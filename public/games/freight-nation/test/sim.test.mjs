// FREIGHT NATION — headless sim battery (run: node test/sim.test.mjs)
// Covers GDD §19 acceptance criteria that don't need a renderer.
import { NODES, EDGES, edgeKey, TRUCK_TYPES, CFG, CARGO } from "../src/data.mjs";
import { newGame, tick, routeOptions, findRoute, assign, reroute, forceEvent, autoPlanStops,
  serialize, deserialize, effSpeed, edgeOf, buyTruck, hireDriver, tankOf } from "../src/sim.mjs";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) pass++; else { fail++; console.log("  FAIL:", n, d); } };
const band = (n, v, lo, hi) => check(`${n} in [${lo},${hi}]`, v >= lo && v <= hi, `got ${(+v).toFixed(2)}`);
const optOf = (opts, kind) => opts.find(o => o.kind === kind || (o.also || []).includes(kind));

// ---------- 1. graph integrity & connectivity ----------
{
  for (const e of EDGES) check(`edge nodes exist ${e.hwy}`, NODES[e.a] && NODES[e.b]);
  const S = newGame(1);
  const ids = Object.keys(NODES);
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const r = findRoute(S, a, b, S.trucks[0], null, "fastest");
    check(`connected ${a}->${b}`, !!r);
  }
}

// ---------- 2. route options: fastest vs cheapest vs safest ----------
{
  const S = newGame(2);
  const truck = S.trucks[0], driver = S.drivers[0];
  const opts = routeOptions(S, "LGB", "SF", truck, driver);
  check("at least 2 distinct routes LGB->SF", opts.length >= 2, opts.length);
  const fast = optOf(opts, "fastest");
  const cheap = optOf(opts, "cheapest") || fast;
  check("fastest is fastest", fast.mins <= cheap.mins + 1, `${fast.mins} vs ${cheap.mins}`);
  check("cheapest costs less (fuel+tolls)", cheap.fuel$ + cheap.tolls <= fast.fuel$ + fast.tolls + 1,
    `${cheap.fuel$ + cheap.tolls} vs ${fast.fuel$ + fast.tolls}`);
  // cheapest LA->SF is genuinely the lowest-$ of the offered options (with real mileage,
  // cheap valley diesel + the $12 bridge legitimately beats 436mi of pricey coastal fuel)
  const laOpts = routeOptions(S, "LA", "SF", truck, driver);
  const c2 = optOf(laOpts, "cheapest");
  check("cheapest LA->SF is lowest-$ option", laOpts.every(o => c2.fuel$ + c2.tolls <= o.fuel$ + o.tolls + 1),
    laOpts.map(o => `${o.kind}:$${o.fuel$ + o.tolls}`).join(" "));
}

// ---------- 3. closures force rerouting ----------
{
  const S = newGame(3);
  const truck = S.trucks[0], driver = S.drivers[0];
  const before = findRoute(S, "LA", "SF", truck, driver, "fastest");
  // close every edge on the fastest path's first hop
  const k = edgeKey(before.path[0], before.path[1]);
  forceEvent(S, "wildfire", k);
  const after = findRoute(S, "LA", "SF", truck, driver, "fastest");
  check("closure produces a different route", after && after.path.join() !== before.path.join());
  check("closed edge not used", !after.path.some((n, i) => after.path[i + 1] && edgeKey(n, after.path[i + 1]) === k));
}

// ---------- 4. a real trip: accept, drive, deliver, get paid ----------
{
  const S = newGame(4);
  S.contracts = [{ id: 999, shipper: "Test Co", cargoType: "general", pallets: 3, from: "LKW", to: "LA",
    pay: 200, mi: 20, urgent: false, deadline: S.time + 600, expires: S.time + 600, tier: "LOCAL" }];
  const truck = S.trucks[0], driver = S.drivers[0];
  const route = routeOptions(S, "LKW", "LA", truck, driver)[0];
  const res = assign(S, 999, truck.id, driver.id, route, {});
  check("assign ok", res.ok, res.why);
  const cashBefore = S.cash, fuelBefore = truck.fuel;
  tick(S, 600);
  check("trip completed", !truck.trip && truck.at === "LA", truck.status);
  check("got paid", S.cash > cashBefore - 50, `${cashBefore} -> ${S.cash}`);
  check("fuel burned", truck.fuel < fuelBefore);
  check("driver freed", !driver.busy);
  check("report written", S.reports.length === 1 && !S.reports[0].failed);
  check("rep gained", S.rep >= 2, S.rep);
}

// ---------- 5. rush hour slows urban travel (GDD §6) ----------
{
  const S = newGame(5);
  const truck = S.trucks[0], driver = S.drivers[0];
  const e = edgeOf(edgeKey("LKW", "LA"));
  const noonT = Math.floor(S.time / 1440) * 1440 + 12 * 60;
  const rushT = Math.floor(S.time / 1440) * 1440 + 17 * 60;
  const vNoon = effSpeed(S, e, truck, driver, noonT);
  const vRush = effSpeed(S, e, truck, driver, rushT);
  check("rush hour slows urban edges", vRush < vNoon * 0.6, `${vRush.toFixed(0)} vs ${vNoon.toFixed(0)}`);
  // and the planner prices it in: same route, ETA computed for a rush-hour departure is slower
  const day = findRoute(S, "LKW", "LA", truck, driver, "fastest", new Set(), noonT);
  const rush = findRoute(S, "LKW", "LA", truck, driver, "fastest", new Set(), rushT);
  check("planner prices rush hour in", rush.mins > day.mins * 1.4, `${rush.mins} vs ${day.mins}`);
}

// ---------- 6. fuel: burn, auto-stops, run-dry tow ----------
{
  const S = newGame(6);
  const truck = S.trucks[0], driver = S.drivers[0];
  // rusty van LGB->SF needs more than one 30gal tank at 10mpg (~410mi)
  const route = routeOptions(S, "LGB", "SF", truck, driver).find(o => o.kind === "fastest");
  const plan = autoPlanStops(S, truck, driver, route.path);
  check("auto-plan schedules a refuel", Object.values(plan).some(p => p.refuel), JSON.stringify(plan));
  // now force the disaster: no stops at all
  S.contracts = [{ id: 999, shipper: "T", cargoType: "general", pallets: 3, from: "LGB", to: "SF",
    pay: 900, mi: route.mi, deadline: S.time + 5000, expires: S.time + 500, tier: "LONG-HAUL" }];
  assign(S, 999, truck.id, driver.id, route, {});
  truck.trip.stopPlan = {}; // strip the safety net
  const cash0 = S.cash;
  tick(S, 2000);
  const towed = S.alerts.some(a => a.msg.includes("ran out of fuel"));
  check("running dry gets you towed", towed);
}

// ---------- 7. fatigue: rises driving, rest resets, rest costs time ----------
{
  const S = newGame(7);
  const truck = S.trucks[0], driver = S.drivers[0];
  const route = routeOptions(S, "LGB", "SAC", truck, driver).find(o => o.kind === "fastest");
  S.contracts = [{ id: 999, shipper: "T", cargoType: "general", pallets: 3, from: "LGB", to: "SAC",
    pay: 900, mi: route.mi, deadline: S.time + 90000, expires: S.time + 500, tier: "LONG-HAUL" }];
  assign(S, 999, truck.id, driver.id, route, autoPlanStops(S, truck, driver, route.path));
  tick(S, 240);
  check("fatigue rises while driving", driver.fatigue > 10, driver.fatigue);
  tick(S, 4000);
  check("long trip completes with stops", !truck.trip, truck.status);
  check("driver rested during trip or after", driver.fatigue < 95, driver.fatigue);
}

// ---------- 8. fragile cargo: rough roads hurt, smooth roads don't ----------
{
  const roughDmg = [], smoothDmg = [];
  for (const [from, to, arr] of [["BAK", "FRS", roughDmg], ["STK", "SAC", smoothDmg]]) {
    const S = newGame(42);
    const truck = S.trucks[0], driver = S.drivers[0];
    truck.at = from;
    const route = findRoute(S, from, to, truck, driver, "fastest");
    S.contracts = [{ id: 999, shipper: "T", cargoType: "fragile", pallets: 3, from, to,
      pay: 500, mi: route.mi, deadline: S.time + 9000, expires: S.time + 500, tier: "REGIONAL" }];
    assign(S, 999, truck.id, driver.id, route, {});
    tick(S, 900);
    const rep = S.reports[0];
    arr.push(rep ? rep.dmg : -1);
  }
  check("rough road damages fragile cargo more", roughDmg[0] > smoothDmg[0], `${roughDmg[0]} vs ${smoothDmg[0]}`);
}

// ---------- 9. deadlines: late delivery is penalized ----------
{
  const S = newGame(9);
  const truck = S.trucks[0], driver = S.drivers[0];
  const route = routeOptions(S, "LKW", "LA", truck, driver)[0];
  S.contracts = [{ id: 999, shipper: "T", cargoType: "general", pallets: 3, from: "LKW", to: "LA",
    pay: 300, mi: 20, deadline: S.time - 60, expires: S.time + 500, tier: "LOCAL" }]; // already blown deadline
  assign(S, 999, truck.id, driver.id, route, {});
  tick(S, 800);
  const rep = S.reports[0];
  check("late trip reported", !!rep);
  check("late penalty applied or failed", rep.failed || rep.penalties > 0, JSON.stringify(rep && rep.notes));
}

// ---------- 10. blocked mid-trip + reroute recovers ----------
{
  const S = newGame(10);
  const truck = S.trucks[0], driver = S.drivers[0];
  truck.at = "LA";
  const route = findRoute(S, "LA", "BAK", truck, driver, "fastest"); // direct I-5 Grapevine
  S.contracts = [{ id: 999, shipper: "T", cargoType: "general", pallets: 3, from: "LA", to: "BAK",
    pay: 400, mi: route.mi, deadline: S.time + 90000, expires: S.time + 500, tier: "REGIONAL" }];
  assign(S, 999, truck.id, driver.id, route, {});
  tick(S, 10);
  // burn the Grapevine ahead of the truck
  const ev = forceEvent(S, "wildfire", edgeKey("LA", "BAK"));
  // truck is ON that edge already (committed) OR at LA — either way, once at a node with
  // closed road ahead it blocks. Rewind to guarantee the blocked path: put it back at LA.
  truck.trip.legIdx = 0; truck.trip.edgeIdx = 0; truck.trip.posMi = 0;
  tick(S, 30);
  check("truck blocks at closed road", truck.trip && truck.trip.blocked, truck.status);
  const rr = reroute(S, truck.id, "fastest");
  check("reroute found detour", rr.ok, rr.why);
  tick(S, 6000);
  check("delivered after detour", !truck.trip && truck.at === "BAK", `${truck.status} at ${truck.at}`);
}

// ---------- 11. progression: shop gates, fleet growth, hiring ----------
{
  const S = newGame(11);
  check("start with exactly one rusty van", S.trucks.length === 1 && S.trucks[0].type === "rusty");
  check("start with one driver", S.drivers.length === 1);
  const denied = buyTruck(S, "semi");
  check("semi denied at rep 0", !denied.ok);
  S.cash = 100000; S.rep = 30;
  check("semi allowed at rep 30", buyTruck(S, "semi").ok);
  check("fleet grew", S.trucks.length === 2);
  check("hire a second driver", hireDriver(S, 0).ok && S.drivers.length === 2);
  // two simultaneous trips
  const [t1, t2] = S.trucks;
  const [d1, d2] = S.drivers;
  t1.at = "LKW"; t2.at = "LKW";
  const r1 = findRoute(S, "LKW", "LA", t1, d1, "fastest");
  const r2 = findRoute(S, "LKW", "RIV", t2, d2, "fastest");
  S.contracts = [
    { id: 991, shipper: "A", cargoType: "general", pallets: 3, from: "LKW", to: "LA", pay: 200, mi: 20, deadline: S.time + 9000, expires: S.time + 500, tier: "LOCAL" },
    { id: 992, shipper: "B", cargoType: "general", pallets: 3, from: "LKW", to: "RIV", pay: 200, mi: 35, deadline: S.time + 9000, expires: S.time + 500, tier: "LOCAL" },
  ];
  check("assign truck 1", assign(S, 991, t1.id, d1.id, r1, {}).ok);
  check("assign truck 2", assign(S, 992, t2.id, d2.id, r2, {}).ok);
  tick(S, 900);
  check("both trips completed in parallel", !t1.trip && !t2.trip && t1.at === "LA" && t2.at === "RIV",
    `${t1.at} / ${t2.at}`);
  check("fleet milestone fired", S.milestones.two === true);
}

// ---------- 12. capacity gating pulls you up the truck ladder ----------
{
  const S = newGame(12);
  const truck = S.trucks[0], driver = S.drivers[0];
  S.contracts = [{ id: 999, shipper: "T", cargoType: "furniture", pallets: 18, from: "LKW", to: "LA",
    pay: 500, mi: 20, deadline: S.time + 9000, expires: S.time + 500, tier: "LOCAL" }];
  const route = findRoute(S, "LKW", "LA", truck, driver, "fastest");
  const res = assign(S, 999, truck.id, driver.id, route, {});
  check("4-pallet van rejects 18-pallet load", !res.ok);
}

// ---------- 13. contract board respects rep tiers ----------
{
  const S = newGame(13);
  tick(S, 1); // board already generated at rep 0
  const far = S.contracts.filter(c => c.mi > CFG.REGIONAL_MI);
  check("no long-haul contracts at rep 0", far.length === 0, far.map(c => c.mi).join(","));
}

// ---------- 14. save / load roundtrip ----------
{
  const S = newGame(14);
  tick(S, 200);
  const json = serialize(S);
  const S2 = deserialize(json);
  check("load restores state", S2 && S2.time === S.time && S2.cash === S.cash && S2.trucks.length === S.trucks.length);
  tick(S, 100); tick(S2, 100);
  check("post-load sim identical (determinism)", serialize(S) === serialize(S2));
}

// ---------- 15. determinism under a seed ----------
{
  const run = seed => { const S = newGame(seed); tick(S, 1000); return serialize(S); };
  check("same seed => same world", run(77) === run(77));
  check("different seed => different world", run(77) !== run(78));
}

// ---------- 16. economy sanity: local grinding is modestly profitable ----------
{
  const S = newGame(16);
  const truck = S.trucks[0], driver = S.drivers[0];
  let profit = 0;
  for (let i = 0; i < 8; i++) {
    driver.fatigue = 0;
    const from = truck.at;
    const to = from === "LA" ? "LKW" : "LA";
    const route = findRoute(S, from, to, truck, driver, "fastest");
    S.contracts = [{ id: 5000 + i, shipper: "T", cargoType: "general", pallets: 4, from, to,
      pay: Math.round(CFG.PAY_BASE + route.mi * CFG.PAY_PER_MI * 1.18), mi: route.mi,
      deadline: S.time + route.mins * 2 + 120, expires: S.time + 500, tier: "LOCAL" }];
    const ok = assign(S, 5000 + i, truck.id, driver.id, route, autoPlanStops(S, truck, driver, route.path));
    if (!ok.ok) break;
    tick(S, 700);
    if (S.reports[0]) profit += S.reports[0].profit;
  }
  band("8 local runs net profit", profit, 100, 2500);
}

// ---------- 17. baked road geometry (real OSM centerlines) ----------
try {
  const { GEOM, CA_SHAPE } = await import("../src/geometry.mjs");
  const dMi = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180) * 69.17, (a[1] - b[1]) * 69.05);
  let covered = 0;
  for (const e of EDGES) {
    const line = GEOM[edgeKey(e.a, e.b)];
    if (!line) continue;
    covered++;
    const A = NODES[e.a], B = NODES[e.b];
    check(`geom ${e.hwy} ${e.a}->${e.b} has shape`, line.length >= 3, line.length);
    check(`geom starts at ${e.a}`, dMi(line[0], [A.lon, A.lat]) < 2);
    check(`geom ends at ${e.b}`, dMi(line[line.length - 1], [B.lon, B.lat]) < 2);
    let mi = 0;
    for (let i = 0; i < line.length - 1; i++) mi += dMi(line[i], line[i + 1]);
    // short hops tolerate absolute junction-approach overhead (605→405 loops etc.)
    check(`geom mileage sane ${e.hwy} (${e.mi}mi vs path ${Math.round(mi)}mi)`,
      mi > e.mi * 0.5 && mi < Math.max(e.mi * 1.8, e.mi + 13), Math.round(mi));
  }
  band("baked corridor coverage", covered / EDGES.length, 0.8, 1.0);
  check("CA boundary baked", CA_SHAPE && CA_SHAPE.length > 50, CA_SHAPE && CA_SHAPE.length);
} catch (e) {
  check("geometry.mjs exists (run tools/bake_geometry.mjs)", false, e.message);
}

// ---------- 15. deadhead repositioning is charged ----------
{
  const S = newGame(15);
  const truck = S.trucks[0], driver = S.drivers[0];
  truck.at = "LKW";
  S.contracts = [{ id: 950, shipper: "Deadhead Co", cargoType: "general", pallets: 3, from: "SD", to: "ANA",
    pay: 900, mi: 90, urgent: false, deadline: S.time + 1400, expires: S.time + 1400, tier: "REGIONAL" }];
  const route = routeOptions(S, "SD", "ANA", truck, driver)[0];
  const cashBefore = S.cash;
  check("assign with deadhead ok", assign(S, 950, truck.id, driver.id, route, {}).ok);
  const rep = truck.trip.spend.reposition;
  check("empty-mile overhead charged up front", rep > 0, rep);
  check("empty-mile overhead debited from cash", Math.round(cashBefore - S.cash) === rep,
    `${cashBefore} -> ${S.cash} vs ${rep}`);

  const S2 = newGame(15);
  const t2 = S2.trucks[0], d2 = S2.drivers[0];
  t2.at = "SD";
  S2.contracts = [{ id: 951, shipper: "NoDeadhead Co", cargoType: "general", pallets: 3, from: "SD", to: "ANA",
    pay: 900, mi: 90, urgent: false, deadline: S2.time + 1400, expires: S2.time + 1400, tier: "REGIONAL" }];
  const r2 = routeOptions(S2, "SD", "ANA", t2, d2)[0];
  assign(S2, 951, t2.id, d2.id, r2, {});
  check("no overhead when already at pickup", !t2.trip.spend.reposition, t2.trip.spend.reposition);
}

// ---------- 16. freeway passport ----------
{
  // every collectable shield must be reachable, or the set can never be completed
  const PASSPORT = ["I-5", "I-10", "I-15", "I-80", "I-205", "I-215", "I-405", "I-580",
    "I-605", "I-710", "I-880", "US-101", "CA-22", "CA-57", "CA-60", "CA-91", "CA-99", "CA-152"];
  const onEdges = new Set();
  for (const e of EDGES) for (const raw of e.hwy.match(/(?:I|US|CA|SR)-?\d+/gi) || []) {
    const m = raw.match(/^(I|US|CA|SR)-?(\d+)$/i);
    onEdges.add(`${m[1].toUpperCase() === "SR" ? "CA" : m[1].toUpperCase()}-${m[2]}`);
  }
  for (const road of PASSPORT) check(`passport road ${road} is reachable`, onEdges.has(road));
  check("no edge highway is missing from the passport",
    [...onEdges].every(r => PASSPORT.includes(r)), [...onEdges].filter(r => !PASSPORT.includes(r)).join(","));

  const S = newGame(16);
  const truck = S.trucks[0], driver = S.drivers[0];
  S.contracts = [{ id: 960, shipper: "Stamp Co", cargoType: "general", pallets: 3, from: "LKW", to: "LA",
    pay: 200, mi: 20, urgent: false, deadline: S.time + 900, expires: S.time + 900, tier: "LOCAL" }];
  const route = routeOptions(S, "LKW", "LA", truck, driver)[0];
  assign(S, 960, truck.id, driver.id, route, {});
  check("passport starts empty", S.discoveredFreeways.length === 0);
  const cashBefore = S.cash;
  tick(S, 900);
  const found = S.discoveredFreeways.length;
  check("driving stamps freeways", found > 0, found);
  check("stamps are paid as they happen",
    S.cash >= cashBefore, `${cashBefore} -> ${S.cash}`);
  check("trip report lists the roads travelled", (S.reports[0].freeways || []).length > 0);
  check("no duplicate shields", new Set(S.discoveredFreeways).size === found);

  // a second trip down the same corridor must not re-award anything
  truck.at = "LA";
  S.contracts = [{ id: 961, shipper: "Stamp Co", cargoType: "general", pallets: 3, from: "LA", to: "LKW",
    pay: 200, mi: 20, urgent: false, deadline: S.time + 900, expires: S.time + 900, tier: "LOCAL" }];
  const back = routeOptions(S, "LA", "LKW", truck, driver)[0];
  assign(S, 961, truck.id, driver.id, back, {});
  tick(S, 900);
  check("re-driving a known freeway awards nothing new",
    S.reports[0].newFreeways.length === 0, S.reports[0].newFreeways.join(","));
  check("passport did not grow on a repeat corridor", S.discoveredFreeways.length === found);

  // stamps earned before a failure are kept — you still rode the road
  const S3 = newGame(17);
  const t3 = S3.trucks[0], d3 = S3.drivers[0];
  S3.contracts = [{ id: 962, shipper: "Doomed Co", cargoType: "general", pallets: 3, from: "LKW", to: "SF",
    pay: 500, mi: 400, urgent: false, deadline: S3.time + 60, expires: S3.time + 60, tier: "LONG-HAUL" }];
  const long = routeOptions(S3, "LKW", "SF", t3, d3)[0];
  assign(S3, 962, t3.id, d3.id, long, {});
  tick(S3, 240);
  check("shields stamped mid-trip persist", S3.discoveredFreeways.length > 0, S3.discoveredFreeways.length);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
