const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    precision highp float;

    uniform sampler2D uBg1;
    uniform sampler2D uBg2;
    uniform sampler2D uChar1;
    uniform sampler2D uChar2;
    uniform sampler2D uTrailMask;
    uniform vec2 uMouse;
    uniform vec2 uParallax;
    uniform float uRadius;
    uniform float uHoverStrength;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVelocity;
    uniform float uQuality;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                          -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
            + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
            dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = vUv;
        vec2 mousePos = uMouse;

        vec2 bgUv = uv + uParallax * 0.004;
        vec2 charUv = uv - uParallax * 0.008;

        float trailRaw = texture2D(uTrailMask, uv).r;

        float time = uTime * 0.6;
        vec2 noiseCoord = uv * 3.0;
        float noise1 = snoise(noiseCoord + time * 0.3) * 0.5;
        float noise2 = snoise(noiseCoord * 2.0 - time * 0.2) * 0.25;
        float noise3 = 0.0;
        if (uQuality > 0.5) {
            noise3 = snoise(noiseCoord * 4.0 + time * 0.15) * 0.125;
        }
        float combinedNoise = noise1 + noise2 + noise3;

        float threshold = 0.4 + combinedNoise * 0.12;
        float mask = smoothstep(threshold - 0.08, threshold + 0.08, trailRaw);
        mask *= uHoverStrength;

        float edge = smoothstep(threshold - 0.1, threshold, trailRaw)
                   - smoothstep(threshold, threshold + 0.1, trailRaw);
        edge *= uHoverStrength;

        float distortionZone = smoothstep(threshold - 0.2, threshold, trailRaw)
                             - smoothstep(threshold, threshold + 0.2, trailRaw);
        distortionZone *= uHoverStrength;

        vec2 toMouse = normalize(uv - mousePos + 0.001);
        vec2 liquidDistort;
        if (uQuality > 0.5) {
            float flowNoise1 = snoise(uv * 5.0 + time * 0.5);
            float flowNoise2 = snoise(uv * 5.0 + time * 0.5 + 100.0);
            vec2 flowDir = vec2(flowNoise1, flowNoise2);
            liquidDistort = (flowDir * 0.012 + toMouse * 0.008 * uVelocity) * distortionZone;
        } else {
            liquidDistort = toMouse * 0.01 * uVelocity * distortionZone;
        }

        vec2 bgUv1 = bgUv + liquidDistort * 0.3;
        vec2 bgUv2 = bgUv + liquidDistort * 0.5;
        vec2 charUv1 = charUv + liquidDistort * 0.5;
        vec2 charUv2 = charUv + liquidDistort;

        vec4 bg1 = texture2D(uBg1, bgUv1);
        vec4 bg2 = texture2D(uBg2, bgUv2);

        vec4 char1;
        vec4 char2;
        if (uQuality > 0.5) {
            float chromaAmount = distortionZone * 0.005 * uHoverStrength;
            vec2 chromaDir = normalize(uv - mousePos + 0.001);
            char1.r = texture2D(uChar1, charUv1 + chromaDir * chromaAmount).r;
            char1.ga = texture2D(uChar1, charUv1).ga;
            char1.b = texture2D(uChar1, charUv1 - chromaDir * chromaAmount).b;
            char2.r = texture2D(uChar2, charUv2 + chromaDir * chromaAmount).r;
            char2.ga = texture2D(uChar2, charUv2).ga;
            char2.b = texture2D(uChar2, charUv2 - chromaDir * chromaAmount).b;
        } else {
            char1 = texture2D(uChar1, charUv1);
            char2 = texture2D(uChar2, charUv2);
        }

        vec3 scene1 = mix(bg1.rgb, char1.rgb, char1.a);
        vec3 scene2 = mix(bg2.rgb, char2.rgb, char2.a);
        vec3 finalColor = mix(scene1, scene2, mask);

        float rippleBase = trailRaw - threshold;
        float ripple = sin(rippleBase * 80.0 - uTime * 3.0) * 0.5 + 0.5;
        ripple *= edge;
        ripple *= uHoverStrength * 0.06;
        finalColor += vec3(ripple);

        finalColor += vec3(0.95, 0.3, 0.3) * edge * 0.15;

        float vignette = 1.0 - smoothstep(0.4, 1.6, length(vUv - 0.5) * 1.8);
        finalColor *= mix(0.55, 1.0, vignette);

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;
