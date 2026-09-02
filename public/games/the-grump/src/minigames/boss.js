import { MiniGame, registerMinigame } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, Button, impact } from '../draw.js';
import { drawOffice } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { bubble } from '../draw.js';
import { SCORE, GRUMPY, PAT_QUOTES } from '../state.js';
import { USELESS } from './meeting_declined.js';

const BOSS_HP = 18;
class JustOneMoreThing extends MiniGame {
  constructor(api, def) {
    super(api, def); this.hp = api.S.bossHp ?? BOSS_HP; this.btn = new Button(560, 420, 260, 88, 'DECLINE', { color: '#ef4444', size: 34 });
    this.moveT = 0.9; this.invites = []; this.spawnT = 1.5; this.intro = 2.2; this.hitT = 0; this.phase = 1; this.hits = 0; this.taunt = 'NEW MEETING — 4:59 PM'; this.tauntT = 0;
    this.vx = 260; this.vy = 180; this.decoys = [];
    if (this.hp < BOSS_HP) { this.phase = this.hp <= Math.floor(BOSS_HP / 2) ? 2 : 1; this.intro = 1.0; this.taunt = 'STILL PENDING: ' + this.hp + ' MORE'; this.tauntT = 2; }   // resumed after a Full Soung Mode interruption — damage sticks // phase-2 trap buttons that shadow the real one
    api.audio.startMusic('musicBoss'); this.lineT = 2.4; this.line = 'meeting'; this.lines = ['meeting', 'addedyou', 'five', 'saidyes', 'look', 'toldthem', 'idea', 'hearmeout'];
  }
  moveBtn() { // burst to a new heading (the button GLIDES, it doesn't teleport)
    // slows as the meeting takes damage, so the fight always converges (was: constant speed → could drag on forever)
    const tired = 1 - 0.45 * (1 - this.hp / BOSS_HP);
    const sp = (this.phase === 2 ? 360 : 260) * tired, a = rand(0, Math.PI * 2); this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.moveT = rand(0.6, 1.0);
    if (this.phase === 2 && this.decoys.length < 2) this.decoys.push(new Button(rand(440, 1000), rand(260, 560), 240, 80, pick(['ACCEPT ALL', 'REPLY ALL']), { color: '#b91c1c', size: 30 }));
  }
  glide(dt) {
    const b = this.btn; b.x += this.vx * dt; b.y += this.vy * dt;
    if (b.x < 440 || b.x > 1020) { this.vx *= -1; b.x = Math.max(440, Math.min(1020, b.x)); } if (b.y < 240 || b.y > 600) { this.vy *= -1; b.y = Math.max(240, Math.min(600, b.y)); }
    for (const d of this.decoys) { d.x += Math.sin(this.t * 3 + d.y) * 120 * dt; d.y += Math.cos(this.t * 2.2 + d.x) * 90 * dt; d.x = Math.max(440, Math.min(1020, d.x)); d.y = Math.max(240, Math.min(600, d.y)); }
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.hitT = Math.max(0, this.hitT - dt); this.tauntT = Math.max(0, this.tauntT - dt);
    if (this.t < this.intro) return;
    this.lineT -= dt; if (this.lineT <= 0) { this.line = this.lines[(this.lines.indexOf(this.line) + 1) % this.lines.length]; this.api.say(this.line); this.lineT = 4.6; }
    this.moveT -= dt; if (this.moveT <= 0) this.moveBtn(); this.glide(dt);
    this.spawnT -= dt; if (this.spawnT <= 0) { const side = Math.random() < 0.5; this.invites.push({ x: side ? -100 : W + 100, y: rand(150, 600), vx: (side ? 1 : -1) * rand(150, 230) * (this.phase === 2 ? 1.4 : 1), title: pick(USELESS) }); this.spawnT = (this.phase === 2 ? 1.1 : 1.6); this.api.sfx('meeting'); }
    const keep = [];
    for (const inv of this.invites) { inv.x += inv.vx * dt; if (Math.abs(inv.x - 330) < 50) { this.api.grumpy(2, 'INVITE HIT'); this.api.shake(5, 0.15); this.api.sfx('wrong'); } else if (inv.x > -150 && inv.x < W + 150) keep.push(inv); }
    this.invites = keep;
  }
  pointerDown(p) {
    if (this.done || this.t < this.intro) return;
    for (const d of this.decoys) if (d.hit(p)) { this.api.grumpy(GRUMPY.QUICK_QUESTION, d.label); this.api.sfx('wrong'); this.api.shake(8, 0.25); this.api.say(d.label === 'REPLY ALL' ? 'replyall' : 'saidyes'); this.api.particles.text(d.label + '?!', p.x, p.y - 40, { impact: true, size: 50, color: '#ff6b6b' }); d.x = rand(440, 1000); d.y = rand(260, 560); return; }
    const near = p.x >= this.btn.x - 18 && p.x <= this.btn.x + this.btn.w + 18 && p.y >= this.btn.y - 18 && p.y <= this.btn.y + this.btn.h + 18;   // forgiving edge
    if (near) {
      this.hp--; this.hits++; this.api.S.bossHp = this.hp; this.hitT = 0.25; this.api.sfx('bam'); if (this.hits % 4 === 1) this.api.say('soung_no'); this.api.shake(10, 0.2); this.api.particles.papers(p.x, p.y, 8);
      this.api.particles.text(pick(['NO.', 'DECLINE!', 'NOPE', 'ABSOLUTELY NOT', 'BAM!', 'WHAM!']), p.x, p.y - 40, { impact: true, size: 54, color: pick(['#ffe600', '#ff6b6b', '#fff']) });
      if (this.hp === Math.floor(BOSS_HP / 2)) { this.phase = 2; this.taunt = 'RESCHEDULED: 4:59:30 PM'; this.tauntT = 2; this.api.sfx('patAlarm'); this.line = 'saidyes'; this.lineT = 3.2; this.api.say('saidyes'); this.api.flash('#ef4444', 0.25); }
      if (this.hp <= 0) { this.api.score(SCORE.BOSS, '+1500', 640, 300); this.api.S.stats.meetingsDeclined++; this.api.sfx('victory'); this.api.slowmo(0.25, 0.8); this.api.flash('#fff', 0.5); this.api.audio.stopMusic(); this.api.S.bossHp = undefined; this.finish(true, 'MEETING DECLINED', { sub: 'The calendar is quiet.', boss: true }); }
      this.moveBtn(); return;
    }
    for (let i = this.invites.length - 1; i >= 0; i--) { const inv = this.invites[i]; if (Math.abs(p.x - inv.x) < 130 && Math.abs(p.y - inv.y) < 34) { this.invites.splice(i, 1); this.api.score(100, '+100', inv.x, inv.y); this.api.sfx('decline'); this.api.particles.emit(inv.x, inv.y, { n: 6 }); return; } }
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    // dramatic vignette
    const v = ctx.createRadialGradient(640, 360, 200, 640, 360, 900); v.addColorStop(0, 'rgba(120,0,0,0)'); v.addColorStop(1, `rgba(90,0,0,${0.35 + Math.sin(this.t * 6) * 0.08})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: this.hitT > 0 ? 'angry' : 'rage', arms: 'up', t: this.t, steam: true });
    // boss calendar card
    const sh = this.hitT > 0 ? Math.sin(this.t * 60) * 6 : 0, scale = 1 + (this.t < this.intro ? Math.sin(this.t * 6) * 0.04 : 0);
    ctx.save(); ctx.translate(800 + sh, 210); ctx.scale(scale, scale);
    fillR(ctx, -260, -90, 520, 150, 16, '#fff', '#111', 5); fillR(ctx, -260, -90, 520, 44, 16, '#b91c1c'); ctx.fillStyle = '#b91c1c'; ctx.fillRect(-260, -60, 520, 14);
    txt(ctx, '📅 NEW MEETING', 0, -68, { size: 22, color: '#fff' });
    txt(ctx, this.phase === 2 ? '4:59:30 PM (moved)' : '4:59 PM', 0, -15, { size: 40, color: '#111', font: "'Bangers', Impact, sans-serif", weight: 400 });
    txt(ctx, '"Just one more thing..." — Pat', 0, 30, { size: 18, color: '#4b5563', weight: 500 });
    ctx.restore();
    drawPat(ctx, 1140, 700, 0.95, { t: this.t, arms: 'wave', tilt: Math.sin(this.t * 8) * 0.03 });
    if (this.t >= this.intro && this.lineT > 1.2) bubble(ctx, 830, 380, 300, 70, PAT_QUOTES[this.line].text, { tail: 'right', size: 20 });
    // boss health bar
    fillR(ctx, 480, 300, 640, 30, 15, '#0b1220', '#374151', 3); fillR(ctx, 484, 304, 632 * Math.max(0, this.hp / BOSS_HP), 22, 11, this.phase === 2 ? '#f97316' : '#b91c1c');
    txt(ctx, `4:59 PM MEETING  ${Math.max(0, this.hp)}/${BOSS_HP}`, 800, 316, { size: 18, color: '#fff', stroke: '#111', strokeW: 3 });
    for (const inv of this.invites) { fillR(ctx, inv.x - 130, inv.y - 30, 260, 60, 10, '#fff', '#b91c1c', 3); txt(ctx, '📅 ' + inv.title, inv.x, inv.y + 1, { size: 16, color: '#111' }); }
    if (this.t >= this.intro) { for (const d of this.decoys) d.draw(ctx, false); this.btn.draw(ctx, this.btn.hit(this.api.pointer)); txt(ctx, this.phase === 2 ? 'SMASH DECLINE — DODGE THE TRAPS!' : 'SMASH DECLINE!', 800, 118, { size: 30, color: '#ffe600', stroke: '#111', strokeW: 6 }); }
    else { impact(ctx, 'JUST ONE MORE THING', 800, 500, 60 + Math.sin(this.t * 8) * 4, '#ff6b6b', -0.05); txt(ctx, 'BOSS FIGHT', 800, 560, { size: 26, color: '#fff', stroke: '#111', strokeW: 5 }); }
    if (this.tauntT > 0) impact(ctx, this.taunt, 800, 620, 46, '#f97316', 0.05);
    txt(ctx, '4:58 PM', 640, 690, { size: 22, color: '#fff', stroke: '#111', strokeW: 4 });
  }
}
registerMinigame({ id: 'boss', title: 'JUST ONE MORE THING', tagline: 'A 4:59 PM meeting. Decline it into oblivion.', pat: true, special: 'boss', create: (api, def) => new JustOneMoreThing(api, def) });
