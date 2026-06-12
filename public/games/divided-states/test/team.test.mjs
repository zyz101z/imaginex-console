// Team-mode tests: team victory (last team standing), no attacking teammates,
// proportional region-bonus split, and through-only fortify across allies.
// Run: node test/team.test.mjs

import { STATE_CODES } from "../src/data/states.js";
import { REGIONS } from "../src/data/regions.js";
import { ADJACENCY } from "../src/data/adjacency.js";
import {
  createGame, autoDistribute, currentPlayerId, currentPlayer, playerById, statesOf,
  teamsAlive, sameTeam,
} from "../src/engine/gamestate.js";
import {
  beginTurn, placeArmies, endReinforcement, executeAttackUntilDecided, fortify, canFortify,
  reachableOwned, regionBonus, legalAttacks, turnInSet, endTurn,
} from "../src/engine/rules.js";
import { findSet } from "../src/engine/cards.js";
import * as ai from "../src/ai/ai.js";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };

// headless AI turn (mirrors main.js aiTurn, no animation)
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
    const b = owned.find((c) => ADJACENCY[c].some((n) => !sameTeam(s, s.owner[n], pid))) || owned[0];
    if (b) placeArmies(s, pid, b, s.reinforcementsRemaining);
  }
  endReinforcement(s);
  let guard = 0;
  while (guard++ < 60 && s.phase !== "gameover") {
    const mv = ai.chooseAttack(s, pid, diff);
    if (!mv) break;
    // sanity: AI must never be handed an attack on an ally
    if (sameTeam(s, s.owner[mv.from], s.owner[mv.to])) throw new Error("AI tried to attack an ally!");
    executeAttackUntilDecided(s, mv.from, mv.to, s.armies[mv.from] - 1);
  }
  if (s.phase !== "gameover") s.phase = "fortify";
}

// ---- 1. 2v2 game -> one team wins, owns all 49 ----
function team2v2(seed) {
  const s = createGame({ playerCount: 4, seed, players: [
    { name: "A1", isAI: true, difficulty: "officer", team: 0 },
    { name: "A2", isAI: true, difficulty: "officer", team: 0 },
    { name: "B1", isAI: true, difficulty: "general", team: 1 },
    { name: "B2", isAI: true, difficulty: "general", team: 1 },
  ]});
  autoDistribute(s);
  beginTurn(s);
  let guard = 0, noAllyAttack = true;
  try {
    while (s.winner === null && guard < 6000) { aiPlayTurn(s); endTurn(s); guard++; }
  } catch (e) { noAllyAttack = false; }
  return { s, decided: s.winner !== null, noAllyAttack, guard };
}
let allWon = true, allClean = true;
for (let seed = 1; seed <= 6; seed++) {
  const r = team2v2(seed);
  if (!r.decided) allWon = false;
  if (!r.noAllyAttack) allClean = false;
  if (r.decided) {
    const winTeam = r.s.winningTeam;
    const teamStates = r.s.players.filter((p) => p.team === winTeam).reduce((a, p) => a + statesOf(r.s, p.id).length, 0);
    if (teamStates !== 49 || teamsAlive(r.s).length !== 1) allWon = false;
  }
}
ok(allWon, "2v2 games end with a single winning team owning all 49");
ok(allClean, "AI never attacks an ally (legalAttacks excludes teammates)");

// spot-check: legalAttacks never targets a teammate
{
  const s = createGame({ playerCount: 4, seed: 3, players: [{team:0},{team:0},{team:1},{team:1}] });
  autoDistribute(s);
  let anyAllyTarget = false;
  for (const p of s.players) for (const m of legalAttacks(s, p.id))
    if (sameTeam(s, s.owner[m.to], p.id)) anyAllyTarget = true;
  ok(!anyAllyTarget, "legalAttacks never returns an allied target");
}

// ---- 2. proportional region split ----
{
  const s = createGame({ playerCount: 4, seed: 1, players: [{team:0},{team:0},{team:1},{team:1}] });
  const NE = REGIONS.northeast.states; // 9 states, bonus 5
  NE.forEach((c, i) => { s.owner[c] = i < 5 ? 0 : 1; s.armies[c] = 1; }); // p0 holds 5, p1 holds 4
  const b0 = regionBonus(s, 0), b1 = regionBonus(s, 1);
  ok(b0 + b1 === REGIONS.northeast.bonus, `team region bonus sums to the region's bonus (${b0}+${b1})`);
  ok(b0 === 3 && b1 === 2, `proportional split: 5/9->+3, 4/9->+2 (got ${b0},${b1})`);
  // an enemy owning one NE state -> team no longer owns the region -> no bonus
  s.owner[NE[0]] = 2;
  ok(regionBonus(s, 0) === 0, "no region bonus when an enemy holds part of it");
}

// ---- 3. through-only fortify across an ally ----
{
  // CA(p0) - OR(p1, ally) - WA(p0): CA and WA connect only through ally OR.
  const s = createGame({ playerCount: 3, seed: 1, players: [{team:0},{team:0},{team:1}] });
  STATE_CODES.forEach((c) => { s.owner[c] = 2; s.armies[c] = 1; }); // enemy owns the rest
  s.owner.CA = 0; s.armies.CA = 5;
  s.owner.OR = 1; s.armies.OR = 1; // ally
  s.owner.WA = 0; s.armies.WA = 1;
  const reach = reachableOwned(s, 0, "CA");
  ok(reach.includes("WA"), "fortify path routes through an ally to reach own cut-off state");
  ok(!reach.includes("OR"), "ally's state is NOT a valid fortify destination (no gifting)");
  ok(canFortify(s, "CA", "WA", 3), "can fortify own->own through ally territory");
  ok(!canFortify(s, "CA", "OR", 3), "cannot fortify onto an ally's state");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:"); fails.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
else console.log("All team tests passed ✓");
