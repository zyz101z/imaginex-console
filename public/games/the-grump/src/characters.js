// characters.js — Soung + Pat renderers. Heads are PNG sprites (see ASSETS.md);
// bodies are drawn procedurally so the art can be swapped without touching gameplay.
// Expressions are overlays positioned by the eye/mouth anchors in SPRITES. If a
// per-mood file exists (e.g. assets/soung_angry.png) it is used INSTEAD of overlays.
import { txt } from './draw.js';

export const SPRITES = {
  // Meshy image-to-image heads (nano-banana-pro, reference = D:\DontBeSoung portraits), green-keyed,
  // normalized to 400x520 with the chin/neck at the bottom. Overlays only run for moods with no file.
  soung: { file: 'assets/soung_annoyed.png', w: 400, h: 520, eyes: [[140, 250], [260, 250]], mouth: [200, 380], eyeR: 24, skin: '#e6b28a',
    moods: { annoyed: 'assets/soung_annoyed.png', angry: 'assets/soung_angry.png', rage: 'assets/soung_rage.png', eyeroll: 'assets/soung_eyeroll.png', deadpan: 'assets/soung_deadpan.png', smirk: 'assets/soung_smirk.png', cool: 'assets/soung_cool.png', shocked: 'assets/soung_shocked.png' },
    // full-body poses (520x800, feet at bottom). The mood head is drawn OVER the pose's own head:
    // `neck` = the shirt collar opening in sprite px (x center, top edge y, width at the top, V-notch y);
    // `faceW` = how wide the FACE should draw in sprite px (≈ shoulder width → cartoon proportions like Pat).
    // The head sprite's chin sits 26 px above `neck.top`; its own (long) neck is clipped to the collar opening.
    bodies: { stand: { file: 'assets/soung_body_stand.png', neck: { x: 243, top: 240, w: 76, v: 285 }, faceW: 200 },
              walk:  { file: 'assets/soung_body_walk.png',  neck: { x: 252, top: 236, w: 96, v: 300 }, faceW: 200 },
              rage:  { file: 'assets/soung_body_rage.png',  neck: { x: 275, top: 250, w: 110, v: 320 }, faceW: 215 } } },
  pat:   { file: 'assets/pat_happy.png', w: 400, h: 520, eyes: [[140, 250], [260, 250]], mouth: [200, 390], eyeR: 22, skin: '#f0c3a0',
    moods: { happy: 'assets/pat_happy.png', excited: 'assets/pat_excited.png' }, bodies: { stand: { file: 'assets/pat_body.png' } } },
};
// To add a mood: drop assets/<name>_<mood>.png (400x520, transparent) and list it in moods.
// Head-sprite geometry (measured on the 400x520 heads): chin row / height, face width / sprite width.
const HEAD_CHIN = 0.72, HEAD_FACE = 0.67;

const images = {};
export function loadSprites(base = '') {
  if (typeof Image === 'undefined') return Promise.resolve();
  const jobs = [];
  for (const [k, s] of Object.entries(SPRITES)) {
    const files = { base: s.file, ...s.moods };
    for (const [pose, b] of Object.entries(s.bodies || {})) files['body_' + pose] = b.file;
    for (const [mood, file] of Object.entries(files)) {
      jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { images[k + ':' + mood] = im; res(); }; im.onerror = () => res(); im.src = base + file; }));
    }
  }
  return Promise.all(jobs);
}
export function spriteReady(k) { return !!images[k + ':base']; }

// Draw a head: (cx, cy) = head center, hw = drawn head width.
function drawHead(ctx, key, cx, cy, hw, mood, opts = {}) {
  const s = SPRITES[key];
  const im = images[key + ':' + mood] || images[key + ':base'];
  const iw = im ? (im.naturalWidth || im.width || s.w) : s.w, ih = im ? (im.naturalHeight || im.height || s.h) : s.h;
  const k = hw / iw, hh = ih * k;
  const custom = !!images[key + ':' + mood];
  ctx.save();
  if (opts.tilt) { ctx.translate(cx, cy); ctx.rotate(opts.tilt); ctx.translate(-cx, -cy); }
  if (im) ctx.drawImage(im, cx - hw / 2, cy - hh / 2, hw, hh);
  else { // placeholder head
    ctx.fillStyle = s.skin; ctx.beginPath(); ctx.ellipse(cx, cy, hw / 2, hh / 2, 0, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#222'; ctx.stroke();
    txt(ctx, key.toUpperCase(), cx, cy + hh * 0.35, { size: hw * 0.16, color: '#222' });
  }
  if (opts.tint) { ctx.globalAlpha = opts.tintA ?? 0.35; ctx.fillStyle = opts.tint; ctx.beginPath(); ctx.ellipse(cx, cy, hw / 2 - 2, hh / 2 - 2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  if (!custom) drawExpression(ctx, s, cx - hw / 2, cy - hh / 2, k, mood, opts);
  ctx.restore();
  return { hh };
}

function drawExpression(ctx, s, ox, oy, k, mood, opts) {
  const E = s.eyes.map(([x, y]) => [ox + x * k, oy + y * k]);
  const M = [ox + s.mouth[0] * k, oy + s.mouth[1] * k];
  const r = s.eyeR * k;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1a0f'; ctx.lineWidth = Math.max(3, 9 * k);
  const brow = (angleL, lift) => { // angleL: inner-end drop (angry) in px per eye-radius
    E.forEach(([x, y], i) => {
      const dir = i === 0 ? 1 : -1; // inner side toward center
      const y0 = y - r * 1.7 - lift * r;
      ctx.beginPath(); ctx.moveTo(x - dir * r * 1.4, y0 - angleL * r * 0.2); ctx.lineTo(x + dir * r * 1.2, y0 + angleL * r); ctx.stroke();
    });
  };
  // Mouth is left as drawn in the sprite — expressions come from brows/eyes only.
  // (A painted-over mouth looked wrong; per-mood head PNGs are the right upgrade, see ASSETS.md.)
  const flatMouth = () => {};
  const eyeballs = (px, py) => E.forEach(([x, y]) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 0.85, 0, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#2a1a0f'; ctx.beginPath(); ctx.arc(x + px * r, y + py * r, r * 0.42, 0, 7); ctx.fill(); });
  const lids = (amt) => E.forEach(([x, y]) => { ctx.fillStyle = s.skin; ctx.beginPath(); ctx.ellipse(x, y - r * 0.9 + amt * r, r * 1.35, r * 0.75, 0, 0, 7); ctx.fill(); ctx.lineWidth = Math.max(2, 5 * k); ctx.beginPath(); ctx.moveTo(x - r * 1.2, y - r * 0.2 + amt * r * 0.6); ctx.lineTo(x + r * 1.2, y - r * 0.2 + amt * r * 0.6); ctx.stroke(); });
  switch (mood) {
    case 'annoyed': brow(0.45, 0); flatMouth(0); break;
    case 'angry': brow(0.9, -0.1); flatMouth(-1.4); break;
    case 'rage': brow(1.2, -0.2); flatMouth(-2); ctx.fillStyle = '#ff2d2d'; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(E[0][0] - r * 2.2, E[0][1] + r * 2, r, 0, 7); ctx.arc(E[1][0] + r * 2.2, E[1][1] + r * 2, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'eyeroll': eyeballs(0.2, -0.55); brow(0.1, 0.35); flatMouth(0.4); break;
    case 'deadpan': lids(0.45); brow(0.1, -0.1); flatMouth(0); break;
    case 'cool': E.forEach(([x, y]) => { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 1.15, 0, 0, 7); ctx.fill(); }); ctx.lineWidth = Math.max(3, 6 * k); ctx.beginPath(); ctx.moveTo(E[0][0] + r * 1.4, E[0][1]); ctx.lineTo(E[1][0] - r * 1.4, E[1][1]); ctx.stroke(); break;
    case 'smirk': brow(0.2, 0.2); break;  // keeps the source smile
    case 'happy': break;
    case 'excited': brow(-0.3, 0.6); break;
    case 'shocked': eyeballs(0, 0); brow(-0.4, 0.8); break;
    default: brow(0.45, 0); flatMouth(0);
  }
}

// --- Soung: light-blue button-up, dark slacks. (x, y) = feet center, s = scale (1 = ~330px tall standing).
// Draw a one-piece body sprite with feet at (x, y) and the mood head over its head. Shared by both characters.
function drawFigure(ctx, key, pose, x, y, s, mood, o) {
  const S = SPRITES[key], P = S.bodies[pose], body = images[key + ':body_' + pose];
  const t = o.t || 0, H = 372 * s, scale = H / body.naturalHeight, Wd = body.naturalWidth * scale;
  const bob = o.walk ? Math.abs(Math.sin(t * 12)) * 6 * s : (o.bob || key === 'pat' ? Math.sin(t * (key === 'pat' ? 3 : 2.2)) * 2.5 * s : 0);
  const lean = (o.walk ? Math.sin(t * 12) * 0.05 : key === 'pat' ? Math.sin(t * 3) * 0.015 : 0) + (o.tilt || 0);
  ctx.save();
  if (o.seated) { ctx.beginPath(); ctx.rect(x - 600, -2000, 1200, 2000 + (o.deskY ?? 502)); ctx.clip(); }   // behind the desk: nothing below the desk edge
  else { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 62 * s, 12 * s, 0, 0, 7); ctx.fill(); }
  ctx.translate(x, y - bob); ctx.rotate(lean);
  ctx.drawImage(body, -Wd / 2, -H, Wd, H);
  let headX = x, headY = y - H * 0.8 - bob, headW = 140 * s;
  if (P.neck) { // overlay the expression head: face sized to the shoulders, chin on the collar, neck clipped into the collar opening
    const im = images[key + ':' + mood] || images[key + ':base'];
    if (im) {
      const N = P.neck, hwid = (P.faceW / HEAD_FACE) * scale, hh = hwid * im.naturalHeight / im.naturalWidth;
      const nx = (N.x - body.naturalWidth / 2) * scale, top = -H + N.top * scale, v = -H + N.v * scale, half = N.w / 2 * scale;
      const hy = top - 26 * scale - HEAD_CHIN * hh;   // chin 26 sprite-px above the collar = a visible bit of neck
      ctx.save(); ctx.beginPath();
      ctx.rect(nx - hwid, hy - 20, hwid * 2, top + 2 * scale - hy + 20);          // everything above the collar…
      ctx.moveTo(nx - half, top); ctx.lineTo(nx + half, top); ctx.lineTo(nx, v); ctx.closePath(); // …plus the collar's V opening
      ctx.clip();
      ctx.drawImage(im, nx - hwid / 2, hy, hwid, hh);
      ctx.restore();
      headX = x + nx; headY = y - bob + hy + hh * 0.36; headW = hwid;
    }
  }
  ctx.restore();
  if (o.sweat) { ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.ellipse(headX + headW * 0.5, headY - headW * 0.1 + ((t * 40) % 30), 6 * s, 10 * s, 0, 0, 7); ctx.fill(); }
  if (mood === 'rage' || o.steam) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4 * s; for (let i = 0; i < 3; i++) { const ph = (t * 3 + i) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(headX - 40 * s + i * 40 * s, headY - headW * 0.75 - ph * 40 * s, 10 * s, 0, 7); ctx.stroke(); } ctx.restore(); }
  return { headX, headY, headW, top: y - H - bob };
}

export function drawSoung(ctx, x, y, s = 1, o = {}) {
  const mood = o.mood || 'annoyed', t = o.t || 0, hw = 118 * s;
  const pose = o.arms === 'up' ? 'rage' : o.walk ? 'walk' : 'stand';
  if (images['soung:body_' + pose]) return drawFigure(ctx, 'soung', pose, x, y, s, mood === 'annoyed' && pose === 'rage' ? 'rage' : mood, o);
  const bob = o.walk ? Math.sin(t * 12) * 4 * s : (o.bob ? Math.sin(t * 2.2) * 2.5 * s : 0);
  const bodyTop = y - 205 * s + bob, cx = x;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 12 * s, 0, 0, 7); ctx.fill();
  if (!o.seated) {
    // legs
    const step = o.walk ? Math.sin(t * 12) * 14 * s : 0;
    ctx.fillStyle = '#2b3245'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    [[-1, step], [1, -step]].forEach(([d, st]) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx + d * 12 * s - 15 * s, y - 95 * s, 30 * s, 92 * s, 8) : ctx.rect(cx + d * 12 * s - 15 * s, y - 95 * s, 30 * s, 92 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(cx + d * 12 * s + st * 0.5, y - 2 * s, 24 * s, 9 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2b3245'; });
  }
  // torso (shirt)
  ctx.fillStyle = o.shirt || '#bcd3f0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 62 * s, bodyTop); ctx.lineTo(cx + 62 * s, bodyTop); ctx.lineTo(cx + 55 * s, bodyTop + 120 * s); ctx.lineTo(cx - 55 * s, bodyTop + 120 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // collar + buttons
  ctx.beginPath(); ctx.moveTo(cx - 22 * s, bodyTop); ctx.lineTo(cx, bodyTop + 22 * s); ctx.lineTo(cx + 22 * s, bodyTop); ctx.stroke();
  ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, bodyTop + 40 * s + i * 26 * s, 3.5 * s, 0, 7); ctx.fill(); }
  // arms
  const armL = o.arms || 'down';
  ctx.fillStyle = o.shirt || '#bcd3f0';
  const arm = (dir, ang) => { ctx.save(); ctx.translate(cx + dir * 58 * s, bodyTop + 14 * s); ctx.rotate(dir * ang); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-13 * s, 0, 26 * s, 92 * s, 10) : ctx.rect(-13 * s, 0, 26 * s, 92 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = SPRITES.soung.skin; ctx.beginPath(); ctx.arc(0, 96 * s, 14 * s, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.fillStyle = o.shirt || '#bcd3f0'; };
  if (armL === 'up') { arm(-1, 2.6); arm(1, 2.6); }
  else if (armL === 'cross') { arm(-1, 1.3); arm(1, 1.3); }
  else if (armL === 'typing') { arm(-1, 1.9); arm(1, 1.9); }
  else if (armL === 'walk') { const a = Math.sin(t * 12) * 0.5; arm(-1, 0.15 + a); arm(1, 0.15 - a); }
  else { arm(-1, 0.12); arm(1, 0.12); }
  // head
  const headCy = bodyTop - 84 * s;
  drawHead(ctx, 'soung', cx, headCy, hw, mood, { tilt: o.tilt || 0, tint: o.tint, tintA: o.tintA });
  // sweat drop / steam
  if (o.sweat) { ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.ellipse(cx + hw * 0.55, headCy - hw * 0.1 + ((t * 40) % 30), 6 * s, 10 * s, 0, 0, 7); ctx.fill(); }
  if (mood === 'rage' || o.steam) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4 * s; for (let i = 0; i < 3; i++) { const ph = (t * 3 + i) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(cx - 40 * s + i * 40 * s, headCy - hw * 0.75 - ph * 40 * s, 10 * s, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1; }
  ctx.restore();
  return { headX: cx, headY: headCy, headW: hw, top: headCy - hw * 0.66 };
}

// --- Pat: white tee, always delighted. Same contract as drawSoung.
export function drawPat(ctx, x, y, s = 1, o = {}) {
  const mood = o.mood || 'happy', t = o.t || 0, hw = 122 * s;
  if (images['pat:body_stand']) return drawFigure(ctx, 'pat', 'stand', x, y, s, mood, o);
  const bob = o.walk ? Math.sin(t * 12) * 4 * s : Math.sin(t * 3) * 3 * s;
  const bodyTop = y - 210 * s + bob, cx = x;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 64 * s, 12 * s, 0, 0, 7); ctx.fill();
  if (!o.seated) {
    const step = o.walk ? Math.sin(t * 12) * 14 * s : 0;
    ctx.fillStyle = '#4a5568'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    [[-1, step], [1, -step]].forEach(([d, st]) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx + d * 13 * s - 16 * s, y - 98 * s, 32 * s, 95 * s, 8) : ctx.rect(cx + d * 13 * s - 16 * s, y - 98 * s, 32 * s, 95 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.ellipse(cx + d * 13 * s + st * 0.5, y - 2 * s, 25 * s, 9 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4a5568'; });
  }
  ctx.fillStyle = '#f7f7f7'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 70 * s, bodyTop); ctx.lineTo(cx + 70 * s, bodyTop); ctx.lineTo(cx + 60 * s, bodyTop + 122 * s); ctx.lineTo(cx - 60 * s, bodyTop + 122 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, bodyTop + 2 * s, 20 * s, 0.1, Math.PI - 0.1); ctx.stroke();
  const arm = (dir, ang) => { ctx.save(); ctx.translate(cx + dir * 66 * s, bodyTop + 12 * s); ctx.rotate(dir * ang); ctx.fillStyle = '#f7f7f7'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-15 * s, 0, 30 * s, 30 * s, 8) : ctx.rect(-15 * s, 0, 30 * s, 30 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = SPRITES.pat.skin; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-13 * s, 28 * s, 26 * s, 62 * s, 10) : ctx.rect(-13 * s, 28 * s, 26 * s, 62 * s); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 96 * s, 15 * s, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); };
  const a = o.arms || 'wave';
  if (a === 'wave') { arm(-1, 0.15); arm(1, 2.9 + Math.sin(t * 10) * 0.25); }
  else if (a === 'walk') { const w = Math.sin(t * 12) * 0.5; arm(-1, 0.15 + w); arm(1, 0.15 - w); }
  else if (a === 'point') { arm(-1, 0.15); arm(1, 1.6); }
  else if (a === 'both') { arm(-1, 2.7); arm(1, 2.7); }
  else { arm(-1, 0.15); arm(1, 0.15); }
  const headCy = bodyTop - 82 * s;
  drawHead(ctx, 'pat', cx, headCy, hw, mood, { tilt: o.tilt || Math.sin(t * 3) * 0.04 });
  ctx.restore();
  return { headX: cx, headY: headCy, headW: hw, top: headCy - hw * 0.66 };
}

// Just a head (intro close-ups etc). (cx, cy) = center, hw = drawn width.
export function drawHeadOnly(ctx, key, cx, cy, hw, mood, opts = {}) { return drawHead(ctx, key, cx, cy, hw, mood, opts); }

// Small circular head icon (Slack avatar style). Falls back to a colored circle if the sprite is missing.
export function drawHeadIcon(ctx, key, cx, cy, size, mood = 'happy') {
  const im = images[key + ':' + mood] || images[key + ':base'];
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, 7); ctx.closePath(); ctx.fillStyle = '#e5e7eb'; ctx.fill(); ctx.clip();
  if (im) { const k = size / im.naturalWidth * 1.15, w = im.naturalWidth * k, h = im.naturalHeight * k; ctx.drawImage(im, cx - w / 2, cy - h * 0.42, w, h); }
  else { ctx.fillStyle = SPRITES[key].skin; ctx.fillRect(cx - size, cy - size, size * 2, size * 2); }
  ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
}

// Generic coworker (hallway extras) — procedural, no sprite.
export function drawCoworker(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, c = o.color || '#f59e0b';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x, y, 40 * s, 8 * s, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.fillStyle = '#374151'; ctx.fillRect(x - 22 * s, y - 70 * s, 18 * s, 68 * s); ctx.fillRect(x + 4 * s, y - 70 * s, 18 * s, 68 * s);
  ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 40 * s, y - 160 * s, 80 * s, 95 * s, 12) : ctx.rect(x - 40 * s, y - 160 * s, 80 * s, 95 * s); ctx.fill(); ctx.stroke();
  const hb = Math.sin(t * 12) * 3 * s;
  ctx.fillStyle = o.skin || '#f1c27d'; ctx.beginPath(); ctx.arc(x, y - 200 * s + hb, 38 * s, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.hair || '#3b2314'; ctx.beginPath(); ctx.arc(x, y - 212 * s + hb, 36 * s, Math.PI, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x - 12 * s, y - 202 * s + hb, 4 * s, 0, 7); ctx.arc(x + 12 * s, y - 202 * s + hb, 4 * s, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 190 * s + hb, 14 * s, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

// Test hook: inject fake image objects so the sprite code paths run headless.
export function _injectSpriteForTest(key, img) { images[key] = img; }
