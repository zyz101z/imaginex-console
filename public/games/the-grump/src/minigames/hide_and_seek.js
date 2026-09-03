// HIDE AND SEEK — Pat is sweeping the office with a flashlight. Move Soung between cover spots.
// Cover gets blown (a coworker parks in front of it) so you have to keep relocating.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick, clamp } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice, HUD_H, drawPads, padDir, hint } from '../office.js';
import { drawSoung, drawPat, drawCoworker } from '../characters.js';
import { SCORE, GRUMPY, PAT_QUOTES, coworkerName } from '../state.js';

const COVERS = [{ x: 230, kind: 'plant' }, { x: 520, kind: 'cabinet' }, { x: 800, kind: 'cooler' }, { x: 1080, kind: 'plant' }];
class HideAndSeek extends MiniGame {
  constructor(api, def) {
    super(api, def); this.dur = 9; this.x = 640; this.targetX = null; this.caught = 0; this.hurtT = 0;
    this.covers = COVERS.map(c => ({ ...c, blown: 0, warn: 0, guy: pick(['#f59e0b', '#8b5cf6', '#06b6d4']) })); this.blowT = 1.4; this.sweepPhase = -Math.PI / 2; this.patX = 120; this.safeT = 1.0; this.spotted = false; this.suspicion = 0;
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt); this.safeT = Math.max(0, this.safeT - dt);
    if (!this.said && this.t > 0.3) { this.said = true; this.api.say('wherego'); }
    // movement
    const k = this.api.engine.keys; let dir = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) dir -= 1; if (k.has('ArrowRight') || k.has('KeyD')) dir += 1;
    if (this.padDir) dir = this.padDir;
    if (dir) { this.x += dir * 600 * dt; this.targetX = null; } else if (this.targetX != null) { const d = this.targetX - this.x; this.x += clamp(d, -600 * dt, 600 * dt); }
    this.x = clamp(this.x, 110, 1170);
    // flashlight sweep: speeds up over time
    this.sweepPhase += dt * (0.7 + this.t * 0.08) * this.diff;
    this.patX = 640 + Math.sin(this.sweepPhase) * 520;
    // covers get blown, one at a time, never all
    for (const c of this.covers) { c.blown = Math.max(0, c.blown - dt); if (c.warn > 0) { c.warn -= dt; if (c.warn <= 0) c.blown = rand(2.2, 3.2); } }
    this.blowT -= dt;
    if (this.blowT <= 0) { const active = this.covers.filter(c => c.blown <= 0 && c.warn <= 0); if (active.length > 1) { const c = pick(active); c.warn = 0.7; c.who = coworkerName(); } this.blowT = rand(1.2, 1.9) / this.diff; }
    // detection
    const inCover = this.covers.some(c => c.blown <= 0 && Math.abs(this.x - c.x) < 58);
    const inBeam = Math.abs(this.x - this.patX) < 95;
    // the beam has to LINGER on him — a '?' meter over Pat fills, giving you a beat to dive for cover
    this.suspicion = inBeam && !inCover && this.safeT <= 0 ? this.suspicion + dt : Math.max(0, this.suspicion - dt * 2);
    const hiddenInBeam = inBeam && inCover; if (hiddenInBeam && !this.wasHiddenInBeam) { this.api.score(50, pick(['not today +50', 'nope +50', 'nice try +50']), this.x, 420); this.api.sfx('tick'); } this.wasHiddenInBeam = hiddenInBeam;
    if (this.suspicion >= 0.32) {
      this.suspicion = 0; this.caught++; this.hurtT = 0.6; this.safeT = 1.4; this.api.grumpy(GRUMPY.QUICK_QUESTION, 'SPOTTED'); this.api.shake(8, 0.25); this.api.say('foundyou'); this.api.flash('#fff', 0.15);
      this.api.particles.text(PAT_QUOTES.foundyou.text, this.x, 380, { impact: true, size: 60, color: '#ff6b6b' });
    }
    if (this.t >= this.dur) {
      if (this.caught === 0) { this.api.score(SCORE.PAT_AVOIDED, '+500', 640, 300); this.api.S.stats.patAvoided++; this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'NEVER FOUND', { sub: 'Pat gave up and asked someone else.', pat: 'wherego' }); }
      else this.finish(false, `SPOTTED ${this.caught}×`, { sub: '"Oh THERE you are. Quick question."' });
    }
  }
  pointerDown(p) { const d = this.api.engine.touch ? padDir(p) : 0; if (d) { this.padDir = d; return; } this.targetX = p.x; }
  pointerMove(p) { if (this.padDir) return; if (this.api.engine.pointer.down) this.targetX = p.x; }
  pointerUp() { this.padDir = 0; }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    // dim office, Pat's flashlight cone lights a band of floor
    ctx.fillStyle = 'rgba(10,12,40,0.55)'; ctx.fillRect(0, 0, W, H);
    // back counter where Pat walks
    fillR(ctx, 0, 400, W, 60, 0, '#6b4f2a', '#3b2a14', 3); ctx.fillStyle = '#8a6a3c'; ctx.fillRect(0, 400, W, 10);
    drawPat(ctx, this.patX, 440, 0.62, { t: this.t, walk: true, arms: 'point' });
    const g = ctx.createLinearGradient(0, 300, 0, H); g.addColorStop(0, 'rgba(255,240,150,0.0)'); g.addColorStop(0.35, 'rgba(255,240,150,0.55)'); g.addColorStop(1, 'rgba(255,240,150,0.25)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(this.patX - 12, 330); ctx.lineTo(this.patX + 12, 330); ctx.lineTo(this.patX + 110, H); ctx.lineTo(this.patX - 110, H); ctx.closePath(); ctx.fill();
    txt(ctx, '🔦', this.patX + 30, 350, { size: 26 });
    if (this.suspicion > 0.02) { fillR(ctx, this.patX - 30, 300, 60, 10, 5, '#0b1220'); fillR(ctx, this.patX - 28, 302, 56 * Math.min(1, this.suspicion / 0.32), 6, 3, '#ef4444'); txt(ctx, '?', this.patX, 285, { size: 26 + this.suspicion * 40, color: '#ffe600', stroke: '#111', strokeW: 4 }); }
    // Soung then covers on top
    drawSoung(ctx, this.x, 700, 0.9, { mood: this.hurtT > 0 ? 'shocked' : 'deadpan', t: this.t, walk: Math.abs((this.targetX ?? this.x) - this.x) > 4, sweat: this.hurtT > 0 });
    for (const c of this.covers) {
      if (c.kind === 'plant') { fillR(ctx, c.x - 45, 640, 90, 70, 8, '#a8a29e', '#333', 3); ctx.strokeStyle = '#3f9142'; ctx.lineWidth = 12; ctx.lineCap = 'round'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(c.x, 650); ctx.lineTo(c.x + i * 28, 480 + Math.abs(i) * 30); ctx.stroke(); } }
      else if (c.kind === 'cabinet') { fillR(ctx, c.x - 60, 470, 120, 240, 6, '#9ca3af', '#333', 3); for (let i = 0; i < 4; i++) { fillR(ctx, c.x - 50, 480 + i * 58, 100, 48, 4, '#6b7280', '#333', 2); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(c.x - 12, 500 + i * 58, 24, 6); } }
      else { fillR(ctx, c.x - 40, 560, 80, 150, 8, '#e5e7eb', '#333', 3); fillR(ctx, c.x - 32, 480, 64, 90, 30, '#bae6fd', '#333', 3); }
      if (c.blown > 0) { drawCoworker(ctx, c.x + 10, 712, 0.9, { t: this.t, color: c.guy }); bubble(ctx, c.x - 70, 430, 160, 44, c.who ? c.who + "'s spot" : ['taken', 'my spot', 'excuse me'][Math.floor(c.x / 100) % 3], { size: c.who ? 14 : 16 }); }
      else if (c.warn > 0) { txt(ctx, '⚠', c.x, 430 + Math.sin(this.t * 20) * 4, { size: 34 }); drawCoworker(ctx, c.x + 10 + (Math.random() < 0.5 ? -1 : 1) * 0, 712 + 260 * (c.warn / 0.7), 0.9, { t: this.t, color: c.guy }); }
      else if (Math.abs(this.x - c.x) < 58) { txt(ctx, '🫣', c.x, 440, { size: 30 }); }
    }
    txt(ctx, 'STAY OUT OF THE FLASHLIGHT', 640, HUD_H + 24, { size: 24, color: '#fff', stroke: '#111', strokeW: 5 });
    txt(ctx, hint(this.api.engine, '← → keys, or drag · cover gets taken, keep moving', '◀ ▶ pads or drag · cover gets taken, keep moving'), 640, HUD_H + 54, { size: 17, color: '#ffe600', stroke: '#111', strokeW: 3 });
    if (this.t < 2.2) bubble(ctx, this.patX - 120, 270, 240, 56, PAT_QUOTES.wherego.text, { size: 18 });
    if (this.api.engine.touch) drawPads(ctx);
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'hide_and_seek', title: 'HIDE AND SEEK', tagline: "Pat's looking for you. Don't be found.", pat: true, create: (api, def) => new HideAndSeek(api, def) });
