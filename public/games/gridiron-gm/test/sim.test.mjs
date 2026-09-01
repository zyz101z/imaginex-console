// P0 stat-realism battery: sim many seasons headless, assert league-wide numbers land in
// believable bands. Chalk target (user pick): favorite (5+ ovr units) wins 72-75%.
import { makeRng } from "../src/rng.mjs";
import { buildLeague, teamUnits, emptyStats } from "../src/players.mjs";
import { simGame } from "../src/sim.mjs";
import { makeSchedule, emptyStandings, playWeek, simPlayoffs, seeds, replayUserGame } from "../src/season.mjs";
import { TEAMS } from "../src/data_teams.mjs";
import { REAL_ROSTERS } from "../src/data_rosters.mjs";

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${name} ${detail}`); }
};
const band = (name, val, lo, hi) =>
  check(`${name} in [${lo}, ${hi}]`, val >= lo && val <= hi, `got ${val.toFixed(2)}`);

// ---------- 1. Roster construction ----------
{
  const rng = makeRng(42);
  const league = buildLeague(rng);
  check("32 rosters", Object.keys(league).length === 32);
  for (const [id, roster] of Object.entries(league)) {
    const pos = p => roster.filter(x => x.pos === p).length;
    check(`${id} QB>=2`, pos("QB") >= 2);
    check(`${id} OL>=7`, pos("OL") >= 7);
    check(`${id} K>=1`, pos("K") >= 1);
  }
  // real players present and on the right teams
  const minn = league.MIN;
  check("Jefferson on MIN", minn.some(p => p.name === "Justin Jefferson" && p.real));
  check("MIN authored 2-deep (25+ real)", minn.filter(p => p.real).length >= 25);
  const gb = league.GB;
  check("Parsons on GB", gb.some(p => p.name === "Micah Parsons"));
  // authored teams should out-rate tier-5 generated teams
  const u = id => { const x = teamUnits(league[id]); return (x.offPass + x.offRun + x.defPass + x.defRun) / 4; };
  check("DET (authored tier1) > TEN (gen tier5)", u("DET") > u("TEN") + 3, `${u("DET").toFixed(1)} vs ${u("TEN").toFixed(1)}`);
}

// ---------- 2. Single-game sanity ----------
{
  const rng = makeRng(7);
  const league = buildLeague(rng);
  const r = simGame(rng, { id: "MIN", players: league.MIN }, { id: "CHI", players: league.CHI }, "MIN");
  check("game has scores", typeof r.scoreA === "number" && typeof r.scoreB === "number");
  check("no tie after OT", r.scoreA !== r.scoreB);
  check("drive log populated", r.log.length >= 20);
  check("winner declared", r.winner === "MIN" || r.winner === "CHI");
}

// ---------- 3. Scoring & chalk calibration (600 games) ----------
{
  const rng = makeRng(1234);
  const league = buildLeague(rng);
  let totPts = 0, games = 0, homeWins = 0;
  let favGames = 0, favWins = 0, bigFavGames = 0, bigFavWins = 0;
  const strength = {};
  for (const t of TEAMS) {
    const u = teamUnits(league[t.id]);
    strength[t.id] = (u.offPass + u.offRun + u.defPass + u.defRun) / 4;
  }
  for (let i = 0; i < 4000; i++) {
    const a = rng.pick(TEAMS).id;
    let b = rng.pick(TEAMS).id;
    while (b === a) b = rng.pick(TEAMS).id;
    // fresh stats each game so injuries don't accumulate over this loop
    for (const p of [...league[a], ...league[b]]) { p.injuredWeeks = 0; }
    const r = simGame(rng, { id: a, players: league[a] }, { id: b, players: league[b] }, a);
    totPts += r.scoreA + r.scoreB; games++;
    if (r.scoreA > r.scoreB) homeWins++;
    const gap = strength[a] - strength[b];
    if (Math.abs(gap) >= 3) {
      favGames++;
      if ((gap > 0) === (r.winner === a)) favWins++;
    }
    if (Math.abs(gap) >= 5) {
      bigFavGames++;
      if ((gap > 0) === (r.winner === a)) bigFavWins++;
    }
  }
  band("avg total points/game", totPts / games, 38, 52);
  band("home win rate", homeWins / games, 0.52, 0.60);
  band("favorite (3+ gap) win rate", favWins / favGames, 0.66, 0.78);
  band("CHALK: big favorite (5+ gap) win rate", bigFavWins / bigFavGames, 0.72, 0.80);
}

// ---------- 4. Full-season battery (10 seasons) ----------
{
  let leaderPassSum = 0, leaderRushSum = 0, leaderRecSum = 0, sackLeaderSum = 0;
  let champTierSum = 0, minWinsSum = 0;
  const absurd = { maxCar: 0, topYpc: 4.4, maxRush: 0, maxPass: 0, maxRec: 0, maxPassTD: 0, maxRushTD: 0, maxRecTD: 0,
    maxTotTD: 0, maxSacks: 0, maxInts: 0, ldrPassTD: 0, ldrRushTD: 0, ldrRecTD: 0 };
  const N = 10;
  for (let s = 0; s < N; s++) {
    const rng = makeRng(9000 + s);
    const league = buildLeague(rng);
    const schedule = makeSchedule(rng);
    const standings = emptyStandings();
    // weather ON, like the real app runs (import hoisted lazily to keep section order)
    const { gameWeather } = await import("../src/sim.mjs");
    const wxFn = (homeId, week) => gameWeather(9000 + s, 1, week, homeId);
    for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, wxFn);
    // every team plays 16-17 games (greedy scheduler may drop 1)
    for (const t of TEAMS) {
      const s2 = standings[t.id];
      const gp = s2.w + s2.l + s2.t;
      check(`${t.id} played 15-17`, gp >= 15 && gp <= 17, `gp=${gp}`);
    }
    // league leaders
    const all = Object.values(league).flat();
    const top = key => Math.max(...all.map(p => p.stats[key]));
    leaderPassSum += top("passYd");
    leaderRushSum += top("rushYd");
    leaderRecSum += top("recYd");
    sackLeaderSum += top("sacks");
    const topRusher = [...all].sort((a, b) => b.stats.rushYd - a.stats.rushYd)[0];
    if (topRusher.stats.car > 0) absurd.topYpc = topRusher.stats.rushYd / topRusher.stats.car;
    for (const p of all) {
      const st = p.stats;
      if (st.recYd > 0 || st.recTD > 0) check("catches imply-ed", st.rec >= Math.max(1, st.recTD), `${p.name} ${st.rec}rec/${st.recYd}yd/${st.recTD}td`);
      if (st.rushTD > 0) check("TD runs are carries", st.car >= st.rushTD, `${p.name} ${st.car}car/${st.rushTD}td`);
      absurd.maxCar = Math.max(absurd.maxCar, p.stats.car);
      absurd.maxRush = Math.max(absurd.maxRush, p.stats.rushYd);
      absurd.maxPass = Math.max(absurd.maxPass, p.stats.passYd);
      absurd.maxRec = Math.max(absurd.maxRec, p.stats.recYd);
      absurd.maxPassTD = Math.max(absurd.maxPassTD, p.stats.passTD);
      absurd.maxRushTD = Math.max(absurd.maxRushTD, p.stats.rushTD);
      absurd.maxRecTD = Math.max(absurd.maxRecTD, p.stats.recTD);
      absurd.maxTotTD = Math.max(absurd.maxTotTD, p.stats.rushTD + p.stats.recTD);
      absurd.maxSacks = Math.max(absurd.maxSacks, p.stats.sacks);
      absurd.maxInts = Math.max(absurd.maxInts, p.stats.ints);
    }
    absurd.ldrPassTD += top("passTD");
    absurd.ldrRushTD += top("rushTD");
    absurd.ldrRecTD += top("recTD");
    minWinsSum += standings.MIN.w;
    const bracket = simPlayoffs(rng, league, standings);
    check(`s${s} champion exists`, TEAMS.some(t => t.id === bracket.champion));
    const champStrengthRank = [...TEAMS].map(t => {
      const u = teamUnits(league[t.id]);
      return { id: t.id, v: (u.offPass + u.offRun + u.defPass + u.defRun) / 4 };
    }).sort((x, y) => y.v - x.v).findIndex(x => x.id === bracket.champion);
    champTierSum += champStrengthRank;
    // seeds sane
    check(`s${s} 7 NFC seeds`, seeds(standings, "NFC").length === 7);
  }
  band("avg league-leader pass yds", leaderPassSum / N, 3800, 5600);
  // ---- absurdity guards (user: "no 4000-yd RBs / 50-TD scorers") — checked vs EVERY player
  // in all 10 seasons, not just averages: nothing may exceed all-time-record-ish ceilings.
  band("MAX any-player rush yds (record ~2105)", absurd.maxRush, 0, 2400);
  band("MAX any-player carries (record 416)", absurd.maxCar, 0, 450);
  band("season YPC of top rusher believable", absurd.topYpc, 3.0, 6.5);
  band("MAX any-player pass yds (record ~5477)", absurd.maxPass, 0, 6000);
  band("MAX any-player rec yds (record ~1964)", absurd.maxRec, 0, 2200);
  band("MAX any-player pass TD (record 55)", absurd.maxPassTD, 0, 60);
  band("MAX any-player rush TD (record 28)", absurd.maxRushTD, 0, 30);
  band("MAX any-player rec TD (record 23)", absurd.maxRecTD, 0, 26);
  band("MAX any-player total TD (record 31)", absurd.maxTotTD, 0, 34);
  // mismatch mechanics can produce all-time seasons (that's what the Records Book is for);
  // 28 = legendary, 40+ = cartoon.
  band("MAX any-player sacks (record 22.5, legends allowed)", absurd.maxSacks, 0, 28);
  band("MAX any-player INTs thrown", absurd.maxInts, 0, 32);
  band("avg leader pass TD", absurd.ldrPassTD / N, 25, 55);
  band("avg leader rush TD", absurd.ldrRushTD / N, 8, 26);
  band("avg leader rec TD", absurd.ldrRecTD / N, 6, 22);
  band("avg league-leader rush yds", leaderRushSum / N, 1100, 2100);
  band("avg league-leader rec yds", leaderRecSum / N, 1100, 2000);
  band("avg sack leader", sackLeaderSum / N, 10, 26);
  // single-elim playoffs + endgame comeback logic = real champion variance (2011 Giants
  // won at 9-7). Ten champions average: top-40%-ish is the honest expectation.
  band("avg champion strength rank (playoff variance is real)", champTierSum / N, 0, 13);
  band("MIN avg wins (tier-2 team)", minWinsSum / N, 7, 13);
}

// ---------- 5. Weather engine ----------
{
  const { gameWeather, STADIUM } = await import("../src/sim.mjs");
  // domes never see weather; forecast is deterministic
  for (let w = 0; w < 18; w++) check("dome stays clear", gameWeather(123, 1, w, "MIN") === null);
  const a = JSON.stringify(gameWeather(999, 2, 14, "GB"));
  const b = JSON.stringify(gameWeather(999, 2, 14, "GB"));
  check("forecast deterministic", a === b);
  // late-season cold cities see snow/cold at a real rate; early season never snows
  let snowy = 0, early = 0;
  for (let seed = 0; seed < 300; seed++) {
    const late = gameWeather(seed, 1, 16, "BUF");
    if (late && (late.type === "snow" || late.type === "cold")) snowy++;
    const sept = gameWeather(seed, 1, 2, "BUF");
    if (sept && (sept.type === "snow" || sept.type === "cold")) early++;
  }
  band("BUF week 17 snow/cold rate", snowy / 300, 0.25, 0.75);
  check("no September snow", early === 0, early);
  // snow suppresses scoring: same matchup, clear vs snow, many games
  const rng = makeRng(4242);
  const league = buildLeague(rng);
  const snowWx = { type: "snow", pass: -3.5, run: 1.0, kick: -0.10, to: 0.015 };
  let clearPts = 0, snowPts = 0;
  for (let i = 0; i < 400; i++) {
    for (const p of [...league.GB, ...league.CHI]) p.injuredWeeks = 0;
    const rc = simGame(rng, { id: "GB", players: league.GB }, { id: "CHI", players: league.CHI }, "GB");
    const rs = simGame(rng, { id: "GB", players: league.GB }, { id: "CHI", players: league.CHI }, "GB", null, snowWx);
    clearPts += rc.scoreA + rc.scoreB;
    snowPts += rs.scoreA + rs.scoreB;
  }
  check("snow suppresses scoring", snowPts < clearPts * 0.97, `${(snowPts / 400).toFixed(1)} vs ${(clearPts / 400).toFixed(1)}`);
}

// ---------- 6. 4th-down aggression ----------
{
  const rng = makeRng(31415);
  const league = buildLeague(rng);
  let aggTD = 0, aggTO = 0, aggPunt = 0, conTD = 0, conTO = 0, conPunt = 0, downs = 0;
  for (let i = 0; i < 300; i++) {
    for (const p of [...league.GB, ...league.CHI]) p.injuredWeeks = 0;
    const ra = simGame(rng,
      { id: "GB", players: league.GB, strategy: { passLean: 0.55, aggression: 0.8 } },
      { id: "CHI", players: league.CHI, strategy: { passLean: 0.55, aggression: 0.5 } }, "GB");
    const rc = simGame(rng,
      { id: "GB", players: league.GB, strategy: { passLean: 0.55, aggression: 0.2 } },
      { id: "CHI", players: league.CHI, strategy: { passLean: 0.55, aggression: 0.5 } }, "GB");
    for (const d of ra.log) if (d.off === "GB") {
      if (d.result === "TD") aggTD++;
      if (d.result === "TO") { aggTO++; if (d.downs) downs++; }
      if (d.result === "PUNT") aggPunt++;
    }
    for (const d of rc.log) if (d.off === "GB") {
      if (d.result === "TD") conTD++;
      if (d.result === "TO") conTO++;
      if (d.result === "PUNT") conPunt++;
    }
  }
  check("riverboat scores more TDs", aggTD > conTD * 1.05, `${aggTD} vs ${conTD}`);
  check("riverboat turns it over more", aggTO > conTO * 1.1, `${aggTO} vs ${conTO}`);
  check("riverboat punts less", aggPunt < conPunt * 0.9, `${aggPunt} vs ${conPunt}`);
  check("turnover-on-downs happens", downs > 10, downs);
}

// ---------- 7. Determinism ----------
{
  const run = () => {
    const rng = makeRng(555);
    const league = buildLeague(rng);
    const r = simGame(rng, { id: "MIN", players: league.MIN }, { id: "GB", players: league.GB }, "MIN");
    return `${r.scoreA}-${r.scoreB}`;
  };
  check("same seed => same result", run() === run());
}

// ---- §7 LIVE COACH'S CALL: hooks, marks, deterministic replay ----
{
  const rng = makeRng(4242);
  const league = buildLeague(rng);
  const schedule = makeSchedule(rng, 1);
  const standings = emptyStandings();
  const userId = "MIN";
  // hunt a few weeks until the user's game produces a marked decision moment
  let hooks = null, myGame = null, week = -1;
  for (let w = 0; w < 18 && !myGame; w++) {
    hooks = { teamId: userId };
    const res = playWeek(rng, league, schedule, w, standings, {}, {}, null, null, hooks);
    const g = res.find(x => x.home === userId || x.away === userId);
    if (g && g.log.some(d => d.ask && d.ask.type === "4th")) { myGame = g; week = w; }
  }
  check("call: a marked decision moment appears within a season", !!myGame, week);
  if (myGame) {
    // decisions now come in four types; anchor the replay test on a 4TH-DOWN ask
    const askEntry = myGame.log.find(d => d.ask && d.ask.type === "4th");
    const askIdx = myGame.log.indexOf(askEntry);
    check("call: a 4th-down mark carries context", !!askEntry && askEntry.ask.drive >= 0 && askEntry.ask.diff < 0 && askEntry.ask.remaining >= 2);
    check("call: 4th-down mark is the user's offense; ice marks are defense",
      askEntry.off === userId &&
      myGame.log.every(d => !d.ask || d.ask.type === "ice" ? true : d.off === userId || !d.ask));

    // snapshot world state for integrity checks
    const stTot = (id) => { const s = standings[id]; return [s.w, s.l, s.pf, s.pa].join("/"); };
    const preMine = stTot(userId);
    const gpSum = () => league[userId].reduce((a, p) => a + p.stats.gp, 0);
    const gpBefore = gpSum();

    // replay with GO FOR IT at the marked drive
    const oldLog = myGame.log;
    const r2 = replayUserGame(hooks, standings, null, { [askEntry.ask.drive + ":4th"]: "go" });
    check("call: replay returns a game", !!r2 && Array.isArray(r2.log));
    // determinism: everything BEFORE the decision replays identically
    let prefixSame = true;
    for (let i = 0; i < askIdx; i++) {
      const a = oldLog[i], b = r2.log[i];
      if (!b || a.result !== b.result || a.points !== b.points || a.off !== b.off) prefixSame = false;
    }
    check("call: pre-decision drives replay identically", prefixSame);
    // (a follow-up ask of a DIFFERENT type — e.g. onside after the go-for-it TD —
    // may legitimately mark the same drive; only a leftover 4TH mark is a bug)
    check("call: the decided drive is no longer marked", !r2.log[askIdx] || !r2.log[askIdx].ask ||
      r2.log[askIdx].ask.type !== "4th" || r2.log[askIdx].ask.drive !== askEntry.ask.drive);
    // world integrity: standings reflect exactly one played game for the user
    const s2 = standings[userId];
    const playedCt = schedule.slice(0, week + 1).reduce((n, wk) =>
      n + wk.filter(x => x.played && (x.home === userId || x.away === userId)).length, 0);
    check("call: games conserved after replay (w+l = games played)", s2.w + s2.l === playedCt, stTot(userId) + " played " + playedCt);
    check("call: schedule score matches the replay", schedule[week].find(x => x.home === myGame.home && x.away === myGame.away).scoreHome === r2.scoreA);
    check("call: gp not double-counted", gpSum() <= gpBefore + 0, gpSum() - gpBefore);
    // replay with same (empty) decisions = byte-identical outcome
    const r3 = replayUserGame(hooks, standings, null, { [askEntry.ask.drive + ":4th"]: "go" });
    check("call: replay is deterministic", r3.scoreA === r2.scoreA && r3.scoreB === r2.scoreB && r3.log.length === r2.log.length);
  }
}

// ---- §8 all four decision types across seasons: no crash, types observed ----
{
  const typesSeen = new Set();
  for (const seed of [11, 77, 313]) {
    const rng = makeRng(seed);
    const league = buildLeague(rng);
    const schedule = makeSchedule(rng, 1);
    const standings = emptyStandings();
    const hooks = { teamId: "GB", decide: (ctx) => {
      typesSeen.add(ctx.type);
      return ctx.type === "4th" ? "go" : ctx.type === "twopt" ? "kick"
           : ctx.type === "onside" ? "onside" : "ice";
    } };
    let crashed = false;
    try {
      for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, null, hooks);
    } catch (e) { crashed = true; console.log("  sweep crash:", e.message); }
    check("calls sweep: season with live decisions survives (seed " + seed + ")", !crashed);
  }
  check("calls sweep: 4th-down moments occur", typesSeen.has("4th"), [...typesSeen].join());
  check("calls sweep: at least 3 of 4 decision types observed", typesSeen.size >= 3, [...typesSeen].join());
}

// ---- §9 BLITZ DIAL (defAggression): back-compat + directional effects ----
{
  const mk = seed => { const r = makeRng(seed); return buildLeague(r); };
  const league = mk(31337);
  const A = "GB", B = "CHI";
  // (a) back-compat: explicit 0.5 dial === no dial at all, bit for bit
  const g1 = simGame(makeRng(5), { id: A, players: league[A], strategy: { passLean: 0.55, aggression: 0.5 } },
    { id: B, players: league[B] }, A);
  const g2 = simGame(makeRng(5), { id: A, players: league[A], strategy: { passLean: 0.55, aggression: 0.5, defAggression: 0.5 } },
    { id: B, players: league[B], strategy: { passLean: 0.55, defAggression: 0.5 } }, A);
  check("blitz: 50% dial is EXACTLY legacy behavior", g1.scoreA === g2.scoreA && g1.scoreB === g2.scoreB,
    `${g1.scoreA}-${g1.scoreB} vs ${g2.scoreA}-${g2.scoreB}`);
  // (b) paired-seed A/B: blitz-happy defense forces more sacks + turnovers
  const N = 500;
  const tally = defAgg => {
    let sacks = 0, ints = 0, ptsAllowed = 0, lbSacks = 0, dlSacks = 0;
    for (let i = 0; i < N; i++) {
      const lg = mk(600 + (i % 5));
      const rng = makeRng(9000 + i);
      const defT = { id: B, players: lg[B], strategy: { passLean: 0.55, aggression: 0.5, defAggression: defAgg } };
      const offT = { id: A, players: lg[A] };
      const r = simGame(rng, offT, defT, A);
      ptsAllowed += r.scoreA;
      for (const p of lg[B]) { sacks += p.stats.sacks; ints += p.stats.defInts;
        if (p.pos === "LB") lbSacks += p.stats.sacks; if (p.pos === "DL") dlSacks += p.stats.sacks; }
    }
    return { sacks, ints, ptsAllowed, lbShare: lbSacks / Math.max(1, lbSacks + dlSacks) };
  };
  const base = tally(0.5), hot = tally(0.8), bend = tally(0.2);
  check("blitz-happy defense gets MORE sacks (≥15% up)", hot.sacks >= base.sacks * 1.15,
    `${base.sacks} → ${hot.sacks}`);
  check("blitz-happy defense forces more INTs", hot.ints > base.ints, `${base.ints} → ${hot.ints}`);
  check("blitzing has a cost: gives up more points than bend-don't-break", hot.ptsAllowed > bend.ptsAllowed,
    `hot ${(hot.ptsAllowed / N).toFixed(1)}/g vs bend ${(bend.ptsAllowed / N).toFixed(1)}/g`);
  check("blitz funnels sacks to the LBs (share up ≥8pts)", hot.lbShare >= base.lbShare + 0.08,
    `${(100 * base.lbShare).toFixed(0)}% → ${(100 * hot.lbShare).toFixed(0)}%`);
  check("bend-don't-break trades takeaways away", bend.sacks < base.sacks && bend.ints <= base.ints,
    `sacks ${base.sacks} → ${bend.sacks}`);
}

// ---------- FG range sanity (the 67-yard-attempt bug) ----------
// Every attempt distance rides scorerText ("NAME, NN-yd attempt"); none may exceed
// the best leg's ceiling (~58) + the crunch-time desperation bonus (6).
{
  const lg = buildLeague(makeRng(777));
  const A = "KC", B = "DEN";
  let maxSeen = 0, att = 0, games = 0, fgm = 0;
  for (let i = 0; i < 400; i++) {
    const g = simGame(makeRng(40000 + i), { id: A, players: lg[A] }, { id: B, players: lg[B] }, A);
    games++;
    for (const row of g.log) {
      if ((row.result === "FG" || row.result === "FG-MISS") && row.scorer) {
        const mm = /(\d+)-yd attempt/.exec(row.scorer);
        if (mm) { att++; maxSeen = Math.max(maxSeen, +mm[1]); }
        if (row.result === "FG") fgm++;
      }
    }
  }
  check("FG: attempts still happen", att > games, `${att} attempts in ${games} games`);
  check("FG: no attempt beyond a real leg (≤64)", maxSeen <= 64, `longest ${maxSeen}`);
  check("FG: long tries exist (≥50 seen)", maxSeen >= 50, `longest ${maxSeen}`);
  band("FG make rate", fgm / Math.max(1, att), 0.68, 0.92);
}

// ---------- impossible-outcome sweep (the 67-yd-FG family) ----------
// Hunt for football that cannot happen: punts from FG range, kneels that gain
// yards, negative/absurd drive yardage, tied final scores, FGM > FGA, and
// stat lines from players with 0 games played.
{
  const lg = buildLeague(makeRng(4242));
  let puntFromRange = 0, kneelGains = 0, badYards = 0, ties = 0, games = 0, scoreDrift = 0;
  for (let i = 0; i < 600; i++) {
    const ids = Object.keys(lg);
    const A = ids[i % ids.length], B = ids[(i + 7) % ids.length];
    if (A === B) continue;
    const g = simGame(makeRng(70000 + i), { id: A, players: lg[A] }, { id: B, players: lg[B] }, A);
    games++;
    if (g.scoreA === g.scoreB) ties++;
    // SCORE CONSERVATION: replaying the drive log (exactly like the app's ticker —
    // points to the offense, defPoints to the other side) must land on the final
    // score. If these ever diverge, the ticker ends on a different score than the
    // standings/box record.
    let sumA = 0, sumB = 0;
    for (const row of g.log) {
      if (row.off === A) sumA += row.points || 0; else sumB += row.points || 0;
      if (row.defPoints) { if (row.off === A) sumB += row.defPoints; else sumA += row.defPoints; }
      if (!Number.isFinite(row.yards) || row.yards < 0 || row.yards > 99) badYards++;
      if (row.result === "KNEEL" && row.yards > 0) kneelGains++;
      // punt spot must be OUTSIDE even the weakest leg's range (minSpotFG ≥ 70 floor)
      if (row.result === "PUNT" && row.start + row.yards >= 70) puntFromRange++;
    }
    if (sumA !== g.scoreA || sumB !== g.scoreB) scoreDrift++;
  }
  check("sweep: drive log always sums to the final score", scoreDrift === 0, `${scoreDrift} games drifted`);
  check("sweep: no punts from FG range", puntFromRange === 0, `${puntFromRange}`);
  check("sweep: score conservation checked on real games", games > 500, games);
  check("sweep: kneels never gain yards", kneelGains === 0, `${kneelGains}`);
  check("sweep: drive yardage always 0-99 and finite", badYards === 0, `${badYards}`);
  check("sweep: OT leaves no tied finals", ties === 0, `${ties} of ${games}`);

  // full season: counting stats imply games played; yards imply touches; FGM ≤ FGA
  const league = buildLeague(makeRng(31));
  const rng = makeRng(32);
  const schedule = makeSchedule(rng, 1);
  const standings = emptyStandings();
  for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, null);
  let ghostStats = 0, ghostYards = 0, badFG = 0, badInjury = 0;
  const COUNTING = ["passYd", "car", "rushYd", "rec", "recYd", "tackles", "sacks", "defInts", "fga"];
  for (const roster of Object.values(league)) {
    for (const p of roster) {
      const any = COUNTING.some(k => (p.stats[k] || 0) > 0);
      if (any && !(p.stats.gp > 0)) ghostStats++;
      if ((p.stats.rushYd > 0 && !(p.stats.car > 0)) || (p.stats.recYd > 0 && !(p.stats.rec > 0))) ghostYards++;
      if ((p.stats.fgm || 0) > (p.stats.fga || 0)) badFG++;
      if (p.injuredWeeks < 0) badInjury++;
    }
  }
  check("sweep: no stats without games played", ghostStats === 0, `${ghostStats} players`);
  check("sweep: yards imply carries/receptions", ghostYards === 0, `${ghostYards} players`);
  check("sweep: FGM never exceeds FGA", badFG === 0, `${badFG}`);
  check("sweep: injury weeks never negative", badInjury === 0, `${badInjury}`);
}


// ---------- situational-football + stat-realism sweep (2026-09-01 user reports) ----------
// Born from three live bug reports: (1) teams punting on their final possession
// while losing, (2) "ice the kicker" asked when nobody was kicking, (3) receivers
// with 10+ catches under 30 yards / cartoon team attempt counts. Each check locks
// a CLASS of bug: decision asks must match what the drive actually did, late-game
// choices must be football-sane, and league-wide touch rates must stay in
// real-NFL bands.
{
  const lg = buildLeague(makeRng(1212));
  const ids = Object.keys(lg);
  let losingFinalPunts = 0, games = 0;
  let badIceAsk = 0, badTwoPtAsk = 0, badOnsideAsk = 0, iceAsks = 0;
  for (let i = 0; i < 500; i++) {
    const A = ids[i % ids.length], B = ids[(i + 9) % ids.length];
    if (A === B) continue;
    // hooks with decide->null mark every ask moment without changing outcomes
    const g = simGame(makeRng(90000 + i), { id: A, players: lg[A] }, { id: B, players: lg[B] }, A,
      null, null, { teamId: B, decide: () => null });
    games++;
    // walk the log with running scores to reconstruct each drive's situation
    let sA = 0, sB = 0;
    const rows = g.log.filter(r => r.q !== 5);
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      const offScore = r.off === A ? sA : sB, defScore = r.off === A ? sB : sA;
      const remaining = 22 - j;   // drive slots left including this one
      if (r.result === "PUNT" && offScore < defScore && remaining <= 2) losingFinalPunts++;
      if (r.ask) {
        // ask/drive coherence: each ask type may only mark a drive that could honor it
        if (r.ask.type === "ice") {
          iceAsks++;
          if (r.result !== "FG" && r.result !== "FG-MISS") badIceAsk++;
          if (!(r.ask.dist >= 18 && r.ask.dist <= 70)) badIceAsk++;
        }
        if (r.ask.type === "twopt" && r.result !== "TD") badTwoPtAsk++;
        if (r.ask.type === "onside" && !(r.points > 0)) badOnsideAsk++;
      }
      if (r.off === A) sA += (r.points || 0); else sB += (r.points || 0);
      if (r.defPoints) { if (r.off === A) sB += r.defPoints; else sA += r.defPoints; }
    }
  }
  check("late: losing teams never punt their final possession", losingFinalPunts === 0, `${losingFinalPunts}`);
  check("asks: ice only fires on an actual FG attempt (w/ real distance)", badIceAsk === 0, `${badIceAsk} of ${iceAsks}`);
  check("asks: ice moments still occur", iceAsks > 5, `${iceAsks}`);
  check("asks: 2-pt only fires on a TD drive", badTwoPtAsk === 0, `${badTwoPtAsk}`);
  check("asks: onside only fires after points", badOnsideAsk === 0, `${badOnsideAsk}`);

  // league-wide touch realism over a full season (the dink-and-dunk detector)
  const league = buildLeague(makeRng(61));
  const rng = makeRng(62);
  const schedule = makeSchedule(rng, 1);
  const standings = emptyStandings();
  for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, null);
  let rec = 0, recYd = 0, car = 0, rushYd = 0, teamGames = 0, dinkLines = 0, wr1Rec = 0, wr1N = 0;
  for (const roster of Object.values(league)) {
    teamGames += 17;
    for (const p of roster) {
      rec += p.stats.rec; recYd += p.stats.recYd; car += p.stats.car; rushYd += p.stats.rushYd;
      // the reported bug shape: a season line full of catches worth nothing
      if (p.stats.rec >= 10 && p.stats.recYd < p.stats.rec * 5) dinkLines++;
      if (p.pos === "WR" && p.stats.rec > 0 && p.stats.gp >= 12) { wr1Rec = Math.max(wr1Rec, p.stats.rec); wr1N++; }
    }
  }
  band("league yards per catch", recYd / Math.max(1, rec), 8.5, 13.5);
  band("league yards per carry", rushYd / Math.max(1, car), 3.4, 5.4);
  band("team receptions per game", rec / (teamGames / 1), 12, 26);
  band("team carries per game", car / (teamGames / 1), 16, 34);
  check("no 10-catch dink lines (rec>=10 with <5 yds/catch)", dinkLines === 0, `${dinkLines} players`);
  band("league-leading WR receptions", wr1Rec, 55, 165);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
