// PIG MERGE TYCOON — headless engine battery. Run: node test/engine.test.mjs
import {
  TIERS, MAX_TIER, EXPANSIONS, UPGRADES, CRATE_TYPES, CRATE_LIFETIME, buyTier, newGame, capacity, pigletCost,
  digInterval, truffleValue, crateChance, upgradeCost, expansionCost, buyPiglet, canMerge,
  mergePigs, doDig, cratePulls, openCrate, declineCrate, expireCrate, buyUpgrade,
  buyExpansion, rebirthRequirement, canRebirth, doRebirth, offlineEarnings, score, fmt,
  serialize, deserialize,
} from "../src/engine.mjs";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) pass++; else { fail++; console.log("  FAIL:", n, d); } };

// seeded rng (mulberry32) so the battery is reproducible
const makeRng = (seed) => { let a = seed >>> 0; return () => {
  a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- 1. data ----------
check("20 tiers", TIERS.length === 20 && MAX_TIER === 20);
check("tier names unique", new Set(TIERS.map(t => t.name)).size === 20);
check("tier sizes ascend", TIERS.every((t, i) => i === 0 || t.size > TIERS[i - 1].size));
check("capacity ladder ascends", EXPANSIONS.every((c, i) => i === 0 || c > EXPANSIONS[i - 1]));

// ---------- 2. economy math ----------
{
  const s = newGame();
  check("starter coins buy exactly one piglet", s.coins >= pigletCost(s) && s.coins < 2 * pigletCost(s));
  check("piglet price climbs", (s.bought = 10, pigletCost(s) > 12), pigletCost(s));
  s.bought = 0;
  check("truffle value doubles-ish per tier", truffleValue(s, 5) > truffleValue(s, 4) * 1.8);
  s.upgrades.market = 8;
  check("market upgrade multiplies value", truffleValue(s, 3) > truffleValue({ ...s, upgrades: { ...s.upgrades, market: 0 } }, 3) * 2);
  s.upgrades.feed = 8;
  check("feed upgrade speeds digs", digInterval(s) < 6.0 * 0.6, digInterval(s).toFixed(2));
  s.upgrades.lucky = 8;
  check("lucky upgrade raises crate odds", crateChance(s) > (1 / 45) * 2.5);
  for (const k of Object.keys(UPGRADES)) {
    check(`upgrade ${k} cost grows`, upgradeCost({ ...s, upgrades: { feed: 3, market: 3, lucky: 3, stock: 3 } }, k) >
      upgradeCost({ ...s, upgrades: { feed: 0, market: 0, lucky: 0, stock: 0 } }, k));
  }
}

// ---------- 3. buy / merge / capacity ----------
{
  const rng = makeRng(1);
  const s = newGame();
  const p1 = buyPiglet(s, rng);
  check("buy piglet works", !!p1 && s.pigs.length === 1 && p1.tier === 1);
  check("cannot overspend", (s.coins = 0, buyPiglet(s, rng) === null));
  s.coins = 1e9;
  while (s.pigs.length < capacity(s)) buyPiglet(s, rng);
  check("capacity respected", buyPiglet(s, rng) === null && s.pigs.length === EXPANSIONS[0]);
  const [a, b, c] = s.pigs;
  check("canMerge same tier", canMerge(s, a, b));
  check("cannot merge with self", !canMerge(s, a, a));
  const merged = mergePigs(s, a.id, b.id, rng);
  check("merge consumes one, upgrades other", merged.tier === 2 && s.pigs.length === EXPANSIONS[0] - 1);
  check("cannot merge different tiers", !canMerge(s, merged, c));
  check("bestTier tracks", s.bestTier === 2);
  check("discovered logs tier 2", s.discovered.includes(2));
  // max tier can't merge
  const m1 = { id: 900, tier: MAX_TIER }, m2 = { id: 901, tier: MAX_TIER };
  s.pigs.push(m1, m2);
  check("max tier cannot merge", !canMerge(s, m1, m2));
}

// ---------- 4. digs + crates ----------
{
  const rng = makeRng(9);
  const s = newGame();
  s.coins = 1e9;
  for (let i = 0; i < 5; i++) buyPiglet(s, rng);
  const before = s.coins;
  const r = doDig(s, s.pigs[0], rng, 100);
  check("dig pays truffle value", s.coins === before + r.value && r.value === truffleValue(s, 1));
  let crates = 0;
  const seenTypes = {};
  for (let i = 0; i < 3000; i++) {
    const res = doDig(s, s.pigs[i % s.pigs.length], rng, 100 + i);
    if (res.crate) {
      crates++;
      seenTypes[res.crate.type] = (seenTypes[res.crate.type] || 0) + 1;
      check("crate has a cost priced off its base tier",
        res.crate.cost === Math.ceil(truffleValue(s, res.crate.base) * CRATE_TYPES[res.crate.type].costDigs));
      s.crate = null;
    }
  }
  check("crates appear at ~1/45 digs", crates > 30 && crates < 120, crates);
  check("wooden is the common crate", (seenTypes.wooden || 0) > (seenTypes.golden || 0), JSON.stringify(seenTypes));

  // pulls table: resolved tiers, probabilities sum to 1, matches what open rolls
  s.crate = { type: "iron", base: 3, cost: 100, expiresAt: 1e9 };
  const pulls = cratePulls(s.crate);
  check("iron pulls are base-1..base+1 (post-nerf)", pulls.map(p => p.tier).join(",") === "2,3,4");
  check("pull rates sum to 1", Math.abs(pulls.reduce((a, p) => a + p.p, 0) - 1) < 1e-9);
  // clamped offsets merge (golden at the top of the ladder = guaranteed max tier)
  const topPulls = cratePulls({ type: "golden", base: MAX_TIER, cost: 1, expiresAt: 1e9 });
  check("clamped pulls merge at max tier", topPulls.length === 1 && topPulls[0].tier === MAX_TIER &&
    Math.abs(topPulls[0].p - 1) < 1e-9);

  // opening pays the cost and lands inside the advertised table
  s.coins = 1e9;
  const coinsBefore = s.coins;
  const opened = openCrate(s, rng, 0);
  check("open deducts the cost", s.coins === coinsBefore - 100);
  check("open yields an advertised tier", opened && [2, 3, 4].includes(opened.tier), opened && opened.tier);
  // broke: no open, crate stays
  s.crate = { type: "wooden", base: 2, cost: 500, expiresAt: 1e9 };
  s.coins = 10;
  check("cannot open broke (crate stays)", openCrate(s, rng, 0) === null && !!s.crate);
  // decline clears it
  declineCrate(s);
  check("decline walks away", s.crate === null);
  // expiry
  s.crate = { type: "wooden", base: 2, cost: 5, expiresAt: 5 };
  expireCrate(s, 10);
  check("crate expires", s.crate === null);
  // full pen blocks opening, crate waits
  s.coins = 1e9;
  while (s.pigs.length < capacity(s)) buyPiglet(s, rng);
  s.crate = { type: "wooden", base: 2, cost: 5, expiresAt: 1e9 };
  check("full pen blocks crate open", openCrate(s, rng, 0) === null && !!s.crate);
  s.crate = null;

  // rate distribution: over many opens, common pull dominates the rare pull
  const dist = {};
  s.coins = 1e15;
  for (let i = 0; i < 800; i++) {
    s.pigs = s.pigs.slice(0, 3);
    s.crate = { type: "iron", base: 3, cost: 1, expiresAt: 1e9 };
    const g = openCrate(s, rng, 0);
    if (g) dist[g.tier] = (dist[g.tier] || 0) + 1;
  }
  check("open rolls follow the advertised rates (t3 ≈ 45% beats t4 ≈ 15%)",
    (dist[3] || 0) > (dist[4] || 0) * 1.6, JSON.stringify(dist));
}

// ---------- 4b. Prize Breeds (shop tier upgrade) ----------
{
  const rng = makeRng(21);
  const s = newGame();
  check("shop starts selling piglets", buyTier(s) === 1);
  s.coins = 1e9;
  for (let i = 0; i < 6; i++) buyPiglet(s, rng);
  const inflated = pigletCost(s);
  check("price inflated after buys", inflated > 12, inflated);
  check("stock upgrade purchasable", buyUpgrade(s, "stock"));
  check("shop now sells Pigs (tier 2)", buyTier(s) === 2);
  check("price inflation reset on new stock line", s.bought === 0 && pigletCost(s) === Math.ceil(12 * 4));
  s.pigs = [];   // make room (the 6 buys above filled the starter pen)
  const p = buyPiglet(s, rng);
  check("shop pig comes out at the shop tier", p && p.tier === 2);
  // rebirth resets the stock line
  s.pigs = [{ id: 999, tier: 14, x: 0, y: 0 }];
  doRebirth(s);
  check("rebirth resets Prize Breeds", buyTier(s) === 1 && s.upgrades.stock === 0);
  // old saves migrate
  const legacy = JSON.parse(serialize(newGame()));
  delete legacy.upgrades.stock;
  const mig = deserialize(JSON.stringify(legacy));
  check("pre-stock saves migrate to stock 0", mig && mig.upgrades.stock === 0);
  // crates give players plenty of time now
  check("crates wait 5 minutes", CRATE_LIFETIME === 300);
}

// ---------- 5. upgrades + expansion purchases ----------
{
  const s = newGame();
  s.coins = 1e12;
  for (const k of Object.keys(UPGRADES)) {
    let n = 0;
    while (buyUpgrade(s, k)) n++;
    check(`upgrade ${k} caps at max`, n === UPGRADES[k].max && !buyUpgrade(s, k));
  }
  let e = 0;
  while (buyExpansion(s)) e++;
  check("expansions cap at ladder end", e === EXPANSIONS.length - 1 && expansionCost(s) === null);
  check("capacity at max ladder", capacity(s) === EXPANSIONS[EXPANSIONS.length - 1]);
  const poor = newGame();
  poor.coins = 0;
  check("cannot buy upgrade broke", !buyUpgrade(poor, "feed"));
  check("cannot expand broke", !buyExpansion(poor));
}

// ---------- 6. rebirth ----------
{
  const rng = makeRng(3);
  const s = newGame();
  check("rebirth gated", !canRebirth(s) && rebirthRequirement(s) === 10);
  s.pigs.push({ id: 1, tier: 10, x: 0, y: 0 });
  s.upgrades.market = 5; s.expansion = 3; s.coins = 5555; s.bought = 30;
  check("rebirth allowed at tier 10", canRebirth(s));
  check("rebirth executes", doRebirth(s));
  check("rebirth doubles mult", s.mult === 2 && s.rebirths === 1);
  check("rebirth resets run", s.pigs.length === 0 && s.coins === 15 && s.bought === 0 &&
    s.upgrades.market === 0 && s.expansion === 1);
  check("requirement climbs", rebirthRequirement(s) === 11);
  for (let i = 0; i < 10; i++) { s.pigs = [{ id: 1, tier: 16, x: 0, y: 0 }]; doRebirth(s); }
  check("requirement caps at 14", rebirthRequirement(s) === 14);
  check("mult compounds", s.mult === 2 ** 11);
}

// ---------- 7. offline earnings ----------
{
  const s = newGame(1000);
  s.pigs = [{ id: 1, tier: 4, x: 0, y: 0 }, { id: 2, tier: 4, x: 0, y: 0 }];
  const g1 = offlineEarnings(s, 1000 + 3600);
  const expected = Math.floor((2 * truffleValue(s, 4) / digInterval(s)) * 3600 * 0.4);
  check("offline pays 40% rate", g1 === expected, `${g1} vs ${expected}`);
  s.lastSeen = 0;
  const g2 = offlineEarnings(s, 100 * 3600);
  const cap = Math.floor((2 * truffleValue(s, 4) / digInterval(s)) * 8 * 3600 * 0.4);
  check("offline caps at 8h", g2 === cap, `${g2} vs ${cap}`);
  const s2 = newGame(0);
  check("no pigs, no offline pay", offlineEarnings(s2, 99999) === 0);
  const s3 = newGame(0);
  s3.pigs = [{ id: 1, tier: 1, x: 0, y: 0 }];
  s3.lastSeen = 100;
  check("short absences ignored", offlineEarnings(s3, 130) === 0);
}

// ---------- 8. save round-trip + score + fmt ----------
{
  const rng = makeRng(5);
  const s = newGame();
  s.coins = 12345; buyPiglet(s, rng);
  const s2 = deserialize(serialize(s));
  check("save round-trip", JSON.stringify(s2) === JSON.stringify(s));
  check("bad save rejected", deserialize('{"v":99}') === null);
  s.bestTier = 12; s.rebirths = 3;
  check("score formula", score(s) === 1203);
  check("fmt small", fmt(999) === "999");
  check("fmt K/M", fmt(1500) === "1.5K" && fmt(2_400_000) === "2.4M");
  check("fmt trims .0", fmt(2000) === "2K");
  check("fmt hundreds floor", fmt(123_456) === "123K");
}

// ---------- 9. scripted bot: play to rebirth ×2 with invariants ----------
{
  const rng = makeRng(42);
  const s = newGame(0);
  let now = 0, violations = 0, merges = 0;
  const invariant = () => {
    if (s.coins < 0) violations++;
    if (s.pigs.length > capacity(s)) violations++;
    if (s.pigs.some(p => p.tier < 1 || p.tier > MAX_TIER)) violations++;
  };
  let guard = 0;
  while (s.rebirths < 2 && guard++ < 400000) {
    now += 1;
    // every pig digs about every digInterval seconds (compressed sim)
    for (const p of [...s.pigs]) if (guard % Math.max(1, Math.round(digInterval(s))) === 0) doDig(s, p, rng, now);
    expireCrate(s, now);
    if (s.crate) {
      if (s.coins > s.crate.cost * 2 && s.pigs.length < capacity(s)) openCrate(s, rng, now);
      else if (s.coins < s.crate.cost) declineCrate(s);
    }
    // greedy: merge any pair, buy piglets, then upgrades, then expand, then rebirth
    const byTier = {};
    for (const p of s.pigs) (byTier[p.tier] = byTier[p.tier] || []).push(p);
    for (const t of Object.keys(byTier)) {
      while (byTier[t].length >= 2 && +t < MAX_TIER) {
        const a = byTier[t].pop(), b = byTier[t].pop();
        if (mergePigs(s, a.id, b.id, rng)) merges++;
      }
    }
    while (s.pigs.length < capacity(s) && s.coins >= pigletCost(s)) buyPiglet(s, rng);
    for (const k of ["feed", "market", "lucky", "stock"]) if (s.coins > upgradeCost(s, k) * 4) buyUpgrade(s, k);
    if (expansionCost(s) != null && s.coins > expansionCost(s) * 2) buyExpansion(s);
    if (canRebirth(s)) doRebirth(s);
    invariant();
  }
  check("bot reaches rebirth x2", s.rebirths === 2, `rebirths=${s.rebirths} after ${guard} ticks`);
  check("bot merged a lot", merges > 80, merges);
  check("no invariant violations", violations === 0, violations);
  check("bestTier >= first requirement", s.bestTier >= 10, s.bestTier);
}

console.log(`\n=== pigmerge: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
