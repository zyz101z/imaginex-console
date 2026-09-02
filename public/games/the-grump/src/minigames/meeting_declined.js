// INVITE STORM — invites rain onto Soung's calendar. Click the junk to DECLINE it before it lands.
// Good invites (Team Lunch, RKTs, Early Release) are green: let those land — clicking them declines free food.
import { MiniGame, registerMinigame, drawTimer } from './registry.js';
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, bubble } from '../draw.js';
import { drawOffice, HUD_H } from '../office.js';
import { drawSoung, drawPat } from '../characters.js';
import { SCORE, GRUMPY, PAT_QUOTES } from '../state.js';

export const USELESS = ['Sync on the Sync', 'Pre-Meeting for the Meeting', 'Q3 Alignment Alignment', 'Optional (Mandatory) Town Hall', 'Brainstorm: Brainstorming', "'Quick' Check-in (2 hrs)", 'Retro on the Retro', 'Circle-Back Session', 'Deep Dive Kickoff', 'Status Update Status Update', 'Touch Base Touchpoint', 'Ideation Jam (no agenda)', 'Reply-All Debrief'];
export const IMPORTANT = ['🍕 Team Lunch', '🍚 Free RKTs in the Break Room', '🏖 Early Release Friday'];
const CAL_Y = 590;

class InviteStorm extends MiniGame {
  constructor(api, def) { super(api, def); this.dur = 10; this.cards = []; this.spawnT = 0.3; this.declined = 0; this.mistakes = 0; this.good = 0; this.react = ''; this.reactT = 0; this.patSaid = 0; }
  spawn() {
    const important = Math.random() < 0.22, title = important ? pick(IMPORTANT) : pick(USELESS);
    const w = Math.max(200, title.length * 11 + 50);
    this.cards.push({ x: rand(520 + w / 2, W - 30 - w / 2), y: HUD_H - 40, w, h: 54, title, important, vy: rand(150, 210) * this.diff * (important ? 0.85 : 1), rot: rand(-0.12, 0.12), t: 0 });
    if (important && title.includes('RKT')) this.api.say('rkt'); else if (this.patSaid++ % 6 === 0) this.api.say(pick(['meeting', 'addedyou', 'mentioned', 'five']));
    this.api.sfx('meeting');
  }
  update(dt) {
    super.update(dt); if (this.done) return;
    this.reactT = Math.max(0, this.reactT - dt);
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.55, 0.85) / this.diff; }
    const keep = [];
    for (const c of this.cards) {
      c.t += dt; c.y += c.vy * dt;
      if (c.y + c.h / 2 >= CAL_Y) {
        if (c.important) { this.good++; this.api.score(150, '+150', c.x, CAL_Y - 30); this.api.sfx('good'); this.say(c.title.includes('RKT') ? 'RKTs. FINALLY.' : 'FREE FOOD. FINE.'); this.api.particles.emit(c.x, CAL_Y, { n: 10, colors: ['#22c55e', '#bbf7d0', '#fff'], shape: 'circle' }); }
        else { this.mistakes++; this.api.grumpy(GRUMPY.MEETING, 'AUTO-ACCEPTED'); this.api.shake(6, 0.2); this.api.sfx('wrong'); this.say('AUTO-ACCEPTED. GREAT.'); }
        continue;
      }
      keep.push(c);
    }
    this.cards = keep;
    if (this.t >= this.dur) { if (this.mistakes === 0) { this.api.S.relief(); this.mood = 'smirk'; this.finish(true, 'CALENDAR CLEARED', { sub: `${this.declined} declined · ${this.good} snacks accepted` }); } else this.finish(false, 'CALENDAR CHAOS', { sub: `${this.mistakes} slipped through`, pat: 'addedyou' }); }
  }
  say(s) { this.react = s; this.reactT = 0.9; }
  pointerDown(p) {
    if (this.done) return;
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      if (Math.abs(p.x - c.x) < c.w / 2 + 6 && Math.abs(p.y - c.y) < c.h / 2 + 8) {
        this.cards.splice(i, 1);
        if (c.important) { this.mistakes++; this.api.grumpy(GRUMPY.QUICK_QUESTION, 'DECLINED FREE FOOD'); this.api.sfx('wrong'); this.api.shake(6, 0.2); this.say(c.title.includes('RKT') ? 'YOU DECLINED RKTs?!?!' : 'YOU DECLINED FREE FOOD?!'); this.api.say('soung_seriously'); }
        else { this.declined++; this.api.S.stats.meetingsDeclined++; this.api.score(SCORE.MEETING_DECLINED, '+250', c.x, c.y); this.api.sfx('decline'); this.api.particles.papers(c.x, c.y, 6); this.api.particles.text(pick(['DECLINED', 'NO.', 'NOPE', 'PASS']), c.x, c.y - 30, { impact: true, size: 40, color: '#ff6b6b' }); if (this.declined % 5 === 0) this.api.say('soung_no'); }
        return;
      }
    }
  }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: this.reactT > 0 ? (this.react.includes('FINALLY') || this.react.includes('FINE') ? 'smirk' : 'angry') : 'deadpan', t: this.t });
    drawPat(ctx, 1150, 700, 0.85, { t: this.t, arms: 'wave', tilt: -0.04 }); txt(ctx, '📨', 1090, 400, { size: 32 });
    // calendar strip
    fillR(ctx, 500, CAL_Y, 760, 100, 10, '#fff', '#111', 3); ctx.fillStyle = '#2563eb'; ctx.fillRect(500, CAL_Y, 760, 26);
    txt(ctx, "📅 SOUNG'S CALENDAR — today", 880, CAL_Y + 13, { size: 15, color: '#fff' });
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(520 + i * 82, CAL_Y + 36, 74, 54); txt(ctx, `${9 + i}:00`, 557 + i * 82, CAL_Y + 50, { size: 12, color: '#6b7280', weight: 500 }); }
    for (const c of this.cards) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot + Math.sin(c.t * 5) * 0.03);
      fillR(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 10, '#fff', c.important ? '#16a34a' : '#dc2626', 4);
      fillR(ctx, -c.w / 2, -c.h / 2, 12, c.h, 10, c.important ? '#16a34a' : '#dc2626'); ctx.fillStyle = c.important ? '#16a34a' : '#dc2626'; ctx.fillRect(-c.w / 2 + 6, -c.h / 2, 6, c.h);
      txt(ctx, (c.important ? '' : '📅 ') + c.title, 6, 1, { size: 17, color: '#111' });
      ctx.restore();
    }
    txt(ctx, 'DECLINE THE RED · LET THE GREEN LAND', 640, HUD_H + 24, { size: 24, color: '#fff', stroke: '#111', strokeW: 5 });
    if (this.reactT > 0) txt(ctx, this.react, 330, 160, { size: 30, color: '#ffe600', stroke: '#111', strokeW: 6 });
    drawTimer(ctx, this.dur - this.t, this.dur, txt, fillR);
  }
}
registerMinigame({ id: 'meeting_declined', title: 'INVITE STORM', tagline: 'Decline the junk. Never decline the RKTs.', pat: false, create: (api, def) => new InviteStorm(api, def) });
