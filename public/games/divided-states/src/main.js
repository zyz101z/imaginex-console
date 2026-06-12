// Controller: owns the GameState and the turn loop; wires the engine to the
// (Opus-built) UI modules and a placeholder greedy AI (real AI = Phase 4).

import {
  createGame, autoDistribute, currentPlayer, currentPlayerId, playerById, statesOf,
  placeInitialArmies, allStatesClaimed, unclaimedStates, draftPick,
} from "./engine/gamestate.js";
import {
  beginTurn, placeArmies, endReinforcement, legalAttacks, executeAttackRound,
  reachableOwned, fortify, turnInSet, endTurn, reinforcementCount,
} from "./engine/rules.js";
import { winProbability } from "./engine/combat.js";
import { findSet } from "./engine/cards.js";
import { ADJACENCY } from "./data/adjacency.js";
import { REGIONS } from "./data/regions.js";
import * as ai from "./ai/ai.js";

import { createMap } from "./ui/map.js";
import { createHud } from "./ui/hud.js";
import { createLog } from "./ui/log.js";
import { createMenus } from "./ui/menus.js";
import { createCombatFx } from "./ui/combatfx.js";
import { createAudio } from "./ui/audio.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let state = null;
let selFrom = null; // selected source state during attack/fortify
const ui = {};
let busy = false; // true while AI/animation runs — blocks input
let winReported = false; // guard so a win is reported to the host (ImagineX) only once

// When a HUMAN wins, bump a local cumulative win count and report it to the host
// page (ImagineX leaderboard). Standalone, window.parent is self and this is a no-op.
function finishGame() {
  if (state && state.winner != null && !state.players[state.winner].isAI && !winReported) {
    winReported = true;
    let wins = 0;
    try { wins = parseInt(localStorage.getItem("dividedstates_wins") || "0", 10) || 0; } catch {}
    wins += 1;
    try { localStorage.setItem("dividedstates_wins", String(wins)); } catch {}
    try {
      window.parent.postMessage(
        { type: "imaginex-score", gameId: "divided-states", score: wins, nickname: "Player" }, "*");
    } catch { /* not embedded */ }
  }
  ui.audio.play("win");
  ui.menus.showWin(state);
}

function init() {
  ui.audio = createAudio();
  ui.map = createMap({ svg: $("map-svg"), onStateClick: handleStateClick });
  ui.hud = createHud({
    topEl: $("hud-top"),
    sideEl: $("hud-side"),
    handlers: {
      onEndReinforce: () => { if (humanActive()) finishReinforce(); },
      onEndAttack: () => { if (humanActive() && state.phase === "attack") { selFrom = null; state.phase = "fortify"; refresh(); } },
      onEndFortify: () => { if (humanActive()) doEndTurn(); },
      onEndTurn: () => { if (humanActive()) doEndTurn(); },
      onTurnInCards: () => { if (humanActive() && state.phase === "reinforce") humanTurnInCards(); },
      onToggleMute: (m) => ui.audio.setMuted(m),
      onRegionHover: (key) => { if (state && ui.map) ui.map.setHighlights(key ? REGIONS[key].states : [], "region"); },
      onShowHelp: () => ui.menus.showHelp(() => ui.menus.hide()), // Back resumes the game
    },
  });
  ui.log = createLog({ root: $("log-root") });
  ui.fx = createCombatFx({ layer: $("fx-layer"), svg: $("map-svg") });
  ui.menus = createMenus({ root: $("menu-root"), onNewGame: startNewGame, onShowHelp: () => ui.menus.showHelp() });
  setupPanelToggle();
  ui.menus.showStart();
}

// Mobile/tablet only (the button is hidden on desktop via CSS): a toggle that
// collapses the side panel so the map fills the screen. Default = collapsed (big map);
// the choice is remembered. The End Turn bar stays pinned even when collapsed.
function setupPanelToggle() {
  const app = $("app");
  const btn = document.createElement("button");
  btn.id = "panel-toggle";
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle info panel");
  app.appendChild(btn);

  let collapsed = true; // default: maximize the map on small screens
  try { const v = localStorage.getItem("ds_panel_collapsed"); if (v !== null) collapsed = v === "1"; } catch {}
  const apply = () => {
    app.classList.toggle("panel-hidden", collapsed);
    btn.classList.toggle("active", collapsed);
    btn.textContent = collapsed ? "▣ Info" : "✕ Map";
  };
  apply();
  btn.addEventListener("click", () => {
    collapsed = !collapsed;
    try { localStorage.setItem("ds_panel_collapsed", collapsed ? "1" : "0"); } catch {}
    apply();
    if (ui.audio) ui.audio.play("click");
  });
}

function startNewGame({ playerCount = 4, humanCount = 1, difficulty = "officer", names = [], setup = "random" } = {}) {
  const players = Array.from({ length: playerCount }, (_, i) => {
    let name;
    if (i < humanCount) {
      const entered = names[i] && String(names[i]).trim();
      name = entered || (humanCount > 1 ? `Player ${i + 1}` : "You");
    } else {
      name = `CPU ${i - humanCount + 1}`;
    }
    return { name, isAI: i >= humanCount, difficulty };
  });
  state = createGame({ playerCount, seed: (Date.now() & 0x7fffffff) || 1, players });
  winReported = false;
  ui.menus.hide();
  if (setup === "draft") {
    // Interactive claim: players take turns picking unclaimed states, then armies
    // are scattered and play begins. (Random setup skips straight to play.)
    state.phase = "draft";
    state.turnPointer = 0;
    refresh();
    runDraft();
  } else {
    autoDistribute(state);
    beginTurn(state);
    refresh();
    runTurn();
  }
}

const advanceDraftPicker = () => { state.turnPointer = (state.turnPointer + 1) % state.order.length; };

// Drive the interactive draft: AI picks automatically; a human picks by clicking an
// unclaimed state (see handleStateClick). When every state is claimed, scatter the
// starting armies and start the game.
async function runDraft() {
  if (allStatesClaimed(state)) {
    placeInitialArmies(state);
    state.turnPointer = 0;
    beginTurn(state);
    refresh();
    await runTurn();
    return;
  }
  const p = currentPlayer(state);
  if (p.isAI) {
    busy = true;
    refresh();
    await sleep(300);
    const code = ai.draftPick(state, currentPlayerId(state), p.difficulty);
    if (code) { draftPick(state, currentPlayerId(state), code); ui.audio.play("reinforce"); }
    advanceDraftPicker();
    busy = false;
    refresh();
    await runDraft();
  } else {
    busy = false;
    refresh(); // updateSelectable highlights the unclaimed states for the human picker
  }
}

function refresh() {
  ui.map.render(state);
  ui.hud.render(state);
  ui.log.render(state);
  updateSelectable();
}

const humanActive = () => state && !busy && !currentPlayer(state).isAI && state.phase !== "gameover";

function updateSelectable() {
  if (!state) return;
  ui.map.setHighlights([], "selected");
  if (state.phase === "draft") {
    const p = currentPlayer(state);
    ui.map.setSelectable(!busy && p && !p.isAI ? unclaimedStates(state) : null);
    return;
  }
  if (!humanActive()) { ui.map.setSelectable(null); return; }
  const pid = currentPlayerId(state);
  if (state.phase === "reinforce") {
    ui.map.setSelectable(statesOf(state, pid));
  } else if (state.phase === "attack") {
    if (selFrom) {
      const targets = ADJACENCY[selFrom].filter((c) => state.owner[c] !== pid);
      ui.map.setSelectable([selFrom, ...targets]);
      ui.map.setHighlights(targets, "attack");
      ui.map.setHighlights([selFrom], "selected");
    } else {
      ui.map.setSelectable(statesOf(state, pid).filter((c) => state.armies[c] >= 2 &&
        ADJACENCY[c].some((n) => state.owner[n] !== pid)));
    }
  } else if (state.phase === "fortify") {
    if (selFrom) {
      const reach = reachableOwned(state, pid, selFrom);
      ui.map.setSelectable([selFrom, ...reach]);
      ui.map.setHighlights(reach, "fortify");
      ui.map.setHighlights([selFrom], "selected");
    } else {
      ui.map.setSelectable(statesOf(state, pid).filter((c) => state.armies[c] > 1));
    }
  } else {
    ui.map.setSelectable(null);
  }
}

// ---- Human interaction ----
function handleStateClick(code) {
  // Draft: the current human picks an unclaimed state.
  if (state && state.phase === "draft") {
    if (busy || currentPlayer(state).isAI || state.owner[code] !== null) return;
    draftPick(state, currentPlayerId(state), code);
    ui.audio.play("reinforce");
    advanceDraftPicker();
    refresh();
    runDraft();
    return;
  }
  if (!humanActive()) return;
  const pid = currentPlayerId(state);
  if (state.phase === "reinforce") {
    if (state.owner[code] !== pid || state.reinforcementsRemaining <= 0) return;
    placeArmies(state, pid, code, 1);
    ui.audio.play("reinforce");
    if (state.reinforcementsRemaining <= 0) finishReinforce(); else refresh();
  } else if (state.phase === "attack") {
    if (!selFrom) {
      if (state.owner[code] === pid && state.armies[code] >= 2) { selFrom = code; updateSelectable(); }
    } else if (code === selFrom) {
      selFrom = null; updateSelectable();
    } else if (state.owner[code] !== pid && ADJACENCY[selFrom].includes(code)) {
      humanAttack(selFrom, code);
    } else if (state.owner[code] === pid && state.armies[code] >= 2) {
      selFrom = code; updateSelectable();
    }
  } else if (state.phase === "fortify") {
    if (!selFrom) {
      if (state.owner[code] === pid && state.armies[code] > 1) { selFrom = code; updateSelectable(); }
    } else if (reachableOwned(state, pid, selFrom).includes(code)) {
      const n = state.armies[selFrom] - 1;
      fortify(state, selFrom, code, n);
      ui.audio.play("reinforce");
      selFrom = null;
      doEndTurn();
    } else if (state.owner[code] === pid && state.armies[code] > 1) {
      selFrom = code; updateSelectable();
    }
  }
}

function finishReinforce() {
  endReinforcement(state);
  selFrom = null;
  refresh();
}

function humanTurnInCards() {
  const pid = currentPlayerId(state);
  if (!findSet(playerById(state, pid).cards)) return;
  const bonus = turnInSet(state, pid);
  state.reinforcementsRemaining += bonus;
  refresh();
}

async function humanAttack(from, to) {
  busy = true;
  const { rounds, captured } = resolveAttack(from, to, state.armies[from] - 1);
  await ui.fx.playAttack(from, to, rounds, { onRoll: () => { ui.audio.play("dice"); ui.audio.play("gunfire"); } });
  if (captured) { await ui.fx.playCapture(to); ui.audio.play("explosion"); }
  selFrom = null;
  busy = false;
  refresh();
}

async function doEndTurn() {
  endTurn(state);
  refresh();
  await runTurn();
}

// ---- Shared attack resolution (collect rounds for animation) ----
function resolveAttack(from, to, moveIfCaptured) {
  const rounds = [];
  let captured = false, eliminated = false;
  while (state.owner[from] !== state.owner[to] && state.armies[from] >= 2) {
    const r = executeAttackRound(state, from, to, moveIfCaptured);
    rounds.push({ attackerRolls: r.attackerRolls, defenderRolls: r.defenderRolls });
    if (r.captured) { captured = true; eliminated = r.eliminated; break; }
  }
  if (eliminated) ui.audio.play("eliminate");
  return { rounds, captured, eliminated };
}

// ---- Placeholder AI (greedy). Real AI is Phase 4. ----
async function runTurn() {
  if (!state || state.phase === "gameover") { if (state?.winner != null) finishGame(); return; }
  const p = currentPlayer(state);
  if (!p.isAI) { refresh(); return; } // hand control to the human
  busy = true;
  refresh();
  await sleep(350);
  await aiTurn();
  busy = false;
  if (state.phase !== "gameover") { endTurn(state); refresh(); await runTurn(); }
  else { refresh(); finishGame(); }
}

async function aiTurn() {
  const pid = currentPlayerId(state);
  const diff = currentPlayer(state).difficulty;
  const player = playerById(state, pid);

  // Reinforce: cash card sets per policy, then place by plan.
  while (findSet(player.cards) && ai.shouldTurnInCards(state, pid, diff)) {
    const b = turnInSet(state, pid); if (!b) break; state.reinforcementsRemaining += b;
  }
  for (const { code, n } of ai.planReinforcements(state, pid, diff)) {
    if (n > 0 && state.owner[code] === pid) placeArmies(state, pid, code, Math.min(n, state.reinforcementsRemaining));
  }
  if (state.reinforcementsRemaining > 0) { // safety: dump any remainder on a border
    const owned = statesOf(state, pid);
    const b = owned.find((c) => ADJACENCY[c].some((n) => state.owner[n] !== pid)) || owned[0];
    if (b) placeArmies(state, pid, b, state.reinforcementsRemaining);
  }
  endReinforcement(state);
  refresh();
  await sleep(280);

  // Attack: follow the AI's choices until it stops.
  let guard = 0;
  while (guard++ < 45 && state.phase !== "gameover") {
    const mv = ai.chooseAttack(state, pid, diff);
    if (!mv) break;
    const { rounds, captured } = resolveAttack(mv.from, mv.to, state.armies[mv.from] - 1);
    await ui.fx.playAttack(mv.from, mv.to, rounds, { fast: true, onRoll: () => { ui.audio.play("dice"); ui.audio.play("gunfire"); } });
    if (captured) { await ui.fx.playCapture(mv.to); ui.audio.play("explosion"); }
    refresh();
    await sleep(110);
  }

  // Fortify (one move).
  if (state.phase !== "gameover") {
    const f = ai.planFortify(state, pid, diff);
    if (f) { try { fortify(state, f.from, f.to, f.n); } catch { /* board shifted; skip */ } }
    state.phase = "fortify";
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
