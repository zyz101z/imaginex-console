// fullsoung.js — FULL SOUNG MODE: 8 seconds of smashing everything annoying.
import { W, H, rand, pick } from './engine.js';
import { txt, fillR, impact, IMPACT } from './draw.js';
import { drawSoung, drawPat } from './characters.js';
import { bubble } from './draw.js';
import { PAT_QUOTES } from './state.js';
import { SCORE } from './state.js';

const TARGETS = [
  { kind: 'slack', label: 'Quick question', icon: '💬', w: 190, h: 54, color: '#fff', stroke: '#4a154b' },
  { kind: 'invite', label: 'Sync on the Sync', icon: '📅', w: 210, h: 60, color: '#fff', stroke: '#2563eb' },
  { kind: 'laptop', label: 'LAPTOP', icon: '💻', w: 120, h: 80, color: '#374151', stroke: '#111' },
  { kind: 'notif', label: '(99+)', icon: '🔔', w: 90, h: 70, color: '#ef4444', stroke: '#111' },
  { kind: 'deck', label: '84-slide deck', icon: '📊', w: 170, h: 100, color: '#f97316', stroke: '#111' },
  { kind: 'alert', label: 'Meeting in 1 min', icon: '⏰', w: 200, h: 56, color: '#fde68a', stroke: '#111' },
  { kind: 'printer', label: 'PC LOAD LETTER', icon: '🖨', w: 150, h: 100, color: '#d1d5db', stroke: '#111' },
  { kind: 'screen', label: 'Zoom: 47 attendees', icon: '🖥', w: 210, h: 120, color: '#0f172a', stroke: '#111' },
];

export class FullSoungMode {
  constructor(api) { this.api = api; this.t = 0; this.dur = 8; this.items = []; this.spawnT = 0.5; this.done = false; this.smashed = 0; this.banner = 1.6; api.sfx('fullSoung'); api.audio.startMusic('musicRage'); api.shake(18, 1.2); api.flash('#ff2d2d', 0.4); }
  spawn() { const d = pick(TARGETS); this.items.push({ ...d, x: rand(520, W - 120), y: rand(150, H - 100), vx: rand(-60, 60), vy: rand(-40, 40), rot: rand(-0.15, 0.15), t: 0 }); }
  update(dt) {
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    if (this.t >= this.dur) { this.done = true; this.api.audio.stopMusic(); return; }
    this.spawnT -= dt; if (this.spawnT <= 0 && this.items.length < 9) { this.spawn(); this.spawnT = 0.28; }
    for (const it of this.items) { it.t += dt; it.x += it.vx * dt; it.y += it.vy * dt; if (it.x < 480 || it.x > W - 60) it.vx *= -1; if (it.y < 130 || it.y > H - 60) it.vy *= -1; }
  }
  pointerDown(p) {
    if (this.done) return;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (Math.abs(p.x - it.x) < it.w / 2 + 10 && Math.abs(p.y - it.y) < it.h / 2 + 10) {
        this.items.splice(i, 1); this.smashed++; this.api.S.stats.smashed++;
        this.api.score(SCORE.SMASH, '+50', it.x, it.y - 30);
        this.api.sfx('bam'); this.api.shake(12, 0.25); this.api.slowmo(0.35, 0.18);
        this.api.particles.papers(it.x, it.y, 14); this.api.particles.emit(it.x, it.y, { n: 16, colors: ['#ffe600', '#ff6b6b', '#fff', '#f97316'] });
        this.api.particles.text(pick(['BAM!', 'SMASH!', 'DELETED', 'REJECTED', 'WHAM!', 'NOPE!', 'CRUNCH', 'YEET']), it.x, it.y - 20, { impact: true, size: 72, color: pick(['#ffe600', '#ff6b6b', '#fff']) });
        return;
      }
    }
  }
  draw(ctx) {
    // rage backdrop
    const g = ctx.createRadialGradient(400, 400, 100, 640, 360, 1000); g.addColorStop(0, '#7f1d1d'); g.addColorStop(1, '#1a0000'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + this.t * 0.6; ctx.beginPath(); ctx.moveTo(400, 420); ctx.lineTo(400 + Math.cos(a) * 1500, 420 + Math.sin(a) * 1500); ctx.stroke(); } ctx.restore();
    drawSoung(ctx, 260, 720, 1.5, { mood: 'rage', arms: 'up', t: this.t, tilt: Math.sin(this.t * 30) * 0.04 });
    for (const it of this.items) {
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot + Math.sin(this.t * 4 + it.x) * 0.05);
      const pop = Math.min(1, it.t / 0.15); ctx.scale(pop, pop);
      fillR(ctx, -it.w / 2, -it.h / 2, it.w, it.h, 10, it.color, it.stroke, 4);
      txt(ctx, it.icon, -it.w / 2 + 28, 0, { size: 30 });
      txt(ctx, it.label, 12, 1, { size: it.w > 150 ? 17 : 15, color: ['#374151', '#0f172a', '#ef4444'].includes(it.color) ? '#fff' : '#111' });
      ctx.restore();
    }
    // Pat peeking from the bottom-right corner, very concerned
    { const k = Math.min(1, Math.max(0, (this.t - 1.4) / 0.4)); ctx.save(); ctx.beginPath(); ctx.rect(1000, 0, 280, 720); ctx.clip(); drawPat(ctx, 1200, 720 + 250 * (1 - k), 0.8, { t: this.t, arms: 'none', tilt: -0.35 + Math.sin(this.t * 25) * 0.02 }); ctx.restore(); if (k >= 1 && this.t < 6) bubble(ctx, 800, 470, 290, 70, PAT_QUOTES.grumpy.text, { tail: 'right', size: 21 }); }
    if (this.banner > 0) { const k = Math.min(1, (1.6 - this.banner) / 0.2); impact(ctx, 'FULL SOUNG MODE', 640, 300, 96 * k, '#ffe600', -0.06); impact(ctx, 'ACTIVATED', 640, 400, 80 * k, '#ff6b6b', 0.04); }
    else { txt(ctx, 'SMASH EVERYTHING', 820, 118, { size: 34, color: '#ffe600', stroke: '#111', strokeW: 6, font: IMPACT, weight: 400 }); }
    fillR(ctx, 1030, 104, 220, 26, 13, '#0b1220', '#374151', 2); fillR(ctx, 1033, 107, 214 * Math.max(0, 1 - this.t / this.dur), 20, 10, '#ff2d2d');
    txt(ctx, `${this.smashed} smashed`, 1140, 150, { size: 18, color: '#fff', stroke: '#111', strokeW: 3 });
  }
}
