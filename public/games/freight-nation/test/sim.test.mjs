// FREIGHT NATION — headless sim battery (run: node test/sim.test.mjs)
// Covers GDD §19 acceptance criteria that don't need a renderer.
import { NODES, EDGES, edgeKey, TRUCK_TYPES, CFG, CARGO, REGIONS, REGION_ORDER,
  PASSPORT_ROADS, SHIELD_REGIONS, parseHighways, ZONE_WEATHER, WEATHER, PAINT_COLORS } from "../src/data.mjs";
import { newGame, tick, routeOptions, findRoute, assign, reroute, forceEvent, autoPlanStops,
  serialize, deserialize, effSpeed, edgeOf, buyTruck, hireDriver, tankOf,
  isRush, edgeTz, tzOf, truckRange, longestLeg, pathInRange, tierOf, restAllowance,
  unlockedCities, cityUnlocked, checkRegionUnlocks, fmtDur, lanePremium, zoneSeverity,
  truckHighway, truckShields, truckEdge, renameTruck, paintTruck, truckPaint } from "../src/sim.mjs";

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
  // The baked OSM atlas covers the HOME region; the rest of the country draws its real roads
  // from the live map service, and falls back to `via` waypoints when offline.
  const homeEdges = EDGES.filter(e => NODES[e.a].region === "west" && NODES[e.b].region === "west");
  const homeCovered = homeEdges.filter(e => GEOM[edgeKey(e.a, e.b)]).length;
  band("baked corridor coverage (home region)", homeCovered / homeEdges.length, 0.8, 1.0);
  check("every baked corridor still matches a live edge",
    Object.keys(GEOM).every(k => EDGES.some(e => edgeKey(e.a, e.b) === k)),
    Object.keys(GEOM).filter(k => !EDGES.some(e => edgeKey(e.a, e.b) === k)).join(","));
  check("out-of-region corridors have hand waypoints instead",
    EDGES.filter(e => !GEOM[edgeKey(e.a, e.b)] && e.mi > 120).every(e => (e.via || []).length > 0),
    EDGES.filter(e => !GEOM[edgeKey(e.a, e.b)] && e.mi > 120 && !(e.via || []).length).map(e => e.hwy).join(","));
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
  // The passport is DERIVED from the graph, so the two-way invariant must hold exactly:
  // every shield sits on a drivable road, and every road on the map is worth a shield.
  const PASSPORT = PASSPORT_ROADS;
  const onEdges = new Set();
  for (const e of EDGES) for (const ref of parseHighways(e.hwy)) onEdges.add(ref);
  for (const road of PASSPORT) check(`passport road ${road} is reachable`, onEdges.has(road));
  check("no edge highway is missing from the passport",
    [...onEdges].every(r => PASSPORT.includes(r)), [...onEdges].filter(r => !PASSPORT.includes(r)).join(","));
  check("passport spans the whole country", PASSPORT.length >= 45, PASSPORT.length);
  check("every shield is tagged with a region",
    PASSPORT.every(r => (SHIELD_REGIONS[r] || []).length > 0));

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

// ---------- 18. the national map: regions, time zones, range, hours-of-service ----------
{
  // --- regions unlock outward from home, and only with reputation
  const S = newGame(18);
  check("new game starts in the home region only", S.regions.join() === "west", S.regions.join());
  check("home cities are open", cityUnlocked(S, "LKW") && cityUnlocked(S, "SF"));
  check("far cities are locked at rep 0", !cityUnlocked(S, "NYC") && !cityUnlocked(S, "DAL"));
  check("board only offers unlocked freight",
    S.contracts.every(c => cityUnlocked(S, c.from) && cityUnlocked(S, c.to)),
    S.contracts.map(c => `${c.from}->${c.to}`).join(" "));

  S.rep = REGIONS.southwest.repReq;
  const opened = checkRegionUnlocks(S);
  check("reputation opens the next region", opened.includes("southwest"), opened.join());
  check("the Southwest is now drivable", cityUnlocked(S, "LV") && cityUnlocked(S, "PHX"));
  check("regions further out stay shut", !cityUnlocked(S, "SEA"));
  S.rep = 0;
  checkRegionUnlocks(S);
  check("a region already earned is never taken back", cityUnlocked(S, "LV"));

  S.rep = 100;
  checkRegionUnlocks(S);
  check("every region opens at max reputation", S.regions.length === REGION_ORDER.length, S.regions.join());
  check("the whole country is now drivable", unlockedCities(S).length === Object.keys(NODES).length);
  check("regions unlock in geographic order",
    REGION_ORDER.every((r, i) => i === 0 || REGIONS[r].repReq >= REGIONS[REGION_ORDER[i - 1]].repReq));

  // --- time zones: rush hour follows the local clock, not the dispatcher's
  check("Pacific cities are tz 0", tzOf("LKW") === 0 && tzOf("SEA") === 0);
  check("Mountain / Central / Eastern offsets", tzOf("DEN") === 1 && tzOf("DAL") === 2 && tzOf("NYC") === 3);
  const pacificRush = 17 * 60; // 5 PM at home
  check("5 PM Pacific is rush at home", isRush(pacificRush, 0));
  check("5 PM Pacific is already past rush in New York", !isRush(pacificRush, 3));
  check("2 PM Pacific IS rush in New York", isRush(14 * 60, 3));
  const nycEdge = EDGES.find(e => e.a === "PHL" && e.b === "NYC");
  check("an edge picks up its own time zone", edgeTz(nycEdge) === 3, edgeTz(nycEdge));
  {
    // same road, same clock, different coast: speed must differ because rush is local
    const S2 = newGame(181);
    S2.time = 14 * 60;
    for (const z of Object.keys(S2.weather)) S2.weather[z] = { type: "clear", until: 1e9 };
    const tr = S2.trucks[0], e = EDGES.find(x => x.a === "PHL" && x.b === "NYC");
    const fast = effSpeed(S2, e, tr, null, 9 * 60);   // 9 AM PT = noon ET, clear
    const slow = effSpeed(S2, e, tr, null, 14 * 60);  // 2 PM PT = 5 PM ET, gridlock
    check("east-coast rush bites on the dispatcher's afternoon", slow < fast * 0.7, `${slow} vs ${fast}`);
  }

  // --- distance tiers now reach across the continent
  check("tier ladder", tierOf(40) === "LOCAL" && tierOf(200) === "REGIONAL" &&
    tierOf(600) === "LONG-HAUL" && tierOf(2400) === "TRANSCON");
  {
    const S3 = newGame(182);
    S3.rep = 100; checkRegionUnlocks(S3);
    const r = findRoute(S3, "LKW", "NYC", { type: "semi", upgrades: {} }, null, "fastest");
    check("Lakewood to New York is routable", !!r);
    check("a transcontinental run is transcon-tier", tierOf(r.mi) === "TRANSCON", r.mi);
    band("coast-to-coast mileage is realistic", r.mi, 2600, 3400);
  }

  // --- hours-of-service: long routes quote the nights they need
  check("a short hop needs no rest", restAllowance(4 * 60) === 0);
  check("a full shift earns one sleep", restAllowance(11 * 60) === CFG.REST_MIN);
  {
    const S4 = newGame(183);
    S4.rep = 100; checkRegionUnlocks(S4);
    const semi = { type: "semi", upgrades: {} };
    const r = findRoute(S4, "LKW", "NYC", semi, null, "fastest");
    check("transcon ETA includes sleep", r.mins > r.driveMins, `${r.mins} vs ${r.driveMins}`);
    check("transcon books multiple nights", r.nights >= 3, r.nights);
    check("elapsed time = driving + rest", r.mins === r.driveMins + r.restMins);
    check("a local hop books no nights",
      findRoute(S4, "LKW", "LGB", semi, null, "fastest").nights === 0);
    check("multi-day durations read in days", fmtDur(3000).endsWith("h") && fmtDur(3000).includes("d"), fmtDur(3000));
  }
  {
    // a driver who redlines between towns must shut down where they are, not drive on forever
    const S5 = newGame(184);
    S5.rep = 100; checkRegionUnlocks(S5);
    const truck = S5.trucks[0], driver = S5.drivers[0];
    truck.type = "semi"; truck.fuel = 999; truck.at = "BAK";
    driver.fatigue = CFG.FATIGUE_CRIT - 0.5;
    S5.contracts = [{ id: 980, shipper: "Redline Co", cargoType: "general", pallets: 3, from: "BAK", to: "STK",
      pay: 900, mi: 230, urgent: false, deadline: S5.time + 5000, expires: S5.time + 5000, tier: "REGIONAL" }];
    const route = routeOptions(S5, "BAK", "STK", truck, driver)[0];
    assign(S5, 980, truck.id, driver.id, route, {});
    tick(S5, 90);
    check("hours-of-service forces a roadside shutdown",
      truck.trip && /Mandatory rest/.test(truck.trip.pauseWhy || ""), truck.trip && truck.trip.pauseWhy);
    tick(S5, CFG.ROADSIDE_REST_MIN + 30);
    check("the driver wakes up rested", driver.fatigue < 20, driver.fatigue);
  }

  // --- fuel range: no corridor may be longer than a full tank can cross
  {
    const semi = { type: "semi", upgrades: {} };
    const worst = EDGES.reduce((m, e) => Math.max(m, e.mi), 0);
    check("no single leg outruns a semi's tank", worst <= truckRange(semi), `${worst} vs ${Math.round(truckRange(semi))}`);
    check("the aux tank actually extends range",
      truckRange({ type: "semi", upgrades: { tank: true } }) > truckRange(semi));
    const rusty = { type: "rusty", upgrades: {} };
    const longRun = ["DEN", "KC"];
    check("a rusty van cannot be sent across the plains", !pathInRange(rusty, longRun));
    check("a semi can", pathInRange(semi, longRun));
    check("longestLeg reads the graph", longestLeg(["LKW", "LGB"]) === 7, longestLeg(["LKW", "LGB"]));

    // and the sim refuses the assignment rather than towing you 300 miles from nowhere
    const S6 = newGame(185);
    S6.rep = 100; checkRegionUnlocks(S6);
    const t6 = S6.trucks[0], d6 = S6.drivers[0]; // rusty van
    t6.at = "DEN";
    S6.contracts = [{ id: 981, shipper: "Too Far Co", cargoType: "general", pallets: 3, from: "DEN", to: "KC",
      pay: 5000, mi: 600, urgent: false, deadline: S6.time + 9000, expires: S6.time + 9000, tier: "LONG-HAUL" }];
    const r6 = routeOptions(S6, "DEN", "KC", t6, d6)[0];
    const res = assign(S6, 981, t6.id, d6.id, r6, {});
    check("out-of-range assignment is refused", !res.ok, res.why);
    check("...with a reason that names the range", /range|fuel stops/i.test(res.why || ""), res.why);
  }

  // --- generated contracts stay inside what the fleet can actually do
  {
    const S7 = newGame(186);
    S7.rep = 100; checkRegionUnlocks(S7);
    S7.lastBoardRoll = -9999;
    tick(S7, 5);
    const fleetRange = Math.max(...S7.trucks.map(truckRange));
    let checked = 0;
    for (const c of S7.contracts) {
      const probe = findRoute(S7, c.from, c.to, S7.trucks[0], null, "fastest");
      if (!probe) continue;
      checked++;
      check(`board contract ${c.from}->${c.to} is drivable by the fleet`,
        longestLeg(probe.path) <= fleetRange, longestLeg(probe.path));
    }
    check("board was actually populated", checked > 0, checked);
  }

  // --- national data integrity
  {
    const ids = Object.keys(NODES);
    check("every city belongs to a real region", ids.every(i => REGIONS[NODES[i].region]));
    check("every city has a weather zone", ids.every(i => ZONE_WEATHER[NODES[i].zone]));
    check("every city has a state and time zone",
      ids.every(i => NODES[i].st && NODES[i].tz >= 0 && NODES[i].tz <= 3));
    check("every weather pick is a defined type",
      Object.values(ZONE_WEATHER).every(ws => ws.every(([t]) => WEATHER[t])));
    check("the map covers every region", REGION_ORDER.every(r => ids.some(i => NODES[i].region === r)));
    check("snow and ice exist for the cold half of the country",
      !!WEATHER.snow && !!WEATHER.ice && WEATHER.snow.chainable && WEATHER.ice.chainable);
    check("chains blunt the snow penalty", (() => {
      const S8 = newGame(187);
      const e = EDGES.find(x => x.mtn);
      S8.weather[NODES[e.a].zone] = { type: "snow", until: 1e9 };
      const bare = effSpeed(S8, e, { type: "semi", upgrades: {} }, null, 12 * 60);
      const chained = effSpeed(S8, e, { type: "semi", upgrades: { chains: true } }, null, 12 * 60);
      return chained > bare;
    })());
    check("states visited is tracked", newGame(188).stats.statesVisited.includes("CA"));
  }

  // --- lane premiums: the rest of the country must be worth driving to
  {
    check("snow country scores harsher than the desert",
      zoneSeverity("greatlakes") > zoneSeverity("desert") &&
      zoneSeverity("rockies") > zoneSeverity("south"));
    check("every zone has a severity", Object.keys(ZONE_WEATHER).every(z => zoneSeverity(z) >= 0));
    // an easy in-state lane earns little or no premium; a mountain/snow lane earns a real one
    const easy = lanePremium(["LKW", "ANA"]);
    const hard = lanePremium(["SLC", "CHY"]);          // I-80 over Wyoming: mtn + sparse + plains
    check("an easy home lane pays no big premium", easy < 1.08, easy);
    check("a mountain snow lane pays a premium", hard > easy + 0.1, `${hard} vs ${easy}`);
    check("the premium is capped", lanePremium(["BIL", "SPK"]) <= 1 + CFG.LANE_PREMIUM_MAX + 1e-9);
    check("premium never penalises a lane", lanePremium(["LKW", "LGB"]) >= 1);

    // and that premium must actually reach the player's wallet
    const S10 = newGame(190);
    S10.rep = 100; checkRegionUnlocks(S10);
    S10.cash = 1e6; buyTruck(S10, "semi");
    S10.contracts = []; S10.lastBoardRoll = -9999;
    tick(S10, 2);
    const perMi = S10.contracts.map(c => c.pay / Math.max(1, c.mi));
    check("board pays a sane rate per mile", perMi.every(v => v > 0.5 && v < 20),
      perMi.map(v => v.toFixed(2)).join(","));
  }

  // --- hours-of-service quotes must account for the driver you actually have
  {
    check("a rested driver needs no rest on a short run", restAllowance(5 * 60, 0) === 0);
    check("a half-spent driver redlines sooner on the SAME run",
      restAllowance(5 * 60, 70) === CFG.REST_MIN, restAllowance(5 * 60, 70));
    check("more fatigue never means less rest",
      restAllowance(9 * 60, 40) >= restAllowance(9 * 60, 0));
    const S11 = newGame(191);
    const truck = S11.trucks[0], driver = S11.drivers[0];
    driver.fatigue = 0;
    const fresh = findRoute(S11, "LKW", "SD", truck, driver, "fastest");
    driver.fatigue = 78;
    const tired = findRoute(S11, "LKW", "SD", truck, driver, "fastest");
    check("a tired driver gets a longer, honest ETA", tired.mins > fresh.mins, `${tired.mins} vs ${fresh.mins}`);
    // The gap must be the SLEEP the tired driver owes, not invented driving. (Drive time does
    // creep up a little — a tired driver is 5% slower — but the jump is the rest.)
    check("the extra time is rest, not phantom driving",
      tired.restMins > fresh.restMins &&
      tired.driveMins < fresh.driveMins * 1.1,
      `rest ${fresh.restMins}->${tired.restMins}, drive ${fresh.driveMins}->${tired.driveMins}`);
  }

  // --- "which freeway am I on" must track the truck, and mark the moment it changes
  {
    const S12 = newGame(192);
    const truck = S12.trucks[0], driver = S12.drivers[0];
    check("an idle truck is on no road", truckHighway(truck) === null);
    S12.contracts = [{ id: 970, shipper: "Signage Co", cargoType: "general", pallets: 3,
      from: "LKW", to: "SD", pay: 800, mi: 100, urgent: false,
      deadline: S12.time + 5000, expires: S12.time + 5000, tier: "REGIONAL" }];
    const route = routeOptions(S12, "LKW", "SD", truck, driver)[0];
    assign(S12, 970, truck.id, driver.id, route, {});
    tick(S12, 15);
    const first = truckHighway(truck);
    check("a rolling truck reports its freeway", !!first, first);
    check("the freeway is a real edge label",
      EDGES.some(e => e.hwy === first), first);
    check("shields parse off the label", truckShields(truck).length > 0, truckShields(truck).join());
    check("the change is timestamped", truck.trip.highwayChangedAt != null);

    // Drive a route that provably crosses more than one named highway and collect the
    // sequence of roads the badge would have shown.
    const S12b = newGame(1921);
    const t2 = S12b.trucks[0], d2 = S12b.drivers[0];
    const r2 = routeOptions(S12b, "LKW", "SAC", t2, d2)[0];
    const labels = [];
    for (let i = 0; i < r2.path.length - 1; i++) {
      const e = EDGES.find(x => edgeKey(x.a, x.b) === edgeKey(r2.path[i], r2.path[i + 1]));
      if (e && labels[labels.length - 1] !== e.hwy) labels.push(e.hwy);
    }
    check("the test route really does change freeways", labels.length >= 2, labels.join(" → "));
    S12b.contracts = [{ id: 972, shipper: "Signage Co", cargoType: "general", pallets: 3,
      from: "LKW", to: "SAC", pay: 3000, mi: r2.mi, urgent: false,
      deadline: S12b.time + 99000, expires: S12b.time + 99000, tier: "LONG-HAUL" }];
    assign(S12b, 972, t2.id, d2.id, r2, autoPlanStops(S12b, t2, d2, r2.path));
    const seen = [];
    let prevSeen = null, changeStamps = 0, guard = 0;
    while (t2.trip && guard++ < 4000) {
      tick(S12b, 3);
      if (!t2.trip) break;
      const now = truckHighway(t2);
      if (now && now !== prevSeen) {
        seen.push(now);
        if (prevSeen !== null) {
          changeStamps++;
          check(`freeway change ${prevSeen}->${now} is timestamped fresh`,
            S12b.time - t2.trip.highwayChangedAt <= 6, S12b.time - t2.trip.highwayChangedAt);
          check(`freeway change ${prevSeen}->${now} remembers the old road`,
            t2.trip.prevHighway === prevSeen, `${t2.trip.prevHighway} vs ${prevSeen}`);
        }
        prevSeen = now;
      }
    }
    check("the badge reported more than one freeway on a multi-road route",
      seen.length >= 2, seen.join(" → "));
    check("every change was recorded", changeStamps >= 1, changeStamps);
  }

  // --- completing the passport must pay like the grind it is
  {
    const S13 = newGame(193);
    const cash0 = S13.cash, rep0 = S13.rep = 40;
    S13.discoveredFreeways = [...PASSPORT_ROADS];
    checkRegionUnlocks(S13);
    tick(S13, 1); // milestones are checked on delivery; force one directly
    buyTruck(S13, "nonexistent");
    S13.cash = cash0;
    // drive a real delivery so checkMilestones() runs
    const t13 = S13.trucks[0], d13 = S13.drivers[0];
    S13.contracts = [{ id: 971, shipper: "Finale Co", cargoType: "general", pallets: 3,
      from: "LKW", to: "LGB", pay: 100, mi: 7, urgent: false,
      deadline: S13.time + 4000, expires: S13.time + 4000, tier: "LOCAL" }];
    assign(S13, 971, t13.id, d13.id, routeOptions(S13, "LKW", "LGB", t13, d13)[0], {});
    tick(S13, 900);
    check("finishing the passport pays the Grand Tour bonus",
      S13.cash >= cash0 + CFG.PASSPORT_COMPLETE_BONUS, `${cash0} -> ${Math.round(S13.cash)}`);
    check("...and a reputation jump", S13.rep >= rep0 + CFG.PASSPORT_COMPLETE_REP, S13.rep);
    check("...announced as a milestone",
      S13.alerts.some(a => /PASSPORT COMPLETE/.test(a.msg)));
    const cashAfter = S13.cash;
    tick(S13, 2000);
    check("the Grand Tour bonus pays exactly once", S13.cash <= cashAfter + 1000,
      `${cashAfter} -> ${Math.round(S13.cash)}`);
    check("the completion bonus dwarfs a single stamp",
      CFG.PASSPORT_COMPLETE_BONUS > CFG.PASSPORT_BONUS * PASSPORT_ROADS.length * 5);
  }

  // --- special deliveries: rare, loud, and they actually pay like an event
  {
    const oldChance = CFG.SPECIAL_CHANCE;
    CFG.SPECIAL_CHANCE = 1; // force the roll so the test is deterministic
    const S14 = newGame(194);
    S14.stats.delivered = 2; // specials wait until the tutorial trips are done
    S14.contracts = []; S14.lastBoardRoll = -9999;
    tick(S14, 2);
    const specials = S14.contracts.filter(c => c.special);
    check("a special delivery appears on the board", specials.length >= 1, specials.length);
    check("only ONE special at a time — it stays an event", specials.length === 1, specials.length);
    const sp = specials[0];
    check("the special has a story", !!sp.special.name && !!sp.special.icon && !!sp.special.blurb);
    check("the special rides a real cargo type", !!CARGO[sp.cargoType], sp.cargoType);
    check("the special respects the player's cargo reputation",
      CARGO[sp.cargoType].repReq <= S14.rep, `${sp.cargoType} needs ${CARGO[sp.cargoType].repReq}`);
    check("it was announced", S14.alerts.some(a => /SPECIAL DELIVERY on the board/.test(a.msg)));
    // pay premium: a same-route normal contract must pay meaningfully less
    CFG.SPECIAL_CHANCE = 0;
    const S14b = newGame(194);
    S14b.stats.delivered = 2; S14b.contracts = []; S14b.lastBoardRoll = -9999;
    tick(S14b, 2);
    const twin = S14b.contracts.find(c => c.from === sp.from && c.to === sp.to && c.pallets === sp.pallets);
    if (twin) check("the special pays a real premium over its normal twin",
      sp.pay > twin.pay * 1.5, `${sp.pay} vs ${twin.pay}`);

    // deliver it: bonus rep, counter, milestone
    const t14 = S14.trucks[0], d14 = S14.drivers[0];
    t14.at = sp.from; t14.type = "semi"; t14.fuel = 140;
    const r14 = routeOptions(S14, sp.from, sp.to, t14, d14)[0];
    const repBefore = S14.rep;
    check("special assigns like any load", assign(S14, sp.id, t14.id, d14.id, r14,
      autoPlanStops(S14, t14, d14, r14.path)).ok);
    let g14 = 0; while (t14.trip && g14++ < 3000) tick(S14, 5);
    const rep14 = S14.reports[0];
    check("special delivered", rep14 && !rep14.failed, rep14 && rep14.failedWhy);
    check("special pays bonus reputation", S14.rep >= repBefore + 2 + CFG.SPECIAL_REP_BONUS,
      `${repBefore} -> ${S14.rep}`);
    check("special delivery is counted", S14.stats.specials === 1, S14.stats.specials);
    check("the report tells the story", rep14.notes.some(n => /Special delivery/.test(n)),
      rep14.notes.join(" / "));
    check("first-special milestone fires", !!S14.milestones.special1);
    check("specials survive a save round-trip",
      !!deserialize(serialize(S14)).milestones.special1);
    CFG.SPECIAL_CHANCE = oldChance;
    check("special chance restored for later tests", CFG.SPECIAL_CHANCE === oldChance);
  }

  // --- the garage: name & paint are the player's, and the rules hold
  {
    const S15 = newGame(195);
    const t15 = S15.trucks[0];
    check("rename works and trims", renameTruck(S15, t15.id, "  Thunderbolt  ").ok && t15.nick === "Thunderbolt");
    check("rename caps at 24 chars", (renameTruck(S15, t15.id, "x".repeat(60)), t15.nick.length <= 24), t15.nick.length);
    check("empty rename rejected", !renameTruck(S15, t15.id, "   ").ok);
    check("rename of a ghost truck rejected", !renameTruck(S15, 9999, "Ghost").ok);
    const cash15 = S15.cash;
    check("paint works and charges", paintTruck(S15, t15.id, "purple").ok &&
      t15.color === "purple" && S15.cash === cash15 - CFG.PAINT_COST);
    check("truckPaint resolves the hex", truckPaint(t15).hex === "#7a4fbf", truckPaint(t15) && truckPaint(t15).hex);
    check("same color again rejected (no wasted $)", !paintTruck(S15, t15.id, "purple").ok);
    check("made-up color rejected", !paintTruck(S15, t15.id, "chartreuse").ok);
    S15.cash = CFG.PAINT_COST - 1;
    check("can't paint on an empty wallet", !paintTruck(S15, t15.id, "red").ok);
    const back15 = deserialize(serialize(S15));
    check("name and paint survive a save round-trip",
      back15.trucks[0].nick === t15.nick && back15.trucks[0].color === "purple");
    check("every paint color has a distinct hex",
      new Set(PAINT_COLORS.map(c => c.hex)).size === PAINT_COLORS.length);
  }

  // --- v1 (California-only) saves are retired, not half-loaded
  {
    const S9 = newGame(189);
    const round = deserialize(serialize(S9));
    check("v2 saves round-trip", round && round.regions.join() === S9.regions.join());
    check("v1 saves are rejected", deserialize(JSON.stringify({ ...S9, v: 1 })) === null);
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
