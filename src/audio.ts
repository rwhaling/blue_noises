// Configuration Literals
const TARGET_DEVICE_ID: string | null = null; // Set to a specific device ID string if needed, or null for default
const FFT_SIZE = 256;          // Power of 2 (e.g., 128, 256, 512, 1024). Affects frequency resolution.
const SMOOTHING_FACTOR = 0.75;   // 0 = no smoothing, closer to 1 = more smoothing.
const MIN_DECIBELS = -90;       // Minimum decibel value for analysis range.
const MAX_DECIBELS = -10;       // Maximum decibel value for analysis range.

export class AudioAnalyzer {
    private audioContext: AudioContext | null = null;
    private analyserNode: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isInitialized = false;
    private smoothedLevel = 0;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private stream: MediaStream | null = null;

    constructor() {
        console.log("AudioAnalyzer: Instance created.");
    }

    // --- Public API ---

    /**
     * Initializes the audio context, requests microphone access, and sets up the analyzer.
     * Must be called after a user interaction (e.g., button click).
     */
    public async initializeAudio(): Promise<void> {
        if (this.isInitialized) {
            console.log("AudioAnalyzer: Already initialized.");
            return;
        }

        console.log("AudioAnalyzer: Initializing audio...");
        try {
            // 1. Create Audio Context (check for existing context and resume if suspended)
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                console.log(`AudioAnalyzer: AudioContext created. State: ${this.audioContext.state}`);
            }

            // If context is suspended, try to resume it.
            if (this.audioContext.state === 'suspended') {
                 console.log("AudioAnalyzer: AudioContext is suspended, attempting to resume...");
                 await this.audioContext.resume();
                 console.log(`AudioAnalyzer: AudioContext resumed. State: ${this.audioContext.state}`);
            }

            // Ensure context is running before proceeding
             if (this.audioContext.state !== 'running') {
                throw new Error(`AudioContext failed to start or resume. State: ${this.audioContext.state}`);
             }

            // --- Find Preferred Device ID (with fallback) ---
            let targetDeviceId: string | null = TARGET_DEVICE_ID; // Start with the constant override
            const preferredDeviceLabel = "BlackHole 2ch"; // Target label fragment

            if (!targetDeviceId) { // Only search if TARGET_DEVICE_ID is not set
                console.log(`AudioAnalyzer: Searching for preferred device containing label: "${preferredDeviceLabel}"...`);
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
                    const preferredDevice = audioInputDevices.find(device => device.label.includes(preferredDeviceLabel));

                    if (preferredDevice) {
                        targetDeviceId = preferredDevice.deviceId;
                        console.log(`AudioAnalyzer: Found preferred device: "${preferredDevice.label}" (ID: ${targetDeviceId}). Will attempt to use it.`);
                    } else {
                        console.log(`AudioAnalyzer: Preferred device "${preferredDeviceLabel}" not found. Will use default audio input.`);
                    }
                     // Log all devices (optional, keep from previous step if desired)
                     console.log("AudioAnalyzer: Available Audio Input Devices:");
                     if (audioInputDevices.length > 0) {
                        audioInputDevices.forEach((device, index) => {
                            console.log(`  [${index}] Label: "${device.label}" | Device ID: "${device.deviceId}"`);
                        });
                     } else {
                        console.log("AudioAnalyzer: No audio input devices found.");
                     }

                } catch (enumErr) {
                    console.error("AudioAnalyzer: Error enumerating devices:", enumErr);
                    console.log("AudioAnalyzer: Proceeding with default audio input due to enumeration error.");
                }
            } else {
                 console.log(`AudioAnalyzer: Using explicitly set TARGET_DEVICE_ID: ${targetDeviceId}`);
            }
            // --- End Device ID Search ---

            // 2. Get Audio Input Stream using the determined device ID or default
            console.log("AudioAnalyzer: Requesting microphone access...");
            const constraints: MediaStreamConstraints = {
                // Use the dynamically determined targetDeviceId, fallback to true if still null
                audio: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
                video: false
            };
            console.log("AudioAnalyzer: Using constraints:", JSON.stringify(constraints)); // Log the final constraints

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const audioTracks = this.stream.getAudioTracks();
            if (audioTracks.length > 0) {
                const settings = audioTracks[0].getSettings();
                // Ensure settings.deviceId exists before logging
                const currentDeviceId = settings.deviceId || 'N/A';
                const currentDeviceLabel = audioTracks[0].label || 'N/A';
                console.log(`AudioAnalyzer: Successfully using audio device: "${currentDeviceLabel}" (ID: ${currentDeviceId})`);
            } else {
                console.warn("AudioAnalyzer: No audio track found in the stream.");
                throw new Error("No audio track available.");
            }

            // 3. Create Source Node
            this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
            console.log("AudioAnalyzer: MediaStreamSourceNode created.");

            // 4. Create Analyzer Node
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = FFT_SIZE;
            this.analyserNode.minDecibels = MIN_DECIBELS;
            this.analyserNode.maxDecibels = MAX_DECIBELS;
            this.analyserNode.smoothingTimeConstant = 0; // We'll do our own smoothing
            console.log("AudioAnalyzer: AnalyserNode created with FFT_SIZE:", FFT_SIZE);


            // 5. Setup Data Array
            const bufferLength = this.analyserNode.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            console.log("AudioAnalyzer: Data array created with length:", bufferLength);


            // 6. Connect Nodes: Source -> Analyser
            this.sourceNode.connect(this.analyserNode);
            // We don't connect the analyser to the destination (speakers)
            console.log("AudioAnalyzer: Nodes connected (Source -> Analyser).");


            this.isInitialized = true;
            this.smoothedLevel = 0; // Reset level on init
            console.log("AudioAnalyzer: Initialization successful.");

        } catch (err) {
            console.error("AudioAnalyzer: Error initializing audio:", err);
            this.isInitialized = false;
            // Clean up potentially created resources if init failed mid-way
            this.cleanupAudio();
        }
    }

    /**
     * Stops the audio stream and disconnects nodes.
     */
    public cleanupAudio(): void {
         console.log("AudioAnalyzer: Cleaning up audio resources...");
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
             console.log("AudioAnalyzer: MediaStream tracks stopped.");
        }
         if (this.sourceNode) {
             this.sourceNode.disconnect();
             this.sourceNode = null;
             console.log("AudioAnalyzer: Source node disconnected.");
         }
         // Analyser node disconnects automatically when source is disconnected
         this.analyserNode = null;
         this.stream = null;
         this.dataArray = null;
         // Don't close the context here, might want to reuse it.
         // if (this.audioContext && this.audioContext.state !== 'closed') {
         //     this.audioContext.close();
         //     console.log("AudioAnalyzer: AudioContext closed.");
         // }
         // this.audioContext = null;
         this.isInitialized = false;
         this.smoothedLevel = 0;
         console.log("AudioAnalyzer: Cleanup complete.");
    }


    /**
     * Gets the current smoothed audio level (0-1 range).
     * Updates the internal analysis data.
     * Returns 0 if not initialized.
     */
    public getSmoothedLevel(): number {
        if (!this.isInitialized || !this.analyserNode || !this.dataArray) {
            // console.warn("AudioAnalyzer: Cannot get level, not initialized.");
            return 0;
        }

        this.analyserNode.getByteFrequencyData(this.dataArray);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;

        // Normalize the average to a 0-1 range
        const normalizedLevel = average / 255.0;

        // Apply exponential moving average for smoothing
        this.smoothedLevel = SMOOTHING_FACTOR * this.smoothedLevel + (1 - SMOOTHING_FACTOR) * normalizedLevel;

        // Clamp the value just in case
        return Math.max(0, Math.min(1, this.smoothedLevel));
    }

     /**
     * Returns whether the analyzer has been successfully initialized.
     */
     public checkInitialized(): boolean {
        return this.isInitialized;
     }
}
