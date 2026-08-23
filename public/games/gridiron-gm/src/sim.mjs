// Drive-based game simulation. Deterministic given rng. Tuned CHALKY (user pick, GDD §12 #4):
// target ~72-75% favorite win rate at a 5+ ovr gap (real NFL is ~65%).
import { teamUnits, depthChart, attr } from "./players.mjs";

export const TUNE = {
  DRIVES_PER_TEAM: 11,
  EDGE_SCALE: 0.0168,      // how strongly unit-rating gaps move drive outcomes (chalk dial)
  BASE_TD: 0.210,         // league-average per-drive TD prob
  BASE_FG_ATT: 0.21,      // per-drive FG attempt prob
  BASE_TO: 0.115,         // per-drive turnover prob
  HOME_EDGE: 3.0,         // rating-point equivalent of home field
  MOMENTUM_MAX: 2.2,      // max rating-point swing from momentum
  INJURY_PER_GAME: 0.038, // per-player appearance injury chance (durability-modified)
  CLUTCH_Q4_VAR: 0.35,    // extra variance in one-score 4th quarters
  FIELD_POS_SCALE: 0.004, // TD-prob shift per yard of field position off the 25
  MATCHUP_CAP: 2.6,       // max rating-point swing from an individual matchup edge
  SAFETY_BASE: 0.055,     // safety chance when pinned inside the 8
};

// ---------------------------------------------------------------- weather & stadiums
// Domes never see weather. Cold-city teams live in it late season — and are built for it
// (small home run-game bonus in snow/freeze). Everyone else is warm/mild outdoor.
export const STADIUM = {
  dome: ["ARI", "ATL", "DAL", "DET", "HOU", "IND", "LV", "LAR", "LAC", "MIN", "NO"],
  cold: ["BUF", "GB", "CHI", "CLE", "DEN", "NE", "NYG", "NYJ", "PIT", "KC", "BAL", "CIN", "PHI", "WAS"],
};

// per-weather unit/kicking shifts (symmetric: both offenses suffer; run suffers least)
export const WEATHER_FX = {
  snow: { icon: "❄️", desc: "Snow", pass: -3.5, run: 1.0, kick: -0.10, to: 0.015 },
  cold: { icon: "🥶", desc: "Freezing", pass: -1.5, run: 0, kick: -0.04, to: 0 },
  rain: { icon: "🌧️", desc: "Rain", pass: -2.0, run: 0, kick: -0.05, to: 0.010 },
  wind: { icon: "💨", desc: "High winds", pass: -1.5, run: 0, kick: -0.09, to: 0 },
};

// deterministic per (seed, season, week, home): the forecast you see IS the game you get
export function gameWeather(seed, seasonNum, week, homeId) {
  if (STADIUM.dome.includes(homeId)) return null;
  let h = (seed ^ (seasonNum * 2654435761) ^ ((week + 1) * 40503)) >>> 0;
  for (const c of homeId) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  const r1 = (h % 1000) / 1000;
  const r2 = ((h >>> 10) % 1000) / 1000;
  const late = Math.max(0, Math.min(1, (week - 8) / 8)); // Nov→Jan ramp
  if (STADIUM.cold.includes(homeId) && late > 0) {
    if (r1 < 0.08 + 0.18 * late) return { type: "snow", ...WEATHER_FX.snow };
    if (r1 < 0.20 + 0.32 * late) return { type: "cold", ...WEATHER_FX.cold };
  }
  if (r2 < 0.10) return { type: "rain", ...WEATHER_FX.rain };
  if (r2 < 0.17) return { type: "wind", ...WEATHER_FX.wind };
  return null;
}

// individual matchups: a burner WR vs a slow CB, or an elite edge vs a turnstile tackle,
// creates a capped-but-real per-game edge — and the mismatch winner eats in the box score.
export function matchupEdges(offChart, defChart) {
  const wr1 = offChart.WR[0], cb1 = defChart.CB[0];
  const wrEdge = wr1 && cb1
    ? Math.max(-15, Math.min(15, (0.55 * attr(wr1, "speed") + 0.45 * attr(wr1, "route")) - attr(cb1, "coverage")))
    : 0;
  const protectors = offChart.OL.slice(0, 5).filter(p => p.injuredWeeks === 0);
  const weakOL = protectors.length ? protectors.reduce((w, p) => attr(p, "passBlock") < attr(w, "passBlock") ? p : w) : null;
  const rushers = defChart.DL.slice(0, 4).filter(p => p.injuredWeeks === 0);
  const topRusher = rushers.length ? rushers.reduce((b, p) => attr(p, "passRush") > attr(b, "passRush") ? p : b) : null;
  const rushEdge = topRusher && weakOL
    ? Math.max(-15, Math.min(15, attr(topRusher, "passRush") - attr(weakOL, "passBlock")))
    : 0;
  return { wrEdge, rushEdge, wr1, cb1, topRusher, weakOL };
}

function drivePlan(rng, offUnits, defUnits, passLean) {
  // Returns probabilities for this drive given matchup edges and gameplan
  const passEdge = offUnits.offPass - defUnits.defPass;
  const runEdge = offUnits.offRun - defUnits.defRun;
  const blendedEdge = passLean * passEdge + (1 - passLean) * runEdge;
  const e = blendedEdge * TUNE.EDGE_SCALE;
  let td = TUNE.BASE_TD + e * 0.55;
  let fgAtt = TUNE.BASE_FG_ATT + e * 0.15;
  let to = TUNE.BASE_TO - e * 0.30;
  td = Math.max(0.06, Math.min(0.50, td));
  fgAtt = Math.max(0.10, Math.min(0.30, fgAtt));
  to = Math.max(0.04, Math.min(0.24, to));
  return { td, fgAtt, to, passEdge, runEdge };
}

function attributeDrive(rng, off, result, yards, chart, mu) {
  // Split drive yardage into pass/run and credit players.
  // 0.93 factor: drives include penalty yards/incompletions that don't credit anyone.
  const statYards = Math.round(yards * 0.93);
  const passShare = 0.56 + rng.f() * 0.2;
  const passYd = Math.round(statYards * passShare);
  const runYd = statYards - passYd;
  const qb = chart.QB[0]; const rbs = chart.RB; const wrs = chart.WR; const tes = chart.TE;
  if (qb) { qb.stats.passYd += passYd; }
  // receivers
  let remaining = passYd;
  const targets = [...wrs.slice(0, 3), ...tes.slice(0, 1)].filter(p => p && p.injuredWeeks === 0);
  for (let i = 0; i < targets.length && remaining > 0; i++) {
    // a mismatch WR1 sees more targets (edge 12 → ~+20% share), capped by the pie itself
    const mismatchBoost = (i === 0 && mu && mu.wrEdge > 4) ? 1 + Math.min(0.15, mu.wrEdge * 0.010) : 1;
    const share = i === targets.length - 1 ? remaining
      : Math.round(remaining * (0.42 - i * 0.07) * mismatchBoost * (0.7 + rng.f() * 0.6));
    const got = Math.max(0, Math.min(remaining, share));
    targets[i].stats.recYd += got;
    targets[i].stats.rec += Math.max(got > 0 ? 1 : 0, Math.round(got / 11)); // yards imply a catch
    remaining -= got;
  }
  // rushers — mobile QBs take a scramble share first (Lamar runs; Goff does not)
  const rb1 = rbs[0], rb2 = rbs[1];
  let rbYd = runYd;
  const qbMob = qb ? ((qb.attrs && qb.attrs.mobility) || 55) : 55;
  if (qb && qbMob > 68 && runYd > 0) {
    const share = Math.min(0.4, (qbMob - 68) / 75); // mob 96 → ~37% of team rush yards
    const qbYd = Math.round(runYd * share * (0.6 + rng.f() * 0.8));
    if (qbYd > 0) {
      qb.stats.rushYd += qbYd;
      qb.stats.car += Math.max(1, Math.round(qbYd / 6.5)); // scrambles run longer per carry
      rbYd -= qbYd;
    }
  }
  if (rb1 && rb2) {
    const s1 = Math.round(rbYd * (0.62 + rng.f() * 0.2));
    rb1.stats.rushYd += s1; rb2.stats.rushYd += rbYd - s1;
    rb1.stats.car += Math.max(s1 > 0 ? 1 : 0, Math.round(s1 / 4.7));
    rb2.stats.car += Math.max(0, Math.round((rbYd - s1) / 4.7));
  } else if (rb1) {
    rb1.stats.rushYd += rbYd;
    rb1.stats.car += Math.max(rbYd > 0 ? 1 : 0, Math.round(rbYd / 4.7));
  }
  // TD credit (returns scorer text for the drive log / ticker)
  if (result === "TD") {
    const playYd = rng.int(1, Math.max(2, Math.min(35, yards)));
    if (rng.chance(passShare)) {
      if (qb) qb.stats.passTD += 1;
      const t = targets.length ? targets[Math.floor(rng.f() * Math.min(3, targets.length))] : null;
      if (t) {
        t.stats.recTD += 1;
        t.stats.rec += 1; // a TD catch IS a reception
        return `${qb ? qb.name : "QB"} → ${t.name}, ${playYd}-yd TD pass`;
      }
      return qb ? `${qb.name} TD pass` : null;
    } else if (rb1 || (qb && qbMob > 68)) {
      let scorer;
      if (qb && qbMob > 68 && rng.chance(Math.min(0.35, (qbMob - 68) / 90))) scorer = qb;
      else scorer = (rng.chance(0.75) || !rb2) ? (rb1 || qb) : rb2;
      scorer.stats.rushTD += 1;
      scorer.stats.car += 1; // a TD run IS a carry
      return `${scorer.name}, ${playYd}-yd TD ${scorer === qb ? "scramble" : "run"}`;
    }
  }
  return null;
}

function attributeDefense(rng, chart, sacks, ints, star = null) {
  const dl = chart.DL.slice(0, 4), lb = chart.LB.slice(0, 3);
  for (let i = 0; i < sacks; i++) {
    // a mismatch edge rusher wins his rep more often (tuned: season leaders stay <26)
    const p = (star && rng.chance(0.16)) ? star
      : rng.chance(0.7) ? rng.pick(dl.length ? dl : lb) : rng.pick(lb.length ? lb : dl);
    if (p) p.stats.sacks += 1;
  }
  const dbs = [...chart.CB.slice(0, 3), ...chart.S.slice(0, 2)];
  for (let i = 0; i < ints; i++) {
    const p = rng.pick(dbs.length ? dbs : lb);
    if (p) p.stats.defInts += 1;
  }
  for (const p of [...dl, ...lb, ...chart.CB.slice(0, 2), ...chart.S.slice(0, 2)]) {
    if (p) p.stats.tackles += rng.int(2, 7);
  }
}

// One game. teamA/teamB: {id, players, strategy:{passLean 0..1, aggression 0..1}}
// homeId: which team id is at home. Returns box score + drive log.
const BOX_KEYS = ["passYd", "passTD", "ints", "car", "rushYd", "rushTD", "rec", "recYd", "recTD",
  "tackles", "sacks", "defInts", "fgm", "fga"];

function applyCoach(units, coach, coachModsFn) {
  if (!coach || !coachModsFn) return;
  const m = coachModsFn(coach, units);
  units.offPass += m.offPass; units.offRun += m.offRun;
  units.defPass += m.defPass; units.defRun += m.defRun;
}

export function simGame(rng, teamA, teamB, homeId, coachModsFn, weather = null, hooks = null) {
  const ua = teamUnits(teamA.players), ub = teamUnits(teamB.players);
  applyCoach(ua, teamA.coach, coachModsFn);
  applyCoach(ub, teamB.coach, coachModsFn);
  if (weather) {
    // symmetric: the elements don't pick sides — but run-heavy rosters mind them less
    for (const u of [ua, ub]) { u.offPass += weather.pass; u.offRun += weather.run; }
    // cold-city home team in snow/freeze: they practice in this (small run edge)
    if ((weather.type === "snow" || weather.type === "cold") && STADIUM.cold.includes(homeId)) {
      (homeId === teamA.id ? ua : ub).offRun += 1.0;
    }
  }
  const chartA = depthChart(teamA.players), chartB = depthChart(teamB.players);
  // snapshot season stats so we can diff a per-game box score afterward (no rng consumed)
  const preSnap = new Map();
  for (const p of [...teamA.players, ...teamB.players]) {
    preSnap.set(p, BOX_KEYS.map(k => p.stats[k]));
  }
  const muA = matchupEdges(chartA, chartB); // A's offense vs B's defense
  const muB = matchupEdges(chartB, chartA);
  const sides = [
    { t: teamA, u: ua, chart: chartA, mu: muA, score: 0, momentum: 0, drives: [], sacksFor: 0, intsFor: 0 },
    { t: teamB, u: ub, chart: chartB, mu: muB, score: 0, momentum: 0, drives: [], sacksFor: 0, intsFor: 0 },
  ];
  if (homeId === teamA.id) { ua.offPass += TUNE.HOME_EDGE / 2; ua.offRun += TUNE.HOME_EDGE / 2; }
  if (homeId === teamB.id) { ub.offPass += TUNE.HOME_EDGE / 2; ub.offRun += TUNE.HOME_EDGE / 2; }

  const log = [];
  let scorerText = null;
  const totalDrives = TUNE.DRIVES_PER_TEAM * 2;
  // FIELD POSITION: where each side's NEXT drive starts (yards from own goal; 25 = touchback).
  // Turnovers hand the defense the ball AT THE SPOT — a pick near your goal line is a gift.
  const nextStart = [25, 25];
  for (let d = 0; d < totalDrives; d++) {
    const offIdx = d % 2, defIdx = 1 - offIdx;
    const off = sides[offIdx], def = sides[defIdx];
    const quarter = Math.min(4, 1 + Math.floor(d / (totalDrives / 4)));
    const passLean = off.t.strategy ? off.t.strategy.passLean : 0.55;
    const start = nextStart[offIdx];
    nextStart[offIdx] = 25; // consumed; scores/normal exchanges reset below

    // momentum as temp rating shift + individual-matchup edges (capped havoc)
    const wrBoost = Math.max(-TUNE.MATCHUP_CAP, Math.min(TUNE.MATCHUP_CAP, off.mu.wrEdge * 0.13));
    const rushHit = Math.max(-TUNE.MATCHUP_CAP, Math.min(TUNE.MATCHUP_CAP, off.mu.rushEdge > 0 ? -off.mu.rushEdge * 0.16 : -off.mu.rushEdge * 0.06));
    const offU = { ...off.u,
      offPass: off.u.offPass + off.momentum + wrBoost + rushHit,
      offRun: off.u.offRun + off.momentum };
    const p = drivePlan(rng, offU, def.u, passLean);
    // pressure mismatch also cooks up turnovers (strip sacks, hurried throws)
    if (off.mu.rushEdge > 5) p.to = Math.min(0.28, p.to + off.mu.rushEdge * 0.0028);
    // slick ball, numb hands: weather feeds the turnover column
    if (weather && weather.to) p.to = Math.min(0.28, p.to + weather.to);

    // SAFETY: pinned deep against a live pass rush, bad things happen (2 pts + free kick)
    if (start <= 8 && rng.chance(TUNE.SAFETY_BASE + (off.mu.rushEdge > 5 ? 0.03 : 0))) {
      def.score += 2;
      def.sacksFor += 1;
      nextStart[defIdx] = rng.int(45, 62); // free kick = great field position too
      const tackler = off.mu.rushEdge > 5 && def.mu ? null : null;
      log.push({ q: quarter, off: off.t.id, result: "SAFETY", points: 0, defPoints: 2,
        yards: 0, scorer: null, start });
      continue;
    }
    // short field = easier points; backed up = harder (0.4% per yard off the 25)
    const fp = (start - 25) * TUNE.FIELD_POS_SCALE;
    p.td = Math.max(0.04, Math.min(0.60, p.td + fp));
    p.fgAtt = Math.max(0.06, Math.min(0.38, p.fgAtt + fp * 0.6));

    // clutch variance late in one-score games
    let variance = 1;
    if (quarter === 4 && Math.abs(sides[0].score - sides[1].score) <= 8) variance += TUNE.CLUTCH_Q4_VAR;

    // ---- END-GAME SITUATIONAL FOOTBALL (last 6 drive slots) ----
    const remaining = totalDrives - d; // includes this drive
    const diff = off.score - def.score;
    const lateGame = remaining <= 6;
    // 4TH-DOWN AGGRESSION (gameplan dial, 0..1, 0.5 = league-normal): riverboat coaches
    // convert punts into extended drives — or turnovers on downs. Conservatives punt more,
    // protect the ball, and leave points on the field. Late-game logic overrides this.
    const agg = ((off.t.strategy && off.t.strategy.aggression != null)
      ? off.t.strategy.aggression : 0.5) - 0.5;
    let gambled = false;
    if (!lateGame && agg !== 0) {
      const puntP = Math.max(0, 1 - (p.to + p.td + p.fgAtt));
      if (agg > 0) {
        p.td = Math.min(0.55, p.td + puntP * agg * 0.42);
        p.to = Math.min(0.28, p.to + puntP * agg * 0.34);
        gambled = true;
      } else {
        p.td *= 1 + agg * 0.25;   // fewer TDs...
        p.to *= 1 + agg * 0.50;   // ...but the ball stays safe
        p.fgAtt = Math.min(0.38, p.fgAtt - agg * 0.05); // settle for 3
      }
    }
    let hurry = false, milk = false, noPunt = false;
    // LIVE COACH'S CALL (user team, trailing, crunch time): the app can pause the
    // ticker here and let the human pick the branch. hooks null (or decide->null)
    // = the automatic policy below runs exactly as it always has.
    let decision = null, askInfo;
    if (hooks && hooks.teamId === off.t.id && lateGame && diff < 0 && diff >= -9 && remaining >= 2) {
      const ctx = { drive: d, quarter, diff, start, remaining };
      decision = hooks.decide ? hooks.decide(ctx) : null;
      if (!decision) askInfo = ctx;   // mark the moment; the ticker may come back for it
    }
    if (lateGame && diff > 0 && remaining <= 2) {
      // victory formation: leading team with the ball late kneels it out
      if (remaining === 1 || rng.chance(0.6)) {
        log.push({ q: 4, off: off.t.id, result: "KNEEL", points: 0, yards: rng.int(1, 4),
          scorer: null, start });
        break; // ballgame
      }
    }
    if (lateGame && diff < 0 && decision !== "safe") {
      // trailing: hurry-up, and 4th downs are GO downs — punting is (mostly) off the table
      const deficit = -diff;
      const puntP = Math.max(0, 1 - (p.to + p.td + p.fgAtt));
      if (decision === "go") {
        // the human says CHASE THE TOUCHDOWN — all gas, no punts
        p.td += puntP * 0.45; p.fgAtt += puntP * 0.10; p.to += puntP * 0.45;
        noPunt = true;
      } else if (decision === "fg") {
        // the human says TAKE THE POINTS — bleed toward the kick
        p.td += puntP * 0.10; p.fgAtt += puntP * 0.55; p.to += puntP * 0.10;
      } else if (deficit >= 4) {
        // need a TD (or two): all-out aggression — converts or turns it over on downs
        p.td += puntP * 0.40; p.fgAtt += puntP * 0.15; p.to += puntP * 0.45;
        noPunt = true;
      } else {
        // a FG ties/wins: bleed toward the kick, keep some caution
        p.td += puntP * 0.15; p.fgAtt += puntP * 0.45; p.to += puntP * 0.15;
      }
      hurry = true;
    } else if (lateGame && diff > 0) {
      // leading: conservative, run-heavy, protect the ball, grind clock
      p.to *= 0.65; p.td *= 0.80;
      milk = true;
    }

    let roll = rng.f() * variance;
    // desperation: clutch variance must not leak the roll back into "punt"
    if (noPunt) roll = roll % (p.to + p.td + p.fgAtt);
    let result, points = 0, yards, conv = null;
    let downs = false;
    if (roll < p.to) {
      result = "TO"; yards = Math.min(rng.int(3, 22), 99 - start);
      // defense takes over AT THE SPOT — turn it over deep in your own end and pay for it
      nextStart[defIdx] = Math.max(5, Math.min(95, 100 - (start + yards)));
      def.momentum = Math.min(TUNE.MOMENTUM_MAX, def.momentum + 1.1);
      off.momentum = Math.max(-TUNE.MOMENTUM_MAX, off.momentum - 0.8);
      // a gambler's giveaway is often a failed 4th down, not a pick
      downs = gambled && agg > 0 && rng.chance(Math.min(0.5, agg * 1.3));
      if (!downs && rng.chance(0.55)) { def.intsFor += 1; if (off.chart.QB[0]) off.chart.QB[0].stats.ints += 1; }
    } else if (roll < p.to + p.td) {
      result = "TD";
      // 2-point decisions: classic chart, late game only (down 2/5/10/16 or up 1/4/12 after the 6)
      const lead6 = off.score + 6 - def.score;
      if (lateGame && [-2, -5, -10, -16, 1, 4, 12].includes(lead6)) {
        if (rng.chance(0.48)) { points = 8; conv = "2G"; }
        else { points = 6; conv = "2F"; }
      } else if (rng.chance(0.96)) { points = 7; }
      else { points = 6; conv = "XM"; }
      yards = Math.max(1, 100 - start); // drive length IS the field you actually crossed
      off.momentum = Math.min(TUNE.MOMENTUM_MAX, off.momentum + 0.7);
    } else if (roll < p.to + p.td + p.fgAtt) {
      // stall inside range: attempt spot depends on where the drive started
      const spot = Math.min(92, start + rng.int(25, 50));
      yards = spot - start;
      const dist = 100 - spot + 17;
      const k = off.chart.K[0];
      const made = rng.chance(Math.max(0.2, Math.min(0.97,
        1.06 - dist * 0.009 + (off.u.kicker - 75) * 0.006 + (weather ? weather.kick : 0))));
      if (k) { k.stats.fga += 1; if (made) k.stats.fgm += 1; }
      result = made ? "FG" : "FG-MISS"; points = made ? 3 : 0;
      scorerText = k ? `${k.name}, ${dist}-yd attempt` : null;
      if (!made) nextStart[defIdx] = Math.max(5, Math.min(95, 100 - spot)); // missed FG = spot of the kick
    } else {
      result = "PUNT"; yards = Math.min(rng.int(5, 30), 99 - start);
      const landing = start + yards + 38 + rng.int(-8, 12);
      nextStart[defIdx] = landing >= 100 ? 20 : Math.max(2, 100 - landing); // touchback or pinned
      off.momentum *= 0.6;
    }
    off.score += points;
    const tdText = attributeDrive(rng, off, result, yards, off.chart, off.mu);
    if (result === "TD") scorerText = tdText;
    if (result === "TO" || rng.chance(0.40)) def.sacksFor += rng.chance(0.55) ? 1 : 0;
    log.push({ q: quarter, off: off.t.id, result, points, yards, scorer: scorerText, start,
      hurry: hurry || undefined, milk: milk || undefined, conv: conv || undefined,
      downs: downs || undefined, ask: askInfo });
    scorerText = null;
  }
  // defense stat attribution — the mismatch rusher (facing side's weak OL) eats first
  attributeDefense(rng, chartB, sides[1].sacksFor, sides[1].intsFor, muA.rushEdge > 5 ? muA.topRusher : null);
  attributeDefense(rng, chartA, sides[0].sacksFor, sides[0].intsFor, muB.rushEdge > 5 ? muB.topRusher : null);

  // game clock: assign each drive a duration (longer drives eat more clock), scale the
  // total to a 60-minute game, then stamp remaining time + quarter onto each log entry.
  {
    const durs = log.map(d => {
      if (d.result === "KNEEL") return 1.6;
      const base = 1.2 + d.yards * 0.045 + (d.result === "PUNT" ? 0.4 : 0);
      return base * (d.hurry ? 0.55 : d.milk ? 1.45 : 1);
    });
    const total = durs.reduce((a, b) => a + b, 0);
    let elapsed = 0;
    for (let i = 0; i < log.length; i++) {
      elapsed += durs[i] * (60 / total);
      const el = Math.min(59.99, elapsed);
      log[i].q = Math.min(4, Math.floor(el / 15) + 1);
      const remQ = 15 - (el % 15);
      const mm = Math.floor(remQ), ss = Math.floor((remQ - mm) * 60);
      log[i].clock = `${mm}:${String(ss).padStart(2, "0")}`;
    }
  }

  // overtime: sudden-ish decision by strength + luck
  if (sides[0].score === sides[1].score) {
    const edge = (ua.offPass + ua.offRun - ub.defPass - ub.defRun)
      - (ub.offPass + ub.offRun - ua.defPass - ua.defRun);
    const winA = rng.chance(0.5 + edge * 0.004);
    const otPts = rng.chance(0.5) ? 3 : 6;
    sides[winA ? 0 : 1].score += otPts;
    log.push({ q: 5, off: winA ? teamA.id : teamB.id, result: "OT-WIN", points: otPts, yards: 0 });
  }

  // injuries + games-played
  for (const side of sides) {
    const chart = side.chart;
    for (const pos of Object.keys(chart)) {
      for (const p of chart[pos].slice(0, pos === "OL" ? 5 : 3)) {
        if (p.injuredWeeks > 0) continue;
        p.stats.gp += 1;
        const risk = TUNE.INJURY_PER_GAME * (1.4 - p.durability / 100);
        // +1 compensates the same-week heal tick in playWeek — min injury now actually sits a game
        if (rng.chance(risk)) { p.injuredWeeks = rng.int(1, 8) + 1; p.newInjury = true; }
      }
    }
  }
  // per-game box score: diff vs pre-game snapshot, keep players who did something
  const box = { [teamA.id]: [], [teamB.id]: [] };
  for (const [team, side] of [[teamA, box[teamA.id]], [teamB, box[teamB.id]]]) {
    for (const p of team.players) {
      const pre = preSnap.get(p);
      const g = {};
      let any = false;
      BOX_KEYS.forEach((k, i) => {
        const d = p.stats[k] - pre[i];
        if (d !== 0) { g[k] = d; any = true; }
      });
      if (any) side.push({ name: p.name, pos: p.pos, g });
    }
  }

  return {
    scoreA: sides[0].score, scoreB: sides[1].score,
    winner: sides[0].score > sides[1].score ? teamA.id : teamB.id,
    log, box, weather,
  };
}
