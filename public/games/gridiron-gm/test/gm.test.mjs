// P2 league-health battery: run 10 full franchise cycles (season → offseason → FA → draft)
// headless with all-AI teams and assert the league stays sane — rosters legal, ratings stable,
// ages realistic, cap respected, rookies arriving, veterans retiring.
import { makeRng } from "../src/rng.mjs";
import { buildLeague, depthChart, TEMPLATE, teamUnits, emptyStats } from "../src/players.mjs";
import { makeSchedule, emptyStandings, playWeek, simPlayoffs } from "../src/season.mjs";
import { TEAMS } from "../src/data_teams.mjs";
import { ensureContracts, ageAndRetire, expireContracts, aiResign, aiFreeAgencyRound, faAsking, resyncDraftSlots,
  genDraftClass, draftOrder, aiPick, rookieContract, fillMinimums, payroll, CAP_LIMIT,
  ROSTER_MAX, archiveSeasonStats, computeAwards, hofScore, seedStreetFA } from "../src/gm.mjs";

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

  // ---- decade-probe integrity (aggregated so 10 seasons don't spam 60k checks)
  {
    // (a) no player on two rosters / duplicate ids anywhere in the league
    const seen = new Map(); // id -> teamId
    let dupes = 0, wrongTeamId = 0, badContract = 0, badDead = 0;
    for (const [teamId, roster] of Object.entries(league)) {
      for (const p of roster) {
        if (seen.has(p.id)) dupes++;
        seen.set(p.id, teamId);
        if (p.teamId !== teamId) wrongTeamId++;
        const c = p.contract;
        if (!c || !Number.isFinite(c.salary) || !Number.isFinite(c.years) ||
            c.salary <= 0 || c.years < 1) badContract++;
      }
    }
    for (const t of TEAMS) {
      const dm = deadMoney[t.id] || 0;
      if (!Number.isFinite(dm) || dm < 0) badDead++;
    }
    check(`s${season} no player on two rosters`, dupes === 0, `${dupes} dupes`);
    check(`s${season} teamId matches roster`, wrongTeamId === 0, `${wrongTeamId} mismatched`);
    check(`s${season} all contracts valid (salary>0, years>=1)`, badContract === 0, `${badContract} bad`);
    check(`s${season} dead money finite and non-negative`, badDead === 0, `${badDead} bad`);
    // (b) unsigned pool leftovers must not still claim a team
    check(`s${season} FA pool leftovers are teamless`,
      pool.every(p => p.teamId === null || p.teamId === undefined), pool.length + " in pool");
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

// ---- All-Pro team + shared statline (player card / awards) ----
{
  const { computeAllPro, statLine } = await import("../src/gm.mjs");
  const rng2 = makeRng(777);
  const lg = buildLeague(rng2);
  // give a few players stats so selections are meaningful
  let stamped = 0;
  for (const roster of Object.values(lg)) {
    for (const p of roster) {
      if (stamped >= 200) break;
      p.stats.gp = 10;
      if (p.pos === "QB") { p.stats.passYd = 2000 + (p.ovr * 10); p.stats.passTD = 15; }
      else if (p.pos === "RB") { p.stats.rushYd = 500 + p.ovr * 5; p.stats.car = 120; }
      else if (["WR", "TE"].includes(p.pos)) { p.stats.recYd = 400 + p.ovr * 5; p.stats.rec = 40; }
      else if (p.pos === "K") { p.stats.fgm = 20; p.stats.fga = 24; }
      else { p.stats.tackles = 40; p.stats.sacks = p.pos === "DL" ? 8 : 2; }
      stamped++;
    }
  }
  const team = computeAllPro(lg);
  check("all-pro: nine positions filled", team.length === 9, team.length);
  check("all-pro: one per position", new Set(team.map(x => x.pos)).size === 9);
  check("all-pro: entries carry id/name/team/line", team.every(x => x.id && x.name && x.teamId && x.line));
  const qb = team.find(x => x.pos === "QB");
  const bestQB = Object.values(lg).flat().filter(p => p.pos === "QB" && p.stats.gp > 0)
    .reduce((b, p) => (!b || p.stats.passYd > b.stats.passYd) ? p : b, null);
  check("all-pro: QB is the top passer", qb.id === bestQB.id);
  check("statLine: QB format", statLine("QB", { passYd: 4000, passTD: 30, ints: 9 }) === "4000 yds, 30 TD, 9 INT");
  check("statLine: career-totals tolerant of missing keys", statLine("RB", { rushYd: 900 }) === "0 car, 900 yds, 0 TD");
}

// ---------- launch street pool (season 1 opened with ZERO free agents) ----------
{
  const pool = seedStreetFA(makeRng(9));
  check("street seed: a real market (25+ players)", pool.length >= 25, `${pool.length}`);
  check("street seed: journeyman tier (ovr 60-74)", pool.every(p => p.ovr >= 60 && p.ovr <= 74));
  check("street seed: every player has a cheap 1-yr ask",
    pool.every(p => p.asking && p.asking.years === 1 && p.asking.salary >= 0.8 && p.asking.salary <= 3));
  check("street seed: covers QB and K", ["QB", "K"].every(pos => pool.some(p => p.pos === pos)));
  check("street seed: unowned + healthy", pool.every(p => p.teamId === null && p.injuredWeeks === 0));
}

// ---------- FA backup pricing + mid-draft slot resync (2026-09-01 user reports) ----------
{
  const rng = makeRng(55);
  const lg = buildLeague(makeRng(56));
  // role players (<=74) must ask affordable backup money; starters still ask starter money
  let backupAsks = 0, backupTooRich = 0, starterAsks = 0, starterSum = 0;
  for (const roster of Object.values(lg)) {
    for (const p of roster) {
      const ask = faAsking(rng, p);
      check("faAsking sane", ask.salary >= 0.8 && Number.isFinite(ask.salary) && ask.years >= 1);
      if (p.ovr >= 68 && p.ovr <= 74) { backupAsks++; if (ask.salary > 3.2) backupTooRich++; }
      if (p.ovr >= 80) { starterAsks++; starterSum += ask.salary; }
    }
  }
  check("decent backups (68-74) ask cheap (<=3.2M)", backupAsks > 50 && backupTooRich === 0,
    `${backupTooRich}/${backupAsks} over`);
  check("starters still ask starter money", starterSum / Math.max(1, starterAsks) > 5,
    (starterSum / Math.max(1, starterAsks)).toFixed(1));

  // resyncDraftSlots: after a pick trade, every unexercised slot's owner matches the book
  const picks = {};
  for (const t of ["AAA", "BBB", "CCC"]) picks[t] = [1, 2, 3].map(r => ({ round: r, from: t }));
  const slots = [];
  for (let r = 1; r <= 3; r++) for (const t of ["AAA", "BBB", "CCC"]) slots.push({ round: r, slotTeam: t, owner: t });
  // AAA trades its R2 to BBB mid-draft (idx 2 already exercised)
  picks.BBB.push(picks.AAA.splice(picks.AAA.findIndex(k => k.round === 2), 1)[0]);
  resyncDraftSlots(slots, 2, picks);
  const moved = slots.find(sl => sl.round === 2 && sl.slotTeam === "AAA");
  check("resync: traded slot re-owned", moved.owner === "BBB", moved.owner);
  check("resync: untouched slots keep owners", slots.filter(sl => sl.owner === sl.slotTeam).length === 8);
  check("resync: exercised slots untouched", slots[0].owner === "AAA" && slots[1].owner === "BBB");

  // duplicate-round picks are distinct assets: {round, from} entries move the EXACT pick
  const { execTrade, evalTrade } = await import("../src/gm.mjs");
  const lg2 = buildLeague(makeRng(77));
  const [tA, tB] = Object.keys(lg2);
  const book = { [tA]: [{ round: 2, from: tA }, { round: 2, from: "XYZ" }, { round: 5, from: tA }],
                 [tB]: [{ round: 1, from: tB }] };
  execTrade(lg2, book, tA, tB, { players: [], picks: [{ round: 2, from: "XYZ" }] }, { players: [], picks: [] });
  check("exact pick moves (via-XYZ R2, not own R2)",
    book[tB].some(k => k.round === 2 && k.from === "XYZ") &&
    book[tA].some(k => k.round === 2 && k.from === tA), JSON.stringify(book));
  // both same-round picks can move in ONE deal
  execTrade(lg2, book, tB, tA, { players: [], picks: [{ round: 2, from: "XYZ" }] },
    { players: [], picks: [{ round: 2, from: tA }] });
  check("same-round swap lands both", book[tA].some(k => k.from === "XYZ" && k.round === 2) &&
    book[tB].some(k => k.from === tA && k.round === 2));
  // evalTrade values object-form picks (duplicates each count)
  const ev = evalTrade(lg2, book, tA, tB, { players: [], picks: [] },
    { players: [], picks: [{ round: 2, from: tA }, { round: 1, from: tB }] });
  check("evalTrade counts object-form picks", ev.giveVal === 45 + 90, ev.giveVal);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
