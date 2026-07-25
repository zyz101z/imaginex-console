// FREIGHT NATION — browser UI layer (real map + offline atlas + panels). Game logic lives in sim.mjs.
import { NODES, EDGES, edgeKey, TRUCK_TYPES, UPGRADES, CARGO, CFG, WEATHER, EVENT_DEFS,
  REGIONS, REGION_ORDER, PASSPORT_ROADS, SHIELD_REGIONS, parseHighways, PAINT_COLORS,
  STATE_REGIONS, REGION_COLORS, REGION_LABELS } from "./data.mjs";
import { newGame, tick, routeOptions, findRoute, assign, reroute, forceEvent, autoPlanStops,
  serialize, deserialize, buyTruck, sellTruck, buyUpgrade, repairTruck, hireDriver,
  renameTruck, paintTruck, truckPaint,
  fmtClock, fmtDur, dayOf, isRush, truckPos, truckHighway, truckShields, eventsOn, edgeClosed,
  edgeOf, tankOf, zoneWeather,
  tzOf, tzName, localClock, edgeTz, cityUnlocked, unlockedRegions, nextRegion,
  truckRange, longestLeg, pathInRange, repForTier } from "./sim.mjs";
import * as GEO from "./geometry.mjs"; // baked real OSM centerlines, full network, state boundary
import * as ATLAS from "./states.mjs"; // baked lower-48 outlines — the offline map's landmass
const GEOM = GEO.GEOM || {}, CA_SHAPE = GEO.CA_SHAPE, NETWORK = GEO.NETWORK || null;
const STATES = ATLAS.STATES || {};

const $ = s => document.querySelector(s);
let S = null;
let selTruckId = null, activeTab = "contracts";
let paintOpenId = null;      // fleet card whose paint swatches are expanded
let contractSort = "nearby";
let planner = null;         // { contract, truckId, driverId, opts, choice, plan, avoid:Set }
let pendingReports = [];    // reports queued for modal display
let shownReports = 0;
let cam = { x: 0, y: 0, z: 1 };
const RATE = { 0: 0, 1: 1.6, 4: 6.5, 16: 26 }; // game-min per real-sec
const adventureMode = () => S && S.stats.delivered < 2;
const featuredContract = () => {
  if (!S) return null;
  return rankedContracts()[0]?.contract || S.contracts[0];
};
let realMap = null, realMapReady = false, realRouteDrag = false;
let lastRealMapUpdate = 0;
const truckMarkers = new Map();
const stopMarkers = new Map();
let followTruckMode = false, inspectRoadMode = false;
// PASSPORT_ROADS is derived from the road graph in data.mjs — never re-list it here, or the
// panel and the sim's stamping rules drift apart the moment someone adds a corridor.

// ---------------------------------------------------------------- boot / save
function boot() {
  const raw = localStorage.getItem(CFG.SAVE_KEY);
  if (raw) { try { S = deserialize(raw); } catch (e) { S = null; } }
  // __RD_SEED lets the headless harness replay an exact game; players always get a fresh one.
  if (!S) S = newGame(window.__RD_SEED ?? ((Math.random() * 2 ** 31) | 0));
  shownReports = S.reports.length;
  initRealMap();
  requestAnimationFrame(frame);
  setInterval(() => save(), 30000);
  document.addEventListener("visibilitychange", () => save());
}
const save = () => { try { localStorage.setItem(CFG.SAVE_KEY, serialize(S)); } catch (e) {} };

// ---------------------------------------------------------------- projection
// Flat lon/lat scaled to the LOWER 48 (was one state). PXD is degrees→pixels; 0.82 is a
// rough cos(latitude) squash so the country isn't stretched sideways. MAP_W/MAP_H are the
// full national extent in those pixels — the camera centres on them.
const LON0 = -125.5, LAT1 = 49.8, PXD = 30;
const px = lon => (lon - LON0) * PXD * 0.82;
const py = lat => (LAT1 - lat) * PXD;
const MAP_W = px(-66.5), MAP_H = py(24.2);   // ~1451 × 768
const HOME_VIEW = { lon: -119.6, lat: 36.5, z: 3.6 }; // opens on California, where truck #1 lives
// Keep the point at the centre of the screen inside the country, so panning can't sail off
// into blank ocean. Mirrors `maxBounds` on the live map.
function clampCam(fit) {
  const k = fit * cam.z;
  const limX = k * MAP_W / 2, limY = k * MAP_H / 2;
  cam.x = Math.max(-limX, Math.min(limX, cam.x));
  cam.y = Math.max(-limY, Math.min(limY, cam.y));
}
const nodeXY = id => [px(NODES[id].lon), py(NODES[id].lat)];
// road geometry: baked real OSM centerlines when available; hand `via` waypoints as fallback.
// Baked lines are stored in the edge's own a→b orientation (the bake iterates EDGES).
const EPTS = new Map();
function edgePts(e) {
  const kk = edgeKey(e.a, e.b);
  if (!EPTS.has(kk)) {
    const baked = GEOM && GEOM[kk];
    EPTS.set(kk, baked
      ? baked.map(([lo, la]) => [px(lo), py(la)])
      : [nodeXY(e.a), ...(e.via || []).map(([lo, la]) => [px(lo), py(la)]), nodeXY(e.b)]);
  }
  return EPTS.get(kk);
}
const findEdgeAB = (a, b) => EDGES.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
// full-network base layer: every highway's COMPLETE real line, projected once
const NET_LAYER = NETWORK ? Object.entries(NETWORK).map(([name, hw]) => {
  const segs = hw.segs.map(sg => sg.map(([lo, la]) => [px(lo), py(la)]));
  const lens = segs.map(sg => { let L = 0; for (let i = 0; i < sg.length - 1; i++) L += Math.hypot(sg[i + 1][0] - sg[i][0], sg[i + 1][1] - sg[i][1]); return L; });
  return { name, bg: !!hw.bg, segs, lens,
    col: name.startsWith("I-") ? "#2b5cab" : name.startsWith("US-") ? "#5a6672" : "#2e7d32" };
}) : null;
function tracePath(ctx, pts) { pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); }
const geoGap = (a, b) => Math.hypot((a[0] - b[0]) * 55, (a[1] - b[1]) * 69);
function roadParts(pts) {
  let first = 0, last = pts.length - 1;
  const connectors = [];
  // Baked geometry includes exact city-center endpoints. When the freeway is miles away,
  // render that honest last-mile connection differently instead of inventing a freeway.
  if (pts.length > 2 && geoGap(GEOtoLonLat(pts[0]), GEOtoLonLat(pts[1])) > 2) {
    connectors.push([pts[0], pts[1]]); first = 1;
  }
  if (pts.length > 2 && geoGap(GEOtoLonLat(pts.at(-2)), GEOtoLonLat(pts.at(-1))) > 2) {
    connectors.push([pts.at(-2), pts.at(-1)]); last--;
  }
  return { core: pts.slice(first, last + 1), connectors };
}
const GEOtoLonLat = p => [p[0] / (PXD * .82) + LON0, LAT1 - p[1] / PXD];
// the landmass, projected once: rings of [x,y] per state
const STATE_RINGS = Object.entries(STATES).map(([name, rings]) =>
  ({ name, rings: rings.map(r => r.map(([lo, la]) => [px(lo), py(la)])) }));
const STATE_TO_REGION = {};
for (const [rg, names] of Object.entries(STATE_REGIONS)) for (const nm of names) STATE_TO_REGION[nm] = rg;
function alongPoly(pts, frac) {
  const segs = [];
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(d); L += d;
  }
  let target = Math.max(0, Math.min(1, frac)) * L;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] > 0 ? target / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
}
// ---------------------------------------------------------------- main loop
let lastT = 0, acc = 0, lastHUD = 0, lastSideUI = 0, sideLockUntil = 0, lastSideScroll = 0;
const sideScrolling = () => performance.now() - lastSideScroll < 1200;
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000 || 0);
  lastT = t;
  if (!S.gameOver) {
    acc += dt * RATE[S.speed];
    const whole = Math.floor(acc);
    if (whole > 0) { acc -= whole; tick(S, whole); }
  }
  // celebrate territory: a region unlock is a big deal — show what it actually opened
  if (knownRegionCount == null) knownRegionCount = (S.regions || []).length;
  if ((S.regions || []).length > knownRegionCount && !$("#modal").classList.contains("open")) {
    const fresh = (S.regions || []).slice(knownRegionCount);
    knownRegionCount = S.regions.length;
    showRegionUnlock(fresh);
  }
  // surface new trip reports as modals
  if (S.reports.length !== shownReports && !$("#modal").classList.contains("open")) {
    const fresh = S.reports.slice(0, Math.max(0, S.reports.length - shownReports));
    shownReports = S.reports.length;
    if (fresh[0]) { renderSide(); showReport(fresh[0]); }
  }
  if (!realMap && followTruckMode) focusTruck(); // the live map follows via updateRealMap()
  drawMap();
  if (t - lastHUD > 250) { lastHUD = t; renderHUD(); }
  const side = $("#side");
  // Touch devices have no :hover, so sideLockUntil (set on pointer/touch) is the only signal
  // that the player is reading the panel. The passport used to be excluded here, which is
  // exactly why it fought back when you scrolled it on a phone.
  const playerUsingSide = side &&
    (side.matches(":hover") || performance.now() < sideLockUntil || sideScrolling());
  if (!playerUsingSide && t - lastSideUI > 900) { lastSideUI = t; renderSide(); }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- map rendering
const canvas = () => $("#mapCanvas");
function drawMap() {
  if (realMap) {
    const now = performance.now();
    if (now - lastRealMapUpdate > 100) { lastRealMapUpdate = now; updateRealMap(); }
    return;
  }
  const cv = canvas(); if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width = cv.clientWidth * devicePixelRatio;
  const H = cv.height = cv.clientHeight * devicePixelRatio;
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = cv.clientWidth, h = cv.clientHeight;
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, "#8ed6f2"); ocean.addColorStop(1, "#4da9d2");
  ctx.fillStyle = ocean; ctx.fillRect(0, 0, w, h); // pacific
  const fit = Math.min(w / MAP_W, h / MAP_H);
  if (!cam.init) { // open on your home region (dblclick = zoom out to the whole country)
    cam.init = true; cam.z = HOME_VIEW.z;
    cam.x = -(px(HOME_VIEW.lon) - MAP_W / 2) * fit * cam.z;
    cam.y = -(py(HOME_VIEW.lat) - MAP_H / 2) * fit * cam.z;
  }
  clampCam(fit); // same fence as the live map: you can't wander off the country
  // k = world→screen scale. s converts a desired SCREEN size into world units, so roads,
  // labels and icons stay the same size on screen at every zoom — zooming spreads the
  // geography instead of fattening the ink (this is what makes the LA tangle readable).
  const k = fit * cam.z, s = 1 / k;
  // ink growth: roads/trucks swell gently as you zoom (capped), text stays constant-size
  const g = Math.min(2.2, Math.pow(Math.max(1, cam.z), 0.4));   // roads
  const tg = Math.min(2.3, Math.pow(Math.max(1, cam.z), 0.55)); // trucks
  const ts = 20 * tg; // truck icon screen px
  ctx.translate(cam.x + w / 2, cam.y + h / 2);
  ctx.scale(k, k);
  ctx.translate(-MAP_W / 2, -MAP_H / 2);
  // The landmass: real lower-48 state outlines (tools/bake_states.mjs). Drawing the states
  // individually — rather than one national silhouette — means the borders you cross on a
  // cross-country haul are actually on the map.
  const land = ctx.createLinearGradient(0, 0, 0, MAP_H);
  land.addColorStop(0, "#8fcf79"); land.addColorStop(0.55, "#c2dc82"); land.addColorStop(1, "#e8ca78");
  const traceRings = st => {
    for (const ring of st.rings) { ctx.moveTo(ring[0][0], ring[0][1]); tracePath(ctx, ring); ctx.closePath(); }
  };
  if (STATE_RINGS.length) {
    ctx.beginPath();
    for (const st of STATE_RINGS) traceRings(st);
    ctx.fillStyle = land; ctx.fill("evenodd");
    ctx.strokeStyle = "#ffffffcc"; ctx.lineWidth = 1.2 * s; ctx.stroke(); // state lines
    ctx.beginPath();
    for (const st of STATE_RINGS) traceRings(st);
    ctx.strokeStyle = "#6f9c6a"; ctx.lineWidth = 0.5 * s; ctx.stroke();
  } else if (CA_SHAPE && CA_SHAPE.length > 10) { // atlas missing: at least draw home
    ctx.beginPath();
    CA_SHAPE.forEach(([lo, la], i) => i ? ctx.lineTo(px(lo), py(la)) : ctx.moveTo(px(lo), py(la)));
    ctx.closePath(); ctx.fillStyle = land; ctx.fill();
  }
  // REGION LAYER: the territory ladder, visible. Unlocked regions wear their color at a
  // whisper; locked regions sit under gray — the map itself says "not yours yet".
  if (STATE_RINGS.length) {
    const open = new Set(unlockedRegions(S));
    for (const st of STATE_RINGS) {
      const rg = STATE_TO_REGION[st.name];
      if (!rg) continue;
      const owned = open.has(rg);
      ctx.beginPath(); traceRings(st);
      ctx.fillStyle = owned ? REGION_COLORS[rg] : "#5c6a72";
      ctx.globalAlpha = owned ? 0.13 : 0.24;
      ctx.fill("evenodd");
      ctx.globalAlpha = 1;
    }
  }
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const drawShield = (mx, my, short, col) => {
    ctx.font = `bold ${9 * s}px system-ui`;
    const tw = ctx.measureText(short).width + 8 * s;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(mx - tw / 2, my - 7 * s, tw, 13 * s, 4 * s); ctx.fill();
    ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1 * s; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.fillText(short, mx, my + 3 * s);
    ctx.textAlign = "left";
  };
  if (NET_LAYER) {
    // BASE LAYER: the real freeway network, complete — this IS the map.
    for (const hw of NET_LAYER) {
      const major = hw.name.startsWith("I-");
      for (const sg of hw.segs) {
        ctx.beginPath(); tracePath(ctx, sg);
        ctx.lineWidth = (hw.bg ? 4 : major ? 6.5 : 5) * s * g;
        ctx.strokeStyle = "#eaf3df"; ctx.stroke();
        ctx.beginPath(); tracePath(ctx, sg);
        ctx.lineWidth = (hw.bg ? 1.8 : major ? 3.6 : 2.8) * s * g;
        ctx.strokeStyle = hw.bg ? "#91a99d" : major ? "#708b8d" : "#7e9a80";
        ctx.stroke();
      }
    }
    // STATUS OVERLAY: game corridors surface only when something is happening on them
    for (const e of EDGES) {
      const evs = eventsOn(S, e);
      const closed = edgeClosed(S, e);
      const slowed = evs.length > 0 || (e.urban && isRush(S.time, edgeTz(e)));
      const avoided = planner && planner.avoid.has(edgeKey(e.a, e.b));
      if (!closed && !slowed && !avoided) continue;
      ctx.beginPath(); tracePath(ctx, edgePts(e));
      ctx.lineWidth = 3.6 * s * g;
      ctx.strokeStyle = closed ? "#e0392b" : avoided ? "#ff5544" : "#e8a13a";
      if (avoided && !closed) ctx.setLineDash([5 * s, 5 * s]);
      ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    // shields: screen-space, collision-aware. One per freeway guaranteed when visible;
    // repeats spaced ~300px apart along long highways; nothing overlaps anything.
    const onScreen = (x, y) => {
      const sx = (x - 380) * k + w / 2 + cam.x, sy = (y - 400) * k + h / 2 + cam.y;
      return sx > 8 && sx < w - 8 && sy > 8 && sy < h - 8;
    };
    const placed = []; // [wx, wy, name]
    const clear = (x, y, name) => !placed.some(p =>
      Math.hypot(p[0] - x, p[1] - y) < (p[2] === name ? 300 : 36) * s);
    for (const hw of NET_LAYER) {
      if (hw.bg && cam.z < 2.2) continue;
      let count = 0;
      const cap = hw.bg ? 1 : 4;
      for (let i = 0; i < hw.segs.length && count < cap; i++) {
        const nS = Math.max(1, Math.round(hw.lens[i] * k / 340));
        for (let t = 0; t < nS && count < cap; t++) {
          const [mx, my] = alongPoly(hw.segs[i], (t + 0.5) / nS);
          if (!onScreen(mx, my) || !clear(mx, my, hw.name)) continue;
          drawShield(mx, my, hw.name, hw.col);
          placed.push([mx, my, hw.name]);
          count++;
        }
      }
      // guarantee: a visible major freeway always shows its name at least once
      if (!count && !hw.bg) {
        outer: for (let i = 0; i < hw.segs.length; i++) {
          for (const frac of [0.5, 0.3, 0.7, 0.15, 0.85]) {
            const [mx, my] = alongPoly(hw.segs[i], frac);
            if (!onScreen(mx, my)) continue;
            if (!placed.some(p => Math.hypot(p[0] - mx, p[1] - my) < 20 * s)) {
              drawShield(mx, my, hw.name, hw.col);
              placed.push([mx, my, hw.name]);
              break outer;
            }
          }
        }
      }
    }
  } else {
    // fallback (no baked network): draw game edges directly
    for (const e of EDGES) {
      const pts = edgePts(e);
      const closed = edgeClosed(S, e);
      const slowed = eventsOn(S, e).length > 0 || (e.urban && isRush(S.time, edgeTz(e)));
      const wMajor = e.hwy.startsWith("I-");
      ctx.beginPath(); tracePath(ctx, pts);
      ctx.lineWidth = (wMajor ? 7 : 5.5) * s * g;
      ctx.strokeStyle = "#eef5df"; ctx.stroke();
      ctx.beginPath(); tracePath(ctx, pts);
      ctx.lineWidth = (wMajor ? 4 : 3) * s * g;
      ctx.strokeStyle = closed ? "#e0392b" : slowed ? "#e8a13a" : wMajor ? "#708b8d" : "#7e9a80";
      ctx.stroke();
      if (e.mi * k > 55 || e.mi >= 60) {
        const [mx, my] = alongPoly(pts, e.mi < 30 ? 0.63 : 0.5);
        const short = e.hwy.split(" ")[0];
        drawShield(mx, my, short, short.startsWith("I-") ? "#2b5cab" : short.startsWith("US-") ? "#5a6672" : "#2e7d32");
      }
    }
  }
  // toll + live-event markers sit on the game corridors (where the sim actually plays out)
  for (const e of EDGES) {
    const pts = edgePts(e);
    const evs = eventsOn(S, e);
    const [mx, my] = alongPoly(pts, e.mi < 30 ? 0.63 : 0.5);
    if (e.toll) {
      ctx.fillStyle = "#ffd75e"; ctx.font = `bold ${9 * s}px monospace`;
      ctx.fillText("$" + e.toll, mx + 8 * s, my - 9 * s);
    }
    if (evs.length) {
      ctx.font = `${16 * s}px serif`;
      ctx.fillText(EVENT_DEFS[evs[0].type].icon, mx - 8 * s, my - 8 * s);
    }
  }
  // planned route highlight
  const selTruck = S.trucks.find(t => t.id === selTruckId);
  const hlPath = planner && planner.opts[planner.choice] ? planner.opts[planner.choice].path
    : (selTruck && selTruck.trip ? selTruck.trip.legs[selTruck.trip.legIdx].path.slice(selTruck.trip.edgeIdx) : null);
  if (hlPath) {
    const localLinks = [];
    ctx.beginPath();
    for (let i = 0; i < hlPath.length - 1; i++) {
      const e = findEdgeAB(hlPath[i], hlPath[i + 1]);
      if (e) {
        const parts = roadParts(edgePts(e));
        if (parts.core.length > 1) tracePath(ctx, parts.core);
        localLinks.push(...parts.connectors);
      }
    }
    ctx.strokeStyle = "#097dc1"; ctx.lineWidth = 9 * s * g; ctx.globalAlpha = 0.78; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.setLineDash([2 * s, 13 * s]); ctx.lineDashOffset = -(lastT / 45) * s;
    ctx.strokeStyle = "#d8f6ff"; ctx.lineWidth = 2.5 * s * g; ctx.stroke();
    ctx.setLineDash([]);
    if (localLinks.length) {
      ctx.beginPath(); localLinks.forEach(p => tracePath(ctx, p));
      ctx.setLineDash([5 * s, 5 * s]); ctx.strokeStyle = "#315f75";
      ctx.lineWidth = 3 * s; ctx.globalAlpha = .8; ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  if (planner && planner.dragPoint) {
    const [x, y] = planner.dragPoint;
    ctx.beginPath(); ctx.arc(x, y, 13 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#fff4a8"; ctx.fill();
    ctx.strokeStyle = "#e38b18"; ctx.lineWidth = 3 * s; ctx.stroke();
    ctx.font = `${15 * s}px serif`; ctx.fillText("📍", x - 8 * s, y + 5 * s);
  }
  // region labels: locked regions ALWAYS show name + the stars they cost (that's the
  // actionable info); unlocked names only at country zoom so they don't crowd the cities
  {
    const open = new Set(unlockedRegions(S));
    for (const rg of REGION_ORDER) {
      const owned = open.has(rg);
      if (owned && cam.z > 2.4) continue;
      const [lo, la] = REGION_LABELS[rg];
      const x = px(lo), y = py(la);
      const txt = owned ? REGIONS[rg].name.toUpperCase() : `🔒 ${REGIONS[rg].name} · ⭐${REGIONS[rg].repReq}`;
      ctx.font = `bold ${11 * s}px system-ui`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = owned ? "rgba(255,255,255,.82)" : "rgba(58,68,75,.88)";
      ctx.beginPath(); ctx.roundRect(x - tw / 2 - 6 * s, y - 9 * s, tw + 12 * s, 17 * s, 7 * s); ctx.fill();
      ctx.fillStyle = owned ? REGION_COLORS[rg] : "#ffe9a8";
      ctx.textAlign = "center";
      ctx.fillText(txt, x, y + 3.5 * s);
      ctx.textAlign = "left";
    }
  }
  // cities (label offsets keep the LA/OC tangle readable; small towns label-up on zoom)
  const LBL = { LA: [9, -7], LKW: [-62, 3], LGB: [-67, 15], ANA: [9, -2], SNA: [9, 14], RIV: [9, -4],
    SBD: [9, -11], SD: [9, 5], SB: [-84, -4], SLO: [-96, 0], SAL: [-48, -7], SJ: [9, 10],
    OAK: [9, -6], SF: [-86, -2], STK: [9, -2], SAC: [9, -4], RED: [9, 1], BAK: [9, 12], FRS: [9, 1] };
  for (const [id, n] of Object.entries(NODES)) {
    const [x, y] = nodeXY(id);
    // Cities in regions you haven't earned yet are drawn as faint ghosts: you can see the
    // country waiting for you, but it's clearly not open for business.
    const locked = !cityUnlocked(S, id);
    ctx.globalAlpha = locked ? 0.32 : 1;
    const mission = planner ? planner.contract : (adventureMode() ? featuredContract() : null);
    const isDestination = mission && id === mission.to;
    const isOrigin = mission && id === mission.from;
    if (isDestination) {
      const pulse = 13 + Math.sin(lastT / 180) * 3;
      ctx.beginPath(); ctx.arc(x, y, pulse * s, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,211,64,.28)"; ctx.fill();
      ctx.strokeStyle = "#f7a900"; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.font = `${18 * s}px serif`; ctx.fillText("⭐", x - 9 * s, y - 14 * s);
    } else if (isOrigin) {
      ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(60,169,219,.25)"; ctx.fill();
    }
    const rush = n.urban && isRush(S.time, tzOf(id)); // 5 PM where the CITY is, not where you are
    if (rush) {
      ctx.beginPath(); ctx.arc(x, y, (9 + Math.sin(lastT / 200) * 2) * s, 0, 7);
      ctx.strokeStyle = "rgba(255,150,40,.6)"; ctx.lineWidth = 2 * s; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, (n.tier >= 3 ? 6 : n.tier === 2 ? 5 : 4) * s, 0, 7);
    ctx.fillStyle = n.yard ? "#ffd75e" : n.tier >= 2 ? "#fff" : "#eaf6ea"; ctx.fill();
    ctx.strokeStyle = "#315b62"; ctx.lineWidth = 1.5 * s; ctx.stroke();
    // On a 66-city national map, labelling everything at once is a wall of text. Major hubs
    // and your own yard read at country view; the rest bloom in as you zoom into a region.
    const showLabel = n.yard || n.tier >= 3 || (n.tier >= 2 && cam.z >= 1.8) || cam.z >= 3;
    if (showLabel) {
      const [dx0, dy0] = LBL[id] || [9, 3];
      const dx = dx0 * s, dy = dy0 * s;
      ctx.font = `bold ${10 * s}px system-ui`;
      const tw = ctx.measureText(n.name).width;
      ctx.fillStyle = "rgba(255,253,240,.9)";
      ctx.beginPath(); ctx.roundRect(x + dx - 3 * s, y + dy - 9 * s, tw + 6 * s, 12 * s, 3 * s); ctx.fill();
      ctx.fillStyle = n.yard ? "#9d5a0b" : "#21475a";
      ctx.fillText(n.name, x + dx, y + dy);
      const w = zoneWeather(S, n.zone);
      if (w.icon) { ctx.font = `${10 * s}px serif`; ctx.fillText(w.icon, x + dx + tw + 6 * s, y + dy); }
    }
    ctx.globalAlpha = 1; // locked-city ghosting must not leak into the next city or the trucks
  }
  // trucks
  for (const tr of S.trucks) {
    let x, y;
    if (tr.trip) {
      const p = truckPos(tr.trip);
      const e = p.b ? findEdgeAB(p.a, p.b) : null;
      if (e) {
        const pts = edgePts(e);
        // orient the polyline so frac 0 = the node we departed
        [x, y] = alongPoly(e.a === p.a ? pts : [...pts].reverse(), p.frac);
      } else { [x, y] = nodeXY(p.a); }
    } else if (tr.at) { [x, y] = nodeXY(tr.at); y -= ts * 0.55 * s; }
    else continue;
    if (tr.id === selTruckId) {
      ctx.beginPath(); ctx.arc(x, y - 2 * s, ts * 0.75 * s, 0, 7);
      ctx.strokeStyle = "#5ec4ff"; ctx.lineWidth = 2 * s; ctx.stroke();
    }
    if (tr.trip && tr.trip.blocked && Math.floor(lastT / 400) % 2 === 0) {
      ctx.beginPath(); ctx.arc(x, y - 2 * s, ts * 0.85 * s, 0, 7);
      ctx.strokeStyle = "#e0392b"; ctx.lineWidth = 3 * s; ctx.stroke();
    }
    // soft shadow puck so the rig pops off the road
    ctx.beginPath(); ctx.ellipse(x, y + ts * 0.22 * s, ts * 0.42 * s, ts * 0.16 * s, 0, 0, 7);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
    const paint = truckPaint(tr);
    if (paint) { // the paint job: a colored ring around the rig
      ctx.beginPath(); ctx.arc(x, y - 2 * s, ts * 0.62 * s, 0, 7);
      ctx.strokeStyle = paint.hex; ctx.lineWidth = 3.5 * s; ctx.stroke();
    }
    ctx.font = `${ts * s}px serif`;
    ctx.fillText(TRUCK_TYPES[tr.type].icon, x - ts * 0.5 * s, y + ts * 0.25 * s);
    // the road it's on, pinned under the rig — same information the live map shows
    const hwy = truckHighway(tr);
    if (hwy) {
      const changed = justChangedHighway(tr.trip);
      const col = shieldClass(hwy) === "shield-i" ? "#2b5cab"
        : shieldClass(hwy) === "shield-us" ? "#4a5560" : "#2f8b4d";
      ctx.font = `bold ${9 * s}px system-ui`;
      const tw = ctx.measureText(hwy).width + 9 * s;
      const by = y + ts * 0.5 * s;
      ctx.fillStyle = changed ? "#f7a900" : col;
      ctx.beginPath(); ctx.roundRect(x - tw / 2, by, tw, 13 * s, 4 * s); ctx.fill();
      ctx.strokeStyle = changed ? "#7a4a00" : "#ffffff88";
      ctx.lineWidth = (changed ? 2 : 1) * s; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(hwy, x, by + 9.5 * s);
      ctx.textAlign = "left";
    }
    tr._px = x; tr._py = y; // for click hit-testing
  }
  ctx.restore();
}

// ---------------------------------------------------------------- real map (MapLibre + OpenFreeMap)
// The live map needs three things off the network: the library, the vector tiles and OSRM.
// Any of them can be missing (no wifi, blocked CDN, a school firewall), so every entry point
// into the real map falls back to the baked offline atlas rather than leaving a dead screen.
let canvasWired = false;
function useCanvasFallback(why) {
  if (!realMap && canvasWired) return;
  if (realMap) { try { realMap.remove(); } catch (e) {} }
  realMap = null; realMapReady = false;
  truckMarkers.clear(); stopMarkers.clear();
  document.body.classList.add("canvas-map");
  // Road Explorer reads labels off the live vector tiles, which the atlas doesn't have.
  const inspect = $("#inspectRoad");
  if (inspect) { inspect.disabled = true; inspect.title = "Needs the live map"; inspect.style.opacity = ".45"; }
  inspectRoadMode = false;
  if (!canvasWired) { canvasWired = true; wireCanvas(); }
  if (why) console.warn("Falling back to the offline atlas:", why);
}
function initRealMap() {
  if (!window.maplibregl) return useCanvasFallback("maplibre-gl did not load");
  try {
    realMap = new window.maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    // Open on the home region rather than the whole country: a first-time player needs to
    // see their own truck, not a continent. The map zooms out as their runs get longer.
    center: [-118.02, 33.91],
    zoom: 7.2,
    maxZoom: 15,
    // Fence the map to the country the game is set in. Without this you can drag off to the
    // Atlantic or Siberia, which is just distraction — there's no freight out there.
    // A little slack past the borders so coastal cities aren't jammed against the edge.
    maxBounds: [[-127.5, 22.0], [-64.5, 51.5]],
    minZoom: 3,
    attributionControl: true
  });
  realMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  realMap.on("load", () => {
    realMapReady = true;
    // territory layer FIRST so routes, missions and trucks all stack above it
    try {
      realMap.addSource("regions", { type: "geojson", data: regionsGeo() });
      realMap.addLayer({ id: "region-fill", type: "fill", source: "regions",
        paint: { "fill-color": ["case", ["==", ["get", "locked"], 1], "#5c6a72", ["get", "color"]],
                 "fill-opacity": ["case", ["==", ["get", "locked"], 1], 0.20, 0.09] } });
      realMap.addLayer({ id: "region-line", type: "line", source: "regions",
        paint: { "line-color": ["get", "color"], "line-opacity": 0.35, "line-width": 1.4 } });
      realMap.addSource("region-labels", { type: "geojson", data: regionLabelsGeo() });
      realMap.addLayer({ id: "region-label", type: "symbol", source: "region-labels",
        layout: { "text-field": ["get", "label"], "text-size": 13,
                  "text-font": ["Noto Sans Bold", "Noto Sans Regular"], "text-allow-overlap": false },
        paint: { "text-color": ["case", ["==", ["get", "locked"], 1], "#3a444b", ["get", "color"]],
                 "text-halo-color": "#ffffff", "text-halo-width": 1.6 } });
    } catch (e) { console.warn("region layer skipped:", e); }
    realMap.addSource("game-route", { type: "geojson", data: emptyGeo() });
    realMap.addSource("pickup-route", { type: "geojson", data: emptyGeo() });
    realMap.addLayer({ id: "pickup-route-glow", type: "line", source: "pickup-route",
      paint: { "line-color": "#fff", "line-width": 9, "line-opacity": .75 } });
    realMap.addLayer({ id: "pickup-route-line", type: "line", source: "pickup-route",
      paint: { "line-color": "#e58a19", "line-width": 5, "line-opacity": .9, "line-dasharray": [2, 2] } });
    realMap.addLayer({ id: "game-route-glow", type: "line", source: "game-route",
      paint: { "line-color": "#fff", "line-width": 12, "line-opacity": .8 } });
    realMap.addLayer({ id: "game-route-line", type: "line", source: "game-route",
      paint: { "line-color": "#087fc2", "line-width": 7, "line-opacity": .95 } });
    realMap.addSource("game-missions", { type: "geojson", data: emptyGeo() });
    realMap.addLayer({ id: "mission-halo", type: "circle", source: "game-missions",
      paint: { "circle-radius": ["case", ["==", ["get", "role"], "destination"], 18, 10],
        "circle-color": ["case", ["==", ["get", "role"], "destination"], "#ffd23f", "#45a9dd"],
        "circle-opacity": .38, "circle-stroke-width": 3, "circle-stroke-color": "#fff" } });
    realMap.addLayer({ id: "mission-label", type: "symbol", source: "game-missions",
      layout: { "text-field": ["get", "label"], "text-size": 16, "text-offset": [0, -1.7],
        "text-anchor": "bottom", "text-font": ["Noto Sans Regular"] },
      paint: { "text-color": "#17384c", "text-halo-color": "#fff", "text-halo-width": 2 } });
    wireRealMap();
    updateRealMap();
  });
    realMap.on("error", e => {
      if (!realMapReady) useCanvasFallback(e.error?.message || "map style failed");
    });
    // Tiles can hang rather than error outright; don't leave a player staring at grey.
    setTimeout(() => { if (!realMapReady) useCanvasFallback("map tiles timed out"); }, 12000);
  } catch (e) {
    useCanvasFallback(e.message);
  }
}
const emptyGeo = () => ({ type: "FeatureCollection", features: [] });
function wireRealMap() {
  // Reshaping the route is bound to both pointer families — the mouse-only version did
  // nothing on a tablet, which is where this game actually gets played.
  const beginRouteDrag = e => {
    if (!planner || planner.addingStopType) return;
    e.preventDefault?.();
    realRouteDrag = true;
    realMap.dragPan.disable();
    realMap.getCanvas().style.cursor = "crosshair";
  };
  const endRouteDrag = async e => {
    if (!realRouteDrag || !planner) return;
    realRouteDrag = false;
    realMap.dragPan.enable();
    realMap.getCanvas().style.cursor = "";
    const ll = e.lngLat || e.lngLats?.[0];
    if (!ll) return;
    addPlannerPoint("checkpoint", [ll.lng, ll.lat]);
    planner.loadingRealRoute = true;
    renderSide();
    replanRoutes();
    await refreshRealRoutes();
    renderSide();
  };
  realMap.on("mousedown", "game-route-line", beginRouteDrag);
  realMap.on("touchstart", "game-route-line", beginRouteDrag);
  realMap.on("mouseup", endRouteDrag);
  realMap.on("touchend", endRouteDrag);
  realMap.on("mouseenter", "game-route-line", () => {
    if (planner) realMap.getCanvas().style.cursor = "grab";
  });
  realMap.on("mouseleave", "game-route-line", () => {
    if (!realRouteDrag) realMap.getCanvas().style.cursor = "";
  });
  realMap.on("click", async e => {
    if (planner?.addingStopType) {
      const type = planner.addingStopType;
      planner.addingStopType = null;
      addPlannerPoint(type, [e.lngLat.lng, e.lngLat.lat]);
      planner.loadingRealRoute = true;
      renderSide();
      replanRoutes();
      await refreshRealRoutes();
      return;
    }
    if (inspectRoadMode) inspectRoadAt(e.point);
  });
  realMap.on("dragstart", () => {
    if (followTruckMode) {
      followTruckMode = false;
      $("#followTruck").classList.remove("active");
    }
  });
}
function inspectRoadAt(point) {
  const features = realMap.queryRenderedFeatures(point).filter(f => f.layer?.type === "line");
  for (const f of features) {
    const refs = String(f.properties?.ref || "").split(";").map(normalizeRoadRef).filter(Boolean);
    const name = refs[0] || f.properties?.name || f.properties?.name_en;
    if (name) {
      const kind = refs[0] ? "Freeway" : "Road";
      toast(`<b>🛣️ ${name}</b><br><span class="dim">${kind} explorer · click another road to keep looking</span>`);
      return;
    }
  }
  toast("No labeled road found there—try clicking closer to a road line.");
}
function nearestGameNode(coord) {
  let best = null, dist = Infinity;
  for (const [id, n] of Object.entries(NODES)) {
    const d = geoGap(coord, [n.lon, n.lat]);
    if (d < dist) { best = id; dist = d; }
  }
  return best;
}
function addPlannerPoint(type, coord) {
  if (!planner) return;
  planner.routePoints = [...(planner.routePoints || []), {
    id: planner.nextPointId++, type, coord, node: nearestGameNode(coord)
  }];
}
const lastPushed = { route: undefined, pickup: undefined, mission: undefined };
function updateRealMap() {
  if (!realMapReady) return;
  refreshRegionLayer(); // lifts the gray off newly unlocked territory
  const geometry = currentRealGeometry();
  if (geometry !== lastPushed.route) {
    lastPushed.route = geometry;
    realMap.getSource("game-route").setData(
      geometry ? { type: "Feature", properties: {}, geometry } : emptyGeo());
  }
  const pickupGeometry = currentPickupGeometry();
  if (pickupGeometry !== lastPushed.pickup) {
    lastPushed.pickup = pickupGeometry;
    realMap.getSource("pickup-route").setData(pickupGeometry
      ? { type: "Feature", properties: {}, geometry: pickupGeometry } : emptyGeo());
  }
  const mission = planner ? planner.contract : (adventureMode() ? featuredContract() : null);
  const missionKey = mission ? `${mission.from}>${mission.to}` : "";
  if (missionKey !== lastPushed.mission) {
    lastPushed.mission = missionKey;
    const missionFeatures = mission
      ? [pointFeature(mission.from, "origin", `📍 ${NODES[mission.from].name}`),
         pointFeature(mission.to, "destination", `⭐ ${NODES[mission.to].name}`)] : [];
    realMap.getSource("game-missions").setData({ type: "FeatureCollection", features: missionFeatures });
  }
  updateTruckMarkers();
  updateStopMarkers();
  if (followTruckMode) {
    const tr = S.trucks.find(t => t.id === selTruckId) || S.trucks[0];
    if (tr) realMap.setCenter(truckLngLat(tr));
  }
}
const pointFeature = (id, role, label) => ({ type: "Feature", properties: { role, label },
  geometry: { type: "Point", coordinates: [NODES[id].lon, NODES[id].lat] } });
function currentRealGeometry() {
  if (planner) {
    // Only the real route at THIS index may be drawn — falling back to realRoutes[0]
    // would paint a different road than the one the card describes.
    const card = chosenCard();
    if (!card) return null;
    return card.real ? card.real.geometry : simPathGeometry(card.opt.path);
  }
  const tr = S.trucks.find(t => t.id === selTruckId) || S.trucks.find(t => t.trip);
  if (tr && tr.trip) return tr.trip.mapLegGeometries?.[tr.trip.legIdx] ||
    tr.trip.mapGeometry || simPathGeometry(tr.trip.legs[tr.trip.legIdx].path);
  return null;
}
function currentPickupGeometry() {
  if (planner) return planner.realDeadhead?.geometry || null;
  return null;
}
// Memoised so repeat calls return the SAME object — updateRealMap leans on identity to
// skip re-uploading an unchanged multi-thousand-point line to the GPU ten times a second.
const simGeoCache = new Map();
function simPathGeometry(path) {
  const key = path.join(">");
  if (!simGeoCache.has(key)) simGeoCache.set(key, buildSimPathGeometry(path));
  return simGeoCache.get(key);
}
function buildSimPathGeometry(path) {
  const coordinates = [];
  for (let i = 0; i < path.length - 1; i++) {
    const e = findEdgeAB(path[i], path[i + 1]); if (!e) continue;
    let pts = (GEOM[edgeKey(e.a, e.b)] || [[NODES[e.a].lon, NODES[e.a].lat], [NODES[e.b].lon, NODES[e.b].lat]]);
    if (e.a !== path[i]) pts = [...pts].reverse();
    coordinates.push(...pts.slice(coordinates.length ? 1 : 0));
  }
  return { type: "LineString", coordinates };
}
// Colour the badge the way the real signs are: blue interstate, white US route, green state.
function shieldClass(hwy) {
  const first = (hwy ? parseHighways(hwy)[0] : "") || "";
  return first.startsWith("I-") ? "shield-i" : first.startsWith("US-") ? "shield-us" : "shield-st";
}
// "changed" stays true for a few game-minutes after the road name actually changes.
const justChangedHighway = T =>
  T.highwayChangedAt != null && S.time - T.highwayChangedAt <= CFG.HWY_FLASH_MIN;

// territory overlay data for the live map. Rebuilt whenever a region unlocks so the gray
// lifts off the new country the moment it's earned.
const closeRing = r => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]))
  ? [...r, r[0]] : r;
function regionsGeo() {
  const open = new Set(unlockedRegions(S));
  return { type: "FeatureCollection", features: Object.entries(STATES).flatMap(([name, rings]) => {
    const rg = STATE_TO_REGION[name];
    if (!rg) return [];
    return [{ type: "Feature",
      properties: { region: rg, color: REGION_COLORS[rg], locked: open.has(rg) ? 0 : 1 },
      geometry: { type: "MultiPolygon", coordinates: rings.map(r => [closeRing(r)]) } }];
  }) };
}
function regionLabelsGeo() {
  const open = new Set(unlockedRegions(S));
  return { type: "FeatureCollection", features: REGION_ORDER.map(rg => ({
    type: "Feature",
    properties: { locked: open.has(rg) ? 0 : 1, color: REGION_COLORS[rg],
      label: open.has(rg) ? REGIONS[rg].name.toUpperCase()
        : `LOCKED — ${REGIONS[rg].name} — ${REGIONS[rg].repReq} STARS` },
    geometry: { type: "Point", coordinates: REGION_LABELS[rg] } })) };
}
let lastRegionsKey = "";
function refreshRegionLayer() {
  if (!realMap || !realMapReady) return;
  const key = (S.regions || []).join(",");
  if (key === lastRegionsKey) return;
  lastRegionsKey = key;
  try {
    realMap.getSource("regions")?.setData(regionsGeo());
    realMap.getSource("region-labels")?.setData(regionLabelsGeo());
  } catch (e) {}
}

function updateTruckMarkers() {
  const live = new Set();
  for (const tr of S.trucks) {
    live.add(tr.id);
    let marker = truckMarkers.get(tr.id);
    if (!marker) {
      const el = document.createElement("div");
      el.className = "truck-marker";
      const rig = document.createElement("span");
      rig.className = "truck-rig"; rig.textContent = TRUCK_TYPES[tr.type].icon;
      const shield = document.createElement("span");
      shield.className = "truck-shield";
      el.appendChild(rig); el.appendChild(shield);
      el.title = tr.nick;
      el.onclick = () => { selTruckId = tr.id; activeTab = "fleet"; renderSide(); };
      marker = new window.maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(truckLngLat(tr)).addTo(realMap);
      truckMarkers.set(tr.id, marker);
    }
    marker.setLngLat(truckLngLat(tr));
    const el = marker.getElement();
    el.classList.toggle("selected", tr.id === selTruckId);
    // the paint job rides on the marker ring (selection still wins with its orange)
    const paint = truckPaint(tr);
    if (tr.id !== selTruckId) el.style.borderColor = paint ? paint.hex : "";
    // The road under the wheels, right on the truck — and a flash when it changes, so
    // switching from the 605 to the 5 is something you SEE rather than have to notice.
    const shieldEl = el.querySelector(".truck-shield");
    const hwy = truckHighway(tr);
    if (shieldEl) {
      const label = hwy || "";
      if (shieldEl.textContent !== label) shieldEl.textContent = label;
      shieldEl.classList.toggle("hidden", !label);
      shieldEl.classList.toggle("changed", !!tr.trip && justChangedHighway(tr.trip));
      shieldEl.className = shieldEl.className.replace(/ ?shield-(i|us|st)\b/g, "") + " " + shieldClass(hwy);
    }
  }
  for (const [id, marker] of truckMarkers) if (!live.has(id)) { marker.remove(); truckMarkers.delete(id); }
}
function updateStopMarkers() {
  const points = planner?.routePoints || [];
  const live = new Set(points.map(p => p.id));
  points.forEach((p, i) => {
    let marker = stopMarkers.get(p.id);
    if (!marker) {
      const el = document.createElement("div");
      el.className = `stop-marker ${p.type}`;
      el.innerHTML = `<span>${p.type === "fuel" ? "⛽" : p.type === "rest" ? "😴" : i + 1}</span>`;
      marker = new window.maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
        .setLngLat(p.coord).addTo(realMap);
      marker.on("drag", () => {
        const ll = marker.getLngLat(), current = planner?.routePoints.find(x => x.id === p.id);
        if (current) current.coord = [ll.lng, ll.lat];
      });
      marker.on("dragend", async () => {
        if (!planner) return;
        const ll = marker.getLngLat(), current = planner.routePoints.find(x => x.id === p.id);
        if (!current) return;
        current.coord = [ll.lng, ll.lat]; current.node = nearestGameNode(current.coord);
        replanRoutes(); renderSide(); await refreshRealRoutes();
      });
      stopMarkers.set(p.id, marker);
    }
    marker.setLngLat(p.coord);
    const span = marker.getElement().querySelector("span");
    span.textContent = p.type === "fuel" ? "⛽" : p.type === "rest" ? "😴" : String(i + 1);
  });
  for (const [id, marker] of stopMarkers) if (!live.has(id)) { marker.remove(); stopMarkers.delete(id); }
}
function truckLngLat(tr) {
  if (!tr.trip) return [NODES[tr.at].lon, NODES[tr.at].lat];
  const T = tr.trip, leg = T.legs[T.legIdx];
  const legGeometry = T.mapLegGeometries?.[T.legIdx] || (leg.loaded ? T.mapGeometry : null);
  if (legGeometry) {
    let done = 0, total = 0;
    for (let i = 0; i < leg.path.length - 1; i++) {
      const e = findEdgeAB(leg.path[i], leg.path[i + 1]); if (!e) continue;
      total += e.mi;
      if (i < T.edgeIdx) done += e.mi;
      else if (i === T.edgeIdx) done += T.posMi;
    }
    return alongCoordinates(legGeometry.coordinates, total ? done / total : 0);
  }
  const p = truckPos(T), e = p.b ? findEdgeAB(p.a, p.b) : null;
  if (!e) return [NODES[p.a].lon, NODES[p.a].lat];
  let pts = GEOM[edgeKey(e.a, e.b)] || [[NODES[e.a].lon, NODES[e.a].lat], [NODES[e.b].lon, NODES[e.b].lat]];
  if (e.a !== p.a) pts = [...pts].reverse();
  return alongCoordinates(pts, p.frac);
}
function alongCoordinates(coords, frac) {
  if (!coords || !coords.length) return [-118, 34];
  const lens = []; let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = geoGap(coords[i], coords[i + 1]); lens.push(d); total += d;
  }
  let target = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? target / lens[i] : 0;
      return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
    }
    target -= lens[i];
  }
  return coords.at(-1);
}

// canvas interaction: select trucks, toggle avoid-edges in planner, pan/zoom
function canvasToWorld(ev) {
  const cv = canvas(), r = cv.getBoundingClientRect();
  const w = cv.clientWidth, h = cv.clientHeight;
  const fit = Math.min(w / MAP_W, h / MAP_H);
  const x = (ev.clientX - r.left - cam.x - w / 2) / (fit * cam.z) + MAP_W / 2;
  const y = (ev.clientY - r.top - cam.y - h / 2) / (fit * cam.z) + MAP_H / 2;
  return [x, y];
}
function wireCanvas() {
  const cv = canvas();
  let drag = null;
  cv.addEventListener("mousedown", e => {
    const [wx, wy] = canvasToWorld(e);
    drag = { x: e.clientX, y: e.clientY, moved: false, route: planner && nearPlannedRoute(wx, wy, 12) };
  });
  window.addEventListener("mousemove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.route && drag.moved) {
      planner.dragPoint = canvasToWorld(e);
    } else {
      cam.x += dx; cam.y += dy;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });
  window.addEventListener("mouseup", e => {
    if (drag && drag.route && drag.moved) finishRouteDrag(e);
    else if (drag && !drag.moved) handleClick(e);
    drag = null;
  });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const w = cv.clientWidth, h = cv.clientHeight;
    const fit = Math.min(w / MAP_W, h / MAP_H);
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    // world point under the cursor stays put while zooming (map-app feel)
    const wx = (cx - cam.x - w / 2) / (fit * cam.z) + MAP_W / 2;
    const wy = (cy - cam.y - h / 2) / (fit * cam.z) + MAP_H / 2;
    cam.z = Math.max(0.7, Math.min(40, cam.z * (e.deltaY < 0 ? 1.16 : 0.86)));
    cam.x = cx - w / 2 - (wx - MAP_W / 2) * fit * cam.z;
    cam.y = cy - h / 2 - (wy - MAP_H / 2) * fit * cam.z;
  }, { passive: false });
  cv.addEventListener("dblclick", () => { // toggle your region ↔ the whole country
    if (cam.z > 1.2) { cam.z = 1; cam.x = 0; cam.y = 0; }
    else cam.init = false; // recompute home-region focus next frame
  });
}
function nearPlannedRoute(wx, wy, screenPx) {
  if (!planner || !planner.opts[planner.choice]) return false;
  const cv = canvas(), tol = screenPx / (Math.min(cv.clientWidth / MAP_W, cv.clientHeight / MAP_H) * cam.z);
  const path = planner.opts[planner.choice].path;
  for (let p = 0; p < path.length - 1; p++) {
    const e = findEdgeAB(path[p], path[p + 1]); if (!e) continue;
    const pts = edgePts(e);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((wx - x1) * (x2 - x1) + (wy - y1) * (y2 - y1)) / L2));
      if (Math.hypot(wx - x1 - (x2 - x1) * t, wy - y1 - (y2 - y1) * t) < tol) return true;
    }
  }
  return false;
}
function finishRouteDrag(ev) {
  if (!planner) return;
  const [wx, wy] = canvasToWorld(ev);
  const cv = canvas(), tol = 38 / (Math.min(cv.clientWidth / MAP_W, cv.clientHeight / MAP_H) * cam.z);
  let best = null, dist = Infinity;
  for (const [id] of Object.entries(NODES)) {
    if (id === planner.contract.from || id === planner.contract.to) continue;
    const [x, y] = nodeXY(id), d = Math.hypot(wx - x, wy - y);
    if (d < dist) { best = id; dist = d; }
  }
  planner.dragPoint = null;
  if (best && dist < tol) {
    planner.via = best;
    replanRoutes();
    toast(`📍 Route now goes through <b>${NODES[best].name}</b>.`);
    renderSide();
  } else {
    toast("Drop the route on a labeled city dot to use it as a waypoint.");
  }
}
function handleClick(ev) {
  const [wx, wy] = canvasToWorld(ev);
  const cv = canvas();
  const tol = 1 / (Math.min(cv.clientWidth / MAP_W, cv.clientHeight / MAP_H) * cam.z); // world units per screen px
  // truck? (hit radius tracks the grown icon size)
  const tgc = Math.min(2.3, Math.pow(Math.max(1, cam.z), 0.55));
  for (const tr of S.trucks) {
    if (tr._px != null && Math.hypot(tr._px - wx, tr._py - wy) < 16 * tgc * tol) {
      selTruckId = tr.id; activeTab = "fleet"; renderSide(); return;
    }
  }
  // edge? (planner avoid-toggle, or event inspect) — hit-test every segment of the real path
  for (const e of EDGES) {
    const pts = edgePts(e);
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1;
      const t = Math.max(0, Math.min(1, ((wx - x1) * (x2 - x1) + (wy - y1) * (y2 - y1)) / (L * L)));
      d = Math.min(d, Math.hypot(wx - (x1 + (x2 - x1) * t), wy - (y1 + (y2 - y1) * t)));
    }
    if (d < 8 * tol) {
      const k = edgeKey(e.a, e.b);
      if (planner) {
        if (planner.avoid.has(k)) planner.avoid.delete(k); else planner.avoid.add(k);
        replanRoutes();
        renderSide();
      } else {
        const evs = eventsOn(S, e);
        const info = evs.length
          ? evs.map(ev2 => `${EVENT_DEFS[ev2.type].icon} ${EVENT_DEFS[ev2.type].name} — clears ~${fmtClock(ev2.endsAt)} (${Math.max(0, Math.round((ev2.endsAt - S.time) / 60 * 10) / 10)}h)`).join("<br>")
          : "No incidents. " + (e.urban && isRush(S.time, edgeTz(e)) ? "🚗 Rush-hour congestion right now." : "Flowing normally.");
        toast(`<b>${e.hwy}</b> · ${NODES[e.a].name} ↔ ${NODES[e.b].name} · ${e.mi} mi · ${e.mph} mph${e.toll ? ` · toll $${e.toll}` : ""}${e.q <= 2 ? " · ⚠️ rough pavement" : ""}<br>${info}`);
      }
      return;
    }
  }
}

// A clock time alone is a lie on a multi-day haul — "4:15 PM" three days out reads as today.
const fmtWhen = t => dayOf(t) === dayOf(S.time) ? fmtClock(t) : `Day ${dayOf(t)} ${fmtClock(t)}`;

// ---------------------------------------------------------------- HUD
function renderHUD() {
  $("#cash").textContent = `$${Math.round(S.cash).toLocaleString()}`;
  $("#cash").className = S.cash < 0 ? "bad" : "";
  $("#rep").textContent = `⭐ ${S.rep}`;
  // On a national map the most motivating "next" is almost always the next slice of country.
  const nextRg = nextRegion(S);
  const next = nextRg ? `${REGIONS[nextRg].repReq} opens ${REGIONS[nextRg].name}`
    : S.rep < 50 ? "50 unlocks MEDICAL" : "elite carrier";
  $("#rep").title = `Gold stars (reputation). Earn them by delivering ON TIME — ` +
    `LOCAL +1, REGIONAL +2, LONG-HAUL +3, TRANSCON +4, specials +${CFG.SPECIAL_REP_BONUS} extra. ` +
    `Late costs 2, a failed delivery costs 6. Next: ${next}`;
  const terr = $("#territory");
  if (terr) {
    const open = unlockedRegions(S).length;
    terr.innerHTML = nextRg
      ? `🗺️ ${open}/${REGION_ORDER.length} regions · <b>⭐${REGIONS[nextRg].repReq}</b> opens ${REGIONS[nextRg].name}`
      : `🗺️ Coast to coast — all ${REGION_ORDER.length} regions open`;
    terr.title = nextRg ? REGIONS[nextRg].blurb : "The whole country is yours to run.";
  }
  // The dispatch office keeps home time; the country runs on four clocks, so say which one.
  $("#clock").innerHTML = `Day ${dayOf(S.time)} · <b>${fmtClock(S.time)}</b> <span class="dim">PT</span>` +
    `${isRush(S.time) ? ' <span class="rush">RUSH HOUR</span>' : ""}`;
  $("#clock").title = ["PT", "MT", "CT", "ET"]
    .map((z, i) => `${z} ${fmtClock(S.time + i * 60)}`).join("  ·  ");
  document.querySelectorAll("#speedCtl button").forEach(b => {
    b.classList.toggle("on", +b.dataset.s === S.speed);
    b.disabled = !!planner;
    b.title = planner ? "Time is paused while planning" : "";
  });
  const a = S.alerts[0];
  if (a) {
    $("#tickerLine").innerHTML = `<span class="dim">${fmtClock(a.at)}</span> ${a.msg}`;
    $("#tickerLine").className = "tickline " + a.kind;
  }
  if (S.gameOver) $("#tickerLine").innerHTML = "💀 BANKRUPT — press Reset to start a new company.";
}

// ---------------------------------------------------------------- side panel
function renderSide() {
  const el = $("#side");
  const tabList = adventureMode() ? ["contracts", "fleet", "passport"] : ["contracts", "fleet", "passport", "shop", "log"];
  if (!tabList.includes(activeTab)) activeTab = "contracts";
  const tabs = tabList.map(t =>
    `<button class="tab ${activeTab === t ? "on" : ""}" data-tab="${t}">${
      { contracts: "📋 JOBS", fleet: `🚚 FLEET (${S.trucks.length})`, passport: "🛣️ PASSPORT", shop: "🛒 SHOP", log: "📜 LOG" }[t]}</button>`).join("");
  let body = "";
  if (activeTab === "contracts") body = contractsHtml();
  else if (activeTab === "fleet") body = fleetHtml();
  else if (activeTab === "passport") body = passportHtml();
  else if (activeTab === "shop") body = shopHtml();
  else body = logHtml();
  // This panel re-renders on a timer, and replacing innerHTML resets the scroll box to the
  // top. On a long list (the 51-shield passport, a big fleet) that reads as the page yanking
  // itself back up every second — and on touch, where there's no :hover to pause it, it makes
  // the bottom of the list unreachable. Carry the scroll position across the rebuild.
  const prevBody = el.querySelector(".tabbody");
  const keepTab = prevBody && prevBody.dataset.tab === activeTab ? prevBody.scrollTop || 0 : 0;
  el.innerHTML = `<div class="tabs">${tabs}</div><div class="tabbody" data-tab="${activeTab}">${body}</div>`;
  if (keepTab) {
    const bodyEl = el.querySelector(".tabbody");
    if (bodyEl) bodyEl.scrollTop = keepTab;
  }
  el.querySelectorAll(".tab").forEach(b => b.onclick = () => { activeTab = b.dataset.tab; renderSide(); });
  wireSide(el);
}

function passportHtml() {
  reconcilePassport();
  const found = new Set(S.discoveredFreeways || []);
  const pct = Math.round(found.size / PASSPORT_ROADS.length * 100);
  const active = S.trucks.filter(t => t.trip).map(t => {
    const T = t.trip, leg = T.legs[T.legIdx];
    const here = leg.path[Math.min(T.edgeIdx, leg.path.length - 1)];
    const next = leg.path[Math.min(T.edgeIdx + 1, leg.path.length - 1)];
    const edge = here !== next ? findEdgeAB(here, next) : null;
    const roads = edge ? fallbackFreeways([here, next]) : [];
    return `${TRUCK_TYPES[t.type].icon} ${t.nick}: ${roads.length ? roads.join(", ") : edge?.hwy || "local roads"}`;
  });
  // 51 shields is too many for one flat wall — group them by the region they're earned in,
  // so the passport doubles as a map of where you've been and what country is still ahead.
  const open = unlockedRegions(S);
  const byRegion = REGION_ORDER.map(rg => ({
    rg,
    roads: PASSPORT_ROADS.filter(r => (SHIELD_REGIONS[r] || [])[0] === rg),
  })).filter(g => g.roads.length);
  const shieldHtml = r => {
    const cls = r.startsWith("US-") ? "us" : r.startsWith("I-") ? "interstate" : "ca";
    return `<div class="road-shield ${cls} ${found.has(r) ? "found" : ""}">${found.has(r) ? "✓ " : "?"} ${r}</div>`;
  };
  return `<div class="card mission-card">
    <div class="mission-title">🛣️ National Freeway Passport</div>
    <div>Ride on freeways to stamp them into your collection.</div>
    ${bar("Discovered", pct, "#2674bd")}
    <div class="dim small">${found.size} of ${PASSPORT_ROADS.length} freeway shields found · each new one earns a $${CFG.PASSPORT_BONUS} Explorer bonus.</div>
    <div class="grandtour ${found.size >= PASSPORT_ROADS.length ? "won" : ""}">
      ${found.size >= PASSPORT_ROADS.length
        ? `🏆 GRAND TOUR COMPLETE — you've driven every road in the country.`
        : `🏆 <b>Grand Tour</b>: collect all ${PASSPORT_ROADS.length} for
           <b>$${CFG.PASSPORT_COMPLETE_BONUS.toLocaleString()}</b> + ${CFG.PASSPORT_COMPLETE_REP} reputation
           <span class="dim">· ${PASSPORT_ROADS.length - found.size} to go</span>`}
    </div>
  </div>
  ${active.length ? `<div class="card"><b>🚚 Traveling now</b>${active.map(x => `<div class="good small">${x}</div>`).join("")}
    <div class="dim small">A freeway stamps as soon as the truck enters its game corridor.</div></div>` :
    `<div class="card"><b>🚚 No truck is traveling</b><div class="dim small">Dispatch a contract to begin collecting freeway stamps.</div></div>`}
  ${byRegion.map(g => {
    const got = g.roads.filter(r => found.has(r)).length;
    const locked = !open.includes(g.rg);
    return `<div class="card${locked ? " locked-region" : ""}" style="margin-top:8px">
      <b>${locked ? "🔒 " : ""}${REGIONS[g.rg].name}</b>
      <span class="dim small"> ${got}/${g.roads.length}</span>
      ${locked ? `<div class="dim small">Reach ⭐${REGIONS[g.rg].repReq} reputation to run these roads.</div>` : ""}
      <div class="passport-grid">${g.roads.map(shieldHtml).join("")}</div>
    </div>`;
  }).join("")}
  <div class="card" style="margin-top:10px"><b>🔎 Road Explorer</b>
    <div class="dim">Press the 🛣️ map button, then click roads to learn their names.</div></div>`;
}
function reconcilePassport() {
  S.discoveredFreeways = S.discoveredFreeways || [];
  const recovered = new Set(S.discoveredFreeways);
  // Completed reports are authoritative history, including reports made before a
  // browser refresh interrupted the normal passport animation.
  for (const report of S.reports || []) {
    for (const road of [...(report.freeways || []), ...(report.newFreeways || [])])
      if (PASSPORT_ROADS.includes(road)) recovered.add(road);
  }
  // Reconstruct every corridor already reached by each active trip. This supports
  // old saves whose trip object predates the freeway-passport fields.
  for (const truck of S.trucks || []) {
    const T = truck.trip; if (!T) continue;
    for (let li = 0; li <= T.legIdx; li++) {
      const leg = T.legs[li], edgeLimit = li < T.legIdx ? leg.path.length - 1 : T.edgeIdx + 1;
      for (let i = 0; i < Math.min(edgeLimit, leg.path.length - 1); i++)
        for (const road of fallbackFreeways([leg.path[i], leg.path[i + 1]])) recovered.add(road);
    }
    for (const road of T.newFreeways || []) recovered.add(road);
  }
  if (recovered.size !== S.discoveredFreeways.length) {
    S.discoveredFreeways = [...recovered];
    save();
  }
}

let contractQuoteCache = { key: "", values: new Map() };
function contractQuote(c) {
  const fleetKey = S.trucks.map(t => `${t.id}:${t.at || "road"}:${t.trip ? 1 : 0}:${Math.round(t.fuel)}`).join(",");
  const key = `${Math.floor(S.time / 30)}|${fleetKey}|${S.events.length}|${S.contracts.map(x => x.id).join(",")}`;
  if (contractQuoteCache.key !== key) contractQuoteCache = { key, values: new Map() };
  if (contractQuoteCache.values.has(c.id)) return contractQuoteCache.values.get(c.id);
  const driver = S.drivers.find(d => !d.busy) || S.drivers[0];
  let best = null;
  for (const truck of S.trucks) {
    if (truck.trip || TRUCK_TYPES[truck.type].cap < c.pallets || !truck.at) continue;
    const dead = truck.at === c.from
      ? { path: [c.from], mi: 0, mins: 0, fuel$: 0, tolls: 0 }
      : findRoute(S, truck.at, c.from, truck, driver, "fastest");
    const loaded = findRoute(S, c.from, c.to, truck, driver, "fastest");
    if (!dead || !loaded) continue;
    // a truck that can't cross the longest leg (to the pickup OR on the run) is no quote at
    // all — otherwise the card offers a PLAN ROUTE button that dead-ends in a range refusal
    if (!pathInRange(truck, dead.path) || !pathInRange(truck, loaded.path)) continue;
    const repositionOverhead = Math.round(dead.mi * CFG.DEADHEAD_OVERHEAD_PER_MI);
    const operatingCost = dead.fuel$ + loaded.fuel$ + dead.tolls + loaded.tolls + repositionOverhead;
    const q = { truck, dead, loaded, pickupMi: dead.mi, pickupMins: dead.mins,
      operatingCost, deadCost: dead.fuel$ + dead.tolls + repositionOverhead,
      repositionOverhead, net: Math.round(c.pay - operatingCost) };
    if (!best || q.pickupMi < best.pickupMi || (q.pickupMi === best.pickupMi && q.net > best.net)) best = q;
  }
  contractQuoteCache.values.set(c.id, best);
  return best;
}
function rankedContracts() {
  const rows = S.contracts.map(contract => ({ contract, quote: contractQuote(contract) }));
  return rows.sort((a, b) => {
    if (!a.quote) return 1; if (!b.quote) return -1;
    if (contractSort === "profit") return b.quote.net - a.quote.net;
    if (contractSort === "pay") return b.contract.pay - a.contract.pay;
    return a.quote.pickupMi - b.quote.pickupMi || b.quote.net - a.quote.net;
  });
}
const poorFit = (c, q) => q && q.pickupMi > Math.max(100, c.mi * .75);

// What the player sees on a load: the special's story when there is one, plain cargo when
// not. The cargoType underneath still runs the physics either way.
const cargoDisplay = c => c.special
  ? { icon: c.special.icon, name: c.special.name }
  : { icon: CARGO[c.cargoType].icon, name: CARGO[c.cargoType].name };

function contractsHtml() {
  if (planner) return plannerHtml();
  if (!S.contracts.length) return `<p class="dim">Board is empty — new freight posts every few hours.</p>`;
  if (adventureMode()) {
    const c = featuredContract(), cg = CARGO[c.cargoType];
    const q = contractQuote(c);
    const step = S.stats.delivered + 1;
    return `<div class="card mission-card">
      <div class="mission-title">${step === 1 ? "Your first mission!" : "One more practice trip!"}</div>
      <div class="dim">${step === 1 ? `A ${CFG.HOME_REGION_NAME} town is waiting for a delivery.` : "Choose another destination and learn a new route."}</div>
      <div class="mission-route">📍 ${NODES[c.from].name}<br>⭐ <b>${NODES[c.to].name}</b></div>
      <div>${cg.icon} Bring ${cg.name.toLowerCase()} safely to the destination.</div>
      ${q ? `<div class="good small">🚚 Best nearby job: ${q.truck.nick} is ${q.pickupMi ? q.pickupMi + " mi" : "already"} from pickup.</div>` : ""}
      <button class="btn go" data-accept="${c.id}">SHOW ME THE ROUTES →</button>
    </div>
    <div class="card"><b>🧭 Map tip</b><div class="dim">Look for the pulsing gold star. You can drag the map, zoom, or press 🚚 to find your van.</div></div>`;
  }
  const sortBar = `<div class="card"><b>Find work for your trucks</b>
    <div class="dim small">Nearby jobs waste less fuel and driver time before the cargo is loaded.</div>
    <div class="row">
      <button class="btn s ${contractSort === "nearby" ? "go" : ""}" data-contract-sort="nearby">📍 Nearest pickup</button>
      <button class="btn s ${contractSort === "profit" ? "go" : ""}" data-contract-sort="profit">💰 Best net</button>
      <button class="btn s ${contractSort === "pay" ? "go" : ""}" data-contract-sort="pay">📦 Highest pay</button>
    </div></div>`;
  return sortBar + rankedContracts().map(({ contract: c, quote: q }) => {
    const cg = cargoDisplay(c);
    const timeLeft = fmtDur(c.dlMins); // cross-country freight is measured in days, not hours
    const canHaul = !!q;
    const badFit = poorFit(c, q);
    return `<div class="card ${canHaul ? "" : "locked"} ${badFit ? "failbg" : ""} ${c.special ? "special" : ""}">
      ${c.special ? `<div class="special-banner">⭐ SPECIAL DELIVERY</div>` : ""}
      <div class="cardtop"><b>${cg.icon} ${cg.name}</b> <span class="chip ${c.tier}">${c.tier}</span>${c.urgent ? ' <span class="chip URGENT">⚡ URGENT</span>' : ""}
        <span class="star-chip" title="Gold stars earned if you deliver ON TIME. Bigger jobs earn more. Late = −2, failed = −6.">⭐ +${repForTier(c.tier)}${c.special ? ` <span class="star-extra">+${CFG.SPECIAL_REP_BONUS}</span>` : ""}</span></div>
      ${c.special ? `<div class="special-blurb">${c.special.blurb}</div>` : ""}
      <div>${NODES[c.from].name} → <b>${NODES[c.to].name}</b> · ${c.mi} mi · ${c.pallets} pallets</div>
      <div class="dim">${c.shipper} · deliver within <b>${timeLeft}</b></div>
      ${q ? `<div class="${badFit ? "bad" : q.pickupMi <= 25 ? "good" : "warn"} small">
        🚚 ${q.truck.nick}: ${q.pickupMi ? `${q.pickupMi} empty mi · about $${q.deadCost} to reach pickup` : "already at pickup"}
        ${badFit ? " · POOR FIT" : ""}</div>
        <div class="small"><b>Estimated net $${q.net}</b> <span class="dim">after route fuel and tolls</span></div>` : ""}
      <div class="cardbot"><b class="pay">$${c.pay} gross</b>
        ${canHaul ? `<button class="btn go" data-accept="${c.id}">PLAN ROUTE ▶</button>`
          : `<span class="dim">${S.trucks.some(t => TRUCK_TYPES[t.type].cap >= c.pallets)
              ? "no truck has the range for this run yet"
              : `needs ${c.pallets}-pallet truck`}</span>`}</div>
    </div>`;
  }).join("");
}

function plannerHtml() {
  const c = planner.contract, cg = CARGO[c.cargoType];
  const trucks = S.trucks.filter(t => !t.trip && TRUCK_TYPES[t.type].cap >= c.pallets);
  const drivers = S.drivers.filter(d => !d.busy);
  const truck = S.trucks.find(t => t.id === planner.truckId);
  const driver = S.drivers.find(d => d.id === planner.driverId);
  const dl = (planner.departAt != null ? planner.departAt : S.time) + c.dlMins; // window starts at pickup
  if (adventureMode()) {
    const friendly = {
      fastest: ["⚡", "FAST ROUTE", "Get there sooner"],
      cheapest: ["🌴", "SCENIC ROUTE", "Save money and explore"],
      safest: ["🛡️", "SAFE ROUTE", "Calmer roads, less risk"]
    };
    const here = truck?.at ? NODES[truck.at].name : NODES[c.from].name;
    const deadSim = truck?.at && truck.at !== c.from
      ? findRoute(S, truck.at, c.from, truck, driver, "fastest") : null;
    let simple = `<div class="card mission-card"><div class="cardtop"><div class="mission-title">Build Rusty's trip</div><span class="chip">⏸ TIME PAUSED</span></div>
      <div class="mission-route">🚚 ${here}<br>📦 Pick up in ${NODES[c.from].name}<br>⭐ Deliver to <b>${NODES[c.to].name}</b></div>
      <div class="dim">${truck?.at !== c.from ? "The dashed orange road gets Rusty to pickup. " : ""}The blue road carries the delivery.</div>
      ${deadSim ? `<div class="small"><b>🟠 To pickup:</b> ${freewayLine(planner.realDeadhead, deadSim.path)}</div>` : ""}
      ${planner.loadingRealRoute ? `<div class="warn">Finding roads…</div>` : ""}
      </div>${routeWorkshopHtml()}`;
    const FRIENDLY = [friendly.fastest,
      ["🌴", "EXPLORER ROUTE", "A different way across the map"],
      ["🛡️", "ALTERNATE ROUTE", "One more road to consider"]];
    routeCards().slice(0, 3).forEach(card => {
      const f = FRIENDLY[card.i] || FRIENDLY[2];
      const mins = Math.round(card.mins);
      const fresh = unseenFreeways(card.roads);
      simple += `<div class="card route route-choice ${planner.choice === card.i ? "sel" : ""}" data-route="${card.i}">
        <div class="choice-name">${f[0]} ${f[1]}</div>
        <div><b>🛣️ ${roadLine(card.roads)}</b></div>
        ${fresh.length ? `<div class="good small">✨ New passport stamps: ${fresh.join(", ")}</div>` :
          `<div class="dim small">Already traveled freeway territory</div>`}
        <div class="choice-note">${f[2]} · ${Math.round(card.mi)} mi · about ${fmtDur(mins)}${
          card.opt.nights ? ` · 🛏️ ${card.opt.nights} night${card.opt.nights > 1 ? "s" : ""} on the road` : ""}</div>
        ${card.tolls ? `<div class="small warn">Includes a $${card.tolls} toll</div>` : ""}
      </div>`;
    });
    simple += `<div class="row"><button class="btn go" id="dispatch">🚚 START DELIVERY!</button>
      <button class="btn" id="cancelPlan">Back</button></div>`;
    return simple;
  }
  const disp = cargoDisplay(c);
  let html = `<div class="card ${c.special ? "special" : ""}">
    ${c.special ? `<div class="special-banner">⭐ SPECIAL DELIVERY</div>` : ""}
    <div class="cardtop"><b>${disp.icon} ${disp.name}</b> → ${NODES[c.to].name} · <span class="chip">⏸ TIME PAUSED</span> · <b class="pay">$${c.pay}</b>
      <span class="star-chip">⭐ +${repForTier(c.tier)} on time</span></div>
    <div class="dim">deliver within ${Math.round(c.dlMins / 6) / 10}h · ${c.pallets} pallets${cg.fragile ? " · 🏺 handle with care" : ""}${cg.perishable ? " · 🥬 keep it cold" : ""}${cg.theft ? " · 🥷 theft target" : ""}</div>
    <label>Truck: <select id="pTruck">${trucks.map(t => `<option value="${t.id}" ${t.id === planner.truckId ? "selected" : ""}>${TRUCK_TYPES[t.type].icon} ${t.nick} (${t.at ? NODES[t.at].name : "en route"} · fuel ${Math.round(t.fuel)}g)</option>`).join("")}</select></label>
    <label>Driver: <select id="pDriver">${drivers.map(d => `<option value="${d.id}" ${d.id === planner.driverId ? "selected" : ""}>${d.name} ${"★".repeat(d.skill)} (fatigue ${Math.round(d.fatigue)})</option>`).join("")}</select></label>
  </div>`;
  if (truck && truck.at !== c.from) html += `<p class="dim">↪ ${truck.nick} will first deadhead ${NODES[truck.at].name} → ${NODES[c.from].name} to load.</p>`;
  html += routeWorkshopHtml();
  html += `<p class="dim small">Tip: click a road on the map to avoid/unavoid it (${planner.avoid.size} avoided).</p>`;
  routeCards().forEach(card => {
    const o = card.opt;
    const etaLate = o.eta > dl;
    html += `<div class="card route ${planner.choice === card.i ? "sel" : ""}" data-route="${card.i}">
      <div class="cardtop"><b>${o.kind.toUpperCase()}</b>${(o.also || []).map(k => ` <span class="dim">= ${k}</span>`).join("")}
        <span class="${etaLate ? "bad" : "good"}">ETA ${fmtWhen(o.eta)}${etaLate ? " ⚠ LATE" : ""}</span></div>
      <div><b>🛣️ ${roadLine(card.roads)}</b></div>
      <div>${o.mi} mi · ${fmtDur(o.mins)}${o.nights ? ` <span class="dim">(incl. ${o.nights} sleep)</span>` : ""} · fuel ~$${o.fuel$} · tolls $${o.tolls} · risk ${o.risk}${o.rough ? ` · <span class="warn">rough ${o.rough}mi</span>` : ""}</div>
    </div>`;
  });
  const o = planner.opts[planner.choice];
  if (o) {
    const mids = o.path.slice(0, -1); // stops possible at start + intermediate nodes
    html += `<div class="card"><b>Stops</b> <span class="dim small">(auto-planned — edit freely)</span>`;
    for (const n of mids) {
      const p = planner.plan[n] || {};
      html += `<div class="stoprow">${NODES[n].name} <span class="dim small">⛽$${NODES[n].fuel.toFixed(2)} · ${NODES[n].safety >= 3 ? "🔒 safe lot" : "⚠️ sketchy parking"}</span>
        <label><input type="checkbox" data-stop="${n}" data-kind="refuel" ${p.refuel ? "checked" : ""}>⛽</label>
        <label><input type="checkbox" data-stop="${n}" data-kind="rest" ${p.rest ? "checked" : ""}>😴</label></div>`;
    }
    html += `</div>`;
  }
  html += `<div class="row"><button class="btn go" id="dispatch">🚚 DISPATCH</button>
    <button class="btn" id="cancelPlan">Cancel</button></div>`;
  return html;
}

function routeWorkshopHtml() {
  const points = planner.routePoints || [], n = points.length;
  const adding = planner.addingStopType;
  const typeInfo = {
    checkpoint: ["📍", "Checkpoint"], fuel: ["⛽", "Fuel stop"], rest: ["😴", "Rest stop"]
  };
  return `<div class="card">
    <div class="cardtop"><b>🧭 Build your stops</b>${n ? `<span class="chip">${n} stop${n === 1 ? "" : "s"}</span>` : ""}</div>
    <div class="dim small">${adding ? `<b>Click the map to place a ${typeInfo[adding][1].toLowerCase()}.</b>` :
      "Choose a stop type, click the map, then drag its marker whenever you want."}</div>
    <div class="row">
      <button class="btn ${adding === "checkpoint" ? "go" : ""}" data-add-stop="checkpoint">📍 Checkpoint</button>
      <button class="btn ${adding === "fuel" ? "go" : ""}" data-add-stop="fuel">⛽ Fuel</button>
      <button class="btn ${adding === "rest" ? "go" : ""}" data-add-stop="rest">😴 Rest</button>
    </div>
    ${n ? `<div class="stop-list">${points.map((p, i) => `<div class="stop-item">
      <span>${i + 1}. ${typeInfo[p.type][0]}</span>
      <span class="stop-name"><b>${typeInfo[p.type][1]}</b><br><span class="dim small">near ${NODES[p.node].name}</span></span>
      <button class="btn s" data-move-stop="${p.id}" data-dir="-1" ${i ? "" : "disabled"}>↑</button>
      <button class="btn s" data-move-stop="${p.id}" data-dir="1" ${i < n - 1 ? "" : "disabled"}>↓</button>
      <button class="btn s danger" data-remove-stop="${p.id}">×</button>
    </div>`).join("")}</div>
    <div class="row"><button class="btn" id="undoCheckpoint">↶ Undo last</button><button class="btn" id="clearVia">Reset all</button></div>` : ""}
  </div>`;
}

// A rolling truck has no `at`, but on a four-timezone map "where is it, and what time is it
// THERE" is exactly what the dispatcher needs to reason about rush hour and driver hours.
function whereTruckIs(tr) {
  if (!tr.trip) return "";
  const p = truckPos(tr.trip);
  const here = p.b || p.a;
  return `near ${NODES[here].name}, ${NODES[here].st} · ${localClock(S.time, here)} ${tzName(here)}`;
}

function fleetHtml() {
  return S.trucks.map(tr => {
    const tt = TRUCK_TYPES[tr.type];
    const T = tr.trip;
    const driver = T ? S.drivers.find(d => d.id === T.driverId) : null;
    const fuelPct = Math.round(tr.fuel / tankOf(tr) * 100);
    let tripHtml = "";
    if (T) {
      const c = T.contract;
      const leg = T.legs[T.legIdx];
      // before pickup the delivery window hasn't started (deadline is set at loading) —
      // the old code printed "NaNm left" here for the whole deadhead
      const timeLeft = c.deadline == null ? "window starts at pickup"
        : c.deadline - S.time < 0 ? `<span class="bad">⏰ LATE</span>`
        : `${fmtDur(c.deadline - S.time)} left`;
      const hwy = truckHighway(tr);
      const nextNode = leg.path[T.edgeIdx + 1];
      tripHtml = `${hwy ? `<div class="nowon ${shieldClass(hwy)} ${justChangedHighway(T) ? "changed" : ""}">
          <span class="nowon-label">NOW ON</span> <b>${hwy}</b>
          ${nextNode ? `<span class="nowon-to">→ ${NODES[nextNode].name}</span>` : ""}
        </div>` : ""}
        <div class="dim">${cargoDisplay(c).icon} ${c.special ? `<b>${c.special.name}</b> · ` : ""}${NODES[c.from].name} → ${NODES[c.to].name} · $${c.pay} · ${timeLeft}</div>
        <div class="dim small">${leg.path.slice(T.edgeIdx).map(n => NODES[n].name).join(" → ")}</div>
        ${CARGO[c.cargoType].fragile ? bar("Cargo", 100 - T.cargo.dmg, "#c586ff") : ""}
        ${CARGO[c.cargoType].perishable ? bar("Fresh", T.cargo.fresh, "#7ee08a") : ""}
        <div class="row">
          <button class="btn s" data-rr="fastest" data-t="${tr.id}">↻ Fastest</button>
          <button class="btn s" data-rr="cheapest" data-t="${tr.id}">↻ Cheapest</button>
          <button class="btn s" data-rr="safest" data-t="${tr.id}">↻ Safest</button>
        </div>
        <div class="row">
          <button class="btn s" data-stopnext="refuel" data-t="${tr.id}">⛽ Fuel next city</button>
          <button class="btn s" data-stopnext="rest" data-t="${tr.id}">😴 Rest next city</button>
        </div>`;
    } else {
      tripHtml = `<div class="row">
        <button class="btn s" data-repair="${tr.id}">🔧 Repair ($${Math.round((100 - tr.cond) * 9)})</button>
        ${S.trucks.length > 1 ? `<button class="btn s danger" data-sell="${tr.id}">Sell</button>` : ""}
      </div>`;
    }
    const paint = truckPaint(tr);
    return `<div class="card ${tr.id === selTruckId ? "sel" : ""}" data-truck="${tr.id}">
      <div class="cardtop"><b>${tt.icon} ${paint ? `<span class="paint-dot" style="background:${paint.hex}"></span>` : ""}${tr.nick}</b> <span class="dim">${
        tr.at ? `${NODES[tr.at].name}, ${NODES[tr.at].st} · ${localClock(S.time, tr.at)} ${tzName(tr.at)}`
              : whereTruckIs(tr)}</span></div>
      <div class="row garage-row">
        <button class="btn s" data-rename="${tr.id}">✏️ Name</button>
        <button class="btn s" data-paint-open="${tr.id}">🎨 Paint ($${CFG.PAINT_COST})</button>
      </div>
      ${paintOpenId === tr.id ? `<div class="swatches">${PAINT_COLORS.map(pc =>
        `<button class="swatch ${tr.color === pc.id ? "on" : ""}" style="background:${pc.hex}"
           title="${pc.name}" data-paint="${tr.id}:${pc.id}"></button>`).join("")}</div>` : ""}
      <div class="${T && (T.blocked || (T.pauseWhy || "").includes("OUT OF FUEL")) ? "bad" : "dim"}">${tr.status}</div>
      ${bar("Fuel", fuelPct, fuelPct < 20 ? "#e0392b" : "#5ec4ff")}
      ${bar("Cond", tr.cond, tr.cond < 40 ? "#e0392b" : "#8fd18f")}
      ${driver ? bar(`${driver.name} 😴`, 100 - driver.fatigue, driver.fatigue > 80 ? "#e0392b" : "#ffd75e") : ""}
      ${Object.keys(tr.upgrades).length ? `<div class="dim small">Upgrades: ${Object.keys(tr.upgrades).map(u => UPGRADES[u].name).join(", ")}</div>` : ""}
      ${tripHtml}
    </div>`;
  }).join("") + driversHtml();
}
const bar = (label, pct, color) =>
  `<div class="bar"><span>${label}</span><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></div></div></div>`;

function driversHtml() {
  return `<h3>Drivers</h3>` + S.drivers.map(d =>
    `<div class="drow">${d.name} ${"★".repeat(d.skill)}${"☆".repeat(5 - d.skill)}
      <span class="dim">$${d.wage}/day · ${d.busy ? "on the road" : "available"} · fatigue ${Math.round(d.fatigue)}</span></div>`).join("");
}

function shopHtml() {
  let html = `<h3>Trucks <span class="dim small">(your ladder to a fleet)</span></h3>`;
  for (const [id, t] of Object.entries(TRUCK_TYPES)) {
    if (id === "rusty") continue;
    const locked = S.rep < t.repReq;
    const afford = S.cash >= t.cost;
    html += `<div class="card ${locked ? "locked" : ""}">
      <div class="cardtop"><b>${t.icon} ${t.name}</b><b class="pay">$${t.cost.toLocaleString()}</b></div>
      <div class="dim small">${t.blurb}</div>
      <div class="dim small">${t.cap} pallets · ${t.tank}gal · ${t.mpg}mpg · ${t.top}mph${t.reefer ? " · ❄️ reefer" : ""}${t.secure ? " · 🔐 secure" : ""}</div>
      ${locked ? `<div class="warn">Requires ⭐ ${t.repReq} reputation</div>`
        : `<button class="btn go s" data-buy="${id}" ${afford ? "" : "disabled"}>${afford ? "BUY" : "Can't afford"}</button>`}
    </div>`;
  }
  html += `<h3>Upgrades</h3>`;
  for (const tr of S.trucks) {
    const missing = Object.entries(UPGRADES).filter(([k]) => !tr.upgrades[k]);
    if (!missing.length) continue;
    html += `<div class="card"><div class="cardtop"><b>${TRUCK_TYPES[tr.type].icon} ${tr.nick}</b></div>` +
      missing.map(([k, u]) => `<div class="stoprow">${u.name} <span class="dim small">${u.blurb}</span>
        <button class="btn s" data-up="${k}" data-t="${tr.id}" ${S.cash >= u.cost ? "" : "disabled"}>$${u.cost}</button></div>`).join("") + `</div>`;
  }
  html += `<h3>Hire Drivers <span class="dim small">($200 signing + daily wage)</span></h3>`;
  html += S.hirePool.map((d, i) =>
    `<div class="drow">${d.name} ${"★".repeat(d.skill)}${"☆".repeat(5 - d.skill)} <span class="dim">$${d.wage}/day</span>
      <button class="btn s" data-hire="${i}" ${S.cash >= 200 ? "" : "disabled"}>HIRE</button></div>`).join("");
  return html;
}

function logHtml() {
  const reps = S.reports.map(r => `<div class="card ${r.failed ? "failbg" : ""}">
    <div class="cardtop"><b>${r.failed ? "❌" : "✅"} ${CARGO[r.contract.cargoType].icon} → ${NODES[r.contract.to].name}</b>
      <b class="${r.profit >= 0 ? "pay" : "bad"}">${r.profit >= 0 ? "+" : ""}$${r.profit}</b></div>
    <div class="dim small">${r.truck} · ${r.driver} · ${Math.round(r.minutes / 6) / 10}h · rep ${r.repD > 0 ? "+" : ""}${r.repD}</div>
  </div>`).join("");
  const stats = `<div class="card"><b>Company</b>
    <div class="dim">Delivered ${S.stats.delivered} · Failed ${S.stats.failed} · ${Math.round(S.stats.miles).toLocaleString()} miles driven</div>
    <div class="dim">Earned $${Math.round(S.stats.earned).toLocaleString()} · Spent $${Math.round(S.stats.spent).toLocaleString()}</div></div>`;
  return stats + (reps || `<p class="dim">No completed trips yet.</p>`);
}

// ---------------------------------------------------------------- side panel wiring
function wireSide(el) {
  el.querySelectorAll("[data-accept]").forEach(b => b.onclick = () => openPlanner(+b.dataset.accept));
  el.querySelectorAll("[data-rename]").forEach(b => b.onclick = () => {
    const tr = S.trucks.find(t => t.id === +b.dataset.rename);
    if (!tr || typeof window.prompt !== "function") return;
    const name = window.prompt(`New name for ${tr.nick}?`, tr.nick);
    if (name != null && renameTruck(S, tr.id, name).ok) { save(); renderSide(); }
  });
  el.querySelectorAll("[data-paint-open]").forEach(b => b.onclick = () => {
    const id = +b.dataset.paintOpen;
    paintOpenId = paintOpenId === id ? null : id;
    renderSide();
  });
  el.querySelectorAll("[data-paint]").forEach(b => b.onclick = () => {
    const [tid, colorId] = b.dataset.paint.split(":");
    if (paintTruck(S, +tid, colorId).ok) { save(); renderSide(); }
  });
  el.querySelectorAll("[data-contract-sort]").forEach(b => b.onclick = () => {
    contractSort = b.dataset.contractSort; renderSide();
  });
  el.querySelectorAll("[data-route]").forEach(b => b.onclick = () => { planner.choice = +b.dataset.route; syncPlanStops(); renderSide(); });
  el.querySelectorAll("[data-stop]").forEach(cb => cb.onchange = () => {
    const n = cb.dataset.stop, k = cb.dataset.kind;
    planner.plan[n] = planner.plan[n] || {};
    planner.plan[n][k] = cb.checked;
  });
  const pt = $("#pTruck"); if (pt) pt.onchange = () => {
    planner.truckId = +pt.value; replanRoutes(); refreshRealRoutes(); renderSide();
  };
  const pd = $("#pDriver"); if (pd) pd.onchange = () => { planner.driverId = +pd.value; replanRoutes(); renderSide(); };
  const dis = $("#dispatch"); if (dis) dis.onclick = doDispatch;
  const cp = $("#cancelPlan"); if (cp) cp.onclick = closePlanner;
  const clearVia = $("#clearVia"); if (clearVia) clearVia.onclick = () => {
    planner.via = null; planner.routePoints = []; replanRoutes(); refreshRealRoutes(); renderSide();
  };
  el.querySelectorAll("[data-add-stop]").forEach(b => b.onclick = () => {
    planner.addingStopType = planner.addingStopType === b.dataset.addStop ? null : b.dataset.addStop;
    if (realMap) realMap.getCanvas().style.cursor = planner.addingStopType ? "crosshair" : "";
    renderSide();
  });
  const undoCheckpoint = $("#undoCheckpoint"); if (undoCheckpoint) undoCheckpoint.onclick = () => {
    planner.routePoints = (planner.routePoints || []).slice(0, -1);
    replanRoutes(); refreshRealRoutes(); renderSide();
  };
  el.querySelectorAll("[data-remove-stop]").forEach(b => b.onclick = () => {
    planner.routePoints = planner.routePoints.filter(p => p.id !== +b.dataset.removeStop);
    replanRoutes(); refreshRealRoutes(); renderSide();
  });
  el.querySelectorAll("[data-move-stop]").forEach(b => b.onclick = () => {
    const i = planner.routePoints.findIndex(p => p.id === +b.dataset.moveStop);
    const j = i + +b.dataset.dir;
    if (i < 0 || j < 0 || j >= planner.routePoints.length) return;
    [planner.routePoints[i], planner.routePoints[j]] = [planner.routePoints[j], planner.routePoints[i]];
    replanRoutes(); refreshRealRoutes(); renderSide();
  });
  el.querySelectorAll("[data-rr]").forEach(b => b.onclick = () => {
    const r = reroute(S, +b.dataset.t, b.dataset.rr);
    if (!r.ok && r.why) toast(r.why);
    renderSide();
  });
  el.querySelectorAll("[data-stopnext]").forEach(b => b.onclick = () => {
    const tr = S.trucks.find(t => t.id === +b.dataset.t);
    if (!tr || !tr.trip) return;
    const T = tr.trip, leg = T.legs[T.legIdx];
    const nextNode = leg.path[T.edgeIdx + (T.posMi > 0 ? 1 : 0)];
    if (!nextNode) return;
    T.stopPlan[nextNode] = T.stopPlan[nextNode] || {};
    T.stopPlan[nextNode][b.dataset.stopnext] = true;
    toast(`${b.dataset.stopnext === "refuel" ? "⛽ Refuel" : "😴 Rest"} scheduled at ${NODES[nextNode].name}.`);
    renderSide();
  });
  el.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => { buyTruck(S, b.dataset.buy); save(); renderSide(); });
  el.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => {
    if (confirm("Sell this truck?")) { sellTruck(S, +b.dataset.sell); save(); renderSide(); }
  });
  el.querySelectorAll("[data-repair]").forEach(b => b.onclick = () => { repairTruck(S, +b.dataset.repair); save(); renderSide(); });
  el.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { buyUpgrade(S, +b.dataset.t, b.dataset.up); save(); renderSide(); });
  el.querySelectorAll("[data-hire]").forEach(b => b.onclick = () => { hireDriver(S, +b.dataset.hire); save(); renderSide(); });
  el.querySelectorAll("[data-truck]").forEach(c => c.addEventListener("click", e => {
    if (e.target.closest("button,input,select,label")) return;
    selTruckId = +c.dataset.truck;
    renderSide();
  }));
}

function openPlanner(contractId) {
  const c = S.contracts.find(x => x.id === contractId);
  if (!c) {
    toast("That contract just expired. The board has been refreshed with new jobs.");
    renderSide();
    return;
  }
  const truck = contractQuote(c)?.truck ||
    S.trucks.find(t => !t.trip && TRUCK_TYPES[t.type].cap >= c.pallets);
  const driver = S.drivers.find(d => !d.busy);
  if (!truck) { toast("No idle truck big enough — check the SHOP."); return; }
  if (!driver) { toast("No available driver — hire one in the SHOP."); return; }
  const resumeSpeed = S.speed;
  S.speed = 0;
  planner = { contract: c, truckId: truck.id, driverId: driver.id, opts: [], choice: 0, plan: {},
    avoid: new Set(), via: null, routePoints: [], nextPointId: 1, addingStopType: null, resumeSpeed };
  replanRoutes();
  activeTab = "contracts";
  renderSide();
  refreshRealRoutes();
}
function closePlanner() {
  if (!planner) return;
  S.speed = planner.resumeSpeed ?? 1;
  planner = null;
  renderSide();
}
function replanRoutes() {
  const c = planner.contract;
  const truck = S.trucks.find(t => t.id === planner.truckId);
  const driver = S.drivers.find(d => d.id === planner.driverId);
  // ETA-aware: plan the loaded leg departing after any deadhead + 30min load
  let departAt = S.time;
  if (truck.at !== c.from) {
    const dead = findRoute(S, truck.at, c.from, truck, driver, "fastest");
    departAt = S.time + (dead ? dead.mins : 0) + 30;
  }
  planner.departAt = departAt;
  const stopNodes = (planner.routePoints || [])
    .filter(p => p.type === "fuel" || p.type === "rest").map(p => p.node)
    .filter((n, i, all) => n !== c.from && n !== c.to && n !== all[i - 1]);
  if (planner.via || stopNodes.length) {
    const viaNodes = [...(planner.via ? [planner.via] : []), ...stopNodes];
    planner.opts = ["fastest", "cheapest", "safest"].map(kind => {
      const nodes = [c.from, ...viaNodes, c.to];
      let out = { kind, path: [c.from], mi: 0, mins: 0, fuel$: 0, tolls: 0, risk: 0, rough: 0, eta: departAt };
      for (let i = 0; i < nodes.length - 1; i++) {
        if (nodes[i] === nodes[i + 1]) continue;
        const leg = findRoute(S, nodes[i], nodes[i + 1], truck, driver, kind, planner.avoid, out.eta);
        if (!leg) return null;
        out.path.push(...leg.path.slice(1));
        for (const k of ["mi", "mins", "fuel$", "tolls", "risk", "rough"]) out[k] += leg[k] || 0;
        out.eta = leg.eta;
      }
      return out;
    }).filter(Boolean).filter((o, i, all) => all.findIndex(x => x.path.join() === o.path.join()) === i);
  } else {
    planner.opts = routeOptions(S, c.from, c.to, truck, driver, planner.avoid, departAt);
  }
  planner.choice = Math.min(planner.choice, Math.max(0, planner.opts.length - 1));
  syncPlanStops();
}
function syncPlanStops() {
  const truck = S.trucks.find(t => t.id === planner.truckId);
  const driver = S.drivers.find(d => d.id === planner.driverId);
  const o = planner.opts[planner.choice] || planner.opts[0];
  planner.plan = o ? autoPlanStops(S, truck, driver, o.path) : {};
  if (o) for (const p of planner.routePoints || []) {
    if ((p.type === "fuel" || p.type === "rest") && o.path.includes(p.node)) {
      planner.plan[p.node] = planner.plan[p.node] || {};
      planner.plan[p.node][p.type === "fuel" ? "refuel" : "rest"] = true;
    }
  }
}
// Editing stops fires a routing request per interaction, and responses can land out of
// order — an older reply used to overwrite a newer one. Every request carries a sequence
// number and only the newest one is allowed to write into the planner.
let osrmSeq = 0;
let realRoutesInFlight = null;
async function refreshRealRoutes() {
  const p = planner;
  if (!p || !realMap) return;
  const c = p.contract;
  const truck = S.trucks.find(t => t.id === p.truckId);
  const loadedPoints = [[NODES[c.from].lon, NODES[c.from].lat],
    ...(p.routePoints || []).map(x => x.coord), [NODES[c.to].lon, NODES[c.to].lat]];
  const deadheadPoints = truck?.at && truck.at !== c.from
    ? [[NODES[truck.at].lon, NODES[truck.at].lat], [NODES[c.from].lon, NODES[c.from].lat]] : null;
  const seq = ++osrmSeq;
  p.loadingRealRoute = true;
  const job = (async () => {
    try {
      const [loadedData, deadheadData] = await Promise.all([
        fetchOsrm(loadedPoints, loadedPoints.length === 2),
        deadheadPoints ? fetchOsrm(deadheadPoints, false) : Promise.resolve(null)
      ]);
      if (planner !== p || seq !== osrmSeq) return; // a newer request already won
      p.realRoutes = loadedData.routes.map(r => ({ geometry: r.geometry, distance: r.distance,
        duration: r.duration, freeways: freewayNames(r) }));
      const deadRoute = deadheadData?.routes?.[0] || null;
      p.realDeadhead = deadRoute ? { ...deadRoute, freeways: freewayNames(deadRoute) } : null;
      const allCoords = [
        ...(p.realDeadhead?.geometry?.coordinates || []),
        ...(p.realRoutes[0]?.geometry?.coordinates || [])
      ];
      if (allCoords.length && window.maplibregl?.LngLatBounds) {
        const bounds = allCoords.reduce((b, xy) => b.extend(xy),
          new window.maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
        realMap?.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: 650 });
      }
      if (loadedPoints.length > 2) toast(`⭐ Route updated with ${loadedPoints.length - 2} stop${loadedPoints.length === 3 ? "" : "s"}.`);
    } catch (e) {
      if (planner !== p || seq !== osrmSeq) return;
      p.realRoutes = null;
      p.realDeadhead = null;
      // The atlas geometry still draws a correct route, so this is a downgrade, not a failure.
      toast(`Live road data is unavailable right now (${e.message}) — using the built-in atlas roads.`);
    } finally {
      if (planner === p && seq === osrmSeq) { p.loadingRealRoute = false; renderSide(); }
    }
  })();
  realRoutesInFlight = job;
  return job;
}
const OSRM_TIMEOUT_MS = 9000;
const osrmCache = new Map(); // url → response; planners re-request identical routes constantly
async function fetchOsrm(points, alternatives) {
  const coords = points.map(x => `${x[0].toFixed(5)},${x[1].toFixed(5)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=${alternatives ? "true" : "false"}&steps=true`;
  if (osrmCache.has(url)) return osrmCache.get(url);
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), OSRM_TIMEOUT_MS);
  try {
    const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (!res.ok) throw new Error(`routing service ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("no road route found");
    if (osrmCache.size > 60) osrmCache.clear();
    osrmCache.set(url, data);
    return data;
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "routing timed out" : e.message);
  } finally {
    clearTimeout(timer);
  }
}
function freewayNames(route) {
  const found = [];
  for (const leg of route.legs || []) for (const step of leg.steps || []) {
    const candidates = String(step.ref || "").split(";").map(normalizeRoadRef).filter(Boolean);
    if (!candidates.length && /freeway|highway|expressway/i.test(step.name || "")) candidates.push(step.name);
    for (const name of candidates) if (name && found[found.length - 1] !== name && !found.includes(name)) found.push(name);
  }
  return found;
}
function normalizeRoadRef(ref) {
  const s = ref.trim().replace(/\s+/g, " ");
  const m = s.match(/^(I|US|CA|SR)\s*-?\s*(\d+)(?:\s*(?:Business|BUS))?$/i);
  if (!m) return "";
  const prefix = m[1].toUpperCase() === "SR" ? "CA" : m[1].toUpperCase();
  return `${prefix}-${m[2]}`;
}
function fallbackFreeways(path) {
  const names = [];
  for (let i = 0; i < path.length - 1; i++) {
    const label = findEdgeAB(path[i], path[i + 1])?.hwy || "";
    const refs = label.match(/(?:I|US|CA|SR)-?\d+/gi) || [];
    for (const ref of refs) {
      const name = normalizeRoadRef(ref);
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}
// A route card is backed by exactly ONE sim option. The sim is what actually charges fuel,
// tolls and time, so its numbers are the ones quoted. A live OSRM route is attached only
// when one exists at the same index; it supplies drawing geometry and real-world freeway
// names, never the distance or ETA. (Previously card N could show OSRM route N's mileage
// while dispatching sim option 0 — the player was quoted a trip the game never ran.)
function routeCards() {
  if (!planner) return [];
  return planner.opts.map((o, i) => {
    const real = planner.realRoutes?.[i] || null;
    const roads = real?.freeways?.length ? real.freeways : fallbackFreeways(o.path);
    return { i, opt: o, real, roads, mi: o.mi, mins: o.mins, eta: o.eta, tolls: o.tolls };
  });
}
const chosenCard = () => routeCards()[planner?.choice] || routeCards()[0] || null;
function roadLine(roads) {
  if (!roads.length) return "Local roads";
  const shown = roads.slice(0, 4).join(" → ");
  return roads.length > 4 ? `${shown} → +${roads.length - 4} more` : shown;
}
function freewayLine(realRoute, simPath) {
  return roadLine(realRoute?.freeways?.length ? realRoute.freeways : fallbackFreeways(simPath));
}
function unseenFreeways(roads) {
  const known = new Set(S.discoveredFreeways || []);
  return roads.filter(r => PASSPORT_ROADS.includes(r) && !known.has(r));
}
function doDispatch() {
  const card = chosenCard();
  if (!card) return;
  const o = card.opt;
  const mapGeometry = card.real?.geometry || null;
  const res = assign(S, planner.contract.id, planner.truckId, planner.driverId, o, planner.plan);
  if (!res.ok) { toast(res.why || "Could not dispatch."); return; }
  const dispatched = S.trucks.find(t => t.id === planner.truckId);
  if (dispatched?.trip && mapGeometry) {
    dispatched.trip.mapGeometry = mapGeometry; // compatibility with saves made by the first real-map build
    dispatched.trip.mapLegGeometries = dispatched.trip.legs.length === 2
      ? [planner.realDeadhead?.geometry || null, mapGeometry] : [mapGeometry];
  }
  const resumeSpeed = planner.resumeSpeed ?? 1;
  selTruckId = planner.truckId;
  planner = null;
  S.speed = resumeSpeed;
  save();
  renderSide();
}

// ---------------------------------------------------------------- modals & toasts
function showReport(r) {
  const c = r.contract, cg = cargoDisplay(c);
  const ex = r.expenses;
  const specialWin = !r.failed && !!c.special;
  $("#modalBody").innerHTML = `
    <h2>${r.failed ? "🧭 LET'S TRY ANOTHER ROUTE" : specialWin ? `${c.special.icon} SPECIAL DELIVERY COMPLETE!` : "🎉 DELIVERY COMPLETE!"}</h2>
    ${r.failed ? `<p class="bad"><b>${r.failedWhy}</b></p>` : ""}
    ${specialWin ? `<p class="special-blurb">${c.special.blurb}</p>` : ""}
    <p>${cg.icon} ${cg.name} · ${NODES[c.from].name} → ${NODES[c.to].name} · ${r.truck} · ${r.driver}</p>
    <table>
      <tr><td>Contract payment</td><td class="r">$${r.failed ? 0 : c.pay}</td></tr>
      ${r.bonuses ? `<tr><td>Bonuses</td><td class="r good">+$${r.bonuses}</td></tr>` : ""}
      ${r.penalties ? `<tr><td>Penalties</td><td class="r bad">−$${r.penalties}</td></tr>` : ""}
      <tr><td>Fuel</td><td class="r">−$${Math.round(ex.fuel)}</td></tr>
      ${ex.reposition ? `<tr><td>Empty-mile repositioning</td><td class="r bad">−$${ex.reposition}</td></tr>` : ""}
      ${ex.tolls ? `<tr><td>Tolls</td><td class="r">−$${ex.tolls}</td></tr>` : ""}
      ${ex.stops ? `<tr><td>Rest stops</td><td class="r">−$${ex.stops}</td></tr>` : ""}
      ${ex.fines ? `<tr><td>Tickets/fines</td><td class="r bad">−$${ex.fines}</td></tr>` : ""}
      ${ex.repairs ? `<tr><td>Repairs/towing</td><td class="r bad">−$${ex.repairs}</td></tr>` : ""}
      <tr class="total"><td><b>PROFIT</b></td><td class="r"><b class="${r.profit >= 0 ? "good" : "bad"}">${r.profit >= 0 ? "+" : ""}$${r.profit}</b></td></tr>
    </table>
    ${r.notes.length ? `<p class="dim">${r.notes.join(" · ")}</p>` : ""}
    ${r.newFreeways?.length ? `<div class="card mission-card"><b>🛣️ NEW FREEWAY STAMP!</b>
      <div>${r.newFreeways.join(" · ")}</div><div class="good">+$${r.newFreeways.length * 25} Explorer bonus</div></div>` : ""}
    <div class="star-earn ${r.repD >= 0 ? "good-bg" : "bad-bg"}">${r.repD > 0
      ? `⭐ +${r.repD} gold star${r.repD > 1 ? "s" : ""}! <span class="dim small">(${c.tier} on time${r.repD > repForTier(c.tier) ? " + bonus" : ""})</span>`
      : r.repD === 0 ? `⭐ no stars this time`
      : `⭐ ${r.repD} stars <span class="dim small">(${r.failed ? "failed delivery" : "late delivery"})</span>`}</div>
    <p class="dim small">Trip time ${Math.round(r.minutes / 6) / 10}h · incidents ${r.incidents} · driver fatigue ${r.fatigue}</p>
    ${!r.failed && S.stats.delivered <= 2 ? `<p><b>⭐ Map Explorer sticker earned!</b></p>` : ""}
    <button class="btn go" onclick="document.getElementById('modal').classList.remove('open')">${S.stats.delivered < 2 ? "NEXT ADVENTURE" : "CONTINUE"}</button>`;
  $("#modal").classList.add("open");
  if (specialWin) confetti();
}

// ---------------------------------------------------------------- region moments
// A region unlock used to be one line in the ticker — easy to miss, and it never said what
// you actually GOT. Now it's a full celebration that lists the new cities and shields.
let knownRegionCount = null; // set at boot; frame() watches for growth
const regionCities = rg => Object.entries(NODES).filter(([, n]) => n.region === rg);
const regionShields = rg => PASSPORT_ROADS.filter(r => (SHIELD_REGIONS[r] || [])[0] === rg);
function showRegionUnlock(rgIds) {
  const cards = rgIds.map(rg => {
    const cities = regionCities(rg);
    const shields = regionShields(rg);
    return `<div class="card" style="border-color:${REGION_COLORS[rg]}">
      <div class="mission-title" style="color:${REGION_COLORS[rg]}">${REGIONS[rg].name}</div>
      <div class="special-blurb">${REGIONS[rg].blurb}</div>
      <div><b>🏙️ ${cities.length} new cities:</b> ${cities.map(([, n]) => `${n.name}, ${n.st}`).join(" · ")}</div>
      ${shields.length ? `<div><b>🛣️ ${shields.length} new shields to collect:</b> ${shields.join(" · ")}</div>` : ""}
      <div class="good">📋 Fresh freight from the new territory is already on the board.</div>
    </div>`;
  }).join("");
  $("#modalBody").innerHTML = `<h2>🗺️ NEW TERRITORY UNLOCKED!</h2>${cards}
    <button class="btn go" onclick="document.getElementById('modal').classList.remove('open')">LET'S GO SEE IT →</button>`;
  $("#modal").classList.add("open");
  confetti(40);
}
// the 🗺️ counter in the top bar opens this: every region, what it holds, what it costs
function showRegionsOverview() {
  const open = unlockedRegions(S);
  $("#modalBody").innerHTML = `<h2>🗺️ Your America</h2>
    <p class="dim small">Earn ⭐ gold stars by delivering on time — each milestone opens a new
    region: more cities, more freight, more freeway shields.</p>
    ${REGION_ORDER.map(rg => {
      const owned = open.includes(rg);
      const cities = regionCities(rg);
      const shields = regionShields(rg);
      return `<div class="card ${owned ? "" : "locked-region"}" style="border-left:6px solid ${REGION_COLORS[rg]}">
        <b>${owned ? "✅" : "🔒"} ${REGIONS[rg].name}</b>
        <span class="dim small">${owned ? "yours" : `unlocks at ⭐${REGIONS[rg].repReq} (you have ⭐${S.rep})`}</span>
        <div class="dim small">${cities.length} cities · ${shields.length} shields${owned ? "" : ` · ${REGIONS[rg].blurb}`}</div>
      </div>`;
    }).join("")}
    <button class="btn go" onclick="document.getElementById('modal').classList.remove('open')">BACK TO WORK</button>`;
  $("#modal").classList.add("open");
}

// ---------------------------------------------------------------- confetti
// Pure-DOM celebration — ~60 emoji petals that fall and fade, then clean themselves up.
// Cheap enough for an iPad, and guarded so the headless harness can call it safely.
function confetti(count = 60) {
  try {
    const PIECES = ["🎉", "⭐", "🎊", "✨", "🏆", "💛"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.textContent = PIECES[(Math.random() * PIECES.length) | 0];
      p.style.left = (Math.random() * 100) + "vw";
      p.style.animationDelay = (Math.random() * 0.9) + "s";
      p.style.animationDuration = (2.2 + Math.random() * 1.6) + "s";
      p.style.fontSize = (14 + Math.random() * 18) + "px";
      document.body.appendChild(p);
      setTimeout(() => { try { p.remove(); } catch (e) {} }, 5000);
    }
  } catch (e) { /* headless or ancient browser — the celebration is optional */ }
}
let toastTimer = null;
function toast(html) {
  const t = $("#toast");
  t.innerHTML = html;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 6000);
}

// ---------------------------------------------------------------- top bar wiring + dev
function wireTop() {
  document.querySelectorAll("#speedCtl button").forEach(b => b.onclick = () => {
    if (!planner) S.speed = +b.dataset.s;
  });
  $("#resetBtn").onclick = () => {
    if (confirm("Start a brand-new company? Current save is erased.")) {
      localStorage.removeItem(CFG.SAVE_KEY);
      S = newGame((Math.random() * 2 ** 31) | 0);
      shownReports = 0; selTruckId = null; planner = null;
      renderSide();
    }
  };
  $("#helpBtn").onclick = () => {
    $("#modalBody").innerHTML = adventureMode() ? `<h2>🗺️ Welcome, Map Explorer!</h2>
      <p><b>Rusty the van needs your help.</b> Pick a destination, choose a route, and watch Rusty travel across ${CFG.HOME_REGION_NAME} — then earn your way across ${CFG.REGION}.</p>
      <p>Look for the <b>gold star ⭐</b> on the map. It shows where your delivery needs to go.</p>
      <p class="dim">For your first two trips, we’ll show you one simple step at a time. More company tools unlock afterward.</p>
      <button class="btn go" onclick="document.getElementById('modal').classList.remove('open')">START MY FIRST MISSION →</button>` :
      `<h2>🚚 Company Mode Unlocked!</h2>
      <p>You’ve learned the basics. Now you can choose contracts, manage drivers, buy trucks, plan stops, and react to changing roads.</p>
      <p><b>⭐ Gold stars</b> are your reputation. Deliver <b>on time</b> to earn them — bigger
      jobs earn more (LOCAL +1 · REGIONAL +2 · LONG-HAUL +3 · TRANSCON +4). Arriving late
      costs 2 and a failed delivery costs 6, so protect the cargo and watch the clock.</p>
      <p><b>🗺️ Stars unlock America.</b> Each new region opens more cities to deliver to,
      new freight on the board, and new freeway shields for your passport. The gray areas on
      the map show where you can't work — yet. Click the 🗺️ counter up top to see them all.</p>
      <p class="dim">Drag to pan, scroll or use +/− to zoom, and click roads for current conditions.</p>
      <button class="btn go" onclick="document.getElementById('modal').classList.remove('open')">LET'S ROLL</button>`;
    $("#modal").classList.add("open");
  };
  window.addEventListener("keydown", e => {
    if (e.key === "`") $("#dev").classList.toggle("open");
    if (e.key === " " && !e.target.closest("input,select")) {
      e.preventDefault();
      if (!planner) S.speed = S.speed === 0 ? 1 : 0;
    }
  });
  $("#zoomIn").onclick = () => realMap ? realMap.zoomIn() : (cam.z = Math.min(40, cam.z * 1.25));
  $("#zoomOut").onclick = () => realMap ? realMap.zoomOut() : (cam.z = Math.max(.7, cam.z / 1.25));
  const terrBtn = $("#territory"); if (terrBtn) terrBtn.onclick = showRegionsOverview;
  $("#findTruck").onclick = focusTruck;
  $("#followTruck").onclick = () => {
    followTruckMode = !followTruckMode;
    $("#followTruck").classList.toggle("active", followTruckMode);
    if (followTruckMode) {
      selTruckId = selTruckId || S.trucks[0]?.id;
      focusTruck();
      toast("🎥 Following your truck. Drag the map to stop following.");
    }
  };
  $("#inspectRoad").onclick = () => {
    inspectRoadMode = !inspectRoadMode;
    $("#inspectRoad").classList.toggle("active", inspectRoadMode);
    if (realMap) realMap.getCanvas().style.cursor = inspectRoadMode ? "crosshair" : "";
    toast(inspectRoadMode ? "🛣️ Road Explorer is on—click any road to identify it." : "Road Explorer turned off.");
  };
  $("#dev").innerHTML = `<b>DEV</b>
    <button data-d="cash">+$25k</button><button data-d="rep">+10 rep</button>
    <button data-d="skip">+4h</button><button data-d="fire">🔥 random</button>
    <button data-d="wreck">🚨 random</button><button data-d="fuel">refuel all</button>
    <button data-d="rest">wake all</button><button data-d="clear">clear events</button>`;
  $("#dev").querySelectorAll("button").forEach(b => b.onclick = () => {
    const d = b.dataset.d;
    if (d === "cash") S.cash += 25000;
    if (d === "rep") S.rep = Math.min(100, S.rep + 10);
    if (d === "skip") tick(S, 240);
    if (d === "fire" || d === "wreck") {
      const e = EDGES[(Math.random() * EDGES.length) | 0];
      forceEvent(S, d === "fire" ? "wildfire" : "accident_major", edgeKey(e.a, e.b));
    }
    if (d === "fuel") for (const t of S.trucks) t.fuel = tankOf(t);
    if (d === "rest") for (const dr of S.drivers) dr.fatigue = 0;
    if (d === "clear") S.events = [];
    renderSide();
  });
}

function focusTruck() {
  const tr = S.trucks.find(t => t.id === selTruckId) || S.trucks[0];
  if (!tr) return;
  if (realMap) {
    realMap.easeTo({ center: truckLngLat(tr), zoom: Math.max(realMap.getZoom(), 10), duration: 650 });
    selTruckId = tr.id;
    return;
  }
  let x, y;
  if (tr.trip) {
    const p = truckPos(tr.trip), e = p.b ? findEdgeAB(p.a, p.b) : null;
    if (e) [x, y] = alongPoly(e.a === p.a ? edgePts(e) : [...edgePts(e)].reverse(), p.frac);
    else [x, y] = nodeXY(p.a);
  } else [x, y] = nodeXY(tr.at);
  const cv = canvas(), fit = Math.min(cv.clientWidth / MAP_W, cv.clientHeight / MAP_H);
  cam.z = Math.max(cam.z, 9); // a truck is a dot on a national map — get close
  cam.x = -(x - 380) * fit * cam.z;
  cam.y = -(y - 400) * fit * cam.z;
  selTruckId = tr.id;
}

// ---------------------------------------------------------------- go
// debug/test hook (used by the headless smoke harness + browser console tinkering)
if (typeof window !== "undefined") window.__rd = {
  get S() { return S; },
  setTab: t => { activeTab = t; renderSide(); },
  renderSide: () => renderSide(),
  plan: id => openPlanner(id),
  dispatch: () => doDispatch(),
  report: r => showReport(r),
  // hooks the headless smoke harness drives (test/ui.smoke.mjs)
  frame: t => frame(t),
  tickMinutes: n => tick(S, n),
  mapMode: () => (realMap ? "real" : "canvas"),
  planner: () => planner,
  routeCards,
  chosenOption: () => chosenCard()?.opt || null,
  truckCap: tr => TRUCK_TYPES[tr.type].cap,
  // The drawn route must come from the SELECTED option, never from option 0.
  plannerGeometryMatchesChoice: () => {
    if (!planner) return false;
    const i = planner.choice, drawn = currentRealGeometry();
    const real = planner.realRoutes?.[i];
    if (real) return drawn === real.geometry;
    return JSON.stringify(drawn) === JSON.stringify(simPathGeometry(planner.opts[i].path));
  },
  settled: () => realRoutesInFlight || Promise.resolve(),
  passportRoads: () => PASSPORT_ROADS,
  saveKey: () => CFG.SAVE_KEY,
  save: () => save(),
  load: raw => deserialize(raw),
};
boot();
wireTop();
const sideEl = $("#side");
sideEl.addEventListener("pointerdown", () => { sideLockUntil = performance.now() + 1500; });
sideEl.addEventListener("pointerup", () => { sideLockUntil = performance.now() + 500; });
// Momentum scrolling keeps moving after your finger lifts, so hold the panel still for a
// beat after the LAST scroll event, not just while touching it.
sideEl.addEventListener("scroll", () => { lastSideScroll = performance.now(); }, true);
sideEl.addEventListener("touchstart", () => { sideLockUntil = performance.now() + 2000; }, { passive: true });
sideEl.addEventListener("touchend", () => { sideLockUntil = performance.now() + 1200; }, { passive: true });
renderSide();
if (!localStorage.getItem(CFG.SAVE_KEY + "_seen")) {
  localStorage.setItem(CFG.SAVE_KEY + "_seen", "1");
  $("#helpBtn").click();
}
