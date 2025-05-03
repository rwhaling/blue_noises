precision highp float;

uniform vec3 u_colorA;
uniform vec3 u_colorB;
varying vec2 v_texCoord;
uniform float u_time;
uniform float u_noiseSpeed;       // EDIT: Now primarily for displacement noise
uniform float u_noiseScale;
uniform float u_gridScale;
uniform float u_gridRotation;   // EDIT: Added rotation uniform (radians)
uniform vec2 u_gridAxisScale;   // EDIT: Added axis scaling uniform (xScale, yScale)
uniform float u_noiseAmplitude; // Get noise amplitude uniform
uniform float u_gridWaveSpeed;    // EDIT: Added uniform for sine wave speed
uniform float u_grainAmplitude;   // EDIT: Added uniform for grain amplitude

const float PI = acos(-1.0); // Define PI if not already available
const float INV_SQRT2 = 0.7071067811865475; // 1.0 / sqrt(2.0)

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// --- Simple 2D Hash Function ---
// Takes a 2D vector, returns a pseudo-random 2D vector in [0, 1] range
vec2 hash22(vec2 p) {
    // Simple hash based on large number multiplication and fract
    // Using constants known to work reasonably well
    p = vec2( dot(p, vec2(127.1, 311.7)),
              dot(p, vec2(269.5, 183.3)) );
    return fract(sin(p) * 43758.5453);
}
// Note: You might want to experiment with different hash functions
// if this one shows undesirable patterns.

// --- Simple Hash Function: vec2 -> vec4 ---
// Generates 4 pseudo-random values in [0, 1] from a 2D input
vec4 hash24(vec2 p) {
    // Use properties of high-frequency sine waves
    // Different offsets/multipliers for each component
    vec4 R = vec4(127.1, 311.7, 269.5, 183.3); // Some prime-ish numbers
    vec4 S = vec4(43758.5453, 21758.9843, 59758.1942, 37758.4731); // Large numbers
    return fract(sin(vec4(dot(p, R.xy), dot(p, R.yz), dot(p, R.zw), dot(p, R.wx))) * S);
}

void main() {
    // Time components scaled separately
    float displacementTime = u_time * u_noiseSpeed;
    float sineWaveTime = u_time * u_gridWaveSpeed;

    // Other uniforms
    float gridScale = u_gridScale;
    float gridRotation = u_gridRotation;
    vec2 gridAxisScale = u_gridAxisScale;
    float noiseAmplitude = u_noiseAmplitude;
    float noiseScale = u_noiseScale; // Get noise scale uniform

    // --- Coordinate Transformation Pipeline ---
    // 1. Start with base texture coordinates
    vec2 pos = v_texCoord;
    pos -= 0.5;
    // 2. Apply overall grid scale
    pos *= gridScale;
    // 3. Apply user-defined rotation
    float cosR = cos(gridRotation);
    float sinR = sin(gridRotation);
    mat2 rotMat = mat2(cosR, sinR, -sinR, cosR);
    pos = rotMat * pos;
    // 4. Apply user-defined axis scaling
    pos *= gridAxisScale;
    // 5. Apply fixed -45 degree rotation
    vec2 rotatedForLookup = vec2(pos.x + pos.y, -pos.x + pos.y) * INV_SQRT2;

    // --- Calculate Displacement ---
    // Scale the lookup coordinate by noiseScale before sampling noise
    vec2 noiseCoord = rotatedForLookup * noiseScale; // EDIT: Apply noiseScale here
    // Sample 3D noise using scaled coordinate and displacementTime
    float noiseValue = snoise(vec3(noiseCoord, displacementTime)); // EDIT: Use scaled noiseCoord
    // Create offset
    vec2 displacementOffset = vec2(noiseValue) * noiseAmplitude;

    // --- Apply Displacement and Determine Grid Cell ---
    vec2 displacedPos = rotatedForLookup + displacementOffset;
    vec2 i_grid = floor(displacedPos);

    // --- Define representative XY for the grid cell ---
    vec2 representativeXY = i_grid;

    // --- Hash the representative coordinate ---
    vec4 hashParams = hash24(representativeXY);

    // --- Define sine wave parameters ---
    float freq1 = mix(0.5, 3.0, hashParams.x);
    float phase1 = hashParams.y * 2.0 * PI;
    float amp1 = mix(0.1, 0.5, hashParams.z);
    float freq2 = mix(0.8, 4.0, hashParams.w);
    float phase2 = hashParams.x * 2.0 * PI;
    float amp2 = mix(0.1, 0.5, hashParams.y);
    float baseOffset = mix(-0.2, 0.2, hashParams.z);

    // --- Combine sine waves using sineWaveTime ---
    float sineValue = baseOffset +
                      amp1 * sin(freq1 * sineWaveTime + phase1) +
                      amp2 * sin(freq2 * sineWaveTime + phase2);

    // --- Map the result ---
    float mappedValue = sineValue * 0.5 + 0.5;
    mappedValue = clamp(mappedValue, 0.0, 1.0);

    /*
    // --- OLD METHOD (commented out): Noise based on representative XY ---
    // --- Calculate noise using snoise with representative XY and actual time ---
    float noise = snoise(vec3(representativeXY, timeComp)); // Approx [-1, 1]

    // --- Map noise from approx [-1, 1] to [0, 1] ---
    float mappedNoise = noise * 0.5 + 0.5;
    mappedNoise = clamp(mappedNoise, 0.0, 1.0); // Ensure it stays within range
    float mappedValue = mappedNoise; // Use noise for color mix if uncommented
    */

    /*
    // --- HASH OFFSET METHOD (commented out): Continuous noise offset by hash ---
    vec2 hashOffset = hash22(representativeXY) * 100.0; // Needs hash22 function defined
    vec2 noiseInputXY = v_texCoord * scale + hashOffset;
    float noise = snoise(vec3(noiseInputXY, timeComp)); // Approx [-1, 1]
    float mappedNoise = noise * 0.5 + 0.5;
    mappedNoise = clamp(mappedNoise, 0.0, 1.0);
    float mappedValue = mappedNoise; // Use offset noise for color mix if uncommented
    */

    // --- Add Final High-Frequency Grain ---
    // Use texture coordinates scaled by frequency for grain input
    // EDIT: Renamed finalNoiseCoord to grainCoord, kept literal frequency
    vec2 grainCoord = v_texCoord * 200.0;
    // Calculate noise, approx [-1, 1]
    // EDIT: Renamed finalNoise to grainValue, kept literal time scale multiplier
    float grainValue = snoise(vec3(grainCoord, u_time * 2.0));
    // Scale noise by gain and add to the mapped value
    // EDIT: Using u_grainAmplitude uniform instead of literal
    mappedValue += grainValue * u_grainAmplitude;
    // Clamp again to ensure it's in [0, 1] range
    mappedValue = clamp(mappedValue, 0.0, 1.0);

    // --- Color mix ---
    vec3 color = mix(u_colorA, u_colorB, mappedValue);
    gl_FragColor = vec4(color, 1.0);
}