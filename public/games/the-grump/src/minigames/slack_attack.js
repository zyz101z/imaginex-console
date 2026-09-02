import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice, HUD_H } from '../office.js';
import { drawSoung, drawPat, drawHeadIcon } from '../characters.js';
import { SCORE, GRUMPY, PAT_QUOTES, PAT_PINGS } from '../state.js';

export const SLACK_MSGS = PAT_PINGS;

class SlackAttack extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 10; this.bubbles = []; this.spawnT = 0.4; this.hits = 0; this.swats = 0; this.head = { x: 330, y: 295 }; this.hurtT = 0; this.chain = 0; this.lastSwat = -9; }
  spawn() {
    const side = Math.floor(rand(0, 3)); let x, y;
    if (side === 0) { x = W + 80; y = rand(HUD_H + 40, H - 120); } else if (side === 1) { x = rand(500, W); y = HUD_H + 34; }   // just under the HUD — a bubble in the HUD strip would eat clicks meant for pause/mute else { x = rand(500, W); y = H + 40; }
    const msg = pick(SLACK_MSGS), w = Math.max(150, msg.length * 11 + 90);
    const dx = this.head.x - x, dy = this.head.y - y, d = Math.hypot(dx, dy), sp = rand(150, 210) * this.diff;
    this.bubbles.push({ x, y, w, h: 50, msg, vx: dx / d * sp, vy: dy / d * sp, wob: rand(0, 6) });
    this.api.sfx('slack');
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (!this.asked && this.t > 5.5) { this.asked = true; this.api.say('ignoring'); }
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.55, 0.95) / this.diff; }
    for (const b of this.bubbles) { b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(this.t * 6 + b.wob) * 0.6; }
    const keep = [];
    for (const b of this.bubbles) {
      if (Math.hypot(b.x - this.head.x, b.y - this.head.y) < 70) { this.hits++; this.hurtT = 0.4; this.api.grumpy(GRUMPY.SLACK, 'SLACK HIT'); this.api.shake(6, 0.2); this.api.particles.emit(b.x, b.y, { n: 8, colors: ['#4a154b', '#e01e5a', '#fff'] }); }
      else keep.push(b);
    }
    this.bubbles = keep;
    if (this.t >= this.dur) {
      if (this.hits === 0) { this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'INBOX ZERO', { sub: `${this.swats} messages ignored` }); }
      else this.finish(this.hits <= 2, this.hits <= 2 ? 'MOSTLY IGNORED' : 'SLACK OVERLOAD', { sub: `${this.swats} swatted, ${this.hits} got through` });
    }
  }
  pointerDown(p) {
    if (this.done) return;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (p.x >= b.x - b.w / 2 - 8 && p.x <= b.x + b.w / 2 + 8 && p.y >= b.y - b.h / 2 - 8 && p.y <= b.y + b.h / 2 + 8) {
        this.bubbles.splice(i, 1); this.swats++; this.api.S.stats.slackIgnored++;
        this.chain = this.t - this.lastSwat < 0.7 ? this.chain + 1 : 1; this.lastSwat = this.t;   // quick successive swats chain up
        const pts = SCORE.SLACK_IGNORED + Math.min(150, 25 * (this.chain - 1));
        this.api.score(pts, this.chain > 1 ? `CHAIN ×${this.chain} +${pts}` : '+100', b.x, b.y); this.api.sfx(this.chain > 2 ? 'basket' : 'pop');
        this.api.particles.emit(b.x, b.y, { n: 10, colors: ['#4a154b', '#36c5f0', '#2eb67d', '#ecb22e', '#e01e5a'], shape: 'circle' });
        return;
      }
    }
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: this.hurtT > 0 ? 'angry' : (this.done ? this.mood : 'annoyed'), arms: 'typing', t: this.t, tilt: this.hurtT > 0 ? Math.sin(this.t * 40) * 0.08 : 0 });
    drawPat(ctx, 1170, 700, 0.9, { t: this.t, arms: 'wave', tilt: 0.05 }); txt(ctx, '📱', 1240, 470, { size: 40 });
    if (this.t > 5.5 && this.t < 9) bubble(ctx, 780, 300, 300, 70, PAT_QUOTES.ignoring.text, { tail: 'right', size: 20 });
    for (const b of this.bubbles) {
      fillR(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12, '#fff', '#4a154b', 3);
      drawHeadIcon(ctx, 'pat', b.x - b.w / 2 + 26, b.y, 34);
      txt(ctx, 'Pat', b.x - b.w / 2 + 50, b.y - 12, { size: 12, color: '#4a154b', align: 'left' });
      txt(ctx, b.msg, b.x - b.w / 2 + 50, b.y + 8, { size: 17, color: '#111', align: 'left' });
    }
    txt(ctx, 'SWAT THE NOTIFICATIONS!', 800, 118, { size: 26, color: '#fff', stroke: '#111', strokeW: 5 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'slack_attack', title: 'SLACK ATTACK', tagline: 'Click the notifications before they reach Soung', pat: false, create: (api, def) => new SlackAttack(api, def) });
