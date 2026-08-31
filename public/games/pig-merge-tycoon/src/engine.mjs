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
  { name: "Robo Hog",      hue: 195, sat: 25, size: 2.16, glow: true, robo: true, light: 74 },
  { name: "Dragon Boar",   hue: 115, sat: 55, size: 2.26, glow: true, dragon: true, tusks: true, light: 55 },
  { name: "Phoenix Sow",   hue: 22,  sat: 95, size: 2.36, glow: true, phoenix: true, light: 55 },
  { name: "INFINITY HOG",  hue: 270, sat: 35, size: 2.52, glow: true, infinity: true, galaxy: true, light: 24 },
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
// Tables shifted DOWN one tier 2026-08-30 (playtest: crates scaled too hard —
// iron/golden kept gifting pigs above the pen's best working tier). Wooden is
// now filler, iron peaks at median+1, golden at median+2.
export const CRATE_TYPES = {
  wooden: { name: "Wooden Crate", icon: "🪵", weight: 70, costDigs: 10,
            pulls: [[-2, 0.35], [-1, 0.50], [0, 0.15]] },
  iron:   { name: "Iron Crate",   icon: "⚙️", weight: 25, costDigs: 28,
            pulls: [[-1, 0.40], [0, 0.45], [1, 0.15]] },
  golden: { name: "Golden Crate", icon: "🌟", weight: 5,  costDigs: 80,
            pulls: [[0, 0.40], [1, 0.45], [2, 0.15]] },
};
export const CRATE_LIFETIME = 300;  // 5 minutes to decide — no rushing (user request)

// Farm themes — cosmetic reskins of the whole scene. Bought once with coins
// (escalating late-game sinks), then switch freely. Never reset by rebirth.
export const THEMES = {
  classic: { name: "Classic Farm", icon: "🌿", cost: 0 },
  winter:  { name: "Winter Farm",  icon: "❄️", cost: 200_000 },
  night:   { name: "Night Farm",   icon: "🌙", cost: 2_000_000 },
  beach:   { name: "Beach Farm",   icon: "🏖️", cost: 20_000_000 },
};

// 🎀 BLUE RIBBONS — farm milestones. Each pays a coin lump sized in digs-worth of
// your BEST pig's truffle (so a ribbon earned at tier 3 or tier 18 feels the same).
// `progress(s)` → [current, goal]; earned when current >= goal. Never reset by rebirth.
// Descriptions use tier NUMBERS, never names — undiscovered pigs stay a surprise.
const stat = (k) => (s) => (s.stats && s.stats[k]) || 0;
export const RIBBONS = [
  // merging
  { id: "merge1",    icon: "🤝", name: "First Merge",       desc: "merge two pigs",              goal: 1,    of: stat("merges"), digs: 15 },
  { id: "merge25",   icon: "🔁", name: "Merge Master",      desc: "merge 25 times",             goal: 25,   of: stat("merges"), digs: 25 },
  { id: "merge100",  icon: "🌀", name: "Merge Machine",     desc: "merge 100 times",            goal: 100,  of: stat("merges"), digs: 40 },
  { id: "merge500",  icon: "🌪️", name: "Merge Tornado",     desc: "merge 500 times",            goal: 500,  of: stat("merges"), digs: 80 },
  { id: "merge2000", icon: "♾️", name: "Merge Legend",      desc: "merge 2,000 times",          goal: 2000, of: stat("merges"), digs: 150 },
  // climbing the ladder
  { id: "tier5",   icon: "🐖", name: "Growing Up",        desc: "reach pig tier 5",   goal: 5,  of: (s) => s.bestTier, digs: 20 },
  { id: "tier8",   icon: "👑", name: "Farm Royalty",      desc: "reach pig tier 8",   goal: 8,  of: (s) => s.bestTier, digs: 30 },
  { id: "tier10",  icon: "✨", name: "Double Digits",     desc: "reach pig tier 10",  goal: 10, of: (s) => s.bestTier, digs: 40 },
  { id: "tier12",  icon: "🌟", name: "Star Farmer",       desc: "reach pig tier 12",  goal: 12, of: (s) => s.bestTier, digs: 50 },
  { id: "tier16",  icon: "🏆", name: "Sweet Sixteen",     desc: "reach pig tier 16",  goal: 16, of: (s) => s.bestTier, digs: 70 },
  { id: "tier20",  icon: "🚀", name: "Top Twenty",        desc: "reach pig tier 20",  goal: 20, of: (s) => s.bestTier, digs: 100 },
  { id: "tier24",  icon: "💫", name: "The Final Form",    desc: "reach pig tier 24",  goal: 24, of: (s) => s.bestTier, digs: 200 },
  // the pig book
  { id: "book10", icon: "📖", name: "Bookworm",          desc: "discover 10 kinds of pig",  goal: 10, of: (s) => s.discovered.length, digs: 30 },
  { id: "book16", icon: "📚", name: "Pig Scholar",       desc: "discover 16 kinds of pig",  goal: 16, of: (s) => s.discovered.length, digs: 60 },
  { id: "book24", icon: "🎓", name: "Complete Collection", desc: "discover every pig",      goal: 24, of: (s) => s.discovered.length, digs: 200 },
  // coins + truffles
  { id: "coins1k",  icon: "🪙", name: "Pocket Money",     desc: "earn 1K coins in total",    goal: 1e3,  of: (s) => s.lifetimeCoins, digs: 15 },
  { id: "coins100k", icon: "💰", name: "Truffle Tycoon",  desc: "earn 100K coins in total",  goal: 1e5,  of: (s) => s.lifetimeCoins, digs: 25 },
  { id: "coins10m", icon: "💎", name: "Millionaire Hog",  desc: "earn 10M coins in total",   goal: 1e7,  of: (s) => s.lifetimeCoins, digs: 40 },
  { id: "coins1b",  icon: "🏦", name: "Billionaire Bacon", desc: "earn 1B coins in total",    goal: 1e9,  of: (s) => s.lifetimeCoins, digs: 60 },
  { id: "coins1t",  icon: "🌍", name: "Trillion Truffles", desc: "earn 1T coins in total",   goal: 1e12, of: (s) => s.lifetimeCoins, digs: 100 },
  { id: "digs100",  icon: "🍄", name: "Snout Work",       desc: "dig up 100 truffles",       goal: 100,  of: (s) => s.digs, digs: 15 },
  { id: "digs1k",   icon: "⛏️", name: "Truffle Miner",    desc: "dig up 1,000 truffles",     goal: 1e3,  of: (s) => s.digs, digs: 30 },
  { id: "digs10k",  icon: "🏔️", name: "Truffle Mountain", desc: "dig up 10,000 truffles",    goal: 1e4,  of: (s) => s.digs, digs: 60 },
  // crates
  { id: "crate1",   icon: "📦", name: "What's Inside?",   desc: "open a mystery crate",      goal: 1,  of: stat("crates"), digs: 15 },
  { id: "crate10",  icon: "🪵", name: "Crate Cracker",    desc: "open 10 crates",            goal: 10, of: stat("crates"), digs: 30 },
  { id: "crate50",  icon: "⚙️", name: "Crate Collector",  desc: "open 50 crates",            goal: 50, of: stat("crates"), digs: 60 },
  { id: "golden1",  icon: "🌟", name: "Golden Touch",     desc: "open a golden crate",       goal: 1,  of: stat("goldenCrates"), digs: 40 },
  // the farm itself
  { id: "buy50",    icon: "🛒", name: "Regular Customer", desc: "buy 50 pigs from the shop", goal: 50, of: stat("bought"), digs: 25 },
  { id: "maxupg",   icon: "⬆️", name: "Maxed Out",        desc: "max out any upgrade",       goal: 1,
    of: (s) => Object.keys(UPGRADES).some(k => s.upgrades[k] >= UPGRADES[k].max) ? 1 : 0, digs: 40 },
  { id: "stock5",   icon: "🏅", name: "Prize Stock",      desc: "Prize Breeds level 5",      goal: 5,  of: (s) => s.upgrades.stock || 0, digs: 50 },
  { id: "bigpen",   icon: "🚧", name: "Room to Roam",     desc: "fully expand the pen",      goal: EXPANSIONS.length - 1, of: (s) => s.expansion, digs: 50 },
  { id: "packed",   icon: "🐷", name: "Packed Pen",       desc: "have 25 pigs at once",      goal: 25, of: (s) => s.pigs.length, digs: 40 },
  { id: "quads",    icon: "👯", name: "Matching Set",     desc: "have 4 of the same pig at once", goal: 4,
    of: (s) => { const c = {}; let m = 0; for (const p of s.pigs) { c[p.tier] = (c[p.tier] || 0) + 1; if (c[p.tier] > m) m = c[p.tier]; } return m; }, digs: 20 },
  { id: "names5",   icon: "🏷️", name: "Name Tags",        desc: "name 5 pigs",               goal: 5,  of: stat("names"), digs: 20 },
  { id: "themes",   icon: "🎨", name: "Interior Decorator", desc: "own every farm style",    goal: Object.keys(THEMES).length, of: (s) => s.themesOwned.length, digs: 80 },
  // rebirths
  { id: "rb1",  icon: "🌱", name: "Fresh Start",      desc: "sell the farm once",       goal: 1,  of: (s) => s.rebirths, digs: 30 },
  { id: "rb3",  icon: "🌿", name: "Serial Seller",    desc: "sell the farm 3 times",    goal: 3,  of: (s) => s.rebirths, digs: 50 },
  { id: "rb5",  icon: "🌳", name: "Farm Flipper",     desc: "sell the farm 5 times",    goal: 5,  of: (s) => s.rebirths, digs: 80 },
  { id: "rb10", icon: "🗿", name: "Statue Garden",    desc: "sell the farm 10 times",   goal: 10, of: (s) => s.rebirths, digs: 150 },
];

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
    theme: "classic",
    themesOwned: ["classic"],
    stats: { merges: 0, crates: 0, goldenCrates: 0, bought: 0, names: 0 },   // lifetime, never reset
    ribbons: [],                     // ribbon ids earned (lifetime)
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
  s.stats.bought++;
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
  s.stats.merges++;
  a.name = a.name || b.name;   // a named pig keeps its name through the merge
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
  s.stats.crates++;
  if (s.crate.type === "golden") s.stats.goldenCrates++;
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

// ---------------------------------------------------------------- themes + names
export function buyTheme(s, key) {
  const t = THEMES[key];
  if (!t || s.themesOwned.includes(key) || s.coins < t.cost) return false;
  s.coins -= t.cost;
  s.themesOwned.push(key);
  s.theme = key;
  return true;
}
export function setTheme(s, key) {
  if (!THEMES[key] || !s.themesOwned.includes(key)) return false;
  s.theme = key;
  return true;
}
// Noah's feature: tap-tap a pig to name it. Names survive merges (the merged pig
// keeps whichever parent had one). Empty string clears the name.
export function namePig(s, id, name) {
  const pig = s.pigs.find(p => p.id === id);
  if (!pig) return false;
  const clean = String(name || "").trim().slice(0, 12);
  if (clean && !pig.name) s.stats.names++;   // first name on this pig counts; renames don't
  pig.name = clean || undefined;
  return true;
}

// Sell a stranded pig (an odd one out you can't merge anymore). Pays a few digs'
// worth of ITS truffle, capped at HALF the shop's base price for that tier — so
// buy→sell can never profit, even after rebirth multipliers inflate truffle value.
export const SELL_DIGS = 4;
export const sellValue = (s, pig) =>
  Math.max(1, Math.min(Math.ceil(truffleValue(s, pig.tier) * SELL_DIGS),
                       Math.floor(12 * Math.pow(4, pig.tier - 1) * 0.5)));
export function sellPig(s, id) {
  const pig = s.pigs.find(p => p.id === id);
  if (!pig) return 0;
  const value = sellValue(s, pig);
  s.pigs = s.pigs.filter(p => p.id !== id);
  s.coins += value;
  s.lifetimeCoins += value;
  s.stats.sold = (s.stats.sold || 0) + 1;
  return value;
}

// ---------------------------------------------------------------- ribbons
export const ribbonProgress = (s, r) => [Math.min(r.goal, r.of(s)), r.goal];
export const hasRibbon = (s, id) => s.ribbons.includes(id);
export const ribbonReward = (s, r) => Math.ceil(truffleValue(s, s.bestTier) * r.digs);
// Award every newly-completed ribbon; returns [{ ribbon, reward }] for the UI to
// celebrate. Called after any mutating action (cheap: ~40 closures).
export function checkRibbons(s) {
  const won = [];
  for (const r of RIBBONS) {
    if (s.ribbons.includes(r.id) || r.of(s) < r.goal) continue;
    const reward = ribbonReward(s, r);
    s.ribbons.push(r.id);
    s.coins += reward;
    s.lifetimeCoins += reward;
    won.push({ ribbon: r, reward });
  }
  return won;
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
  // shiny pigs removed (Noah's call) — scrub any that snuck into saves during the shiny hour
  delete s.shinyFound;
  if (s.pigs) for (const p of s.pigs) delete p.shiny;
  if (!s.themesOwned) { s.themesOwned = ["classic"]; s.theme = "classic"; }   // pre-theme saves
  // pre-ribbon saves: counters start at zero, but ribbons for things the save
  // already proves (best tier, coins, digs, rebirths…) will award on the first check
  if (!s.stats) s.stats = { merges: 0, crates: 0, goldenCrates: 0, bought: 0, names: 0 };
  if (!s.ribbons) s.ribbons = [];
  return s;
}
