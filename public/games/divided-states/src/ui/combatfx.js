// combatfx.js — dice + capture animations overlaid on the map.
// Self-contained UI module. Reads nothing from GameState; just renders effects.
//
// export function createCombatFx({ layer, svg }) -> { playAttack, playCapture, setMuted, cellCenterPx }
//
// `layer` is the #fx-layer HTML overlay (absolutely positioned, pointer-events:none).
// `svg`   is the #map-svg element (viewBox "0 0 1100 740", preserveAspectRatio default
//          xMidYMid meet => letterboxed). We map viewBox coords -> layer-local pixels.

import { STATE_CENTROIDS } from "../data/states-paths.js";

const VB_W = 1100;
const VB_H = 740;

const STYLE_ID = "combatfx-styles";

// Pip layouts for faces 1..6 on a 3x3 grid (cells 0..8, row-major).
const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
.cfx-die {
  position: absolute;
  width: 36px;
  height: 36px;
  margin-left: -18px;
  margin-top: -18px;
  border-radius: 9px;
  box-sizing: border-box;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1px;
  pointer-events: none;
  will-change: transform, opacity, box-shadow;
  transform: translateZ(0);
  box-shadow:
    0 3px 8px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -2px 3px rgba(0,0,0,0.35);
  transition:
    transform 0.16s cubic-bezier(.2,.9,.3,1.2),
    opacity 0.2s ease-out,
    box-shadow 0.16s ease-out,
    filter 0.16s ease-out;
}
.cfx-die.cfx-attacker {
  background: linear-gradient(150deg, #f06b62 0%, #c0392c 60%, #9c2820 100%);
}
.cfx-die.cfx-defender {
  background: linear-gradient(150deg, #5e95ec 0%, #2f63c4 60%, #244e9c 100%);
}
.cfx-die .cfx-pip {
  border-radius: 50%;
  align-self: center;
  justify-self: center;
  width: 6px;
  height: 6px;
  background: #fff;
  box-shadow: 0 0 1px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(0,0,0,0.25);
}
/* Numeral fallback for faces outside 1..6 */
.cfx-die.cfx-num {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
/* spawn / settle states */
.cfx-die.cfx-enter { transform: scale(0.3) rotate(-14deg); opacity: 0; }
.cfx-die.cfx-settle { animation: cfx-settle 0.22s cubic-bezier(.2,.9,.3,1.25); }
.cfx-die.cfx-rolling { animation: cfx-tumble 0.3s ease-in-out infinite; }

.cfx-die.cfx-lost {
  opacity: 0.32;
  transform: scale(0.78);
  filter: grayscale(0.5);
  box-shadow: 0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08);
}
.cfx-die.cfx-loseflash { animation: cfx-loseflash 0.34s ease-out; }
.cfx-die.cfx-won {
  box-shadow:
    0 0 0 2px #fff,
    0 0 12px rgba(255,255,255,0.7),
    0 3px 8px rgba(0,0,0,0.5);
}

@keyframes cfx-tumble {
  0%   { transform: rotate(-4deg); }
  50%  { transform: rotate(4deg); }
  100% { transform: rotate(-4deg); }
}
@keyframes cfx-settle {
  0%   { transform: scale(1.18) rotate(3deg); }
  60%  { transform: scale(0.94) rotate(-1deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes cfx-loseflash {
  0%   { box-shadow: 0 0 0 0 rgba(255,60,52,0); }
  25%  { box-shadow: 0 0 0 3px rgba(255,70,60,0.95), 0 0 16px rgba(255,60,52,0.85); filter: brightness(1.4); }
  100% { box-shadow: 0 0 0 0 rgba(255,60,52,0); }
}

/* ---- capture shockwave ---- */
.cfx-capture {
  position: absolute;
  pointer-events: none;
  width: 0; height: 0;
}
.cfx-ring {
  position: absolute;
  left: 0; top: 0;
  width: 44px;
  height: 44px;
  margin-left: -22px;
  margin-top: -22px;
  border-radius: 50%;
  border: 4px solid var(--cfx-tone, #ffd34d);
  box-shadow: 0 0 18px var(--cfx-glow, rgba(255,211,77,0.85));
  animation: cfx-pulse 0.32s cubic-bezier(.15,.7,.3,1) forwards;
}
.cfx-ring.cfx-ring2 {
  animation: cfx-pulse 0.34s cubic-bezier(.15,.7,.3,1) 0.06s forwards;
  opacity: 0;
}
.cfx-core {
  position: absolute;
  left: 0; top: 0;
  width: 22px; height: 22px;
  margin-left: -11px; margin-top: -11px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--cfx-tone, #fff3c4) 0%, var(--cfx-glow, rgba(255,211,77,0.6)) 55%, transparent 75%);
  animation: cfx-core 0.3s ease-out forwards;
}
.cfx-spark {
  position: absolute;
  left: 0; top: 0;
  width: 5px; height: 5px;
  margin-left: -2.5px; margin-top: -2.5px;
  border-radius: 50%;
  background: var(--cfx-tone, #ffe08a);
  box-shadow: 0 0 6px var(--cfx-glow, rgba(255,211,77,0.9));
  animation: cfx-spark 0.34s ease-out forwards;
}
@keyframes cfx-pulse {
  0%   { transform: scale(0.25); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: scale(3.4); opacity: 0; }
}
@keyframes cfx-core {
  0%   { transform: scale(0.4); opacity: 0; }
  35%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes cfx-spark {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(var(--sx,0), var(--sy,0)) scale(0.3); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cfx-die.cfx-rolling,
  .cfx-die.cfx-settle,
  .cfx-die.cfx-loseflash { animation: none; }
  .cfx-die { transition: opacity 0.15s ease-out; }
  .cfx-ring, .cfx-ring2, .cfx-core, .cfx-spark { animation-duration: 0.2s; }
}
`;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createCombatFx({ layer, svg }) {
  injectStyles();
  let muted = false; // stored only; rendering is silent either way.

  // Convert a viewBox coordinate (vx,vy in 0..1100 / 0..740) to layer-local pixels.
  // The SVG uses xMidYMid meet => content is letterboxed/centered inside the rendered box.
  function vbToLayerPx(vx, vy) {
    const sRect = svg.getBoundingClientRect();
    const lRect = layer.getBoundingClientRect();
    // Letterbox: uniform scale = min of the two axis ratios; centered remainder.
    const scale = Math.min(sRect.width / VB_W, sRect.height / VB_H);
    const drawnW = VB_W * scale;
    const drawnH = VB_H * scale;
    const padX = (sRect.width - drawnW) / 2;
    const padY = (sRect.height - drawnH) / 2;
    // viewBox point -> viewport px
    const vpX = sRect.left + padX + vx * scale;
    const vpY = sRect.top + padY + vy * scale;
    // viewport px -> layer-local px
    return { x: vpX - lRect.left, y: vpY - lRect.top, scale };
  }

  function cellCenterPx(code) {
    const c = STATE_CENTROIDS[code];
    if (!c) return { x: 0, y: 0, scale: 1 };
    return vbToLayerPx(c[0], c[1]); // centroids are already in viewBox coords
  }

  // Render a die face: pips for 1..6, numeral otherwise.
  function setDieFace(el, value) {
    el.textContent = "";
    const v = Number(value);
    const layout = Number.isInteger(v) && PIP_LAYOUT[v];
    if (layout) {
      el.classList.remove("cfx-num");
      const set = new Set(layout);
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("span");
        if (set.has(i)) cell.className = "cfx-pip";
        // grid auto-places in order; empty span just holds the cell.
        el.appendChild(cell);
      }
    } else {
      el.classList.add("cfx-num");
      el.textContent = value == null ? "?" : String(value);
    }
  }

  function makeDie(value, side, x, y) {
    const el = document.createElement("div");
    el.className = `cfx-die cfx-${side} cfx-enter`;
    setDieFace(el, value);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    // next frame: enter (lets the transition fire)
    requestAnimationFrame(() => {
      el.classList.remove("cfx-enter");
      el.classList.add("cfx-settle");
    });
    return el;
  }

  // Choose which rounds to show and how long to hold each. We bias HARD toward a
  // long, readable hold of the final faces — the previous version cleared dice in
  // ~140ms, too fast to read. `fast` (AI attacks) collapses to one quick round so
  // AI turns don't drag.
  function planRounds(rounds, fast) {
    if (!Array.isArray(rounds) || rounds.length === 0) {
      return { shown: [], perRound: 0 };
    }
    if (fast) {
      // AI: just the decisive final round, brief.
      return { shown: [rounds[rounds.length - 1]], perRound: 340 };
    }
    // Human: show the decisive final round clearly; for multi-round fights also show
    // the opening round first. Each round gets a generous hold so you can read it.
    const shown = rounds.length <= 1 ? [rounds[0]] : [rounds[0], rounds[rounds.length - 1]];
    return { shown, perRound: 1200 };
  }

  async function playAttack(fromCode, toCode, rounds, opts = {}) {
    const reduce = prefersReduced();
    const fast = !!opts.fast;
    const onRoll = typeof opts.onRoll === "function" ? opts.onRoll : null;

    const { shown, perRound } = planRounds(rounds, fast);
    if (shown.length === 0) return;

    const from = cellCenterPx(fromCode);
    const to = cellCenterPx(toCode);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    // Attacker dice cluster sits toward `from`; defender toward `to`.
    const atkPos = { x: mid.x + (from.x - mid.x) * 0.6, y: mid.y + (from.y - mid.y) * 0.6 };
    const defPos = { x: mid.x + (to.x - mid.x) * 0.6, y: mid.y + (to.y - mid.y) * 0.6 };

    const live = [];
    const spawn = (val, side, base, idx) => {
      const offset = idx * 42 - 21;
      const el = makeDie(val, side, base.x + offset, base.y);
      live.push(el);
      return el;
    };
    const clearLive = () => {
      while (live.length) live.pop().remove();
    };

    try {
      for (let r = 0; r < shown.length; r++) {
        const round = shown[r] || {};
        const aRolls = Array.isArray(round.attackerRolls) ? round.attackerRolls : [];
        const dRolls = Array.isArray(round.defenderRolls) ? round.defenderRolls : [];

        // Clear previous round's dice.
        clearLive();

        const aDice = aRolls.map((v, i) => spawn(v, "attacker", atkPos, i));
        const dDice = dRolls.map((v, i) => spawn(v, "defender", defPos, i));
        const all = aDice.concat(dDice);

        const rollMs = reduce ? 0 : (fast ? 130 : 260);
        if (onRoll) onRoll(); // rolling sound, synced to this round's tumble
        if (rollMs > 0) {
          all.forEach((d) => {
            d.classList.remove("cfx-settle");
            d.classList.add("cfx-rolling");
          });
          await sleep(rollMs);
          all.forEach((d) => {
            d.classList.remove("cfx-rolling");
            d.classList.add("cfx-settle");
          });
        }

        // Flag winners/losers per compared pair.
        // attackerRoll > defenderRoll => defender loses; ties => attacker loses.
        const pairs = Math.min(aRolls.length, dRolls.length);
        for (let p = 0; p < pairs; p++) {
          const a = aRolls[p];
          const d = dRolls[p];
          const attackerWins = a > d;
          const winner = attackerWins ? aDice[p] : dDice[p];
          const loser = attackerWins ? dDice[p] : aDice[p];
          winner.classList.add("cfx-won");
          if (!reduce) loser.classList.add("cfx-loseflash");
          loser.classList.add("cfx-lost");
        }

        // Hold the settled faces so the result is clearly readable before clearing.
        const holdMs = Math.max(180, perRound - rollMs);
        await sleep(holdMs);
      }
    } finally {
      clearLive();
    }
  }

  async function playCapture(code, color) {
    const reduce = prefersReduced();
    const { x, y } = cellCenterPx(code);

    const wrap = document.createElement("div");
    wrap.className = "cfx-capture";
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;

    // Optional owner color tinting; defaults to a bright war-room amber.
    if (typeof color === "string" && color) {
      wrap.style.setProperty("--cfx-tone", color);
      wrap.style.setProperty("--cfx-glow", color);
    }

    const core = document.createElement("div");
    core.className = "cfx-core";
    const ring = document.createElement("div");
    ring.className = "cfx-ring";
    wrap.appendChild(core);
    wrap.appendChild(ring);

    if (!reduce) {
      const ring2 = document.createElement("div");
      ring2.className = "cfx-ring cfx-ring2";
      wrap.appendChild(ring2);
      // Radiating sparks.
      const SPARKS = 8;
      for (let i = 0; i < SPARKS; i++) {
        const ang = (i / SPARKS) * Math.PI * 2;
        const dist = 26 + Math.random() * 10;
        const sp = document.createElement("div");
        sp.className = "cfx-spark";
        sp.style.setProperty("--sx", `${Math.cos(ang) * dist}px`);
        sp.style.setProperty("--sy", `${Math.sin(ang) * dist}px`);
        wrap.appendChild(sp);
      }
    }

    layer.appendChild(wrap);
    try {
      await sleep(reduce ? 200 : 340);
    } finally {
      wrap.remove();
    }
  }

  function setMuted(bool) {
    muted = !!bool;
  }

  return { playAttack, playCapture, setMuted, cellCenterPx };
}
