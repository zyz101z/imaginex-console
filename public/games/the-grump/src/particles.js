// particles.js — confetti/papers/sparks + floating score text.
import { rand, pick } from './engine.js';
import { txt, impact } from './draw.js';

export class Particles {
  constructor() { this.list = []; this.texts = []; }
  emit(x, y, o = {}) {
    const n = o.n || 12;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(o.speedMin || 80, o.speed || 340);
      this.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 120), life: rand(0.5, o.life || 1.1), t: 0,
        color: pick(o.colors || ['#ffe600', '#ff6b6b', '#4ade80', '#60a5fa', '#fff']), size: rand(4, o.size || 10),
        shape: o.shape || 'rect', rot: rand(0, 6), vr: rand(-8, 8), g: o.gravity ?? 600 });
    }
  }
  papers(x, y, n = 10) { this.emit(x, y, { n, colors: ['#fff', '#f3f4f6', '#fef9c3'], size: 18, shape: 'paper', life: 1.6, gravity: 250, speed: 420 }); }
  text(s, x, y, o = {}) { this.texts.push({ s, x, y, t: 0, life: o.life || 1.1, color: o.color || '#ffe600', size: o.size || 34, impact: o.impact, rot: rand(-0.2, 0.2), vy: o.vy ?? -60 }); }
  update(dt) {
    for (const p of this.list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt; }
    this.list = this.list.filter(p => p.t < p.life);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; }
    this.texts = this.texts.filter(t => t.t < t.life);
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.save(); ctx.globalAlpha = 1 - p.t / p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      if (p.shape === 'paper') { ctx.fillRect(-p.size / 2, -p.size * 0.65, p.size, p.size * 1.3); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(-p.size / 2, -p.size * 0.65, p.size, p.size * 1.3); }
      else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); }
      else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    for (const t of this.texts) {
      const k = t.t / t.life, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const pop = t.t < 0.15 ? 0.6 + (t.t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (t.t - 0.15) * 0.4);
      if (t.impact) impact(ctx, t.s, t.x, t.y, t.size * pop, t.color, t.rot, a);
      else txt(ctx, t.s, t.x, t.y, { size: t.size * pop, color: t.color, stroke: '#111', strokeW: 5, alpha: a });
    }
  }
}
