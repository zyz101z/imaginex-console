// GRIDIRON GM — STRATEGY PROBE (on-demand): how much do roster quality and GM choices
// decide results vs. the dice? Run: node test/strategy.probe.mjs [srcDir]
// (pass an old copy of src/ to compare engines side by side)
const ROOT = process.argv[2] ? new URL("file://" + process.argv[2].replace(/\/?$/, "/")) : new URL("../src/", import.meta.url);
const { makeRng } = await import(new URL("rng.mjs", ROOT));
const { buildLeague, teamUnits, depthChart } = await import(new URL("players.mjs", ROOT));
const sim = await import(new URL("sim.mjs", ROOT));
const { simGame } = sim;
const { coachMods, genCoach } = await import(new URL("gm.mjs", ROOT));
const { makeSchedule, emptyStandings, playWeek } = await import(new URL("season.mjs", ROOT));
const { TEAMS } = await import(new URL("data_teams.mjs", ROOT));

const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };
const corr = (x, y) => { const mx = avg(x), my = avg(y); let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy); };
const comp = u => (u.offPass + u.offRun + u.defPass + u.defRun) / 4;
const clone = r => r.map(p => ({ ...p, attrs: { ...p.attrs }, stats: { ...p.stats }, injuredWeeks: 0 }));
const pct = x => (100 * x).toFixed(1) + "%";
const SEASONS = +(process.env.PROBE_SEASONS || 200);
const ONLY = process.env.PROBE_ONLY || "ABCD";

const base = buildLeague(makeRng(4242));
for (const t of TEAMS) { const d = depthChart(base[t.id]); for (const pos in d) d[pos].forEach((p, i) => p.depth = i); }
const comps = TEAMS.map(t => comp(teamUnits(base[t.id])));
const strat = (coach) => ({ passLean: coach.scheme === "AIR" ? 0.66 : coach.scheme === "GROUND" ? 0.44 : 0.55,
  aggression: 0.5, defAggression: coach.scheme === "DEFENSE" ? 0.62 : 0.5, auto: true });

console.log(`\n== A. LEAGUE SPREAD (team composite) == sd ${sd(comps).toFixed(2)}  range ${Math.min(...comps).toFixed(1)}-${Math.max(...comps).toFixed(1)}`);

if (ONLY.includes("B")) {
console.log(`\n== B. ${SEASONS} SEASONS (random coaches, AI game-plans) ==`);
{
  const xs = [], ys = [], perfect = [], sixteen = [], fifteen = [], maxW = [], bestW = [], champs = [];
  for (let s = 0; s < SEASONS; s++) {
    const rng = makeRng(9000 + s);
    const league = Object.fromEntries(TEAMS.map(t => [t.id, clone(base[t.id])]));
    const coaches = Object.fromEntries(TEAMS.map(t => [t.id, genCoach(rng)]));
    const strategies = Object.fromEntries(TEAMS.map(t => [t.id, strat(coaches[t.id])]));
    const sch = makeSchedule(rng, 1), st = emptyStandings();
    for (let w = 0; w < 18; w++) playWeek(rng, league, sch, w, st, strategies, coaches, coachMods, null);
    const wins = TEAMS.map(t => st[t.id].w);
    TEAMS.forEach((t, i) => { xs.push(comps[i]); ys.push(wins[i]); });
    perfect.push(wins.filter(w => w === 17).length); sixteen.push(wins.filter(w => w >= 16).length);
    fifteen.push(wins.filter(w => w >= 15).length); maxW.push(Math.max(...wins));
  }
  const r = corr(xs, ys);
  console.log(`talent share of wins (R²) ${(r * r).toFixed(3)}   [real NFL ≈ 0.55-0.65]`);
  console.log(`per season: best record avg ${avg(maxW).toFixed(1)} wins · 15+ win teams ${avg(fifteen).toFixed(2)} · 16+ ${avg(sixteen).toFixed(2)} · 17-0 ${avg(perfect).toFixed(3)}  (17-0 in ${perfect.filter(x => x).length}/${SEASONS} seasons)`);
  const top = comps.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
  for (const [lab, k] of [["best", 0], ["2nd", 1], ["5th", 4], ["16th", 15], ["28th", 27], ["worst", 31]]) {
    const idx = top[k][1], w = ys.filter((_, j) => j % 32 === idx);
    console.log(`  ${lab.padEnd(5)} ${TEAMS[idx].id.padEnd(4)} comp ${comps[idx].toFixed(1)}  avg ${avg(w).toFixed(1)}  range ${Math.min(...w)}-${Math.max(...w)}  10+ wins ${pct(w.filter(x => x >= 10).length / w.length)}  17-0 ${w.filter(x => x === 17).length}`);
  }
}

}
if (ONLY.includes("C")) {
console.log("\n== C. SINGLE GAME: P(stronger team wins) by composite gap ==");
{
  const buckets = {}; const rng = makeRng(31337);
  for (let i = 0; i < 32; i++) for (let j = i + 1; j < 32; j++) for (let r = 0; r < 12; r++) {
    const A = { id: TEAMS[i].id, players: clone(base[TEAMS[i].id]) };
    const B = { id: TEAMS[j].id, players: clone(base[TEAMS[j].id]) };
    const res = simGame(rng, A, B, r % 2 ? A.id : B.id, null, null, null);
    const gap = comps[i] - comps[j]; const b = Math.min(8, Math.floor(Math.abs(gap)));
    (buckets[b] ||= [0, 0]); buckets[b][1]++;
    if ((gap >= 0) === (res.winner === A.id)) buckets[b][0]++;
  }
  for (const b of Object.keys(buckets)) console.log(`  gap ${b}${b == 8 ? "+ " : "-" + (+b + 1)}: ${pct(buckets[b][0] / buckets[b][1])}  (n=${buckets[b][1]})`);
}

}
// head-to-head: team X vs every other team, home+away. Opponents use AI game-plans + a 2★ balanced coach.
const OPP_COACH = { scheme: "BALANCED", quality: 2 };
function h2h(teamId, { mutate = null, strategy = null, coach = null, reps = 140 } = {}) {
  let w = 0, g = 0; const rng = makeRng(777);
  for (const o of TEAMS) { if (o.id === teamId) continue;
    for (let r = 0; r < reps; r++) {
      const mine = clone(base[teamId]); if (mutate) mutate(mine);
      const st = typeof strategy === "function" ? strategy(o.id, r % 2 ? teamId : o.id) : (strategy || { passLean: 0.55 });
      const res = simGame(rng, { id: teamId, players: mine, strategy: st, coach },
        { id: o.id, players: clone(base[o.id]), strategy: { passLean: 0.55, auto: true }, coach: OPP_COACH }, r % 2 ? teamId : o.id, coachMods, null, null);
      if (res.winner === teamId) w++; g++; } }
  return w / g;
}
const order = comps.map((c, i) => [c, TEAMS[i].id]).sort((a, b) => b[0] - a[0]);
for (const MID of ONLY.includes("D") ? [order[15][1], order[25][1]] : []) {
  const b0 = h2h(MID);
  const row = (lab, r) => console.log("  " + lab.padEnd(44), pct(r).padStart(6), `  Δ ${((r - b0) * 17 >= 0 ? "+" : "") + ((r - b0) * 17).toFixed(2)} wins`);
  console.log(`\n== D. LEVERS for ${MID} (baseline ${pct(b0)}, ±0.2 wins noise) ==`);
  console.log("  -- +10 to ONE starter --");
  for (const pos of ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"]) {
    const p0 = depthChart(base[MID])[pos][0];
    row(`+10 ${pos}1 (${p0.name} ${p0.ovr})`, h2h(MID, { mutate: ros => { const p = ros.find(x => x.id === p0.id);
      for (const k in p.attrs) p.attrs[k] = Math.min(99, p.attrs[k] + 10); p.ovr += 10; } }));
  }
  const weakOL = depthChart(base[MID]).OL.slice(0, 5).reduce((a, b) => a.ovr < b.ovr ? a : b);
  row(`+10 weakest OL (${weakOL.name} ${weakOL.ovr})`, h2h(MID, { mutate: ros => { const p = ros.find(x => x.id === weakOL.id);
    for (const k in p.attrs) p.attrs[k] = Math.min(99, p.attrs[k] + 10); p.ovr += 10; } }));
  console.log("  -- gameplan (same lean every week vs per-opponent ideal) --");
  for (const pl of [0.3, 0.45, 0.65, 0.75]) row(`pass lean ${Math.round(pl * 100)}% every week`, h2h(MID, { strategy: { passLean: pl } }));
  if (sim.bestLean) {
    const ideal = (oppId, homeId) => { const mu = teamUnits(base[MID]), ou = teamUnits(base[oppId]);
      const om = coachMods(OPP_COACH, ou);
      const h = homeId === MID ? sim.TUNE.HOME_EDGE / 2 : 0;
      const adj = sim.passMatchupAdj ? sim.passMatchupAdj(sim.matchupEdges(depthChart(base[MID]), depthChart(base[oppId]))) : 0;
      return { passLean: sim.bestLean(mu.offPass + h + adj - ou.defPass - om.defPass, mu.offRun + h - ou.defRun - om.defRun) }; };
    row("ideal lean, re-set each week", h2h(MID, { strategy: ideal }));
  }
  console.log("  -- coaches (fit depends on roster) --");
  for (const sch of ["AIR", "GROUND", "DEFENSE", "BALANCED"]) for (const q of [1, 3])
    row(`${sch} ${q}★`, h2h(MID, { coach: { scheme: sch, quality: q }, strategy: sim.bestLean ? { passLean: 0.55 } : null }));
}

// E. DYNASTY CHECK: a GM who builds far past the league's best roster. Can they go 17-0 too easily?
if (ONLY.includes("E")) {
  console.log(`\n== E. SUPER-TEAMS (best roster + N to every starter, ${SEASONS} seasons) ==`);
  const bestId = comps.map((c, i) => [c, TEAMS[i].id]).sort((a, b) => b[0] - a[0])[0][1];
  for (const bump of [0, 3, 6]) {
    const sup = clone(base[bestId]);
    const ch = depthChart(sup), N = { QB: 1, RB: 2, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 3, S: 2, K: 1 };
    for (const pos in N) ch[pos].slice(0, N[pos]).forEach(p => { for (const k in p.attrs) p.attrs[k] = Math.min(99, p.attrs[k] + bump); p.ovr = Math.min(99, p.ovr + bump); });
    const c = comp(teamUnits(sup));
    const wins = []; let perfect = 0, champsish = 0;
    for (let s = 0; s < SEASONS; s++) {
      const rng = makeRng(5000 + s);
      const league = Object.fromEntries(TEAMS.map(t => [t.id, clone(t.id === bestId ? sup : base[t.id])]));
      const coaches = Object.fromEntries(TEAMS.map(t => [t.id, genCoach(rng)]));
      coaches[bestId] = { scheme: "BALANCED", quality: 3 };
      const strategies = Object.fromEntries(TEAMS.map(t => [t.id, strat(coaches[t.id])]));
      const sch = makeSchedule(rng, 1), st = emptyStandings();
      for (let w = 0; w < 18; w++) playWeek(rng, league, sch, w, st, strategies, coaches, coachMods, null);
      wins.push(st[bestId].w); if (st[bestId].w === 17) perfect++;
    }
    console.log(`  ${bestId} +${bump} (comp ${c.toFixed(1)}, league #2 ${[...comps].sort((a, b) => b - a)[1].toFixed(1)}): avg ${avg(wins).toFixed(1)} wins · 15+ ${pct(wins.filter(w => w >= 15).length / SEASONS)} · 16+ ${pct(wins.filter(w => w >= 16).length / SEASONS)} · 17-0 ${pct(perfect / SEASONS)}`);
  }
}
