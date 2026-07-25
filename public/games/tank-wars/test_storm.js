// TANK WARS — headless battery for the SURVIVAL (Tank Storm) expansion + regressions.
// Lives NEXT TO the game now (survives scratchpad loss). Run: node test_storm.js
// Technique per DEVLOG: run the game's <script> in a node vm with a stub DOM/canvas,
// then drive it through the new window.__tw hook.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('FATAL: no script found'); process.exit(1); }

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };

// ---------- stub DOM ----------
const noop = () => {};
function makeCtx() {
  return new Proxy({
    canvas: {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
  }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
}
function makeEl(id) {
  let html = '';
  const el = {
    id, style: {}, dataset: {}, children: [], textContent: '',
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); if (!v) this.children.length = 0; },
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
const messages = [];
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
sandbox.window.parent = { postMessage: (msg) => messages.push(msg) };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(m[1], sandbox, { timeout: 30000 });
} catch (e) {
  console.log('FATAL: script crashed at boot:', e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
const tw = sandbox.window.__tw;
check('boot: __tw hook exposed', !!tw);
if (!tw) process.exit(1);

const STEP = 1 / 60;
const run = (secs) => { for (let i = 0; i < Math.round(secs / STEP); i++) tw.update(STEP); };
const enemies = () => tw.tanks.filter(t => t.team === 1 && t.alive);
const skipCountdown = () => run(2.0);

// ---------- 1. content present ----------
check('TEMPEST tank exists', !!tw.TANKS.tempest && tw.TANKS.tempest.twin === true);
check('TEMPEST is wave-gated', tw.TANKS.tempest.reqWave === 10);
check('6 survival perks', tw.PERK_ORDER.length === 6 && tw.PERK_ORDER.every(k => tw.PERKS[k]));
check('boss color defined for sprites', m[1].includes('BOSS_COL'));

// ---------- 2. quick-play regression: full match to 5 still works ----------
{
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  check('quick: two tanks', tw.tanks.length === 2);
  check('quick: survival off', tw.surv.on === false);
  const scrap0 = tw.profile.scrap;
  let guard = 0;
  while (tw.phase !== 'matchover' && guard++ < 4000) {
    if (tw.phase === 'play' && tw.tanks[1].alive) tw.damageTank(tw.tanks[1]);
    tw.update(0.1);
  }
  check('quick: match reaches matchover', tw.phase === 'matchover', tw.phase);
  check('quick: player won 5-0', tw.tanks[0].score === 5, tw.tanks[0].score + '-' + tw.tanks[1].score);
  check('quick: scrap paid', tw.profile.scrap > scrap0, tw.profile.scrap - scrap0);
  check('quick: win posted to leaderboard', messages.some(x => x && x.gameId === 'tank-wars'), messages.length);
}

// ---------- 3. maze integrity across all arenas ----------
{
  let ok = true;
  for (const kind of ['maze', 'dense', 'pillars', 'corridors', 'shifting', 'jungle', 'city', 'snow', 'lava']) {
    for (let i = 0; i < 4; i++) { tw.genMaze(kind); if (!tw.allCellsReachable()) ok = false; }
  }
  check('mazes: all arenas fully connected (36 gens)', ok);
}

// ---------- 4. survival: wave 1 -> clear -> draft -> wave 2 ----------
{
  tw.startSurvival();
  check('surv: on', tw.surv.on === true && tw.surv.wave === 1);
  check('surv: wave 1 = player + 1 enemy', tw.tanks.length === 2, tw.tanks.length);
  check('surv: enemy is team 1 rookie', tw.tanks[1].team === 1 && tw.tanks[1].aiLv === 'rookie');
  check('surv: countdown announces', tw.phase === 'countdown');
  skipCountdown();
  check('surv: play begins', tw.phase === 'play', tw.phase);
  const run0 = tw.surv.run;
  tw.damageTank(tw.tanks[1]);
  run(0.3);   // ride out the kill hitstop
  check('surv: clearing the wave opens the draft', tw.phase === 'draft', tw.phase);
  check('surv: draft has 3 distinct perks', new Set(tw.surv.draft).size === 3, tw.surv.draft.join(','));
  check('surv: wave pay banked', tw.surv.run > run0, tw.surv.run);
  const picked = tw.surv.draft[1];
  tw.survApplyPerk(1);
  check('surv: perk stacked', tw.surv.perks[picked] === 1);
  check('surv: wave 2 begins', tw.surv.wave === 2 && tw.phase === 'countdown');
  check('surv: wave 2 = 2 enemies', enemies().length === 2, enemies().length);
}

// ---------- 5. teammates never hurt each other ----------
{
  tw.startSurvival(); tw.survStartWave(4);   // 3 enemies
  skipCountdown();
  const [e1, e2] = enemies();
  // park an enemy-owned shell right on top of the other enemy
  tw.shells.length = 0;
  tw.shells.push({ id: 9001, x: e2.x, y: e2.y, vx: 1, vy: 0, r: 4, owner: e1.i, team: 1,
    age: 0, grace: 0, big: false, heavy: false, smash: 0, bounces: -1, accel: 0, life: 9, col: '#fff' });
  tw.update(STEP);
  check('team: enemy shell passes through a teammate', e2.alive === true);
  // same shell on the player must connect
  const p = tw.tanks[0];
  tw.shells.length = 0;
  tw.shells.push({ id: 9002, x: p.x, y: p.y, vx: 1, vy: 0, r: 4, owner: e1.i, team: 1,
    age: 0, grace: 0, big: false, heavy: false, smash: 0, bounces: -1, accel: 0, life: 9, col: '#fff' });
  tw.update(STEP);
  check('team: enemy shell still kills the player', p.alive === false || tw.phase === 'survover');
}

// ---------- 6. boss wave: HP, armor, death ----------
{
  tw.startSurvival(); tw.survStartWave(5);
  skipCountdown();   // kills only clear a wave that has actually started
  const boss = tw.tanks[1];
  check('boss: spawns on wave 5', !!boss.boss, JSON.stringify({ len: tw.tanks.length }));
  check('boss: WARLORD first', boss.boss.type === 'warlord', boss.boss.type);
  check('boss: 5 HP at wave 5', boss.hp === 5, boss.hp);
  check('boss: bigger hitbox', boss.r === 18);
  check('boss: named in the HUD copy', tw.surv.bossName === 'THE WARLORD', tw.surv.bossName);
  for (let i = 0; i < 4; i++) tw.damageTank(boss);
  check('boss: armor soaks 4 hits', boss.alive === true && boss.hp === 1, boss.hp);
  tw.damageTank(boss);
  check('boss: falls on the 5th', boss.alive === false);
  run(0.3);   // hitstop again
  check('boss: kill pays big + clears the wave', tw.phase === 'draft', tw.phase);
}

// ---------- 7. warlord radial burst ----------
{
  tw.startSurvival(); tw.survStartWave(5);
  skipCountdown();
  const boss = tw.tanks[1];
  boss.boss.burstCd = 0.01;
  let peak = 0;
  for (let i = 0; i < 30; i++) { tw.update(STEP); peak = Math.max(peak, tw.shells.filter(s2 => s2.team === 1).length); }
  check('warlord: radial burst fills the air', peak >= 10, peak);
}

// ---------- 8. juggernaut charge telegraph (wave 10) ----------
{
  tw.startSurvival(); tw.survStartWave(10);
  const boss = tw.tanks[1];
  check('jugg: wave 10 boss is THE JUGGERNAUT', boss.boss.type === 'juggernaut', boss.boss.type);
  check('jugg: 7 HP at wave 10', boss.hp === 7, boss.hp);
  skipCountdown();
  boss.boss.chargeCd = 0.01;
  // pin the player right next to the boss each frame — guaranteed line of sight
  let armed = false;
  for (let i = 0; i < 180 && !armed; i++) {
    tw.tanks[0].x = boss.x + 45; tw.tanks[0].y = boss.y;
    tw.update(STEP);
    if (boss.telegraphT > 0 || boss.boss.charging > 0) armed = true;
  }
  check('jugg: telegraphs before charging', armed,
    JSON.stringify({ tele: boss.telegraphT, chg: boss.boss.charging }));
}

// ---------- 9. vortex reinforcements at half HP (wave 15) ----------
{
  tw.startSurvival(); tw.survStartWave(15);
  const boss = tw.tanks[1];
  check('vortex: wave 15 boss is THE VORTEX', boss.boss.type === 'vortex', boss.boss.type);
  const n0 = tw.tanks.length;
  const half = Math.ceil(boss.boss.maxHp / 2);
  while (boss.hp > half) tw.damageTank(boss);
  tw.damageTank(boss);   // crossing the line
  check('vortex: summons 2 minions at half HP', tw.tanks.length === n0 + 2, tw.tanks.length - n0);
  check('vortex: minions are rookie scouts', tw.tanks.slice(-1)[0].aiLv === 'rookie');
}

// ---------- 10. FREEZE power-up ----------
{
  tw.startSurvival(); tw.survStartWave(3);
  skipCountdown();
  const p = tw.tanks[0];
  tw.powerup = { x: p.x, y: p.y, kind: 'freeze', age: 0 };
  tw.updatePowerups(STEP);
  check('freeze: consumed on pickup', tw.powerup === null);
  check('freeze: every enemy iced', enemies().every(e => e.frozenT > 0));
  check('freeze: the player is not', !(p.frozenT > 0));
  const positions = enemies().map(e => [e.x, e.y]);
  run(1.0);
  const still = enemies().every((e, i) => positions[i] && Math.hypot(e.x - positions[i][0], e.y - positions[i][1]) < 1);
  check('freeze: frozen tanks cannot move', still);
  run(3.0);
  check('freeze: thaws after 3.5s', enemies().every(e => !(e.frozenT > 0)));
  check('freeze: offline powerup pool includes it', m[1].includes("'freeze'"));
  check('freeze: online pool excludes it', /online' \? \['triple', 'rapid', 'shield', 'big'\]/.test(m[1]));
}

// ---------- 11. TEMPEST twin cannons ----------
{
  tw.startSurvival();
  tw.profile.owned.tempest = true; tw.profile.tank = 'tempest';
  tw.startSurvival();   // restart so the player tank picks it up
  skipCountdown();
  const p = tw.tanks[0];
  p.cd = 0; tw.shells.length = 0;
  tw.fireShell(p);
  check('tempest: one trigger = two shells', tw.shells.filter(s => s.owner === 0).length === 2, tw.shells.length);
  p.cd = 0; p.power = 'triple'; p.powerT = 8;
  tw.shells.length = 0;
  tw.fireShell(p);
  check('tempest + TRIPLE = six shells', tw.shells.filter(s => s.owner === 0).length === 6, tw.shells.length);
  tw.profile.tank = 'scout';
}

// ---------- 12. perks actually do things ----------
{
  tw.startSurvival();
  tw.surv.perks = { quickload: 1, magazine: 1, velocity: 1, aegis: 1 };
  tw.survStartWave(2);
  skipCountdown();
  const p = tw.tanks[0];
  check('aegis: shield up at wave start', p.shield === true);
  p.cd = 0; tw.shells.length = 0;
  tw.fireShell(p);
  const cdExpect = tw.TANKS.scout.fireCd * 0.82;
  check('quickload: reload 18% faster', Math.abs(p.cd - cdExpect) < 1e-6, p.cd);
  const spdExpect = tw.TANKS.scout.shell.speed * 1.12;
  const sp = Math.hypot(tw.shells[0].vx, tw.shells[0].vy);
  check('velocity: shells 12% faster', Math.abs(sp - spdExpect) < 0.5, sp);
  // magazine: 5th live shell allowed (base cap 4)
  tw.shells.length = 0;
  for (let i = 0; i < 6; i++) { p.cd = 0; tw.fireShell(p); }
  check('magazine: cap 4 -> 5', tw.shells.filter(s => s.owner === 0).length === 5, tw.shells.length);
}

// ---------- 13. game over: scrap, milestones, best wave ----------
{
  tw.startSurvival();
  tw.survStartWave(11);
  tw.surv.run = 100; tw.surv.kills = 30;
  const scrap0 = tw.profile.scrap;
  tw.survOver();
  check('over: phase survover', tw.phase === 'survover');
  // run 100 + milestones for wave 11: 25 (w5) + 75 (w10) = 200
  check('over: milestones paid', tw.profile.scrap === scrap0 + 200, tw.profile.scrap - scrap0);
  check('over: best wave recorded', tw.profile.bestWave === 11, tw.profile.bestWave);
  check('over: bestWave persisted', JSON.parse(store.get('tankwars_profile')).bestWave === 11);
  check('over: survival never posts a leaderboard win',
    !messages.slice().reverse().find(x => x.__surv), true);
}

// ---------- 14. garage gating ----------
{
  tw.profile.bestWave = 0; tw.profile.owned = { scout: true }; tw.profile.tank = 'scout';
  tw.renderGarage();
  const list = byId('garageList');
  const texts = [];
  const walk = (el) => { if (!el) return; if (el.textContent) texts.push(el.textContent); (el.children || []).forEach(walk); };
  walk(list);
  check('garage: tempest locked behind wave 10', texts.some(t => /SURVIVE WAVE 10/.test(t)), texts.filter(t => /WAVE/.test(t)).join('|'));
  tw.profile.bestWave = 12;
  tw.renderGarage();
  const texts2 = [];
  const walk2 = (el) => { if (!el) return; if (el.textContent) texts2.push(el.textContent); (el.children || []).forEach(walk2); };
  walk2(byId('garageList'));
  check('garage: unlocks after wave 10',
    texts2.some(t => /BUY 6000|6000 SCRAP/.test(t)) && !texts2.some(t => /SURVIVE WAVE 10/.test(t)),
    texts2.filter(t => /6000|WAVE/.test(t)).join('|'));
  tw.profile.bestWave = 0;
}

// ---------- 15. survival soak: idle player vs the storm, no crashes ----------
{
  tw.startSurvival();
  let err = null;
  try {
    let guard = 0;
    while (tw.phase !== 'survover' && guard++ < 60 * 120) {
      if (tw.phase === 'draft') tw.survApplyPerk(0);
      tw.update(STEP);
    }
  } catch (e) { err = e; }
  check('soak: 2 minutes of storm with no exception', !err, err && err.message);
  check('soak: run ended or still valid', ['survover', 'play', 'countdown', 'draft'].includes(tw.phase), tw.phase);
  check('soak: idle player eventually falls', tw.phase === 'survover');
  check('soak: numbers stayed finite', Number.isFinite(tw.profile.scrap) && Number.isFinite(tw.surv.run));
}

// ---------- 16. campaign regression: config untouched ----------
check('campaign: still 10 battles', tw.CAMPAIGN.length === 10);
check('campaign: rewards intact', tw.CAMPAIGN[9].reward === 150);

console.log(`\n=== stormtest: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
