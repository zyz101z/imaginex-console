// LUNCH DEFENSE — hands reach in from everywhere to steal Soung's lunch. Slap them. Shoo Pat off the chair.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble, impact } from '../draw.js';
import { drawOffice, HUD_H } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { SCORE, GRUMPY, PAT_QUOTES } from '../state.js';

const PLATE = { x: 640, y: 508 };   // on the table top (y 500–540), in front of Soung
const LANES = [[-1, 0], [-1, -0.45], [-1, 0.5], [1, 0], [1, -0.45], [1, 0.5], [0, -1], [-0.6, -1], [0.6, -1]]; // direction the hand comes FROM
const SKINS = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac', '#e0ac69'];
class LunchDefense extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 10; this.hands = []; this.spawnT = 0.5; this.pat = null; this.patT = 2.5; this.steals = 0; this.slaps = 0; this.hurtT = 0; this.patVisits = 0; }
  spawn() {
    const [dx, dy] = pick(LANES); const len = 520; const sx = PLATE.x + dx * len, sy = PLATE.y + dy * 300;
    this.hands.push({ sx, sy, k: 0, speed: rand(0.45, 0.68) * Math.sqrt(this.diff), skin: pick(SKINS), sleeve: pick(['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#111827']), slapped: 0, msg: pick(['just one chip', 'you gonna eat that?', 'sharing is caring', 'for the team', 'ooh what is that']) });
  }
  pos(h) { return { x: h.sx + (PLATE.x - h.sx) * h.k, y: h.sy + (PLATE.y - h.sy) * h.k }; }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.6, 0.95) / Math.sqrt(this.diff); }
    this.patT -= dt;
    if (!this.pat && this.patT <= 0) { this.pat = { x: 1330, pushes: 0 }; this.api.sfx('patAlarm'); this.api.say(this.patVisits++ ? 'there' : 'lunch'); }
    if (this.pat) { this.pat.x -= 120 * this.diff * dt; if (this.pat.x <= 880) { this.hit('PAT SAT DOWN', GRUMPY.QUICK_QUESTION); this.pat = null; this.patT = 3 / this.diff; } }
    const keep = [];
    for (const h of this.hands) {
      if (h.slapped > 0) { h.slapped -= dt; h.k -= dt * 1.8; if (h.k > -0.2) keep.push(h); continue; }
      h.k += h.speed * dt;
      if (h.k >= 0.86) { this.hit(pick(['CHIP STOLEN', 'A BITE. THEY TOOK A BITE.', 'FRIES: GONE']), GRUMPY.SLACK); continue; }
      keep.push(h);
    }
    this.hands = keep;
    if (this.t >= this.dur) {
      this.api.S.lunchDone = true;
      if (this.steals === 0) { this.api.score(SCORE.LUNCH, '+1000', 640, 300); this.api.S.stats.lunchesSaved++; this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'LUNCH PROTECTED', { sub: `${this.slaps} hands slapped. Sandwich intact.` }); }
      else if (this.steals <= 2) { this.api.score(500, '+500', 640, 300); this.api.S.stats.lunchesSaved++; this.mood = 'smirk'; this.finish(true, 'LUNCH (MOSTLY) SAVED', { sub: `${this.steals} bite${this.steals === 1 ? '' : 's'} lost, ${this.slaps} hands slapped.` }); }
      else this.finish(false, 'LUNCH RAIDED', { sub: `${this.steals} bites stolen. ${this.slaps} slapped.` });
    }
  }
  hit(msg, g) { this.steals++; this.hurtT = 0.5; this.api.grumpy(g, msg); this.api.shake(6, 0.2); this.api.sfx('wrong'); this.api.particles.text(msg, 640, 200, { size: 26, color: '#ff6b6b' }); }
  pointerDown(p) {
    if (this.done) return;
    if (this.pat && Math.abs(p.x - this.pat.x) < 90 && p.y > 300 && p.y < 700) { this.pat.x += 170; this.pat.pushes++; this.api.sfx('pop'); this.api.say(pick(['soung_eating', 'soung_not_today', 'soung_leave_me_alone'])); this.api.particles.text(pick(['"Not now, Pat."', '"Eating."', '"No."', '"Leave."']), this.pat.x, 330, { size: 26, color: '#fff' }); if (this.pat.x > 1330) { this.pat = null; this.patT = 2.5 / this.diff; this.api.score(200, '+200', 1000, 400); } return; }
    for (let i = this.hands.length - 1; i >= 0; i--) {
      const h = this.hands[i]; if (h.slapped > 0) continue; const q = this.pos(h);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 60) { h.slapped = 0.5; this.slaps++; this.api.score(100, '+100', q.x, q.y - 20); this.api.sfx('slap'); this.api.shake(3, 0.1); this.api.particles.text(pick(['SLAP!', 'NO.', 'MINE.', 'BACK OFF']), q.x, q.y - 50, { impact: true, size: 44, color: '#ffe600' }); this.api.particles.emit(q.x, q.y, { n: 6, colors: ['#fff', '#ffe600'], shape: 'circle' }); return; }
    }
  }
  drawHand(ctx, h) {
    const q = this.pos(h), ang = Math.atan2(PLATE.y - h.sy, PLATE.x - h.sx);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang);
    // sleeve + arm back toward the source
    // sleeve fades out toward the source instead of a full-screen bar
    const L = 210; const sg = ctx.createLinearGradient(-60 - L, 0, -60, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.35, h.sleeve); sg.addColorStop(1, h.sleeve);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-60 - L, -14); ctx.lineTo(-60, -22); ctx.lineTo(-60, 22); ctx.lineTo(-60 - L, 14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-60 - L * 0.6, -19); ctx.lineTo(-60, -22); ctx.moveTo(-60 - L * 0.6, 19); ctx.lineTo(-60, 22); ctx.stroke();
    ctx.fillStyle = h.skin; ctx.beginPath(); ctx.rect(-60, -18, 60, 36); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(10, 0, 34, 26, 0, 0, 7); ctx.fill(); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(28, i * 11 - 5, 26 - Math.abs(i) * 5, 10, 5) : ctx.rect(28, i * 11 - 5, 26 - Math.abs(i) * 5, 10); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    if (h.k > 0.25 && h.k < 0.6 && h.slapped <= 0) bubble(ctx, q.x - 80, q.y - 90, 160, 44, h.msg, { size: 15 });
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'cafeteria');
    // Soung sits BEHIND the table (drawn first), the table top covers his lap, the plate sits on the table in front of him.
    drawSoung(ctx, 640, 720, 1.0, { seated: true, mood: this.hurtT > 0 ? 'angry' : (this.done ? this.mood : 'deadpan'), t: this.t });
    fillR(ctx, 396, 540, 588, 130, 4, '#8a5f2c', '#5b3a1a', 3); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(396, 540, 588, 18);   // table skirt (hides the legs)
    fillR(ctx, 380, 500, 620, 40, 8, '#b07c48', '#5b3a1a', 3);
    // plate + food (shrinks as it gets stolen)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(PLATE.x, PLATE.y + 20, 110, 34, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.stroke();
    txt(ctx, '🥪', PLATE.x - 30, PLATE.y, { size: Math.max(28, 60 - this.steals * 6) }); txt(ctx, '🍟', PLATE.x + 45, PLATE.y - 4, { size: Math.max(20, 46 - this.steals * 5) });
    for (const h of this.hands) this.drawHand(ctx, h);
    if (this.pat) { drawPat(ctx, this.pat.x, 690, 0.95, { t: this.t, walk: true, arms: 'wave' }); bubble(ctx, this.pat.x - 320, 250, 300, 74, [PAT_QUOTES.lunch.text, PAT_QUOTES.there.text, PAT_QUOTES.gotasec.text][this.pat.pushes % 3], { tail: 'right', size: 20 }); }
    txt(ctx, 'SLAP THE HANDS · SHOO PAT · 10 SECONDS', 640, HUD_H + 24, { size: 24, color: '#fff', stroke: '#111', strokeW: 5 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'lunch_defense', title: 'LUNCH DEFENSE', tagline: 'Everyone wants a bite. Nobody gets one.', pat: true, special: 'lunch', create: (api, def) => new LunchDefense(api, def) });
