import * as THREE from 'three';

export const EdgeBlendShader = {
    uniforms: {
        map: { value: null },
        map2: { value: null },
        patternTexture: { value: null },
        mixVideo: { value: 0.0 }, // 0.0 = map, 1.0 = map2
        blendLeft: { value: 0.0 },
        blendRight: { value: 0.0 },
        blendTop: { value: 0.0 },
        blendBottom: { value: 0.0 },
        cropInfo: { value: new THREE.Vector4(0, 1, 0, 1) }, // uMin, uMax, vMin, vMax
        gamma: { value: 1.0 },
        patternMode: { value: 0 } // 0=Video, 1=Grid, 2=ColorBars, 3=UV, 4=Black
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
        uniform sampler2D patternTexture;
        uniform float mixVideo;
        
        uniform float blendLeft;
        uniform float blendRight;
        uniform float blendTop;
        uniform float blendBottom;
        uniform vec4 cropInfo; // uMin, uMax, vMin, vMax
        uniform float gamma; 
        
        uniform int patternMode; // 0=Video, 1=FineGrid, 2=Focus, 3=Overlap, 4=Black, 5=Custom, 6=Metric
        
        varying vec2 vUv;

        float ramp(float t) {
            return pow(t, gamma);
        }

        // --- PATTERN GENERATORS ---

        // 1. FINE GRID (Pro Alignment)
        vec3 fineGridPattern(vec2 uv) {
            // Background
            vec3 col = vec3(0.0);
            
            // Major Grid (10x10)
            float divMaj = 10.0;
            float thMaj = 0.002;
            float xMaj = fract(uv.x * divMaj);
            float yMaj = fract(uv.y * divMaj);
            if (xMaj < thMaj || xMaj > 1.0-thMaj || yMaj < thMaj || yMaj > 1.0-thMaj) col += vec3(0.5);

            // Crosshairs at Major intersections
            if ((abs(xMaj) < thMaj*4.0 || abs(xMaj-1.0) < thMaj*4.0) && (abs(yMaj) < thMaj*4.0 || abs(yMaj-1.0) < thMaj*4.0)) {
                    col = vec3(1.0); 
            }

            // Minor Grid (Subdivisions 50x50)
            float divMin = 50.0;
            float thMin = 0.001;
            float xMin = fract(uv.x * divMin);
            float yMin = fract(uv.y * divMin);
            if ((xMin < thMin || xMin > 1.0-thMin || yMin < thMin || yMin > 1.0-thMin) && col.r < 0.1) col += vec3(0.2);

            // Diagonals (Aspect Check)
            float diag1 = abs(uv.y - uv.x);
            float diag2 = abs(uv.y - (1.0 - uv.x));
            if (diag1 < 0.002 || diag2 < 0.002) col = vec3(1.0, 1.0, 0.0);

            // Center Cross (Red)
            if (abs(uv.x - 0.5) < 0.002 || abs(uv.y - 0.5) < 0.002) col = vec3(1.0, 0.0, 0.0);

            return col;
        }

        // 2. FOCUS (High Freq)
        vec3 focusPattern(vec2 uv) {
            float freq = 100.0; 
            float c = mod(floor(uv.x * freq) + floor(uv.y * freq), 2.0);
            float dist = distance(uv, vec2(0.5));
            float ring = mod(floor(dist * 100.0), 2.0);
            
            vec3 col = vec3(c);
            if (dist < 0.2) col = vec3(ring);
            return col;
        }

        void main() {
            // Calculate Local UVs for Overlap/Blending
            float uSpan = cropInfo.y - cropInfo.x;
            float vSpan = cropInfo.w - cropInfo.z;
            if (uSpan < 0.001) uSpan = 0.001;
            if (vSpan < 0.001) vSpan = 0.001;

            float uLocal = (vUv.x - cropInfo.x) / uSpan;
            float vLocal = (vUv.y - cropInfo.z) / vSpan;

            vec3 finalColor = vec3(0.0);
            float alpha = 1.0;

            if (patternMode == 1) {
                finalColor = fineGridPattern(vUv);
            } else if (patternMode == 2) {
                finalColor = focusPattern(vUv);
            } else if (patternMode == 3) {
                // OVERLAP GUIDE
                finalColor = fineGridPattern(vUv) * 0.2; 
                
                // Left Blend (Red)
                if (blendLeft > 0.0 && uLocal < blendLeft) {
                    finalColor = mix(finalColor, vec3(1.0, 0.0, 0.0), 0.5); 
                }
                // Right Blend (Blue)
                if (blendRight > 0.0 && uLocal > (1.0 - blendRight)) {
                    finalColor = mix(finalColor, vec3(0.0, 0.0, 1.0), 0.5); 
                }
                // Top/Bottom (Green)
                if ((blendTop > 0.0 && vLocal > (1.0 - blendTop)) || (blendBottom > 0.0 && vLocal < blendBottom)) {
                        finalColor = mix(finalColor, vec3(0.0, 1.0, 0.0), 0.5);
                }
                
            } else if (patternMode == 4) {
                finalColor = vec3(0.0); // Black
            } else if (patternMode == 5) {
                // CUSTOM TEXTURE
                vec4 cP = texture2D(patternTexture, vUv);
                finalColor = cP.rgb;
            } else if (patternMode == 6) {
                // METRIC / UV RAMP
                finalColor = vec3(vUv.x, vUv.y, 0.0);
                if (mod(vUv.x, 0.1) < 0.002 || mod(vUv.y, 0.1) < 0.002) finalColor += vec3(0.5);
            } else {
                // VIDEO
                vec4 c1 = texture2D(map, vUv);
                vec4 c2 = texture2D(map2, vUv);
                finalColor = mix(c1, c2, mixVideo).rgb;
            }

            // --- EDGE BLENDING ALPHA ---
            if (blendLeft > 0.0 && uLocal < blendLeft) {
                    alpha *= ramp(uLocal / blendLeft);
            }
            if (blendRight > 0.0 && uLocal > (1.0 - blendRight)) {
                    alpha *= ramp((1.0 - uLocal) / blendRight);
            }
            if (blendTop > 0.0 && vLocal > (1.0 - blendTop)) {
                    alpha *= ramp((1.0 - vLocal) / blendTop);
            }
            if (blendBottom > 0.0 && vLocal < blendBottom) {
                    alpha *= ramp(vLocal / blendBottom);
            }
            
            gl_FragColor = vec4(finalColor * alpha, 1.0); 
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

    set patternTexture(texture: THREE.Texture | null) {
        this.uniforms.patternTexture.value = texture;
    }

    set mixVideo(val: number) {
        this.uniforms.mixVideo.value = val;
    }

    set patternMode(val: number) {
        this.uniforms.patternMode.value = val;
        this.uniformsNeedUpdate = true;
    }
}
