
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);
const mouse = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5 };
const smoothMouse = { x: 0.5, y: 0.5 };
const parallax = { x: 0, y: 0 };
const smoothParallax = { x: 0, y: 0 };
let isHovering = false;
let hoverStrength = 0;
let velocity = 0;

let lastFrameTime = performance.now();
let frameCount = 0;
let fpsSum = 0;
let qualityReduced = false;

const cursorEl = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');
const cursorPos = { x: 0, y: 0 };
const dotPos = { x: 0, y: 0 };
const uniforms = {
    uBg1: { value: null },
    uBg2: { value: null },
    uChar1: { value: null },
    uChar2: { value: null },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uParallax: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 0.22 },
    uHoverStrength: { value: 0 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uVelocity: { value: 0 },
    uTrailMask: { value: null },
    uQuality: { value: 1.0 }
};
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
const trailSize = { w: Math.floor(window.innerWidth * 0.5), h: Math.floor(window.innerHeight * 0.5) };
const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType };
let trailRT_A = new THREE.WebGLRenderTarget(trailSize.w, trailSize.h, rtOpts);
let trailRT_B = new THREE.WebGLRenderTarget(trailSize.w, trailSize.h, rtOpts);

const trailScene = new THREE.Scene();
const trailCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const fadeMat = new THREE.ShaderMaterial({
    uniforms: { uPrev: { value: null }, uFade: { value: 0.97 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uPrev; uniform float uFade; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uPrev, vUv) * uFade; }',
    depthTest: false, depthWrite: false
});
const fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat);
fadeQuad.renderOrder = 0;
trailScene.add(fadeQuad);

const brushMat = new THREE.ShaderMaterial({
    uniforms: {
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uBrushSize: { value: 0.10 },
        uAspect: { value: window.innerWidth / window.innerHeight },
        uIntensity: { value: 1.0 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader: `
        uniform vec2 uCenter;
        uniform float uBrushSize;
        uniform float uAspect;
        uniform float uIntensity;
        varying vec2 vUv;
        void main(){
            vec2 diff = (vUv - uCenter) * vec2(uAspect, 1.0);
            float d = length(diff);
            float brush = smoothstep(uBrushSize, uBrushSize * 0.2, d) * uIntensity;
            gl_FragColor = vec4(vec3(brush), brush);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false
});
const brushQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brushMat);
brushQuad.renderOrder = 1;
trailScene.add(brushQuad);
const loader = new THREE.TextureLoader();
let loadCount = 0;
const TOTAL_TEXTURES = 4;
const liquidFill = document.getElementById('liquid-fill');
const loadingPercent = document.getElementById('loading-percent');
let displayProgress = 0;
let realProgress = 0;
let loadingDone = false;

function onTextureLoad() {
    loadCount++;
    realProgress = (loadCount / TOTAL_TEXTURES) * 100;
}

function animateLoading() {
    if (loadingDone) return;

    const target = Math.min(realProgress, 100);
    const speed = displayProgress < target ? 0.8 : 0.1;
    displayProgress += (target - displayProgress) * speed * 0.06 + 0.15;

    if (realProgress < 100) {
        displayProgress = Math.min(displayProgress, realProgress - 1);
    }
    displayProgress = Math.max(0, Math.min(displayProgress, 100));

    const rounded = Math.round(displayProgress);
    liquidFill.style.height = rounded + '%';
    loadingPercent.textContent = rounded + '%';

    if (rounded >= 100 && realProgress >= 100) {
        loadingDone = true;
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 600);
    } else {
        requestAnimationFrame(animateLoading);
    }
}

animateLoading();

function loadTex(url, uniform) {
    loader.load(url, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        uniforms[uniform].value = texture;
        onTextureLoad();
    }, undefined, (err) => {
        console.error('Erro ao carregar ' + url + ':', err);
        onTextureLoad();
    });
}

const isMobile = window.innerWidth <= 768;

if (isMobile) {
    document.getElementById('hint').innerHTML = '<span></span>Toque para revelar';
    brushMat.uniforms.uBrushSize.value = 0.14;
}

if (isMobile) {
    loadTex('assets/mobile/fundobrancomobilemenino.png', 'uBg1');
    loadTex('assets/mobile/fundobrancomobilespider.png', 'uBg2');
    loadTex('assets/mobile/meninomobilesemfundo.webp', 'uChar1');
    loadTex('assets/mobile/spidermobilesemfundo.png', 'uChar2');
} else {
    loadTex('assets/desktop/fundo brancomenino.png', 'uBg1');
    loadTex('assets/desktop/fundobrancospider.png', 'uBg2');
    loadTex('assets/desktop/Semfundomenino.webp', 'uChar1');
    loadTex('assets/desktop/semfundospider.png', 'uChar2');
}
document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1.0 - (e.clientY / window.innerHeight);
    isHovering = true;

    parallax.x = (e.clientX / window.innerWidth - 0.5);
    parallax.y = (e.clientY / window.innerHeight - 0.5);

    cursorPos.x = e.clientX;
    cursorPos.y = e.clientY;
    dotPos.x = e.clientX;
    dotPos.y = e.clientY;
});

document.addEventListener('mouseleave', () => {
    isHovering = false;
});

document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    mouse.x = t.clientX / window.innerWidth;
    mouse.y = 1.0 - (t.clientY / window.innerHeight);
    isHovering = true;
    parallax.x = (t.clientX / window.innerWidth - 0.5);
    parallax.y = (t.clientY / window.innerHeight - 0.5);
    cursorPos.x = t.clientX;
    cursorPos.y = t.clientY;
    dotPos.x = t.clientX;
    dotPos.y = t.clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    mouse.x = t.clientX / window.innerWidth;
    mouse.y = 1.0 - (t.clientY / window.innerHeight);
    isHovering = true;
    parallax.x = (t.clientX / window.innerWidth - 0.5);
    parallax.y = (t.clientY / window.innerHeight - 0.5);
    cursorPos.x = t.clientX;
    cursorPos.y = t.clientY;
    dotPos.x = t.clientX;
    dotPos.y = t.clientY;
}, { passive: true });

document.addEventListener('touchend', () => {
    isHovering = false;
});

document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => cursorEl.classList.add('hovering'));
    el.addEventListener('mouseleave', () => cursorEl.classList.remove('hovering'));
});

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    const trailScale = qualityReduced ? 0.25 : 0.5;
    trailSize.w = Math.floor(window.innerWidth * trailScale);
    trailSize.h = Math.floor(window.innerHeight * trailScale);
    trailRT_A.setSize(trailSize.w, trailSize.h);
    trailRT_B.setSize(trailSize.w, trailSize.h);
    brushMat.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
});
function reduceQuality() {
    qualityReduced = true;
    renderer.setPixelRatio(1);
    trailSize.w = Math.floor(window.innerWidth * 0.25);
    trailSize.h = Math.floor(window.innerHeight * 0.25);
    trailRT_A.setSize(trailSize.w, trailSize.h);
    trailRT_B.setSize(trailSize.w, trailSize.h);
    uniforms.uQuality.value = 0.0;
    while (particles.length > 15) particles.pop();
}

function fLerp(current, target, rate, dt60) {
    return current + (target - current) * (1 - Math.pow(1 - rate, dt60));
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaMs = now - lastFrameTime;
    lastFrameTime = now;
    const dt = Math.min(deltaMs / 1000, 0.1);
    const dt60 = dt * 60;

    if (!qualityReduced && frameCount < 90) {
        frameCount++;
        if (deltaMs > 0 && frameCount > 10) fpsSum += 1000 / deltaMs;
        if (frameCount === 90) {
            const avgFps = fpsSum / 80;
            if (avgFps < 40) reduceQuality();
        }
    }

    const time = now * 0.001;
    uniforms.uTime.value = time;

    smoothMouse.x = fLerp(smoothMouse.x, mouse.x, 0.06, dt60);
    smoothMouse.y = fLerp(smoothMouse.y, mouse.y, 0.06, dt60);
    uniforms.uMouse.value.set(smoothMouse.x, smoothMouse.y);

    smoothParallax.x = fLerp(smoothParallax.x, parallax.x, 0.04, dt60);
    smoothParallax.y = fLerp(smoothParallax.y, parallax.y, 0.04, dt60);
    uniforms.uParallax.value.set(smoothParallax.x, smoothParallax.y);

    const dx = mouse.x - mouse.prevX;
    const dy = mouse.y - mouse.prevY;
    const rawVelocity = Math.sqrt(dx * dx + dy * dy) * 50;
    velocity = fLerp(velocity, Math.min(rawVelocity, 2.0), 0.1, dt60);
    uniforms.uVelocity.value = velocity;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;

    const targetStrength = isHovering ? 1.0 : 0.0;
    hoverStrength = fLerp(hoverStrength, targetStrength, 0.04, dt60);
    uniforms.uHoverStrength.value = hoverStrength;

    const baseBrush = isMobile ? 0.14 : 0.10;
    brushMat.uniforms.uBrushSize.value = baseBrush + Math.sin(time * 1.2) * 0.005;
    brushMat.uniforms.uIntensity.value = isHovering ? 1.0 : 0.0;

    brushMat.uniforms.uCenter.value.set(smoothMouse.x, smoothMouse.y);

    fadeMat.uniforms.uFade.value = Math.pow(0.97, dt60);
    fadeMat.uniforms.uPrev.value = trailRT_A.texture;
    renderer.setRenderTarget(trailRT_B);
    renderer.render(trailScene, trailCamera);
    renderer.setRenderTarget(null);

    uniforms.uTrailMask.value = trailRT_B.texture;

    const temp = trailRT_A;
    trailRT_A = trailRT_B;
    trailRT_B = temp;

    const cx = parseFloat(cursorEl.style.left) || cursorPos.x;
    const cy = parseFloat(cursorEl.style.top) || cursorPos.y;
    const cursorLerp = 1 - Math.pow(1 - 0.12, dt60);
    cursorEl.style.left = (cx + (cursorPos.x - cx) * cursorLerp) + 'px';
    cursorEl.style.top = (cy + (cursorPos.y - cy) * cursorLerp) + 'px';
    cursorDot.style.left = dotPos.x + 'px';
    cursorDot.style.top = dotPos.y + 'px';

    renderer.render(scene, camera);
}

animate();
const bgCanvas = document.getElementById('bg-particles');
const bgCtx = bgCanvas.getContext('2d');

function resizeBgCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
resizeBgCanvas();
window.addEventListener('resize', resizeBgCanvas);

const particles = [];
const PARTICLE_COUNT = 40;

for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2.5 + 1,
        opacity: Math.random() * 0.15 + 0.08,
        isRed: Math.random() > 0.5
    });
}

let lastParticleTime = performance.now();
function animateParticles() {
    requestAnimationFrame(animateParticles);

    const now = performance.now();
    const pdt = Math.min((now - lastParticleTime) / 1000, 0.1) * 60;
    lastParticleTime = now;

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    const mx = cursorPos.x;
    const my = cursorPos.y;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx * pdt;
        p.y += p.vy * pdt;

        const pdx = p.x - mx;
        const pdy = p.y - my;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (dist < 200 && dist > 0) {
            const force = (200 - dist) / 200 * 0.15;
            p.x += (pdx / dist) * force;
            p.y += (pdy / dist) * force;
        }

        if (p.x < -10) p.x = bgCanvas.width + 10;
        if (p.x > bgCanvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = bgCanvas.height + 10;
        if (p.y > bgCanvas.height + 10) p.y = -10;

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        bgCtx.fillStyle = p.isRed
            ? `rgba(200, 40, 40, ${p.opacity})`
            : `rgba(80, 80, 80, ${p.opacity})`;
        bgCtx.fill();

        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
            if (d < 150) {
                bgCtx.beginPath();
                bgCtx.moveTo(p.x, p.y);
                bgCtx.lineTo(p2.x, p2.y);
                bgCtx.strokeStyle = `rgba(180, 40, 40, ${(1 - d / 150) * 0.12})`;
                bgCtx.lineWidth = 0.5;
                bgCtx.stroke();
            }
        }
    }
}

animateParticles();
