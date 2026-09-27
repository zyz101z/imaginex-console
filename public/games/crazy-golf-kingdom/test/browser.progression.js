// Progression flow: XP/levels, quests, mulligan, profile, crown on finale. node prog_check.js
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  // 1. title shows level; profile renders
  const t = await page.evaluate(() => ({ lvl: document.getElementById('lvlTitle').textContent })); check('title shows level', /Lv 1/.test(t.lvl), t.lvl);
  await page.click('#btnProfile'); await new Promise(r => setTimeout(r, 300));
  const pf = await page.evaluate(() => ({ on: document.getElementById('profile').classList.contains('on'), quests: document.querySelectorAll('#pfQuests .quest').length, badges: document.querySelectorAll('#pfBadges .badge').length, crowns: document.querySelectorAll('#pfCrowns .crown').length }));
  check('profile screen renders 3 quests / 20+ badges / 5 crowns', pf.on && pf.quests === 3 && pf.badges >= 20 && pf.crowns === 5, JSON.stringify(pf));
  // 2. XP → level up with reward
  const lv = await page.evaluate(() => { const { save } = window.__cgk; const c0 = save.coins, m0 = save.mulligans; window.__cgk.addXp(900, 'test'); return { xp: save.xp, coins: save.coins - c0, mull: save.mulligans - m0, lvl: document.getElementById('lvlTitle').textContent }; });
  check('900 xp reaches level 2 and pays the reward', lv.xp === 900 && lv.coins === 120 && lv.mull === 1, JSON.stringify(lv));
  // 3. quest progress + completion pays out
  const q = await page.evaluate(() => { const { save } = window.__cgk; const quests = window.__cgk.ensureQuests(); const qb = quests.find(x => x.id === 'bumpers5'); if (!qb) return { skip: true, ids: quests.map(x => x.id) }; const c0 = save.coins; for (let i = 0; i < 5; i++) window.__cgk.questFire('bumper', 1); return { done: save.quests.bumpers5.done, n: save.quests.bumpers5.n, c0 }; });
  if (q.skip) console.log('  (bumper quest not in today\'s set:', q.ids.join(','), ')'); else check('bumper quest completes after 5 hits', q.done && q.n === 5, JSON.stringify(q));
  // 4. mulligan undoes a shot in quick round
  await page.evaluate(() => { document.querySelector('[data-back="title"]').click(); window.__cgk.S.players = 1; window.__cgk.save.mulligans = 2; window.__cgk.startRound('quick', 'meadow'); });
  await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 }); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; const a = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x) + 0.6; window.__cgk.shootBall(Math.cos(a), Math.sin(a), 0.5); });
  await page.waitForFunction(() => window.__cgk.S.balls[0].resting, { timeout: 20000 }); await new Promise(r => setTimeout(r, 300));
  const m = await page.evaluate(() => { const { S, save } = window.__cgk; const before = { x: S.balls[0].x, strokes: S.strokes[0], m: save.mulligans, btn: document.getElementById('btnMulligan').disabled }; window.__cgk.useMulligan(); return { before, after: { x: S.balls[0].x, strokes: S.strokes[0], m: save.mulligans, teeX: S.world.teeX } }; });
  check('mulligan button enabled after a shot', m.before.btn === false); check('mulligan restores position and stroke', m.after.strokes === 0 && Math.abs(m.after.x - m.after.teeX) < 0.01 && m.after.m === m.before.m - 1, JSON.stringify(m));
  // 5. finale hole loads in career, holing it grants a crown
  await page.evaluate(() => { window.__cgk.S.players = 1; window.__cgk.startRound('career', 'meadow'); });
  await page.waitForFunction(() => window.__cgk.S.world && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(async () => { await window.__cgk.loadHole(8); }); await page.waitForFunction(() => window.__cgk.S.hole && window.__cgk.S.hole.finale && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 }); await page.evaluate(() => window.__cgk.skipFlyover()); await new Promise(r => setTimeout(r, 500));
  const fh = await page.evaluate(() => ({ name: window.__cgk.S.hole.name, hud: document.getElementById('popup').querySelector('.big').textContent })); check('finale loads with banner', fh.name === 'The Gauntlet' && /FINALE/.test(fh.hud), JSON.stringify(fh));
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; S.strokes[0] = 3; b.x = S.world.cupX - 0.25; b.z = S.world.cupZ; b.resting = false; b.vx = 1.0; b.vz = 0; });
  await new Promise(r => setTimeout(r, 3500));
  const cr = await page.evaluate(() => ({ crown: !!window.__cgk.save.crowns.meadow, badge: !!window.__cgk.save.badges.crown1 }));
  check('crown awarded for career finale', cr.crown, JSON.stringify(cr)); check('Crowned achievement unlocked', cr.badge);
  await page.screenshot({ path: 'crown.png' });
  console.log('errors:', errs.length ? errs.join(' | ') : 'none'); check('no page errors', errs.length === 0);
  console.log(`progression: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
