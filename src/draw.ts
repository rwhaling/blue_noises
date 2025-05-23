// REMOVE Shader imports
// import passthroughVertexShader from './shaders/passthrough.vert?raw'
// import compositeGridGradientFragmentShader from './shaders/compositeGridGradient.frag?raw'
// import gridGradientFragmentShader from './shaders/gridgradient.frag?raw'
// import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
// import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
// import noiseSpectralCompositeFragmentShader from './shaders/noiseSpectralComposite.frag?raw'

// ADD Renderer import
import { Renderer, GradientUniforms, BlurUniforms, CompositeUniforms } from './render'; // Adjust path if needed

// ADD AudioAnalyzer import
import { AudioAnalyzer } from './audio'; // Adjust path if needed

// ADD Definition for CanvasContexts
interface CanvasContexts {
  canvas2d: HTMLCanvasElement;
  canvasWebGL: HTMLCanvasElement;
}

// MODIFIED: Wrap Window augmentation in declare global
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

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

// ADD AudioAnalyzer instance variable
let audioAnalyzer: AudioAnalyzer | null = null;

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

// --- REMOVE Simple Animation State ---
// let isAnimating = false;
// let animationStartTime = 0;
// const ANIMATION_DURATION = 2000;
// let startValues = { gridScale: 0, shapeAmplitude: 0, gradientAmplitude: 0 };
// let endValues = { gridScale: 1.0, shapeAmplitude: 6.0, gradientAmplitude: 1.0 };
// --- End Remove Animation State ---


// --- Step 2: Add Blur Parameters ---
const BLUR_RADIUS = 3.0; // Example blur radius
const BLUR_PASSES = 0;   // Example blur passes

// Keep gradient noise parameters
let NOISE_CENTER = 0.4;
let NOISE_WIDTH = 0.55;
let NOISE_AMPLITUDE = 1.2;
let NOISE_SPEED = 0.4;          // Speed for displacement noise
let NOISE_SCALE = 1.51; // 5.11, 1.51, 0.33
let NOISE_OFFSET_SCALE = 0.7;
let GRID_SCALE = 1.51;
let GRID_ROTATION = 0.0;
let GRID_AXIS_SCALE: [number, number] = [2.0, 1.0];
let GRID_WAVE_SPEED = 0.6;      // EDIT: Added constant for sine wave speed

// --- ADDED: Separate noise parameters for shape displacement ---
let SHAPE_NOISE_AMPLITUDE = 0.00; // Controlled by slider
let SHAPE_NOISE_SCALE = 1.51;     // Initial value, same as original for now

// --- ADDED: High-frequency noise parameters for shape displacement ---
let HIGH_FREQ_SHAPE_NOISE_AMOUNT = 0.0; // Start with a smaller amount
let HIGH_FREQ_SHAPE_NOISE_SCALE = 32.0; // Start with a higher scale

// --- ADDED: Grain Amplitude ---
let GRAIN_AMPLITUDE = 0.1; // Default grain amount

// Keep gradient wave parameters
let WAVE_AMPLITUDE = 1.2;
let WAVE_XSCALE = 0.1;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.1;   // NEW: time scale for the wave

// --- ADDED: Time Pulse Parameters ---
let TIME_PULSE_FREQUENCY = 1.7333; // Example frequency (cycles per second)
let TIME_PULSE_AMOUNT = 0.3;    // Example amount (0 to 1 typical)

// --- ADDED: Pulse Sync Frequency ---
let PULSE_SYNC_FREQ = 1.0; // Retrigger frequency (1 = one cycle per width travelled)

// --- MOVED: Declare HEXAGON_WIDTH before it's used in snapshotValues ---
let HEXAGON_WIDTH = 150 * Math.sqrt(3); // NEW: Max geometric width of the drawn hex within the pulse window. Initialized same as pulse width.

let PALETTES = [
    ["#100F0F", "#3734DA", "#3734DA", "#33E6DA"], // Palette 1 (Index 0)
    ["#357DC0", "#3D2D5B", "#33E6DA", "#C73868"], // Palette 2 (Index 1)
    ["#ED4596", "#3734DA", "#542636", "#F2585B"], // Palette 3 (Index 2)
    ["#261C39", "#3734DA", "#3734DA", "#33E6DA"], // Palette 4 (Index 0)
    ["#3734DA", "#C73868", "#33E6DA", "#261C39"], // Palette 5 (Index 4)
    ["#ED4596", "#3D2D5B", "#100F0F", "#C73868"], // Palette 6 (Index 2)
    ["#357DC0", "#542636", "#33E6DA", "#261C39"], // Palette 7 (Index 1)
    ["#33E6DA", "#542636", "#C73868", "#F2585B"], // Palette 9 (Index 2)
    ["#357DC0", "#3D2D5B", "#3734DA", "#33E6DA"], // Palette 8 (Index 1)
    ["#33E6DA", "#261C39", "#261C39", "#F2585B"], // Palette 9 (Index 2)
    ["#357DC0", "#3734DA", "#3734DA", "#33E6DA"], // Palette 2 (Index 1)
    ["#357DC0", "#3D2D5B", "#3734DA", "#ED4596"], // Palette 5 (Index 1)
    ["#33E6DA", "#261C39", "#261C39", "#ED4596"], // Palette 9 (Index 2)
    ["#100F0F", "#3734DA", "#33E6DA", "#C73868"], // Palette 10 (Index 3)
    ["#3734DA", "#100F0F", "#33E6DA", "#261C39"], // Palette 11 (Index 4)

];
let CURRENT_PALETTE = 0; // UPDATED: Start at index 0
// Palette Colors - Initialize using CURRENT_PALETTE
let GRADIENT_COLOR_A = PALETTES[CURRENT_PALETTE][0];
let GRADIENT_COLOR_B = PALETTES[CURRENT_PALETTE][1];
let PALETTE_COLOR_C = PALETTES[CURRENT_PALETTE][2];
let PALETTE_COLOR_D = PALETTES[CURRENT_PALETTE][3];

/* nice light mode teal/pink
#357Dc0
#C73868
#261C39
#ED4596
*/

/* nice light mode blue on teal
#357DC0
#3d2D5B
#3734DA // nice with C73868
#33E6DA
*/


// very nice together
// #33E6DA
// #261C39

/* current favorite w music
#3D2D5B (nice lighter purple)
#100F0F
#3734DA // very nice with C73868
#33E6DA
*/

/* very nice red/orange on blue/magenta
nice with music
#ED4596 // nice with 100F0F too at large grids
#3734DA -- nice with 205EA6 too
#542636
#F2585B
*/

/* nice dull orange on teal
nice with music
#205EA6
#100F0F
#261C39
#F2585B
*/

/* very nice pink/teal on black/aqua
nice with music
#100F0F
#205EA6
#33E6DA
#C73868 // very nice with 261C39 too
*/

/* 
#100F0F
#205EA6 // nice to use with 3734DA
#3734DA // very very nice with C73868
#261C39 // nice with #542636 too
*/

/* purple/black on teal/blue (not that good)
#33E6DA
#3734DA
#ED4596
#261C39
*/

/* superb red/maroon on teal/blue
#3734DA // nice with 100F0F
#33E6DA
#C73868
#261C39 // nice with #542636 too
*/



/* very nice purple on teal
#100F0F
#205EA6
#542636
#C73868
*/

/* very nice purple/magenta on black/indigo
#100F0F
#3734DA 
#542636
#C73868
*/

/* very nice metallic teal on indigo/black
#100F0F
#3734DA
#261C39
#33E6DA
*/

/* heck yes
#3734DA
#C73868
#33E6DA
#261C39
*/


/*
#100F0F
#205EA6 -- nice with 3734DA too
#C73868
#F2585B
*/



/* dark mirror - nice to introduce a new color/particles
#100F0F
#205EA6 -- nice with 3734DA too
#205EA6
#100F0F
*/

/*
#100F0F
#261C39
#33E6DA
#205EA6
*/

/*
#100F0F
#3734DA
#205EA6
#33E6DA
*/

/*
#100F0F
#205EA6
#205EA6
#542636
*/

/*
#100F0F
#261C39
#205EA6
#542636
*/

/*
#100F0F
#205EA6
#3734DA
#C73868
*/

/*
#100F0F
#205EA6
#3734DA
#542636
*/

/*
#100F0F
#205EA6
#3734DA
#C73868
*/

/*
#205EA6
#261C39
#3734DA // nice with 33E6DA too
#C73868
*/

/*
#100F0F
#205EA6
#3734DA
#C73868
*/



// let GRADIENT_COLOR_A = '#3171B2'; // Base Color AED4596
// let GRADIENT_COLOR_B = '#3171B2'; 

// let GRADIENT_COLOR_A = '#C73868'; // Base Color AED4596
// let GRADIENT_COLOR_B = '#3171B2'; // Base Color swap to A145ED
// // --- Step 1: Add New Color Constants ---
// const PALETTE_COLOR_C = '#261C39'; // Color for opaque black elements
// const PALETTE_COLOR_D = '#AED4596'; // Color for opaque white elements (unused for now)



// ADD Configuration for audio modulation
// const MAX_SHAPE_AMPLITUDE_FROM_AUDIO = 4.0; // The max value SHAPE_NOISE_AMPLITUDE will reach at full audio input
// const BASE_SHAPE_AMPLITUDE = 0.1;           // A small base amplitude when audio is silent

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
let HEXAGON_PULSE_WIDTH = 150 * Math.sqrt(3); // RENAMED from HEXAGON_WIDTH
let HEXAGON_PULSE_SPEED = 0.0; // RENAMED from OFFSET, represents pixels/sec speed
let hexagonPhase = 0.0; // Accumulated phase/distance travelled
let HEXAGON_HEIGHT = 225; // NEW: Vertical distance from center to apex (default based on R=150 * 1.5)

// ADD new variable for audio modulation factor (0-1 range typically)
let SHAPE_AUDIO_MOD = 0.0; // Represents the intensity/factor of modulation from audio

// ADD a scaling factor for the audio modulation - CHANGED to let
let AUDIO_MOD_SCALE = 4.0; // Adjust this to control how much audio affects the amount

// --- ADDED: Audio Sensitivity ---
let AUDIO_SENSITIVITY = 0.1; // Default sensitivity threshold (0 to 1)

// --- ADDED: Color Transition State ---
let isTransitioning = false;
let transitionStartTime = 0;
const TRANSITION_DURATION = 200; // Milliseconds

// --- ADDED: Store current and target colors ---
let currentGradientColorA = GRADIENT_COLOR_A;
let currentGradientColorB = GRADIENT_COLOR_B;
let currentPaletteColorC = PALETTE_COLOR_C;
let currentPaletteColorD = PALETTE_COLOR_D;

let targetGradientColorA = GRADIENT_COLOR_A;
let targetGradientColorB = GRADIENT_COLOR_B;
let targetPaletteColorC = PALETTE_COLOR_C;
let targetPaletteColorD = PALETTE_COLOR_D;

// --- MODIFY: Snapshot State (remove animation values) ---
let snapshotValues = {
    gridScale: GRID_SCALE, // Initialize with current defaults
    shapeAmplitude: SHAPE_NOISE_AMPLITUDE, // Base amplitude from slider
    gradientAmplitude: NOISE_AMPLITUDE,
    hexagonWidth: HEXAGON_WIDTH,
    audioModScale: AUDIO_MOD_SCALE, // ADDED
    audioSensitivity: AUDIO_SENSITIVITY, // ADDED
    hfShapeAmount: HIGH_FREQ_SHAPE_NOISE_AMOUNT // ADDED
};
// --- End Snapshot State ---


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

    // Initialize SHAPE_CENTER_X (fixed geometric center)
    SHAPE_CENTER_X = canvasWebGL.width / 2;
    // Initialize HEXAGON_PULSE_START to the center (this is the base desired center)
    HEXAGON_PULSE_START = canvasWebGL.width / 2;
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // --- Step 15a: Update resource check ---
    // ADD check for renderer instance
    if (!renderer || !elementsCanvas || !elementsCtx) {
         throw new Error('Renderer or elements canvas not initialized');
    }

    // --- Check if Audio Analyzer is ready (optional safety) ---
    const isAudioReady = audioAnalyzer?.checkInitialized() ?? false;

    const width = canvasWebGL.width;
    const height = canvasWebGL.height;

    // --- ADDED: Color Transition Logic ---
    const now = Date.now();
    if (isTransitioning) {
        const elapsedTime = now - transitionStartTime;
        const progress = Math.min(1, elapsedTime / TRANSITION_DURATION);

        // Interpolate colors
        GRADIENT_COLOR_A = lerpHexColor(currentGradientColorA, targetGradientColorA, progress);
        GRADIENT_COLOR_B = lerpHexColor(currentGradientColorB, targetGradientColorB, progress);
        PALETTE_COLOR_C = lerpHexColor(currentPaletteColorC, targetPaletteColorC, progress);
        PALETTE_COLOR_D = lerpHexColor(currentPaletteColorD, targetPaletteColorD, progress);

        if (progress >= 1) {
            isTransitioning = false;
            // Snap to final target colors to avoid floating point issues
            currentGradientColorA = targetGradientColorA;
            currentGradientColorB = targetGradientColorB;
            currentPaletteColorC = targetPaletteColorC;
            currentPaletteColorD = targetPaletteColorD;
            // Ensure the main variables are also precisely the target ones
            GRADIENT_COLOR_A = targetGradientColorA;
            GRADIENT_COLOR_B = targetGradientColorB;
            PALETTE_COLOR_C = targetPaletteColorC;
            PALETTE_COLOR_D = targetPaletteColorD;
        }
    }
    // --- END Color Transition Logic ---

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

    // --- Update SHAPE_AUDIO_MOD based on audio level ---
    let rawAudioLevel = 0.0; // Store the raw level first
    if (isAudioReady && audioAnalyzer) {
        // Get the raw smoothed audio level (0-1)
        rawAudioLevel = audioAnalyzer.getSmoothedLevel();
    }

    // Apply sensitivity threshold and rescaling
    let effectiveAudioMod = 0.0;
    if (rawAudioLevel >= AUDIO_SENSITIVITY) {
        // Prevent division by zero if sensitivity is 1.0
        const denominator = Math.max(1e-6, 1.0 - AUDIO_SENSITIVITY);
        // Scale the level from [AUDIO_SENSITIVITY, 1] to [0, 1]
        effectiveAudioMod = (rawAudioLevel - AUDIO_SENSITIVITY) / denominator;
        // Clamp to ensure it stays within [0, 1] due to potential floating point inaccuracies
        effectiveAudioMod = Math.max(0, Math.min(1, effectiveAudioMod));
    }
    // If rawAudioLevel < AUDIO_SENSITIVITY, effectiveAudioMod remains 0.0

    // {{ ADDED: Debug Logging - Remove or comment out later }}
    // Limit logging to prevent spamming the console too much
    if (frameCount % 60 === 0) { // Log once per second (assuming 60fps)
        console.log(`Audio Debug: raw=${rawAudioLevel.toFixed(3)}, sens=${AUDIO_SENSITIVITY.toFixed(3)}, effectiveMod=${effectiveAudioMod.toFixed(3)}`);
    }
    // {{ END: Debug Logging }}


    // Use the effectiveAudioMod for calculations
    SHAPE_AUDIO_MOD = effectiveAudioMod; // Update the global variable if needed elsewhere, or just use effectiveAudioMod directly below
    // --- End Audio Modulation Factor Update ---


    // --- Calculate Effective High-Frequency Shape Amount ---
    // Combine base HF amount (from slider) with the scaled *effective* audio modulation
    const EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT = HIGH_FREQ_SHAPE_NOISE_AMOUNT + effectiveAudioMod * AUDIO_MOD_SCALE; // MODIFIED: Use effectiveAudioMod

    // {{ ADDED: Debug Logging - Remove or comment out later }}
    if (frameCount % 60 === 0) { // Log once per second
         console.log(`HF Shape Debug: base=${HIGH_FREQ_SHAPE_NOISE_AMOUNT.toFixed(3)}, modScale=${AUDIO_MOD_SCALE.toFixed(3)}, effectiveAmount=${EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT.toFixed(3)}`);
    }
    // {{ END: Debug Logging }}


    // Optional: Clamp the effective amount if needed
    // EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT = Math.max(0, EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT);
    // --- End Effective HF Amount Calculation ---


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
        grainAmplitude: GRAIN_AMPLITUDE
    };
    renderer.renderGradientPass(gradientUniforms);


    // --- Pass 2: Draw 2D elements to elementsTexture ---
    elementsCtx.clearRect(0, 0, width, height);

    // --- REVISED Hexagon Drawing Logic with Implicit Multi-Window Sync ---
    if (SHAPE_CENTER_X === null) { SHAPE_CENTER_X = width / 2; }
    // Ensure HEXAGON_PULSE_START has its default if somehow null (shouldn't happen after setup)
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
    const pulse_center_base = HEXAGON_PULSE_START; // Base desired *center* X offset for the pulse window
    const window_W = HEXAGON_PULSE_WIDTH; // Current width of the pulse window
    const max_geometric_width = HEXAGON_WIDTH; // Max visual width of the hex shape itself
    const fixed_shape_cy = height / 2; // Vertical center of the shape
    // Calculate half of the maximum allowed geometric width
    const half_max_geometric_width = max_geometric_width / 2;

    // --- Calculate the base start position dynamically based on current width and desired center ---
    const pulse_start_base = pulse_center_base - window_W / 2;
    // --- End Dynamic Calculation ---


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
    // This position moves continuously with hexagonPhase, based on the dynamically calculated start
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

        // --- CONDITION 1: Check if x_abs is within the geometric bounds defined by HEXAGON_WIDTH ---
        const x_dist_from_center = Math.abs(x_abs - SHAPE_CENTER_X);
        const is_within_geometric_width = x_dist_from_center <= half_max_geometric_width;

        // --- CONDITION 2: Check if this position falls within the width of *a* pulse window instance ---
        const is_within_pulse_window = position_in_cycle < window_W;

        // --- DRAW if BOTH conditions are met ---
        if (is_within_geometric_width && is_within_pulse_window) {
             // This x_abs should be drawn

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
        // else: x_abs is outside the geometric bounds OR outside the current pulse window, do nothing
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
        shapeNoiseAmplitude: SHAPE_NOISE_AMPLITUDE, // EDIT: Use the base amplitude directly
        hfShapeNoiseScale: HIGH_FREQ_SHAPE_NOISE_SCALE,
        hfShapeNoiseAmount: EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT, // EDIT: Use the calculated effective HF amount
        colorA: hexToRgb01Local(GRADIENT_COLOR_A), // Use local helper
        colorB: hexToRgb01Local(GRADIENT_COLOR_B), // Use local helper
        colorC: hexToRgb01Local(PALETTE_COLOR_C),  // Use local helper
        colorD: hexToRgb01Local(PALETTE_COLOR_D),  // Use local helper
        // REMOVE shapeAudioMod uniform, as it's incorporated into EFF_HIGH_FREQ_SHAPE_NOISE_AMOUNT
        // shapeAudioMod: SHAPE_AUDIO_MOD,
    };
    // Pass the texture returned by applyBlurPasses
    renderer.renderCompositePass(compositeUniforms, finalBlurredElementsTexture);

    frameCount++;
}

// --- REMOVE Animate Parameters function ---
// function animateParameters() { ... }
// --- End Remove Animate function ---

// --- ADDED: Function to store current parameter values ---
function takeSnapshot() {
    snapshotValues.gridScale = GRID_SCALE;
    snapshotValues.shapeAmplitude = SHAPE_NOISE_AMPLITUDE;
    snapshotValues.gradientAmplitude = NOISE_AMPLITUDE;
    snapshotValues.hexagonWidth = HEXAGON_WIDTH;
    snapshotValues.audioModScale = AUDIO_MOD_SCALE; // ADDED
    snapshotValues.audioSensitivity = AUDIO_SENSITIVITY; // Store current sensitivity
    snapshotValues.hfShapeAmount = HIGH_FREQ_SHAPE_NOISE_AMOUNT; // ADDED: Snapshot base HF amount
    console.log('Snapshot taken:', snapshotValues);
}
// --- End Snapshot function ---

// --- ADDED: Function to update palette and UI ---
function updatePalette() {
    // Store the colors *before* changing the palette index
    currentGradientColorA = GRADIENT_COLOR_A;
    currentGradientColorB = GRADIENT_COLOR_B;
    currentPaletteColorC = PALETTE_COLOR_C;
    currentPaletteColorD = PALETTE_COLOR_D;

    // Increment and wrap palette index
    CURRENT_PALETTE = (CURRENT_PALETTE + 1) % PALETTES.length;

    // --- UPDATED: Set target colors instead of directly updating ---
    targetGradientColorA = PALETTES[CURRENT_PALETTE][0];
    targetGradientColorB = PALETTES[CURRENT_PALETTE][1];
    targetPaletteColorC = PALETTES[CURRENT_PALETTE][2];
    targetPaletteColorD = PALETTES[CURRENT_PALETTE][3];

    // --- ADDED: Start transition ---
    isTransitioning = true;
    transitionStartTime = Date.now();

    // Update UI elements (still reflect the target immediately)
    const paletteButton = document.getElementById('palette-button');
    const colorAInput = document.getElementById('color-a-input') as HTMLInputElement | null;
    const colorBInput = document.getElementById('color-b-input') as HTMLInputElement | null;
    const colorCInput = document.getElementById('color-c-input') as HTMLInputElement | null;
    const colorDInput = document.getElementById('color-d-input') as HTMLInputElement | null;

    if (paletteButton) {
        paletteButton.textContent = `Palette ${CURRENT_PALETTE + 1}`; // Display 1-based index
    }
    // --- UPDATED: Set UI inputs to target colors ---
    if (colorAInput) colorAInput.value = targetGradientColorA;
    if (colorBInput) colorBInput.value = targetGradientColorB;
    if (colorCInput) colorCInput.value = targetPaletteColorC;
    if (colorDInput) colorDInput.value = targetPaletteColorD;

    // Optional: Log the change
    console.log(`Starting transition to Palette ${CURRENT_PALETTE + 1}`);
}
// --- End Palette Update Function ---

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

    // --- ADDED: Instantiate and Initialize Audio Analyzer ---
    // Instantiate the analyzer
    audioAnalyzer = new AudioAnalyzer();

    // We need a user interaction to start the audio.
    // Use a button click for this.
    // RENAME the button ID in HTML from 'animate-button' to 'start-audio-button' for clarity
    // Or keep using 'animate-button' if preferred.
    const startAudioButton = document.getElementById('animate-button') as HTMLButtonElement | null; // Or 'start-audio-button'
    let audioInitialized = false; // Track initialization state

    if (startAudioButton) {
        // Make this button ONLY initialize audio ONCE
        startAudioButton.addEventListener('click', async () => {
             if (audioAnalyzer && !audioInitialized) {
                 console.log("Audio start button clicked, attempting to initialize audio...");
                await audioAnalyzer.initializeAudio();
                audioInitialized = audioAnalyzer.checkInitialized(); // Update state after attempt
                 if (audioInitialized) {
                     console.log("Audio initialized successfully via button click.");
                     // Optionally change button text/state
                     startAudioButton.textContent = "Audio Active";
                     startAudioButton.disabled = true; // Disable after successful init
                 } else {
                      console.error("Failed to initialize audio via button click.");
                      // Keep button enabled to allow retrying? Or display error?
                 }
             } else if (audioInitialized) {
                  console.log("Audio already initialized.");
             }
             // --- REMOVE call to animateParameters() ---
        }, { once: false }); // Use { once: true } if you *never* want it to retry after failure
    } else {
        console.warn("Could not find button to trigger audio initialization (expected #animate-button or #start-audio-button). Audio analysis will not start.");
    }
    // --- END Audio Analyzer Setup ---


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

    // --- ADDED: Palette button listener ---
    const paletteButton = document.querySelector('#palette-button');
    paletteButton?.addEventListener('click', updatePalette);
    // --- End Palette button listener ---


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
    const hexagonPulseWidthSlider = document.getElementById('hexagon-pulse-width-slider') as HTMLInputElement; // RENAMED ID
    const hexagonPulseWidthValueSpan = document.getElementById('hexagon-pulse-width-value'); // RENAMED ID
    const hexagonPulseSpeedSlider = document.getElementById('hexagon-pulse-speed-slider') as HTMLInputElement; // RENAMED ID
    const hexagonPulseSpeedValueSpan = document.getElementById('hexagon-pulse-speed-value'); // RENAMED ID
    const hexagonHeightSlider = document.getElementById('hexagon-height-slider') as HTMLInputElement;
    const hexagonHeightValueSpan = document.getElementById('hexagon-height-value');
    // --- ADDED: Hexagon Width Slider ---
    const hexagonWidthSlider = document.getElementById('hexagon-width-slider') as HTMLInputElement;
    const hexagonWidthValueSpan = document.getElementById('hexagon-width-value');
    // --- ADDED: Pulse Sync Freq Slider ---
    const pulseSyncFreqSlider = document.getElementById('pulse-sync-freq-slider') as HTMLInputElement;
    const pulseSyncFreqValueSpan = document.getElementById('pulse-sync-freq-value');
    // EDIT: Add grain amplitude slider variables
    const grainAmplitudeSlider = document.getElementById('grain-amplitude-slider') as HTMLInputElement;
    const grainAmplitudeValueSpan = document.getElementById('grain-amplitude-value');
    // ADDED: Audio Mod Scale slider variables
    const audioModScaleSlider = document.getElementById('audio-mod-scale-slider') as HTMLInputElement;
    const audioModScaleValueSpan = document.getElementById('audio-mod-scale-value');
    // ADDED: Audio Sensitivity slider variables
    const audioSensitivitySlider = document.getElementById('audio-sensitivity-slider') as HTMLInputElement;
    const audioSensitivityValueSpan = document.getElementById('audio-sensitivity-value');


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
    const colorAInput = document.getElementById('color-a-input') as HTMLInputElement | null;
    const colorBInput = document.getElementById('color-b-input') as HTMLInputElement | null;
    const colorCInput = document.getElementById('color-c-input') as HTMLInputElement | null;
    const colorDInput = document.getElementById('color-d-input') as HTMLInputElement | null;

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
        noiseSpeedSlider.min = "0"; // ADDED: Explicitly set min
        noiseSpeedSlider.max = "50"; // ADDED: Explicitly set max based on 0-5 range and scale factor 10
        noiseSpeedSlider.step = "0.25"; // ADDED: Set step to match 0.025 increments
        noiseSpeedSlider.value = (NOISE_SPEED * 10.0).toString(); // Set initial slider position
        noiseSpeedValueSpan.textContent = NOISE_SPEED.toFixed(1); // Keep displaying 1 decimal for noise speed value
        noiseSpeedSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            NOISE_SPEED = sliderValue / 10.0;
            // Update display to show more precision if needed, e.g., toFixed(3)
            noiseSpeedValueSpan.textContent = NOISE_SPEED.toFixed(3); // UPDATED: Show 3 decimal places
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
        // Get canvas dimensions needed for centering and wrapping
        const canvasWidth = contexts.canvasWebGL.width;
        const canvasCenter = canvasWidth / 2;

        // Slider range is 0-1000 (defined in HTML)
        // Slider value 0 corresponds to offset 0 (center)

        // Set initial display based on HTML defaults (should be 0)
        // Note: HEXAGON_PULSE_START is initialized to canvasCenter in setup()
        hexagonPulseStartSlider.value = "0";
        hexagonPulseStartValueSpan.textContent = "0";

        hexagonPulseStartSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value); // This is 0-1000

            // The slider value itself represents the desired offset from the center
            // sliderValue = 0 means offset = 0
            const currentOffset = sliderValue;

            // Calculate the desired center position based on the offset
            const desiredCenter = canvasCenter + currentOffset;

            // Wrap the desired center position around the canvas width
            const wrappedCenter = ((desiredCenter % canvasWidth) + canvasWidth) % canvasWidth;

            HEXAGON_PULSE_START = wrappedCenter; // Update the actual pulse start (center) variable
            hexagonPhase = 0.0; // Reset the phase when start position changes

            // Update the span to show the current slider value (0-1000)
            hexagonPulseStartValueSpan.textContent = sliderValue.toFixed(0);
        });
    }

    if (hexagonPulseWidthSlider && hexagonPulseWidthValueSpan) {
        hexagonPulseWidthSlider.value = HEXAGON_PULSE_WIDTH.toString(); // UPDATED variable names
        hexagonPulseWidthValueSpan.textContent = HEXAGON_PULSE_WIDTH.toFixed(0); // UPDATED variable name
        hexagonPulseWidthSlider.addEventListener('input', (e) => { // UPDATED variable name
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_PULSE_WIDTH = sliderValue; // Update the window width variable - UPDATED variable name
            hexagonPulseWidthValueSpan.textContent = HEXAGON_PULSE_WIDTH.toFixed(0); // UPDATED variable name
        });
    }

    // Pulse Speed (RENAMED from Offset)
    if (hexagonPulseSpeedSlider && hexagonPulseSpeedValueSpan) {
        // Define reasonable min/max for speed (pixels/sec or units/sec)
        hexagonPulseSpeedSlider.min = "0"; // UPDATED: Set min to 0
        hexagonPulseSpeedSlider.max = "500"; // UPDATED: Set max to 500
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

    // --- ADDED: Listener for Hexagon Width slider ---
    if (hexagonWidthSlider && hexagonWidthValueSpan) {
        hexagonWidthSlider.max = contexts.canvasWebGL.width.toString(); // Max width can be canvas width
        hexagonWidthSlider.value = HEXAGON_WIDTH.toString();
        hexagonWidthValueSpan.textContent = HEXAGON_WIDTH.toFixed(0);
        hexagonWidthSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            HEXAGON_WIDTH = Math.max(0, sliderValue); // Ensure width is not negative
            hexagonWidthValueSpan.textContent = HEXAGON_WIDTH.toFixed(0);
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

    // EDIT: Add listener for Grain Amplitude slider
    if (grainAmplitudeSlider && grainAmplitudeValueSpan) {
        // Example scale: 0-50 maps to 0.0 - 0.5 grain amplitude
        grainAmplitudeSlider.value = (GRAIN_AMPLITUDE * 100.0).toString(); // Set initial slider position
        grainAmplitudeValueSpan.textContent = GRAIN_AMPLITUDE.toFixed(2);
        grainAmplitudeSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            GRAIN_AMPLITUDE = sliderValue / 100.0; // Scale slider value to desired range
            grainAmplitudeValueSpan.textContent = GRAIN_AMPLITUDE.toFixed(2);
        });
    }

    // --- ADDED: Listener for Audio Mod Scale slider ---
    if (audioModScaleSlider && audioModScaleValueSpan) {
        // Reverse quadratic scale for initial value: s = sqrt(4.0 / 64.0) = 0.25 => slider value 25
        const initialS_audio = Math.sqrt(AUDIO_MOD_SCALE / 64.0);
        audioModScaleSlider.value = (initialS_audio * 100.0).toString();
        audioModScaleValueSpan.textContent = AUDIO_MOD_SCALE.toFixed(2);
        audioModScaleSlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            const s = sliderValue / 100.0;
            AUDIO_MOD_SCALE = s * s * 64.0; // Apply quadratic scale (0-100 maps to 0-64)
            audioModScaleValueSpan.textContent = AUDIO_MOD_SCALE.toFixed(2);
        });
    }

    // --- ADDED: Listener for Audio Sensitivity slider ---
    if (audioSensitivitySlider && audioSensitivityValueSpan) {
        // {{ EDIT: Update scaling logic and formatting }}
        // Set initial slider position: V = S * 0.0025 => S = V / 0.0025
        const initialSliderValue = Math.round(AUDIO_SENSITIVITY / 0.0025);
        audioSensitivitySlider.value = initialSliderValue.toString();
        audioSensitivityValueSpan.textContent = AUDIO_SENSITIVITY.toFixed(4); // Show 4 decimal places

        audioSensitivitySlider.addEventListener('input', (e) => {
            const sliderValue = parseFloat((e.target as HTMLInputElement).value);
            // New scaling: Slider 1-200 maps to 0.0025 - 0.5
            AUDIO_SENSITIVITY = sliderValue * 0.0025;
            audioSensitivityValueSpan.textContent = AUDIO_SENSITIVITY.toFixed(4); // Update display format
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

// --- ADDED: Helper function to lerp between two hex colors ---
function lerpHexColor(hexA: string, hexB: string, t: number): string {
    const rgbA = hexToRgb01Local(hexA).map(c => c * 255);
    const rgbB = hexToRgb01Local(hexB).map(c => c * 255);

    const r = Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * t);
    const g = Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * t);
    const b = Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * t);

    const toHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// --- END Helper function ---