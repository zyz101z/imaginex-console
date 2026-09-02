// intro.js — the deadly-serious AAA opening. Black screen → narration → slow-mo coffee walk →
// laptop → 8:01 AM → Slack DING → horror → PAT DETECTED → "five minutes" → THE GRUMP slams in.
// Pure timeline: every beat is a function of this.t so it's headless-testable. Click/key skips.
import { W, H, easeOut } from '../engine.js';
import { txt, fillR, impact, IMPACT, bubble, rrect } from '../draw.js';
import { drawOffice } from '../office.js';
import { drawSoung, drawPat, drawHeadOnly, drawHeadIcon } from '../characters.js';
import { audio } from '../audio.js';
import { markIntroSeen } from '../state.js';

const MONO = "'Courier New', Consolas, monospace";
// Beat times (seconds). Tweak here; the draw code reads these names.
export const T = {
  slate: 0.4, slateMonday: 1.6, slateTime: 2.8, slateOut: 5.0,
  n1: 5.6, n2: 9.2, n3: 11.8, n4: 14.8, narrOut: 18.8,
  walk: 19.2, walkEnd: 23.8, sit: 24.2, laptop: 25.0, unread: 26.2, clock: 28.8, clockOut: 31.0,
  ding0: 31.4, ding1: 32.7, look: 33.3, ding2: 34.4, closeup: 35.2, closeupOut: 38.8, hud: 36.4,
  steps: 39.0, lookOver: 40.2, patIn: 40.8, detected: 41.6, patLine: 43.0, dots: 46.0, five: 47.4, hud17: 49.4, chair: 51.0,
  slam: 53.4, sub: 54.4, end: 56.6,
};

export class IntroScene {
  constructor(game, o = {}) { this.game = game; this.t = 0; this.played = {}; this.grumpyShown = 0; this.mandatory = !!o.mandatory; }
  enter() { audio.ensure(); audio.stopMusic(); }
  exit() { audio.stopMusic(); audio.stopVoices(); }
  cue(name, at, fn) { if (this.t >= at && !this.played[name]) { this.played[name] = true; fn(); } }
  finish() { markIntroSeen(); this.game.startWorkday(); }
  skip() { if (this.mandatory) return; this.finish(); }
  pointerDown() { this.skip(); }
  keyDown() { this.skip(); }
  update(dt) {
    this.t += dt; const t = this.t;
    this.cue('music', 0.1, () => audio.startMusic('musicCinematic'));
    this.cue('v0', T.slate + 0.3, () => audio.say('narr_offices'));
    this.cue('v1', T.n1, () => audio.say('narr_monday'));
    this.cue('v2', T.n2, () => audio.say('narr_soung'));
    this.cue('v3', T.n3, () => audio.say('narr_worse'));
    this.cue('v4', T.n4, () => audio.say('narr_goal'));
    this.cue('epic', T.walk, () => audio.startMusic('musicEpic'));
    this.cue('sit', T.sit, () => audio.play('land'));
    this.cue('laptop', T.laptop, () => audio.play('pop'));
    for (let i = 0; i < 10; i++) this.cue('unread' + i, T.unread + i * 0.22, () => audio.play('tick'));
    this.cue('quiet', T.clock, () => { audio.stopMusic(); audio.play('tick'); });
    this.cue('ding0', T.ding0, () => audio.play('slack'));
    this.cue('ding1', T.ding1, () => audio.play('slack'));
    this.cue('ding2', T.ding2, () => { audio.play('slack'); setTimeout(() => { audio.play('sting'); audio.startMusic('musicHorror'); }, 350); });
    this.cue('twitch', T.closeup + 0.8, () => audio.play('tick'));
    this.cue('hud', T.hud, () => audio.play('good'));
    for (let i = 0; i < 4; i++) this.cue('step' + i, T.steps + i * 0.42, () => audio.play('step'));
    this.cue('alarm', T.detected, () => { audio.stopMusic(); audio.play('patAlarm'); this.engine.shake(8, 0.5); });
    this.cue('alarm2', T.detected + 0.8, () => audio.play('patAlarm'));
    this.cue('patLine', T.patLine, () => audio.say('pat_intro_coming'));
    this.cue('five', T.five, () => audio.say('five'));
    this.cue('hud17', T.hud17, () => audio.play('grumble'));
    this.cue('chair', T.chair, () => { audio.say('pat_grab_chair'); audio.play('step'); });
    this.cue('slam', T.slam, () => { audio.stopVoices(); audio.play('bam'); audio.play('fullSoung'); this.engine.shake(16, 0.6); this.engine.flash('#fff', 0.2); });
    this.cue('title', T.sub, () => audio.startMusic('musicTitle'));
    if (t >= T.end) this.finish();
    // grumpy meter easing
    const target = t >= T.hud17 ? 17 : t >= T.hud ? 3 : 0;
    this.grumpyShown += (target - this.grumpyShown) * Math.min(1, dt * 4);
  }

  draw(ctx) {
    const t = this.t;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (t < T.narrOut) this.drawSlates(ctx, t);
    else if (t < T.slam) this.drawOffice(ctx, t);
    if (t >= T.slam) this.drawSlam(ctx, t);
    if (t < T.slam && !this.mandatory) txt(ctx, 'click to skip', 1180, 700, { size: 14, color: 'rgba(255,255,255,0.45)', weight: 500 });
  }

  fade(t, at, dur = 0.8) { return t < at ? 0 : Math.min(1, (t - at) / dur); }

  drawSlates(ctx, t) {
    const out = t > T.slateOut - 0.5 && t < T.slateOut ? 1 - (t - (T.slateOut - 0.5)) / 0.5 : 1;
    if (t < T.slateOut) {
      const a = out;
      txt(ctx, 'AMAZON CORPORATE OFFICES', 640, 300, { size: 34, font: MONO, weight: 700, color: '#e5e7eb', alpha: this.fade(t, T.slate) * a });
      txt(ctx, 'MONDAY', 640, 360, { size: 30, font: MONO, weight: 700, color: '#e5e7eb', alpha: this.fade(t, T.slateMonday) * a });
      txt(ctx, '08:00 AM', 640, 416, { size: 30, font: MONO, weight: 700, color: '#e5e7eb', alpha: this.fade(t, T.slateTime) * a });
      return;
    }
    const gone = t > T.narrOut - 0.6 ? 1 - (t - (T.narrOut - 0.6)) / 0.6 : 1;
    const lines = [[T.n1, 'For most people, it was just another Monday.', '#d1d5db', 30], [T.n2, 'For David Soung...', '#fff', 36], [T.n3, 'it was about to get much worse.', '#fca5a5', 36], [T.n4, 'He had one goal. Survive until 5:00 PM.', '#ffe600', 30]];
    lines.forEach(([at, s, c, size], i) => { const a = this.fade(t, at, 1.0) * gone; if (a > 0) txt(ctx, s, 640, 270 + i * 70, { size, color: c, weight: 500, alpha: a }); });
  }

  letterbox(ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 70); ctx.fillRect(0, H - 70, W, 70); }

  drawOffice(ctx, t) {
    const closeup = t >= T.closeup && t < T.closeupOut;
    if (closeup) { this.drawCloseup(ctx, t); return; }
    if (t >= T.clock && t < T.clockOut) { drawOffice(ctx, t, 'desk'); this.drawClock(ctx, t); this.letterbox(ctx); return; }
    drawOffice(ctx, t, 'desk');
    const slow = t < T.walkEnd;
    if (slow) {
      // slow-motion walk in from the left, coffee in hand
      const k = easeOut(Math.min(1, (t - T.walk) / (T.walkEnd - T.walk))), x = -140 + k * 470, tt = (t - T.walk) * 0.35;
      const r = drawSoung(ctx, x, 690, 1.0, { mood: 'deadpan', arms: 'walk', walk: k < 1, t: tt });
      this.drawCoffee(ctx, x + 88, 560 + Math.sin(tt * 12) * 3);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, W, H);
      this.letterbox(ctx);
      const a = this.fade(t, T.walk, 0.6) * (t > T.walkEnd - 0.4 ? (T.walkEnd - t) / 0.4 : 1);
      txt(ctx, 'SLOW MOTION', 640, 120, { size: 18, font: MONO, color: 'rgba(255,255,255,0.5)', alpha: Math.max(0, a) });
      return;
    }
    // seated at the desk
    const lookScreen = t >= T.look && t < T.closeup, lookOver = t >= T.lookOver;
    const mood = t >= T.chair ? 'rage' : t >= T.hud17 ? 'angry' : t >= T.ding2 ? 'annoyed' : t >= T.unread ? 'eyeroll' : 'deadpan';
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood, arms: 'typing', t, tilt: lookOver ? -0.12 : lookScreen ? 0.08 : 0, sweat: t >= T.five });
    // laptop on the desk (lid opens at T.laptop); desk front panel hides the legs
    const dg = ctx.createLinearGradient(0, 500, 0, 700); dg.addColorStop(0, '#d6a86a'); dg.addColorStop(1, '#b8874a');
    ctx.fillStyle = dg; ctx.fillRect(0, 500, W, 220); ctx.fillStyle = '#c69556'; ctx.fillRect(0, 500, W, 12);
    fillR(ctx, 480, 530, 220, 34, 6, '#111827', '#000'); ctx.fillStyle = '#374151'; for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) ctx.fillRect(490 + c * 17, 536 + r * 13, 13, 9);
    fillR(ctx, 760, 520, 70, 70, 10, '#fff', '#222', 3);
    const lid = t < T.laptop ? 0 : easeOut(Math.min(1, (t - T.laptop) / 0.8));
    fillR(ctx, 250, 496, 190, 14, 4, '#374151', '#111', 3);
    if (lid > 0) { const lh = 130 * lid; fillR(ctx, 254, 496 - lh, 182, lh, 6, '#1f2937', '#111', 3); if (lid > 0.5) { fillR(ctx, 262, 504 - lh, 166, lh - 16, 3, '#0ea5e9'); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(272, 512 - lh + i * 22, 60 + (i * 41) % 70, 6); } }
    // unread counter spins up on the laptop before the clock beat
    if (t >= T.unread && t < T.clock) { const k = Math.min(1, (t - T.unread) / 2.2), n = Math.floor(easeOut(k) * 247); fillR(ctx, 264, 396, 162, 56, 6, '#111827', '#ef4444', 3); txt(ctx, '📥 UNREAD', 345, 412, { size: 14, color: '#fca5a5' }); txt(ctx, String(n), 345, 436, { size: 24, color: '#fff', font: MONO, weight: 700 }); }   // on the laptop screen
    // Slack notifications
    const msgs = [[T.ding0, 'There he is!'], [T.ding1, 'Hey Soung...'], [T.ding2, 'Quick question.']];
    const gone = t >= T.patIn ? Math.max(0, 1 - (t - T.patIn) / 0.4) : 1;   // the Slack thread fades when Pat shows up in person
    msgs.forEach(([at, m], i) => { if (t < at || gone <= 0) return; const k = easeOut(Math.min(1, (t - at) / 0.35)) * gone; const y = 130 + i * 92 - (1 - k) * 60; ctx.save(); ctx.globalAlpha = k; fillR(ctx, 860, y, 380, 76, 14, '#fff', '#4a154b', 4); drawHeadIcon(ctx, 'pat', 900, y + 38, 48); txt(ctx, 'PAT', 936, y + 24, { size: 18, color: '#4a154b', align: 'left' }); txt(ctx, m, 936, y + 52, { size: 22, color: '#111', align: 'left', weight: 500 }); ctx.restore(); });
    // Pat arrives
    if (t >= T.patIn) {
      const k = easeOut(Math.min(1, (t - T.patIn) / 1.0));
      drawPat(ctx, 1330 - 480 * k, 690, 1.05, { t, walk: k < 1, arms: t >= T.five ? 'point' : 'wave' });
      if (t >= T.patLine && t < T.dots + 1.4) bubble(ctx, 560, 250, 360, 96, 'Hey Soung! I was just coming over because y—', { tail: 'right', size: 22 });
      if (t >= T.five && t < T.chair) bubble(ctx, 560, 250, 360, 84, 'This should only take five minutes.', { tail: 'right', size: 22 });
      if (t >= T.chair) bubble(ctx, 560, 250, 360, 84, "I'll just grab a chair.", { tail: 'right', size: 22 });
    }
    if (t >= T.dots) bubble(ctx, 400, 120, 120, 60, '. . .', { tail: 'bottom', size: 28 });
    // PAT DETECTED
    if (t >= T.detected && t < T.patLine + 1.2) { if (Math.floor(t * 6) % 2 === 0) { ctx.fillStyle = 'rgba(255,0,0,0.18)'; ctx.fillRect(0, 0, W, H); } fillR(ctx, 240, 92, 800, 96, 14, '#dc2626', '#111', 5); txt(ctx, '⚠ PAT DETECTED ⚠', 640, 142, { size: 62, color: '#fff', font: IMPACT, weight: 400, stroke: '#111', strokeW: 6 }); }
    this.letterbox(ctx);
    if (t >= T.hud) this.drawHud(ctx, t);
  }

  drawCoffee(ctx, x, y) {
    fillR(ctx, x - 16, y - 22, 32, 44, 5, '#f8fafc', '#111', 3); fillR(ctx, x - 19, y - 28, 38, 10, 3, '#7c2d12', '#111', 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { const ph = (this.t * 1.5 + i) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(x + i * 8, y - 32); ctx.quadraticCurveTo(x + i * 8 + 6, y - 44 - ph * 20, x + i * 8, y - 56 - ph * 24); ctx.stroke(); } ctx.globalAlpha = 1;
  }

  drawClock(ctx, t) {
    const k = easeOut(Math.min(1, (t - T.clock) / 0.4));
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(640, 360); ctx.scale(k, k);
    fillR(ctx, -300, -110, 600, 220, 24, '#111827', '#374151', 6);
    txt(ctx, '8:01 AM', 0, -10, { size: 120, font: MONO, weight: 700, color: t >= T.clock + 0.6 ? '#ef4444' : '#e5e7eb' });
    txt(ctx, 'MONDAY', 0, 70, { size: 26, font: MONO, weight: 700, color: '#9ca3af' });
    ctx.restore();
  }

  drawCloseup(ctx, t) {
    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(640, 360, 100, 640, 360, 700); g.addColorStop(0, 'rgba(120,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const tw = t >= T.closeup + 0.8 && (Math.floor(t * 9) % 4 === 0) ? 0.02 : 0;   // eye twitch
    const zoom = 1 + Math.min(0.12, (t - T.closeup) * 0.04);
    drawHeadOnly(ctx, 'soung', 640, 400, 520 * zoom, t >= T.closeup + 2 ? 'angry' : 'annoyed', { tilt: tw + Math.sin(t * 40) * tw });
    this.letterbox(ctx);
    if (t >= T.hud) this.drawHud(ctx, t);
  }

  drawHud(ctx, t) {
    const k = easeOut(Math.min(1, (t - T.hud) / 0.5));
    ctx.save(); ctx.globalAlpha = k;
    fillR(ctx, 40, 562, 420, 74, 12, 'rgba(17,24,39,0.9)', '#ffe600', 3);   // bottom-left, clear of the PAT DETECTED banner
    txt(ctx, 'GRUMPY METER', 60, 584, { size: 18, color: '#ffe600', align: 'left' });
    txt(ctx, Math.round(this.grumpyShown) + '%', 440, 584, { size: 22, color: '#fff', align: 'right' });
    fillR(ctx, 60, 602, 380, 18, 9, '#1f2937'); fillR(ctx, 60, 602, 380 * this.grumpyShown / 100, 18, 9, this.grumpyShown > 10 ? '#f97316' : '#22c55e');
    ctx.restore();
  }

  drawSlam(ctx, t) {
    const k = Math.min(1, (t - T.slam) / 0.22), sc = 3 - 2 * easeOut(k);
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
    if (t >= T.sub) { drawOffice(ctx, t, 'desk'); ctx.fillStyle = 'rgba(10,12,30,0.6)'; ctx.fillRect(0, 0, W, H); drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: 'angry', arms: 'cross', t }); drawPat(ctx, 850, 690, 1.05, { t, arms: 'wave' }); }
    ctx.save(); ctx.translate(640, t >= T.sub ? 250 : 340); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 2);
    impact(ctx, 'THE', 0, -95, 70, '#fff', -0.03);
    impact(ctx, 'GRUMP', 0, 20, 190, '#ffe600', 0.02);
    ctx.restore();
    if (t >= T.sub) { const a = this.fade(t, T.sub, 0.5); fillR(ctx, 420, 400, 440, 48, 24, '#111827', '#ffe600', 3); txt(ctx, 'A Corporate Survival Game', 640, 424, { size: 26, color: '#fff', alpha: a }); }
  }
}
