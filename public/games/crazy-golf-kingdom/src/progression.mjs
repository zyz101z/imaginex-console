// CRAZY GOLF KINGDOM — progression: XP/levels, level rewards, daily quests, achievements, mulligans. Pure module.

export const LEVEL_MAX = 40;
export function xpForLevel(l) { return Math.round(350 * Math.pow(l, 1.45)); }          // xp needed to go from l to l+1
export function levelFromXp(xp) { let l = 1, acc = 0; while (l < LEVEL_MAX && xp >= acc + xpForLevel(l)) { acc += xpForLevel(l); l++; } return { level: l, into: xp - acc, need: l < LEVEL_MAX ? xpForLevel(l) : 0 }; }

export const TITLES = ['Rookie', 'Weekend Putter', 'Bumper Bouncer', 'Windmill Whisperer', 'Portal Pilot', 'Cannon Fodder', 'Swamp Survivor', 'Candy Crusher', 'Castle Creeper', 'Star Sailor',
  'Ace Chaser', 'Bank Shot Bandit', 'Gap Jumper', 'Tail Dodger', 'Gauntlet Runner', 'Course Royalty', 'Kingdom Legend', 'Mini-Golf Monarch', 'The Crazy One', 'Grand Champion'];
export function titleFor(level) { return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))]; }

// what each level-up hands out (cycles; every 5th level is bigger)
export function levelReward(level) {
  if (level % 5 === 0) return { coins: 300, mulligans: 2, label: '300 coins + 2 mulligans' };
  if (level % 2 === 0) return { coins: 120, mulligans: 1, label: '120 coins + 1 mulligan' };
  return { coins: 150, mulligans: 0, label: '150 coins' };
}
// skins unlock by level as well as coins
export const SKIN_LEVEL = { classic: 1, sunny: 1, stripe: 2, mint: 3, soccer: 4, stars: 6, checker: 7, eyes: 8, flame: 12, galaxy: 14, gold: 18 };

// ---------- daily quests ----------
export const QUEST_POOL = [
  { id: 'birdies2', text: 'Score 2 birdies or better', goal: 2, ev: 'birdie', reward: { coins: 80, xp: 150 } },
  { id: 'bumpers5', text: 'Hit 5 bumpers', goal: 5, ev: 'bumper', reward: { coins: 50, xp: 80 } },
  { id: 'round', text: 'Finish a 9-hole round', goal: 1, ev: 'round', reward: { coins: 100, xp: 200 } },
  { id: 'bank', text: 'Make a Bank Shot', goal: 1, ev: 'trick:bank', reward: { coins: 90, xp: 150, mulligans: 1 } },
  { id: 'air', text: 'Hole out off a jump pad', goal: 1, ev: 'trick:air', reward: { coins: 90, xp: 150, mulligans: 1 } },
  { id: 'pars3', text: 'Make par or better on 3 holes', goal: 3, ev: 'parOrBetter', reward: { coins: 60, xp: 120 } },
  { id: 'kingdom', text: 'Play a hole in every kingdom', goal: 5, ev: 'kingdom', distinct: true, reward: { coins: 120, xp: 220 } },
  { id: 'ace', text: 'Ace the Shot of the Day', goal: 1, ev: 'aceDaily', reward: { coins: 200, xp: 400, mulligans: 2 } },
  { id: 'points1500', text: 'Score 1,500 points in one round', goal: 1, ev: 'round1500', reward: { coins: 120, xp: 250 } },
  { id: 'water0', text: 'Finish a round with no water or pit penalties', goal: 1, ev: 'cleanRound', reward: { coins: 100, xp: 200 } },
  { id: 'portal', text: 'Go through a portal 3 times', goal: 3, ev: 'teleport', reward: { coins: 50, xp: 90 } },
  { id: 'finale', text: 'Clear a kingdom finale', goal: 1, ev: 'finale', reward: { coins: 150, xp: 300, mulligans: 1 } },
];
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function questsForDay(key) { // 3 distinct quests, seeded by the UTC day key
  let a = hash('cgk-quests-' + key); const pick = []; const pool = QUEST_POOL.slice();
  while (pick.length < 3 && pool.length) { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296; pick.push(pool.splice(Math.floor(r * pool.length), 1)[0]); }
  return pick;
}
// progress state: { [questId]: { n, done, set:[...] } } ; returns list of quests that just completed
export function questEvent(quests, prog, ev, value) {
  const done = [];
  for (const q of quests) {
    const st = prog[q.id] || (prog[q.id] = { n: 0, done: false, set: [] });
    if (st.done || q.ev !== ev) continue;
    if (q.distinct) { if (!st.set.includes(value)) st.set.push(value); st.n = st.set.length; } else st.n += (typeof value === 'number' ? value : 1);
    if (st.n >= q.goal) { st.done = true; done.push(q); }
  }
  return done;
}

// ---------- achievements ----------
export const ACHIEVEMENTS = [
  { id: 'firstHole', name: 'First Putt', desc: 'Finish a hole', icon: '⛳', xp: 50, test: s => s.holesPlayed >= 1 },
  { id: 'firstAce', name: 'Hole in One!', desc: 'Ace any hole', icon: '🎯', xp: 200, test: s => s.aces >= 1 },
  { id: 'aces5', name: 'Sniper', desc: 'Five aces', icon: '🏹', xp: 400, test: s => s.aces >= 5 },
  { id: 'bank', name: 'Off the Cushion', desc: 'Make a bank shot', icon: '🎱', xp: 100, test: s => (s.tricks?.bank || 0) >= 1 },
  { id: 'air', name: 'Air Mail', desc: 'Hole out off a jump pad', icon: '🦘', xp: 150, test: s => (s.tricks?.air || 0) >= 1 },
  { id: 'buster', name: 'Pinball Wizard', desc: 'Bumper Buster bonus', icon: '🔴', xp: 150, test: s => (s.tricks?.buster || 0) >= 1 },
  { id: 'bomb', name: 'Long Bomb', desc: 'Hole out from 9+ metres', icon: '🚀', xp: 150, test: s => (s.tricks?.bomb || 0) >= 1 },
  { id: 'round', name: 'Full Round', desc: 'Finish 9 holes', icon: '🏁', xp: 100, test: s => s.rounds >= 1 },
  { id: 'rounds10', name: 'Regular', desc: 'Finish 10 rounds', icon: '📅', xp: 300, test: s => s.rounds >= 10 },
  { id: 'underPar', name: 'Under Par', desc: 'Finish a round under par', icon: '📉', xp: 200, test: s => s.underParRounds >= 1 },
  { id: 'streak5', name: 'On Fire', desc: '5 holes at or under par in a row', icon: '🔥', xp: 200, test: s => s.bestStreak >= 5 },
  { id: 'crown1', name: 'Crowned', desc: 'Clear a kingdom finale', icon: '👑', xp: 250, test: s => Object.keys(s.crowns || {}).length >= 1 },
  { id: 'crown5', name: 'Five Kingdoms', desc: 'Clear every finale', icon: '🏰', xp: 800, test: s => Object.keys(s.crowns || {}).length >= 5 },
  { id: 'stars27', name: 'Perfect Kingdom', desc: '27 stars in one kingdom', icon: '⭐', xp: 500, test: s => Object.values(s.career || {}).some(k => Object.values(k).reduce((a, b) => a + b, 0) >= 27) },
  { id: 'dailyAce', name: 'Shot of the Day', desc: 'Ace the daily ace challenge', icon: '🌅', xp: 300, test: s => s.dailyAces >= 1 },
  { id: 'skins4', name: 'Collector', desc: 'Own 4 ball skins', icon: '🎨', xp: 150, test: s => (s.skins || []).length >= 4 },
  { id: 'skinsAll', name: 'Fashionista', desc: 'Own every ball skin', icon: '👗', xp: 400, test: s => (s.skins || []).length >= 11 },
  { id: 'clubs3', name: 'Caddie', desc: 'Own 3 clubs', icon: '🏌️', xp: 150, test: s => (s.clubs || []).length >= 3 },
  { id: 'portals10', name: 'Portal Pilot', desc: 'Use 10 portals', icon: '🌀', xp: 120, test: s => (s.portals || 0) >= 10 },
  { id: 'wet', name: 'Splash Zone', desc: 'Find the water 10 times', icon: '💦', xp: 60, test: s => (s.splashes || 0) >= 10 },
  { id: 'level10', name: 'Double Digits', desc: 'Reach level 10', icon: '🔟', xp: 300, test: s => s.level >= 10 },
];
export function checkAchievements(save) {
  const got = save.badges || (save.badges = {}); const fresh = [];
  const stats = { ...save, level: levelFromXp(save.xp || 0).level };
  for (const a of ACHIEVEMENTS) { if (!got[a.id] && a.test(stats)) { got[a.id] = Date.now(); fresh.push(a); } }
  return fresh;
}
