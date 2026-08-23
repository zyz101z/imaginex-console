// GM layer: contracts, salary cap, aging/development, retirement, free agency, draft, AI GMs.
import { TEAMS } from "./data_teams.mjs";
import { makePlayer, TEMPLATE, genName, depthChart } from "./players.mjs";

export const CAP_LIMIT = 250; // $M, strict-mode ceiling (soft allows +15%)
export const ROSTER_MAX = 60;

// position decline onset (RBs age fast, QBs/OL slow, kickers forever)
const DECLINE_AGE = { QB: 31, RB: 27, WR: 29, TE: 29, OL: 31, DL: 29, LB: 29, CB: 28, S: 29, K: 36 };

// ---------------------------------------------------------------- contracts & cap
export function contractFor(rng, p, premium = 1) {
  const base = Math.max(0.8, Math.pow(Math.max(0, p.ovr - 58) / 10, 2.1) * 1.15);
  const ageMod = p.age >= 30 ? 0.75 : p.age <= 24 ? 1.1 : 1;
  const salary = Math.round(base * ageMod * premium * 10) / 10;
  const years = p.age >= 30 ? rng.int(1, 2) : rng.int(1, 4);
  return { salary, years };
}

export function rookieContract(round) {
  return { salary: Math.max(0.9, Math.round((7.5 - round * 0.95) * 10) / 10, 0.9), years: 4 };
}

export const payroll = roster => Math.round(roster.reduce((s, p) => s + (p.contract ? p.contract.salary : 0), 0) * 10) / 10;

export function capRoom(roster, deadMoney, capMode) {
  if (capMode === "none") return Infinity;
  const limit = capMode === "soft" ? CAP_LIMIT * 1.15 : CAP_LIMIT;
  return Math.round((limit - payroll(roster) - (deadMoney || 0)) * 10) / 10;
}

// ensure every player has a contract (initial build + save migration)
export function ensureContracts(rng, league) {
  for (const roster of Object.values(league)) {
    for (const p of roster) if (!p.contract) p.contract = contractFor(rng, p);
  }
}

// ---------------------------------------------------------------- offseason: aging
// Returns news items. Mutates league (ages, ovr changes, removes retirees).
function shiftAttrs(p, delta) {
  if (!p.attrs) return;
  for (const k of Object.keys(p.attrs)) {
    p.attrs[k] = Math.max(40, Math.min(99, p.attrs[k] + delta));
  }
}

export function ageAndRetire(rng, league) {
  const news = [];
  for (const [teamId, roster] of Object.entries(league)) {
    for (let i = roster.length - 1; i >= 0; i--) {
      const p = roster[i];
      p.age += 1;
      const decline = DECLINE_AGE[p.pos] || 29;
      if (p.age <= 25 && p.ovr < p.potential) {
        const jump = rng.int(0, 3);
        const before = p.ovr;
        p.ovr = Math.min(p.potential, p.ovr + jump);
        shiftAttrs(p, p.ovr - before); // attrs are what the sim plays — keep them in step
        if (p.ovr - before >= 3) news.push({ type: "dev", text: `${p.name} (${teamId} ${p.pos}) made a leap: ${before} → ${p.ovr}` });
      } else if (p.age >= decline) {
        const drop = p.age >= decline + 3 ? rng.int(2, 5) : rng.int(1, 3);
        const before = p.ovr;
        p.ovr = Math.max(50, p.ovr - drop);
        shiftAttrs(p, p.ovr - before);
      }
      const retires = p.age >= 39 ||
        (p.age >= 35 && rng.chance(0.4)) ||
        (p.age >= 33 && p.ovr < 70) ||
        (p.age >= 31 && p.ovr < 62);
      if (retires && p.pos !== "K" || (p.pos === "K" && p.age >= 42)) {
        roster.splice(i, 1);
        news.push({ type: "retire", text: `${p.name} (${teamId} ${p.pos}, ${p.age}) announced his retirement` });
        const score = hofScore(p);
        if (score >= HOF_THRESHOLD) {
          news.push({ type: "hof", text: `🏛️ ${p.name} (${p.pos}) elected to the Hall of Fame`,
            inductee: { name: p.name, pos: p.pos, lastTeamId: teamId, score: Math.round(score),
              seasons: p.career.length, totals: careerTotals(p) } });
        }
      }
    }
  }
  return news;
}

// ---------------------------------------------------------------- offseason: contracts
// Decrement years; expired players leave for the FA pool. Returns the pool (sorted best-first).
export function expireContracts(league) {
  const pool = [];
  for (const [teamId, roster] of Object.entries(league)) {
    for (let i = roster.length - 1; i >= 0; i--) {
      const p = roster[i];
      p.contract.years -= 1;
      if (p.contract.years <= 0) {
        roster.splice(i, 1);
        p.teamId = null;
        p.lastTeamId = teamId;
        p.depth = null; // old team's depth slot means nothing elsewhere
        pool.push(p);
      }
    }
  }
  pool.sort((a, b) => b.ovr - a.ovr);
  return pool;
}

// AI teams re-sign their own good expiring players before they hit the market
export function aiResign(rng, league, pool, capMode, deadMoney, userTeamId) {
  const signed = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    if (p.lastTeamId === userTeamId || !p.lastTeamId) continue;
    const roster = league[p.lastTeamId];
    const decline = DECLINE_AGE[p.pos] || 29;
    if (p.ovr >= 78 && p.age < decline + 2 && rng.chance(0.75)) {
      const c = contractFor(rng, p);
      if (capRoom(roster, deadMoney[p.lastTeamId], capMode) >= c.salary && roster.length < ROSTER_MAX) {
        p.contract = c; p.teamId = p.lastTeamId;
        roster.push(p);
        pool.splice(i, 1);
        signed.push(p);
      }
    }
  }
  return signed;
}

// one AI free-agency round: every AI team fills roster holes, then upgrades if rich
export function aiFreeAgencyRound(rng, league, pool, capMode, deadMoney, userTeamId) {
  const signings = [];
  const order = [...TEAMS].sort(() => rng.f() - 0.5);
  for (const t of order) {
    if (t.id === userTeamId) continue;
    const roster = league[t.id];
    const chart = depthChart(roster);
    let signedThisRound = 0; // cap: FA is a multi-round frenzy, not a one-day sweep
    // 1) fill position holes, worst-covered first, max 2 signings per round
    const holes = Object.entries(TEMPLATE)
      .filter(([pos, want]) => chart[pos].length < want)
      .sort((a, b) => (chart[a[0]].length / a[1]) - (chart[b[0]].length / b[1]));
    for (const [pos] of holes) {
      if (signedThisRound >= 1) break; // one hole-fill per team per round
      const idx = pool.findIndex(p => p.pos === pos);
      if (idx === -1) continue;
      const p = pool[idx];
      const c = contractFor(rng, p, 1.05);
      if (capRoom(roster, deadMoney[t.id], capMode) >= c.salary && roster.length < ROSTER_MAX) {
        pool.splice(idx, 1);
        p.contract = c; p.teamId = t.id;
        roster.push(p);
        signings.push({ team: t.id, p });
        signedThisRound += 1;
      }
    }
    // 2) upgrade weakest starter if plenty of room (counts against the cap)
    const room = capRoom(roster, deadMoney[t.id], capMode);
    if (signedThisRound < 2 && room > 12 && rng.chance(0.6) && roster.length < ROSTER_MAX) {
      let weakest = null;
      for (const [pos, list] of Object.entries(depthChart(roster))) {
        if (list[0] && (!weakest || list[0].ovr < weakest.ovr)) weakest = list[0];
      }
      if (weakest) {
        const idx = pool.findIndex(p => p.pos === weakest.pos && p.ovr > weakest.ovr + 3);
        if (idx !== -1) {
          const p = pool[idx];
          const c = contractFor(rng, p, 1.1);
          if (c.salary <= room) {
            pool.splice(idx, 1);
            p.contract = c; p.teamId = t.id;
            roster.push(p);
            signings.push({ team: t.id, p });
          }
        }
      }
    }
  }
  return signings;
}

// ---------------------------------------------------------------- draft
// 7 rounds × 32. Prospects carry a scouted range (fog); true ovr hidden until drafted.
export function genDraftClass(rng) {
  const POS_POOL = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "OL", "OL", "OL", "DL", "DL", "LB", "LB", "CB", "CB", "S", "K"];
  const prospects = [];
  for (let i = 0; i < 224; i++) {
    const round = Math.floor(i / 32) + 1;
    const mean = 76 - round * 2.4;
    const ovr = Math.max(56, Math.min(92, Math.round(mean + rng.gauss() * 4)));
    const pos = rng.pick(POS_POOL);
    const p = makePlayer(rng, { name: genName(rng), pos, age: rng.int(21, 23), ovr, teamId: null });
    p.potential = Math.min(99, ovr + rng.int(2, 15)); // rookies have upside
    const err = 2 + round + rng.int(0, 3);
    const center = ovr + rng.int(-2, 2);
    p.scoutLo = Math.max(50, center - err);
    p.scoutHi = Math.min(99, center + err);
    p.rookie = true;
    prospects.push(p);
  }
  // SLEEPERS: ~10 late-board prospects whose TRUE talent far exceeds their projection.
  // Their scouted range stays low — only scouting (or drafting them) reveals the truth.
  const late = prospects.filter(p => (p.scoutLo + p.scoutHi) / 2 < 68);
  for (let i = 0; i < 10 && late.length; i++) {
    const p = late.splice(rng.int(0, late.length - 1), 1)[0];
    p.ovr = rng.int(76, 88);                     // the real deal
    p.potential = Math.min(99, p.ovr + rng.int(5, 15));
    p.sleeper = true;                            // internal flag (never shown)
  }
  // BUSTS: ~7 high-board prospects who are projected way better than they are
  const early = prospects.filter(p => (p.scoutLo + p.scoutHi) / 2 >= 72 && !p.sleeper);
  for (let i = 0; i < 7 && early.length; i++) {
    const p = early.splice(rng.int(0, early.length - 1), 1)[0];
    p.ovr = Math.max(54, p.ovr - rng.int(9, 16)); // looks great, isn't
    p.potential = Math.min(99, p.ovr + rng.int(0, 6));
  }
  // board order: by scouted midpoint (this is what everyone THINKS the order is)
  prospects.sort((a, b) => (b.scoutLo + b.scoutHi) - (a.scoutLo + a.scoutHi));
  return prospects;
}

// draft order: reverse record (worst picks first), champion picks last
export function draftOrder(standings) {
  const winPct = id => {
    const s = standings[id];
    const g = Math.max(1, s.w + s.l + s.t);
    return (s.w + 0.5 * s.t) / g + (s.pf - s.pa) / 10000;
  };
  return TEAMS.map(t => t.id).sort((a, b) => winPct(a) - winPct(b));
}

// AI pick: best scouted midpoint with a need bonus
export function aiPick(rng, roster, prospects) {
  const chart = depthChart(roster);
  let bestIdx = 0, bestVal = -1;
  const lim = Math.min(prospects.length, 24);
  for (let i = 0; i < lim; i++) {
    const p = prospects[i];
    const mid = (p.scoutLo + p.scoutHi) / 2;
    const starters = chart[p.pos] || [];
    const needBonus = starters.length < (TEMPLATE[p.pos] || 2) ? 8 :
      (starters[0] && starters[0].ovr < 76 ? 4 : 0);
    const val = mid + needBonus + rng.f() * 3;
    if (val > bestVal) { bestVal = val; bestIdx = i; }
  }
  return bestIdx;
}

// ---------------------------------------------------------------- roster hygiene
// After FA + draft, top any remaining holes with cheap generated depth (practice-squad tier)
export function fillMinimums(rng, league) {
  for (const [teamId, roster] of Object.entries(league)) {
    const chart = depthChart(roster);
    for (const [pos, want] of Object.entries(TEMPLATE)) {
      for (let i = chart[pos].length; i < want; i++) {
        const p = makePlayer(rng, {
          name: genName(rng), pos, age: rng.int(22, 26),
          ovr: rng.int(58, 66), teamId,
        });
        p.contract = { salary: 0.9, years: 1 };
        roster.push(p);
      }
    }
  }
}

// user cuts a player mid-franchise: 30% of salary sticks as dead money this season
export function cutPlayer(league, deadMoney, teamId, playerId) {
  const roster = league[teamId];
  const idx = roster.findIndex(p => p.id === playerId);
  if (idx === -1) return null;
  const p = roster.splice(idx, 1)[0];
  deadMoney[teamId] = Math.round(((deadMoney[teamId] || 0) + p.contract.salary * 0.3) * 10) / 10;
  return p;
}

// ---------------------------------------------------------------- careers, awards, HOF
// call BEFORE ageAndRetire each offseason so retirees carry their final season
export function archiveSeasonStats(league, seasonNum) {
  for (const [teamId, roster] of Object.entries(league)) {
    for (const p of roster) {
      if (p.stats.gp > 0) p.career.push({ season: seasonNum, teamId, ...p.stats });
    }
  }
}

export function careerTotals(p) {
  const t = {};
  for (const s of p.career) {
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "number" && k !== "season") t[k] = (t[k] || 0) + v;
    }
  }
  return t;
}

export function hofScore(p) {
  const t = careerTotals(p);
  return (t.passYd || 0) / 80 + (t.passTD || 0) * 2 - (t.ints || 0) * 1.5 +
    (t.rushYd || 0) / 45 + (t.rushTD || 0) * 2.5 +
    (t.recYd || 0) / 50 + (t.recTD || 0) * 2.5 +
    (t.sacks || 0) * 3 + (t.defInts || 0) * 4 + (t.fgm || 0) * 1 + (t.gp || 0) * 0.15;
}
export const HOF_THRESHOLD = 320;

// season awards from accumulated stats (call before stats reset)
// one statline formatter for awards, All-Pro and the player card (season or career totals)
export function statLine(pos, s) {
  if (!s) return "";
  if (pos === "QB") return `${s.passYd || 0} yds, ${s.passTD || 0} TD, ${s.ints || 0} INT`;
  if (pos === "RB") return `${s.car || 0} car, ${s.rushYd || 0} yds, ${s.rushTD || 0} TD`;
  if (["WR", "TE"].includes(pos)) return `${s.rec || 0} rec, ${s.recYd || 0} yds, ${s.recTD || 0} TD`;
  if (pos === "K") return `${s.fgm || 0}/${s.fga || 0} FG`;
  return `${s.tackles || 0} tkl, ${s.sacks || 0} sacks, ${s.defInts || 0} INT`;
}
export function computeAwards(league) {
  const all = Object.values(league).flat().filter(p => p.stats.gp > 0);
  const offScore = s => s.passYd * 1 + s.passTD * 40 - s.ints * 25 +
    (s.rushYd + s.recYd) * 1.2 + (s.rushTD + s.recTD) * 40;
  const defScore = s => s.sacks * 45 + s.defInts * 55 + s.tackles * 1.5;
  const fmt = p => statLine(p.pos, p.stats);
  const top = (list, score) => list.reduce((b, p) => (!b || score(p.stats) > score(b.stats)) ? p : b, null);
  const mvp = top(all, offScore);
  const opoy = top(all.filter(p => p.pos !== "QB"), offScore);
  const dpoy = top(all.filter(p => ["DL", "LB", "CB", "S"].includes(p.pos)), defScore);
  const rookies = all.filter(p => p.rookie);
  const roy = rookies.length ? top(rookies, p2 => offScore(p2) + defScore(p2)) : null;
  const pack = p => p && { id: p.id, name: p.name, teamId: p.teamId, pos: p.pos, line: fmt(p) };
  return { mvp: pack(mvp), opoy: pack(opoy), dpoy: pack(dpoy), roy: pack(roy) };
}

// GRIDIRON ALL-PRO TEAM — the season's best at each spot (announced with the awards)
export function computeAllPro(league) {
  const all = Object.values(league).flat().filter(p => p.stats.gp > 0);
  const off = s => s.passYd + s.passTD * 40 - s.ints * 25 + (s.rushYd + s.recYd) * 1.2 + (s.rushTD + s.recTD) * 40;
  const def = s => s.sacks * 45 + s.defInts * 55 + s.tackles * 1.5;
  const kick = s => s.fgm * 30 + (s.fga ? (s.fgm / s.fga) * 200 : 0);
  const team = [];
  for (const [pos, score] of [["QB", off], ["RB", off], ["WR", off], ["TE", off],
                              ["DL", def], ["LB", def], ["CB", def], ["S", def], ["K", kick]]) {
    const best = all.filter(p => p.pos === pos)
      .reduce((b, p) => (!b || score(p.stats) > score(b.stats)) ? p : b, null);
    if (best) team.push({ id: best.id, pos, name: best.name, teamId: best.teamId,
                          line: statLine(best.pos, best.stats) });
  }
  return team;
}

// ---------------------------------------------------------------- coaches & team identity
// The head coach's scheme IS the team identity ("build a defense team / run team / pass team").
// The bonus scales with how well the roster fits the scheme — stack the right units and the
// identity amplifies them.
export const SCHEMES = {
  AIR: { name: "Air Attack", desc: "Pass-first offense. Amplifies QB/WR/pass-blocking." },
  GROUND: { name: "Ground Game", desc: "Run-first, clock control. Amplifies RB/OL." },
  DEFENSE: { name: "Defense First", desc: "Wins ugly. Amplifies the whole defense." },
  BALANCED: { name: "Balanced", desc: "No identity bonus spikes, no weaknesses." },
};

export function genCoach(rng) {
  return {
    name: "Coach " + genName(rng),
    scheme: rng.pick(Object.keys(SCHEMES)),
    quality: rng.int(1, 3), // 1-3 stars
  };
}

// fit 0..1 = how much the roster suits the scheme (relevant units vs league-average 76)
export function coachFit(coach, units) {
  const rel = coach.scheme === "AIR" ? units.offPass
    : coach.scheme === "GROUND" ? units.offRun
    : coach.scheme === "DEFENSE" ? (units.defPass + units.defRun) / 2
    : (units.offPass + units.offRun + units.defPass + units.defRun) / 4;
  return Math.max(0, Math.min(1, (rel - 72) / 12));
}

// returns additive unit modifiers; apply after teamUnits()
export function coachMods(coach, units) {
  if (!coach) return { offPass: 0, offRun: 0, defPass: 0, defRun: 0 };
  const b = coach.quality * (0.5 + coachFit(coach, units) * 0.8); // 0.5 .. 3.9
  switch (coach.scheme) {
    case "AIR": return { offPass: b, offRun: -b * 0.3, defPass: 0, defRun: 0 };
    case "GROUND": return { offPass: -b * 0.3, offRun: b, defPass: 0, defRun: 0 };
    case "DEFENSE": return { offPass: -b * 0.2, offRun: -b * 0.2, defPass: b * 0.75, defRun: b * 0.75 };
    default: return { offPass: b * 0.3, offRun: b * 0.3, defPass: b * 0.3, defRun: b * 0.3 };
  }
}

// ---------------------------------------------------------------- trades
export function playerValue(p) {
  const base = Math.pow(Math.max(0, p.ovr - 58) / 10, 2.4) * 10;
  const ageF = p.age <= 24 ? 1.3 : p.age <= 27 ? 1.1 : p.age <= 29 ? 0.9 : p.age <= 31 ? 0.65 : 0.45;
  const upside = p.age <= 25 ? (p.potential - p.ovr) * 0.8 : 0;
  const injF = p.injuredWeeks > 3 ? 0.8 : p.injuredWeeks > 0 ? 0.92 : 1; // hurt players cost less
  return Math.round((base * ageF + upside) * injF);
}
export const PICK_VALUE = { 1: 90, 2: 45, 3: 24, 4: 13, 5: 7, 6: 4, 7: 2 };
// next year's pick trades at a discount — the classic GM arbitrage (win-now teams pay it,
// rebuilders collect it)
export const FUTURE_DISCOUNT = 0.6;

function assetValue(league, picks, teamId, assets) {
  let v = 0;
  for (const pid of assets.players) {
    const p = league[teamId].find(x => x.id === pid);
    if (p) v += playerValue(p);
  }
  for (const round of assets.picks) v += PICK_VALUE[round] || 0;
  for (const round of assets.fpicks || []) v += (PICK_VALUE[round] || 0) * FUTURE_DISCOUNT;
  return v;
}

// would this roster still meet position minimums after losing these players?
export function legalAfterLoss(roster, playerIds) {
  const remaining = roster.filter(p => !playerIds.includes(p.id));
  const chart = depthChart(remaining);
  for (const [pos, want] of Object.entries(TEMPLATE)) {
    if (chart[pos].length < Math.max(1, want - 1)) return false;
  }
  return true;
}

// AI (partner) evaluates: they give `theirAssets`, receive `myAssets`.
// Returns {accept, reason, giveVal, getVal}
export function evalTrade(league, picks, myTeamId, partnerId, myAssets, theirAssets, discount = 1) {
  const getVal = assetValue(league, picks, myTeamId, myAssets);
  const giveVal = assetValue(league, picks, partnerId, theirAssets);
  if (!theirAssets.players.length && !theirAssets.picks.length) return { accept: false, reason: "Nothing offered from their side.", giveVal, getVal };
  if (!legalAfterLoss(league[partnerId], theirAssets.players)) return { accept: false, reason: "That would gut their depth chart.", giveVal, getVal };
  if (league[partnerId].length - theirAssets.players.length + myAssets.players.length > ROSTER_MAX)
    return { accept: false, reason: "No roster room on their side.", giveVal, getVal };
  const needed = giveVal * 1.1 * discount + 4; // AI skims a premium (deadline sellers discount it)
  if (getVal < needed) {
    const gap = Math.round(needed - getVal);
    return { accept: false, reason: `Not enough value — they want roughly ${gap} more points of value.`, giveVal, getVal };
  }
  return { accept: true, reason: "Deal!", giveVal, getVal };
}

// move players + picks both ways. assets = {players:[ids], picks:[rounds], fpicks:[rounds]}
// futurePicks (optional): next year's pick book — fpicks move through it and convey at rollover
export function execTrade(league, picks, aId, bId, aAssets, bAssets, futurePicks = null) {
  const moveP = (fromId, toId, ids) => {
    for (const pid of ids) {
      const idx = league[fromId].findIndex(p => p.id === pid);
      if (idx !== -1) {
        const p = league[fromId].splice(idx, 1)[0];
        p.teamId = toId;
        p.depth = null;
        league[toId].push(p);
      }
    }
  };
  const movePk = (book, fromId, toId, rounds) => {
    for (const r of rounds || []) {
      const idx = book[fromId].findIndex(k => k.round === r);
      if (idx !== -1) book[toId].push(book[fromId].splice(idx, 1)[0]);
    }
  };
  moveP(aId, bId, aAssets.players); moveP(bId, aId, bAssets.players);
  movePk(picks, aId, bId, aAssets.picks); movePk(picks, bId, aId, bAssets.picks);
  if (futurePicks) {
    movePk(futurePicks, aId, bId, aAssets.fpicks); movePk(futurePicks, bId, aId, bAssets.fpicks);
  }
}

export function freshPicks() {
  const picks = {};
  for (const t of TEAMS) picks[t.id] = [1, 2, 3, 4, 5, 6, 7].map(r => ({ round: r, from: t.id }));
  return picks;
}

// ---------------------------------------------------------------- training focus
// User assigns up to 3 players a specific ATTRIBUTE to develop ("make him a run-mauler").
// Applied each offseason: focused attr grows, overall recomputes from the attrs.
export function applyTraining(rng, league, training, coach) {
  const news = [];
  for (const t of training || []) {
    // own-team only: if he was traded/cut/retired, your staff isn't training him anymore
    const roster = t.teamId ? [league[t.teamId] || []] : Object.values(league);
    let player = null;
    for (const r of roster) {
      player = r.find(pp => pp.id === t.playerId);
      if (player) break;
    }
    if (!player || !player.attrs || player.attrs[t.attr] == null) continue;
    let gain = 1;
    if (player.age <= 24) gain += 1;                       // young players mold fastest
    if (player.potential > player.ovr) gain += 1;          // untapped ceiling
    if (coach && coach.quality >= 2) gain += 1;            // good staff develops better
    gain += rng.int(0, 1);
    const before = player.attrs[t.attr];
    player.attrs[t.attr] = Math.min(99, before + gain);
    // overall follows the attributes (they're the real ratings)
    const vals = Object.values(player.attrs);
    player.ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    news.push({ type: "train", text: `🎯 ${player.name}'s ${t.attr} improved ${before} → ${player.attrs[t.attr]} (focused training)` });
  }
  return news;
}

// ---------------------------------------------------------------- scouting
// 1st point: tighten a prospect's range. 2nd point: exact rating + ceiling read.
export function scoutProspect(p) {
  p.scouted = (p.scouted || 0) + 1;
  if (p.scouted === 1) {
    // re-center on the truth — this is how you FIND the sleepers and dodge the busts
    p.scoutLo = Math.max(50, p.ovr - 3);
    p.scoutHi = Math.min(99, p.ovr + 3);
  } else {
    p.scoutLo = p.ovr; p.scoutHi = p.ovr;
    const up = p.potential - p.ovr;
    p.ceiling = up >= 10 ? "HIGH ceiling" : up >= 5 ? "solid ceiling" : "near his ceiling";
  }
  return p;
}

// ---------------------------------------------------------------- AI trade offers
// An AI team with a need covets one of the user's good players and assembles a package.
export function genAIOffer(rng, league, picks, userTeamId, futurePicks = null, opts = {}) {
  let shuffled = [...TEAMS].filter(t => t.id !== userTeamId).sort(() => rng.f() - 0.5);
  if (opts.preferTeams && opts.preferTeams.length) {
    const pref = new Set(opts.preferTeams);
    shuffled = shuffled.filter(t => pref.has(t.id)).concat(shuffled.filter(t => !pref.has(t.id)));
  }
  for (const t of shuffled.slice(0, 10)) {
    const chart = depthChart(league[t.id]);
    for (const [pos, want] of Object.entries(TEMPLATE)) {
      const starter = chart[pos][0];
      if (!(chart[pos].length < want || (starter && starter.ovr < 75))) continue;
      const targets = league[userTeamId]
        .filter(p => p.pos === pos && p.ovr >= 76 && p.injuredWeeks === 0)
        .sort((a, b) => b.ovr - a.ovr);
      const target = targets[0];
      if (!target || !legalAfterLoss(league[userTeamId], [target.id])) continue;
      const targetVal = playerValue(target) * (opts.premium || (1.02 + rng.f() * 0.16)); // they pay a premium
      const give = { players: [], picks: [], fpicks: [] };
      let val = 0;
      const candidates = league[t.id]
        .filter(p => p.injuredWeeks === 0 && p.ovr >= 68)
        .sort((a, b) => playerValue(b) - playerValue(a));
      for (const c of candidates) {
        if (val >= targetVal || give.players.length >= 2) break;
        if (playerValue(c) <= targetVal - val + 20 &&
            legalAfterLoss(league[t.id], [...give.players, c.id])) {
          give.players.push(c.id); val += playerValue(c);
        }
      }
      for (let r = 1; r <= 7 && val < targetVal; r++) {
        if (picks[t.id].some(k => k.round === r)) { give.picks.push(r); val += PICK_VALUE[r]; }
      }
      // desperate buyers mortgage the future: sweeten with next year's premium picks
      if (futurePicks) {
        for (let r = 1; r <= 3 && val < targetVal; r++) {
          if (futurePicks[t.id].some(k => k.round === r)) {
            give.fpicks.push(r); val += PICK_VALUE[r] * FUTURE_DISCOUNT;
          }
        }
      }
      if (val < targetVal * 0.92) continue;
      return { from: t.id, wantIds: [target.id], wantName: target.name, wantPos: target.pos,
        giveIds: give.players, givePicks: give.picks, giveFPicks: give.fpicks, value: Math.round(val) };
    }
  }
  return null;
}

// ---------------------------------------------------------------- records book
export const RECORD_KEYS = [
  ["passYd", "passing yards"], ["passTD", "passing TDs"], ["rushYd", "rushing yards"],
  ["rushTD", "rushing TDs"], ["recYd", "receiving yards"], ["recTD", "receiving TDs"],
  ["sacks", "sacks"], ["defInts", "interceptions"], ["fgm", "field goals made"],
];

// call at season end BEFORE stats reset; returns news for broken records
export function updateRecords(records, league, standings, seasonNum) {
  const news = [];
  records.player = records.player || {};
  for (const [key, label] of RECORD_KEYS) {
    let best = null;
    for (const roster of Object.values(league)) {
      for (const p of roster) {
        if (p.stats[key] > (best ? best.value : 0)) {
          best = { value: p.stats[key], name: p.name, teamId: p.teamId, season: seasonNum };
        }
      }
    }
    const cur = records.player[key];
    if (best && (!cur || best.value > cur.value)) {
      records.player[key] = best;
      if (cur) news.push({ type: "record",
        text: `📜 NEW RECORD: ${best.name} — ${best.value} ${label} (old: ${cur.name}, ${cur.value})` });
    }
  }
  // team wins record
  let bw = null;
  for (const [tid, st] of Object.entries(standings)) {
    if (!bw || st.w > bw.value) bw = { value: st.w, teamId: tid, season: seasonNum };
  }
  const curW = records.teamWins;
  if (bw && (!curW || bw.value > curW.value)) {
    records.teamWins = bw;
    if (curW) news.push({ type: "record", text: `📜 NEW RECORD: ${bw.value}-win season (${bw.teamId})` });
  }
  return news;
}
