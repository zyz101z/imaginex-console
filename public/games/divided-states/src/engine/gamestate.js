// Game state: players, ownership, armies, phase, turn order, seeded RNG.
// The state object is the single source of truth the rest of the engine mutates.

import { STATE_CODES } from "../data/states.js";
import { buildDeck, shuffle } from "./cards.js";

const DEFAULT_COLORS = ["#d64550", "#3b7dd8", "#46a758", "#e0a93b", "#9c5bd6", "#26b3b3"];

// Total starting armies per player, scaled for the 49-state map.
export const STARTING_ARMIES = { 2: 45, 3: 38, 4: 32, 5: 27, 6: 23 };

// mulberry32 — small, fast, seedable PRNG for reproducible games/tests.
// The generator's internal word lives on the state object (`_rngState`) so a
// serialized game resumes with the exact same dice it would have rolled.
function makeRng(s) {
  return function () {
    s._rngState = (s._rngState + 0x6d2b79f5) | 0;
    const a = s._rngState;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Win modes: "domination" (classic last-team-standing), "regions" (first team to
// control `winTarget` full regions), "turnlimit" (most territory when round
// `turnLimit` ends — a shorter "Blitz" game).
export function createGame({
  playerCount = 4, seed = 1, players = null,
  winMode = "domination", winTarget = 4, turnLimit = 15,
} = {}) {
  if (playerCount < 2 || playerCount > 6) throw new Error("playerCount must be 2-6");

  const playerList =
    players ||
    Array.from({ length: playerCount }, (_, i) => ({
      isAI: true,
      difficulty: "officer",
      name: `Player ${i + 1}`,
    }));

  const state = {
    seed,
    _rngState: seed >>> 0,
    _rng: null, // attached below (reads/writes _rngState so saves stay exact)
    players: playerList.map((p, i) => ({
      id: i,
      name: p.name || `Player ${i + 1}`,
      color: p.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      isAI: p.isAI !== undefined ? p.isAI : true,
      difficulty: p.difficulty || "officer",
      // Team id. Default = own index → every player on their own team (free-for-all).
      team: p.team !== undefined && p.team !== null ? p.team : i,
      cards: [],
      alive: true,
      stats: { captures: 0, eliminations: 0, setsTraded: 0 },
    })),
    order: playerList.map((_, i) => i),
    turnPointer: 0,
    phase: "setup", // setup -> reinforce -> attack -> fortify -> (next turn)
    owner: Object.fromEntries(STATE_CODES.map((c) => [c, null])),
    armies: Object.fromEntries(STATE_CODES.map((c) => [c, 0])),
    reinforcementsRemaining: 0,
    conqueredThisTurn: false,
    deck: [],
    discard: [],
    setsTurnedIn: 0,
    winner: null,
    winningTeam: null,
    winMode,
    winTarget: winMode === "regions" ? winTarget : null,
    turnLimit: winMode === "turnlimit" ? turnLimit : null,
    winMethod: null, // set at gameover: "domination" | "regions" | "turnlimit"
    round: 1, // full cycles through the turn order (drives the Blitz limit)
    turnNumber: 0,
    log: [],
  };
  state._rng = makeRng(state);
  state.deck = shuffle(buildDeck(), state._rng);
  return state;
}

// --- Save / resume ---
// Everything in the state is plain JSON except _rng (a closure over _rngState,
// which IS serialized) — so a round-trip resumes mid-game with identical dice.
export function serializeGame(s) {
  const { _rng, ...rest } = s;
  return JSON.stringify(rest);
}

export function deserializeGame(json) {
  const s = typeof json === "string" ? JSON.parse(json) : json;
  s._rng = makeRng(s);
  return s;
}

export const playerCount = (s) => s.players.length;
export const currentPlayerId = (s) => s.order[s.turnPointer];
export const currentPlayer = (s) => s.players[currentPlayerId(s)];
export const playerById = (s, id) => s.players[id];
export const ownerOf = (s, code) => s.owner[code];
export const armiesOf = (s, code) => s.armies[code];
export const statesOf = (s, playerId) =>
  STATE_CODES.filter((c) => s.owner[c] === playerId);
export const alivePlayers = (s) => s.players.filter((p) => p.alive);

// --- Teams ---
// Two players are allies if they share a team. A player is always their own ally.
export const sameTeam = (s, a, b) =>
  a != null && b != null && s.players[a] && s.players[b] && s.players[a].team === s.players[b].team;
export const teamOf = (s, playerId) => s.players[playerId].team;
export const teammates = (s, playerId) =>
  s.players.filter((p) => p.team === s.players[playerId].team).map((p) => p.id);
// Distinct teams that still have at least one living player.
export const teamsAlive = (s) => [...new Set(s.players.filter((p) => p.alive).map((p) => p.team))];

export function logEvent(s, msg) {
  s.log.push({ turn: s.turnNumber, msg });
  if (s.log.length > 500) s.log.shift();
}

// --- Setup helpers ---

// Interactive draft pick (used by UI phase 2). Claims one unowned state.
export function draftPick(s, playerId, code) {
  if (s.owner[code] !== null) throw new Error(`${code} already claimed`);
  s.owner[code] = playerId;
  s.armies[code] = 1;
}

// Scatter each player's remaining starting armies across the states they already
// own (each owned state already has 1). Used after both random and draft claims.
export function placeInitialArmies(s) {
  const total = STARTING_ARMIES[playerCount(s)] || 30;
  for (const p of s.players) {
    const owned = statesOf(s, p.id);
    if (!owned.length) continue;
    let extra = total - owned.length;
    while (extra > 0) {
      const code = owned[Math.floor(s._rng() * owned.length)];
      s.armies[code]++;
      extra--;
    }
  }
}

// Quick random distribution — used by tests and as the "random" claim option.
// Assigns every state round-robin (1 army each), then scatters starting armies.
export function autoDistribute(s) {
  const codes = shuffle([...STATE_CODES], s._rng);
  codes.forEach((code, i) => {
    const pid = s.order[i % s.order.length];
    s.owner[code] = pid;
    s.armies[code] = 1;
  });
  placeInitialArmies(s);
}

// All states still unclaimed? (used to detect the end of an interactive draft)
export function allStatesClaimed(s) {
  return STATE_CODES.every((c) => s.owner[c] !== null);
}
export function unclaimedStates(s) {
  return STATE_CODES.filter((c) => s.owner[c] === null);
}
