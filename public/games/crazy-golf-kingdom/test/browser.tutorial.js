// Tutorial flow + polish (peek flyover, putter, cannon preview). node tut_check.js
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  // 1. first PLAY on a fresh save starts the tutorial
  await page.evaluate(async () => { const P = await import('./src/physics.mjs'); window.__pick = () => { const { S } = window.__cgk; const w = S.world, b = S.balls[0]; let best = null; const base = Math.atan2(w.cupZ - b.z, w.cupX - b.x); for (const a of [0, .2, -.2, .5, -.5, .9, -.9, 1.4, -1.4, 2.2, -2.2, Math.PI]) for (const p of [.15, .3, .45, .6, .8, 1]) { const t = { ...b, events: [] }; P.shoot(t, Math.cos(base + a), Math.sin(base + a), p); P.simulateUntilRest(w, t, S.worldT, 14); const d = t.inCup ? -1 : Math.hypot(w.cupX - t.x, w.cupZ - t.z) + (t.penalty || 0) * 50; if (!best || d < best.d) best = { d, dx: Math.cos(base + a), dz: Math.sin(base + a), p }; if (t.inCup) return best; } return best; }; });
  await page.click('#btnPlay');
  await page.waitForFunction(() => window.__cgk.S.mode === 'tutorial' && window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 1200));
  const t0 = await page.evaluate(() => ({ mode: window.__cgk.S.mode, coach: document.getElementById('coach').classList.contains('on'), text: document.getElementById('coachText').textContent, obst: window.__cgk.S.hole.obstacles.length, holes: window.__cgk.S.course.length }));
  check('first PLAY starts the tutorial', t0.mode === 'tutorial' && t0.holes === 3, JSON.stringify(t0)); check('coach shows lesson 1', t0.coach && /drag/i.test(t0.text), t0.text); check('lesson 1 has no obstacles', t0.obst === 0, t0.obst);
  await page.screenshot({ path: 'tut_1.png' });
  // putter appears while aiming (keyboard charge)
  await page.keyboard.down('Space'); await new Promise(r => setTimeout(r, 300)); const putter = await page.evaluate(() => window.__cgk.R.putter.visible); await page.keyboard.up('Space');
  check('putter visible while aiming', putter);
  await new Promise(r => setTimeout(r, 400)); const t1 = await page.evaluate(() => document.getElementById('coachText').textContent); check('coach advances after first shot', /dots|harder/i.test(t1), t1);
  // play through the 3 lessons with the bot
  const start = Date.now();
  while (Date.now() - start < 150000) {
    const st = await page.evaluate(() => ({ screen: window.__cgk.S.screen, can: window.__cgk.canShoot(), fly: !!window.__cgk.S.flyover, mode: window.__cgk.S.mode }));
    if (st.screen === 'modes' || st.mode !== 'tutorial') break;
    if (st.fly) { await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 150)); continue; }
    if (st.can) { await page.evaluate(() => { const s = window.__pick(); window.__cgk.shootBall(s.dx, s.dz, s.p); }); await new Promise(r => setTimeout(r, 400)); continue; }
    await new Promise(r => setTimeout(r, 250));
  }
  const done = await page.evaluate(() => ({ screen: window.__cgk.S.screen, done: window.__cgk.save.tutorialDone, coins: window.__cgk.save.coins, coach: document.getElementById('coach').classList.contains('on') }));
  check('tutorial completes to the modes screen', done.screen === 'modes' && done.done === true, JSON.stringify(done)); check('tutorial pays 100 coins', done.coins >= 100, done.coins); check('coach hidden after tutorial', !done.coach);
  // 2. second PLAY goes straight to modes; tutorial button still works
  await page.evaluate(() => document.querySelector('[data-back="title"]').click()); await page.click('#btnPlay'); await new Promise(r => setTimeout(r, 300));
  check('PLAY skips tutorial once done', await page.evaluate(() => window.__cgk.S.screen === 'modes'));
  // 3. peek flyover goes to the cup and comes back
  await page.evaluate(() => document.querySelector('[data-back="title"]').click()); await page.evaluate(() => { window.__cgk.S.players = 1; window.__cgk.startRound('quick', 'meadow'); });
  await page.waitForFunction(() => window.__cgk.S.world && window.__cgk.S.mode === 'quick' && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 }); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 600));
  const b0 = await page.evaluate(() => ({ x: window.__cgk.R.cam.sx, z: window.__cgk.R.cam.sz })); await page.click('#btnPeek'); await new Promise(r => setTimeout(r, 1650));
  const mid = await page.evaluate(() => ({ x: window.__cgk.R.cam.sx, z: window.__cgk.R.cam.sz, cupX: window.__cgk.S.world.cupX, cupZ: window.__cgk.S.world.cupZ, fly: !!window.__cgk.S.flyover }));
  await new Promise(r => setTimeout(r, 1900)); const end = await page.evaluate(() => ({ x: window.__cgk.R.cam.sx, z: window.__cgk.R.cam.sz, fly: !!window.__cgk.S.flyover, can: window.__cgk.canShoot() }));
  check('peek reaches the cup at the midpoint', Math.hypot(mid.x - mid.cupX, mid.z - mid.cupZ) < 1.5, JSON.stringify(mid)); check('peek returns to the ball', Math.hypot(end.x - b0.x, end.z - b0.z) < 1.0 && !end.fly && end.can, JSON.stringify(end));
  // 4. cannon preview extends to the target
  const found = await page.evaluate(() => { const { generateCourse } = window.__cgk; for (let s = 1; s < 120; s++) { const c = generateCourse({ kingdom: 'dino', seed: s }); const i = c.findIndex(h => h.obstacles.some(o => o.type === 'cannon')); if (i >= 0) return { s, i }; } return null; });
  if (found) { await page.evaluate(async (f) => { const { S, generateCourse } = window.__cgk; S.course = generateCourse({ kingdom: 'dino', seed: f.s }); await window.__cgk.loadHole(f.i); }, found); await page.waitForFunction(() => !document.getElementById('loading').classList.contains('on')); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 500));
    const res = await page.evaluate(() => { const { S, R } = window.__cgk; const c = S.hole.obstacles.find(o => o.type === 'cannon'); const T = 2.2; const b = S.balls[0]; b.x = (c.x + 0.5) * T - 1.6; b.z = (c.z + 0.5) * T; b.resting = true; S.aim.active = true; S.aim.dx = 1; S.aim.dz = 0; S.aim.power = 0.4; S.aimTarget = 0; S.drag = { x0: 0, y0: 0 }; return new Promise(r => setTimeout(() => { const n = R.preview.count; const m = new (Object.getPrototypeOf(R.tmpM).constructor)(); R.preview.getMatrixAt(n - 1, m); const p = { x: m.elements[12], z: m.elements[14] }; r({ n, last: p, tx: (c.tx + 0.5) * T, tz: (c.tz + 0.5) * T }); }, 250)); });
    check('cannon preview ends at the target ring', res.n > 5 && Math.hypot(res.last.x - res.tx, res.last.z - res.tz) < 0.6, JSON.stringify(res)); await page.screenshot({ path: 'tut_cannon.png' }); }
  console.log('errors:', errs.length ? errs.join(' | ') : 'none'); check('no page errors', errs.length === 0);
  console.log(`tutorial/polish: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
