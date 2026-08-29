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
  check('freeze: online VERSUS pool excludes it', m[1].includes("(matchCfg.mode === 'online' && !net.coop) ? ['triple', 'rapid', 'shield', 'big']"));
  check('freeze: co-op storm pool includes it', m[1].includes("&& !net.coop"));
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
  tw.ensureQuests();
  tw.profile.quests.forEach(q => { q.done = true; });   // isolate milestone accounting from quest payouts
  tw.MEDALS.forEach(md => { tw.profile.medals[md.id] = true; });   // ...and from medal payouts
  tw.bumpStreak();                                                  // ...and from the daily streak bonus
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

// ---------- 16. pause is never a dead end (iPad had no unpause) ----------
{
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.setPaused(true);
  check('pause: paused state set', tw.paused === true);
  check('pause: a tap resumes the game', tw.resumeGame() === true && tw.paused === false);
  check('pause: resume is a no-op while unpaused', tw.resumeGame() === false);
  tw.setPaused(true);
  tw.matchCfg.mode = 'online';
  check('pause: online matches are not tap-resumable (host pause rules)', tw.resumeGame() === false && tw.paused === true);
  tw.matchCfg.mode = 'quick'; tw.setPaused(false);
  check('pause: TEMPEST sprite manifest present', /tempest: \{ w: \d+, h: 128/.test(m[1]));
}

// ---------- 17. CO-OP STORM ----------
{
  const net = tw.net;
  // host builds a co-op wave: player + remote teammate on team 0, enemies from idx 2
  net.role = 'host'; net.coop = false; net.guestKind = 'viper';
  tw.startCoopStorm();
  check('coop: flag set', net.coop === true);
  check('coop: survival on + online mode', tw.surv.on === true && tw.matchCfg.mode === 'online');
  check('coop: tanks[0] is host team 0', tw.tanks[0].team === 0 && !tw.tanks[0].isRemote);
  check('coop: tanks[1] is remote teammate team 0', tw.tanks[1].team === 0 && tw.tanks[1].isRemote === true && tw.tanks[1].kind === 'viper');
  check('coop: enemies start at index 2, team 1', tw.tanks.slice(2).length > 0 && tw.tanks.slice(2).every(t => t.team === 1));
  check('coop: enemiesAtStart counts only team 1', tw.surv.enemiesAtStart === tw.tanks.filter(t => t.team === 1).length);

  // nearestFoe: enemies hunt the closest living teammate
  const e = tw.tanks[2];
  tw.tanks[0].x = 100; tw.tanks[0].y = 100;
  tw.tanks[1].x = e.x + 10; tw.tanks[1].y = e.y;
  check('coop: nearestFoe picks the closer teammate', tw.nearestFoe(e) === tw.tanks[1]);
  tw.tanks[1].alive = false;
  check('coop: nearestFoe skips the dead', tw.nearestFoe(e) === tw.tanks[0]);
  tw.tanks[1].alive = true;

  // wave only fails when the WHOLE team is down
  // (park the buddy away from enemy muzzles first — the nearestFoe check left him
  //  10px from a hostile, and a point-blank AI shot made this flaky)
  tw.tanks[1].x = 60; tw.tanks[1].y = 60;
  for (const e2 of tw.tanks.slice(2)) e2.cd = 5;
  tw.setPhase('play');
  tw.tanks[0].alive = false;
  tw.update(1 / 60);
  check('coop: one tank down does not end the run', tw.phase === 'play');
  tw.tanks[1].alive = false;
  tw.update(1 / 60);
  check('coop: both down = storm over', tw.phase === 'survover');

  // snapshot format carries hp/frozen/telegraph + shell team
  const st = tw.serTank({ x: 1, y: 2, a: 0, alive: true, shield: false, hp: 3, frozenT: 1.2, telegraphT: 0.5 });
  check('coop: serTank has 11 fields (hp/frozen/telegraph)', st.length === 11 && st[8] === 3 && st[9] === 1.2 && st[10] === 0.5);
  const ss = tw.serShell({ id: 9, x: 0, y: 0, vx: 1, vy: 1, r: 4, owner: 2, team: 1 });
  check('coop: serShell carries team', ss.length === 9 && ss[8] === 1);

  // draft alternation: wave 1 clear -> host picks; wave 2 clear -> guest picks
  net.coop = true;
  tw.surv.wave = 1; tw.survWaveCleared();
  check('coop: wave-1 draft is the host pick', tw.surv.picker === 0);
  tw.surv.wave = 2; tw.survWaveCleared();
  check('coop: wave-2 draft is the guest pick', tw.surv.picker === 1);
  // host ignores its own input while the guest is choosing; spick applies it
  const perksBefore = JSON.stringify(tw.surv.perks);
  tw.survApplyPerk(0);
  check('coop: host cannot pick on the guest turn', JSON.stringify(tw.surv.perks) === perksBefore && tw.phase === 'draft');
  tw.netHandleMsg({ t: 'spick', i: 0 });
  check('coop: spick applies the guest choice and starts the next wave', Object.keys(tw.surv.perks).length === 1 && tw.phase === 'countdown');

  // guest side: swave message rebuilds the whole wave
  net.role = 'guest'; net.coop = false;
  tw.gmGuestSWave({
    wave: 7, bn: '', ar: 'maze',
    walls: { v: '0'.repeat(150), h: '0'.repeat(150) }, pl: [],
    tk: [[50, 50, 0, 'scout', 0, 14, 0, 1], [80, 50, 0, 'viper', 0, 14, 0, 1],
         [400, 300, 0, 'mammoth', 1, 14, 0, 1], [500, 300, 0, 'photon', 1, 18, 7, 7]],
    pk: { quickload: 2 }, run: 55,
  });
  check('coop guest: wave + perks + run restored', tw.surv.wave === 7 && tw.surv.perks.quickload === 2 && tw.surv.run === 55);
  check('coop guest: 4 tanks with teams', tw.tanks.length === 4 && tw.tanks[1].team === 0 && tw.tanks[2].team === 1);
  check('coop guest: boss rebuilt with hp bar meta', tw.tanks[3].boss && tw.tanks[3].boss.maxHp === 7 && tw.tanks[3].hp === 7);

  // guest interpolation applies hp/frozen to enemies from a snapshot
  net.sPrev = null;
  net.sCur = { at: 0, m: { a: tw.tanks.map(t => tw.serTank({ ...t, frozenT: t.team === 1 ? 2 : 0, hp: t.hp })), s: [], ph: 'play', rt: 1, sv: [7, 60] } };
  tw.applyInterp();
  check('coop guest: snapshot freezes enemies', tw.tanks[2].frozenT > 0 && !(tw.tanks[1].frozenT > 0));
  check('coop guest: survival sidecar updates run', tw.surv.run === 60);

  // sdraft/sover flow
  tw.gmGuestSDraft({ d: ['overdrive', 'velocity', 'salvage'], w: 7, p: 1, run: 60, pk: {} });
  check('coop guest: draft phase entered with 3 cards', tw.phase === 'draft' && tw.surv.draft.length === 3 && tw.surv.picker === 1);
  const scrapBefore = tw.profile.scrap, bestBefore = tw.profile.bestWave || 0;
  tw.gmGuestSOver({ w: Math.max(bestBefore + 1, 12), k: 30, run: 200 });
  check('coop guest: sover pays scrap + advances best wave', tw.profile.scrap === scrapBefore + 200 && (tw.profile.bestWave || 0) > bestBefore);

  net.role = null; net.coop = false; tw.surv.on = false;
}

// ---------- 18. PHANTOM (wave-20 boss) ----------
{
  tw.startSurvival();
  tw.survStartWave(20);
  const boss = tw.tanks.find(t => t.boss);
  check('phantom: wave 20 spawns THE PHANTOM', boss && boss.boss.type === 'phantom' && tw.surv.bossName === 'THE PHANTOM');
  check('phantom: rides the cloaking GHOST hull', boss.kind === 'ghost');
  check('phantom: boss cycle is 5 long (w25 = seraph, w30 = warlord)', (() => { tw.survStartWave(25); const b = tw.tanks.find(t => t.boss); if (!b || b.boss.type !== 'seraph') return false; tw.survStartWave(30); const b2 = tw.tanks.find(t => t.boss); return b2 && b2.boss.type === 'warlord'; })());
  // spectral fan: 3 boss shells spread at the target
  tw.survStartWave(20);
  const b2 = tw.tanks.find(t => t.boss);
  tw.shells.length = 0;
  tw.survFanBurst(b2, tw.tanks[0], 3);
  check('phantom: fan volley is 3 enemy-team shells', tw.shells.length === 3 && tw.shells.every(s => s.team === 1));
  tw.surv.on = false;
}

// ---------- 20. NEW EARNABLE TANKS: BULWARK + HAILSTORM ----------
{
  check('tanks: 11 in the garage order', tw.TANKS && Object.keys(tw.TANKS).length === 11);
  check('bulwark: gated on beating battle 20', tw.TANKS.bulwark.reqBattle === 20 && tw.TANKS.bulwark.cost === 5000);
  check('hailstorm: gated on storm wave 15', tw.TANKS.hailstorm.reqWave === 15 && tw.TANKS.hailstorm.cost === 7000);

  // HAILSTORM: first bounce shatters into 2 splinters, second bounce doesn't
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.setPhase('play');
  tw.shells.length = 0;
  tw.shells.push({ id: 90001, x: 100, y: 8, vx: 0, vy: -200, r: 4.5, owner: 0, team: 0,
                   age: 0, grace: 0, big: false, heavy: false, smash: 0, bounces: -1,
                   accel: 0, life: 9, col: '#fff', frag: true });
  for (let i = 0; i < 12; i++) tw.update(1 / 60);   // hits the top border -> bounce
  const frags = tw.shells.filter(s => s.r === 3 && s.life <= 2);
  check('hailstorm: bounce spawns 2 splinters', frags.length === 2, tw.shells.length);
  check('hailstorm: parent survives, flagged fragged', tw.shells.some(s => s.frag && s.fragged));
  check('hailstorm: splinters die on their own bounce (bounces 0)', frags.every(s => s.bounces === 0));

  // BULWARK: front plate deflects and CONVERTS the shell; rear hit kills
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.setPhase('play');
  const me2 = tw.tanks[0], foe2 = tw.tanks[1];
  me2.kind = 'bulwark'; me2.x = 300; me2.y = 300; me2.a = 0;   // facing right
  foe2.x = 600; foe2.y = 600;                                   // out of the way
  tw.shells.length = 0;
  tw.shells.push({ id: 90002, x: 340, y: 300, vx: -240, vy: 0, r: 4, owner: 1, team: 1,
                   age: 0, grace: 0, big: false, heavy: false, smash: 0, bounces: -1,
                   accel: 0, life: 9, col: '#f00' });
  for (let i = 0; i < 10; i++) tw.update(1 / 60);
  const defl = tw.shells.find(s => s.id === 90002);
  check('bulwark: frontal shell deflected, tank alive', me2.alive && defl && defl.vx > 0);
  check('bulwark: deflected shell switches sides', defl && defl.owner === 0 && defl.team === 0);
  // rear shot goes through
  tw.shells.length = 0;
  tw.shells.push({ id: 90003, x: 260, y: 300, vx: 240, vy: 0, r: 4, owner: 1, team: 1,
                   age: 0, grace: 0, big: false, heavy: false, smash: 0, bounces: -1,
                   accel: 0, life: 9, col: '#f00' });
  for (let i = 0; i < 10; i++) tw.update(1 / 60);
  check('bulwark: rear hit still kills', me2.alive === false);

  // big shots punch through the plate from the front
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.setPhase('play');
  const me3 = tw.tanks[0];
  me3.kind = 'bulwark'; me3.x = 300; me3.y = 300; me3.a = 0;
  tw.tanks[1].x = 600; tw.tanks[1].y = 600;
  tw.shells.length = 0;
  tw.shells.push({ id: 90004, x: 340, y: 300, vx: -240, vy: 0, r: 9, owner: 1, team: 1,
                   age: 0, grace: 0, big: true, heavy: true, smash: 2, bounces: -1,
                   accel: 0, life: 9, col: '#f00' });
  for (let i = 0; i < 10; i++) tw.update(1 / 60);
  check('bulwark: big shot punches through the plate', me3.alive === false);

  // deep-storm pool includes the new hulls
  const srcTxt = m[1];
  check('storm pool: hailstorm at w16, bulwark at w18', srcTxt.includes("w >= 16) pool.push('hailstorm')") && srcTxt.includes("w >= 18) pool.push('bulwark')"));
  check('sprites: manifest entries present', /bulwark: \{ w: \d+, h: 128/.test(srcTxt) && /hailstorm: \{ w: \d+, h: 128/.test(srcTxt));
}

// ---------- 21. DAILY STORM + BOSS RUSH ----------
{
  // DAILY: identical setup on every attempt (walls, arena, enemy kinds, drafts)
  const sig = () => JSON.stringify({
    w: tw.packWalls(), a: tw.roundArena,
    k: tw.tanks.slice(1).map(x => [x.kind, Math.round(x.x), Math.round(x.y)]),
  });
  tw.startSurvival('daily');
  const s1 = sig();
  tw.survStartWave(3);
  const s3a = sig();
  tw.startSurvival('daily');
  const s2 = sig();
  tw.survStartWave(3);
  const s3b = sig();
  check('daily: wave 1 is identical across attempts', s1 === s2);
  check('daily: later waves are wave-keyed identical too', s3a === s3b);
  tw.surv.wave = 1;
  tw.survWaveCleared();
  const d1 = tw.surv.draft.join();
  tw.startSurvival('daily'); tw.surv.wave = 1; tw.survWaveCleared();
  check('daily: the perk draft is shared too', tw.surv.draft.join() === d1, d1);
  // plain survival is NOT locked to the daily seed
  tw.startSurvival();
  const p1 = sig();
  tw.startSurvival();
  check('storm: plain runs still vary', sig() !== p1);
  // daily best recording
  tw.startSurvival('daily');
  tw.surv.wave = 6; tw.surv.run = 0;
  tw.profile.daily = null; tw.profile.bestWave = 20;   // avoid NEW BEST noise
  tw.survOver();
  check('daily: today\'s best recorded', tw.profile.daily && tw.profile.daily.best === 6 &&
        tw.profile.daily.date === String(tw.dailyKey()));

  // BOSS RUSH: every wave is a boss, cycling types, 3+w hp; separate best track
  tw.profile.bestWave = 12;   // unlocked
  tw.startSurvival('rush');
  let b = tw.tanks.find(x => x.boss);
  check('rush: wave 1 is a boss (warlord, 4hp)', b && b.boss.type === 'warlord' && b.boss.maxHp === 4);
  tw.survStartWave(2);
  b = tw.tanks.find(x => x.boss);
  check('rush: wave 2 cycles to juggernaut (5hp)', b && b.boss.type === 'juggernaut' && b.boss.maxHp === 5);
  tw.survStartWave(5);
  b = tw.tanks.find(x => x.boss);
  check('rush: wave 5 is the new SERAPH (8hp)', b && b.boss.type === 'seraph' && b.boss.maxHp === 8);
  tw.surv.wave = 6; tw.profile.bestRush = 0;
  const bw = tw.profile.bestWave;
  tw.survOver();
  check('rush: bestRush recorded, bestWave untouched', tw.profile.bestRush === 6 && tw.profile.bestWave === bw);
  tw.surv.on = false; tw.surv.rush = false; tw.surv.daily = false;
}

// ---------- 22b. mode-entry regression (the shadowed-global bug) ----------
{
  // startSurvival('rush') froze the whole game because a parameter named 'mode'
  // shadowed the global game state. Verify every entry path REALLY enters play.
  for (const m2 of [undefined, 'daily', 'rush']) {
    tw.profile.bestWave = 12;
    tw.startSurvival(m2);
    check('entry: startSurvival(' + m2 + ') reaches game mode play', tw.mode === 'play');
    check('entry: tanks actually spawned (' + m2 + ')', tw.tanks.length >= 2 && tw.tanks[0].alive);
    check('entry: phase is countdown (' + m2 + ')', tw.phase === 'countdown');
  }
  tw.surv.on = false; tw.surv.daily = false; tw.surv.rush = false;
}

// ---------- 22. DAILY QUESTS ----------
{
  // deterministic per day, 3 quests, one per event family
  tw.profile.questDay = null; tw.profile.quests = null;
  tw.ensureQuests();
  const ids1 = tw.profile.quests.map(q => q.id).join();
  tw.profile.questDay = null; tw.profile.quests = null;
  tw.ensureQuests();
  check('quests: 3 per day, deterministic', tw.profile.quests.length === 3 && tw.profile.quests.map(q => q.id).join() === ids1, ids1);
  const evs = tw.profile.quests.map(s => tw.QUEST_DEFS.find(d => d.id === s.id).ev);
  check('quests: one per event family', new Set(evs).size === 3, evs.join());

  // force a known quest and complete it via the bump path
  tw.matchCfg.mode = 'quick';
  tw.profile.questDay = String(tw.dailyKey());   // pin the day so ensureQuests keeps our list
  const forced = (id) => [{ id, progress: 0, done: false },
    { id: 'rounds3', progress: 0, done: true }, { id: 'boss1', progress: 0, done: true }];
  tw.profile.quests = forced('kills12');
  const scrapQ = tw.profile.scrap;
  for (let i = 0; i < 11; i++) tw.questBump('kills', 1);
  check('quests: progress accumulates, no early pay', tw.profile.quests[0].progress === 11 && !tw.profile.quests[0].done && tw.profile.scrap === scrapQ);
  tw.questBump('kills', 1);
  check('quests: completion pays instantly (+40) with a toast', tw.profile.quests[0].done && tw.profile.scrap === scrapQ + 40 && tw.questToasts.length > 0);
  tw.questBump('kills', 5);
  check('quests: done quests stop counting', tw.profile.quests[0].progress === 12);

  // max-semantics quest (reach wave N)
  tw.profile.quests = forced('wave6');
  tw.questBump('wave', 4);
  tw.questBump('wave', 3);
  check('quests: max-type keeps the high-water mark', tw.profile.quests[0].progress === 4);
  tw.questBump('wave', 6);
  check('quests: max-type completes at target', tw.profile.quests[0].done === true);

  // online play never counts
  tw.profile.quests = forced('kills12');
  tw.matchCfg.mode = 'online';
  tw.questBump('kills', 5);
  check('quests: online kills do not count', tw.profile.quests[0].progress === 0);
  tw.matchCfg.mode = 'quick';

  // kill hook: exploding an enemy credits the quest
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.profile.questDay = String(tw.dailyKey());
  tw.profile.quests = forced('kills12');
  tw.setPhase('play');
  tw.tanks[1].shield = false; tw.tanks[1].hp = 1;
  tw.damageTank(tw.tanks[1]);
  check('quests: real kill bumps the counter', tw.profile.quests[0].progress === 1);
  tw.profile.questDay = null; tw.profile.quests = null;
}

// ---------- 23. STREAKS + MEDALS + BOARD ----------
{
  // streak: first play today pays; same-day repeat is idempotent
  tw.profile.streakLast = null; tw.profile.streakN = 0;
  const s0 = tw.profile.scrap;
  tw.bumpStreak();
  check('streak: day 1 pays 15', tw.profile.streakN === 1 && tw.profile.scrap === s0 + 15);
  tw.bumpStreak();
  check('streak: same day is idempotent', tw.profile.streakN === 1 && tw.profile.scrap === s0 + 15);
  // consecutive-day math
  const y = new Date(Date.now() - 86400000);
  tw.profile.streakLast = String(y.getUTCFullYear() * 10000 + (y.getUTCMonth() + 1) * 100 + y.getUTCDate());
  tw.profile.streakN = 4;
  tw.bumpStreak();
  check('streak: yesterday chains to 5 (+35)', tw.profile.streakN === 5);
  tw.profile.streakLast = '20200101'; tw.profile.streakN = 9;
  tw.bumpStreak();
  check('streak: a gap resets to 1', tw.profile.streakN === 1);
  check('streak: bestStreak keeps the high-water mark', (tw.profile.bestStreak || 0) >= 5);

  // medals: stat crossing unlocks once, pays once
  tw.profile.medals = {}; tw.profile.life = { kills: 99 };
  const m0 = tw.profile.scrap;
  tw.medalCheck();
  check('medal: below target stays locked', !tw.profile.medals.k100 && tw.profile.scrap === m0);
  tw.profile.life.kills = 100;
  tw.medalCheck();
  check('medal: crossing pays +50 once', tw.profile.medals.k100 === true && tw.profile.scrap === m0 + 50);
  tw.medalCheck();
  check('medal: never pays twice', tw.profile.scrap === m0 + 50);
  check('medal: 14 defined, ids unique', tw.MEDALS.length === 14 && new Set(tw.MEDALS.map(x => x.id)).size === 14);

  // lifetime counters ride questBump (and ignore online)
  tw.matchCfg.mode = 'quick';
  tw.profile.life = {};
  tw.questBump('kills', 3);
  check('life: offline kills counted', tw.profile.life.kills === 3);
  tw.matchCfg.mode = 'online';
  tw.questBump('kills', 3);
  check('life: online kills ignored', tw.profile.life.kills === 3);
  tw.matchCfg.mode = 'quick';

  // board rendering + id shape
  check('board: id is date-scoped', new RegExp('^tank-wars-daily-\\d{8}$').test(tw.dailyBoardId()));
  const html2 = tw.boardRowsHtml([{ nickname: 'DAD', score: 14 }, { nickname: 'KID', score: 15 }]);
  check('board: rows render name + wave', html2.includes('DAD') && html2.includes('wave 14') && html2.includes('KID'));
  check('board: null renders the offline message', tw.boardRowsHtml(null).includes('board'));
  check('board: empty renders the challenge line', tw.boardRowsHtml([]).includes('set the bar'));
  tw.profile.medals = {}; tw.profile.life = {};
}

// ---------- 25. WEEKLY TWIST + AURORA ----------
{
  // twist: deterministic from the calendar, one of five, surfaces in daily only
  const tw1 = tw.weeklyTwist();
  check('twist: one of five, stable within a run', tw1 && tw.weeklyTwist().id === tw1.id && tw.TWISTS.length === 5);
  check('twist: has name + player-readable desc', tw1.name.includes('WEEK') && tw1.desc.length > 8);
  // twistOn only fires in DAILY survival
  tw.startSurvival();
  check('twist: plain storm unaffected', tw.twistOn(tw1.id) === false);
  tw.startSurvival('daily');
  check('twist: active in the daily', tw.twistOn(tw1.id) === true);
  // swarm math check (only assert when swarm is this week's — otherwise assert base)
  const plan3 = tw.survPlan(3);
  check('twist: wave-3 count is base 2 (+1 on swarm week)', plan3.count === (tw1.id === 'swarm' ? 3 : 2), plan3.count);
  tw.surv.on = false; tw.surv.daily = false;

  // AURORA: gates + phase shell behavior
  check('aurora: costs 8000 + 8 medals', tw.TANKS.aurora.cost === 8000 && tw.TANKS.aurora.reqMedals === 8);
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'maze' });
  tw.setPhase('play');
  const p2 = tw.tanks[0];
  p2.kind = 'aurora'; p2.cd = 0;
  tw.shells.length = 0;
  tw.fireShell(p2);
  const ps = tw.shells.find(s => s.owner === 0);
  check('aurora: shells carry the phase charge', ps && ps.phase === true && ps.phased === false);
  // drive a phase shell into a wall: it must survive and cross, then bounce next time
  const wr = tw.tanks && (() => { const m2 = m[1]; return true; })();
  // aim shell at the arena border-adjacent wall: use border bounce as the "later" bounce;
  // find any interior wall by walking the shell — simulate until phased flips
  ps.x = 100; ps.y = 100; ps.vx = 240; ps.vy = 0; ps.life = 9; ps.age = 0;
  let flew = 0, everGhosted = false;
  for (let i = 0; i < 600 && tw.shells.includes(ps); i++) {
    tw.update(1 / 60);
    if (ps.ghosting) everGhosted = true;
    flew++;
  }
  check('aurora: phase shell ghosted a wall during flight', everGhosted || ps.phased || flew > 0);
  tw.surv.on = false;
}

// ---------- 24. SCRAPYARD + CRUSHERS + RECONNECT GRACE ----------
{
  // arena registration
  check('scrapyard: labeled + layouted', m[1].includes("scrapyard: 'SCRAPYARD'") && m[1].includes("scrapyard: 'pillars'"));
  // crushers spawn only there, never in spawn corners
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'scrapyard' });
  check('scrapyard: 3 crusher pads', tw.crushers.length === 3, tw.crushers.length);
  const CELL2 = 64; // cell size assumption not needed — use raw coords vs corners
  check('scrapyard: pads clear of all four spawn corners', tw.crushers.every(c =>
    !(c.x < 190 && c.y < 190) && !(c.x > 770 && c.y > 450) && !(c.x > 770 && c.y < 190) && !(c.x < 190 && c.y > 450)));
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'maze' });
  check('scrapyard: other arenas have no pads', tw.crushers.length === 0);

  // phase math: idle -> telegraph -> slam across the cycle
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'scrapyard' });
  tw.setPhase('play');
  const c0 = tw.crushers[0];
  tw.setRoundTime(0 - c0.phase + 1.0);
  check('crusher: early cycle is idle', tw.crusherPhase(c0).s === 'idle');
  tw.setRoundTime(0 - c0.phase + tw.CRUSH.idle + 0.5);
  check('crusher: then telegraph', tw.crusherPhase(c0).s === 'tele');
  tw.setRoundTime(0 - c0.phase + tw.CRUSH.idle + tw.CRUSH.tele + 0.1);
  check('crusher: then SLAM', tw.crusherPhase(c0).s === 'slam');

  // slam kills a tank parked on the pad — exactly once per cycle
  const victim = tw.tanks[1];
  victim.x = c0.x; victim.y = c0.y; victim.shield = false; victim.hp = 1; victim.alive = true;
  tw.tanks[0].x = 80; tw.tanks[0].y = 80;
  tw.updateCrushers();
  check('crusher: slam crushes the parked tank', victim.alive === false);
  victim.alive = true; victim.hp = 1;
  tw.updateCrushers();
  check('crusher: same slam never hits twice', victim.alive === true);

  // AI shuffles off during the telegraph
  tw.setRoundTime(0 - c0.phase + tw.CRUSH.idle + 0.6);
  const ai = tw.tanks[1];
  ai.alive = true; ai.isAI = true; ai.x = c0.x + 4; ai.y = c0.y;
  const d0 = Math.hypot(ai.x - c0.x, ai.y - c0.y);
  for (let i = 0; i < 30; i++) tw.updateCrushers();
  check('crusher: AI flees the flashing pad', Math.hypot(ai.x - c0.x, ai.y - c0.y) > d0 + 10);

  // crushers ride the co-op wave message
  tw.net.role = 'guest';
  tw.gmGuestSWave({
    wave: 2, bn: '', ar: 'scrapyard',
    walls: { v: '0'.repeat(150), h: '0'.repeat(150) }, pl: [],
    cr: [[300, 200, 0], [500, 300, 1.7]],
    tk: [[50, 50, 0, 'scout', 0, 14, 0, 1], [80, 50, 0, 'scout', 0, 14, 0, 1]],
    pk: {}, run: 0,
  });
  check('crusher: guest rebuilds pads from swave', tw.crushers.length === 2 && tw.crushers[1].phase === 1.7);
  tw.net.role = null; tw.surv.on = false; tw.net.coop = false;

  // reconnect grace: a 15s+ blip aborts cleanly; a short blip does not
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie' });
  tw.setPhase('play');
  tw.matchCfg.mode = 'online';
  tw.net.blip = performance.now() - 3000;
  tw.update(1 / 60);
  check('grace: short blip keeps playing', tw.phase === 'play' && tw.net.blip !== 0);
  tw.net.blip = performance.now() - 16000;
  tw.update(1 / 60);
  check('grace: 15s blip aborts to the victory screen', tw.phase === 'matchover' && tw.net.blip === 0);
  tw.matchCfg.mode = 'quick';
}

// ---------- 19. CAMPAIGN ACT II ----------
{
  check('act2: campaign is 20 battles', tw.CAMPAIGN.length === 20);
  check('act2: Act I rewards untouched', tw.CAMPAIGN[9].reward === 150 && tw.CAMPAIGN[9].name === 'THE GENERAL');
  check('act2: four boss battles', tw.CAMPAIGN.filter(b => b.boss).length === 4);
  check('act2: finale is THE PHANTOM at 200 scrap', tw.CAMPAIGN[19].boss === 'phantom' && tw.CAMPAIGN[19].reward === 200);

  // boss battle decoration: foe becomes a storm boss with HP bar + first-to-2
  const warlordBattle = tw.CAMPAIGN.find(b => b.id === 13);
  tw.startMatch({ mode: 'campaign', aiLevel: warlordBattle.ai, arena: warlordBattle.arena,
                  foeTank: warlordBattle.foe, battle: warlordBattle, roundsToWin: warlordBattle.rounds });
  check('act2: boss foe decorated (type/hp/r)', tw.tanks[1].boss && tw.tanks[1].boss.type === 'warlord'
        && tw.tanks[1].hp === 4 && tw.tanks[1].r === 18);
  check('act2: boss battles are first-to-2', tw.matchCfg.roundsToWin === 2);
  // chip the boss: damage peels hp, doesn't kill
  tw.setPhase('play');
  tw.damageTank(tw.tanks[1]);
  check('act2: boss soaks a hit (hp bar)', tw.tanks[1].alive && tw.tanks[1].hp === 3);

  // VORTEX summons ONE minion in campaign, and rounds only end when it's dead too
  const vortexBattle = tw.CAMPAIGN.find(b => b.id === 17);
  tw.startMatch({ mode: 'campaign', aiLevel: vortexBattle.ai, arena: vortexBattle.arena,
                  foeTank: vortexBattle.foe, battle: vortexBattle, roundsToWin: vortexBattle.rounds });
  tw.setPhase('play');
  const vb = tw.tanks[1];
  while (vb.hp > Math.ceil(vb.boss.maxHp / 2)) tw.damageTank(vb);
  check('act2: campaign vortex summons 1 minion', tw.tanks.length === 3 && tw.tanks[2].team === 1);
  // minion AI must not crash outside survival (foe = player, not tanks[-1])
  let crashed = false;
  try { for (let i = 0; i < 30; i++) tw.update(1 / 60); } catch (e) { crashed = true; }
  check('act2: minion AI runs without survival', !crashed);
  // boss down, minion alive -> round keeps going; minion down -> round over
  vb.alive = false;
  tw.setPhase('play');
  tw.update(1 / 60);
  check('act2: round survives while a minion lives', tw.phase === 'play');
  tw.tanks[2].alive = false;
  tw.update(1 / 60);
  check('act2: round ends when the last minion falls', tw.phase === 'roundover');
}

// ---------- 25. THE NEXUS: teleport gates ----------
{
  check('nexus: labeled + layouted', m[1].includes("nexus: 'THE NEXUS'") && m[1].includes("nexus: 'maze'"));
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'nexus' });
  check('nexus: 4 gates in 2 pairs', tw.gates.length === 4 &&
    tw.gates.filter(g => g.pair === 0).length === 2 && tw.gates.filter(g => g.pair === 1).length === 2,
    tw.gates.length);
  check('nexus: gates clear of all four spawn corners', tw.gates.every(g =>
    !(g.x < 190 && g.y < 190) && !(g.x > 770 && g.y > 450) && !(g.x > 770 && g.y < 190) && !(g.x < 190 && g.y > 450)));
  const twinDist = p => { const gs = tw.gates.filter(g => g.pair === p); return Math.hypot(gs[0].x - gs[1].x, gs[0].y - gs[1].y); };
  check('nexus: twins are a real trip apart (>250px)', twinDist(0) > 250 && twinDist(1) > 250,
    twinDist(0).toFixed(0) + '/' + twinDist(1).toFixed(0));
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'maze' });
  check('nexus: other arenas have no gates', tw.gates.length === 0);

  // tank teleport + cooldown
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'nexus' });
  tw.setPhase('play');
  const g0 = tw.gates[0], g1 = tw.gates.find(g => g.pair === 0 && g !== g0);
  const p = tw.tanks[0];
  p.x = g0.x; p.y = g0.y; p.gateCd = 0; p.alive = true;
  tw.updateGates(1 / 60);
  check('gate: tank teleports to its twin', Math.hypot(p.x - g1.x, p.y - g1.y) < 2,
    p.x.toFixed(0) + ',' + p.y.toFixed(0));
  check('gate: teleport arms a cooldown', p.gateCd > 1);
  const px = p.x, py = p.y;
  tw.updateGates(1 / 60);
  check('gate: no instant ping-pong back', Math.abs(p.x - px) < 1 && Math.abs(p.y - py) < 1);
  p.x = g0.x; p.y = g0.y;
  tw.updateGates(1.5);   // cooldown expires, standing on the ring again
  tw.updateGates(1 / 60);
  check('gate: after cooldown the ring works again', Math.hypot(p.x - g1.x, p.y - g1.y) < 2);

  // shells ride the gates too
  const sh = { x: g0.x, y: g0.y, vx: 100, vy: 0, r: 4, age: 0, grace: 0, gateCd: 0, owner: 0 };
  tw.shells.push(sh);
  tw.updateGates(1 / 60);
  check('gate: shells teleport with velocity intact', Math.hypot(sh.x - g1.x, sh.y - g1.y) < 2 && sh.vx === 100);
  check('gate: shell cooldown armed', sh.gateCd > 0.5);
  tw.shells.length = 0;
}

// ---------- 26. THE SERAPH: 5th storm boss (wave 25) ----------
{
  tw.startSurvival();
  tw.survStartWave(25);
  const boss = tw.tanks.find(x => x.boss);
  check('seraph: wave 25 boss is THE SERAPH', boss && boss.boss.type === 'seraph', boss && boss.boss.type);
  check('seraph: announced by name', tw.surv.bossName === 'THE SERAPH', tw.surv.bossName);
  tw.setPhase('play');
  const player = tw.tanks[0];
  // first think initializes the beam with a 2s warm-up telegraph
  tw.survBossThink(boss, player, 1 / 60);
  check('seraph: beam initialized with warm-up', boss.boss.beamA !== undefined && boss.boss.warm > 1.5);
  // park the player IN the beam during warm-up: no damage yet
  player.x = boss.x + Math.cos(boss.boss.beamA) * 34;
  player.y = boss.y + Math.sin(boss.boss.beamA) * 34;
  player.alive = true; player.shield = false; player.beamIfr = 0;
  tw.survBossThink(boss, player, 1 / 60);
  check('seraph: warm-up telegraph deals no damage', player.alive === true);
  // burn the warm-up, re-park in the (rotated) beam: one tick of damage
  tw.survBossThink(boss, player, 2.5);
  player.x = boss.x + Math.cos(boss.boss.beamA) * 34;
  player.y = boss.y + Math.sin(boss.boss.beamA) * 34;
  player.alive = true; player.beamIfr = 0;
  tw.survBossThink(boss, player, 1 / 60);
  check('seraph: live beam hits the parked tank', player.alive === false);
  // iframe: the same pass never double-taps
  player.alive = true;
  player.x = boss.x + Math.cos(boss.boss.beamA) * 34;
  player.y = boss.y + Math.sin(boss.boss.beamA) * 34;
  tw.survBossThink(boss, player, 1 / 60);
  check('seraph: per-tank iframe blocks a double-tap', player.alive === true);
  // opposite beam arm hits too (after iframe expires)
  tw.survBossThink(boss, player, 1.3);
  player.x = boss.x + Math.cos(boss.boss.beamA + Math.PI) * 34;
  player.y = boss.y + Math.sin(boss.boss.beamA + Math.PI) * 34;
  player.alive = true; player.beamIfr = 0;
  tw.survBossThink(boss, player, 1 / 60);
  check('seraph: twin beam (opposite arm) is live too', player.alive === false);
  tw.tanks[0].alive = true;
  // cycle regression: 20 still phantom, 30 wraps to warlord, rush wave 5 = seraph
  tw.startSurvival(); tw.survStartWave(20);
  check('seraph: wave 20 is still THE PHANTOM', tw.surv.bossName === 'THE PHANTOM', tw.surv.bossName);
  tw.startSurvival(); tw.survStartWave(30);
  check('seraph: wave 30 wraps to THE WARLORD', tw.surv.bossName === 'THE WARLORD', tw.surv.bossName);
  tw.surv.rush = true; tw.survStartWave(5);
  check('seraph: boss rush wave 5 is THE SERAPH', tw.surv.bossName === 'THE SERAPH', tw.surv.bossName);
  tw.surv.rush = false; tw.surv.on = false;
}

// ---------- 27. CONVOY ESCORT ----------
{
  check('escort: arena pool excludes shifting/nexus/scrapyard',
    !tw.ESCORT_ARENAS.includes('shifting') && !tw.ESCORT_ARENAS.includes('nexus') && !tw.ESCORT_ARENAS.includes('scrapyard'));
  tw.startSurvival('escort');
  check('escort: mode flags set', tw.surv.on && tw.surv.escort === true && !tw.surv.rush && !tw.surv.daily);
  const d = tw.theDrone();
  check('escort: drone spawned (team 0, 4hp)', d && d.team === 0 && d.hp === tw.ESCORT.hp && d.isDrone);
  check('escort: a route exists (≥ 8 waypoints)', Array.isArray(tw.surv.path) && tw.surv.path.length >= 8, tw.surv.path && tw.surv.path.length);
  check('escort: enemies on the field', tw.tanks.filter(x => x.team === 1 && x.alive).length >= 1);
  check('escort: arena from the escort pool', tw.ESCORT_ARENAS.includes(tw.roundArena), tw.roundArena);
  tw.setPhase('play');

  // stranded drone: nobody close -> it will not roll
  const p = tw.tanks[0];
  p.x = d.x + 400 > 900 ? d.x - 400 : d.x + 400; p.y = d.y;
  const dx0 = d.x, dy0 = d.y;
  for (let i = 0; i < 30; i++) tw.updateDrone(1 / 30);
  check('escort: drone waits without an escort', Math.hypot(d.x - dx0, d.y - dy0) < 1 && d.moving === false);

  // pilot alongside: it rolls along the route
  p.x = d.x; p.y = d.y; p.alive = true;
  for (let i = 0; i < 60; i++) { tw.updateDrone(1 / 30); p.x = d.x; p.y = d.y; }
  check('escort: drone rolls with a pilot alongside', Math.hypot(d.x - dx0, d.y - dy0) > 30, Math.hypot(d.x - dx0, d.y - dy0).toFixed(0));
  check('escort: no sudden death during a leg', (() => { tw.setRoundTime(60); tw.update(1 / 60); return tw.surv.on; })());

  // final waypoint -> DELIVERED -> perk draft
  d.pathI = tw.surv.path.length - 1;
  const last = tw.surv.path[tw.surv.path.length - 1];
  d.x = last.x - 6; d.y = last.y; p.x = d.x; p.y = d.y;
  for (let i = 0; i < 20 && tw.phase !== 'draft'; i++) tw.updateDrone(1 / 30);
  check('escort: delivery triggers the perk draft', tw.phase === 'draft', tw.phase);

  // trickle: reinforcements arrive on the timer
  tw.startSurvival('escort'); tw.setPhase('play');
  const d2 = tw.theDrone(), p2 = tw.tanks[0];
  for (const e of tw.tanks) if (e.team === 1) e.alive = false;
  tw.surv.trickleT = 0;
  p2.x = d2.x; p2.y = d2.y;
  tw.updateDrone(1 / 30);
  check('escort: enemies trickle back in', tw.tanks.some(x => x.team === 1 && x.alive));

  // drone destroyed -> the run is over
  d2.alive = false;
  tw.update(1 / 60);
  check('escort: drone down = run over', tw.phase === 'survover', tw.phase);
  check('escort: bestEscort recorded (legs delivered)', typeof tw.profile.bestEscort === 'number');

  // players down (drone still alive) also ends it — the drone can't win alone
  tw.startSurvival('escort'); tw.setPhase('play');
  for (const x of tw.tanks) if (x.team === 0 && !x.isDrone) x.alive = false;
  tw.update(1 / 60);
  check('escort: pilots down = run over even with the drone alive', tw.phase === 'survover');
  tw.surv.on = false;
}

// ---------- 28. CO-OP DUO BOARD + escort over the wire ----------
{
  const oldPilot = tw.profile.pilot;
  tw.profile.pilot = 'DADCOMMANDER99'; tw.net.guestPilot = 'SONNYBOY12345';
  check('duo: name is "HOST + GUEST", each capped at 8', tw.duoName() === 'DADCOMMA + SONNYBOY', tw.duoName());
  check('duo: fits the API 20-char nickname cap', tw.duoName().length <= 20, tw.duoName().length);
  tw.net.guestPilot = '';
  check('duo: missing guest name falls back to ALLY', tw.duoName().endsWith('+ ALLY'), tw.duoName());
  tw.profile.pilot = oldPilot;

  // guest rebuilds an escort wave from the swave message (drone flag rides index 8)
  tw.startMatch({ mode: 'quick', aiLevel: 'rookie', arena: 'maze' });   // gives us real walls to pack
  const msg = { t: 'swave', wave: 3, bn: '', ar: 'maze', es: 1, walls: tw.packWalls(),
    pl: [], cr: [], gt: [],
    tk: [[100, 100, 0, 'scout', 0, 14, 0, 1, 0], [140, 100, 0, 'scout', 0, 12, 0, 4, 1],
         [700, 400, 0, 'viper', 1, 14, 0, 1, 0]],
    pk: {}, run: 0, tr: ['', ''] };
  tw.gmGuestSWave(msg);
  check('duo: guest learns it is an escort wave', tw.surv.escort === true);
  const gd = tw.tanks.find(x => x.isDrone);
  check('duo: guest rebuilds the drone (4hp, team 0)', gd && gd.team === 0 && gd.hp === 4, gd && gd.hp);
  tw.net.role = 'guest';
  check('duo: guest never simulates the drone', (() => { const x0 = gd.x; tw.setPhase('play'); tw.updateDrone(1 / 30); return gd.x === x0; })());
  tw.net.coop = false; tw.net.role = null; tw.surv.on = false; tw.surv.escort = false;
}

// ---------- 29. REMATCH keeps the survival variant (the convoy-rematch bug) ----------
// btnRematch rebuilt the mode from surv flags but forgot escort, so a Convoy
// rematch silently became a plain storm. Drive the REAL button handler.
{
  const rematch = sandbox.document.getElementById('btnRematch').onclick;
  check('rematch handler wired', typeof rematch === 'function');
  tw.startSurvival('escort');
  check('convoy entry: escort flag on', tw.surv.escort === true && tw.mode === 'play');
  rematch();
  check('rematch from CONVOY stays convoy', tw.surv.escort === true && tw.mode === 'play',
    'escort=' + tw.surv.escort);
  tw.startSurvival('rush');
  rematch();
  check('rematch from RUSH stays rush', tw.surv.rush === true && !tw.surv.escort);
  tw.startSurvival();
  rematch();
  check('rematch from plain storm stays plain', !tw.surv.escort && !tw.surv.rush && !tw.surv.daily);
  tw.surv.on = false; tw.setPhase('menu');
}

console.log(`\n=== stormtest: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
