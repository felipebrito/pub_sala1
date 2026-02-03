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
  uniform vec2 blendRange; // x: start edge, y: end edge
  uniform int projectorIndex; // 0, 1, 2
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float alpha = 1.0;

    // Simplified edge blending (linear)
    // Projector 0 (Left): Fade out on the right edge
    if (projectorIndex == 0) {
      if (vUv.x > 0.5) { // Right 50% is overlap
        alpha = 1.0 - (vUv.x - 0.5) * 2.0;
      }
    } 
    // Projector 1 (Middle): Fade in on left, fade out on right
    else if (projectorIndex == 1) {
      if (vUv.x < 0.5) { // Left 50% is overlap with P0
        alpha = vUv.x * 2.0;
      } else { // Right 50% is overlap with P2
        alpha = 1.0 - (vUv.x - 0.5) * 2.0;
      }
    }
    // Projector 2 (Right): Fade in on left
    else if (projectorIndex == 2) {
      if (vUv.x < 0.5) { // Left 50% is overlap with P1
        alpha = vUv.x * 2.0;
      }
    }

    // Apply gamma correction to the alpha ramp for smoother blending if needed
    alpha = pow(alpha, 1.0 / 2.2);

    gl_FragColor = vec4(color.rgb, color.a * alpha * opacity);
  }
`;
