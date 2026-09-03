// HIDE AND SEEK — Pat is sweeping the dark office with a flashlight. Soung has to get his stuff back from the desks
// (headphones, coffee, RKTs...) without being lit up. Classic stealth loop: wait behind cover for the beam to pass,
// dash out to grab the item, get back behind cover before the beam comes around.
// Rebuilt 2026-09-02 (user: "doesn't work well") — the old version was a sine sweep that sped up forever, a 0.32 s
// spot timer and covers yanked every 1.5 s, with nothing to do but stand still. Now: constant-speed beam with pauses
// at each end (predictable), a 0.5 s spot timer with a visible meter over SOUNG, items to collect, and rarer
// cover-stealing with a long warning.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick, clamp } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice, HUD_H, drawPads, padDir, hint } from '../office.js';
import { drawSoung, drawPat, drawCoworker } from '../characters.js';
import { SCORE, GRUMPY, PAT_QUOTES, coworkerName } from '../state.js';

const COVERS = [{ x: 230, kind: 'plant' }, { x: 520, kind: 'cabinet' }, { x: 800, kind: 'cooler' }, { x: 1080, kind: 'plant' }];
const GAPS = [375, 660, 940];   // desks between the covers where the items show up
const ITEMS = [{ icon: '🎧', name: 'HEADPHONES' }, { icon: '☕', name: 'COFFEE' }, { icon: '🍚', name: 'RKTs' }, { icon: '📓', name: 'NOTEBOOK' }, { icon: '🔌', name: 'CHARGER' }];
const BEAM_HALF = 95, SPOT_TIME = 0.5, COVER_R = 60;

class HideAndSeek extends MiniGame {
  constructor(api, def) {
    super(api, def); this.dur = 11; this.x = 520; this.targetX = null; this.caught = 0; this.hurtT = 0; this.safeT = 0.8; this.suspicion = 0;
    this.covers = COVERS.map(c => ({ ...c, blown: 0, warn: 0, guy: pick(['#f59e0b', '#8b5cf6', '#06b6d4']) })); this.blowT = 3.0;
    // beam: constant speed, bounces at the ends with a short pause (predictable timing)
    this.patX = 120; this.beamDir = 1; this.beamPause = 0.4; this.beamSpeed = 300 * Math.pow(this.diff, 0.6);
    this.item = null; this.itemT = 0.6; this.got = 0; this.usedGaps = []; this.pool = [...ITEMS].sort(() => Math.random() - 0.5);
  }
  spawnItem() {
    const free = GAPS.filter(x => !this.usedGaps.slice(-1).includes(x)); const x = pick(free); this.usedGaps.push(x);
    this.item = { ...this.pool[this.got % this.pool.length], x, t: 0 };
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt); this.safeT = Math.max(0, this.safeT - dt);
    if (!this.said && this.t > 0.3) { this.said = true; this.api.say('wherego'); }
    // movement (keys / pads / drag-tap)
    const k = this.api.engine.keys; let dir = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) dir -= 1; if (k.has('ArrowRight') || k.has('KeyD')) dir += 1;
    if (this.padDir) dir = this.padDir;
    if (dir) { this.x += dir * 620 * dt; this.targetX = null; } else if (this.targetX != null) { const d = this.targetX - this.x; this.x += clamp(d, -620 * dt, 620 * dt); }
    this.x = clamp(this.x, 110, 1170);
    // beam
    if (this.beamPause > 0) this.beamPause -= dt;
    else { this.patX += this.beamDir * this.beamSpeed * dt; if (this.patX >= 1160) { this.patX = 1160; this.beamDir = -1; this.beamPause = 0.45; } else if (this.patX <= 120) { this.patX = 120; this.beamDir = 1; this.beamPause = 0.45; } }
    // items to collect
    if (!this.item) { this.itemT -= dt; if (this.itemT <= 0) { this.spawnItem(); this.api.sfx('pop'); } }
    else { this.item.t += dt; if (Math.abs(this.x - this.item.x) < 46) { this.got++; this.api.score(150, `${this.item.icon} +150`, this.item.x, 470); this.api.sfx('good'); this.api.particles.emit(this.item.x, 500, { n: 8, colors: ['#ffe600', '#fff'], shape: 'circle' }); this.item = null; this.itemT = 0.5; } }
    // a coworker occasionally parks in front of a cover (long warning, never the one you're in, never more than one)
    for (const c of this.covers) { c.blown = Math.max(0, c.blown - dt); if (c.warn > 0) { c.warn -= dt; if (c.warn <= 0) c.blown = rand(2.0, 2.8); } }
    this.blowT -= dt;
    if (this.blowT <= 0) { const active = this.covers.filter(c => c.blown <= 0 && c.warn <= 0 && Math.abs(this.x - c.x) > COVER_R); if (!this.covers.some(c => c.blown > 0 || c.warn > 0) && active.length) { const c = pick(active); c.warn = 1.0; c.who = coworkerName(); } this.blowT = rand(2.6, 3.6) / Math.sqrt(this.diff); }
    // detection: the beam has to LINGER on him — the meter fills over Soung's head
    const inCover = this.inCover, inBeam = Math.abs(this.x - this.patX) < BEAM_HALF;
    this.suspicion = inBeam && !inCover && this.safeT <= 0 ? this.suspicion + dt : Math.max(0, this.suspicion - dt * 3);
    const hiddenInBeam = inBeam && inCover; if (hiddenInBeam && !this.wasHiddenInBeam) { this.api.score(50, pick(['not today +50', 'nope +50', 'nice try +50']), this.x, 420); this.api.sfx('tick'); } this.wasHiddenInBeam = hiddenInBeam;
    if (this.suspicion >= SPOT_TIME) {
      this.suspicion = 0; this.caught++; this.hurtT = 0.6; this.safeT = 1.6; this.api.grumpy(GRUMPY.QUICK_QUESTION, 'SPOTTED'); this.api.shake(8, 0.25); this.api.say('foundyou'); this.api.flash('#fff', 0.15);
      this.api.particles.text(PAT_QUOTES.foundyou.text, this.x, 380, { impact: true, size: 60, color: '#ff6b6b' });
    }
    if (this.t >= this.dur) {
      const sub = `${this.got} item${this.got === 1 ? '' : 's'} recovered`;
      if (this.caught === 0) { this.api.score(SCORE.PAT_AVOIDED, '+500', 640, 300); this.api.S.stats.patAvoided++; this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'NEVER FOUND', { sub: sub + '. Pat gave up and asked someone else.', pat: 'wherego' }); }
      else if (this.caught === 1 && this.got >= 2) { this.api.score(200, '+200', 640, 300); this.mood = 'smirk'; this.finish(true, 'MOSTLY HIDDEN', { sub: sub + '. Spotted once. Deniable.' }); }
      else this.finish(false, `SPOTTED ${this.caught}×`, { sub: sub + '. "Oh THERE you are. Quick question."' });
    }
  }
  get inCover() { return this.covers.some(c => c.blown <= 0 && Math.abs(this.x - c.x) < COVER_R); }
  pointerDown(p) { const d = this.api.engine.touch ? padDir(p) : 0; if (d) { this.padDir = d; return; } this.targetX = p.x; }
  pointerMove(p) { if (this.padDir) return; if (this.api.engine.pointer.down) this.targetX = p.x; }
  pointerUp() { this.padDir = 0; }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    ctx.fillStyle = 'rgba(10,12,40,0.62)'; ctx.fillRect(0, 0, W, H);
    // back counter where Pat walks + the desks the items sit on
    fillR(ctx, 0, 400, W, 60, 0, '#6b4f2a', '#3b2a14', 3); ctx.fillStyle = '#8a6a3c'; ctx.fillRect(0, 400, W, 10);
    for (const gx of GAPS) { fillR(ctx, gx - 70, 560, 140, 26, 4, '#b8874a', '#5b3a1a', 2); ctx.fillStyle = '#8a5f2c'; ctx.fillRect(gx - 60, 586, 12, 100); ctx.fillRect(gx + 48, 586, 12, 100); }
    drawPat(ctx, this.patX, 440, 0.62, { t: this.t, walk: this.beamPause <= 0, arms: 'point' });
    // the beam: a hard-edged band on the floor that matches the hit test exactly
    const g = ctx.createLinearGradient(0, 330, 0, H); g.addColorStop(0, 'rgba(255,240,150,0.05)'); g.addColorStop(0.3, 'rgba(255,240,150,0.55)'); g.addColorStop(1, 'rgba(255,240,150,0.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(this.patX - 14, 330); ctx.lineTo(this.patX + 14, 330); ctx.lineTo(this.patX + BEAM_HALF, 560); ctx.lineTo(this.patX + BEAM_HALF, H); ctx.lineTo(this.patX - BEAM_HALF, H); ctx.lineTo(this.patX - BEAM_HALF, 560); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,150,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.patX - BEAM_HALF, 560); ctx.lineTo(this.patX - BEAM_HALF, H); ctx.moveTo(this.patX + BEAM_HALF, 560); ctx.lineTo(this.patX + BEAM_HALF, H); ctx.stroke();
    txt(ctx, '🔦', this.patX + 30, 350, { size: 26 });
    // item on a desk
    if (this.item) { const b = Math.sin(this.item.t * 6) * 4; txt(ctx, this.item.icon, this.item.x, 530 + b, { size: 40 }); fillR(ctx, this.item.x - 60, 480 + b, 120, 26, 8, '#ffe600', '#111', 2); txt(ctx, 'GRAB ' + this.item.name, this.item.x, 493 + b, { size: 13, color: '#111' }); }
    // Soung, then covers on top
    const inCover = this.inCover;
    drawSoung(ctx, this.x, 700, 0.9, { mood: this.hurtT > 0 ? 'shocked' : inCover ? 'deadpan' : 'annoyed', t: this.t, walk: Math.abs((this.targetX ?? this.x) - this.x) > 4 || !!this.padDir, sweat: this.hurtT > 0 || (!inCover && Math.abs(this.x - this.patX) < 260) });
    for (const c of this.covers) {
      if (c.kind === 'plant') { fillR(ctx, c.x - 45, 640, 90, 70, 8, '#a8a29e', '#333', 3); ctx.strokeStyle = '#3f9142'; ctx.lineWidth = 12; ctx.lineCap = 'round'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(c.x, 650); ctx.lineTo(c.x + i * 28, 480 + Math.abs(i) * 30); ctx.stroke(); } }
      else if (c.kind === 'cabinet') { fillR(ctx, c.x - 60, 470, 120, 240, 6, '#9ca3af', '#333', 3); for (let i = 0; i < 4; i++) { fillR(ctx, c.x - 50, 480 + i * 58, 100, 48, 4, '#6b7280', '#333', 2); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(c.x - 12, 500 + i * 58, 24, 6); } }
      else { fillR(ctx, c.x - 40, 560, 80, 150, 8, '#e5e7eb', '#333', 3); fillR(ctx, c.x - 32, 480, 64, 90, 30, '#bae6fd', '#333', 3); }
      if (c.blown > 0) { drawCoworker(ctx, c.x + 10, 712, 0.9, { t: this.t, color: c.guy }); bubble(ctx, c.x - 70, 430, 160, 44, c.who ? c.who + "'s spot" : ['taken', 'my spot', 'excuse me'][Math.floor(c.x / 100) % 3], { size: c.who ? 14 : 16 }); }
      else if (c.warn > 0) { txt(ctx, '⚠', c.x, 430 + Math.sin(this.t * 20) * 4, { size: 34 }); drawCoworker(ctx, c.x + 10, 712 + 260 * (c.warn / 1.0), 0.9, { t: this.t, color: c.guy }); }
      else if (Math.abs(this.x - c.x) < COVER_R) { txt(ctx, '🫣', c.x, 440, { size: 30 }); }
    }
    // status pip + suspicion meter over Soung
    const pipY = 330;
    if (this.suspicion > 0.02) { fillR(ctx, this.x - 40, pipY, 80, 12, 6, '#0b1220', '#ef4444', 2); fillR(ctx, this.x - 38, pipY + 2, 76 * Math.min(1, this.suspicion / SPOT_TIME), 8, 4, '#ef4444'); txt(ctx, '!', this.x, pipY - 18, { size: 24 + this.suspicion * 30, color: '#ef4444', stroke: '#111', strokeW: 4 }); }
    else if (inCover) { fillR(ctx, this.x - 34, pipY, 68, 22, 11, '#166534', '#111', 2); txt(ctx, 'HIDDEN', this.x, pipY + 11, { size: 12, color: '#bbf7d0' }); }
    else { fillR(ctx, this.x - 40, pipY, 80, 22, 11, '#7c2d12', '#111', 2); txt(ctx, 'EXPOSED', this.x, pipY + 11, { size: 12, color: '#fed7aa' }); }
    txt(ctx, 'GRAB YOUR STUFF · STAY OUT OF THE FLASHLIGHT', 640, HUD_H + 24, { size: 24, color: '#fff', stroke: '#111', strokeW: 5 });
    txt(ctx, hint(this.api.engine, '← → keys, or click where to go · wait for the beam to pass, then dash', '◀ ▶ pads or tap where to go · wait for the beam to pass, then dash'), 640, HUD_H + 54, { size: 16, color: '#ffe600', stroke: '#111', strokeW: 3 });
    txt(ctx, `${this.got} recovered`, 1140, 150, { size: 18, color: '#fff', stroke: '#111', strokeW: 3 });
    if (this.t < 2.2) bubble(ctx, this.patX - 120, 270, 240, 56, PAT_QUOTES.wherego.text, { size: 18 });
    if (this.api.engine.touch) drawPads(ctx);
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'hide_and_seek', title: 'HIDE AND SEEK', tagline: "Pat's looking for you. Get your stuff. Don't be found.", pat: true, create: (api, def) => new HideAndSeek(api, def) });
