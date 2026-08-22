// Gridiron GM — P1 browser app: pick team, advance through a season, watch your games
// on a ~30s drive ticker, standings/roster/leaders/schedule views, localStorage saves.
import { makeRng } from "./rng.mjs";
import { buildLeague, emptyStats, depthChart, teamUnits, TEMPLATE, ATTR_DEFS, attr, ensureAttrs, bumpNextId } from "./players.mjs";
import { simGame, matchupEdges, gameWeather, STADIUM } from "./sim.mjs";
import { makeSchedule, emptyStandings, playWeek, simPlayoffs, seeds, nextPlayoffRound } from "./season.mjs";
import { TEAMS, TEAM_BY_ID } from "./data_teams.mjs";
import { sfx, playDrive, setMuted, isMuted, startCrowd, stopCrowd } from "./sfx.mjs";
import { ensureContracts, ageAndRetire, expireContracts, aiResign, aiFreeAgencyRound,
  genDraftClass, draftOrder, aiPick, rookieContract, fillMinimums, payroll, capRoom,
  cutPlayer, contractFor, CAP_LIMIT, ROSTER_MAX,
  archiveSeasonStats, computeAwards, computeAllPro, statLine, careerTotals,
  SCHEMES, genCoach, coachFit, coachMods, playerValue, PICK_VALUE,
  evalTrade, execTrade, freshPicks, legalAfterLoss, applyTraining, scoutProspect,
  genAIOffer, updateRecords, RECORD_KEYS } from "./gm.mjs";

const SAVE_KEY = "gridiron_gm_save_v1";
const $ = sel => document.querySelector(sel);

let S = null; // game state

// ---------------------------------------------------------------- state
function newFranchise(teamId, capMode) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  S = {
    teamId, seed, capMode: capMode || "strict", seasonNum: 1, week: 0,
    phase: "season", // season | postseason | offseason | freeagency | draft
    league: buildLeague(rng),
    schedule: makeSchedule(rng, 1),
    standings: emptyStandings(),
    lastResults: [], bracket: null, history: [],
    deadMoney: {}, fa: null, draft: null,
    news: [], security: 60, goal: null, hof: [], lastAwards: null,
    strategy: { passLean: 0.55, aggression: 0.5 },
    coaches: {}, picks: null, coachMarket: [], tradeUI: null,
    rngTick: 1000,
  };
  for (const t of TEAMS) S.coaches[t.id] = genCoach(rng);
  S.picks = freshPicks();
  S.futurePicks = freshPicks();
  S.training = [];
  S.scoutPts = 10;
  S.nextClass = genDraftClass(rng);
  ensureContracts(rng, S.league);
  setOwnerGoal();
  save();
}

// owner expectation scales with roster strength (recomputed each season)
function setOwnerGoal() {
  const rank = [...TEAMS].map(t => {
    const u = teamUnits(S.league[t.id]);
    return { id: t.id, v: (u.offPass + u.offRun + u.defPass + u.defRun) / 4 };
  }).sort((a, b) => b.v - a.v).findIndex(x => x.id === S.teamId) + 1;
  if (rank <= 8) S.goal = { text: "Contend: win 11+ games", minWins: 11 };
  else if (rank <= 20) S.goal = { text: "Make a push: win 9+ games", minWins: 9 };
  else S.goal = { text: "Show progress: win 6+ games", minWins: 6 };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* full */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      S = JSON.parse(raw);
      // migrate pre-P2 saves
      if (!S.capMode) S.capMode = "strict";
      if (!S.deadMoney) S.deadMoney = {};
      if (!S.news) S.news = [];
      if (S.security == null) S.security = 60;
      if (!S.hof) S.hof = [];
      if (!S.strategy) S.strategy = { passLean: 0.55 };
      if (!S.coaches || !Object.keys(S.coaches).length) {
        S.coaches = {};
        const crng = makeRng((S.seed ^ 0xc0ac4) >>> 0);
        for (const t of TEAMS) S.coaches[t.id] = genCoach(crng);
      }
      if (!S.picks) S.picks = freshPicks();
      if (!S.futurePicks) S.futurePicks = freshPicks();
      if (S.strategy.aggression == null) S.strategy.aggression = 0.5;
      if (S.draft && S.draft.order && !S.draft.slots) S.draft = null; // abandon mid-draft pre-P3b saves
      ensureAttrs(makeRng((S.seed ^ 0xa77) >>> 0), S.league);
      if (!S.training) S.training = [];
      if (S.scoutPts == null) S.scoutPts = 10;
      if (!S.nextClass) S.nextClass = genDraftClass(makeRng((S.seed ^ 0xdc1) >>> 0));
      // prevent id collisions between loaded players and future generated ones
      let maxId = 0;
      for (const roster of Object.values(S.league)) for (const p of roster) maxId = Math.max(maxId, p.id);
      for (const p of (S.nextClass || [])) maxId = Math.max(maxId, p.id);
      for (const p of ((S.fa && S.fa.pool) || [])) maxId = Math.max(maxId, p.id);
      for (const p of ((S.draft && S.draft.prospects) || [])) maxId = Math.max(maxId, p.id);
      bumpNextId(maxId);
      if (S.muted) setMuted(true);
      if (!S.streetFA) S.streetFA = [];
      if (!S.records) S.records = {};
      if (S.fa && S.fa.pool) ensureAttrs(makeRng((S.seed ^ 0xa78) >>> 0), { pool: S.fa.pool });
      ensureContracts(makeRng((S.seed ^ 0x5eed) >>> 0), S.league);
      return true;
    }
  } catch (e) {}
  return false;
}
function weekRng() {
  S.rngTick += 1;
  return makeRng((S.seed + S.seasonNum * 977 + S.rngTick * 7919) >>> 0);
}

// ---------------------------------------------------------------- helpers
const teamName = id => `${TEAM_BY_ID[id].city} ${TEAM_BY_ID[id].name}`;
const rec = id => { const s = S.standings[id]; return `${s.w}-${s.l}${s.t ? "-" + s.t : ""}`; };

function chip(id) {
  const t = TEAM_BY_ID[id];
  return `<span class="chip" style="background:${t.color};border-color:${t.color2}">` +
    `<img src="${logoUrl(id)}" width="14" height="14" onerror="this.style.display='none'" alt="">${id}</span>`;
}

// Real team logos via ESPN's public CDN (personal-use app; graceful fallback to color chip
// if offline). Full visual pass deferred to P4 per user.
function logoUrl(id) {
  const espn = id === "WAS" ? "wsh" : id.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espn}.png`;
}
function logo(id, size = 22) {
  return `<img class="logo" src="${logoUrl(id)}" width="${size}" height="${size}" onerror="this.style.display='none'" alt="">`;
}

// ---------------------------------------------------------------- views
function renderTop() {
  const phaseTxt = S.phase === "season" ? `Season ${S.seasonNum} — Week ${S.week + 1}/18`
    : S.phase === "postseason" ? `Season ${S.seasonNum} — ${S.playoffs ? PLAYOFF_STAGES[S.playoffs.stage] : "Playoffs"}`
    : S.phase === "freeagency" ? `Season ${S.seasonNum + 1} — Free Agency (round ${S.fa.round + 1}/3)`
    : S.phase === "draft" ? `Season ${S.seasonNum + 1} — Draft R${S.draft.slots[Math.min(S.draft.idx, S.draft.slots.length - 1)].round}`
    : `Season ${S.seasonNum} — Complete`;
  $("#topbar").innerHTML = `
    ${logo(S.teamId, 28)} <b>${teamName(S.teamId)}</b>
    <span class="dim">${rec(S.teamId)}</span>
    <span class="dim tt" title="Owner goal: ${S.goal ? S.goal.text : "TBD"}. Hit your goal or job security falls — at 20% or lower after a season, you're fired.">Job: ${S.security}%</span>
    ${["offseason", "freeagency", "draft"].includes(S.phase) ?
      `<button class="mini ${S.training.length < 3 ? "warn" : ""}" onclick="__gm.goRoster()"
        title="Training camp: focuses apply when the new season starts. Click attribute numbers on the Roster to set them — don't waste your ${3 - S.training.length} open slot(s)!">🎯 Training ${S.training.length}/3</button>` : ""}
    <span class="grow"></span>
    <span>${phaseTxt}</span>
    <button id="muteBtn" class="mini mute" title="Toggle sound">${isMuted() ? "🔇" : "🔊"}</button>
    <button id="advanceBtn" class="advance">${
      S.phase === "season" ? "ADVANCE WEEK ▶" :
      S.phase === "postseason" ? `PLAY ${S.playoffs ? PLAYOFF_STAGES[S.playoffs.stage].toUpperCase() : "PLAYOFFS"} ▶` :
      S.phase === "offseason" ? "START OFFSEASON ▶" :
      S.phase === "freeagency" ? (S.fa.round < 3 ? "RUN FA ROUND ▶" : "TO DRAFT ▶") :
      "SIM TO MY PICK ▶"}</button>`;
  $("#advanceBtn").onclick = () => { sfx.tick(); advance(); };
  $("#muteBtn").onclick = () => {
    setMuted(!isMuted());
    S.muted = isMuted();
    save(); render();
  };
  const tc = TEAM_BY_ID[S.teamId];
  $("#topbar").style.borderBottom = `3px solid ${tc.color}`;
  $("#topbar").style.background = `linear-gradient(90deg, ${tc.color}26, #171b22 40%)`;
}

function viewStandings() {
  let html = "";
  for (const conf of ["NFC", "AFC"]) {
    html += `<div class="conf"><h3>${conf}</h3><div class="divgrid">`;
    for (const div of ["North", "East", "South", "West"]) {
      const teams = TEAMS.filter(t => t.conf === conf && t.div === div)
        .sort((a, b) => {
          const x = S.standings[a.id], y = S.standings[b.id];
          return (y.w - y.l) - (x.w - x.l) || (y.pf - y.pa) - (x.pf - x.pa);
        });
      html += `<table><tr><th colspan=4>${conf} ${div}</th></tr>
        <tr class="hdr"><td>Team</td><td>W-L</td><td>PF</td><td>PA</td></tr>`;
      for (const t of teams) {
        const s = S.standings[t.id];
        const me = t.id === S.teamId ? ' class="me"' : "";
        html += `<tr${me}><td>${chip(t.id)} ${t.name}</td><td>${s.w}-${s.l}</td><td>${s.pf}</td><td>${s.pa}</td></tr>`;
      }
      html += "</table>";
    }
    html += "</div></div>";
  }
  return html;
}

function viewRoster() {
  const chart = depthChart(S.league[S.teamId]);
  const u = teamUnits(S.league[S.teamId]);
  const lean = Math.round((S.strategy ? S.strategy.passLean : 0.55) * 100);
  const agg = Math.round(((S.strategy && S.strategy.aggression != null) ? S.strategy.aggression : 0.5) * 100);
  let html = `<div class="units dim">Off Pass ${u.offPass.toFixed(0)} · Off Run ${u.offRun.toFixed(0)} · Def Pass ${u.defPass.toFixed(0)} · Def Run ${u.defRun.toFixed(0)}</div>
  <div class="units"><label class="tt" title="Gameplan: how pass-heavy your offense plays. Lean toward your stronger unit and your opponent's weaker defense.">Gameplan — Pass lean: <b id="leanVal">${lean}%</b></label>
    <input type="range" min="30" max="75" value="${lean}" style="width:220px;vertical-align:middle"
      oninput="document.getElementById('leanVal').textContent=this.value+'%'"
      onchange="__gm.setLean(this.value)">
    <span style="margin-left:18px"></span>
    <label class="tt" title="4th-down aggression. Riverboat (high): more go-for-it conversions AND more turnovers on downs — boom-or-bust. Conservative (low): punt/kick more, protect the ball, score less. 50% = league normal.">4th-down aggression: <b id="aggVal">${agg}%</b></label>
    <input type="range" min="20" max="80" value="${agg}" style="width:180px;vertical-align:middle"
      oninput="document.getElementById('aggVal').textContent=this.value+'%'"
      onchange="__gm.setAgg(this.value)">
    <span class="dim small">${agg >= 62 ? "🎲 riverboat" : agg <= 38 ? "🛡️ conservative" : "balanced"}</span></div>`;
  const ATTR_LABEL = { arm: "Arm", accuracy: "Acc", decision: "Dec", speed: "Spd", power: "Pow",
    hands: "Hnd", route: "Rte", catching: "Cat", blocking: "Blk", passBlock: "PassBlk", runBlock: "RunBlk",
    passRush: "Rush", runStop: "RunStp", coverage: "Cov", tackling: "Tkl", blitz: "Blz",
    runSupport: "RunSup", kickPower: "Pow", kickAcc: "Acc" };
  const STARTERS = { QB: 1, RB: 2, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 3, S: 2, K: 1 };
  for (const pos of ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"]) {
    const defs = ATTR_DEFS[pos] || [];
    html += `<table><tr><th colspan="2">${pos} <span class="dim small">(top ${STARTERS[pos]} start)</span></th>
      <th>Age</th><th class="tt" title="Overall — a blend of the attributes. The sim uses the ATTRIBUTES, so start players whose strengths fit your scheme.">OVR</th>` +
      defs.map(k => `<th>${ATTR_LABEL[k]}</th>`).join("") + `<th>Status</th><th>Stats</th></tr>`;
    chart[pos].forEach((p, i) => {
      const st = p.stats;
      let stat = "";
      if (pos === "QB") stat = `${st.passYd} yds, ${st.passTD} TD, ${st.ints} INT` +
        (st.rushYd > 0 ? ` · ${st.car} car, ${st.rushYd} rush, ${st.rushTD} rTD` : "");
      else if (pos === "RB") stat = `${st.car} car, ${st.rushYd} yds (${st.car ? (st.rushYd / st.car).toFixed(1) : "0.0"}), ${st.rushTD} TD`;
      else if (pos === "WR" || pos === "TE") stat = `${st.rec}-${st.recYd}-${st.recTD}`;
      else if (pos === "K") stat = `${st.fgm}/${st.fga} FG`;
      else stat = `${st.tackles}t ${st.sacks}s ${st.defInts}i`;
      const status = p.injuredWeeks > 0 ? `<span class="inj">OUT ${p.injuredWeeks}w</span>` : (i < STARTERS[pos] ? "<b class='win'>START</b>" : "");
      const up = i > 0 && p.injuredWeeks === 0
        ? `<button class="mini up" onclick="__gm.promote(${p.id})" title="Move up the depth chart">▲</button>` : "";
      const starter = i < STARTERS[pos];
      html += `<tr${p.real ? "" : ' class="genp"'}${starter ? ' style="background:#161c26"' : ""}>
        <td>${up}</td><td>${pn(p)}</td><td>${p.age}</td><td>${p.ovr}</td>` +
        defs.map(k => {
          const v = attr(p, k);
          const focused = S.training.some(t => t.playerId === p.id && t.attr === k);
          const cls = focused ? "focus" : (v >= p.ovr + 4 ? "win" : v <= p.ovr - 4 ? "loss" : "");
          return `<td class="${cls} clickattr" onclick="__gm.train(${p.id}, '${k}')"
            title="Click to set as offseason training focus (${S.training.length}/3 slots used)">${focused ? "🎯" : ""}${v}</td>`;
        }).join("") +
        `<td>${status}</td><td class="dim small">${stat}</td></tr>`;
    });
    html += `</table>`;
  }
  return html + `<div class='dim small'>▲ moves a player up his position's depth chart. Green/red attributes = notably above/below overall.
    <b>Click any attribute to set a 🎯 training focus (${S.training.length}/3)</b> — focused attributes grow each offseason (young players + good coaches develop faster). Build your run-mauler.</div>`;
}

function viewSchedule() {
  let html = "";
  if (S.seasonNum === 1 && S.week === 0 && !S.sawIntro) {
    html += `<div class="coachcard intro"><b>Welcome, Coach.</b> The loop: check <b>THIS WEEK</b> below → tweak your
      <b>gameplan slider</b> (My Roster) → hit <b>ADVANCE WEEK</b> and watch the game. Between seasons you'll re-sign,
      shop free agency, and draft. Click attribute numbers to set 🎯 <b>training focuses</b>, spend <b>scout points</b>
      (Draft/Scout) all season, and keep the owner happy — <span class="tt" title="Job security. Lose too much and you're fired.">Job %</span> is watching.
      <button class="mini" onclick="__gm.dismissIntro()">GOT IT</button></div>`;
  }
  if (S.phase === "season") {
    const g = S.schedule[S.week] && S.schedule[S.week].find(x => x.home === S.teamId || x.away === S.teamId);
    if (g) {
      const opp = g.home === S.teamId ? g.away : g.home;
      const ou = teamUnits(S.league[opp]);
      const mu = teamUnits(S.league[S.teamId]);
      const oc = S.coaches[opp];
      const weakRun = ou.defRun <= ou.defPass;
      const myChart = depthChart(S.league[S.teamId]);
      const oppChart = depthChart(S.league[opp]);
      const myAtk = matchupEdges(myChart, oppChart);
      const oppAtk = matchupEdges(oppChart, myChart);
      let mmHtml = "";
      if (myAtk.wrEdge >= 7 && myAtk.wr1) mmHtml += `<br><span class="win">🔥 MISMATCH: ${myAtk.wr1.name} torches their CB1 — feed him (pass lean up).</span>`;
      if (myAtk.rushEdge >= 7 && myAtk.topRusher === null) {}
      if (oppAtk.wrEdge >= 7 && oppAtk.wr1) mmHtml += `<br><span class="loss">⚠️ Their ${oppAtk.wr1.name} outclasses your CB1 — expect deep shots.</span>`;
      if (oppAtk.rushEdge >= 7 && oppAtk.topRusher) mmHtml += `<br><span class="loss">⚠️ ${oppAtk.topRusher.name} vs ${oppAtk.weakOL ? oppAtk.weakOL.name : "your line"} is a problem — pressure coming (running helps).</span>`;
      if (myAtk.rushEdge >= 7 && myAtk.topRusher) mmHtml += `<br><span class="win">🔥 ${myAtk.topRusher.name} owns their ${myAtk.weakOL ? myAtk.weakOL.name : "line"} — sacks incoming.</span>`;
      const wx = weatherFor(g.home, S.week);
      const wxHtml = wx
        ? `<br><span class="tt" title="Weather hits both offenses — but passing and kicking suffer most, and cold-city teams keep a run edge at home. Lean run in bad weather.">${wx.icon} Forecast: <b>${wx.desc}</b> — ${wx.type === "snow" ? "passing/kicking suffer badly; the ground game travels" : wx.type === "wind" ? "kicks and deep balls get shaky" : wx.type === "rain" ? "slick ball — turnovers up, passing down" : "tough on the passing game"}.</span>`
        : "";
      // Narrative lines: division rivalry, revenge game, live streak (flavor only)
      let nHtml = "";
      if (TEAM_BY_ID[opp].conf === TEAM_BY_ID[S.teamId].conf && TEAM_BY_ID[opp].div === TEAM_BY_ID[S.teamId].div)
        nHtml += `<br><span class="dim">🏈 DIVISION RIVALRY — these count double in the locker room.</span>`;
      for (let w2 = 0; w2 < S.week; w2++) {
        const pg = S.schedule[w2].find(x => (x.home === S.teamId && x.away === opp) || (x.away === S.teamId && x.home === opp));
        if (pg && pg.played) {
          const my = pg.home === S.teamId ? pg.scoreHome : pg.scoreAway;
          const their = pg.home === S.teamId ? pg.scoreAway : pg.scoreHome;
          if (their > my) nHtml += `<br><span class="loss">😤 REVENGE GAME: they took Week ${w2 + 1}, ${their}-${my}. Answer back.</span>`;
        }
      }
      let streak = 0, kind = null;
      for (let w2 = S.week - 1; w2 >= 0; w2--) {
        const pg = S.schedule[w2].find(x => x.home === S.teamId || x.away === S.teamId);
        if (!pg || !pg.played) continue;
        const my = pg.home === S.teamId ? pg.scoreHome : pg.scoreAway;
        const their = pg.home === S.teamId ? pg.scoreAway : pg.scoreHome;
        const k = my > their ? "W" : "L";
        if (!kind) { kind = k; streak = 1; }
        else if (k === kind) streak++;
        else break;
      }
      if (streak >= 3) nHtml += kind === "W"
        ? `<br><span class="win">🔥 ${streak}-game win streak — keep it rolling.</span>`
        : `<br><span class="loss">🧊 ${streak} straight losses — this one has to stop the bleeding.</span>`;
      html += `<div class="coachcard"><b>THIS WEEK:</b> ${g.home === S.teamId ? "vs" : "@"} ${logo(opp)} <b>${teamName(opp)}</b> (${rec(opp)}) — ${SCHEMES[oc.scheme].name} team<br>
        <span class="dim">Their D: pass ${ou.defPass.toFixed(0)} / run ${ou.defRun.toFixed(0)} · Your O: pass ${mu.offPass.toFixed(0)} / run ${mu.offRun.toFixed(0)}</span>${mmHtml}${wxHtml}${nHtml}<br>
        <span class="win">Gameplan hint: they're softer against the ${weakRun ? "RUN — lean your slider down" : "PASS — let it fly"}.</span></div>`;
    }
  }
  html += "<table><tr class='hdr'><td>Wk</td><td>Matchup</td><td>Result</td></tr>";
  for (let w = 0; w < 18; w++) {
    const g = S.schedule[w].find(x => x.home === S.teamId || x.away === S.teamId);
    if (!g) { html += `<tr><td>${w + 1}</td><td class="dim">BYE</td><td></td></tr>`; continue; }
    const home = g.home === S.teamId;
    const opp = home ? g.away : g.home;
    const vs = home ? "vs" : "@";
    let res = "";
    if (g.played) {
      const my = home ? g.scoreHome : g.scoreAway, their = home ? g.scoreAway : g.scoreHome;
      res = `<b class="${my > their ? "win" : "loss"}">${my > their ? "W" : "L"} ${my}-${their}</b>`;
    }
    const cur = w === S.week && S.phase === "season" ? ' class="me"' : "";
    const wx = weatherFor(g.home, w);
    const wxIcon = wx ? ` <span class="tt" title="Forecast: ${wx.desc}">${wx.icon}</span>` : "";
    html += `<tr${cur}><td>${w + 1}</td><td>${vs} ${chip(opp)} ${teamName(opp)}${wxIcon}</td><td>${res}</td></tr>`;
  }
  return html + "</table>";
}

let leadersConf = "NFL";
function viewLeaders() {
  const all = Object.values(S.league).flat().filter(p =>
    leadersConf === "NFL" || (p.teamId && TEAM_BY_ID[p.teamId] && TEAM_BY_ID[p.teamId].conf === leadersConf));
  const tabs = ["NFL", "NFC", "AFC"].map(cf =>
    `<button class="mini ${cf === leadersConf ? "" : "off"}" onclick="__gm.leadersFilter('${cf}')">${cf}</button>`).join(" ");
  const cat = (label, key, fmt) => {
    const top = [...all].sort((a, b) => b.stats[key] - a.stats[key]).slice(0, 5);
    let h = `<table><tr><th colspan=3>${label}</th></tr>`;
    for (const p of top) h += `<tr><td>${chip(p.teamId)}</td><td>${pn(p)}</td><td>${fmt(p.stats)}</td></tr>`;
    return h + "</table>";
  };
  return `<h2>League Leaders <span style="margin-left:12px">${tabs}</span></h2><div class="divgrid">
    ${cat("Passing Yards", "passYd", s => s.passYd + " yds, " + s.passTD + " TD")}
    ${cat("Rushing Yards", "rushYd", s => s.rushYd + " yds, " + s.rushTD + " TD")}
    ${cat("Receiving Yards", "recYd", s => s.recYd + " yds, " + s.recTD + " TD")}
    ${cat("Sacks", "sacks", s => s.sacks + " sacks")}
  </div>`;
}

// ---------------------------------------------------------------- player card
// Click any underlined player name to open this. Live everywhere the roster,
// leaders, free agency and awards render — one lookup, one card.
function findPlayerById(id) {
  for (const roster of Object.values(S.league)) {
    for (const p of roster) if (p.id === id) return p;
  }
  if (S.fa && S.fa.pool) { const p = S.fa.pool.find(x => x.id === id); if (p) return p; }
  return null;   // draft prospects excluded on purpose — the card would leak true ratings
}
function pcard(id) {
  const p = findPlayerById(id);
  if (p) showPlayerCard(p);
}
function pcardByName(name) {
  for (const roster of Object.values(S.league)) {
    for (const p of roster) if (p.name === name) return showPlayerCard(p);
  }
}
function closePcard() {
  const el = document.getElementById("pcard");
  if (el) el.remove();
}
function showPlayerCard(p) {
  closePcard();
  const div = document.createElement("div");
  div.id = "pcard";
  const teamRow = p.teamId
    ? `${logo(p.teamId, 22)} ${teamName(p.teamId)}`
    : `<span class="dim">FREE AGENT</span>`;
  const bars = (ATTR_DEFS[p.pos] || []).map(k => {
    const v = attr(p, k);
    const pct = Math.max(4, Math.round((v - 40) / 59 * 100));
    const col = v >= 88 ? "#4de37f" : v >= 75 ? "#ffd166" : "#8fa5cf";
    return `<div class="pcRow"><span class="pcAttr">${k}</span>
      <span class="pcBarBg"><span class="pcBar" style="width:${pct}%;background:${col}"></span></span>
      <b>${v}</b></div>`;
  }).join("");
  const contract = p.contract
    ? `$${p.contract.salary}M × ${p.contract.years}y` : "no contract";
  const seasonL = p.stats.gp > 0 ? `${statLine(p.pos, p.stats)} <span class="dim">(${p.stats.gp} gp)</span>` : `<span class="dim">no games yet</span>`;
  const tot = careerTotals(p);
  const careerL = p.career.length
    ? `${statLine(p.pos, tot)} <span class="dim">(${p.career.length} season${p.career.length > 1 ? "s" : ""} + this one)</span>`
    : `<span class="dim">rookie season</span>`;
  const badges = [
    p.allPro ? `<span class="pcBadge">★ ALL-PRO ×${p.allPro}</span>` : "",
    p.rookie ? `<span class="pcBadge" style="border-color:#7fd8c8;color:#7fd8c8">ROOKIE</span>` : "",
    p.injuredWeeks > 0 ? `<span class="pcBadge" style="border-color:#ff8f9f;color:#ff8f9f">INJURED ${p.injuredWeeks}w</span>` : "",
  ].join(" ");
  div.innerHTML = `<div class="pcBox">
    <button class="pcClose" onclick="__gm.closePcard()">✕</button>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="font-size:34px;font-weight:900;color:#ffd166">${p.ovr}</div>
      <div><b style="font-size:18px">${p.name}</b><br>
        <span class="dim">${p.pos} · age ${p.age} · ${teamRow}</span></div>
    </div>
    ${badges ? `<div style="margin:4px 0 8px">${badges}</div>` : ""}
    ${bars}
    <div class="pcSec">CONTRACT</div><div>${contract}</div>
    <div class="pcSec">THIS SEASON</div><div>${seasonL}</div>
    <div class="pcSec">CAREER</div><div>${careerL}</div>
  </div>`;
  div.onclick = (e) => { if (e.target === div) closePcard(); };
  document.body.appendChild(div);
}
const pn = (p) => `<span class="pn" onclick="__gm.pcard(${p.id})">${p.name}</span>`;
// Hall of Fame plaque — career card for an inducted legend
function hofCard(i) {
  const h2 = S.hof[i];
  if (!h2) return;
  closePcard();
  const div = document.createElement("div");
  div.id = "pcard";
  const t = h2.totals || {};
  div.innerHTML = `<div class="pcBox" style="border-color:#c9a227">
    <button class="pcClose" onclick="__gm.closePcard()">✕</button>
    <div style="text-align:center;margin-bottom:6px;font-size:26px">🏛️</div>
    <div style="text-align:center"><b style="font-size:19px">${h2.name}</b><br>
      <span class="dim">${h2.pos}${h2.lastTeamId ? " · " + teamName(h2.lastTeamId) : ""}</span></div>
    <div class="pcSec">CAREER</div>
    <div>${statLine(h2.pos, t)} <span class="dim">(${t.gp || 0} games, ${h2.seasons} seasons)</span></div>
    <div class="pcSec">LEGACY</div>
    <div>HOF score <b style="color:#c9a227">${h2.score}</b> · retired Season ${h2.seasonRetired}</div>
  </div>`;
  div.onclick = (e) => { if (e.target === div) closePcard(); };
  document.body.appendChild(div);
}

// Weekly milestone watch — the living world celebrates round numbers as they fall
const MILESTONES = [
  ["passYd", 4000, "passing yards"], ["passTD", 30, "passing TDs"],
  ["rushYd", 1000, "rushing yards"], ["recYd", 1000, "receiving yards"],
  ["sacks", 10, "sacks"], ["defInts", 8, "interceptions"],
];
// 📖 SEASON YEARBOOK — snapshot the season's story while the stats are still live
// (built at the offseason turn, BEFORE archiveSeasonStats wipes the season lines)
function buildYearbook(standing) {
  const roster = S.league[S.teamId];
  const active = roster.filter(p => p.stats.gp > 0);
  const top = score => active.reduce((b, p) => (!b || score(p.stats) > score(b.stats)) ? p : b, null);
  const mk = (label, p) => p && { label, id: p.id, name: p.name, pos: p.pos, line: statLine(p.pos, p.stats) };
  const leaders = [
    mk("Passing", top(x => x.passYd || 0)),
    mk("Rushing", top(x => x.rushYd || 0)),
    mk("Receiving", top(x => x.recYd || 0)),
    mk("Defense", top(x => (x.sacks || 0) * 45 + (x.defInts || 0) * 55 + (x.tackles || 0) * 1.5)),
  ].filter(Boolean);
  // the season's story, read from the schedule
  let bigWin = null, toughLoss = null, bestStreak = 0, run = 0;
  for (let w = 0; w < 18; w++) {
    const g = S.schedule[w] && S.schedule[w].find(x => x.home === S.teamId || x.away === S.teamId);
    if (!g || !g.played) continue;
    const my = g.home === S.teamId ? g.scoreHome : g.scoreAway;
    const their = g.home === S.teamId ? g.scoreAway : g.scoreHome;
    const opp = g.home === S.teamId ? g.away : g.home;
    if (my > their) {
      run++; bestStreak = Math.max(bestStreak, run);
      if (!bigWin || my - their > bigWin.m) bigWin = { opp, sc: `${my}-${their}`, m: my - their, w: w + 1 };
    } else if (my < their) {
      run = 0;
      if (!toughLoss || their - my > toughLoss.m) toughLoss = { opp, sc: `${their}-${my}`, m: their - my, w: w + 1 };
    } else run = 0;
  }
  // rookie report: how the newest class actually played
  const grade = sc => sc >= 1100 ? "A" : sc >= 650 ? "B" : sc >= 320 ? "C" : sc >= 120 ? "D" : "—";
  const rscore = st => (st.passYd || 0) + (st.passTD || 0) * 40 + ((st.rushYd || 0) + (st.recYd || 0)) * 1.2 +
    ((st.rushTD || 0) + (st.recTD || 0)) * 40 + (st.sacks || 0) * 45 + (st.defInts || 0) * 55 + (st.tackles || 0) * 1.5;
  const rookies = roster.filter(p => p.rookie).map(p => ({
    id: p.id, name: p.name, pos: p.pos, ovr: p.ovr,
    line: p.stats.gp > 0 ? statLine(p.pos, p.stats) : "did not play",
    grade: p.stats.gp > 0 ? grade(rscore(p.stats)) : "—",
  }));
  const myAwards = [];
  if (S.lastAwards) {
    for (const [label, w] of [["MVP", S.lastAwards.mvp], ["OPOY", S.lastAwards.opoy],
                              ["DPOY", S.lastAwards.dpoy], ["ROY", S.lastAwards.roy]]) {
      if (w && w.teamId === S.teamId) myAwards.push(`${label}: ${w.name}`);
    }
  }
  const allProMine = (S.lastAllPro || []).filter(ap => ap.teamId === S.teamId).map(ap => ap.name);
  return { season: S.seasonNum, record: `${standing.w}-${standing.l}`,
           leaders, bigWin, toughLoss, bestStreak, rookies, myAwards, allProMine };
}

function milestoneNews() {
  for (const roster of Object.values(S.league)) {
    for (const p of roster) {
      if (!p.stats.gp) continue;
      p.mstone = p.mstone || {};
      for (const [k, th, label] of MILESTONES) {
        if (!p.mstone[k] && (p.stats[k] || 0) >= th) {
          p.mstone[k] = true;
          S.news.unshift({ week: S.week + 1, season: S.seasonNum,
            text: `🎉 MILESTONE: ${p.name} (${p.teamId}) crosses ${th.toLocaleString()} ${label}${p.teamId === S.teamId ? " — that's your guy!" : ""}` });
        }
      }
    }
  }
}

function viewNews() {
  if (!S.news.length) return "<p class='dim'>No news yet — play some games.</p>";
  let html = "<h2>League News</h2>";
  let lastWk = null;
  for (const n of S.news) {
    const wk = `S${n.season} · Week ${n.week}`;
    if (wk !== lastWk) { html += `<h3 class="dim">${wk}</h3>`; lastWk = wk; }
    html += `<div class="newsline">${n.text}</div>`;
  }
  return html;
}

function viewBracket() {
  let html = "";
  // the answer everyone came for goes FIRST (it was buried under awards/records/HOF)
  if (S.bracket && !S.playoffs) {
    const mine = S.bracket.champion === S.teamId;
    html += `<div class="coachcard champbox"><h2 class="champ" style="margin:4px 0">🏆 ${logo(S.bracket.champion, 40)}
      ${teamName(S.bracket.champion)} win the Gridiron Bowl!${mine ? " DYNASTY! 🎉🎉🎉" : ""}</h2></div>`;
  }
  html += `<p><b>Owner goal:</b> ${S.goal ? S.goal.text : "TBD"} · <b>Job security:</b> ${S.security}%</p>`;
  if (S.lastAwards) {
    const a = S.lastAwards;
    html += `<h3>Season ${S.lastAwardsSeason || S.seasonNum} Awards</h3><table>`;
    for (const [label, w] of [["MVP", a.mvp], ["Off. Player of the Year", a.opoy], ["Def. Player of the Year", a.dpoy], ["Rookie of the Year", a.roy]]) {
      if (w) html += `<tr><td><b>${label}</b></td><td>${chip(w.teamId)} ${w.id ? `<span class="pn" onclick="__gm.pcard(${w.id})">${w.name}</span>` : w.name} (${w.pos})</td><td class="dim">${w.line}</td></tr>`;
    }
    html += "</table>";
    if (S.lastAllPro && S.lastAllPro.length) {
      html += `<h3>★ Gridiron All-Pro Team</h3><table>`;
      for (const ap of S.lastAllPro) {
        html += `<tr><td><b>${ap.pos}</b></td><td>${chip(ap.teamId)} <span class="pn" onclick="__gm.pcard(${ap.id})">${ap.name}</span></td><td class="dim">${ap.line}</td></tr>`;
      }
      html += "</table>";
    }
  }
  const yb = S.yearbook;
  if (yb && yb.season === S.seasonNum) {
    html += `<h3>📖 Season ${yb.season} Yearbook — ${yb.record}</h3>`;
    html += `<div class="coachcard">`;
    if (yb.bigWin) html += `📈 <b>Signature win:</b> ${yb.bigWin.sc} over ${chip(yb.bigWin.opp)} ${teamName(yb.bigWin.opp)} (Week ${yb.bigWin.w})<br>`;
    if (yb.toughLoss) html += `📉 <b>The one that stung:</b> ${yb.toughLoss.sc} to ${chip(yb.toughLoss.opp)} ${teamName(yb.toughLoss.opp)} (Week ${yb.toughLoss.w})<br>`;
    if (yb.bestStreak >= 2) html += `🔥 <b>Longest win streak:</b> ${yb.bestStreak} games<br>`;
    if (yb.myAwards.length) html += `🏆 <b>Hardware:</b> ${yb.myAwards.join(" · ")}<br>`;
    if (yb.allProMine.length) html += `★ <b>All-Pros:</b> ${yb.allProMine.join(", ")}<br>`;
    html += `</div>`;
    if (yb.leaders.length) {
      html += `<table><tr class="hdr"><td>Team leader</td><td>Player</td><td>Line</td></tr>`;
      for (const L of yb.leaders) html += `<tr><td>${L.label}</td><td><span class="pn" onclick="__gm.pcard(${L.id})">${L.name}</span> <span class="dim">${L.pos}</span></td><td class="dim">${L.line}</td></tr>`;
      html += `</table>`;
    }
    if (yb.rookies.length) {
      html += `<h3>🎓 Rookie report card</h3><table><tr class="hdr"><td>Grade</td><td>Rookie</td><td>Season</td></tr>`;
      for (const r of yb.rookies) html += `<tr><td><b class="${r.grade === "A" || r.grade === "B" ? "win" : r.grade === "—" ? "dim" : ""}">${r.grade}</b></td><td><span class="pn" onclick="__gm.pcard(${r.id})">${r.name}</span> <span class="dim">${r.pos} ${r.ovr}</span></td><td class="dim">${r.line}</td></tr>`;
      html += `</table>`;
    }
  }
  if (S.records && S.records.player && Object.keys(S.records.player).length) {
    html += `<h3>📜 Record Book (single season)</h3><table>`;
    for (const [key, label] of RECORD_KEYS) {
      const r = S.records.player[key];
      if (r) html += `<tr><td>${label}</td><td>${chip(r.teamId)} ${r.name}</td><td><b>${r.value}</b></td><td class="dim">S${r.season}</td></tr>`;
    }
    if (S.records.teamWins) {
      const tw = S.records.teamWins;
      html += `<tr><td>team wins</td><td>${chip(tw.teamId)} ${teamName(tw.teamId)}</td><td><b>${tw.value}</b></td><td class="dim">S${tw.season}</td></tr>`;
    }
    html += "</table>";
  }
  if (S.hof.length) {
    html += `<h3>🏛️ Hall of Fame</h3><table>`;
    for (const h of [...S.hof].reverse().slice(0, 15)) {
      const idx = S.hof.indexOf(h);
      html += `<tr><td><span class="pn" onclick="__gm.hofCard(${idx})">${h.name}</span> (${h.pos})</td><td class="dim">${h.seasons} seasons · retired S${h.seasonRetired}</td></tr>`;
    }
    html += "</table>";
  }
  const roundHtml = r => {
    let h = `<p><b>${r.name}:</b></p>`;
    if (r.games) {
      for (const g of r.games) {
        const wChip = id => id === g.winner ? `<b>${chip(id)} ${g.winner === g.home ? g.hs : g.as}</b>` : `${chip(id)} ${id === g.home ? g.hs : g.as}`;
        h += `<div class="newsline">${wChip(g.away)} @ ${wChip(g.home)} — <b>${teamName(g.winner)}</b> advance${g.winner === S.teamId ? " 🎉" : ""}${(g.home === S.teamId || g.away === S.teamId) && g.winner !== S.teamId ? " 💔" : ""}</div>`;
      }
    } else {
      h += `<p class="dim">${r.winners.map(w => chip(w) + " " + teamName(w)).join(" · ")} advance</p>`;
    }
    return h;
  };
  if (S.playoffs) {
    const P = S.playoffs;
    html += `<h3>🏆 Playoff Picture — ${PLAYOFF_STAGES[P.stage]} up next</h3>`;
    // next-round matchup preview
    let preview = [];
    if (P.stage === 3) {
      preview.push(`${teamName(P.champs.NFC)} vs ${teamName(P.champs.AFC)}`);
    } else {
      for (const conf of ["NFC", "AFC"]) {
        const seedsArr = conf === "NFC" ? P.nfcSeeds : P.afcSeeds;
        const alive = conf === "NFC" ? P.nfcAlive : P.afcAlive;
        const { bye, pairs } = nextPlayoffRound(seedsArr, alive);
        if (bye) preview.push(`${teamName(bye)} — BYE`);
        for (const [h2, a2] of pairs) {
          const mine = h2 === S.teamId || a2 === S.teamId;
          preview.push(`${mine ? "⭐ " : ""}${teamName(a2)} (${rec(a2)}) @ ${teamName(h2)} (${rec(h2)})`);
        }
      }
    }
    html += preview.map(x => `<div class="newsline">${x}</div>`).join("");
    html += `<p class="win">Hit PLAY ${PLAYOFF_STAGES[P.stage].toUpperCase()} to run it.</p>`;
    for (const r of [...P.rounds].reverse()) html += roundHtml(r);
    return html;
  }
  if (!S.bracket) return html + "<p class='dim'>Playoffs not yet simulated this season.</p>";
  html += "<h3>Playoff Bracket</h3>";
  for (const r of [...S.bracket.rounds].reverse()) html += roundHtml(r);
  if (S.history.length) {
    html += "<h3>Franchise history</h3><table><tr class='hdr'><td>Season</td><td>Your record</td><td>Champion</td></tr>";
    for (const h of S.history) html += `<tr><td>${h.season}</td><td>${h.record}</td><td>${chip(h.champ)} ${teamName(h.champ)}</td></tr>`;
    html += "</table>";
  }
  return html;
}

function viewBoxScore() {
  const b = S.lastBox;
  if (!b) return "<p class='dim'>No completed game yet — play a week first.</p>";
  const secDefs = [
    ["Passing", p => p.g.passYd != null || p.g.passTD != null,
      p => `${p.g.passYd || 0} yds, ${p.g.passTD || 0} TD, ${p.g.ints || 0} INT`],
    ["Rushing", p => p.g.rushYd != null || p.g.car != null,
      p => `${p.g.car || 0} car, ${p.g.rushYd || 0} yds (${p.g.car ? ((p.g.rushYd || 0) / p.g.car).toFixed(1) : "0.0"} ypc)${p.g.rushTD ? ", " + p.g.rushTD + " TD" : ""}`],
    ["Receiving", p => p.g.recYd != null || p.g.rec != null,
      p => `${p.g.rec || 0} rec, ${p.g.recYd || 0} yds${p.g.recTD ? ", " + p.g.recTD + " TD" : ""}`],
    ["Defense", p => p.g.tackles != null || p.g.sacks != null || p.g.defInts != null,
      p => `${p.g.tackles || 0} tkl${p.g.sacks ? ", " + p.g.sacks + " sck" : ""}${p.g.defInts ? ", " + p.g.defInts + " INT" : ""}`],
    ["Kicking", p => p.g.fga != null, p => `${p.g.fgm || 0}/${p.g.fga || 0} FG`],
  ];
  let html = `<h2>Week ${b.week + 1}: ${teamName(b.away)} ${b.scoreAway} @ ${b.scoreHome} ${teamName(b.home)}</h2>`;
  html += `<div class="divgrid">`;
  for (const id of [b.away, b.home]) {
    html += `<div><h3>${chip(id)} ${teamName(id)}</h3>`;
    for (const [label, match, fmt] of secDefs) {
      const rows = (b.box[id] || []).filter(match);
      if (!rows.length) continue;
      // passing first by yds, defense by tackles, etc — sort by the most relevant magnitude
      rows.sort((x, y) => (y.g.passYd || y.g.rushYd || y.g.recYd || y.g.tackles || y.g.fga || 0) -
                          (x.g.passYd || x.g.rushYd || x.g.recYd || x.g.tackles || x.g.fga || 0));
      html += `<table><tr><th colspan=2>${label}</th></tr>`;
      for (const p of rows) html += `<tr><td>${p.name} <span class="dim">${p.pos}</span></td><td>${fmt(p)}</td></tr>`;
      html += `</table>`;
    }
    html += `</div>`;
  }
  return html + "</div>";
}

function viewStreetFA() {
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  let html = `<h2>Street Free Agents</h2>
    <p class="dim">Unsigned veterans available on 1-year deals — injury insurance. Cap room: <b>$${room === Infinity ? "∞" : room + "M"}</b> · Roster: ${S.league[S.teamId].length}/${ROSTER_MAX}</p>`;
  if (!S.streetFA || !S.streetFA.length) return html + "<p class='dim'>The street is empty this season.</p>";
  html += `<table><tr class="hdr"><td>Pos</td><td>Player</td><td>Age</td><td>OVR</td><td>Asking</td><td></td></tr>`;
  for (const p of S.streetFA.slice(0, 30)) {
    const hi = (ATTR_DEFS[p.pos] || []).map(k => `${k} ${attr(p, k)}`).join(" · ");
    html += `<tr><td>${p.pos}</td><td>${pn(p)}<br><span class="dim small">${hi}</span></td><td>${p.age}</td><td><b>${p.ovr}</b></td>
      <td>$${p.asking.salary}M × 1y</td>
      <td><button class="mini" onclick="__gm.signStreet(${p.id})">SIGN</button></td></tr>`;
  }
  return html + "</table>";
}

function viewFreeAgency() {
  if (!S.fa) return viewStreetFA();
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  let html = `<h2>Free Agency — Round ${Math.min(S.fa.round + 1, 3)}/3</h2>
    <p>Cap room: <b>$${room === Infinity ? "∞" : room + "M"}</b> · Roster: ${S.league[S.teamId].length}/${ROSTER_MAX}</p>`;
  if (S.training.length < 3) {
    html += `<div class="coachcard" style="border-left:4px solid #ffc62f">🎯 <b>Training camp is coming:</b>
      only ${S.training.length}/3 focuses set. Click attribute numbers on <b>My Roster</b> (works on rookies too) —
      they apply when the season starts.</div>`;
  }
  const mine = S.fa.pool.filter(p => p.lastTeamId === S.teamId);
  if (mine.length) {
    html += `<h3>Your expiring players (re-sign before they leave!)</h3><table>`;
    for (const p of mine.slice(0, 12)) {
      html += `<tr><td>${p.pos}</td><td>${pn(p)}</td><td>${p.age}y</td><td><b>${p.ovr}</b></td>
        <td>$${p.asking.salary}M × ${p.asking.years}y</td>
        <td><button class="mini" onclick="__gm.userSignFA(${p.id})">RE-SIGN</button></td></tr>`;
    }
    html += "</table>";
  }
  const market = S.fa.pool.filter(p => p.lastTeamId !== S.teamId);
  const marketShown = prospectPos === "ALL" ? market : market.filter(p => p.pos === prospectPos);
  html += `<h3>Open market — ${market.length} available</h3><p>${posTabs()}</p>
  <table><tr class="hdr"><td>Pos</td><td>Player</td><td>Age</td><td>OVR</td><td>Asking</td><td></td></tr>`;
  for (const p of marketShown.slice(0, 40)) {
    const hi = (ATTR_DEFS[p.pos] || []).map(k => `${k} ${attr(p, k)}`).join(" · ");
    html += `<tr><td>${p.pos}</td><td>${pn(p)}<br><span class="dim small">${hi}</span></td><td>${p.age}</td><td><b>${p.ovr}</b></td>
      <td>$${p.asking.salary}M × ${p.asking.years}y</td>
      <td><button class="mini" onclick="__gm.userSignFA(${p.id})">SIGN</button></td></tr>`;
  }
  html += "</table>";
  if (S.fa.signings.length) {
    html += `<h3>Recent signings</h3><div class="dim small">` +
      S.fa.signings.slice(0, 12).map(x => `${x.mine ? "⭐ " : ""}${chip(x.team)} signed ${x.name} (${x.pos}, ${x.ovr}) — $${x.salary}M`).join("<br>") + "</div>";
  }
  if (S.fa.news.length) {
    html += `<h3>Offseason news</h3><div class="dim small">` +
      S.fa.news.slice(0, 15).map(n => n.text).join("<br>") + "</div>";
  }
  return html;
}

let prospectPos = "ALL";
function posTabs() {
  return ["ALL", "QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"].map(x =>
    `<button class="mini ${x === prospectPos ? "" : "off"}" onclick="__gm.prospectFilter('${x}')">${x}</button>`).join(" ");
}
function filterProspects(list) {
  return prospectPos === "ALL" ? list : list.filter(p => p.pos === prospectPos);
}

function viewScouting() {
  if (!S.nextClass || !S.nextClass.length) return "";
  const shown = filterProspects(S.nextClass);
  let html = `<h2>Scouting — next draft class</h2>
    <p>Scout points: <b>${S.scoutPts}</b> <span class="dim tt" title="1st point on a prospect tightens his range. 2nd point reveals exact rating + ceiling. You gain +2 points per week (max 24 banked) — scout all season, don't hoard.">(?)</span>
    &nbsp; ${posTabs()}</p>
    <p class="dim small">${S.nextClass.length} prospects in the class · showing ${Math.min(60, shown.length)} of ${shown.length}${prospectPos === "ALL" ? "" : " at " + prospectPos}</p>
    <table><tr class="hdr"><td>#</td><td>Pos</td><td>Prospect</td><td>Age</td><td>Scouted</td><td>Ceiling</td><td></td></tr>`;
  shown.slice(0, 60).forEach((p, i) => {
    const range = p.scoutLo === p.scoutHi ? `<b>${p.scoutLo}</b>` : `${p.scoutLo}–${p.scoutHi}`;
    const btn = (p.scouted || 0) >= 2 ? "<span class='dim small'>fully scouted</span>"
      : S.scoutPts > 0 ? `<button class="mini" onclick="__gm.scout(${p.id})">SCOUT (1pt)</button>` : "";
    html += `<tr><td>${i + 1}</td><td>${p.pos}</td><td>${p.name}</td><td>${p.age}</td>
      <td>${range}</td><td class="dim small">${p.ceiling || ""}</td><td>${btn}</td></tr>`;
  });
  return html + "</table>";
}

function viewDraft() {
  if (!S.draft) {
    const sc = viewScouting();
    return sc || "<p class='dim'>The draft follows free agency.</p>";
  }
  const D = S.draft;
  const slot = D.slots[D.idx] || D.slots[D.slots.length - 1];
  const onClock = slot.owner;
  const myClock = onClock === S.teamId;
  let html = `<div class="draftbanner"><div class="draftbanner-inner">
      <h2 style="margin:0">🏈 DRAFT DAY — Round ${slot.round}, Pick ${(D.idx % 32) + 1}</h2>
      <p style="margin:6px 0 0">On the clock: ${chip(onClock)} <b>${teamName(onClock)}</b>${myClock ? " — <b class='win'>YOUR PICK!</b>" : ""}</p>
    </div></div>`;
  // team needs summary
  const chart = depthChart(S.league[S.teamId]);
  const needs = Object.entries(TEMPLATE)
    .filter(([pos, want]) => chart[pos].length < want || (chart[pos][0] && chart[pos][0].ovr < 74))
    .map(([pos]) => pos);
  html += `<p class="dim">Your needs: ${needs.length ? needs.join(", ") : "none — best available"}</p>`;
  const myRemainingPicks = D.slots.slice(D.idx).filter(sl => sl.owner === S.teamId);
  const rookiePool = myRemainingPicks.reduce((sum, sl) => sum + rookieContract(sl.round).salary, 0);
  const dRoom = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  if (dRoom !== Infinity) {
    const short = rookiePool > dRoom;
    html += `<p class="${short ? "loss" : "dim"}">Cap room $${dRoom}M · your remaining picks will cost ~$${rookiePool.toFixed(1)}M in rookie contracts${short ? " — ⚠️ THIS WILL PUT YOU OVER THE CAP (trade picks or clear salary)" : ""}</p>`;
  }
  html += `<p>${posTabs()}</p>
  <table><tr class="hdr"><td>#</td><td>Pos</td><td>Prospect</td><td>Age</td><td>Scouted</td><td>Ceiling</td><td></td></tr>`;
  filterProspects(D.prospects).slice(0, 40).forEach((p, i) => {
    const range = p.scoutLo === p.scoutHi ? `<b>${p.scoutLo}</b>` : `${p.scoutLo}–${p.scoutHi}`;
    html += `<tr><td>${i + 1}</td><td>${p.pos}</td><td>${p.name}</td><td>${p.age}</td>
      <td>${range}</td><td class="dim small">${p.ceiling || ""}</td>
      <td>${myClock ? `<button class="mini" onclick="__gm.userDraftPickById(${p.id})">PICK</button>` : ""}</td></tr>`;
  
  });
  html += "</table>";
  if (D.log.length) {
    html += `<h3>Recent picks</h3><div class="dim small">` +
      D.log.slice(0, 14).map(x => `${x.mine ? "⭐ " : ""}R${x.round}P${x.pick} ${chip(x.team)}${x.via ? " (via " + x.via + ")" : ""} — ${x.name} (${x.pos})`).join("<br>") + "</div>";
  }
  return html;
}

function viewFinances() {
  const roster = [...S.league[S.teamId]].sort((a, b) => b.contract.salary - a.contract.salary);
  const pr = payroll(roster);
  const dead = S.deadMoney[S.teamId] || 0;
  const room = capRoom(roster, dead, S.capMode);
  const capTxt = S.capMode === "none" ? "No cap (sandbox)" :
    S.capMode === "soft" ? `Soft cap $${CAP_LIMIT}M (can exceed to $${Math.round(CAP_LIMIT * 1.15)}M)` :
    `Hard cap $${CAP_LIMIT}M`;
  let html = `<h2>Finances</h2>`;
  if (room !== Infinity && room < 0) {
    html += `<div class="coachcard" style="border-left:4px solid #ff7b72"><b class="loss">⚠️ $${Math.abs(room).toFixed(1)}M OVER THE CAP.</b>
      You can't sign or acquire salary. Escape routes: TRADE players for picks (salary-shedding trades are always allowed), or CUT (30% dead money, 70% relief).</div>`;
  }
  html += `<p>${capTxt}<br>Payroll: <b>$${pr}M</b> · Dead money: $${dead}M · Room: <b class="${room !== Infinity && room < 10 ? "loss" : "win"}">$${room === Infinity ? "∞" : room + "M"}</b></p>
    <table><tr class="hdr"><td>Pos</td><td>Player</td><td>Age</td><td>OVR</td><td>Salary</td><td>Years</td><td></td></tr>`;
  for (const p of roster) {
    let ext = "";
    if (p.contract.years === 1 && S.phase === "season") {
      const ask = extensionAsk(p);
      ext = `<button class="mini" onclick="__gm.userExtend(${p.id})"
        title="Extend before he hits free agency">EXTEND $${ask.salary}M×${ask.years}</button> `;
    }
    const expiring = p.contract.years === 1 ? ' <span class="loss small">expiring</span>' : "";
    html += `<tr${p.real ? "" : ' class="genp"'}><td>${p.pos}</td><td>${pn(p)}${expiring}</td><td>${p.age}</td><td>${p.ovr}</td>
      <td>$${p.contract.salary}M</td><td>${p.contract.years}</td>
      <td>${ext}<button class="mini danger" onclick="__gm.userCut(${p.id})">CUT</button></td></tr>`;
  }
  return html + "</table><div class='dim small'>Extend expiring players during the season to keep them off the market (they charge a premium for security).</div>";
}

function coachCard(c, extra = "") {
  const stars = "★".repeat(c.quality) + "☆".repeat(3 - c.quality);
  return `<div class="coachcard"><b>${c.name}</b> <span class="dim">${stars}</span><br>
    <b>${SCHEMES[c.scheme].name}</b> — <span class="dim">${SCHEMES[c.scheme].desc}</span>${extra}</div>`;
}

function viewCoach() {
  const c = S.coaches[S.teamId];
  const u = teamUnits(S.league[S.teamId]);
  const fit = coachFit(c, u);
  const m = coachMods(c, u);
  const fmt = v => (v >= 0 ? "+" : "") + v.toFixed(1);
  let html = `<h2>Coaching & Team Identity</h2>` + coachCard(c,
    `<br><span class="tt" title="How well your roster suits the scheme. Build the right units and the identity bonus grows.">Roster fit: <b>${Math.round(fit * 100)}%</b></span>
     · Effect: <span class="dim">Pass off ${fmt(m.offPass)} · Run off ${fmt(m.offRun)} · Pass def ${fmt(m.defPass)} · Run def ${fmt(m.defRun)}</span>`);
  html += `<p class="dim small">Your coach's scheme is your team identity. Want a "defense team"? Hire a Defense First coach and stack defenders — the fit bonus amplifies them. Identity changes are offseason-only (free agency window).</p>`;
  if (S.phase === "freeagency" && S.coachMarket.length) {
    html += `<h3>Available coaches (hire replaces your current coach)</h3>`;
    S.coachMarket.forEach((cand, i) => {
      html += coachCard(cand, ` <button class="mini" onclick="__gm.hireCoach(${i})">HIRE</button>`);
    });
  } else {
    html += `<p class="dim">Coach market opens during free agency.</p>`;
  }
  return html;
}

function tradesOpen() {
  return (S.phase === "season" && S.week <= 8) || S.phase === "freeagency";
}

function viewTrades() {
  if (!tradesOpen()) return `<h2>Trade Center</h2><p class='dim'>Trades are open weeks 1–9 and during free agency. ${S.phase === "season" ? "The deadline has passed for this season." : ""}</p>`;
  if (!S.tradeUI) S.tradeUI = { partner: S.teamId === "GB" ? "CHI" : "GB", mine: [], theirs: [], minePicks: [], theirPicks: [], mineFPicks: [], theirFPicks: [], verdict: null };
  if (!S.tradeUI.mineFPicks) { S.tradeUI.mineFPicks = []; S.tradeUI.theirFPicks = []; } // migrate open UIs
  let offerHtml = "";
  if (S.aiOffer) {
    const o = S.aiOffer;
    const giveDesc = o.giveIds.map(id => {
      const p = S.league[o.from].find(x => x.id === id);
      return p ? `${p.name} (${p.pos} ${p.ovr})` : null;
    }).filter(Boolean).concat(o.givePicks.map(r => `R${r} pick`))
      .concat((o.giveFPicks || []).map(r => `next-yr R${r} pick`)).join(" + ");
    offerHtml = `<div class="coachcard offer"><b>📞 INCOMING OFFER</b> — ${chip(o.from)} ${teamName(o.from)} want
      <b>${o.wantName}</b> (${o.wantPos}) and offer: <b>${giveDesc || "nothing?"}</b>
      <br><button class="mini" onclick="__gm.acceptOffer()">ACCEPT</button>
      <button class="mini danger" onclick="__gm.rejectOffer()">REJECT</button>
      <span class="dim small"> expires in ${Math.max(0, S.aiOffer.week + 3 - S.week)} wk</span></div>`;
  }
  const T = S.tradeUI;
  const partners = TEAMS.filter(t => t.id !== S.teamId);
  let html = `<h2>Trade Center</h2>${offerHtml}<p>Partner:
    <select onchange="__gm.tradePartner(this.value)">` +
    partners.map(t => `<option value="${t.id}" ${t.id === T.partner ? "selected" : ""}>${t.city} ${t.name}</option>`).join("") +
    `</select></p><div class="divgrid">`;
  const side = (teamId, sel, picksSel, tag) => {
    const roster = [...S.league[teamId]].sort((a, b) => b.ovr - a.ovr); // FULL roster
    let h = `<div><h3>${chip(teamId)} send: <span class="dim small">(${roster.length} players)</span></h3><div class="scrollbox"><table>`;
    for (const p of roster) {
      const on = sel.includes(p.id);
      h += `<tr class="${on ? "me" : ""}"><td><input type="checkbox" ${on ? "checked" : ""}
        onchange="__gm.tradeToggle('${tag}', ${p.id})"></td>
        <td>${p.pos} ${p.name}</td><td>${p.age}y <b>${p.ovr}</b></td>
        <td class="dim tt" title="Trade value">${playerValue(p)}v</td></tr>`;
    }
    h += `</table></div><div>Picks: `;
    for (const k of [...S.picks[teamId]].sort((x, y) => x.round - y.round)) {
      const on = picksSel.includes(k.round);
      h += `<label><input type="checkbox" ${on ? "checked" : ""}
        onchange="__gm.tradeTogglePick('${tag}', ${k.round})"> R${k.round}${k.from !== teamId ? " (via " + k.from + ")" : ""}</label> `;
    }
    const fSel = tag === "mine" ? T.mineFPicks : T.theirFPicks;
    h += `</div><div class="tt" title="Next year's picks trade at a discount (~60% of a current pick). Sell them to win now; collect them to rebuild.">Next-year picks: `;
    for (const k of [...S.futurePicks[teamId]].sort((x, y) => x.round - y.round)) {
      const on = fSel.includes(k.round);
      h += `<label><input type="checkbox" ${on ? "checked" : ""}
        onchange="__gm.tradeTogglePick('${tag}', ${k.round}, true)"> R${k.round}${k.from !== teamId ? " (via " + k.from + ")" : ""}</label> `;
    }
    return h + `</div></div>`;
  };
  html += side(S.teamId, T.mine, T.minePicks, "mine");
  html += side(T.partner, T.theirs, T.theirPicks, "theirs");
  html += `</div><p><button class="advance" onclick="__gm.tradePropose()">PROPOSE TRADE</button></p>`;
  if (T.verdict) html += `<p class="${T.verdict.accept ? "win" : "loss"}"><b>${T.verdict.accept ? "ACCEPTED" : "REJECTED"}:</b> ${T.verdict.reason}</p>`;
  return html;
}

const VIEWS = {
  standings: viewStandings, roster: viewRoster, schedule: viewSchedule,
  leaders: viewLeaders, playoffs: viewBracket, boxscore: viewBoxScore,
  freeagency: viewFreeAgency, draft: viewDraft, finances: viewFinances,
  news: viewNews, coach: viewCoach, trades: viewTrades,
};
let activeView = "schedule";

// Awards Night: once per season, when the offseason begins, walk the four awards
// on stage — ROY -> DPOY -> OPOY -> MVP, saving the big one for last.
function runAwardsNight() {
  S.awardsCeremonySeason = S.seasonNum;
  save();
  const seq = [
    ["ROOKIE OF THE YEAR", S.lastAwards.roy],
    ["DEFENSIVE PLAYER OF THE YEAR", S.lastAwards.dpoy],
    ["OFFENSIVE PLAYER OF THE YEAR", S.lastAwards.opoy],
    ["MOST VALUABLE PLAYER", S.lastAwards.mvp],
  ].filter(x => x[1]);
  if (S.lastAllPro && S.lastAllPro.length) seq.push(["__ALLPRO__", null]);
  if (!seq.length) return;
  const div = document.createElement("div");
  div.id = "awardsNight";
  document.body.appendChild(div);
  let i = 0;
  const show = () => {
    if (i >= seq.length) { div.remove(); return; }
    const [label, w] = seq[i++];
    sfx.fanfare();
    if (label === "__ALLPRO__") {
      const mineCt = S.lastAllPro.filter(ap => ap.teamId === S.teamId).length;
      div.innerHTML = `<div class="revealcard">
        <div class="dim" style="letter-spacing:3px">AWARDS NIGHT — SEASON ${S.seasonNum}</div>
        <h2 class="champ" style="margin:12px 0 6px">★ GRIDIRON ALL-PRO TEAM</h2>
        <div style="text-align:left;display:inline-block;margin:6px 0">` +
        S.lastAllPro.map(ap => `<div style="margin:3px 0"><b style="display:inline-block;width:34px">${ap.pos}</b> ${logo(ap.teamId, 18)} ${ap.name}${ap.teamId === S.teamId ? " ⭐" : ""}</div>`).join("") +
        `</div>${mineCt ? `<p class="win" style="margin:8px 0">⭐ ${mineCt} OF YOURS MADE THE TEAM! ⭐</p>` : ""}
        <button class="revealbtn">CLOSE THE CURTAIN 🏆</button></div>`;
      div.querySelector(".revealbtn").onclick = show;
      return;
    }
    const mine = w.teamId === S.teamId;
    div.innerHTML = `<div class="revealcard">
      <div class="dim" style="letter-spacing:3px">AWARDS NIGHT — SEASON ${S.seasonNum}</div>
      <h2 class="champ" style="margin:12px 0 6px">${label}</h2>
      <p style="font-size:26px;margin:10px 0">${logo(w.teamId, 36)} <b>${w.name}</b> <span class="dim">(${w.pos}, ${w.teamId})</span></p>
      <p style="margin:4px 0">${w.line}</p>
      ${mine ? '<p class="win" style="margin:8px 0">⭐ THAT\'S YOUR GUY! ⭐</p>' : ""}
      <button class="revealbtn">${i >= seq.length ? "CLOSE THE CURTAIN 🏆" : "NEXT AWARD ▶"}</button></div>`;
    div.querySelector(".revealbtn").onclick = show;
  };
  show();
}

function render() {
  if (S && S.phase === "offseason" && S.lastAwards && S.awardsCeremonySeason !== S.seasonNum
      && !document.getElementById("awardsNight")) {
    runAwardsNight();
  }
  if (S && S.phase === "fired") {
    $("#topbar").innerHTML = `<b>GRIDIRON GM</b>`;
    const candidates = [...TEAMS].map(t => {
      const u = teamUnits(S.league[t.id]);
      return { t, v: (u.offPass + u.offRun + u.defPass + u.defRun) / 4 };
    }).sort((a, b) => a.v - b.v).slice(0, 10);
    $("#content").innerHTML = `<h2 class="loss">YOU'RE FIRED.</h2>
      <p>After ${S.seasonNum} season${S.seasonNum > 1 ? "s" : ""}, ${teamName(S.teamId)} ownership has moved on.
      Your record: ${S.history.map(h => h.record).join(", ")}.</p>
      <h3>Rebuild elsewhere — these franchises will take your call:</h3>
      <div class="pickgrid">` + candidates.map(c =>
        `<button class="pick" data-id="${c.t.id}" style="border-color:${c.t.color}" onclick="__gm.takeOver('${c.t.id}')">
          ${logo(c.t.id, 30)} <b>${c.t.id}</b> ${c.t.city} ${c.t.name}</button>`).join("") + `</div>
      <p class="dim small">…or use "Reset franchise" in the nav to start completely over.</p>`;
    return;
  }
  renderTop();
  document.querySelectorAll("nav button").forEach(b =>
    b.classList.toggle("active", b.dataset.view === activeView));
  $("#content").innerHTML = VIEWS[activeView]();
}

// Player of the Game: best statline on the winning side (whole game on a tie).
// Same weighting family as computeAwards so "best" feels consistent.
function playerOfTheGame(myGame, hs, as) {
  const winner = hs > as ? myGame.home : as > hs ? myGame.away : null;
  const pool = [];
  for (const [team, side] of Object.entries(myGame.box)) {
    if (winner && team !== winner) continue;
    for (const e of side) pool.push({ team, ...e });
  }
  const sc = g => (g.passYd || 0) + (g.passTD || 0) * 40 - (g.ints || 0) * 25 +
    ((g.rushYd || 0) + (g.recYd || 0)) * 1.2 + ((g.rushTD || 0) + (g.recTD || 0)) * 40 +
    (g.sacks || 0) * 45 + (g.defInts || 0) * 55 + (g.fgm || 0) * 10;
  const best = pool.reduce((b, p) => (!b || sc(p.g) > sc(b.g)) ? p : b, null);
  if (!best || sc(best.g) < 40) return null;   // nobody popped — skip the honor
  const g = best.g, parts = [];
  if (g.passYd) parts.push(`${g.passYd} pass yds${g.passTD ? `, ${g.passTD} TD` : ""}`);
  if (g.rushYd) parts.push(`${g.rushYd} rush yds${g.rushTD ? `, ${g.rushTD} TD` : ""}`);
  if (g.recYd) parts.push(`${g.rec || 0} rec, ${g.recYd} yds${g.recTD ? `, ${g.recTD} TD` : ""}`);
  if (g.sacks) parts.push(`${g.sacks} sacks`);
  if (g.defInts) parts.push(`${g.defInts} INT`);
  if (!parts.length && g.fgm) parts.push(`${g.fgm}/${g.fga || g.fgm} FG`);
  return { ...best, line: parts.join(" · ") };
}

// ---------------------------------------------------------------- ticker
// ~30s pacing (user decision): drive log ≈ 22-24 entries → ~1.15s each. Skippable.
function runTicker(myGame, results, done) {
  const overlay = $("#ticker");
  // Weather-matched stadium backdrop (Meshy paintings). Missing file -> the
  // gradient just sits on the flat dark background, exactly as before.
  const wxT = myGame.weather ? myGame.weather.type : null;
  const scene = myGame.bowl ? "bowl"
    : STADIUM.dome.includes(myGame.home) ? "dome"
    : wxT === "snow" ? "snow" : wxT === "rain" ? "rain"
    : (wxT === "cold" || wxT === "wind") ? "cold" : "clear";
  overlay.style.backgroundImage =
    `linear-gradient(rgba(10,12,16,.82), rgba(10,12,16,.93)), url('img/stadium_${scene}.png')`;
  overlay.classList.remove("hidden");
  startCrowd();
  const home = myGame.home, away = myGame.away;
  let hs = 0, as = 0, i = 0;
  const log = myGame.log;
  const drivesEl = $("#tickerLog");
  drivesEl.innerHTML = "";
  if (myGame.weather) {
    const w = myGame.weather;
    const wline = document.createElement("div");
    wline.className = "tline";
    wline.textContent = `${w.icon} Conditions in ${TEAM_BY_ID[home].city}: ${w.desc}`;
    drivesEl.prepend(wline);
  } else if (myGame.bowl) {
    const bline = document.createElement("div");
    bline.className = "tline";
    bline.textContent = "🏆 THE GRIDIRON BOWL — neutral site, perfect conditions. For all of it.";
    drivesEl.prepend(bline);
  }
  const scoreEl = $("#tickerScore");
  $("#tickerBox").classList.add("hidden");
  const step = () => {
    if (i >= log.length) {
      $("#tickerSkip").textContent = "CONTINUE ▶";
      $("#tickerBox").classList.remove("hidden");
      scoreEl.innerHTML = `<span class="qpill">FINAL</span> &nbsp; ${logo(away, 34)} <b>${as}</b> <span class="dim">—</span> <b>${hs}</b> ${logo(home, 34)}`;
      const potg = playerOfTheGame(myGame, hs, as);
      if (potg) {
        const pl = document.createElement("div");
        pl.className = "tline potg";
        pl.textContent = `⭐ PLAYER OF THE GAME: ${potg.name} (${potg.pos}, ${potg.team}) — ${potg.line}`;
        drivesEl.prepend(pl);
        drivesEl.scrollTop = 0;
      }
      return;
    }
    const d = log[i++];
    if (d.off === home) hs += d.points; else as += d.points;
    if (d.defPoints) { if (d.off === home) as += d.defPoints; else hs += d.defPoints; }
    const clockTxt = d.q === 5 ? "OVERTIME" : `Q${d.q} · ${d.clock || ""}`;
    scoreEl.innerHTML = `${logo(away, 34)} <b>${as}</b> <span class="dim">—</span> <b>${hs}</b> ${logo(home, 34)}
      &nbsp;<span class="qpill">${clockTxt}</span>`;
    const conv = d.conv === "2G" ? " +2-POINT CONVERSION!" : d.conv === "2F" ? " (2-pt try FAILS)"
      : d.conv === "XM" ? " (XP shanked!)" : "";
    const desc = ({
      TD: "TOUCHDOWN!" + conv, FG: "Field goal is GOOD", "FG-MISS": "Field goal MISSES",
      PUNT: "drive stalls — punt",
      TO: d.downs ? "TURNOVER ON DOWNS — the gamble fails!" : "TURNOVER!",
      "OT-WIN": "wins it in overtime!",
      KNEEL: "kneels it out. That's the ballgame.",
      SAFETY: "SAFETY!! Swallowed up in his own end zone — 2 points!",
    })[d.result] || d.result;
    playDrive(d);
    const line = document.createElement("div");
    line.className = "tline" + (d.result === "TD" ? " td" : d.result === "TO" ? " to" : "");
    if (d.result !== "TD" && d.result !== "TO") {
      line.style.borderLeftColor = TEAM_BY_ID[d.off].color;
    }
    const who = d.scorer && (d.result === "TD" || d.result === "FG" || d.result === "FG-MISS")
      ? ` — ${d.scorer}` : "";
    const sf = (d.hurry ? "HURRY-UP — " : d.milk ? "grinding clock — " : "") +
      (d.start >= 50 ? "SHORT FIELD! " : d.start <= 10 ? "backed up... " : "");
    line.textContent = `${clockTxt} · ${teamName(d.off)} — ${sf}${d.yards ? d.yards + " yd drive, " : ""}${desc}${who}`;
    drivesEl.prepend(line);
    timer = setTimeout(step, 1150);
  };
  let timer = setTimeout(step, 400);
  $("#tickerSkip").onclick = () => {
    clearTimeout(timer);
    stopCrowd();
    overlay.classList.add("hidden");
    $("#tickerSkip").textContent = "SKIP ▶";
    done();
  };
  $("#tickerBox").onclick = () => {
    clearTimeout(timer);
    stopCrowd();
    overlay.classList.add("hidden");
    $("#tickerSkip").textContent = "SKIP ▶";
    activeView = "boxscore";
    done();
  };
}

// ---------------------------------------------------------------- advance
// forecast is deterministic: what THIS WEEK shows is what the game gets
const weatherFor = (homeId, week) => gameWeather(S.seed, S.seasonNum, week, homeId);

function advance() {
  if (S.phase === "season") {
    const rng = weekRng();
    const results = playWeek(rng, S.league, S.schedule, S.week, S.standings, aiStrategies(), S.coaches, coachMods, weatherFor);
    genWeeklyNews(results);
    const mg = results.find(g => g.home === S.teamId || g.away === S.teamId);
    if (mg) {
      const my = mg.home === S.teamId ? mg.scoreHome : mg.scoreAway;
      const their = mg.home === S.teamId ? mg.scoreAway : mg.scoreHome;
      const delta = my > their ? (my - their >= 17 ? 2 : 1) : (their - my >= 17 ? -2 : -1);
      S.security = Math.max(0, Math.min(100, S.security + delta));
    }
    S.scoutPts = Math.min(24, (S.scoutPts || 0) + 2); // scouts file weekly reports
    // AI teams occasionally call about your players (trade window only)
    if (S.aiOffer && S.week > S.aiOffer.week + 2) S.aiOffer = null; // offer expired
    if (!S.aiOffer && S.week <= 8 && rng.chance(0.22)) {
      const offer = genAIOffer(rng, S.league, S.picks, S.teamId, S.futurePicks);
      if (offer) {
        S.aiOffer = { ...offer, week: S.week };
        S.news.unshift({ week: S.week + 1, season: S.seasonNum,
          text: `📞 The ${TEAM_BY_ID[offer.from].name} are calling about ${offer.wantName} — check the Trade Center` });
      }
    }
    const myGame = results.find(g => g.home === S.teamId || g.away === S.teamId);
    if (myGame) {
      S.lastBox = { week: S.week, home: myGame.home, away: myGame.away,
        scoreHome: myGame.scoreHome, scoreAway: myGame.scoreAway, box: myGame.box };
    }
    const finish = () => {
      milestoneNews();
      S.week += 1;
      if (S.week >= 18) {
        S.phase = "postseason";
        // regular season closed: awards + records lock BEFORE playoff stats accumulate
        S.lastAwards = computeAwards(S.league);
        S.lastAllPro = computeAllPro(S.league);
        for (const ap of S.lastAllPro) {
          const p = findPlayerById(ap.id);
          if (p) p.allPro = (p.allPro || 0) + 1;   // badge shows on the player card
        }
        S.lastAwardsSeason = S.seasonNum;
        if (!S.records) S.records = {};
        const recNews = updateRecords(S.records, S.league, S.standings, S.seasonNum);
        for (const n of recNews) S.news.unshift({ week: 18, season: S.seasonNum, text: n.text });
      }
      S.lastResults = results.map(({ log, box, ...g }) => g);
      save(); render();
    };
    if (myGame) runTicker(myGame, results, finish);
    else finish(); // bye week
  } else if (S.phase === "postseason") {
    advancePlayoffs();
  } else if (S.phase === "offseason") {
    // awards + owner verdict first (stats still live), then retirements/contracts -> FA
    const s = S.standings[S.teamId];
    if (!S.lastAwards) S.lastAwards = computeAwards(S.league); // fallback for saves mid-transition
    const champion = S.bracket.champion === S.teamId;
    const madePlayoffs = ["NFC", "AFC"].some(c => seeds(S.standings, c).includes(S.teamId));
    let delta = 0;
    if (s.w >= S.goal.minWins + 2) delta += 18;
    else if (s.w >= S.goal.minWins) delta += 12;
    else if (s.w >= S.goal.minWins - 2) delta -= 10;
    else delta -= 22;
    if (madePlayoffs) delta += 8;
    if (champion) delta += 30;
    S.security = Math.max(0, Math.min(100, S.security + delta));
    S.yearbook = buildYearbook(s);
    S.history.push({ season: S.seasonNum, record: `${s.w}-${s.l}`, champ: S.bracket.champion,
      awards: S.lastAwards, security: S.security });
    if (S.security <= 20 && S.seasonNum >= 2 && !champion) {
      S.phase = "fired";
      save(); render();
      return;
    }
    startOffseasonPipeline();
  } else if (S.phase === "freeagency") {
    const rng = weekRng();
    if (S.fa.round < 3) {
      const signings = aiFreeAgencyRound(rng, S.league, S.fa.pool, S.capMode, S.deadMoney, S.teamId);
      for (const x of signings) {
        S.fa.signings.unshift({ team: x.team, name: x.p.name, pos: x.p.pos, ovr: x.p.ovr, salary: x.p.contract.salary });
      }
      S.fa.round += 1;
      save(); render();
    } else {
      const order = draftOrder(S.standings);
      const slots = [];
      for (let r = 1; r <= 7; r++) {
        for (const slotTeam of order) {
          const owner = Object.keys(S.picks).find(tid =>
            S.picks[tid].some(k => k.round === r && k.from === slotTeam)) || slotTeam;
          slots.push({ round: r, slotTeam, owner });
        }
      }
      S.draft = { slots, idx: 0, prospects: (S.nextClass && S.nextClass.length) ? S.nextClass : genDraftClass(rng), log: [] };
      S.nextClass = null;
      // unsigned free agents stay on the street — in-season injury insurance (1-yr cheap deals)
      S.streetFA = S.fa.pool.slice(0, 60).map(p => {
        p.asking = { salary: Math.max(0.8, Math.round(p.asking.salary * 0.7 * 10) / 10), years: 1 };
        return p;
      });
      S.phase = "draft";
      activeView = "draft";
      advanceDraftAI();
      save(); render();
    }
  } else if (S.phase === "draft") {
    advanceDraftAI();
    save(); render();
  }
}

// sim AI picks until the user is on the clock (or the draft ends). Slots respect traded picks.
function advanceDraftAI() {
  const D = S.draft;
  const rng = weekRng();
  while (D.idx < D.slots.length) {
    const slot = D.slots[D.idx];
    const teamId = slot.owner;
    if (teamId === S.teamId) {
      if (S.league[S.teamId].length < ROSTER_MAX && D.prospects.length) return; // your pick
    } else if (D.prospects.length && S.league[teamId].length < ROSTER_MAX) {
      const idx = aiPick(rng, S.league[teamId], D.prospects);
      const p = D.prospects.splice(idx, 1)[0];
      p.teamId = teamId; p.contract = rookieContract(slot.round);
      S.league[teamId].push(p);
      D.log.unshift({ round: slot.round, pick: (D.idx % 32) + 1, team: teamId, name: p.name, pos: p.pos,
        via: slot.slotTeam !== teamId ? slot.slotTeam : null });
    }
    D.idx += 1;
  }
  finishOffseason();
}

function userDraftPickById(id) {
  const i = S.draft.prospects.findIndex(x => x.id === id);
  if (i !== -1) userDraftPick(i);
}

function userDraftPick(i) {
  const D = S.draft;
  const slot = D.slots[D.idx];
  const p = D.prospects.splice(i, 1)[0];
  if (!p || !slot) return;
  p.teamId = S.teamId; p.contract = rookieContract(slot.round);
  S.league[S.teamId].push(p);
  D.log.unshift({ round: slot.round, pick: (D.idx % 32) + 1, team: S.teamId, name: p.name, pos: p.pos,
    mine: true, via: slot.slotTeam !== S.teamId ? slot.slotTeam : null });
  showPickReveal(p, slot, (D.idx % 32) + 1);
  D.idx += 1;
  advanceDraftAI();
  save(); render();
}

// Full-screen "THE PICK IS IN" card over the draft-stage art. User picks only —
// AI picks would spam it. Purely presentational; the pick is already executed.
function showPickReveal(p, slot, pickNo) {
  sfx.draftPick();
  const div = document.createElement("div");
  div.id = "pickReveal";
  const range = p.scoutLo === p.scoutHi ? `${p.scoutLo} ovr` : `${p.scoutLo}–${p.scoutHi} ovr`;
  div.innerHTML = `<div class="revealcard">
    <div class="dim" style="letter-spacing:3px">THE PICK IS IN</div>
    <h2 style="margin:10px 0 4px">Round ${slot.round}, Pick ${pickNo}</h2>
    <p style="margin:4px 0">${logo(S.teamId, 38)} <b>${teamName(S.teamId)}</b> select…</p>
    <h1 style="margin:12px 0;font-size:40px">${p.name}</h1>
    <p style="margin:4px 0"><b>${p.pos}</b> · age ${p.age} · scouted ${range}${p.ceiling ? ` · <span class="dim">${p.ceiling}</span>` : ""}</p>
    <button class="revealbtn">WELCOME ABOARD ▶</button></div>`;
  div.querySelector(".revealbtn").onclick = () => div.remove();
  document.body.appendChild(div);
}

function userSignFA(playerId) {
  const idx = S.fa.pool.findIndex(p => p.id === playerId);
  if (idx === -1) return;
  const p = S.fa.pool[idx];
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  if (S.league[S.teamId].length >= ROSTER_MAX) { alert("Roster is full (60)."); return; }
  if (p.asking.salary > room) { alert(`Not enough cap room ($${room}M left, asking $${p.asking.salary}M).`); return; }
  S.fa.pool.splice(idx, 1);
  p.contract = { salary: p.asking.salary, years: p.asking.years };
  p.teamId = S.teamId;
  S.league[S.teamId].push(p);
  S.fa.signings.unshift({ team: S.teamId, name: p.name, pos: p.pos, ovr: p.ovr, salary: p.contract.salary, mine: true });
  save(); render();
}

function userCut(playerId) {
  const p = S.league[S.teamId].find(x => x.id === playerId);
  if (!p) return;
  if (!legalAfterLoss(S.league[S.teamId], [playerId])) {
    alert("You can't cut him — your depth chart would be illegally thin at " + p.pos + ".");
    return;
  }
  if (!confirm(`Cut ${p.name}? $${(p.contract.salary * 0.3).toFixed(1)}M dead money this season.`)) return;
  cutPlayer(S.league, S.deadMoney, S.teamId, playerId);
  save(); render();
}
function setLean(v) {
  S.strategy.passLean = Math.max(0.3, Math.min(0.75, (+v) / 100));
  save();
}
function setAgg(v) {
  S.strategy.aggression = Math.max(0.2, Math.min(0.8, (+v) / 100));
  save(); render();
}
function hireCoach(i) {
  const cand = S.coachMarket[i];
  if (!cand || S.phase !== "freeagency") return;
  S.news.unshift({ week: 0, season: S.seasonNum + 1, text: `${teamName(S.teamId)} hire ${cand.name} (${SCHEMES[cand.scheme].name})` });
  S.coaches[S.teamId] = cand;
  S.coachMarket.splice(i, 1);
  save(); render();
}

function tradePartner(id) {
  S.tradeUI = { partner: id, mine: [], theirs: [], minePicks: [], theirPicks: [], mineFPicks: [], theirFPicks: [], verdict: null };
  render();
}
function tradeToggle(side, pid) {
  const arr = side === "mine" ? S.tradeUI.mine : S.tradeUI.theirs;
  const i = arr.indexOf(pid);
  if (i === -1) arr.push(pid); else arr.splice(i, 1);
  S.tradeUI.verdict = null;
  render();
}
function tradeTogglePick(side, round, future) {
  const arr = future
    ? (side === "mine" ? S.tradeUI.mineFPicks : S.tradeUI.theirFPicks)
    : (side === "mine" ? S.tradeUI.minePicks : S.tradeUI.theirPicks);
  const i = arr.indexOf(round);
  if (i === -1) arr.push(round); else arr.splice(i, 1);
  S.tradeUI.verdict = null;
  render();
}
function tradePropose() {
  const T = S.tradeUI;
  if (!T || !tradesOpen()) return;
  const myAssets = { players: T.mine, picks: T.minePicks, fpicks: T.mineFPicks || [] };
  const theirAssets = { players: T.theirs, picks: T.theirPicks, fpicks: T.theirFPicks || [] };
  const verdict = evalTrade(S.league, S.picks, S.teamId, T.partner, myAssets, theirAssets);
  // user-side legality too: don't let a trade break your own minimums or cap
  if (verdict.accept) {
    const incoming = theirAssets.players.map(pid => S.league[T.partner].find(p => p.id === pid)).filter(Boolean);
    const inSalary = incoming.reduce((sum, p) => sum + p.contract.salary, 0);
    const outSalary = myAssets.players.map(pid => S.league[S.teamId].find(p => p.id === pid))
      .filter(Boolean).reduce((sum, p) => sum + p.contract.salary, 0);
    const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
    const delta = inSalary - outSalary;
    // cap-reducing (or neutral) trades are ALWAYS legal — they're how you escape cap hell
    if (room !== Infinity && delta > 0 && delta > room) {
      verdict.accept = false;
      verdict.reason = `You can't afford it — adds $${delta.toFixed(1)}M to payroll but you have $${room}M room.`;
    } else if (S.league[S.teamId].length - myAssets.players.length + incoming.length > ROSTER_MAX) {
      verdict.accept = false;
      verdict.reason = "Your roster would exceed 60.";
    } else if (!legalAfterLoss(S.league[S.teamId], myAssets.players)) {
      verdict.accept = false;
      verdict.reason = "That would leave YOUR depth chart illegally thin at a position.";
    }
  }
  T.verdict = verdict;
  if (verdict.accept) {
    const names = T.theirs.map(pid => (S.league[T.partner].find(p => p.id === pid) || {}).name).filter(Boolean);
    execTrade(S.league, S.picks, S.teamId, T.partner, myAssets, theirAssets, S.futurePicks);
    S.news.unshift({ week: S.week + 1, season: S.seasonNum, text: `TRADE: ${teamName(S.teamId)} acquire ${names.join(", ") || "picks"} from the ${TEAM_BY_ID[T.partner].name}` });
    S.tradeUI = { partner: T.partner, mine: [], theirs: [], minePicks: [], theirPicks: [], mineFPicks: [], theirFPicks: [], verdict };
  }
  save(); render();
}

function promote(playerId) {
  const roster = S.league[S.teamId];
  const p = roster.find(x => x.id === playerId);
  if (!p) return;
  // displayed (injury-aware) order determines WHO we swap with...
  const shown = depthChart(roster)[p.pos];
  const di = shown.findIndex(x => x.id === playerId);
  if (di <= 0) return;
  const above = shown[di - 1];
  // ...but we freeze the injury-INDEPENDENT order, so healed starters aren't left buried
  const base = roster.filter(x => x.pos === p.pos)
    .sort((a, b) => (a.depth != null ? a.depth : 900) - (b.depth != null ? b.depth : 900) || b.ovr - a.ovr);
  base.forEach((x, idx) => { x.depth = idx; });
  const tmp = p.depth; p.depth = above.depth; above.depth = tmp;
  save(); render();
}

function train(playerId, attrKey) {
  const i = S.training.findIndex(t => t.playerId === playerId && t.attr === attrKey);
  if (i !== -1) { S.training.splice(i, 1); save(); render(); return; }
  S.training = S.training.filter(t => t.playerId !== playerId); // one focus per player
  if (S.training.length >= 3) S.training.shift();
  S.training.push({ playerId, attr: attrKey, teamId: S.teamId });
  save(); render();
}

function scout(prospectId) {
  const p = (S.nextClass || []).find(x => x.id === prospectId);
  if (!p || S.scoutPts <= 0 || (p.scouted || 0) >= 2) return;
  S.scoutPts -= 1;
  scoutProspect(p);
  save(); render();
}

function dismissIntro() { S.sawIntro = true; save(); render(); }

// stable per-player extension asking price (seeded by player id — no reroll scumming)
function extensionAsk(p) {
  const r = makeRng(((S.seed ^ (p.id * 2654435761)) >>> 0));
  return contractFor(r, p, 1.15);
}

function userExtend(playerId) {
  const p = S.league[S.teamId].find(x => x.id === playerId);
  if (!p || p.contract.years !== 1 || S.phase !== "season") return;
  const ask = extensionAsk(p);
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  if (room !== Infinity && ask.salary - p.contract.salary > room) {
    alert(`Not enough cap room (needs $${(ask.salary - p.contract.salary).toFixed(1)}M more).`);
    return;
  }
  if (!confirm(`Extend ${p.name}: $${ask.salary}M × ${ask.years} years?`)) return;
  p.contract = { salary: ask.salary, years: ask.years };
  S.news.unshift({ week: S.week + 1, season: S.seasonNum,
    text: `${teamName(S.teamId)} extend ${p.name} ($${ask.salary}M/yr)` });
  save(); render();
}

function acceptOffer() {
  const o = S.aiOffer;
  if (!o) return;
  const stillMine = o.wantIds.every(id => S.league[S.teamId].some(p => p.id === id));
  const stillTheirs = o.giveIds.every(id => S.league[o.from].some(p => p.id === id));
  const picksTheirs = o.givePicks.every(r => S.picks[o.from].some(k => k.round === r)) &&
    (o.giveFPicks || []).every(r => S.futurePicks[o.from].some(k => k.round === r));
  if (!stillMine || !stillTheirs || !picksTheirs) {
    alert("The offer fell through — rosters changed since it was made.");
    S.aiOffer = null; save(); render(); return;
  }
  // same protections as manual trades: cap and roster room
  const incoming = o.giveIds.map(id => S.league[o.from].find(p => p.id === id)).filter(Boolean);
  const inSalary = incoming.reduce((sum, p) => sum + p.contract.salary, 0);
  const outSalary = o.wantIds.map(id => S.league[S.teamId].find(p => p.id === id))
    .filter(Boolean).reduce((sum, p) => sum + p.contract.salary, 0);
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  const offerDelta = inSalary - outSalary;
  if (room !== Infinity && offerDelta > 0 && offerDelta > room) {
    alert(`You can't afford this deal — adds $${offerDelta.toFixed(1)}M to payroll ($${room}M room).`);
    return;
  }
  if (S.league[S.teamId].length - o.wantIds.length + incoming.length > ROSTER_MAX) {
    alert("Your roster would exceed 60.");
    return;
  }
  const names = o.giveIds.map(id => (S.league[o.from].find(p => p.id === id) || {}).name).filter(Boolean);
  execTrade(S.league, S.picks, S.teamId, o.from,
    { players: o.wantIds, picks: [] },
    { players: o.giveIds, picks: o.givePicks, fpicks: o.giveFPicks || [] }, S.futurePicks);
  S.news.unshift({ week: S.week + 1, season: S.seasonNum,
    text: `TRADE: ${teamName(o.from)} land ${o.wantName}; ${teamName(S.teamId)} receive ${names.join(", ") || "picks"}${(o.givePicks.length || (o.giveFPicks || []).length) ? " + picks" : ""}` });
  S.aiOffer = null;
  save(); render();
}
function rejectOffer() { S.aiOffer = null; save(); render(); }

function signStreet(playerId) {
  const idx = (S.streetFA || []).findIndex(p => p.id === playerId);
  if (idx === -1) return;
  const p = S.streetFA[idx];
  const room = capRoom(S.league[S.teamId], S.deadMoney[S.teamId], S.capMode);
  if (S.league[S.teamId].length >= ROSTER_MAX) { alert("Roster is full (60)."); return; }
  if (p.asking.salary > room) { alert(`Not enough cap room ($${room}M left).`); return; }
  S.streetFA.splice(idx, 1);
  p.contract = { salary: p.asking.salary, years: 1 };
  p.teamId = S.teamId;
  p.stats = emptyStats();
  S.league[S.teamId].push(p);
  S.news.unshift({ week: S.week + 1, season: S.seasonNum, text: `${teamName(S.teamId)} sign ${p.name} (${p.pos}) off the street` });
  save(); render();
}

function goRoster() { activeView = "roster"; render(); }
function leadersFilter(cf) { leadersConf = cf; render(); }
function prospectFilter(x) { prospectPos = x; render(); }

window.__gm = { userDraftPick, userDraftPickById, userSignFA, userCut, setLean, setAgg, hireCoach, promote, train, scout, dismissIntro, leadersFilter, prospectFilter, signStreet, acceptOffer, rejectOffer, userExtend, goRoster,
  tradePartner, tradeToggle, tradeTogglePick, tradePropose, pcard, pcardByName, closePcard, hofCard };

function startOffseasonPipeline() {
    const rng = weekRng();
    archiveSeasonStats(S.league, S.seasonNum);
    for (const roster of Object.values(S.league)) for (const p of roster) { p.rookie = false; p.mstone = {}; }
    S.deadMoney = {}; for (const t of TEAMS) S.deadMoney[t.id] = 0;
    const news = ageAndRetire(rng, S.league);
    for (const n of news) if (n.type === "hof") S.hof.push({ ...n.inductee, seasonRetired: S.seasonNum });
    const pool = expireContracts(S.league);
    aiResign(rng, S.league, pool, S.capMode, S.deadMoney, S.teamId);
    for (const p of pool) p.asking = contractFor(rng, p, 1.05);
    S.fa = { pool, round: 0, news, signings: [] };
    // coaching carousel: bad AI teams change coaches; a fresh candidate market opens
    for (const t of TEAMS) {
      if (t.id !== S.teamId && S.standings[t.id].w <= 5 && rng.chance(0.4)) {
        S.coaches[t.id] = genCoach(rng);
      }
    }
    S.coachMarket = [genCoach(rng), genCoach(rng), genCoach(rng), genCoach(rng)];
  S.phase = "freeagency";
  activeView = "freeagency";
  save(); render();
}

function aiStrategies() {
  const strategies = { [S.teamId]: S.strategy };
  for (const t of TEAMS) {
    if (t.id === S.teamId) continue;
    const sch = (S.coaches[t.id] || {}).scheme;
    strategies[t.id] = { passLean: sch === "AIR" ? 0.66 : sch === "GROUND" ? 0.44 : 0.55,
      aggression: sch === "AIR" ? 0.58 : sch === "DEFENSE" ? 0.42 : sch === "GROUND" ? 0.46 : 0.5 };
  }
  return strategies;
}

const PLAYOFF_STAGES = ["Wild Card", "Divisional Round", "Conference Championships", "GRIDIRON BOWL"];

// one ADVANCE = one playoff round (your game plays on the ticker); if you're not involved,
// remaining rounds resolve in the same click.
function advancePlayoffs() {
  const rng = weekRng();
  if (!S.playoffs) {
    S.playoffs = { stage: 0, rounds: [],
      nfcSeeds: seeds(S.standings, "NFC"), afcSeeds: seeds(S.standings, "AFC"),
      nfcAlive: null, afcAlive: null, champs: {} };
    S.playoffs.nfcAlive = [...S.playoffs.nfcSeeds];
    S.playoffs.afcAlive = [...S.playoffs.afcSeeds];
  }
  const P = S.playoffs;
  const strategies = aiStrategies();
  const mk = id => ({ id, players: S.league[id], strategy: strategies[id], coach: S.coaches[id] });

  // ONE round per click — even when you're out, every round is its own event
  let games = [];
  if (P.stage === 3) {
    const home = rng.chance(0.5) ? P.champs.NFC : P.champs.AFC;
    const away = home === P.champs.NFC ? P.champs.AFC : P.champs.NFC;
    games.push({ conf: "NFL", home, away });
  } else {
    for (const conf of ["NFC", "AFC"]) {
      const seedsArr = conf === "NFC" ? P.nfcSeeds : P.afcSeeds;
      const alive = conf === "NFC" ? P.nfcAlive : P.afcAlive;
      const { pairs } = nextPlayoffRound(seedsArr, alive);
      for (const [h, a] of pairs) games.push({ conf, home: h, away: a });
    }
  }
  // playoff week passes: injured players heal one week per round
  for (const roster of Object.values(S.league)) {
    for (const pl of roster) if (pl.injuredWeeks > 0) pl.injuredWeeks--;
  }
  const winners = { NFC: [], AFC: [], NFL: [] };
  const played = [];
  let myGame = null;
  for (const g of games) {
    // January football is weather football — except the neutral-site Bowl
    const wx = P.stage === 3 ? null : weatherFor(g.home, 18 + P.stage);
    const r = simGame(rng, mk(g.home), mk(g.away), g.home, coachMods, wx);
    const w = r.winner, l = w === g.home ? g.away : g.home;
    winners[g.conf].push(w);
    played.push({ conf: g.conf, home: g.home, away: g.away, hs: r.scoreA, as: r.scoreB, winner: w });
    S.news.unshift({ week: 19 + P.stage, season: S.seasonNum,
      text: `PLAYOFFS (${PLAYOFF_STAGES[P.stage]}): ${teamName(w)} eliminate the ${TEAM_BY_ID[l].name} ${Math.max(r.scoreA, r.scoreB)}-${Math.min(r.scoreA, r.scoreB)}` });
    if (g.home === S.teamId || g.away === S.teamId) {
      myGame = { home: g.home, away: g.away, log: r.log, box: r.box,
        scoreHome: r.scoreA, scoreAway: r.scoreB, weather: wx, bowl: P.stage === 3 };
    }
  }
  if (P.stage === 3) {
    S.bracket = { rounds: P.rounds.concat([{ name: PLAYOFF_STAGES[3], winners: winners.NFL, games: played }]),
      champion: winners.NFL[0] };
    S.news.unshift({ week: 22, season: S.seasonNum, text: `🏆 ${teamName(winners.NFL[0])} WIN THE GRIDIRON BOWL!` });
    S.playoffs = null;
    S.phase = "offseason";
  } else {
    for (const conf of ["NFC", "AFC"]) {
      const seedsArr = conf === "NFC" ? P.nfcSeeds : P.afcSeeds;
      const alive = conf === "NFC" ? P.nfcAlive : P.afcAlive;
      const { bye } = nextPlayoffRound(seedsArr, alive);
      const newAlive = (bye ? [bye] : []).concat(winners[conf]);
      if (conf === "NFC") P.nfcAlive = newAlive; else P.afcAlive = newAlive;
      if (P.stage === 2) P.champs[conf] = winners[conf][0];
      P.rounds.push({ name: `${conf} ${PLAYOFF_STAGES[P.stage]}`, winners: winners[conf],
        games: played.filter(g => g.conf === conf) });
    }
    P.stage += 1;
  }
  activeView = "playoffs";
  if (myGame) {
    S.lastBox = { week: 18 + (S.playoffs ? S.playoffs.stage : 4), home: myGame.home, away: myGame.away,
      scoreHome: myGame.scoreHome, scoreAway: myGame.scoreAway, box: myGame.box };
    runTicker(myGame, [], () => { save(); render(); });
    save();
    return;
  }
  save(); render();
}

const winPctOf = id => {
  const st = S.standings[id];
  const g = Math.max(1, st.w + st.l + st.t);
  return (st.w + 0.5 * st.t) / g;
};

function genWeeklyNews(results) {
  const items = [];
  for (const g of results) {
    const margin = Math.abs(g.scoreHome - g.scoreAway);
    const total = g.scoreHome + g.scoreAway;
    const winner = g.scoreHome > g.scoreAway ? g.home : g.away;
    const loser = winner === g.home ? g.away : g.home;
    const score = `${Math.max(g.scoreHome, g.scoreAway)}-${Math.min(g.scoreHome, g.scoreAway)}`;
    if (margin >= 24) items.push(`${teamName(winner)} DEMOLISH the ${TEAM_BY_ID[loser].name} ${score}`);
    else if (total >= 70) items.push(`Shootout! ${teamName(winner)} outlast the ${TEAM_BY_ID[loser].name} ${score}`);
    else if (S.week >= 4 && winPctOf(loser) - winPctOf(winner) >= 0.28)
      items.push(`UPSET: ${teamName(winner)} (${rec(winner)}) stun the ${TEAM_BY_ID[loser].name} (${rec(loser)})`);
    for (const [tid, arr] of Object.entries(g.box || {})) {
      for (const p of arr) {
        if ((p.g.passYd || 0) >= 380) items.push(`${p.name} (${tid}) torches for ${p.g.passYd} passing yards`);
        if ((p.g.rushYd || 0) >= 160) items.push(`${p.name} (${tid}) gashes for ${p.g.rushYd} on the ground`);
        if ((p.g.recYd || 0) >= 160) items.push(`${p.name} (${tid}) erupts for ${p.g.recYd} receiving yards`);
        if ((p.g.passTD || 0) >= 5) items.push(`${p.name} (${tid}) throws ${p.g.passTD} touchdowns`);
        if ((p.g.sacks || 0) >= 3) items.push(`${p.name} (${tid}) racks up ${p.g.sacks} sacks`);
      }
    }
  }
  for (const [tid, roster] of Object.entries(S.league)) {
    for (const p of roster) {
      if (p.newInjury) {
        p.newInjury = false;
        if (p.ovr >= 84) items.push(`🚑 ${p.name} (${tid} ${p.pos}) out ${p.injuredWeeks} week${p.injuredWeeks > 1 ? "s" : ""}`);
      }
    }
  }
  for (const t of items) S.news.unshift({ week: S.week + 1, season: S.seasonNum, text: t });
  S.news.length = Math.min(S.news.length, 60);
}

function takeOver(teamId) {
  S.teamId = teamId;
  S.security = 55;
  S.strategy = { passLean: 0.55 };
  // straight into the offseason pipeline — verdict/history already recorded pre-firing
  startOffseasonPipeline();
}
window.__gm.takeOver = takeOver;

function finishOffseason() {
  const rng = weekRng();
  // training camp: focuses apply NOW — you can set/adjust them all offseason, even on rookies
  const trainNews = applyTraining(rng, S.league, S.training, S.coaches[S.teamId]);
  for (const n of trainNews) S.news.unshift({ week: 0, season: S.seasonNum + 1, text: n.text });
  S.training = [];
  fillMinimums(rng, S.league);
  S.seasonNum += 1; S.week = 0; S.phase = "season"; S.bracket = null;
  for (const roster of Object.values(S.league)) {
    for (const p of roster) { p.stats = emptyStats(); p.injuredWeeks = 0; }
  }
  S.schedule = makeSchedule(rng, S.seasonNum);
  S.standings = emptyStandings();
  S.fa = null; S.draft = null; S.lastBox = null; S.tradeUI = null; S.aiOffer = null;
  S.lastAwards = null; // recomputed at next week 18
  // futures convey: last year's "next-year" pick book IS this season's draft capital
  S.picks = S.futurePicks || freshPicks();
  S.futurePicks = freshPicks();
  S.nextClass = genDraftClass(rng);
  S.scoutPts = 8; // regenerates +2/week during the season (cap 24)
  setOwnerGoal();
  activeView = "schedule";
}

// ---------------------------------------------------------------- boot
function showTeamPicker() {
  const grid = TEAMS.map(t =>
    `<button class="pick" data-id="${t.id}" style="border-color:${t.color}">
      ${logo(t.id, 34)} <b style="color:${t.color2 === '#FFFFFF' ? t.color : t.color2}">${t.id}</b> ${t.city} ${t.name}</button>`).join("");
  $("#content").innerHTML = `<h2>Choose your franchise</h2>
    <p class="dim">Salary cap:
      <label><input type="radio" name="capmode" value="strict" checked> Strict ($${CAP_LIMIT}M hard)</label>
      <label><input type="radio" name="capmode" value="soft"> Soft (+15% overage allowed)</label>
      <label><input type="radio" name="capmode" value="none"> No cap</label></p>
    <div class="pickgrid">${grid}</div>`;
  document.querySelectorAll(".pick").forEach(b => b.onclick = () => {
    const mode = document.querySelector("input[name=capmode]:checked").value;
    newFranchise(b.dataset.id, mode);
    activeView = "schedule";
    render();
  });
  $("#topbar").innerHTML = "<b>GRIDIRON GM</b>";
}

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  activeView = b.dataset.view; render();
});
$("#resetBtn").onclick = () => {
  if (confirm("Delete franchise and start over?")) { localStorage.removeItem(SAVE_KEY); location.reload(); }
};

// ".tt" tooltips: hover works via title, but also show on CLICK (title alone is easy to miss)
document.addEventListener("click", (e) => {
  const t = e.target.closest(".tt");
  document.querySelectorAll(".tipPop").forEach(x => x.remove());
  if (!t || !t.title) return;
  const pop = document.createElement("div");
  pop.className = "tipPop";
  pop.textContent = t.title;
  document.body.appendChild(pop);
  const r = t.getBoundingClientRect();
  pop.style.left = Math.min(window.innerWidth - 320, Math.max(8, r.left)) + "px";
  pop.style.top = (r.bottom + 6) + "px";
  setTimeout(() => pop.remove(), 6000);
});

if (load()) render(); else showTeamPicker();
