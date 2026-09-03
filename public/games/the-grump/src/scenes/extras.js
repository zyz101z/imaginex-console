// extras.js — COWORKERS (enter your real coworkers' names) and TOP 10 (live leaderboard) screens off the title.
import { W, H } from '../engine.js';
import { txt, fillR, Button, IMPACT, wrapText } from '../draw.js';
import { drawOffice, drawMute, hitMute } from '../office.js';
import { drawPat, drawHeadIcon } from '../characters.js';
import { audio } from '../audio.js';
import { loadCoworkers, saveCoworkers, refreshCoworkers, loadName } from '../state.js';
import { TextEntry } from '../ui/textentry.js';
import { MEDALS, loadMedals } from '../medals.js';

export const GAME_ID = 'the-grump';
export function fetchTop(n = 10) {
  if (typeof fetch !== 'function') return Promise.resolve([]);
  return fetch(`/api/leaderboard?gameId=${GAME_ID}`).then(r => r.ok ? r.json() : []).then(rows => (Array.isArray(rows) ? rows : []).slice(0, n)).catch(() => []);
}

export class CoworkersScene {
  constructor(game) { this.game = game; this.t = 0; this.list = loadCoworkers(); this.entry = new TextEntry({ label: 'ADD A COWORKER (first name)', y: 330, max: 12 }); this.back = new Button(W / 2 - 120, 660, 240, 50, 'DONE', { color: '#22c55e', size: 22 }); }
  update(dt) { this.t += dt; }
  commit() { const v = this.entry.value.trim(); if (v && this.list.length < 8 && !this.list.some(n => n.toLowerCase() === v.toLowerCase())) { this.list.push(v); saveCoworkers(this.list); refreshCoworkers(); audio.play('good'); } this.entry.value = ''; this.entry.done = false; }
  pointerDown(p) {
    if (hitMute(p)) { audio.toggleMute(); return; }
    if (this.back.hit(p)) { audio.play('click'); this.game.showTitle(); return; }
    for (let i = 0; i < this.list.length; i++) { const b = this.chip(i); if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.list.splice(i, 1); saveCoworkers(this.list); refreshCoworkers(); audio.play('decline'); return; } }
    if (this.entry.pointerDown(p) === 'ok') this.commit();
  }
  keyDown(code) { if (code === 'Escape') { this.game.showTitle(); return; } if (this.entry.keyDown(code) === 'ok') this.commit(); }
  chip(i) { const w = 150, x = 60 + (i % 4) * (w + 12), y = 150 + Math.floor(i / 4) * 46; return { x, y, w, h: 38 }; }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.8)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, 'YOUR COWORKERS', 640, 60, { size: 44, font: IMPACT, weight: 400, color: '#ffe600', stroke: '#111', strokeW: 6 });
    txt(ctx, "They'll wander the hallway, steal your cover, raid your lunch and pop up over cubicles. Click a name to remove it. Up to 8.", 640, 105, { size: 16, color: '#d1d5db', weight: 500 });
    if (!this.list.length) txt(ctx, '(none yet — the office is full of strangers)', 640, 170, { size: 18, color: '#9ca3af', weight: 500 });
    this.list.forEach((n, i) => { const b = this.chip(i); fillR(ctx, b.x, b.y, b.w, b.h, 10, '#1f2937', '#ffe600', 2); txt(ctx, n + '  ✕', b.x + b.w / 2, b.y + b.h / 2 + 1, { size: 16, color: '#fff' }); });
    drawPat(ctx, 1150, 720, 0.75, { t: this.t, arms: 'wave' });
    this.entry.draw(ctx);
    this.back.draw(ctx, this.back.hit(this.game.engine.pointer)); drawMute(ctx, audio.muted);
  }
}

export class MedalsScene {
  constructor(game) { this.game = game; this.t = 0; this.have = loadMedals(); this.back = new Button(W / 2 - 120, 660, 240, 44, 'BACK', { color: '#3b82f6', size: 20 }); }
  update(dt) { this.t += dt; }
  pointerDown(p) { if (hitMute(p)) { audio.toggleMute(); return; } if (this.back.hit(p)) { audio.play('click'); this.game.showTitle(); } }
  keyDown() { this.game.showTitle(); }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.82)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, `🎖 MEDALS  ${this.have.size} / ${MEDALS.length}`, 640, 52, { size: 40, font: IMPACT, weight: 400, color: '#ffe600', stroke: '#111', strokeW: 6 });
    MEDALS.forEach((m, i) => {
      const col = i % 4, row = Math.floor(i / 4), x = 80 + col * 285, y = 95 + row * 135, got = this.have.has(m.id);
      fillR(ctx, x, y, 265, 120, 14, got ? 'rgba(255,230,0,0.14)' : 'rgba(17,24,39,0.9)', got ? '#ffe600' : '#374151', got ? 3 : 2);
      txt(ctx, got ? m.icon : '🔒', x + 34, y + 36, { size: got ? 30 : 24, alpha: got ? 1 : 0.6 });
      txt(ctx, m.title, x + 66, y + 30, { size: m.title.length > 16 ? 15 : 19, color: got ? '#ffe600' : '#9ca3af', align: 'left' });
      wrapText(ctx, m.desc, x + 132, y + 82, 240, 14, got ? '#fff' : '#6b7280');
    });
    this.back.draw(ctx, this.back.hit(this.game.engine.pointer)); drawMute(ctx, audio.muted);
  }
}

export class LeaderboardScene {
  constructor(game) { this.game = game; this.t = 0; this.rows = null; this.back = new Button(W / 2 - 120, 650, 240, 50, 'BACK', { color: '#3b82f6', size: 22 }); this.me = loadName(); }
  enter() { fetchTop(10).then(r => { this.rows = r; }); }
  update(dt) { this.t += dt; }
  pointerDown(p) { if (hitMute(p)) { audio.toggleMute(); return; } if (this.back.hit(p)) { audio.play('click'); this.game.showTitle(); } }
  keyDown() { this.game.showTitle(); }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.8)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, '🏆 TOP 10 GRUMPS', 640, 60, { size: 44, font: IMPACT, weight: 400, color: '#ffe600', stroke: '#111', strokeW: 6 });
    fillR(ctx, 290, 95, 700, 530, 16, 'rgba(17,24,39,0.92)', '#ffe600', 3);
    if (!this.rows) txt(ctx, 'loading' + '.'.repeat(1 + Math.floor(this.t * 3) % 3), 640, 360, { size: 24, color: '#9ca3af', weight: 500 });
    else if (!this.rows.length) txt(ctx, 'Nobody has survived a workday yet. Be the first.', 640, 360, { size: 22, color: '#d1d5db', weight: 500 });
    else this.rows.forEach((r, i) => { const y = 130 + i * 50, mine = this.me && r.nickname === this.me; if (mine) fillR(ctx, 300, y - 20, 680, 42, 8, 'rgba(255,230,0,0.12)'); txt(ctx, `${i + 1}.`, 340, y, { size: 24, color: i < 3 ? '#ffe600' : '#9ca3af', align: 'right' }); txt(ctx, r.nickname, 370, y, { size: 24, color: mine ? '#ffe600' : '#fff', align: 'left' }); txt(ctx, (r.score || 0).toLocaleString(), 950, y, { size: 24, color: '#fff', align: 'right' }); });
    drawPat(ctx, 1150, 720, 0.75, { t: this.t, arms: 'wave', tilt: -0.05 });
    this.back.draw(ctx, this.back.hit(this.game.engine.pointer)); drawMute(ctx, audio.muted);
  }
}
