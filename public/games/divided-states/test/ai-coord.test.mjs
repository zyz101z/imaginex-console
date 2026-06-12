// AI team-coordination tests: allies independently agree on a focus-fire target,
// and a coordinated general actually attacks that target. Run: node test/ai-coord.test.mjs

import { STATE_CODES } from "../src/data/states.js";
import { ADJACENCY } from "../src/data/adjacency.js";
import { createGame, teamOf } from "../src/engine/gamestate.js";
import * as ai from "../src/ai/ai.js";

let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };

// Build a board where pid0 (team 0) owns everything except a couple of enemy footholds.
// extraTeam1 lets us pad team 1 so it's no longer the smallest team.
function board(extraTeam1 = 0) {
  const s = createGame({ playerCount: 4, seed: 1, players: [
    { team: 0 }, { team: 0 }, { team: 1 }, { team: 2 },
  ]});
  s.players.forEach((p) => { p.alive = true; });
  const from = "KS";
  const [n1, n2] = ADJACENCY[from].slice(0, 2);
  STATE_CODES.forEach((c) => { s.owner[c] = 0; s.armies[c] = 1; }); // pid0 holds the map
  s.owner[from] = 0; s.armies[from] = 20;     // a fat stack to attack from
  s.owner[n1] = 2; s.armies[n1] = 1;          // team 1 foothold
  s.owner[n2] = 3; s.armies[n2] = 1;          // team 2 foothold
  // pad team 1 with isolated states (not adjacent to `from`, so no new attack on pid0)
  const pad = STATE_CODES.filter((c) => c !== from && c !== n1 && c !== n2 && !ADJACENCY[from].includes(c));
  for (let i = 0; i < extraTeam1; i++) { s.owner[pad[i]] = 2; s.armies[pad[i]] = 1; }
  return { s, from, n1, n2 };
}

// ---- 1. allies independently agree on the same focus target ----
{
  const { s } = board();
  ok(ai.focusEnemyTeam(s, 0) === ai.focusEnemyTeam(s, 1),
    "both allies derive the SAME focus-fire target (no messaging needed)");
}

// ---- 2. focus = the enemy team closest to elimination (fewest states) ----
{
  const a = board();        // team1 = 1 state, team2 = 1 state -> tie broken by lower id => team 1
  ok(ai.focusEnemyTeam(a.s, 0) === 1, "ties (equal size) break to the lower team id");
  const b = board(3);       // team1 padded to 4 states, team2 still 1 -> focus flips to team 2
  ok(ai.focusEnemyTeam(b.s, 0) === 2, "focus flips to the now-smaller enemy team (team 2)");
}

// ---- 3. a coordinated general actually attacks the focus team ----
{
  const a = board();        // focus = team 1
  const mvA = ai.chooseAttack(a.s, 0, "general");
  ok(mvA && teamOf(a.s, a.s.owner[mvA.to]) === ai.focusEnemyTeam(a.s, 0),
    "general focus-fires the smaller team (team 1)");
  const b = board(3);       // focus flips to team 2
  const mvB = ai.chooseAttack(b.s, 0, "general");
  ok(mvB && teamOf(b.s, b.s.owner[mvB.to]) === ai.focusEnemyTeam(b.s, 0),
    "general re-targets when the focus team changes (team 2)");
}

// ---- 4. free-for-all is unaffected: no allies => no focus distortion ----
{
  const s = createGame({ playerCount: 4, seed: 1 }); // default FFA (each its own team)
  s.players.forEach((p) => { p.alive = true; });
  // every player is a singleton team, so "the team closest to elimination" is still
  // well-defined, but coordination is OFF (no teammate) — proven by the AI regression
  // suite staying green. Here we just confirm focusEnemyTeam doesn't crash in FFA.
  ok(typeof ai.focusEnemyTeam(s, 0) === "number" || ai.focusEnemyTeam(s, 0) === null,
    "focusEnemyTeam is well-defined in free-for-all");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:"); fails.forEach((f) => console.log("  ✗ " + f)); process.exit(1); }
else console.log("All AI coordination tests passed ✓");
