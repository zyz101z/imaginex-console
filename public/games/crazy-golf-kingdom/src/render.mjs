// CRAZY GOLF KINGDOM — three.js renderer. Everything on screen is built here from the hole data.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TILE, BALL_R, CUP_R, bladeAngle, moverOffset, floorHeight } from './physics.mjs';

const WALL_H = 0.34, WALL_T = 0.17;

// ---------- textures (canvas-made, no assets) ----------
function feltTexture(color, dark, stripes = true) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 256);
  if (stripes) { g.fillStyle = '#' + dark.toString(16).padStart(6, '0'); for (let i = 0; i < 256; i += 64) g.fillRect(0, i, 256, 32); }
  const img = g.getImageData(0, 0, 256, 256); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseTexture(base, amp = 30) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const img = g.createImageData(128, 128); const d = img.data; const r = (base >> 16) & 255, gg = (base >> 8) & 255, b = base & 255;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amp; d[i] = r + n; d[i + 1] = gg + n; d[i + 2] = b + n; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ballTexture(skin) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = skin.base; g.fillRect(0, 0, 256, 128);
  if (skin.pattern === 'dimple') { g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 6; y < 128; y += 12) for (let x = (y / 12 % 2) * 6; x < 256; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 6.283); g.fill(); } }
  if (skin.pattern === 'stripe') { g.fillStyle = skin.accent; g.fillRect(0, 52, 256, 24); }
  if (skin.pattern === 'stars') { g.fillStyle = skin.accent; for (let i = 0; i < 18; i++) { const x = (i * 97) % 256, y = (i * 53) % 128; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? 3 : 7; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); } }
  if (skin.pattern === 'soccer') { g.fillStyle = skin.accent; for (let i = 0; i < 8; i++) { const x = (i * 71 + 20) % 256, y = (i * 41 + 15) % 128; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); } }
  if (skin.pattern === 'eyes') { g.fillStyle = '#fff'; g.beginPath(); g.arc(96, 64, 22, 0, 6.283); g.arc(160, 64, 22, 0, 6.283); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(100, 66, 9, 0, 6.283); g.arc(164, 66, 9, 0, 6.283); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.arc(128, 84, 18, 0.3, 2.84); g.stroke(); }
  if (skin.pattern === 'flame') { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffd54f'); gr.addColorStop(0.6, '#ff6f00'); gr.addColorStop(1, '#b71c1c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse((i * 41) % 256, 20 + (i * 29) % 60, 6, 18, 0, 0, 6.283); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function arrowTexture(color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.moveTo(20, 40); g.lineTo(70, 40); g.lineTo(70, 20); g.lineTo(112, 64); g.lineTo(70, 108); g.lineTo(70, 88); g.lineTo(20, 88); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const blob = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
  blob(70, 80, 45); blob(120, 60, 55); blob(175, 78, 48); blob(100, 90, 40); blob(150, 95, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flagTexture(n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = '#e53935'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 40, 28, 0, 6.283); g.fill();
  g.fillStyle = '#e53935'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function chevronTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#ffd600'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#212121';
  for (let i = -1; i < 4; i++) { g.beginPath(); g.moveTo(i * 36, 20); g.lineTo(i * 36 + 30, 64); g.lineTo(i * 36, 108); g.lineTo(i * 36 + 14, 108); g.lineTo(i * 36 + 44, 64); g.lineTo(i * 36 + 14, 20); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#5c6bc0'; g.beginPath(); g.arc(128, 128, 128, 0, 6.283); g.fill();
  g.strokeStyle = '#c5cae9'; g.lineWidth = 10; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(128, 128, 100, k * 2.094, k * 2.094 + 1.4); g.stroke(); const a = k * 2.094 + 1.4; g.fillStyle = '#c5cae9'; g.beginPath(); g.moveTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); g.lineTo(128 + Math.cos(a + 0.25) * 100, 128 + Math.sin(a + 0.25) * 100); g.closePath(); g.fill(); }
  g.fillStyle = '#9fa8da'; g.beginPath(); g.arc(128, 128, 22, 0, 6.283); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function checkerTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- model cache ----------
const gltfLoader = new GLTFLoader();
const modelCache = new Map();   // name -> Promise<THREE.Object3D|null>
const modelReady = new Map();   // name -> THREE.Object3D|null once resolved (lets buildHole place models synchronously)
export function loadModel(name) {
  if (!modelCache.has(name)) {
    modelCache.set(name, new Promise((res) => {
      gltfLoader.load('models/' + name + '.glb', (g) => {
        const obj = g.scene; obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; if (o.material) { o.material.roughness = 0.85; o.material.metalness = 0; } } });
        // normalise: sit on y=0, fit into a unit box (scaled by caller)
        const box = new THREE.Box3().setFromObject(obj); const size = new THREE.Vector3(); box.getSize(size); const ctr = new THREE.Vector3(); box.getCenter(ctr);
        const s = 1 / Math.max(size.x, size.y, size.z); obj.scale.setScalar(s); obj.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s);
        const wrap = new THREE.Group(); wrap.add(obj); wrap.userData.size = size.clone().multiplyScalar(s); modelReady.set(name, wrap); res(wrap);
      }, undefined, () => { modelReady.set(name, null); res(null); });
    }));
  }
  return modelCache.get(name);
}
function fallbackModel(name, color) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1, 7), m); body.position.y = 0.5; body.castShadow = true; g.add(body);
  g.userData.size = new THREE.Vector3(0.9, 1, 0.9); return g;
}

// ---------- renderer ----------
export class GolfRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    // preserveDrawingBuffer: the compositor may otherwise present a CLEARED (black) buffer if it samples the canvas
    // between a clear and the next draw — which is exactly what happens while shaders compile at hole start on real GPUs.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    const touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = touch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
    this.cam = { yaw: -0.6, pitch: 0.95, dist: 9, tx: 0, ty: 0, tz: 0, sx: 0, sy: 0, sz: 0 };
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.9); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.2); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(touch ? 1536 : 2048, touch ? 1536 : 2048); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02; this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.holeGroup = null; this.dynamicNodes = []; this.animNodes = []; this.particles = [];
    this.ballSkin = { base: '#ffffff', accent: '#ff5252', pattern: 'dimple' };
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), new THREE.MeshStandardMaterial({ map: ballTexture(this.ballSkin), roughness: 0.45 }));
    this.ball.castShadow = true; this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.scene.add(this.ballShadow);
    // aim arrow
    this.arrow = new THREE.Group();
    const am = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    this.arrowShaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.07), am); this.arrowShaft.position.x = 0.5; this.arrow.add(this.arrowShaft);
    this.arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 3), am); this.arrowHead.rotation.z = -Math.PI / 2; this.arrow.add(this.arrowHead);
    this.arrowRing = new THREE.Mesh(new THREE.RingGeometry(BALL_R * 1.6, BALL_R * 2.1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false }));
    this.arrowRing.rotation.x = -Math.PI / 2; this.arrow.add(this.arrowRing); this.arrow.renderOrder = 10; this.arrow.visible = false; this.scene.add(this.arrow);
    // sky dome
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x8fd3ff) }, bot: { value: new THREE.Color(0xe8f7ff) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vp; void main(){ float h = clamp(vp.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bot, top, h),1.0); }' }));
    this.scene.add(this.sky);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.9; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.stars = null;
    this.other = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.4 })); this.other.castShadow = true; this.other.visible = false; this.scene.add(this.other);
    // particles
    this.pGeo = new THREE.BufferGeometry(); this.pMax = 600; this.pPos = new Float32Array(this.pMax * 3); this.pCol = new Float32Array(this.pMax * 3);
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.pMesh = new THREE.Points(this.pGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this.scene.add(this.pMesh); this.pMesh.frustumCulled = false;
    this.checker = checkerTexture(); this.arrowTex = arrowTexture(); this.chevronTex = chevronTexture(); this.discTex = discTexture();
    // shot preview (instanced dots) + ball trail + shake
    this.previewMax = 40; this.preview = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff59d, transparent: true, opacity: 0.95, depthTest: false }), this.previewMax);
    this.preview.renderOrder = 11; this.preview.count = 0; this.preview.frustumCulled = false; this.scene.add(this.preview);
    this.trailMax = 24; this.trailPos = new Float32Array(this.trailMax * 3); this.trailGeo = new THREE.BufferGeometry(); this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Line(this.trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); this.trail.frustumCulled = false; this.scene.add(this.trail); this.trailPts = [];
    this.shake = 0; this.tmpM = new THREE.Matrix4();
    this.cloudTex = cloudTexture(); this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cloudTex, transparent: true, opacity: 0.9, depthWrite: false })); const sc = 14 + Math.random() * 18; sp.scale.set(sc, sc * 0.5, 1); sp.position.set((Math.random() - 0.5) * 220, 26 + Math.random() * 18, (Math.random() - 0.5) * 220); sp.userData.v = 0.4 + Math.random() * 0.6; this.clouds.add(sp); }
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4 })); this.moon.visible = false; this.scene.add(this.moon);
    this.hitNodes = new Map(); this.hitAnims = [];
    this.cupGlow = new THREE.Mesh(new THREE.RingGeometry(CUP_R + 0.05, CUP_R + 0.22, 32), new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.cupGlow.rotation.x = -Math.PI / 2; this.scene.add(this.cupGlow);
    this.idlePulse = 0;
    // putter: shaft + head, shown behind the ball while aiming, swings on the shot
    this.putter = new THREE.Group(); const shaftMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.7, roughness: 0.3 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.9, 8), shaftMat); shaft.position.set(0, 0.45, 0); shaft.rotation.z = 0.35; shaft.position.x = -0.16;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.35 })); head.position.set(0, 0.03, 0);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x212121 })); grip.position.set(-0.31, 0.86, 0); grip.rotation.z = 0.35;
    this.putter.add(shaft, head, grip); this.putter.visible = false; this.putter.traverse(o => { o.castShadow = true; }); this.scene.add(this.putter); this.putterSwing = null;
    this.resize();
  }
  preloadModels(names) { return Promise.all(names.map(n => loadModel(n))); }
  warm(ball, worldT) { this.update(ball, worldT, 0.016, null); this.renderer.compile(this.scene, this.camera); this.renderer.render(this.scene, this.camera); }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    if (w === this._w && h === this._h) return;   // setSize clears the canvas — never do it for a no-op
    this._w = w; this._h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.world) this.renderer.render(this.scene, this.camera);   // redraw immediately so a resize never leaves a cleared frame
  }
  putt(power) { this.putterSwing = { t: 0, power }; }
  setPreview(points) { // [{x,y,z}] or null
    if (!points || !points.length) { this.preview.count = 0; return; }
    const n = Math.min(points.length, this.previewMax);
    for (let i = 0; i < n; i++) { const p = points[i]; const sc = 1 - i / n * 0.5; this.tmpM.makeScale(sc, sc, sc); this.tmpM.setPosition(p.x, p.y + 0.1, p.z); this.preview.setMatrixAt(i, this.tmpM); }
    this.preview.count = n; this.preview.instanceMatrix.needsUpdate = true;
  }
  addShake(v) { this.shake = Math.min(0.35, this.shake + v); }
  hit(x, z) { // squash a bumper / wobble a guardian near (x,z)
    let best = null, bd = 1.2;
    for (const [, h] of this.hitNodes) { const d = Math.hypot(h.node.position.x - x, h.node.position.z - z); if (d < bd) { bd = d; best = h; } }
    if (best) this.hitAnims.push({ h: best, t: 0 });
  }
  setCupNear(d) { this.cupGlow.material.opacity = d < 1.6 ? Math.max(0, 0.8 - d * 0.4) : 0; this.cupGlow.userData.on = d < 1.6; }
  setOther(ball) { if (!ball || ball.inCup) { this.other.visible = false; return; } this.other.visible = true; this.other.position.set(ball.x, ball.y + BALL_R, ball.z); }
  setSkin(skin) { this.ballSkin = skin; this.ball.material.map = ballTexture(skin); this.ball.material.needsUpdate = true; this.trail.material.color.set(skin.trail || '#ffffff'); this.trail.material.opacity = skin.trail ? 0.75 : 0.45; this.ball.material.emissive = new THREE.Color(skin.glow || 0x000000); this.ball.material.emissiveIntensity = skin.glow ? 0.5 : 0; this.emitT = 0; }

  // ---------- build a hole ----------
  async buildHole(hole, K, world) {
    if (this.holeGroup) { this.scene.remove(this.holeGroup); this.holeGroup.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    this.dynamicNodes = []; this.animNodes = []; this.world = world; this.K = K;
    const G = this.holeGroup = new THREE.Group(); this.scene.add(G);
    this.sky.material.uniforms.top.value.set(K.sky[0]); this.sky.material.uniforms.bot.value.set(K.sky[1]);
    this.ground.material.color.set(0xffffff); const gt = noiseTexture(K.ground, K.id === 'space' ? 6 : 12); gt.repeat.set(140, 140); this.ground.material.map = gt; this.ground.material.needsUpdate = true; this.scene.fog = new THREE.Fog(K.fog, 40, 140);
    this.hemi.intensity = K.id === 'space' ? 0.5 : K.id === 'castle' ? 0.6 : 0.9; this.sun.intensity = K.id === 'space' ? 1.6 : K.id === 'castle' ? 1.5 : 2.2;
    this.sun.color.set(K.id === 'castle' ? 0xc9b7ff : K.id === 'space' ? 0xdfe9ff : 0xfff4e0);
    if (K.id === 'space') { if (!this.stars) { const g = new THREE.BufferGeometry(); const p = new Float32Array(1200 * 3); for (let i = 0; i < p.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(280); if (v.y < 5) v.y = 5 + Math.random() * 100; p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z; } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true })); } this.scene.add(this.stars); }
    else if (this.stars) this.scene.remove(this.stars);
    this.clouds.visible = K.id !== 'space'; this.moon.visible = K.id === 'castle';
    for (const sp of this.clouds.children) sp.material.opacity = K.id === 'castle' ? 0.35 : 0.9;
    this.hitNodes.clear(); this.hitAnims = [];

    const felt = feltTexture(K.felt, K.feltDark); felt.repeat.set(1, 1);
    const feltMat = new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 });
    const sandMat = new THREE.MeshStandardMaterial({ map: noiseTexture(0xe8d29a, 26), roughness: 1 });
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfefff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.95 });
    const syrupMat = new THREE.MeshStandardMaterial({ color: 0xc2185b, roughness: 0.25, metalness: 0.05 });
    const surfMat = { felt: feltMat, sand: sandMat, ice: iceMat, syrup: syrupMat };
    const wallMat = new THREE.MeshStandardMaterial({ color: K.wall, roughness: 0.6 });
    const wallTopMat = new THREE.MeshStandardMaterial({ color: K.wallTop, roughness: 0.5 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });

    // tiles
    for (const t of hole.tiles) {
      const x = t.x * TILE, z = t.z * TILE;
      if (!t.ramp) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.12, TILE), surfMat[t.surface] || feltMat);
        top.position.set(x + TILE / 2, t.height - 0.06, z + TILE / 2); top.receiveShadow = true; G.add(top);
        const base = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.7 + t.height, TILE), baseMat); base.position.set(x + TILE / 2, (t.height - 0.12 - 0.7) / 2 - 0.06, z + TILE / 2); G.add(base);
      } else {
        // sloped top: plane geometry with corner heights
        const geo = new THREE.PlaneGeometry(TILE, TILE, 1, 1); geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const px = pos.getX(i) + TILE / 2 + x, pz = pos.getZ(i) + TILE / 2 + z; pos.setY(i, floorHeight(world, Math.min(Math.max(px, x + 0.001), x + TILE - 0.001), Math.min(Math.max(pz, z + 0.001), z + TILE - 0.001))); }
        geo.computeVertexNormals();
        const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95, color: 0xd7ccc8 })); top.position.set(x + TILE / 2, 0, z + TILE / 2); top.receiveShadow = true; G.add(top);
        const lo = Math.min(t.ramp.from, t.ramp.to); const base = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.7 + lo, TILE), baseMat); base.position.set(x + TILE / 2, (lo - 0.7) / 2 - 0.02, z + TILE / 2); G.add(base);
        // wedge under the slope so the high end is not hollow: thin plane pushed down copies the top
        const under = top.clone(); under.material = baseMat; under.position.y = -0.03; G.add(under);
      }
    }
    for (const g of hole.gaps || []) { const pit = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.7, TILE), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 1 })); pit.position.set((g.x + 0.5) * TILE, -0.55, (g.z + 0.5) * TILE); G.add(pit);
      const edge = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.02, 4), new THREE.MeshBasicMaterial({ visible: false })); G.add(edge); }
    // walls
    for (const w of world.walls) {
      const dx = w.bx - w.ax, dz = w.bz - w.az, L = Math.hypot(dx, dz); const ang = Math.atan2(dz, dx);
      const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
      const h0 = floorHeight(world, mx - dz / L * 0.05, mz + dx / L * 0.05); const h1 = floorHeight(world, mx + dz / L * 0.05, mz - dx / L * 0.05);
      const hgt = Math.max(isFinite(h0) ? h0 : -9, isFinite(h1) ? h1 : -9);
      const isBlock = w.kind === 'block';
      const m = new THREE.Mesh(new THREE.BoxGeometry(L + (isBlock ? 0 : WALL_T), WALL_H + 0.7, WALL_T), wallMat); m.position.set(mx, hgt + WALL_H / 2 - 0.35, mz); m.rotation.y = -ang; m.castShadow = true; m.receiveShadow = true; G.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(L + (isBlock ? 0 : WALL_T), 0.05, WALL_T + 0.02), wallTopMat); cap.position.set(mx, hgt + WALL_H + 0.02, mz); cap.rotation.y = -ang; G.add(cap);
    }
    // corner posts where outer walls meet (the classic mini-golf look)
    { const seen = new Set(); const postGeo = new THREE.CylinderGeometry(WALL_T * 0.78, WALL_T * 0.78, WALL_H + 0.06, 12); const capGeo = new THREE.SphereGeometry(WALL_T * 0.8, 12, 8);
      for (const w of world.walls) { if (w.kind !== 'wall') continue; for (const [px, pz] of [[w.ax, w.az], [w.bx, w.bz]]) { const k = px.toFixed(2) + ',' + pz.toFixed(2); if (seen.has(k)) continue; seen.add(k);
        const h0 = floorHeight(world, px + 0.06, pz + 0.06), h1 = floorHeight(world, px - 0.06, pz - 0.06), h2 = floorHeight(world, px + 0.06, pz - 0.06), h3 = floorHeight(world, px - 0.06, pz + 0.06); const hgt = Math.max(...[h0, h1, h2, h3].filter(isFinite), -9);
        const post = new THREE.Mesh(postGeo, wallMat); post.position.set(px, hgt + WALL_H / 2, pz); post.castShadow = true; G.add(post);
        const cap = new THREE.Mesh(capGeo, wallTopMat); cap.position.set(px, hgt + WALL_H + 0.02, pz); G.add(cap); } } }
    // cup + flag
    const cupY = floorHeight(world, world.cupX, world.cupZ);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 32), new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); cup.rotation.x = -Math.PI / 2; cup.position.set(world.cupX, cupY + 0.003, world.cupZ); G.add(cup);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.04, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); rim.rotation.x = -Math.PI / 2; rim.position.set(world.cupX, cupY + 0.004, world.cupZ); G.add(rim);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0xffd54f })); pole.position.set(world.cupX, cupY + 0.65, world.cupZ); pole.castShadow = true; G.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ map: flagTexture(hole.index + 1), side: THREE.DoubleSide })); flag.position.set(world.cupX + 0.25, cupY + 1.15, world.cupZ); G.add(flag); this.animNodes.push({ n: flag, f: (t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; } });
    this.flag = flag; this.pole = pole; this.cupGlow.position.set(world.cupX, cupY + 0.005, world.cupZ);
    // tee marker
    const teeY = floorHeight(world, world.teeX, world.teeZ);
    const tee = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); tee.rotation.x = -Math.PI / 2; tee.position.set(world.teeX, teeY + 0.004, world.teeZ); G.add(tee);

    // obstacles
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.4 }); const bumperTop = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffab91, emissiveIntensity: 0.6 });
    for (const o of hole.obstacles) {
      const cx = (o.x + 0.5) * TILE, cz = (o.z + 0.5) * TILE; const y = floorHeight(world, cx, cz);
      switch (o.type) {
        case 'bumper': { const bx = cx + (o.dx || 0), bz = cz + (o.dz || 0); const r = o.r || 0.3;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.34, 20), bumperMat); m.position.set(bx, y + 0.17, bz); m.castShadow = true; G.add(m); this.hitNodes.set(bx.toFixed(2) + ',' + bz.toFixed(2), { node: m, kind: 'bumper', y: y + 0.17 });
          const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.05, 20), bumperTop); top.position.set(bx, y + 0.36, bz); G.add(top); this.animNodes.push({ n: top, f: (t, node) => { node.material.emissiveIntensity = 0.5 + Math.sin(t * 4 + bx) * 0.3; }, mat: true }); break; }
        case 'windmill': case 'spinner': {
          if (o.type === 'windmill') { // the Meshy windmill tower stands just outside the course beside its blades
            const has = (x, z) => hole.tiles.some(t => t.x === x && t.z === z);
            for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { if (!has(o.x + dx, o.z + dz)) { const wx = (o.x + dx * 1.35 + 0.5) * TILE, wz = (o.z + dz * 1.35 + 0.5) * TILE; this._placeModel(G, 'windmill', wx, -0.9, wz, TILE * 0.95, Math.atan2(cx - wx, cz - wz), K, true); break; } }
          }
          const d = world.dynamics.find(dd => Math.abs(dd.x - cx) < 1e-6 && Math.abs(dd.z - cz) < 1e-6 && dd.type === o.type);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x8d6e63 })); hub.position.set(cx, y + 0.2, cz); G.add(hub);
          const grp = new THREE.Group(); grp.position.set(cx, y + 0.17, cz); G.add(grp);
          const bladeMat = new THREE.MeshStandardMaterial({ color: o.model ? 0x6ab04c : o.type === 'windmill' ? 0xfff176 : 0x4dd0e1, roughness: 0.5 });
          for (let i = 0; i < (d ? d.blades : 2); i++) { const b = new THREE.Mesh(o.model ? new THREE.CylinderGeometry(0.08, 0.18, d ? d.len : TILE, 10) : new THREE.BoxGeometry(d ? d.len : TILE, 0.28, 0.1), bladeMat); if (o.model) b.rotation.z = Math.PI / 2; b.rotation.y = i * Math.PI / (d ? d.blades : 2); b.castShadow = true; grp.add(b); }
          if (o.model) { hub.visible = false; this._placeModel(G, o.model, cx, y, cz, (o.hubR || 0.5) * 5.2, o.rot || 0, K, true); }
          if (d) this.dynamicNodes.push({ node: grp, dyn: d }); break; }
        case 'mover': {
          const d = world.dynamics.find(dd => Math.abs(dd.x - cx) < 1e-6 && Math.abs(dd.z - cz) < 1e-6 && dd.type === 'mover');
          const m = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? d.hw * 2 : d.hd * 2, WALL_H, d.axis === 'x' ? d.hd * 2 : d.hw * 2), new THREE.MeshStandardMaterial({ color: o.model ? 0xffffff : 0x9575cd, emissive: o.model ? 0xff80ab : 0x000000, emissiveIntensity: o.model ? 0.5 : 0, roughness: 0.5, transparent: !!o.model, opacity: o.model ? 0.55 : 1 })); m.position.set(cx, y + WALL_H / 2, cz); m.castShadow = !o.model; G.add(m);
          if (o.model) { const rider = new THREE.Group(); rider.position.set(0, -WALL_H / 2, 0); m.add(rider); loadModel(o.model).then(mm => { const src = mm || fallbackModel(o.model, K.wall); const c = src.clone(); const sz = src.userData.size || new THREE.Vector3(1, 1, 1); const target = Math.max(d.hw, d.hd) * 2.1; c.scale.setScalar(Math.min(target / Math.max(sz.x, sz.z), 1.7 / sz.y)); c.rotation.y = d.axis === 'x' ? Math.PI / 2 : 0; rider.add(c); }); }
          // rail
          const rail = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? d.amp * 2 + d.hw * 2 : 0.08, 0.02, d.axis === 'x' ? 0.08 : d.amp * 2 + d.hw * 2), new THREE.MeshStandardMaterial({ color: 0x333333 })); rail.position.set(cx, y + 0.012, cz); G.add(rail);
          this.dynamicNodes.push({ node: m, dyn: d, baseX: cx, baseZ: cz }); break; }
        case 'block': { /* walls already drawn from world.walls; add a cap decoration */ break; }
        case 'boost': {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.8, TILE * 0.8), new THREE.MeshBasicMaterial({ map: this.arrowTex, transparent: true, color: 0x69f0ae, opacity: 0.9 }));
          p.rotation.x = -Math.PI / 2; p.rotation.z = -Math.atan2(o.dirz, o.dirx); p.position.set(cx, y + 0.005, cz); G.add(p);
          this.animNodes.push({ n: p, f: (t, node) => { node.material.opacity = 0.6 + Math.sin(t * 6) * 0.3; }, mat: true }); break; }
        case 'teleport': case 'portal_exit': {
          const col = o.type === 'teleport' ? 0x40c4ff : 0xff4081;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 32), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })); ring.rotation.x = Math.PI / 2; ring.position.set(cx, y + 0.06, cz); G.add(ring);
          const disc = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 })); disc.rotation.x = -Math.PI / 2; disc.position.set(cx, y + 0.006, cz); G.add(disc);
          this.animNodes.push({ n: ring, f: (t, node) => { node.rotation.z = t * 2; node.position.y = y + 0.08 + Math.sin(t * 3) * 0.03; } }); break; }
        case 'cannon': {
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x455a64 })); base.position.set(cx, y + 0.06, cz); G.add(base);
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4, metalness: 0.4 }));
          barrel.position.set(cx, y + 0.35, cz); barrel.rotation.z = -Math.PI / 4; const holder = new THREE.Group(); holder.position.set(cx, y + 0.12, cz); barrel.position.set(0.2, 0.28, 0); holder.add(barrel); holder.rotation.y = -(o.aim || 0); holder.castShadow = true; G.add(holder);
          const tgt = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); const tx = (o.tx + 0.5) * TILE, tz = (o.tz + 0.5) * TILE; tgt.rotation.x = -Math.PI / 2; tgt.position.set(tx, floorHeight(world, tx, tz) + 0.006, tz); G.add(tgt);
          this.animNodes.push({ n: tgt, f: (t, node) => { const s = 1 + Math.sin(t * 4) * 0.12; node.scale.set(s, s, 1); } }); break; }
        case 'water': {
          const r = (o.r || 0.42) * TILE; const wt = noiseTexture(0x4fc3f7, 40); wt.repeat.set(2, 2); const w = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: wt, color: 0x81d4fa, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 }));
          w.rotation.x = -Math.PI / 2; w.position.set(cx, y + 0.004, cz); G.add(w);
          const lip = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 32), new THREE.MeshBasicMaterial({ color: 0xe0f7fa })); lip.rotation.x = -Math.PI / 2; lip.position.set(cx, y + 0.007, cz); G.add(lip);
          this.animNodes.push({ n: w, f: (t, node) => { node.material.map.offset.set(Math.sin(t * 0.7) * 0.08, t * 0.05); node.material.opacity = 0.8 + Math.sin(t * 2 + cx) * 0.08; }, mat: true }); break; }
        case 'model': { this._placeModel(G, o.model, cx, y, cz, (o.r || 0.5) * 2.1, o.rot || 0, K); break; }
        case 'attractor': {
          const r = o.r || TILE * 2; const well = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.12, depthWrite: false })); well.rotation.x = -Math.PI / 2; well.position.set(cx, y + 0.004, cz); G.add(well);
          for (let k = 1; k <= 3; k++) { const ring = new THREE.Mesh(new THREE.RingGeometry(r * k / 3 - 0.03, r * k / 3, 48), new THREE.MeshBasicMaterial({ color: 0x84ffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, y + 0.005, cz); G.add(ring); this.animNodes.push({ n: ring, f: (t, node) => { const sc = 1 - ((t * 0.35 + k / 3) % 1) * 0.9; node.scale.set(sc, sc, 1); node.material.opacity = 0.1 + sc * 0.35; }, mat: true }); }
          const core = new THREE.Mesh(new THREE.CylinderGeometry(o.core || 0.4, (o.core || 0.4) * 1.1, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0x263238, emissive: 0x00bcd4, emissiveIntensity: 0.6 })); core.position.set(cx, y + 0.12, cz); G.add(core);
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, (o.core || 0.4) * 1.3, 1.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x84ffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(cx, y + 0.95, cz); G.add(beam);
          if (o.model) { const holder = new THREE.Group(); holder.position.set(cx, y + 1.6, cz); G.add(holder); loadModel(o.model).then(mm => { const src = mm || fallbackModel(o.model, K.wall); const c = src.clone(); const sz = src.userData.size || new THREE.Vector3(1, 1, 1); c.scale.setScalar(2.6 / Math.max(sz.x, sz.z)); c.position.y = -sz.y * c.scale.y / 2; holder.add(c); }); this.animNodes.push({ n: holder, f: (t, node) => { node.rotation.y = t * 0.8; node.position.y = y + 1.9 + Math.sin(t * 1.5) * 0.12; } }); }
          break; }
        case 'turntable': {
          const disc = new THREE.Mesh(new THREE.CircleGeometry(TILE * 0.48, 40), new THREE.MeshStandardMaterial({ map: this.discTex, roughness: 0.6 })); disc.rotation.x = -Math.PI / 2; disc.position.set(cx, y + 0.006, cz); G.add(disc);
          const pad = world.pads.find(p => p.type === 'turntable' && Math.abs(p.x - cx) < 1e-6 && Math.abs(p.z - cz) < 1e-6);
          this.animNodes.push({ n: disc, f: (t, node) => { node.rotation.z = -(pad ? pad.omega : 1.6) * t; } }); break; }
        case 'jump': {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.7, 0.05, TILE * 0.7), new THREE.MeshStandardMaterial({ map: this.chevronTex, roughness: 0.5 })); plate.position.set(cx, y + 0.03, cz); plate.rotation.y = -Math.atan2(o.dirz, o.dirx); G.add(plate);
          const lip = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.7, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0xffd600 })); lip.position.set(cx + o.dirx * TILE * 0.36, y + 0.08, cz + o.dirz * TILE * 0.36); lip.rotation.y = -Math.atan2(o.dirz, o.dirx) + Math.PI / 2; G.add(lip);
          const tx = (o.tx + 0.5) * TILE, tz = (o.tz + 0.5) * TILE; const tgt = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xffd600, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); tgt.rotation.x = -Math.PI / 2; tgt.position.set(tx, floorHeight(world, tx, tz) + 0.006, tz); G.add(tgt);
          this.animNodes.push({ n: tgt, f: (t, node) => { const s = 1 + Math.sin(t * 5) * 0.1; node.scale.set(s, s, 1); } });
          this.animNodes.push({ n: plate, f: (t, node) => { node.position.y = y + 0.03 + Math.max(0, Math.sin(t * 3)) * 0.02; } }); break; }
      }
    }
    this._scatter(G, hole, K);
    for (const d of hole.decor || []) { const cx = (d.x + 0.5) * TILE, cz = (d.z + 0.5) * TILE; this._placeModel(G, d.model, cx, -0.9, cz, TILE * 1.1 * (d.scale || 1), d.rot || 0, K, true); }
    // frame the shadow camera on the course
    const b = hole.bounds; const cxm = ((b.minX + b.maxX + 1) / 2) * TILE, czm = ((b.minZ + b.maxZ + 1) / 2) * TILE; const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * TILE + 12;
    this.sun.position.set(cxm + 14, 24, czm + 9); this.sun.target.position.set(cxm, 0, czm);
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -span / 1.6; sc.right = sc.top = span / 1.6; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    this.courseCenter = { x: cxm, z: czm, span };
  }
  _scatter(G, hole, K) {
    let a = (hole.seed * 2654435761 + hole.index * 97) >>> 0; const rng = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const b = hole.bounds; const occupied = new Set(hole.tiles.map(t => t.x + ',' + t.z)); for (const d of hole.decor || []) occupied.add(d.x + ',' + d.z);
    const mats = {
      trunk: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 1 }), leaf: new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 }), leaf2: new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.9 }),
      flower: new THREE.MeshStandardMaterial({ color: 0xffeb3b }), flower2: new THREE.MeshStandardMaterial({ color: 0xff5252 }),
      gum: new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.3 }), gum2: new THREE.MeshStandardMaterial({ color: 0x80d8ff, roughness: 0.3 }), cane: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), caneR: new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.4 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x6d6d6d, roughness: 1 }), fern: new THREE.MeshStandardMaterial({ color: 0x33691e, roughness: 1 }),
      dead: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1 }), stone: new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 }),
      crystal: new THREE.MeshStandardMaterial({ color: 0x40c4ff, emissive: 0x0091ea, emissiveIntensity: 0.8, roughness: 0.2 }), crystal2: new THREE.MeshStandardMaterial({ color: 0xea80fc, emissive: 0xaa00ff, emissiveIntensity: 0.7, roughness: 0.2 }), asteroid: new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 1 }),
    };
    const n = 34;
    for (let i = 0; i < n; i++) {
      const gx = b.minX - 1 - Math.floor(rng() * 5), gxr = b.maxX + 1 + Math.floor(rng() * 5), gz = b.minZ - 1 - Math.floor(rng() * 5), gzr = b.maxZ + 1 + Math.floor(rng() * 5);
      const side = rng(); let tx, tz;
      if (side < 0.25) { tx = gx; tz = b.minZ + Math.floor(rng() * (b.maxZ - b.minZ + 6)) - 3; } else if (side < 0.5) { tx = gxr; tz = b.minZ + Math.floor(rng() * (b.maxZ - b.minZ + 6)) - 3; } else if (side < 0.75) { tz = gz; tx = b.minX + Math.floor(rng() * (b.maxX - b.minX + 6)) - 3; } else { tz = gzr; tx = b.minX + Math.floor(rng() * (b.maxX - b.minX + 6)) - 3; }
      if (occupied.has(tx + ',' + tz)) continue;
      // never adjacent to the course (walls stay readable)
      let near = false; for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) if (occupied.has((tx + ax) + ',' + (tz + az))) near = true; if (near) continue;
      occupied.add(tx + ',' + tz);
      const x = (tx + rng()) * TILE, z = (tz + rng()) * TILE, y = -0.9; const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rng() * 6.28; const sc = 0.7 + rng() * 0.7;
      const add = (geo, mat, py, s = 1) => { const m = new THREE.Mesh(geo, mat); m.position.y = py; m.scale.setScalar(s); m.castShadow = true; g.add(m); return m; };
      const r = rng();
      if (K.id === 'meadow') { if (r < 0.6) { add(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 7), mats.trunk, 0.35); add(new THREE.ConeGeometry(0.75, 1.5, 8), rng() < 0.5 ? mats.leaf : mats.leaf2, 1.3); add(new THREE.ConeGeometry(0.55, 1.1, 8), mats.leaf2, 2.0); } else { for (let k = 0; k < 4; k++) { const f = add(new THREE.SphereGeometry(0.11, 8, 6), rng() < 0.5 ? mats.flower : mats.flower2, 0.12); f.position.x = (rng() - 0.5) * 1.2; f.position.z = (rng() - 0.5) * 1.2; } } }
      else if (K.id === 'candy') { if (r < 0.5) { add(new THREE.SphereGeometry(0.42, 12, 10), rng() < 0.5 ? mats.gum : mats.gum2, 0.36).scale.y = 0.75; } else { add(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), mats.cane, 0.7); for (let k = 0; k < 4; k++) add(new THREE.TorusGeometry(0.085, 0.03, 6, 12), mats.caneR, 0.2 + k * 0.32).rotation.x = Math.PI / 2; add(new THREE.TorusGeometry(0.2, 0.08, 8, 14, Math.PI), mats.cane, 1.4); } }
      else if (K.id === 'dino') { if (r < 0.5) { for (let k = 0; k < 5; k++) { const f = add(new THREE.ConeGeometry(0.16, 0.9, 5), mats.fern, 0.45); f.rotation.z = (rng() - 0.5) * 1.2; f.rotation.y = k * 1.26; f.position.y = 0.3; } } else add(new THREE.DodecahedronGeometry(0.45, 0), mats.rock, 0.3).scale.y = 0.6; }
      else if (K.id === 'castle') { if (r < 0.5) { add(new THREE.CylinderGeometry(0.06, 0.14, 1.6, 6), mats.dead, 0.8); for (let k = 0; k < 3; k++) { const br = add(new THREE.CylinderGeometry(0.03, 0.06, 0.8, 5), mats.dead, 1.3); br.rotation.z = 0.8 + rng() * 0.4; br.rotation.y = k * 2.1; } } else { add(new THREE.BoxGeometry(0.5, 0.7, 0.14), mats.stone, 0.35); add(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12, 1, false, 0, Math.PI), mats.stone, 0.7).rotation.x = Math.PI / 2; } }
      else { if (r < 0.6) { add(new THREE.OctahedronGeometry(0.4, 0), rng() < 0.5 ? mats.crystal : mats.crystal2, 0.45).scale.y = 1.8; } else add(new THREE.DodecahedronGeometry(0.5, 0), mats.asteroid, 0.4); }
      g.scale.setScalar(sc); G.add(g);
    }
  }
  _placeModel(G, name, cx, y, cz, size, rot, K, decor = false) {
    const holder = new THREE.Group(); holder.position.set(cx, y, cz); holder.rotation.y = rot; G.add(holder);
    if (!decor) this.hitNodes.set(cx.toFixed(2) + ',' + cz.toFixed(2), { node: holder, kind: 'model', y });
    const put = (m) => { if (!holder.parent) return; const sz = m.userData.size || new THREE.Vector3(1, 1, 1); const s = size / Math.max(sz.x, sz.z, 0.001); const maxH = decor ? 2.6 : 1.5; let sc = s; if (sz.y * sc > maxH) sc = maxH / sz.y; m.scale.setScalar(sc); holder.add(m); };
    const cached = modelReady.get(name);
    if (cached !== undefined) { if (cached) put(cached.clone()); else put(fallbackModel(name, K.wall)); }
    else loadModel(name).then(m => { if (m) put(m.clone()); else put(fallbackModel(name, K.wall)); });
    if (!decor) { // subtle base ring so the collision proxy reads
      const ring = new THREE.Mesh(new THREE.RingGeometry(size / 2 - 0.06, size / 2, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, y + 0.005, cz); G.add(ring);
    }
  }

  // ---------- per-frame ----------
  update(ball, worldT, dt, aim) {
    const c0 = this.cam; for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz', 'sx', 'sy', 'sz']) if (!Number.isFinite(c0[k])) c0[k] = k === 'dist' ? 7 : k === 'pitch' ? 0.72 : 0;
    if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y) || !Number.isFinite(ball.z)) { ball.x = this.world ? this.world.teeX : 0; ball.z = this.world ? this.world.teeZ : 0; ball.y = 0; }
    // ball transform + rolling
    this.ball.position.set(ball.x, ball.y + BALL_R, ball.z);
    const sp = Math.hypot(ball.vx, ball.vz);
    if (sp > 0.01) { const axis = new THREE.Vector3(ball.vz, 0, -ball.vx).normalize(); this.ball.rotateOnWorldAxis(axis, sp * dt / BALL_R); }
    const fh = floorHeight(this.world, ball.x, ball.z); this.ballShadow.position.set(ball.x, (isFinite(fh) ? fh : ball.y) + 0.006, ball.z); this.ballShadow.visible = ball.y - (isFinite(fh) ? fh : ball.y) > 0.05;
    this.ball.visible = !ball.inCup;
    // skin particles while moving fast
    const sk = this.ballSkin; this.emitT = (this.emitT || 0) + dt;
    if (sk.particle && sp > 2.5 && !ball.inCup && !ball.air && this.emitT > 0.04) { this.emitT = 0;
      if (sk.particle === 'fire') this.burst(ball.x, ball.y + BALL_R, ball.z, 3, [0xff6f00, 0xffca28, 0xd50000], 0.6, -0.35, 0.45);
      else if (sk.particle === 'sparkle') this.burst(ball.x, ball.y + BALL_R, ball.z, 2, [0xffffff, 0xfff176, sk.glow || 0xffffff], 0.9, 0.2, 0.6);
      else if (sk.particle === 'bubbles') this.burst(ball.x, ball.y + BALL_R, ball.z, 2, [0xb2ebf2, 0xffffff], 0.5, -0.6, 0.8);
      else if (sk.particle === 'hearts') this.burst(ball.x, ball.y + BALL_R, ball.z, 1, [0xff4081, 0xf8bbd0], 0.7, -0.3, 0.7); }
    // trail
    if (sp > 4.5 && !ball.inCup) this.trailPts.push({ x: ball.x, y: ball.y + BALL_R, z: ball.z }); else if (this.trailPts.length) this.trailPts.shift();
    while (this.trailPts.length > this.trailMax) this.trailPts.shift();
    for (let i = 0; i < this.trailMax; i++) { const p = this.trailPts[Math.max(0, i - (this.trailMax - this.trailPts.length))] || this.trailPts[0] || { x: ball.x, y: -5, z: ball.z }; this.trailPos[i * 3] = p.x; this.trailPos[i * 3 + 1] = p.y; this.trailPos[i * 3 + 2] = p.z; }
    this.trailGeo.attributes.position.needsUpdate = true; this.trail.visible = this.trailPts.length > 1;
    // dynamics
    for (const n of this.dynamicNodes) {
      if (n.dyn.type === 'mover') { const off = moverOffset(n.dyn, worldT); if (n.dyn.axis === 'x') n.node.position.x = n.baseX + off; else n.node.position.z = n.baseZ + off; }
      else n.node.rotation.y = -bladeAngle(n.dyn, worldT);
    }
    for (const a of this.animNodes) a.f(worldT, a.n);
    for (const a of this.hitAnims) { a.t += dt * 6; const u = Math.min(1, a.t); const k = Math.sin(u * Math.PI); if (a.h.kind === 'bumper') { a.h.node.scale.set(1 + k * 0.35, 1 - k * 0.4, 1 + k * 0.35); a.h.node.position.y = a.h.y - k * 0.07; } else { a.h.node.rotation.z = Math.sin(u * Math.PI * 3) * 0.18 * (1 - u); a.h.node.scale.setScalar(1 + k * 0.08); } }
    this.hitAnims = this.hitAnims.filter(a => a.t < 1);
    for (const sp of this.clouds.children) { sp.position.x += sp.userData.v * dt; if (sp.position.x > 120) sp.position.x = -120; }
    this.moon.position.set(this.camera.position.x - 60, 55, this.camera.position.z - 90);
    if (this.cupGlow.userData.on) { const k = 1 + Math.sin(worldT * 6) * 0.08; this.cupGlow.scale.set(k, k, 1); }
    if (aim && aim.active && aim.power <= 0.02) { this.idlePulse += dt; const k = 1 + Math.max(0, Math.sin(this.idlePulse * 3)) * 0.25; this.arrowRing.scale.set(k, k, 1); } else { this.idlePulse = 0; this.arrowRing.scale.set(1, 1, 1); }
    // putter behind the ball, pulled back with power; swings through on a shot
    if (this.putterSwing) { const sw = this.putterSwing; sw.t += dt * 7; const u = Math.min(1, sw.t); const back = 0.22 + sw.power * 0.4; const off = back * (1 - u) - 0.12 * u;
      this.putter.visible = true; this.putter.position.set(ball.x - Math.cos(this.putterYaw || 0) * off, ball.y, ball.z - Math.sin(this.putterYaw || 0) * off); this.putter.rotation.y = -(this.putterYaw || 0); this.putter.rotation.z = -0.1 - (1 - u) * (0.25 + sw.power * 0.3);
      if (u >= 1) { this.putterSwing = null; this.putter.visible = false; } }
    else if (aim && aim.active) { this.putterYaw = Math.atan2(aim.dz, aim.dx); const back = 0.22 + aim.power * 0.4; this.putter.visible = true; this.putter.position.set(ball.x - aim.dx * back, ball.y, ball.z - aim.dz * back); this.putter.rotation.y = -this.putterYaw; this.putter.rotation.z = -0.1 - aim.power * 0.35; }
    else this.putter.visible = false;
    // aim arrow
    if (aim && aim.active) {
      this.arrow.visible = true; this.arrow.position.set(ball.x, ball.y + 0.02, ball.z); this.arrow.rotation.y = -Math.atan2(aim.dz, aim.dx);
      const L = 0.5 + aim.power * 3.2; this.arrowShaft.scale.x = L; this.arrowShaft.position.x = L / 2 + BALL_R * 1.5; this.arrowHead.position.x = L + BALL_R * 1.5 + 0.12;
      const col = new THREE.Color().setHSL(0.33 - aim.power * 0.33, 0.9, 0.6); this.arrowShaft.material.color.copy(col); this.arrowShaft.visible = this.preview.count === 0; this.arrowHead.visible = this.preview.count === 0; this.preview.material.color.copy(col);
    } else this.arrow.visible = false;
    // particles
    let alive = 0;
    for (const p of this.particles) { p.life -= dt; if (p.life <= 0) continue; p.vy -= 9.8 * dt * p.g; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.4; p.vx *= 0.8; p.vz *= 0.8; }
      this.pPos[alive * 3] = p.x; this.pPos[alive * 3 + 1] = p.y; this.pPos[alive * 3 + 2] = p.z; this.pCol[alive * 3] = p.r; this.pCol[alive * 3 + 1] = p.g2; this.pCol[alive * 3 + 2] = p.b; alive++; if (alive >= this.pMax) break; }
    this.particles = this.particles.filter(p => p.life > 0);
    this.pGeo.setDrawRange(0, alive); this.pGeo.attributes.position.needsUpdate = true; this.pGeo.attributes.color.needsUpdate = true;
    // camera
    const c = this.cam;
    c.sx += (c.tx - c.sx) * Math.min(1, dt * 6); c.sy += (c.ty - c.sy) * Math.min(1, dt * 6); c.sz += (c.tz - c.sz) * Math.min(1, dt * 6);
    const ex = c.sx + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist, ey = c.sy + Math.sin(c.pitch) * c.dist, ez = c.sz + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist;
    this.shake = Math.max(0, this.shake - dt * 1.2); const sh = this.shake * this.shake * 3;
    this.camera.position.set(ex + (Math.random() - 0.5) * sh, Math.max(ey, 0.6) + (Math.random() - 0.5) * sh, ez + (Math.random() - 0.5) * sh); this.camera.lookAt(c.sx, c.sy + 0.2, c.sz);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
  burst(x, y, z, n, colors, speed = 3, g = 1, life = 1.2) {
    for (let i = 0; i < n; i++) { const c = new THREE.Color(colors[i % colors.length]); const a = Math.random() * 6.283, e = Math.random() * 1.2; const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1, vz: Math.sin(a) * Math.cos(e) * s, life: life * (0.6 + Math.random() * 0.6), g, floor: y - 0.05, r: c.r, g2: c.g, b: c.b }); }
  }
  // Camera helpers
  lookAtBall(ball) { const c = this.cam; c.tx = ball.x; c.ty = ball.y; c.tz = ball.z; }
  snapToBall(ball) { const c = this.cam; c.tx = c.sx = ball.x; c.ty = c.sy = ball.y; c.tz = c.sz = ball.z; }
  faceCup(ball, world) { const c = this.cam; c.yaw = Math.atan2(ball.z - world.cupZ, ball.x - world.cupX); }
  worldToScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * this.canvas.clientWidth, y: (1 - v.y) / 2 * this.canvas.clientHeight }; }
  // ray from screen to the ball's floor plane (for drag aiming)
  screenToFloor(px, py, yPlane) {
    const v = new THREE.Vector3((px / this.canvas.clientWidth) * 2 - 1, -(py / this.canvas.clientHeight) * 2 + 1, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize(); const t = (yPlane - this.camera.position.y) / (dir.y || -1e-6);
    if (t < 0) return null; return { x: this.camera.position.x + dir.x * t, z: this.camera.position.z + dir.z * t };
  }
}
