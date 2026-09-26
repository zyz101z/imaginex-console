// Headless screenshot + smoke run of Crazy Golf Kingdom. usage: node shot.js [kingdom] [holeIdx] [outprefix]
const puppeteer = require('puppeteer-core');
const kingdom = process.argv[2] || 'meadow', holeIdx = Number(process.argv[3] || 0), out = process.argv[4] || 'shot';
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 });
  const errs = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: out + '_title.png' });
  // start a quick round in the kingdom directly via the hook
  await page.evaluate(async (k, hi) => { const { S } = window.__cgk; S.mode = 'quick'; S.players = 1; document.getElementById('btnPlay').click(); }, kingdom, holeIdx);
  await page.click(`[data-mode="quick"]`);
  await page.waitForSelector('#kingdomList .kcard');
  const idx = ['meadow', 'candy', 'dino', 'castle', 'space'].indexOf(kingdom);
  await page.evaluate((i) => document.querySelectorAll('#kingdomList .kcard')[i].click(), idx);
  await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  if (holeIdx > 0) { await page.evaluate(async (hi) => { await window.__cgk.loadHole(hi); }, holeIdx); await page.waitForFunction(() => !document.getElementById('loading').classList.contains('on')); }
  await new Promise(r => setTimeout(r, 3200)); // flyover done
  await page.screenshot({ path: out + '_hole.png' });
  const info = await page.evaluate(() => { const { S } = window.__cgk; return { hole: S.holeIdx, par: S.hole.par, tiles: S.hole.tiles.length, obstacles: S.hole.obstacles.map(o => o.type), decor: S.hole.decor.map(d => d.model), fly: !!S.flyover, canvasW: document.getElementById('c').width }; });
  console.log(JSON.stringify(info));
  // take a shot toward the cup via the hook
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; const dx = S.world.cupX - b.x, dz = S.world.cupZ - b.z; const l = Math.hypot(dx, dz); window.__cgk._shot = { dx: dx / l, dz: dz / l }; });
  await page.keyboard.down('Space'); await new Promise(r => setTimeout(r, 500)); await page.keyboard.up('Space');
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: out + '_moving.png' });
  await new Promise(r => setTimeout(r, 4000));
  const after = await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; return { strokes: S.strokes[0], x: +b.x.toFixed(2), z: +b.z.toFixed(2), resting: b.resting, inCup: b.inCup, teeX: +S.world.teeX.toFixed(2) }; });
  console.log(JSON.stringify(after));
  await page.screenshot({ path: out + '_after.png' });
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
