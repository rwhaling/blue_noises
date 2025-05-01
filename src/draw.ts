import passthroughVertexShader from './shaders/passthrough.vert?raw'
import compositeGridGradientFragmentShader from './shaders/compositeGridGradient.frag?raw'
import gridGradientFragmentShader from './shaders/gridgradient.frag?raw'
import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
import noiseSpectralCompositeFragmentShader from './shaders/noiseSpectralComposite.frag?raw'
let frameCount = 0

// Keep essential WebGL globals - remove | null
let gl: WebGLRenderingContext; // Changed
let frameTexture: WebGLTexture; // Changed
let framebuffer: WebGLFramebuffer; // Changed
let positionBuffer: WebGLBuffer; // Changed
let texCoordBuffer: WebGLBuffer; // Changed

// --- Step 3: Re-introduce Canvas Globals ---
let elementsCanvas: HTMLCanvasElement;
let elementsCtx: CanvasRenderingContext2D;

// --- Step 4: Add Element Texture Globals ---
let elementsTexture: WebGLTexture; // Texture for 2D canvas drawing
let blurredElementsTexture: WebGLTexture; // Texture for blurred elements
let tempBlurTexture: WebGLTexture; // Temp texture for blur ping-pong

// --- Step 5: Add Blur Framebuffer Global ---
let blurFramebuffer: WebGLFramebuffer; // FBO for blur passes

// Keep time tracking
let startTime = Date.now();
let FRAMES_PER_SECOND = 60;
let currentTime = 0.0; // CHANGED: Made global and initialized

// Add back rendering state variables
let isRendering = false;
let currentFrameNumber = 0;
let dirHandle: FileSystemDirectoryHandle | null = null;
const TOTAL_FRAMES = 5550; // Example value, adjust as needed

// --- Step 2: Add Blur Parameters ---
const BLUR_RADIUS = 3.0; // Example blur radius
const BLUR_PASSES = 0;   // Example blur passes

// Keep gradient noise parameters
let NOISE_CENTER = 0.4;
let NOISE_WIDTH = 0.55;
let NOISE_AMPLITUDE = 1.2;
let NOISE_SPEED = 0.8;          // Speed for displacement noise
let NOISE_SCALE = 1.51; // 5.11, 1.51, 0.33
let NOISE_OFFSET_SCALE = 0.7;
let GRID_SCALE = 1.51; 
let GRID_ROTATION = 0.0;
let GRID_AXIS_SCALE = [2.0, 1.0];
let GRID_WAVE_SPEED = 0.6;      // EDIT: Added constant for sine wave speed

// --- ADDED: Separate noise parameters for shape displacement ---
let SHAPE_NOISE_AMPLITUDE = 4.04; // Initial value, same as original for now
let SHAPE_NOISE_SCALE = 1.51;     // Initial value, same as original for now

// --- ADDED: High-frequency noise parameters for shape displacement ---
let HIGH_FREQ_SHAPE_NOISE_AMOUNT = 0.0; // Start with a smaller amount
let HIGH_FREQ_SHAPE_NOISE_SCALE = 32.0; // Start with a higher scale

// Keep gradient wave parameters
let WAVE_AMPLITUDE = 1.2;
let WAVE_XSCALE = 0.1;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.1;   // NEW: time scale for the wave

// --- ADDED: Time Pulse Parameters ---
let TIME_PULSE_FREQUENCY = 1; // Example frequency (cycles per second)
let TIME_PULSE_AMOUNT = 0.1;    // Example amount (0 to 1 typical)

// Palette Colors
let GRADIENT_COLOR_A = '#100F0F'; // Base Color AED4596
let GRADIENT_COLOR_B = '#3734DA'; // Base Color swap to A145ED
// --- Step 1: Add New Color Constants ---
let PALETTE_COLOR_C = '#C73868'; // Color for opaque black elements - CHANGED to let
let PALETTE_COLOR_D = '#F2585B'; // Color for opaque white elements (unused for now) - CHANGED to let

let PALETTE_COLOR_E = '#C73868';
let PALETTE_COLOR_F = '#F2585B';
// 33E6DA
// 3734DA
// 
// A145ED
// ED4596
// C73868

// 8F34DA
// AED4596

// 8F34DA
// 3171B2

// 261C39
// 3171B2

// 261C39
// 3734DA

/* purple/black on teal/blue
#33E6DA
#3734DA
#ED4596
#261C39
*/

/* very nice red/orange on blue/magenta
#ED4596
#3734DA -- nice with 205EA6 too
#C73868
#F2585B
*/

/*
#100F0F
#205EA6 -- nice with 3734DA too
#C73868
#F2585B
*/

/*
#100F0F
#205EA6 -- nice with 3734DA too
#C73868
#69A1CC
*/

/* dark mirror - nice to introduce a new color/particles
#100F0F
#205EA6 -- nice with 3734DA too
#205EA6
#100F0F
*/


// let GRADIENT_COLOR_A = '#3171B2'; // Base Color AED4596
// let GRADIENT_COLOR_B = '#3171B2'; 

// let GRADIENT_COLOR_A = '#C73868'; // Base Color AED4596
// let GRADIENT_COLOR_B = '#3171B2'; // Base Color swap to A145ED
// // --- Step 1: Add New Color Constants ---
// const PALETTE_COLOR_C = '#261C39'; // Color for opaque black elements
// const PALETTE_COLOR_D = '#AED4596'; // Color for opaque white elements (unused for now)



// Add back frame padding helper
function padFrameNumber(num: number): string {
    return num.toString().padStart(6, '0');
}

// Keep passthrough vertex shader source
const vertexShaderSource = passthroughVertexShader;

// Keep gradient program, add blur program, rename palette to spectralComposite
let gradientProgram: WebGLProgram; // Changed
let blurProgram: WebGLProgram;
let spectralCompositeProgram: WebGLProgram; // Changed name

function initWebGL(canvas: HTMLCanvasElement) {
    const localGl = canvas.getContext('webgl', {
        alpha: true,
        preserveDrawingBuffer: true
    });
    if (!localGl) {
        throw new Error('WebGL not supported');
    }
    gl = localGl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // --- Create Buffers ---
    const positions = new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]);
    positionBuffer = gl.createBuffer();
    if (!positionBuffer) throw new Error("Failed to create position buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]);
    texCoordBuffer = gl.createBuffer();
    if (!texCoordBuffer) throw new Error("Failed to create texCoord buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // --- Create Textures (Step 7) ---
    frameTexture = gl.createTexture();
    if (!frameTexture) throw new Error("Failed to create frameTexture");
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    elementsTexture = gl.createTexture(); // New
    if (!elementsTexture) throw new Error("Failed to create elementsTexture");
    gl.bindTexture(gl.TEXTURE_2D, elementsTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    blurredElementsTexture = gl.createTexture(); // New
    if (!blurredElementsTexture) throw new Error("Failed to create blurredElementsTexture");
    gl.bindTexture(gl.TEXTURE_2D, blurredElementsTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    tempBlurTexture = gl.createTexture(); // New
    if (!tempBlurTexture) throw new Error("Failed to create tempBlurTexture");
    gl.bindTexture(gl.TEXTURE_2D, tempBlurTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // --- Create Framebuffers (Step 7) ---
    framebuffer = gl.createFramebuffer(); // For gradient pass
    if (!framebuffer) throw new Error("Failed to create framebuffer");

    blurFramebuffer = gl.createFramebuffer(); // New: For blur passes
    if (!blurFramebuffer) throw new Error("Failed to create blurFramebuffer");


    // --- Initial Allocation ---
    // Will be done in setup based on actual canvas size
    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we start unbound
}

export function setup({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    initWebGL(canvasWebGL);

    // --- Step 8: Create elements canvas and context ---
    elementsCanvas = document.createElement('canvas');
    elementsCanvas.width = canvasWebGL.width;
    elementsCanvas.height = canvasWebGL.height;
    const localCtx = elementsCanvas.getContext('2d');
    if (!localCtx) {
        throw new Error("Failed to get 2D context for elements canvas");
    }
    elementsCtx = localCtx;

    // --- Step 8: Allocate Textures ---
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, elementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, blurredElementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, tempBlurTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind

    // --- Step 8: Initialize Programs ---
    initGradientProgram(gl);
    initBlurProgram(gl);
    initSpectralCompositeProgram(gl);


    // Clear blur textures initially (optional, good practice)
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurredElementsTexture, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempBlurTexture, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);


    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we end unbound
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // --- Step 15a: Update resource check ---
    if (!gl || !framebuffer || !frameTexture ||
        !elementsCanvas || !elementsCtx || !elementsTexture || // Added elements check
        !blurFramebuffer || !blurredElementsTexture || !tempBlurTexture || // Added blur texture check
        !positionBuffer || !texCoordBuffer ||
        !gradientProgram || !blurProgram || !spectralCompositeProgram) { // Added blurProgram check
        // This check might technically be redundant now due to types,
        // but kept for explicit runtime safety.
        throw new Error('Context or critical resources not initialized');
    }

    const width = canvasWebGL.width;
    const height = canvasWebGL.height;
    // const currentTime = frameCount / FRAMES_PER_SECOND; // REMOVED old calculation

    // --- UPDATE: Calculate time increment with pulse ---
    const timeIncrementBase = 1.0 / FRAMES_PER_SECOND;
    // Calculate nominal time based on frame count for stable pulse
    const nominalTime = frameCount / FRAMES_PER_SECOND; // EDIT: Use frameCount for pulse input
    const pulseFactor = 1.0 + TIME_PULSE_AMOUNT * Math.cos(nominalTime * TIME_PULSE_FREQUENCY * 2.0 * Math.PI); // EDIT: Use nominalTime
    const timeIncrement = timeIncrementBase * pulseFactor;
    currentTime += timeIncrement; // Increment global currentTime
    // --- End Time Update ---

    // --- Pass 1: Draw gradient to frameTexture (offscreen) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameTexture, 0);
    gl.viewport(0, 0, width, height);
    gl.useProgram(gradientProgram);

    // Set uniforms for B&W gradient pass
    const colorA_Gradient = hexToRgb01("#000000");
    const colorB_Gradient = hexToRgb01("#FFFFFF");
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorA'), colorA_Gradient);
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorB'), colorB_Gradient);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_time'), currentTime);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseCenter'), NOISE_CENTER);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseWidth'), NOISE_WIDTH);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseAmplitude'), NOISE_AMPLITUDE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseSpeed'), NOISE_SPEED);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseScale'), NOISE_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseOffsetScale'), NOISE_OFFSET_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveAmplitude'), WAVE_AMPLITUDE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveXScale'), WAVE_XSCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveTimeScale'), WAVE_TIMESCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_gridScale'), GRID_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_gridRotation'), GRID_ROTATION);
    gl.uniform2fv(gl.getUniformLocation(gradientProgram, 'u_gridAxisScale'), GRID_AXIS_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_gridWaveSpeed'), GRID_WAVE_SPEED);

    // Draw the grayscale gradient quad
    gl.clearColor(0, 0, 0, 0); // Clear FBO with transparent black
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- Pass 2: Draw 2D elements to elementsTexture ---
    // Clear the 2D canvas (transparent)
    elementsCtx.clearRect(0, 0, elementsCanvas.width, elementsCanvas.height);

    // Draw the custom stretched hexagon
    elementsCtx.fillStyle = 'black'; // Opaque black
    elementsCtx.beginPath();
    const centerX = elementsCanvas.width / 2;
    const centerY = elementsCanvas.height / 2;
    const R = 150; // Base radius, determines horizontal extent and angled side length

    // Calculate vertex coordinates based on the desired shape:
    // - Vertical sides (connecting side vertices) should have length 2*R
    // - Angled sides (connecting top/bottom to sides) should have length R
    const ryTop = R * 1.5;              // Top/Bottom Y offset (derived: 3R/2)
    const ySide = R;                    // Side vertices Y offset (to make vertical side 2R)
    const xSide = R * Math.sqrt(3) / 2; // Side vertices X offset (from regular hexagon)

    // Define the 6 vertices relative to center
    const points = [
        { x: 0,       y: ryTop },  // 1. Top
        { x: xSide,   y: ySide },  // 2. Top-Right
        { x: xSide,   y: -ySide }, // 3. Bottom-Right
        { x: 0,       y: -ryTop }, // 4. Bottom
        { x: -xSide,  y: -ySide }, // 5. Bottom-Left
        { x: -xSide,  y: ySide }   // 6. Top-Left
    ];

    // Move to the first vertex (Top)
    elementsCtx.moveTo(centerX + points[0].x, centerY + points[0].y);

    // Draw lines to subsequent vertices
    for (let i = 1; i < points.length; i++) {
        elementsCtx.lineTo(centerX + points[i].x, centerY + points[i].y);
    }

    elementsCtx.closePath(); // Close the path to complete the hexagon
    elementsCtx.fill();

    // Upload canvas to elementsTexture (use texture unit 0 temporarily)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, elementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementsCanvas);

    // --- Pass 3: Blur elementsTexture into blurredElementsTexture ---
    let readTex = elementsTexture;
    let writeTex = blurredElementsTexture;
    let finalBlurredTexture = elementsTexture; // Default if BLUR_PASSES is 0

    if (BLUR_PASSES > 0 && BLUR_RADIUS > 0) {
        gl.useProgram(blurProgram);
        gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), width, height);
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_blurRadius"), BLUR_RADIUS);
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_time"), currentTime); // Pass time if blur shader uses it
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_flipY"), 0.0); // IMPORTANT: Flip Y is 0.0 for FBO rendering

        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer); // Use the dedicated blur FBO
        gl.viewport(0, 0, width, height); // Set viewport for FBO

        for (let i = 0; i < BLUR_PASSES; ++i) {
            // Set the target texture for this pass
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTex, 0);

            // Bind the texture to read from
            gl.activeTexture(gl.TEXTURE0); // Use texture unit 0 for blur input
            gl.bindTexture(gl.TEXTURE_2D, readTex);
            gl.uniform1i(gl.getUniformLocation(blurProgram, "u_image"), 0);

            // Execute blur pass
            gl.clearColor(0, 0, 0, 0); // Clear FBO just in case
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Swap textures for next pass
            [readTex, writeTex] = [writeTex, readTex]; // Ping-pong
        }
        finalBlurredTexture = readTex; // The last texture read from is the final result
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind the blur FBO
    } else {
        finalBlurredTexture = elementsTexture; // Use original if no blur
    }


    // --- Pass 4: Composite to screen using spectral shader ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
    gl.viewport(0, 0, width, height);
    gl.useProgram(spectralCompositeProgram);

    // Bind gradient texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_gradientTex"), 0);

    // Bind blurred elements texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, finalBlurredTexture);
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_elementsTex"), 1);

    // Set palette color uniforms
    const colorA_Palette = hexToRgb01(GRADIENT_COLOR_A);
    const colorB_Palette = hexToRgb01(GRADIENT_COLOR_B);
    const colorC_Palette = hexToRgb01(PALETTE_COLOR_C);
    const colorD_Palette = hexToRgb01(PALETTE_COLOR_D);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorA"), colorA_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorB"), colorB_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorC"), colorC_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorD"), colorD_Palette);

    // Set u_flipY for drawing to the screen
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, "u_flipY"), 1.0);

    // --- Pass Noise/Grid uniforms for displacement ---
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_time'), currentTime);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_noiseSpeed'), NOISE_SPEED);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_noiseScale'), NOISE_SCALE);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_gridScale'), GRID_SCALE);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_gridRotation'), GRID_ROTATION);
    gl.uniform2fv(gl.getUniformLocation(spectralCompositeProgram, 'u_gridAxisScale'), GRID_AXIS_SCALE);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_noiseAmplitude'), NOISE_AMPLITUDE);
    // --- Use NEW Shape-Specific Uniforms ---
    // NOTE: We will rename these uniforms in the shader itself in the next step
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_shapeNoiseScale'), SHAPE_NOISE_SCALE);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_shapeNoiseAmplitude'), SHAPE_NOISE_AMPLITUDE);
    // --- ADDED: High Frequency Shape Noise ---
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_hfShapeNoiseScale'), HIGH_FREQ_SHAPE_NOISE_SCALE);
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, 'u_hfShapeNoiseAmount'), HIGH_FREQ_SHAPE_NOISE_AMOUNT);
    // --- End Uniforms ---

    // Clear screen before drawing final texture
    gl.clearColor(0, 0, 0, 1); // Clear with opaque black
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the final composited quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    frameCount++;
}

// Add back rendering control functions
async function startRendering() {
    try {
        dirHandle = await window.showDirectoryPicker();
        currentFrameNumber = 0;
        isRendering = true;
        console.log('Starting render sequence...');
    } catch (err: any) { // Added type annotation for err
        console.error(err.name, err.message);
    }
}

async function saveCurrentFrame(canvas: HTMLCanvasElement) {
    if (!dirHandle) return;

    const frameToSave = currentFrameNumber;  // Capture the frame number immediately
    try {
        const filename = `frame_${padFrameNumber(frameToSave)}.png`;  // Use captured value
        
        const dataUrl = canvas.toDataURL('image/png');
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        
        console.log(`Saved ${filename}`);
        
        currentFrameNumber = frameToSave + 1;  // Increment based on captured value
        
        if (currentFrameNumber >= TOTAL_FRAMES) {
            isRendering = false;
            dirHandle = null;
            console.log('Render sequence complete!');
        }
    } catch (err) {
        console.error('Failed to save frame:', err);
        isRendering = false;
        dirHandle = null;
    }
}

export function start(contexts: CanvasContexts) {
    // Modify animation loop for conditional saving
    async function animate() {
        draw(contexts);
        
        if (isRendering) {
            // Need to pass the correct canvas (canvasWebGL) to saveCurrentFrame
            await saveCurrentFrame(contexts.canvasWebGL);
            // Only request next frame if still rendering
            if (isRendering) {
            requestAnimationFrame(animate);
            }
        } else {
            requestAnimationFrame(animate); // Continue animation even when not saving
        }
    }

    // Add back render button listener
    const renderButton = document.querySelector('#render-button');
    renderButton?.addEventListener('click', startRendering);
    
    // --- SLIDER SETUP ---
    const noiseAmpSlider = document.getElementById('noise-amplitude-slider') as HTMLInputElement;
    const noiseAmpValueSpan = document.getElementById('noise-amplitude-value');
    const noiseScaleSlider = document.getElementById('noise-scale-slider') as HTMLInputElement;
    const noiseScaleValueSpan = document.getElementById('noise-scale-value');
    const noiseSpeedSlider = document.getElementById('noise-speed-slider') as HTMLInputElement;
    const noiseSpeedValueSpan = document.getElementById('noise-speed-value');
    const gridScaleSlider = document.getElementById('grid-scale-slider') as HTMLInputElement;
    const gridScaleValueSpan = document.getElementById('grid-scale-value');
    const gridWaveSpeedSlider = document.getElementById('grid-wave-speed-slider') as HTMLInputElement;
    const gridWaveSpeedValueSpan = document.getElementById('grid-wave-speed-value');

    // --- ADDED: Get new shape sliders ---
    const shapeAmpSlider = document.getElementById('shape-amplitude-slider') as HTMLInputElement;
    const shapeAmpValueSpan = document.getElementById('shape-amplitude-value');
    const shapeScaleSlider = document.getElementById('shape-scale-slider') as HTMLInputElement;
    const shapeScaleValueSpan = document.getElementById('shape-scale-value');

    // --- ADDED: Get new HF shape sliders ---
    const hfShapeAmountSlider = document.getElementById('hf-shape-amount-slider') as HTMLInputElement;
    const hfShapeAmountValueSpan = document.getElementById('hf-shape-amount-value');
    const hfShapeScaleSlider = document.getElementById('hf-shape-scale-slider') as HTMLInputElement;
    const hfShapeScaleValueSpan = document.getElementById('hf-shape-scale-value');

    // --- ADDED: Get new time pulse sliders ---
    const timePulseFreqSlider = document.getElementById('time-pulse-freq-slider') as HTMLInputElement;
    const timePulseFreqValueSpan = document.getElementById('time-pulse-freq-value');
    const timePulseAmountSlider = document.getElementById('time-pulse-amount-slider') as HTMLInputElement;
    const timePulseAmountValueSpan = document.getElementById('time-pulse-amount-value');

    // --- Toggle Controls Button Setup ---
    const toggleBtn = document.getElementById('toggle-controls-button') as HTMLButtonElement;
    const sliderContainer = document.getElementById('slider-container'); // Get container too

    if (toggleBtn && sliderContainer) {
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = sliderContainer.classList.toggle('collapsed');
            toggleBtn.textContent = isCollapsed ? 'Show Controls' : 'Hide Controls';
        });
    }
    // --- End Toggle Controls Button Setup ---

    // --- COLOR INPUT SETUP ---
    const colorAInput = document.getElementById('color-a-input') as HTMLInputElement;
    const colorBInput = document.getElementById('color-b-input') as HTMLInputElement;
    const colorCInput = document.getElementById('color-c-input') as HTMLInputElement;
    const colorDInput = document.getElementById('color-d-input') as HTMLInputElement;

    // Helper to validate hex color (simple check)
    const isValidHex = (hex: string): boolean => /^#[0-9A-F]{6}$/i.test(hex) || /^#[0-9A-F]{3}$/i.test(hex);

    if (colorAInput) {
        colorAInput.value = GRADIENT_COLOR_A; // Ensure initial value sync
        colorAInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (isValidHex(value)) {
                GRADIENT_COLOR_A = value;
                colorAInput.style.borderColor = ''; // Reset border on valid
            } else {
                colorAInput.style.borderColor = 'red'; // Indicate error
            }
        });
    }
    if (colorBInput) {
        colorBInput.value = GRADIENT_COLOR_B; // Ensure initial value sync
        colorBInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (isValidHex(value)) {
                GRADIENT_COLOR_B = value;
                colorBInput.style.borderColor = ''; 
            } else {
                colorBInput.style.borderColor = 'red'; 
            }
        });
    }
    if (colorCInput) {
        colorCInput.value = PALETTE_COLOR_C; // Ensure initial value sync
        colorCInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (isValidHex(value)) {
                PALETTE_COLOR_C = value;
                colorCInput.style.borderColor = ''; 
            } else {
                colorCInput.style.borderColor = 'red'; 
            }
        });
    }
    if (colorDInput) {
        colorDInput.value = PALETTE_COLOR_D; // Ensure initial value sync
        colorDInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (isValidHex(value)) {
                PALETTE_COLOR_D = value;
                colorDInput.style.borderColor = ''; 
            } else {
                colorDInput.style.borderColor = 'red'; 
            }
        });
    }
    // --- END COLOR INPUT SETUP ---

    if (noiseAmpSlider && noiseAmpValueSpan) {
        noiseAmpSlider.value = (NOISE_AMPLITUDE * 25.0).toString(); // Set initial slider position
        noiseAmpValueSpan.textContent = NOISE_AMPLITUDE.toFixed(2);
        noiseAmpSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            NOISE_AMPLITUDE = sliderValue / 25.0;
            noiseAmpValueSpan.textContent = NOISE_AMPLITUDE.toFixed(2);
        });
    }
    if (noiseScaleSlider && noiseScaleValueSpan) {
        // Reverse the quadratic scale to set initial slider position approximately
        const initialS_noise = Math.sqrt((NOISE_SCALE - 0.1) / 63.9);
        noiseScaleSlider.value = (initialS_noise * 100.0).toString();
        noiseScaleValueSpan.textContent = NOISE_SCALE.toFixed(2);
        noiseScaleSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            const s = sliderValue / 100.0;
            NOISE_SCALE = 0.1 + s * s * 63.9;
            noiseScaleValueSpan.textContent = NOISE_SCALE.toFixed(2);
        });
    }
    if (noiseSpeedSlider && noiseSpeedValueSpan) {
        noiseSpeedSlider.value = (NOISE_SPEED * 10.0).toString(); // Set initial slider position
        noiseSpeedValueSpan.textContent = NOISE_SPEED.toFixed(1);
        noiseSpeedSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            NOISE_SPEED = sliderValue / 10.0;
            noiseSpeedValueSpan.textContent = NOISE_SPEED.toFixed(1);
        });
    }
    if (gridScaleSlider && gridScaleValueSpan) {
        // Reverse the quadratic scale to set initial slider position approximately
        const initialS_grid = Math.sqrt((GRID_SCALE - 1.0) / 63.0);
        gridScaleSlider.value = (initialS_grid * 100.0).toString();
        gridScaleValueSpan.textContent = GRID_SCALE.toFixed(2);
        gridScaleSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            const s = sliderValue / 100.0;
            GRID_SCALE = 1.0 + s * s * 63.0;
            gridScaleValueSpan.textContent = GRID_SCALE.toFixed(2);
        });
    }
    if (gridWaveSpeedSlider && gridWaveSpeedValueSpan) {
        gridWaveSpeedSlider.value = (GRID_WAVE_SPEED * 100.0).toString(); // Set initial slider position
        gridWaveSpeedValueSpan.textContent = GRID_WAVE_SPEED.toFixed(2);
        gridWaveSpeedSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            GRID_WAVE_SPEED = sliderValue / 100.0;
            gridWaveSpeedValueSpan.textContent = GRID_WAVE_SPEED.toFixed(2);
        });
    }

    // Listeners for base shape sliders
    if (shapeAmpSlider && shapeAmpValueSpan) {
        shapeAmpSlider.value = (SHAPE_NOISE_AMPLITUDE * 25.0).toString();
        shapeAmpValueSpan.textContent = SHAPE_NOISE_AMPLITUDE.toFixed(2);
        shapeAmpSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            SHAPE_NOISE_AMPLITUDE = sliderValue / 25.0;
            shapeAmpValueSpan.textContent = SHAPE_NOISE_AMPLITUDE.toFixed(2);
        });
    }
    if (shapeScaleSlider && shapeScaleValueSpan) {
        const initialS_shape = Math.sqrt((SHAPE_NOISE_SCALE - 0.1) / 63.9);
        shapeScaleSlider.value = (initialS_shape * 100.0).toString();
        shapeScaleValueSpan.textContent = SHAPE_NOISE_SCALE.toFixed(2);
        shapeScaleSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            const s = sliderValue / 100.0;
            SHAPE_NOISE_SCALE = 0.1 + s * s * 63.9;
            shapeScaleValueSpan.textContent = SHAPE_NOISE_SCALE.toFixed(2);
        });
    }

    // --- ADDED: Listeners for new HF shape sliders ---
    if (hfShapeAmountSlider && hfShapeAmountValueSpan) {
        // Using a similar scale to amplitude for now, adjust max value if needed
        hfShapeAmountSlider.value = (HIGH_FREQ_SHAPE_NOISE_AMOUNT * 25.0).toString();
        hfShapeAmountValueSpan.textContent = HIGH_FREQ_SHAPE_NOISE_AMOUNT.toFixed(2);
        hfShapeAmountSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HIGH_FREQ_SHAPE_NOISE_AMOUNT = sliderValue / 25.0; // Or maybe / 50.0 or 100.0 for finer control
            hfShapeAmountValueSpan.textContent = HIGH_FREQ_SHAPE_NOISE_AMOUNT.toFixed(2);
        });
    }
    if (hfShapeScaleSlider && hfShapeScaleValueSpan) {
        // Using similar quadratic scale
        const initialS_hf_shape = Math.sqrt((HIGH_FREQ_SHAPE_NOISE_SCALE - 0.1) / 63.9);
        hfShapeScaleSlider.value = (initialS_hf_shape * 100.0).toString();
        hfShapeScaleValueSpan.textContent = HIGH_FREQ_SHAPE_NOISE_SCALE.toFixed(2);
        hfShapeScaleSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            const s = sliderValue / 100.0;
            // Adjust max scale if needed (e.g., 127.9 instead of 63.9 for higher frequencies)
            HIGH_FREQ_SHAPE_NOISE_SCALE = 0.1 + s * s * 63.9; // Or higher max
            hfShapeScaleValueSpan.textContent = HIGH_FREQ_SHAPE_NOISE_SCALE.toFixed(2);
        });
    }
    // --- END SLIDER SETUP ---

    // --- ADDED: Listeners for new time pulse sliders ---
    if (timePulseFreqSlider && timePulseFreqValueSpan) {
        // Example scale: 0 to 5 Hz, linear
        timePulseFreqSlider.value = (TIME_PULSE_FREQUENCY * 20.0).toString(); // 0-100 maps to 0-5
        timePulseFreqValueSpan.textContent = TIME_PULSE_FREQUENCY.toFixed(2);
        timePulseFreqSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            TIME_PULSE_FREQUENCY = sliderValue / 20.0;
            timePulseFreqValueSpan.textContent = TIME_PULSE_FREQUENCY.toFixed(2);
        });
    }
    if (timePulseAmountSlider && timePulseAmountValueSpan) {
        // Example scale: 0 to 1 amount, linear
        timePulseAmountSlider.value = (TIME_PULSE_AMOUNT * 100.0).toString(); // 0-100 maps to 0-1
        timePulseAmountValueSpan.textContent = TIME_PULSE_AMOUNT.toFixed(2);
        timePulseAmountSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            TIME_PULSE_AMOUNT = sliderValue / 100.0;
            timePulseAmountValueSpan.textContent = TIME_PULSE_AMOUNT.toFixed(2);
        });
    }
    // --- END SLIDER SETUP ---

    setup(contexts);
    animate();
}

// Keep initGradientProgram - no ! needed for gl, positionBuffer, texCoordBuffer
function initGradientProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER); // Removed !
    if (!vertexShader) throw new Error("Couldn't create vertex shader"); // Added check
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Add error checking

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER); // Removed !
    if (!fragmentShader) throw new Error("Couldn't create fragment shader"); // Added check
    gl.shaderSource(fragmentShader, compositeGridGradientFragmentShader);
    gl.compileShader(fragmentShader);
    // TODO: Add error checking

    const localProgram = gl.createProgram(); // Removed !
    if (!localProgram) throw new Error("Couldn't create program"); // Added check
    gradientProgram = localProgram; // Assign to global
    gl.attachShader(gradientProgram, vertexShader);
    gl.attachShader(gradientProgram, fragmentShader);
    gl.linkProgram(gradientProgram);
    // TODO: Add error checking

    // Set up attributes using global buffers
    gl.useProgram(gradientProgram); // Use program before getting locations
    const positionLocation = gl.getAttribLocation(gradientProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(gradientProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// --- Step 9: Implement initBlurProgram ---
function initBlurProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for blur");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Check compile status: gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for blur");
    gl.shaderSource(fragmentShader, blurFragmentShader); // Use blur shader source
    gl.compileShader(fragmentShader);
    // TODO: Check compile status: gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create blur program");
    blurProgram = localProgram; // Assign to the global variable
    gl.attachShader(blurProgram, vertexShader);
    gl.attachShader(blurProgram, fragmentShader);
    gl.linkProgram(blurProgram);
    // TODO: Check link status: gl.getProgramParameter(blurProgram, gl.LINK_STATUS)

    // Set up attributes using global buffers
    gl.useProgram(blurProgram); // Use program before getting locations

    const positionLocation = gl.getAttribLocation(blurProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(blurProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// Remove placeholder/old initPaletteProgram - Will be replaced by initSpectralCompositeProgram
// function initPaletteProgram(gl: WebGLRenderingContext) { ... }


// --- Step 10: Implement initSpectralCompositeProgram ---
function initSpectralCompositeProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for composite");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Check compile status

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for composite");
    gl.shaderSource(fragmentShader, noiseSpectralCompositeFragmentShader);
    gl.compileShader(fragmentShader);
    // TODO: Check compile status

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create spectral composite program");
    spectralCompositeProgram = localProgram;
    gl.attachShader(spectralCompositeProgram, vertexShader);
    gl.attachShader(spectralCompositeProgram, fragmentShader);
    gl.linkProgram(spectralCompositeProgram);
    // TODO: Check link status

    // Set up attributes
    gl.useProgram(spectralCompositeProgram);
    const positionLocation = gl.getAttribLocation(spectralCompositeProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(spectralCompositeProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// Keep helper function to convert hex to [r, g, b] in 0..1
function hexToRgb01(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return [
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
    ];
}