// PAPER BARRAGE — Pat lobs paper balls at Soung's head from across the office. It's a TIMING game:
// click / SPACE when a ball is in the catch ring around Soung's head to snatch it out of the air.
// Three catches in a row and Soung fires one back. Miss the window and it bonks him.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { drawOffice, HUD_H, hint } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const HEAD = { x: 330, y: 290 }, HAND = { x: 1060, y: 420 };
const ZONE_IN = 0.74, ZONE_OUT = 0.97;   // fraction of the flight during which a click catches
class PaperBarrage extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 11; this.balls = []; this.windup = 0; this.nextT = 1.0; this.hits = 0; this.catches = 0; this.streak = 0; this.whiffT = 0; this.hurtT = 0; this.smirkT = 0; this.returns = []; this.stuck = 0; this.said = false; this.hrT = 0; }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.whiffT = Math.max(0, this.whiffT - dt); this.hurtT = Math.max(0, this.hurtT - dt); this.smirkT = Math.max(0, this.smirkT - dt); this.stuck = Math.max(0, this.stuck - dt); this.hrT = Math.max(0, this.hrT - dt);
    if (!this.said && this.t > 0.3) { this.said = true; this.api.say('headsup'); }
    // Pat: wind up (telegraph) → throw
    this.nextT -= dt;
    if (this.windup > 0) { this.windup -= dt; if (this.windup <= 0) this.throwBall(); }
    else if (this.nextT <= 0) { this.windup = 0.45; this.nextT = rand(1.0, 1.5) / Math.sqrt(this.diff); if (Math.random() < 0.3) this.api.say(pick(['thinkfast', 'catch', 'headsup'])); }
    const keep = [];
    for (const b of this.balls) {
      b.k += dt / b.flight;
      if (b.k >= 1) { this.hits++; this.streak = 0; this.hurtT = 0.6; this.stuck = 0.8; this.api.grumpy(GRUMPY.SLACK, 'PAPER TO THE HEAD'); this.api.shake(7, 0.2); this.api.sfx('bonk'); this.api.particles.papers(HEAD.x, HEAD.y, 5); this.api.particles.text(pick(['BONK', 'THWAP', 'OOF']), HEAD.x, HEAD.y - 90, { impact: true, size: 50, color: '#ff6b6b' }); continue; }
      keep.push(b);
    }
    this.balls = keep;
    for (const r of this.returns) { r.k += dt / 0.5; if (r.k >= 1 && !r.landed) { r.landed = true; this.api.score(200, 'RETURN FIRE +200', HAND.x, HAND.y - 60); this.api.sfx('bonk'); this.api.say('ow'); this.api.particles.papers(HAND.x, HAND.y - 80, 6); this.hrT = 1.6; } }
    this.returns = this.returns.filter(r => r.k < 1.3);
    if (this.t >= this.dur) {
      if (this.hits <= 1) { this.api.S.relief(); this.mood = 'smirk'; this.api.score(300, '+300', 640, 300); this.finish(true, `CAUGHT ${this.catches}`, { sub: this.hits ? 'One got through. Acceptable.' : 'Not a single sheet landed.', pat: 'ow' }); }
      else this.finish(false, `PAPERED ${this.hits}×`, { sub: `${this.catches} caught. Recycling bin: full.`, pat: 'niceshot' });
    }
  }
  throwBall() {
    const curve = Math.random() < 0.35 * this.diff ? rand(-1, 1) : 0;
    this.balls.push({ k: 0, flight: rand(0.85, 1.05) / Math.pow(this.diff, 0.5), curve, spin: rand(4, 9) });
    this.api.sfx('swish');
  }
  pos(b) { const t = b.k, x = HAND.x + (HEAD.x - HAND.x) * t, y = HAND.y + (HEAD.y - HAND.y) * t - Math.sin(Math.PI * t) * 190 + b.curve * Math.sin(Math.PI * t * 2) * 90; return { x, y }; }
  catchNow() {
    if (this.done) return;
    const i = this.balls.findIndex(b => b.k >= ZONE_IN && b.k <= ZONE_OUT);
    if (i < 0) { this.whiffT = 0.35; this.api.sfx('tick'); return; }   // grabbed at nothing
    const b = this.balls.splice(i, 1)[0], p = this.pos(b);
    this.catches++; this.streak++; this.smirkT = 0.5; this.api.sfx('pop');
    const pts = 150 + Math.min(150, 50 * (this.streak - 1)); this.api.score(pts, this.streak > 1 ? `×${this.streak} +${pts}` : '+150', p.x, p.y - 30);
    this.api.particles.emit(p.x, p.y, { n: 8, colors: ['#fff', '#ffe600'], shape: 'circle' });
    if (this.streak % 3 === 0) { this.returns.push({ k: 0, landed: false }); this.api.sfx('whoosh'); this.api.say(pick(['soung_not_now', 'soung_go_away'])); this.api.particles.text('RETURN FIRE!', 640, 260, { impact: true, size: 56, color: '#ffe600' }); }
  }
  pointerDown() { this.catchNow(); }
  keyDown(code) { if (['Space', 'Enter', 'ArrowUp', 'KeyW'].includes(code)) this.catchNow(); }
  drawBall(ctx, x, y, rot, r = 20) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = r + (i % 2 ? 3 : -3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(2, 3); ctx.lineTo(-3, 10); ctx.stroke(); ctx.restore();
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    const mood = this.hurtT > 0 ? 'angry' : this.smirkT > 0 ? 'smirk' : this.done ? this.mood : 'deadpan';
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood, arms: 'typing', t: this.t, tilt: this.hurtT > 0 ? Math.sin(this.t * 40) * 0.08 : 0 });
    if (this.stuck > 0) this.drawBall(ctx, HEAD.x + 40, HEAD.y - 60, 0.4, 16);
    // catch ring: pulses when a ball is in the window
    const live = this.balls.some(b => b.k >= ZONE_IN && b.k <= ZONE_OUT);
    ctx.save(); ctx.strokeStyle = live ? '#22c55e' : this.whiffT > 0 ? '#ef4444' : 'rgba(255,230,0,0.55)'; ctx.lineWidth = live ? 7 : 4; ctx.setLineDash(live ? [] : [10, 8]); ctx.beginPath(); ctx.arc(HEAD.x, HEAD.y, live ? 130 + Math.sin(this.t * 30) * 4 : 125, 0, 7); ctx.stroke(); ctx.restore();
    if (live) txt(ctx, 'NOW!', HEAD.x, HEAD.y - 160, { size: 30, color: '#22c55e', stroke: '#111', strokeW: 5 });
    if (this.whiffT > 0) txt(ctx, 'whiff', HEAD.x, HEAD.y - 160, { size: 22, color: '#fca5a5', stroke: '#111', strokeW: 4 });
    // Pat with a stack of paper
    fillR(ctx, 1110, 560, 90, 60, 6, '#fff', '#111', 3); for (let i = 0; i < 4; i++) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(1116, 566 + i * 13, 78, 3); }
    drawPat(ctx, 1080, 700, 1.0, { t: this.t, arms: this.windup > 0 ? 'both' : 'point', tilt: this.windup > 0 ? -0.18 : this.hrT > 0 ? 0.15 : 0 });
    if (this.windup > 0) { this.drawBall(ctx, HAND.x, HAND.y - 40 - this.windup * 60, this.t * 6); txt(ctx, '!', 1080, 250, { size: 44, color: '#ef4444', stroke: '#111', strokeW: 6 }); }
    if (this.hrT > 0) bubble(ctx, 720, 250, 300, 70, PAT_QUOTES.ow.text, { tail: 'right', size: 20 });
    else if (this.t < 2.2) bubble(ctx, 740, 250, 280, 64, PAT_QUOTES.headsup.text, { tail: 'right', size: 21 });
    for (const b of this.balls) { const p = this.pos(b); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(p.x, 500, 16, 5, 0, 0, 7); ctx.fill(); this.drawBall(ctx, p.x, p.y, this.t * b.spin); }
    for (const r of this.returns) { const t = Math.min(1, r.k), x = HEAD.x + (HAND.x - HEAD.x) * t, y = HEAD.y + (HAND.y - 120 - HEAD.y) * t - Math.sin(Math.PI * t) * 120; if (!r.landed) this.drawBall(ctx, x, y, this.t * 12); }
    txt(ctx, hint(this.api.engine, 'CATCH — click / SPACE when the ring is GREEN', 'CATCH — TAP when the ring is GREEN'), 640, HUD_H + 24, { size: 22, color: '#fff', stroke: '#111', strokeW: 5 });
    txt(ctx, `${this.catches} caught · ${this.hits} hit`, 640, HUD_H + 54, { size: 16, color: '#ffe600', stroke: '#111', strokeW: 3 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'paper_barrage', title: 'PAPER BARRAGE', tagline: 'Pat found the recycling bin. Catch or get bonked.', pat: true, create: (api, def) => new PaperBarrage(api, def) });
