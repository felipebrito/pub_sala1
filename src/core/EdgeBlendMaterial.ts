import * as THREE from 'three';

export const EdgeBlendShader = {
    uniforms: {
        map: { value: null },
        map2: { value: null },
        mixVideo: { value: 0.0 }, // 0.0 = map, 1.0 = map2
        blendLeft: { value: 0.0 },
        blendRight: { value: 0.0 },
        blendTop: { value: 0.0 },
        blendBottom: { value: 0.0 },
        cropInfo: { value: new THREE.Vector4(0, 1, 0, 1) }, // uMin, uMax, vMin, vMax
        gamma: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv; // GLOBAL UV (already mapped to slice)
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D map;
        uniform sampler2D map2;
        uniform float mixVideo;
        
        uniform float blendLeft;
        uniform float blendRight;
        uniform float blendTop;
        uniform float blendBottom;
        uniform vec4 cropInfo; // uMin, uMax, vMin, vMax
        uniform float gamma; 
        
        varying vec2 vUv;

        float ramp(float t) {
            // Apply gamma curve to control gradient falloff
            // t is linear 0..1
            return pow(t, gamma);
        }

        void main() {
            vec4 c1 = texture2D(map, vUv);
            vec4 c2 = texture2D(map2, vUv);

            // Mix the two video sources
            vec4 color = mix(c1, c2, mixVideo);
            
            // Calculate LOCAL UV (0..1) relative to crop
            // uLocal = (globalU - uMin) / (uMax - uMin)
            float uSpan = cropInfo.y - cropInfo.x;
            float vSpan = cropInfo.w - cropInfo.z;
            
            // Avoid division by zero
            if (uSpan < 0.001) uSpan = 0.001;
            if (vSpan < 0.001) vSpan = 0.001;

            float uLocal = (vUv.x - cropInfo.x) / uSpan;
            float vLocal = (vUv.y - cropInfo.z) / vSpan;
            
            // Edge Blending = darkening edges to black -> Alpha 0
            // Since projectors add light, "Black" means no light.
            // Transparency over Black background works too.
            
            float alpha = 1.0;
            
            // Left Edge
            if (blendLeft > 0.0) {
                 if (uLocal < blendLeft) {
                      alpha *= ramp(uLocal / blendLeft);
                 }
            }
            
            // Right Edge
            if (blendRight > 0.0) {
                 if (uLocal > (1.0 - blendRight)) {
                      alpha *= ramp((1.0 - uLocal) / blendRight);
                 }
            }
            
             // Top Edge (vLocal 1 is Top)
             if (blendTop > 0.0) {
                  if (vLocal > (1.0 - blendTop)) {
                      alpha *= ramp((1.0 - vLocal) / blendTop);
                  }
             }
             
             // Bottom Edge
             if (blendBottom > 0.0) {
                  if (vLocal < blendBottom) {
                       alpha *= ramp(vLocal / blendBottom);
                  }
             }
            
            // Apply Factor to RGB
            gl_FragColor = vec4(color.rgb * alpha, 1.0); 
        }
    `
};

export class EdgeBlendMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            uniforms: THREE.UniformsUtils.clone(EdgeBlendShader.uniforms),
            vertexShader: EdgeBlendShader.vertexShader,
            fragmentShader: EdgeBlendShader.fragmentShader,
            side: THREE.DoubleSide
        });
    }

    set map(texture: THREE.Texture | null) {
        this.uniforms.map.value = texture;
    }

    set map2(texture: THREE.Texture | null) {
        this.uniforms.map2.value = texture;
    }

    set mixVideo(val: number) {
        this.uniforms.mixVideo.value = val;
    }
}
