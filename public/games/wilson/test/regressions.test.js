// Regression tests for the 8 bugs found in the audit.
const puppeteer = require('puppeteer');
const CHROME = process.env.CHROME_PATH || (process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:3000/games/wilson/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=900,700'],
  });
  const problems = [];
  const errors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE.ERR: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(400);

  // ---- BUG 1: all-walls-done save must not softlock ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('wilson_save')) || {};
    s.ownedColors = ['white','purple']; s.ownedNozzles=['m']; s.ownedSkins=['purple'];
    s.equippedSkin='purple'; s.coins=500; s.districts=1;
    s.city = { walls: Array.from({length:10}, () => ({p:'skull', done:true, g:'A', c:'#fff', img:null})) };
    localStorage.setItem('wilson_save', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(400);
  let city = await page.evaluate(() => window.__wilson.cityState());
  let st = await page.evaluate(() => window.__wilson.state());
  const blanks = city.walls.filter(w => !w.done).length;
  const district = await page.evaluate(() => window.__wilson.save.districts);
  console.log('BUG1 softlock: blank walls =', blanks, '| district =', district, '| coins kept =', st.coins);
  if (blanks === 0) problems.push('BUG1: still softlocked — no blank walls after loading a completed district');
  if (district < 2) problems.push('BUG1: district should have advanced');
  if (st.coins !== 500) problems.push('BUG1: coins should be preserved when rolling district');

  // ---- BUG 2a: unknown skin id must not brick boot ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('wilson_save'));
    s.equippedSkin = 'nonexistent_skin_xyz'; s.ownedSkins = ['nonexistent_skin_xyz'];
    localStorage.setItem('wilson_save', JSON.stringify(s));
  });
  errors.length = 0;
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  const bootOk = await page.evaluate(() => typeof window.__wilson === 'object' && !!document.getElementById('btnPlay'));
  const skinNow = await page.evaluate(() => window.__wilson.save.equippedSkin);
  console.log('BUG2a bad skin: booted =', bootOk, '| skin repaired to =', skinNow, '| errors =', errors.length);
  if (!bootOk) problems.push('BUG2a: game failed to boot with unknown skin id');
  if (skinNow !== 'purple') problems.push('BUG2a: bad skin not sanitized');
  if (errors.length) problems.push('BUG2a: errors on boot: ' + errors.join('|'));

  // ---- BUG 2b: unknown prompt id on a saved wall must not kill render loop ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('wilson_save'));
    s.city = { walls: [{p:'REMOVED_SHAPE', done:true, g:'S', c:'#fff', img:null},
                       {p:'skull', done:false, g:null, c:null, img:null}] };
    localStorage.setItem('wilson_save', JSON.stringify(s));
  });
  errors.length = 0;
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(300);
  // skate across the whole city; a throwing draw would freeze the loop
  await page.keyboard.down('ArrowRight'); await sleep(1200); await page.keyboard.up('ArrowRight');
  const alive = await page.evaluate(() => new Promise(res => {
    const t0 = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0 < 500)));
  }));
  console.log('BUG2b bad prompt: render loop alive =', alive, '| errors =', errors.length);
  if (!alive) problems.push('BUG2b: render loop died with unknown prompt id');
  if (errors.length) problems.push('BUG2b: errors: ' + errors.slice(0,2).join('|'));

  // ---- BUG 5: coins must NOT respawn on reload ----
  await page.evaluate(() => window.__wilson.reset());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(300);
  const c0 = (await page.evaluate(() => window.__wilson.cityState())).coins;
  // park Wilson just before the first wall's coin arc, then skate through it
  await page.evaluate(() => { const c = window.__wilson.cityState();
    window.__wilson.goto(c.walls[0].x + 260 + 120 - 70); });
  await page.keyboard.down('ArrowRight'); await sleep(1600); await page.keyboard.up('ArrowRight');
  const c1 = (await page.evaluate(() => window.__wilson.cityState())).coins;
  const wallet1 = (await page.evaluate(() => window.__wilson.state())).coins;
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(() => document.getElementById('btnPlay').click());
  await sleep(400);
  const c2 = (await page.evaluate(() => window.__wilson.cityState())).coins;
  const wallet2 = (await page.evaluate(() => window.__wilson.state())).coins;
  console.log('BUG5 coin farm: uncollected', c0, '->', c1, '-> after reload', c2, '| wallet', wallet1, '->', wallet2);
  if (!(c1 < c0)) problems.push('BUG5: setup failed, no coins collected');
  if (c2 !== c1) problems.push('BUG5: coins respawned on reload (' + c1 + ' -> ' + c2 + ') — farmable');
  if (wallet2 !== wallet1) problems.push('BUG5: wallet changed across reload');

  // ---- BUG 6: tiny viewport must not produce broken canvases / DONE crash ----
  errors.length = 0;
  await page.setViewport({ width: 320, height: 150 });
  await sleep(400);
  const dims = await page.evaluate(() => {
    window.__wilson.play();
    return window.__wilson.dims ? window.__wilson.dims() : null;
  });
  await page.evaluate(() => { window.__wilson.paintRectNorm(0.2,0.2,0.5,0.5,'purple'); });
  const scored = await page.evaluate(() => { try { const r = window.__wilson.score(); return {ok:true, grade:r.grade}; } catch(e){ return {ok:false, err:e.message}; } });
  console.log('BUG6 tiny viewport:', JSON.stringify(dims), '| score() =', JSON.stringify(scored));
  if (!scored.ok) problems.push('BUG6: scoring throws on tiny viewport: ' + scored.err);
  await page.setViewport({ width: 900, height: 700 });
  await sleep(300);

  // ---- BUG 4: blur clears held keys ----
  await page.evaluate(() => window.__wilson.skate());
  await sleep(200);
  await page.keyboard.down('ArrowRight');
  await sleep(300);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('ArrowRight');
  const xA = (await page.evaluate(() => window.__wilson.pos())).x;
  await sleep(600);
  const xB = (await page.evaluate(() => window.__wilson.pos())).x;
  console.log('BUG4 stuck keys after blur: x', Math.round(xA), '->', Math.round(xB));
  if (Math.abs(xB - xA) > 5) problems.push('BUG4: Wilson kept moving after blur (stuck key)');

  // ---- BUG 8: leaderboard submits only on personal best ----
  const submits = await page.evaluate(async () => {
    const seen = [];
    const origPM = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = (msg, t) => { if (msg && msg.type === 'imaginex-score') seen.push(msg.score); return origPM(msg, t); };
    const origFetch = window.fetch;
    window.fetch = (u, o) => { try { const b = JSON.parse(o.body); if (b.gameId === 'wilson') seen.push(b.score); } catch(e){} return Promise.resolve({ok:true, json:()=>({}) }); };
    const W = window.__wilson;
    W.reset();
    W.play(); W.fillTarget(1,'purple'); document.getElementById('btnDone').click();   // big score -> best
    await new Promise(r=>setTimeout(r,150));
    document.getElementById('btnNext').click();
    await new Promise(r=>setTimeout(r,150));
    W.play(); W.paintRectNorm(0.01,0.01,0.02,0.02,'purple'); document.getElementById('btnDone').click(); // tiny -> not best
    await new Promise(r=>setTimeout(r,150));
    document.getElementById('btnNext').click();
    await new Promise(r=>setTimeout(r,150));
    W.play(); W.paintRectNorm(0.02,0.02,0.02,0.02,'purple'); document.getElementById('btnDone').click(); // tiny -> not best
    await new Promise(r=>setTimeout(r,150));
    window.fetch = origFetch;
    return seen;
  });
  console.log('BUG8 submits across 3 walls (1 best + 2 worse):', JSON.stringify(submits));
  if (submits.length !== 1) problems.push('BUG8: expected exactly 1 submit, got ' + submits.length + ' -> ' + JSON.stringify(submits));

  // ---- BUG 9: drips must not bake stray pixels into the paint ----
  // A drip used to re-stamp the same anti-aliased rim every frame; 8-bit
  // premultiplied rounding accumulated there into opaque off-colour specks
  // that fresh paint could not cover ("black dots you can't fill in").
  await page.setViewport({ width: 960, height: 700 });
  await page.evaluate(() => { window.__wilson.reset(); window.__wilson.play(); window.__wilson.setPrompt('skull'); });
  await sleep(300);
  await page.evaluate(() => { const nz=[...document.querySelectorAll('#nozzles .nz')]; nz[nz.length-1].click(); });
  for (let y = 200; y < 430; y += 9) {
    await page.mouse.move(220, y); await page.mouse.down();
    for (let x = 220; x <= 700; x += 18) await page.mouse.move(x, y);
    await page.mouse.up();
  }
  await sleep(1200);   // let every drip finish running
  const speckle = await page.evaluate(() => {
    const ctx = document.getElementById('cv').getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const d = ctx.getImageData(260*dpr, 230*dpr, 380*dpr, 170*dpr).data;
    let dark = 0, total = 0;
    for (let i = 0; i < d.length; i += 4) {
      total++;
      if (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2] < 70) dark++;
    }
    return { total, dark };
  });
  console.log('BUG9 speckle scan inside solid paint: ' + speckle.dark + ' stray dark px of ' + speckle.total);
  if (speckle.dark > 0) problems.push('BUG9: ' + speckle.dark + ' stray dark pixels baked into solid paint (drip rounding regression)');

  console.log('\n=== ERRORS (whole run) ===');
  console.log(errors.length ? errors.slice(0,5).join('\n') : '(none)');
  console.log('\n=== VERDICT ===');
  console.log(problems.length ? 'FAIL:\n' + problems.join('\n') : 'ALL BUG-FIX REGRESSIONS PASSED');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
