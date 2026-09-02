// workday.js — the main loop: transition → intro card → mini-game → result → repeat.
// Grumpy 100% interrupts anything with Full Soung Mode (or game over when patience is gone).
import { W, H, pick, rand } from '../engine.js';
import { txt, fillR, banner, impact, bubble, Button } from '../draw.js';
import { drawOffice, drawHUD, hitMute, hitPause, HUD_H } from '../office.js';
import { drawSoung, drawPat, drawHeadIcon } from '../characters.js';
import { Particles } from '../particles.js';
import { audio } from '../audio.js';
import { RunState, CORPORATE, PAT_LINES, PAT_QUOTES, MINUTES_PER_GAME, GRUMPY } from '../state.js';
import { regularMinigames, specialMinigame } from '../minigames/index.js';
import { FullSoungMode } from '../fullsoung.js';

export class WorkdayScene {
  constructor(game) {
    this.game = game; this.S = new RunState(); this.particles = new Particles(); this.t = 0;
    this.phase = 'transition'; this.phaseT = 0; this.mg = null; this.def = null; this.lastId = null; this.msg = ''; this.rage = null; this.grumpyFlash = 0; this.patLine = '';
    this.api = this.makeApi();
    this.paused = false; this.resumeBtn = new Button(W / 2 - 170, 330, 340, 70, 'RESUME', { color: '#22c55e', size: 28 }); this.menuBtn = new Button(W / 2 - 170, 420, 340, 60, 'MAIN MENU', { color: '#ef4444', size: 24 });
  }
  pause() { if (this.paused) return; this.paused = true; this.pausedMusic = audio.musicName; audio.stopMusic(); audio.stopVoices(); audio.play('click'); }
  resume() { if (!this.paused) return; this.paused = false; audio.play('click'); if (this.pausedMusic) audio.startMusic(this.pausedMusic); }
  makeApi() {
    const self = this;
    return {
      S: this.S, engine: null, particles: this.particles, audio,
      get pointer() { return self.engine.pointer; },
      sfx: n => audio.play(n),
      shake: (a, d) => self.engine.shake(a, d), slowmo: (f, d) => self.engine.slowmo(f, d), flash: (c, d) => self.engine.flash(c, d),
      score: (n, label, x, y) => { self.S.addScore(n); if (label) self.particles.text(label, x ?? 640, y ?? 300, { color: '#ffe600' }); },
      grumpy: (n, why) => { const was = self.S.grumpy; self.S.addGrumpy(n, why); self.grumpyFlash = 0.5; audio.play('grumble'); self.particles.text(`+${n}% GRUMPY`, 330, 215, { color: '#ff6b6b', size: 30 }); if (was < 75 && self.S.grumpy >= 75 && self.S.grumpy < 100) self.patHeckle(pick(['grumpy', 'grumpy', 'hearmeout'])); },
      say: key => audio.say(key),
    };
  }
  enter() { this.api.engine = this.engine; audio.startMusic('musicWork'); this.startTransition(); }
  exit() { audio.stopMusic(); }

  // ---- phase control ----
  startTransition() { this.phase = 'transition'; this.phaseT = 0.9; this.mg = null; this.patCard = Math.random() < 0.3; this.msg = this.patCard ? 'Pat: "' + PAT_QUOTES[pick(['soung', 'there', 'gotasec', 'idea', 'five', 'mentioned', 'quickcall', 'notbusy'])].text + '"' : pick(CORPORATE); }
  // Pat pops in from the right edge with a line (no penalty — pure heckling).
  patHeckle(key) { this.heckle = { key, t: 0, text: PAT_QUOTES[key].text }; audio.say(key); }
  chooseNext() {
    if (this.S.bossReady) return specialMinigame('boss');
    if (this.S.lunchReady) return specialMinigame('lunch') || pick(regularMinigames());
    // shuffle-bag: each cycle plays every regular game exactly once in random order;
    // the next bag is reshuffled so it never starts with the game the last one ended on.
    if (!this.bag || !this.bag.length) {
      const all = regularMinigames();
      do { this.bag = [...all].sort(() => Math.random() - 0.5); } while (all.length > 1 && this.bag[0].id === this.lastId);
    }
    const def = this.bag.shift(); this.lastId = def.id;
    return def;
  }
  startIntro() {
    this.def = this.chooseNext(); this.lastId = this.def.id;
    this.phase = 'intro'; this.phaseT = this.def.pat ? 1.6 : 1.1;
    const q = this.def.special === 'lunch' ? 'lunch' : this.def.special === 'boss' ? 'meeting' : pick(PAT_LINES);
    this.patLine = PAT_QUOTES[q].text;
    if (this.def.pat) { audio.play('patAlarm'); this.S.addGrumpy(5, 'PAT DETECTED'); this.engine.shake(5, 0.3); setTimeout(() => audio.say(q), 350); } else audio.play('whoosh');
  }
  startPlay() { this.phase = 'play'; this.mg = this.def.create(this.api, this.def); this.clockStart = this.S.clock; if (this.def.special === 'lunch') this.S.lunchDone = true; }
  startResult(r) {
    this.phase = 'result'; this.phaseT = r.boss ? 2.2 : 1.4; this.result = r; this.S.gamesPlayed++;
    if (r.success) audio.play('good'); else audio.play('grumble');
    // win streak: every consecutive win from the 2nd pays a growing bonus (capped) and shows a STREAK stamp
    if (r.success && !r.boss) { this.S.streak++; this.S.stats.bestStreak = Math.max(this.S.stats.bestStreak, this.S.streak); if (this.S.streak >= 2) { r.streakBonus = Math.min(500, 100 * this.S.streak); this.S.addScore(r.streakBonus, 'STREAK'); this.phaseT += 0.3; setTimeout(() => audio.play('basket'), 500); } } else if (!r.boss) this.S.streak = 0;
    // Pat always has a comment. Success = he feels ignored; failure = he's thrilled to have "helped".
    // Pat comments on ~2 of 3 results (he was commenting on every single one — user: "a bit much")
    if (!r.pat && !r.boss && Math.random() < 0.35) r.pat = null; else { r.pat = r.pat || (r.success ? pick(['ignoring', 'ignoring', 'busy', 'there', 'hearmeout']) : pick(['idea', 'five', 'look', 'gotasec', 'toldthem', 'saidyes', 'addedyou'])); setTimeout(() => audio.say(r.pat), 250); }
    if (r.boss && r.success) { this.phaseT = 2.4; }
  }
  startRage() {
    if (!this.S.rage()) { this.game.gameOver(this.S); return; }
    this.phase = 'rage'; this.rage = new FullSoungMode(this.api); this.mg = null; setTimeout(() => audio.say('grumpy'), 1700);
    // the meter shows the cool-down live: it starts at 100 and drains as he smashes (endRage clamps it)
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt; this.particles.update(dt); this.grumpyFlash = Math.max(0, this.grumpyFlash - dt);
    if (this.heckle) { this.heckle.t += dt; if (this.heckle.t > 2.6) this.heckle = null; }
    if (this.S.pendingRage && this.phase !== 'rage') { this.startRage(); return; }
    switch (this.phase) {
      case 'transition': this.phaseT -= dt; if (this.phaseT <= 0) this.startIntro(); break;
      case 'intro': this.phaseT -= dt; if (this.phaseT <= 0) this.startPlay(); break;
      case 'play': {
        this.mg.update(dt);
        if (!this.def.special) { const k = Math.min(1, this.mg.t / (this.mg.dur || 8)); this.S.clock = Math.min(this.clockStart + MINUTES_PER_GAME, this.clockStart + MINUTES_PER_GAME * k); }
        else if (this.def.special === 'lunch') { const k = Math.min(1, this.mg.t / (this.mg.dur || 10)); this.S.clock = Math.min(this.clockStart + MINUTES_PER_GAME, this.clockStart + MINUTES_PER_GAME * k); }
        if (this.mg.done) { if (!this.def.special || this.def.special === 'lunch') this.S.clock = this.clockStart + MINUTES_PER_GAME; if (this.S.clock > 16 * 60 + 58) this.S.clock = 16 * 60 + 58; this.startResult(this.mg.result); }
        break;
      }
      case 'result': this.phaseT -= dt; if (this.phaseT <= 0) { if (this.result.boss && this.result.success) { this.S.finishDay(); this.game.win(this.S); return; } this.startTransition(); } break;
      case 'rage': this.rage.update(dt); if (this.rage.done) { this.S.endRage(); this.rage = null; audio.startMusic('musicWork'); this.startTransition(); } break;
    }
  }
  pointerDown(p) {
    if (hitMute(p)) { audio.toggleMute(); return; }
    audio.ensure();
    if (this.paused) { if (this.resumeBtn.hit(p)) this.resume(); else if (this.menuBtn.hit(p)) { audio.play('click'); this.game.showTitle(); } return; }
    if (hitPause(p)) { this.pause(); return; }
    if (this.phase === 'play') this.mg.pointerDown(p); else if (this.phase === 'rage') this.rage.pointerDown(p);
  }
  pointerMove(p) { if (this.paused) return; if (this.phase === 'play') this.mg.pointerMove(p); }
  pointerUp() { if (this.paused) return; if (this.phase === 'play') this.mg.pointerUp?.(); }
  keyDown(code) {
    if (code === 'Escape' || (this.paused && (code === 'Enter' || code === 'Space'))) { this.paused ? this.resume() : this.pause(); return; }
    if (this.paused) return;
    if (this.phase === 'play') this.mg.keyDown(code);
  }

  draw(ctx) {
    if (this.phase === 'play') this.mg.draw(ctx);
    else if (this.phase === 'rage') this.rage.draw(ctx);
    else if (this.phase === 'result' && this.mg) { this.mg.draw(ctx); this.drawResult(ctx); }
    else if (this.phase === 'intro') this.drawIntro(ctx);
    else this.drawTransition(ctx);
    // Pat's heckle is a Slack card (every mini-game already has its own Pat on screen — a second one walking in looked like a bug)
    if (this.heckle && this.phase === 'play') { const h = this.heckle, k = h.t < 0.3 ? h.t / 0.3 : h.t > 2.2 ? Math.max(0, 1 - (h.t - 2.2) / 0.4) : 1; const y = HUD_H + 8 - (1 - k) * 80; ctx.save(); ctx.globalAlpha = Math.max(0, k); fillR(ctx, 800, y, 440, 64, 12, '#fff', '#4a154b', 3); drawHeadIcon(ctx, 'pat', 836, y + 32, 40); txt(ctx, 'PAT', 866, y + 20, { size: 14, color: '#4a154b', align: 'left' }); txt(ctx, h.text, 866, y + 44, { size: 20, color: '#111', align: 'left', weight: 500 }); ctx.restore(); }
    this.particles.draw(ctx);
    drawHUD(ctx, this.S, this.t, audio.muted);
    if (this.grumpyFlash > 0) { ctx.fillStyle = `rgba(255,0,0,${this.grumpyFlash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (this.paused) {
      ctx.fillStyle = 'rgba(5,8,20,0.78)'; ctx.fillRect(0, 0, W, H);
      impact(ctx, 'PAUSED', 640, 220, 90, '#ffe600', -0.02);
      txt(ctx, 'Soung is pretending to be on a call.', 640, 285, { size: 22, color: '#d1d5db', weight: 500 });
      this.resumeBtn.draw(ctx, this.resumeBtn.hit(this.engine.pointer)); this.menuBtn.draw(ctx, this.menuBtn.hit(this.engine.pointer));
      txt(ctx, 'ESC / ENTER to resume · Main Menu ends this workday', 640, 520, { size: 16, color: '#9ca3af', weight: 500 });
    }
  }
  drawTransition(ctx) {
    ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, W, H);
    const k = 1 - this.phaseT / 0.9;
    if (this.patCard) drawPat(ctx, 640, 640, 0.75, { t: this.t, arms: 'wave' });
    txt(ctx, this.msg, 640, this.patCard ? 260 : 340, { size: this.msg.length > 26 ? 34 : 40, color: '#ffe600', stroke: '#000', strokeW: 6, alpha: Math.min(1, k * 4) });
    const dots = '.'.repeat(1 + Math.floor(this.t * 3) % 3);
    txt(ctx, 'please hold' + dots, 640, 400, { size: 20, color: '#9ca3af', weight: 500 });
    fillR(ctx, 440, 440, 400, 12, 6, '#1f2937'); fillR(ctx, 440, 440, 400 * k, 12, 6, '#38bdf8');
  }
  drawIntro(ctx) {
    drawOffice(ctx, this.t, 'desk');
    drawSoung(ctx, 330, 640, 1.05, { seated: true, mood: this.def.pat ? 'angry' : 'annoyed', arms: 'typing', t: this.t, sweat: this.def.pat });
    if (this.def.pat) {
      const k = Math.min(1, (1.6 - this.phaseT) / 0.4);
      drawPat(ctx, 1330 - 330 * k, 660, 1, { t: this.t, walk: k < 1, arms: 'wave' });
      bubble(ctx, 700, 280, 300, 84, this.patLine, { tail: 'right', size: 22 });
      if (Math.floor(this.t * 6) % 2 === 0) { fillR(ctx, 340, HUD_H + 20, 600, 70, 12, '#fbbf24', '#111', 4); txt(ctx, '⚠ PAT DETECTED ⚠', 640, HUD_H + 56, { size: 40, color: '#111', font: "'Bangers', Impact, sans-serif", weight: 400 }); }
    }
    banner(ctx, W, H, this.def.title, this.def.tagline, { size: 64 });
  }
  drawResult(ctx) {
    const r = this.result;
    banner(ctx, W, H, r.msg, r.sub, { accent: r.success ? '#22c55e' : '#ef4444', color: r.success ? '#bbf7d0' : '#fecaca', size: r.msg.length > 18 ? 48 : 64, subColor: '#fff' });
    if (r.streakBonus) { const k = Math.min(1, Math.max(0, (1.7 - this.phaseT) / 0.25)), sc = 1.6 - 0.6 * k; ctx.save(); ctx.translate(1040, 190); ctx.rotate(0.12); ctx.scale(sc, sc); ctx.globalAlpha = k; fillR(ctx, -130, -44, 260, 88, 14, '#f97316', '#111', 5); txt(ctx, `STREAK ×${this.S.streak}`, 0, -12, { size: 30, color: '#fff', font: "'Bangers', Impact, sans-serif", weight: 400 }); txt(ctx, `+${r.streakBonus}`, 0, 22, { size: 22, color: '#ffe600' }); ctx.restore(); }
    // Pat's take, bottom-right
    const k = Math.min(1, (this.phaseT < 1.2 ? (1.2 - this.phaseT) : 0) / 0.25);
    if (k > 0 && r.pat) { drawPat(ctx, 1150, 720 + (1 - k) * 200, 0.85, { t: this.t, arms: 'wave' }); if (k >= 1) bubble(ctx, 760, 540, 300, 70, PAT_QUOTES[r.pat].text, { tail: 'right', size: 20 }); }
  }
}
