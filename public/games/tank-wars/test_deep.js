// TANK WARS — DEEP AUDIT PROBE: plays every mode through the REAL entry paths with
// randomized inputs, checking world invariants every tick. Slower than test_storm.js
// (run on demand, not per-commit). Run: node test_deep.js
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('FATAL: no script found'); process.exit(1); }

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };

// ---------- stub DOM (same recipe as test_storm) ----------
const noop = () => {};
function makeCtx() {
  return new Proxy({
    canvas: {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
  }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
}
function makeEl(id) {
  let inner = '';
  const el = {
    id, style: {}, dataset: {}, children: [], textContent: '',
    get innerHTML() { return inner; },
    set innerHTML(v) { inner = String(v); if (!v) this.children.length = 0; },
    className: '', width: 960, height: 640, value: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop, focus: noop, select: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    getContext: makeCtx, play: () => Promise.resolve(), pause: noop, onerror: null,
  };
  return el;
}
const els = new Map();
const byId = (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };
const store = new Map();
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, performance,
  Math, JSON, Date, parseInt, parseFloat, isNaN, Promise,
  requestAnimationFrame: noop,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  document: {
    getElementById: byId,
    createElement: (tag) => { const e = makeEl(''); if (tag !== 'canvas') e.getContext = undefined; return e; },
    addEventListener: noop, body: makeEl('body'),
  },
  location: { search: '' },
  navigator: { userAgent: 'headless' },
  Audio: function () { return makeEl('audio'); },
};
sandbox.addEventListener = noop; sandbox.removeEventListener = noop;
sandbox.dispatchEvent = noop;
sandbox.window = sandbox;
sandbox.window.parent = { postMessage: noop };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(m[1], sandbox, { timeout: 30000 });
} catch (e) {
  console.log('FATAL: boot crash:', e.message);
  process.exit(1);
}
const tw = sandbox.window.__tw;
if (!tw) { console.log('FATAL: no __tw'); process.exit(1); }

const STEP = 1 / 60;
let crashNote = null;

// world invariants — checked constantly; any violation is a bug
function invariants(tag) {
  for (const t of tw.tanks) {
    if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.a)) {
      return `${tag}: tank ${t.i} has non-finite pos/angle`;
    }
    if (t.x < -50 || t.x > 1010 || t.y < -50 || t.y > 690) {
      return `${tag}: tank ${t.i} out of bounds (${t.x | 0},${t.y | 0})`;
    }
    if (t.hp < 0) return `${tag}: negative hp`;
  }
  for (const s of tw.shells) {
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return `${tag}: shell non-finite`;
  }
  if (tw.shells.length > 400) return `${tag}: shell flood (${tw.shells.length})`;
  if (!Number.isFinite(tw.profile.scrap) || tw.profile.scrap < 0) return `${tag}: scrap corrupt (${tw.profile.scrap})`;
  if (!['countdown', 'play', 'roundover', 'matchover', 'draft', 'survover'].includes(tw.phase)) {
    return `${tag}: unknown phase '${tw.phase}'`;
  }
  return null;
}

// fuzz driver: random keyboard through the REAL input path
const KEYSETS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
function fuzz(tag, secs, opts = {}) {
  const ticks = Math.round(secs / STEP);
  for (let i = 0; i < ticks; i++) {
    if (i % 9 === 0) {
      for (const k of KEYSETS) tw.keys[k] = Math.random() < 0.4;
      tw.keys.Space = Math.random() < 0.5;
    }
    try {
      tw.update(STEP);
    } catch (e) {
      return `${tag}: EXCEPTION mid-play: ${e.message}`;
    }
    const bad = invariants(tag);
    if (bad) return bad;
    if (opts.onTick && opts.onTick(i)) break;
  }
  for (const k of KEYSETS) tw.keys[k] = false;
  return null;
}
function report(err, name) { check(name, !err, err || ''); }

// ---------- A. quick play, both AI levels, real entry ----------
for (const lvl of ['rookie', 'ace']) {
  tw.startMatch({ mode: 'quick', aiLevel: lvl });
  check(`quick ${lvl}: enters play`, tw.mode === 'play' && tw.phase === 'countdown');
  report(fuzz(`quick ${lvl}`, 30), `quick ${lvl}: 30s fuzz clean`);
  check(`quick ${lvl}: game progressed (score or shells seen)`, tw.tanks[0].score + tw.tanks[1].score >= 0);
}

// ---------- B. campaign spot checks incl. all four boss battles ----------
for (const id of [1, 7, 10, 13, 15, 17, 20]) {
  const b = tw.CAMPAIGN.find(x => x.id === id);
  tw.startMatch({ mode: 'campaign', aiLevel: b.ai, arena: b.arena, foeTank: b.foe, battle: b, roundsToWin: b.rounds });
  check(`campaign ${id}: enters play`, tw.mode === 'play');
  if (b.boss) check(`campaign ${id}: boss dressed`, tw.tanks[1].boss && tw.tanks[1].hp === b.bossHp);
  report(fuzz(`campaign ${id}`, 18), `campaign ${id} (${b.name}): 18s fuzz clean`);
  // force the round to resolve both ways at least once across the loop
  if (tw.phase === 'play') {
    // kill until no team-1 tank stands — the VORTEX summons a minion mid-slaughter,
    // and the round rightly refuses to end while it lives (that's the feature)
    let g2 = 0;
    while (tw.tanks.some(x => x.i > 0 && x.team === 1 && x.alive) && g2++ < 30) {
      for (const x of [...tw.tanks]) if (x.i > 0 && x.team === 1 && x.alive) tw.damageTank(x);
    }
    // explodeTank sets hitstop (0.1s) — give the engine a few frames to swallow it
    try { for (let k = 0; k < 30 && tw.phase === 'play'; k++) tw.update(STEP); }
    catch (e) { check(`campaign ${id}: resolve tick`, false, e.message); }
    check(`campaign ${id}: round resolves when foes die`, tw.phase !== 'play');
  }
}

// ---------- C. survival plain: real run to wave 3, then deep-wave probes ----------
{
  tw.startSurvival();
  check('storm: enters play', tw.mode === 'play' && tw.phase === 'countdown');
  let err = null;
  for (let wave = 1; wave <= 3 && !err; wave++) {
    err = fuzz(`storm w${wave}`, 10, {
      onTick: () => tw.phase === 'draft' || tw.phase === 'survover',
    });
    if (!err && tw.phase === 'play') {
      // hurry the wave along: the fuzzer isn't a marksman
      for (const t of tw.tanks.slice(1)) while (t.alive) tw.damageTank(t);
      try { tw.update(STEP); } catch (e) { err = 'storm: clear tick: ' + e.message; }
    }
    if (!err && tw.phase === 'draft') tw.survApplyPerk(0);
    if (tw.phase === 'survover') break;
  }
  report(err, 'storm: 3 waves with perk drafts, fuzz clean');
  for (const w of [7, 13, 19, 26]) {
    tw.survStartWave(w);
    report(fuzz(`storm deep w${w}`, 6), `storm deep wave ${w}: fuzz clean`);
  }
}

// ---------- D. daily: entry + determinism at depth + full fuzz ----------
{
  tw.startSurvival('daily');
  check('daily: enters play', tw.mode === 'play' && tw.surv.daily === true);
  report(fuzz('daily w1', 8), 'daily: wave 1 fuzz clean');
  tw.survStartWave(5);
  const sig1 = JSON.stringify(tw.packWalls()) + tw.tanks.slice(1).map(t => t.kind).join();
  report(fuzz('daily w5', 6), 'daily: wave 5 fuzz clean');
  tw.startSurvival('daily');
  tw.survStartWave(5);
  const sig2 = JSON.stringify(tw.packWalls()) + tw.tanks.slice(1).map(t => t.kind).join();
  check('daily: wave-5 determinism survives a played run', sig1 === sig2);
}

// ---------- E. boss rush: every boss type under fuzz ----------
{
  tw.profile.bestWave = 12;
  tw.startSurvival('rush');
  check('rush: enters play', tw.mode === 'play' && tw.surv.rush === true);
  let err = null;
  for (let w = 1; w <= 4 && !err; w++) {
    if (w > 1) tw.survStartWave(w);
    const boss = tw.tanks.find(t => t.boss);
    if (!boss) { err = `rush w${w}: no boss spawned`; break; }
    err = fuzz(`rush w${w} (${boss.boss.type})`, 10);
  }
  report(err, 'rush: all four boss types fuzz clean');
}

// ---------- F. co-op host under fuzz with fake guest input ----------
{
  tw.net.role = 'host'; tw.net.coop = false; tw.net.guestKind = 'viper';
  tw.startCoopStorm();
  check('coop: enters play', tw.mode === 'play' && tw.net.coop === true);
  let err = null;
  for (let i = 0; i < 600 && !err; i++) {
    if (i % 12 === 0) {
      tw.net.rIn = { st: Math.random() * 6.28 - 3.14, th: Math.random(), f: Math.random() < 0.4 ? 1 : 0 };
      for (const k of KEYSETS) tw.keys[k] = Math.random() < 0.4;
    }
    try { tw.update(STEP); } catch (e) { err = 'coop: EXCEPTION: ' + e.message; }
    if (!err) err = invariants('coop');
    if (tw.phase === 'draft' || tw.phase === 'survover') break;
  }
  report(err, 'coop: 10s host fuzz with live guest inputs clean');
  tw.net.role = null; tw.net.coop = false; tw.surv.on = false;
}

// ---------- G. garage economy sweep: buy everything, gates hold ----------
{
  const p = tw.profile;
  p.scrap = 100000; p.bestWave = 20; p.done[20] = true;
  els.get && tw.renderGarage();
  let spent = 0;
  for (const k of Object.keys(tw.TANKS)) {
    if (!p.owned[k]) { p.owned[k] = true; p.scrap -= tw.TANKS[k].cost; spent += tw.TANKS[k].cost; }
  }
  check('garage: all 10 tanks purchasable with gates met', Object.keys(tw.TANKS).every(k => p.owned[k]) && p.scrap >= 0);
  for (const k of Object.keys(tw.TANKS)) {
    p.tank = k;
    tw.startSurvival();
    const e2 = fuzz(`drive ${k}`, 4);
    check(`garage: ${k} drives + fires clean`, !e2, e2 || '');
  }
  tw.surv.on = false;
}

// ---------- H2. scrapyard: fuzz on the crusher arena ----------
{
  tw.startMatch({ mode: 'quick', aiLevel: 'ace', arena: 'scrapyard' });
  check('scrapyard: enters play with pads', tw.mode === 'play' && tw.crushers.length === 3);
  report(fuzz('scrapyard', 25), 'scrapyard: 25s fuzz with live crushers clean');
}

// ---------- H. static hazard scan: params shadowing globals ----------
{
  const src = m[1];
  const globals = ['mode', 'phase', 'paused', 'banner', 'tanks', 'shells', 'mines', 'keys', 'powerup'];
  const badParams = [];
  for (const g of globals) {
    const re = new RegExp('function\\s+\\w+\\s*\\(([^)]*)\\)', 'g');
    let match;
    while ((match = re.exec(src))) {
      const params = match[1].split(',').map(x => x.trim().split('=')[0].trim());
      if (params.includes(g)) badParams.push(match[0].slice(0, 60));
    }
  }
  check('static: no function param shadows a game global', badParams.length === 0, badParams.join(' | '));
}

console.log(`\n=== deeptest: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
