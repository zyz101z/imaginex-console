// Real mouse-drag input test: drag from an arbitrary screen point, both aim modes, right-drag orbit, keyboard charge.
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  const ready = async () => { await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 }); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400)); };
  await page.evaluate(() => { const { S } = window.__cgk; S.players = 1; window.__cgk.startRound('quick', 'meadow'); }); await ready();
  const state = () => page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; return { strokes: S.strokes[0], x: b.x, z: b.z, vx: b.vx, vz: b.vz, resting: b.resting, cupX: S.world.cupX, cupZ: S.world.cupZ, yaw: window.__cgk.R.cam.yaw, power: S.aim.power, active: S.aim.active, can: window.__cgk.canShoot(), mode: window.__cgk.save.aimMode }; });
  // 1. PULL mode: drag from a random spot (far from the ball) downward-right → ball should move up-left on screen (away from drag), with mid power
  let s0 = await state(); check('ready to shoot', s0.can);
  const sx = 300, sy = 200; // nowhere near the ball (ball is centred ~640,395)
  await page.mouse.move(sx, sy); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(sx, sy + i * 12); await new Promise(r => setTimeout(r, 16)); }
  const mid = await state(); check('drag anywhere activates aim', mid.active && mid.power > 0.2 && mid.power < 0.8, mid.power.toFixed(2));
  await page.mouse.up(); await new Promise(r => setTimeout(r, 120));
  const s1 = await state(); check('release fires a shot', s1.strokes === 1 && !s1.resting, JSON.stringify({ st: s1.strokes, r: s1.resting }));
  // in pull mode a downward drag (toward camera) sends the ball away from the camera: velocity should point roughly away from camera → toward camera's look direction
  const camDir = await page.evaluate(() => { const c = window.__cgk.R.cam; return { x: -Math.cos(c.yaw), z: -Math.sin(c.yaw) }; });
  const dot = (s1.vx * camDir.x + s1.vz * camDir.z) / (Math.hypot(s1.vx, s1.vz) || 1);
  check('pull mode: drag toward camera shoots away from camera', dot > 0.6, dot.toFixed(2));
  await page.waitForFunction(() => window.__cgk.S.balls[0].resting, { timeout: 20000 }); await new Promise(r => setTimeout(r, 300));
  // 2. power scales with drag length: full-height drag → power 1
  await page.mouse.move(640, 100); await page.mouse.down(); for (let i = 1; i <= 20; i++) { await page.mouse.move(640, 100 + i * 30); await new Promise(r => setTimeout(r, 10)); }
  const full = await state(); check('long drag reaches full power', full.power >= 0.99, full.power.toFixed(2));
  // dead zone / cancel: drag back to origin → power 0, release = no shot
  for (let i = 20; i >= 0; i--) { await page.mouse.move(640, 100 + i * 30); await new Promise(r => setTimeout(r, 6)); }
  const canc = await state(); check('drag back to start cancels (power 0)', canc.power === 0, canc.power);
  await page.mouse.up(); await new Promise(r => setTimeout(r, 100)); const s2 = await state(); check('cancelled release does not shoot', s2.strokes === 1, s2.strokes);
  // 3. right-drag orbits the camera and never shoots
  const yaw0 = s2.yaw; await page.mouse.move(400, 400); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 10; i++) { await page.mouse.move(400 + i * 20, 400); await new Promise(r => setTimeout(r, 10)); } await page.mouse.up({ button: 'right' });
  const s3 = await state(); check('right-drag orbits', Math.abs(s3.yaw - yaw0) > 0.3, (s3.yaw - yaw0).toFixed(2)); check('right-drag does not shoot', s3.strokes === 1);
  // 4. PUSH mode: toggle, then drag toward the camera → ball comes toward camera
  await page.evaluate(() => document.querySelector('.aimBtn').click()); await page.keyboard.press('r'); await new Promise(r => setTimeout(r, 300)); await page.waitForFunction(() => window.__cgk.S.autoFace === false, { timeout: 10000 }); await new Promise(r => setTimeout(r, 200));
  const camDir2 = await page.evaluate(() => { const c = window.__cgk.R.cam; return { x: -Math.cos(c.yaw), z: -Math.sin(c.yaw) }; });
  await page.mouse.move(900, 300); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(900, 300 + i * 12); await new Promise(r => setTimeout(r, 16)); } await page.mouse.up(); await new Promise(r => setTimeout(r, 120));
  const s4 = await state();
  const dot2 = (s4.vx * camDir2.x + s4.vz * camDir2.z) / (Math.hypot(s4.vx, s4.vz) || 1);
  check('push mode: drag toward camera shoots toward camera', s4.mode === 'push' && s4.strokes === 2 && dot2 < -0.6, JSON.stringify({ mode: s4.mode, st: s4.strokes, dot: +dot2.toFixed(2) }));
  await page.evaluate(() => document.querySelector('.aimBtn').click());
  await page.waitForFunction(() => window.__cgk.S.balls[0].resting, { timeout: 20000 }); await new Promise(r => setTimeout(r, 300));
  // 5. keyboard: space ramps and holds
  await page.keyboard.down('Space'); await new Promise(r => setTimeout(r, 1600)); const k1 = await state(); await new Promise(r => setTimeout(r, 600)); const k2 = await state();
  check('space charge ramps to full and holds', k1.power >= 0.99 && k2.power >= 0.99, `${k1.power.toFixed(2)} ${k2.power.toFixed(2)}`);
  await page.keyboard.up('Space'); await new Promise(r => setTimeout(r, 100)); const s5 = await state(); check('space release shoots', s5.strokes === 3, s5.strokes);
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); check('no page errors', errs.length === 0);
  console.log(`drag: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
