// office.js — cartoon office backdrops + HUD.
import { W, H } from './engine.js';
import { txt, fillR, rrect, IMPACT } from './draw.js';
import { fmtClock, MAX_PATIENCE } from './state.js';

export const HUD_H = 92;

function skyline(ctx, x, y, w, h, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#8ed0ff'); g.addColorStop(1, '#dff3ff');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8;
  for (let i = 0; i < 3; i++) { const cx = x + ((t * 12 + i * 170) % (w + 120)) - 60, cy = y + 30 + i * 22; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 7); ctx.arc(cx + 22, cy - 8, 22, 0, 7); ctx.arc(cx + 46, cy, 16, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  const bs = [[0, 0.55, 60], [70, 0.35, 45], [125, 0.7, 70], [205, 0.45, 55], [270, 0.6, 40], [320, 0.3, 65], [395, 0.5, 50], [455, 0.65, 60], [525, 0.4, 45]];
  for (const [bx, bh, bw] of bs) { const hh = h * bh, by = y + h - hh; ctx.fillStyle = '#9fb3c8'; ctx.fillRect(x + bx, by, bw, hh); ctx.strokeStyle = '#6b7f95'; ctx.lineWidth = 2; ctx.strokeRect(x + bx, by, bw, hh); ctx.fillStyle = '#dbe7f3'; for (let r = by + 10; r < y + h - 10; r += 16) for (let c = x + bx + 8; c < x + bx + bw - 8; c += 14) ctx.fillRect(c, r, 7, 9); }
  ctx.fillStyle = '#5aa856'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(x + i * 70 + 20, y + h + 10, 45, 0, 7); ctx.fill(); }
  ctx.restore();
}

export function drawOffice(ctx, t, variant = 'desk') {
  // wall
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f1ece2'); g.addColorStop(1, '#e2dacb');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (variant === 'hallway') {
    ctx.fillStyle = '#d8d2c6'; ctx.fillRect(0, 0, W, H);
    // perspective floor
    ctx.fillStyle = '#c3b7a3'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W * 0.62, 150); ctx.lineTo(W * 0.38, 150); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a89b86'; ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) { const k = i / 9, y = 150 + (H - 150) * k * k; ctx.beginPath(); ctx.moveTo(W * 0.38 - (W * 0.38) * k * k, y); ctx.lineTo(W * 0.62 + (W * 0.38) * k * k, y); ctx.stroke(); }
    // walls + doors
    ctx.fillStyle = '#e8e1d5'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.38, 150); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.62, 150); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b5e3c';
    for (let i = 0; i < 4; i++) { const k = 0.25 + i * 0.2, xw = W * 0.38 * (1 - k * k) * 0.9, y0 = 150 + (H - 150) * k * k * 0.55, hh = 90 + 220 * k * k; ctx.fillRect(xw - 20 - 40 * k, y0 - hh * 0.4, 30 + 30 * k, hh); ctx.fillRect(W - xw - 10 - 0 * k, y0 - hh * 0.4, 30 + 30 * k, hh); }
    ctx.fillStyle = '#7dd3fc'; ctx.fillRect(W * 0.38, 40, W * 0.24, 110); ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.strokeRect(W * 0.38, 40, W * 0.24, 110);
    txt(ctx, 'EXIT', W / 2, 95, { size: 40, color: '#166534', font: IMPACT, weight: 400 });
    return;
  }
  if (variant === 'cafeteria') { drawBreakRoom(ctx, t); return; }
  if (variant === 'openplan') { drawOpenPlan(ctx, t); return; }
  // desk variant
  ctx.fillStyle = '#c9c1b2'; ctx.fillRect(0, HUD_H + 150, W, 12);
  // window
  fillR(ctx, 60, HUD_H + 20, 600, 300, 8, '#5b6b7c');
  skyline(ctx, 72, HUD_H + 32, 576, 276, t);
  ctx.fillStyle = '#5b6b7c'; ctx.fillRect(356, HUD_H + 20, 14, 300);
  // poster
  fillR(ctx, 900, HUD_H + 30, 240, 190, 6, '#fff', '#222', 5);
  ['FOCUS', 'PLAN', 'EXECUTE'].forEach((s, i) => txt(ctx, s, 1020, HUD_H + 75 + i * 50, { size: 38, color: '#222', font: IMPACT, weight: 400 }));
  // shelf + plant + books
  ctx.fillStyle = '#8b6a44'; ctx.fillRect(760, HUD_H + 300, 460, 14);
  fillR(ctx, 1080, HUD_H + 240, 60, 60, 6, '#9ca3af', '#333');
  ctx.strokeStyle = '#3f9142'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(1110, HUD_H + 245); ctx.lineTo(1110 + i * 22, HUD_H + 190 + Math.abs(i) * 12); ctx.stroke(); }
  [['#1e3a8a', 0], ['#7f1d1d', 26], ['#065f46', 52]].forEach(([c, dx]) => fillR(ctx, 1160 + dx, HUD_H + 230, 22, 70, 2, c, '#222', 2));
  // floor + desk
  ctx.fillStyle = '#c9b48f'; ctx.fillRect(0, 560, W, H - 560);
  const dg = ctx.createLinearGradient(0, 500, 0, 700); dg.addColorStop(0, '#d6a86a'); dg.addColorStop(1, '#b8874a');
  ctx.fillStyle = dg; ctx.fillRect(0, 500, W, 220);
  ctx.fillStyle = '#c69556'; ctx.fillRect(0, 500, W, 12);
  ctx.strokeStyle = '#8a5f2c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 512); ctx.lineTo(W, 512); ctx.stroke();
  // monitor (left of Soung), keyboard, mug, plant, notebook
  fillR(ctx, 40, 300, 260, 200, 10, '#1f2937', '#111', 4); fillR(ctx, 52, 312, 236, 170, 6, '#0ea5e9');
  ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(70, 330 + i * 24, 90 + (i * 37) % 100, 8);
  ctx.fillStyle = '#374151'; ctx.fillRect(150, 500, 40, 24); ctx.fillRect(110, 520, 120, 10);
  fillR(ctx, 480, 530, 220, 34, 6, '#111827', '#000'); ctx.fillStyle = '#374151'; for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) ctx.fillRect(490 + c * 17, 536 + r * 13, 13, 9);
  fillR(ctx, 760, 520, 70, 70, 10, '#fff', '#222', 3); ctx.beginPath(); ctx.arc(842, 555, 18, -1.3, 1.3); ctx.stroke(); ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(795, 528, 28, 6, 0, 0, 7); ctx.fill();
  fillR(ctx, 900, 540, 70, 70, 6, '#a8a29e', '#333'); ctx.strokeStyle = '#3f9142'; ctx.lineWidth = 9; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(935, 545); ctx.lineTo(935 + i * 22, 480 + Math.abs(i) * 15); ctx.stroke(); }
  fillR(ctx, 1010, 590, 200, 60, 6, '#1f2937', '#000'); ctx.fillStyle = '#111'; ctx.fillRect(1040, 612, 120, 8);
}

export function drawHUD(ctx, S, t, muted) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, HUD_H); g.addColorStop(0, '#111827'); g.addColorStop(1, '#1f2937');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HUD_H); ctx.fillStyle = '#ffe600'; ctx.fillRect(0, HUD_H - 4, W, 4);
  // clock
  fillR(ctx, 16, 14, 230, 64, 12, '#0b1220', '#374151', 2);
  txt(ctx, '🕒', 50, 46, { size: 30 });
  txt(ctx, fmtClock(S.clock), 150, 46, { size: 34, color: '#fef3c7', font: "'Courier New', monospace", weight: 700 });
  // grumpy meter
  const gx = 290, gw = 560, gy = 20, gh = 52, k = S.grumpy / 100;
  const pulse = S.grumpy >= 80 ? 1 + Math.sin(t * 14) * 0.03 : 1;
  ctx.save(); ctx.translate(gx + gw / 2, gy + gh / 2); ctx.scale(pulse, pulse); ctx.translate(-(gx + gw / 2), -(gy + gh / 2));
  fillR(ctx, gx, gy, gw, gh, 14, '#0b1220', '#374151', 2);
  if (k > 0) { const mg = ctx.createLinearGradient(gx, 0, gx + gw, 0); mg.addColorStop(0, '#22c55e'); mg.addColorStop(0.5, '#facc15'); mg.addColorStop(1, '#ef4444'); ctx.save(); rrect(ctx, gx + 4, gy + 4, (gw - 8) * k, gh - 8, 10); ctx.clip(); ctx.fillStyle = mg; ctx.fillRect(gx, gy, gw, gh); ctx.restore(); }
  txt(ctx, `GRUMPY: ${Math.round(S.grumpy)}%`, gx + gw / 2, gy + gh / 2 + 1, { size: 30, color: '#fff', stroke: '#111', strokeW: 5 });
  ctx.restore();
  // patience faces
  for (let i = 0; i < MAX_PATIENCE; i++) txt(ctx, i < S.patience ? '😤' : '💀', 885 + i * 40, 46, { size: 30, alpha: i < S.patience ? 1 : 0.5 });
  // score
  fillR(ctx, 1000, 14, 140, 64, 12, '#0b1220', '#374151', 2);
  txt(ctx, 'SOUNG SCORE', 1070, 32, { size: 14, color: '#9ca3af' });
  txt(ctx, String(S.score).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 1070, 56, { size: 26, color: '#ffe600' });
  drawPause(ctx);
  drawMute(ctx, muted);
  ctx.restore();
}
// Touch thumb pads for the left/right games. padDir(p) → -1 | 1 | 0.
export const PADS = [{ x: 100, y: 630, dir: -1, ch: '◀' }, { x: 1180, y: 630, dir: 1, ch: '▶' }];
export function drawPads(ctx) { for (const p of PADS) { ctx.save(); ctx.globalAlpha = 0.45; fillR(ctx, p.x - 62, p.y - 62, 124, 124, 62, '#0b1220', '#ffe600', 3); ctx.globalAlpha = 0.9; txt(ctx, p.ch, p.x, p.y + 2, { size: 44, color: '#ffe600' }); ctx.restore(); } }
export function padDir(p) { for (const q of PADS) if (Math.hypot(p.x - q.x, p.y - q.y) < 70) return q.dir; return 0; }
// pick the hint wording for the input device
export const hint = (engine, mouse, touch) => (engine && engine.touch ? touch : mouse);
export function drawPause(ctx) { fillR(ctx, 1150, 22, 50, 48, 10, '#0b1220', '#374151', 2); txt(ctx, '⏸', 1175, 47, { size: 26, color: '#fff' }); }
export function hitPause(p) { return p.x >= 1150 && p.x <= 1200 && p.y >= 22 && p.y <= 70; }
export function drawMute(ctx, muted) { fillR(ctx, 1208, 22, 56, 48, 10, '#0b1220', '#374151', 2); txt(ctx, muted ? '🔇' : '🔊', 1236, 47, { size: 26 }); }
export function hitMute(p) { return p.x >= 1208 && p.x <= 1264 && p.y >= 22 && p.y <= 70; }


// ---- shared bits ----
function ceilingLights(ctx, y = HUD_H + 18) {
  for (let x = 140; x < W; x += 300) { fillR(ctx, x, y, 200, 14, 7, '#f8fafc', '#cbd5e1', 2); const g = ctx.createLinearGradient(0, y + 14, 0, y + 90); g.addColorStop(0, 'rgba(255,255,240,0.35)'); g.addColorStop(1, 'rgba(255,255,240,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x + 200, y + 14); ctx.lineTo(x + 240, y + 90); ctx.lineTo(x - 40, y + 90); ctx.closePath(); ctx.fill(); }
}
function tileFloor(ctx, y0, a = '#e7dcc4', b = '#d9cbae', size = 64) {
  ctx.fillStyle = a; ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = b; for (let r = 0; r * size < H - y0; r++) for (let c = 0; c * size < W; c++) if ((r + c) % 2) ctx.fillRect(c * size, y0 + r * size, size, size);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 120); g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, 120);
}
function vignette(ctx) { const g = ctx.createRadialGradient(640, 360, 420, 640, 360, 900); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function plant(ctx, x, y, s = 1) {
  fillR(ctx, x - 34 * s, y - 60 * s, 68 * s, 60 * s, 8, '#b45309', '#7c2d12', 2);
  ctx.strokeStyle = '#3f9142'; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x, y - 55 * s); ctx.quadraticCurveTo(x + i * 22 * s, y - 120 * s, x + i * 34 * s, y - 150 * s + Math.abs(i) * 18 * s); ctx.stroke(); }
}

// Break room: serving counter + chalkboard menu on the left, tables in the back, vending machine + fridge on the right.
function drawBreakRoom(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#fbf3e3'); g.addColorStop(1, '#efe2c8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 430);
  // wainscot panel + chair rail
  ctx.fillStyle = '#d8c6a3'; ctx.fillRect(0, 330, W, 100); ctx.fillStyle = '#b89a6b'; ctx.fillRect(0, 326, W, 8);
  ctx.strokeStyle = 'rgba(120,90,50,0.25)'; ctx.lineWidth = 2; for (let x = 40; x < W; x += 80) { ctx.strokeRect(x, 342, 56, 76); }
  ceilingLights(ctx);
  // window with blinds (center-left)
  fillR(ctx, 470, HUD_H + 40, 300, 180, 6, '#8ed0ff', '#5b6b7c', 6); ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 9; i++) ctx.fillRect(476, HUD_H + 50 + i * 19, 288, 8);
  // chalkboard menu
  fillR(ctx, 60, HUD_H + 30, 300, 190, 8, '#1f2a24', '#7c5a2b', 8);
  txt(ctx, "TODAY'S SPECIAL", 210, HUD_H + 70, { size: 22, color: '#fde68a', font: "'Bangers', Impact, sans-serif", weight: 400 });
  ['Mystery Casserole ... $6', 'Sad Desk Salad ....... $9', "Someone's Leftovers .. free"].forEach((s, i) => txt(ctx, s, 210, HUD_H + 110 + i * 32, { size: 17, color: '#e5e7eb', weight: 500, font: "'Courier New', monospace" }));
  // back tables (small, behind)
  for (const x of [560, 760]) { fillR(ctx, x - 70, 300, 140, 14, 6, '#b07c48', '#5b3a1a', 2); ctx.fillStyle = '#8a5f2c'; ctx.fillRect(x - 6, 314, 12, 116); fillR(ctx, x - 100, 330, 30, 60, 4, '#374151', '#111', 2); fillR(ctx, x + 70, 330, 30, 60, 4, '#374151', '#111', 2); }
  // vending machine
  fillR(ctx, 1030, 150, 150, 300, 8, '#1e3a8a', '#0f172a', 4); fillR(ctx, 1044, 165, 100, 200, 4, '#0f172a', '#334155', 2);
  const snacks = ['#f97316', '#facc15', '#22c55e', '#ec4899', '#38bdf8', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#f43f5e', '#84cc16', '#fb923c'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { fillR(ctx, 1052 + c * 30, 172 + r * 48, 22, 34, 3, snacks[r * 3 + c], '#111', 1); ctx.fillStyle = '#94a3b8'; ctx.fillRect(1046, 210 + r * 48, 96, 2); }
  fillR(ctx, 1150, 170, 22, 120, 4, '#334155', '#0f172a', 2); ctx.fillStyle = '#22c55e'; ctx.fillRect(1156, 180, 10, 6); fillR(ctx, 1044, 380, 100, 44, 6, '#111827', '#334155', 2);
  txt(ctx, 'SNACKS', 1105, 440, { size: 12, color: '#93c5fd' });
  // fridge
  fillR(ctx, 1200, 150, 70, 300, 8, '#e5e7eb', '#333', 3); ctx.fillStyle = '#9ca3af'; ctx.fillRect(1200, 280, 70, 4); ctx.fillRect(1256, 180, 6, 80); ctx.fillRect(1256, 300, 6, 120);
  fillR(ctx, 1208, 200, 40, 30, 3, '#fde68a', '#d97706', 1); txt(ctx, 'NOT YOURS', 1228, 215, { size: 7, color: '#7c2d12' });
  // coffee station
  fillR(ctx, 400, 330, 60, 100, 4, '#111827', '#000', 2); fillR(ctx, 410, 345, 40, 30, 3, '#ef4444'); txt(ctx, '☕', 430, 400, { size: 22 });
  plant(ctx, 980, 430, 0.9);
  tileFloor(ctx, 430);
  vignette(ctx);
}

// Open-plan office: wall with a window band, ceiling lights, carpet — cubicles are drawn by the mini-game.
function drawOpenPlan(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#eef0f4'); g.addColorStop(1, '#dfe3ea'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 600);
  ceilingLights(ctx);
  fillR(ctx, 60, HUD_H + 40, 1160, 130, 6, '#5b6b7c'); skyline(ctx, 68, HUD_H + 48, 1144, 114, t);
  for (let x = 60 + 290; x < 1220; x += 290) { ctx.fillStyle = '#5b6b7c'; ctx.fillRect(x - 6, HUD_H + 40, 12, 130); }
  ctx.fillStyle = '#c4c9d2'; ctx.fillRect(0, 590, W, 10);
  // carpet
  ctx.fillStyle = '#9aa3b2'; ctx.fillRect(0, 600, W, H - 600); ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 0; x < W; x += 40) for (let y = 600; y < H; y += 40) if (((x + y) / 40) % 2) ctx.fillRect(x, y, 40, 40);
  vignette(ctx);
}
