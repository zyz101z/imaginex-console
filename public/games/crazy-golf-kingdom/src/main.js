// CRAZY GOLF KINGDOM — game controller: modes, input, HUD, save, audio.
import { KINGDOMS, kingdomById, generateCourse, generateDaily, generateAceHole, generateHole, dailySeed, makeRng } from './coursegen.mjs';
import { compileWorld, newBall, shoot, step, STEP, MAX_STROKES, floorHeight, TILE } from './physics.mjs';
const EASY_MAX = 20;
const maxStrokes = () => save.easy ? EASY_MAX : MAX_STROKES;
import { GolfRenderer } from './render.mjs';
import { buildFinale } from './finales.mjs';
import { levelFromXp, titleFor, levelReward, SKIN_LEVEL, questsForDay, questEvent, checkAchievements, ACHIEVEMENTS, LEVEL_MAX } from './progression.mjs';

const $ = (id) => document.getElementById(id);
const IS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
const DEBUG = /[?&]debug/.test(location.search);   // ?debug → counts dark frames after each render and shows it in the HUD
if (IS_TOUCH) document.documentElement.classList.add('touch');
const SAVE_KEY = 'cgk_save_v1';
const SKINS = [
  { id: 'classic', name: 'Classic', base: '#ffffff', accent: '#ff5252', pattern: 'dimple', cost: 0, blurb: 'The original.' },
  { id: 'sunny', name: 'Sunny', base: '#ffeb3b', accent: '#ff9800', pattern: 'dimple', cost: 150, trail: '#ffeb3b', particle: 'sparkle', glow: 0x6d4c00, sfx: 'chime', blurb: 'Golden sparkle trail.' },
  { id: 'stripe', name: 'Racer', base: '#ffffff', accent: '#e53935', pattern: 'stripe', cost: 250, trail: '#e53935', sfx: 'vroom', blurb: 'Red racing stripe, engine rev on the drop.' },
  { id: 'soccer', name: 'Striker', base: '#ffffff', accent: '#212121', pattern: 'soccer', cost: 350, trail: '#ffffff', sfx: 'goal', blurb: 'GOAL horn when it drops.' },
  { id: 'stars', name: 'Starry', base: '#3f51b5', accent: '#fff176', pattern: 'stars', cost: 500, trail: '#fff176', particle: 'sparkle', glow: 0x1a237e, sfx: 'twinkle', blurb: 'Leaves stardust behind.' },
  { id: 'eyes', name: 'Buddy', base: '#ffffff', accent: '#000000', pattern: 'eyes', cost: 700, trail: '#ff4081', particle: 'hearts', sfx: 'giggle', blurb: 'Giggles when it drops. Hearts everywhere.' },
  { id: 'mint', name: 'Mint', base: '#a5ffd6', accent: '#00bfa5', pattern: 'dimple', cost: 400, trail: '#64ffda', particle: 'bubbles', sfx: 'pop', blurb: 'Bubbly, minty, fresh.' },
  { id: 'flame', name: 'Inferno', base: '#ff6f00', accent: '#ffd54f', pattern: 'flame', cost: 1200, trail: '#ff9100', particle: 'fire', glow: 0xbf360c, sfx: 'roar', blurb: 'On fire. Literally.' },
  { id: 'checker', name: 'Finish Line', base: '#ffffff', accent: '#212121', pattern: 'checker', cost: 600, trail: '#ffffff', sfx: 'vroom', blurb: 'Chequered flag, all the way round.' },
  { id: 'galaxy', name: 'Galaxy', base: '#2a0a5a', accent: '#ff4081', pattern: 'galaxy', cost: 1500, trail: '#b388ff', particle: 'sparkle', glow: 0x311b92, sfx: 'twinkle', blurb: 'A whole nebula in your hand.' },
  { id: 'gold', name: '24 Karat', base: '#e6b422', accent: '#fff3b0', pattern: 'gold', cost: 2500, metal: true, trail: '#ffd54f', particle: 'sparkle', sfx: 'chime', blurb: 'Solid gold. Rolls like it too.' },
];
const CLUBS = [
  { id: 'classic', name: 'Classic', cost: 0, level: 1, shape: 'blade', shaft: 0xcfd8dc, head: 0x37474f, grip: 0x212121, blurb: 'Trusty steel blade.', icon: '🏌️' },
  { id: 'mallet', name: 'Mallet', cost: 200, level: 2, shape: 'mallet', shaft: 0xb0bec5, head: 0x1565c0, grip: 0x0d47a1, blurb: 'Big blue mallet head.', icon: '🔵' },
  { id: 'wood', name: 'Old Hickory', cost: 350, level: 3, shape: 'wood', shaft: 0x8d6e63, shaftMetal: 0, head: 0x5d4037, headMetal: 0, grip: 0x3e2723, blurb: 'Persimmon and hickory, like grandpa\'s.', icon: '🪵' },
  { id: 'candy', name: 'Candy Cane', cost: 500, level: 5, shape: 'candy', shaft: 0xffffff, shaftMetal: 0.1, head: 0xffffff, headMetal: 0.1, grip: 0xe53935, blurb: 'Peppermint striped. Smells great.', icon: '🍬' },
  { id: 'bone', name: 'Dino Bone', cost: 700, level: 7, shape: 'bone', shaft: 0xefebe9, shaftMetal: 0, head: 0xefebe9, headMetal: 0, grip: 0x6d4c41, blurb: 'Genuine (cartoon) fossil.', icon: '🦴' },
  { id: 'neon', name: 'Neon', cost: 900, level: 9, shape: 'blade', shaft: 0x00e5ff, shaftMetal: 0.3, head: 0xff4081, headMetal: 0.3, grip: 0x212121, glow: 0.9, blurb: 'Glows in the dark.', icon: '💡' },
  { id: 'gold', name: 'Midas', cost: 1800, level: 12, shape: 'mallet', shaft: 0xffd54f, shaftMetal: 1, head: 0xffc107, headMetal: 1, grip: 0x5d4037, blurb: 'Pure gold. Wildly impractical.', icon: '🥇' },
  { id: 'staff', name: 'Wizard Staff', cost: 2200, level: 15, shape: 'staff', shaft: 0x4e342e, shaftMetal: 0, head: 0x7c4dff, headMetal: 0.2, grip: 0x3e2723, glow: 0.5, blurb: 'Putts with a purple orb. Why not.', icon: '🔮' },
];
const RESULT = (s, par) => s === 1 ? ['HOLE IN ONE!', 500, '⛳'] : s - par <= -2 ? ['EAGLE!', 350, '🦅'] : s - par === -1 ? ['BIRDIE!', 200, '🐦'] : s === par ? ['PAR', 100, '👍'] : s - par === 1 ? ['BOGEY', 50, '😅'] : ['+' + (s - par), 10, '😬'];
const STARS_NEEDED = 14;

// ---------- save ----------
function loadSave() { try { return Object.assign({ coins: 0, skins: ['classic'], skin: 'classic', career: {}, dailyBest: {}, sound: true, music: true, easy: false, aimMode: 'pull', xp: 0, mulligans: 1, clubs: ['classic'], club: 'classic', rounds: 0, underParRounds: 0, bestStreak: 0, crowns: {}, tricks: {}, portals: 0, splashes: 0, dailyAces: 0, badges: {}, quests: {}, questDay: '', holesPlayed: 0, bestRound: null, aces: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return { coins: 0, skins: ['classic'], skin: 'classic', career: {}, dailyBest: {}, sound: true, holesPlayed: 0, bestRound: null, aces: 0 }; } }
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
  skin: (kind) => { switch (kind) {
    case 'chime': [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, 0, i * 0.07)); break;
    case 'vroom': tone(90, 0.5, 'sawtooth', 0.22, 260); tone(180, 0.4, 'square', 0.08, 300, 0.1); break;
    case 'goal': [440, 440, 440, 587].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.14, 'sawtooth', 0.16, 0, i * 0.16)); noise(0.5, 0.06, 0.5); break;
    case 'twinkle': for (let i = 0; i < 7; i++) tone(1400 + Math.random() * 1600, 0.12, 'sine', 0.09, 0, i * 0.06); break;
    case 'giggle': [700, 900, 760, 980, 820, 1050].forEach((f, i) => tone(f, 0.09, 'triangle', 0.16, 120, i * 0.09)); break;
    case 'pop': for (let i = 0; i < 5; i++) tone(500 + i * 90, 0.06, 'sine', 0.15, 400, i * 0.08); break;
    case 'roar': noise(0.6, 0.25); tone(70, 0.6, 'sawtooth', 0.25, -30); tone(140, 0.5, 'square', 0.08, -60, 0.05); break;
  } },
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
R.setClub(CLUBS.find(c => c.id === save.club) || CLUBS[0]);
const S = {
  screen: 'title', mode: null, kingdom: 'meadow', players: 1, course: [], holeIdx: 0, hole: null, world: null, K: null,
  balls: [], strokes: [], scores: [[], []], player: 0, done: [false, false], worldT: 0, acc: 0, last: performance.now(),
  aim: { active: false, dx: 1, dz: 0, power: 0 }, drag: null, orbit: null, flyover: null, waitingShot: true, holeOver: false, paused: false,
  keys: {}, charge: 0, charging: false, aimAngle: 0, popTimer: 0, points: [0, 0], aces: 0,
  pointers: new Map(), pinch: null, autoFace: true, cupZoom: null,
  shot: null, streak: 0, idleT: 0, aimTarget: 0, loadSeq: 0, attract: null, attractSeq: 0, attractStopped: 0,
};
window.__cgk = { S, R, save, KINGDOMS, SKINS, CLUBS, generateCourse, startAce, renderLeaderboards, nameFor, dailyId, aceId, addXp, questFire, useMulligan, renderProfile, ensureQuests, loadHole: (i) => loadHole(i), startRound, shootBall: (dx, dz, p) => { if (canShoot()) doShot(dx, dz, p); }, canShoot: () => canShoot(), skipFlyover: () => { if (S.flyover) S.flyover.t = 99; } };

// ---------- screens ----------
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.toggle('on', el.id === id); S.screen = id; if (id !== 'play') coach(null); $('hud').classList.toggle('on', id === 'play'); if (id !== 'play' && id !== 'pause') playMusic('title');
  if (id === 'title' || id === 'modes' || id === 'kingdoms' || id === 'shop' || id === 'how') { if (!S.attract && S.attractSeq === S.attractStopped) startAttract(); } else if (id === 'play') { S.attractSeq++; S.attractStopped = S.attractSeq; S.attract = null; } }
function renderTitle() { $('coinsTitle').textContent = save.coins; { const L = levelFromXp(save.xp || 0); $('lvlTitle').textContent = `Lv ${L.level} ${titleFor(L.level)}`; } const tot = KINGDOMS.reduce((a, K) => a + careerStars(K.id), 0); $('starsTitle').textContent = `★ ${tot}/${KINGDOMS.length * 27}`; $('easyChk').checked = !!save.easy; }
function renderModes() {
  const d = new Date(); const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
  $('dailyInfo').textContent = save.dailyBest[key] != null ? `Today's best: ${save.dailyBest[key]} pts` : 'One scored attempt per day';
  const ab = (save.aceBest || {})[aceKey()]; $('aceInfo').textContent = ab != null ? `Today's best: ${ab} pts` : 'Ace it in 3 balls · daily board';
}
function renderKingdoms() {
  const box = $('kingdomList'); box.innerHTML = '';
  KINGDOMS.forEach((K, i) => {
    const unlocked = S.mode !== 'career' || kingdomUnlocked(i);
    const stars = careerStars(K.id); const need = i > 0 ? STARS_NEEDED : 0;
    const el = document.createElement('button'); el.className = 'kcard' + (unlocked ? '' : ' locked'); el.style.setProperty('--k', '#' + K.felt.toString(16).padStart(6, '0')); el.style.setProperty('--w', '#' + K.wall.toString(16).padStart(6, '0'));
    el.innerHTML = `<div class="kemoji">${K.emoji}${(save.crowns || {})[K.id] ? '<span class="kcrown">' + (stars >= 27 ? '👑' : '🥇') + '</span>' : ''}</div><div class="kname">${K.name}</div><div class="kdesc">${K.desc}</div>` + (S.mode === 'career' ? `<div class="kstars">★ ${stars}/27${unlocked ? '' : ` — need ${need}★ in ${KINGDOMS[i - 1].name}`}</div>` : '');
    el.disabled = !unlocked; el.onclick = () => { SFX.click(); startRound(S.mode, K.id); }; box.appendChild(el);
  });
}
function renderShop() {
  $('shopCoins').textContent = save.coins; const box = $('skinList'); box.innerHTML = '';
  for (const sk of SKINS) {
    const owned = save.skins.includes(sk.id); const need = SKIN_LEVEL[sk.id] || 1; const lvl = levelFromXp(save.xp || 0).level; const locked = !owned && lvl < need; const el = document.createElement('button'); el.className = 'skin' + (save.skin === sk.id ? ' sel' : '') + (locked ? ' locked' : '');
    el.innerHTML = `<span class="sw" style="background:${sk.base};border-color:${sk.accent}">${sk.pattern === 'eyes' ? '👀' : sk.pattern === 'stars' ? '✨' : sk.pattern === 'flame' ? '🔥' : sk.pattern === 'soccer' ? '⚽' : sk.pattern === 'stripe' ? '🏁' : ''}</span><b>${sk.name}</b><em>${sk.blurb || ''}</em><small>${owned ? (save.skin === sk.id ? 'equipped' : 'owned') : locked ? '🔒 level ' + need : sk.cost + ' 🪙'}</small>`;
    el.onclick = () => { if (!owned) { if (locked) { toast(`Reach level ${need} to unlock ${sk.name}`); return; } if (save.coins < sk.cost) { toast('Not enough coins'); return; } save.coins -= sk.cost; save.skins.push(sk.id); SFX.coin(); } save.skin = sk.id; R.setSkin(sk); persist(save); renderShop(); };
    box.appendChild(el);
  }
  const cbox = $('clubList'); cbox.innerHTML = '';
  for (const cl of CLUBS) {
    const owned = (save.clubs || ['classic']).includes(cl.id); const lvl = levelFromXp(save.xp || 0).level; const locked = !owned && lvl < cl.level;
    const el = document.createElement('button'); el.className = 'skin' + (save.club === cl.id ? ' sel' : '') + (locked ? ' locked' : '');
    el.innerHTML = `<span class="sw" style="background:#${cl.head.toString(16).padStart(6, '0')};border-color:#${cl.shaft.toString(16).padStart(6, '0')}">${cl.icon}</span><b>${cl.name}</b><em>${cl.blurb}</em><small>${owned ? (save.club === cl.id ? 'equipped' : 'owned') : locked ? '🔒 level ' + cl.level : cl.cost + ' 🪙'}</small>`;
    el.onclick = () => { if (!owned) { if (locked) { toast(`Reach level ${cl.level} to unlock ${cl.name}`); return; } if (save.coins < cl.cost) { toast('Not enough coins'); return; } save.coins -= cl.cost; save.clubs = [...(save.clubs || ['classic']), cl.id]; SFX.coin(); } save.club = cl.id; R.setClub(cl); persist(save); renderShop(); };
    cbox.appendChild(el);
  }
}
function toast(msg, ms = 1400) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms); }

// ---------- hole generation: Web Worker so the page never freezes ----------
let genWorker = null; const genPending = new Map(); let genSeq = 0;
try { genWorker = new Worker('src/gen.worker.mjs', { type: 'module' }); genWorker.onmessage = (e) => { const p = genPending.get(e.data.id); if (!p) return; genPending.delete(e.data.id); if (e.data.hole) p.res(e.data.hole); else p.rej(new Error(e.data.error)); }; genWorker.onerror = () => { genWorker = null; for (const [, p] of genPending) p.rej(new Error('worker')); genPending.clear(); }; } catch (e) { genWorker = null; }
function genAsync(kind, args) {
  if (genWorker) return new Promise((res, rej) => { const id = ++genSeq; genPending.set(id, { res, rej }); genWorker.postMessage({ id, kind, args }); })
    .catch(() => new Promise(r => setTimeout(() => r(kind === 'ace' ? generateAceHole(new Date(args.date)) : generateHole(args)), 20)));
  return new Promise(r => setTimeout(() => r(kind === 'ace' ? generateAceHole(new Date(args.date)) : generateHole(args)), 20));
}
// a course is a list of "specs" that become holes lazily; ensureHole(i) resolves the hole object
function courseSpecs(mode, kingdom) {
  if (mode === 'tutorial') return [{ kingdom: 'meadow', index: 0, seed: 4242, difficulty: 0, budget: 0 }, { kingdom: 'meadow', index: 1, seed: 777, difficulty: 2, budget: 0 }, { kingdom: 'meadow', index: 2, seed: 99, difficulty: 2, budget: 1 }];
  if (mode === 'daily') { const seed = dailySeed(new Date()); const rng = makeRng(seed); const out = []; for (let i = 0; i < 9; i++) { const k = KINGDOMS[Math.floor(rng() * KINGDOMS.length)].id; out.push({ kingdom: k, index: i, seed: seed + i * 131, difficulty: Math.min(8, 1 + i) }); } return out; }
  const seed = mode === 'career' ? 777 + KINGDOMS.findIndex(k => k.id === kingdom) * 1000 : (Math.random() * 1e9) | 0;
  return Array.from({ length: 9 }, (_, i) => i === 8 ? { kingdom, index: 8, seed: seed + 8 * 17, _finale: true } : ({ kingdom, index: i, seed: seed + i * 17 }));
}
async function ensureHole(i) {
  const c = S.course; if (!c[i]) return null;
  if (c[i].tiles) return c[i];
  if (c[i]._finale) { const h = buildFinale(c[i].kingdom, kingdomById(c[i].kingdom)); if (h) { c[i] = h; return h; } }
  if (!c[i]._promise) c[i]._promise = genAsync('hole', c[i]).then(h => { c[i] = h; return h; });
  return c[i]._promise;
}
function prefetchHole(i) { if (S.course[i] && !S.course[i].tiles) ensureHole(i).catch(() => {}); }

// ---------- tutorial: three coached holes on first play ----------
const COACH = {
  0: [() => save.aimMode === 'push' ? 'Press anywhere and drag TOWARD the hole, then let go.' : 'Press anywhere and drag AWAY from the hole, like a slingshot. Let go to shoot.', () => 'The dots show where your ball will roll. A longer drag hits harder.'],
  1: [() => 'Corners: bounce off the walls to get around. Right-drag or two fingers to look around.', () => 'Nice. Sink it to move on.'],
  2: [() => 'Obstacles! Bumpers bounce you, windmills need timing. Stuck? ↩ undoes a shot.', () => 'Last hole of the tutorial. Finish it to earn your first coins.'],
};
function coach(text) { const el = $('coach'); if (!text) { el.classList.remove('on'); return; } $('coachText').textContent = text; el.classList.add('on'); }
function coachStep() { if (S.mode !== 'tutorial') return; const steps = COACH[S.holeIdx] || []; const i = Math.min(steps.length - 1, S.strokes[0] > 0 ? 1 : 0); coach(steps[i] ? steps[i]() : null); }
async function startTutorial() { S.players = 1; save.mulligans = Math.max(save.mulligans || 0, 1); await startRound('tutorial', 'meadow'); }
function finishTutorial() {
  coach(null); save.tutorialDone = true; save.coins += 100; persist(save); addXp(200, 'tutorial');
  popup('🎓 TUTORIAL COMPLETE', '+100 coins · now pick a way to play', 2600); SFX.fanfare(5);
  setTimeout(() => { renderModes(); show('modes'); }, 2400);
}
$('btnSkipTut').onclick = (e) => { e.stopPropagation(); save.tutorialDone = true; persist(save); coach(null); renderModes(); show('modes'); };

// ---------- Shot of the Day: one hole, three balls, ace it ----------
const ACE_POINTS = [300, 200, 100];
function aceKey() { const d = new Date(); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0'); }
function aceId() { return 'crazy-golf-ace-daily-' + aceKey(); }
async function startAce() {
  S.mode = 'ace'; S.players = 1; S.kingdom = 'meadow'; S.holeIdx = 0; S.scores = [[], []]; S.points = [0, 0]; S.streak = 0; S.aces = 0;
  S.course = [{ _ace: true, date: Date.now() }]; S.ace = { attempt: 0, best: Infinity, done: false, aced: 0 };
  show('play'); await loadHole(0); updateHud();
}
function aceAfterRest(b) {
  const a = S.ace; if (!a || a.done) return;
  if (b.inCup) { a.aced = a.attempt; a.done = true; const pts = ACE_POINTS[a.attempt - 1] || 100; S.points[0] = pts; save.coins += Math.round(pts / 5); save.dailyAces = (save.dailyAces || 0) + 1; save.aces = (save.aces || 0) + 1; persist(save); questFire('aceDaily', 1); addXp(pts, 'ace'); badgeCheck(); popup(`⛳ ACE!`, `Ball ${a.attempt} of 3 · +${pts} pts`, 2200); SFX.fanfare(5); setTimeout(() => finishAce(pts), 2300); return; }
  const d = Math.hypot(b.x - S.world.cupX, b.z - S.world.cupZ); a.best = Math.min(a.best, d);
  if (a.attempt >= 3) { a.done = true; const pts = Math.max(0, Math.round(50 - a.best * 10)); S.points[0] = pts; save.coins += Math.round(pts / 5); persist(save); popup('😬 NO ACE', `Closest: ${a.best.toFixed(2)} m · +${pts} pts`, 2000); setTimeout(() => finishAce(pts), 2100); return; }
  toast(`Ball ${a.attempt} missed by ${d.toFixed(2)} m — ${3 - a.attempt} left`, 1600);
  // reset to the tee for the next ball
  b.x = S.world.teeX; b.z = S.world.teeZ; b.y = floorHeight(S.world, b.x, b.z); b.vx = b.vz = 0; b.resting = true; b.lastX = b.x; b.lastZ = b.z; S.autoFace = true; S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x); updateHud();
}
function finishAce(pts) {
  const k = aceKey(); save.aceBest = save.aceBest || {}; const prev = save.aceBest[k]; const isBest = prev == null || pts > prev; if (isBest) save.aceBest[k] = pts; persist(save);
  $('scoreHead').textContent = S.ace.aced ? `ACE ON BALL ${S.ace.aced}! · ${pts} pts` : `NO ACE · ${pts} pts`;
  $('scoreTable').innerHTML = `<tr><th>Shot of the Day</th><th>${S.K.emoji} ${S.K.name}</th></tr><tr><td>Result</td><td>${S.ace.aced ? '⛳ ace on ball ' + S.ace.aced : 'closest ' + S.ace.best.toFixed(2) + ' m'}</td></tr><tr><td>Points</td><td><b>${pts}</b>${isBest && prev != null ? ' (new best)' : ''}</td></tr>`;
  $('scoreExtra').innerHTML = '<div id="aceBoard" class="hint">Loading today\'s board…</div>';
  show('scorecard'); $('btnAgain').textContent = 'TRY AGAIN';
  postAce(isBest ? pts : null);
}
function profileName() { try { const p = JSON.parse(localStorage.getItem('imaginex_profile') || 'null'); return p && p.nickname ? String(p.nickname).trim().slice(0, 16) : ''; } catch (e) { return ''; } }
function nameFor() { return profileName() || (save.name || '').trim().slice(0, 16); }
function dailyId() { return 'crazy-golf-daily-' + aceKey(); }
// ---------- leaderboards: fetch/post helpers + the in-game screen ----------
const boardCache = {};
function fetchBoard(id) { return fetch('/api/leaderboard?gameId=' + id).then(r => r.ok ? r.json() : []).then(rows => { rows = Array.isArray(rows) ? rows : []; boardCache[id] = rows; return rows; }).catch(() => null); }
function postBoard(id, score) { const n = nameFor(); if (!n || !(score > 0)) return Promise.resolve(false); return fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: id, nickname: n, score }) }).then(r => r.ok).catch(() => false); }
function rankOf(rows, name) { const i = (rows || []).findIndex(r => r.nickname === name); return i >= 0 ? i + 1 : null; }
function boardHtml(rows, unit, empty) {
  if (rows == null) return '<div class="lbEmpty">Offline — could not load this board.</div>';
  if (!rows.length) return `<div class="lbEmpty">${empty}</div>`;
  const me = nameFor();
  return '<div class="lbRows">' + rows.slice(0, 10).map((r, i) => `<div class="lbRow ${r.nickname === me ? 'me' : ''}"><span class="lbRank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.'}</span><span class="lbName">${String(r.nickname).slice(0, 16)}</span><span class="lbScore">${r.score}${unit}</span></div>`).join('') + '</div>';
}
async function renderLeaderboards() {
  $('lbName').textContent = nameFor() ? `Posting as ${nameFor()}` : 'Set a name to post scores'; $('lbNameRow').style.display = profileName() ? 'none' : '';
  if (!profileName()) $('lbNameInput').value = save.name || '';
  const best = (k) => { const c = save.career[k] || {}; const st = Object.values(c).reduce((a, b) => a + b, 0); return st; };
  $('lbPersonal').innerHTML = [['Best round', save.bestRound != null ? save.bestRound + ' strokes' : '—'], ['Aces', save.aces || 0], ['Best streak', save.bestStreak || 0], ['Crowns', Object.keys(save.crowns || {}).length + '/5'], ...KINGDOMS.map(K => [K.emoji + ' ' + K.name, '★ ' + best(K.id) + '/27'])].map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
  for (const el of ['lbDaily', 'lbAce', 'lbAll']) $(el).innerHTML = '<div class="lbEmpty">Loading…</div>';
  const [d, a, all] = await Promise.all([fetchBoard(dailyId()), fetchBoard(aceId()), fetchBoard('crazy-golf-kingdom')]);
  $('lbDaily').innerHTML = boardHtml(d, ' pts', 'No rounds posted yet today. Play the Daily Course!'); $('lbAce').innerHTML = boardHtml(a, ' pts', 'No aces yet today — be first!'); $('lbAll').innerHTML = boardHtml(all, ' pts', 'Nobody on the all-time board yet.');
  const me = nameFor(); const rd = rankOf(d, me), ra = rankOf(a, me), rall = rankOf(all, me);
  $('lbYou').textContent = me ? [rd ? `Daily #${rd}` : null, ra ? `Shot of the Day #${ra}` : null, rall ? `All-time #${rall}` : null].filter(Boolean).join(' · ') || 'Not on a board yet today' : '';
}
$('btnBoards').onclick = () => { SFX.click(); renderLeaderboards(); show('boards'); };
$('lbNameBtn').onclick = () => { const v = ($('lbNameInput').value || '').trim().slice(0, 16); if (!v) return; save.name = v; persist(save); renderLeaderboards(); };
for (const tab of document.querySelectorAll('.lbTab')) tab.onclick = () => { for (const t of document.querySelectorAll('.lbTab')) t.classList.toggle('sel', t === tab); for (const pane of document.querySelectorAll('.lbPane')) pane.classList.toggle('on', pane.id === tab.dataset.pane); };
function postAce(pts) {
  const box = $('aceBoard'); const render = (rows) => { if (!rows) { box.textContent = 'Board unavailable offline.'; return; }
    box.innerHTML = `<b style="color:#ffe082">Today's top 10</b><div style="display:grid;grid-template-columns:auto 1fr auto;gap:2px 12px;text-align:left;margin:6px auto 0;max-width:320px">` + (rows.slice(0, 10).map((r, i) => `<span>${i + 1}.</span><span style="${r.nickname === nameFor() ? 'color:#ffd166;font-weight:800' : ''}">${String(r.nickname).slice(0, 16)}</span><span>${r.score}</span>`).join('') || '<span></span><span>No aces yet — be first!</span><span></span>') + '</div>' + (nameFor() ? '' : `<div style="margin-top:8px">Post your score: <input id="aceName" maxlength="16" placeholder="your name" style="padding:6px 10px;border-radius:8px;border:1px solid #888;background:#0b1024;color:#fff"> <button class="btn small ghost" id="aceNameBtn">POST</button></div>`); 
    const nb = $('aceNameBtn'); if (nb) nb.onclick = () => { const v = ($('aceName').value || '').trim().slice(0, 16); if (!v) return; save.name = v; persist(save); postAce(save.aceBest[aceKey()]); }; };
  const fetchBoard = () => fetch('/api/leaderboard?gameId=' + aceId()).then(r => r.ok ? r.json() : []).then(rows => render(Array.isArray(rows) ? rows : [])).catch(() => render(null));
  if (pts != null && nameFor() && pts > 0) postBoard(aceId(), pts).finally(fetchBoard); else fetchBoard();
}
// ---------- progression: XP, levels, quests, achievements, mulligans ----------
function todayKey() { const d = new Date(); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0'); }
function ensureQuests() { const k = todayKey(); if (save.questDay !== k) { save.questDay = k; save.quests = {}; persist(save); } return questsForDay(k); }
function addXp(n, why) {
  if (!n) return; const before = levelFromXp(save.xp || 0).level; save.xp = (save.xp || 0) + n; const after = levelFromXp(save.xp).level; persist(save);
  if (after > before) { for (let l = before + 1; l <= after; l++) { const r = levelReward(l); save.coins += r.coins; save.mulligans = (save.mulligans || 0) + r.mulligans; } persist(save);
    setTimeout(() => { popup(`⬆️ LEVEL ${after}`, `${titleFor(after)} · ${levelReward(after).label}`, 2400); SFX.fanfare(4); R.burst(currentBall ? currentBall().x : 0, 0.5, currentBall ? currentBall().z : 0, 40, [0xffeb3b, 0x69f0ae, 0x40c4ff], 3, 0.8, 1.4); }, 600); }
  updateXpHud();
}
function questFire(ev, value) {
  const quests = ensureQuests(); const done = questEvent(quests, save.quests, ev, value); persist(save);
  done.forEach((q, i) => setTimeout(() => { toast(`✅ Quest: ${q.text} · +${q.reward.coins}🪙 +${q.reward.xp}xp${q.reward.mulligans ? ' +' + q.reward.mulligans + ' mulligan' : ''}`, 2400); save.coins += q.reward.coins; save.mulligans = (save.mulligans || 0) + (q.reward.mulligans || 0); SFX.coin(); addXp(q.reward.xp, 'quest'); }, 1200 + i * 900));
}
function badgeCheck() { const fresh = checkAchievements(save); fresh.forEach((a, i) => setTimeout(() => { toast(`${a.icon} Achievement: ${a.name} · +${a.xp}xp`, 2400); SFX.coin(); addXp(a.xp, 'badge'); }, 2000 + i * 900)); if (fresh.length) persist(save); }
function updateXpHud() { const L = levelFromXp(save.xp || 0); const el = $('hXp'); if (el) { el.textContent = `Lv ${L.level}`; el.style.setProperty('--p', L.need ? L.into / L.need : 1); } const mb = $('btnMulligan'); if (mb) { mb.textContent = `↩ ${save.mulligans || 0}`; mb.style.display = (S.mode === 'quick' || S.mode === 'career' || S.mode === 'tutorial') && S.screen === 'play' ? '' : 'none'; mb.disabled = !(save.mulligans > 0 && S.lastShot && currentBall().resting && !currentBall().inCup); } }
function useMulligan() {
  const b = currentBall(); if (!(save.mulligans > 0 && S.lastShot && b.resting && !b.inCup && (S.mode === 'quick' || S.mode === 'career' || S.mode === 'tutorial'))) return;
  const ls = S.lastShot; b.x = ls.x; b.z = ls.z; b.y = floorHeight(S.world, b.x, b.z); b.vx = b.vz = 0; b.lastX = b.x; b.lastZ = b.z; S.strokes[S.player] = ls.strokes; save.mulligans--; persist(save); S.lastShot = null;
  R.burst(b.x, b.y + 0.2, b.z, 20, [0xffffff, 0x90caf9], 1.5, 0.5, 0.7); SFX.teleport(); toast('↩ Mulligan! Shot undone', 1400); S.autoFace = true; S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x); updateHud();
}
function renderProfile() {
  const L = levelFromXp(save.xp || 0); $('pfLevel').textContent = `Level ${L.level} · ${titleFor(L.level)}`; $('pfXp').textContent = L.need ? `${L.into} / ${L.need} XP to level ${L.level + 1}` : 'MAX LEVEL'; $('pfBar').style.setProperty('--p', L.need ? L.into / L.need : 1);
  $('pfStats').innerHTML = [['Holes', save.holesPlayed || 0], ['Rounds', save.rounds || 0], ['Aces', save.aces || 0], ['Best streak', save.bestStreak || 0], ['Coins', save.coins], ['Mulligans', save.mulligans || 0]].map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
  $('pfCrowns').innerHTML = KINGDOMS.map(K => { const c = (save.crowns || {})[K.id]; const gold = careerStars(K.id) >= 27; return `<div class="crown ${c ? 'on' : ''} ${gold ? 'gold' : ''}" title="${K.name}">${gold ? '👑' : c ? '🥇' : '⚪'}<small>${K.emoji}</small></div>`; }).join('');
  const quests = ensureQuests(); $('pfQuests').innerHTML = quests.map(q => { const st = save.quests[q.id] || { n: 0 }; return `<div class="quest ${st.done ? 'done' : ''}"><span>${st.done ? '✅' : '▫️'} ${q.text}</span><small>${Math.min(st.n, q.goal)}/${q.goal} · ${q.reward.coins}🪙 ${q.reward.xp}xp</small></div>`; }).join('');
  $('pfBadges').innerHTML = ACHIEVEMENTS.map(a => `<div class="badge ${save.badges[a.id] ? 'on' : ''}" title="${a.desc}"><span>${a.icon}</span><small>${a.name}</small></div>`).join('');
}

// ---------- attract mode: a live hole with a ghost golfer behind the menus ----------
async function startAttract() {
  const seq = ++S.attractSeq; S.attract = null;
  const K = KINGDOMS[Math.floor(Math.random() * KINGDOMS.length)];
  let hole; try { hole = await genAsync('hole', { kingdom: K.id, index: 2 + Math.floor(Math.random() * 4), seed: (Math.random() * 1e9) | 0 }); } catch (e) { return; }
  if (seq !== S.attractSeq || S.screen === 'play') return;
  const world = compileWorld(hole);
  await R.preloadModels([...new Set([...hole.obstacles.filter(o => o.type === 'model').map(o => o.model), ...(hole.decor || []).map(d => d.model), ...(hole.obstacles.some(o => o.type === 'windmill') ? ['windmill'] : [])])]);
  if (seq !== S.attractSeq || S.screen === 'play') return;
  await R.buildHole(hole, K, world);
  if (seq !== S.attractSeq || S.screen === 'play') return;
  const ball = newBall(world); const cc = R.courseCenter;
  R.cam.tx = R.cam.sx = cc.x; R.cam.tz = R.cam.sz = cc.z; R.cam.ty = R.cam.sy = 0; R.cam.dist = Math.max(9, cc.span * 0.55); R.cam.pitch = 0.62; R.cam.yaw = Math.random() * 6.28;
  S.attract = { hole, world, ball, t: 0, wait: 1.2, doneAt: null, K };
  R.warm(ball, 0);
}
function attractShot(a) {
  const w = a.world, b = a.ball; const base = Math.atan2(w.cupZ - b.z, w.cupX - b.x); let best = null;
  for (const ang of [0, .25, -.25, .55, -.55, .9, -.9, 1.4, -1.4, 2.2, -2.2, Math.PI]) for (const pw of [.15, .3, .5, .75, 1]) {
    const t = { ...b, events: [] }; shoot(t, Math.cos(base + ang), Math.sin(base + ang), pw); let tt = a.t; while (!t.resting && tt - a.t < 10) { step(w, t, tt); tt += STEP; }
    const d = t.inCup ? -1 : Math.hypot(w.cupX - t.x, w.cupZ - t.z) + (t.penalty || 0) * 50; if (!best || d < best.d) best = { d, ang, pw }; if (t.inCup) break; }
  shoot(b, Math.cos(base + best.ang), Math.sin(base + best.ang), best.pw); b.penalty = 0;
}
function attractFrame(dt) {
  const a = S.attract; if (!a) return;
  a.t += dt; R.cam.yaw += dt * 0.12; R.lookAtBall({ x: R.courseCenter.x, y: 0, z: R.courseCenter.z });
  if (a.ball.inCup) { if (a.doneAt == null) { a.doneAt = a.t; R.burst(a.world.cupX, 0.2, a.world.cupZ, 40, [0xffeb3b, 0xff4081, 0x40c4ff, 0x69f0ae], 3, 0.8, 1.4); } else if (a.t - a.doneAt > 2.2) { startAttract(); return; } }
  else if (a.ball.resting) { a.wait -= dt; if (a.wait <= 0) { attractShot(a); a.wait = 1.4 + Math.random(); } }
  else { let acc = dt; while (acc > 0) { step(a.world, a.ball, a.t); acc -= STEP; } for (const e of a.ball.events) { if (e.type === 'bumper' || e.type === 'model') R.hit(e.x, e.z); if (e.type === 'reset') a.ball.penalty = 0; } a.ball.events.length = 0; }
  if (a.t > 75) { startAttract(); return; }   // never let one hole loop forever
  R.update(a.ball, a.t, dt, null);
}
// ---------- round flow ----------
async function startRound(mode, kingdom) {
  S.mode = mode; S.kingdom = kingdom; S.holeIdx = 0; S.scores = [[], []]; S.points = [0, 0]; S.aces = 0; S.streak = 0; S.roundPenalties = 0; S.lastShot = null;
  S.course = courseSpecs(mode, kingdom);
  show('play'); await loadHole(0);
}
async function loadHole(i) {
  const gen = ++S.loadSeq;
  S.world = null; S.hole = null; $('loadText').textContent = S.mode === 'ace' ? 'BUILDING THE SHOT OF THE DAY…' : `BUILDING HOLE ${i + 1}…`; $('loadSpin').textContent = '⛳';
  // keep the last rendered frame on screen; only show the overlay if this load turns out to be slow (no dark flash on fast loads)
  clearTimeout(S.loadTimer); S.loadTimer = setTimeout(() => { if (gen === S.loadSeq && !S.world) $('loading').classList.add('on'); }, 550);
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  let hole;
  try { hole = S.course[i] && S.course[i]._ace ? await genAsync('ace', { date: S.course[i].date }) : await ensureHole(i); } catch (e) { hole = generateHole(S.course[i]); }
  if (gen !== S.loadSeq) { clearTimeout(S.loadTimer); return; }   // a newer load superseded this one
  if (S.course[i] && S.course[i]._ace) S.course[i] = hole;
  S.holeIdx = i; S.K = kingdomById(hole.kingdom); const world = compileWorld(hole); playMusic(S.K.id);
  S.balls = [newBall(world), newBall(world)]; S.strokes = [0, 0]; S.done = [false, false]; S.player = 0; S.holeOver = false; S.worldT = 0; S.waitingShot = false; S.cupZoom = null; S.autoFace = true;
  $('loadSpin').textContent = S.K.emoji;
  await R.preloadModels([...new Set([...hole.obstacles.filter(o => o.type === 'model').map(o => o.model), ...(hole.decor || []).map(d => d.model), ...(hole.obstacles.some(o => o.type === 'windmill') ? ['windmill'] : [])])]);
  if (gen !== S.loadSeq) return;
  await R.buildHole(hole, S.K, world);
  if (gen !== S.loadSeq) return;
  S.hole = hole; S.world = world;   // only now does the frame loop see the new hole (renderer + state switch together)
  updateHud();
  prefetchHole(i + 1);
  // flyover: cup → tee
  const b = S.balls[0]; R.snapToBall({ x: S.world.cupX, y: floorHeight(S.world, S.world.cupX, S.world.cupZ), z: S.world.cupZ }); R.cam.dist = 7; R.cam.pitch = 0.9; R.faceCup(b, S.world); R.cam.yaw += 0.6;
  S.flyover = { t: 0, dur: 2.4, from: { x: S.world.cupX, z: S.world.cupZ, yaw: R.cam.yaw }, to: { x: b.x, z: b.z, yaw: Math.atan2(b.z - S.world.cupZ, b.x - S.world.cupX) } };
  // warm the GPU: compile shaders + draw one frame behind the overlay, so the first visible frame is complete
  R.warm(S.balls[0], S.worldT);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (gen !== S.loadSeq) return;
  clearTimeout(S.loadTimer); $('loading').classList.remove('on');
  if (S.mode === 'ace') popup('SHOT OF THE DAY', `Ace it in 3 balls · ${S.K.emoji} ${S.K.name}`, 2400); else if (S.hole.finale) { popup(`👑 FINALE: ${S.hole.name.toUpperCase()}`, `${S.hole.blurb} · Par ${S.hole.par}`, 3200); SFX.fanfare(3); } else popup(`HOLE ${i + 1}`, `Par ${S.hole.par} · ${S.K.emoji} ${S.K.name}`, 2000);
  S.lastShot = null; updateXpHud(); if (S.mode === 'tutorial') { popup(`LESSON ${i + 1}`, ['Your first putt', 'Around the corner', 'Obstacles'][i] || '', 1800); setTimeout(coachStep, 600); } else coach(null);
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
    if (sh.lip) tricks.push(['🍀 LUCKY LIP', 50]); if (sh.tele) tricks.push(['🌀 PORTAL PUTT', 75]); if (sh.cannon) tricks.push(['💥 CANNONBALL', 75]); if (sh.jump) tricks.push(['🦘 AIR MAIL', 100]);
  }
  for (const [, v] of tricks) pts += v;
  save.tricks = save.tricks || {}; for (const [t] of tricks) { const k = /BANK/.test(t) ? 'bank' : /BUSTER/.test(t) ? 'buster' : /BOMB/.test(t) ? 'bomb' : /AIR/.test(t) ? 'air' : /LIP/.test(t) ? 'lip' : /PORTAL/.test(t) ? 'portal' : 'cannon'; save.tricks[k] = (save.tricks[k] || 0) + 1; if (k === 'bank') questFire('trick:bank', 1); if (k === 'air') questFire('trick:air', 1); }
  // streak: consecutive holes at or under par (solo modes)
  if (p === 0) { if (holed && strokes <= S.hole.par) { S.streak++; save.bestStreak = Math.max(save.bestStreak || 0, S.streak); questFire('parOrBetter', 1); if (strokes < S.hole.par) questFire('birdie', 1); } else { if (S.streak >= 2) toast(`💔 Streak of ${S.streak} broken`, 1600); S.streak = 0; } questFire('kingdom', S.K.id); }
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
  if (p === 0) { addXp(pts, 'hole'); if (holed && S.hole.finale && S.mode === 'career') { if (!save.crowns[S.kingdom]) { save.crowns[S.kingdom] = Date.now(); persist(save); setTimeout(() => { popup('👑 KINGDOM CLEARED', `${S.K.name} · crown earned`, 2600); SFX.fanfare(5); R.addShake(0.2); for (let k = 0; k < 3; k++) setTimeout(() => R.burst(S.world.cupX + (Math.random() - 0.5) * 3, 0.8, S.world.cupZ + (Math.random() - 0.5) * 3, 60, [0xffd54f, 0xffffff, 0xff4081], 4, 0.6, 1.8), 200 + k * 300); }, 2000); } questFire('finale', 1); } else if (holed && S.hole.finale) questFire('finale', 1); badgeCheck(); }
  popup(`${emoji} ${label}`, `${S.players === 2 ? 'P' + (p + 1) + ' · ' : ''}${strokes} stroke${strokes === 1 ? '' : 's'} · +${pts} pts`, 1800);
  if (holed) { SFX.fanfare(strokes === 1 ? 5 : strokes <= S.hole.par ? 4 : 2); if (strokes === 1) { for (let k = 0; k < 4; k++) setTimeout(() => R.burst(S.world.cupX + (Math.random() - 0.5) * 2, 0.6, S.world.cupZ + (Math.random() - 0.5) * 2, 50, [0xffeb3b, 0xff4081, 0x40c4ff, 0x69f0ae, 0xffffff], 4, 0.6, 1.8), 250 + k * 260); R.addShake(0.2); } }
  if (S.done[0] && (S.players === 1 || S.done[1])) { S.holeOver = true; setTimeout(showHoleEnd, 1500); }
  else nextPlayer();
}
function showHoleEnd() {
  if (S.mode === 'tutorial' && S.holeIdx >= S.course.length - 1) return finishTutorial();
  if (S.holeIdx >= S.course.length - 1) return showScorecard();
  loadHole(S.holeIdx + 1);
}
async function showScorecard() {
  await Promise.all(S.course.map((_, i) => ensureHole(i)));
  const total = (p) => S.scores[p].reduce((a, b) => a + (b || 0), 0); const parT = S.course.reduce((a, h) => a + h.par, 0);
  let rows = '<tr><th>Hole</th>' + S.course.map((_, i) => `<th>${i + 1}</th>`).join('') + '<th>Tot</th></tr>';
  rows += '<tr><td>Par</td>' + S.course.map(h => `<td>${h.par}</td>`).join('') + `<td>${parT}</td></tr>`;
  for (let p = 0; p < S.players; p++) rows += `<tr class="pl"><td>${S.players === 2 ? 'P' + (p + 1) : 'You'}</td>` + S.course.map((h, i) => { const s = S.scores[p][i]; const c = s == null ? '' : s === 1 ? 'ace' : s < h.par ? 'under' : s === h.par ? 'par' : 'over'; return `<td class="${c}">${s ?? '-'}</td>`; }).join('') + `<td><b>${total(p)}</b></td></tr>`;
  $('scoreTable').innerHTML = rows;
  const rel = total(0) - parT; const relS = rel === 0 ? 'EVEN' : rel > 0 ? '+' + rel : String(rel);
  let head = S.players === 2 ? (total(0) === total(1) ? 'TIE GAME!' : total(0) < total(1) ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!') : `${relS} · ${S.points[0]} pts`;
  $('scoreHead').textContent = head;
  const key = dailyKey();
  if (S.mode === 'daily') { if (save.dailyBest[key] == null || S.points[0] > save.dailyBest[key]) save.dailyBest[key] = S.points[0]; try { window.parent.postMessage({ type: 'imaginex-score', gameId: 'crazy-golf-kingdom', score: S.points[0] }, '*'); } catch (e) {}
    const pts = S.points[0]; postBoard(dailyId(), pts).then(() => fetchBoard(dailyId())).then(rows => { const r = rankOf(rows, nameFor()); const el = $('scoreRank'); if (!el) return; el.innerHTML = rows == null ? '' : (r ? `🏆 You're <b>#${r}</b> on today's Daily Course board` : (nameFor() ? `Today's board: ${rows.length ? rows.length + ' players' : 'be the first to post'}` : `<button class="btn small ghost" id="btnNameFromScore">Set a name to post your score</button>`)); const nb = $('btnNameFromScore'); if (nb) nb.onclick = () => { renderLeaderboards(); show('boards'); }; }); }
  if (S.mode !== 'daily' && (save.bestRound == null || total(0) < save.bestRound)) save.bestRound = total(0);
  save.rounds = (save.rounds || 0) + 1; if (total(0) < parT) save.underParRounds = (save.underParRounds || 0) + 1; questFire('round', 1); if (S.points[0] >= 1500) questFire('round1500', 1); if (!(S.roundPenalties || 0)) questFire('cleanRound', 1); addXp(200, 'round'); badgeCheck();
  const extra = S.mode === 'career' ? `★ ${careerStars(S.kingdom)}/27 in ${S.K.name}` + (KINGDOMS.findIndex(k => k.id === S.kingdom) < KINGDOMS.length - 1 && careerStars(S.kingdom) >= STARS_NEEDED ? ' — next kingdom unlocked!' : '') : S.mode === 'daily' ? 'Score posted to the daily leaderboard' : '';
  $('scoreExtra').textContent = extra; $('scoreRank').innerHTML = ''; persist(save); show('scorecard');
}
function dailyKey() { const d = new Date(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }

// ---------- HUD ----------
function updateHud() {
  $('hHole').textContent = S.mode === 'ace' ? `Shot of the Day` : `Hole ${S.holeIdx + 1}/${S.course.length}`; $('hPar').textContent = S.mode === 'ace' ? `Ball ${Math.min(3, (S.ace ? S.ace.attempt : 0) + 1)}/3` : `Par ${S.hole.par}`;
  $('hStrokes').textContent = S.players === 2 ? `P1 ${S.strokes[0]} · P2 ${S.strokes[1]}` : `Strokes ${S.strokes[0]}`;
  $('hPlayer').textContent = S.players === 2 ? `Player ${S.player + 1}` : ''; $('hPlayer').style.display = S.players === 2 ? '' : 'none';
  $('hKing').textContent = `${S.K.emoji} ${S.K.name}${save.easy ? ' · EASY' : ''}`;
  const done = S.scores[0].filter(x => x != null).length; const rel = S.scores[0].reduce((a, sc, i) => a + (sc == null || !S.course[i].par ? 0 : sc - S.course[i].par), 0);
  $('hScore').textContent = done ? `${rel === 0 ? 'E' : rel > 0 ? '+' + rel : rel} thru ${done} · ${S.points[0]} pts` : `${S.points[0]} pts`;
  $('hStreak').textContent = S.streak >= 2 ? `🔥 ${S.streak}` : ''; $('hStreak').style.display = S.streak >= 2 ? '' : 'none';
  updateXpHud();
}
function popup(big, small, ms = 1500) { const p = $('popup'); p.querySelector('.big').textContent = big; p.querySelector('.small').textContent = small; p.classList.add('on'); clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('on'), ms); }

// ---------- input ----------
const ballPlaneY = () => currentBall().y + 0.02;
function canShoot() { return S.screen === 'play' && !!S.world && !!S.hole && !S.flyover && !S.holeOver && currentBall().resting && !currentBall().inCup && !S.paused; }
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
  let dx, dz;
  if (f0 && f1) { dx = f0.x - f1.x; dz = f0.z - f1.z; }
  else { // pointer above the horizon: map the screen drag through the camera's yaw instead of the floor plane
    const yaw = R.cam.yaw, sx = S.drag.x0 - px, sy = S.drag.y0 - py; const fx = -Math.cos(yaw), fz = -Math.sin(yaw), rx = Math.sin(yaw), rz = -Math.cos(yaw);
    dx = rx * sx + fx * (-sy); dz = rz * sx + fz * (-sy); }
  if (save.aimMode === 'push') { dx = -dx; dz = -dz; }
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
  S.lastShot = { x: b.x, z: b.z, strokes: S.strokes[S.player] - 1 }; R.putt(power); if (S.mode === 'tutorial') setTimeout(coachStep, 300);
  S.shot = { x0: b.x, z0: b.z, walls: 0, bumpers: 0, lip: false, tele: false, cannon: false, jump: false }; S.idleT = 0; if (S.mode === 'ace' && S.ace) S.ace.attempt++; updateHud();
  R.burst(b.x, b.y + 0.05, b.z, 8, [0xffffff, 0xdddddd], 1.2, 1, 0.5);
}
function pinchState() { const pts = [...S.pointers.values()]; const [a, b] = pts; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  ac(); S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
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
for (const ev of ['touchstart', 'touchmove']) canvas.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.target === canvas || (e.target.closest && e.target.closest('#hud'))) { if (e.cancelable) e.preventDefault(); } }, { passive: false });
// iOS only unlocks audio on touchend/click: resume the context + retry music there too
for (const ev of ['touchend', 'click']) window.addEventListener(ev, () => { ac(); if (save.music && MUSIC.want && (!MUSIC.cur || MUSIC.cur.paused)) { MUSIC.cur = null; playMusic(MUSIC.want); } }, { capture: true, passive: true });
// orientation / viewport changes (iPad split view, rotate)
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => R.resize());
window.addEventListener('orientationchange', () => setTimeout(() => R.resize(), 300));
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
$('btnPlay').onclick = () => { SFX.click(); if (!save.tutorialDone) { startTutorial(); return; } renderModes(); show('modes'); };
$('btnTutorial').onclick = () => { SFX.click(); startTutorial(); };
$('btnShop').onclick = () => { SFX.click(); renderShop(); show('shop'); };
$('btnHow').onclick = () => { SFX.click(); show('how'); };
for (const el of document.querySelectorAll('[data-back]')) el.onclick = () => { SFX.click(); renderTitle(); show(el.dataset.back); };
for (const el of document.querySelectorAll('[data-mode]')) el.onclick = () => { SFX.click(); S.mode = el.dataset.mode; S.players = el.dataset.players ? Number(el.dataset.players) : 1; if (S.mode === 'daily') startRound('daily', 'meadow'); else { renderKingdoms(); $('kingTitle').textContent = S.mode === 'career' ? 'Career — pick a kingdom' : S.players === 2 ? '2 Players — pick a kingdom' : 'Quick Round — pick a kingdom'; show('kingdoms'); } };
$('btnAgain').onclick = () => { SFX.click(); $('btnAgain').textContent = 'PLAY AGAIN'; if (S.mode === 'ace') startAce(); else if (S.mode === 'daily') { renderTitle(); show('title'); } else startRound(S.mode, S.kingdom); };
$('btnAce').onclick = () => { SFX.click(); startAce(); };
$('btnProfile').onclick = () => { SFX.click(); renderProfile(); show('profile'); };
$('btnMulligan').onclick = () => useMulligan();
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
$('btnPeek').onclick = () => { if (S.screen !== 'play' || S.flyover || !S.world) return; const b = currentBall(); const yaw0 = R.cam.yaw; S.flyover = { t: 0, dur: 3.2, peek: true, from: { x: b.x, z: b.z, yaw: yaw0 }, to: { x: S.world.cupX, z: S.world.cupZ, yaw: yaw0 } }; };
$('easyChk').onchange = (e) => { save.easy = e.target.checked; persist(save); };
function aimLabel() { return save.aimMode === 'push' ? '🎯 Aim: PUSH toward target' : '🎯 Aim: PULL back (slingshot)'; }
function toggleAim() { save.aimMode = save.aimMode === 'push' ? 'pull' : 'push'; persist(save); for (const el of document.querySelectorAll('.aimBtn')) el.textContent = aimLabel(); toast(save.aimMode === 'push' ? 'Drag toward where you want the ball to go' : 'Drag back like a slingshot', 1800); }
for (const el of document.querySelectorAll('.aimBtn')) { el.textContent = aimLabel(); el.onclick = () => toggleAim(); }

// ---------- main loop ----------
function handleEvents(b) {
  for (const e of b.events) {
    switch (e.type) {
      case 'wall': SFX.wall(e.v); if (S.shot && e.v > 1.5) S.shot.walls++; if (e.v > 6) R.addShake(0.06); R.burst(e.x, b.y + 0.1, e.z, 5, [0xffffff, 0xffe082], 1.2, 1, 0.4); break;
      case 'bumper': SFX.bumper(); if (S.shot) S.shot.bumpers++; questFire('bumper', 1); R.hit(e.x, e.z); R.addShake(0.12 + Math.min(0.15, e.v * 0.02)); R.burst(e.x, b.y + 0.15, e.z, 14, [0xff7043, 0xffffff, 0xffeb3b], 2.2, 1, 0.6); break;
      case 'model': SFX.model(); R.hit(e.x, e.z); R.burst(e.x, b.y + 0.15, e.z, 8, [0xffffff], 1.5, 1, 0.5); break;
      case 'cup': SFX.cup(); { const sk = SKINS.find(k => k.id === save.skin); if (sk && sk.sfx) setTimeout(() => SFX.skin(sk.sfx), 250); } R.burst(S.world.cupX, b.y + 0.2, S.world.cupZ, 60, [0xffeb3b, 0xff4081, 0x40c4ff, 0x69f0ae, 0xffffff], 3.5, 0.8, 1.6); b.events.length = 0; S.cupZoom = { t: 0 }; if (S.mode === 'ace') { aceAfterRest(b); return true; } finishBall(S.player, true); return true;
      case 'reset': SFX.water(); R.addShake(0.15); save.splashes = (save.splashes || 0) + 1; S.roundPenalties = (S.roundPenalties || 0) + 1; { const msg = e.reason === 'water' ? '💦 Splash!' : e.reason === 'gap' ? '🕳️ Into the pit!' : '🕳️ Off course!'; if (S.mode === 'ace') toast(msg, 1200); else if (save.easy) toast(msg + ' (easy mode: no penalty)'); else { toast(msg + ' +1 stroke'); S.strokes[S.player]++; } } updateHud(); break;
      case 'boost': SFX.boost(); break;
      case 'teleport': SFX.teleport(); if (S.shot) S.shot.tele = true; save.portals = (save.portals || 0) + 1; questFire('teleport', 1); R.burst(b.x, b.y + 0.1, b.z, 20, [0x40c4ff, 0xff4081], 2, 0.3, 0.8); break;
      case 'cannon': SFX.cannon(); if (S.shot) S.shot.cannon = true; R.addShake(0.28); R.burst(b.x, b.y + 0.2, b.z, 25, [0x90a4ae, 0xffffff, 0xff9800], 2.5, 0.8, 0.8); break;
      case 'land': R.burst(b.x, b.y + 0.05, b.z, 10, [0xffffff], 1.4, 1, 0.5); R.addShake(0.08); break;
      case 'jump': SFX.boost(); R.addShake(0.1); R.burst(b.x, b.y + 0.1, b.z, 16, [0xffd600, 0xffffff], 2, 1, 0.6); if (S.shot) S.shot.jump = true; break;
      case 'turntable': SFX.teleport(); break;
      case 'lipout': SFX.lipout(); if (S.shot) S.shot.lip = true; toast('😮 SO CLOSE!', 900); break;
      case 'rest': updateXpHud(); if (S.mode === 'ace') { b.events.length = 0; aceAfterRest(b); return true; } if (S.strokes[S.player] >= maxStrokes() && !b.inCup) { b.events.length = 0; finishBall(S.player, false); return true; } if (S.players === 2 && !S.done[S.player]) nextPlayer(); S.autoFace = true; S.idleT = 0; S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - b.z, S.world.cupX - b.x); if (S.strokes[S.player] === maxStrokes() - 1) toast('Last stroke!'); break;
    }
  }
  b.events.length = 0; return false;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
  if (S.screen !== 'play') { if (S.attract && S.screen !== 'scorecard') attractFrame(dt); return; }
  if (!S.world || !S.hole) return;
  if (S.flyover) {
    const f = S.flyover; f.t += dt; const u = Math.min(1, f.t / f.dur); let e = u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u; if (f.peek) { const v = u < 0.5 ? u * 2 : 2 - u * 2; e = v < 0.5 ? 2 * v * v : -1 + (4 - 2 * v) * v; }
    R.cam.tx = R.cam.sx = f.from.x + (f.to.x - f.from.x) * e; R.cam.tz = R.cam.sz = f.from.z + (f.to.z - f.from.z) * e; { const fh = floorHeight(S.world, R.cam.tx, R.cam.tz); R.cam.ty = R.cam.sy = isFinite(fh) ? fh : 0; }
    R.cam.yaw = f.from.yaw + (f.to.yaw - f.from.yaw) * e; R.cam.dist = 7 + Math.sin(u * Math.PI) * 4;
    if (u >= 1) { const wasPeek = f.peek; S.flyover = null; R.cam.dist = 7; R.cam.pitch = 0.72; if (!wasPeek) S.aimAngle = S.aimTarget = Math.atan2(S.world.cupZ - f.to.z, S.world.cupX - f.to.x); }
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
      let stopEv = null;
      while (!t.resting && tt - S.worldT < 1.4 && pts.length < 40) { step(S.world, t, tt); tt += STEP; if (++k % 5 === 0) pts.push({ x: t.x, y: t.y, z: t.z }); stopEv = t.events.find(e => e.type === 'wall' || e.type === 'bumper' || e.type === 'model' || e.type === 'reset' || e.type === 'cannon' || e.type === 'teleport'); if (stopEv) break; }
      if (stopEv && (stopEv.type === 'cannon' || stopEv.type === 'teleport')) { // show where the ride ends: an arc to the cannon target / a hop to the portal exit
        const pad = S.world.pads.find(p => p.type === stopEv.type && Math.hypot(p.x - t.x, p.z - t.z) < (stopEv.type === 'cannon' ? 0.9 : 0.8) + p.r);
        if (pad) { const tx = pad.tx, tz = pad.tz; const y0 = t.y; for (let j = 1; j <= 8; j++) { const u = j / 8; pts.push({ x: pad.x + (tx - pad.x) * u, y: y0 + (stopEv.type === 'cannon' ? Math.sin(u * Math.PI) * 2.2 : 0.4 * Math.sin(u * Math.PI)), z: pad.z + (tz - pad.z) * u }); } }
      }
      R.setPreview(pts);
    } else R.setPreview(null);
    R.setCupNear(b.resting && !b.inCup ? Math.hypot(b.x - S.world.cupX, b.z - S.world.cupZ) : 9);
    if (canShoot() && !S.drag && !S.charging) { S.idleT += dt; if (S.idleT > 12) { toast('Drag back from the ball to shoot', 1500); S.idleT = 0; } } else S.idleT = 0;
    if (S.cupZoom) { S.cupZoom.t += dt; R.cam.tx = S.world.cupX; R.cam.tz = S.world.cupZ; R.cam.ty = floorHeight(S.world, S.world.cupX, S.world.cupZ); R.cam.dist = Math.max(3.2, R.cam.dist - dt * 6); }
  }
  R.setOther(S.players === 2 && !S.done[1 - S.player] ? S.balls[1 - S.player] : null);
  R.update(currentBall(), S.worldT, dt, S.aim.active && canShoot() ? S.aim : null);
  if (DEBUG) { const gl = R.renderer.getContext(); const px = new Uint8Array(4); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; let lum = 0; for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { gl.readPixels(Math.floor(W * fx), Math.floor(H * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); lum = Math.max(lum, (px[0] + px[1] + px[2]) / 3); } /* dark only if EVERY sample is dark (the cup itself is black) */ S.dbgFrames = (S.dbgFrames || 0) + 1; if (lum < 8) { S.dbgDark = (S.dbgDark || 0) + 1; const e = { lum, t: +performance.now().toFixed(0), cam: { yaw: +R.cam.yaw.toFixed(2), pitch: +R.cam.pitch.toFixed(2), dist: +R.cam.dist.toFixed(2), sx: +R.cam.sx.toFixed(1), sy: +R.cam.sy.toFixed(2), sz: +R.cam.sz.toFixed(1) }, hole: S.holeIdx, fly: !!S.flyover, flyT: S.flyover ? +S.flyover.t.toFixed(2) : null, ball: [+currentBall().x.toFixed(1), +currentBall().y.toFixed(2), +currentBall().z.toFixed(1)], loading: document.getElementById('loading').classList.contains('on') }; (S.dbgLog = S.dbgLog || []).push(e); console.warn('CGK dark frame ' + JSON.stringify(e)); } $('hKing').textContent = `dbg frames ${S.dbgFrames} dark ${S.dbgDark || 0}`; }
  // other player's ball ghost (2P): draw as small marker via particles? keep simple: show in HUD only
}
R.resize(); renderTitle(); show('title'); requestAnimationFrame(frame);
$('loading').classList.remove('on');
