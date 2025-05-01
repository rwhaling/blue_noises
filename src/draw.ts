// REMOVE Shader imports
// import passthroughVertexShader from './shaders/passthrough.vert?raw'
// import compositeGridGradientFragmentShader from './shaders/compositeGridGradient.frag?raw'
// import gridGradientFragmentShader from './shaders/gridgradient.frag?raw'
// import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
// import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
// import noiseSpectralCompositeFragmentShader from './shaders/noiseSpectralComposite.frag?raw'

// ADD Renderer import
import { Renderer, GradientUniforms, BlurUniforms, CompositeUniforms } from './render'; // Adjust path if needed

let frameCount = 0;

// REMOVE WebGL Globals
// let gl: WebGLRenderingContext;
// let frameTexture: WebGLTexture;
// let framebuffer: WebGLFramebuffer;
// let positionBuffer: WebGLBuffer;
// let texCoordBuffer: WebGLBuffer;
// let elementsTexture: WebGLTexture;
// let blurredElementsTexture: WebGLTexture;
// let tempBlurTexture: WebGLTexture;
// let blurFramebuffer: WebGLFramebuffer;
// let gradientProgram: WebGLProgram;
// let blurProgram: WebGLProgram;
// let spectralCompositeProgram: WebGLProgram;

// ADD Renderer instance variable
let renderer: Renderer | null = null; // To hold the Renderer instance

// Keep 2D Canvas Globals
let elementsCanvas: HTMLCanvasElement;
let elementsCtx: CanvasRenderingContext2D;

// Keep time tracking
let startTime = Date.now();
let FRAMES_PER_SECOND = 60;
let currentTime = 0.0; // CHANGED: Made global and initialized

// Add back rendering state variables
let isRendering = false;
let currentFrameNumber = 0;
let dirHandle: FileSystemDirectoryHandle | null = null;
const TOTAL_FRAMES = 5550; // Example value, adjust as needed

// --- ADDED: Simple Animation State ---
let isAnimating = false;
let animationStartTime = 0;
const ANIMATION_DURATION = 2000; // Duration in milliseconds (e.g., 2 seconds)
let startValues = { gridScale: 0, shapeAmplitude: 0, gradientAmplitude: 0 };
let endValues = { gridScale: 1.0, shapeAmplitude: 6.0, gradientAmplitude: 1.0 };
// --- End Animation State ---


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
let SHAPE_NOISE_AMPLITUDE = 0.00; // Initial value, same as original for now
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

// --- ADDED: Pulse Sync Frequency ---
let PULSE_SYNC_FREQ = 1.0; // Retrigger frequency (1 = one cycle per width travelled)

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

// --- ADDED: Snapshot State ---
let snapshotValues = {
    gridScale: GRID_SCALE, // Initialize with current defaults
    shapeAmplitude: SHAPE_NOISE_AMPLITUDE,
    gradientAmplitude: NOISE_AMPLITUDE
};
// --- End Snapshot State ---


// Keep padFrameNumber
function padFrameNumber(num: number): string {
    return num.toString().padStart(6, '0');
}

// REMOVE vertexShaderSource constant
// const vertexShaderSource = passthroughVertexShader;

// REMOVE old program variables (already removed above)
// let gradientProgram: WebGLProgram;
// let blurProgram: WebGLProgram;
// let spectralCompositeProgram: WebGLProgram;

// REMOVE initWebGL function
// function initWebGL(canvas: HTMLCanvasElement) { ... }

// --- ADDED: Fixed Shape Center ---
let SHAPE_CENTER_X: number | null = null;

// --- UPDATED: Hexagon Pulse/Window Parameters ---
let HEXAGON_PULSE_START: number | null = null; // Base start position
let HEXAGON_WIDTH = 150 * Math.sqrt(3);
let HEXAGON_PULSE_SPEED = 0.0; // RENAMED from OFFSET, represents pixels/sec speed
let hexagonPhase = 0.0; // Accumulated phase/distance travelled
let HEXAGON_HEIGHT = 225; // NEW: Vertical distance from center to apex (default based on R=150 * 1.5)

export function setup({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // REMOVE old initWebGL call
    // initWebGL(canvasWebGL);

    // --- Step 8: Create elements canvas and context (KEEP) ---
    elementsCanvas = document.createElement('canvas');
    elementsCanvas.width = canvasWebGL.width;
    elementsCanvas.height = canvasWebGL.height;
    const localCtx = elementsCanvas.getContext('2d');
    if (!localCtx) {
        throw new Error("Failed to get 2D context for elements canvas");
    }
    elementsCtx = localCtx;

    // REMOVE Texture Allocation (now handled by Renderer.resize/init)
    // gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // ... and other texImage2D calls ...
    // gl.bindTexture(gl.TEXTURE_2D, null); // Unbind

    // REMOVE Program Initialization calls (now handled by Renderer.init)
    // initGradientProgram(gl);
    // initBlurProgram(gl);
    // initSpectralCompositeProgram(gl);

    // REMOVE Initial Blur Texture Clear (now handled by Renderer.resize/init)
    // gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
    // ... clear calls ...
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we end unbound

    // ADD Renderer instantiation and initialization
    renderer = new Renderer(canvasWebGL);
    renderer.init();

    // Initialize SHAPE_CENTER_X (fixed)
    SHAPE_CENTER_X = canvasWebGL.width / 2;
    // Initialize HEXAGON_PULSE_START (controlled by slider, defaults to center)
    HEXAGON_PULSE_START = canvasWebGL.width / 2; // Still default to center for initial load
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // --- Step 15a: Update resource check ---
    // ADD check for renderer instance
    if (!renderer || !elementsCanvas || !elementsCtx) {
         throw new Error('Renderer or elements canvas not initialized');
    }

    const width = canvasWebGL.width;
    const height = canvasWebGL.height;

    // --- ADD BACK: Time Calculation ---
    const timeIncrementBase = 1.0 / FRAMES_PER_SECOND;
    // Calculate nominal time based on frame count for stable pulse
    const nominalTime = frameCount / FRAMES_PER_SECOND;
    const pulseFactor = 1.0 + TIME_PULSE_AMOUNT * Math.cos(nominalTime * TIME_PULSE_FREQUENCY * 2.0 * Math.PI);
    const timeIncrement = timeIncrementBase * pulseFactor;
    currentTime += timeIncrement; // Increment global currentTime
    // console.log(`draw.ts - Frame: ${frameCount}, CurrentTime: ${currentTime.toFixed(3)}`); // Optional DEBUG
    // --- End Time Calculation ---

    // --- Update Hexagon Phase (based on speed and time increment) ---
    hexagonPhase += HEXAGON_PULSE_SPEED * timeIncrement;
    // --- End Phase Update ---

    // --- Handle Simple Animation ---
    if (isAnimating) {
        const elapsedTime = Date.now() - animationStartTime;
        const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1.0); // Clamp progress to 0-1

        // Linear interpolation (lerp)
        const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

        GRID_SCALE = lerp(startValues.gridScale, endValues.gridScale, progress);
        SHAPE_NOISE_AMPLITUDE = lerp(startValues.shapeAmplitude, endValues.shapeAmplitude, progress);
        NOISE_AMPLITUDE = lerp(startValues.gradientAmplitude, endValues.gradientAmplitude, progress);

        // TODO: Update sliders visually if desired (more complex)

        if (progress >= 1.0) {
            isAnimating = false;
            console.log('Animation complete.');
            // Optionally ensure final values are exact
            GRID_SCALE = endValues.gridScale;
            SHAPE_NOISE_AMPLITUDE = endValues.shapeAmplitude;
            NOISE_AMPLITUDE = endValues.gradientAmplitude;
        }
    }
    // --- End Simple Animation Handling ---


    // --- Pass 1: Draw gradient to frameTexture (offscreen) ---
    // ADD call to renderer.renderGradientPass
    const gradientUniforms: GradientUniforms = {
        colorA: hexToRgb01Local("#000000"), // Use local helper for now
        colorB: hexToRgb01Local("#FFFFFF"), // Use local helper for now
        time: currentTime,
        noiseCenter: NOISE_CENTER,
        noiseWidth: NOISE_WIDTH,
        noiseAmplitude: NOISE_AMPLITUDE, // Gradient noise amplitude
        noiseSpeed: NOISE_SPEED,
        noiseScale: NOISE_SCALE,
        noiseOffsetScale: NOISE_OFFSET_SCALE,
        waveAmplitude: WAVE_AMPLITUDE,
        waveXScale: WAVE_XSCALE,
        waveTimeScale: WAVE_TIMESCALE,
        gridScale: GRID_SCALE,
        gridRotation: GRID_ROTATION,
        gridAxisScale: GRID_AXIS_SCALE,
        gridWaveSpeed: GRID_WAVE_SPEED,
    };
    renderer.renderGradientPass(gradientUniforms);


    // --- Pass 2: Draw 2D elements to elementsTexture ---
    elementsCtx.clearRect(0, 0, width, height);

    // --- REVISED Hexagon Drawing Logic with Implicit Multi-Window Sync ---
    if (SHAPE_CENTER_X === null) { SHAPE_CENTER_X = width / 2; }
    if (HEXAGON_PULSE_START === null) { HEXAGON_PULSE_START = width / 2; }

    // --- Define the fixed shape base geometry AND original proportions ---
    const R_BASE = 150;
    const shape_hw = R_BASE * Math.sqrt(3) / 2;
    const shape_vh = R_BASE;
    const original_shape_yo = R_BASE * 1.5;

    // Calculate slopes based *only* on the original, full-height proportions
    const m_tl_orig = shape_hw !== 0 ? (original_shape_yo - shape_vh) / shape_hw : 0;
    const m_tr_orig = shape_hw !== 0 ? (shape_vh - original_shape_yo) / shape_hw : 0;
    const m_bl_orig = shape_hw !== 0 ? (-original_shape_yo + shape_vh) / shape_hw : 0;
    const m_br_orig = shape_hw !== 0 ? (-shape_vh + original_shape_yo) / shape_hw : 0;
    // --- End Shape Definition ---

    // --- Get current parameters ---
    const current_shape_yo = HEXAGON_HEIGHT; // Current max height offset from slider
    const pulse_start_base = HEXAGON_PULSE_START; // Base starting X offset for the pulse window
    const window_W = HEXAGON_WIDTH; // Width of the pulse window
    const fixed_shape_cy = height / 2; // Vertical center of the shape

    // --- Sync Frequency Calculation ---
    // Determine the spatial length of one sync cycle. Prevent division by zero or negative freq.
    const sync_cycle_length_pixels = width / Math.max(1e-6, PULSE_SYNC_FREQ); // Use small epsilon instead of 1 to allow frequencies < 1 if needed later, ensure > 0.
    // --- End Sync Calculation ---


    // --- Helper functions (remain the same) ---
    function getTopRelY(x_rel_shape: number): number {
        if (x_rel_shape <= 0) { return m_tl_orig * x_rel_shape + current_shape_yo; }
        else { return m_tr_orig * x_rel_shape + current_shape_yo; }
    }
    function getBottomRelY(x_rel_shape: number): number {
        if (x_rel_shape <= 0) { return m_bl_orig * x_rel_shape - current_shape_yo; }
        else { return m_br_orig * x_rel_shape - current_shape_yo; }
    }
    // --- End Helper Functions ---

    elementsCtx.strokeStyle = 'white';
    elementsCtx.lineWidth = 1;

    // Calculate the nominal start position of the "zeroth" conceptual window instance
    // This position moves continuously with hexagonPhase
    const nominal_zeroth_window_start = pulse_start_base + hexagonPhase;

    // --- Iterate over screen X coordinates ---
    for (let x_abs = 0; x_abs < width; x_abs++) {

        // Calculate the position of x_abs relative to the nominal start of the zeroth window
        const relative_position = x_abs - nominal_zeroth_window_start;

        // Map this relative position into a single sync cycle using modulo arithmetic.
        // This effectively tells us how far x_abs is from the start of the *nearest preceding*
        // conceptual window instance boundary in the repeating pattern.
        // Handle potential negative results from modulo correctly.
        const position_in_cycle = ((relative_position % sync_cycle_length_pixels) + sync_cycle_length_pixels) % sync_cycle_length_pixels;

        // Check if this position falls within the width of *a* window instance
        // If it does, it means this x_abs is currently covered by one of the repeating, sliding windows.
        if (position_in_cycle < window_W) {
            // This x_abs is inside the visible part of *some* shape window instance for this frame

            // Calculate x relative to the *fixed* shape center for geometry lookup
            const x_rel_shape = x_abs - SHAPE_CENTER_X;

            // --- Calculate and Clamp Y coordinates (This logic remains the same) ---
            // 1. Calculate initial desired top/bottom Y based on slopes and current height
            let y_top_initial = fixed_shape_cy + getTopRelY(x_rel_shape);
            let y_bottom_initial = fixed_shape_cy + getBottomRelY(x_rel_shape);

            let y_top_height_clamped: number;
            let y_bottom_height_clamped: number;

            // 2. Check for Inversion due to low height
            if (y_top_initial < y_bottom_initial) {
                // Inversion occurred. Collapse this segment to the center line.
                y_top_height_clamped = fixed_shape_cy;
                y_bottom_height_clamped = fixed_shape_cy;
            } else {
                // 3. No inversion: Apply normal height range clamping (squashing)
                const max_y = fixed_shape_cy + current_shape_yo;
                const min_y = fixed_shape_cy - current_shape_yo;
                y_top_height_clamped = Math.max(min_y, Math.min(max_y, y_top_initial));
                y_bottom_height_clamped = Math.max(min_y, Math.min(max_y, y_bottom_initial));
                // Minor safety check: ensure clamping didn't accidentally invert
                y_bottom_height_clamped = Math.min(y_top_height_clamped, y_bottom_height_clamped);
            }

            // 4. Clamp final Y coordinates to canvas bounds
            let y_draw_top = Math.max(0, Math.min(height - 1, y_top_height_clamped));
            let y_draw_bottom = Math.max(0, Math.min(height - 1, y_bottom_height_clamped));
            // --- End Y Calculation ---


            // 6. Draw the vertical line segment if it has valid height
            if (y_draw_top >= y_draw_bottom) {
                elementsCtx.beginPath();
                elementsCtx.moveTo(x_abs + 0.5, y_draw_bottom);
                elementsCtx.lineTo(x_abs + 0.5, y_draw_top);
                elementsCtx.stroke();
            }
        }
        // else: x_abs is not covered by any window instance in the current phase, do nothing
    }
    // --- End REVISED Hexagon Drawing Logic ---

    // Upload canvas to elementsTexture
    renderer.uploadElementsTexture(elementsCanvas);


    // --- Pass 3: Blur elementsTexture into blurredElementsTexture ---
    // REMOVE old blur logic
    // let readTex = elementsTexture;
    // let writeTex = blurredElementsTexture;
    // let finalBlurredTexture = elementsTexture; // Default if BLUR_PASSES is 0
    // if (BLUR_PASSES > 0 && BLUR_RADIUS > 0) {
    //     gl.useProgram(blurProgram);
    //     gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), width, height);
    //     // ... set uniforms, bind FBO, loop, draw, swap ...
    //     finalBlurredTexture = readTex;
    //     gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind the blur FBO
    // } else {
    //     finalBlurredTexture = elementsTexture; // Use original if no blur
    // }

    // ADD call to renderer.applyBlurPasses
    const blurUniforms: BlurUniforms = {
        resolution: [width, height],
        radius: BLUR_RADIUS,
        time: currentTime // Pass time if needed by blur shader
    };
    // The applyBlurPasses method returns the texture containing the final result
    const finalBlurredElementsTexture = renderer.applyBlurPasses(blurUniforms, BLUR_PASSES);

    // DEBUG: Log the texture object being passed to composite
    // console.log('Texture passed to composite:', finalBlurredElementsTexture);
    // DEBUG: Check if it's the expected texture when blur is off
    // if (renderer && BLUR_PASSES <= 0 && finalBlurredElementsTexture !== renderer.elementsInputTexture) {
    //     console.error("DEBUG: Blur pass returned unexpected texture!");
    // }


    // --- Pass 4: Composite to screen using spectral shader ---
    // REMOVE old WebGL calls
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
    // gl.viewport(0, 0, width, height);
    // gl.useProgram(spectralCompositeProgram);
    // // Bind gradient texture to unit 0
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_gradientTex"), 0);
    // // Bind blurred elements texture to unit 1
    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, finalBlurredTexture); // Use the potentially blurred texture
    // gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_elementsTex"), 1);
    // // Set palette color uniforms
    // const colorA_Palette = hexToRgb01(GRADIENT_COLOR_A);
    // // ... set uniforms one by one ...
    // gl.clearColor(0, 0, 0, 1); // Clear with opaque black
    // gl.clear(gl.COLOR_BUFFER_BIT);
    // // Draw the final composited quad
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ADD call to renderer.renderCompositePass
    const compositeUniforms: CompositeUniforms = {
        time: currentTime,
        noiseSpeed: NOISE_SPEED,
        noiseScale: NOISE_SCALE,     // Gradient noise scale (used for displacement)
        noiseAmplitude: NOISE_AMPLITUDE, // Gradient noise amplitude (used for displacement)
        gridScale: GRID_SCALE,
        gridRotation: GRID_ROTATION,
        gridAxisScale: GRID_AXIS_SCALE,
        shapeNoiseScale: SHAPE_NOISE_SCALE,
        shapeNoiseAmplitude: SHAPE_NOISE_AMPLITUDE,
        hfShapeNoiseScale: HIGH_FREQ_SHAPE_NOISE_SCALE,
        hfShapeNoiseAmount: HIGH_FREQ_SHAPE_NOISE_AMOUNT,
        colorA: hexToRgb01Local(GRADIENT_COLOR_A), // Use local helper
        colorB: hexToRgb01Local(GRADIENT_COLOR_B), // Use local helper
        colorC: hexToRgb01Local(PALETTE_COLOR_C),  // Use local helper
        colorD: hexToRgb01Local(PALETTE_COLOR_D),  // Use local helper
    };
    // Pass the texture returned by applyBlurPasses
    renderer.renderCompositePass(compositeUniforms, finalBlurredElementsTexture);

    frameCount++;
}

// --- ADDED: Function to start the simple animation ---
function animateParameters() {
    if (isAnimating) return; // Don't restart if already animating

    isAnimating = true;
    animationStartTime = Date.now();

    // Store starting values
    startValues.gridScale = GRID_SCALE;
    startValues.shapeAmplitude = SHAPE_NOISE_AMPLITUDE;
    startValues.gradientAmplitude = NOISE_AMPLITUDE;

    console.log('Starting animation...');
}
// --- End Animate Parameters function ---

// --- ADDED: Function to store current parameter values ---
function takeSnapshot() {
    snapshotValues.gridScale = GRID_SCALE;
    snapshotValues.shapeAmplitude = SHAPE_NOISE_AMPLITUDE;
    snapshotValues.gradientAmplitude = NOISE_AMPLITUDE;
    console.log('Snapshot taken:', snapshotValues);
}
// --- End Snapshot function ---

// --- MODIFY: Rename and change logic for Reset function ---
// Function to reset parameters based on the last snapshot
function resetParametersToSnapshot() {
    // Stop any ongoing animation
    if (isAnimating) {
        isAnimating = false;
        console.log('Animation stopped by Reset.');
    }

    // Restore values from snapshot
    GRID_SCALE = snapshotValues.gridScale;
    SHAPE_NOISE_AMPLITUDE = snapshotValues.shapeAmplitude;
    NOISE_AMPLITUDE = snapshotValues.gradientAmplitude;

    // --- ADDED: Reset hexagon phase ---
    hexagonPhase = 0.0; // Keep reset for accumulated distance

    console.log('Parameters reset to snapshot:', snapshotValues);
    console.log('Hexagon phase reset.'); // Optional log

    // --- ADDED: Update sliders and value spans to match snapshot ---
    const gridScaleSlider = document.getElementById('grid-scale-slider') as HTMLInputElement | null;
    const gridScaleValueSpan = document.getElementById('grid-scale-value');
    if (gridScaleSlider && gridScaleValueSpan) {
        // Reverse the quadratic scale calculation to set slider position
        // GRID_SCALE = 1.0 + s*s * 63.0  => s = sqrt((GRID_SCALE - 1.0) / 63.0)
        const s_grid = Math.sqrt(Math.max(0, (GRID_SCALE - 1.0)) / 63.0); // Ensure non-negative arg for sqrt
        gridScaleSlider.value = (s_grid * 100.0).toString();
        gridScaleValueSpan.textContent = GRID_SCALE.toFixed(2);
    }

    const shapeAmpSlider = document.getElementById('shape-amplitude-slider') as HTMLInputElement | null;
    const shapeAmpValueSpan = document.getElementById('shape-amplitude-value');
    if (shapeAmpSlider && shapeAmpValueSpan) {
        // SHAPE_NOISE_AMPLITUDE = sliderValue / 25.0 => sliderValue = SHAPE_NOISE_AMPLITUDE * 25.0
        shapeAmpSlider.value = (SHAPE_NOISE_AMPLITUDE * 25.0).toString();
        shapeAmpValueSpan.textContent = SHAPE_NOISE_AMPLITUDE.toFixed(2);
    }

    const noiseAmpSlider = document.getElementById('noise-amplitude-slider') as HTMLInputElement | null;
    const noiseAmpValueSpan = document.getElementById('noise-amplitude-value');
    if (noiseAmpSlider && noiseAmpValueSpan) {
        // NOISE_AMPLITUDE = sliderValue / 25.0 => sliderValue = NOISE_AMPLITUDE * 25.0
        noiseAmpSlider.value = (NOISE_AMPLITUDE * 25.0).toString();
        noiseAmpValueSpan.textContent = NOISE_AMPLITUDE.toFixed(2);
    }

    const hexagonPulseSpeedSlider = document.getElementById('hexagon-pulse-speed-slider') as HTMLInputElement | null; // RENAMED ID
    const hexagonPulseSpeedValueSpan = document.getElementById('hexagon-pulse-speed-value'); // RENAMED ID
    if (hexagonPulseSpeedSlider && hexagonPulseSpeedValueSpan) {
        const defaultSpeed = 0.0;
        hexagonPulseSpeedSlider.value = defaultSpeed.toString(); // Reset speed to 0
        HEXAGON_PULSE_SPEED = defaultSpeed; // Update variable too
        hexagonPulseSpeedValueSpan.textContent = defaultSpeed.toFixed(3);
    }

    // --- ADDED: Reset PULSE_SYNC_FREQ slider ---
    const pulseSyncFreqSlider = document.getElementById('pulse-sync-freq-slider') as HTMLInputElement | null;
    const pulseSyncFreqValueSpan = document.getElementById('pulse-sync-freq-value');
    if (pulseSyncFreqSlider && pulseSyncFreqValueSpan) {
        const defaultFreq = 1.0;
        pulseSyncFreqSlider.value = defaultFreq.toString(); // Set slider to default 1.0
        PULSE_SYNC_FREQ = defaultFreq; // Update variable
        pulseSyncFreqValueSpan.textContent = defaultFreq.toFixed(1);
    }
    // --- End Slider Updates ---
}
// --- End Reset Parameters function ---

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
    // {{ Moved setup call to the beginning }}
    setup(contexts);

    // Modify animation loop for conditional saving
    async function animate() {
        // console.log(`Animate frame: ${frameCount}`); // DEBUG: Verify loop execution

        // Check if renderer is initialized before drawing
        if (renderer) {
            draw(contexts);

            if (isRendering) {
                // Need to pass the correct canvas (canvasWebGL) to saveCurrentFrame
                await saveCurrentFrame(contexts.canvasWebGL);
                // Only request next frame if still rendering
                if (isRendering) {
                    requestAnimationFrame(animate);
                } else {
                    // If rendering stopped, ensure animation continues if desired
                    requestAnimationFrame(animate);
                }
            } else {
                requestAnimationFrame(animate); // Continue animation even when not saving
            }
        } else {
             // Handle case where renderer isn't ready yet (optional)
             console.warn("Renderer not initialized, delaying animation frame.");
             requestAnimationFrame(animate); // Try again next frame
        }
    }

    // Add back render button listener
    const renderButton = document.querySelector('#render-button');
    renderButton?.addEventListener('click', startRendering);

    // --- ADDED: Animate button listener ---
    const animateButton = document.querySelector('#animate-button');
    animateButton?.addEventListener('click', animateParameters);
    // --- End Animate button listener ---

    // --- MODIFY: Update Reset button listener ---
    const resetButton = document.querySelector('#reset-button');
    resetButton?.addEventListener('click', resetParametersToSnapshot); // Use the updated function
    // --- End Reset button listener ---

    // --- ADDED: Snapshot button listener ---
    const snapshotButton = document.querySelector('#snapshot-button');
    snapshotButton?.addEventListener('click', takeSnapshot);
    // --- End Snapshot button listener ---

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
    const shapeAmpSlider = document.getElementById('shape-amplitude-slider') as HTMLInputElement;
    const shapeAmpValueSpan = document.getElementById('shape-amplitude-value');
    const shapeScaleSlider = document.getElementById('shape-scale-slider') as HTMLInputElement;
    const shapeScaleValueSpan = document.getElementById('shape-scale-value');
    const hfShapeAmountSlider = document.getElementById('hf-shape-amount-slider') as HTMLInputElement;
    const hfShapeAmountValueSpan = document.getElementById('hf-shape-amount-value');
    const hfShapeScaleSlider = document.getElementById('hf-shape-scale-slider') as HTMLInputElement;
    const hfShapeScaleValueSpan = document.getElementById('hf-shape-scale-value');
    const timePulseFreqSlider = document.getElementById('time-pulse-freq-slider') as HTMLInputElement;
    const timePulseFreqValueSpan = document.getElementById('time-pulse-freq-value');
    const timePulseAmountSlider = document.getElementById('time-pulse-amount-slider') as HTMLInputElement;
    const timePulseAmountValueSpan = document.getElementById('time-pulse-amount-value');
    const hexagonPulseStartSlider = document.getElementById('hexagon-pulse-start-slider') as HTMLInputElement;
    const hexagonPulseStartValueSpan = document.getElementById('hexagon-pulse-start-value');
    const hexagonWidthSlider = document.getElementById('hexagon-width-slider') as HTMLInputElement;
    const hexagonWidthValueSpan = document.getElementById('hexagon-width-value');
    const hexagonPulseSpeedSlider = document.getElementById('hexagon-pulse-speed-slider') as HTMLInputElement; // RENAMED ID
    const hexagonPulseSpeedValueSpan = document.getElementById('hexagon-pulse-speed-value'); // RENAMED ID
    const hexagonHeightSlider = document.getElementById('hexagon-height-slider') as HTMLInputElement;
    const hexagonHeightValueSpan = document.getElementById('hexagon-height-value');
    // --- ADDED: Pulse Sync Freq Slider ---
    const pulseSyncFreqSlider = document.getElementById('pulse-sync-freq-slider') as HTMLInputElement;
    const pulseSyncFreqValueSpan = document.getElementById('pulse-sync-freq-value');


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

    // --- Listeners for time pulse sliders ---
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

    // --- Listeners for Hexagon (Window) sliders ---
    if (hexagonPulseStartSlider && hexagonPulseStartValueSpan) {
        hexagonPulseStartSlider.max = contexts.canvasWebGL.width.toString();
        if (HEXAGON_PULSE_START !== null) {
             hexagonPulseStartSlider.value = HEXAGON_PULSE_START.toString();
             hexagonPulseStartValueSpan.textContent = HEXAGON_PULSE_START.toFixed(0);
        } else {
            console.error("HEXAGON_PULSE_START is unexpectedly null after setup call!");
            const defaultStart = contexts.canvasWebGL.width / 2;
            hexagonPulseStartSlider.value = defaultStart.toString();
            hexagonPulseStartValueSpan.textContent = defaultStart.toFixed(0);
        }

        hexagonPulseStartSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_PULSE_START = sliderValue; // Update the pulse start variable
            hexagonPulseStartValueSpan.textContent = HEXAGON_PULSE_START.toFixed(0);
        });
    }

    if (hexagonWidthSlider && hexagonWidthValueSpan) {
        hexagonWidthSlider.value = HEXAGON_WIDTH.toString();
        hexagonWidthValueSpan.textContent = HEXAGON_WIDTH.toFixed(0);
        hexagonWidthSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_WIDTH = sliderValue; // Update the window width variable
            hexagonWidthValueSpan.textContent = HEXAGON_WIDTH.toFixed(0);
        });
    }

    // Pulse Speed (RENAMED from Offset)
    if (hexagonPulseSpeedSlider && hexagonPulseSpeedValueSpan) {
        // Define reasonable min/max for speed (pixels/sec or units/sec)
        hexagonPulseSpeedSlider.min = "-2000"; // Example range
        hexagonPulseSpeedSlider.max = "2000";
        hexagonPulseSpeedSlider.step = "1"; // Adjust step as needed
        hexagonPulseSpeedSlider.value = HEXAGON_PULSE_SPEED.toString();
        hexagonPulseSpeedValueSpan.textContent = HEXAGON_PULSE_SPEED.toFixed(3); // Show precision
        hexagonPulseSpeedSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_PULSE_SPEED = sliderValue; // Update the speed variable
            hexagonPulseSpeedValueSpan.textContent = HEXAGON_PULSE_SPEED.toFixed(3);
        });
    }

    // Height (Existing)
    if (hexagonHeightSlider && hexagonHeightValueSpan) {
        hexagonHeightSlider.value = HEXAGON_HEIGHT.toString();
        hexagonHeightValueSpan.textContent = HEXAGON_HEIGHT.toFixed(0);
        hexagonHeightSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_HEIGHT = sliderValue; // Update the height variable
            hexagonHeightValueSpan.textContent = HEXAGON_HEIGHT.toFixed(0);
        });
    }

    // --- ADDED: Listener for Pulse Sync Freq slider ---
    if (pulseSyncFreqSlider && pulseSyncFreqValueSpan) {
        pulseSyncFreqSlider.min = "1";    // Frequency must be at least 1
        pulseSyncFreqSlider.max = "50";   // Set max frequency
        pulseSyncFreqSlider.step = "0.1"; // Allow fractional frequencies
        pulseSyncFreqSlider.value = PULSE_SYNC_FREQ.toString();
        pulseSyncFreqValueSpan.textContent = PULSE_SYNC_FREQ.toFixed(1);
        pulseSyncFreqSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            PULSE_SYNC_FREQ = Math.max(1, sliderValue); // Ensure freq >= 1
            pulseSyncFreqValueSpan.textContent = PULSE_SYNC_FREQ.toFixed(1);
        });
    }
    // --- END SLIDER LISTENERS ---

    animate(); // Start the animation loop
}

// REMOVE initGradientProgram function
// function initGradientProgram(gl: WebGLRenderingContext) { ... }

// REMOVE initBlurProgram function
// function initBlurProgram(gl: WebGLRenderingContext) { ... }

// REMOVE initSpectralCompositeProgram function
// function initSpectralCompositeProgram(gl: WebGLRenderingContext) { ... }


// Keep helper function to convert hex to [r, g, b] in 0..1
// We need this locally for the uniform construction until we decide where it lives permanently
function hexToRgb01Local(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return [
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
    ];
}