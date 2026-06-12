// Headless engine tests for Divided States. Run: `node test/engine.test.mjs`
// Verifies data integrity, adjacency correctness, combat math, rules, cards,
// and runs full games to completion with a greedy bot.

import { STATES, STATE_CODES, STATE_BY_CODE } from "../src/data/states.js";
import { ADJACENCY, areAdjacent } from "../src/data/adjacency.js";
import { REGIONS } from "../src/data/regions.js";
import { resolveRound, winProbability, attackerDiceCount, defenderDiceCount } from "../src/engine/combat.js";
import { buildDeck, setBonus, isValidSet, findSet } from "../src/engine/cards.js";
import {
  createGame, autoDistribute, statesOf, currentPlayerId, playerById, alivePlayers,
} from "../src/engine/gamestate.js";
import {
  reinforcementCount, regionBonus, beginTurn, placeArmies, endReinforcement,
  legalAttacks, executeAttackUntilDecided, reachableOwned, turnInSet, drawCard,
  endTurn,
} from "../src/engine/rules.js";

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }
function approx(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

// ---------- 1. Data integrity ----------
ok(STATES.length === 49, `49 states (got ${STATES.length})`);
ok(new Set(STATE_CODES).size === 49, "state codes unique");
ok(!STATE_CODES.includes("HI"), "Hawaii excluded");

const regionUnion = [];
for (const k of Object.keys(REGIONS)) regionUnion.push(...REGIONS[k].states);
ok(regionUnion.length === 49, `regions cover 49 slots (got ${regionUnion.length})`);
ok(new Set(regionUnion).size === 49, "no state in two regions");
ok(regionUnion.every((c) => STATE_BY_CODE[c]), "all region states are real");
ok(STATE_CODES.every((c) => regionUnion.includes(c)), "every state is in a region");
// state.region matches region membership
ok(STATES.every((s) => REGIONS[s.region]?.states.includes(s.code)), "state.region consistent");

// ---------- 2. Adjacency ----------
ok(Object.keys(ADJACENCY).length === 49, "adjacency has 49 entries");
ok(STATE_CODES.every((c) => ADJACENCY[c]), "every state has an adjacency list");
let symmetric = true, selfLoop = false, dupes = false, badRef = false;
for (const a of Object.keys(ADJACENCY)) {
  const ns = ADJACENCY[a];
  if (new Set(ns).size !== ns.length) dupes = true;
  for (const b of ns) {
    if (b === a) selfLoop = true;
    if (!STATE_BY_CODE[b]) badRef = true;
    if (!(ADJACENCY[b] || []).includes(a)) symmetric = false;
  }
}
ok(symmetric, "adjacency is symmetric (every edge mutual)");
ok(!selfLoop, "no self-adjacency");
ok(!dupes, "no duplicate neighbors");
ok(!badRef, "no neighbor references a non-state");
ok(JSON.stringify(ADJACENCY.AK) === JSON.stringify(["WA"]), "AK connects only to WA");
ok(ADJACENCY.WA.includes("AK"), "WA connects to AK");
// graph connectivity: BFS reaches all 49
function connectedCount(start) {
  const seen = new Set([start]); const q = [start];
  while (q.length) for (const nb of ADJACENCY[q.shift()]) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  return seen.size;
}
ok(connectedCount("CA") === 49, "map is fully connected (all 49 reachable)");
// spot-check a few well-known borders
ok(areAdjacent("CA", "OR") && areAdjacent("CA", "NV") && areAdjacent("CA", "AZ"), "CA borders OR/NV/AZ");
ok(!areAdjacent("CA", "ID"), "CA does NOT border ID");
ok(!areAdjacent("AZ", "CO"), "Four Corners: AZ not adjacent to CO (point only)");
ok(!areAdjacent("UT", "NM"), "Four Corners: UT not adjacent to NM (point only)");
ok(areAdjacent("MO", "TN") && ADJACENCY.MO.length === 8, "Missouri has 8 neighbors");
ok(ADJACENCY.TN.length === 8, "Tennessee has 8 neighbors");

// ---------- 3. Combat ----------
ok(attackerDiceCount(1) === 0 && attackerDiceCount(2) === 1 && attackerDiceCount(4) === 3 && attackerDiceCount(10) === 3, "attacker dice counts");
ok(defenderDiceCount(1) === 1 && defenderDiceCount(5) === 2, "defender dice counts");
// loss invariant over many rounds
let lossInvariant = true;
const rng = (() => { let a = 12345; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
for (let i = 0; i < 5000; i++) {
  const aA = 2 + Math.floor(rng() * 10), dA = 1 + Math.floor(rng() * 10);
  const r = resolveRound(aA, dA, rng);
  const pairs = Math.min(attackerDiceCount(aA), defenderDiceCount(dA));
  if (r.attackerLosses + r.defenderLosses !== pairs) lossInvariant = false;
}
ok(lossInvariant, "each round's total losses == compared dice pairs");
ok(winProbability(5, 0) === 1, "winProb vs 0 defenders == 1");
ok(winProbability(1, 5) === 0, "winProb with 1 army == 0");
ok(approx(winProbability(2, 1), 15 / 36, 0.005), `winProb(2,1) ~ 0.4167 (got ${winProbability(2, 1).toFixed(4)})`);
ok(winProbability(13, 1) > 0.99, "winProb(13,1) > 0.99");
ok(winProbability(10, 5) > winProbability(6, 5), "more attackers => higher win prob");
ok(winProbability(5, 5) < winProbability(5, 3), "more defenders => lower win prob");

// ---------- 4. Cards ----------
ok(buildDeck().length === 51, "deck = 49 states + 2 wilds");
ok(buildDeck().filter((c) => c.wild).length === 2, "deck has 2 wilds");
ok(JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map(setBonus)) === JSON.stringify([4, 6, 8, 10, 12, 15, 20, 25]), "set bonus escalation");
ok(isValidSet([{ symbol: "recruits" }, { symbol: "recruits" }, { symbol: "recruits" }]), "three-of-a-kind is a set");
ok(isValidSet([{ symbol: "recruits" }, { symbol: "cavalry" }, { symbol: "artillery" }]), "one-of-each is a set");
ok(isValidSet([{ wild: true }, { symbol: "recruits" }, { symbol: "recruits" }]), "wild completes a set");
ok(!isValidSet([{ symbol: "recruits" }, { symbol: "recruits" }, { symbol: "cavalry" }]), "two+one is NOT a set");
ok(findSet([{ symbol: "cavalry" }, { symbol: "recruits" }, { symbol: "cavalry" }, { symbol: "cavalry" }]) !== null, "findSet finds a triple");

// ---------- 5. Reinforcement math ----------
{
  const s = createGame({ playerCount: 2, seed: 7 });
  // give player 0 exactly 12 states, none a full region
  STATE_CODES.forEach((c, i) => { s.owner[c] = i < 12 ? 0 : 1; s.armies[c] = 1; });
  // ensure those 12 don't accidentally complete a region (they won't: Pacific=4 incl AK)
  ok(reinforcementCount(s, 0) === Math.max(3, Math.floor(12 / 3)) + regionBonus(s, 0), "reinforcement = floor(owned/3)+regionBonus");
  // give player 0 the whole Pacific region (4 states) plus a couple others
  STATE_CODES.forEach((c) => { s.owner[c] = 1; s.armies[c] = 1; });
  for (const c of REGIONS.pacific.states) s.owner[c] = 0;
  ok(regionBonus(s, 0) === REGIONS.pacific.bonus, "full Pacific region grants its bonus");
  ok(reinforcementCount(s, 0) === Math.max(3, Math.floor(4 / 3)) + REGIONS.pacific.bonus, "reinforcement includes region bonus");
}

// ---------- 6. Integration: full games to completion with a greedy bot ----------
function greedyTurn(s) {
  const pid = currentPlayerId(s);
  // reinforce: turn in sets (forced if >=5 cards), place all on the strongest border
  while (playerById(s, pid).cards.length >= 5) {
    const bonus = turnInSet(s, pid);
    if (bonus === 0) break;
    s.reinforcementsRemaining += bonus;
  }
  const owned = statesOf(s, pid);
  // pick a border state (has an enemy neighbor); fallback to any owned
  const border = owned.find((c) => ADJACENCY[c].some((n) => s.owner[n] !== pid)) || owned[0];
  if (s.reinforcementsRemaining > 0) placeArmies(s, pid, border, s.reinforcementsRemaining);
  endReinforcement(s);
  // attack: take the best-odds attack while it's favorable, capped
  let attacks = 0;
  while (attacks < 40) {
    const moves = legalAttacks(s, pid);
    let best = null, bestP = 0;
    for (const m of moves) {
      const p = winProbability(s.armies[m.from], s.armies[m.to]);
      if (p > bestP) { bestP = p; best = m; }
    }
    if (!best || bestP < 0.55) break;
    executeAttackUntilDecided(s, best.from, best.to, s.armies[best.from] - 1);
    attacks++;
    if (s.winner !== null) break;
  }
  endTurn(s);
}

function invariantsHold(s) {
  // no state owned by a dead player
  for (const c of STATE_CODES) {
    if (s.owner[c] === null) return "null owner mid-game";
    if (!playerById(s, s.owner[c]).alive) return "state owned by dead player";
    if (s.armies[c] < 1) return `armies<1 at ${c}`;
  }
  // distinct owners == alive players
  const owners = new Set(STATE_CODES.map((c) => s.owner[c]));
  if (owners.size !== alivePlayers(s).length) return "owner count != alive players";
  return null;
}

let gamesOk = 0, gamesPlayed = 0, invariantBreak = null;
for (let seed = 1; seed <= 8; seed++) {
  const s = createGame({ playerCount: 2 + (seed % 5), seed });
  autoDistribute(s);
  // total armies sanity
  beginTurn(s);
  gamesPlayed++;
  let guard = 0;
  while (s.winner === null && guard < 6000) {
    greedyTurn(s);
    const bad = invariantsHold(s);
    if (bad && s.winner === null) { invariantBreak = `seed ${seed}: ${bad}`; break; }
    guard++;
  }
  if (s.winner !== null) gamesOk++;
}
ok(invariantBreak === null, `invariants hold every turn (${invariantBreak || "ok"})`);
ok(gamesOk === gamesPlayed, `all ${gamesPlayed} games reached a winner (got ${gamesOk})`);

// ---------- report ----------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:"); fails.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
else console.log("All engine tests passed ✓");
