// CRAZY GOLF KINGDOM — game controller: modes, input, HUD, save, audio.
import { KINGDOMS, kingdomById, generateCourse, generateDaily, dailySeed } from './coursegen.mjs';
import { compileWorld, newBall, shoot, step, STEP, MAX_STROKES, floorHeight, TILE } from './physics.mjs';
const EASY_MAX = 20;
const maxStrokes = () => save.easy ? EASY_MAX : MAX_STROKES;
import { GolfRenderer } from './render.mjs';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'cgk_save_v1';
const SKINS = [
  { id: 'classic', name: 'Classic', base: '#ffffff', accent: '#ff5252', pattern: 'dimple', cost: 0 },
  { id: 'sunny', name: 'Sunny', base: '#ffeb3b', accent: '#ff9800', pattern: 'dimple', cost: 150 },
  { id: 'stripe', name: 'Racer', base: '#ffffff', accent: '#e53935', pattern: 'stripe', cost: 250 },
  { id: 'soccer', name: 'Striker', base: '#ffffff', accent: '#212121', pattern: 'soccer', cost: 350 },
  { id: 'stars', name: 'Starry', base: '#3f51b5', accent: '#fff176', pattern: 'stars', cost: 500 },
  { id: 'eyes', name: 'Buddy', base: '#ffffff', accent: '#000000', pattern: 'eyes', cost: 700 },
  { id: 'mint', name: 'Mint', base: '#a5ffd6', accent: '#00bfa5', pattern: 'dimple', cost: 400 },
  { id: 'flame', name: 'Inferno', base: '#ff6f00', accent: '#ffd54f', pattern: 'flame', cost: 1200 },
];
const RESULT = (s, par) => s === 1 ? ['HOLE IN ONE!', 500, '⛳'] : s - par <= -2 ? ['EAGLE!', 350, '🦅'] : s - par === -1 ? ['BIRDIE!', 200, '🐦'] : s === par ? ['PAR', 100, '👍'] : s - par === 1 ? ['BOGEY', 50, '😅'] : ['+' + (s - par), 10, '😬'];
const STARS_NEEDED = 14;

// ---------- save ----------
function loadSave() { try { return Object.assign({ coins: 0, skins: ['classic'], skin: 'classic', career: {}, dailyBest: {}, sound: true, music: true, easy: false, aimMode: 'pull', holesPlayed: 0, bestRound: null, aces: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return { coins: 0, skins: ['classic'], skin: 'classic', career: {}, dailyBest: {}, sound: true, holesPlayed: 0, bestRound: null, aces: 0 }; } }
function persist(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} }
const save = loadSave();
const careerStars = (kid) => Object.values(save.career[kid] || {}).reduce((a, b) => a + b, 0);
const kingdomUnlocked = (i) => i === 0 || careerStars(KINGDOMS[i - 1].id) >= STARS_NEEDED;

// ---------- audio (procedural) ----------
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  const a = ac(); if (!a || !save.sound) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + delay);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + delay + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + delay); g.gain.exponentialRampToValueAtTime(vol, a.currentTime + delay + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + delay); o.stop(a.currentTime + delay + dur + 0.05);
}
function noise(dur, vol = 0.15, delay = 0) { const a = ac(); if (!a || !save.sound) return; const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain(); g.gain.value = vol; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + delay); }
const SFX = {
  putt: (p) => { tone(180 + p * 120, 0.08, 'triangle', 0.25, -60); noise(0.05, 0.08); },
  wall: (v) => { tone(120, 0.07, 'square', Math.min(0.2, 0.05 + v * 0.03), -40); },
  bumper: () => { tone(520, 0.12, 'square', 0.18, 300); tone(780, 0.1, 'sine', 0.12, 0, 0.05); },
  model: () => { tone(260, 0.1, 'triangle', 0.18, -120); },
  cup: () => { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.25, 'sine', 0.2, 0, 0.1); },
  fanfare: (n) => { const notes = [523, 659, 784, 1047, 1319]; for (let i = 0; i < Math.min(n, 5); i++) tone(notes[i], 0.25, 'triangle', 0.18, 0, i * 0.11); },
  water: () => { tone(300, 0.3, 'sine', 0.2, -220); noise(0.25, 0.12); },
  boost: () => { tone(400, 0.25, 'sawtooth', 0.12, 700); },
  teleport: () => { tone(900, 0.3, 'sine', 0.15, -600); tone(300, 0.3, 'sine', 0.15, 600, 0.1); },
  cannon: () => { noise(0.3, 0.3); tone(90, 0.35, 'sine', 0.3, -60); },
  lipout: () => { tone(700, 0.08, 'sine', 0.12, -200); },
  click: () => tone(600, 0.05, 'square', 0.08),
  coin: () => { tone(1200, 0.08, 'square', 0.1); tone(1600, 0.12, 'square', 0.1, 0, 0.06); },
};

// ---------- music director (Suno loops in music/, crossfaded) ----------
const MUSIC = { cur: null, want: null, tracks: {}, vol: 0.55 };
function musicTrack(name) {
  if (!MUSIC.tracks[name]) { const a = new Audio('music/' + name + '.mp3'); a.loop = true; a.preload = 'auto'; a.volume = 0; MUSIC.tracks[name] = a; }
  return MUSIC.tracks[name];
}
function playMusic(name) {
  MUSIC.want = name; if (!save.music) return;
  if (MUSIC.cur && MUSIC.cur._name === name) return;
  const next = musicTrack(name); next._name = name;
  const prev = MUSIC.cur; MUSIC.cur = next;
  next.currentTime = 0; next.volume = 0; next.play().catch(() => {});
  const t0 = performance.now(); const dur = 900;
  const tick = () => { const u = Math.min(1, (performance.now() - t0) / dur); next.volume = MUSIC.vol * u; if (prev && prev !== next) prev.volume = MUSIC.vol * (1 - u); if (u < 1) requestAnimationFrame(tick); else if (prev && prev !== next) { prev.pause(); } };
  requestAnimationFrame(tick);
}
function stopMusic() { if (MUSIC.cur) { MUSIC.cur.pause(); MUSIC.cur = null; } }
function toggleMusic() { save.music = !save.music; persist(save); $('btnMusic').textContent = save.music ? '🎵' : '🎵̸'; $('btnMusicTitle').textContent = save.music ? '🎵 Music: ON' : '🎵 Music: OFF'; if (!save.music) stopMusic(); else if (MUSIC.want) playMusic(MUSIC.want); }
// browsers block autoplay until a gesture: retry the wanted track on first interaction
window.addEventListener('pointerdown', () => { if (save.music && MUSIC.want && (!MUSIC.cur || MUSIC.cur.paused)) { MUSIC.cur = null; playMusic(MUSIC.want); } }, { capture: true });
window.addEventListener('keydown', () => { if (save.music && MUSIC.want && (!MUSIC.cur || MUSIC.cur.paused)) { MUSIC.cur = null; playMusic(MUSIC.want); } }, { capture: true });

// ---------- state ----------
const canvas = $('c');
const R = new GolfRenderer(canvas);
R.setSkin(SKINS.find(s => s.id === save.skin) || SKINS[0]);
const S = {
  screen: 'title', mode: null, kingdom: 'meadow', players: 1, course: [], holeIdx: 0, hole: null, world: null, K: null,
  balls: [], strokes: [], scores: [[], []], player: 0, done: [false, false], worldT: 0, acc: 0, last: performance.now(),
  aim: { active: false, dx: 1, dz: 0, power: 0 }, drag: null, orbit: null, flyover: null, waitingShot: true, holeOver: false, paused: false,
  keys: {}, charge: 0, charging: false, aimAngle: 0, popTimer: 0, points: [0, 0], aces: 0,
  pointers: new Map(), pinch: null, autoFace: true, cupZoom: null,
  shot: null, streak: 0, idleT: 0, aimTarget: 0,
};
window.__cgk = { S, R, save, KINGDOMS, SKINS, generateCourse, loadHole: (i) => loadHole(i), startRound, shootBall: (dx, dz, p) => { if (canShoot()) doShot(dx, dz, p); }, canShoot: () => canShoot(), skipFlyover: () => { if (S.flyover) S.flyover.t = 99; } };

// ---------- screens ----------
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === id); S.screen = id; $('hud').classList.toggle('on', id === 'play'); if (id !== 'play' && id !== 'pause') playMusic('title'); }
function renderTitle() { $('coinsTitle').textContent = save.coins; const tot = KINGDOMS.reduce((a, K) => a + careerStars(K.id), 0); $('starsTitle').textContent = `★ ${tot}/${KINGDOMS.length * 27}`; $('easyChk').checked = !!save.easy; }
function renderModes() {
  const d = new Date(); const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
  $('dailyInfo').textContent = save.dailyBest[key] != null ? `Today's best: ${save.dailyBest[key]} pts` : 'One scored attempt per day';
}
function renderKingdoms() {
  const box = $('kingdomList'); box.innerHTML = '';
  KINGDOMS.forEach((K, i) => {
    const unlocked = S.mode !== 'career' || kingdomUnlocked(i);
    const stars = careerStars(K.id); const need = i > 0 ? STARS_NEEDED : 0;
    const el = document.createElement('button'); el.className = 'kcard' + (unlocked ? '' : ' locked'); el.style.setProperty('--k', '#' + K.felt.toString(16).padStart(6, '0')); el.style.setProperty('--w', '#' + K.wall.toString(16).padStart(6, '0'));
    el.innerHTML = `<div class="kemoji">${K.emoji}</div><div class="kname">${K.name}</div><div class="kdesc">${K.desc}</div>` + (S.mode === 'career' ? `<div class="kstars">★ ${stars}/27${unlocked ? '' : ` — need ${need}★ in ${KINGDOMS[i - 1].name}`}</div>` : '');
    el.disabled = !unlocked; el.onclick = () => { SFX.click(); startRound(S.mode, K.id); }; box.appendChild(el);
  });
}
function renderShop() {
  $('shopCoins').textContent = save.coins; const box = $('skinList'); box.innerHTML = '';
  for (const sk of SKINS) {
    const owned = save.skins.includes(sk.id); const el = document.createElement('button'); el.className = 'skin' + (save.skin === sk.id ? ' sel' : '');
    el.innerHTML = `<span class="sw" style="background:${sk.base};border-color:${sk.accent}">${sk.pattern === 'eyes' ? '👀' : sk.pattern === 'stars' ? '✨' : sk.pattern === 'flame' ? '🔥' : sk.pattern === 'soccer' ? '⚽' : sk.pattern === 'stripe' ? '🏁' : ''}</span><b>${sk.name}</b><small>${owned ? (save.skin === sk.id ? 'equipped' : 'owned') : sk.cost + ' 🪙'}</small>`;
    el.onclick = () => { if (!owned) { if (save.coins < sk.cost) { toast('Not enough coins'); return; } save.coins -= sk.cost; save.skins.push(sk.id); SFX.coin(); } save.skin = sk.id; R.setSkin(sk); persist(save); renderShop(); };
    box.appendChild(el);
  }
}
function toast(msg, ms = 1400) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms); }

// ---------- round flow ----------
async function startRound(mode, kingdom) {
  S.mode = mode; S.kingdom = kingdom; S.holeIdx = 0; S.scores = [[], []]; S.points = [0, 0]; S.aces = 0; S.streak = 0;
  if (mode === 'daily') S.course = generateDaily(new Date()); else S.course = generateCourse({ kingdom, seed: mode === 'career' ? 777 + KINGDOMS.findIndex(k => k.id === kingdom) * 1000 : (Math.random() * 1e9) | 0 });
  show('play'); await loadHole(0);
}
async function loadHole(i) {
  S.holeIdx = i; S.hole = S.course[i]; S.K = kingdomById(S.hole.kingdom); S.world = compileWorld(S.hole); playMusic(S.K.id);
  S.balls = [newBall(S.world), newBall(S.world)]; S.strokes = [0, 0]; S.done = [false, false]; S.player = 0; S.holeOver = false; S.worldT = 0; S.waitingShot = false; S.cupZoom = null; S.autoFace = true;
  $('loading').classList.add('on');
  await R.buildHole(S.hole, S.K, S.world);
  $('loading').classList.remove('on');
  updateHud();
  // flyover: cup → tee
  const b = S.balls[0]; R.snapToBall({ x: S.world.cupX, y: floorHeight(S.world, S.world.cupX, S.world.cupZ), z: S.world.cupZ }); R.cam.dist = 7; R.cam.pitch = 0.9; R.faceCup(b, S.world); R.cam.yaw += 0.6;
  S.flyover = { t: 0, dur: 2.4, from: { x: S.world.cupX, z: S.world.cupZ, yaw: R.cam.yaw }, to: { x: b.x, z: b.z, yaw: Math.atan2(b.z - S.world.cupZ, b.x - S.world.cupX) } };
  popup(`HOLE ${i + 1}`, `Par ${S.hole.par} · ${S.K.emoji} ${S.K.name}`, 2000);
}
function currentBall() { return S.balls[S.player]; }
function nextPlayer() {
  if (S.players === 1) return;
  for (let k = 1; k <= 2; k++) { const p = (S.player + k) % 2; if (!S.done[p]) { S.player = p; break; } }
  updateHud(); const b = currentBall(); R.lookAtBall(b); R.faceCup(b, S.world);
}
function finishBall(p, holed) {
  if (S.done[p]) return;
  S.done[p] = true; const strokes = S.strokes[p] + (holed ? 0 : 0);
  let [label, pts, emoji] = holed ? RESULT(strokes, S.hole.par) : ['MAX STROKES', 10, '😵'];
  // trick-shot bonuses on the holing shot
  const tricks = []; const sh = S.shot;
  if (holed && sh) {
    const dist = Math.hypot(S.world.cupX - sh.x0, S.world.cupZ - sh.z0);
    if (sh.walls >= 2) tricks.push(['🎱 BANK SHOT', 75]); if (sh.bumpers >= 3) tricks.push(['🔴 BUMPER BUSTER', 100]); if (dist > 9) tricks.push(['🚀 LONG BOMB', 100]);
    if (sh.lip) tricks.push(['🍀 LUCKY LIP', 50]); if (sh.tele) tricks.push(['🌀 PORTAL PUTT', 75]); if (sh.cannon) tricks.push(['💥 CANNONBALL', 75]);
  }
  for (const [, v] of tricks) pts += v;
  // streak: consecutive holes at or under par (solo modes)
  if (p === 0) { if (holed && strokes <= S.hole.par) S.streak++; else { if (S.streak >= 2) toast(`💔 Streak of ${S.streak} broken`, 1600); S.streak = 0; } }
  const mult = p === 0 ? Math.min(3, 1 + Math.floor(S.streak / 2) * 0.5) : 1; if (mult > 1) pts = Math.round(pts * mult);
  S.scores[p][S.holeIdx] = strokes; S.points[p] += pts;
  tricks.forEach(([t, v], i) => setTimeout(() => { toast(`${t} +${v}`, 1300); SFX.coin(); }, 900 + i * 700));
  if (mult > 1) setTimeout(() => toast(`🔥 ${S.streak} in a row · ×${mult} points`, 1400), 900 + tricks.length * 700);
  const stars = !holed ? 0 : strokes < S.hole.par ? 3 : strokes === S.hole.par ? 2 : 1;
  setTimeout(() => { const el = $('stars'); el.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1400); }, 400);
  $('coinFly').textContent = `+${Math.round(pts / 10)} 🪙`; $('coinFly').classList.remove('on'); void $('coinFly').offsetWidth; $('coinFly').classList.add('on');
  if (holed && strokes === 1) { S.aces++; save.aces = (save.aces || 0) + 1; }
  if (S.mode !== 'daily' || true) { save.coins += Math.round(pts / 10); }
  if (S.mode === 'career' && p === 0) { const cs = Math.max(1, stars); save.career[S.kingdom] = save.career[S.kingdom] || {}; save.career[S.kingdom][S.holeIdx] = Math.max(save.career[S.kingdom][S.holeIdx] || 0, cs); }
  save.holesPlayed++; persist(save);
  popup(`${emoji} ${label}`, `${S.players === 2 ? 'P' + (p + 1) + ' · ' : ''}${strokes} stroke${strokes === 1 ? '' : 's'} · +${pts} pts`, 1800);
  if (holed) { SFX.fanfare(strokes === 1 ? 5 : strokes <= S.hole.par ? 4 : 2); if (strokes === 1) { for (let k = 0; k < 4; k++) setTimeout(() => R.burst(S.world.cupX + (Math.random() - 0.5) * 2, 0.6, S.world.cupZ + (Math.random() - 0.5) * 2, 50, [0xffeb3b, 0xff4081, 0x40c4ff, 0x69f0ae, 0xffffff], 4, 0.6, 1.8), 250 + k * 260); R.addShake(0.2); } }
  if (S.done[0] && (S.players === 1 || S.done[1])) { S.holeOver = true; setTimeout(showHoleEnd, 1500); }
  else nextPlayer();
}
function showHoleEnd() {
  if (S.holeIdx >= S.course.length - 1) return showScorecard();
  loadHole(S.holeIdx + 1);
}
function showScorecard() {
  const total = (p) => S.scores[p].reduce((a, b) => a + (b || 0), 0); const parT = S.course.reduce((a, h) => a + h.par, 0);
  let rows = '<tr><th>Hole</th>' + S.course.map((_, i) => `<th>${i + 1}</th>`).join('') + '<th>Tot</th></tr>';
  rows += '<tr><td>Par</td>' + S.course.map(h => `<td>${h.par}</td>`).join('') + `<td>${parT}</td></tr>`;
  for (let p = 0; p < S.players; p++) rows += `<tr class="pl"><td>${S.players === 2 ? 'P' + (p + 1) : 'You'}</td>` + S.course.map((h, i) => { const s = S.scores[p][i]; const c = s == null ? '' : s === 1 ? 'ace' : s < h.par ? 'under' : s === h.par ? 'par' : 'over'; return `<td class="${c}">${s ?? '-'}</td>`; }).join('') + `<td><b>${total(p)}</b></td></tr>`;
  $('scoreTable').innerHTML = rows;
  const rel = total(0) - parT; const relS = rel === 0 ? 'EVEN' : rel > 0 ? '+' + rel : String(rel);
  let head = S.players === 2 ? (total(0) === total(1) ? 'TIE GAME!' : total(0) < total(1) ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!') : `${relS} · ${S.points[0]} pts`;
  $('scoreHead').textContent = head;
  const key = dailyKey();
  if (S.mode === 'daily') { if (save.dailyBest[key] == null || S.points[0] > save.dailyBest[key]) save.dailyBest[key] = S.points[0]; try { window.parent.postMessage({ type: 'imaginex-score', gameId: 'crazy-golf-kingdom', score: S.points[0] }, '*'); } catch (e) {} }
  if (S.mode !== 'daily' && (save.bestRound == null || total(0) < save.bestRound)) save.bestRound = total(0);
  const extra = S.mode === 'career' ? `★ ${careerStars(S.kingdom)}/27 in ${S.K.name}` + (KINGDOMS.findIndex(k => k.id === S.kingdom) < KINGDOMS.length - 1 && careerStars(S.kingdom) >= STARS_NEEDED ? ' — next kingdom unlocked!' : '') : S.mode === 'daily' ? 'Score posted to the daily leaderboard' : '';
  $('scoreExtra').textContent = extra; persist(save); show('scorecard');
}
function dailyKey() { const d = new Date(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }

// ---------- HUD ----------
function updateHud() {
  $('hHole').textContent = `Hole ${S.holeIdx + 1}/${S.course.length}`; $('hPar').textContent = `Par ${S.hole.par}`;
  $('hStrokes').textContent = S.players === 2 ? `P1 ${S.strokes[0]} · P2 ${S.strokes[1]}` : `Strokes ${S.strokes[0]}`;
  $('hPlayer').textContent = S.players === 2 ? `Player ${S.player + 1}` : ''; $('hPlayer').style.display = S.players === 2 ? '' : 'none';
  $('hKing').textContent = `${S.K.emoji} ${S.K.name}${save.easy ? ' · EASY' : ''}`;
  const done = S.scores[0].filter(x => x != null).length; const rel = S.scores[0].reduce((a, sc, i) => a + (sc == null ? 0 : sc - S.course[i].par), 0);
  $('hScore').textContent = done ? `${rel === 0 ? 'E' : rel > 0 ? '+' + rel : rel} thru ${done} · ${S.points[0]} pts` : `${S.points[0]} pts`;
  $('hStreak').textContent = S.streak >= 2 ? `🔥 ${S.streak}` : ''; $('hStreak').style.display = S.streak >= 2 ? '' : 'none';
}
function popup(big, small, ms = 1500) { const p = $('popup'); p.querySelector('.big').textContent = big; p.querySelector('.small').textContent = small; p.classList.add('on'); clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('on'), ms); }

// ---------- input ----------
const ballPlaneY = () => currentBall().y + 0.02;
function canShoot() { return S.screen === 'play' && !S.flyover && !S.holeOver && currentBall().resting && !currentBall().inCup && !S.paused; }
function pointerDown(px, py, button, touches) {
  if (S.screen !== 'play') return;
  if (button === 2 || touches === 2) { S.orbit = { x: px, y: py, yaw: R.cam.yaw, pitch: R.cam.pitch }; return; }
  if (!canShoot()) { S.orbit = { x: px, y: py, yaw: R.cam.yaw, pitch: R.cam.pitch, weak: true }; return; }
  S.drag = { x0: px, y0: py }; S.aim.active = true; S.aim.power = 0; S.aimTarget = S.aimAngle;
}
function pointerMove(px, py) {
  if (S.orbit) { S.autoFace = false; R.cam.yaw = S.orbit.yaw + (px - S.orbit.x) * 0.006; R.cam.pitch = Math.max(0.25, Math.min(1.4, S.orbit.pitch + (py - S.orbit.y) * 0.004)); return; }
  if (!S.drag) return;
  const sd = Math.hypot(px - S.drag.x0, py - S.drag.y0); const dead = 10, full = Math.max(120, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.42);
  if (sd < dead) { S.aim.power = 0; S.aim.active = true; $('power').style.setProperty('--p', 0); return; }
  const f0 = R.screenToFloor(S.drag.x0, S.drag.y0, ballPlaneY()), f1 = R.screenToFloor(px, py, ballPlaneY());
  if (!f0 || !f1) return;
  let dx = f0.x - f1.x, dz = f0.z - f1.z; if (save.aimMode === 'push') { dx = -dx; dz = -dz; }
  const d = Math.hypot(dx, dz) || 1; S.aimTarget = Math.atan2(dz / d, dx / d);
  S.aim.power = Math.min(1, (sd - dead) / full); S.aim.active = true;
  $('power').style.setProperty('--p', S.aim.power); $('power').classList.add('on');
}
function pointerUp() {
  if (S.orbit) { S.orbit = null; }
  if (S.drag) { S.drag = null; if (S.aim.power > 0.02 && canShoot()) doShot(Math.cos(S.aimTarget), Math.sin(S.aimTarget), S.aim.power); S.aim.active = false; S.aim.power = 0; $('power').classList.remove('on'); }
}
function doShot(dx, dz, power) {
  const b = currentBall(); shoot(b, dx, dz, power); S.strokes[S.player]++; SFX.putt(power); S.autoFace = false; R.setPreview(null);
  S.shot = { x0: b.x, z0: b.z, walls: 0, bumpers: 0, lip: false, tele: false, cannon: false }; S.idleT = 0; updateHud();
  R.burst(b.x, b.y + 0.05, b.z, 8, [0xffffff, 0xdddddd], 1.2, 1, 0.5);
}
function pinchState() { const pts = [...S.pointers.values()]; const [a, b] = pts; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  ac(); S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
  if (S.pointers.size === 2) { // second finger: cancel any aim, start orbit+pinch
    S.drag = null; S.aim.active = false; S.aim.power = 0; $('power').classList.remove('on'); S.orbit = null;
    const p = pinchState(); S.pinch = { d0: p.d, dist0: R.cam.dist, mx: p.mx, my: p.my, yaw: R.cam.yaw, pitch: R.cam.pitch }; S.autoFace = false; return;
  }
  if (S.pointers.size > 2) return;
  pointerDown(e.clientX, e.clientY, e.button, 1);
});
canvas.addEventListener('pointermove', (e) => {
  if (S.pointers.has(e.pointerId)) S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.pinch && S.pointers.size >= 2) { const p = pinchState(); R.cam.dist = Math.max(3.5, Math.min(22, S.pinch.dist0 * S.pinch.d0 / Math.max(1, p.d))); R.cam.yaw = S.pinch.yaw + (p.mx - S.pinch.mx) * 0.006; R.cam.pitch = Math.max(0.25, Math.min(1.4, S.pinch.pitch + (p.my - S.pinch.my) * 0.004)); return; }
  pointerMove(e.clientX, e.clientY);
});
const endPointer = (e) => { S.pointers.delete(e.pointerId); if (S.pointers.size < 2) S.pinch = null; if (S.pointers.size === 0) pointerUp(); };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { S.pointers.clear(); S.pinch = null; pointerUp(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { R.cam.dist = Math.max(3.5, Math.min(22, R.cam.dist + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  S.keys[e.key] = true; if (e.shiftKey) S.keys.Shift = true; ac();
  if (e.key === ' ' && canShoot() && !S.charging) { S.charging = true; S.charge = 0; S.aim.active = true; S.aim.power = 0; S.aim.dx = Math.cos(S.aimAngle); S.aim.dz = Math.sin(S.aimAngle); }
  if (e.key === 'Escape' && S.screen === 'play') togglePause();
  if (e.key.toLowerCase() === 'r' && S.screen === 'play' && !S.flyover) { S.autoFace = true; }
});
window.addEventListener('keyup', (e) => { S.keys[e.key] = false; if (!e.shiftKey) S.keys.Shift = false; if (e.key === ' ' && S.charging) { S.charging = false; if (canShoot()) doShot(Math.cos(S.aimAngle), Math.sin(S.aimAngle), S.aim.power); S.aim.active = false; S.aim.power = 0; $('power').classList.remove('on'); } });
window.addEventListener('resize', () => R.resize());
function togglePause() { S.paused = !S.paused; $('pause').classList.toggle('on', S.paused); if (MUSIC.cur) MUSIC.cur.volume = S.paused ? MUSIC.vol * 0.35 : MUSIC.vol; }

// ---------- buttons ----------
$('btnPlay').onclick = () => { SFX.click(); renderModes(); show('modes'); };
$('btnShop').onclick = () => { SFX.click(); renderShop(); show('shop'); };
$('btnHow').onclick = () => { SFX.click(); show('how'); };
for (const el of document.querySelectorAll('[data-back]')) el.onclick = () => { SFX.click(); renderTitle(); show(el.dataset.back); };
for (const el of document.querySelectorAll('[data-mode]')) el.onclick = () => { SFX.click(); S.mode = el.dataset.mode; S.players = el.dataset.players ? Number(el.dataset.players) : 1; if (S.mode === 'daily') startRound('daily', 'meadow'); else { renderKingdoms(); $('kingTitle').textContent = S.mode === 'career' ? 'Career — pick a kingdom' : S.players === 2 ? '2 Players — pick a kingdom' : 'Quick Round — pick a kingdom'; show('kingdoms'); } };
$('btnAgain').onclick = () => { SFX.click(); if (S.mode === 'daily') { renderTitle(); show('title'); } else startRound(S.mode, S.kingdom); };
$('btnMenu').onclick = () => { SFX.click(); renderTitle(); show('title'); };
$('btnPause').onclick = () => togglePause();
$('btnResume').onclick = () => togglePause();
$('btnQuit').onclick = () => { S.paused = false; $('pause').classList.remove('on'); renderTitle(); show('title'); };
$('btnSound').onclick = () => { save.sound = !save.sound; persist(save); $('btnSound').textContent = save.sound ? '🔊' : '🔇'; };
$('btnMusic').onclick = () => toggleMusic(); $('btnMusicTitle').onclick = () => toggleMusic();
$('btnMusic').textContent = save.music ? '🎵' : '🎵̸'; $('btnMusicTitle').textContent = save.music ? '🎵 Music: ON' : '🎵 Music: OFF';
window.__cgk.MUSIC = MUSIC;
$('btnSound').textContent = save.sound ? '🔊' : '🔇';
$('btnCam').onclick = () => { S.autoFace = true; };
$('easyChk').onchange = (e) => { save.easy = e.target.checked; persist(save); };
function aimLabel() { return save.aimMode === 'push' ? '🎯 Aim: PUSH toward target' : '🎯 Aim: PULL back (slingshot)'; }
function toggleAim() { save.aimMode = save.aimMode === 'push' ? 'pull' : 'push'; persist(save); for (const el of document.querySelectorAll('.aimBtn')) el.textContent = aimLabel(); toast(save.aimMode === 'push' ? 'Drag toward where you want the ball to go' : 'Drag back like a slingshot', 1800); }
for (const el of document.querySelectorAll('.aimBtn')) { el.textContent = aimLabel(); el.onclick = () => toggleAim(); }

// ---------- main loop ----------
function handleEvents(b) {
  for (const e of b.events) {
    switch (e.type) {
      case 'wall': SFX.wall(e.v); if (S.shot && e.v > 1.5) S.shot.walls++; if (e.v > 6) R.addShake(0.06); R.burst(e.x, b.y + 0.1, e.z, 5, [0xffffff, 0xffe082], 1.2, 1, 0.4); break;
      case 'bumper': SFX.bumper(); if (S.shot) S.shot.bumpers++; R.hit(e.x, e.z); R.addShake(0.12 + Math.min(0.15, e.v * 0.02)); R.burst(e.x, b.y + 0.15, e.z, 14, [0xff7043, 0xffffff, 0xffeb3b], 2.2, 1, 0.6); break;
      case 'model': SFX.model(); R.hit(e.x, e.z); R.burst(e.x, b.y + 0.15, e.z, 8, [0xffffff], 1.5, 1, 0.5); break;
      case 'cup': SFX.cup(); R.burst(S.world.cupX, b.y + 0.2, S.world.cupZ, 60, [0xffeb3b, 0xff4081, 0x40c4ff, 0x69f0ae, 0xffffff], 3.5, 0.8, 1.6); b.events.length = 0; S.cupZoom = { t: 0 }; finishBall(S.player, true); return true;
      case 'reset': SFX.water(); R.addShake(0.15); if (save.easy) toast(e.reason === 'water' ? '💦 Splash! (easy mode: no penalty)' : '🕳️ Off course! (no penalty)'); else { toast(e.reason === 'water' ? '💦 Splash! +1 stroke' : '🕳️ Off course! +1 stroke'); S.strokes[S.player]++; } updateHud(); break;
      case 'boost': SFX.boost(); break;
      case 'teleport': SFX.teleport(); if (S.shot) S.shot.tele = true; R.burst(b.x, b.y + 0.1, b.z, 20, [0x40c4ff, 0xff4081], 2, 0.3, 0.8); break;
      case 'cannon': SFX.cannon(); if (S.shot) S.shot.cannon = true; R.addShake(0.28); R.burst(b.x, b.y + 0.2, b.z, 25, [0x90a4ae, 0xffffff, 0xff9800], 2.5, 0.8, 0.8); break;
      case 'land': R.burst(b.x, b.y + 0.05, b.z, 10, [0xffffff], 1.4, 1, 0.5); break;
      case 'lipout': SFX.lipout(); if (S.shot) S.shot.lip = true; toast('😮 SO CLOSE!', 900); break;
      case 'rest': if (S.strokes[S.player] >= maxStrokes() && !b.inCup) { b.events.length = 0; finishBall(S.player, false); return true; } if (S.players === 2 && !S.done[S.player]) nextPlayer(); S.autoFace = true; S.idleT = 0; S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x); if (S.strokes[S.player] === maxStrokes() - 1) toast('Last stroke!'); break;
    }
  }
  b.events.length = 0; return false;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
  if (S.screen !== 'play' || !S.world) return;
  if (S.flyover) {
    const f = S.flyover; f.t += dt; const u = Math.min(1, f.t / f.dur); const e = u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
    R.cam.tx = R.cam.sx = f.from.x + (f.to.x - f.from.x) * e; R.cam.tz = R.cam.sz = f.from.z + (f.to.z - f.from.z) * e; R.cam.ty = R.cam.sy = floorHeight(S.world, R.cam.tx, R.cam.tz) || 0;
    R.cam.yaw = f.from.yaw + (f.to.yaw - f.from.yaw) * e; R.cam.dist = 7 + Math.sin(u * Math.PI) * 4;
    if (u >= 1) { S.flyover = null; R.cam.dist = 7; R.cam.pitch = 0.72; S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - f.to.z, S.world.cupX - f.to.x); }
  }
  if (!S.paused && !S.flyover) {
    // keyboard aim/charge
    if (canShoot()) {
      const rot = dt * (S.keys.Shift ? 0.35 : 1.1);
      if (S.keys.ArrowLeft) { S.aimAngle -= rot; S.aimTarget = S.aimAngle; S.aim.active = true; S.aim.dx = Math.cos(S.aimAngle); S.aim.dz = Math.sin(S.aimAngle); }
      if (S.keys.ArrowRight) { S.aimAngle += rot; S.aimTarget = S.aimAngle; S.aim.active = true; S.aim.dx = Math.cos(S.aimAngle); S.aim.dz = Math.sin(S.aimAngle); }
      if (S.charging) { S.charge += dt; S.aim.power = Math.min(1, S.charge / 1.3); $('power').style.setProperty('--p', S.aim.power); $('power').classList.add('on'); }
      else if (!S.drag && (S.keys.ArrowLeft || S.keys.ArrowRight)) { S.aim.power = 0; }
      else if (!S.drag) S.aim.active = S.aim.active && (S.keys.ArrowLeft || S.keys.ArrowRight) ? true : S.drag ? true : false;
      if (S.drag) { let dd = S.aimTarget - S.aimAngle; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); S.aimAngle += dd * Math.min(1, dt * 18); S.aim.dx = Math.cos(S.aimAngle); S.aim.dz = Math.sin(S.aimAngle); }
      if (!S.drag && !S.charging && !(S.keys.ArrowLeft || S.keys.ArrowRight)) { S.aim.active = true; S.aim.power = 0; S.aim.dx = Math.cos(S.aimAngle); S.aim.dz = Math.sin(S.aimAngle); }
    }
    // physics
    S.acc += dt; const b = currentBall();
    while (S.acc >= STEP) { step(S.world, b, S.worldT); S.worldT += STEP; S.acc -= STEP; if (b.events.length && handleEvents(b)) break; }
    if (b.events.length) handleEvents(b);
    // camera follows the active ball; auto-yaw gently behind the direction of travel while moving
    if (!S.orbit) { R.lookAtBall(b); }
    if (S.keys.q) { R.cam.yaw -= dt * 1.5; S.autoFace = false; } if (S.keys.e) { R.cam.yaw += dt * 1.5; S.autoFace = false; }
    if (S.autoFace && b.resting && !b.inCup && !S.orbit && !S.pinch) { const want = Math.atan2(b.z - S.world.cupZ, b.x - S.world.cupX); let d = want - R.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); R.cam.yaw += d * Math.min(1, dt * 4); if (Math.abs(d) < 0.01) S.autoFace = false; }
    // shot preview: simulate the real physics for up to 1.4 s or until the first bounce
    if (S.aim.active && S.aim.power > 0.02 && canShoot()) {
      const t = { ...b, events: [] }; shoot(t, S.aim.dx, S.aim.dz, S.aim.power); const pts = []; let tt = S.worldT, k = 0;
      while (!t.resting && tt - S.worldT < 1.4 && pts.length < 40) { step(S.world, t, tt); tt += STEP; if (++k % 5 === 0) pts.push({ x: t.x, y: t.y, z: t.z }); if (t.events.some(e => e.type === 'wall' || e.type === 'bumper' || e.type === 'model' || e.type === 'reset' || e.type === 'cannon' || e.type === 'teleport')) break; }
      R.setPreview(pts);
    } else R.setPreview(null);
    R.setCupNear(b.resting && !b.inCup ? Math.hypot(b.x - S.world.cupX, b.z - S.world.cupZ) : 9);
    if (canShoot() && !S.drag && !S.charging) { S.idleT += dt; if (S.idleT > 12) { toast('Drag back from the ball to shoot', 1500); S.idleT = 0; } } else S.idleT = 0;
    if (S.cupZoom) { S.cupZoom.t += dt; R.cam.tx = S.world.cupX; R.cam.tz = S.world.cupZ; R.cam.ty = floorHeight(S.world, S.world.cupX, S.world.cupZ); R.cam.dist = Math.max(3.2, R.cam.dist - dt * 6); }
  }
  R.setOther(S.players === 2 && !S.done[1 - S.player] ? S.balls[1 - S.player] : null);
  R.update(currentBall(), S.worldT, dt, S.aim.active && canShoot() ? S.aim : null);
  // other player's ball ghost (2P): draw as small marker via particles? keep simple: show in HUD only
}
R.resize(); renderTitle(); show('title'); requestAnimationFrame(frame);
$('loading').classList.remove('on');
