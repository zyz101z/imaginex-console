// Leaderboards screen + daily posting/rank with a stubbed API. node lb_check.js
const puppeteer = require('puppeteer-core');
let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 760 }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  const boards = {}; const posted = [];
  await page.setRequestInterception(true);
  page.on('request', r => { const u = new URL(r.url()); if (u.pathname === '/api/leaderboard') { if (r.method() === 'POST') { const b = JSON.parse(r.postData()); posted.push(b); const rows = boards[b.gameId] || (boards[b.gameId] = []); const i = rows.findIndex(x => x.nickname === b.nickname); if (i >= 0) rows[i].score = Math.max(rows[i].score, b.score); else rows.push({ nickname: b.nickname, score: b.score }); rows.sort((a, b2) => b2.score - a.score); r.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); } else { const id = u.searchParams.get('gameId'); r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(boards[id] || []) }); } } else r.continue(); });
  // console profile present → name comes from it
  await page.evaluateOnNewDocument(() => { localStorage.setItem('imaginex_profile', JSON.stringify({ nickname: 'Noah', avatarColor: '#4fc3f7', createdAt: 1 })); localStorage.setItem('cgk_save_v1', JSON.stringify({ tutorialDone: true })); });
  await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  const dailyId = await page.evaluate(() => window.__cgk.dailyId()); const aceId = await page.evaluate(() => window.__cgk.aceId());
  boards[dailyId] = [{ nickname: 'Dad', score: 2400 }, { nickname: 'Zed', score: 1900 }]; boards[aceId] = [{ nickname: 'Dad', score: 300 }]; boards['crazy-golf-kingdom'] = [{ nickname: 'Dad', score: 3100 }, { nickname: 'Noah', score: 2000 }];
  check('name comes from the console profile', await page.evaluate(() => window.__cgk.nameFor()) === 'Noah');
  // 1. boards screen renders all tabs
  await page.click('#btnBoards'); await new Promise(r => setTimeout(r, 700));
  const b1 = await page.evaluate(() => ({ on: document.getElementById('boards').classList.contains('on'), daily: document.querySelectorAll('#lbDaily .lbRow').length, ace: document.querySelectorAll('#lbAce .lbRow').length, all: document.querySelectorAll('#lbAll .lbRow').length, me: document.querySelectorAll('#lbAll .lbRow.me').length, you: document.getElementById('lbYou').textContent, nameRow: document.getElementById('lbNameRow').style.display }));
  check('boards screen shows daily 2 / ace 1 / all-time 2', b1.on && b1.daily === 2 && b1.ace === 1 && b1.all === 2, JSON.stringify(b1)); check('my row highlighted on all-time', b1.me === 1); check('rank summary shows all-time #2', /All-time #2/.test(b1.you), b1.you); check('name input hidden when profile exists', b1.nameRow === 'none');
  await page.click('.lbTab[data-pane="lbPersonal"]'); await new Promise(r => setTimeout(r, 100)); check('personal tab switches', await page.evaluate(() => document.getElementById('lbPersonal').classList.contains('on') && !document.getElementById('lbDaily').classList.contains('on')));
  await page.screenshot({ path: 'lb_screen.png' });
  // 2. finishing a daily round posts to the per-day board and shows rank
  await page.evaluate(() => { document.querySelector('#boards [data-back="title"]').click(); window.__cgk.S.players = 1; window.__cgk.startRound('daily', 'meadow'); });
  await page.waitForFunction(() => window.__cgk.S.world && window.__cgk.S.mode === 'daily' && !document.getElementById('loading').classList.contains('on'), { timeout: 60000 });
  await page.evaluate(() => { const { S } = window.__cgk; window.__cgk.skipFlyover(); S.holeIdx = 8; S.hole = S.course[8].tiles ? S.course[8] : S.hole; S.scores[0] = [3, 3, 3, 3, 3, 3, 3, 3]; S.points[0] = 2200; });
  await page.evaluate(() => { const { S } = window.__cgk; const b = S.balls[0]; S.strokes[0] = 2; b.x = S.world.cupX - 0.25; b.z = S.world.cupZ; b.resting = false; b.vx = 1.0; b.vz = 0; });
  await page.waitForFunction(() => window.__cgk.S.screen === 'scorecard', { timeout: 20000 }); await new Promise(r => setTimeout(r, 800));
  const sc = await page.evaluate(() => ({ rank: document.getElementById('scoreRank').textContent, pts: window.__cgk.S.points[0] }));
  check('daily round posted to the per-day board', posted.some(p => p.gameId === dailyId && p.nickname === 'Noah' && p.score > 2200), JSON.stringify(posted));
  check('scorecard shows today rank (#2 behind Dad 2400)', /#2/.test(sc.rank), JSON.stringify(sc));
  await page.screenshot({ path: 'lb_scorecard.png' });
  console.log('errors:', errs.length ? errs.join(' | ') : 'none'); check('no page errors', errs.length === 0);
  console.log(`leaderboards: ${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
