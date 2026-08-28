// Tests for win variants (Region Rush / Blitz), save-game serialization, and
// match stats. Run: `node test/winmodes.test.mjs`

import { STATE_CODES } from "../src/data/states.js";
import { REGIONS } from "../src/data/regions.js";
import {
  createGame, autoDistribute, statesOf, serializeGame, deserializeGame,
} from "../src/engine/gamestate.js";
import {
  beginTurn, endTurn, checkWinner, teamRegionCount, executeAttackUntilDecided,
  turnInSet, placeArmies, endReinforcement,
} from "../src/engine/rules.js";

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }

// ---------- 1. Defaults ----------
{
  const s = createGame({ playerCount: 4, seed: 1 });
  ok(s.winMode === "domination", "default win mode is domination");
  ok(s.winTarget === null && s.turnLimit === null, "no target/limit in domination");
  ok(s.round === 1, "round counter starts at 1");
  ok(s.players.every((p) => p.stats && p.stats.captures === 0), "players start with zeroed stats");
}

// ---------- 2. Region Rush ----------
{
  const s = createGame({ playerCount: 3, seed: 5, winMode: "regions", winTarget: 4 });
  // Hand player 0 exactly 4 full regions; split the rest between 1 and 2.
  const keys = Object.keys(REGIONS);
  const p0Regions = keys.slice(0, 4);
  const p0States = new Set(p0Regions.flatMap((k) => REGIONS[k].states));
  STATE_CODES.forEach((c, i) => {
    s.owner[c] = p0States.has(c) ? 0 : 1 + (i % 2);
    s.armies[c] = 1;
  });
  ok(teamRegionCount(s, s.players[0].team) === 4, "teamRegionCount sees the 4 regions");
  const w = checkWinner(s);
  ok(w === 0, `region rush declares player 0 the winner (got ${w})`);
  ok(s.winMethod === "regions", "winMethod is 'regions'");
  ok(s.winningTeam === s.players[0].team, "winningTeam set");

  // The same board in domination mode is NOT a win (two rivals still alive).
  const d = createGame({ playerCount: 3, seed: 5 });
  STATE_CODES.forEach((c, i) => {
    d.owner[c] = p0States.has(c) ? 0 : 1 + (i % 2);
    d.armies[c] = 1;
  });
  ok(checkWinner(d) === null, "same board is no win under domination");

  // 3 regions is not enough.
  const u = createGame({ playerCount: 3, seed: 5, winMode: "regions", winTarget: 4 });
  const only3 = new Set(keys.slice(0, 3).flatMap((k) => REGIONS[k].states));
  STATE_CODES.forEach((c, i) => {
    u.owner[c] = only3.has(c) ? 0 : 1 + (i % 2);
    u.armies[c] = 1;
  });
  ok(checkWinner(u) === null, "3 of 4 target regions is not a win");
}

// ---------- 3. Region Rush in team mode ----------
{
  const s = createGame({
    playerCount: 4, seed: 9, winMode: "regions", winTarget: 4,
    players: [
      { name: "A1", team: 0 }, { name: "A2", team: 0 },
      { name: "B1", team: 1 }, { name: "B2", team: 1 },
    ],
  });
  // Team 0 (players 0+1 splitting states) owns 4 regions together.
  const keys = Object.keys(REGIONS);
  const teamRegions = new Set(keys.slice(0, 4).flatMap((k) => REGIONS[k].states));
  let alt = 0;
  STATE_CODES.forEach((c, i) => {
    s.owner[c] = teamRegions.has(c) ? (alt++ % 2) : 2 + (i % 2);
    s.armies[c] = 1;
  });
  const w = checkWinner(s);
  ok(w === 0 || w === 1, `team region rush crowns a team-0 member (got ${w})`);
  ok(s.winningTeam === 0, "winning team is team 0");
  ok(s.winMethod === "regions", "team win method is 'regions'");
}

// ---------- 4. Blitz (turn limit) ----------
{
  const s = createGame({ playerCount: 2, seed: 3, winMode: "turnlimit", turnLimit: 3 });
  autoDistribute(s);
  beginTurn(s);
  // Nobody attacks; just cycle turns until the limit trips.
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 40) {
    s.reinforcementsRemaining = 0; // skip placement bookkeeping — endTurn doesn't check
    endTurn(s);
  }
  ok(s.phase === "gameover", "blitz game ends at the turn limit");
  ok(s.winMethod === "turnlimit", "winMethod is 'turnlimit'");
  ok(s.round === 4, `limit of 3 rounds ends entering round 4 (got ${s.round})`);
  const s0 = statesOf(s, 0).length, s1 = statesOf(s, 1).length;
  const expected = s0 >= s1 ? 0 : 1;
  ok(s.winner === expected, `winner holds the most states (${s0} vs ${s1}, winner ${s.winner})`);
}

// ---------- 5. Blitz tiebreak: equal states -> most armies ----------
{
  const s = createGame({ playerCount: 2, seed: 3, winMode: "turnlimit", turnLimit: 1 });
  // Hand-build a tied board: alternate ownership (25/24 is unavoidable with 49
  // states, so instead test armies tiebreak with a forced states tie is moot —
  // verify the armies tiebreak logic on a constructed 24/24 board + 1 for p0.)
  STATE_CODES.forEach((c, i) => { s.owner[c] = i % 2; s.armies[c] = 1; });
  // p0 owns 25 states (indices 0,2,...48). Give p1 huge armies — states still rule.
  STATE_CODES.forEach((c, i) => { if (i % 2 === 1) s.armies[c] = 50; });
  beginTurn(s);
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 10) { s.reinforcementsRemaining = 0; endTurn(s); }
  ok(s.winner === 0, "states beat armies in blitz adjudication");
}

// ---------- 6. Save / resume serialization ----------
{
  const s = createGame({ playerCount: 4, seed: 42, winMode: "regions" });
  autoDistribute(s);
  beginTurn(s);
  // Play a bit so the state is mid-game and the RNG has advanced.
  const pid = s.order[s.turnPointer];
  const mine = statesOf(s, pid);
  placeArmies(s, pid, mine[0], s.reinforcementsRemaining);
  endReinforcement(s);

  const json = serializeGame(s);
  ok(typeof json === "string" && json.length > 100, "serializeGame returns JSON");
  ok(!json.includes("_rng\""), "the rng closure itself is not serialized");
  const s2 = deserializeGame(json);
  ok(serializeGame(s2) === json, "round-trip is byte-identical");
  ok(typeof s2._rng === "function", "deserialized game has a live rng");
  // The resumed game must roll the exact same dice as the original.
  let same = true;
  for (let i = 0; i < 50; i++) if (s._rng() !== s2._rng()) same = false;
  ok(same, "resumed RNG continues the identical sequence");
  ok(s2.winMode === "regions" && s2.winTarget === 4, "win mode survives the round-trip");
}

// ---------- 7. Stats tracking ----------
{
  const s = createGame({ playerCount: 2, seed: 11 });
  // p0 owns everything except one weak p1 state -> guaranteed capture + elimination.
  STATE_CODES.forEach((c) => { s.owner[c] = 0; s.armies[c] = 5; });
  s.owner.FL = 1; s.armies.FL = 1;
  s.players[1].cards = [{ symbol: "recruits" }];
  executeAttackUntilDecided(s, "GA", "FL", null);
  ok(s.owner.FL === 0, "FL captured");
  ok(s.players[0].stats.captures === 1, "capture counted");
  ok(s.players[0].stats.eliminations === 1, "elimination counted");
  // Set trading increments setsTraded.
  s.players[0].cards = [{ symbol: "recruits" }, { symbol: "cavalry" }, { symbol: "artillery" }];
  const bonus = turnInSet(s, 0);
  ok(bonus > 0, "set traded for a bonus");
  ok(s.players[0].stats.setsTraded === 1, "set trade counted");
}

// ---------- 8. Full Region Rush games with greedy bots ----------
// Mirrors main.js: checkWinner runs after every capture, so a rush can end
// mid-attack; otherwise endTurn's check catches it.
{
  const { winProbability } = await import("../src/engine/combat.js");
  const { legalAttacks, placeArmies: pa } = await import("../src/engine/rules.js");
  const { ADJACENCY } = await import("../src/data/adjacency.js");
  let finished = 0, methodsSeen = new Set(), bad = null;
  for (let seed = 21; seed <= 24; seed++) {
    const s = createGame({ playerCount: 4, seed, winMode: "regions", winTarget: 4 });
    autoDistribute(s);
    beginTurn(s);
    let guard = 0;
    while (s.winner === null && guard++ < 4000) {
      const pid = s.order[s.turnPointer];
      const owned = statesOf(s, pid);
      const border = owned.find((c) => ADJACENCY[c].some((n) => s.owner[n] !== pid)) || owned[0];
      if (s.reinforcementsRemaining > 0) pa(s, pid, border, s.reinforcementsRemaining);
      endReinforcement(s);
      let attacks = 0;
      while (attacks++ < 40 && s.winner === null) {
        const moves = legalAttacks(s, pid);
        let best = null, bestP = 0;
        for (const m of moves) {
          const p = winProbability(s.armies[m.from], s.armies[m.to]);
          if (p > bestP) { bestP = p; best = m; }
        }
        if (!best || bestP < 0.55) break;
        const r = executeAttackUntilDecided(s, best.from, best.to, s.armies[best.from] - 1);
        if (r && r.captured && checkWinner(s) !== null) { s.phase = "gameover"; break; }
      }
      if (s.winner !== null) break;
      endTurn(s);
    }
    if (s.winner !== null) {
      finished++;
      methodsSeen.add(s.winMethod);
      if (s.winMethod === "regions" &&
          teamRegionCount(s, s.players[s.winner].team) < 4) bad = `seed ${seed}: regions win without 4 regions`;
    }
  }
  ok(finished === 4, `all 4 region-rush games finished (got ${finished})`);
  ok(methodsSeen.has("regions"), `at least one game won by region rush (saw: ${[...methodsSeen]})`);
  ok(bad === null, bad || "region wins actually held 4 regions");
}

// ---------- report ----------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:"); fails.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
else console.log("All win-mode tests passed ✓");
