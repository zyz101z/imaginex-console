// Player generation + roster assembly: real snapshot overlaid on tier-calibrated generation.
import { TEAMS, TEAM_TIER } from "./data_teams.mjs";
import { REAL_ROSTERS } from "./data_rosters.mjs";

const FIRST = ["Jalen","Marcus","Trey","Darius","Caleb","Zion","Malik","Jaylen","DeShawn","Trent",
  "Cole","Hunter","Brock","Tanner","Wyatt","Gage","Chase","Blake","Dawson","Cade",
  "Amari","Xavier","Elijah","Isaiah","Josiah","Micah","Noah","Ezra","Levi","Asher",
  "Tyrell","Devonte","Keshawn","Rashad","Jamal","Andre","Terrell","Donte","Marquis","Cortez",
  "Jake","Ryan","Matt","Danny","Tommy","Joey","Nick","Sam","Ben","Will"];
const LAST = ["Washington","Jefferson","Brooks","Hayes","Coleman","Simmons","Rivers","Dalton","Pierce","Watts",
  "Mitchell","Carter","Henderson","Franklin","Griffin","Sanders","Boone","Vance","Sharpe","Odom",
  "Lattimore","Tillman","Okafor","Nakamura","Sosa","Vasquez","Ferreira","Kowalski","Lindqvist","Petrov",
  "McCray","Dunbar","Holloway","Beckett","Stallworth","Ridgeway","Calloway","Prescott","Winfield","Ashford",
  "Barlow","Crowder","Dixon","Ellison","Fontaine","Garvey","Hutchins","Ingram","Jarrett","Kessler"];

// Positional roster template to fill to a playable 2-deep (counts beyond authored players)
export const TEMPLATE = { QB: 2, RB: 3, WR: 4, TE: 2, OL: 7, DL: 6, LB: 5, CB: 4, S: 3, K: 1 };
// Tier → mean overall for generated starters/backups
const TIER_STARTER_OVR = { 1: 84, 2: 81, 3: 78, 4: 75, 5: 72 };
const BACKUP_DROP = 9;

let nextId = 1;
// after loading a save, bump past every existing id so new players can't collide
export function bumpNextId(minId) { if (minId >= nextId) nextId = minId + 1; }

// position-specific attributes: the REAL ratings; overall is just their blend.
// An 80-ovr guard can be an 87 run-blocker — depth chart + scheme choices should see that.
export const ATTR_DEFS = {
  QB: ["arm", "accuracy", "decision", "mobility"],
  RB: ["speed", "power", "hands"],
  WR: ["speed", "hands", "route"],
  TE: ["catching", "blocking"],
  OL: ["passBlock", "runBlock"],
  DL: ["passRush", "runStop"],
  LB: ["coverage", "runStop", "blitz"],
  CB: ["coverage", "tackling"],
  S: ["coverage", "runSupport"],
  K: ["kickPower", "kickAcc"],
};

// attributes generated INDEPENDENT of overall (not everything scales with quality):
// QB mobility ~62 baseline regardless of ovr — an elite pocket passer is still slow.
// Mean-correction pushes the remaining attrs up to preserve the overall.
const ATTR_INDEP = { QB: { mobility: { base: 62, sd: 8 } } };

export function genAttrs(rng, pos, ovr) {
  const defs = ATTR_DEFS[pos] || [];
  const indep = ATTR_INDEP[pos] || {};
  const offsets = defs.map(k => indep[k]
    ? (indep[k].base - ovr) + rng.gauss() * indep[k].sd
    : rng.gauss() * 4.5);
  const mean = offsets.reduce((a, b) => a + b, 0) / (offsets.length || 1);
  const attrs = {};
  defs.forEach((k, i) => {
    attrs[k] = Math.max(40, Math.min(99, Math.round(ovr + offsets[i] - mean)));
  });
  return attrs;
}

export function makePlayer(rng, { name, pos, age, ovr, teamId, real = false }) {
  const potential = Math.min(99, Math.max(ovr, ovr + rng.int(-3, 12) - Math.max(0, age - 25)));
  return {
    id: nextId++,
    name, pos, age, ovr, potential,
    attrs: genAttrs(rng, pos, ovr),
    teamId,
    real,                                  // authored real player vs generated
    durability: rng.int(70, 95),
    injuredWeeks: 0,
    depth: null,                           // user-set depth order (null = auto by ovr)
    stats: emptyStats(),
    career: [],
  };
}

// authored mobility for the league's known legs (everyone else defaults pocket-ish)
export const QB_MOBILITY = {
  "Lamar Jackson": 96, "Jayden Daniels": 93, "Josh Allen": 88, "Jalen Hurts": 90,
  "Kyler Murray": 89, "Justin Fields": 91, "Anthony Richardson": 90, "Caleb Williams": 83,
  "Drake Maye": 83, "Bo Nix": 80, "J.J. McCarthy": 76, "Cam Ward": 78, "Jaxson Dart": 77,
  "Michael Penix Jr.": 70, "Jordan Love": 74, "C.J. Stroud": 74, "Brock Purdy": 73,
  "Patrick Mahomes": 78, "Justin Herbert": 76, "Jalen Milroe": 95, "Malik Willis": 88,
  "Joshua Dobbs": 80, "Tyrod Taylor": 79, "Daniel Jones": 80, "Trevor Lawrence": 77,
};

export function applyQbMobility(p) {
  if (p.pos === "QB" && QB_MOBILITY[p.name] != null && p.attrs) {
    p.attrs.mobility = QB_MOBILITY[p.name];
  }
}

// save migration: fill missing attrs (whole players OR newly-added attribute keys)
export function ensureAttrs(rng, league) {
  for (const roster of Object.values(league)) {
    for (const p of roster) {
      if (!p.attrs || !Object.keys(p.attrs).length) {
        p.attrs = genAttrs(rng, p.pos, p.ovr);
      } else {
        for (const k of ATTR_DEFS[p.pos] || []) {
          if (p.attrs[k] == null) {
            const base = (k === "mobility" && p.pos === "QB") ? 62 : p.ovr;
            p.attrs[k] = Math.max(40, Math.min(99, Math.round(base + rng.gauss() * (k === "mobility" ? 8 : 4.5))));
          }
        }
      }
      applyQbMobility(p);
      if (p.depth === undefined) p.depth = null;
    }
  }
}

// attribute accessor with graceful fallback to ovr
export const attr = (p, k) => (p.attrs && p.attrs[k] != null) ? p.attrs[k] : p.ovr;

export function emptyStats() {
  return { gp: 0, passYd: 0, passTD: 0, ints: 0, car: 0, rushYd: 0, rushTD: 0, recYd: 0, recTD: 0, rec: 0,
    tackles: 0, sacks: 0, defInts: 0, fgm: 0, fga: 0 };
}

export function genName(rng) { return `${rng.pick(FIRST)} ${rng.pick(LAST)}`; }

export function buildRoster(rng, teamId) {
  const players = [];
  const authored = REAL_ROSTERS[teamId] || [];
  for (const [name, pos, age, ovr] of authored) {
    const p = makePlayer(rng, { name, pos, age, ovr, teamId, real: true });
    applyQbMobility(p);
    players.push(p);
  }
  const tier = TEAM_TIER[teamId] || 3;
  const starterOvr = TIER_STARTER_OVR[tier];
  for (const [pos, want] of Object.entries(TEMPLATE)) {
    const have = players.filter(p => p.pos === pos).length;
    for (let i = have; i < want; i++) {
      const isStarterSlot = i === 0;
      const base = isStarterSlot ? starterOvr : starterOvr - BACKUP_DROP - (i - 1) * 3;
      const ovr = Math.max(58, Math.min(94, Math.round(base + rng.gauss() * 3)));
      players.push(makePlayer(rng, {
        name: genName(rng), pos, age: rng.int(22, 31), ovr, teamId,
      }));
    }
  }
  return players;
}

// Depth chart = best-overall ordering per position (healthy players first)
export function depthChart(players) {
  const byPos = {};
  for (const pos of Object.keys(TEMPLATE)) {
    byPos[pos] = players
      .filter(p => p.pos === pos)
      .sort((a, b) =>
        (a.injuredWeeks > 0 ? 1 : 0) - (b.injuredWeeks > 0 ? 1 : 0) ||
        (a.depth != null ? a.depth : 900) - (b.depth != null ? b.depth : 900) ||
        b.ovr - a.ovr);
  }
  return byPos;
}

function avgTopBy(list, n, fn) {
  const top = list.filter(p => p.injuredWeeks === 0).slice(0, n);
  if (top.length === 0) return 55;
  return top.reduce((s, p) => s + fn(p), 0) / top.length;
}

// Unit strengths consumed by the sim — built from position ATTRIBUTES so lineup
// choices (e.g. starting the better RUN BLOCKER over the higher overall) matter.
export function teamUnits(players) {
  const d = depthChart(players);
  const qb1 = d.QB[0];
  const qbPass = qb1 ? 0.4 * attr(qb1, "accuracy") + 0.35 * attr(qb1, "arm") + 0.25 * attr(qb1, "decision") : 55;
  return {
    qb: qb1 ? qb1.ovr : 55,
    offPass: 0.45 * qbPass
      + 0.30 * avgTopBy(d.WR, 3, p => 0.4 * attr(p, "hands") + 0.35 * attr(p, "route") + 0.25 * attr(p, "speed"))
      + 0.10 * avgTopBy(d.TE, 1, p => attr(p, "catching"))
      + 0.15 * avgTopBy(d.OL, 5, p => attr(p, "passBlock")),
    offRun: 0.40 * avgTopBy(d.RB, 2, p => 0.55 * attr(p, "power") + 0.45 * attr(p, "speed"))
      + 0.42 * avgTopBy(d.OL, 5, p => attr(p, "runBlock"))
      + 0.08 * avgTopBy(d.TE, 1, p => attr(p, "blocking"))
      + 0.10 * (qb1 ? attr(qb1, "mobility") : 55),
    defPass: 0.40 * avgTopBy(d.CB, 3, p => attr(p, "coverage"))
      + 0.25 * avgTopBy(d.S, 2, p => attr(p, "coverage"))
      + 0.35 * avgTopBy(d.DL, 4, p => attr(p, "passRush")),
    defRun: 0.45 * avgTopBy(d.DL, 4, p => attr(p, "runStop"))
      + 0.40 * avgTopBy(d.LB, 3, p => 0.6 * attr(p, "runStop") + 0.2 * attr(p, "blitz") + 0.2 * attr(p, "coverage"))
      + 0.15 * avgTopBy(d.S, 2, p => attr(p, "runSupport")),
    kicker: avgTopBy(d.K, 1, p => 0.6 * attr(p, "kickAcc") + 0.4 * attr(p, "kickPower")),
  };
}

export function buildLeague(rng) {
  const league = {};
  for (const t of TEAMS) league[t.id] = buildRoster(rng, t.id);
  return league;
}
