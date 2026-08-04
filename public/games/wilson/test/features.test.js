const puppeteer = require('puppeteer');
const CHROME = process.env.CHROME_PATH || (process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  await sleep(500);
  const problems = [];
  await page.evaluate(() => window.__wilson.reset());
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(300);

  // A) prompt library grew
  const prompts = await page.evaluate(() => window.__wilson.prompts());
  console.log('prompts:', prompts.length, prompts.join(','));
  if (prompts.length < 18) problems.push('expected >=18 prompts, got ' + prompts.length);
  if (new Set(prompts).size !== prompts.length) problems.push('duplicate prompt ids');

  // B) city has rails + birds
  const city = await page.evaluate(() => window.__wilson.cityState());
  console.log('rails:', city.rails.length, '| birds:', city.birds);
  if (city.rails.length < 3) problems.push('expected grind rails in city');
  if (city.birds < 3) problems.push('expected pigeons in city');

  // C) TRICK: jump, then jump again mid-air -> airTricks>0, land -> coins awarded
  const coinsBefore = (await page.evaluate(() => window.__wilson.state())).coins;
  await page.evaluate(() => { window.__wilson.goto(300); window.__wilson.jump(); });
  await sleep(120);
  await page.evaluate(() => window.__wilson.jump());   // mid-air trick
  await sleep(80);
  const mid = await page.evaluate(() => window.__wilson.pos());
  console.log('mid-air:', 'trick=' + mid.trick, 'airTricks=' + mid.airTricks, 'y=' + mid.y.toFixed(0));
  if (!(mid.airTricks > 0)) problems.push('second jump in air should start a trick');
  await sleep(1100); // land
  const afterLand = await page.evaluate(() => window.__wilson.state());
  const posLand = await page.evaluate(() => window.__wilson.pos());
  console.log('after land: coins', coinsBefore, '->', afterLand.coins, '| airTricks reset:', posLand.airTricks);
  if (!(afterLand.coins > coinsBefore)) problems.push('landing a trick should award coins');
  if (posLand.airTricks !== 0) problems.push('airTricks should reset on landing');

  // D) GRIND: drop onto a rail from above
  const rail = city.rails[0];
  await page.evaluate((r) => window.__wilson.place(r.x + r.w/2, -(r.h) - 40, 200), rail);
  await sleep(300);
  const onRail = await page.evaluate(() => window.__wilson.pos());
  console.log('rail test: onRail=' + onRail.onRail, 'y=' + onRail.y.toFixed(0), '(rail h=' + rail.h + ')');
  if (!onRail.onRail) problems.push('falling onto a rail should start a grind');

  // grinding off the end pays out
  const preGrind = (await page.evaluate(() => window.__wilson.state())).coins;
  await page.keyboard.down('ArrowRight');
  await sleep(1000);
  await page.keyboard.up('ArrowRight');
  const postGrind = (await page.evaluate(() => window.__wilson.state())).coins;
  console.log('grind payout: coins', preGrind, '->', postGrind);
  if (!(postGrind > preGrind)) problems.push('completing a grind should pay coins');

  // E) MURAL PERSISTENCE: paint a wall, reload, confirm image data survived
  const wallX = city.walls[0].x;
  await page.evaluate((x) => window.__wilson.goto(x + 130), wallX);
  await sleep(200);
  await page.evaluate(() => window.__wilson.paintHere());
  await sleep(200);
  await page.evaluate(() => { window.__wilson.fillTarget(1,'neongreen'); });
  await page.evaluate(() => document.getElementById('btnDone').click());
  await sleep(400);
  const cityAfterPaint = await page.evaluate(() => window.__wilson.cityState());
  const paintedNow = cityAfterPaint.walls.filter(w => w.hasImg).length;
  console.log('walls with saved mural image:', paintedNow);
  if (paintedNow < 1) problems.push('painted wall should store a mural image');

  const saveSize = await page.evaluate(() => (localStorage.getItem('wilson_save')||'').length);
  console.log('save size:', (saveSize/1024).toFixed(1) + 'KB');
  if (saveSize > 2_000_000) problems.push('save too large: ' + saveSize);

  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(600);
  const cityReload = await page.evaluate(() => window.__wilson.cityState());
  const imgAfter = cityReload.walls.filter(w => w.hasImg).length;
  console.log('after reload, murals with image:', imgAfter);
  if (imgAfter < 1) problems.push('mural image should survive reload');

  // F) screenshot the street with rails/birds/mural
  await page.evaluate((x) => window.__wilson.goto(x - 200), wallX);
  await sleep(400);
  await page.screenshot({ path: __dirname + '/shot3_street.png' });
  await page.evaluate(() => { const c = window.__wilson.cityState(); window.__wilson.goto(c.rails[0].x - 60); });
  await sleep(400);
  await page.screenshot({ path: __dirname + '/shot3_rail.png' });

  console.log('\n=== ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  if (errors.length) problems.push('runtime errors present');
  console.log('\n=== VERDICT ===');
  console.log(problems.length ? 'FAIL:\n' + problems.join('\n') : 'ALL NEW-FEATURE CHECKS PASSED');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
