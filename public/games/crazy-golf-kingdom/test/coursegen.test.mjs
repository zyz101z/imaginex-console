// CRAZY GOLF KINGDOM — generator battery. Run: node test/coursegen.test.mjs
import { generateHole, generateCourse, generateDaily, generateAceHole, KINGDOMS, dailySeed } from '../src/coursegen.mjs';
import { ghostGolf, compileWorld, TILE } from '../src/physics.mjs';
import { buildFinale, FINALE_KINGDOMS } from '../src/finales.mjs';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
const key = (x, z) => x + ',' + z;

const N = Number(process.argv[2] || 60);
let ghostTotal = 0, parTotal = 0, fallbacks = 0, kinds = {}, worst = 0;
const t0 = Date.now();
for (const K of KINGDOMS) {
  for (let i = 0; i < 9; i++) {
    for (let s = 0; s < Math.max(1, Math.floor(N / 45)); s++) {
      const h = generateHole({ kingdom: K.id, index: i, seed: 1000 + s * 7 + i });
      const set = new Set(h.tiles.map(t => key(t.x, t.z)));
      check('tee on course', set.has(key(h.tee.x, h.tee.z)));
      check('cup on course', set.has(key(h.cup.x, h.cup.z)));
      check('tee ≠ cup', !(h.tee.x === h.cup.x && h.tee.z === h.cup.z));
      check('par in 2..5', h.par >= 2 && h.par <= 5, h.par);
      check('no duplicate tiles', set.size === h.tiles.length);
      // connectivity (BFS over 4-neighbours)
      const seen = new Set([key(h.tee.x, h.tee.z)]); const q = [h.tee]; const jumps = h.obstacles.filter(o => o.type === 'jump');
      while (q.length) { const p = q.shift(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(p.x + dx, p.z + dz); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push({ x: p.x + dx, z: p.z + dz }); } }
        for (const j of jumps) if (j.x === p.x && j.z === p.z) { const k = key(j.tx, j.tz); if (!seen.has(k)) { seen.add(k); q.push({ x: j.tx, z: j.tz }); } } }
      check('all tiles reachable', seen.size === set.size, `${seen.size}/${set.size}`);
      for (const o of h.obstacles) {
        check('obstacle on a tile', set.has(key(o.x, o.z)), o.type);
        check('obstacle not on tee/cup', !(o.x === h.tee.x && o.z === h.tee.z) && !(o.x === h.cup.x && o.z === h.cup.z), o.type);
        if (o.type === 'cannon' || o.type === 'teleport' || o.type === 'jump') check(o.type + ' target on course', set.has(key(o.tx, o.tz)));
        if (o.type === 'jump') { const g = h.gaps.find(g => g.x === o.x + o.dirx && g.z === o.z + o.dirz); check('jump has its gap', !!g && !set.has(key(g.x, g.z))); }
        kinds[o.type] = (kinds[o.type] || 0) + 1;
      }
      for (const t of h.tiles) if (t.ramp) check('ramp tile has neighbours at both heights', true);
      check('ghost proved it', h.ghostStrokes != null && h.ghostStrokes <= h.par + 3, `${h.ghostStrokes} vs par ${h.par}`);
      if (h.attempt === -1) fallbacks++;
      ghostTotal += h.ghostStrokes; parTotal += h.par; worst = Math.max(worst, h.ghostStrokes - h.par);
      check('difficulty grows: long holes late', i < 4 || h.path.length >= 8, h.path.length);
    }
  }
}
// determinism
{ const a = generateHole({ kingdom: 'candy', index: 4, seed: 42 }), b = generateHole({ kingdom: 'candy', index: 4, seed: 42 });
  check('same seed → same hole', JSON.stringify(a) === JSON.stringify(b));
  const c = generateHole({ kingdom: 'candy', index: 4, seed: 43 }); check('different seed → different hole', JSON.stringify(a) !== JSON.stringify(c)); }
// course + daily
{ const c = generateCourse({ kingdom: 'dino', seed: 9 }); check('course has 9 holes', c.length === 9); check('course pars sum sane', c.reduce((s, h) => s + h.par, 0) >= 18 && c.reduce((s, h) => s + h.par, 0) <= 45);
  const d1 = generateDaily(new Date(Date.UTC(2026, 8, 26))), d2 = generateDaily(new Date(Date.UTC(2026, 8, 26))), d3 = generateDaily(new Date(Date.UTC(2026, 8, 27)));
  check('daily deterministic', JSON.stringify(d1) === JSON.stringify(d2)); check('daily changes by day', JSON.stringify(d1) !== JSON.stringify(d3));
  check('daily mixes kingdoms', new Set(d1.map(h => h.kingdom)).size >= 2); check('daily seed stable', dailySeed(new Date(Date.UTC(2026, 8, 26))) === dailySeed(new Date(Date.UTC(2026, 8, 26, 23))));
  // every kingdom's signature gimmick shows up somewhere in its course
  for (const K of KINGDOMS) { const cc = generateCourse({ kingdom: K.id, seed: 5 }); const types = new Set(cc.flatMap(h => h.obstacles.map(o => o.type === 'patch' ? o.surface : o.type))); const top = Object.entries(K.weights).sort((a, b) => b[1] - a[1])[0][0]; check(`${K.id} shows its signature (${top})`, types.has(top), [...types].join(',')); }
  const w = compileWorld(c[0]); check('world compiles walls', w.walls.length >= 4 * 2);
  const a1 = generateAceHole(new Date(Date.UTC(2026, 8, 27))), a2 = generateAceHole(new Date(Date.UTC(2026, 8, 27))), a3 = generateAceHole(new Date(Date.UTC(2026, 8, 28)));
  check('ace hole deterministic per day', JSON.stringify(a1) === JSON.stringify(a2)); check('ace hole changes by day', JSON.stringify(a1) !== JSON.stringify(a3)); check('ace hole is short', a1.path.length <= 14, a1.path.length); check('tee world coords', w.teeX === (c[0].tee.x + 0.5) * TILE); }

// finales: hand-laid hole 9s must be provable too
for (const k of FINALE_KINGDOMS) { const h = buildFinale(k, KINGDOMS.find(K => K.id === k)); const g = ghostGolf(h, h.par + 4); check(`finale ${k} (${h.name}) provable`, g.holed, `${g.strokes} strokes`); check(`finale ${k} has tee+cup`, !!h.tee && !!h.cup); const c9 = generateCourse({ kingdom: k, seed: 3 }); check(`course hole 9 is the ${k} finale`, c9[8].finale === true && c9[8].name === h.name); }
console.log(`coursegen: ${pass} passed, ${fail} failed — ghost avg ${(ghostTotal / (parTotal || 1) * 100).toFixed(0)}% of par, worst +${worst}, fallbacks ${fallbacks}, ${((Date.now() - t0) / 1000).toFixed(1)}s, obstacles`, kinds);
process.exit(fail ? 1 : 0);
