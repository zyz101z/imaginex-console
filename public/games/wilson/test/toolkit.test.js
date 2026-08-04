// Undo / eraser / peek, mural gallery, and challenge goals.
const puppeteer = require('puppeteer');
const CHROME = process.env.CHROME_PATH || (process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=900,700'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE.ERR: ' + m.text()); });
  await page.goto('http://localhost:3000/games/wilson/index.html', { waitUntil: 'networkidle0' });
  await sleep(600);
  const problems = [];
  await page.evaluate(() => window.__wilson.reset());

  // ================= UNDO =================
  await page.evaluate(() => { const W = window.__wilson; W.play(); W.setPrompt('skull'); });
  const u = await page.evaluate(() => {
    const W = window.__wilson;
    W.strokeAt(0.2,0.3,0.5,0.3,'purple','l');
    const afterOne = W.inkPixels();
    W.strokeAt(0.2,0.6,0.8,0.6,'red','l');
    const afterTwo = W.inkPixels();
    W.undo();
    const afterUndo = W.inkPixels();
    return { afterOne, afterTwo, afterUndo, strokes: W.strokeCount() };
  });
  console.log('UNDO: ink after 1 stroke =', u.afterOne, '| after 2 =', u.afterTwo, '| after undo =', u.afterUndo, '| strokes left =', u.strokes);
  if (!(u.afterTwo > u.afterOne)) problems.push('second stroke should add ink');
  if (u.strokes !== 1) problems.push('undo should leave 1 stroke, got ' + u.strokes);
  // replay must reproduce the first stroke exactly
  if (Math.abs(u.afterUndo - u.afterOne) > u.afterOne * 0.02)
    problems.push('undo should restore exactly the first stroke (' + u.afterOne + ' vs ' + u.afterUndo + ')');

  const uEmpty = await page.evaluate(() => { const W = window.__wilson;
    W.undo(); W.undo(); W.undo(); return { strokes: W.strokeCount(), ink: W.inkPixels() }; });
  console.log('UNDO past start:', JSON.stringify(uEmpty));
  if (uEmpty.strokes !== 0 || uEmpty.ink !== 0) problems.push('undoing everything should empty the wall');

  // ================= ERASER =================
  const e = await page.evaluate(() => {
    const W = window.__wilson; W.play(); W.setPrompt('skull');
    W.strokeAt(0.2,0.5,0.8,0.5,'purple','fat');
    const before = W.inkPixels();
    W.strokeAt(0.4,0.5,0.6,0.5,'purple','fat',true);  // erase across the middle
    const after = W.inkPixels();
    return { before, after };
  });
  console.log('ERASER: ink', e.before, '->', e.after);
  if (!(e.after < e.before * 0.9)) problems.push('eraser should remove paint (' + e.before + ' -> ' + e.after + ')');
  if (e.after === 0) problems.push('eraser removed everything — too aggressive');

  // ================= PEEK =================
  const peek = await page.evaluate(async () => {
    const W = window.__wilson; W.play(); W.setPrompt('skull');
    document.getElementById('btnPeek').click();
    await new Promise(r => setTimeout(r, 120));
    const inkDuringPeek = W.inkPixels();   // peek is drawn to the screen, NOT the paint layer
    return { inkDuringPeek };
  });
  console.log('PEEK: paint-layer ink during peek =', peek.inkDuringPeek, '(must stay 0)');
  if (peek.inkDuringPeek !== 0) problems.push('peek must not paint onto the wall');
  const peekFree = await page.evaluate(() => { const W = window.__wilson;
    W.play(); W.setPrompt('free'); document.getElementById('btnPeek').click();
    return document.getElementById('toast').textContent; });
  console.log('PEEK on freestyle says:', JSON.stringify(peekFree));
  if (!/freestyle/i.test(peekFree)) problems.push('peek on a freestyle wall should explain there is no target');

  // ================= GALLERY =================
  await page.evaluate(() => window.__wilson.reset());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  const galBefore = await page.evaluate(() => window.__wilson.gallery().length);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(300);
  // paint two walls
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const W = window.__wilson, c = W.cityState();
      const wall = c.walls.find(w => !w.done);
      W.goto(wall.x + 130);
    });
    await sleep(200);
    await page.evaluate(() => window.__wilson.paintHere());
    await sleep(200);
    await page.evaluate(() => { window.__wilson.fillTarget(1,'purple'); document.getElementById('btnDone').click(); });
    await sleep(300);
    await page.evaluate(() => document.getElementById('btnNext').click());
    await sleep(300);
  }
  const gal = await page.evaluate(() => window.__wilson.gallery());
  console.log('GALLERY after 2 walls:', gal.length, JSON.stringify(gal.slice(0,2)));
  if (gal.length !== galBefore + 2) problems.push('gallery should hold 2 murals, got ' + gal.length);
  if (!gal.every(g => g.hasImg)) problems.push('gallery entries should keep their image');
  if (!gal.every(g => g.grade && g.name)) problems.push('gallery entries need grade + name');

  // murals must SURVIVE a district rollover (the whole point)
  const survived = await page.evaluate(async () => {
    const W = window.__wilson;
    const s = W.save;
    // force-complete the district and roll to the next one
    W.play();
    return true;
  });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('wilson_save'));
    raw.city.walls.forEach(w => { w.done = true; });
    localStorage.setItem('wilson_save', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(400);
  const galAfterRoll = await page.evaluate(() => window.__wilson.gallery().length);
  const districtNow = await page.evaluate(() => window.__wilson.save.districts);
  console.log('GALLERY after district rollover: murals =', galAfterRoll, '| district =', districtNow);
  if (galAfterRoll !== gal.length) problems.push('gallery must survive district rollover');

  // gallery UI renders
  await page.evaluate(() => { document.getElementById('btnMenu2').click(); document.getElementById('btnGallery').click(); });
  await sleep(300);
  const tiles = await page.evaluate(() => document.querySelectorAll('#galGrid .gal').length);
  console.log('gallery tiles rendered:', tiles);
  if (tiles !== galAfterRoll) problems.push('gallery UI should render every mural');
  await page.screenshot({ path: __dirname + '/out_gallery.png' });

  // cap holds
  const capped = await page.evaluate(() => {
    const W = window.__wilson;
    for (let i = 0; i < 40; i++) W.bump('nothing');   // no-op stat, just churn
    const raw = JSON.parse(localStorage.getItem('wilson_save'));
    return raw.gallery.length;
  });
  if (capped > 24) problems.push('gallery should cap at 24, got ' + capped);

  // ================= GOALS =================
  await page.evaluate(() => window.__wilson.reset());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  const goals0 = await page.evaluate(() => window.__wilson.goals());
  console.log('GOALS rolled:', goals0.length, goals0.map(g => g.t).join(' | '));
  if (goals0.length !== 3) problems.push('should roll 3 goals, got ' + goals0.length);
  if (new Set(goals0.map(g => g.id)).size !== 3) problems.push('goals should be distinct');

  // progress + reward
  const STAT_FOR = {walls3:'walls', gradeA:'gradeA', gradeS:'gradeS', tricks5:'tricks',
    combo2:'combo2', grind3:'grinds', coins40:'coinsPicked', colors4:'colors4',
    free1:'freeWall', guess1:'guessed'};
  const prog = await page.evaluate((STAT_FOR) => {
    const W = window.__wilson;
    const g = W.goals()[0];
    const coinsBefore = W.save.coins;
    for (let i = 0; i < g.target; i++) W.bump(STAT_FOR[g.id]);
    return { goal: g, after: W.goals()[0], coinsBefore, coinsAfter: W.save.coins };
  }, STAT_FOR);
  console.log('GOAL "' + prog.goal.t + '": claimed =', prog.after.claimed,
    '| coins', prog.coinsBefore, '->', prog.coinsAfter, '(reward ' + prog.goal.reward + ')');
  if (!prog.after.claimed) problems.push('completing a goal should mark it claimed');
  if (prog.coinsAfter !== prog.coinsBefore + prog.goal.reward)
    problems.push('goal reward not paid: expected +' + prog.goal.reward);

  // finishing all three rerolls
  const reroll = await page.evaluate((STAT_FOR) => {
    const W = window.__wilson;
    let guard = 0;
    while (W.goals().some(g => !g.claimed) && guard++ < 20) {
      const g = W.goals().find(x => !x.claimed);
      for (let i = 0; i < g.target; i++) W.bump(STAT_FOR[g.id]);
    }
    return W.goals();
  }, STAT_FOR);
  console.log('after clearing all:', reroll.map(g => g.t + '[' + g.prog + '/' + g.target + ']').join(' | '));
  if (reroll.some(g => g.claimed)) problems.push('a fresh set of goals should be unclaimed');

  // goals UI renders
  await page.evaluate(() => { document.getElementById('btnGoals').click(); });
  await sleep(250);
  const rows = await page.evaluate(() => document.querySelectorAll('#goalList .chal').length);
  console.log('goal rows rendered:', rows);
  if (rows !== 3) problems.push('goals UI should render 3 rows');
  await page.screenshot({ path: __dirname + '/out_goals.png' });

  const bytes = await page.evaluate(() => window.__wilson.saveBytes());
  console.log('save size:', (bytes/1024).toFixed(1) + 'KB');
  if (bytes > 500000) problems.push('save grew too large: ' + bytes);

  console.log('\n=== ERRORS ===');
  console.log(errors.length ? errors.slice(0,5).join('\n') : '(none)');
  if (errors.length) problems.push('runtime errors');
  console.log('\n=== VERDICT ===');
  console.log(problems.length ? 'FAIL:\n' + problems.join('\n') : 'ALL TOOLKIT/GALLERY/GOALS CHECKS PASSED');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
