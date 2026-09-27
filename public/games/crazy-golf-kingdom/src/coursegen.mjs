// CRAZY GOLF KINGDOM — procedural hole generator. Pure + seeded. No hole is hand-built.
import { ghostGolf } from './physics.mjs';
import { buildFinale } from './finales.mjs';

export const KINGDOMS = [
  { id: 'meadow', name: 'Meadow Kingdom', emoji: '🌻', felt: 0x4caf50, feltDark: 0x43a047, wall: 0xe53935, wallTop: 0xff5252,
    sky: [0x8fd3ff, 0xe8f7ff], ground: 0x7cb342, fog: 0xbfe6ff, gravity: 9.8, models: ['windmill', 'mushroom', 'gnome'],
    weights: { bumper: 4, block: 2, windmill: 3, sand: 2, model: 3, boost: 1, spinner: 1, jump: 2 }, desc: 'Sunny greens, red bumpers, and a windmill or three.' },
  { id: 'candy', name: 'Candy Kingdom', emoji: '🍭', felt: 0xf48fb1, feltDark: 0xec7aa4, wall: 0x26c6da, wallTop: 0x80deea,
    sky: [0xffc1e3, 0xfff3fb], ground: 0xf8bbd0, fog: 0xffd6ea, gravity: 9.8, models: ['lollipop', 'gingerbread', 'cupcake'],
    weights: { bumper: 3, boost: 4, syrup: 3, model: 3, block: 1, spinner: 2, teleport: 1, turntable: 2 }, desc: 'Boost pads and sticky syrup. Sweet and fast.' },
  { id: 'dino', name: 'Dino Swamp', emoji: '🦖', felt: 0x8bc34a, feltDark: 0x7cb342, wall: 0x6d4c41, wallTop: 0x8d6e63,
    sky: [0x9ccc65, 0xfff9c4], ground: 0x558b2f, fog: 0xd7e8b0, gravity: 9.8, models: ['trex', 'palm', 'volcano'],
    weights: { water: 4, spinner: 3, model: 3, bumper: 2, sand: 2, block: 1, cannon: 2, jump: 5 }, desc: 'Water hazards, sweeping tails, and a very friendly T-rex.' },
  { id: 'castle', name: 'Haunted Castle', emoji: '🏰', felt: 0x7e57c2, feltDark: 0x6f4bb5, wall: 0x546e7a, wallTop: 0x78909c,
    sky: [0x2c1a4d, 0x6a3fa0], ground: 0x37294f, fog: 0x4a3270, gravity: 9.8, models: ['tower', 'ghost', 'pumpkin'],
    weights: { mover: 4, teleport: 3, model: 3, block: 2, bumper: 2, windmill: 1, cannon: 1, turntable: 2 }, desc: 'Moving walls and spooky portals after dark.' },
  { id: 'space', name: 'Space Station', emoji: '🚀', felt: 0x263c6b, feltDark: 0x1e3059, wall: 0x00e5ff, wallTop: 0x84ffff,
    sky: [0x03060f, 0x121a3a], ground: 0x0b1024, fog: 0x0b1024, gravity: 4.9, models: ['ufo', 'rocket', 'alien'],
    weights: { ice: 4, cannon: 3, bumper: 3, model: 3, mover: 2, teleport: 2, boost: 1, turntable: 3, jump: 4 }, desc: 'Low gravity, ice, and cannons. Nothing stops rolling.' },
];
export const kingdomById = (id) => KINGDOMS.find(k => k.id === id) || KINGDOMS[0];

// ---------- seeded rng ----------
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const weighted = (rng, w) => { let tot = 0; for (const k in w) tot += w[k]; let r = rng() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; };
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const key = (x, z) => x + ',' + z;

// ---------- path ----------
function buildPath(rng, length) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const path = [{ x: 0, z: 0 }]; const used = new Set([key(0, 0)]); let dir = 0;
    let ok = true;
    for (let i = 1; i < length; i++) {
      const opts = [];
      for (const cand of [dir, (dir + 1) % 4, (dir + 3) % 4]) {
        const [dx, dz] = DIRS[cand]; const nx = path[i - 1].x + dx, nz = path[i - 1].z + dz;
        if (used.has(key(nx, nz))) continue;
        // keep the path readable: the new tile may only touch the tile we came from
        let touches = 0; for (const [ax, az] of DIRS) if (used.has(key(nx + ax, nz + az))) touches++;
        if (touches > 1) continue;
        opts.push({ cand, nx, nz, w: cand === dir ? 0.62 : 0.19 });
      }
      if (!opts.length) { ok = false; break; }
      let r = rng() * opts.reduce((s, o) => s + o.w, 0); let sel = opts[0];
      for (const o of opts) { r -= o.w; if (r <= 0) { sel = o; break; } }
      dir = sel.cand; path.push({ x: sel.nx, z: sel.nz }); used.add(key(sel.nx, sel.nz));
    }
    if (ok) return path;
  }
  return null;
}

// straight runs: arrays of consecutive indexes sharing a direction
function runs(path) {
  const out = []; let cur = [0];
  for (let i = 1; i < path.length; i++) {
    const d = key(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    const pd = i > 1 ? key(path[i - 1].x - path[i - 2].x, path[i - 1].z - path[i - 2].z) : d;
    if (d === pd) cur.push(i); else { out.push(cur); cur = [i - 1, i]; }
  }
  out.push(cur); return out.filter(r => r.length >= 2);
}
const dirOf = (a, b) => b.x > a.x ? 'x' : b.x < a.x ? '-x' : b.z > a.z ? 'z' : '-z';

// ---------- generate ----------
export function generateHole({ kingdom = 'meadow', index = 0, seed = 1, difficulty = null } = {}) {
  const K = kingdomById(kingdom);
  const diff = difficulty == null ? index : difficulty;    // 0..8
  for (let attempt = 0; attempt < 30; attempt++) {
    const rng = makeRng(seed * 7919 + attempt * 104729 + hashStr(kingdom) + index * 31);
    const length = Math.min(22, 6 + Math.floor(diff * 1.6) + Math.floor(rng() * 4));
    const path = buildPath(rng, length); if (!path) continue;
    const tiles = new Map(); const setTile = (x, z, t) => tiles.set(key(x, z), { x, z, height: 0, surface: 'felt', ...t });
    for (const p of path) setTile(p.x, p.z, {});
    const tee = path[0], cup = path[path.length - 1];
    const R = runs(path);
    const rampTiles = new Set(); let h = 0;
    // elevation: one ramp on a long straight run (never first/last two tiles)
    if (diff >= 1 && rng() < (diff >= 3 ? 0.55 : 0.3)) {
      const cands = R.filter(r => r.length >= 4 && r[0] >= 1 && r[r.length - 1] <= path.length - 3);
      if (cands.length) {
        const r = pick(rng, cands); const i = r[1 + Math.floor(rng() * (r.length - 2))];
        const up = rng() < 0.6 ? 0.45 : -0.45; const dir = dirOf(path[i - 1], path[i]);
        tiles.get(key(path[i].x, path[i].z)).ramp = { dir, from: h, to: h + up }; rampTiles.add(i);
        for (let j = i + 1; j < path.length; j++) tiles.get(key(path[j].x, path[j].z)).height = h + up;
        h += up;
      }
    }
    // widening: side strips along straight runs (skip ramp tiles + tee/cup)
    const wide = new Set();
    for (const r of R) {
      if (r.length < 3 || rng() > 0.4) continue;
      const a = path[r[0]], b = path[r[1]]; const horiz = a.z === b.z; const side = rng() < 0.5 ? 1 : -1;
      for (const i of r) {
        if (rampTiles.has(i) || i === 0 || i === path.length - 1) continue;
        const p = path[i]; const sx = horiz ? p.x : p.x + side, sz = horiz ? p.z + side : p.z;
        if (tiles.has(key(sx, sz))) continue;
        // don't let the strip touch other path tiles (keeps corridors readable)
        let bad = false; for (const [dx, dz] of DIRS) { const k2 = key(sx + dx, sz + dz); if (tiles.has(k2) && k2 !== key(p.x, p.z)) { const tt = tiles.get(k2); if (!(tt._side)) bad = true; } }
        if (bad) continue;
        setTile(sx, sz, { height: tiles.get(key(p.x, p.z)).height, _side: true, _of: i }); wide.add(i);
      }
    }
    // obstacles
    const budget = Math.min(5, 1 + Math.floor(diff / 2) + (diff >= 6 ? 1 : 0));
    const obstacles = []; const gaps = []; const taken = new Set([0, 1, path.length - 2, path.length - 1]);
    for (const i of rampTiles) { taken.add(i - 1); taken.add(i); taken.add(i + 1); }
    const free = () => path.map((_, i) => i).filter(i => !taken.has(i));
    let guard = 0;
    while (obstacles.length < budget && guard++ < 40) {
      const type = weighted(rng, K.weights);
      const cands = free(); if (!cands.length) break;
      const i = pick(rng, cands); const p = path[i]; const tile = tiles.get(key(p.x, p.z));
      const d = dirOf(path[i - 1], p); const along = d === 'x' || d === '-x';
      const sign = (d === 'x' || d === 'z') ? 1 : -1;
      const add = (o) => { obstacles.push({ x: p.x, z: p.z, ...o }); taken.add(i); taken.add(i - 1); taken.add(i + 1); };
      switch (type) {
        case 'bumper': {
          if (wide.has(i)) { const s = tiles.get(key(p.x, p.z)); add({ type: 'bumper', dx: along ? 0 : 0.35, dz: along ? 0.35 : 0, r: 0.3 }); obstacles.push({ x: p.x, z: p.z, type: 'bumper', dx: along ? 0 : -0.35, dz: along ? -0.35 : 0, r: 0.3 }); void s; }
          else add({ type: 'bumper', dx: 0, dz: 0, r: 0.3 });
          break; }
        case 'block': add({ type: 'block', w: along ? 0.5 : 0.28, d: along ? 0.28 : 0.5 }); break;
        case 'windmill': add({ type: 'windmill', speed: 0.9 + rng() * 0.8 + diff * 0.05, phase: rng() * 6.28 }); break;
        case 'spinner': add({ type: 'spinner', speed: 1.6 + rng() * 1.2, phase: rng() * 6.28 }); break;
        case 'mover': add({ type: 'mover', axis: along ? 'z' : 'x', amp: 0.55, speed: 1.0 + rng() * 0.8, phase: rng() * 6.28 }); break;
        case 'boost': add({ type: 'boost', dirx: along ? sign : 0, dirz: along ? 0 : sign, strength: 7 }); break;
        case 'sand': case 'ice': case 'syrup': { tile.surface = type; const n = path[i + 1]; if (n && !taken.has(i + 1)) tiles.get(key(n.x, n.z)).surface = type; taken.add(i); obstacles.push({ x: p.x, z: p.z, type: 'patch', surface: type }); break; }
        case 'water': add({ type: 'water', r: wide.has(i) ? 0.34 : 0.25 }); break;
        case 'model': add({ type: 'model', model: pick(rng, K.models), r: 0.5, rot: rng() * 6.28 }); break;
        case 'turntable': { if (wide.has(i)) { guard++; break; } add({ type: 'turntable', omega: (rng() < 0.5 ? 1 : -1) * (1.3 + rng() * 0.8 + diff * 0.05) }); break; }
        case 'jump': { // pad at j, GAP at j+1, landing at j+2 — scan every free index for a straight, 1-wide, flat run
          let placed = false;
          for (const j of cands) {
            if (j < 2 || j + 3 >= path.length - 1) continue;
            const q = path[j], n1 = path[j + 1], n2 = path[j + 2], n3 = path[j + 3]; if (taken.has(j + 1) || taken.has(j + 2) || taken.has(j + 3)) continue;
            const dj = dirOf(path[j - 1], q); if (dirOf(q, n1) !== dj || dirOf(n1, n2) !== dj) continue;
            const tq = tiles.get(key(q.x, q.z)); const flat = [q, n1, n2].every(r => { const t = tiles.get(key(r.x, r.z)); return t && !t.ramp && t.height === tq.height; }); if (!flat) continue;
            let ok = true; for (const [dx, dz] of DIRS) { const k2 = key(n1.x + dx, n1.z + dz); if (tiles.has(k2) && k2 !== key(q.x, q.z) && k2 !== key(n2.x, n2.z)) ok = false; }
            if (!ok || wide.has(j) || wide.has(j + 2)) continue;
            const aj = dj === 'x' || dj === '-x'; const sj = (dj === 'x' || dj === 'z') ? 1 : -1;
            tiles.delete(key(n1.x, n1.z)); gaps.push({ x: n1.x, z: n1.z });
            obstacles.push({ x: q.x, z: q.z, type: 'jump', dirx: aj ? sj : 0, dirz: aj ? 0 : sj, tx: n2.x, tz: n2.z, vy: 4.2, minSpeed: 4.6 });
            for (const t of [j - 1, j, j + 1, j + 2, j + 3]) taken.add(t); placed = true; break;
          }
          if (!placed) guard++; break; }
        case 'cannon': {
          const j = i + 3 + Math.floor(rng() * 3); if (j >= path.length - 1 || taken.has(j)) { guard++; break; }
          const tgt = path[j]; add({ type: 'cannon', tx: tgt.x, tz: tgt.z, aim: Math.atan2(tgt.z - p.z, tgt.x - p.x) }); taken.add(j); break; }
        case 'teleport': {
          const j = i + 3 + Math.floor(rng() * 4); if (j >= path.length - 1 || taken.has(j)) { guard++; break; }
          const tgt = path[j]; add({ type: 'teleport', tx: tgt.x, tz: tgt.z, id: obstacles.length });
          obstacles.push({ x: tgt.x, z: tgt.z, type: 'portal_exit', id: obstacles.length - 1 }); taken.add(j); taken.add(j + 1); break; }
      }
    }
    // decorative guardians on the outside edge (no collision) — one or two per hole
    for (const g of gaps) tiles.set(key(g.x, g.z), { x: g.x, z: g.z, _gap: true });
    const decor = [];
    const nDecor = 1 + (rng() < 0.6 ? 1 : 0);
    for (let n = 0; n < nDecor; n++) {
      const i = 2 + Math.floor(rng() * Math.max(1, path.length - 4)); const p = path[i];
      for (const [dx, dz] of [[2, 1], [-2, 1], [1, 2], [-1, 2], [2, -1], [-2, -1], [1, -2], [-1, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
        const qx = p.x + dx, qz = p.z + dz; let near = false;
        for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) if (tiles.has(key(qx + ax, qz + az))) near = true;
        if (!near && !decor.some(q => q.x === qx && q.z === qz)) { decor.push({ x: qx, z: qz, model: pick(rng, K.models), rot: rng() * 6.28, scale: 1.0 }); break; }
      }
    }
    const turns = R.length - 1;
    let par = 2 + (path.length >= 10 ? 1 : 0) + (path.length >= 16 ? 1 : 0) + (obstacles.filter(o => o.type !== 'patch' && o.type !== 'portal_exit').length >= 3 ? 1 : 0) + (turns >= 4 ? 1 : 0);
    par = Math.max(2, Math.min(5, par));
    const tl = [...tiles.values()].filter(t => !t._gap).map(t => { const { _side, _of, ...rest } = t; return rest; });
    const xs = tl.map(t => t.x), zs = tl.map(t => t.z);
    const hole = { kingdom: K.id, index, seed, attempt, tiles: tl, tee, cup, obstacles, gaps, decor, par, gravity: K.gravity, path,
                   bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
    // prove it: the ghost must finish within par+3
    const g = ghostGolf(hole, par + 3);
    if (!g.holed) continue;
    hole.ghostStrokes = g.strokes;
    return hole;
  }
  // fallback: a plain straight hole (always completable)
  const tiles = []; for (let i = 0; i < 6; i++) tiles.push({ x: i, z: 0, height: 0, surface: 'felt' });
  return { kingdom: K.id, index, seed, attempt: -1, tiles, tee: { x: 0, z: 0 }, cup: { x: 5, z: 0 }, obstacles: [], gaps: [], decor: [], par: 2, gravity: K.gravity, path: tiles.map(t => ({ x: t.x, z: t.z })), bounds: { minX: 0, maxX: 5, minZ: 0, maxZ: 0 }, ghostStrokes: 1 };
}

export function generateCourse({ kingdom = 'meadow', seed = 1, holes = 9, finale = true } = {}) {
  const out = []; for (let i = 0; i < holes; i++) out.push(finale && i === holes - 1 ? (buildFinale(kingdom, kingdomById(kingdom)) || generateHole({ kingdom, index: i, seed: seed + i * 17 })) : generateHole({ kingdom, index: i, seed: seed + i * 17 }));
  return out;
}
export function dailySeed(date = new Date()) {
  const s = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  return hashStr('cgk-daily-' + s);
}
export function generateAceHole(date = new Date()) {
  const seed = hashStr('cgk-ace-' + dailySeed(date)); const rng = makeRng(seed);
  const k = KINGDOMS[Math.floor(rng() * KINGDOMS.length)].id;
  return generateHole({ kingdom: k, index: 0, seed, difficulty: 1 + Math.floor(rng() * 3) });
}
export function generateDaily(date = new Date()) {
  const seed = dailySeed(date); const rng = makeRng(seed); const out = [];
  for (let i = 0; i < 9; i++) { const k = KINGDOMS[Math.floor(rng() * KINGDOMS.length)].id; out.push(generateHole({ kingdom: k, index: i, seed: seed + i * 131, difficulty: Math.min(8, 1 + i) })); }
  return out;
}
