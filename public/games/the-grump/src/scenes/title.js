import { W, H, rand, pick } from '../engine.js';
import { txt, Button, fillR, impact, IMPACT, bubble } from '../draw.js';
import { drawOffice, drawMute, hitMute } from '../office.js';
import { drawSoung, drawPat, drawHeadIcon } from '../characters.js';
import { audio } from '../audio.js';
import { loadBest } from '../state.js';
import { SLACK_MSGS } from '../minigames/slack_attack.js';
import { PAT_QUOTES, BUILD } from '../state.js';

export class TitleScene {
  constructor(game) { this.game = game; this.t = 0; this.notes = []; this.noteT = 1; this.start = new Button(W / 2 - 170, 520, 340, 74, 'START WORKDAY', { color: '#22c55e', size: 30 }); this.how = new Button(W / 2 - 170, 610, 200, 60, 'HOW TO PLAY', { color: '#3b82f6', size: 22 }); this.intro = new Button(W / 2 + 40, 610, 130, 60, '▶ INTRO', { color: '#7c3aed', size: 22 }); this.best = loadBest(); }
  enter() { this.t = 0; this.notes = []; }
  update(dt) {
    this.t += dt; this.noteT -= dt;
    if (this.noteT <= 0 && this.notes.length < 14) { this.notes.push({ x: rand(120, 560), y: rand(330, 470), msg: pick(SLACK_MSGS), t: 0, rot: rand(-0.2, 0.2) }); this.noteT = rand(0.9, 1.6); if (this.notes.length > 2) audio.play('slack'); }
    for (const n of this.notes) n.t += dt;
    // Pat peeks in every ~7s
    const cyc = this.t % 11; if (cyc < dt && this.t > 2) { this.peekLine = pick(['soung', 'there', 'lunch']); if (this.notes.length > 1) audio.say(this.peekLine); }
  }
  pointerDown(p) {
    if (hitMute(p)) { audio.toggleMute(); return; }
    audio.ensure(); audio.startMusic('musicTitle');
    if (this.start.hit(p)) { audio.play('click'); this.game.play(); }
    else if (this.intro.hit(p)) { audio.play('click'); this.game.showIntro(true); }
    else if (this.how.hit(p)) { audio.play('click'); this.game.showHowTo(); }
  }
  keyDown(code) { if (code === 'Enter' || code === 'Space') { audio.ensure(); this.game.play(); } }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk');
    ctx.fillStyle = 'rgba(10,12,30,0.35)'; ctx.fillRect(0, 0, W, H);
    const mood = this.notes.length > 10 ? 'angry' : this.notes.length > 5 ? 'eyeroll' : 'annoyed';
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood, arms: 'typing', t: this.t, bob: true });
    for (const n of this.notes) { const k = Math.min(1, n.t / 0.2); ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.rot); ctx.scale(k, k); const w = n.msg.length * 10 + 70; fillR(ctx, -w / 2, -22, w, 44, 10, '#fff', '#4a154b', 3); drawHeadIcon(ctx, 'pat', -w / 2 + 22, 0, 30); txt(ctx, n.msg, -w / 2 + 44, 1, { size: 16, color: '#111', align: 'left' }); ctx.restore(); }
    { const cyc = this.t % 11; const k = cyc < 0.4 ? cyc / 0.4 : cyc < 3 ? 1 : cyc < 3.4 ? 1 - (cyc - 3) / 0.4 : 0; if (k > 0 && this.t > 2) { drawPat(ctx, W + 40 - 170 * k, 720, 0.85, { t: this.t, arms: 'wave', tilt: -0.3 }); if (k >= 1) bubble(ctx, W - 420, 440, 250, 70, PAT_QUOTES[this.peekLine || 'soung'].text, { tail: 'right', size: 20 }); } }
    const wob = Math.sin(this.t * 2) * 0.02;
    ctx.save(); ctx.translate(840, 200); ctx.rotate(wob);
    impact(ctx, 'THE', 0, -80, 64, '#fff', -0.03);
    impact(ctx, 'GRUMP', 0, 30, 160, '#ffe600', 0.02);
    ctx.restore();
    fillR(ctx, 640, 320, 400, 44, 22, '#111827', '#ffe600', 3); txt(ctx, 'A Corporate Survival Game', 840, 342, { size: 24, color: '#fff' });
    txt(ctx, 'MISSION: SURVIVE UNTIL 5:00 PM', 840, 400, { size: 26, color: '#ffe600', stroke: '#111', strokeW: 5 });
    if (this.best.score > 0) txt(ctx, `BEST: ${this.best.score.toLocaleString()}  ·  DAYS SURVIVED: ${this.best.survived}`, 840, 440, { size: 18, color: '#fff', stroke: '#111', strokeW: 3 });
    this.start.draw(ctx, this.start.hit(this.game.engine.pointer)); this.how.draw(ctx, this.how.hit(this.game.engine.pointer)); this.intro.draw(ctx, this.intro.hit(this.game.engine.pointer));
    drawMute(ctx, audio.muted);
    txt(ctx, `build ${BUILD} · click anywhere for sound`, 640, 705, { size: 14, color: '#d1d5db', weight: 500 });
  }
}

export class HowToScene {
  constructor(game) { this.game = game; this.t = 0; this.back = new Button(W / 2 - 120, 630, 240, 60, 'BACK', { color: '#3b82f6' }); }
  update(dt) { this.t += dt; }
  pointerDown(p) { if (hitMute(p)) { audio.toggleMute(); return; } if (this.back.hit(p)) { audio.play('click'); this.game.showTitle(); } }
  keyDown() { this.game.showTitle(); }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.75)'; ctx.fillRect(0, 0, W, H);
    fillR(ctx, 140, 60, 1000, 550, 20, '#111827', '#ffe600', 4);
    txt(ctx, 'HOW TO PLAY', 640, 105, { size: 44, font: IMPACT, weight: 400, color: '#ffe600' });
    const lines = [
      ['🕒', 'Survive from 8:01 AM to 5:00 PM. Each mini-game moves the clock.'],
      ['😤', 'The GRUMPY meter rises with every interruption. Wins calm it slightly.'],
      ['🔥', 'At 100% — FULL SOUNG MODE. Smash to COOL DOWN. Where the meter lands is where it stays.'],
      ['💀', 'Full Soung Mode uses one PATIENCE. Hit 100% with none left = Soung has had enough.'],
      ['⚠', 'When Pat shows up, something annoying is about to happen. Act fast.'],
      ['🖱', 'Mouse / touch for most games. Arrow keys or drag in the hallway.'],
      ['📅', 'At 4:58 PM a boss meeting appears. DECLINE it. Repeatedly.'],
      ['⏸', 'ESC or the ⏸ button pauses. Main Menu ends the day.'],
    ];
    lines.forEach(([ic, s], i) => { txt(ctx, ic, 200, 165 + i * 54, { size: 30 }); txt(ctx, s, 240, 165 + i * 54, { size: 22, color: '#fff', align: 'left', weight: 500 }); });
    this.back.draw(ctx, this.back.hit(this.game.engine.pointer)); drawMute(ctx, audio.muted);
  }
}
