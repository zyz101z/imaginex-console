// iPad emulation: Safari-like UA, touch, 1024x768 landscape + 820x1180 portrait. Real touch drags via CDP Input.dispatchTouchEvent.
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--touch-events=enabled'] });
  for (const [w, h, name] of [[1024, 768, 'ipad_land'], [820, 1180, 'ipad_port']]) {
    const page = await browser.newPage(); await page.setUserAgent(UA); await page.setViewport({ width: w, height: h, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.evaluateOnNewDocument(() => { localStorage.setItem('cgk_save_v1', JSON.stringify({ tutorialDone: true })); });
    await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: name + '_title.png' });
    const t = await page.evaluate(() => ({ touchClass: document.documentElement.classList.contains('touch'), dpr: window.__cgk.R.renderer.getPixelRatio(), scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
    check(name + ': touch class applied', t.touchClass); check(name + ': pixel ratio capped 1.5', t.dpr <= 1.5, t.dpr); check(name + ': no horizontal overflow', t.scrollW <= t.innerW + 1, `${t.scrollW} vs ${t.innerW}`);
    // tap PLAY → modes → quick → kingdom (all via touch taps)
    const tap = async (sel) => { const el = await page.$(sel); const b = await el.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await new Promise(r => setTimeout(r, 250)); };
    await tap('#btnPlay'); await tap('[data-mode="quick"]'); await page.waitForSelector('#kingdomList .kcard'); await tap('#kingdomList .kcard');
    await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
    await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: name + '_hole.png' });
    const hb = await page.evaluate(() => document.getElementById('btnPause').getBoundingClientRect().width); check(name + ': HUD buttons ≥ 44px', hb >= 44, hb);
    // one-finger drag from an arbitrary point (not on the ball) → shot
    const cdp = await page.createCDPSession();
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const sx = w * 0.25, sy = h * 0.3;
    await touch('touchStart', sx, sy); for (let i = 1; i <= 12; i++) { await touch('touchMove', sx, sy + i * 14); await new Promise(r => setTimeout(r, 16)); }
    const mid = await page.evaluate(() => ({ p: window.__cgk.S.aim.power, a: window.__cgk.S.aim.active }));
    await touch('touchEnd', 0, 0); await new Promise(r => setTimeout(r, 150));
    const st = await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; return { strokes: S.strokes[0], moving: !b.resting, music: !!window.__cgk.MUSIC.cur }; });
    check(name + ': touch drag charges power', mid.a && mid.p > 0.15, mid.p.toFixed(2)); check(name + ': touch release shoots', st.strokes === 1 && st.moving, JSON.stringify(st));
    // two-finger pinch: zoom changes, no shot
    await page.waitForFunction(() => window.__cgk.S.balls[0].resting, { timeout: 20000 }); await new Promise(r => setTimeout(r, 2200)); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400));
    const s1 = await page.evaluate(() => window.__cgk.S.strokes[0]);
    const d0 = await page.evaluate(() => window.__cgk.R.cam.dist);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2 - 60, y: h / 2, id: 1 }, { x: w / 2 + 60, y: h / 2, id: 2 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w / 2 - 60 - i * 15, y: h / 2, id: 1 }, { x: w / 2 + 60 + i * 15, y: h / 2, id: 2 }] }); await new Promise(r => setTimeout(r, 16)); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await new Promise(r => setTimeout(r, 150));
    const pz = await page.evaluate(() => ({ dist: window.__cgk.R.cam.dist, strokes: window.__cgk.S.strokes[0] }));
    check(name + ': pinch zooms in', pz.dist < d0 - 0.5, `${d0.toFixed(1)} → ${pz.dist.toFixed(1)}`); check(name + ': pinch does not shoot', pz.strokes === s1, `${s1} → ${pz.strokes}`);
    // pause panel fits and is tappable
    await tap('#btnPause'); const pv = await page.evaluate(() => { const r = document.getElementById('btnResume').getBoundingClientRect(); return r.bottom <= window.innerHeight && r.top >= 0; }); check(name + ': pause panel on screen', pv); await tap('#btnResume');
    console.log(name, 'errors:', errs.length ? errs.join(' | ') : 'none'); check(name + ': no page errors', errs.length === 0);
    await page.close();
  }
  console.log(`ipad: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
