precision mediump float;
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
