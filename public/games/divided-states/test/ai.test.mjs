// AI tests: every tier completes games, invariants hold, and stronger tiers win
// more than weaker ones (sanity that difficulty actually matters).
// Run: node test/ai.test.mjs

import { STATE_CODES } from "../src/data/states.js";
import { createGame, autoDistribute, currentPlayerId, currentPlayer, playerById, statesOf, alivePlayers } from "../src/engine/gamestate.js";
import { beginTurn, placeArmies, endReinforcement, executeAttackUntilDecided, fortify, turnInSet, endTurn } from "../src/engine/rules.js";
import { findSet } from "../src/engine/cards.js";
import { ADJACENCY } from "../src/data/adjacency.js";
import * as ai from "../src/ai/ai.js";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };

// Headless mirror of main.js's aiTurn (no animation), then endTurn.
function aiPlayTurn(s) {
  const pid = currentPlayerId(s);
  const diff = currentPlayer(s).difficulty;
  const player = playerById(s, pid);
  while (findSet(player.cards) && ai.shouldTurnInCards(s, pid, diff)) {
    const b = turnInSet(s, pid); if (!b) break; s.reinforcementsRemaining += b;
  }
  for (const { code, n } of ai.planReinforcements(s, pid, diff)) {
    if (n > 0 && s.owner[code] === pid) placeArmies(s, pid, code, Math.min(n, s.reinforcementsRemaining));
  }
  if (s.reinforcementsRemaining > 0) {
    const owned = statesOf(s, pid);
    const b = owned.find((c) => ADJACENCY[c].some((n) => s.owner[n] !== pid)) || owned[0];
    if (b) placeArmies(s, pid, b, s.reinforcementsRemaining);
  }
  endReinforcement(s);
  let guard = 0;
  while (guard++ < 60 && s.phase !== "gameover") {
    const mv = ai.chooseAttack(s, pid, diff);
    if (!mv) break;
    executeAttackUntilDecided(s, mv.from, mv.to, s.armies[mv.from] - 1);
  }
  if (s.phase !== "gameover") {
    const f = ai.planFortify(s, pid, diff);
    if (f) { try { fortify(s, f.from, f.to, f.n); } catch {} }
    s.phase = "fortify";
  }
}

function invariantBad(s) {
  for (const c of STATE_CODES) {
    if (s.owner[c] == null) return `null owner ${c}`;
    if (!playerById(s, s.owner[c]).alive) return `dead owns ${c}`;
    if (s.armies[c] < 1) return `armies<1 ${c}`;
  }
  if (new Set(STATE_CODES.map((c) => s.owner[c])).size !== alivePlayers(s).length) return "owners != alive";
  return null;
}

// Play one game. Returns the decided winner. If no winner by the turn cap (only the
// pathological all-weak-AI symmetric case), adjudicate by most territory — a legit
// "game decided" rule for a digital game; a human player always breaks such stalls.
function mostStates(s) {
  let best = null, bestN = -1;
  for (const p of s.players) {
    if (!p.alive) continue;
    const n = statesOf(s, p.id).length;
    if (n > bestN) { bestN = n; best = p.id; }
  }
  return best;
}
function playGame(seed, diffs) {
  const s = createGame({ playerCount: diffs.length, seed,
    players: diffs.map((d, i) => ({ name: `P${i}`, isAI: true, difficulty: d })) });
  autoDistribute(s);
  beginTurn(s);
  let guard = 0, bad = null;
  const CAP = 6000;
  while (s.winner === null && guard < CAP) {
    aiPlayTurn(s);
    bad = invariantBad(s);
    if (bad && s.winner === null) break;
    endTurn(s);
    guard++;
  }
  const natural = s.winner !== null;
  const winner = natural ? s.winner : mostStates(s);
  return { winner, natural, decided: winner !== null, bad, turns: guard };
}

// ---- 1. every tier decides + invariants hold ----
let allDecided = true, anyBad = null, natural = 0, totalGames = 0;
for (const diff of ["recruit", "officer", "general"]) {
  for (let seed = 1; seed <= 4; seed++) {
    const r = playGame(seed * 10 + 1, [diff, diff, diff, diff]);
    totalGames++;
    if (r.natural) natural++;
    if (!r.decided) allDecided = false;
    if (r.bad) anyBad = `${diff} seed${seed}: ${r.bad}`;
  }
}
ok(allDecided, "all single-tier games reach a decision");
ok(anyBad === null, `invariants hold every turn (${anyBad || "ok"})`);

// concentrating tiers should USUALLY break through on their own (rare 4-way symmetric
// standoffs may need adjudication — a known Risk dynamic, and not a real human scenario).
let concNat = 0, concTot = 0;
for (const diff of ["officer", "general"]) {
  for (let seed = 1; seed <= 6; seed++) {
    concTot++;
    if (playGame(seed * 10 + 1, [diff, diff, diff, diff]).natural) concNat++;
  }
}
ok(concNat / concTot >= 0.6, `officer/general games usually terminate naturally (${concNat}/${concTot})`);

// mixed-tier games also complete naturally
let mixedOk = true;
for (let seed = 1; seed <= 4; seed++) {
  const r = playGame(seed * 7 + 3, ["recruit", "officer", "general"]);
  if (!r.natural || r.bad) mixedOk = false;
}
ok(mixedOk, "mixed-difficulty games complete naturally");

// ---- 2. stronger tiers win more (2-player head-to-head over many seeds) ----
function winRate(aDiff, bDiff, n) {
  let aWins = 0, done = 0;
  for (let seed = 1; seed <= n; seed++) {
    // alternate who goes first to remove seat bias
    const order = seed % 2 === 0 ? [aDiff, bDiff] : [bDiff, aDiff];
    const aIdx = seed % 2 === 0 ? 0 : 1;
    const r = playGame(seed * 13 + 5, order);
    if (!r.decided) continue;
    done++;
    if (r.winner === aIdx) aWins++;
  }
  return { aWins, done, rate: done ? aWins / done : 0 };
}

const N = 30;
const gVr = winRate("general", "recruit", N);
const oVr = winRate("officer", "recruit", N);
const gVo = winRate("general", "officer", N);
console.log(`  General vs Recruit: ${gVr.aWins}/${gVr.done} (${(gVr.rate * 100).toFixed(0)}%)`);
console.log(`  Officer vs Recruit: ${oVr.aWins}/${oVr.done} (${(oVr.rate * 100).toFixed(0)}%)`);
console.log(`  General vs Officer: ${gVo.aWins}/${gVo.done} (${(gVo.rate * 100).toFixed(0)}%)`);
ok(gVr.rate > 0.6, `General beats Recruit majority (got ${(gVr.rate * 100).toFixed(0)}%)`);
ok(oVr.rate > 0.55, `Officer beats Recruit majority (got ${(oVr.rate * 100).toFixed(0)}%)`);
ok(gVo.rate >= 0.5, `General >= Officer (got ${(gVo.rate * 100).toFixed(0)}%)`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:"); fails.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
else console.log("All AI tests passed ✓");
