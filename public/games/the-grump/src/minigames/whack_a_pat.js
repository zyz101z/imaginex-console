// WHACK-A-PAT — Pat pops up over cubicle walls. Bonk him before he asks. Don't bonk coworkers (HR).
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { HUD_H, drawOffice } from '../office.js';
import { drawSoung, drawHeadIcon, drawCoworker } from '../characters.js';
import { GRUMPY, PAT_QUOTES, coworkerName } from '../state.js';

export const CUBES = [[640, 330], [880, 330], [1120, 330], [460, 520], [700, 520], [940, 520], [1180, 520]];
class WhackAPat extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 10; this.pops = []; this.spawnT = 0.4; this.bonks = 0; this.missed = 0; this.hr = 0; this.hurtT = 0; this.bonkT = 0; this.combo = 0; }
  spawn() {
    const free = CUBES.map((c, i) => i).filter(i => !this.pops.some(p => p.cube === i)); if (!free.length) return;
    const r = Math.random(), kind = r < 0.22 ? 'coworker' : r < 0.32 ? 'bitcoin' : 'pat';
    this.pops.push({ cube: pick(free), kind, t: 0, up: rand(1.1, 1.5) / Math.sqrt(this.diff), state: 'rise', color: pick(['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']), line: pick(['quick', 'gotasec', 'notbusy', 'hearmeout', 'peekaboo']), who: kind === 'coworker' ? coworkerName() : '' });
    if (kind === 'bitcoin') this.api.say('bitcoin'); else if (kind === 'pat' && Math.random() < 0.25) this.api.say(this.pops[this.pops.length - 1].line);
    this.api.sfx('pop');
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt); this.bonkT = Math.max(0, this.bonkT - dt);
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.45, 0.7) / Math.sqrt(this.diff); }
    const keep = [];
    for (const p of this.pops) {
      p.t += dt;
      if (p.state === 'rise' && p.t >= p.up) {
        if (p.kind !== 'coworker') { this.missed++; this.hurtT = 0.5; this.combo = 0; this.api.grumpy(GRUMPY.SLACK, 'PAT ASKED'); this.api.sfx('wrong'); this.api.particles.text(PAT_QUOTES[p.line].text, CUBES[p.cube][0], CUBES[p.cube][1] - 120, { size: 22, color: '#ff6b6b' }); }
        p.state = 'sink'; p.t = 0;
      }
      if (p.state === 'bonked' && p.t > 0.45) continue;
      if (p.state === 'sink' && p.t > 0.25) continue;
      keep.push(p);
    }
    this.pops = keep;
    if (this.t >= this.dur) { if (this.missed <= 2 && this.hr === 0) { this.api.S.relief(); this.mood = 'smirk'; this.api.score(300, '+300', 640, 300); this.finish(true, `PAT BONKED ×${this.bonks}`, { sub: 'He will be back. He is always back.', pat: 'ow' }); } else this.finish(false, this.hr ? 'HR COMPLAINT' : 'PAT GOT HIS QUESTIONS IN', { sub: `${this.bonks} bonks · ${this.missed} questions · ${this.hr} wrong faces` }); }
  }
  height(p) { const k = p.state === 'rise' ? Math.min(1, p.t / 0.18) : p.state === 'sink' ? Math.max(0, 1 - p.t / 0.25) : Math.max(0, 1 - p.t / 0.15); return k; }
  pointerDown(pt) {
    if (this.done) return;
    for (const p of this.pops) {
      if (p.state !== 'rise') continue; const [cx, cy] = CUBES[p.cube], hy = cy - 95 * this.height(p);
      if (Math.hypot(pt.x - cx, pt.y - hy) < 70) {
        p.state = 'bonked'; p.t = 0; this.bonkT = 0.35;
        if (p.kind === 'coworker') { this.hr++; this.combo = 0; this.api.grumpy(GRUMPY.QUICK_QUESTION, 'WRONG PERSON'); this.api.sfx('wrong'); this.api.shake(6, 0.2); this.api.particles.text('HR COMPLAINT', cx, hy - 80, { impact: true, size: 40, color: '#ff6b6b' }); }
        else { this.bonks++; this.combo++; if (p.kind === 'bitcoin') this.bitcoins = (this.bitcoins || 0) + 1; const pts = (p.kind === 'bitcoin' ? 300 : 150) + (this.combo >= 3 ? 50 * Math.min(4, this.combo - 2) : 0); this.api.score(pts, this.combo >= 3 ? `COMBO ×${this.combo} +${pts}` : '+' + pts, cx, hy - 60); this.api.sfx('bonk'); this.api.shake(5, 0.15); this.api.particles.emit(cx, hy, { n: 10, colors: ['#ffe600', '#fff', '#f97316'], shape: 'circle' }); this.api.particles.text(pick(['BONK', 'WHAM', 'NOPE', 'DOWN']), cx, hy - 70, { impact: true, size: 52, color: '#ffe600' }); if (p.kind === 'bitcoin') this.api.say('soung_no_bitcoin'); else if (this.bonks % 3 === 0) this.api.say('ow'); else if (this.bonks % 3 === 1) this.api.say(pick(['soung_not_now', 'soung_go_away'])); }
        return;
      }
    }
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'openplan');
    txt(ctx, 'BONK PAT. NOT THE COWORKERS.', 640, HUD_H + 24, { size: 26, color: '#fff', stroke: '#111', strokeW: 5 });
    drawSoung(ctx, 250, 700, 0.95, { mood: this.hurtT > 0 ? 'angry' : this.bonkT > 0 ? 'rage' : 'annoyed', t: this.t, arms: this.bonkT > 0 ? 'up' : 'down' });
    if (this.bonkT > 0) txt(ctx, '📰', 330, 380 - this.bonkT * 120, { size: 50 });
    // rows back to front; each pop is drawn BEHIND its wall via a clip
    for (let row = 0; row < 2; row++) {
      const cubes = CUBES.map((c, i) => [c, i]).filter(([c]) => c[1] === (row === 0 ? 330 : 520));
      for (const [c, i] of cubes) {
        const p = this.pops.find(q => q.cube === i); const [cx, cy] = c;
        if (p) {
          const k = this.height(p), hy = cy - 95 * k; ctx.save(); ctx.beginPath(); ctx.rect(cx - 105, 0, 210, cy + 10); ctx.clip();
          if (p.kind === 'coworker') { drawCoworker(ctx, cx, hy + 190, 0.85, { t: this.t, color: p.color }); if (p.who) { fillR(ctx, cx - 50, hy - 92, 100, 24, 6, '#fff', '#111', 2); txt(ctx, p.who, cx, hy - 80, { size: 13, color: '#111' }); } }
          else { drawHeadIcon(ctx, 'pat', cx, hy, 150, p.state === 'bonked' ? 'excited' : 'happy'); }
          if (p.state === 'bonked') { txt(ctx, '💫', cx, hy - 60, { size: 40 }); }
          ctx.restore();
          // the Bitcoin sign is drawn OUTSIDE the wall clip (it was getting cut off) — held up over his head
          if (p.kind === 'bitcoin' && p.state !== 'bonked') { const bx = cx > 1000 ? cx - 225 : cx + 85; fillR(ctx, bx, hy - 70, 140, 44, 6, '#f7931a', '#111', 3); txt(ctx, '₿ BITCOIN?', bx + 70, hy - 48, { size: 18, color: '#fff' }); }
          if (p.state === 'rise' && p.t > 0.3 && p.kind !== 'coworker' && p.kind !== 'bitcoin') bubble(ctx, cx - 90, hy - 150, 180, 44, PAT_QUOTES[p.line].text, { size: 14 });
        }
        fillR(ctx, cx - 100, cy, 200, 130, 6, row ? '#b8bfc9' : '#a9b1bc', '#4b5563', 3); ctx.fillStyle = '#6b7280'; ctx.fillRect(cx - 100, cy, 200, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let yy = cy + 18; yy < cy + 124; yy += 12) ctx.fillRect(cx - 92, yy, 184, 4);   // fabric ribbing
        fillR(ctx, cx - 70, cy + 40, 44, 30, 3, '#1f2937', '#111', 2); fillR(ctx, cx + 30, cy + 36, 40, 26, 3, '#fde68a', '#d97706', 1);   // monitor + sticky note
      }
    }
    txt(ctx, `${this.bonks} bonks`, 1140, 150, { size: 18, color: '#fff', stroke: '#111', strokeW: 3 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'whack_a_pat', title: 'WHACK-A-PAT', tagline: 'He keeps popping up. Bonk him with the newspaper.', pat: true, create: (api, def) => new WhackAPat(api, def) });
