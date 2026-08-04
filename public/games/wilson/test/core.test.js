// Core: spray engine, shape-matching judge, freestyle recognition, shop.
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

  if (!(await page.evaluate(() => typeof window.__wilson === 'object'))) problems.push('test hook missing');

  async function trial(name, prompt, draw) {
    const r = await page.evaluate((p, fn) => {
      const W = window.__wilson; W.play(); W.setPrompt(p);
      (new Function('W', fn))(W); return W.score();
    }, prompt, draw);
    console.log((name+' ').padEnd(34,'.') +
      ' match=' + (r.match*100).toFixed(0).padStart(3) + '%' +
      ' acc=' + (r.accuracy*100).toFixed(0).padStart(3) + '%' +
      ' ink=' + (r.inkRatio*100).toFixed(0).padStart(3) + '%' +
      ' grade=' + r.grade + ' coins=' + r.coins +
      (r.guess ? ' guess=' + r.guess.name : ''));
    return r;
  }

  // ---- the judge ----
  const exact    = await trial('exact shape', 'skull', "W.fillTarget(1,'purple');");
  const outline  = await trial('outline only', 'skull', "W.shapeOutline('skull',0.055,'white');");
  const small    = await trial('right shape, small + corner', 'smiley', "W.disc(0.25,0.3,0.13,'purple');");
  const wrong    = await trial('wrong shape (star for tag)', 'smiley', "W.shapeFill('star','purple');");
  const sprayAll = await trial('sprayed whole wall', 'skull', "W.rect(0,0,1,1,'red');");
  const blank    = await trial('blank wall', 'skull', "");
  const lumpy    = await trial('lumpy freehand circle', 'smiley', "W.blob(0.5,0.5,0.3,0.12,'purple');");

  if (exact.grade !== 'S') problems.push('exact shape should be S, got ' + exact.grade);
  // Outlines get hole-filled, so drawing just the outline must score like the solid form.
  if (outline.accuracy < 0.8) problems.push('outline should score high, got ' + outline.accuracy.toFixed(2));
  // Position/size independence is the whole point of the normalized judge.
  if (small.accuracy < 0.8) problems.push('small off-centre drawing should still score, got ' + small.accuracy.toFixed(2));
  if (wrong.grade === 'S' || wrong.grade === 'A') problems.push('wrong shape should not score S/A, got ' + wrong.grade);
  if (sprayAll.grade !== 'F') problems.push('spraying everything should be F, got ' + sprayAll.grade);
  if (blank.coins !== 0) problems.push('blank wall should pay 0 coins, got ' + blank.coins);
  if (exact.accuracy <= wrong.accuracy) problems.push('exact should beat wrong shape');
  // S is meant to be rare: a lumpy freehand circle is a real attempt, not a perfect one.
  if (lumpy.grade === 'S') problems.push('lumpy freehand should not reach S (grading too easy)');
  if (lumpy.grade === 'F') problems.push('lumpy freehand is a genuine attempt, should not be F');

  // ---- freestyle recognition ----
  console.log('');
  const fHeart = await trial('freestyle: heart', 'free', "W.shapeFill('heart','red');");
  const fGhost = await trial('freestyle: ghost outline', 'free', "W.shapeOutline('ghost',0.05,'white');");
  const fJunk  = await trial('freestyle: scribble', 'free', "W.rect(0.3,0.3,0.4,0.05,'white');W.rect(0.4,0.2,0.05,0.5,'white');");
  if (!fHeart.guess || fHeart.guess.id !== 'heart') problems.push('freestyle should recognise a heart, guessed ' + (fHeart.guess && fHeart.guess.id));
  if (!fGhost.guess || fGhost.guess.id !== 'ghost') problems.push('freestyle should recognise a ghost, guessed ' + (fGhost.guess && fGhost.guess.id));
  if (fJunk.grade === 'S' || fJunk.grade === 'A') problems.push('freestyle scribble should not score high');

  // ---- shop ----
  await page.evaluate(() => { document.getElementById('btnMenu').click(); document.getElementById('btnShop2').click(); });
  await sleep(250);
  const shopItems = await page.evaluate(() => document.querySelectorAll('#shopGrid .item').length);
  console.log('\nshop items:', shopItems);
  if (shopItems < 3) problems.push('shop not rendering items');

  console.log('\n=== ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  if (errors.length) problems.push('runtime errors');
  console.log('\n=== VERDICT ===');
  console.log(problems.length ? 'FAIL:\n' + problems.join('\n') : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
