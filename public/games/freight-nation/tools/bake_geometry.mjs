// BAKE v3: real highway centerlines from OpenStreetMap, LEG-SEQUENCED so every edge follows
// exactly the freeways it is named for, in order (an "I-405" edge may never borrow the 605;
// "I-605/I-5" runs the 605 first, joins the 5 at their real interchange, then rides the 5).
// Run: node tools/bake_geometry.mjs   (fetches cached in tools/cache/, keyed by query hash)
// Road data © OpenStreetMap contributors (ODbL) — attribution shown in the game footer.
import { NODES, EDGES, edgeKey } from "../src/data.mjs";
import fs from "node:fs";
import path from "node:path";

const CACHE = new URL("./cache/", import.meta.url).pathname;
fs.mkdirSync(CACHE, { recursive: true });
const UA = "RouteDispatcher-bake/1.0 (personal game project; one-time bake)";

// legs are ordered from the EDGES entry's `a` city to its `b` city.
// Each leg lists acceptable OSM ref spellings for ONE named highway.
const CORRIDORS = {
  "LGB|LKW": { pad: 0.12, legs: [["I 405"]] },                       // a=LKW per EDGES
  "LA|LKW":  { pad: 0.12, legs: [["I 605"], ["I 5"]] },              // a=LKW: 605 then the 5
  "LA|LGB":  { pad: 0.12, legs: [["I 710"]] },
  "ANA|LKW": { pad: 0.12, legs: [["CA 91", "SR 91"]] },
  "LGB|SNA": { pad: 0.12, legs: [["CA 22", "SR 22"]] },
  "ANA|LA":  { pad: 0.12, legs: [["I 5"]] },
  "ANA|SNA": { pad: 0.1,  legs: [["I 5"]] },
  "ANA|RIV": { pad: 0.15, legs: [["CA 91", "SR 91"]] },
  "ANA|SBD": { pad: 0.2,  legs: [["CA 57", "SR 57"], ["I 10"]] },    // 57 to Pomona, 10 east
  "LA|RIV":  { pad: 0.15, legs: [["CA 60", "SR 60"]] },
  "RIV|SBD": { pad: 0.12, legs: [["I 215"]] },
  "LA|SBD":  { pad: 0.15, legs: [["I 10"]] },
  "SD|SNA":  { pad: 0.2,  legs: [["I 5"]] },                          // a=SNA
  "RIV|SD":  { pad: 0.25, legs: [["I 15", "I 215"]] },                // 15/215 corridor
  "LA|SB":   { pad: 0.2,  legs: [["US 101"]] },
  "SB|SLO":  { pad: 0.25, legs: [["US 101"]] },
  "SAL|SLO": { pad: 0.3,  legs: [["US 101"]] },
  "SAL|SJ":  { pad: 0.2,  legs: [["US 101"]] },
  "SF|SJ":   { pad: 0.15, legs: [["US 101"]] },
  "BAK|LA":  { pad: 0.3,  legs: [["I 5"]] },
  "BAK|FRS": { pad: 0.25, legs: [["CA 99", "SR 99"]] },
  "FRS|STK": { pad: 0.25, legs: [["CA 99", "SR 99"]] },
  "BAK|STK": { pad: 0.45, legs: [["CA 58", "SR 58", "I 5"]] },       // 58 west joins the lonely 5 north (one soup: 58-east dead-ends, no wrong-road risk)
  "FRS|SJ":  { pad: 0.3,  legs: [["CA 99", "SR 99"], ["CA 152", "SR 152"], ["US 101"]] },
  "OAK|SJ":  { pad: 0.12, legs: [["I 880"]] },
  "OAK|SF":  { pad: 0.1,  legs: [["I 80"]] },
  "OAK|STK": { pad: 0.18, legs: [["I 5"], ["I 205"], ["I 580"]] },   // a=STK
  "OAK|SAC": { pad: 0.2,  legs: [["I 80"]] },
  "SAC|STK": { pad: 0.12, legs: [["I 5", "CA 99", "SR 99"]] },
  "RED|SAC": { pad: 0.3,  legs: [["I 5"]] },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const qhash = s => { let h = 0; for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return h.toString(36); };
async function overpass(query, cacheName) {
  const file = path.join(CACHE, cacheName + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status === 504) { console.log(`  (busy ${res.status}, retry ${attempt})`); await sleep(8000 * attempt); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      fs.writeFileSync(file, JSON.stringify(json));
      await sleep(2500);
      return json;
    } catch (e) {
      console.log(`  (attempt ${attempt} failed: ${e.message})`);
      await sleep(5000 * attempt);
    }
  }
  return null;
}

const distMi = (a, b) => {
  const dx = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180) * 69.17;
  const dy = (a[1] - b[1]) * 69.05;
  return Math.hypot(dx, dy);
};

function simplify(pts, eps) {
  if (pts.length <= 2) return pts;
  const d2seg = (p, a, b) => {
    const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2));
    return Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t));
  };
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = d2seg(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

// ---- graph of ONE leg's ways (dual carriageways stitched, single named highway only)
function buildGraph(ways) {
  const keyOf = p => p[0].toFixed(4) + "," + p[1].toFixed(4);
  const adj = new Map(), coord = new Map();
  const addEdge = (p1, p2, w) => {
    const k1 = keyOf(p1), k2 = keyOf(p2);
    coord.set(k1, p1); coord.set(k2, p2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push([k2, w]); adj.get(k2).push([k1, w]);
  };
  for (const way of ways) {
    const g = way.geometry || [];
    for (let i = 0; i < g.length - 1; i++) {
      const p1 = [g[i].lon, g[i].lat], p2 = [g[i + 1].lon, g[i + 1].lat];
      addEdge(p1, p2, distMi(p1, p2));
    }
  }
  // stitch carriageways/gaps within THIS highway only (penalized so real road wins)
  const cell = 0.004;
  const grid = new Map();
  for (const [kk, c] of coord) {
    const gk = Math.floor(c[0] / cell) + ":" + Math.floor(c[1] / cell);
    if (!grid.has(gk)) grid.set(gk, []);
    grid.get(gk).push(kk);
  }
  for (const [kk, c] of coord) {
    const gx = Math.floor(c[0] / cell), gy = Math.floor(c[1] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const ok of grid.get((gx + dx) + ":" + (gy + dy)) || []) {
        if (ok <= kk) continue;
        const d = distMi(c, coord.get(ok));
        if (d < 0.16) { adj.get(kk).push([ok, d * 4 + 0.02]); adj.get(ok).push([kk, d * 4 + 0.02]); }
      }
    }
  }
  // largest connected component (stray tagged fragments must not capture endpoints)
  const compOf = new Map();
  let compId = 0;
  for (const start of adj.keys()) {
    if (compOf.has(start)) continue;
    compId++;
    const stack = [start];
    while (stack.length) {
      const u = stack.pop();
      if (compOf.has(u)) continue;
      compOf.set(u, compId);
      for (const [v] of adj.get(u)) if (!compOf.has(v)) stack.push(v);
    }
  }
  const sizes = new Map();
  for (const c of compOf.values()) sizes.set(c, (sizes.get(c) || 0) + 1);
  const bigComp = sizes.size ? [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  const nearest = p => {
    let best = null, bd = Infinity;
    for (const [kk, c] of coord) {
      if (compOf.get(kk) !== bigComp) continue;
      const d = distMi(p, c);
      if (d < bd) { bd = d; best = kk; }
    }
    return [best, bd];
  };
  return { adj, coord, compOf, bigComp, nearest, grid, cell };
}

// closest pair of points between two leg graphs (their real interchange), main components only
function closestPair(gA, gB) {
  let best = null, bd = Infinity;
  for (const [ka, ca] of gA.coord) {
    if (gA.compOf.get(ka) !== gA.bigComp) continue;
    const gx = Math.floor(ca[0] / gB.cell), gy = Math.floor(ca[1] / gB.cell);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      for (const kb of gB.grid.get((gx + dx) + ":" + (gy + dy)) || []) {
        if (gB.compOf.get(kb) !== gB.bigComp) continue;
        const d = distMi(ca, gB.coord.get(kb));
        if (d < bd) { bd = d; best = [ka, kb]; }
      }
    }
  }
  return best ? [best[0], best[1], bd] : null;
}

function dijkstra(g, srcK, dstK) {
  const dist = new Map([[srcK, 0]]), prev = new Map();
  const heap = [[0, srcK]];
  const hpush = it => {
    heap.push(it);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const hpop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const done = new Set();
  while (heap.length) {
    const [d, u] = hpop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === dstK) break;
    for (const [v, w] of g.adj.get(u) || []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); hpush([nd, v]); }
    }
  }
  if (!done.has(dstK)) return null;
  const line = [];
  let cur = dstK;
  while (cur) { line.unshift(g.coord.get(cur)); cur = prev.get(cur); }
  return { line, mi: dist.get(dstK) };
}

const listRe = refs => new RegExp("(^|;\\s*)(" + refs.join("|") + ")(\\s*;|$)");
const soupOf = (elements, refs) => {
  const re = listRe(refs);
  return elements.filter(w => w.type === "way" && w.tags && w.tags.ref && re.test(w.tags.ref));
};

// ---------------------------------------------------------------- corridors
const GEOM = {};
const report = [];
for (const e of EDGES) {
  const kk = edgeKey(e.a, e.b);
  const spec = CORRIDORS[kk];
  if (!spec) { console.log(`SKIP ${kk}`); continue; }
  const A = NODES[e.a], B = NODES[e.b];
  const south = Math.min(A.lat, B.lat) - spec.pad, north = Math.max(A.lat, B.lat) + spec.pad;
  const west = Math.min(A.lon, B.lon) - spec.pad, east = Math.max(A.lon, B.lon) + spec.pad;
  const allRefs = [...new Set(spec.legs.flat())];
  const refRe = "(^|;[ ]*)(" + allRefs.join("|") + ")([ ]*;|$)";
  const q = `[out:json][timeout:60];way["highway"~"motorway|trunk|primary"]["ref"~"${refRe}"](${south},${west},${north},${east});out geom;`;
  console.log(`${kk} (${e.hwy}) …`);
  const json = await overpass(q, kk.replace("|", "_") + "_" + qhash(q));
  if (!json || !json.elements || !json.elements.length) { console.log(`  ✗ no data`); report.push([kk, "NO DATA"]); continue; }
  // build one graph per leg, then route leg-by-leg through real interchanges
  const graphs = spec.legs.map(refs => buildGraph(soupOf(json.elements, refs)));
  if (graphs.some(gg => !gg.bigComp)) { console.log(`  ✗ empty leg soup`); report.push([kk, "EMPTY LEG"]); continue; }
  let ok = true, full = [], totMi = 0, note = [];
  let srcK = graphs[0].nearest([A.lon, A.lat])[0];
  for (let i = 0; i < graphs.length && ok; i++) {
    const gi = graphs[i];
    let dstK, nextSrcK = null;
    if (i === graphs.length - 1) dstK = gi.nearest([B.lon, B.lat])[0];
    else {
      const jn = closestPair(gi, graphs[i + 1]);
      if (!jn) { ok = false; note.push(`no junction leg${i}`); break; }
      dstK = jn[0]; nextSrcK = jn[1];
    }
    const r = dijkstra(gi, srcK, dstK);
    if (!r) { ok = false; note.push(`no path leg${i}`); break; }
    full = full.concat(r.line);
    totMi += r.mi;
    srcK = nextSrcK;
  }
  if (!ok) { console.log(`  ✗ ${note.join(",")}`); report.push([kk, "FAIL " + note.join(",")]); continue; }
  let line = simplify(full, 0.0035);
  line = [[A.lon, A.lat], ...line, [B.lon, B.lat]];
  GEOM[kk] = line.map(p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]);
  report.push([kk, `${line.length} pts · data ${e.mi}mi vs real ~${Math.round(totMi)}mi`]);
  console.log(`  ✓ ${line.length} pts · data ${e.mi}mi vs real ~${Math.round(totMi)}mi`);
}

// ---------------------------------------------------------------- FULL freeway network (base map layer)
// Every highway's COMPLETE real line, end to end — the 405 runs Irvine→San Fernando, the 605
// runs Seal Beach→Duarte — drawn as the map itself. Game corridors are logic on top.
const NETWORK_REFS = {
  "I-5": ["I 5"], "I-10": ["I 10"], "I-15": ["I 15"], "I-80": ["I 80"],
  "I-205": ["I 205"], "I-215": ["I 215"], "I-405": ["I 405"], "I-580": ["I 580"],
  "I-605": ["I 605"], "I-710": ["I 710"], "I-880": ["I 880"],
  "I-210": ["I 210"], "I-110": ["I 110"], "I-105": ["I 105"], // context-only (no game edges)
  "US-101": ["US 101"],
  "CA-22": ["CA 22", "SR 22"], "CA-57": ["CA 57", "SR 57"], "CA-58": ["CA 58", "SR 58"],
  "CA-60": ["CA 60", "SR 60"], "CA-91": ["CA 91", "SR 91"], "CA-99": ["CA 99", "SR 99"],
  "CA-152": ["CA 152", "SR 152"],
};
const BG_ONLY = new Set(["I-210", "I-110", "I-105"]);

// merge ways that share endpoint NODES into long chains. Exact 4-decimal keys: each
// carriageway assembles into its own full-length chain (dual carriageways stay separate,
// which is fine — they overlap visually). Longest-first greedy, prefer long continuations.
function mergeChains(segs) {
  const key = p => p[0].toFixed(4) + "," + p[1].toFixed(4);
  const segLen = sg => { let L = 0; for (let i = 0; i < sg.length - 1; i++) L += Math.hypot(sg[i + 1][0] - sg[i][0], sg[i + 1][1] - sg[i][1]); return L; };
  const ends = new Map();
  segs.forEach((sg, i) => {
    for (const kk of [key(sg[0]), key(sg[sg.length - 1])]) {
      if (!ends.has(kk)) ends.set(kk, []);
      ends.get(kk).push(i);
    }
  });
  const used = new Set();
  const order = segs.map((sg, i) => i).sort((a, b) => segLen(segs[b]) - segLen(segs[a]));
  const chains = [];
  for (const i0 of order) {
    if (used.has(i0)) continue;
    used.add(i0);
    let chain = [...segs[i0]];
    for (const tail of [true, false]) {
      let grew = true;
      while (grew) {
        grew = false;
        const endPt = tail ? chain[chain.length - 1] : chain[0];
        const cands = (ends.get(key(endPt)) || []).filter(j => !used.has(j))
          .sort((a, b) => segLen(segs[b]) - segLen(segs[a]));
        for (const j of cands) {
          let sg = segs[j];
          if (key(sg[sg.length - 1]) === key(endPt)) sg = [...sg].reverse();
          if (key(sg[0]) !== key(endPt)) continue; // orientation mismatch: leave for another chain
          used.add(j);
          if (tail) chain = [...chain, ...sg.slice(1)];
          else chain = [...[...sg].reverse().slice(0, -1), ...chain];
          grew = true;
          break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

const NETWORK = {};
for (const [name, refs] of Object.entries(NETWORK_REFS)) {
  const refRe = "(^|;[ ]*)(" + refs.join("|") + ")([ ]*;|$)";
  const q = `[out:json][timeout:120];way["highway"~"motorway|trunk"]["ref"~"${refRe}"](32.3,-124.6,41.3,-114.0);out geom;`;
  const json = await overpass(q, "net_" + name.replace(/[^A-Za-z0-9]/g, "") + "_" + qhash(q));
  if (!json || !json.elements) { console.log(`NET ${name}: ✗ no data`); continue; }
  let raw = [];
  for (const w of json.elements) {
    if (!w.geometry || w.geometry.length < 2) continue;
    raw.push(w.geometry.map(gp => [gp.lon, gp.lat]));
  }
  const chains = mergeChains(raw);
  const segs = [];
  for (const ch of chains) {
    const sm = simplify(ch, 0.005).map(p => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3]);
    const out = [sm[0]];
    for (const p of sm.slice(1)) {
      const l = out[out.length - 1];
      if (p[0] !== l[0] || p[1] !== l[1]) out.push(p);
    }
    if (out.length >= 2) segs.push(out);
  }
  // drop micro-fragments (old alignments, tiny ramps caught by ref tags)
  const lenOf = sg => { let L = 0; for (let i = 0; i < sg.length - 1; i++) L += distMi(sg[i], sg[i + 1]); return L; };
  const kept = segs.filter(sg => lenOf(sg) > 2).sort((a, b) => lenOf(b) - lenOf(a)).slice(0, 40);
  // DEDUPE CARRIAGEWAYS: the opposite direction runs ~50-200m parallel — drawing both doubles
  // the ink and doubles the labels. Keep a chain only if it covers ground the kept set doesn't.
  const d2segDeg = (p, a, b) => {
    const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2));
    return Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * t), p[1] - (a[1] + (b[1] - a[1]) * t));
  };
  const nearKept = (p, keptChains) => {
    for (const kc of keptChains) {
      for (let i = 0; i < kc.length - 1; i++) if (d2segDeg(p, kc[i], kc[i + 1]) < 0.004) return true;
    }
    return false;
  };
  const deduped = [];
  for (const ch of kept) {
    let dup = 0;
    for (const p of ch) if (nearKept(p, deduped)) dup++;
    if (ch.length && dup / ch.length > 0.7) continue; // it's the other carriageway
    deduped.push(ch);
  }
  NETWORK[name] = { bg: BG_ONLY.has(name) || undefined, segs: deduped };
  console.log(`NET ${name}: ${raw.length} ways → ${kept.length} chains → ${deduped.length} after carriageway dedupe`);
}

// ---------------------------------------------------------------- CA boundary
let CA_SHAPE = null;
try {
  const file = path.join(CACHE, "us-states.json");
  let states;
  if (fs.existsSync(file)) states = JSON.parse(fs.readFileSync(file, "utf8"));
  else {
    const res = await fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json", { headers: { "User-Agent": UA } });
    states = await res.json();
    fs.writeFileSync(file, JSON.stringify(states));
  }
  const ca = states.features.find(f => f.properties.name === "California");
  let rings = ca.geometry.type === "Polygon" ? [ca.geometry.coordinates[0]] : ca.geometry.coordinates.map(c => c[0]);
  rings.sort((a, b) => b.length - a.length);
  CA_SHAPE = simplify(rings[0], 0.02).map(p => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3]);
  console.log(`CA boundary: ${CA_SHAPE.length} pts`);
} catch (e) { console.log("CA boundary failed:", e.message); }

const out = `// GENERATED by tools/bake_geometry.mjs — real road centerlines & state boundary.
// Road data © OpenStreetMap contributors (ODbL). Boundary: US Census (public domain).
// Do not hand-edit; re-run the bake instead.
export const GEOM = ${JSON.stringify(GEOM)};
export const CA_SHAPE = ${JSON.stringify(CA_SHAPE)};
export const NETWORK = ${JSON.stringify(NETWORK)};
`;
fs.writeFileSync(new URL("../src/geometry.mjs", import.meta.url).pathname, out);
console.log("\n=== BAKE REPORT ===");
for (const [kk, msg] of report) console.log(kk.padEnd(10), msg);
console.log(`geometry.mjs written: ${Object.keys(GEOM).length}/${EDGES.length} corridors, boundary ${CA_SHAPE ? "OK" : "MISSING"}`);
