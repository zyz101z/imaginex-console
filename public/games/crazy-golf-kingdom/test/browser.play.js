// Full playthrough through the real browser loop: 9 holes solo (career), then a 2P hole. node play.js [kingdom]
const puppeteer = require('puppeteer-core');
const kingdom = process.argv[2] || 'meadow';
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 });
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  // shot chooser injected into the page: greedy search using the real physics module
  await page.evaluate(async () => {
    const P = await import('./src/physics.mjs');
    window.__pick = () => { const { S } = window.__cgk; const w = S.world, b = S.balls[S.player]; let best = null; const base = Math.atan2(w.cupZ - b.z, w.cupX - b.x);
      for (const a of [0, .18, -.18, .4, -.4, .7, -.7, 1.05, -1.05, 1.5, -1.5, 2, -2, 2.6, -2.6, Math.PI]) for (const p of [.12, .25, .4, .55, .75, 1]) { const t = { ...b, events: [] }; P.shoot(t, Math.cos(base + a), Math.sin(base + a), p); P.simulateUntilRest(w, t, S.worldT, 14); const d = t.inCup ? -1 : Math.hypot(w.cupX - t.x, w.cupZ - t.z) + (t.penalty || 0) * 50; if (!best || d < best.d) best = { d, dx: Math.cos(base + a), dz: Math.sin(base + a), p }; if (t.inCup) return best; }
      return best; };
  });
  async function playRound(mode, players, maxHoles = 9) {
    await page.evaluate((m, k, pl) => { const { S } = window.__cgk; S.players = pl; window.__cgk.startRound(m, k); }, mode, kingdom, players);
    await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
    let shots = 0; const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const st = await page.evaluate(() => { const { S } = window.__cgk; return { screen: S.screen, hole: S.holeIdx, can: window.__cgk.canShoot(), fly: !!S.flyover, over: S.holeOver, loading: document.getElementById('loading').classList.contains('on') }; });
      if (st.screen === 'scorecard') break;
      if (st.hole >= maxHoles) break;
      if (st.fly) { await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 150)); continue; }
      if (st.can) { await page.evaluate(() => { const s = window.__pick(); window.__cgk.shootBall(s.dx, s.dz, s.p); }); shots++; await new Promise(r => setTimeout(r, 400)); continue; }
      await new Promise(r => setTimeout(r, 250));
    }
    return { shots, ...(await page.evaluate(() => { const { S, save } = window.__cgk; return { screen: S.screen, scores: S.scores, points: S.points, pars: S.course.map(h => h.par), coins: save.coins, career: save.career, head: document.getElementById('scoreHead').textContent, table: document.getElementById('scoreTable').innerText.split('\n').length }; })) };
  }
  const r1 = await playRound('career', 1);
  console.log('career:', JSON.stringify({ shots: r1.shots, screen: r1.screen, scores: r1.scores[0], pars: r1.pars, points: r1.points[0], coins: r1.coins, head: r1.head }));
  check('career round reached scorecard', r1.screen === 'scorecard'); check('9 scores recorded', r1.scores[0].filter(x => x != null).length === 9, r1.scores[0]);
  check('coins earned', r1.coins > 0); check('stars saved', r1.career[kingdom] && Object.keys(r1.career[kingdom]).length === 9);
  check('scores plausible (≤ 8 each)', r1.scores[0].every(s => s >= 1 && s <= 8)); check('bot mostly at or under par', r1.scores[0].filter((s, i) => s <= r1.pars[i]).length >= 5, r1.scores[0].map((s, i) => s - r1.pars[i]));
  await page.screenshot({ path: 'p_scorecard.png' });
  const r2 = await playRound('quick', 2, 3);
  console.log('2P:', JSON.stringify({ shots: r2.shots, screen: r2.screen, scores: r2.scores, head: r2.head }));
  check('2P: both players scored on holes', r2.scores[0].filter(x => x != null).length >= 2 && r2.scores[1].filter(x => x != null).length >= 2, JSON.stringify(r2.scores));
  // daily
  const r3 = await playRound('daily', 1, 2);
  check('daily round runs', r3.scores[0].filter(x => x != null).length >= 2, JSON.stringify(r3.scores));
  console.log('errors:', errs.length ? errs.slice(0, 5).join('\n') : 'none'); check('no page errors', errs.length === 0);
  console.log(`playthrough: ${pass} passed, ${fail} failed`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
