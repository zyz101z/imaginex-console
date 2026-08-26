// Season scaffolding: schedule, standings, playoffs. (P0: simplified 17-game schedule —
// 6 divisional + 11 cross-slate; real NFL formula fidelity is a P1 nicety.)
import { TEAMS } from "./data_teams.mjs";
import { simGame } from "./sim.mjs";
import { makeRng } from "./rng.mjs";

export function makeSchedule(rng, seasonNum = 1) {
  const weeks = Array.from({ length: 18 }, () => []); // 18 weeks, 17 games + 1 bye
  const games = [];
  // NFL-style formula: 6 divisional (home & away) + 4 vs a rotating same-conf division
  // + 4 vs a rotating cross-conf division + 3 vs the remaining same-conf divisions.
  // Division opponents: exactly twice. EVERY other opponent: at most once.
  const divsOf = conf => ["North", "East", "South", "West"]
    .map(d => TEAMS.filter(t => t.conf === conf && t.div === d).map(t => t.id));
  const NFC = divsOf("NFC"), AFC = divsOf("AFC");
  const MATCHINGS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  const sameM = MATCHINGS[seasonNum % 3];
  const extrasM = MATCHINGS[(seasonNum + 1) % 3];
  const crossShift = seasonNum % 4;

  const bipartite = (X, Y, skipFn = null) => {
    for (let k = 0; k < X.length; k++) {
      for (let m = 0; m < Y.length; m++) {
        if (skipFn && skipFn(k, m)) continue;
        games.push((k + m + seasonNum) % 2 === 0 ? [X[k], Y[m]] : [Y[m], X[k]]);
      }
    }
  };

  for (const D of [NFC, AFC]) {
    // divisional home-and-home
    for (const four of D) {
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        games.push([four[i], four[j]]); games.push([four[j], four[i]]);
      }
    }
    // 4 games vs the paired same-conference division
    for (const [i, j] of sameM) bipartite(D[i], D[j]);
    // 3 games vs the OTHER same-conference pairing (each team skips one rotating opponent)
    for (const [i, j] of extrasM) bipartite(D[i], D[j], (k, m) => m === (k + seasonNum) % 4);
  }
  // 4 cross-conference games vs a rotating AFC division
  for (let i = 0; i < 4; i++) bipartite(NFC[i], AFC[(i + crossShift) % 4]);

  // distribute into weeks: per-week matching, most-constrained team first.
  // Each team has 17 games over 18 weeks (one bye). Retry with reshuffles if stranded.
  for (let attempt = 0; attempt < 1500; attempt++) {
    for (const w of weeks) w.length = 0;
    const remaining = [...games].sort(() => rng.f() - 0.5);
    for (let w = 0; w < 18; w++) {
      const busy = new Set();
      // teams with the most remaining games get priority in this week's matching
      const load = {};
      for (const [h, a] of remaining) { load[h] = (load[h] || 0) + 1; load[a] = (load[a] || 0) + 1; }
      const weeksLeft = 18 - w;
      // forced games first: a team with as many games left as weeks left cannot take a bye
      remaining.sort((g1, g2) => {
        const f1 = (load[g1[0]] >= weeksLeft || load[g1[1]] >= weeksLeft) ? 1 : 0;
        const f2 = (load[g2[0]] >= weeksLeft || load[g2[1]] >= weeksLeft) ? 1 : 0;
        return f2 - f1 || (load[g2[0]] + load[g2[1]]) - (load[g1[0]] + load[g1[1]]);
      });
      const placedIdx = [];
      for (let i = 0; i < remaining.length; i++) {
        const [h, a] = remaining[i];
        if (busy.has(h) || busy.has(a)) continue;
        weeks[w].push({ home: h, away: a, played: false });
        busy.add(h); busy.add(a);
        placedIdx.push(i);
      }
      for (let i = placedIdx.length - 1; i >= 0; i--) remaining.splice(placedIdx[i], 1);
    }
    // repair pass: place stragglers by relocating a conflicting game to another week
    for (let i = remaining.length - 1; i >= 0; i--) {
      const [h, a] = remaining[i];
      let done = false;
      for (let w = 0; w < 18 && !done; w++) {
        const wk = weeks[w];
        const conflicts = wk.filter(g => g.home === h || g.away === h || g.home === a || g.away === a);
        if (conflicts.length === 0) { // direct fit
          wk.push({ home: h, away: a, played: false });
          done = true; break;
        }
        if (conflicts.length > 2) continue;
        // try to move every conflicting game elsewhere
        const moves = [];
        for (const c of conflicts) {
          let target = -1;
          for (let w2 = 0; w2 < 18; w2++) {
            if (w2 === w) continue;
            if (!weeks[w2].some(g => g.home === c.home || g.away === c.home || g.home === c.away || g.away === c.away)) {
              target = w2; break;
            }
          }
          if (target === -1) { moves.length = 0; break; }
          moves.push([c, target]);
        }
        if (moves.length === conflicts.length) {
          for (const [c, w2] of moves) {
            wk.splice(wk.indexOf(c), 1);
            weeks[w2].push(c);
          }
          wk.push({ home: h, away: a, played: false });
          done = true;
        }
      }
      if (done) remaining.splice(i, 1);
    }
    if (remaining.length === 0) {
      // spread division rematches by reordering WHOLE WEEKS (always stays valid:
      // each week is internally conflict-free wherever it sits in the calendar).
      const samePair = (x, y) => (x.home === y.home && x.away === y.away) || (x.home === y.away && x.away === y.home);
      const share = (A, B) => A.some(g => B.some(x => samePair(x, g)));
      const conflicts = () => {
        let c = 0;
        for (let i = 0; i < 17; i++) if (share(weeks[i], weeks[i + 1])) c++;
        return c;
      };
      let cur = conflicts();
      for (let iter = 0; iter < 600 && cur > 0; iter++) {
        const i = rng.int(0, 17), j = rng.int(0, 17);
        if (i === j) continue;
        [weeks[i], weeks[j]] = [weeks[j], weeks[i]];
        const next = conflicts();
        if (next <= cur) cur = next;
        else [weeks[i], weeks[j]] = [weeks[j], weeks[i]]; // revert
      }
      return weeks;
    }
  }
  return weeks; // best effort (tests will flag if short)
}

export function emptyStandings() {
  const s = {};
  for (const t of TEAMS) s[t.id] = { w: 0, l: 0, t: 0, pf: 0, pa: 0, divW: 0, divL: 0 };
  return s;
}

// Full pre-game snapshot of everything simGame mutates — the price of letting a
// human rewrite a game that already happened (live decisions re-sim from here).
function snapTeams(home, away) {
  const snap = new Map();
  for (const p of [...home.players, ...away.players]) {
    snap.set(p, { stats: { ...p.stats }, injuredWeeks: p.injuredWeeks, newInjury: p.newInjury });
  }
  return snap;
}
function restoreSnap(snap) {
  for (const [p, v] of snap) {
    p.stats = { ...v.stats };
    p.injuredWeeks = v.injuredWeeks;
    p.newInjury = v.newInjury;
  }
}
function applyGameToStandings(standings, game, scoreA, scoreB, sign) {
  const hs = standings[game.home], as = standings[game.away];
  hs.pf += sign * scoreA; hs.pa += sign * scoreB; as.pf += sign * scoreB; as.pa += sign * scoreA;
  const th = TEAMS.find(t => t.id === game.home), ta = TEAMS.find(t => t.id === game.away);
  const divGame = th.conf === ta.conf && th.div === ta.div;
  if (scoreA > scoreB) {
    hs.w += sign; as.l += sign;
    if (divGame) { hs.divW += sign; as.divL += sign; }
  } else {
    as.w += sign; hs.l += sign;
    if (divGame) { as.divW += sign; hs.divL += sign; }
  }
}

export function playWeek(rng, league, schedule, week, standings, strategies = {}, coaches = {}, coachModsFn = null, weatherFn = null, hooks = null) {
  const results = [];
  for (const game of schedule[week]) {
    if (game.played) continue;
    const home = { id: game.home, players: league[game.home], strategy: strategies[game.home], coach: coaches[game.home] };
    const away = { id: game.away, players: league[game.away], strategy: strategies[game.away], coach: coaches[game.away] };
    const wx = weatherFn ? weatherFn(game.home, week) : null;
    const isUsers = hooks && (game.home === hooks.teamId || game.away === hooks.teamId);
    if (isUsers) {
      hooks.captured = { rngState: rng.state(), snap: snapTeams(home, away), game, home, away, wx };
    }
    const r = simGame(rng, home, away, game.home, coachModsFn, wx, isUsers ? hooks : null);
    game.weather = wx || undefined;
    game.played = true;
    game.scoreHome = r.scoreA; game.scoreAway = r.scoreB;
    const hs = standings[game.home], as = standings[game.away];
    hs.pf += r.scoreA; hs.pa += r.scoreB; as.pf += r.scoreB; as.pa += r.scoreA;
    const th = TEAMS.find(t => t.id === game.home), ta = TEAMS.find(t => t.id === game.away);
    const divGame = th.conf === ta.conf && th.div === ta.div;
    if (r.scoreA > r.scoreB) {
      hs.w++; as.l++;
      if (divGame) { hs.divW++; as.divL++; }
    } else {
      as.w++; hs.l++;
      if (divGame) { as.divW++; hs.divL++; }
    }
    results.push({ ...game, log: r.log, box: r.box });
  }
  // heal one week of injuries
  for (const roster of Object.values(league)) {
    for (const p of roster) if (p.injuredWeeks > 0) p.injuredWeeks--;
  }
  return results;
}

// Re-run the user's game from the captured rng state with the coach's decisions
// applied. Reverts stats/injuries/standings/scores first, so the world ends up
// exactly as if the game had been played this way the first time. NOTE: playWeek's
// end-of-week heal tick already ran, so we re-apply it to these two rosters.
export function replayUserGame(hooks, standings, coachModsFn, decisions) {
  const C = hooks.captured;
  if (!C) return null;
  // 1) revert everything the first sim did
  restoreSnap(C.snap);
  applyGameToStandings(standings, C.game, C.game.scoreHome, C.game.scoreAway, -1);
  // 2) same dice, new choices
  const rng = makeRng(0);
  rng.setState(C.rngState);
  const r = simGame(rng, C.home, C.away, C.game.home, coachModsFn, C.wx,
    { teamId: hooks.teamId, decide: ctx => decisions[ctx.drive + ":" + ctx.type] || null });
  // 3) apply the new outcome + redo the weekly heal for these rosters
  C.game.scoreHome = r.scoreA; C.game.scoreAway = r.scoreB;
  applyGameToStandings(standings, C.game, r.scoreA, r.scoreB, +1);
  for (const p of [...C.home.players, ...C.away.players]) {
    if (p.injuredWeeks > 0) p.injuredWeeks--;
  }
  return r;
}

export function seeds(standings, conf) {
  const confTeams = TEAMS.filter(t => t.conf === conf);
  const byDiv = {};
  for (const t of confTeams) (byDiv[t.div] = byDiv[t.div] || []).push(t.id);
  const winPct = id => {
    const s = standings[id];
    return (s.w + 0.5 * s.t) / Math.max(1, s.w + s.l + s.t);
  };
  const cmp = (a, b) => winPct(b) - winPct(a) ||
    (standings[b].pf - standings[b].pa) - (standings[a].pf - standings[a].pa);
  const champs = Object.values(byDiv).map(ids => [...ids].sort(cmp)[0]).sort(cmp);
  const rest = confTeams.map(t => t.id).filter(id => !champs.includes(id)).sort(cmp);
  return [...champs, ...rest.slice(0, 3)]; // 7 seeds
}

export function simPlayoffs(rng, league, standings, strategies = {}, coaches = {}, coachModsFn = null) {
  const bracket = { rounds: [] };
  const play = (a, b, homeId) => {
    const r = simGame(rng,
      { id: a, players: league[a], strategy: strategies[a], coach: coaches[a] },
      { id: b, players: league[b], strategy: strategies[b], coach: coaches[b] }, homeId);
    return r.winner;
  };
  const confWinners = {};
  for (const conf of ["NFC", "AFC"]) {
    let s = seeds(standings, conf);
    // wild card: 1 bye; 2v7 3v6 4v5
    const wc = [[s[1], s[6]], [s[2], s[5]], [s[3], s[4]]].map(([h, a]) => play(h, a, h));
    bracket.rounds.push({ name: conf + " Wild Card", winners: [...wc] });
    let rem = [s[0], ...wc].sort((a, b) => s.indexOf(a) - s.indexOf(b));
    const dv = [[rem[0], rem[3]], [rem[1], rem[2]]].map(([h, a]) => play(h, a, h));
    bracket.rounds.push({ name: conf + " Divisional", winners: [...dv] });
    const cc = play(dv[0], dv[1], dv[0]);
    bracket.rounds.push({ name: conf + " Championship", winners: [cc] });
    confWinners[conf] = cc;
  }
  const champ = play(confWinners.NFC, confWinners.AFC, rng.chance(0.5) ? confWinners.NFC : confWinners.AFC);
  bracket.champion = champ;
  return bracket;
}

// steppable playoff pairings (for round-by-round play with tickers, vs one-shot simPlayoffs).
// alive=7 → wild card (top seed bye); 4 → divisional; 2 → championship. Home = better seed.
export function nextPlayoffRound(seedsArr, alive) {
  const sorted = [...alive].sort((a, b) => seedsArr.indexOf(a) - seedsArr.indexOf(b));
  if (sorted.length === 7) {
    return { bye: sorted[0], pairs: [[sorted[1], sorted[6]], [sorted[2], sorted[5]], [sorted[3], sorted[4]]] };
  }
  const pairs = [];
  for (let i = 0; i < sorted.length / 2; i++) pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
  return { bye: null, pairs };
}
