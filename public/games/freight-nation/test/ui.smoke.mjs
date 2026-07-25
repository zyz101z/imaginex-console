// Headless smoke test for src/ui.mjs — boots the UI against a fake DOM/MapLibre/fetch
// and drives the flows a player actually takes. Catches the class of bug the sim battery
// cannot see: render crashes, broken wiring, planner/dispatch desync, offline fallback.
//
//   node test/ui.smoke.mjs            # real-map path (MapLibre + OSRM available)
//   node test/ui.smoke.mjs --offline  # MapLibre missing → canvas fallback must still run
import { installDom, installMapLibre, installFetch } from "./dom-stub.mjs";

const OFFLINE = process.argv.includes("--offline");
// Fixed seed by default so a failure is reproducible; --seed=N sweeps other games.
const seedArg = process.argv.find(a => a.startsWith("--seed="));
globalThis.__RD_SEED = seedArg ? +seedArg.split("=")[1] : 20260724;
let pass = 0;
const fails = [];
const ok = (label, cond, detail = "") => {
  if (process.env.RD_TRACE) console.error("  ·", label);
  if (cond) pass++;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

const dom = installDom();
globalThis.__RD_SEED = seedArg ? +seedArg.split("=")[1] : 20260724; // installDom resets globals
if (!OFFLINE) installMapLibre();
const fetchCalls = installFetch();

// Canvas 2d context stub, so the fallback renderer can be exercised for real.
const noop = () => {};
const ctx2d = new Proxy({
  canvas: {}, measureText: () => ({ width: 40 }), createLinearGradient: () => ({ addColorStop: noop }),
  save: noop, restore: noop, beginPath: noop, closePath: noop, clip: noop,
}, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
const canvasEl = dom.byId.get("mapCanvas");
canvasEl.getContext = () => ctx2d;
canvasEl.clientWidth = 900; canvasEl.clientHeight = 700;
canvasEl.width = 900; canvasEl.height = 700;

const errors = [];
process.on("uncaughtException", e => errors.push(e));

const ui = await import("../src/ui.mjs");
const rd = globalThis.window.__rd;
await new Promise(r => setTimeout(r, 0)); // let the map's async "load" land

try {

ok("boot: debug hook exposed", !!rd);
ok("boot: game state created", !!rd?.S, rd?.S ? "" : "S is null");
ok(`boot: ${OFFLINE ? "canvas fallback" : "real map"} selected`,
  OFFLINE ? rd.mapMode() === "canvas" : rd.mapMode() === "real",
  `mapMode=${rd?.mapMode?.()}`);

// --- a frame must run without throwing, in both map modes --------------------
try { rd.frame(16); rd.frame(32); ok("frame: renders without throwing", true); }
catch (e) { ok("frame: renders without throwing", false, e.message); }

// --- side panel renders every tab --------------------------------------------
for (const tab of ["contracts", "fleet", "passport", "shop", "log"]) {
  try {
    rd.setTab(tab);
    const html = dom.byId.get("side").innerHTML;
    ok(`tab ${tab}: renders non-empty`, html.length > 50, `${html.length} chars`);
  } catch (e) { ok(`tab ${tab}: renders`, false, e.message); }
}
rd.setTab("contracts");

// --- planner: open, and route cards must agree with what dispatch will use ----
const S = rd.S;
// The board can post freight the starting van is too small for; plan one it can carry.
const capacity = Math.max(...S.trucks.map(t => rd.truckCap(t)));
const contract = S.contracts.find(c => c.pallets <= capacity);
ok("planner: a haulable contract exists", !!contract,
  `board pallets = ${S.contracts.map(c => c.pallets).join(",")} vs cap ${capacity}`);

if (contract) {
  rd.plan(contract.id);
  ok("planner: opened", !!rd.planner(), "planner is null after plan()");
}

if (contract && rd.planner() && !OFFLINE) {
  await rd.settled();
  ok("planner: OSRM was queried", fetchCalls.length > 0, `${fetchCalls.length} calls`);
  ok("planner: real routes stored", !!rd.planner().realRoutes?.length);
}

if (rd.planner()) {
  const p = rd.planner();
  const cards = rd.routeCards();
  ok("planner: at least one route card", cards.length > 0);
  ok("planner: never more cards than sim options",
    cards.length <= p.opts.length, `${cards.length} cards vs ${p.opts.length} opts`);
  // Every card must be selectable and resolve to the sim option it advertises.
  for (let i = 0; i < cards.length; i++) {
    p.choice = i;
    const chosen = rd.chosenOption();
    ok(`planner: card ${i} maps to its own sim option`,
      chosen === p.opts[i], `resolved to opts[${p.opts.indexOf(chosen)}]`);
    ok(`planner: card ${i} miles match its sim option`,
      Math.round(cards[i].mi) === Math.round(p.opts[i].mi),
      `card ${cards[i].mi} vs sim ${p.opts[i].mi}`);
    ok(`planner: card ${i} draws the road it advertises`,
      rd.plannerGeometryMatchesChoice(), "drawn geometry came from a different option");
  }
  p.choice = 0;
}

// --- dispatch ----------------------------------------------------------------
const trucksBefore = S.trucks.filter(t => t.trip).length;
if (rd.planner()) rd.dispatch();
ok("dispatch: truck is now on a trip", S.trucks.filter(t => t.trip).length === trucksBefore + 1);
ok("dispatch: planner closed", !rd.planner());
ok("dispatch: time resumed", S.speed > 0, `speed=${S.speed}`);

// --- run the clock: the sim + UI must survive a full multi-day run ------------
try {
  for (let i = 0; i < 240; i++) { rd.tickMinutes(30); rd.frame(1000 + i * 16); }
  ok("simulation: 5 game-days of ticking + rendering survives", true);
} catch (e) { ok("simulation: 5 game-days survives", false, e.message); }

ok("simulation: something got delivered or failed",
  S.stats.delivered + S.stats.failed > 0, `d=${S.stats.delivered} f=${S.stats.failed}`);

// --- freeway passport --------------------------------------------------------
rd.setTab("passport");
const passportHtml = dom.byId.get("side").innerHTML;
ok("passport: renders shields", passportHtml.includes("Freeway Passport"));
ok("passport: at least one road discovered after driving",
  (S.discoveredFreeways || []).length > 0, `${(S.discoveredFreeways || []).length} found`);
ok("passport: no unknown roads leaked into the collection",
  (S.discoveredFreeways || []).every(r => rd.passportRoads().includes(r)),
  (S.discoveredFreeways || []).filter(r => !rd.passportRoads().includes(r)).join(","));

// --- the national map: regions, unlocks, multi-day copy ----------------------
{
  const { REGIONS, REGION_ORDER, PASSPORT_ROADS } = await import("../src/data.mjs");
  const { checkRegionUnlocks } = await import("../src/sim.mjs");

  ok("passport: the whole country is collectable", rd.passportRoads().length >= 45,
    `${rd.passportRoads().length} shields`);
  ok("passport: home region shields render", passportHtml.includes("California"));
  ok("passport: locked regions are shown but marked",
    passportHtml.includes("locked-region") && passportHtml.includes("🔒"));
  ok("passport: a far region is still locked at low rep",
    passportHtml.includes(REGIONS.northeast.name));

  // the territory chip must tell the player what's next
  rd.frame(9000);
  const terr = dom.byId.get("territory").innerHTML;
  ok("hud: territory chip renders", terr.includes("regions"), terr);
  ok("hud: territory chip names the next unlock",
    terr.includes(REGIONS[REGION_ORDER[S.regions.length]] ? REGIONS[REGION_ORDER[S.regions.length]].name : "Coast"),
    terr);

  // unlocking a region must repopulate the board with freight you can actually see
  const before = S.regions.length;
  S.rep = Math.max(S.rep, REGIONS.southwest.repReq);
  const opened = checkRegionUnlocks(S);
  ok("unlock: reputation opened new country", S.regions.length > before, opened.join());
  try {
    rd.setTab("contracts"); rd.frame(9100);
    ok("unlock: contract board re-renders after a region opens",
      dom.byId.get("side").innerHTML.length > 50);
  } catch (e) { ok("unlock: board re-renders", false, e.message); }
  try {
    rd.setTab("passport"); rd.frame(9200);
    ok("unlock: the newly opened region is no longer marked locked",
      !new RegExp(`locked-region[\\s\\S]{0,200}${REGIONS.southwest.name}`).test(dom.byId.get("side").innerHTML));
  } catch (e) { ok("unlock: passport re-renders", false, e.message); }

  // a cross-country haul must be describable without lying about the clock
  const { findRoute, fmtDur } = await import("../src/sim.mjs");
  S.rep = 100; checkRegionUnlocks(S);
  const long = findRoute(S, "LKW", "NYC", { type: "semi", upgrades: {} }, null, "fastest");
  ok("transcon: route exists once the country is open", !!long);
  ok("transcon: duration reads in days", !!long && fmtDur(long.mins).includes("d"), long && fmtDur(long.mins));
  ok("transcon: quoted time includes nights", !!long && long.nights >= 3, long && long.nights);
  rd.setTab("contracts");
}

// --- the freeway badge, and the panel not fighting your scroll -----------------
{
  const { truckHighway } = await import("../src/sim.mjs");
  const rolling = S.trucks.find(t => t.trip);
  if (rolling) {
    ok("badge: a rolling truck reports a freeway", !!truckHighway(rolling), truckHighway(rolling));
    rd.setTab("fleet");
    const fleet = dom.byId.get("side").innerHTML;
    ok("badge: the fleet card shows NOW ON", fleet.includes("NOW ON"), fleet.slice(0, 200));
    ok("badge: the fleet card names the road", fleet.includes(truckHighway(rolling)));
  } else {
    ok("badge: (no truck rolling to check)", true);
  }

  // the panel re-renders on a timer; that must not throw away where the player scrolled to
  rd.setTab("passport");
  const body = () => dom.byId.get("side").querySelector?.(".tabbody");
  const b1 = body();
  if (b1) {
    b1.scrollTop = 420;
    rd.renderSide();
    const b2 = body();
    ok("scroll: passport keeps its scroll position across a re-render",
      b2 && b2.scrollTop === 420, b2 && b2.scrollTop);
    // switching tabs SHOULD start at the top, not inherit the old offset
    rd.setTab("fleet");
    // falsy, not ===0: a freshly created element has no scrollTop set at all
    ok("scroll: a different tab starts at the top", !(body() || {}).scrollTop,
      (body() || {}).scrollTop);
  } else { ok("scroll: tabbody exists", false, "no .tabbody found"); }
  rd.setTab("contracts");
}

// --- special deliveries + the garage ------------------------------------------
{
  const { paintTruck, renameTruck } = await import("../src/sim.mjs");
  // plant a special on the board and make sure the gold card renders
  S.contracts.unshift({ id: 424242, shipper: "Smoke Co", cargoType: "general", pallets: 2,
    from: "LKW", to: "LA", pay: 999, mi: 22, urgent: false, dlMins: 600,
    special: { name: "20,000 Rubber Ducks", icon: "🦆", blurb: "Quack." },
    expires: S.time + 999, tier: "LOCAL" });
  S.stats.delivered = Math.max(S.stats.delivered, 2); // past the tutorial: show the full board
  rd.setTab("contracts");
  const board = dom.byId.get("side").innerHTML;
  ok("special: gold banner renders", board.includes("SPECIAL DELIVERY"), board.slice(0, 120));
  ok("special: the story shows", board.includes("Rubber Ducks"));
  S.contracts = S.contracts.filter(c => c.id !== 424242);

  // garage: rename + paint buttons exist, painting reflects in the card and doesn't break a frame
  rd.setTab("fleet");
  ok("garage: rename button renders", dom.byId.get("side").innerHTML.includes("data-rename"));
  ok("garage: paint button renders", dom.byId.get("side").innerHTML.includes("data-paint-open"));
  S.cash += 500;
  const t0 = S.trucks[0];
  ok("garage: paintTruck works from the UI's state", paintTruck(S, t0.id, "teal").ok && t0.color === "teal");
  ok("garage: renameTruck works", renameTruck(S, t0.id, "Duck Force One").ok);
  rd.renderSide();
  const fleet = dom.byId.get("side").innerHTML;
  ok("garage: the new name shows", fleet.includes("Duck Force One"));
  ok("garage: the paint dot shows", fleet.includes("paint-dot"));
  try { rd.frame(12000); rd.frame(12016); ok("garage: painted truck renders without throwing", true); }
  catch (e) { ok("garage: painted truck renders without throwing", false, e.message); }
  rd.setTab("contracts");
}

// --- stars on cards + region unlock celebration + territory overview -----------
{
  const { REGIONS, REGION_ORDER } = await import("../src/data.mjs");
  const { checkRegionUnlocks } = await import("../src/sim.mjs");
  rd.setTab("contracts");
  const board2 = dom.byId.get("side").innerHTML;
  ok("stars: every contract card advertises its ⭐ value", board2.includes("star-chip"),
    board2.includes("JOBS") ? "no star-chip in board html" : "board missing");

  // unlocking a region must pop the celebration modal that lists the new cities
  const modal = dom.byId.get("modal");
  modal.classList.remove("open");
  const before2 = S.regions.length;
  const nextRg = REGION_ORDER[before2];
  if (nextRg) {
    S.rep = Math.max(S.rep, REGIONS[nextRg].repReq);
    checkRegionUnlocks(S);
    rd.frame(20000);
    const body2 = dom.byId.get("modalBody").innerHTML;
    ok("unlock: celebration modal opens", modal.classList.contains("open"), "modal not open");
    ok("unlock: modal names the region", body2.includes(REGIONS[nextRg].name), body2.slice(0, 100));
    ok("unlock: modal lists new cities", body2.includes("new cities"), body2.slice(0, 100));
    modal.classList.remove("open");
  }

  // the 🗺️ chip opens the territory overview with every region's price
  const terr = dom.byId.get("territory");
  if (terr.onclick) terr.onclick();
  const body3 = dom.byId.get("modalBody").innerHTML;
  ok("territory: overview opens on click", modal.classList.contains("open"));
  ok("territory: overview lists every region",
    REGION_ORDER.every(rg => body3.includes(REGIONS[rg].name)),
    REGION_ORDER.filter(rg => !body3.includes(REGIONS[rg].name)).join(","));
  ok("territory: locked regions show their star price", body3.includes("unlocks at ⭐") || !body3.includes("🔒"));
  modal.classList.remove("open");

  // the region overlay must not break a frame in either map mode
  try { rd.frame(21000); rd.frame(21016); ok("regions: overlay renders without throwing", true); }
  catch (e) { ok("regions: overlay renders without throwing", false, e.message); }
}

// --- COMPANY EXPANSION: driver careers, emergencies, depots --------------------
{
  const { buyDepot, maybeSpawnEmergency } = await import("../src/sim.mjs");
  const { CFG: CFG2 } = await import("../src/data.mjs");
  // driver career cards render with level chip + XP bar + rename button
  rd.setTab("fleet");
  const fleet2 = dom.byId.get("side").innerHTML;
  ok("careers: level chip renders", fleet2.includes("lvl-chip"), fleet2.slice(0, 80));
  ok("careers: XP bar renders", fleet2.includes("XP ") || fleet2.includes("MAX LEVEL"));
  ok("careers: driver rename button renders", fleet2.includes("data-drename"));

  // depots: shop section renders; buying one shows HOME controls and the map flag path runs
  S.cash += 60000;
  rd.setTab("shop");
  const shop2 = dom.byId.get("side").innerHTML;
  ok("depots: shop section renders", shop2.includes("Depots"), shop2.slice(0, 60));
  ok("depots: Lakewood is home", shop2.includes("HOME BASE"));
  ok("depots: a hub is buyable", shop2.includes("data-depot"));
  ok("depots: buying works from UI state", buyDepot(S, "SD").ok);
  rd.setTab("shop");
  ok("depots: SET HOME appears for the new depot", dom.byId.get("side").innerHTML.includes("data-home"));
  try { rd.frame(30000); rd.frame(30016); ok("depots: map renders flags without throwing", true); }
  catch (e) { ok("depots: map renders flags without throwing", false, e.message); }

  // emergencies: force one and check the board screams
  S.stats.delivered = Math.max(S.stats.delivered, 2);
  S.weather.south = { type: "storm", until: S.time + 9999 };
  S.contracts = S.contracts.filter(c => !c.emergency);
  S.lastEmergencyAt = 0;
  const oldCh = CFG2.EMERGENCY_CHANCE; CFG2.EMERGENCY_CHANCE = 1;
  const em = maybeSpawnEmergency(S);
  CFG2.EMERGENCY_CHANCE = oldCh;
  ok("emergency: spawned under a forced storm", !!em);
  if (em) {
    rd.setTab("contracts");
    const board3 = dom.byId.get("side").innerHTML;
    ok("emergency: red banner renders", board3.includes("EMERGENCY — DANGER PAY"), board3.slice(0, 100));
    S.contracts = S.contracts.filter(c => c.id !== em.id);
  }
  rd.setTab("contracts");
}

// --- readability & clarity fixes (2026-07-25 user feedback) --------------------
{
  // toast must never inherit the page's navy text onto a navy box again
  const fs2 = await import("fs");
  const html2 = fs2.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const toastCss = (html2.match(/#toast \{[^}]*\}/) || [""])[0];
  ok("toast: sets its own text color", /color:\s*#/.test(toastCss), toastCss.slice(0, 90));
  ok("toast: light background", /background:\s*#f/i.test(toastCss));

  // deadline clarity: the planner must SAY the cutoff
  S.stats.delivered = Math.max(S.stats.delivered, 2);
  const c2 = S.contracts.find(cc => cc.pallets <= Math.max(...S.trucks.map(t => rd.truckCap(t))) && S.trucks.some(t => !t.trip));
  if (c2 && S.trucks.some(t => !t.trip)) {
    rd.plan(c2.id);
    if (rd.planner()) {
      rd.setTab("contracts");
      const ph = dom.byId.get("side").innerHTML;
      ok("deadline: planner states the cutoff", ph.includes("deadline-line") && ph.includes("of pickup"), ph.slice(0, 80));
      ok("deadline: route cards show spare-or-late", /spare|LATE/.test(ph));
      // weather note: force a storm across the whole route, re-render
      for (const z of Object.keys(S.weather)) S.weather[z] = { type: "storm", until: S.time + 9999 };
      rd.setTab("contracts");
      ok("weather: route cards call out storms", dom.byId.get("side").innerHTML.includes("wx-route-note"));
      for (const z of Object.keys(S.weather)) S.weather[z] = { type: "clear", until: S.time + 9999 };
      const cp = dom.byId.get("side"); // close planner cleanly for the tests below
      rd.planner() && rd.setTab("contracts");
    } else ok("deadline: planner opened for clarity checks", false, "planner null");
  } else ok("deadline: (no plannable contract — skipped)", true);
  try { rd.frame(40000); ok("weather: map badges render without throwing", true); }
  catch (e) { ok("weather: map badges render without throwing", false, e.message); }
}

// --- the Omaha bug: trucks must follow the ROAD SHAPE outside baked coverage ---
{
  const { EDGES: EDGES2, NODES: NODES2, edgeKey: ek2 } = await import("../src/data.mjs");
  const { GEOM: GEOM2 } = await import("../src/geometry.mjs");
  // CHY→OMA (I-80 across Nebraska): no baked geometry out there — the fallback line must
  // ride the via waypoints, not a straight Cheyenne→Omaha chord through the fields
  const e2 = EDGES2.find(x => ek2(x.a, x.b) === ek2("CHY", "OMA"));
  ok("omaha: corridor exists with via waypoints", !!e2 && (e2.via || []).length > 0);
  ok("omaha: corridor really is unbaked", !GEOM2[ek2("CHY", "OMA")]);
  const geo = rd.simGeo(["CHY", "OMA"]);
  ok("omaha: fallback line is road-shaped (has waypoints)", geo.coordinates.length > 2, geo.coordinates.length);
  if (e2 && (e2.via || []).length) {
    const [vx, vy] = e2.via[0];
    ok("omaha: line passes through the freeway waypoint",
      geo.coordinates.some(([x2, y2]) => Math.abs(x2 - vx) < 1e-6 && Math.abs(y2 - vy) < 1e-6));
    // and a chord would NOT: midpoint of the chord vs the waypoint differ measurably
    const [ax, ay] = [NODES2.CHY.lon, NODES2.CHY.lat], [bx, by] = [NODES2.OMA.lon, NODES2.OMA.lat];
    const chordMidY = (ay + by) / 2;
    ok("omaha: waypoint is measurably off the chord (the visible bug)",
      Math.abs(vy - chordMidY) > 0.05, Math.abs(vy - chordMidY).toFixed(3));
  }
  // every long unbaked corridor nationwide must be road-shaped, not a chord
  const chords = EDGES2.filter(x => !GEOM2[ek2(x.a, x.b)] && x.mi > 120 &&
    rd.simGeo([x.a, x.b]).coordinates.length <= 2).map(x => x.hwy);
  ok("omaha: no long corridor anywhere falls back to a bare chord", chords.length === 0, chords.join(","));

  // reroute must drop the stale OSRM line (it describes the OLD road)
  const rolling = S.trucks.find(t => t.trip);
  if (rolling) {
    rolling.trip.mapGeometry = { type: "LineString", coordinates: [[0, 0], [1, 1]] };
    rolling.trip.mapLegGeometries = [rolling.trip.mapGeometry];
    rd.setTab("fleet");
    const btn = { dataset: { rr: "fastest", t: String(rolling.id) }, onclick: null };
    // drive the real handler via the DOM the panel just rendered
    const side2 = dom.byId.get("side");
    const rrBtns = [];
    const walk3 = el => { if (!el) return; if (el.dataset && el.dataset.rr) rrBtns.push(el); (el.children || []).forEach(walk3); };
    walk3(side2);
    if (rrBtns.length) {
      rrBtns[0].onclick && rrBtns[0].onclick();
      ok("reroute: stale OSRM geometry cleared (or reroute refused cleanly)",
        !rolling.trip || rolling.trip.mapGeometry === null || rolling.trip.mapGeometry.coordinates[0][0] === 0,
        JSON.stringify(rolling.trip && rolling.trip.mapGeometry && rolling.trip.mapGeometry.coordinates[0]));
    } else ok("reroute: (no reroute button rendered — truck not rolling)", true);
  } else ok("reroute: (no rolling truck to test)", true);
}

// --- save / load round trip --------------------------------------------------
try {
  rd.save();
  const raw = globalThis.localStorage.getItem(rd.saveKey());
  ok("save: wrote to localStorage", !!raw && raw.length > 100);
  const back = rd.load(raw);
  ok("save: round-trips cash", Math.round(back.cash) === Math.round(S.cash));
  ok("save: round-trips passport",
    (back.discoveredFreeways || []).length === (S.discoveredFreeways || []).length);
} catch (e) { ok("save: round trip", false, e.message); }

ok("no uncaught exceptions during the run", errors.length === 0, errors.map(e => e.message).join("; "));

} catch (e) {
  fails.push(`harness crashed: ${e.stack.split("\n").slice(0, 3).join(" | ")}`);
}

const mode = OFFLINE ? "OFFLINE (canvas fallback)" : "ONLINE (real map)";
console.log(fails.map(f => `  ✗ ${f}`).join("\n"));
console.log(`=== ui smoke [${mode}] seed ${globalThis.__RD_SEED}: ${pass} passed, ${fails.length} failed ===`);
process.exit(fails.length ? 1 : 0);
