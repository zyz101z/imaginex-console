// FREIGHT NATION — simulation core. No DOM access: runs headless for tests (GDD §18).
// All times are game-minutes. Single time zone for the CA MVP (nodes carry tz for the
// nationwide version). Deterministic under a seed via mulberry32.
import { NODES, EDGES, edgeKey, TRUCK_TYPES, UPGRADES, CARGO, SHIPPERS, DRIVER_NAMES,
  CFG, WEATHER, ZONE_WEATHER, EVENT_DEFS } from "./data.mjs";

// ---------------------------------------------------------------- rng
function rand(S) {
  S.rngS = (S.rngS + 0x6D2B79F5) >>> 0;
  let t = S.rngS;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (S, a, b) => a + Math.floor(rand(S) * (b - a + 1));
const pickW = (S, pairs) => {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand(S) * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[0][0];
};

// ---------------------------------------------------------------- graph helpers
const adj = {};
for (const e of EDGES) {
  (adj[e.a] = adj[e.a] || []).push(e);
  (adj[e.b] = adj[e.b] || []).push(e);
}
export const edgeOf = key => EDGES.find(e => edgeKey(e.a, e.b) === key);
const other = (e, n) => e.a === n ? e.b : e.a;
const PASSPORT_REFS = new Set(["I-5", "I-10", "I-15", "I-80", "I-205", "I-215", "I-405", "I-580",
  "I-605", "I-710", "I-880", "US-101", "CA-22", "CA-57", "CA-60", "CA-91", "CA-99", "CA-152"]);
function edgeFreeways(e) {
  return (e.hwy.match(/(?:I|US|CA|SR)-?\d+/gi) || []).map(x => {
    const m = x.match(/^(I|US|CA|SR)-?(\d+)$/i);
    const p = m[1].toUpperCase() === "SR" ? "CA" : m[1].toUpperCase();
    return `${p}-${m[2]}`;
  }).filter(x => PASSPORT_REFS.has(x));
}

// ---------------------------------------------------------------- new game
export function newGame(seed = 1) {
  const S = {
    v: 1, seed, rngS: seed >>> 0,
    time: CFG.START_HOUR, speed: 1,
    cash: CFG.START_CASH, rep: 0,
    trucks: [], drivers: [], hirePool: [],
    contracts: [], events: [], weather: {},
    alerts: [], reports: [],
    stats: { delivered: 0, failed: 0, earned: 0, spent: 0, miles: 0 },
    discoveredFreeways: [],
    milestones: {}, nextId: 1,
    lastEventRoll: 0, lastBoardRoll: -9999, lastWageDay: 0,
  };
  addTruck(S, "rusty", "LKW");
  const d = genDriver(S, 1);
  d.hired = true;
  S.drivers.push(d);
  for (let i = 0; i < 3; i++) S.hirePool.push(genDriver(S));
  for (const z of Object.keys(ZONE_WEATHER)) S.weather[z] = { type: "clear", until: S.time + ri(S, 60, CFG.WEATHER_SHIFT_MIN) };
  refreshBoard(S, true);
  alert_(S, "Welcome, Dispatcher. One rusty van, one driver, big dreams. Accept a contract to roll.", "info");
  return S;
}

export function addTruck(S, typeId, at) {
  const t = TRUCK_TYPES[typeId];
  const truck = { id: S.nextId++, type: typeId, nick: t.name, fuel: t.tank, cond: typeId === "rusty" ? 72 : 100,
    upgrades: {}, at, trip: null, status: "Idle" };
  S.trucks.push(truck);
  return truck;
}
function genDriver(S, forceSkill) {
  const skill = forceSkill || ri(S, 1, 5);
  return { id: S.nextId++, name: DRIVER_NAMES[ri(S, 0, DRIVER_NAMES.length - 1)] + (S.nextId % 7 === 0 ? " Jr." : ""),
    skill, wage: CFG.WAGE_BASE + skill * 35, fatigue: 0, hired: false, busy: false };
}
function alert_(S, msg, kind = "info") {
  S.alerts.unshift({ at: S.time, msg, kind });
  S.alerts.length = Math.min(S.alerts.length, 40);
}
export const fmtClock = t => {
  const m = ((t % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ap}`;
};
export const dayOf = t => Math.floor(t / 1440) + 1;

// ---------------------------------------------------------------- conditions
export const isRush = t => { const m = t % 1440; return m >= CFG.RUSH_START && m < CFG.RUSH_END; };
const isNight = t => { const m = t % 1440; return m >= 22 * 60 || m < 5 * 60; };
export function zoneWeather(S, zone) { return WEATHER[S.weather[zone] ? S.weather[zone].type : "clear"]; }
function edgeZone(e) { return NODES[e.a].zone; }

export function eventsOn(S, e) {
  const k = edgeKey(e.a, e.b);
  return S.events.filter(ev => ev.edge === k && ev.endsAt > S.time);
}
export function edgeClosed(S, e) {
  return eventsOn(S, e).some(ev => EVENT_DEFS[ev.type].closed);
}

// effective speed on an edge at absolute time t (planning + live share this — GDD §7)
export function effSpeed(S, e, truck, driver, t) {
  const tt = TRUCK_TYPES[truck.type];
  let v = Math.min(e.mph, tt.top);
  if (e.urban && isRush(t)) v *= CFG.RUSH_SPEED;
  const w = zoneWeather(S, edgeZone(e));
  v *= w.speed;
  for (const ev of eventsOn(S, e)) {
    const d = EVENT_DEFS[ev.type];
    if (d.speed) v *= d.speed;
    if (d.smoke) v *= 0.8;
  }
  const q = Math.max(1, e.q - eventsOn(S, e).reduce((s, ev) => s + (EVENT_DEFS[ev.type].qPenalty || 0), 0));
  if (q <= 2) v *= 0.92;
  if (driver && driver.fatigue >= CFG.FATIGUE_TIRED) v *= 0.95;
  if (driver) v *= 1 + (driver.skill - 3) * 0.015;
  return Math.max(8, v);
}
// per-mile incident risk multiplier
function riskMult(S, e, driver, t) {
  let r = 1;
  if (e.urban && isRush(t)) r *= CFG.RUSH_RISK;
  r *= zoneWeather(S, edgeZone(e)).risk;
  if (isNight(t)) { r *= CFG.NIGHT_RISK; if (!e.urban) r *= 1.8; } // wildlife country (GDD §9)
  if (driver) {
    if (driver.fatigue >= CFG.FATIGUE_CRIT) r *= 6;
    else if (driver.fatigue >= CFG.FATIGUE_VERY) r *= 3;
    else if (driver.fatigue >= CFG.FATIGUE_TIRED) r *= 1.5;
    r *= 1 - (driver.skill - 3) * 0.08;
  }
  if (e.mtn) r *= 1.25;
  return r;
}
function mpgOf(S, truck, e, cargoType) {
  const tt = TRUCK_TYPES[truck.type];
  let mpg = tt.mpg;
  if (truck.upgrades.aero) mpg *= 1.12;
  if (e && e.mtn) mpg *= 0.82;
  if (e && e.urban && isRush(S.time)) mpg *= 0.85;
  if (cargoType && CARGO[cargoType].heavy) mpg *= 0.88;
  return mpg;
}
export const tankOf = truck => TRUCK_TYPES[truck.type].tank * (truck.upgrades.tank ? 1.4 : 1);

// ---------------------------------------------------------------- routing (GDD §7)
// Time-expanded Dijkstra: edge duration is evaluated at the clock you'd ARRIVE with,
// so rush hour ahead is priced in ("estimate arrival time at each city, not departure").
export function findRoute(S, from, to, truck, driver, kind, avoid = new Set(), departAt = null) {
  const t0 = departAt == null ? S.time : departAt;
  const best = { [from]: { cost: 0, time: t0, prev: null, prevEdge: null } };
  const done = new Set();
  while (true) {
    let cur = null;
    for (const n of Object.keys(best)) if (!done.has(n) && (!cur || best[n].cost < best[cur].cost)) cur = n;
    if (!cur) break;
    if (cur === to) break;
    done.add(cur);
    for (const e of adj[cur] || []) {
      const k = edgeKey(e.a, e.b);
      if (avoid.has(k) || edgeClosed(S, e)) continue;
      const nb = other(e, cur);
      if (done.has(nb)) continue;
      const at = best[cur].time;
      const v = effSpeed(S, e, truck, driver, at);
      const mins = (e.mi / v) * 60;
      const fuel$ = (e.mi / mpgOf(S, truck, e)) * NODES[cur].fuel;
      const risk = riskMult(S, e, driver, at) * e.mi;
      let cost;
      if (kind === "cheapest") cost = fuel$ + e.toll + mins * 0.06;
      else if (kind === "safest") cost = risk * 0.55 + mins * 0.10 + (5 - e.q) * 2;
      else cost = mins + e.toll * 0.15; // fastest
      const nc = best[cur].cost + cost;
      if (!best[nb] || nc < best[nb].cost) {
        best[nb] = { cost: nc, time: at + mins, prev: cur, prevEdge: e };
      }
    }
  }
  if (!best[to]) return null;
  const path = [];
  let n = to;
  while (n) { path.unshift(n); n = best[n].prev; }
  // metrics along the found path
  let mi = 0, mins = 0, fuel$ = 0, tolls = 0, risk = 0, t = t0, rough = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const e = adj[path[i]].find(x => other(x, path[i]) === path[i + 1] && !avoid.has(edgeKey(x.a, x.b)) && !edgeClosed(S, x));
    const v = effSpeed(S, e, truck, driver, t);
    const dm = (e.mi / v) * 60;
    mi += e.mi; mins += dm; tolls += e.toll;
    fuel$ += (e.mi / mpgOf(S, truck, e)) * NODES[path[i]].fuel;
    risk += riskMult(S, e, driver, t) * e.mi;
    if (e.q <= 2) rough += e.mi;
    t += dm;
  }
  return { kind, path, mi: Math.round(mi), mins: Math.round(mins), fuel$: Math.round(fuel$),
    tolls, risk: Math.round(risk), rough, eta: t0 + mins };
}

export function routeOptions(S, from, to, truck, driver, avoid = new Set(), departAt = null) {
  const opts = [];
  for (const kind of ["fastest", "cheapest", "safest"]) {
    const r = findRoute(S, from, to, truck, driver, kind, avoid, departAt);
    if (r && !opts.some(o => o.path.join() === r.path.join())) opts.push(r);
    else if (r) { const o = opts.find(x => x.path.join() === r.path.join()); o.also = (o.also || []).concat(kind); }
  }
  return opts;
}

// auto-plan fuel & rest stops along a path (GDD §4 step 5; player can edit)
export function autoPlanStops(S, truck, driver, path) {
  const plan = {};
  let fuel = truck.fuel, fat = driver ? driver.fatigue : 0;
  const tank = tankOf(truck);
  for (let i = 0; i < path.length - 1; i++) {
    const e = adj[path[i]].find(x => other(x, path[i]) === path[i + 1]);
    if (!e) continue;
    const gal = e.mi / mpgOf(S, truck, e);
    const hrs = e.mi / Math.min(e.mph, TRUCK_TYPES[truck.type].top);
    if (fuel - gal < tank * 0.2) { plan[path[i]] = { ...(plan[path[i]] || {}), refuel: true }; fuel = tank; } // fat reserve: mtn/rush burn more than book mpg
    if (fat + hrs * CFG.FATIGUE_PER_HR > CFG.FATIGUE_VERY) { plan[path[i]] = { ...(plan[path[i]] || {}), rest: true }; fat = 5; }
    fuel -= gal; fat += hrs * CFG.FATIGUE_PER_HR;
  }
  return plan;
}

// ---------------------------------------------------------------- contracts (GDD §11)
const CITY_IDS = Object.keys(NODES);
function genContract(S) {
  const originPool = [];
  for (const tr of S.trucks) if (tr.at) originPool.push(tr.at);
  const from = rand(S) < 0.55 && originPool.length ? originPool[ri(S, 0, originPool.length - 1)]
    : CITY_IDS[ri(S, 0, CITY_IDS.length - 1)];
  // distance tier gated by reputation (GDD §12: rep controls access)
  const maxMi = S.rep >= CFG.REP_LONGHAUL ? 9999 : S.rep >= CFG.REP_REGIONAL ? CFG.REGIONAL_MI : CFG.LOCAL_MI + 80;
  const cands = CITY_IDS.filter(id => {
    if (id === from) return false;
    const probe = findRoute(S, from, id, S.trucks[0], null, "fastest");
    return probe && probe.mi <= maxMi;
  });
  if (!cands.length) return null;
  const to = cands[ri(S, 0, cands.length - 1)];
  const cargoKeys = Object.keys(CARGO).filter(c => CARGO[c].repReq <= S.rep);
  const cargoType = cargoKeys[ri(S, 0, cargoKeys.length - 1)];
  const maxCap = Math.max(...S.trucks.map(t => TRUCK_TYPES[t.type].cap));
  // most contracts fit your fleet; some oversized ones dangle the next truck upgrade
  const pallets = rand(S) < 0.8 ? ri(S, 2, Math.max(2, maxCap)) : ri(S, Math.max(3, maxCap), 22);
  const probe = findRoute(S, from, to, S.trucks[0], null, "fastest");
  const cg = CARGO[cargoType];
  const urgent = rand(S) < 0.15;
  const pay = Math.round((CFG.PAY_BASE + probe.mi * CFG.PAY_PER_MI * cg.mult * (1 + pallets / 22)) * (urgent ? 1.5 : 1));
  const slack = (cg.tightDeadline || urgent) ? 1.25 : CFG.DEADLINE_SLACK;
  return { id: S.nextId++, shipper: SHIPPERS[ri(S, 0, SHIPPERS.length - 1)], cargoType, pallets, from, to,
    pay, mi: probe.mi, urgent,
    dlMins: Math.round(probe.mins * slack + 120), // clock starts when YOU accept (fair board)
    expires: S.time + ri(S, 180, 420),
    tier: probe.mi <= CFG.LOCAL_MI ? "LOCAL" : probe.mi <= CFG.REGIONAL_MI ? "REGIONAL" : "LONG-HAUL" };
}
function refreshBoard(S, force) {
  S.contracts = S.contracts.filter(c => c.expires > S.time);
  if (!force && S.time - S.lastBoardRoll < 90) return;
  S.lastBoardRoll = S.time;
  let guard = 0;
  while (S.contracts.length < CFG.CONTRACT_BOARD && guard++ < 30) {
    const c = genContract(S);
    if (c) S.contracts.push(c);
  }
}

// ---------------------------------------------------------------- assignment
export function assign(S, contractId, truckId, driverId, route, stopPlan) {
  const c = S.contracts.find(x => x.id === contractId);
  const truck = S.trucks.find(x => x.id === truckId);
  const driver = S.drivers.find(x => x.id === driverId);
  if (!c || !truck || !driver || truck.trip || driver.busy) return { ok: false, why: "Unavailable." };
  if (TRUCK_TYPES[truck.type].cap < c.pallets) return { ok: false, why: "Truck too small for this load." };
  const legs = [];
  let deadPlan = {};
  let repositionCost = 0;
  if (truck.at !== c.from) {
    const dead = findRoute(S, truck.at, c.from, truck, driver, "fastest");
    if (!dead) return { ok: false, why: "No path to pickup." };
    legs.push({ path: dead.path, loaded: false });
    deadPlan = autoPlanStops(S, truck, driver, dead.path);
    repositionCost = Math.round(dead.mi * CFG.DEADHEAD_OVERHEAD_PER_MI);
  }
  legs.push({ path: route.path, loaded: true });
  S.contracts = S.contracts.filter(x => x.id !== c.id);
  // "deliver within Xh of pickup": no deadhead → clock starts now; else it starts at loading
  if (c.dlMins != null && legs.length === 1) c.deadline = S.time + c.dlMins;
  driver.busy = true;
  truck.trip = {
    contract: c, driverId, legs, legIdx: 0, edgeIdx: 0, posMi: 0,
    routeKind: route.kind, stopPlan: { ...deadPlan, ...(stopPlan || {}) },
    pauseUntil: null, pauseWhy: null, blocked: false, railDone: {},
    cargo: { dmg: 0, fresh: 100 },
    spend: { fuel: 0, tolls: 0, stops: 0, fines: 0, repairs: 0, reposition: repositionCost },
    startedAt: S.time, incidents: 0,
  };
  truck.at = null;
  if (repositionCost) { S.cash -= repositionCost; S.stats.spent += repositionCost; }
  truck.status = legs[0].loaded ? "En route" : "Deadheading to pickup";
  applyNodeStops(S, truck, legs[0].path[0]); // start-node stops (e.g. top up before rolling out)
  return { ok: true };
}

// reroute the loaded leg from the next node (GDD §7: allowed any time, small delay)
export function reroute(S, truckId, kind, avoid = new Set()) {
  const truck = S.trucks.find(x => x.id === truckId);
  if (!truck || !truck.trip) return { ok: false };
  const T = truck.trip;
  const leg = T.legs[T.legIdx];
  const atNode = T.posMi === 0;           // blocked/waiting AT a node vs mid-edge
  const fromNode = atNode ? leg.path[T.edgeIdx] : leg.path[T.edgeIdx + 1];
  const dest = leg.path[leg.path.length - 1];
  if (fromNode === dest) return { ok: false, why: "Already on final approach." };
  const driver = S.drivers.find(d => d.id === T.driverId);
  const r = findRoute(S, fromNode, dest, truck, driver, kind, avoid);
  if (!r) return { ok: false, why: "No alternate route exists right now." };
  leg.path = leg.path.slice(0, T.edgeIdx + (atNode ? 1 : 2)).concat(r.path.slice(1));
  T.pauseUntil = Math.max(T.pauseUntil || 0, S.time + CFG.REROUTE_DELAY_MIN);
  T.pauseWhy = T.pauseWhy || "Re-planning route";
  T.blocked = false;
  T.stopPlan = { ...T.stopPlan, ...autoPlanStops(S, truck, driver, r.path) };
  alert_(S, `${truck.nick} rerouted (${kind}) via ${r.path.join(" → ")}`, "info");
  return { ok: true, route: r };
}

// ---------------------------------------------------------------- events (GDD §9, §15)
export function forceEvent(S, type, edgeK) {
  const def = EVENT_DEFS[type];
  const ev = { id: S.nextId++, type, edge: edgeK, startedAt: S.time,
    endsAt: S.time + ri(S, def.durMin[0], def.durMin[1]) };
  S.events.push(ev);
  const e = edgeOf(edgeK);
  alert_(S, `${def.icon} ${def.name} on ${e.hwy} (${NODES[e.a].name} ↔ ${NODES[e.b].name})`, def.closed ? "bad" : "warn");
  return ev;
}
function rollEvents(S) {
  if (S.time - S.lastEventRoll < CFG.EVENT_CHECK_MIN) return;
  S.lastEventRoll = S.time;
  // weather shifts per zone
  for (const z of Object.keys(S.weather)) {
    if (S.time >= S.weather[z].until) {
      S.weather[z] = { type: pickW(S, ZONE_WEATHER[z]), until: S.time + ri(S, 120, CFG.WEATHER_SHIFT_MIN + 160) };
    }
  }
  S.events = S.events.filter(ev => ev.endsAt > S.time);
  // spawn: weighted, weather- and rush-aware, capped so it isn't constant interruption
  if (S.events.length >= 4) return;
  const roll = rand(S);
  if (roll < 0.30) {
    const e = EDGES[ri(S, 0, EDGES.length - 1)];
    const w = zoneWeather(S, edgeZone(e));
    const stormy = w.risk >= 2;
    const pool = [];
    if (e.urban) pool.push(["accident_minor", isRush(S.time) ? 5 : 2], ["accident_major", isRush(S.time) ? 2 : 1]);
    else pool.push(["accident_minor", 2], ["closure", stormy ? 2 : 0.5]);
    pool.push(["construction", 1.2]);
    if ((e.mtn || e.sparse || !e.urban) && (edgeZone(e) === "valley" || edgeZone(e) === "south") && zoneWeather(S, edgeZone(e)).breakdown)
      pool.push(["wildfire", 1.5]); // heatwaves breed fires (GDD §15: events fit conditions)
    else if (e.mtn) pool.push(["wildfire", 0.6]);
    forceEvent(S, pickW(S, pool), edgeKey(e.a, e.b));
  }
}

// ---------------------------------------------------------------- per-minute truck sim
function currentEdge(T) {
  const leg = T.legs[T.legIdx];
  const a = leg.path[T.edgeIdx], b = leg.path[T.edgeIdx + 1];
  if (!b) return null;
  return adj[a].find(e => other(e, a) === b);
}
export function truckPos(T) { // for rendering: [nodeA, nodeB, frac]
  const leg = T.legs[T.legIdx];
  const a = leg.path[T.edgeIdx], b = leg.path[T.edgeIdx + 1];
  const e = b ? adj[a].find(x => other(x, a) === b) : null;
  return { a, b, frac: e ? Math.min(1, T.posMi / e.mi) : 0 };
}

function finishTrip(S, truck, failedWhy = null) {
  const T = truck.trip;
  const c = T.contract;
  const driver = S.drivers.find(d => d.id === T.driverId);
  const cg = CARGO[c.cargoType];
  const late = S.time - c.deadline;
  let pay = c.pay, bonuses = 0, penalties = 0, notes = [];
  let failed = !!failedWhy;
  if (!failed) {
    if (late > CFG.LATE_GRACE_MIN) {
      const cut = late > 240 ? 0.6 : 0.25;
      penalties += Math.round(pay * cut);
      notes.push(`Late by ${Math.round(late / 60 * 10) / 10}h (−${Math.round(cut * 100)}%)`);
      if (late > 600) { failed = true; failedWhy = "Severely late — contract cancelled"; }
    } else if (c.deadline - S.time > 90) { bonuses += Math.round(pay * 0.10); notes.push("Early bird bonus +10%"); }
    if (cg.fragile) {
      if (T.cargo.dmg >= 90) { failed = true; failedWhy = "Cargo destroyed"; }
      else if (T.cargo.dmg >= 40) { penalties += Math.round(pay * 0.35); notes.push(`Cargo damaged ${Math.round(T.cargo.dmg)}% (−35%)`); }
      else if (T.cargo.dmg < 10) { bonuses += Math.round(pay * 0.10); notes.push("Flawless handling +10%"); }
    }
    if (cg.perishable) {
      if (T.cargo.fresh <= 20) { failed = true; failedWhy = "Cargo spoiled"; }
      else if (T.cargo.fresh < 55) { penalties += Math.round(pay * 0.30); notes.push(`Freshness ${Math.round(T.cargo.fresh)}% (−30%)`); }
    }
  }
  const spend = T.spend;
  // Passport bonuses are paid the moment a shield is stamped (see advance()), so they are
  // already in the bank here and survive a trip that later fails — you still rode the road.
  const newFreeways = T.newFreeways || [];
  if (newFreeways.length)
    notes.push(`Freeway Passport: ${newFreeways.join(", ")} (+$${newFreeways.length * CFG.PASSPORT_BONUS} explorer bonus)`);
  const wageShare = 0; // wages are daily overhead, not per-trip
  const expenses = spend.fuel + spend.tolls + spend.stops + spend.fines + spend.repairs + (spend.reposition || 0) + wageShare;
  const revenue = failed ? 0 : pay + bonuses - penalties;
  const profit = revenue - expenses;
  S.cash += revenue - 0; // expenses were already deducted live
  let repD;
  if (failed) { repD = cg.medical ? -10 : -6; S.stats.failed++; }
  else if (late > CFG.LATE_GRACE_MIN) { repD = -2; S.stats.delivered++; }
  else { repD = 2 + ((cg.fragile && T.cargo.dmg < 10) || cg.medical ? 1 : 0); S.stats.delivered++; }
  S.rep = Math.max(0, Math.min(100, S.rep + repD));
  S.stats.earned += revenue;
  const report = {
    at: S.time, contract: c, failed, failedWhy, revenue, bonuses, penalties, expenses: { ...spend },
    profit, repD, notes, incidents: T.incidents, minutes: S.time - T.startedAt,
    dmg: Math.round(T.cargo.dmg), fresh: Math.round(T.cargo.fresh),
    driver: driver ? driver.name : "?", fatigue: driver ? Math.round(driver.fatigue) : 0,
    truck: truck.nick, kind: T.routeKind, freeways: T.roadsTraveled || [], newFreeways,
  };
  S.reports.unshift(report); S.reports.length = Math.min(S.reports.length, 12);
  alert_(S, failed ? `❌ ${failedWhy} — ${c.shipper} contract lost (rep ${repD})`
    : `✅ Delivered ${CARGO[c.cargoType].name} to ${NODES[c.to].name} · profit $${profit} (rep +${repD})`,
    failed ? "bad" : "good");
  truck.trip = null;
  truck.at = truckPosNode(T); // destination on success; nearest node ahead if aborted mid-route
  truck.status = "Idle";
  if (driver) driver.busy = false;
  checkMilestones(S);
  return report;
}
function truckPosNode(T) { // nearest sensible node when a trip aborts mid-road
  const leg = T.legs[T.legIdx];
  return leg.path[Math.min(T.edgeIdx + 1, leg.path.length - 1)];
}

function applyNodeStops(S, truck, node) {
  const T = truck.trip;
  const driver = S.drivers.find(d => d.id === T.driverId);
  const plan = T.stopPlan[node];
  const n = NODES[node];
  let pause = 0;
  if (plan && plan.refuel) {
    const tank = tankOf(truck);
    const gal = tank - truck.fuel;
    const cost = Math.round(gal * n.fuel);
    truck.fuel = tank;
    T.spend.fuel += cost; S.cash -= cost; S.stats.spent += cost;
    pause += CFG.FUEL_STOP_MIN;
    truck.status = `Refueling in ${n.name} ($${cost})`;
  }
  if (plan && plan.rest && driver) {
    const safe = n.safety >= 3;
    const cost = safe ? CFG.REST_COST_SAFE : 0;
    T.spend.stops += cost; S.cash -= cost; S.stats.spent += cost;
    pause += CFG.REST_MIN;
    truck.status = `Driver sleeping in ${n.name} (${safe ? "secure lot" : "street parking…"})`;
    T.restingUnsafe = !safe;
    T.restDriver = driver.id;
  }
  if (pause > 0) {
    // extend any existing pause (e.g. loading) rather than clobbering it
    T.pauseUntil = Math.max(T.pauseUntil || S.time, S.time) + pause;
    T.pauseWhy = truck.status;
  }
}
function wakeFromRest(S, truck) {
  const T = truck.trip;
  const driver = S.drivers.find(d => d.id === T.restDriver);
  if (driver) driver.fatigue = 4;
  if (T.restingUnsafe) {
    // sleeping rough: tickets and thieves (GDD §8.2)
    const cg = CARGO[T.contract.cargoType];
    let theftP = 0.12 * (cg.theft ? 2.2 : 1);
    if (truck.upgrades.alarm) theftP *= 0.35;
    if (TRUCK_TYPES[truck.type].secure) theftP *= 0.2;
    const r = rand(S);
    if (r < theftP) {
      alert_(S, `🥷 Cargo stolen overnight while street-parked! The ${T.contract.shipper} load is gone.`, "bad");
      finishTrip(S, truck, "Cargo stolen");
      return true;
    } else if (r < theftP + 0.18) {
      T.spend.fines += 120; S.cash -= 120; S.stats.spent += 120;
      alert_(S, `🎫 Parking ticket ($120) — unauthorized overnight truck parking.`, "warn");
    }
  }
  T.restingUnsafe = false; T.restDriver = null;
  return false;
}

function stepTruck(S, truck) {
  const T = truck.trip;
  if (!T) {
    return;
  }
  const driver = S.drivers.find(d => d.id === T.driverId);
  // paused? (resting, refueling, loading, towed, rail, reroute delay)
  if (T.pauseUntil) {
    if (S.time < T.pauseUntil) return;
    const wasRest = T.restDriver != null;
    T.pauseUntil = null; T.pauseWhy = null;
    if (wasRest && wakeFromRest(S, truck)) return; // trip may have ended (theft)
    truck.status = T.legs[T.legIdx].loaded ? "En route" : "Deadheading to pickup";
  }
  const leg = T.legs[T.legIdx];
  let e = currentEdge(T);
  if (!e) { // leg complete
    if (T.legIdx < T.legs.length - 1) {
      // arrived at pickup: load cargo — the delivery window starts HERE
      T.legIdx++; T.edgeIdx = 0; T.posMi = 0;
      T.pauseUntil = S.time + 30; T.pauseWhy = "Loading cargo";
      if (T.contract.dlMins != null) T.contract.deadline = S.time + 30 + T.contract.dlMins;
      truck.status = `Loading at ${NODES[T.contract.from].name}`;
      applyNodeStops(S, truck, T.legs[T.legIdx].path[0]); // pickup-city stops stack after loading
      return;
    }
    finishTrip(S, truck);
    return;
  }
  // Stamp freeway shields as they are actually encountered. This also makes the
  // passport work for older/in-progress trips that predate real-map route metadata.
  T.stampedEdges = T.stampedEdges || {};
  const stampKey = `${T.legIdx}:${T.edgeIdx}`;
  if (!T.stampedEdges[stampKey]) {
    T.stampedEdges[stampKey] = true;
    const roads = edgeFreeways(e);
    T.roadsTraveled = [...new Set([...(T.roadsTraveled || []), ...roads])];
    const fresh = roads.filter(x => !S.discoveredFreeways.includes(x));
    if (fresh.length) {
      S.discoveredFreeways.push(...fresh);
      T.newFreeways = [...new Set([...(T.newFreeways || []), ...fresh])];
      const bonus = fresh.length * CFG.PASSPORT_BONUS;
      S.cash += bonus; S.stats.earned += bonus;
      alert_(S, `🛣️ Freeway Passport stamped: ${fresh.join(", ")}! +$${bonus}`, "milestone");
    }
  }
  // blocked ahead?
  if (T.posMi === 0 && edgeClosed(S, e)) {
    if (!T.blocked) {
      T.blocked = true;
      truck.status = `⛔ BLOCKED at ${NODES[leg.path[T.edgeIdx]].name} — reroute needed`;
      alert_(S, `⛔ ${truck.nick} is blocked at ${NODES[leg.path[T.edgeIdx]].name} — road ahead is closed. Reroute!`, "bad");
    }
    return; // waits until player reroutes or closure ends
  }
  if (T.blocked) { T.blocked = false; truck.status = leg.loaded ? "En route" : "Deadheading to pickup"; }

  // rail crossing: decide once per edge entry (GDD §9)
  const ek = edgeKey(e.a, e.b);
  if (e.rail && T.railDone[ek] === undefined) {
    T.railDone[ek] = rand(S) < 0.3 ? e.mi * (0.2 + rand(S) * 0.6) : -1; // crossing point or none
  }

  const v = effSpeed(S, e, truck, driver, S.time);
  const dm = v / 60; // miles this minute
  const before = T.posMi;
  T.posMi += dm;
  S.stats.miles += dm;
  // fuel
  const gal = dm / mpgOf(S, truck, e, T.contract.cargoType);
  truck.fuel -= gal;
  if (truck.fuel <= 0) {
    truck.fuel = tankOf(truck) * 0.2;
    S.cash -= CFG.TOW_COST; T.spend.repairs += CFG.TOW_COST; S.stats.spent += CFG.TOW_COST;
    T.pauseUntil = S.time + CFG.TOW_DELAY_MIN; T.pauseWhy = "OUT OF FUEL — towed to next exit";
    truck.status = "⛽ Ran dry! Towed ($" + CFG.TOW_COST + ")";
    S.rep = Math.max(0, S.rep - 2);
    alert_(S, `⛽ ${truck.nick} ran out of fuel on ${e.hwy}! Towing: $${CFG.TOW_COST}, 4h lost, rep −2.`, "bad");
    return;
  }
  // fatigue
  if (driver) driver.fatigue = Math.min(100, driver.fatigue + CFG.FATIGUE_PER_HR / 60);
  if (driver && driver.fatigue >= CFG.FATIGUE_CRIT && !T._critWarned) {
    T._critWarned = true;
    alert_(S, `😴 ${driver.name} is CRITICALLY fatigued — accident risk is severe. Schedule sleep NOW.`, "bad");
  } else if (driver && driver.fatigue >= CFG.FATIGUE_VERY && !T._veryWarned) {
    T._veryWarned = true;
    alert_(S, `🥱 ${driver.name} is very tired — plan a rest stop soon.`, "warn");
  }
  // low fuel warning
  if (truck.fuel < tankOf(truck) * 0.15 && !T._fuelWarned) {
    T._fuelWarned = true;
    alert_(S, `⛽ ${truck.nick} is under 15% fuel — add a refuel stop.`, "warn");
  } else if (truck.fuel >= tankOf(truck) * 0.25) T._fuelWarned = false;

  // rail stop
  if (e.rail && T.railDone[ek] >= 0 && before < T.railDone[ek] && T.posMi >= T.railDone[ek]) {
    T.railDone[ek] = -1;
    const wait = ri(S, 5, 15);
    T.pauseUntil = S.time + wait; T.pauseWhy = "🚆 Waiting on a freight train";
    truck.status = `🚆 Train crossing on ${e.hwy} (${wait} min)`;
    return;
  }
  // cargo wear: rough pavement, storms, speed (GDD §10 fragile rules)
  const cg = CARGO[T.contract.cargoType];
  if (leg.loaded) {
    if (cg.fragile) {
      const q = Math.max(1, e.q - eventsOn(S, e).reduce((s, ev) => s + (EVENT_DEFS[ev.type].qPenalty || 0), 0));
      let d = 0;
      if (q <= 2) d += 0.035 * dm;
      if (v > 62) d += 0.012 * dm;
      if (zoneWeather(S, edgeZone(e)).risk >= 2) d += 0.02 * dm;
      if (truck.upgrades.tires) d *= 0.6;
      if (TRUCK_TYPES[truck.type].softride) d *= 0.5;
      T.cargo.dmg = Math.min(100, T.cargo.dmg + d);
    }
    if (cg.perishable) {
      T.cargo.fresh = Math.max(0, T.cargo.fresh - (TRUCK_TYPES[truck.type].reefer ? 0.006 : 0.05));
    }
  }
  // wear & breakdowns
  truck.cond = Math.max(0, truck.cond - dm * 0.004 * TRUCK_TYPES[truck.type].wear * (e.q <= 2 ? 2 : 1) * (truck.upgrades.tires ? 0.6 : 1));
  const heat = zoneWeather(S, edgeZone(e)).breakdown || 1;
  if (truck.cond < CFG.BREAKDOWN_COND && rand(S) < 0.00035 * dm * (CFG.BREAKDOWN_COND - truck.cond) * heat) {
    const bill = ri(S, 150, 450);
    S.cash -= bill; T.spend.repairs += bill; S.stats.spent += bill;
    T.pauseUntil = S.time + ri(S, 45, 120); T.pauseWhy = "🔧 Roadside breakdown";
    truck.status = `🔧 Breakdown on ${e.hwy} ($${bill})`;
    truck.cond = Math.max(truck.cond + 20, 50); // patched to drivable — full fix at a shop
    alert_(S, `🔧 ${truck.nick} broke down on ${e.hwy} — $${bill} roadside repair.`, "warn");
    return;
  }
  // incidents (accidents / wildlife strikes)
  const risk = CFG.BASE_INCIDENT_PER_MI * dm * riskMult(S, e, driver, S.time);
  if (rand(S) < risk) {
    T.incidents++;
    const major = rand(S) < 0.2;
    const night = isNight(S.time);
    const animal = !e.urban && night && rand(S) < 0.5;
    const bill = major ? ri(S, 300, 900) : 0;
    if (bill) { S.cash -= bill; T.spend.repairs += bill; S.stats.spent += bill; }
    truck.cond = Math.max(5, truck.cond - (major ? 22 : 7));
    if (leg.loaded && cg.fragile) T.cargo.dmg = Math.min(100, T.cargo.dmg + (major ? 45 : 12));
    T.pauseUntil = S.time + (major ? ri(S, 90, 180) : ri(S, 15, 40));
    T.pauseWhy = animal ? "🦌 Animal strike" : major ? "🚨 Serious accident" : "💥 Fender-bender";
    truck.status = `${T.pauseWhy} on ${e.hwy}`;
    if (major) S.rep = Math.max(0, S.rep - 2);
    alert_(S, `${T.pauseWhy}! ${truck.nick} on ${e.hwy}${bill ? ` — $${bill} damage` : ""}${major ? ", rep −2" : ""}.`, major ? "bad" : "warn");
    return;
  }
  // node reached?
  if (T.posMi >= e.mi) {
    T.posMi = 0; T.edgeIdx++;
    const node = leg.path[T.edgeIdx];
    if (e.toll > 0) { S.cash -= e.toll; T.spend.tolls += e.toll; S.stats.spent += e.toll; }
    if (leg.path[T.edgeIdx + 1] !== undefined || T.legIdx < T.legs.length - 1) applyNodeStops(S, truck, node);
  }
}

// ---------------------------------------------------------------- milestones (progression feedback)
function checkMilestones(S) {
  const ms = S.milestones;
  const owned = S.trucks.length;
  const fire = (key, msg) => { if (!ms[key]) { ms[key] = true; alert_(S, `🏆 ${msg}`, "milestone"); } };
  if (S.stats.delivered >= 1) fire("first", "First delivery complete! The company is real.");
  if (owned >= 2) fire("two", "Two trucks! You're officially a fleet dispatcher.");
  if (owned >= 3) fire("three", "Three rigs rolling — contracts can run in parallel.");
  if (owned >= 6) fire("six", "Six-truck fleet! Regional powerhouse status.");
  if (S.rep >= CFG.REP_REGIONAL) fire("regional", "Reputation unlocked REGIONAL contracts.");
  if (S.rep >= CFG.REP_LONGHAUL) fire("longhaul", "Reputation unlocked LONG-HAUL contracts.");
  if (S.rep >= 50) fire("medical", "MissionCare Medical will now ship with you (high pay, strict deadlines).");
  if (S.rep >= 80 && S.cash >= 150000) fire("national", "🎉 GOLDEN BEAR AWARD: California's #1 carrier! (Sandbox continues.)");
}

// ---------------------------------------------------------------- shop / hiring
export function buyTruck(S, typeId) {
  const t = TRUCK_TYPES[typeId];
  if (!t || S.cash < t.cost || S.rep < t.repReq) return { ok: false };
  S.cash -= t.cost; S.stats.spent += t.cost;
  const yard = S.trucks.find(x => x.at) ? S.trucks.find(x => x.at).at : "LKW";
  const truck = addTruck(S, typeId, yard);
  alert_(S, `🛒 Bought a ${t.name} — delivered to ${NODES[yard].name}.`, "good");
  checkMilestones(S);
  return { ok: true, truck };
}
export function sellTruck(S, truckId) {
  const i = S.trucks.findIndex(t => t.id === truckId);
  if (i === -1 || S.trucks[i].trip || S.trucks.length <= 1) return { ok: false };
  const t = S.trucks[i];
  const val = Math.round(TRUCK_TYPES[t.type].cost * 0.5 * (t.cond / 100)) + 300;
  S.cash += val;
  S.trucks.splice(i, 1);
  alert_(S, `Sold ${t.nick} for $${val}.`, "info");
  return { ok: true, val };
}
export function buyUpgrade(S, truckId, upId) {
  const truck = S.trucks.find(t => t.id === truckId);
  const up = UPGRADES[upId];
  if (!truck || !up || truck.upgrades[upId] || S.cash < up.cost) return { ok: false };
  S.cash -= up.cost; S.stats.spent += up.cost;
  truck.upgrades[upId] = true;
  return { ok: true };
}
export function repairTruck(S, truckId) {
  const truck = S.trucks.find(t => t.id === truckId);
  if (!truck || truck.trip) return { ok: false };
  const cost = Math.round((100 - truck.cond) * 9);
  if (cost <= 0 || S.cash < cost) return { ok: false };
  S.cash -= cost; S.stats.spent += cost;
  truck.cond = 100;
  return { ok: true, cost };
}
export function hireDriver(S, poolIdx) {
  const d = S.hirePool[poolIdx];
  if (!d || S.cash < 200) return { ok: false };
  S.cash -= 200; S.stats.spent += 200;
  d.hired = true;
  S.drivers.push(d);
  S.hirePool.splice(poolIdx, 1);
  S.hirePool.push(genDriver(S));
  alert_(S, `🤝 Hired ${d.name} (skill ${d.skill}★, $${d.wage}/day).`, "good");
  return { ok: true };
}

// ---------------------------------------------------------------- master tick
export function tick(S, mins) {
  for (let i = 0; i < mins; i++) {
    S.time += 1;
    // daily wages at midnight (GDD §12 expenses)
    const day = Math.floor(S.time / 1440);
    if (day > S.lastWageDay) {
      S.lastWageDay = day;
      const wages = S.drivers.reduce((s, d) => s + d.wage, 0);
      S.cash -= wages; S.stats.spent += wages;
      alert_(S, `💸 Daily wages paid: $${wages} (${S.drivers.length} driver${S.drivers.length > 1 ? "s" : ""}).`, "info");
      if (S.cash < -2000) alert_(S, `🏦 You are $${-S.cash} in the red — the bank is watching. Deliver!`, "bad");
      if (S.cash < -8000) { S.gameOver = true; alert_(S, "💀 BANKRUPT. The bank has seized the fleet. (Reset to try again.)", "bad"); }
    }
    rollEvents(S);
    refreshBoard(S);
    for (const truck of S.trucks) stepTruck(S, truck);
    for (const d of S.drivers) if (!d.busy) d.fatigue = Math.max(0, d.fatigue - 10 / 60);
  }
}

// ---------------------------------------------------------------- save / load
export const serialize = S => JSON.stringify(S);
export function deserialize(json) {
  const S = JSON.parse(json);
  if (!S || S.v !== 1) return null;
  S.discoveredFreeways = S.discoveredFreeways || [];
  return S;
}
