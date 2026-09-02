// Headless smoke test: node test/smoke.test.mjs
// Drives the real scenes + mini-games with a scripted bot (idle run → game over; perfect run → win).
import { Engine, W, H } from '../src/engine.js';
import { MINIGAMES, regularMinigames, specialMinigame } from '../src/minigames/index.js';
import { CUBES } from '../src/minigames/whack_a_pat.js';
import { RunState, fmtClock, DAY_START, BOSS_TIME, DAY_END, MAX_PATIENCE, introSeen } from '../src/state.js';
import { TitleScene, HowToScene } from '../src/scenes/title.js';
import { WorkdayScene } from '../src/scenes/workday.js';
import { IntroScene, T as INTRO_T } from '../src/scenes/intro.js';
import { GameOverScene, WinScene } from '../src/scenes/end.js';
import { drawSoung, drawPat, _injectSpriteForTest } from '../src/characters.js';

let pass = 0, fail = 0;
const _ls = {}; globalThis.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name); } };

// canvas ctx stub: every method no-ops, gradients/measureText return usable objects
const ctx = new Proxy({}, { get: (_, k) => {
  if (k === 'measureText') return () => ({ width: 10 });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'canvas') return { width: W, height: H };
  return () => {};
}, set: () => true });

class Game {
  constructor() { this.engine = new Engine(null); this.engine.ctx = ctx; this.state = 'title'; }
  showTitle() { this.state = 'title'; this.engine.go(new TitleScene(this)); }
  showHowTo() { this.state = 'howto'; this.engine.go(new HowToScene(this)); }
  showIntro(replay = false) { this.state = 'intro'; this.engine.go(new IntroScene(this, { mandatory: !replay && !introSeen() })); }
  play() { if (introSeen()) this.startWorkday(); else this.showIntro(); }
  startWorkday() { this.state = 'workday'; this.engine.go(new WorkdayScene(this)); }
  gameOver(S) { this.state = 'over'; this.S = S; this.engine.go(new GameOverScene(this, S)); }
  win(S) { this.state = 'win'; this.S = S; this.engine.go(new WinScene(this, S)); }
}

// ---- sprite paths with fake images (bodies + heads) ----
{
  const fake = (w, h) => ({ naturalWidth: w, naturalHeight: h, width: w, height: h });
  for (const m of ['base', 'annoyed', 'angry', 'rage', 'eyeroll', 'deadpan', 'smirk', 'cool', 'shocked']) _injectSpriteForTest('soung:' + m, fake(400, 520));
  for (const m of ['base', 'happy', 'excited']) _injectSpriteForTest('pat:' + m, fake(400, 520));
  for (const p of ['stand', 'walk', 'rage']) _injectSpriteForTest('soung:body_' + p, fake(520, 800));
  _injectSpriteForTest('pat:body_stand', fake(520, 800));
  let ok = true;
  try {
    for (const o of [{}, { walk: true, arms: 'walk' }, { arms: 'up', mood: 'rage', steam: true }, { seated: true, arms: 'typing', sweat: true, mood: 'cool' }, { mood: 'shocked', tilt: 0.2 }]) { const r = drawSoung(ctx, 300, 600, 1, { t: 1.2, ...o }); if (!(r.headY < 600 && r.top < r.headY)) ok = false; }
    for (const o of [{}, { walk: true }, { arms: 'none', tilt: -0.3 }, { mood: 'excited' }]) { const r = drawPat(ctx, 900, 600, 1, { t: 0.5, ...o }); if (!(r.headY < 600)) ok = false; }
  } catch (e) { ok = false; console.log('  sprite draw threw: ' + e.message); }
  check('full-body sprite paths draw (Soung 3 poses, Pat)', ok);
}

// ---- registry ----
check('11 mini-games registered', MINIGAMES.length === 11);
check('9 regular', regularMinigames().length === 9);
check('lunch special', specialMinigame('lunch')?.id === 'lunch_defense');
check('boss special', specialMinigame('boss')?.id === 'boss');
check('fmtClock start', fmtClock(DAY_START) === '8:01 AM');
check('fmtClock boss', fmtClock(BOSS_TIME) === '4:58 PM');
check('fmtClock end', fmtClock(DAY_END) === '5:00 PM');
const rs = new RunState(); rs.addGrumpy(150); check('grumpy clamps 100', rs.grumpy === 100 && rs.pendingRage); rs.addGrumpy(-500); check('grumpy clamps 0', rs.grumpy === 0);

// ---- helpers ----
function run(game, seconds, bot) {
  const dt = 1 / 60; let frames = Math.round(seconds / dt);
  while (frames-- > 0) { bot?.(game); game.engine.step(dt); game.engine.render(); if (game.state === 'over' || game.state === 'win') return; }
}
const click = (g, x, y) => g.engine.scene.pointerDown({ x, y });

// ---- title + howto render ----
{ const g = new Game(); g.showTitle(); run(g, 6); check('title renders 6s', true); click(g, W / 2, 640); check('how-to opens', g.state === 'howto'); run(g, 1); click(g, W / 2, 660); check('back to title', g.state === 'title'); click(g, W / 2, 557); check('first START plays the intro', g.state === 'intro');
  run(g, 5); click(g, 100, 100); check('first-ever intro cannot be skipped', g.state === 'intro' && !introSeen());
  let frames = 0; while (g.state === 'intro' && frames++ < 60 * 60) { g.engine.step(1 / 60); g.engine.render(); }
  check('intro runs to the end and hands off to the workday', g.state === 'workday' && frames >= (INTRO_T.end - 5) * 60 - 5 && frames <= (INTRO_T.end - 5) * 60 + 5 && introSeen());
  g.showTitle(); click(g, W / 2, 557); check('second START skips the intro', g.state === 'workday');
  g.showTitle(); click(g, W / 2 + 105, 640); check('▶ INTRO button replays it', g.state === 'intro'); run(g, 20); click(g, 100, 100); check('click skips the intro', g.state === 'workday'); }

// ---- idle run: nobody touches anything → grumpy climbs → 3 rages → game over ----
{
  const g = new Game(); g.startWorkday(); const sc = g.engine.scene; let sawRage = false, resetOk = false, phases = new Set(), seen = new Set(), maxT = 0;
  run(g, 600, gg => { const s = gg.engine.scene; if (s.phase) phases.add(s.phase); if (s.def) seen.add(s.def.id); if (s.phase === 'rage') sawRage = true; if (sawRage && s.phase === 'transition' && s.S.grumpy >= 15 && s.S.grumpy <= 75) resetOk = true; });
  check('idle run ends in game over', g.state === 'over');
  check('idle run reached Full Soung Mode', sawRage);
  check('rage leaves grumpy in 15–75 (earned cool-down)', resetOk);
  check('patience exhausted at game over', g.S.patience === 0 && g.S.stats.fullSoung === MAX_PATIENCE);
  check('score credited for rages', g.S.score >= 2000 * MAX_PATIENCE);
  check('phases cycled', ['transition', 'intro', 'play', 'result', 'rage'].every(p => phases.has(p)));
  check('game-over scene renders', (run(g, 3), true));
  console.log('  idle: games played', g.S.gamesPlayed, 'clock', fmtClock(g.S.clock), 'seen', [...seen].join(','));
}

// ---- perfect bot: plays every mini-game correctly → survives to 5:00 PM ----
function bot(g) {
  const s = g.engine.scene; if (!s.phase) return;
  if (s.phase === 'rage') { const it = s.rage.items.find(i => !i.bad); if (it) click(g, it.x, it.y); return; }
  if (s.phase !== 'play') return;
  const m = s.mg, id = s.def.id;
  if (id === 'hide_and_seek') { const safe = m.covers.filter(c => c.blown <= 0 && c.warn <= 0); const side = safe.filter(c => (c.x - m.x) * (m.patX - m.x) <= 0 || Math.abs(c.x - m.x) < 60); const cands = side.length ? side : safe; cands.sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x)); m.targetX = cands[0]?.x ?? m.x; }
  else if (id === 'elevator_sprint') { const ahead = m.obs.find(o => !o.hit && o.x - m.dist > 40 && o.x - m.dist < 160); if (ahead && (m.y === 0 || (m.jumps < 1 && -m.y < ahead.h + 20 && m.vy > 0))) m.jump(); }
  else if (id === 'slack_attack') { for (const b of [...m.bubbles]) click(g, b.x, b.y); }
  else if (id === 'meeting_declined') { for (const c of [...m.cards]) if (!c.important) click(g, c.x, c.y); }
  else if (id === 'hallway_escape') { const near = m.cw.filter(c => c.k > 0.35 && c.k < 0.95 && !c.hit).map(c => m.pos({ ...c, k: 0.92 }).x); if (near.length) { let best = m.x, bestS = -1; for (let cx = 200; cx <= 1080; cx += 40) { const s = Math.min(...near.map(nx => Math.abs(cx - nx))) - Math.abs(cx - m.x) * 0.15; if (s > bestS) { bestS = s; best = cx; } } m.targetX = best; } }
  else if (id === 'lunch_defense') { if (m.pat) click(g, m.pat.x, 500); for (const h of [...m.hands]) { if (h.slapped <= 0 && h.k > 0.3) { const q = m.pos(h); click(g, q.x, q.y); } } }
  else if (id === 'whack_a_pat') { for (const p of m.pops) if (p.state === 'rise' && p.kind !== 'coworker' && p.t > 0.2) { const [cx, cy] = CUBES[p.cube]; click(g, cx, cy - 95 * m.height(p)); } }
  else if (id === 'paper_toss') { if (m.ball && !m.ball.live) { const T = 0.75, dx = m.bin.x - 300, dy = (640 - m.bin.h) - 520; m.launch((dx - 0.5 * m.wind * T * T) / T, (dy - 0.5 * 1500 * T * T) / T); } }
  else if (id === 'paper_barrage') { if (m.balls.some(b => b.k >= 0.76 && b.k <= 0.95)) m.catchNow(); }
  else if (id === 'rkt_run') { m.hold = m.state === 'busy' && m.stateT > 0.35; }
  else if (id === 'boss') { if (m.t >= m.intro) { const p = { x: m.btn.x + 10, y: m.btn.y + 10 }; if (!m.decoys.some(d => d.hit(p))) click(g, p.x, p.y); for (const inv of [...m.invites]) click(g, inv.x, inv.y); } }
}
{
  const g = new Game(); g.startWorkday(); const seen = new Set(); let lunchAtNoon = null;
  const results = []; let lastRes = null;
  run(g, 900, gg => { const s = gg.engine.scene; if (s.def) { seen.add(s.def.id); if (s.def.id === 'lunch_defense' && lunchAtNoon == null) lunchAtNoon = s.S.clock; } if (s.phase === 'result' && s.result !== lastRes) { lastRes = s.result; results.push(s.def.id + ':' + (s.result.success ? 'W' : 'L') + ':' + Math.round(s.S.grumpy)); } bot(gg); });
  if (process.env.DIAG) console.log('  results', results.join(' '));
  check('perfect run wins', g.state === 'win');
  check('clock ends at 5:00 PM', g.S.clock === DAY_END);
  check('boss + lunch both played', seen.has('boss') && seen.has('lunch_defense'));
  check('all regular mini-games appeared', regularMinigames().every(m => seen.has(m.id)));
  check('lunch fires at/after noon', lunchAtNoon != null && lunchAtNoon >= 12 * 60);
  check('survival bonus applied', g.S.score >= 5000);
  check('max grumpy stayed sane', g.S.stats.maxGrumpy < 100);
  for (let i = 0; i < 12 * 60; i++) { g.engine.step(1 / 60); g.engine.render(); }
  check('win scene renders full cinematic', g.engine.scene.t > 9.6);
  click(g, W / 2 + 200, 635); check('win → another workday', g.state === 'workday');
  console.log('  perfect: score', g.S.score, 'games', g.S.gamesPlayed, 'maxGrumpy', g.S.stats.maxGrumpy, 'stats', JSON.stringify(g.S.stats));
}
// ---- pause: ESC freezes the workday, RESUME continues, MAIN MENU returns to the title ----
{ const g = new Game(); g.startWorkday(); run(g, 3); const sc = g.engine.scene, t0 = sc.t; sc.keyDown('Escape'); run(g, 2); check('ESC pauses (clock frozen)', sc.paused && sc.t === t0); click(g, W / 2, 365); run(g, 1); check('RESUME continues', !sc.paused && sc.t > t0); click(g, 1175, 47); check('⏸ button pauses', sc.paused); click(g, W / 2, 450); check('MAIN MENU → title', g.state === 'title'); }
// ---- lunch is marked done when it STARTS, so a rage mid-lunch can't re-queue it ----
{ const g = new Game(); g.startWorkday(); const sc = g.engine.scene; sc.S.clock = 12 * 60 + 1; sc.phase = 'transition'; sc.phaseT = 0; run(g, 3.5); check('lunch flagged done at start', sc.def && sc.def.id === 'lunch_defense' && sc.S.lunchDone); }
// ---- hallway: one coworker contact = ONE hit (regression: it used to hit every frame while overlapping) ----
{ const g = new Game(); g.startWorkday(); const sc = g.engine.scene; const def = MINIGAMES.find(m => m.id === 'hallway_escape'); sc.phase = 'transition'; sc.phaseT = 0; sc.chooseNext = () => def; run(g, 2.5);
  const m = sc.mg; m.cw.length = 0; m.spawnT = 99; m.x = 640; m.cw.push({ x: 0.5, k: 0.9, color: '#f00', talk: true, speed: 0.4, pat: false }); const g0 = sc.S.grumpy; run(g, 1.5);
  check('hallway contact counts once', m.hits === 1 && sc.S.grumpy - g0 === 10); }
// ---- elevator: exactly one ground jump + one double-jump, no infinite hopping (regression) ----
{ const g = new Game(); g.startWorkday(); const sc = g.engine.scene; const def = MINIGAMES.find(m => m.id === 'elevator_sprint'); sc.phase = 'transition'; sc.phaseT = 0; sc.chooseNext = () => def; run(g, 2.5);
  const m = sc.mg; m.jump(); run(g, 0.2); const v1 = m.vy; m.jump(); run(g, 0.05); const v2 = m.vy; m.jump(); m.jump(); run(g, 0.05); const v3 = m.vy;
  check('double-jump works once', v1 > -1000 && v2 < v1 && m.jumps === 1); check('third jump in the air is ignored', v3 > v2 - 5); }
// ---- every mini-game survives random clicking for its full duration ----
for (const def of MINIGAMES) {
  const g = new Game(); g.startWorkday(); const sc = g.engine.scene; sc.S.clock = def.special === 'boss' ? BOSS_TIME : def.special === 'lunch' ? 12 * 60 + 1 : DAY_START;
  sc.phase = 'transition'; sc.phaseT = 0; sc.chooseNext = () => def;
  let ok = true, played = false;
  try { run(g, 40, gg => { const s = gg.engine.scene; if (s.phase === 'play' && s.def === def) { played = true; if (Math.random() < 0.3) click(gg, Math.random() * W, Math.random() * H); if (Math.random() < 0.1) s.keyDown('ArrowLeft'); s.pointerMove({ x: Math.random() * W, y: Math.random() * H }); } }); } catch (e) { ok = false; console.log('  ' + def.id + ' threw: ' + e.stack); }
  check(`${def.id} runs under random input`, ok && played);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
