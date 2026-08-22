// Procedural WebAudio SFX v2 — punchier hits + real CROWD (user feedback: louder, add cheering).
// Keep: turnover whistle (user liked it). No audio files; lazy AudioContext.
let ctx = null;
let muted = false;
let crowdNodes = null;

export function setMuted(m) { muted = m; if (m) stopCrowd(); }
export function isMuted() { return muted; }

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// brown noise: integrated white — deep, dark rumble with NO static hiss. This is the
// correct base texture for crowds (white noise through a filter just sounds like radio static).
function brownBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 18; // normalize
  }
  return buf;
}

function noise(c, { dur = 0.2, type = "lowpass", freq = 400, q = 1, gain = 0.4, delay = 0,
  freqEnd = null, gainAttack = 0.005 }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (freqEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), c.currentTime + delay + dur);
  const g = c.createGain();
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + gainAttack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

function tone(c, { dur = 0.15, freq = 440, freqEnd = null, type = "sine", gain = 0.2, delay = 0 }) {
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + delay + dur);
  const g = c.createGain();
  const t0 = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// CHEERING v3: noise-based crowds failed twice (white=static, brown=wind).
// Now: a chorus of PITCHED voices with vocal formant filtering — or, if the user drops
// a real recording at ./crowd.mp3, we use that instead (auto-detected).
let crowdSample = undefined; // undefined=unchecked, null=absent, AudioBuffer=ready
async function loadCrowdSample(c) {
  if (crowdSample !== undefined) return;
  crowdSample = null;
  try {
    const res = await fetch("./crowd.mp3");
    if (res.ok) {
      const raw = await res.arrayBuffer();
      crowdSample = await c.decodeAudioData(raw);
    }
  } catch (e) { crowdSample = null; }
}

// stadium AIR HORN — the unmistakable "somebody scored" sound. Detuned saw cluster,
// octave undertone, hard attack, slight sag at the end.
function airHorn(c, { dur = 0.9, delay = 0, gain = 0.28 }) {
  const t0 = c.currentTime + delay;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1900; lp.Q.value = 0.8;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.linearRampToValueAtTime(gain, t0 + 0.03); // hard attack
  master.gain.setValueAtTime(gain, t0 + dur * 0.75);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(lp); lp.connect(c.destination);
  for (const [f, g0] of [[233, 0.5], [466, 1], [469, 0.8], [474, 0.5], [699, 0.25]]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f, t0);
    o.frequency.linearRampToValueAtTime(f * 0.97, t0 + dur); // sag
    const g = c.createGain(); g.gain.value = g0 * 0.22;
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
}

function cheer(c, { intensity = 1, dur = 1.6, delay = 0 }) {
  loadCrowdSample(c);
  const t0 = c.currentTime + delay;
  if (crowdSample) {
    // real recording: play a random slice, enveloped
    const src = c.createBufferSource();
    src.buffer = crowdSample;
    const maxOff = Math.max(0, crowdSample.duration - dur - 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5 * intensity, t0 + 0.15);
    g.gain.setValueAtTime(0.5 * intensity, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g); g.connect(c.destination);
    src.start(t0, Math.random() * maxOff);
    src.stop(t0 + dur + 0.1);
    return;
  }
  // synth chorus: many detuned voices through vocal formants, "HEYYY" pitch contour
  const formant1 = c.createBiquadFilter();
  formant1.type = "bandpass"; formant1.frequency.value = 750; formant1.Q.value = 1.1;
  const formant2 = c.createBiquadFilter();
  formant2.type = "bandpass"; formant2.frequency.value = 1200; formant2.Q.value = 1.4;
  const mix = c.createGain(); mix.gain.value = 0.26 * intensity;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
  formant1.connect(mix); formant2.connect(mix); mix.connect(lp); lp.connect(c.destination);
  const voices = Math.round(9 + 4 * intensity);
  for (let i = 0; i < voices; i++) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    const base = 140 + Math.random() * 180; // adult shout range
    const vStart = t0 + Math.random() * 0.15;
    const vDur = dur * (0.7 + Math.random() * 0.3);
    o.frequency.setValueAtTime(base * 0.85, vStart);
    o.frequency.linearRampToValueAtTime(base * 1.15, vStart + vDur * 0.3); // rising shout
    o.frequency.linearRampToValueAtTime(base * 0.9, vStart + vDur);        // trails off
    // vibrato = human wobble
    const vib = c.createOscillator(); vib.frequency.value = 4.5 + Math.random() * 2.5;
    const vibG = c.createGain(); vibG.gain.value = base * 0.03;
    vib.connect(vibG); vibG.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, vStart);
    g.gain.linearRampToValueAtTime(1 / voices, vStart + 0.1 + Math.random() * 0.1);
    g.gain.setValueAtTime(1 / voices, vStart + vDur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, vStart + vDur);
    o.connect(g);
    g.connect(Math.random() < 0.5 ? formant1 : formant2);
    o.start(vStart); o.stop(vStart + vDur + 0.05);
    vib.start(vStart); vib.stop(vStart + vDur);
  }
}

// ambience bed REMOVED (two noise-based attempts sounded like static/wind).
// Kept as no-ops so callers don't break; cheers only fire on events now.
export function startCrowd() { const c = ac(); if (c) loadCrowdSample(c); }
export function stopCrowd() {}

export const sfx = {
  // draft pick: snare roll builds -> horn hit + crowd pop
  draftPick() {
    const c = ac(); if (!c || muted) return;
    for (let i = 0; i < 8; i++) noise(c, { dur: 0.04, type: "highpass", freq: 2000, gain: 0.10 + i * 0.03, delay: i * 0.07 });
    airHorn(c, { dur: 0.7, delay: 0.62, gain: 0.22 });
    cheer(c, { intensity: 1.3, dur: 1.6, delay: 0.66 });
  },
  // awards fanfare: rising brass triad + shimmer + applause
  fanfare() {
    const c = ac(); if (!c || muted) return;
    tone(c, { dur: 0.22, freq: 392, type: "sawtooth", gain: 0.22 });
    tone(c, { dur: 0.22, freq: 494, type: "sawtooth", gain: 0.22, delay: 0.2 });
    tone(c, { dur: 0.55, freq: 587, type: "sawtooth", gain: 0.28, delay: 0.4 });
    tone(c, { dur: 0.55, freq: 784, type: "triangle", gain: 0.18, delay: 0.42 });
    cheer(c, { intensity: 1.2, dur: 1.8, delay: 0.5 });
  },
  // PUNT: much beefier tackle — double low hit + pads + crowd reaction murmur
  tackle() {
    const c = ac(); if (!c || muted) return;
    tone(c, { dur: 0.14, freq: 120, freqEnd: 40, type: "sine", gain: 0.85 });
    tone(c, { dur: 0.1, freq: 65, freqEnd: 35, type: "sine", gain: 0.7, delay: 0.02 });
    noise(c, { dur: 0.12, type: "lowpass", freq: 500, gain: 0.55 });
  },
  // FG: big boot + ball flight whoosh; crowd erupts on make, groans on miss
  kick(made) {
    const c = ac(); if (!c || muted) return;
    noise(c, { dur: 0.05, type: "highpass", freq: 1200, gain: 0.6 });
    tone(c, { dur: 0.2, freq: 220, freqEnd: 60, type: "triangle", gain: 0.85 });
    noise(c, { dur: 0.6, type: "bandpass", freq: 900, q: 2, gain: 0.15, delay: 0.15, freqEnd: 300 }); // flight
    if (made) {
      airHorn(c, { dur: 0.55, delay: 0.75, gain: 0.2 });
      cheer(c, { intensity: 1.4, dur: 1.8, delay: 0.8 });
    } else {
      noise(c, { dur: 1.2, type: "bandpass", freq: 450, q: 0.8, gain: 0.35, delay: 0.75,
        freqEnd: 160, gainAttack: 0.2 }); // long groan
    }
  },
  // passing TD: whip + LOUD catch smack + full eruption
  catchTD() {
    const c = ac(); if (!c || muted) return;
    noise(c, { dur: 0.06, type: "bandpass", freq: 2800, q: 2, gain: 0.7 });
    noise(c, { dur: 0.1, type: "lowpass", freq: 1000, gain: 0.8, delay: 0.06 });
    tone(c, { dur: 0.08, freq: 300, freqEnd: 150, type: "triangle", gain: 0.4, delay: 0.06 });
    airHorn(c, { dur: 1.1, delay: 0.2 });
    cheer(c, { intensity: 1.9, dur: 2.6, delay: 0.25 });
  },
  // rushing TD: thundering footsteps → smash through → eruption
  runTD() {
    const c = ac(); if (!c || muted) return;
    for (let i = 0; i < 4; i++) {
      tone(c, { dur: 0.09, freq: 110 - i * 8, freqEnd: 45, type: "sine", gain: 0.75, delay: i * 0.1 });
      noise(c, { dur: 0.05, type: "lowpass", freq: 350, gain: 0.3, delay: i * 0.1 });
    }
    tone(c, { dur: 0.18, freq: 80, freqEnd: 35, type: "sine", gain: 0.9, delay: 0.42 }); // the smash
    noise(c, { dur: 0.15, type: "lowpass", freq: 600, gain: 0.6, delay: 0.42 });
    airHorn(c, { dur: 1.1, delay: 0.55 });
    cheer(c, { intensity: 1.9, dur: 2.6, delay: 0.6 });
  },
  // turnover: whistle (unchanged — user likes it) + slightly bigger gasp
  turnover() {
    const c = ac(); if (!c || muted) return;
    tone(c, { dur: 0.35, freq: 2300, type: "square", gain: 0.12 });
    tone(c, { dur: 0.35, freq: 2330, type: "square", gain: 0.1 });
    noise(c, { dur: 0.7, type: "bandpass", freq: 700, q: 0.7, gain: 0.22, delay: 0.3, gainAttack: 0.1 });
  },
  // OT winner: the roof comes off
  otWin() {
    const c = ac(); if (!c || muted) return;
    airHorn(c, { dur: 1.6, gain: 0.32 });
    airHorn(c, { dur: 1.2, delay: 0.5, gain: 0.2 });
    cheer(c, { intensity: 2.2, dur: 3.4, delay: 0.1 });
    tone(c, { dur: 0.4, freq: 523, type: "triangle", gain: 0.2, delay: 0.2 });
    tone(c, { dur: 0.6, freq: 659, type: "triangle", gain: 0.2, delay: 0.45 });
    tone(c, { dur: 0.8, freq: 784, type: "triangle", gain: 0.18, delay: 0.75 });
  },
  tick() {
    const c = ac(); if (!c || muted) return;
    tone(c, { dur: 0.05, freq: 700, type: "sine", gain: 0.08 });
  },
};

export function playDrive(d) {
  if (d.result === "SAFETY") { sfx.turnover(); sfx.tackle(); return; }
  if (d.result === "PUNT" || d.result === "KNEEL") sfx.tackle();
  else if (d.result === "FG") sfx.kick(true);
  else if (d.result === "FG-MISS") sfx.kick(false);
  else if (d.result === "TO") sfx.turnover();
  else if (d.result === "OT-WIN") sfx.otWin();
  else if (d.result === "TD") {
    if (d.scorer && d.scorer.includes("TD run")) sfx.runTD();
    else sfx.catchTD();
  }
}
