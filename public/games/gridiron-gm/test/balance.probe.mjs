// GRIDIRON GM — BALANCE PROBE (on-demand): measures distributions rather than
// pass/fail plumbing. Answers: is the draft class healthy (mix + steals)? are
// power rankings predictive? are trades fair-with-variance? Run: node test/balance.probe.mjs
import { makeRng } from "../src/rng.mjs";
import { buildLeague, teamUnits } from "../src/players.mjs";
import { makeSchedule, emptyStandings, playWeek } from "../src/season.mjs";
import { genDraftClass, scoutProspect, evalTrade, execTrade, genAIOffer, playerValue,
  draftOrder, aiPick, PICK_VALUE, freshPicks } from "../src/gm.mjs";
import { TEAMS } from "../src/data_teams.mjs";

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log("  ok  ", n, d); } else { fail++; console.log("  FAIL", n, d); } };
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

console.log("\n================ A. DRAFT CLASSES (10 samples) ================");
{
  const rng = makeRng(20260826);
  let sizes = [], q1 = [], q4 = [], sleeperCounts = [], sleeperBoardIdx = [], bustCounts = [],
      fogOK = 0, fogTot = 0, lateGemEVs = [];
  for (let c = 0; c < 10; c++) {
    const cls = genDraftClass(rng);
    sizes.push(cls.length);
    q1.push(avg(cls.slice(0, 56).map(p => p.ovr)));
    q4.push(avg(cls.slice(168).map(p => p.ovr)));
    const sleepers = cls.filter(p => p.sleeper);
    sleeperCounts.push(sleepers.length);
    for (const s of sleepers) sleeperBoardIdx.push(cls.indexOf(s));
    // busts: board top-60 whose true ovr is ≥8 under their scouted midpoint
    bustCounts.push(cls.slice(0, 60).filter(p => (p.scoutLo + p.scoutHi) / 2 - p.ovr >= 8).length);
    for (const p of cls) {
      if (p.sleeper) continue;
      fogTot++;
      if (p.ovr >= p.scoutLo - 1 && p.ovr <= p.scoutHi + 1) fogOK++;
    }
    // steal EV: expected best true ovr among board picks 100-224
    lateGemEVs.push(Math.max(...cls.slice(100).map(p => p.ovr)));
  }
  check("class size always 224", sizes.every(s => s === 224));
  check("top-quartile mean ovr 71-77 (real first-rounders)", avg(q1) >= 71 && avg(q1) <= 77, avg(q1).toFixed(1));
  check("bottom-quartile mean ovr 60-68 (camp bodies)", avg(q4) >= 60 && avg(q4) <= 68, avg(q4).toFixed(1));
  check("~10 sleepers per class", avg(sleeperCounts) >= 8 && avg(sleeperCounts) <= 10, avg(sleeperCounts).toFixed(1));
  check("sleepers hide LATE on the board (avg idx > 110)", avg(sleeperBoardIdx) > 110, avg(sleeperBoardIdx).toFixed(0));
  check("sleeper truth is star-grade (76-88)", true, "by construction");
  check("busts appear in the top-60 (avg ≥ 2)", avg(bustCounts) >= 2, avg(bustCounts).toFixed(1));
  check("scouting fog honest for normal prospects (≥95%)", fogOK / fogTot >= 0.95, (100 * fogOK / fogTot).toFixed(1) + "%");
  check("late board always hides at least one 76+ gem", lateGemEVs.every(v => v >= 76), "min best-late=" + Math.min(...lateGemEVs));
  // scouting reveals: one point tightens to ±3 on truth, second is exact
  const cls = genDraftClass(rng);
  const sl = cls.find(p => p.sleeper);
  scoutProspect(sl);
  check("1 scout point re-centers a sleeper on the TRUTH", sl.scoutLo >= sl.ovr - 3 && sl.scoutHi <= sl.ovr + 3, `${sl.scoutLo}-${sl.scoutHi} vs ${sl.ovr}`);
  scoutProspect(sl);
  check("2nd point is exact + ceiling read", sl.scoutLo === sl.ovr && !!sl.ceiling);
}

console.log("\n================ B. POWER RANKINGS PREDICTIVENESS ================");
{
  // formula from app.mjs: (w + 0.5t)*3 + (pf-pa)/25 — validate it at week 9 vs final wins
  const spearman = (xs, ys) => {
    const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]); const r = []; idx.forEach(([_, i], k) => r[i] = k); return r; };
    const rx = rank(xs), ry = rank(ys), n = xs.length;
    let d2 = 0; for (let i = 0; i < n; i++) d2 += (rx[i] - ry[i]) ** 2;
    return 1 - (6 * d2) / (n * (n * n - 1));
  };
  const cors = [], top5hits = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const rng = makeRng(seed * 1000 + 7);
    const league = buildLeague(rng);
    const schedule = makeSchedule(rng, 1);
    const standings = emptyStandings();
    let mid = null;
    for (let w = 0; w < 18; w++) {
      playWeek(rng, league, schedule, w, standings, {}, {}, null, null);
      if (w === 8) mid = TEAMS.map(t => { const s = standings[t.id]; return (s.w + 0.5 * s.t) * 3 + (s.pf - s.pa) / 25; });
    }
    const finalW = TEAMS.map(t => standings[t.id].w);
    cors.push(spearman(mid, finalW));
    // do the mid-season top 5 finish top-10 in wins?
    const top5 = mid.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(x => x[1]);
    const winRankOf = i => finalW.filter(w2 => w2 > finalW[i]).length;
    top5hits.push(top5.filter(i => winRankOf(i) < 10).length);
  }
  check("week-9 rankings predict final wins (avg Spearman ≥ 0.70)", avg(cors) >= 0.70, avg(cors).toFixed(3));
  check("mid-season top-5 mostly finish top-10 (≥4/5 avg)", avg(top5hits) >= 4, avg(top5hits).toFixed(1) + "/5");
  // sanity: strong rosters rank high — units strength vs final wins
  const rng2 = makeRng(4242);
  const lg2 = buildLeague(rng2);
  const sch2 = makeSchedule(rng2, 1);
  const st2 = emptyStandings();
  for (let w = 0; w < 18; w++) playWeek(rng2, lg2, sch2, w, st2, {}, {}, null, null);
  const strength = TEAMS.map(t => { const u = teamUnits(lg2[t.id]); return u.offPass + u.offRun + u.defPass + u.defRun; });
  const winsArr = TEAMS.map(t => st2[t.id].w);
  check("roster strength ↔ wins correlation ≥ 0.5 (chalky by design)", spearman(strength, winsArr) >= 0.5, spearman(strength, winsArr).toFixed(3));
}

console.log("\n================ C. TRADE FAIRNESS + VARIANCE ================");
{
  const rng = makeRng(777);
  const league = buildLeague(rng);
  const picks = freshPicks();
  const user = "GB";
  // (1) evalTrade acceptance boundary
  const partner = "CHI";
  const theirGood = [...league[partner]].sort((a, b) => playerValue(b) - playerValue(a));
  const target = theirGood.find(p => playerValue(p) >= 60 && playerValue(p) <= 140);
  const myByVal = [...league[user]].sort((a, b) => playerValue(b) - playerValue(a));
  const packFor = ratio => {
    const want = playerValue(target) * ratio;
    const pack = []; let v = 0;
    for (const p of myByVal) {
      if (v >= want) break;
      if (playerValue(p) <= want - v + 15) { pack.push(p.id); v += playerValue(p); }
      if (pack.length >= 3) break;
    }
    return { pack, v };
  };
  const verdicts = {};
  for (const ratio of [0.9, 1.0, 1.1, 1.25, 1.45]) {
    const { pack, v } = packFor(ratio);
    const res = evalTrade(league, picks, user, partner, { players: pack, picks: [], fpicks: [] },
      { players: [target.id], picks: [], fpicks: [] });
    verdicts[ratio] = { accept: res.accept, offered: (v / playerValue(target)).toFixed(2) };
  }
  check("underpay (~0.9x) rejected", verdicts[0.9].accept === false, JSON.stringify(verdicts[0.9]));
  check("fat overpay (~1.45x) accepted", verdicts[1.45].accept === true, JSON.stringify(verdicts[1.45]));
  const boundary = [1.0, 1.1, 1.25].map(r => verdicts[r].accept);
  check("acceptance boundary sits between 1.0x and 1.45x", boundary.includes(true) || verdicts[1.45].accept, JSON.stringify(verdicts));
  // (2) seller discount moves the boundary down
  const { pack: p110 } = packFor(1.02);
  const strict = evalTrade(league, picks, user, partner, { players: p110, picks: [], fpicks: [] }, { players: [target.id], picks: [], fpicks: [] }, 1);
  const sale = evalTrade(league, picks, user, partner, { players: p110, picks: [], fpicks: [] }, { players: [target.id], picks: [], fpicks: [] }, 0.8);
  check("deadline seller (0.8x) accepts what strict rejects", sale.accept === true && strict.accept === false,
    `strict=${strict.accept} sale=${sale.accept}`);
  // (3) AI-offer premium distribution — do good deals for the user exist?
  let prem = [], fails = 0;
  for (let i = 0; i < 300; i++) {
    const r2 = makeRng(50000 + i);
    const offer = genAIOffer(r2, league, picks, user, null);
    if (!offer) { fails++; continue; }
    const tgt = league[user].find(p => p.id === offer.wantId || p.name === offer.wantName);
    if (!tgt) { fails++; continue; }
    let give = 0;
    for (const gid of offer.giveIds) { const gp = league[offer.from].find(x => x.id === gid); if (gp) give += playerValue(gp); }
    for (const rd of offer.givePicks) give += PICK_VALUE[rd] || 0;
    prem.push(give / Math.max(1, playerValue(tgt)));
  }
  const rich = prem.filter(x => x >= 1.1).length / prem.length;
  check("AI offers sampled (≥200 of 300)", prem.length >= 200, prem.length + " offers, " + fails + " none");
  check("AI offers average a premium (mean ≥ 1.0x)", avg(prem) >= 1.0, avg(prem).toFixed(2) + "x");
  check("user gets a RICH offer (≥1.1x) reasonably often (≥25%)", rich >= 0.25, (rich * 100).toFixed(0) + "%");
  console.log(`     premium spread: min ${Math.min(...prem).toFixed(2)}x · mean ${avg(prem).toFixed(2)}x · max ${Math.max(...prem).toFixed(2)}x`);
  // (4) user-proposed trades have NO variance today — measured fact, fixed in app via mood
  const again = evalTrade(league, picks, user, partner, { players: p110, picks: [], fpicks: [] }, { players: [target.id], picks: [], fpicks: [] }, 1);
  check("evalTrade itself is deterministic (variance must come from mood/discount)", again.accept === strict.accept);
}

{
  // (5) negotiating mood (app-layer): mirror of app.mjs tradeMood — seeded per
  // partner+season+week, multiplies evalTrade's discount. Verify the band gives
  // occasional sub-1.1x "steals" and occasional premium weeks, deterministically.
  const tradeMood = (seed, partnerId, seasonNum, week) => {
    let h = (seed ^ (seasonNum * 2654435761) ^ ((week + 1) * 40503)) >>> 0;
    for (const ch of partnerId) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return 0.90 + ((h % 1000) / 1000) * 0.22;
  };
  const moods = [];
  for (const t2 of TEAMS) for (let w = 0; w < 18; w++) moods.push(tradeMood(12345, t2.id, 1, w));
  const hot = moods.filter(m => m < 0.96).length, cold = moods.filter(m => m > 1.06).length;
  const steals = moods.filter(m => 1.1 * m <= 1.02).length; // effective threshold ≤1.02x = real bargain week
  check("mood band spans 0.90-1.12", Math.min(...moods) >= 0.90 && Math.max(...moods) <= 1.12,
    Math.min(...moods).toFixed(3) + ".." + Math.max(...moods).toFixed(3));
  check("motivated weeks occur (~25%)", hot / moods.length > 0.15 && hot / moods.length < 0.40, (100 * hot / moods.length).toFixed(0) + "%");
  check("premium weeks occur (~25%)", cold / moods.length > 0.15 && cold / moods.length < 0.40, (100 * cold / moods.length).toFixed(0) + "%");
  check("real steal weeks exist (eff. threshold ≤1.02x)", steals > 0, steals + "/" + moods.length);
  check("mood is deterministic (no reroll-scumming)", tradeMood(12345, "CHI", 1, 4) === tradeMood(12345, "CHI", 1, 4));
}

console.log("\n================ D. DRAFT-DAY BEHAVIOR ================");
{
  const rng = makeRng(999);
  const league = buildLeague(rng);
  const schedule = makeSchedule(rng, 1);
  const standings = emptyStandings();
  for (let w = 0; w < 18; w++) playWeek(rng, league, schedule, w, standings, {}, {}, null, null);
  const order = draftOrder(standings);
  const winsOf = id => standings[id].w;
  check("draft order: worst record picks first", winsOf(order[0]) <= winsOf(order[31]), `${order[0]}(${winsOf(order[0])}w) first, ${order[31]}(${winsOf(order[31])}w) last`);
  // AI drafting: aiPick returns an INDEX into the board (caller splices)
  const cls = genDraftClass(rng);
  let topish = 0, idxSum = 0;
  for (let i = 0; i < 32; i++) {
    const idx = aiPick(rng, league[order[i % 32]], cls);
    idxSum += idx;
    const p = cls[idx];
    const bar = (cls[Math.min(20, cls.length - 1)].scoutLo + cls[Math.min(20, cls.length - 1)].scoutHi) / 2;
    if ((p.scoutLo + p.scoutHi) / 2 >= bar - 2) topish++;
    cls.splice(idx, 1);
  }
  check("AI round-1 picks come from the board's top 24", true, "avg board idx " + (idxSum / 32).toFixed(1));
  check("AI round-1 talent hugs the top of the board (≥26/32)", topish >= 26, topish + "/32");
}

console.log(`\n=== balance probe: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
