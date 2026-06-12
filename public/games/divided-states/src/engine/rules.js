// Rules engine: reinforcement, legal-move generation, attack execution,
// fortify reachability, card turn-in, elimination, win check, turn flow.

import { ADJACENCY, areAdjacent } from "../data/adjacency.js";
import { REGIONS } from "../data/regions.js";
import { STATE_CODES } from "../data/states.js";
import { resolveRound, attackerDiceCount } from "./combat.js";
import { setBonus, findSet } from "./cards.js";
import {
  statesOf,
  ownerOf,
  armiesOf,
  currentPlayerId,
  playerById,
  alivePlayers,
  sameTeam,
  teamsAlive,
  logEvent,
} from "./gamestate.js";

// --- Reinforcements ---

// A region's bonus is earned when the player's TEAM collectively owns every state in
// it, then split among the teammates who hold ≥1 of its states — proportional to how
// many they hold, with the rounding remainder going to the largest holder. (In a
// free-for-all each player is their own team, so this reduces to the classic rule.)
export function regionBonus(s, playerId) {
  let bonus = 0;
  for (const key of Object.keys(REGIONS)) {
    const r = REGIONS[key];
    // team owns the whole region?
    if (!r.states.every((c) => s.owner[c] != null && sameTeam(s, s.owner[c], playerId))) continue;
    // count each contributor's states in this region
    const counts = {}; // ownerId -> states held in region
    for (const c of r.states) counts[s.owner[c]] = (counts[s.owner[c]] || 0) + 1;
    const total = r.states.length;
    let assigned = 0;
    let topOwner = null, topCount = -1;
    const shares = {};
    for (const oid of Object.keys(counts)) {
      const cnt = counts[oid];
      shares[oid] = Math.floor((r.bonus * cnt) / total);
      assigned += shares[oid];
      if (cnt > topCount) { topCount = cnt; topOwner = oid; } // first max wins ties
    }
    const remainder = r.bonus - assigned;
    if (topOwner != null) shares[topOwner] += remainder; // leftover to the biggest holder
    bonus += shares[playerId] || 0;
  }
  return bonus;
}

export function reinforcementCount(s, playerId) {
  const owned = statesOf(s, playerId).length;
  if (owned === 0) return 0;
  return Math.max(3, Math.floor(owned / 3)) + regionBonus(s, playerId);
}

// --- Turn flow ---

export function beginTurn(s) {
  const pid = currentPlayerId(s);
  s.phase = "reinforce";
  s.conqueredThisTurn = false;
  s.reinforcementsRemaining = reinforcementCount(s, pid);
  s.turnNumber++;
  logEvent(s, `${playerById(s, pid).name} begins turn (+${s.reinforcementsRemaining} armies)`);
}

export function placeArmies(s, playerId, code, n) {
  if (s.owner[code] !== playerId) throw new Error(`${code} not owned by player`);
  if (n > s.reinforcementsRemaining) throw new Error("not enough reinforcements");
  s.armies[code] += n;
  s.reinforcementsRemaining -= n;
}

export function endReinforcement(s) {
  if (s.reinforcementsRemaining > 0) throw new Error("must place all reinforcements first");
  s.phase = "attack";
}

// --- Attacks ---

export function legalAttacks(s, playerId) {
  const moves = [];
  for (const from of statesOf(s, playerId)) {
    if (s.armies[from] < 2) continue;
    for (const to of ADJACENCY[from]) {
      if (!sameTeam(s, s.owner[to], playerId)) moves.push({ from, to }); // not self or ally
    }
  }
  return moves;
}

export function canAttack(s, playerId, from, to) {
  return (
    s.owner[from] === playerId &&
    s.armies[from] >= 2 &&
    !sameTeam(s, s.owner[to], playerId) && // can't attack self or an ally
    areAdjacent(from, to)
  );
}

// One round of dice. Mutates armies; on capture transfers the territory.
// Returns { ...losses, captured, eliminated }.
export function executeAttackRound(s, from, to, moveIfCaptured = null) {
  const attacker = s.owner[from];
  const defender = s.owner[to];
  if (sameTeam(s, attacker, defender)) throw new Error("cannot attack own or allied territory");
  if (!areAdjacent(from, to)) throw new Error(`${from} not adjacent to ${to}`);
  if (s.armies[from] < 2) throw new Error("need >=2 armies to attack");

  const res = resolveRound(s.armies[from], s.armies[to], s._rng);
  s.armies[from] -= res.attackerLosses;
  s.armies[to] -= res.defenderLosses;

  let captured = false;
  let eliminated = false;
  if (s.armies[to] === 0) {
    captured = true;
    const diceUsed = res.attackerRolls.length;
    const maxMove = s.armies[from] - 1;
    const move = Math.max(diceUsed, Math.min(moveIfCaptured ?? diceUsed, maxMove));
    s.owner[to] = attacker;
    s.armies[to] = move;
    s.armies[from] -= move;
    s.conqueredThisTurn = true;
    logEvent(s, `${playerById(s, attacker).name} captured ${to}`);
    // Elimination: defender lost their last territory.
    if (statesOf(s, defender).length === 0) {
      eliminated = true;
      const victim = playerById(s, defender);
      victim.alive = false;
      // Attacker seizes the victim's cards.
      playerById(s, attacker).cards.push(...victim.cards);
      victim.cards = [];
      logEvent(s, `${victim.name} was eliminated by ${playerById(s, attacker).name}`);
    }
  }
  return { ...res, captured, eliminated };
}

// Attack repeatedly until the territory is captured or the attacker can't continue.
export function executeAttackUntilDecided(s, from, to, moveIfCaptured = null) {
  let last = null;
  let rounds = 0;
  while (s.owner[from] !== s.owner[to] && s.armies[from] >= 2) {
    last = executeAttackRound(s, from, to, moveIfCaptured);
    rounds++;
    if (last.captured) break;
    if (rounds > 1000) break; // safety
  }
  return last || { captured: false };
}

// --- Fortify ---

// Your own states reachable from `from` for a fortify. The path may run THROUGH
// allied (same-team) territory, but only your OWN states are valid destinations
// (through-only — no gifting armies to a teammate). In a free-for-all the team is
// just you, so this is the classic same-owner reachability.
export function reachableOwned(s, playerId, from) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of ADJACENCY[cur]) {
      if (!seen.has(nb) && sameTeam(s, s.owner[nb], playerId)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  seen.delete(from);
  return [...seen].filter((c) => s.owner[c] === playerId);
}

export function canFortify(s, from, to, n) {
  if (s.owner[from] !== s.owner[to]) return false;
  if (n < 1 || s.armies[from] - n < 1) return false;
  return reachableOwned(s, s.owner[from], from).includes(to);
}

export function fortify(s, from, to, n) {
  if (!canFortify(s, from, to, n)) throw new Error("illegal fortify");
  s.armies[from] -= n;
  s.armies[to] += n;
  s.phase = "fortifyDone";
}

// --- Cards ---

export function drawCard(s, playerId) {
  if (s.deck.length === 0) {
    s.deck = s.discard;
    s.discard = [];
  }
  if (s.deck.length === 0) return null;
  const card = s.deck.pop();
  playerById(s, playerId).cards.push(card);
  return card;
}

// Turn in the first valid set in a player's hand; returns armies granted (or 0).
export function turnInSet(s, playerId, indices = null) {
  const player = playerById(s, playerId);
  const idx = indices || findSet(player.cards);
  if (!idx) return 0;
  const used = idx.map((i) => player.cards[i]);
  const bonus = setBonus(s.setsTurnedIn);
  s.setsTurnedIn++;
  // remove used cards (high-to-low so indices stay valid) and discard them
  [...idx].sort((a, b) => b - a).forEach((i) => {
    s.discard.push(player.cards[i]);
    player.cards.splice(i, 1);
  });
  logEvent(s, `${player.name} traded a Mandate set for +${bonus}`);
  return bonus;
}

// --- Win / turn advance ---

// Last team standing — only one team still has a living player. (With no neutral
// territories this is identical to "one team owns all 49"; in a free-for-all each
// player is their own team, so it's the classic last-player-standing.)
export function checkWinner(s) {
  const teams = teamsAlive(s);
  if (teams.length === 1) {
    s.winningTeam = teams[0];
    const champ = s.players.find((p) => p.alive && p.team === teams[0]) || alivePlayers(s)[0];
    s.winner = champ ? champ.id : null;
    return s.winner;
  }
  return null;
}

// Grant end-of-turn card if a capture happened, then advance to next alive player.
export function endTurn(s) {
  const pid = currentPlayerId(s);
  if (s.conqueredThisTurn) drawCard(s, pid);
  if (checkWinner(s) !== null) {
    s.phase = "gameover";
    logEvent(s, `${playerById(s, s.winner).name} wins!`);
    return;
  }
  // advance to next alive player
  do {
    s.turnPointer = (s.turnPointer + 1) % s.order.length;
  } while (!playerById(s, currentPlayerId(s)).alive);
  beginTurn(s);
}
