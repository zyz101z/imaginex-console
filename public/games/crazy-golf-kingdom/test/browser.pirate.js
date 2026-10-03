// Pirate Cove: kingdom listed, bot plays a full round incl. The Kraken finale, models load, no page errors. node test/browser.pirate.js (server on :8093)
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 }); const errs = []; page.on('pageerror', e => errs.push(e.message)); const bad404 = []; page.on('response', r => { if (r.status() >= 400 && /models\//.test(r.url())) bad404.push(r.url()); });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('cgk_save_v1', JSON.stringify({ tutorialDone: true, name: 'Tester' })); });
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  check('six kingdoms', await page.evaluate(() => window.__cgk.KINGDOMS.length === 6 && window.__cgk.KINGDOMS[5].id === 'pirate'));
  await page.click('#btnPlay'); await page.waitForSelector('[data-mode="quick"]'); await page.click('[data-mode="quick"]'); await new Promise(r => setTimeout(r, 300));
  check('pirate card on kingdoms screen', await page.evaluate(() => [...document.querySelectorAll('#kingdomList .kname')].some(e => /Pirate Cove/.test(e.textContent))));
  await page.screenshot({ path: 'pirate_kingdoms.png' });
  await page.evaluate(() => { window.__cgk.S.players = 1; window.__cgk.startRound('quick', 'pirate'); });
  await page.waitForFunction(() => window.__cgk.S.world && window.__cgk.S.mode === 'quick' && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(async () => { const P = await import('./src/physics.mjs'); window.__pick = () => { const { S } = window.__cgk; const w = S.world, b = S.balls[0]; let best = null; const base = Math.atan2(w.cupZ - b.z, w.cupX - b.x); for (const a of [0, .2, -.2, .5, -.5, .9, -.9, 1.4, -1.4, 2.2, -2.2, Math.PI]) for (const p of [.15, .3, .45, .6, .8, 1]) { const t = { ...b, events: [] }; P.shoot(t, Math.cos(base + a), Math.sin(base + a), p); P.simulateUntilRest(w, t, S.worldT, 14); const d = t.inCup ? -1 : Math.hypot(w.cupX - t.x, w.cupZ - t.z) + (t.penalty || 0) * 50; if (!best || d < best.d) best = { d, dx: Math.cos(base + a), dz: Math.sin(base + a), p }; if (t.inCup) return best; } return best; }; });
  // play all 9 holes with the bot; screenshot the first tide/whirlpool hole and the finale
  const start = Date.now(); let shotTide = false, shotFinale = false, finaleShots = 0; const strokes = [];
  while (Date.now() - start < 330000) {
    const st = await page.evaluate(() => ({ screen: window.__cgk.S.screen, can: window.__cgk.canShoot(), fly: !!window.__cgk.S.flyover, idx: window.__cgk.S.holeIdx, finale: !!(window.__cgk.S.hole && window.__cgk.S.hole.finale), types: window.__cgk.S.hole ? window.__cgk.S.hole.obstacles.map(o => o.type) : [], auto: window.__cgk.S.autoFace }));
    if (st.screen === 'scorecard') break;
    if (st.fly) { await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 200)); continue; }
    if (st.can && st.auto === false) {
      if (!shotTide && (st.types.includes('tide') || st.types.includes('whirlpool'))) { await new Promise(r => setTimeout(r, 700)); await page.screenshot({ path: 'pirate_hole.png' }); shotTide = true; }
      if (!shotFinale && st.finale && finaleShots === 2) { await new Promise(r => setTimeout(r, 700)); await page.screenshot({ path: 'pirate_finale.png' }); shotFinale = true; }
      if (st.finale) finaleShots++; await page.evaluate(() => { const s = window.__pick(); window.__cgk.shootBall(s.dx, s.dz, s.p); }); await new Promise(r => setTimeout(r, 400)); continue; }
    await new Promise(r => setTimeout(r, 250));
  }
  const fin = await page.evaluate(() => ({ screen: window.__cgk.S.screen, scores: window.__cgk.S.scores[0], names: window.__cgk.S.course.map(h => h.finale ? h.name : h.kingdom) }));
  check('bot finished a Pirate Cove round', fin.screen === 'scorecard', JSON.stringify(fin)); check('finale is The Kraken', fin.names[8] === 'The Kraken', fin.names[8]);
  console.log('scores', JSON.stringify(fin.scores)); console.log('screens', shotFinale, shotTide);
  await page.screenshot({ path: 'pirate_card.png' });
  check('no model 404s', bad404.length === 0, bad404.join(',')); console.log('errors:', errs.length ? errs.join(' | ') : 'none'); check('no page errors', errs.length === 0);
  console.log(`pirate: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
