// state.js — run state, scoring, grumpy meter, workday clock. Pure data + rules (headless-safe).
export const SCORE = { PAT_AVOIDED: 500, MEETING_DECLINED: 250, SLACK_IGNORED: 100, LUNCH: 1000, FULL_SOUNG: 2000, SURVIVED: 5000, SMASH: 50, BOSS: 1500 };
export const GRUMPY = { SLACK: 5, MEETING: 15, QUICK_QUESTION: 10, LATE_MEETING: 30, PAT: 20, AWAY: 15, WRONG_BUTTON: 5, RELIEF: 5 };
export const DAY_START = 8 * 60 + 1;       // 8:01 AM
export const BOSS_TIME = 16 * 60 + 58;     // 4:58 PM
export const DAY_END = 17 * 60;            // 5:00 PM
export const GAMES_PER_DAY = 12;           // regular mini-games before the boss
export const MINUTES_PER_GAME = (BOSS_TIME - DAY_START) / GAMES_PER_DAY;
export const MAX_PATIENCE = 3;             // Full Soung Modes before Soung has HAD ENOUGH

export function fmtClock(min) {
  let h = Math.floor(min / 60), m = Math.floor(min % 60);
  const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export class RunState {
  constructor() {
    this.score = 0; this.grumpy = 0; this.patience = MAX_PATIENCE;
    this.clock = DAY_START; this.gamesPlayed = 0; this.lunchDone = false;
    this.stats = { meetingsDeclined: 0, slackIgnored: 0, patAvoided: 0, maxGrumpy: 0, fullSoung: 0, smashed: 0, lunchesSaved: 0, bestStreak: 0 };
    this.streak = 0;   // consecutive mini-game wins (bonus + banner; see WorkdayScene.startResult)
    this.log = [];
    this.pendingRage = false;   // set when grumpy hits 100; WorkdayScene consumes it
    this.over = false;
  }
  get minutesSurvived() { return Math.floor(this.clock - DAY_START); }
  get progress() { return Math.min(1, (this.clock - DAY_START) / (BOSS_TIME - DAY_START)); }
  get difficulty() { return 1 + this.progress * 0.7; }
  addScore(n, why) { this.score += n; if (why) this.log.push({ t: this.clock, why, n }); return n; }
  addGrumpy(n, why) {
    if (this.over) return;
    this.grumpy = Math.max(0, Math.min(100, this.grumpy + n));
    this.stats.maxGrumpy = Math.max(this.stats.maxGrumpy, this.grumpy);
    if (why && n > 0) this.log.push({ t: this.clock, why, g: n });
    if (this.grumpy >= 100) this.pendingRage = true;
  }
  relief() { this.addGrumpy(-GRUMPY.RELIEF); }
  // Called when Full Soung Mode fires. Returns false if Soung has had enough (game over).
  rage() {
    this.pendingRage = false;
    if (this.patience <= 0) { this.over = true; return false; }
    this.patience--; this.stats.fullSoung++; this.addScore(SCORE.FULL_SOUNG, 'FULL SOUNG MODE');
    return true;
  }
  endRage() { this.grumpy = 30; }
  advanceClock(min) { this.clock = Math.min(BOSS_TIME, this.clock + min); }
  get bossReady() { return this.clock >= BOSS_TIME - 0.001; }
  get lunchReady() { return !this.lunchDone && this.clock >= 12 * 60; }
  finishDay() { this.clock = DAY_END; this.addScore(SCORE.SURVIVED, 'SURVIVED'); }
}

// End-of-day report card. Thresholds sit under a strong (not perfect) run — a perfect bot scores ~30k.
export function grade(score) { return score >= 26000 ? ['S', 'Employee of the Month. Reluctantly.'] : score >= 19000 ? ['A', 'Exceeds expectations. Hates that.'] : score >= 13000 ? ['B', 'Meets expectations. Barely.'] : score >= 7000 ? ['C', 'Needs improvement. Agrees.'] : ['D', 'Please see HR.']; }
export const CORPORATE = ['ALIGNING STAKEHOLDERS...', 'CREATING SYNERGY...', 'CIRCLING BACK...', 'DEEP DIVING...', 'SCHEDULING A FOLLOW-UP...', 'IDENTIFYING ACTION ITEMS...', 'THIS COULD HAVE BEEN AN EMAIL.', 'LEVERAGING CORE COMPETENCIES...', 'TAKING THIS OFFLINE...', 'MOVING THE NEEDLE...', 'BOILING THE OCEAN...', 'PUTTING A PIN IN IT...', 'LOOPING IN LEGAL...', 'SYNCING ON THE SYNC...', 'REFRESHING THE DASHBOARD...', 'PARKING THAT FOR NOW...'];
// Pat's quotes. `voice` = key in audio.js VOICE_FILES (drop an mp3 there and it plays with the bubble).
export const PAT_QUOTES = {
  soung:    { text: 'Soung!', voice: 'soung' },
  there:    { text: 'There he is!', voice: 'there' },
  lunch:    { text: "Soung... what's for lunch today?", voice: 'lunch' },
  ignoring: { text: 'Soung, are you ignoring me?', voice: 'ignoring' },
  grumpy:   { text: 'Why are you so grumpy?', voice: 'grumpy' },
  quick:    { text: 'Soung, quick question.', voice: 'quick' },
  gotasec:  { text: 'Got a sec?', voice: 'gotasec' },
  five:     { text: 'This should only take five minutes.', voice: 'five' },
  idea:     { text: "I've got an idea!", voice: 'idea' },
  meeting:  { text: 'I scheduled us a meeting.', voice: 'meeting' },
  look:     { text: 'Can you take a quick look at this?', voice: 'look' },
  beforeyougo: { text: 'Hey Soung, before you go...', voice: 'beforeyougo' },
  busy:     { text: 'You look busy! Anyway...', voice: 'busy' },
  toldthem: { text: "I told them you'd handle it.", voice: 'toldthem' },
  notbusy:  { text: "You're not busy, right?", voice: 'notbusy' },
  addedyou: { text: 'I added you to the meeting.', voice: 'addedyou' },
  quickcall:{ text: 'Can you jump on a quick call?', voice: 'quickcall' },
  saidyes:  { text: 'I already told them you said yes.', voice: 'saidyes' },
  hearmeout:{ text: 'Soung, hear me out.', voice: 'hearmeout' },
  mentioned:{ text: 'I may have mentioned your name.', voice: 'mentioned' },
  holddoor: { text: 'Soung! Hold the door!', voice: 'holddoor' },
  rkt:      { text: 'Ooh, are those Rice Krispy Treats?', voice: 'rkt' },
  wherego:  { text: "Song? Where'd he go?", voice: 'wherego' },
  waitforme:{ text: 'Soung, wait for me!', voice: 'waitforme' },
  foundyou: { text: 'Found you!', voice: 'foundyou' },
  replyall: { text: 'I replied all.', voice: 'replyall' },
  bitcoin:  { text: 'Soung, have you heard of Bitcoin?', voice: 'bitcoin' },
  ow:       { text: 'Ow! Okay, okay.', voice: 'ow' },
  niceshot: { text: 'Nice shot!', voice: 'niceshot' },
  missed:   { text: 'Missed! Want a hand?', voice: 'missed' },
  peekaboo: { text: 'Peekaboo!', voice: 'peekaboo' },
  showyou:  { text: 'Want me to show you how?', voice: 'showyou' },
  soclose:  { text: 'Ooh! So close!', voice: 'soclose' },
  fanup:    { text: 'Is the fan helping? I can turn it up.', voice: 'fanup' },
  wasthatyou: { text: 'Soung?! Was that you?', voice: 'wasthatyou' },
  dontmove: { text: "Don't. Move.", voice: 'dontmove' },
  gotcha:   { text: 'Gotcha!', voice: 'gotcha' },
};
// What Pat's Slack pings say (Slack Attack + title screen + Full Soung Mode targets).
export const PAT_PINGS = ['quick question', 'got a sec?', "you're not busy, right?", 'hear me out', 'jump on a quick call?', 'I added you to the meeting', "I told them you'd handle it", 'I may have mentioned your name', 'are you ignoring me?', 'ping', 'bump', '👀', 'you there?', 'lunch?', 'I have an idea', 'this should only take 5 min', 'have you heard of Bitcoin?', 'following up on my follow-up', 'circling back', '???'];
// Soung's own (rare) lines — voice only, he doesn't get bubbles. Keys in audio.js VOICE_FILES.
export const SOUNG_VOICE = { notnow: 'soung_not_now', nobitcoin: 'soung_no_bitcoin', goaway: 'soung_go_away', no: 'soung_no', ugh: 'soung_ugh', dealwithit: 'soung_deal_with_it', eating: 'soung_eating', nottoday: 'soung_not_today', leavemealone: 'soung_leave_me_alone', seriously: 'soung_seriously' };
// Lines Pat uses when he barges in before a mini-game (weighted toward the user's favorites).
export const PAT_LINES = ['soung', 'soung', 'there', 'there', 'quick', 'gotasec', 'five', 'idea', 'meeting', 'look', 'busy', 'notbusy', 'quickcall', 'hearmeout', 'toldthem', 'mentioned'];

export const BUILD = '2026-09-02p';
export const SAVE_KEY = 'grump_best';
// Intro: the first-ever play must watch it (persisted); afterwards it's skipped and replayable from the title.
export const INTRO_KEY = 'grump_intro_seen';
export function introSeen() { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } }
export function markIntroSeen() { try { localStorage.setItem(INTRO_KEY, '1'); } catch {} }
export function loadBest() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { score: 0, survived: 0, days: 0 }; } catch { return { score: 0, survived: 0, days: 0 }; } }
export function saveBest(b) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(b)); } catch {} }
