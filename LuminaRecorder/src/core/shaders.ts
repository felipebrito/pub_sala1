export const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(color.rgb, color.a * opacity);
  }
`;
