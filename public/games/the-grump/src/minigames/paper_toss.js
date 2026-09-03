// PAPER TOSS — flick crumpled memos into the bin. Pat's desk fan is the wind. 3 baskets to win.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick, clamp } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice, HUD_H, hint } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const G = 1500, START = { x: 300, y: 520 }, FLOOR = 640;
class PaperToss extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 24; this.memos = 5; this.thrown = 0; this.baskets = 0; this.misses = 0; this.ball = null; this.drag = null; this.newRound(); this.said = false; this.feedT = 0; this.feed = ''; }
  newRound() { this.bin = { x: rand(760, 1150), w: 90, h: 110 }; this.wind = rand(-1, 1) * (250 + 250 * (this.diff - 1)) * (Math.random() < 0.25 ? 0 : 1); this.ball = { x: START.x, y: START.y, vx: 0, vy: 0, live: false, trail: [] }; }
  launch(vx, vy) { if (!this.ball || this.ball.live || this.done) return; this.ball.vx = vx; this.ball.vy = vy; this.ball.live = true; this.thrown++; this.api.sfx('swish'); }
  get memosLeft() { return this.memos - this.thrown; }
  // a round is over when the 3rd basket drops, the last memo has landed, or the (generous) clock runs out
  wrap() { if (this.done) return; if (this.baskets >= 3) { this.api.S.relief(); this.mood = 'smirk'; this.api.score(200, 'BONUS +200', 640, 300); this.finish(true, `${this.baskets} BASKETS`, { sub: 'Pat unplugged the fan in defeat.', pat: 'niceshot' }); } else if (this.memosLeft <= 0 || this.t >= this.dur) this.finish(false, `ONLY ${this.baskets} BASKET${this.baskets === 1 ? '' : 'S'}`, { sub: 'Needed 3 of 5. The fan wins today.', pat: pick(['missed', 'showyou', 'fanup']) }); }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.feedT = Math.max(0, this.feedT - dt);
    if (!this.said && this.t > 0.5) { this.said = true; this.api.say('notbusy'); }
    const b = this.ball;
    if (b && b.live) {
      b.vx += this.wind * dt; b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 24) b.trail.shift();
      const top = FLOOR - this.bin.h;
      if (b.vy > 0 && b.y >= top - 6 && b.y <= top + 26 && Math.abs(b.x - this.bin.x) < this.bin.w / 2 - 8) {
        this.baskets++; this.hot = this.lastWasBasket ? (this.hot || 1) + 1 : 1; this.lastWasBasket = true; this.maxHot = Math.max(this.maxHot || 0, this.hot); const pts = 200 + (this.hot > 1 ? 100 : 0); this.api.score(pts, this.hot > 1 ? `ON FIRE +${pts}` : '+200', this.bin.x, top - 40); this.api.sfx('basket'); this.api.particles.emit(this.bin.x, top, { n: 14, colors: ['#ffe600', '#fff', '#22c55e'] }); this.api.particles.text(pick(['SWISH', 'NOTHING BUT BIN', 'BUCKETS']), this.bin.x, top - 90, { impact: true, size: 46, color: '#ffe600' });
        if (this.baskets % 2 === 0) this.api.say('niceshot'); this.newRound(); this.feed = ''; this.wrap(); return;
      }
      if (b.y >= FLOOR || b.x > W + 40 || b.x < -40) { this.misses++; this.lastWasBasket = false; this.hot = 0; this.api.grumpy(3, 'MISSED THE BIN'); this.api.sfx('wrong'); this.api.particles.papers(clamp(b.x, 0, W), FLOOR, 4); const q = this.missLine(); if (this.misses % 2 === 1) this.api.say(q); this.feed = PAT_QUOTES[q].text; this.feedT = 1.2; this.newRound(); this.wrap(); }
    }
    if (this.t >= this.dur && !(this.ball && this.ball.live)) this.wrap();
  }
  drawPaper(ctx, x, y, idle) {
    if (idle) { const k = (this.t * 1.6) % 1; ctx.strokeStyle = `rgba(255,230,0,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 28 + k * 26, 0, 7); ctx.stroke(); txt(ctx, this.drag ? 'RELEASE!' : 'FLICK ME', x, y - 52, { size: 20, color: '#ffe600', stroke: '#111', strokeW: 4 }); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.ball && this.ball.live ? this.t * 9 : 0);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = 22 + (i % 2 ? 3 : -3); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(2, 4); ctx.lineTo(-4, 12); ctx.moveTo(6, -12); ctx.lineTo(10, 2); ctx.stroke();
    ctx.restore();
  }
  // First miss: "Missed! Want a hand?"; repeated misses rotate through the others, never the same line twice running.
  missLine() { if (this.misses <= 1) { this.lastMiss = 'missed'; return 'missed'; } const opts = ['soclose', 'showyou', 'fanup', 'missed'].filter(k => k !== this.lastMiss); this.lastMiss = pick(opts); return this.lastMiss; }
  pointerDown(p) { if (this.ball && !this.ball.live) this.drag = { x: p.x, y: p.y }; }
  pointerMove(p) { if (this.drag) this.drag.cur = p; }
  pointerUp() { if (this.drag && this.drag.cur) { const dx = this.drag.cur.x - this.drag.x, dy = this.drag.cur.y - this.drag.y; if (Math.hypot(dx, dy) > 20) this.launch(clamp(dx * 4.2, -1400, 1400), clamp(dy * 4.2, -1500, 300)); } this.drag = null; }
  preview() { // dotted flight preview while aiming
    if (!this.drag || !this.drag.cur) return []; const dx = this.drag.cur.x - this.drag.x, dy = this.drag.cur.y - this.drag.y; let vx = clamp(dx * 4.2, -1400, 1400), vy = clamp(dy * 4.2, -1500, 300), x = START.x, y = START.y; const pts = [];
    for (let i = 0; i < 40; i++) { const dt = 0.03; vx += this.wind * dt; vy += G * dt; x += vx * dt; y += vy * dt; if (i % 3 === 0) pts.push({ x, y }); if (y > FLOOR) break; } return pts;
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, W, H);
    // cover the desk furniture on the right: a clear floor lane
    ctx.fillStyle = '#c9b48f'; ctx.fillRect(420, 500, W - 420, 220); ctx.fillStyle = '#b8a27c'; ctx.fillRect(420, FLOOR, W - 420, 4);
    drawSoung(ctx, 230, 700, 0.95, { mood: this.feedT > 0 ? 'angry' : 'deadpan', t: this.t, arms: this.ball && this.ball.live ? 'up' : 'down' });
    // Pat with the fan
    drawPat(ctx, 1150, 470, 0.7, { t: this.t, arms: 'point' }); txt(ctx, '🌀', 1080, 300 + Math.sin(this.t * 30) * 2, { size: 44 });
    const wk = this.wind / 500; txt(ctx, (wk < 0 ? '◀'.repeat(Math.min(4, Math.ceil(-wk * 4))) : wk > 0 ? '▶'.repeat(Math.min(4, Math.ceil(wk * 4))) : '· calm ·'), 900, 300, { size: 26, color: '#2563eb', stroke: '#fff', strokeW: 4 });
    txt(ctx, 'WIND', 900, 275, { size: 14, color: '#2563eb' });
    // bin
    const bx = this.bin.x, top = FLOOR - this.bin.h; fillR(ctx, bx - this.bin.w / 2, top, this.bin.w, this.bin.h, 8, '#4b5563', '#111', 3); ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.ellipse(bx, top, this.bin.w / 2, 12, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke(); txt(ctx, '♻', bx, top + 60, { size: 30, color: '#9ca3af' });
    // preview + ball
    for (const p of this.preview()) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    if (this.ball) { for (const [i, p] of this.ball.trail.entries()) { ctx.fillStyle = `rgba(255,255,255,${i / 30})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); } this.drawPaper(ctx, this.ball.x, this.ball.y, !this.ball.live); }
    txt(ctx, 'FLICK MEMOS INTO THE BIN · 3 OF 5 TO WIN', 640, HUD_H + 24, { size: 24, color: '#fff', stroke: '#111', strokeW: 5 });
    txt(ctx, `${this.baskets} / 3 · memos left: ${this.memosLeft}`, 640, HUD_H + 54, { size: 18, color: '#ffe600', stroke: '#111', strokeW: 4 });
    if (this.feedT > 0) bubble(ctx, 900, 380, 240, 56, this.feed, { tail: 'right', size: 17 });
    for (let i = 0; i < this.memos; i++) { const used = i < this.thrown; fillR(ctx, 1040 + i * 44, 104, 36, 26, 6, used ? '#374151' : '#fff', '#111', 2); if (!used) { ctx.fillStyle = '#9ca3af'; for (let r = 0; r < 3; r++) ctx.fillRect(1046 + i * 44, 110 + r * 6, 24, 2); } }
  }
}
registerMinigame({ id: 'paper_toss', title: 'PAPER TOSS', tagline: "Flick memos into the bin. Pat's fan disagrees.", pat: true, create: (api, def) => new PaperToss(api, def) });
