var ct=Object.defineProperty;var ut=(l,n,t)=>n in l?ct(l,n,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[n]=t;var d=(l,n,t)=>ut(l,typeof n!="symbol"?n+"":n,t);(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))e(o);new MutationObserver(o=>{for(const a of o)if(a.type==="childList")for(const s of a.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&e(s)}).observe(document,{childList:!0,subtree:!0});function t(o){const a={};return o.integrity&&(a.integrity=o.integrity),o.referrerPolicy&&(a.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?a.credentials="include":o.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function e(o){if(o.ep)return;o.ep=!0;const a=t(o);fetch(o.href,a)}})();const $e=`attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord; // Pass through texCoord directly
}
`,dt=`precision highp float;

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
    vec2 grainCoord = v_texCoord * 200.0;
    // Calculate noise, approx [-1, 1]
    float grainValue = snoise(vec3(grainCoord * 1.3, u_time * 2.0));
    // Scale noise by gain and add to the mapped value
    mappedValue += grainValue * u_grainAmplitude;

    // --- Add extra grain near edges ---
    float edgeThreshold = 0.03;
    // Check if the x or y coordinate is within the threshold of any edge
    bool nearEdge = v_texCoord.x < edgeThreshold || v_texCoord.x > 1.0 - edgeThreshold ||
                    v_texCoord.y < edgeThreshold || v_texCoord.y > 1.0 - edgeThreshold;

    // If near an edge, add additional scaled grain
    if (nearEdge) {
        mappedValue += grainValue * 2.0;
    }

    // Clamp again to ensure it's in [0, 1] range
    mappedValue = clamp(mappedValue, 0.0, 1.0);

    // --- Color mix ---
    vec3 color = mix(u_colorA, u_colorB, mappedValue);
    gl_FragColor = vec4(color, 1.0);
}`,mt=`precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blurRadius;
uniform float u_time;
uniform bool u_flipY;
varying vec2 v_texCoord;

void main() {
    // Flip Y coordinate if requested
    vec2 sampleCoord = v_texCoord;
    if (u_flipY) {
        sampleCoord.y = 1.0 - sampleCoord.y;
    }
    vec2 onePixel = vec2(1.0, 1.0) / u_resolution;
    
    // Calculate displacement using both time and x position
    float timeOffset = cos(sampleCoord.x * 20.0) * 2.0; // Spatial variation
    float displacement = 0.0 * cos((u_time + timeOffset) * 2.0 * 3.14159 / 10.0);
    vec2 offset = vec2(0.0, displacement) * onePixel;

    // Add offset to sampleCoord
    sampleCoord += offset;

    // 5x5 Gaussian kernel weights with displaced sampling
    vec4 colorSum = 
        // Row 1
        texture2D(u_image, sampleCoord + onePixel * vec2(-2, -2) * u_blurRadius) * 0.003765 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1, -2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0, -2) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1, -2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2, -2) * u_blurRadius) * 0.003765 +
        
        // Row 2
        texture2D(u_image, sampleCoord + onePixel * vec2(-2, -1) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1, -1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0, -1) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1, -1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2, -1) * u_blurRadius) * 0.015019 +
        
        // Row 3 (center)
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  0) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  0) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  0) * u_blurRadius) * 0.150342 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  0) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  0) * u_blurRadius) * 0.023792 +
        
        // Row 4
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  1) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  1) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  1) * u_blurRadius) * 0.015019 +
        
        // Row 5
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  2) * u_blurRadius) * 0.003765 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  2) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  2) * u_blurRadius) * 0.003765;

    gl_FragColor = colorSum;
}
`,ft=`precision mediump float;

//  MIT License
//
//  Copyright (c) 2025 Ronald van Wijnen
//
//  Permission is hereby granted, free of charge, to any person obtaining a
//  copy of this software and associated documentation files (the "Software"),
//  to deal in the Software without restriction, including without limitation
//  the rights to use, copy, modify, merge, publish, distribute, sublicense,
//  and/or sell copies of the Software, and to permit persons to whom the
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//  DEALINGS IN THE SOFTWARE.

#ifndef SPECTRAL
#define SPECTRAL

const int SPECTRAL_SIZE = 38;
const float SPECTRAL_GAMMA = 2.4;
const float SPECTRAL_EPSILON = 0.0000000000000001;

float spectral_uncompand(float x) {
  return (x < 0.04045) ? x / 12.92 : pow((x + 0.055) / 1.055, SPECTRAL_GAMMA);
}

float spectral_compand(float x) {
  return (x < 0.0031308) ? x * 12.92 : 1.055 * pow(x, 1.0 / SPECTRAL_GAMMA) - 0.055;
}

vec3 spectral_srgb_to_linear(vec3 srgb) {
  return vec3(spectral_uncompand(srgb[0]), spectral_uncompand(srgb[1]), spectral_uncompand(srgb[2]));
}

vec3 spectral_linear_to_srgb(vec3 lrgb) {
  return clamp(vec3(spectral_compand(lrgb[0]), spectral_compand(lrgb[1]), spectral_compand(lrgb[2])), 0., 1.);
}

void spectral_linear_to_reflectance(vec3 lrgb, inout float R[SPECTRAL_SIZE]) {
  float w = min(lrgb.r, min(lrgb.g, lrgb.b));

  lrgb -= w;

  float c = min(lrgb.g, lrgb.b);
  float m = min(lrgb.r, lrgb.b);
  float y = min(lrgb.r, lrgb.g);

  float r = min(max(0.0, lrgb.r - lrgb.b), max(0.0, lrgb.r - lrgb.g));
  float g = min(max(0.0, lrgb.g - lrgb.b), max(0.0, lrgb.g - lrgb.r));
  float b = min(max(0.0, lrgb.b - lrgb.g), max(0.0, lrgb.b - lrgb.r));
  
  R[ 0] = max(SPECTRAL_EPSILON, w * 1.0011607271876400 + c * 0.9705850013229620 + m * 0.9906735573199880 + y * 0.0210523371789306 + r * 0.0315605737777207 + g * 0.0095560747554212 + b * 0.9794047525020140);
  R[ 1] = max(SPECTRAL_EPSILON, w * 1.0011606515972800 + c * 0.9705924981434250 + m * 0.9906715249619790 + y * 0.0210564627517414 + r * 0.0315520718330149 + g * 0.0095581580120851 + b * 0.9794007068431300);
  R[ 2] = max(SPECTRAL_EPSILON, w * 1.0011603192274700 + c * 0.9706253487298910 + m * 0.9906625823534210 + y * 0.0210746178695038 + r * 0.0315148215513658 + g * 0.0095673245444588 + b * 0.9793829034702610);
  R[ 3] = max(SPECTRAL_EPSILON, w * 1.0011586727078900 + c * 0.9707868061190170 + m * 0.9906181076447950 + y * 0.0211649058448753 + r * 0.0313318044982702 + g * 0.0096129126297349 + b * 0.9792943649455940);
  R[ 4] = max(SPECTRAL_EPSILON, w * 1.0011525984455200 + c * 0.9713686732282480 + m * 0.9904514808787100 + y * 0.0215027957272504 + r * 0.0306729857725527 + g * 0.0097837090401843 + b * 0.9789630146085700);
  R[ 5] = max(SPECTRAL_EPSILON, w * 1.0011325252899800 + c * 0.9731632306212520 + m * 0.9898710814002040 + y * 0.0226738799041561 + r * 0.0286480476989607 + g * 0.0103786227058710 + b * 0.9778144666940430);
  R[ 6] = max(SPECTRAL_EPSILON, w * 1.0010850066332700 + c * 0.9767402231587650 + m * 0.9882866087596400 + y * 0.0258235649693629 + r * 0.0246450407045709 + g * 0.0120026452378567 + b * 0.9747243211338360);
  R[ 7] = max(SPECTRAL_EPSILON, w * 1.0009968788945300 + c * 0.9815876054913770 + m * 0.9842906927975040 + y * 0.0334879385639851 + r * 0.0192960753663651 + g * 0.0160977721473922 + b * 0.9671984823439730);
  R[ 8] = max(SPECTRAL_EPSILON, w * 1.0008652515227400 + c * 0.9862802656529490 + m * 0.9739349056253060 + y * 0.0519069663740307 + r * 0.0142066612220556 + g * 0.0267061902231680 + b * 0.9490796575305750);
  R[ 9] = max(SPECTRAL_EPSILON, w * 1.0006962900094000 + c * 0.9899491476891340 + m * 0.9418178384601450 + y * 0.1007490148334730 + r * 0.0102942608878609 + g * 0.0595555440185881 + b * 0.9008501289409770);
  R[10] = max(SPECTRAL_EPSILON, w * 1.0005049611488800 + c * 0.9924927015384200 + m * 0.8173903261951560 + y * 0.2391298997068470 + r * 0.0076191460521811 + g * 0.1860398265328260 + b * 0.7631504454622400);
  R[11] = max(SPECTRAL_EPSILON, w * 1.0003080818799200 + c * 0.9941456804052560 + m * 0.4324728050657290 + y * 0.5348043122727480 + r * 0.0058980410835420 + g * 0.5705798201161590 + b * 0.4659221716493190);
  R[12] = max(SPECTRAL_EPSILON, w * 1.0001196660201300 + c * 0.9951839750332120 + m * 0.1384539782588700 + y * 0.7978075786430300 + r * 0.0048233247781713 + g * 0.8614677684002920 + b * 0.2012632804510050);
  R[13] = max(SPECTRAL_EPSILON, w * 0.9999527659684070 + c * 0.9957567501108180 + m * 0.0537347216940033 + y * 0.9114498940673840 + r * 0.0042298748350633 + g * 0.9458790897676580 + b * 0.0877524413419623);
  R[14] = max(SPECTRAL_EPSILON, w * 0.9998218368992970 + c * 0.9959128182867100 + m * 0.0292174996673231 + y * 0.9537979630045070 + r * 0.0040599171299341 + g * 0.9704654864743050 + b * 0.0457176793291679);
  R[15] = max(SPECTRAL_EPSILON, w * 0.9997386095575930 + c * 0.9956061578345280 + m * 0.0213136517508590 + y * 0.9712416154654290 + r * 0.0043533695594676 + g * 0.9784136302844500 + b * 0.0284706050521843);
  R[16] = max(SPECTRAL_EPSILON, w * 0.9997095516396120 + c * 0.9945976009618540 + m * 0.0201349530181136 + y * 0.9793031238075880 + r * 0.0053434425970201 + g * 0.9795890314112240 + b * 0.0205271767569850);
  R[17] = max(SPECTRAL_EPSILON, w * 0.9997319302106270 + c * 0.9922157154923700 + m * 0.0241323096280662 + y * 0.9833801195075750 + r * 0.0076917201010463 + g * 0.9755335369086320 + b * 0.0165302792310211);
  R[18] = max(SPECTRAL_EPSILON, w * 0.9997994363461950 + c * 0.9862364527832490 + m * 0.0372236145223627 + y * 0.9854612465677550 + r * 0.0135969795736536 + g * 0.9622887553978130 + b * 0.0145135107212858);
  R[19] = max(SPECTRAL_EPSILON, w * 0.9999003303166710 + c * 0.9679433372645410 + m * 0.0760506552706601 + y * 0.9864350469766050 + r * 0.0316975442661115 + g * 0.9231215745131200 + b * 0.0136003508637687);
  R[20] = max(SPECTRAL_EPSILON, w * 1.0000204065261100 + c * 0.8912850042449430 + m * 0.2053754719423990 + y * 0.9867382506701410 + r * 0.1078611963552490 + g * 0.7934340189431110 + b * 0.0133604258769571);
  R[21] = max(SPECTRAL_EPSILON, w * 1.0001447879365800 + c * 0.5362024778620530 + m * 0.5412689034604390 + y * 0.9866178824450320 + r * 0.4638126031687040 + g * 0.4592701359024290 + b * 0.0135488943145680);
  R[22] = max(SPECTRAL_EPSILON, w * 1.0002599790341200 + c * 0.1541081190018780 + m * 0.8158416850864860 + y * 0.9862777767586430 + r * 0.8470554052720110 + g * 0.1855741036663030 + b * 0.0139594356366992);
  R[23] = max(SPECTRAL_EPSILON, w * 1.0003557969708900 + c * 0.0574575093228929 + m * 0.9128177041239760 + y * 0.9858605924440560 + r * 0.9431854093939180 + g * 0.0881774959955372 + b * 0.0144434255753570);
  R[24] = max(SPECTRAL_EPSILON, w * 1.0004275378026900 + c * 0.0315349873107007 + m * 0.9463398301669620 + y * 0.9854749276762100 + r * 0.9688621506965580 + g * 0.0543630228766700 + b * 0.0148854440621406);
  R[25] = max(SPECTRAL_EPSILON, w * 1.0004762334488800 + c * 0.0222633920086335 + m * 0.9599276963319910 + y * 0.9851769347655580 + r * 0.9780306674736030 + g * 0.0406288447060719 + b * 0.0152254296999746);
  R[26] = max(SPECTRAL_EPSILON, w * 1.0005072096750800 + c * 0.0182022841492439 + m * 0.9662605952303120 + y * 0.9849715740141810 + r * 0.9820436438543060 + g * 0.0342215204316970 + b * 0.0154592848180209);
  R[27] = max(SPECTRAL_EPSILON, w * 1.0005251915637300 + c * 0.0162990559732640 + m * 0.9693259700584240 + y * 0.9848463034157120 + r * 0.9839236237187070 + g * 0.0311185790956966 + b * 0.0156018026485961);
  R[28] = max(SPECTRAL_EPSILON, w * 1.0005350960689600 + c * 0.0153656239334613 + m * 0.9708545367213990 + y * 0.9847753518111990 + r * 0.9848454841543820 + g * 0.0295708898336134 + b * 0.0156824871281936);
  R[29] = max(SPECTRAL_EPSILON, w * 1.0005402209748200 + c * 0.0149111568733976 + m * 0.9716050665281280 + y * 0.9847380666252650 + r * 0.9852942758145960 + g * 0.0288108739348928 + b * 0.0157248764360615);
  R[30] = max(SPECTRAL_EPSILON, w * 1.0005427281678400 + c * 0.0146954339898235 + m * 0.9719627697573920 + y * 0.9847196483117650 + r * 0.9855072952198250 + g * 0.0284486271324597 + b * 0.0157458108784121);
  R[31] = max(SPECTRAL_EPSILON, w * 1.0005438956908700 + c * 0.0145964146717719 + m * 0.9721272722745090 + y * 0.9847110233919390 + r * 0.9856050715398370 + g * 0.0282820301724731 + b * 0.0157556123350225);
  R[32] = max(SPECTRAL_EPSILON, w * 1.0005444821215100 + c * 0.0145470156699655 + m * 0.9722094177458120 + y * 0.9847066833006760 + r * 0.9856538499335780 + g * 0.0281988376490237 + b * 0.0157605443964911);
  R[33] = max(SPECTRAL_EPSILON, w * 1.0005447695999200 + c * 0.0145228771899495 + m * 0.9722495776784240 + y * 0.9847045543930910 + r * 0.9856776850338830 + g * 0.0281581655342037 + b * 0.0157629637515278);
  R[34] = max(SPECTRAL_EPSILON, w * 1.0005448988776200 + c * 0.0145120341118965 + m * 0.9722676219987420 + y * 0.9847035963093700 + r * 0.9856883918061220 + g * 0.0281398910216386 + b * 0.0157640525629106);
  R[35] = max(SPECTRAL_EPSILON, w * 1.0005449625468900 + c * 0.0145066940939832 + m * 0.9722765094621500 + y * 0.9847031240775520 + r * 0.9856936646900310 + g * 0.0281308901665811 + b * 0.0157645892329510);
  R[36] = max(SPECTRAL_EPSILON, w * 1.0005449892705800 + c * 0.0145044507314479 + m * 0.9722802433068740 + y * 0.9847029256150900 + r * 0.9856958798482050 + g * 0.0281271086805816 + b * 0.0157648147772649);
  R[37] = max(SPECTRAL_EPSILON, w * 1.0005449969930000 + c * 0.0145038009464639 + m * 0.9722813248265600 + y * 0.9847028681227950 + r * 0.9856965214637620 + g * 0.0281260133612096 + b * 0.0157648801149616);
}

vec3 spectral_xyz_to_srgb(vec3 xyz) {
  mat3 XYZ_RGB;

  XYZ_RGB[0] = vec3( 3.2409699419045200, -1.537383177570090, -0.4986107602930030);
  XYZ_RGB[1] = vec3(-0.9692436362808790,  1.875967501507720,  0.0415550574071756);
  XYZ_RGB[2] = vec3( 0.0556300796969936, -0.203976958888976,  1.0569715142428700);
  
  float r = dot(XYZ_RGB[0], xyz);
  float g = dot(XYZ_RGB[1], xyz);
  float b = dot(XYZ_RGB[2], xyz);

  return spectral_linear_to_srgb(vec3(r, g, b));
}

vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]) {
  vec3 xyz = vec3(0.);
  
  xyz += R[ 0] * vec3(0.0000646919989576, 0.0000018442894440, 0.0003050171476380);
  xyz += R[ 1] * vec3(0.0002194098998132, 0.0000062053235865, 0.0010368066663574);
  xyz += R[ 2] * vec3(0.0011205743509343, 0.0000310096046799, 0.0053131363323992);
  xyz += R[ 3] * vec3(0.0037666134117111, 0.0001047483849269, 0.0179543925899536);
  xyz += R[ 4] * vec3(0.0118805536037990, 0.0003536405299538, 0.0570775815345485);
  xyz += R[ 5] * vec3(0.0232864424191771, 0.0009514714056444, 0.1136516189362870);
  xyz += R[ 6] * vec3(0.0345594181969747, 0.0022822631748318, 0.1733587261835500);
  xyz += R[ 7] * vec3(0.0372237901162006, 0.0042073290434730, 0.1962065755586570);
  xyz += R[ 8] * vec3(0.0324183761091486, 0.0066887983719014, 0.1860823707062960);
  xyz += R[ 9] * vec3(0.0212332056093810, 0.0098883960193565, 0.1399504753832070);
  xyz += R[10] * vec3(0.0104909907685421, 0.0152494514496311, 0.0891745294268649);
  xyz += R[11] * vec3(0.0032958375797931, 0.0214183109449723, 0.0478962113517075);
  xyz += R[12] * vec3(0.0005070351633801, 0.0334229301575068, 0.0281456253957952);
  xyz += R[13] * vec3(0.0009486742057141, 0.0513100134918512, 0.0161376622950514);
  xyz += R[14] * vec3(0.0062737180998318, 0.0704020839399490, 0.0077591019215214);
  xyz += R[15] * vec3(0.0168646241897775, 0.0878387072603517, 0.0042961483736618);
  xyz += R[16] * vec3(0.0286896490259810, 0.0942490536184085, 0.0020055092122156);
  xyz += R[17] * vec3(0.0426748124691731, 0.0979566702718931, 0.0008614711098802);
  xyz += R[18] * vec3(0.0562547481311377, 0.0941521856862608, 0.0003690387177652);
  xyz += R[19] * vec3(0.0694703972677158, 0.0867810237486753, 0.0001914287288574);
  xyz += R[20] * vec3(0.0830531516998291, 0.0788565338632013, 0.0001495555858975);
  xyz += R[21] * vec3(0.0861260963002257, 0.0635267026203555, 0.0000923109285104);
  xyz += R[22] * vec3(0.0904661376847769, 0.0537414167568200, 0.0000681349182337);
  xyz += R[23] * vec3(0.0850038650591277, 0.0426460643574120, 0.0000288263655696);
  xyz += R[24] * vec3(0.0709066691074488, 0.0316173492792708, 0.0000157671820553);
  xyz += R[25] * vec3(0.0506288916373645, 0.0208852059213910, 0.0000039406041027);
  xyz += R[26] * vec3(0.0354739618852640, 0.0138601101360152, 0.0000015840125870);
  xyz += R[27] * vec3(0.0214682102597065, 0.0081026402038399, 0.0000000000000000);
  xyz += R[28] * vec3(0.0125164567619117, 0.0046301022588030, 0.0000000000000000);
  xyz += R[29] * vec3(0.0068045816390165, 0.0024913800051319, 0.0000000000000000);
  xyz += R[30] * vec3(0.0034645657946526, 0.0012593033677378, 0.0000000000000000);
  xyz += R[31] * vec3(0.0014976097506959, 0.0005416465221680, 0.0000000000000000);
  xyz += R[32] * vec3(0.0007697004809280, 0.0002779528920067, 0.0000000000000000);
  xyz += R[33] * vec3(0.0004073680581315, 0.0001471080673854, 0.0000000000000000);
  xyz += R[34] * vec3(0.0001690104031614, 0.0000610327472927, 0.0000000000000000);
  xyz += R[35] * vec3(0.0000952245150365, 0.0000343873229523, 0.0000000000000000);
  xyz += R[36] * vec3(0.0000490309872958, 0.0000177059860053, 0.0000000000000000);
  xyz += R[37] * vec3(0.0000199961492222, 0.0000072209749130, 0.0000000000000000);

  return xyz;
}

float KS(float R) {
	return pow(1.0 - R, 2.0) / (2.0 * R);
}

float KM(float KS) {
  return 1.0 + KS - sqrt(pow(KS, 2.0) + 2.0 * KS);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
		
		float totalConcentration = concentration1 + concentration2;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, vec3 color2, float factor) {
	return spectral_mix(color1, 1., 1. - factor, color2, 1., factor);
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;
		
		float totalConcentration = concentration1 + concentration2 + concentration3;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;
		ksMix += KS(R3[i]) * concentration3;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3, vec3 color4, float tintingStrength4, float factor4) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);
  vec3 lrgb4 = spectral_srgb_to_linear(color4);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];
  float R4[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);
  spectral_linear_to_reflectance(lrgb4, R4);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];
  float luminance4 = spectral_reflectance_to_xyz(R4)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;
    float concentration4 = pow(factor4, 2.) * pow(tintingStrength4, 2.) * luminance4;
		
		float totalConcentration = concentration1 + concentration2 + concentration3 + concentration4;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;
		ksMix += KS(R3[i]) * concentration3;
		ksMix += KS(R4[i]) * concentration4;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3, vec3 color4, float factor4) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3, color4, 1., factor4);
}

#endif




uniform sampler2D u_gradientTex;  // Grayscale gradient (0..1 intensity)
uniform sampler2D u_elementsTex;  // Blurred elements texture (RGBA)
uniform vec3 u_colorA;           // Palette Color A (from TS global)
uniform vec3 u_colorB;           // Palette Color B (from TS global)
uniform vec3 u_colorC;           // Palette Color C
uniform vec3 u_colorD;           // Palette Color D
uniform float u_flipY;           // 1.0 for drawing to screen, 0.0 for FBO

varying vec2 v_texCoord;



uniform float u_time;
uniform float u_noiseSpeed;       // EDIT: Now primarily for displacement noise
uniform float u_gridScale;
uniform float u_gridRotation;   // EDIT: Added rotation uniform (radians)
uniform vec2 u_gridAxisScale;   // EDIT: Added axis scaling uniform (xScale, yScale)
uniform float u_shapeNoiseScale;     // RENAMED from u_noiseScale
uniform float u_shapeNoiseAmplitude; // RENAMED from u_noiseAmplitude
// --- ADDED: High Frequency Shape Noise Uniforms ---
uniform float u_hfShapeNoiseScale;
uniform float u_hfShapeNoiseAmount;

const float PI = acos(-1.0); // Define PI if not already available
const float INV_SQRT2 = 0.7071067811865475; // 1.0 / sqrt(2.0)

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
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
  // Handle coordinate flipping for screen output (used later)
  vec2 uv_screen = v_texCoord;
  uv_screen.y = mix(uv_screen.y, 1.0 - uv_screen.y, u_flipY);

  // Base UV for sampling (no screen flip needed for texture lookups)
  vec2 uv = v_texCoord;

  // --- Calculate Displacement for Elements Texture ---
  float displacementTime = u_time * u_noiseSpeed;

  // Coordinate lookup uses shared grid params
  vec2 pos = uv - 0.5;
  pos *= u_gridScale;
  float cosR = cos(u_gridRotation);
  float sinR = sin(u_gridRotation);
  mat2 rotMat = mat2(cosR, sinR, -sinR, cosR);
  pos = rotMat * pos;
  pos *= u_gridAxisScale;
  vec2 rotatedForLookup = vec2(pos.x + pos.y, -pos.x + pos.y) * INV_SQRT2;

  // --- Calculate Base Shape Displacement ---
  vec2 baseNoiseCoord = rotatedForLookup * u_shapeNoiseScale;
  float baseNoiseValue = snoise(vec3(baseNoiseCoord, displacementTime));
  vec2 baseDisplacementOffset = vec2(baseNoiseValue) * u_shapeNoiseAmplitude * 0.05; // Base offset

  // --- Calculate High Frequency Shape Displacement ---
  vec2 hfNoiseCoord = rotatedForLookup * u_hfShapeNoiseScale; // Use HF scale
  float hfNoiseValue = snoise(vec3(hfNoiseCoord, displacementTime)); // Sample HF noise
  // Use HF amount, and INVERSELY CORRELATE X and Y
  // Flip the sign for the X component
  vec2 hfDisplacementOffset = vec2(-hfNoiseValue, hfNoiseValue) * u_hfShapeNoiseAmount * 0.05; // Edit: Negate X

  // --- Combine Displacements ---
  vec2 totalDisplacementOffset = baseDisplacementOffset + hfDisplacementOffset;

  // Apply total displacement to the original UV coordinates
  vec2 uv_displaced_elements = uv + totalDisplacementOffset;

  // --- Sample Textures ---
  vec4 gradientColor = texture2D(u_gradientTex, uv);
  vec4 elementsColor = texture2D(u_elementsTex, uv_displaced_elements); // Use combined displacement

  // Extract intensity/alpha
  float gradientIntensity = gradientColor.r; // Assuming gradient is R=G=B
  float elementsAlpha = elementsColor.a;     // Use alpha from (displaced) blurred elements

  // Calculate the spectral mix between A and B based on the gradient
  vec3 mixAB = spectral_mix(u_colorA, u_colorB, gradientIntensity);

  // Calculate the spectral mix between C and D based on the gradient
  vec3 mixCD = spectral_mix(u_colorC, u_colorD, gradientIntensity);

  // Interpolate between the AB mix and the CD mix based on the element alpha
  // When elementsAlpha is 0, we get mixAB.
  // When elementsAlpha is 1, we get mixCD.
  vec3 finalColor = mix(mixAB, mixCD, elementsAlpha);

  // Output the final color, using the screen-flipped UV implicitly via gl_FragCoord/varying
  // The color calculation itself doesn't depend on the flip, but the output position does.
  // We don't need uv_screen here directly, but gl_FragColor maps to the correct screen pixel.
  gl_FragColor = vec4(finalColor, 1.0);
}`;function pt(l){const n=parseInt(l.replace("#",""),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}class lt{constructor(n){d(this,"gl");d(this,"canvas");d(this,"gradientProgram");d(this,"blurProgram");d(this,"spectralCompositeProgram");d(this,"positionBuffer");d(this,"texCoordBuffer");d(this,"gradientOutputTexture");d(this,"elementsInputTexture");d(this,"blurredElementsTexture");d(this,"tempBlurTexture");d(this,"gradientFramebuffer");d(this,"blurFramebuffer");this.canvas=n;const t=n.getContext("webgl",{alpha:!0,preserveDrawingBuffer:!0});if(!t)throw new Error("WebGL not supported");this.gl=t,this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA)}init(){this.initBuffers(),this.initPrograms(),this.resize(this.canvas.width,this.canvas.height)}resize(n,t){const e=this.gl;if(this.gradientOutputTexture=this.createAndAllocateTexture(this.gradientOutputTexture,n,t),this.elementsInputTexture=this.createAndAllocateTexture(this.elementsInputTexture,n,t),this.blurredElementsTexture=this.createAndAllocateTexture(this.blurredElementsTexture,n,t),this.tempBlurTexture=this.createAndAllocateTexture(this.tempBlurTexture,n,t),!this.gradientFramebuffer&&(this.gradientFramebuffer=e.createFramebuffer(),!this.gradientFramebuffer))throw new Error("Failed to create gradientFramebuffer");if(e.bindFramebuffer(e.FRAMEBUFFER,this.gradientFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.gradientOutputTexture,0),!this.blurFramebuffer&&(this.blurFramebuffer=e.createFramebuffer(),!this.blurFramebuffer))throw new Error("Failed to create blurFramebuffer");e.bindFramebuffer(e.FRAMEBUFFER,this.blurFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.blurredElementsTexture,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.tempBlurTexture,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindTexture(e.TEXTURE_2D,null)}renderGradientPass(n){const t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,this.gradientFramebuffer),t.viewport(0,0,this.canvas.width,this.canvas.height),t.useProgram(this.gradientProgram),t.uniform3fv(t.getUniformLocation(this.gradientProgram,"u_colorA"),n.colorA),t.uniform3fv(t.getUniformLocation(this.gradientProgram,"u_colorB"),n.colorB),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_time"),n.time),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseCenter"),n.noiseCenter),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseWidth"),n.noiseWidth),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseAmplitude"),n.noiseAmplitude),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseSpeed"),n.noiseSpeed),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseScale"),n.noiseScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_noiseOffsetScale"),n.noiseOffsetScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_waveAmplitude"),n.waveAmplitude),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_waveXScale"),n.waveXScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_waveTimeScale"),n.waveTimeScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_gridScale"),n.gridScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_gridRotation"),n.gridRotation),t.uniform2fv(t.getUniformLocation(this.gradientProgram,"u_gridAxisScale"),n.gridAxisScale),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_gridWaveSpeed"),n.gridWaveSpeed),t.uniform1f(t.getUniformLocation(this.gradientProgram,"u_grainAmplitude"),n.grainAmplitude),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),this.bindAttributesAndDraw(this.gradientProgram),t.bindFramebuffer(t.FRAMEBUFFER,null)}uploadElementsTexture(n){const t=this.gl;t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.elementsInputTexture),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n),t.bindTexture(t.TEXTURE_2D,null)}applyBlurPasses(n,t){const e=this.gl;if(t<=0||n.radius<=0)return this.elementsInputTexture;e.useProgram(this.blurProgram),e.uniform2f(e.getUniformLocation(this.blurProgram,"u_resolution"),n.resolution[0],n.resolution[1]),e.uniform1f(e.getUniformLocation(this.blurProgram,"u_blurRadius"),n.radius),e.uniform1f(e.getUniformLocation(this.blurProgram,"u_time"),n.time),e.uniform1f(e.getUniformLocation(this.blurProgram,"u_flipY"),0),e.bindFramebuffer(e.FRAMEBUFFER,this.blurFramebuffer),e.viewport(0,0,n.resolution[0],n.resolution[1]);let o=this.elementsInputTexture,a=this.tempBlurTexture,s=this.blurredElementsTexture;for(let c=0;c<t;++c){const f=c===t-1?s:a;e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,f,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,o),e.uniform1i(e.getUniformLocation(this.blurProgram,"u_image"),0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),this.bindAttributesAndDraw(this.blurProgram),o=f,c<t-1&&(a=f===this.tempBlurTexture?this.blurredElementsTexture:this.tempBlurTexture)}return e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindTexture(e.TEXTURE_2D,null),s}renderCompositePass(n,t){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.canvas.width,this.canvas.height),e.useProgram(this.spectralCompositeProgram),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.gradientOutputTexture),e.uniform1i(e.getUniformLocation(this.spectralCompositeProgram,"u_gradientTex"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,t),e.uniform1i(e.getUniformLocation(this.spectralCompositeProgram,"u_elementsTex"),1),e.uniform3fv(e.getUniformLocation(this.spectralCompositeProgram,"u_colorA"),n.colorA),e.uniform3fv(e.getUniformLocation(this.spectralCompositeProgram,"u_colorB"),n.colorB),e.uniform3fv(e.getUniformLocation(this.spectralCompositeProgram,"u_colorC"),n.colorC),e.uniform3fv(e.getUniformLocation(this.spectralCompositeProgram,"u_colorD"),n.colorD),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_flipY"),1),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_time"),n.time),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_noiseSpeed"),n.noiseSpeed),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_noiseScale"),n.noiseScale),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_gridScale"),n.gridScale),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_gridRotation"),n.gridRotation),e.uniform2fv(e.getUniformLocation(this.spectralCompositeProgram,"u_gridAxisScale"),n.gridAxisScale),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_noiseAmplitude"),n.noiseAmplitude),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_shapeNoiseScale"),n.shapeNoiseScale),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_shapeNoiseAmplitude"),n.shapeNoiseAmplitude),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_hfShapeNoiseScale"),n.hfShapeNoiseScale),e.uniform1f(e.getUniformLocation(this.spectralCompositeProgram,"u_hfShapeNoiseAmount"),n.hfShapeNoiseAmount),e.clearColor(0,0,0,1),e.clear(this.gl.COLOR_BUFFER_BIT),this.bindAttributesAndDraw(this.spectralCompositeProgram),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,null),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,null)}initBuffers(){const n=this.gl,t=new Float32Array([-1,-1,1,-1,-1,1,1,1]);if(this.positionBuffer=n.createBuffer(),!this.positionBuffer)throw new Error("Failed to create position buffer");n.bindBuffer(n.ARRAY_BUFFER,this.positionBuffer),n.bufferData(n.ARRAY_BUFFER,t,n.STATIC_DRAW);const e=new Float32Array([0,0,1,0,0,1,1,1]);if(this.texCoordBuffer=n.createBuffer(),!this.texCoordBuffer)throw new Error("Failed to create texCoord buffer");n.bindBuffer(n.ARRAY_BUFFER,this.texCoordBuffer),n.bufferData(n.ARRAY_BUFFER,e,n.STATIC_DRAW),n.bindBuffer(n.ARRAY_BUFFER,null)}initPrograms(){this.gradientProgram=this.createProgram($e,dt),this.blurProgram=this.createProgram($e,mt),this.spectralCompositeProgram=this.createProgram($e,ft)}createShader(n,t){const e=this.gl,o=e.createShader(n);if(!o)throw new Error(`Failed to create shader (type: ${n})`);if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){const a=e.getShaderInfoLog(o);throw e.deleteShader(o),new Error(`Shader compile error: ${a}`)}return o}createProgram(n,t){const e=this.gl,o=this.createShader(e.VERTEX_SHADER,n),a=this.createShader(e.FRAGMENT_SHADER,t),s=e.createProgram();if(!s)throw new Error("Failed to create program");if(e.attachShader(s,o),e.attachShader(s,a),e.linkProgram(s),!e.getProgramParameter(s,e.LINK_STATUS)){const c=e.getProgramInfoLog(s);throw e.deleteProgram(s),e.deleteShader(o),e.deleteShader(a),new Error(`Program link error: ${c}`)}return e.detachShader(s,o),e.detachShader(s,a),e.deleteShader(o),e.deleteShader(a),s}bindAttributesAndDraw(n){const t=this.gl,e=t.getAttribLocation(n,"a_position");e>=0&&(t.enableVertexAttribArray(e),t.bindBuffer(t.ARRAY_BUFFER,this.positionBuffer),t.vertexAttribPointer(e,2,t.FLOAT,!1,0,0));const o=t.getAttribLocation(n,"a_texCoord");o>=0&&(t.enableVertexAttribArray(o),t.bindBuffer(t.ARRAY_BUFFER,this.texCoordBuffer),t.vertexAttribPointer(o,2,t.FLOAT,!1,0,0)),t.drawArrays(t.TRIANGLE_STRIP,0,4)}createAndAllocateTexture(n,t,e){const o=this.gl;let a=n;if(a)o.bindTexture(o.TEXTURE_2D,a);else{if(a=o.createTexture(),!a)throw new Error("Failed to create texture");o.bindTexture(o.TEXTURE_2D,a),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR)}return o.texImage2D(o.TEXTURE_2D,0,o.RGBA,t,e,0,o.RGBA,o.UNSIGNED_BYTE,null),o.bindTexture(o.TEXTURE_2D,null),a}}d(lt,"hexToRgb01",pt);const gt=null,tt=256,nt=.75,xt=-90,ht=-10;class _t{constructor(){d(this,"audioContext",null);d(this,"analyserNode",null);d(this,"dataArray",null);d(this,"isInitialized",!1);d(this,"smoothedLevel",0);d(this,"sourceNode",null);d(this,"stream",null);console.log("AudioAnalyzer: Instance created.")}async initializeAudio(){if(this.isInitialized){console.log("AudioAnalyzer: Already initialized.");return}console.log("AudioAnalyzer: Initializing audio...");try{if(this.audioContext||(this.audioContext=new(window.AudioContext||window.webkitAudioContext),console.log(`AudioAnalyzer: AudioContext created. State: ${this.audioContext.state}`)),this.audioContext.state==="suspended"&&(console.log("AudioAnalyzer: AudioContext is suspended, attempting to resume..."),await this.audioContext.resume(),console.log(`AudioAnalyzer: AudioContext resumed. State: ${this.audioContext.state}`)),this.audioContext.state!=="running")throw new Error(`AudioContext failed to start or resume. State: ${this.audioContext.state}`);let n=gt;const t="BlackHole 2ch";if(n)console.log(`AudioAnalyzer: Using explicitly set TARGET_DEVICE_ID: ${n}`);else{console.log(`AudioAnalyzer: Searching for preferred device containing label: "${t}"...`);try{const c=(await navigator.mediaDevices.enumerateDevices()).filter(m=>m.kind==="audioinput"),f=c.find(m=>m.label.includes(t));f?(n=f.deviceId,console.log(`AudioAnalyzer: Found preferred device: "${f.label}" (ID: ${n}). Will attempt to use it.`)):console.log(`AudioAnalyzer: Preferred device "${t}" not found. Will use default audio input.`),console.log("AudioAnalyzer: Available Audio Input Devices:"),c.length>0?c.forEach((m,g)=>{console.log(`  [${g}] Label: "${m.label}" | Device ID: "${m.deviceId}"`)}):console.log("AudioAnalyzer: No audio input devices found.")}catch(s){console.error("AudioAnalyzer: Error enumerating devices:",s),console.log("AudioAnalyzer: Proceeding with default audio input due to enumeration error.")}}console.log("AudioAnalyzer: Requesting microphone access...");const e={audio:n?{deviceId:{exact:n}}:!0,video:!1};console.log("AudioAnalyzer: Using constraints:",JSON.stringify(e)),this.stream=await navigator.mediaDevices.getUserMedia(e);const o=this.stream.getAudioTracks();if(o.length>0){const c=o[0].getSettings().deviceId||"N/A",f=o[0].label||"N/A";console.log(`AudioAnalyzer: Successfully using audio device: "${f}" (ID: ${c})`)}else throw console.warn("AudioAnalyzer: No audio track found in the stream."),new Error("No audio track available.");this.sourceNode=this.audioContext.createMediaStreamSource(this.stream),console.log("AudioAnalyzer: MediaStreamSourceNode created."),this.analyserNode=this.audioContext.createAnalyser(),this.analyserNode.fftSize=tt,this.analyserNode.minDecibels=xt,this.analyserNode.maxDecibels=ht,this.analyserNode.smoothingTimeConstant=0,console.log("AudioAnalyzer: AnalyserNode created with FFT_SIZE:",tt);const a=this.analyserNode.frequencyBinCount;this.dataArray=new Uint8Array(a),console.log("AudioAnalyzer: Data array created with length:",a),this.sourceNode.connect(this.analyserNode),console.log("AudioAnalyzer: Nodes connected (Source -> Analyser)."),this.isInitialized=!0,this.smoothedLevel=0,console.log("AudioAnalyzer: Initialization successful.")}catch(n){console.error("AudioAnalyzer: Error initializing audio:",n),this.isInitialized=!1,this.cleanupAudio()}}cleanupAudio(){console.log("AudioAnalyzer: Cleaning up audio resources..."),this.stream&&(this.stream.getTracks().forEach(n=>n.stop()),console.log("AudioAnalyzer: MediaStream tracks stopped.")),this.sourceNode&&(this.sourceNode.disconnect(),this.sourceNode=null,console.log("AudioAnalyzer: Source node disconnected.")),this.analyserNode=null,this.stream=null,this.dataArray=null,this.isInitialized=!1,this.smoothedLevel=0,console.log("AudioAnalyzer: Cleanup complete.")}getSmoothedLevel(){if(!this.isInitialized||!this.analyserNode||!this.dataArray)return 0;this.analyserNode.getByteFrequencyData(this.dataArray);let n=0;for(let o=0;o<this.dataArray.length;o++)n+=this.dataArray[o];const e=n/this.dataArray.length/255;return this.smoothedLevel=nt*this.smoothedLevel+(1-nt)*e,Math.max(0,Math.min(1,this.smoothedLevel))}checkInitialized(){return this.isInitialized}}let ke=0,D=null,C=null,ne,y,ot=60,We=0,He=!1,Ye=0,ye=null;const vt=5550,St=3,Et=0;let At=.4,Rt=.55,N=1.2,oe=.4,re=1.51,yt=.7,O=1.51,rt=0,at=[2,1],Ce=.6,Y=0,be=1.51,z=0,Te=32,Pe=.1,Ct=1.2,bt=.1,Tt=.1,Ie=1.7333,Le=.3,Fe=1,$=150*Math.sqrt(3),b=[["#100F0F","#3734DA","#3734DA","#33E6DA"],["#357DC0","#3D2D5B","#33E6DA","#C73868"],["#ED4596","#3734DA","#542636","#F2585B"],["#261C39","#3734DA","#3734DA","#33E6DA"],["#3734DA","#C73868","#33E6DA","#261C39"],["#ED4596","#3D2D5B","#100F0F","#C73868"],["#357DC0","#542636","#33E6DA","#261C39"],["#33E6DA","#542636","#C73868","#F2585B"],["#357DC0","#3D2D5B","#3734DA","#33E6DA"],["#33E6DA","#261C39","#261C39","#F2585B"],["#357DC0","#3734DA","#3734DA","#33E6DA"],["#357DC0","#3D2D5B","#3734DA","#ED4596"],["#33E6DA","#261C39","#261C39","#ED4596"],["#100F0F","#3734DA","#33E6DA","#C73868"],["#3734DA","#100F0F","#33E6DA","#261C39"]],h=0,U=b[h][0],M=b[h][1],V=b[h][2],H=b[h][3];function Pt(l){return l.toString().padStart(6,"0")}let we=null,ze=null,De=150*Math.sqrt(3),Ne=0,Ze=0,Oe=225,B=4,E=.1,Ke=!1,st=0;const It=200;let je=U,Qe=M,Je=V,et=H,Be=U,Ue=M,Me=V,Ve=H,F={gridScale:O,shapeAmplitude:Y,gradientAmplitude:N,hexagonWidth:$,audioModScale:B,audioSensitivity:E,hfShapeAmount:z};function Lt({canvasWebGL:l}){ne=document.createElement("canvas"),ne.width=l.width,ne.height=l.height;const n=ne.getContext("2d");if(!n)throw new Error("Failed to get 2D context for elements canvas");y=n,D=new lt(l),D.init(),we=l.width/2,ze=l.width/2}function Ft({canvasWebGL:l}){if(!D||!ne||!y)throw new Error("Renderer or elements canvas not initialized");const n=(C==null?void 0:C.checkInitialized())??!1,t=l.width,e=l.height,o=Date.now();if(Ke){const u=o-st,S=Math.min(1,u/It);U=qe(je,Be,S),M=qe(Qe,Ue,S),V=qe(Je,Me,S),H=qe(et,Ve,S),S>=1&&(Ke=!1,je=Be,Qe=Ue,Je=Me,et=Ve,U=Be,M=Ue,V=Me,H=Ve)}const a=1/ot,s=ke/ot,c=1+Le*Math.cos(s*Ie*2*Math.PI),f=a*c;We+=f,Ze+=Ne*f;let m=0;n&&C&&(m=C.getSmoothedLevel());let g=0;if(m>=E){const u=Math.max(1e-6,1-E);g=(m-E)/u,g=Math.max(0,Math.min(1,g))}ke%60===0&&console.log(`Audio Debug: raw=${m.toFixed(3)}, sens=${E.toFixed(3)}, effectiveMod=${g.toFixed(3)}`);const A=z+g*B;ke%60===0&&console.log(`HF Shape Debug: base=${z.toFixed(3)}, modScale=${B.toFixed(3)}, effectiveAmount=${A.toFixed(3)}`);const ae={colorA:w("#000000"),colorB:w("#FFFFFF"),time:We,noiseCenter:At,noiseWidth:Rt,noiseAmplitude:N,noiseSpeed:oe,noiseScale:re,noiseOffsetScale:yt,waveAmplitude:Ct,waveXScale:bt,waveTimeScale:Tt,gridScale:O,gridRotation:rt,gridAxisScale:at,gridWaveSpeed:Ce,grainAmplitude:Pe};D.renderGradientPass(ae),y.clearRect(0,0,t,e),we===null&&(we=t/2),ze===null&&(ze=t/2);const G=150,x=G*Math.sqrt(3)/2,X=G,k=G*1.5,ie=x!==0?(k-X)/x:0,le=x!==0?(X-k)/x:0,se=x!==0?(-225+X)/x:0,ce=x!==0?(-150+k)/x:0,_=Oe,ue=ze,Z=De,de=$,v=e/2,me=de/2,fe=ue-Z/2,W=t/Math.max(1e-6,Fe);function pe(u){return u<=0?ie*u+_:le*u+_}function ge(u){return u<=0?se*u-_:ce*u-_}y.strokeStyle="white",y.lineWidth=1;const xe=fe+Ze;for(let u=0;u<t;u++){const K=((u-xe)%W+W)%W,P=Math.abs(u-we)<=me,ve=K<Z;if(P&&ve){const j=u-we;let Q=v+pe(j),J=v+ge(j),I,R;if(Q<J)I=v,R=v;else{const Se=v+_,L=v-_;I=Math.max(L,Math.min(Se,Q)),R=Math.max(L,Math.min(Se,J)),R=Math.min(I,R)}let ee=Math.max(0,Math.min(e-1,I)),te=Math.max(0,Math.min(e-1,R));ee>=te&&(y.beginPath(),y.moveTo(u+.5,te),y.lineTo(u+.5,ee),y.stroke())}}D.uploadElementsTexture(ne);const he={resolution:[t,e],radius:St,time:We},T=D.applyBlurPasses(he,Et),_e={time:We,noiseSpeed:oe,noiseScale:re,noiseAmplitude:N,gridScale:O,gridRotation:rt,gridAxisScale:at,shapeNoiseScale:be,shapeNoiseAmplitude:Y,hfShapeNoiseScale:Te,hfShapeNoiseAmount:A,colorA:w(U),colorB:w(M),colorC:w(V),colorD:w(H)};D.renderCompositePass(_e,T),ke++}function wt(){F.gridScale=O,F.shapeAmplitude=Y,F.gradientAmplitude=N,F.hexagonWidth=$,F.audioModScale=B,F.audioSensitivity=E,F.hfShapeAmount=z,console.log("Snapshot taken:",F)}function Dt(){je=U,Qe=M,Je=V,et=H,h=(h+1)%b.length,Be=b[h][0],Ue=b[h][1],Me=b[h][2],Ve=b[h][3],Ke=!0,st=Date.now();const l=document.getElementById("palette-button"),n=document.getElementById("color-a-input"),t=document.getElementById("color-b-input"),e=document.getElementById("color-c-input"),o=document.getElementById("color-d-input");l&&(l.textContent=`Palette ${h+1}`),n&&(n.value=Be),t&&(t.value=Ue),e&&(e.value=Me),o&&(o.value=Ve),console.log(`Starting transition to Palette ${h+1}`)}async function Nt(){try{ye=await window.showDirectoryPicker(),Ye=0,He=!0,console.log("Starting render sequence...")}catch(l){console.error(l.name,l.message)}}async function Ot(l){if(!ye)return;const n=Ye;try{const t=`frame_${Pt(n)}.png`,e=l.toDataURL("image/png"),a=await(await fetch(e)).blob(),c=await(await ye.getFileHandle(t,{create:!0})).createWritable();await c.write(a),await c.close(),console.log(`Saved ${t}`),Ye=n+1,Ye>=vt&&(He=!1,ye=null,console.log("Render sequence complete!"))}catch(t){console.error("Failed to save frame:",t),He=!1,ye=null}}function zt(l){Lt(l),C=new _t;const n=document.getElementById("animate-button");let t=!1;n?n.addEventListener("click",async()=>{C&&!t?(console.log("Audio start button clicked, attempting to initialize audio..."),await C.initializeAudio(),t=C.checkInitialized(),t?(console.log("Audio initialized successfully via button click."),n.textContent="Audio Active",n.disabled=!0):console.error("Failed to initialize audio via button click.")):t&&console.log("Audio already initialized.")},{once:!1}):console.warn("Could not find button to trigger audio initialization (expected #animate-button or #start-audio-button). Audio analysis will not start.");async function e(){D?(Ft(l),He&&await Ot(l.canvasWebGL),requestAnimationFrame(e)):(console.warn("Renderer not initialized, delaying animation frame."),requestAnimationFrame(e))}const o=document.querySelector("#render-button");o==null||o.addEventListener("click",Nt);const a=document.querySelector("#palette-button");a==null||a.addEventListener("click",Dt);const s=document.querySelector("#snapshot-button");s==null||s.addEventListener("click",wt);const c=document.getElementById("noise-amplitude-slider"),f=document.getElementById("noise-amplitude-value"),m=document.getElementById("noise-scale-slider"),g=document.getElementById("noise-scale-value"),A=document.getElementById("noise-speed-slider"),ae=document.getElementById("noise-speed-value"),G=document.getElementById("grid-scale-slider"),x=document.getElementById("grid-scale-value"),X=document.getElementById("grid-wave-speed-slider"),k=document.getElementById("grid-wave-speed-value"),ie=document.getElementById("shape-amplitude-slider"),le=document.getElementById("shape-amplitude-value"),se=document.getElementById("shape-scale-slider"),ce=document.getElementById("shape-scale-value"),_=document.getElementById("hf-shape-amount-slider"),ue=document.getElementById("hf-shape-amount-value"),Z=document.getElementById("hf-shape-scale-slider"),de=document.getElementById("hf-shape-scale-value"),v=document.getElementById("time-pulse-freq-slider"),me=document.getElementById("time-pulse-freq-value"),fe=document.getElementById("time-pulse-amount-slider"),W=document.getElementById("time-pulse-amount-value"),pe=document.getElementById("hexagon-pulse-start-slider"),ge=document.getElementById("hexagon-pulse-start-value"),xe=document.getElementById("hexagon-pulse-width-slider"),he=document.getElementById("hexagon-pulse-width-value"),T=document.getElementById("hexagon-pulse-speed-slider"),_e=document.getElementById("hexagon-pulse-speed-value"),u=document.getElementById("hexagon-height-slider"),S=document.getElementById("hexagon-height-value"),K=document.getElementById("hexagon-width-slider"),Ge=document.getElementById("hexagon-width-value"),P=document.getElementById("pulse-sync-freq-slider"),ve=document.getElementById("pulse-sync-freq-value"),j=document.getElementById("grain-amplitude-slider"),Q=document.getElementById("grain-amplitude-value"),J=document.getElementById("audio-mod-scale-slider"),I=document.getElementById("audio-mod-scale-value"),R=document.getElementById("audio-sensitivity-slider"),ee=document.getElementById("audio-sensitivity-value"),te=document.getElementById("toggle-controls-button"),Se=document.getElementById("slider-container");te&&Se&&te.addEventListener("click",()=>{const r=Se.classList.toggle("collapsed");te.textContent=r?"Show Controls":"Hide Controls"});const L=document.getElementById("color-a-input"),Ee=document.getElementById("color-b-input"),Ae=document.getElementById("color-c-input"),Re=document.getElementById("color-d-input"),Xe=r=>/^#[0-9A-F]{6}$/i.test(r)||/^#[0-9A-F]{3}$/i.test(r);if(L&&(L.value=U,L.addEventListener("input",r=>{const i=r.target.value;Xe(i)?(U=i,L.style.borderColor=""):L.style.borderColor="red"})),Ee&&(Ee.value=M,Ee.addEventListener("input",r=>{const i=r.target.value;Xe(i)?(M=i,Ee.style.borderColor=""):Ee.style.borderColor="red"})),Ae&&(Ae.value=V,Ae.addEventListener("input",r=>{const i=r.target.value;Xe(i)?(V=i,Ae.style.borderColor=""):Ae.style.borderColor="red"})),Re&&(Re.value=H,Re.addEventListener("input",r=>{const i=r.target.value;Xe(i)?(H=i,Re.style.borderColor=""):Re.style.borderColor="red"})),c&&f&&(c.value=(N*25).toString(),f.textContent=N.toFixed(2),c.addEventListener("input",r=>{N=parseFloat(r.target.value)/25,f.textContent=N.toFixed(2)})),m&&g){const r=Math.sqrt((re-.1)/63.9);m.value=(r*100).toString(),g.textContent=re.toFixed(2),m.addEventListener("input",i=>{const p=parseFloat(i.target.value)/100;re=.1+p*p*63.9,g.textContent=re.toFixed(2)})}if(A&&ae&&(A.min="0",A.max="50",A.step="0.25",A.value=(oe*10).toString(),ae.textContent=oe.toFixed(1),A.addEventListener("input",r=>{oe=parseFloat(r.target.value)/10,ae.textContent=oe.toFixed(3)})),G&&x){const r=Math.sqrt((O-1)/63);G.value=(r*100).toString(),x.textContent=O.toFixed(2),G.addEventListener("input",i=>{const p=parseFloat(i.target.value)/100;O=1+p*p*63,x.textContent=O.toFixed(2)})}if(X&&k&&(X.value=(Ce*100).toString(),k.textContent=Ce.toFixed(2),X.addEventListener("input",r=>{Ce=parseFloat(r.target.value)/100,k.textContent=Ce.toFixed(2)})),ie&&le&&(ie.value=(Y*25).toString(),le.textContent=Y.toFixed(2),ie.addEventListener("input",r=>{Y=parseFloat(r.target.value)/25,le.textContent=Y.toFixed(2)})),se&&ce){const r=Math.sqrt((be-.1)/63.9);se.value=(r*100).toString(),ce.textContent=be.toFixed(2),se.addEventListener("input",i=>{const p=parseFloat(i.target.value)/100;be=.1+p*p*63.9,ce.textContent=be.toFixed(2)})}if(_&&ue&&(_.value=(z*25).toString(),ue.textContent=z.toFixed(2),_.addEventListener("input",r=>{z=parseFloat(r.target.value)/25,ue.textContent=z.toFixed(2)})),Z&&de){const r=Math.sqrt((Te-.1)/63.9);Z.value=(r*100).toString(),de.textContent=Te.toFixed(2),Z.addEventListener("input",i=>{const p=parseFloat(i.target.value)/100;Te=.1+p*p*63.9,de.textContent=Te.toFixed(2)})}if(v&&me&&(v.value=(Ie*20).toString(),me.textContent=Ie.toFixed(2),v.addEventListener("input",r=>{Ie=parseFloat(r.target.value)/20,me.textContent=Ie.toFixed(2)})),fe&&W&&(fe.value=(Le*100).toString(),W.textContent=Le.toFixed(2),fe.addEventListener("input",r=>{Le=parseFloat(r.target.value)/100,W.textContent=Le.toFixed(2)})),pe&&ge){const r=l.canvasWebGL.width,i=r/2;pe.value="0",ge.textContent="0",pe.addEventListener("input",q=>{const p=parseFloat(q.target.value);ze=((i+p)%r+r)%r,Ze=0,ge.textContent=p.toFixed(0)})}if(xe&&he&&(xe.value=De.toString(),he.textContent=De.toFixed(0),xe.addEventListener("input",r=>{De=parseFloat(r.target.value),he.textContent=De.toFixed(0)})),T&&_e&&(T.min="0",T.max="500",T.step="1",T.value=Ne.toString(),_e.textContent=Ne.toFixed(3),T.addEventListener("input",r=>{Ne=parseFloat(r.target.value),_e.textContent=Ne.toFixed(3)})),u&&S&&(u.value=Oe.toString(),S.textContent=Oe.toFixed(0),u.addEventListener("input",r=>{Oe=parseFloat(r.target.value),S.textContent=Oe.toFixed(0)})),K&&Ge&&(K.max=l.canvasWebGL.width.toString(),K.value=$.toString(),Ge.textContent=$.toFixed(0),K.addEventListener("input",r=>{const i=parseFloat(r.target.value);$=Math.max(0,i),Ge.textContent=$.toFixed(0)})),P&&ve&&(P.min="1",P.max="50",P.step="0.1",P.value=Fe.toString(),ve.textContent=Fe.toFixed(1),P.addEventListener("input",r=>{const i=parseFloat(r.target.value);Fe=Math.max(1,i),ve.textContent=Fe.toFixed(1)})),j&&Q&&(j.value=(Pe*100).toString(),Q.textContent=Pe.toFixed(2),j.addEventListener("input",r=>{Pe=parseFloat(r.target.value)/100,Q.textContent=Pe.toFixed(2)})),J&&I){const r=Math.sqrt(B/64);J.value=(r*100).toString(),I.textContent=B.toFixed(2),J.addEventListener("input",i=>{const p=parseFloat(i.target.value)/100;B=p*p*64,I.textContent=B.toFixed(2)})}if(R&&ee){const r=Math.round(E/.0025);R.value=r.toString(),ee.textContent=E.toFixed(4),R.addEventListener("input",i=>{E=parseFloat(i.target.value)*.0025,ee.textContent=E.toFixed(4)})}e()}function w(l){const n=parseInt(l.replace("#",""),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function qe(l,n,t){const e=w(l).map(m=>m*255),o=w(n).map(m=>m*255),a=Math.round(e[0]+(o[0]-e[0])*t),s=Math.round(e[1]+(o[1]-e[1])*t),c=Math.round(e[2]+(o[2]-e[2])*t),f=m=>{const g=m.toString(16);return g.length===1?"0"+g:g};return`#${f(a)}${f(s)}${f(c)}`}const Bt=document.querySelector("#canvas-2d"),it=document.querySelector("#canvas-webgl");Bt&&it?zt({canvasWebGL:it}):console.error("Canvas elements not found! Check index.html.");
