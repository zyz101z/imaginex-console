// audio.js — procedural Web Audio SFX + tiny music sequencer.
// To replace any sound with a real file, drop it in audio/ and map it in CUSTOM_FILES,
// e.g. CUSTOM_FILES.slack = 'audio/slack.wav'. Custom files play instead of the synth.
export const CUSTOM_FILES = {
  // slack: 'audio/slack.wav', meeting: 'audio/meeting.wav', patAlarm: 'audio/pat_alarm.wav',
  // grumble: 'audio/grumble.wav', click: 'audio/click.wav', bam: 'audio/bam.wav',
  // fullSoung: 'audio/full_soung.wav', victory: 'audio/victory.wav',
  // Music: the user's Suno loops (2026-09-02). The intro's cinematic/epic/horror cues stay procedural.
  musicTitle: 'audio/music_title.mp3', musicWork: 'audio/music_work.mp3', musicBoss: 'audio/music_boss.mp3', musicRage: 'audio/music_rage.mp3',
};

// Pat voice lines. Record MP3s and drop them in audio/ with these names — they play automatically
// alongside the speech bubble (silent if the file is missing). See GAME_DESIGN.md "Voice lines".
export const VOICE_FILES = {
  soung: 'audio/pat_soung.wav', there: 'audio/pat_there_he_is.wav', lunch: 'audio/pat_lunch.wav',
  ignoring: 'audio/pat_ignoring.wav', grumpy: 'audio/pat_why_grumpy.wav', quick: 'audio/pat_quick_question.wav',
  gotasec: 'audio/pat_got_a_sec.wav', five: 'audio/pat_five_minutes.wav', idea: 'audio/pat_idea.wav',
  meeting: 'audio/pat_meeting.wav', look: 'audio/pat_quick_look.wav', beforeyougo: 'audio/pat_before_you_go.wav', busy: 'audio/pat_busy.wav',
  toldthem: 'audio/pat_told_them.wav', notbusy: 'audio/pat_not_busy.wav', addedyou: 'audio/pat_added_you.wav', quickcall: 'audio/pat_quick_call.wav',
  saidyes: 'audio/pat_said_yes.wav', hearmeout: 'audio/pat_hear_me_out.wav', mentioned: 'audio/pat_mentioned_name.wav',
  holddoor: 'audio/pat_hold_the_door.wav', rkt: 'audio/pat_rkt.wav', wherego: 'audio/pat_where_did_he_go.wav', waitforme: 'audio/pat_wait_for_me.wav', foundyou: 'audio/pat_found_you.wav', replyall: 'audio/pat_reply_all.wav', bitcoin: 'audio/pat_bitcoin.wav', ow: 'audio/pat_ow.wav', niceshot: 'audio/pat_nice_shot.wav', missed: 'audio/pat_missed.wav', peekaboo: 'audio/pat_peekaboo.wav', showyou: 'audio/pat_show_you.wav', wasthatyou: 'audio/pat_was_that_you.wav', dontmove: 'audio/pat_dont_move.wav', gotcha: 'audio/pat_gotcha.wav', headsup: 'audio/pat_heads_up.wav', thinkfast: 'audio/pat_think_fast.wav', catch: 'audio/pat_catch.wav', hr: 'audio/pat_hr.wav', nexttime: 'audio/pat_next_time.wav', leadership: 'audio/pat_leadership.wav', goodeffort: 'audio/pat_good_effort.wav', retro: 'audio/pat_retro.wav', soclose: 'audio/pat_so_close.wav', fanup: 'audio/pat_fan_up.wav',
  // Intro cinematic: narrator (Voicebox clone 'kris' — see GAME_DESIGN.md) + Pat's cut-off line
  narr_offices: 'audio/narr_offices.wav', narr_monday: 'audio/narr_monday.wav', narr_soung: 'audio/narr_soung.wav', narr_worse: 'audio/narr_worse.wav', narr_goal: 'audio/narr_goal.wav', pat_grab_chair: 'audio/pat_grab_chair.wav', pat_intro_coming: 'audio/pat_intro_coming.wav',
  // Soung (optional)
  soung_no: 'audio/soung_no.wav', soung_ugh: 'audio/soung_ugh.wav', soung_deal_with_it: 'audio/soung_deal_with_it.wav', soung_eating: 'audio/soung_eating.wav', soung_not_today: 'audio/soung_not_today.wav', soung_leave_me_alone: 'audio/soung_leave_me_alone.wav', soung_seriously: 'audio/soung_seriously.wav', soung_not_now: 'audio/soung_not_now.wav', soung_no_bitcoin: 'audio/soung_no_bitcoin.wav', soung_go_away: 'audio/soung_go_away.wav',
};

// Per-track music volume (voice lines sit at 0.85–1.0, so keep the beds under them).
const MUSIC_VOL = { musicTitle: 0.5, musicWork: 0.38, musicBoss: 0.5, musicRage: 0.55 };

class AudioSys {
  constructor() { this.ctx = null; this.master = null; this.muted = false; this.music = null; this.musicName = null; this.htmlMusic = null; this._cache = {}; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const C = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!C) return false;
    this.ctx = new C(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    return true;
  }
  // Play a Pat voice line (one at a time; missing files are remembered and skipped).
  say(key) {
    const path = VOICE_FILES[key]; if (!path || typeof Audio === 'undefined') return false;
    this._voice = this._voice || {}; this._missing = this._missing || {};
    if (this._missing[key]) return false;
    try {
      // One channel per speaker: Pat and Soung can talk over each other, but a speaker only interrupts himself.
      const who = key.startsWith('soung_') ? 'soung' : key.startsWith('narr_') ? 'narr' : 'pat';
      this._chan = this._chan || {};
      const cur = this._chan[who];
      if (cur && !cur.ended && !cur.paused) {
        if (who === 'soung' && cur.currentTime < 0.6) return false;   // let Soung finish a short line
        // Pat mid-sentence (< 2.4 s in): don't cut him off — park the new line (one slot) and play it when he's done.
        if (who === 'pat' && cur.currentTime < 2.4 && (cur.duration ? cur.currentTime < cur.duration - 0.25 : true)) {
          this._queued = this._queued || {}; this._queued[who] = key;
          cur.onended = () => { const k = this._queued && this._queued[who]; if (k) { delete this._queued[who]; this.say(k); } };
          return true;
        }
        try { cur.pause(); } catch {}
      }
      if (this._queued && this._queued[who]) delete this._queued[who];
      const a = this._voice[key] || (this._voice[key] = new Audio(path));
      a.onerror = () => { this._missing[key] = true; };
      a.currentTime = 0; a.muted = this.muted; a.volume = who === 'soung' ? 1 : 0.85; a.play().catch(() => { this._missing[key] = true; });
      this._chan[who] = a; this._current = a; return true;
    } catch { return false; }
  }
  stopVoices() { for (const a of Object.values(this._chan || {})) { try { a.pause(); } catch {} } }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; if (this.htmlMusic) this.htmlMusic.muted = this.muted; for (const a of Object.values(this._chan || {})) a.muted = this.muted; return this.muted; }

  // ---- primitives ----
  tone(f, dur, type = 'square', vol = 0.3, o = {}) {
    if (!this.ensure()) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || this.master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.3, o = {}) {
    if (!this.ensure()) return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.freq || 900;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  file(name) {
    const path = CUSTOM_FILES[name]; if (!path || typeof Audio === 'undefined') return false;
    try { const a = this._cache[name] || (this._cache[name] = new Audio(path)); a.currentTime = 0; a.muted = this.muted; a.play().catch(() => {}); return true; } catch { return false; }
  }

  // ---- named SFX (all replaceable via CUSTOM_FILES) ----
  play(name) {
    if (name === 'grumble' && this.say('soung_ugh')) return;
    if (this.file(name)) return;
    const s = this.SFX[name]; if (s) s.call(this);
  }
  get SFX() { return SFX; }

  // ---- music: tiny step sequencer ----
  startMusic(name) {
    if (this.musicName === name) return;
    this.stopMusic();
    this.musicName = name;
    if (CUSTOM_FILES[name] && typeof Audio !== 'undefined') {
      try { this.htmlMusic = new Audio(CUSTOM_FILES[name]); this.htmlMusic.loop = true; this.htmlMusic.volume = MUSIC_VOL[name] ?? 0.45; this.htmlMusic.muted = this.muted; this.htmlMusic.play().catch(() => {}); } catch {}
      return;
    }
    const song = SONGS[name]; if (!song || !this.ensure()) return;
    let step = 0; const stepLen = 60 / song.bpm / 2; // eighth notes
    let next = this.ctx.currentTime + 0.05;
    const tick = () => {
      if (this.musicName !== name) return;
      while (next < this.ctx.currentTime + 0.25) {
        const i = step % song.bass.length;
        const b = song.bass[i], m = song.lead[i % song.lead.length];
        const delay = next - this.ctx.currentTime;
        if (b) this.tone(b, stepLen * 0.9, song.bassType || 'triangle', 0.16, { delay });
        if (m) this.tone(m, stepLen * 0.6, song.leadType || 'square', 0.07, { delay });
        if (song.kick && i % 4 === 0) this.noise(0.08, 0.25, { delay, freq: 200 });
        if (song.hat && i % 2 === 1) this.noise(0.03, 0.06, { delay, type: 'highpass', freq: 6000 });
        next += stepLen; step++;
      }
      this.music = setTimeout(tick, 100);
    };
    tick();
  }
  stopMusic() {
    this.musicName = null;
    if (this.music) { clearTimeout(this.music); this.music = null; }
    if (this.htmlMusic) { try { this.htmlMusic.pause(); } catch {} this.htmlMusic = null; }
  }
}

const N = { C3: 130.8, D3: 146.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, Bb3: 233.1, B3: 246.9, C4: 261.6, D4: 293.7, Eb4: 311.1, E4: 329.6, F4: 349.2, G4: 392, A4: 440, Bb4: 466.2, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784 };
const SONGS = {
  musicTitle: { bpm: 112, kick: true, hat: true, bass: [N.C3, 0, N.C3, N.G3, N.A3, 0, N.A3, N.E3, N.F3, 0, N.F3, N.C3, N.G3, 0, N.G3, N.B3], lead: [N.E4, N.G4, 0, N.C5, 0, N.B4, N.A4, 0, N.F4, N.A4, 0, N.C5, 0, N.D5, N.B4, 0] },
  musicBoss: { bpm: 150, kick: true, hat: true, bassType: 'sawtooth', bass: [N.E3, N.E3, N.E3, N.G3, N.E3, N.E3, N.Bb3, N.A3, N.E3, N.E3, N.E3, N.G3, N.C4, N.B3, N.Bb3, N.A3], lead: [0, N.E5, 0, N.E5, N.G5, 0, N.Eb4 * 2, 0, 0, N.E5, 0, N.E5, N.D5, 0, N.C5, N.B4] },
  musicRage: { bpm: 170, kick: true, bassType: 'sawtooth', leadType: 'sawtooth', bass: [N.A3, N.A3, N.C4, N.A3, N.A3, N.A3, N.Eb4, N.D4], lead: [N.A4, 0, N.C5, N.A4, N.E5, 0, N.Eb4 * 2, N.D5] },
  // intro cinematic: low drone, then the epic fanfare, then horror
  musicCinematic: { bpm: 60, bassType: 'sine', bass: [N.C3 / 2, 0, 0, 0, N.C3 / 2, 0, 0, 0, N.Eb4 / 4, 0, 0, 0, N.C3 / 2, 0, 0, 0], lead: [0, 0, 0, 0, 0, 0, 0, N.G3, 0, 0, 0, 0, 0, 0, 0, 0], leadType: 'triangle', kick: true },
  musicEpic: { bpm: 126, kick: true, hat: true, bassType: 'sawtooth', leadType: 'sawtooth', bass: [N.C3, N.C3, N.C3, N.C3, N.Bb3 / 2, N.Bb3 / 2, N.Bb3 / 2, N.Bb3 / 2, N.F3, N.F3, N.F3, N.F3, N.G3, N.G3, N.G3, N.G3], lead: [N.C4, 0, N.C4, N.G4, 0, N.Bb4, 0, N.C5, N.F4, 0, N.F4, N.A4, 0, N.G4, N.D5, 0] },
  musicHorror: { bpm: 72, bassType: 'sawtooth', leadType: 'sawtooth', bass: [N.B3 / 2, 0, 0, N.C3, 0, 0, N.B3 / 2, 0, N.F3 / 2, 0, 0, 0, N.B3 / 2, 0, 0, 0], lead: [0, 0, 0, 0, 0, 0, N.F4 * 2, 0, 0, N.E4 * 2, 0, 0, 0, 0, N.Bb4 * 2, 0] },
  musicWork: { bpm: 100, hat: true, bass: [N.F3, 0, N.A3, 0, N.C4, 0, N.A3, 0, N.G3, 0, N.B3, 0, N.D4, 0, N.B3, 0], lead: [0, 0, N.C5, 0, 0, 0, N.A4, 0, 0, 0, N.B4, 0, 0, 0, N.D5, 0] },
};

const SFX = {
  slack() { this.tone(880, 0.09, 'sine', 0.3); this.tone(1174, 0.14, 'sine', 0.3, { delay: 0.09 }); },
  meeting() { this.tone(660, 0.12, 'square', 0.2); this.tone(660, 0.12, 'square', 0.2, { delay: 0.16 }); this.tone(880, 0.25, 'square', 0.2, { delay: 0.32 }); },
  patAlarm() { for (let i = 0; i < 3; i++) { this.tone(520, 0.18, 'sawtooth', 0.22, { delay: i * 0.24, slide: 380 }); } },
  grumble() { this.tone(120, 0.35, 'sawtooth', 0.22, { slide: 80 }); this.noise(0.25, 0.08, { freq: 400 }); },
  click() { this.tone(1200, 0.05, 'square', 0.12); },
  wrong() { this.tone(220, 0.25, 'square', 0.2, { slide: 110 }); },
  good() { this.tone(523, 0.08, 'square', 0.18); this.tone(784, 0.15, 'square', 0.18, { delay: 0.08 }); },
  decline() { this.tone(400, 0.08, 'square', 0.2); this.tone(300, 0.15, 'square', 0.2, { delay: 0.08 }); },
  bam() { this.noise(0.25, 0.5, { freq: 1200 }); this.tone(90, 0.3, 'sine', 0.5, { slide: 40 }); },
  whoosh() { this.noise(0.3, 0.2, { type: 'bandpass', freq: 1500 }); },
  fullSoung() { for (let i = 0; i < 8; i++) this.tone(200 + i * 90, 0.12, 'sawtooth', 0.25, { delay: i * 0.07 }); this.noise(0.8, 0.4, { delay: 0.5, freq: 600 }); this.tone(60, 0.9, 'sine', 0.5, { delay: 0.5 }); },
  victory() { [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5].forEach((f, i) => this.tone(f, 0.35, 'square', 0.2, { delay: i * 0.12 })); this.tone(N.C5 * 2, 0.9, 'square', 0.15, { delay: 0.8 }); },
  lose() { [N.E4, N.Eb4, N.D4, N.C4].forEach((f, i) => this.tone(f, 0.4, 'square', 0.2, { delay: i * 0.3 })); },
  tick() { this.tone(2000, 0.03, 'square', 0.08); },
  pop() { this.tone(600, 0.06, 'sine', 0.2, { slide: 1200 }); },
  step() { this.noise(0.05, 0.08, { freq: 500 }); },
  bonk() { this.tone(180, 0.12, 'square', 0.35, { slide: 60 }); this.noise(0.1, 0.3, { freq: 900 }); },
  swish() { this.noise(0.25, 0.15, { type: 'bandpass', freq: 2200 }); },
  basket() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.2, { delay: i * 0.07 })); },
  slap() { this.noise(0.12, 0.5, { freq: 2500, type: 'bandpass' }); this.tone(300, 0.08, 'square', 0.2, { slide: 120 }); },
  jump() { this.tone(300, 0.15, 'square', 0.15, { slide: 700 }); },
  land() { this.noise(0.08, 0.2, { freq: 400 }); },
  sting() { [N.B3, N.C4, N.F4 * 2, N.E4 * 2].forEach((f, i) => this.tone(f, 1.6, 'sawtooth', 0.14, { delay: i * 0.05, slide: f * 0.94 })); this.noise(0.6, 0.25, { freq: 300 }); },
  horn() { this.tone(N.C3, 0.5, 'sawtooth', 0.3); this.tone(N.E3, 0.5, 'sawtooth', 0.2); },
};

export const audio = new AudioSys();
