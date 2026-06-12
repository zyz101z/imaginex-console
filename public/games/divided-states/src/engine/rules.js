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
  logEvent,
} from "./gamestate.js";

// --- Reinforcements ---

export function regionBonus(s, playerId) {
  let bonus = 0;
  for (const key of Object.keys(REGIONS)) {
    const r = REGIONS[key];
    if (r.states.every((c) => s.owner[c] === playerId)) bonus += r.bonus;
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
      if (s.owner[to] !== playerId) moves.push({ from, to });
    }
  }
  return moves;
}

export function canAttack(s, playerId, from, to) {
  return (
    s.owner[from] === playerId &&
    s.armies[from] >= 2 &&
    s.owner[to] !== playerId &&
    areAdjacent(from, to)
  );
}

// One round of dice. Mutates armies; on capture transfers the territory.
// Returns { ...losses, captured, eliminated }.
export function executeAttackRound(s, from, to, moveIfCaptured = null) {
  const attacker = s.owner[from];
  const defender = s.owner[to];
  if (s.owner[from] === s.owner[to]) throw new Error("cannot attack own territory");
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

// Owned states reachable from `from` through a path of same-owner states.
export function reachableOwned(s, playerId, from) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of ADJACENCY[cur]) {
      if (s.owner[nb] === playerId && !seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  seen.delete(from);
  return [...seen];
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

export function checkWinner(s) {
  const alive = alivePlayers(s);
  if (alive.length === 1) {
    s.winner = alive[0].id;
    return s.winner;
  }
  // Domination: someone owns every state.
  for (const p of s.players) {
    if (statesOf(s, p.id).length === STATE_CODES.length) {
      s.winner = p.id;
      return s.winner;
    }
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
