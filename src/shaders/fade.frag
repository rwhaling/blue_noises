precision mediump float;

uniform sampler2D u_image;
uniform float u_fadeAmount; // 0.0 = no fade, 1.0 = fully transparent
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    color.a -= u_fadeAmount;
    if (color.a < 0.0) {
        color.a = 0.0;
    }
    gl_FragColor = color;
} 