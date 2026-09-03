// ELEVATOR SPRINT — endless-runner dash to the elevator. Jump the obstacles; every stumble lets Pat close in.
import { MiniGame, registerMinigame } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { HUD_H, hint } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const GROUND = 640;
const OBST = [
  { kind: 'wet', w: 46, h: 70, label: '⚠' }, { kind: 'chair', w: 70, h: 80, label: '🪑' }, { kind: 'box', w: 80, h: 60, label: '📦' }, { kind: 'cart', w: 110, h: 75, label: '🛒' },
];
class ElevatorSprint extends MiniGame {
  constructor(api, def) {
    super(api, def); this.dur = 9.5; this.dist = 0; this.goal = 3400 * Math.pow(this.diff, 0.6); this.speed = 380 * Math.pow(this.diff, 0.6); this.obs = []; this.spawnX = 900;
    this.y = 0; this.vy = 0; this.jumps = 0; this.gap = 320; this.patGap = 1; this.stumbleT = 0; this.hits = 0; this.entered = false; this.scroll = 0;
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
    while (this.spawnX < this.goal - 500 && this.spawnX - this.dist < W + 200) { const o = pick(OBST); this.obs.push({ ...o, x: this.spawnX, hit: false }); const step = rand(480, 680) / Math.pow(this.diff, 0.3); this.spawnX += step; }   // jump length (≈280–390 px) always fits the gap
    for (const o of this.obs) {
      const sx = o.x - this.dist + soungX;
      if (!o.hit && Math.abs(sx - soungX) < o.w / 2 + 12 && -this.y < o.h - 22 /* forgiving: feet above ~2/3 of the obstacle clears it */) { o.hit = true; this.hits++; this.stumbleT = 0.7; this.patGap = Math.max(0, this.patGap - 0.3); this.api.grumpy(GRUMPY.WRONG_BUTTON, 'TRIPPED'); this.api.shake(8, 0.25); this.api.sfx('wrong'); this.api.particles.papers(soungX, GROUND - 60, 8); }
    }
    this.obs = this.obs.filter(o => o.x - this.dist > -300);
    // Pat slowly gains unless you're clean
    this.patGap = Math.min(1, this.patGap + (this.stumbleT > 0 ? -0.25 : 0.08) * dt);
    if (this.patGap <= 0) { this.api.grumpy(GRUMPY.AWAY, 'PAT CAUGHT UP'); this.api.sfx('patAlarm'); this.finish(false, 'PAT CAUGHT UP', { sub: '"Perfect! We can ride down together."', pat: 'toldthem' }); return; }
    if (this.dist >= this.goal - 420 && !this.entered) { this.entered = true; this.enterT = 0; }
    if (this.entered) { this.enterT += dt; if (this.enterT > 0.9) { this.api.score(400, '+400', 640, 300); this.api.S.stats.patAvoided++; this.api.S.relief(); this.api.sfx('good'); this.mood = 'smirk'; this.finish(true, 'MADE THE ELEVATOR', { sub: `${this.hits === 0 ? 'Flawless sprint.' : 'Tripped ' + this.hits + '×, still made it.'} Doors closed in Pat's face.` }); } }
  }
  drawObstacle(ctx, o, sx) {
    ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(sx, GROUND + 4, o.w / 2 + 6, 7, 0, 0, 7); ctx.fill();
    if (o.kind === 'wet') {  // yellow A-frame sign
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(sx - 24, GROUND); ctx.lineTo(sx - 6, GROUND - 70); ctx.lineTo(sx + 6, GROUND - 70); ctx.lineTo(sx + 24, GROUND); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.moveTo(sx + 6, GROUND - 70); ctx.lineTo(sx + 30, GROUND); ctx.lineTo(sx + 24, GROUND); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(sx - 14, GROUND - 30, 28, 4);
      txt(ctx, 'WET', sx, GROUND - 44, { size: 10, color: '#111', weight: 700 }); txt(ctx, 'FLOOR', sx, GROUND - 18, { size: 10, color: '#111', weight: 700 });
      ctx.fillStyle = 'rgba(56,189,248,0.35)'; ctx.beginPath(); ctx.ellipse(sx + 34, GROUND + 2, 40, 6, 0, 0, 7); ctx.fill();
    } else if (o.kind === 'chair') {  // office chair on wheels
      ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.moveTo(sx, GROUND - 6); ctx.lineTo(sx - 26, GROUND - 2); ctx.moveTo(sx, GROUND - 6); ctx.lineTo(sx + 26, GROUND - 2); ctx.moveTo(sx, GROUND - 6); ctx.lineTo(sx, GROUND - 34); ctx.lineWidth = 5; ctx.strokeStyle = '#4b5563'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#111';
      for (const dx of [-26, 26, 0]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + dx, GROUND - 2, 5, 0, 7); ctx.fill(); }
      fillR(ctx, sx - 30, GROUND - 46, 60, 14, 6, '#1f2937', '#111', 3);   // seat
      fillR(ctx, sx + 12, GROUND - 82, 18, 40, 6, '#1f2937', '#111', 3);   // back
      ctx.fillStyle = '#4b5563'; ctx.fillRect(sx - 28, GROUND - 40, 56, 3);
    } else if (o.kind === 'box') {  // cardboard box with tape
      fillR(ctx, sx - 40, GROUND - 60, 80, 60, 3, '#d4a56a', '#111', 3); ctx.fillStyle = '#b9884f'; ctx.fillRect(sx - 40, GROUND - 60, 80, 10);
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(sx - 4, GROUND - 60, 8, 60); ctx.fillStyle = '#a16207'; ctx.fillRect(sx - 30, GROUND - 40, 20, 12);
      txt(ctx, 'FRAGILE', sx + 12, GROUND - 22, { size: 10, color: '#7c2d12', weight: 700 }); txt(ctx, '↑', sx - 20, GROUND - 16, { size: 12, color: '#7c2d12' });
    } else {  // mail cart with bins
      fillR(ctx, sx - 52, GROUND - 60, 104, 40, 4, '#9ca3af', '#111', 3); ctx.fillStyle = '#6b7280'; ctx.fillRect(sx - 52, GROUND - 60, 104, 6);
      for (let i = 0; i < 3; i++) fillR(ctx, sx - 46 + i * 34, GROUND - 74, 28, 18, 3, ['#ef4444', '#3b82f6', '#fde68a'][i], '#111', 2);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(sx - 44 + i * 6, GROUND - 68, 4, 8); }
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx + 52, GROUND - 60); ctx.lineTo(sx + 64, GROUND - 76); ctx.stroke(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
      for (const dx of [-36, 36]) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + dx, GROUND - 8, 8 + Math.sin(this.t * 20) * 0, 0, 7); ctx.fill(); ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(sx + dx, GROUND - 8, 3, 0, 7); ctx.fill(); }
    }
    ctx.restore();
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
    for (const o of this.obs) { const sx = o.x - this.dist + 300; if (sx < -100 || sx > W + 100) continue; this.drawObstacle(ctx, o, sx); }
    // Pat behind, Soung
    const patX = 300 - 90 - this.patGap * 260;
    if (!this.entered) drawPat(ctx, patX, GROUND + 50, 0.95, { t: this.t, walk: true, arms: 'wave', tilt: -0.1 });
    const sx = this.entered ? 300 + Math.min(1, this.enterT / 0.6) * (ex - 300) : 300;
    drawSoung(ctx, sx, GROUND + 50 + this.y, 0.95, { mood: this.stumbleT > 0 ? 'shocked' : (this.y < -10 ? 'angry' : 'annoyed'), t: this.t, walk: true, sweat: this.patGap < 0.4, tilt: this.y < 0 ? -0.15 : 0 });
    if (this.t < 2.5 && !this.entered) bubble(ctx, patX - 130, 330, 260, 60, PAT_QUOTES.waitforme.text, { size: 18 });
    if (this.stumbleT > 0.4) impact(ctx, ['OOF', 'WHOA', 'AGH'][this.hits % 3], 300, GROUND - 200, 50, '#ff6b6b');
    // HUD: distance bar + Pat gap
    fillR(ctx, 340, HUD_H + 60, 600, 16, 8, '#0b1220'); fillR(ctx, 343, HUD_H + 63, 594 * Math.min(1, this.dist / this.goal), 10, 5, '#38bdf8'); txt(ctx, '🛗', 950, HUD_H + 68, { size: 22 });
    txt(ctx, hint(this.api.engine, 'RUN! click / SPACE to jump (double-jump ok)', 'RUN! TAP to jump (tap again in the air)'), 640, HUD_H + 26, { size: 22, color: '#fff', stroke: '#111', strokeW: 5 });
    fillR(ctx, 340, HUD_H + 86, 600, 10, 5, '#0b1220'); fillR(ctx, 343, HUD_H + 88, 594 * this.patGap, 6, 3, this.patGap < 0.35 ? '#ef4444' : '#22c55e'); txt(ctx, 'LEAD ON PAT', 640, HUD_H + 112, { size: 14, color: '#111' });
  }
}
registerMinigame({ id: 'elevator_sprint', title: 'ELEVATOR SPRINT', tagline: 'Jump the junk. Beat Pat to the elevator.', pat: true, create: (api, def) => new ElevatorSprint(api, def) });
