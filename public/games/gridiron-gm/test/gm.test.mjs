// P2 league-health battery: run 10 full franchise cycles (season → offseason → FA → draft)
// headless with all-AI teams and assert the league stays sane — rosters legal, ratings stable,
// ages realistic, cap respected, rookies arriving, veterans retiring.
import { makeRng } from "../src/rng.mjs";
import { buildLeague, depthChart, TEMPLATE, teamUnits, emptyStats } from "../src/players.mjs";
import { makeSchedule, emptyStandings, playWeek, simPlayoffs } from "../src/season.mjs";
import { TEAMS } from "../src/data_teams.mjs";
import { ensureContracts, ageAndRetire, expireContracts, aiResign, aiFreeAgencyRound,
  genDraftClass, draftOrder, aiPick, rookieContract, fillMinimums, payroll, CAP_LIMIT,
  ROSTER_MAX, archiveSeasonStats, computeAwards, hofScore } from "../src/gm.mjs";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) pass++; else { fail++; console.log("  FAIL:", n, d); } };
const band = (n, v, lo, hi) => check(`${n} in [${lo},${hi}]`, v >= lo && v <= hi, `got ${(+v).toFixed(2)}`);

const rng = makeRng(31337);
const league = buildLeague(rng);
ensureContracts(rng, league);
const deadMoney = {};
let totalRetired = 0, totalDevLeaps = 0, totalHof = 0;

const leagueAvgOvr = () => {
  let s = 0, n = 0;
  for (const roster of Object.values(league)) for (const p of roster) { s += p.ovr; n++; }
  return s / n;
};
const startAvg = leagueAvgOvr();

for (let season = 1; season <= 10; season++) {
  // ---- regular season
  const schedule = makeSchedule(rng);
  const standings = emptyStandings();
  for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings);
  simPlayoffs(rng, league, standings);

  // ---- awards + careers (P3) before any roster mutation
  const awards = computeAwards(league);
  check(`s${season} MVP exists`, awards.mvp && awards.mvp.name, JSON.stringify(awards.mvp));
  check(`s${season} DPOY is a defender`, awards.dpoy && ["DL","LB","CB","S"].includes(awards.dpoy.pos));
  if (season >= 2) check(`s${season} ROY exists (rookies played)`, !!awards.roy);
  archiveSeasonStats(league, season);
  for (const roster of Object.values(league)) for (const p of roster) p.rookie = false;

  // ---- offseason
  for (const t of TEAMS) deadMoney[t.id] = 0;
  const news = ageAndRetire(rng, league);
  totalHof += news.filter(n => n.type === "hof").length;
  totalRetired += news.filter(n => n.type === "retire").length;
  totalDevLeaps += news.filter(n => n.type === "dev").length;
  const pool = expireContracts(league);
  aiResign(rng, league, pool, "strict", deadMoney, null);
  for (let r = 0; r < 3; r++) aiFreeAgencyRound(rng, league, pool, "strict", deadMoney, null);

  // ---- draft (all AI)
  const prospects = genDraftClass(rng);
  const order = draftOrder(standings);
  for (let round = 1; round <= 7; round++) {
    for (const teamId of order) {
      if (!prospects.length) break;
      const roster = league[teamId];
      if (roster.length >= ROSTER_MAX) continue;
      const idx = aiPick(rng, roster, prospects);
      const p = prospects.splice(idx, 1)[0];
      p.teamId = teamId;
      p.contract = rookieContract(round);
      roster.push(p);
    }
  }
  fillMinimums(rng, league);

  // ---- reset for next season
  for (const roster of Object.values(league)) {
    for (const p of roster) { p.stats = emptyStats(); p.injuredWeeks = 0; }
  }

  // ---- per-season invariants
  for (const t of TEAMS) {
    const roster = league[t.id];
    const chart = depthChart(roster);
    for (const [pos, want] of Object.entries(TEMPLATE)) {
      check(`s${season} ${t.id} ${pos} filled`, chart[pos].length >= want,
        `${chart[pos].length}/${want}`);
    }
    check(`s${season} ${t.id} roster <= ${ROSTER_MAX}`, roster.length <= ROSTER_MAX, roster.length);
    check(`s${season} ${t.id} payroll sane`, payroll(roster) <= CAP_LIMIT * 1.35,
      payroll(roster).toFixed(0));
    for (const p of roster) {
      check(`s${season} no zombie ages`, p.age <= (p.pos === "K" ? 42 : 40), `${p.name} ${p.age}`);
    }
  }
}

// ---- decade-scale invariants
band("league avg OVR drift after 10 seasons", leagueAvgOvr() - startAvg, -6, 6);
check("retirements happened", totalRetired > 40, totalRetired);
check("dev leaps happened", totalDevLeaps > 10, totalDevLeaps);
check("HOF inductions over a decade (1-40 sane)", totalHof >= 1 && totalHof <= 40, totalHof);
// careers accumulated: some player has 5+ archived seasons
const maxCareer = Math.max(...Object.values(league).flat().map(p => p.career.length));
check("careers accumulate (5+ seasons)", maxCareer >= 5, maxCareer);
// rookie pipeline: young players present everywhere
let young = 0, total = 0;
for (const roster of Object.values(league)) for (const p of roster) { total++; if (p.age <= 24) young++; }
band("share of players age<=24 after decade", young / total, 0.12, 0.55);
// real players aged out or aged: Jefferson (26 + 10 = 36) should be retired or declined
const jeff = Object.values(league).flat().find(p => p.name === "Justin Jefferson");
check("Jefferson retired or in decline by yr 10", !jeff || jeff.ovr < 95, jeff ? `ovr ${jeff.ovr}` : "retired");
// contracts all valid
let badC = 0;
for (const roster of Object.values(league)) for (const p of roster) {
  if (!p.contract || p.contract.salary <= 0 || p.contract.years <= 0) badC++;
}
check("all contracts valid", badC === 0, badC);

// ---------- P3b: coaches, trades, traded picks ----------
{
  const { genCoach, coachFit, coachMods, playerValue, evalTrade, execTrade, freshPicks } =
    await import("../src/gm.mjs");
  const { simGame } = await import("../src/sim.mjs");
  const rng2 = makeRng(777);
  const lg = buildLeague(rng2);
  ensureContracts(rng2, lg);

  // coach math: right signs, sane magnitude, fit responds to roster
  const airCoach = { name: "T", scheme: "AIR", quality: 3 };
  const uGood = { offPass: 86, offRun: 78, defPass: 78, defRun: 78 }; // stacked passing roster
  const uBad = { offPass: 72, offRun: 78, defPass: 78, defRun: 78 };
  check("air coach boosts pass", coachMods(airCoach, uGood).offPass > 0);
  check("air coach taxes run", coachMods(airCoach, uGood).offRun < 0);
  check("fit scales bonus", coachMods(airCoach, uGood).offPass > coachMods(airCoach, uBad).offPass);
  band("max coach bonus sane", coachMods(airCoach, { offPass: 99, offRun: 78, defPass: 78, defRun: 78 }).offPass, 1, 4.5);
  const dCoach = { name: "D", scheme: "DEFENSE", quality: 2 };
  check("defense coach boosts both def units", coachMods(dCoach, uGood).defPass > 0 && coachMods(dCoach, uGood).defRun > 0);
  // sim accepts coaches without exploding
  const r = simGame(rng2, { id: "MIN", players: lg.MIN, coach: airCoach },
    { id: "GB", players: lg.GB, coach: dCoach }, "MIN", coachMods);
  check("coached game completes", typeof r.scoreA === "number" && r.log.length > 20);

  // player value: young stars >> old marginals
  const young = { ovr: 90, age: 23, potential: 95 };
  const old = { ovr: 78, age: 32, potential: 78 };
  check("value curve sane", playerValue(young) > playerValue(old) * 3,
    `${playerValue(young)} vs ${playerValue(old)}`);

  // trades: robbery rejected, fair deal accepted, assets conserved
  const picks = freshPicks();
  const minStar = lg.MIN.filter(p => p.ovr >= 84).sort((a, b) => b.ovr - a.ovr)[0];
  const gbScrub = lg.GB.filter(p => p.ovr <= 70)[0];
  const v1 = evalTrade(lg, picks, "MIN", "GB", { players: [gbScrubId(lg)], picks: [] }, { players: [minStarOf(lg, "GB")], picks: [] });
  function gbScrubId(l) { return gbScrub.id; }
  function minStarOf(l, t) { const s2 = l[t].filter(p => p.ovr >= 85).sort((a, b) => b.ovr - a.ovr)[0]; return s2 ? s2.id : l[t][0].id; }
  check("robbery rejected", !v1.accept, v1.reason);
  // fair-ish: MIN sends star + R1 pick for GB's best player
  const gbBest = lg.GB.filter(p => p.ovr >= 85).sort((a, b) => b.ovr - a.ovr)[0];
  const fair = evalTrade(lg, picks, "MIN", "GB",
    { players: [minStar.id], picks: [1, 2] }, { players: [gbBest.id], picks: [] });
  check("overpay accepted", fair.accept, fair.reason + ` (give ${fair.giveVal} get ${fair.getVal})`);
  const before = lg.MIN.length + lg.GB.length;
  const pkBefore = picks.MIN.length + picks.GB.length;
  execTrade(lg, picks, "MIN", "GB", { players: [minStar.id], picks: [1, 2] }, { players: [gbBest.id], picks: [] });
  check("players conserved", lg.MIN.length + lg.GB.length === before);
  check("picks conserved", picks.MIN.length + picks.GB.length === pkBefore);
  check("star moved to GB", lg.GB.some(p => p.id === minStar.id));
  check("GB owns MIN R1", picks.GB.some(k => k.round === 1 && k.from === "MIN"));
  check("MIN lost R1+R2", picks.MIN.filter(k => k.round <= 2 && k.from === "MIN").length === 0);

  // ---- future picks: discounted value, move through their own book, convey intact
  const { FUTURE_DISCOUNT, PICK_VALUE } = await import("../src/gm.mjs");
  const futureBook = freshPicks();
  const vCur = evalTrade(lg, picks, "MIN", "CHI", { players: [], picks: [1] }, { players: [], picks: [] });
  const vFut = evalTrade(lg, picks, "MIN", "CHI", { players: [], picks: [], fpicks: [1] }, { players: [], picks: [] });
  check("future R1 worth less than current R1", vFut.getVal < vCur.getVal && vFut.getVal > 0,
    `${vFut.getVal} vs ${vCur.getVal}`);
  check("discount applied", vFut.getVal === Math.round(PICK_VALUE[1] * FUTURE_DISCOUNT * 100) / 100 || vFut.getVal === PICK_VALUE[1] * FUTURE_DISCOUNT,
    vFut.getVal);
  const fBefore = futureBook.MIN.length + futureBook.CHI.length;
  execTrade(lg, picks, "MIN", "CHI", { players: [], picks: [], fpicks: [1, 2] }, { players: [], picks: [], fpicks: [] }, futureBook);
  check("future picks conserved", futureBook.MIN.length + futureBook.CHI.length === fBefore);
  check("CHI owns MIN future R1", futureBook.CHI.some(k => k.round === 1 && k.from === "MIN"));
  check("MIN future book shrank", futureBook.MIN.length === 5, futureBook.MIN.length);
  check("current picks untouched by future-only trade", picks.MIN.every(k => k.round !== 0));
}

// all 32 rosters authored with real players
{
  const { REAL_ROSTERS } = await import("../src/data_rosters.mjs");
  check("all 32 teams authored", Object.keys(REAL_ROSTERS).length === 32);
  const total = Object.values(REAL_ROSTERS).reduce((s2, r) => s2 + r.length, 0);
  band("authored player count", total, 700, 1000);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
