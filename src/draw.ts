import passthroughVertexShader from './shaders/passthrough.vert?raw'
import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
import simpleGradientFragmentShader from './shaders/simplegradient.frag?raw'
import compositeFragmentShader from './shaders/composite.frag?raw'
import fadeFragmentShader from './shaders/fade.frag?raw'

let frameCount = 0
// Add mouse position tracking
let mouseX = 0
let mouseY = 0
let rectX = 100
let rectY = 100
let dx = 1
let dy = 1

// Add these at the top of the file
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let frameTexture: WebGLTexture | null = null;
let framebuffer: WebGLFramebuffer | null = null;
let tempTexture: WebGLTexture | null = null;
let positionBuffer: WebGLBuffer | null = null; // Make global
let texCoordBuffer: WebGLBuffer | null = null; // Make global

// Add time tracking variable at the top of the file with other globals
let startTime = Date.now();

// Add these variables at the top with other globals
let leftCircleY = 600;  // Position for the red circle
let rightCircleY = 400; // Position for the orange circle
let leftDY = 2;      // Movement speed/direction for left circle
let rightDY = -2;    // Movement speed/direction for right circle

// Add these near the top with other state variables
let isRendering = false;
let currentFrameNumber = 0;
let dirHandle: FileSystemDirectoryHandle | null = null;
const TOTAL_FRAMES = 2880;
const FRAMES_PER_SECOND = 24;

// Add this global for the blur output texture (at the top with other globals)
let blurOutputTexture: WebGLTexture | null = null;

// Add these for the fading trail
let circleTrailTexA: WebGLTexture | null = null;
let circleTrailTexB: WebGLTexture | null = null;
let trailFramebuffer: WebGLFramebuffer | null = null;
let fadeProgram: WebGLProgram | null = null;
let drawTextureProgram: WebGLProgram | null = null; // Program to just draw a texture
let readTrailTex: WebGLTexture | null = null;
let writeTrailTex: WebGLTexture | null = null;
const FADE_AMOUNT = 0.04; // Adjust for faster/slower fade (0.0 to 1.0)

// Add these globals at the top with other state variables
let BLUR_RADIUS = 1.0;         // Default blur radius, can be changed at runtime
let BLUR_PASSES = 1;           // Number of blur passes, can be changed at runtime

let NOISE_CENTER = 0.5;
let NOISE_WIDTH = 0.65;
let NOISE_AMPLITUDE = 0.5;
let NOISE_SPEED = 0.1;
let NOISE_SCALE = 64.0;
let NOISE_OFFSET_SCALE = 0.7;

let WAVE_AMPLITUDE = 0.45;
let WAVE_XSCALE = 1.4;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.1;   // NEW: time scale for the wave

// let GRADIENT_COLOR_A = '#1C1726'; 
// let GRADIENT_COLOR_B = '#351286';
// let CIRCLE_COLOR = '#C95792';

// peach/purple, gorgeous
let GRADIENT_COLOR_A = '#F8B55F';  
let GRADIENT_COLOR_B = '#C95792';
// let CIRCLE_COLOR = '#7C4585'; // dark purple
// let CIRCLE_COLOR = '#0A5EB0'; // dark blue (navy)
// let CIRCLE_COLOR = '#FFCFEF'; // very light pink
let BIG_CIRCLE_COLOR = '#6A1E55'; // nice maroon
// let CIRCLE_COLOR = '#B4D6CD'; // light minty blue-green
// let CIRCLE_COLOR = '#0B8494'; // turquoisey navy
// let CIRCLE_COLOR = '#C75B7A'; // mellow maroon, blends nicely
// let CIRCLE_COLOR = '#E9FF97'; // day glow yellow, kinda insane
// let CIRCLE_COLOR = '#E72929'; // bold red
let CIRCLE_COLOR = '#F7EFE5'; // eggshell white

// Add these for multiple circles

let NUM_CIRCLES = 9; // Example: Draw 5 circles
let CIRCLE_SPACING = 87; // Example: Time delay between circles in frames (adjust as needed)

// Add this helper function for zero-padding
function padFrameNumber(num: number): string {
    return num.toString().padStart(6, '0');
}

// Add these shader sources
const vertexShaderSource = passthroughVertexShader;
const fragmentShaderSource = blurFragmentShader;

// Simple fragment shader to just draw a texture
const drawTextureFragmentShaderSource = `
precision mediump float;
uniform sampler2D u_image;
uniform float u_flipY; // Use 1.0 for drawing to screen, 0.0 for FBO
varying vec2 v_texCoord;
void main() {
  // Flip Y coord if drawing to screen (WebGL origin is bottom-left)
  vec2 uv = v_texCoord;
  uv.y = mix(uv.y, 1.0 - uv.y, u_flipY);
  gl_FragColor = texture2D(u_image, uv);
}
`;

// Add these at the top with other globals
let gradientProgram: WebGLProgram | null = null;
let blurProgram: WebGLProgram | null = null;
let compositeProgram: WebGLProgram | null = null;

// Add these new variables at the top with other globals
let circlesCanvas: HTMLCanvasElement;
let circlesCtx: CanvasRenderingContext2D | null = null;

// Helper to convert hex to [r, g, b] in 0..1
function hexToRgb01(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return [
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
    ];
}

// Add these globals at the top with other state variables
let TRAIL_BLUR_RADIUS = 1; // Configurable blur radius for the trail
let TRAIL_BLUR_PASSES = 2;   // Number of blur passes for the trail
let trailBlurTempTex: WebGLTexture | null = null; // Temporary texture for trail blur

function initWebGL(canvas: HTMLCanvasElement) {
    gl = canvas.getContext('webgl', { 
        alpha: true,
        preserveDrawingBuffer: true  // Add this option
    });
    if (!gl) {
        throw new Error('WebGL not supported');
    }

    // Create shader program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    blurProgram = program;

    // Enable standard alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set up position attribute
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
    ]);
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(blurProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind before pointer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up texture coordinate attribute (standard mapping)
    const texCoords = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        1, 1,
    ]);
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texCoordLocation = gl.getAttribLocation(blurProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind before pointer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Create and set up texture
    frameTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Create temporary texture for multi-pass rendering
    tempTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Create framebuffer
    framebuffer = gl.createFramebuffer();

    // After creating tempTexture, also create blurOutputTexture
    blurOutputTexture = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, blurOutputTexture);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvas.width, canvas.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
}

export function setup({ canvas2d, canvasWebGL }: CanvasContexts) {
    const ctx = canvas2d.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context');
    }
    
    initWebGL(canvasWebGL);
    
    ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);
    
    // Add mouse move event listener to the WebGL canvas instead
    canvasWebGL.addEventListener('mousemove', (event) => {
        const rect = canvasWebGL.getBoundingClientRect()
        mouseX = event.clientX - rect.left
        mouseY = event.clientY - rect.top
        // Calculate vector FROM mouse TO rectangle instead
        dx = rectX - mouseX
        dy = rectY - mouseY
    })

    // Call this after initWebGL in setup()
    initGradientProgram(gl!);
    initCompositeProgram(gl!);
    initFadeProgram(gl!);
    initDrawTextureProgram(gl!);

    // Create offscreen canvas for circles
    circlesCanvas = document.createElement('canvas');
    circlesCanvas.width = canvas2d.width;
    circlesCanvas.height = canvas2d.height;
    circlesCtx = circlesCanvas.getContext('2d');

    // Create textures for the fading trail
    circleTrailTexA = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexA);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);

    circleTrailTexB = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexB);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);

    // Create framebuffer for trail rendering
    trailFramebuffer = gl!.createFramebuffer();

    // Set initial read/write textures
    readTrailTex = circleTrailTexA;
    writeTrailTex = circleTrailTexB;

    // Initialize the temporary texture for trail blurring
    trailBlurTempTex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, trailBlurTempTex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

    // (Re-)allocate frameTexture, tempTexture, blurOutputTexture, and trail textures
    gl!.bindTexture(gl!.TEXTURE_2D, frameTexture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

    gl!.bindTexture(gl!.TEXTURE_2D, tempTexture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

    gl!.bindTexture(gl!.TEXTURE_2D, blurOutputTexture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

    // Allocate trail textures
    gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexA);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.bindTexture(gl!.TEXTURE_2D, circleTrailTexB);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

    // Clear the initial trail texture (optional, but good practice)
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, trailFramebuffer);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, readTrailTex, 0);
    gl!.clearColor(0, 0, 0, 0); // Transparent black
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    // Also clear the temp trail blur texture
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, trailBlurTempTex, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null); // Unbind
}

let rectWidth = 300
let rectHeight = 300

export function draw({ canvas2d, canvasWebGL }: CanvasContexts) {
    const ctx = canvas2d.getContext('2d');
    if (!ctx || !gl || !framebuffer || !frameTexture || !tempTexture ||
        !positionBuffer || !texCoordBuffer || // Check buffers
        !gradientProgram || !compositeProgram || !blurProgram || !fadeProgram || !drawTextureProgram || // Check programs
        !circleTrailTexA || !circleTrailTexB || !trailFramebuffer || !readTrailTex || !writeTrailTex || // Check trail resources
        !trailBlurTempTex || // Check new temp texture
        !blurOutputTexture) {
        throw new Error('Context or critical resources not initialized');
    }

    // --- 1. Draw gradient to frameTexture (offscreen) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); // Use main framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameTexture, 0);
    gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
    gl.useProgram(gradientProgram);

    // Set uniforms for colors
    const colorA = hexToRgb01(GRADIENT_COLOR_A);
    const colorB = hexToRgb01(GRADIENT_COLOR_B);
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorA'), colorA);
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorB'), colorB);

    // Set the u_time uniform
    const timeLocation = gl.getUniformLocation(gradientProgram, 'u_time');
    const currentTime = frameCount / FRAMES_PER_SECOND;
    gl.uniform1f(timeLocation, currentTime);

    // Set the noise region uniforms
    const noiseCenterLocation = gl.getUniformLocation(gradientProgram, 'u_noiseCenter');
    const noiseWidthLocation = gl.getUniformLocation(gradientProgram, 'u_noiseWidth');
    gl.uniform1f(noiseCenterLocation, NOISE_CENTER);
    gl.uniform1f(noiseWidthLocation, NOISE_WIDTH);

    // Set the noise parameter uniforms
    const noiseAmplitudeLocation = gl.getUniformLocation(gradientProgram, 'u_noiseAmplitude');
    const noiseSpeedLocation = gl.getUniformLocation(gradientProgram, 'u_noiseSpeed');
    const noiseScaleLocation = gl.getUniformLocation(gradientProgram, 'u_noiseScale');
    const noiseOffsetScaleLocation = gl.getUniformLocation(gradientProgram, 'u_noiseOffsetScale');  
    gl.uniform1f(noiseAmplitudeLocation, NOISE_AMPLITUDE);
    gl.uniform1f(noiseSpeedLocation, NOISE_SPEED);
    gl.uniform1f(noiseScaleLocation, NOISE_SCALE);
    gl.uniform1f(noiseOffsetScaleLocation, NOISE_OFFSET_SCALE);

    // --- Add this: set the wave amplitude uniform ---
    const waveAmplitudeLocation = gl.getUniformLocation(gradientProgram, 'u_waveAmplitude');
    gl.uniform1f(waveAmplitudeLocation, WAVE_AMPLITUDE);

    // --- Add this: set the wave x scale uniform ---
    const waveXScaleLocation = gl.getUniformLocation(gradientProgram, 'u_waveXScale');
    gl.uniform1f(waveXScaleLocation, WAVE_XSCALE);

    // --- Add this: set the wave time scale uniform ---
    const waveTimeScaleLocation = gl.getUniformLocation(gradientProgram, 'u_waveTimeScale');
    gl.uniform1f(waveTimeScaleLocation, WAVE_TIMESCALE);

    // Draw the quad (gradient background)
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- 2. Draw CURRENT lines/circles to offscreen 2D canvas and upload as texture ---
    if (circlesCtx) {
        // Clear the 2D canvas completely ONCE before drawing all elements for this frame
        circlesCtx.clearRect(0, 0, circlesCanvas.width, circlesCanvas.height);

        // draw a big circle
        circlesCtx.beginPath();
        circlesCtx.arc(circlesCanvas.width / 2, circlesCanvas.height / 2, 100, 0, 2 * Math.PI, false);
        circlesCtx.fillStyle = BIG_CIRCLE_COLOR;
        circlesCtx.fill();
        circlesCtx.closePath();

        // Lissajous parameters (base)
        const a = 3.5;
        const b = 5.5;
        const delta = Math.PI / 2;
        const base_time_in_seconds = frameCount / FRAMES_PER_SECOND; // Base time for the leading element
        const scale_factor = 0.1; // Original scaling factor for time in Lissajous calculation
        const margin = 155;
        const Ax = (circlesCanvas.width / 2) - margin;
        const By = (circlesCanvas.height / 2) - margin;
        let maxLineLength = 40;
        let lineLength = 40; // Desired line length (kept for potential future use)
        let halfLineLength = lineLength / 2; // (kept for potential future use)
        const circleRadius = 10; // Define the circle radius

        // Loop to draw n elements
        for (let i = 0; i < NUM_CIRCLES; i++) {
            // Calculate the effective time 't' for this element
            const circle_time_in_seconds = base_time_in_seconds - (i * CIRCLE_SPACING / FRAMES_PER_SECOND); // Correct spacing to seconds
            const t = scale_factor * circle_time_in_seconds;

            // taper the line length
            if ((i * 2) < maxLineLength) {
                lineLength = i * 2;
                halfLineLength = lineLength / 2;
            } else {
                lineLength = maxLineLength;
                halfLineLength = lineLength / 2;
            }

            // Calculate position (center point) for this element
            const cx = circlesCanvas.width / 2 + Ax * Math.sin(a * t + delta);
            const cy = circlesCanvas.height / 2 + By * Math.sin(b * t);

            // --- Calculations for perpendicular line (kept but not used for drawing) ---
            const dxdt = Ax * a * Math.cos(a * t + delta) * scale_factor;
            const dydt = By * b * Math.cos(b * t) * scale_factor;
            let px = -dydt;
            let py = dxdt;
            const mag = Math.sqrt(px * px + py * py);
            if (mag > 1e-6) {
                px /= mag;
                py /= mag;
            } else {
                px = 1;
                py = 0;
            }
            const startX = cx - px * halfLineLength;
            const startY = cy - py * halfLineLength;
            const endX = cx + px * halfLineLength;
            const endY = cy + py * halfLineLength;
            // --- End of line calculations ---

            // --- Draw the circle ---
            circlesCtx.beginPath();
            circlesCtx.arc(cx, cy, circleRadius, 0, 2 * Math.PI, false);
            circlesCtx.fillStyle = CIRCLE_COLOR; // Use fillStyle for circles
            circlesCtx.fill(); // Fill the circle
            circlesCtx.closePath(); // Good practice to close path

            // circlesCtx.beginPath();
            // circlesCtx.moveTo(startX, startY);
            // circlesCtx.lineTo(endX, endY);
            // circlesCtx.lineWidth = 10; // Set line thickness
            // circlesCtx.strokeStyle = CIRCLE_COLOR; // Set line color
            // circlesCtx.stroke(); // Draw the line
            // circlesCtx.closePath();
        }
    }
    if (!window.circleTexture) {
        window.circleTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, window.circleTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.activeTexture(gl.TEXTURE1); // Use texture unit 1 for the current element temporarily
    gl.bindTexture(gl.TEXTURE_2D, window.circleTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, circlesCanvas);

    // --- 2.5 Update Trail Texture ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTrailTex, 0);
    gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);

    // a) Fade Pass: Draw the previous frame's trail (readTrailTex) faded into writeTrailTex
    gl.useProgram(fadeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTrailTex);
    gl.uniform1i(gl.getUniformLocation(fadeProgram, "u_image"), 0);
    gl.uniform1f(gl.getUniformLocation(fadeProgram, "u_fadeAmount"), FADE_AMOUNT);
    gl.uniform1f(gl.getUniformLocation(fadeProgram, "u_flipY"), 0.0); // Rendering to FBO
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // b) Draw Current Circle Pass: Draw the current circle (window.circleTexture) on top
    gl.enable(gl.BLEND); // Enable alpha blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending

    gl.useProgram(drawTextureProgram);
    gl.activeTexture(gl.TEXTURE0); // Texture unit 0 is already bound to window.circleTexture from step 2
    gl.bindTexture(gl.TEXTURE_2D, window.circleTexture);
    gl.uniform1i(gl.getUniformLocation(drawTextureProgram, "u_image"), 0);
    gl.uniform1f(gl.getUniformLocation(drawTextureProgram, "u_flipY"), 0.0); // Rendering to FBO
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disable(gl.BLEND); // Disable blending

    // --- 2.75 Blur Trail Texture (NEW STEP) ---
    let readTexTrailBlur = writeTrailTex;      // Start reading from the updated trail
    let writeTexTrailBlur = trailBlurTempTex;  // Write to the temporary blur texture
    let finalBlurredTrailTex = writeTrailTex; // Assume 0 passes initially

    if (TRAIL_BLUR_PASSES > 0 && TRAIL_BLUR_RADIUS > 0) {
         gl.useProgram(blurProgram); // Use the existing blur program
         gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), canvasWebGL.width, canvasWebGL.height);
         gl.uniform1f(gl.getUniformLocation(blurProgram, "u_blurRadius"), TRAIL_BLUR_RADIUS);
         gl.uniform1f(gl.getUniformLocation(blurProgram, "u_time"), currentTime);
         gl.uniform1f(gl.getUniformLocation(blurProgram, "u_flipY"), 0.0); // Always 0.0 when rendering to FBO

        for (let i = 0; i < TRAIL_BLUR_PASSES; ++i) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, trailFramebuffer); // Use the trail FBO
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTexTrailBlur, 0); // Set output texture

            gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height); // Set viewport

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, readTexTrailBlur); // Bind input texture
            gl.uniform1i(gl.getUniformLocation(blurProgram, "u_image"), 0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Execute blur pass

            // Swap textures for next pass
            const tmp = readTexTrailBlur;
            readTexTrailBlur = writeTexTrailBlur;
            writeTexTrailBlur = tmp;
        }
        finalBlurredTrailTex = readTexTrailBlur; // The last texture read from is the final result
    }
    // Ensure we unbind the framebuffer if we used it
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


    // --- 3. Composite: blend gradient and FINAL (blurred) trail into tempTexture ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); // Use main framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempTexture, 0);
    gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
    gl.useProgram(compositeProgram);

    // Bind gradient as u_gradient (texture unit 0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_gradient"), 0);

    // Bind FINAL (potentially blurred) trail as u_circle (texture unit 1)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, finalBlurredTrailTex); // <-- Use the final blurred trail texture
    gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_circle"), 1);

    // Set u_flipY to 0 when compositing to a texture
    gl.uniform1i(gl.getUniformLocation(compositeProgram, "u_flipY"), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- 4. Blur passes: ping-pong between tempTexture and blurOutputTexture ---
    let readTexBlur = tempTexture;          // Start reading from the composited texture
    let writeTexBlur = blurOutputTexture;

    for (let i = 0; i < BLUR_PASSES; ++i) {
        const isLast = (i === BLUR_PASSES - 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, isLast ? null : framebuffer); // Render to screen on last pass
        if (!isLast) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTexBlur, 0);
        }

        gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
        gl.useProgram(blurProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, readTexBlur); // Read from the correct blur texture
        gl.uniform1i(gl.getUniformLocation(blurProgram, "u_image"), 0);
        gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), canvasWebGL.width, canvasWebGL.height);
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_blurRadius"), BLUR_RADIUS);
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_time"), currentTime); // Use calculated time

        // Set the u_flipY uniform: 1.0 for final pass to screen, 0.0 for FBO
        gl.uniform1f(gl.getUniformLocation(blurProgram, "u_flipY"), isLast ? 1.0 : 0.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Swap read/write textures for next blur pass
        const tmp = readTexBlur;
        readTexBlur = writeTexBlur;
        writeTexBlur = tmp;
    }

    // --- 5. If no blur passes, draw composited result (tempTexture) directly to screen ---
    if (BLUR_PASSES === 0) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
        gl.viewport(0, 0, canvasWebGL.width, canvasWebGL.height);
        gl.useProgram(drawTextureProgram); // Use the simple draw texture program

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tempTexture); // Draw the composited result
        gl.uniform1i(gl.getUniformLocation(drawTextureProgram, "u_image"), 0);

        // Set u_flipY to 1 when drawing to the screen
        gl.uniform1f(gl.getUniformLocation(drawTextureProgram, "u_flipY"), 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // --- 6. Swap Trail Textures for next frame ---
    const tempTrail = readTrailTex;
    readTrailTex = writeTrailTex;
    writeTrailTex = tempTrail;

    frameCount++;
}

async function startRendering() {
    try {
        dirHandle = await window.showDirectoryPicker();
        currentFrameNumber = 0;
        isRendering = true;
        console.log('Starting render sequence...');
    } catch (err) {
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
    async function animate() {
        draw(contexts);
        
        if (isRendering) {
            await saveCurrentFrame(contexts.canvasWebGL);
            requestAnimationFrame(animate);
        } else {
            requestAnimationFrame(animate);
        }
    }

    const renderButton = document.querySelector('#render-button');
    renderButton?.addEventListener('click', startRendering);
    
    setup(contexts);
    animate();
}

// Call this after initWebGL in setup()
function initGradientProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, simpleGradientFragmentShader);
    gl.compileShader(fragmentShader);

    gradientProgram = gl.createProgram()!;
    gl.attachShader(gradientProgram, vertexShader);
    gl.attachShader(gradientProgram, fragmentShader);
    gl.linkProgram(gradientProgram);

    // Set up attributes for this program
    const positionLocation = gl.getAttribLocation(gradientProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(gradientProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

function initCompositeProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, compositeFragmentShader);
    gl.compileShader(fragmentShader);

    compositeProgram = gl.createProgram()!;
    gl.attachShader(compositeProgram, vertexShader);
    gl.attachShader(compositeProgram, fragmentShader);
    gl.linkProgram(compositeProgram);

    // Set up attributes for this program
    const positionLocation = gl.getAttribLocation(compositeProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(compositeProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

function initFadeProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Add error checking for shader compilation

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fadeFragmentShader); // Use fade fragment shader
    gl.compileShader(fragmentShader);
    // TODO: Add error checking for shader compilation

    fadeProgram = gl.createProgram()!;
    gl.attachShader(fadeProgram, vertexShader);
    gl.attachShader(fadeProgram, fragmentShader);
    gl.linkProgram(fadeProgram);
    // TODO: Add error checking for program linking

     // Set up attributes for this program
    const positionLocation = gl.getAttribLocation(fadeProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(fadeProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

function initDrawTextureProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Add error checking

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, drawTextureFragmentShaderSource); // Use simple texture draw shader
    gl.compileShader(fragmentShader);
    // TODO: Add error checking

    drawTextureProgram = gl.createProgram()!;
    gl.attachShader(drawTextureProgram, vertexShader);
    gl.attachShader(drawTextureProgram, fragmentShader);
    gl.linkProgram(drawTextureProgram);
    // TODO: Add error checking

    // Set up attributes for this program
    const positionLocation = gl.getAttribLocation(drawTextureProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(drawTextureProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}