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
