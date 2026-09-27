// Burst-screenshot hole transitions and measure per-frame brightness: any near-black frame = flicker.
const puppeteer = require('puppeteer-core'); const sharp = require('sharp');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 });
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => { window.__cgk.S.players = 1; window.__cgk.startRound('quick', 'meadow'); });
  await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 800));
  const lum = async (buf) => { const st = await sharp(buf).resize(64, 38).greyscale().stats(); return st.channels[0].mean; };
  async function transition(label, trigger) {
    const frames = []; const t0 = Date.now(); await page.evaluate(trigger);
    while (Date.now() - t0 < 2600) { const b = await page.screenshot({ type: 'jpeg', quality: 60 }); frames.push({ t: Date.now() - t0, l: await lum(b), ov: await page.evaluate(() => getComputedStyle(document.getElementById('loading')).opacity) }); }
    const minL = Math.min(...frames.map(f => f.l)); const dark = frames.filter(f => f.l < 40); const ovShown = frames.some(f => Number(f.ov) > 0.05);
    console.log(`${label}: ${frames.length} frames, min luminance ${minL.toFixed(0)}, dark frames ${dark.length}, overlay visible ${ovShown}`, frames.map(f => Math.round(f.l)).join(' '));
    check(label + ': no dark frames', dark.length === 0, dark.map(f => `${f.t}ms:${f.l.toFixed(0)}`).join(','));
    check(label + ': overlay never flashed', !ovShown);
    await page.waitForFunction(() => window.__cgk.S.world && !window.__cgk.S.flyover, { timeout: 60000 }).catch(() => {}); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 500));
  }
  await transition('hole 1→2 (loadHole)', () => window.__cgk.loadHole(1));
  await transition('hole 2→3 (loadHole)', () => window.__cgk.loadHole(2));
  // real cup-in transition (ball dropped → popup → next hole)
  await transition('cup-in → next hole', () => { const { S } = window.__cgk; const b = S.balls[0]; b.x = S.world.cupX - 0.25; b.z = S.world.cupZ; b.resting = false; b.vx = 1.0; b.vz = 0; });
  // kingdom switch (daily-style): Space after Meadow
  await transition('kingdom switch', () => { const { S, generateCourse } = window.__cgk; S.course[4] = generateCourse({ kingdom: 'space', seed: 3 })[4]; return window.__cgk.loadHole(4); });
  console.log(`flicker: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
