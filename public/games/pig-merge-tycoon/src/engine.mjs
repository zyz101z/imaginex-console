// PIG MERGE TYCOON — pure engine. No DOM, no timers, no Math.random:
// every mutator takes explicit rng/now so tests and replays are deterministic.

export const TIERS = [
  { name: "Piglet",        hue: 350, sat: 70, size: 0.50 },
  { name: "Pig",           hue: 345, sat: 60, size: 0.72 },
  { name: "Spotted Pig",   hue: 340, sat: 55, size: 0.80, spots: true },
  { name: "Boar",          hue: 20,  sat: 45, size: 0.88, tusks: true },
  { name: "Muddy Champ",   hue: 28,  sat: 60, size: 0.94, mud: true },
  { name: "Ribbon Winner", hue: 348, sat: 65, size: 1.00, ribbon: true },
  { name: "Truffle Hound", hue: 18,  sat: 42, size: 1.06, sniff: true, light: 48 },
  { name: "Royal Pig",     hue: 335, sat: 70, size: 1.12, crown: true },
  { name: "Knight Pig",    hue: 220, sat: 25, size: 1.18, armor: true },
  { name: "Golden Hog",    hue: 45,  sat: 90, size: 1.24, glow: true },
  { name: "Crystal Pig",   hue: 190, sat: 65, size: 1.30, glow: true, crystal: true },
  { name: "Star Swine",    hue: 265, sat: 70, size: 1.36, glow: true, stars: true },
  { name: "Rainbow Racer", hue: -1,  sat: 80, size: 1.42, glow: true, rainbow: true },
  { name: "Moon Boar",     hue: 230, sat: 45, size: 1.50, glow: true, moon: true, tusks: true },
  { name: "Sun Sow",       hue: 35,  sat: 95, size: 1.58, glow: true, sun: true },
  { name: "HOG EMPEROR",   hue: 0,   sat: 85, size: 1.70, glow: true, crown: true, emperor: true },
  { name: "Volcano Hog",   hue: 15,  sat: 85, size: 1.78, glow: true, magma: true, light: 46 },
  { name: "Storm Sow",     hue: 212, sat: 28, size: 1.86, glow: true, bolt: true, light: 62 },
  { name: "Galaxy Boar",   hue: 258, sat: 55, size: 1.94, glow: true, galaxy: true, tusks: true, light: 42 },
  { name: "COSMIC PIG",    hue: -1,  sat: 90, size: 2.06, glow: true, rainbow: true, crown: true, stars: true, sun: true },
];
export const MAX_TIER = TIERS.length;

export const EXPANSIONS = [6, 9, 12, 16, 20, 25];            // pen capacity per level
const EXPANSION_COST = [0, 400, 4000, 60000, 900000, 15e6];  // cost to REACH level i
export const UPGRADES = {
  feed:   { name: "Feed Quality",  icon: "🥕", max: 8, base: 60,   growth: 2.1 },
  market: { name: "Market Cart",   icon: "🛒", max: 8, base: 90,   growth: 2.1 },
  lucky:  { name: "Lucky Snouts",  icon: "🍀", max: 8, base: 150,  growth: 2.1 },
  // Raises the TIER the shop sells (Piglet → Pig → … → Golden Hog) and resets the
  // buy-price inflation — the fix for "piglets stop being worth buying" late-run.
  // Priced as a milestone purchase (playtest: 600×4.2 felt too cheap).
  stock:  { name: "Prize Breeds",  icon: "🏆", max: 9, base: 1500, growth: 5.0 },
};

// Mystery crates: three rarities. `pulls` are [tierOffset from the pen's median
// tier, probability]; `costDigs` prices the crate in digs-worth of the base tier,
// so crates auto-scale with your economy. Rates are SHOWN before opening.
export const CRATE_TYPES = {
  wooden: { name: "Wooden Crate", icon: "🪵", weight: 70, costDigs: 10,
            pulls: [[-1, 0.35], [0, 0.50], [1, 0.15]] },
  iron:   { name: "Iron Crate",   icon: "⚙️", weight: 25, costDigs: 28,
            pulls: [[0, 0.40], [1, 0.45], [2, 0.15]] },
  golden: { name: "Golden Crate", icon: "🌟", weight: 5,  costDigs: 80,
            pulls: [[1, 0.40], [2, 0.45], [3, 0.15]] },
};
export const CRATE_LIFETIME = 300;  // 5 minutes to decide — no rushing (user request)

export function newGame(now = 0) {
  return {
    v: 1,
    coins: 15,                       // exactly one starter piglet + change
    pigs: [],                        // { id, tier, x, y } — x/y in 0..1 pen space
    nextId: 1,
    bought: 0,                       // piglets bought THIS rebirth (drives price)
    upgrades: { feed: 0, market: 0, lucky: 0, stock: 0 },
    expansion: 0,
    rebirths: 0,
    mult: 1,                         // permanent sell multiplier from rebirths
    bestTier: 1,                     // lifetime best (drives leaderboard score)
    lifetimeCoins: 0,
    digs: 0,
    crate: null,                     // { tier, expiresAt }
    discovered: [1],                 // tier-book entries
    lastSeen: now,
  };
}

// ---------------------------------------------------------------- economy
export const capacity = (s) => EXPANSIONS[s.expansion];
// The tier the shop sells: 1 + Prize Breeds level.
export const buyTier = (s) => 1 + (s.upgrades.stock || 0);
// Base price ×4 per stock level (a tier-up pig ≈ four of the tier below merged);
// the 1.22^bought inflation resets when Prize Breeds levels up (fresh stock line).
export const pigletCost = (s) =>
  Math.ceil(12 * Math.pow(4, s.upgrades.stock || 0) * Math.pow(1.22, s.bought));
export const digInterval = (s) => 6.0 * Math.pow(0.93, s.upgrades.feed);        // seconds
export const truffleValue = (s, tier) =>
  Math.ceil(2 * Math.pow(2.05, tier - 1) * (1 + 0.15 * s.upgrades.market) * s.mult);
export const crateChance = (s) => (1 / 45) * (1 + 0.20 * s.upgrades.lucky);

export function upgradeCost(s, key) {
  const u = UPGRADES[key];
  return Math.ceil(u.base * Math.pow(u.growth, s.upgrades[key]));
}
export const expansionCost = (s) =>
  s.expansion + 1 < EXPANSIONS.length ? EXPANSION_COST[s.expansion + 1] : null;

// ---------------------------------------------------------------- pigs
function addPig(s, tier, rng) {
  const pig = { id: s.nextId++, tier,
    x: 0.15 + rng() * 0.7, y: 0.2 + rng() * 0.6 };
  s.pigs.push(pig);
  if (tier > s.bestTier) s.bestTier = tier;
  if (!s.discovered.includes(tier)) { s.discovered.push(tier); s.discovered.sort((a, b) => a - b); }
  return pig;
}

export function buyPiglet(s, rng) {
  const cost = pigletCost(s);
  if (s.coins < cost || s.pigs.length >= capacity(s)) return null;
  s.coins -= cost;
  s.bought++;
  return addPig(s, buyTier(s), rng);
}

export const canMerge = (s, a, b) =>
  !!a && !!b && a.id !== b.id && a.tier === b.tier && a.tier < MAX_TIER;

// Merge b INTO a: a becomes tier+1 at its own spot, b disappears.
export function mergePigs(s, idA, idB, rng) {
  const a = s.pigs.find(p => p.id === idA), b = s.pigs.find(p => p.id === idB);
  if (!canMerge(s, a, b)) return null;
  s.pigs = s.pigs.filter(p => p.id !== b.id);
  a.tier += 1;
  if (a.tier > s.bestTier) s.bestTier = a.tier;
  if (!s.discovered.includes(a.tier)) { s.discovered.push(a.tier); s.discovered.sort((x, y) => x - y); }
  return a;
}

// One pig digs: pays out a truffle; sometimes unearths a mystery crate.
export function doDig(s, pig, rng, now = 0) {
  const value = truffleValue(s, pig.tier);
  s.coins += value;
  s.lifetimeCoins += value;
  s.digs++;
  let crate = null;
  if (!s.crate && rng() < crateChance(s)) {
    // rarity by weight
    const roll = rng() * 100;
    let acc = 0, type = "wooden";
    for (const [k, def] of Object.entries(CRATE_TYPES)) {
      acc += def.weight;
      if (roll < acc) { type = k; break; }
    }
    const tiers = s.pigs.map(p => p.tier).sort((a, b) => a - b);
    const base = tiers[Math.floor(tiers.length / 2)] || 1;
    const cost = Math.ceil(truffleValue(s, base) * CRATE_TYPES[type].costDigs);
    crate = s.crate = { type, base, cost, expiresAt: now + CRATE_LIFETIME };
  }
  return { value, crate };
}

// The pulls table for a crate, resolved to actual tiers (clamped to 1..MAX_TIER;
// offsets that clamp onto the same tier merge their probabilities). This is what
// the open-crate dialog SHOWS — and exactly what openCrate rolls from.
export function cratePulls(crate) {
  const merged = new Map();
  for (const [off, p] of CRATE_TYPES[crate.type].pulls) {
    const tier = Math.max(1, Math.min(MAX_TIER, crate.base + off));
    merged.set(tier, (merged.get(tier) || 0) + p);
  }
  return [...merged.entries()].sort((a, b) => a[0] - b[0]).map(([tier, p]) => ({ tier, p }));
}

// Pay the crate's cost and roll a pig from its advertised table.
export function openCrate(s, rng, now = 0) {
  if (!s.crate) return null;
  if (s.crate.expiresAt <= now) { s.crate = null; return null; }
  if (s.pigs.length >= capacity(s)) return null;   // pen full
  if (s.coins < s.crate.cost) return null;         // can't afford
  const pulls = cratePulls(s.crate);
  s.coins -= s.crate.cost;
  let roll = rng(), tier = pulls[pulls.length - 1].tier;
  for (const { tier: t, p } of pulls) { if (roll < p) { tier = t; break; } roll -= p; }
  s.crate = null;
  return addPig(s, tier, rng);
}
// Walk away without paying.
export function declineCrate(s) { s.crate = null; }
export function expireCrate(s, now) {
  if (s.crate && s.crate.expiresAt <= now) s.crate = null;
}

// ---------------------------------------------------------------- purchases
export function buyUpgrade(s, key) {
  const u = UPGRADES[key];
  if (!u || s.upgrades[key] >= u.max) return false;
  const cost = upgradeCost(s, key);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.upgrades[key]++;
  if (key === "stock") s.bought = 0;   // new stock line: price inflation resets
  return true;
}

export function buyExpansion(s) {
  const cost = expansionCost(s);
  if (cost == null || s.coins < cost) return false;
  s.coins -= cost;
  s.expansion++;
  return true;
}

// ---------------------------------------------------------------- rebirth
export const rebirthRequirement = (s) => Math.min(14, 10 + s.rebirths);
export const canRebirth = (s) => s.pigs.some(p => p.tier >= rebirthRequirement(s));
export function doRebirth(s) {
  if (!canRebirth(s)) return false;
  s.rebirths++;
  s.mult *= 2;
  s.coins = 15;
  s.pigs = [];
  s.bought = 0;
  s.upgrades = { feed: 0, market: 0, lucky: 0, stock: 0 };
  s.expansion = Math.min(1, s.expansion);   // keep one expansion as a leg up
  s.crate = null;
  return true;
}

// ---------------------------------------------------------------- offline
// Away-time truffle income at 40% rate, capped at 8 hours. Returns coins granted.
export function offlineEarnings(s, now) {
  const away = Math.min(8 * 3600, Math.max(0, now - s.lastSeen));
  s.lastSeen = now;
  if (away < 60 || !s.pigs.length) return 0;
  const perSec = s.pigs.reduce((a, p) => a + truffleValue(s, p.tier), 0) / digInterval(s);
  const gain = Math.floor(perSec * away * 0.4);
  s.coins += gain;
  s.lifetimeCoins += gain;
  return gain;
}

// leaderboard score: one climbing number — best tier dominates, rebirths break ties
export const score = (s) => s.bestTier * 100 + s.rebirths;

// ---------------------------------------------------------------- misc
export function fmt(n) {
  if (n < 1000) return String(Math.floor(n));
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (v >= 100 ? Math.floor(v) : v.toFixed(1).replace(/\.0$/, "")) + units[u];
}

export const serialize = (s) => JSON.stringify(s);
export function deserialize(json) {
  const s = JSON.parse(json);
  if (!s || s.v !== 1) return null;
  if (s.upgrades && s.upgrades.stock == null) s.upgrades.stock = 0;   // pre-stock saves
  return s;
}
