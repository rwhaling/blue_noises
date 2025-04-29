precision mediump float;
uniform sampler2D u_image;
uniform sampler2D u_gradient;
uniform sampler2D u_circle;
uniform bool u_flipY;
varying vec2 v_texCoord;

void main() {
    vec2 sampleCoord = v_texCoord;
    if (!u_flipY) {
        sampleCoord.y = 1.0 - sampleCoord.y;
    }
    vec4 grad = texture2D(u_gradient, sampleCoord);
    vec4 circ = texture2D(u_circle, sampleCoord);
    // "Over" blend: circle over gradient
    gl_FragColor = mix(grad, circ, circ.a);
}