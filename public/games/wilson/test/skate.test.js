const puppeteer = require('puppeteer');
const CHROME = process.env.CHROME_PATH || (process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=900,700'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE.ERR: ' + m.text()); });

  await page.goto('http://localhost:3000/games/wilson/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  const problems = [];

  // fresh save
  await page.evaluate(() => window.__wilson.reset());

  // 1) PLAY enters skate mode with a 10-wall city
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await new Promise(r => setTimeout(r, 400));
  let st = await page.evaluate(() => window.__wilson.state());
  let city = await page.evaluate(() => window.__wilson.cityState());
  console.log('screen:', st.screen, '| walls:', city && city.walls.length, '| world coins:', city && city.coins);
  if (st.screen !== 'skate') problems.push('PLAY should enter skate, got ' + st.screen);
  if (!city || city.walls.length !== 10) problems.push('city should have 10 walls');

  // 2) keyboard movement moves Wilson right
  const x0 = (await page.evaluate(() => window.__wilson.pos())).x;
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 700));
  await page.keyboard.up('ArrowRight');
  const x1 = (await page.evaluate(() => window.__wilson.pos())).x;
  console.log('moved:', Math.round(x0), '->', Math.round(x1));
  if (!(x1 > x0 + 100)) problems.push('arrow-right should move Wilson right');

  // 3) jump works
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 180));
  const air = await page.evaluate(() => window.__wilson.pos());
  console.log('airborne y:', air.y.toFixed(1), 'ground:', air.ground);
  if (air.ground !== false) problems.push('space should make Wilson jump');
  await new Promise(r => setTimeout(r, 800));

  // 4) coin collection: teleport through a coin arc
  const coinsBefore = (await page.evaluate(() => window.__wilson.cityState())).coins;
  const firstWallX = city.walls[0].x;
  await page.evaluate((x) => window.__wilson.goto(x), firstWallX + 260 + 120 - 60);
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, 900));
  await page.keyboard.up('ArrowRight');
  const coinsAfter = (await page.evaluate(() => window.__wilson.cityState())).coins;
  const walletCoins = (await page.evaluate(() => window.__wilson.state())).coins;
  console.log('world coins:', coinsBefore, '->', coinsAfter, '| wallet:', walletCoins);
  if (!(coinsAfter < coinsBefore)) problems.push('skating through arc should collect coins');
  if (!(walletCoins > 0)) problems.push('wallet should gain coins');

  // 5) approach wall -> paint prompt appears -> enter spray with the wall's own prompt
  await page.evaluate((x) => window.__wilson.goto(x), firstWallX + 130);
  await new Promise(r => setTimeout(r, 250));
  const near = await page.evaluate(() => window.__wilson.pos());
  const paintVisible = await page.evaluate(() => !document.getElementById('btnPaint').classList.contains('hidden'));
  console.log('near wall prompt:', near.near, '| paint btn visible:', paintVisible);
  if (!near.near) problems.push('should detect near wall');
  if (!paintVisible) problems.push('PAINT button should be visible near blank wall');

  const entered = await page.evaluate(() => window.__wilson.paintHere());
  await new Promise(r => setTimeout(r, 250));
  st = await page.evaluate(() => window.__wilson.state());
  console.log('entered spray:', entered, '| screen:', st.screen, '| prompt:', st.prompt, '(wall wanted', near.near + ')');
  if (st.screen !== 'play') problems.push('paintHere should enter spray mode');
  if (st.prompt !== near.near) problems.push('spray prompt should match wall prompt');

  // 6) paint it, finish, wall becomes done with grade; screenshot the mural in the world
  await page.evaluate(() => { window.__wilson.fillTarget(1,'purple'); });
  await page.evaluate(() => document.getElementById('btnDone').click());
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: __dirname + '/shot2_result.png' });
  await page.evaluate(() => document.getElementById('btnNext').click());
  await new Promise(r => setTimeout(r, 300));
  city = await page.evaluate(() => window.__wilson.cityState());
  const w0 = city.walls.find(w => w.p === near.near);
  st = await page.evaluate(() => window.__wilson.state());
  console.log('back on street:', st.screen, '| wall done:', w0.done, 'grade:', w0.g);
  if (st.screen !== 'skate') problems.push('btnNext should return to street');
  if (!w0.done) problems.push('wall should be marked done after painting');

  // 7) mural visible in world — screenshot near the painted wall
  await page.evaluate((x) => window.__wilson.goto(x), firstWallX - 150);
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: __dirname + '/shot2_skate.png' });

  // 8) save persistence: reload page, city state should survive
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await new Promise(r => setTimeout(r, 300));
  const city2 = await page.evaluate(() => window.__wilson.cityState());
  const w0b = city2.walls.find(w => w.p === near.near);
  console.log('after reload: walls:', city2.walls.length, '| painted wall still done:', w0b && w0b.done, 'grade:', w0b && w0b.g);
  if (!w0b || !w0b.done) problems.push('painted wall should persist across reload');

  console.log('\n=== ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  if (errors.length) problems.push('runtime errors present');
  console.log('\n=== VERDICT ===');
  console.log(problems.length ? 'FAIL:\n' + problems.join('\n') : 'ALL SKATE CHECKS PASSED');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
