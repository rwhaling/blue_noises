import passthroughVertexShader from './shaders/passthrough.vert?raw'
import simpleGradientFragmentShader from './shaders/simplegradient.frag?raw'
import drawTexturePaletteFragmentShader from './shaders/drawTexturePalette.frag?raw'

let frameCount = 0

// Keep essential WebGL globals - remove | null
let gl: WebGLRenderingContext; // Changed
let frameTexture: WebGLTexture; // Changed
let framebuffer: WebGLFramebuffer; // Changed
let positionBuffer: WebGLBuffer; // Changed
let texCoordBuffer: WebGLBuffer; // Changed

// Keep time tracking
let startTime = Date.now();
let FRAMES_PER_SECOND = 60;

// Add back rendering state variables
let isRendering = false;
let currentFrameNumber = 0;
let dirHandle: FileSystemDirectoryHandle | null = null;
const TOTAL_FRAMES = 2880; // Example value, adjust as needed

// Keep gradient noise parameters
let NOISE_CENTER = 0.5;
let NOISE_WIDTH = 0.65;
let NOISE_AMPLITUDE = 0.5;
let NOISE_SPEED = 0.1;
let NOISE_SCALE = 64.0;
let NOISE_OFFSET_SCALE = 0.7;

// Keep gradient wave parameters
let WAVE_AMPLITUDE = 0.15;
let WAVE_XSCALE = 3.4;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.5;   // NEW: time scale for the wave

// Keep gradient colors (These will be used for the PALETTE now)
let GRADIENT_COLOR_A = '#F8B55F';
let GRADIENT_COLOR_B = '#C95792';

// Add back frame padding helper
function padFrameNumber(num: number): string {
    return num.toString().padStart(6, '0');
}

// Keep passthrough vertex shader source
const vertexShaderSource = passthroughVertexShader;

// Keep gradient program, replace drawTextureProgram with paletteProgram
let gradientProgram: WebGLProgram; // Changed
let paletteProgram: WebGLProgram; // Changed name

function initWebGL(canvas: HTMLCanvasElement) {
    const localGl = canvas.getContext('webgl', { // Use a local variable first
        alpha: true,
        preserveDrawingBuffer: true // Re-enable for frame saving
    });
    if (!localGl) { // Check the local variable
        throw new Error('WebGL not supported');
    }
    gl = localGl; // Assign to the global variable

    // Keep blend setup (might not be strictly necessary for only gradient)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Keep buffer setup (used by multiple programs)
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
    ]);
    positionBuffer = gl.createBuffer(); // Removed !
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    // Attribute setup moved to specific program initializations

    const texCoords = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        1, 1,
    ]);
    texCoordBuffer = gl.createBuffer(); // Removed !
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    // Attribute setup moved to specific program initializations

    // Keep frame texture setup
    frameTexture = gl.createTexture(); // Removed !
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Allocation moved to setup

    // Keep framebuffer setup
    framebuffer = gl.createFramebuffer(); // Removed !

    // Remove blurOutputTexture setup
    // blurOutputTexture = gl!.createTexture();
    // ...

    // Remove tempTexture setup
    // tempTexture = gl.createTexture();
    // ...

    // Remove trail textures/framebuffer creation
    // circleTrailTexA = gl!.createTexture();
    // ...
    // circleTrailTexB = gl!.createTexture();
    // ...
    // trailFramebuffer = gl!.createFramebuffer();
    // ...

    // Remove trail blur temp texture creation
    // trailBlurTempTex = gl!.createTexture();
    // ...

    // Allocate only frameTexture
    gl.bindTexture(gl.TEXTURE_2D, frameTexture); // Removed !
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); // Removed !

    // Remove allocation for other textures
    // gl!.bindTexture(gl!.TEXTURE_2D, tempTexture);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, blurOutputTexture);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexA);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexB);
    // ...

    // Remove clearing of unused textures/framebuffers
    // gl!.bindFramebuffer(gl!.FRAMEBUFFER, trailFramebuffer);
    // ...
    // gl!.bindFramebuffer(gl!.FRAMEBUFFER, null); // Unbind (kept for safety, though maybe not needed)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we start unbound
}

export function setup({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) { // Remove canvas2d
    // Remove 2D context setup
    // const ctx = canvas2d.getContext('2d');
    // if (!ctx) {
    //     throw new Error('Failed to get 2D context');
    // }
    
    initWebGL(canvasWebGL);
    // ctx.fillRect(0, 0, canvas2d.width, canvas2d.height); // Removed

    // Remove mouse listener
    // canvasWebGL.addEventListener('mousemove', (event) => { ... })

    // Initialize the gradient and the NEW palette program
    initGradientProgram(gl);
    initPaletteProgram(gl); // Changed function call

    // Remove circles canvas creation
    // circlesCanvas = document.createElement('canvas');
    // ...

    // Remove trail textures/framebuffer creation
    // circleTrailTexA = gl!.createTexture();
    // ...
    // circleTrailTexB = gl!.createTexture();
    // ...
    // trailFramebuffer = gl!.createFramebuffer();
    // ...

    // Remove trail blur temp texture creation
    // trailBlurTempTex = gl!.createTexture();
    // ...

    // Allocate only frameTexture - Remove ! from gl
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Remove allocation for other textures
    // gl!.bindTexture(gl!.TEXTURE_2D, tempTexture);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, blurOutputTexture);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexA);
    // ...
    // gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexB);
    // ...

    // Remove clearing of unused textures/framebuffers
    // gl!.bindFramebuffer(gl!.FRAMEBUFFER, trailFramebuffer);
    // ...
    // gl!.bindFramebuffer(gl!.FRAMEBUFFER, null); // Unbind (kept for safety, though maybe not needed)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we start unbound
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) { // Remove canvas2d
    // Update resource check for paletteProgram
    if (!gl || !framebuffer || !frameTexture ||
        !positionBuffer || !texCoordBuffer ||
        !gradientProgram || !paletteProgram) { // Changed check
        // This check might technically be redundant now due to types,
        // but kept for explicit runtime safety.
        throw new Error('Context or critical resources not initialized');
    }
    // const ctx = canvas2d.getContext('2d'); // Removed

    // --- 1. Draw gradient to frameTexture (offscreen) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameTexture, 0);
    gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
    gl.useProgram(gradientProgram);

    // Set uniforms for colors - Use hardcoded Black and White for the gradient pass
    const colorA_Gradient = hexToRgb01("#000000");
    const colorB_Gradient = hexToRgb01("#FFFFFF");
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorA'), colorA_Gradient);
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorB'), colorB_Gradient);

    // Set time and other uniforms for gradient
    const timeLocation = gl.getUniformLocation(gradientProgram, 'u_time');
    const currentTime = frameCount / FRAMES_PER_SECOND;
    gl.uniform1f(timeLocation, currentTime);
    const noiseCenterLocation = gl.getUniformLocation(gradientProgram, 'u_noiseCenter');
    const noiseWidthLocation = gl.getUniformLocation(gradientProgram, 'u_noiseWidth');
    gl.uniform1f(noiseCenterLocation, NOISE_CENTER);
    gl.uniform1f(noiseWidthLocation, NOISE_WIDTH);
    const noiseAmplitudeLocation = gl.getUniformLocation(gradientProgram, 'u_noiseAmplitude');
    const noiseSpeedLocation = gl.getUniformLocation(gradientProgram, 'u_noiseSpeed');
    const noiseScaleLocation = gl.getUniformLocation(gradientProgram, 'u_noiseScale');
    const noiseOffsetScaleLocation = gl.getUniformLocation(gradientProgram, 'u_noiseOffsetScale');
    gl.uniform1f(noiseAmplitudeLocation, NOISE_AMPLITUDE);
    gl.uniform1f(noiseSpeedLocation, NOISE_SPEED);
    gl.uniform1f(noiseScaleLocation, NOISE_SCALE);
    gl.uniform1f(noiseOffsetScaleLocation, NOISE_OFFSET_SCALE);
    const waveAmplitudeLocation = gl.getUniformLocation(gradientProgram, 'u_waveAmplitude');
    gl.uniform1f(waveAmplitudeLocation, WAVE_AMPLITUDE);
    const waveXScaleLocation = gl.getUniformLocation(gradientProgram, 'u_waveXScale');
    gl.uniform1f(waveXScaleLocation, WAVE_XSCALE);
    const waveTimeScaleLocation = gl.getUniformLocation(gradientProgram, 'u_waveTimeScale');
    gl.uniform1f(waveTimeScaleLocation, WAVE_TIMESCALE);

    // Draw the grayscale gradient quad
    gl.clearColor(0, 0, 0, 0); // Clear with transparent black
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- 7. Draw grayscale texture to screen using PALETTE shader ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
    gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
    gl.useProgram(paletteProgram); // Use the NEW palette program

    // Bind the grayscale texture (frameTexture) to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(gl.getUniformLocation(paletteProgram, "u_image"), 0); // Tell sampler u_image to use texture unit 0

    // Set palette color uniforms using the original GRADIENT_COLOR_A/B variables
    const colorA_Palette = hexToRgb01(GRADIENT_COLOR_A); // Original Orange
    const colorB_Palette = hexToRgb01(GRADIENT_COLOR_B); // Original Purple
    gl.uniform3fv(gl.getUniformLocation(paletteProgram, "u_colorA"), colorA_Palette);
    gl.uniform3fv(gl.getUniformLocation(paletteProgram, "u_colorB"), colorB_Palette);

    // Set u_flipY for drawing to the screen
    gl.uniform1f(gl.getUniformLocation(paletteProgram, "u_flipY"), 1.0);

    // Clear screen before drawing final texture
    gl.clearColor(0, 0, 0, 1); // Clear with opaque black
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the quad, applying the palette
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
    gl.shaderSource(fragmentShader, simpleGradientFragmentShader);
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

// Rename initDrawTextureProgram to initPaletteProgram and update shader source
function initPaletteProgram(gl: WebGLRenderingContext) { // Renamed function
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Add error checking

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader");
    // Use the NEW palette fragment shader source
    gl.shaderSource(fragmentShader, drawTexturePaletteFragmentShader); // Changed source
    gl.compileShader(fragmentShader);
    // TODO: Add error checking & check compile status

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create program");
    paletteProgram = localProgram; // Assign to the renamed global variable
    gl.attachShader(paletteProgram, vertexShader);
    gl.attachShader(paletteProgram, fragmentShader);
    gl.linkProgram(paletteProgram);
    // TODO: Add error checking & check link status

    // Set up attributes using global buffers
    gl.useProgram(paletteProgram); // Use program before getting locations
    const positionLocation = gl.getAttribLocation(paletteProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(paletteProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
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