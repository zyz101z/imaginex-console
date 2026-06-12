// src/ui/audio.js
// Lightweight Web Audio sound effects for "Divided States".
// No asset files — every sound is synthesized with oscillators / noise buffers.
//
// export function createAudio() -> { play, setMuted }
//
// Design goals:
//  - Lazily create/resume the AudioContext on the first play() (needs a user gesture).
//  - Short (< ~0.6s) and quiet (master gain ~0.2) so rapid AI attacks don't grate.
//  - Never throw: everything is wrapped in try/catch and fails silently.

export function createAudio() {
  let ctx = null;        // AudioContext, created lazily
  let master = null;     // master GainNode
  let muted = false;

  const MASTER_GAIN = 0.2;

  // Lazily build (or resume) the audio graph. Returns the AudioContext or null.
  function ensureContext() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
      }
      // Browsers start the context "suspended" until a user gesture.
      if (ctx.state === 'suspended') {
        // resume() may reject; ignore the rejection.
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }

  // ---- Low-level helpers ---------------------------------------------------

  // A single oscillator "blip" with an attack/decay envelope.
  // freq can be a number, or [startFreq, endFreq] for a glide.
  function tone(freq, start, dur, opts) {
    opts = opts || {};
    const type = opts.type || 'square';
    const peak = opts.gain == null ? 0.6 : opts.gain;
    const t0 = ctx.currentTime + start;
    const t1 = t0 + dur;

    const osc = ctx.createOscillator();
    osc.type = type;

    if (Array.isArray(freq)) {
      osc.frequency.setValueAtTime(freq[0], t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq[1]), t1);
    } else {
      osc.frequency.setValueAtTime(freq, t0);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  // A short burst of filtered white noise (for clatter / clicks).
  function noise(start, dur, opts) {
    opts = opts || {};
    const peak = opts.gain == null ? 0.5 : opts.gain;
    const t0 = ctx.currentTime + start;
    const t1 = t0 + dur;

    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'highpass';
    filter.frequency.value = opts.cutoff == null ? 800 : opts.cutoff;

    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t1 + 0.02);
  }

  // ---- Sound definitions ---------------------------------------------------

  const sounds = {
    // Dice tumbling on a table — a run of short wooden clatters over ~0.3s,
    // roughly matching the roll animation, with a final harder "settle" click.
    dice() {
      noise(0.00, 0.05, { gain: 0.42, cutoff: 900 });
      noise(0.05, 0.04, { gain: 0.34, cutoff: 1300 });
      noise(0.10, 0.04, { gain: 0.30, cutoff: 1100 });
      noise(0.15, 0.04, { gain: 0.28, cutoff: 1600 });
      noise(0.21, 0.04, { gain: 0.24, cutoff: 1300 });
      noise(0.27, 0.06, { gain: 0.40, cutoff: 800 }); // settle thud
    },

    // Soft short "place" tick — reinforcing a state.
    reinforce() {
      tone([220, 330], 0.0, 0.09, { type: 'sine', gain: 0.45 });
    },

    // Bright rising two-note — successful capture.
    capture() {
      tone(660,  0.0,  0.09, { type: 'square', gain: 0.4 });
      tone(990,  0.09, 0.12, { type: 'square', gain: 0.45 });
    },

    // Lower descending tone — a player/army eliminated.
    eliminate() {
      tone([330, 110], 0.0, 0.28, { type: 'sawtooth', gain: 0.4 });
    },

    // Tiny UI tick.
    click() {
      tone(880, 0.0, 0.035, { type: 'square', gain: 0.3 });
    },

    // Short ascending triad fanfare — victory.
    win() {
      tone(523.25, 0.0,  0.12, { type: 'square', gain: 0.4 }); // C5
      tone(659.25, 0.1,  0.12, { type: 'square', gain: 0.4 }); // E5
      tone(783.99, 0.2,  0.14, { type: 'square', gain: 0.4 }); // G5
      tone(1046.5, 0.32, 0.22, { type: 'square', gain: 0.45 }); // C6
    },
  };

  // ---- Public API ----------------------------------------------------------

  function play(name) {
    if (muted) return;
    try {
      const fn = sounds[name];
      if (!fn) return;
      if (!ensureContext()) return;
      fn();
    } catch (e) {
      // Fail silently — audio is never critical.
    }
  }

  function setMuted(value) {
    muted = !!value;
  }

  return { play, setMuted };
}
