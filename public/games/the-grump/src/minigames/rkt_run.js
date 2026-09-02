// RKT RUN — red light / green light. Sneak across the break room to the Rice Krispy Treats while Pat is busy at
// the coffee machine. HOLD to creep; the moment he turns around, FREEZE. Momentum carries you a little, so let go early.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick, clamp } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { drawOffice, HUD_H } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const START_X = 130, TRAY_X = 1040;
class RktRun extends MiniGame {
  constructor(api, def) {
    super(api, def); this.dur = 12; this.x = START_X; this.v = 0; this.hold = false; this.caught = 0; this.hurtT = 0;
    this.state = 'busy'; this.stateT = rand(1.6, 2.4); this.warnT = 0; this.won = false; this.said = false; this.creepT = 0;
  }
  get holding() { const k = this.api.engine.keys; return this.hold || k.has('Space') || k.has('ArrowRight') || k.has('KeyD'); }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (!this.said && this.t > 0.4) { this.said = true; this.api.say('rkt'); }
    // Pat's attention cycle: busy → (turning warning) → looking → busy
    this.stateT -= dt;
    if (this.state === 'busy' && this.stateT <= 0) { this.state = 'turning'; this.stateT = 0.38; this.api.sfx('tick'); }
    else if (this.state === 'turning' && this.stateT <= 0) { this.state = 'looking'; this.stateT = rand(0.9, 1.5) * (this.caught ? 1.1 : 1); this.api.sfx('pop'); if (Math.random() < 0.5) this.api.say('dontmove'); }
    else if (this.state === 'looking' && this.stateT <= 0) { this.state = 'busy'; this.stateT = rand(1.3, 2.3) / Math.sqrt(this.diff); }
    // movement with a little momentum (the tension is in letting go early)
    const accel = this.holding ? 1400 : -1600, vmax = 330 * Math.sqrt(this.diff);
    this.v = clamp(this.v + accel * dt, 0, vmax); this.x = Math.min(TRAY_X, this.x + this.v * dt);
    if (this.v > 5) { this.creepT += dt; if (this.creepT > 0.22) { this.creepT = 0; this.api.sfx('step'); } }
    if (this.state === 'looking' && this.v > 25 && this.hurtT <= 0) {
      this.caught++; this.hurtT = 0.9; this.v = 0; this.x = Math.max(START_X, this.x - 200);
      this.api.grumpy(GRUMPY.QUICK_QUESTION, 'CAUGHT MOVING'); this.api.shake(9, 0.3); this.api.flash('#fff', 0.12); this.api.say(pick(['wasthatyou', 'gotcha', 'there']));
      this.api.particles.text(pick(['BUSTED', 'SEEN', 'CAUGHT']), this.x, 380, { impact: true, size: 60, color: '#ff6b6b' });
      this.stateT = Math.max(this.stateT, 0.8);
    }
    if (this.x >= TRAY_X - 1 && !this.won) {
      this.won = true; this.api.score(500, '+500', TRAY_X, 380); this.api.S.relief(); this.api.sfx('victory'); this.mood = 'smirk'; this.api.say('soung_deal_with_it');
      this.api.particles.emit(TRAY_X, 420, { n: 18, colors: ['#fde68a', '#fff', '#22c55e'] });
      this.finish(true, 'RKTs ACQUIRED', { sub: this.caught ? `Caught ${this.caught}×. Worth it.` : 'Silent. Deadly. Delicious.', pat: 'rkt' });
    }
    if (this.t >= this.dur && !this.won) this.finish(false, 'NO RKTs TODAY', { sub: `Caught ${this.caught}×. Pat ate them all.`, pat: 'there' });
  }
  pointerDown() { this.hold = true; }
  pointerUp() { this.hold = false; }
  draw(ctx) {
    drawOffice(ctx, this.t, 'cafeteria');
    // the prize: a counter with a tray of RKTs on the right
    fillR(ctx, TRAY_X - 90, 470, 200, 40, 8, '#b07c48', '#5b3a1a', 3); fillR(ctx, TRAY_X - 74, 510, 168, 120, 4, '#8a5f2c', '#5b3a1a', 3);
    fillR(ctx, TRAY_X - 70, 440, 140, 34, 6, '#e5e7eb', '#333', 2); for (let i = 0; i < 5; i++) fillR(ctx, TRAY_X - 62 + i * 26, 430, 22, 26, 4, '#fde68a', '#b45309', 2);
    txt(ctx, 'RKTs', TRAY_X, 412, { size: 16, color: '#7c2d12', stroke: '#fff', strokeW: 3 });
    // Pat by the coffee machine (busy) or turned toward the room (looking)
    const looking = this.state === 'looking', turning = this.state === 'turning';
    if (looking) { ctx.fillStyle = 'rgba(220,38,38,0.16)'; ctx.fillRect(0, 0, W, H); const g = ctx.createLinearGradient(1180, 0, 100, 0); g.addColorStop(0, 'rgba(255,240,150,0.45)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1150, 380); ctx.lineTo(60, 300); ctx.lineTo(60, H); ctx.lineTo(1150, 640); ctx.closePath(); ctx.fill(); }
    // busy = back turned (real rear-view sprite); turning = a quick squash-flip; looking = facing the room
    if (turning) { const k = 1 - this.stateT / 0.38, flip = Math.cos(k * Math.PI); ctx.save(); ctx.translate(1190, 0); ctx.scale(Math.max(0.08, Math.abs(flip)), 1); ctx.translate(-1190, 0); drawPat(ctx, 1190, 700, 1.0, { t: this.t, back: flip > 0, arms: 'none', tilt: 0 }); ctx.restore(); }
    else drawPat(ctx, 1190, 700, 1.0, { t: this.t, back: !looking && !this.done, arms: looking ? 'point' : 'none', tilt: looking ? -0.12 : 0.03 });
    if (looking) { txt(ctx, '👀', 1190, 250, { size: 54 }); }
    else if (turning) { bubble(ctx, 960, 250, 130, 54, 'hm?', { tail: 'right', size: 22 }); }
    else if (!this.done) { bubble(ctx, 940, 250, 160, 54, '☕ ...', { tail: 'right', size: 22 }); }
    drawSoung(ctx, this.x, 700, 0.95, { mood: this.hurtT > 0 ? 'shocked' : looking ? 'deadpan' : this.done ? this.mood : 'annoyed', t: this.t, walk: this.v > 5, sweat: looking && !this.done, arms: this.v > 5 ? 'walk' : 'down' });
    // status banner
    const label = looking ? '👀 PAT IS LOOKING — FREEZE!' : turning ? '⚠ HE\'S TURNING...' : '🟢 GO GO GO (hold)';
    fillR(ctx, 340, HUD_H + 8, 600, 44, 12, looking ? '#dc2626' : turning ? '#f59e0b' : '#16a34a', '#111', 3);
    txt(ctx, label, 640, HUD_H + 30, { size: 24, color: '#fff', stroke: '#111', strokeW: 4 });
    txt(ctx, 'HOLD click / SPACE to creep · let go BEFORE he turns', 640, HUD_H + 70, { size: 16, color: '#ffe600', stroke: '#111', strokeW: 3 });
    fillR(ctx, 340, HUD_H + 86, 600, 10, 5, '#0b1220'); fillR(ctx, 343, HUD_H + 88, 594 * ((this.x - START_X) / (TRAY_X - START_X)), 6, 3, '#fde68a');
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'rkt_run', title: 'RKT RUN', tagline: "Free Rice Krispy Treats. Pat's guarding them. Don't get seen.", pat: true, create: (api, def) => new RktRun(api, def) });
