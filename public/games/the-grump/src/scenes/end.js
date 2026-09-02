// end.js — game-over + win cinematics with stats.
import { W, H, rand, pick } from '../engine.js';
import { txt, fillR, Button, impact, IMPACT, bubble, wrapText } from '../draw.js';
import { drawOffice, drawMute, hitMute } from '../office.js';
import { drawSoung, drawPat, drawHeadIcon } from '../characters.js';
import { audio } from '../audio.js';
import { fmtClock, loadBest, saveBest, PAT_QUOTES, grade } from '../state.js';

function statRows(S) {
  return [['Minutes Survived', S.minutesSurvived], ['Meetings Declined', S.stats.meetingsDeclined], ['Slack Messages Ignored', S.stats.slackIgnored], ['Times Pat Was Avoided', S.stats.patAvoided], ['Best Win Streak', S.stats.bestStreak || 0], ['Maximum Grumpy Level', Math.round(S.stats.maxGrumpy) + '%'], ['Things Smashed', S.stats.smashed], ['SOUNG SCORE', S.score.toLocaleString()]];
}
function drawStats(ctx, S, x, y) {
  fillR(ctx, x, y, 600, 372, 16, 'rgba(17,24,39,0.92)', '#ffe600', 3); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 466, y + 12, 122, 348);
  statRows(S).forEach(([k, v], i) => { const last = i === 7; txt(ctx, k, x + 24, y + 30 + i * 40, { size: last ? 22 : 19, color: last ? '#ffe600' : '#d1d5db', align: 'left', weight: last ? 700 : 500 }); txt(ctx, String(v), x + 436, y + 30 + i * 40, { size: last ? 26 : 22, color: last ? '#ffe600' : '#fff', align: 'right' }); });
  // report card stamp
  const [g, note] = grade(S.score); const gc = g === 'S' || g === 'A' ? '#22c55e' : g === 'D' ? '#ef4444' : '#f97316'; txt(ctx, 'REPORT CARD', x + 527, y + 34, { size: 13, color: '#9ca3af' }); ctx.save(); ctx.translate(x + 527, y + 110); ctx.rotate(-0.12); fillR(ctx, -44, -44, 88, 88, 12, 'rgba(0,0,0,0.35)', gc, 5); txt(ctx, g, 0, 2, { size: 62, color: gc, font: "'Bangers', Impact, sans-serif", weight: 400 }); ctx.restore(); wrapText(ctx, note, x + 527, y + 215, 110, 14, '#e5e7eb');
}
function submitScore(S, survived) {
  const best = loadBest(); const nb = { score: Math.max(best.score, S.score), survived: best.survived + (survived ? 1 : 0), days: best.days + 1 }; saveBest(nb);
  try { if (typeof window !== 'undefined' && window.parent && window.parent !== window) window.parent.postMessage({ type: 'imaginex-score', gameId: 'the-grump', score: S.score, nickname: 'Soung' }, '*'); else if (typeof fetch === 'function') fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: 'Soung', gameId: 'the-grump', score: S.score }) }).catch(() => {}); } catch {}
}

export class GameOverScene {
  constructor(game, S) { this.game = game; this.S = S; this.t = 0; this.btn = new Button(W / 2 + 90, 600, 380, 70, 'TRY ANOTHER WORKDAY', { color: '#22c55e', size: 26 }); this.title = new Button(W / 2 + 90, 680, 380, 34, 'MAIN MENU', { color: '#3b82f6', size: 18, shadow: 3 }); this.line = pick(['Nobody saw him leave.', 'He took the stairs.', 'His status is now: Offline. Forever.']); submitScore(S, false); }
  enter() { audio.stopMusic(); audio.play('lose'); setTimeout(() => audio.say('grumpy'), 1200); }
  update(dt) { this.t += dt; }
  pointerDown(p) { if (hitMute(p)) { audio.toggleMute(); return; } if (this.btn.hit(p)) { audio.play('click'); this.game.startWorkday(); } if (this.title.hit(p)) { audio.play('click'); this.game.showTitle(); } }
  keyDown(code) { if (code === 'Enter' || code === 'Space') this.game.startWorkday(); }
  draw(ctx) {
    drawOffice(ctx, this.t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.55)'; ctx.fillRect(0, 0, W, H);
    const x = Math.min(1180, 330 + this.t * 140);
    drawSoung(ctx, x, 690, 1.0, { mood: 'deadpan', arms: 'walk', walk: x < 1180, t: this.t });
    if (this.t > 1) { drawPat(ctx, Math.min(x - 200, 900), 690, 0.95, { t: this.t, walk: x < 1180, arms: 'wave' }); }
    impact(ctx, 'SOUNG HAS HAD ENOUGH', 640, 120, 76, '#ff6b6b', -0.03);
    txt(ctx, `Clocked out at ${fmtClock(this.S.clock)}. ${this.line}`, 640, 185, { size: 22, color: '#fff', stroke: '#111', strokeW: 4 });
    drawStats(ctx, this.S, 60, 240);
    if (this.t > 1) { const q = PAT_QUOTES[this.t < 4 ? 'grumpy' : 'mentioned'].text; fillR(ctx, 700, 215, 460, 64, 12, '#fff', '#4a154b', 3); drawHeadIcon(ctx, 'pat', 736, 247, 40); txt(ctx, 'PAT', 766, 235, { size: 14, color: '#4a154b', align: 'left' }); txt(ctx, q, 766, 259, { size: 20, color: '#111', align: 'left', weight: 500 }); }
    this.btn.draw(ctx, this.btn.hit(this.game.engine.pointer)); this.title.draw(ctx, this.title.hit(this.game.engine.pointer)); drawMute(ctx, audio.muted);
  }
}

export class WinScene {
  constructor(game, S) { this.game = game; this.S = S; this.t = 0; this.btn = new Button(W / 2 + 90, 600, 380, 70, 'ANOTHER WORKDAY?', { color: '#22c55e', size: 26 }); this.title = new Button(W / 2 + 90, 680, 380, 34, 'TITLE', { color: '#3b82f6', size: 18, shadow: 3 }); this.played = {}; submitScore(S, true); }
  enter() { audio.stopMusic(); }
  cue(name, at, fn) { if (this.t >= at && !this.played[name]) { this.played[name] = true; fn(); } }
  update(dt) {
    this.t += dt;
    this.cue('quiet', 0, () => audio.play('tick'));
    this.cue('victory', 1.6, () => audio.play('victory'));
    this.cue('glasses', 3.6, () => { audio.play('good'); setTimeout(() => audio.say('soung_deal_with_it'), 500); });
    this.cue('pat', 8.4, () => { audio.play('patAlarm'); setTimeout(() => audio.say('beforeyougo'), 500); });
    this.cue('freeze', 9.3, () => audio.play('horn'));
  }
  pointerDown(p) { if (hitMute(p)) { audio.toggleMute(); return; } if (this.t < 9.6) { this.t = 9.6; return; } if (this.btn.hit(p)) { audio.play('click'); this.game.startWorkday(); } if (this.title.hit(p)) this.game.showTitle(); }
  keyDown(code) { if (this.t < 9.6) this.t = 9.6; else if (code === 'Enter' || code === 'Space') this.game.startWorkday(); }
  draw(ctx) {
    const t = this.t;
    drawOffice(ctx, t, 'desk');
    const dusk = Math.min(0.45, t * 0.1); ctx.fillStyle = `rgba(30,20,60,${dusk})`; ctx.fillRect(0, 0, W, H);
    if (t < 5) {
      drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: t < 3.6 ? 'deadpan' : 'cool', arms: t < 3.6 ? 'typing' : 'cross', t });
      if (t >= 3.6 && t < 4.2) { const k = (t - 3.6) / 0.6; txt(ctx, '🕶', 330, 220 + k * 110, { size: 60, alpha: 1 - k * 0.5 }); }
      if (t < 1.6) impact(ctx, '5:00 PM', 640, 300, 120, '#fff', 0);
      else impact(ctx, 'SOUNG SURVIVED THE WORKDAY', 640, 200, 66, '#ffe600', -0.02);
      if (t >= 4.2) txt(ctx, 'Deal with it.', 330, 520, { size: 26, color: '#fff', stroke: '#111', strokeW: 4 });
    } else if (t < 9.3) {
      const k = Math.min(1, (t - 5) / 3.2), x = 330 + k * 700;
      drawSoung(ctx, x, 690, 1.0, { mood: 'cool', arms: 'walk', walk: k < 1, t });
      fillR(ctx, 1120, 340, 110, 330, 6, '#8b5e3c', '#111', 4); txt(ctx, 'EXIT', 1175, 320, { size: 26, color: '#16a34a', stroke: '#111', strokeW: 4 });
      if (t >= 8.4) { const pk = Math.min(1, (t - 8.4) / 0.5); drawPat(ctx, 1330 - 190 * pk, 690, 1, { t, walk: pk < 1, arms: 'wave' }); if (pk >= 1) bubble(ctx, 780, 260, 320, 80, 'Hey Soung, before you go...', { tail: 'right', size: 22 }); }
    } else {
      // freeze frame — Soung looks at the camera
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, W, H); drawOffice(ctx, 9.3, 'desk'); ctx.fillStyle = 'rgba(40,30,70,0.45)'; ctx.fillRect(0, 0, W, H);
      drawSoung(ctx, 1030, 690, 1.0, { mood: 'deadpan', arms: 'down', t: 9.3, tilt: -0.08 });
      drawPat(ctx, 1140, 690, 1, { t: 9.3, arms: 'wave' }); bubble(ctx, 780, 260, 320, 80, 'Hey Soung, before you go...', { tail: 'right', size: 22 });
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 140);
      impact(ctx, 'TO BE CONTINUED', 640, 70, 80, '#ffe600', -0.02);
      drawStats(ctx, this.S, 60, 160);
      txt(ctx, `+5,000 SURVIVED · Soung Score ${this.S.score.toLocaleString()}`, 860, 540, { size: 22, color: '#ffe600', stroke: '#111', strokeW: 4 });
      this.btn.draw(ctx, this.btn.hit(this.game.engine.pointer)); this.title.draw(ctx, this.title.hit(this.game.engine.pointer));
    }
    if (t < 9.3) txt(ctx, 'click to skip', 1180, 700, { size: 14, color: '#d1d5db', weight: 500 });
    drawMute(ctx, audio.muted);
  }
}
