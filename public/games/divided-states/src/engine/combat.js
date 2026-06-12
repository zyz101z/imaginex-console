// Dice combat resolution and win-probability helpers.
// Pure functions: they take an rng() -> [0,1) and never touch game state.

export function rollDie(rng) {
  return Math.floor(rng() * 6) + 1;
}

export function rollDice(n, rng) {
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(rollDie(rng));
  return dice.sort((a, b) => b - a); // descending
}

// Dice counts for one battle round.
export function attackerDiceCount(attackerArmies) {
  return Math.max(0, Math.min(3, attackerArmies - 1)); // must leave 1 behind
}
export function defenderDiceCount(defenderArmies) {
  return Math.min(2, defenderArmies);
}

// Resolve ONE round of combat. Returns losses for each side + the dice rolled.
// Defender wins ties.
export function resolveRound(attackerArmies, defenderArmies, rng) {
  const aN = attackerDiceCount(attackerArmies);
  const dN = defenderDiceCount(defenderArmies);
  if (aN === 0 || dN === 0) {
    return { attackerLosses: 0, defenderLosses: 0, attackerRolls: [], defenderRolls: [] };
  }
  const aRolls = rollDice(aN, rng);
  const dRolls = rollDice(dN, rng);
  let attackerLosses = 0;
  let defenderLosses = 0;
  const pairs = Math.min(aN, dN);
  for (let i = 0; i < pairs; i++) {
    if (aRolls[i] > dRolls[i]) defenderLosses++;
    else attackerLosses++; // ties go to defender
  }
  return { attackerLosses, defenderLosses, attackerRolls: aRolls, defenderRolls: dRolls };
}

// --- Win-probability model (for the AI and for tests) ---
// Probability the attacker eventually reduces the defending territory to 0,
// assuming the attacker keeps attacking with all available armies.

const _roundDist = new Map(); // (aN,dN) -> [{aLoss,dLoss,p}]
function roundDistribution(aN, dN) {
  const key = aN * 10 + dN;
  if (_roundDist.has(key)) return _roundDist.get(key);
  const tally = new Map(); // "aLoss,dLoss" -> count
  const total = Math.pow(6, aN + dN);
  const aDice = new Array(aN).fill(1);
  const dDice = new Array(dN).fill(1);
  // enumerate every dice combination
  const dims = aN + dN;
  const counters = new Array(dims).fill(1);
  for (let n = 0; n < total; n++) {
    for (let i = 0; i < aN; i++) aDice[i] = counters[i];
    for (let i = 0; i < dN; i++) dDice[i] = counters[aN + i];
    const a = [...aDice].sort((x, y) => y - x);
    const d = [...dDice].sort((x, y) => y - x);
    let aLoss = 0, dLoss = 0;
    for (let i = 0; i < Math.min(aN, dN); i++) {
      if (a[i] > d[i]) dLoss++; else aLoss++;
    }
    const k = aLoss + "," + dLoss;
    tally.set(k, (tally.get(k) || 0) + 1);
    // increment mixed-radix counter (base 6)
    let idx = 0;
    while (idx < dims) {
      counters[idx]++;
      if (counters[idx] <= 6) break;
      counters[idx] = 1;
      idx++;
    }
  }
  const dist = [...tally.entries()].map(([k, c]) => {
    const [aLoss, dLoss] = k.split(",").map(Number);
    return { aLoss, dLoss, p: c / total };
  });
  _roundDist.set(key, dist);
  return dist;
}

const _winMemo = new Map();
const WIN_CLAMP = 120; // beyond this the probability is saturated; clamp to bound the memo/recursion
// attackerArmies = total armies on the attacking territory (1 must stay behind).
export function winProbability(attackerArmies, defenderArmies) {
  if (defenderArmies <= 0) return 1;
  if (attackerArmies <= 1) return 0; // can't attack
  const a = attackerArmies > WIN_CLAMP ? WIN_CLAMP : attackerArmies;
  const d = defenderArmies > WIN_CLAMP ? WIN_CLAMP : defenderArmies;
  const key = a * 1000 + d;
  if (_winMemo.has(key)) return _winMemo.get(key);
  const aN = attackerDiceCount(a);
  const dN = defenderDiceCount(d);
  let p = 0;
  for (const { aLoss, dLoss, p: rp } of roundDistribution(aN, dN)) {
    p += rp * winProbability(a - aLoss, d - dLoss);
  }
  _winMemo.set(key, p);
  return p;
}
