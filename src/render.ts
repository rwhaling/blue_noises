import passthroughVertexShader from './shaders/passthrough.vert?raw'
import compositeGridGradientFragmentShader from './shaders/compositeGridGradient.frag?raw'
// import gridGradientFragmentShader from './shaders/gridgradient.frag?raw' // Not used currently?
import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
import noiseSpectralCompositeFragmentShader from './shaders/noiseSpectralComposite.frag?raw'

// Helper function (can stay outside or be a static method)
function hexToRgb01(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return [
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
    ];
}

// Define interfaces for uniform objects to improve type safety
interface GradientUniforms {
    time: number;
    noiseCenter: number;
    noiseWidth: number;
    noiseAmplitude: number;
    noiseSpeed: number;
    noiseScale: number;
    noiseOffsetScale: number;
    waveAmplitude: number;
    waveXScale: number;
    waveTimeScale: number;
    gridScale: number;
    gridRotation: number;
    gridAxisScale: [number, number];
    gridWaveSpeed: number;
    colorA: [number, number, number]; // Added for flexibility, default B&W
    colorB: [number, number, number]; // Added for flexibility, default B&W
}

interface BlurUniforms {
    resolution: [number, number];
    radius: number;
    time: number; // If shader uses it
}

interface CompositeUniforms {
    time: number;
    noiseSpeed: number;
    noiseScale: number;
    gridScale: number;
    gridRotation: number;
    gridAxisScale: [number, number];
    noiseAmplitude: number; // Gradient Amplitude
    shapeNoiseScale: number;
    shapeNoiseAmplitude: number;
    hfShapeNoiseScale: number;
    hfShapeNoiseAmount: number;
    colorA: [number, number, number];
    colorB: [number, number, number];
    colorC: [number, number, number];
    colorD: [number, number, number];
}


export class Renderer {
    private gl: WebGLRenderingContext;
    private canvas: HTMLCanvasElement;

    // Programs
    private gradientProgram!: WebGLProgram;
    private blurProgram!: WebGLProgram;
    private spectralCompositeProgram!: WebGLProgram;

    // Buffers
    private positionBuffer!: WebGLBuffer;
    private texCoordBuffer!: WebGLBuffer;

    // Textures
    // We need distinct names for the *output* of the gradient pass
    // and the *input* texture for the elements.
    gradientOutputTexture!: WebGLTexture; // Output of Pass 1 (was frameTexture)
    elementsInputTexture!: WebGLTexture;  // Input from 2D Canvas (was elementsTexture)
    blurredElementsTexture!: WebGLTexture;// Output of Blur Pass
    tempBlurTexture!: WebGLTexture;       // Temp for Blur Ping-Pong

    // Framebuffers
    private gradientFramebuffer!: WebGLFramebuffer; // Renders gradientOutputTexture
    private blurFramebuffer!: WebGLFramebuffer;     // Used for blur passes

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: true // Keep this if needed for saving frames
        });
        if (!context) {
            throw new Error('WebGL not supported');
        }
        this.gl = context;

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    // Initialization orchestrator
    public init(): void {
        this.initBuffers();
        this.initPrograms();
        // Textures and FBOs depend on size, initialized in resize
        this.resize(this.canvas.width, this.canvas.height); // Initial allocation
    }

    // Resize handler (allocates/reallocates textures and FBOs)
    public resize(width: number, height: number): void {
        const gl = this.gl;

        // Update canvas size if necessary (optional, depends on usage)
        // this.canvas.width = width;
        // this.canvas.height = height;

        // --- Create / Reallocate Textures ---
        this.gradientOutputTexture = this.createAndAllocateTexture(this.gradientOutputTexture, width, height);
        this.elementsInputTexture = this.createAndAllocateTexture(this.elementsInputTexture, width, height);
        this.blurredElementsTexture = this.createAndAllocateTexture(this.blurredElementsTexture, width, height);
        this.tempBlurTexture = this.createAndAllocateTexture(this.tempBlurTexture, width, height);

        // --- Create / Reconfigure Framebuffers ---
        // Gradient FBO
        if (!this.gradientFramebuffer) {
            this.gradientFramebuffer = gl.createFramebuffer();
            if (!this.gradientFramebuffer) throw new Error("Failed to create gradientFramebuffer");
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.gradientFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.gradientOutputTexture, 0);

        // Blur FBO
        if (!this.blurFramebuffer) {
            this.blurFramebuffer = gl.createFramebuffer();
            if (!this.blurFramebuffer) throw new Error("Failed to create blurFramebuffer");
        }
        // We attach textures to the blur FBO during the blur pass itself

        // --- Initial Clear (Optional but good practice) ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurredElementsTexture, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tempBlurTexture, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Unbind FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Unbind Texture
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // --- Rendering Pass Methods ---

    public renderGradientPass(uniforms: GradientUniforms): void {
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.gradientFramebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height); // Use canvas dimensions
        gl.useProgram(this.gradientProgram);

        // Set uniforms
        gl.uniform3fv(gl.getUniformLocation(this.gradientProgram, 'u_colorA'), uniforms.colorA);
        gl.uniform3fv(gl.getUniformLocation(this.gradientProgram, 'u_colorB'), uniforms.colorB);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_time'), uniforms.time);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseCenter'), uniforms.noiseCenter);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseWidth'), uniforms.noiseWidth);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseAmplitude'), uniforms.noiseAmplitude);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseSpeed'), uniforms.noiseSpeed);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseScale'), uniforms.noiseScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_noiseOffsetScale'), uniforms.noiseOffsetScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_waveAmplitude'), uniforms.waveAmplitude);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_waveXScale'), uniforms.waveXScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_waveTimeScale'), uniforms.waveTimeScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_gridScale'), uniforms.gridScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_gridRotation'), uniforms.gridRotation);
        gl.uniform2fv(gl.getUniformLocation(this.gradientProgram, 'u_gridAxisScale'), uniforms.gridAxisScale);
        gl.uniform1f(gl.getUniformLocation(this.gradientProgram, 'u_gridWaveSpeed'), uniforms.gridWaveSpeed);

        // Draw the quad
        gl.clearColor(0, 0, 0, 0); // Clear FBO
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.bindAttributesAndDraw(this.gradientProgram); // Use helper

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO
    }

    public uploadElementsTexture(elementsCanvas: HTMLCanvasElement): void {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0); // Use an available texture unit
        gl.bindTexture(gl.TEXTURE_2D, this.elementsInputTexture);
        // Update texture parameters before uploading data - Prevents potential issues?
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // Ensure Y is not flipped during upload
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementsCanvas);
        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind
        // gl.finish(); // DEBUG: Force sync after upload
    }

    public applyBlurPasses(uniforms: BlurUniforms, passes: number): WebGLTexture {
        const gl = this.gl;

        // If no blur needed, return the original elements texture
        if (passes <= 0 || uniforms.radius <= 0) {
            return this.elementsInputTexture;
        }

        gl.useProgram(this.blurProgram);
        gl.uniform2f(gl.getUniformLocation(this.blurProgram, "u_resolution"), uniforms.resolution[0], uniforms.resolution[1]);
        gl.uniform1f(gl.getUniformLocation(this.blurProgram, "u_blurRadius"), uniforms.radius);
        gl.uniform1f(gl.getUniformLocation(this.blurProgram, "u_time"), uniforms.time);
        gl.uniform1f(gl.getUniformLocation(this.blurProgram, "u_flipY"), 0.0); // Render to FBO, don't flip Y

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebuffer);
        gl.viewport(0, 0, uniforms.resolution[0], uniforms.resolution[1]);

        let readTex = this.elementsInputTexture;
        let writeTex = this.tempBlurTexture; // Start writing to temp
        let finalOutputTexture = this.blurredElementsTexture; // Where the final result should land

        for (let i = 0; i < passes; ++i) {
            // Determine the actual write target for this pass
            // If it's the *last* pass, write to finalOutputTexture
            // Otherwise, write to the intermediate writeTex
            const currentWriteTarget = (i === passes - 1) ? finalOutputTexture : writeTex;

            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, currentWriteTarget, 0);

            gl.activeTexture(gl.TEXTURE0); // Use texture unit 0 for blur input
            gl.bindTexture(gl.TEXTURE_2D, readTex);
            gl.uniform1i(gl.getUniformLocation(this.blurProgram, "u_image"), 0);

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.bindAttributesAndDraw(this.blurProgram); // Use helper

            // Prepare for next pass (or finish)
            // The texture we just wrote to becomes the read texture for the next iteration
            readTex = currentWriteTarget;
            // Swap the intermediate target if we're not on the last pass
            if (i < passes - 1) {
                 writeTex = (currentWriteTarget === this.tempBlurTexture) ? this.blurredElementsTexture : this.tempBlurTexture;
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO
        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture

        return finalOutputTexture; // Return the texture holding the final blurred result
    }


    public renderCompositePass(uniforms: CompositeUniforms, blurredElementsTex: WebGLTexture): void {
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(this.spectralCompositeProgram);

        // Bind gradient texture (output from gradient pass) to unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.gradientOutputTexture);
        gl.uniform1i(gl.getUniformLocation(this.spectralCompositeProgram, "u_gradientTex"), 0);

        // Bind blurred elements texture (output from blur pass) to unit 1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, blurredElementsTex); // Use the texture returned by applyBlurPasses
        gl.uniform1i(gl.getUniformLocation(this.spectralCompositeProgram, "u_elementsTex"), 1);

        // Set palette color uniforms
        gl.uniform3fv(gl.getUniformLocation(this.spectralCompositeProgram, "u_colorA"), uniforms.colorA);
        gl.uniform3fv(gl.getUniformLocation(this.spectralCompositeProgram, "u_colorB"), uniforms.colorB);
        gl.uniform3fv(gl.getUniformLocation(this.spectralCompositeProgram, "u_colorC"), uniforms.colorC);
        gl.uniform3fv(gl.getUniformLocation(this.spectralCompositeProgram, "u_colorD"), uniforms.colorD);

        // Set u_flipY for drawing to the screen
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, "u_flipY"), 1.0);

        // Pass Noise/Grid uniforms for displacement
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_time'), uniforms.time);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_noiseSpeed'), uniforms.noiseSpeed);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_noiseScale'), uniforms.noiseScale);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_gridScale'), uniforms.gridScale);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_gridRotation'), uniforms.gridRotation);
        gl.uniform2fv(gl.getUniformLocation(this.spectralCompositeProgram, 'u_gridAxisScale'), uniforms.gridAxisScale);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_noiseAmplitude'), uniforms.noiseAmplitude); // Grad amp
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_shapeNoiseScale'), uniforms.shapeNoiseScale);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_shapeNoiseAmplitude'), uniforms.shapeNoiseAmplitude);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_hfShapeNoiseScale'), uniforms.hfShapeNoiseScale);
        gl.uniform1f(gl.getUniformLocation(this.spectralCompositeProgram, 'u_hfShapeNoiseAmount'), uniforms.hfShapeNoiseAmount);

        // Clear screen before drawing final texture
        gl.clearColor(0, 0, 0, 1); // Clear with opaque black
        gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Draw the final composited quad
        this.bindAttributesAndDraw(this.spectralCompositeProgram); // Use helper

        // Unbind textures (good practice)
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // --- Initialization Helpers ---

    private initBuffers(): void {
        const gl = this.gl;

        const positions = new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]);
        this.positionBuffer = gl.createBuffer();
        if (!this.positionBuffer) throw new Error("Failed to create position buffer");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texCoords = new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]);
        this.texCoordBuffer = gl.createBuffer();
        if (!this.texCoordBuffer) throw new Error("Failed to create texCoord buffer");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind
    }

    private initPrograms(): void {
        this.gradientProgram = this.createProgram(passthroughVertexShader, compositeGridGradientFragmentShader);
        this.blurProgram = this.createProgram(passthroughVertexShader, blurFragmentShader);
        this.spectralCompositeProgram = this.createProgram(passthroughVertexShader, noiseSpectralCompositeFragmentShader);
         // Set up attributes once after programs are created (can be done here or per program)
        // this.setupAttributes(this.gradientProgram);
        // this.setupAttributes(this.blurProgram);
        // this.setupAttributes(this.spectralCompositeProgram);
    }

    private createShader(type: number, source: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) throw new Error(`Failed to create shader (type: ${type})`);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${info}`);
        }
        return shader;
    }

    private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
        const gl = this.gl;
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        if (!program) throw new Error("Failed to create program");
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program); // Clean up shaders too? Maybe not if used elsewhere
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error(`Program link error: ${info}`);
        }

        // Detach and delete shaders after linking (optional but good practice)
        gl.detachShader(program, vertexShader);
        gl.detachShader(program, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        return program;
    }

     // REMOVED setupAttributes function (replaced by bindAttributesAndDraw)
    // private setupAttributes(program: WebGLProgram): void { ... }

    // ADDED: Helper to bind attributes and draw (reduces repetition)
    private bindAttributesAndDraw(program: WebGLProgram): void {
        const gl = this.gl;
        // Ensure program is active (redundant if called immediately after useProgram)
        // gl.useProgram(program);

        const positionLocation = gl.getAttribLocation(program, "a_position");
        if (positionLocation >= 0) {
            gl.enableVertexAttribArray(positionLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        } else {
             // Only warn if it's truly unexpected for a given shader
            // console.warn(`Attribute 'a_position' not found in program.`);
        }

        const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
         if (texCoordLocation >= 0) {
            gl.enableVertexAttribArray(texCoordLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        } else {
            // Only warn if it's truly unexpected for a given shader
            // console.warn(`Attribute 'a_texCoord' not found in program.`);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Clean up state? Disable vertex attrib arrays? Unbind buffer?
        // It's often okay to leave them bound/enabled if the next draw uses the same ones.
        // Let's leave them for now.
        // if (positionLocation >= 0) gl.disableVertexAttribArray(positionLocation);
        // if (texCoordLocation >= 0) gl.disableVertexAttribArray(texCoordLocation);
        // gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }


    private createAndAllocateTexture(existingTexture: WebGLTexture | null, width: number, height: number): WebGLTexture {
        const gl = this.gl;
        let texture = existingTexture;

        if (!texture) {
            texture = gl.createTexture();
            if (!texture) throw new Error("Failed to create texture");
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture); // Bind existing texture
        }

        // Allocate or reallocate storage
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture
        return texture;
    }

    // Static helper for color conversion if preferred
    public static hexToRgb01 = hexToRgb01;
} 