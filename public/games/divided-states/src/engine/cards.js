// Mandate cards (the Risk-card analog). One card per state with a cycling symbol,
// plus 2 wild cards. Sets (3-of-a-kind, one-of-each, or with a wild) turn in for
// escalating reinforcements.

import { STATE_CODES } from "../data/states.js";

export const SYMBOLS = ["recruits", "cavalry", "artillery"];

export function buildDeck() {
  const deck = STATE_CODES.map((code, i) => ({
    state: code,
    symbol: SYMBOLS[i % SYMBOLS.length],
    wild: false,
  }));
  deck.push({ state: null, symbol: "wild", wild: true });
  deck.push({ state: null, symbol: "wild", wild: true });
  return deck;
}

// Fisher-Yates using a provided rng() -> [0,1).
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Escalating bonus by number of sets already turned in (globally): 4,6,8,10,12,15,+5...
export function setBonus(setsAlreadyTurnedIn) {
  const table = [4, 6, 8, 10, 12, 15];
  if (setsAlreadyTurnedIn < table.length) return table[setsAlreadyTurnedIn];
  return 15 + 5 * (setsAlreadyTurnedIn - (table.length - 1));
}

// Is this trio of cards a valid set? (3 same symbol, or one of each, wilds substitute.)
export function isValidSet(cards) {
  if (!cards || cards.length !== 3) return false;
  const wilds = cards.filter((c) => c.wild).length;
  const syms = cards.filter((c) => !c.wild).map((c) => c.symbol);
  if (wilds >= 1) return true; // a wild completes any trio
  const uniq = new Set(syms);
  return uniq.size === 1 || uniq.size === 3; // three same, or one of each
}

// Find indices of the first valid set in a hand, or null.
export function findSet(hand) {
  const n = hand.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        if (isValidSet([hand[i], hand[j], hand[k]])) return [i, j, k];
  return null;
}
