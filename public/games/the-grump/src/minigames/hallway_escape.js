import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick, clamp } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice } from '../office.js';
import { drawSoung, drawCoworker, drawPat } from '../characters.js';
import { GRUMPY, PAT_QUOTES } from '../state.js';

const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];
class HallwayEscape extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 9; this.x = 640; this.targetX = null; this.cw = []; this.spawnT = 0.5; this.hits = 0; this.hurtT = 0; this.lastHit = ''; }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    const k = this.api.engine.keys; let dir = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) dir -= 1; if (k.has('ArrowRight') || k.has('KeyD')) dir += 1;
    if (dir) { this.x += dir * 560 * dt; this.targetX = null; }
    else if (this.targetX != null) { const d = this.targetX - this.x; this.x += clamp(d, -560 * dt, 560 * dt); }
    this.x = clamp(this.x, 200, 1080);
    this.spawnT -= dt; if (this.spawnT <= 0) { const pat = !this.patSpawned && this.t > 3; if (pat) this.patSpawned = true; this.cw.push({ x: rand(0.25, 0.75), k: 0, color: pick(COLORS), talk: false, speed: (pat ? 0.34 : rand(0.36, 0.5)) * this.diff, pat }); this.spawnT = rand(0.7, 1.1) / this.diff; }
    for (const c of this.cw) { c.k += c.speed * dt; if (!c.talk && c.k > 0.55) { c.talk = true; if (c.pat) this.api.say('there'); } }
    // screen position for a coworker: lane 0..1 across the hallway width at depth k
    const keep = [];
    for (const c of this.cw) {
      const p = this.pos(c);
      if (c.k >= 0.92) {
        if (!c.hit && Math.abs(p.x - this.x) < (c.pat ? 100 : 85)) { c.hit = true; this.hits++; this.hurtT = 0.6; this.lastHit = c.pat ? 'THERE HE IS!' : pick(['QUICK QUESTION!', 'GOT A SEC?', 'HEY SOUNG!', 'YOU LOOK BUSY, ANYWAY—']); this.api.grumpy(c.pat ? GRUMPY.PAT : GRUMPY.QUICK_QUESTION, c.pat ? 'CAUGHT BY PAT' : 'CAUGHT IN HALLWAY'); if (c.pat) this.api.say('gotasec'); this.api.shake(8, 0.25); this.api.particles.text(this.lastHit, this.x, 400, { impact: true, size: 56, color: '#ff6b6b' }); }
        if (c.k < 1.1) keep.push(c);
      } else keep.push(c);
    }
    this.cw = keep;
    if (this.t >= this.dur) { if (this.hits === 0) { this.api.score(300, '+300', 640, 300); this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'CLEAN ESCAPE', { sub: 'Made it to the desk. Headphones on.' }); } else this.finish(false, `CAUGHT ${this.hits}×`, { sub: 'The hallway is lava' }); }
  }
  pos(c) { const kk = c.k * c.k; return { x: W * 0.38 + (W * 0.24) * c.x + (c.x - 0.5) * W * 0.76 * kk, y: 150 + (H - 150) * kk * 0.92, s: 0.25 + 0.85 * kk }; }
  pointerDown(p) { this.targetX = p.x; }
  pointerMove(p) { if (this.api.engine.pointer.down) this.targetX = p.x; }
  draw(ctx) {
    drawOffice(ctx, this.t, 'hallway');
    const sorted = [...this.cw].sort((a, b) => a.k - b.k);
    for (const c of sorted) { const p = this.pos(c); if (c.pat) drawPat(ctx, p.x, p.y, p.s * 1.05, { t: this.t, walk: true, arms: 'wave' }); else drawCoworker(ctx, p.x, p.y, p.s, { t: this.t + c.x * 10, color: c.color }); if (c.talk && c.k < 0.92) bubble(ctx, p.x - (c.pat ? 110 : 80), p.y - 300 * p.s - 60, c.pat ? 220 : 160, 50, c.pat ? PAT_QUOTES.there.text : 'Hey Soung...', { size: 18 }); }
    drawSoung(ctx, this.x, 690, 0.95, { mood: this.hurtT > 0 ? 'angry' : 'annoyed', arms: 'walk', walk: true, t: this.t, tilt: this.hurtT > 0 ? Math.sin(this.t * 40) * 0.1 : 0 });
    txt(ctx, 'DODGE THE COWORKERS', 640, 118, { size: 26, color: '#fff', stroke: '#111', strokeW: 5 });
    txt(ctx, '← → keys, or drag', 640, 150, { size: 18, color: '#ffe600', stroke: '#111', strokeW: 3 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'hallway_escape', title: 'HALLWAY ESCAPE', tagline: 'Get back to your desk without being stopped', pat: false, create: (api, def) => new HallwayEscape(api, def) });
