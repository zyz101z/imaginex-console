// Shot of the Day flow + skin trail/particles + new obstacles smoke. node ace_check.js
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // stub the leaderboard API so the flow can be checked offline
  await page.setRequestInterception(true); const posted = [];
  page.on('request', r => { const u = r.url(); if (u.includes('/api/leaderboard')) { if (r.method() === 'POST') { posted.push(JSON.parse(r.postData())); r.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); } else r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify([{ nickname: 'Noah', score: 300 }, { nickname: 'Dad', score: 200 }]) }); } else r.continue(); });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('cgk_save_v1', JSON.stringify({ tutorialDone: true, name: 'Tester' })); });
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  // 1. ace mode: three misses (shoot sideways, weak) → NO ACE result, board rendered, closest posted
  await page.click('#btnPlay'); await page.waitForSelector('#btnAce'); await page.click('#btnAce');
  await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400));
  const h0 = await page.evaluate(() => ({ mode: window.__cgk.S.mode, hud: document.getElementById('hHole').textContent, par: document.getElementById('hPar').textContent }));
  check('ace mode HUD', h0.mode === 'ace' && /Shot of the Day/.test(h0.hud) && /Ball 1\/3/.test(h0.par), JSON.stringify(h0));
  for (let k = 1; k <= 3; k++) {
    await page.waitForFunction(() => window.__cgk.canShoot(), { timeout: 20000 });
    await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; const a = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x) + 2.4; window.__cgk.shootBall(Math.cos(a), Math.sin(a), 0.15); });
    await page.waitForFunction(() => window.__cgk.S.balls[0].resting, { timeout: 20000 }); await new Promise(r => setTimeout(r, 500));
    if (k < 3) { const st = await page.evaluate(() => ({ att: window.__cgk.S.ace.attempt, atTee: Math.abs(window.__cgk.S.balls[0].x - window.__cgk.S.world.teeX) < 0.01, par: document.getElementById('hPar').textContent })); check(`ball ${k} miss returns to tee`, st.att === k && st.atTee && st.par.includes(`Ball ${k + 1}/3`), JSON.stringify(st)); }
  }
  await page.waitForFunction(() => window.__cgk.S.screen === 'scorecard', { timeout: 10000 }); await new Promise(r => setTimeout(r, 600));
  const sc = await page.evaluate(() => ({ head: document.getElementById('scoreHead').textContent, board: document.getElementById('aceBoard').textContent, again: document.getElementById('btnAgain').textContent, best: window.__cgk.save.aceBest }));
  check('no-ace result shown', /NO ACE/.test(sc.head), sc.head); check('board rendered from API', /Noah/.test(sc.board) && /Dad/.test(sc.board), sc.board.slice(0, 80)); check('TRY AGAIN button', sc.again === 'TRY AGAIN');
  await page.screenshot({ path: 'ace_result.png' });
  // 2. ace mode: force an ace on ball 1 → 300 pts posted
  await page.click('#btnAgain'); await page.waitForFunction(() => window.__cgk.S.world && window.__cgk.S.mode === 'ace' && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; S.ace.attempt = 1; b.x = S.world.cupX - 0.3; b.z = S.world.cupZ; b.resting = false; b.vx = 1.2; b.vz = 0; });
  await page.waitForFunction(() => window.__cgk.S.screen === 'scorecard', { timeout: 15000 }); await new Promise(r => setTimeout(r, 400));
  const ac = await page.evaluate(() => ({ head: document.getElementById('scoreHead').textContent, pts: window.__cgk.S.points[0] }));
  check('ace on ball 1 = 300', /ACE ON BALL 1/.test(ac.head) && ac.pts === 300, JSON.stringify(ac));
  check('score posted to per-day ace board', posted.some(p => /^crazy-golf-ace-daily-\d{8}$/.test(p.gameId) && p.score === 300 && p.nickname === 'Tester'), JSON.stringify(posted));
  // 3. skins: equip Inferno, shoot, particles + trail colour
  await page.evaluate(() => { const { save, SKINS, R } = window.__cgk; save.skins.push('flame'); save.skin = 'flame'; R.setSkin(SKINS.find(s => s.id === 'flame')); });
  await page.click('#btnMenu'); await page.evaluate(() => { window.__cgk.S.players = 1; window.__cgk.startRound('quick', 'space'); });
  await page.waitForFunction(() => window.__cgk.S.world && window.__cgk.S.mode === 'quick' && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 }); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; const a = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x); window.__cgk.shootBall(Math.cos(a), Math.sin(a), 0.8); });
  await new Promise(r => setTimeout(r, 350)); const fx = await page.evaluate(() => ({ parts: window.__cgk.R.particles.length, trail: '#' + window.__cgk.R.trail.material.color.getHexString(), glow: window.__cgk.R.ball.material.emissiveIntensity }));
  check('Inferno emits fire particles while rolling', fx.parts > 5, fx.parts); check('Inferno trail is orange', fx.trail === '#ff9100', fx.trail); check('Inferno glows', fx.glow > 0);
  await page.screenshot({ path: 'inferno.png' });
  // 4. new obstacles render on a generated hole containing them (find one)
  const found = await page.evaluate(() => { const { generateCourse } = window.__cgk; for (let s = 1; s < 60; s++) { const c = generateCourse({ kingdom: 'space', seed: s }); const i = c.findIndex(h => h.obstacles.some(o => o.type === 'jump') && h.obstacles.some(o => o.type === 'turntable')); if (i >= 0) return { s, i }; } for (let s = 1; s < 60; s++) { const c = generateCourse({ kingdom: 'space', seed: s }); const i = c.findIndex(h => h.obstacles.some(o => o.type === 'jump')); if (i >= 0) return { s, i, jumpOnly: true }; } return null; });
  check('a Space hole with a jump pad exists', !!found, JSON.stringify(found));
  if (found) { await page.evaluate(async (f) => { const { S, generateCourse } = window.__cgk; S.course = generateCourse({ kingdom: 'space', seed: f.s }); await window.__cgk.loadHole(f.i); }, found); await page.waitForFunction(() => !document.getElementById('loading').classList.contains('on')); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 500)); await page.screenshot({ path: 'jump_hole.png' });
    const jp = await page.evaluate(() => ({ gaps: window.__cgk.S.hole.gaps.length, walls: window.__cgk.S.world.walls.length })); check('jump hole has a gap', jp.gaps >= 1, jp.gaps); }
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); check('no page errors', errs.length === 0);
  console.log(`ace/skins/obstacles: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
