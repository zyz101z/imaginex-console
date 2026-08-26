// GRIDIRON GM — LEAGUE PROBE (on-demand): the systems the balance probe didn't
// cover. Measures: game-level realism, full-season stat realism, injuries,
// playoff integrity, awards, and 10-season league drift through the REAL
// offseason pipeline (age/retire → contracts → FA → draft → fillMinimums).
// Run: node test/league.probe.mjs
import { makeRng } from "../src/rng.mjs";
import { buildLeague, teamUnits, emptyStats } from "../src/players.mjs";
import { makeSchedule, emptyStandings, playWeek, seeds, simPlayoffs } from "../src/season.mjs";
import { simGame, gameWeather } from "../src/sim.mjs";
import { genDraftClass, draftOrder, aiPick, rookieContract, ROSTER_MAX, CAP_LIMIT,
  ageAndRetire, expireContracts, aiResign, aiFreeAgencyRound, fillMinimums, payroll,
  archiveSeasonStats, computeAwards, computeAllPro, updateRecords, contractFor,
  ensureContracts } from "../src/gm.mjs";
import { TEAMS } from "../src/data_teams.mjs";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log("  ok  ", n, d); } else { fail++; console.log("  FAIL", n, d); } };
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

console.log("\n================ E. GAME-LEVEL REALISM (400 games) ================");
{
  const rng = makeRng(555);
  const league = buildLeague(rng);
  let homeW = 0, tot = [], margins = [], shutouts = 0, ties = 0, maxScore = 0;
  for (let g = 0; g < 400; g++) {
    const a = TEAMS[g % 32].id, b = TEAMS[(g * 7 + 11) % 32].id;
    if (a === b) continue;
    const r = simGame(rng, { id: a, players: league[a] }, { id: b, players: league[b] }, a);
    tot.push(r.scoreA + r.scoreB);
    margins.push(Math.abs(r.scoreA - r.scoreB));
    if (r.winner === a) homeW++;
    if (r.scoreA === 0 || r.scoreB === 0) shutouts++;
    if (r.scoreA === r.scoreB) ties++;
    maxScore = Math.max(maxScore, r.scoreA, r.scoreB);
  }
  const n = tot.length;
  check("avg combined score 35-55 (NFL ~43)", avg(tot) >= 35 && avg(tot) <= 55, avg(tot).toFixed(1));
  check("home team wins 50-62% (home-field edge, not a lock)", homeW / n >= 0.50 && homeW / n <= 0.62, (100 * homeW / n).toFixed(1) + "%");
  check("no ties survive (OT always resolves)", ties === 0, ties + " ties");
  check("shutouts rare (<6%)", shutouts / n < 0.06, (100 * shutouts / n).toFixed(1) + "%");
  check("avg margin of victory 8-16", avg(margins) >= 8 && avg(margins) <= 16, avg(margins).toFixed(1));
  check("one-score games happen (≥25%)", margins.filter(m => m <= 8).length / n >= 0.25,
    (100 * margins.filter(m => m <= 8).length / n).toFixed(0) + "% within 8");
  check("no cartoon scores (max ≤ 70)", maxScore <= 70, "max " + maxScore);
}

console.log("\n================ F. FULL-SEASON STAT REALISM ================");
{
  const rng = makeRng(20260826);
  const league = buildLeague(rng);
  const schedule = makeSchedule(rng, 1);
  const standings = emptyStandings();
  const wxFn = (home, week) => gameWeather(20260826, 1, week, home);
  for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, wxFn);
  // schedule shape: every team plays 17 games with one bye
  const gamesOf = {};
  for (const wk of schedule) for (const g of wk) { gamesOf[g.home] = (gamesOf[g.home] || 0) + 1; gamesOf[g.away] = (gamesOf[g.away] || 0) + 1; }
  check("every team plays exactly 17 games (1 bye)", TEAMS.every(t => gamesOf[t.id] === 17));
  const homeCounts = {};
  for (const wk of schedule) for (const g of wk) homeCounts[g.home] = (homeCounts[g.home] || 0) + 1;
  check("home games balanced (8 or 9 each)", TEAMS.every(t => homeCounts[t.id] >= 8 && homeCounts[t.id] <= 9));
  const all = Object.values(league).flat();
  const lead = k => Math.max(...all.map(p => p.stats[k]));
  check("passing leader 3400-6000 yds", lead("passYd") >= 3400 && lead("passYd") <= 6000, lead("passYd"));
  check("rushing leader 900-2400 yds", lead("rushYd") >= 900 && lead("rushYd") <= 2400, lead("rushYd"));
  check("receiving leader 900-2200 yds", lead("recYd") >= 900 && lead("recYd") <= 2200, lead("recYd"));
  check("sack leader 10-28", lead("sacks") >= 10 && lead("sacks") <= 28, lead("sacks"));
  check("nobody plays >17 games", all.every(p => p.stats.gp <= 17), "max gp " + Math.max(...all.map(p => p.stats.gp)));
  const wins = TEAMS.map(t => standings[t.id].w);
  check("win spread is real (best ≥11, worst ≤6)", Math.max(...wins) >= 11 && Math.min(...wins) <= 6,
    Math.min(...wins) + ".." + Math.max(...wins));
  check("league W-L books balance", wins.reduce((a, b) => a + b, 0) === TEAMS.map(t => standings[t.id].l).reduce((a, b) => a + b, 0));

  console.log("\n================ G. INJURIES ================");
  // count injury events across a fresh season using the newInjury flag
  const rng2 = makeRng(99);
  const lg2 = buildLeague(rng2);
  const sch2 = makeSchedule(rng2, 1);
  const st2 = emptyStandings();
  let events = 0;
  for (let w = 0; w < 18; w++) {
    for (const r of Object.values(lg2)) for (const p of r) p.newInjury = false;
    playWeek(rng2, lg2, sch2, w, st2, {}, {}, null, null);
    for (const r of Object.values(lg2)) for (const p of r) if (p.newInjury) events++;
  }
  check("injury volume sane (100-450 per season league-wide)", events >= 100 && events <= 450, events + " events");
  const stuck = Object.values(lg2).flat().filter(p => p.injuredWeeks > 9);
  check("no player ever injured longer than the 9-week max", stuck.length === 0);
  check("some players still rehabbing at season's end (multi-week injuries exist)",
    Object.values(lg2).flat().some(p => p.injuredWeeks > 0));

  console.log("\n================ H. PLAYOFF INTEGRITY ================");
  for (const conf of ["NFC", "AFC"]) {
    const s = seeds(standings, conf);
    check(`${conf}: exactly 7 seeds, all unique`, s.length === 7 && new Set(s).size === 7);
    const divs = new Set(s.slice(0, 4).map(id => TEAMS.find(t => t.id === id).div));
    check(`${conf}: seeds 1-4 are the four division champs`, divs.size === 4);
    const winPct = id => { const x = standings[id]; return x.w / Math.max(1, x.w + x.l); };
    check(`${conf}: no seeded team is worse than an unseeded one by ≥2 wins`,
      Math.min(...s.slice(4).map(winPct)) >= Math.max(...TEAMS.filter(t => t.conf === conf && !s.includes(t.id)).map(t => winPct(t.id))) - 2 / 17);
  }
  // champion quality across 12 fresh seasons
  const ranks = [];
  for (let sn = 0; sn < 12; sn++) {
    const r3 = makeRng(7000 + sn);
    const l3 = buildLeague(r3);
    const s3 = makeSchedule(r3, 1);
    const t3 = emptyStandings();
    for (let w = 0; w < 18; w++) playWeek(r3, l3, s3, w, t3, {}, {}, null, null);
    const bracket = simPlayoffs(r3, l3, t3);
    const cw = t3[bracket.champion].w;
    ranks.push(TEAMS.filter(t => t3[t.id].w > cw).length + 1);
  }
  check("champion is always a playoff-calibre team (win-rank ≤ 12)", Math.max(...ranks) <= 12, "ranks " + ranks.join(","));
  check("champion is usually elite (median win-rank ≤ 5)", [...ranks].sort((a, b) => a - b)[6] <= 5,
    "median " + [...ranks].sort((a, b) => a - b)[6]);

  console.log("\n================ I. AWARDS + ALL-PRO ================");
  const aw = computeAwards(league);
  check("all major awards have winners", !!(aw.mvp && aw.opoy && aw.dpoy), JSON.stringify({ mvp: aw.mvp?.pos, dpoy: aw.dpoy?.pos }));
  check("MVP is a QB (offense weighting holds)", aw.mvp.pos === "QB", aw.mvp.pos + " " + aw.mvp.line);
  check("OPOY is a non-QB by rule", aw.opoy.pos !== "QB", aw.opoy.pos);
  check("DPOY plays defense", ["DL", "LB", "CB", "S"].includes(aw.dpoy.pos), aw.dpoy.pos);
  if (aw.roy) {
    const royP = all.find(p => p.id === aw.roy.id);
    check("ROY is actually a rookie", !!(royP && royP.rookie), aw.roy.name);
  }
  const ap = computeAllPro(league);
  check("All-Pro fills all 9 spots with unique players", ap.length === 9 && new Set(ap.map(x => x.id)).size === 9);
  check("All-Pro spots match their positions", ap.every(x => all.find(p => p.id === x.id).pos === x.pos));
}

console.log("\n================ J. 10-SEASON LEAGUE DRIFT (full offseason pipeline) ================");
{
  const rng = makeRng(424242);
  const league = buildLeague(rng);
  ensureContracts(rng, league); // app does this on new-franchise boot
  const deadMoney = {}; for (const t of TEAMS) deadMoney[t.id] = 0;
  const records = {}; const hof = [];
  const perSeason = [];
  const USER = "GB"; // treated as AI-adjacent: probe makes no user moves
  for (let season = 1; season <= 10; season++) {
    const schedule = makeSchedule(rng, season);
    const standings = emptyStandings();
    for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, null);
    updateRecords(records, league, standings, season);
    // --- offseason, mirroring app.mjs startOffseasonPipeline → runDraftAI → finishOffseason
    archiveSeasonStats(league, season);
    for (const r of Object.values(league)) for (const p of r) { p.rookie = false; p.mstone = {}; }
    for (const t of TEAMS) deadMoney[t.id] = 0;
    const news = ageAndRetire(rng, league);
    for (const n of news) if (n.type === "hof") hof.push(n.inductee);
    const retirements = news.filter(n => n.type === "retire").length;
    const pool = expireContracts(league);
    aiResign(rng, league, pool, "strict", deadMoney, USER);
    for (const p of pool) p.asking = contractFor(rng, p, 1.05);
    for (let round = 0; round < 6; round++) aiFreeAgencyRound(rng, league, pool, "strict", deadMoney, USER);
    // draft: 7 rounds, worst-first, AI picks for everyone
    const order = draftOrder(standings);
    const cls = genDraftClass(rng);
    let drafted = 0;
    for (let round = 1; round <= 7; round++) {
      for (const teamId of order) {
        if (!cls.length || league[teamId].length >= ROSTER_MAX) continue;
        const idx = aiPick(rng, league[teamId], cls);
        const p = cls.splice(idx, 1)[0];
        p.teamId = teamId; p.contract = rookieContract(round);
        league[teamId].push(p); drafted++;
      }
    }
    fillMinimums(rng, league);
    for (const r of Object.values(league)) for (const p of r) { p.stats = emptyStats(); p.injuredWeeks = 0; }
    const all = Object.values(league).flat();
    perSeason.push({
      season, retirements, drafted,
      avgOvr: avg(all.map(p => p.ovr)), avgAge: avg(all.map(p => p.age)),
      minRoster: Math.min(...TEAMS.map(t => league[t.id].length)),
      maxRoster: Math.max(...TEAMS.map(t => league[t.id].length)),
      overCap: TEAMS.filter(t => payroll(league[t.id]) > CAP_LIMIT * 1.15).length,
      bytes: JSON.stringify({ league, records, hof }).length,
      spread: (() => { const u = TEAMS.map(t => { const x = teamUnits(league[t.id]); return x.offPass + x.offRun + x.defPass + x.defRun; }); return Math.max(...u) - Math.min(...u); })(),
    });
  }
  for (const s of perSeason) console.log(`     S${s.season}: ovr ${s.avgOvr.toFixed(1)} age ${s.avgAge.toFixed(1)} roster ${s.minRoster}-${s.maxRoster} retire ${s.retirements} draft ${s.drafted} overCap ${s.overCap} spread ${s.spread.toFixed(0)} save ${(s.bytes / 1024).toFixed(0)}KB`);
  const first = perSeason[0], last = perSeason[perSeason.length - 1];
  check("league talent stable over a decade (|Δ avg ovr| ≤ 3)", Math.abs(last.avgOvr - first.avgOvr) <= 3,
    first.avgOvr.toFixed(1) + " → " + last.avgOvr.toFixed(1));
  check("league age stable 24-28 every season", perSeason.every(s => s.avgAge >= 24 && s.avgAge <= 28),
    perSeason.map(s => s.avgAge.toFixed(1)).join(","));
  check("rosters always legal (37-60 players)", perSeason.every(s => s.minRoster >= 37 && s.maxRoster <= 60),
    "range " + Math.min(...perSeason.map(s => s.minRoster)) + ".." + Math.max(...perSeason.map(s => s.maxRoster)));
  check("no team ever blows through the soft cap ceiling", perSeason.every(s => s.overCap === 0),
    perSeason.map(s => s.overCap).join(","));
  check("retirements flow every season (5-80)", perSeason.every(s => s.retirements >= 5 && s.retirements <= 80),
    perSeason.map(s => s.retirements).join(","));
  check("draft classes get absorbed (≥150 picks made/yr)", perSeason.every(s => s.drafted >= 150),
    perSeason.map(s => s.drafted).join(","));
  check("competitive spread doesn't collapse or explode (season-10 spread 15-120)",
    last.spread >= 15 && last.spread <= 120, last.spread.toFixed(0));
  const growth = (last.bytes - first.bytes) / 9 / 1024;
  check("save growth bounded (< 120KB/season from careers+records)", growth < 120, growth.toFixed(1) + " KB/season");
  check("records book fully populated after a decade", Object.keys(records.player).length === 9 && !!records.teamWins);
  check("HOF gets inductees over a decade (1-60)", hof.length >= 1 && hof.length <= 60, hof.length + " inducted");
  check("HOF inductees carry real careers (≥4 seasons each)", hof.every(h => h.seasons >= 4),
    "min " + Math.min(...hof.map(h => h.seasons)));
}

console.log(`\n=== league probe: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
