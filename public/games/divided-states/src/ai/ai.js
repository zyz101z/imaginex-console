// AI opponents — three difficulty tiers, as PURE decision functions so they can be
// headless-tested. The controller (main.js) calls these and executes/animates the
// results; the AI never touches the DOM.
//
//   Recruit  (easy)   — spreads thin, only fights sure things, no plan.
//   Officer  (medium) — concentrates force, plays regions, cashes cards.
//   General  (hard)   — region-completion + elimination aware, builds an attack axis,
//                       fortifies toward the front. Deliberate and dangerous.

import { ADJACENCY } from "../data/adjacency.js";
import { REGIONS } from "../data/regions.js";
import { winProbability } from "../engine/combat.js";
import { statesOf, playerById, unclaimedStates, sameTeam, teamsAlive, teamOf } from "../engine/gamestate.js";
import { legalAttacks, reachableOwned } from "../engine/rules.js";
import { findSet } from "../engine/cards.js";

// ---------- board helpers ----------
// "Enemy" = not us and not an ally (so allied borders aren't treated as threats).
const enemyNeighbors = (s, c, pid) => ADJACENCY[c].filter((n) => !sameTeam(s, s.owner[n], pid));
const isBorder = (s, c, pid) => ADJACENCY[c].some((n) => !sameTeam(s, s.owner[n], pid));
const borderStates = (s, pid) => statesOf(s, pid).filter((c) => isBorder(s, c, pid));
const threat = (s, c, pid) => enemyNeighbors(s, c, pid).reduce((a, n) => a + s.armies[n], 0);

// Would capturing `code` complete a region for `pid`? (i.e. it's the last missing one.)
function completesRegion(s, pid, code) {
  for (const k in REGIONS) {
    const r = REGIONS[k];
    if (!r.states.includes(code)) continue;
    if (r.states.every((c) => c === code || s.owner[c] === pid)) return r.bonus;
  }
  return 0;
}
// Is `code` an enemy's LAST state (capturing it eliminates them + takes their cards)?
function isEliminating(s, pid, code) {
  const owner = s.owner[code];
  if (owner === pid || owner == null) return false;
  return statesOf(s, owner).length === 1;
}

// ---------- team coordination ----------
// Allied AIs coordinate by (a) drafting/attacking toward SHARED regions, (b) ganging up
// on one enemy team, and (c) reinforcing/fortifying the shared front. Active only at
// Officer+ (TIER.teamRegionW > 0) and only when the AI actually has a teammate, so
// free-for-all behavior is byte-for-byte unchanged. No cross-AI messaging: every ally
// derives the SAME focus target from board state, so they converge without talking.
const coordinating = (s, pid, diff) =>
  cfg(diff).teamRegionW > 0 && s.players.some((p) => p.id !== pid && p.team === teamOf(s, pid));

const teamStates = (s, team) =>
  s.players.filter((p) => p.team === team).reduce((a, p) => a + statesOf(s, p.id).length, 0);
const teamArmies = (s, team) =>
  s.players.filter((p) => p.team === team)
    .reduce((a, p) => a + statesOf(s, p.id).reduce((x, c) => x + s.armies[c], 0), 0);

// The enemy team the whole alliance should focus: closest to elimination (fewest states),
// tie-broken by fewest armies then lowest id. Deterministic, so every ally agrees on the
// same target → natural focus-fire. Returns null when no enemy team remains.
export function focusEnemyTeam(s, pid) {
  const mine = teamOf(s, pid);
  const enemies = teamsAlive(s).filter((t) => t !== mine);
  if (!enemies.length) return null;
  return enemies
    .map((t) => ({ t, st: teamStates(s, t), ar: teamArmies(s, t) }))
    .sort((a, b) => a.st - b.st || a.ar - b.ar || a.t - b.t)[0].t;
}

// Would capturing `code` complete a region for the TEAM (every other state already held
// by us or an ally)? The bonus is team-shared, so this is worth coordinating toward.
function completesTeamRegion(s, pid, code) {
  for (const k in REGIONS) {
    const r = REGIONS[k];
    if (!r.states.includes(code)) continue;
    if (r.states.every((c) => c === code || sameTeam(s, s.owner[c], pid))) return r.bonus;
  }
  return 0;
}
// Bonus for completing a region the team shares but the AI can't finish solo (an ally
// holds the rest). The own-solo case is already scored by completesRegion, so exclude it.
const teamRegionBonus = (s, pid, code, c) =>
  c.teamRegionW && !completesRegion(s, pid, code) && completesTeamRegion(s, pid, code) ? c.teamRegionW : 0;
// Bonus for hitting the agreed focus-fire target. owner is always a live enemy here.
const focusBonus = (s, code, c, focusTeam) =>
  c.focusW && focusTeam != null && s.players[s.owner[code]].team === focusTeam ? c.focusW : 0;

const TIER = {
  // attackMin = preferred odds bar; floor = will still take its best attack above this
  // (a stalemate-breaker so symmetric AIs don't pile armies forever without fighting).
  // teamRegionW = weight for completing a SHARED region; focusW = focus-fire weight.
  // Both 0 for recruit (no teamwork); officer plays team regions; general also focus-fires.
  recruit: { attackMin: 0.8, floor: 0.42, regionW: 0, elimW: 0, concentrate: false, wasteInland: true, teamRegionW: 0, focusW: 0 },
  officer: { attackMin: 0.6, floor: 0.42, regionW: 6, elimW: 4, concentrate: true, teamRegionW: 4, focusW: 0 },
  general: { attackMin: 0.6, floor: 0.42, regionW: 16, elimW: 14, concentrate: true, teamRegionW: 12, focusW: 7 },
};
const cfg = (diff) => TIER[diff] || TIER.officer;

// ---------- draft (interactive claim) ----------
// Choose an unclaimed state to grab: cluster with what we already own and build
// toward whole regions. Recruit drafts more randomly.
export function draftPick(s, pid, diff) {
  const unclaimed = unclaimedStates(s);
  if (!unclaimed.length) return null;
  const coord = coordinating(s, pid, diff);
  const ally = (n) => s.owner[n] != null && s.owner[n] !== pid && sameTeam(s, s.owner[n], pid);
  let best = null, bestScore = -Infinity;
  for (const code of unclaimed) {
    // adjacency to our own states -> keeps our territory connected
    let score = ADJACENCY[code].filter((n) => s.owner[n] === pid).length * 6;
    // coordinated AIs also cluster next to allies, so the team forms one contiguous bloc
    if (coord) score += ADJACENCY[code].filter(ally).length * 4;
    // region foothold -> reward progressing toward a full region's bonus
    for (const k in REGIONS) {
      const r = REGIONS[k];
      if (!r.states.includes(code)) continue;
      score += r.states.filter((x) => s.owner[x] === pid).length * 3;
      if (coord) score += r.states.filter(ally).length * 2; // build toward a SHARED region
      score += Math.max(0, 9 - r.states.length) * 0.4; // small regions are easier to finish
    }
    score += s._rng() * (diff === "recruit" ? 12 : 3); // randomness; recruit leans on it
    if (score > bestScore) { bestScore = score; best = code; }
  }
  return best;
}

// ---------- card policy ----------
// Whether to trade a set NOW (the caller checks a set actually exists). Recruit only
// cashes when forced (>=5 cards); others cash whenever they hold a set.
export function shouldTurnInCards(s, pid, diff) {
  const hand = playerById(s, pid).cards;
  if (!findSet(hand)) return false;
  if (diff === "recruit") return hand.length >= 5;
  return true;
}

// ---------- reinforcement placement ----------
// Returns [{code, n}] summing to state.reinforcementsRemaining (read AFTER card turn-ins).
export function planReinforcements(s, pid, diff) {
  const total = s.reinforcementsRemaining;
  if (total <= 0) return [];
  const focusTeam = coordinating(s, pid, diff) ? focusEnemyTeam(s, pid) : null;
  const borders = borderStates(s, pid);
  if (borders.length === 0) {
    const owned = statesOf(s, pid);
    return owned.length ? [{ code: owned[0], n: total }] : [];
  }

  if (diff === "recruit" || !cfg(diff).concentrate) {
    // Recruit spreads thin — and over ALL its states, so a lot of armies get wasted
    // far from the fight (deliberately weak, easiest level).
    const spread = cfg(diff).wasteInland ? statesOf(s, pid) : borders;
    const out = spread.map((code) => ({ code, n: 0 }));
    for (let i = 0; i < total; i++) out[i % out.length].n++;
    return out.filter((o) => o.n > 0);
  }

  // Concentrate: score each border by offensive opportunity, pick the best axis.
  const scored = borders.map((code) => ({ code, score: offenseScore(s, pid, code, diff, focusTeam) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].code;

  // General also shores up its single most threatened border.
  if (diff === "general") {
    const def = borders
      .map((code) => ({ code, net: threat(s, code, pid) - s.armies[code] }))
      .sort((a, b) => b.net - a.net)[0];
    if (def && def.net > 2 && def.code !== best && total >= 3) {
      const dn = Math.max(1, Math.round(total * 0.3));
      return [{ code: best, n: total - dn }, { code: def.code, n: dn }];
    }
  }
  return [{ code: best, n: total }];
}

// How attractive is stacking armies on this border state? Rewards weak adjacent
// targets and targets that complete a region or eliminate a rival.
function offenseScore(s, pid, code, diff, focusTeam = null) {
  const c = cfg(diff);
  let best = -Infinity;
  for (const t of enemyNeighbors(s, code, pid)) {
    let sc = 22 - Math.min(22, s.armies[t]);                 // weaker target = better
    sc += completesRegion(s, pid, t) ? c.regionW : 0;
    sc += teamRegionBonus(s, pid, t, c);                     // help finish a shared region
    sc += isEliminating(s, pid, t) ? c.elimW : 0;
    sc += focusBonus(s, t, c, focusTeam);                    // pile onto the focus-fire team
    if (sc > best) best = sc;
  }
  // Stickiness: bias toward a border we've already stacked, so reinforcement commits
  // to one decisive front instead of oscillating between borders (which causes stalls).
  return best + s.armies[code] * 0.5;
}

// ---------- attack selection ----------
// Returns the next {from,to} to attack, or null to stop. Called repeatedly.
export function chooseAttack(s, pid, diff) {
  const c = cfg(diff);
  const focusTeam = coordinating(s, pid, diff) ? focusEnemyTeam(s, pid) : null;
  let best = null, bestScore = 0;
  let fallback = null, fallbackP = 0; // best-odds move overall, for the stalemate-breaker
  for (const m of legalAttacks(s, pid)) {
    const p = winProbability(s.armies[m.from], s.armies[m.to]);
    if (p > fallbackP) { fallbackP = p; fallback = m; }
    if (p < c.attackMin) continue;
    let score;
    if (diff === "recruit") {
      score = p; // pure greedy on odds, no strategy
    } else {
      score = p * 8
        + (completesRegion(s, pid, m.to) ? c.regionW : 0)
        + teamRegionBonus(s, pid, m.to, c)
        + (isEliminating(s, pid, m.to) ? c.elimW : 0)
        + focusBonus(s, m.to, c, focusTeam)
        + (22 - Math.min(22, s.armies[m.to])) * 0.2;
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  if (best) return best;
  // Nothing met the preferred bar — still take the best available attack if it's at
  // least a coin-flip+, so the game keeps progressing instead of stalling forever.
  if (fallback && fallbackP >= c.floor) return fallback;
  return null;
}

// ---------- fortify ----------
// Returns {from,to,n} or null. Move spare armies off a safe interior toward the
// most threatened border they can reach.
export function planFortify(s, pid, diff) {
  if (diff === "recruit") return null; // recruits don't bother
  const focusTeam = coordinating(s, pid, diff) ? focusEnemyTeam(s, pid) : null;
  const facesFocus = (c) => focusTeam != null &&
    ADJACENCY[c].some((n) => s.owner[n] != null && s.players[s.owner[n]].team === focusTeam);
  const owned = statesOf(s, pid);
  // candidate sources: interior (no enemy neighbor) with spare armies, biggest first
  const sources = owned
    .filter((c) => s.armies[c] > 1 && !isBorder(s, c, pid))
    .sort((a, b) => s.armies[b] - s.armies[a]);
  for (const from of sources) {
    const reach = reachableOwned(s, pid, from).filter((c) => isBorder(s, c, pid));
    if (!reach.length) continue;
    // send to the most threatened reachable border, preferring the coordinated front
    reach.sort((a, b) =>
      (facesFocus(b) - facesFocus(a)) ||
      ((threat(s, b, pid) - s.armies[b]) - (threat(s, a, pid) - s.armies[a])));
    const to = reach[0];
    return { from, to, n: s.armies[from] - 1 };
  }
  return null;
}
