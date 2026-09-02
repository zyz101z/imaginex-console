// ELEVATOR SPRINT — endless-runner dash to the elevator. Jump the obstacles; every stumble lets Pat close in.
import { MiniGame, registerMinigame } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { HUD_H } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const GROUND = 640;
const OBST = [
  { kind: 'wet', w: 46, h: 70, label: '⚠' }, { kind: 'chair', w: 70, h: 80, label: '🪑' }, { kind: 'box', w: 80, h: 60, label: '📦' }, { kind: 'cart', w: 110, h: 75, label: '🛒' },
];
class ElevatorSprint extends MiniGame {
  constructor(api, def) {
    super(api, def); this.dur = 9.5; this.dist = 0; this.goal = 3400 * Math.pow(this.diff, 0.6); this.speed = 380 * Math.pow(this.diff, 0.6); this.obs = []; this.spawnX = 900;
    this.y = 0; this.vy = 0; this.jumps = 0; this.gap = 320; this.patGap = 1; this.stumbleT = 0; this.hits = 0; this.entered = false; this.scroll = 0; this.coffees = []; this.cups = 0;
  }
  jump() { if (this.done || this.entered) return; if (this.y >= -0.5) { this.vy = -1000; this.api.sfx('jump'); /* on the ground: y is 0 or negative — the old `<= 0.5` was ALWAYS true = infinite jumps */ } else if (this.jumps < 1) { this.vy = -800; this.jumps++; this.api.sfx('jump'); } }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    if (!this.said && this.t > 0.6) { this.said = true; this.api.say('waitforme'); }
    if (!this.said2 && this.patGap < 0.5) { this.said2 = true; this.api.say('there'); }
    const v = this.stumbleT > 0 ? this.speed * 0.35 : this.speed;
    this.dist += v * dt; this.scroll += v * dt;
    // physics
    this.vy += 2700 * dt; this.y = Math.min(0, this.y + this.vy * dt); if (this.y === 0 && this.vy > 0) { if (this.vy > 500) this.api.sfx('land'); this.vy = 0; this.jumps = 0; }
    // spawn obstacles ahead until the elevator
    const soungX = 300;
    while (this.spawnX < this.goal - 500 && this.spawnX - this.dist < W + 200) { const o = pick(OBST); this.obs.push({ ...o, x: this.spawnX, hit: false }); const step = rand(480, 680) / Math.pow(this.diff, 0.3); if (Math.random() < 0.6) this.coffees.push({ x: this.spawnX + step * 0.5, h: rand(110, 160), got: false }); this.spawnX += step; }   // jump length (≈280–390 px) always fits the gap
    for (const o of this.obs) {
      const sx = o.x - this.dist + soungX;
      if (!o.hit && Math.abs(sx - soungX) < o.w / 2 + 12 && -this.y < o.h - 22 /* forgiving: feet above ~2/3 of the obstacle clears it */) { o.hit = true; this.hits++; this.stumbleT = 0.7; this.patGap = Math.max(0, this.patGap - 0.3); this.api.grumpy(GRUMPY.WRONG_BUTTON, 'TRIPPED'); this.api.shake(8, 0.25); this.api.sfx('wrong'); this.api.particles.papers(soungX, GROUND - 60, 8); }
    }
    this.obs = this.obs.filter(o => o.x - this.dist > -300);
    for (const c of this.coffees) { if (!c.got && Math.abs(c.x - this.dist) < 34 && Math.abs(-this.y - c.h) < 46) { c.got = true; this.cups++; this.api.score(50, '☕ +50', 300, GROUND - c.h - 40); this.api.sfx('good'); this.api.particles.emit(300, GROUND - c.h, { n: 6, colors: ['#fff', '#fde68a'], shape: 'circle' }); } }
    this.coffees = this.coffees.filter(c => c.x - this.dist > -300);
    // Pat slowly gains unless you're clean
    this.patGap = Math.min(1, this.patGap + (this.stumbleT > 0 ? -0.25 : 0.08) * dt);
    if (this.patGap <= 0) { this.api.grumpy(GRUMPY.AWAY, 'PAT CAUGHT UP'); this.api.sfx('patAlarm'); this.finish(false, 'PAT CAUGHT UP', { sub: '"Perfect! We can ride down together."', pat: 'toldthem' }); return; }
    if (this.dist >= this.goal - 420 && !this.entered) { this.entered = true; this.enterT = 0; }
    if (this.entered) { this.enterT += dt; if (this.enterT > 0.9) { this.api.score(400, '+400', 640, 300); this.api.S.stats.patAvoided++; this.api.S.relief(); this.api.sfx('good'); this.mood = 'smirk'; this.finish(true, 'MADE THE ELEVATOR', { sub: `${this.hits === 0 ? 'Flawless sprint.' : 'Tripped ' + this.hits + '×, still made it.'}${this.cups ? ' ☕×' + this.cups + '.' : ''} Doors closed in Pat's face.` }); } }
  }
  pointerDown() { this.jump(); }
  keyDown(code) { if (['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(code)) this.jump(); }
  draw(ctx) {
    // lobby: scrolling columns + windows
    ctx.fillStyle = '#dfe5ec'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#c7d0da'; ctx.fillRect(0, GROUND, W, H - GROUND); ctx.fillStyle = '#aeb9c6'; ctx.fillRect(0, GROUND, W, 6);
    for (let i = -1; i < 6; i++) { const cx = ((i * 320 - (this.scroll * 0.5) % 320) + 320) % (W + 320) - 160; fillR(ctx, cx - 18, HUD_H + 40, 36, GROUND - HUD_H - 40, 4, '#b8c2cf', '#8d99a8', 2); fillR(ctx, cx + 60, HUD_H + 90, 160, 200, 6, '#8ed0ff', '#5b6b7c', 4); }
    for (let i = -1; i < 12; i++) { const cx = ((i * 120 - this.scroll % 120) + 120) % (W + 120) - 60; ctx.fillStyle = i % 2 ? '#d3dbe4' : '#c7d0da'; ctx.fillRect(cx, GROUND + 6, 120, H - GROUND); }
    // elevator at the goal
    const ex = this.goal - this.dist + 300;
    if (ex < W + 300) { fillR(ctx, ex - 120, 260, 240, 380, 6, '#3b4652', '#1f2937', 6); const open = this.entered ? Math.max(0, 1 - this.enterT / 0.8) : 1; fillR(ctx, ex - 108, 272, 216, 356, 0, '#7c8a99'); fillR(ctx, ex - 108, 272, 108 * (1 - open) + 4, 356, 0, '#94a3b8', '#334155', 2); fillR(ctx, ex + 108 - (108 * (1 - open) + 4), 272, 108 * (1 - open) + 4, 356, 0, '#94a3b8', '#334155', 2); txt(ctx, '▼', ex, 235, { size: 30, color: '#f97316' }); }
    // obstacles
    for (const o of this.obs) { const sx = o.x - this.dist + 300; if (sx < -100 || sx > W + 100) continue; if (o.kind === 'wet') { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(sx - 23, GROUND); ctx.lineTo(sx + 23, GROUND); ctx.lineTo(sx, GROUND - 70); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.stroke(); txt(ctx, '!', sx, GROUND - 25, { size: 26, color: '#111' }); } else { fillR(ctx, sx - o.w / 2, GROUND - o.h, o.w, o.h, 8, o.kind === 'chair' ? '#374151' : o.kind === 'cart' ? '#9ca3af' : '#c8a26a', '#111', 3); txt(ctx, o.label, sx, GROUND - o.h / 2, { size: 34 }); } }
    for (const c of this.coffees) { if (c.got) continue; const sx = c.x - this.dist + 300; if (sx < -50 || sx > W + 50) continue; const bob = Math.sin(this.t * 5 + c.x) * 4; fillR(ctx, sx - 13, GROUND - c.h - 16 + bob, 26, 30, 5, '#fff', '#111', 2); fillR(ctx, sx - 15, GROUND - c.h - 20 + bob, 30, 8, 3, '#7c2d12', '#111', 2); }
    // Pat behind, Soung
    const patX = 300 - 90 - this.patGap * 260;
    if (!this.entered) drawPat(ctx, patX, GROUND + 50, 0.95, { t: this.t, walk: true, arms: 'wave', tilt: -0.1 });
    const sx = this.entered ? 300 + Math.min(1, this.enterT / 0.6) * (ex - 300) : 300;
    drawSoung(ctx, sx, GROUND + 50 + this.y, 0.95, { mood: this.stumbleT > 0 ? 'shocked' : (this.y < -10 ? 'angry' : 'annoyed'), t: this.t, walk: true, sweat: this.patGap < 0.4, tilt: this.y < 0 ? -0.15 : 0 });
    if (this.t < 2.5 && !this.entered) bubble(ctx, patX - 130, 330, 260, 60, PAT_QUOTES.waitforme.text, { size: 18 });
    if (this.stumbleT > 0.4) impact(ctx, ['OOF', 'WHOA', 'AGH'][this.hits % 3], 300, GROUND - 200, 50, '#ff6b6b');
    // HUD: distance bar + Pat gap
    fillR(ctx, 340, HUD_H + 60, 600, 16, 8, '#0b1220'); fillR(ctx, 343, HUD_H + 63, 594 * Math.min(1, this.dist / this.goal), 10, 5, '#38bdf8'); txt(ctx, '🛗', 950, HUD_H + 68, { size: 22 });
    txt(ctx, 'RUN! click / SPACE to jump (double-jump ok)', 640, HUD_H + 26, { size: 22, color: '#fff', stroke: '#111', strokeW: 5 });
    fillR(ctx, 340, HUD_H + 86, 600, 10, 5, '#0b1220'); fillR(ctx, 343, HUD_H + 88, 594 * this.patGap, 6, 3, this.patGap < 0.35 ? '#ef4444' : '#22c55e'); txt(ctx, 'LEAD ON PAT', 640, HUD_H + 112, { size: 14, color: '#111' });
  }
}
registerMinigame({ id: 'elevator_sprint', title: 'ELEVATOR SPRINT', tagline: 'Jump the junk. Beat Pat to the elevator.', pat: true, create: (api, def) => new ElevatorSprint(api, def) });
