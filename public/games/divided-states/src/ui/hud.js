// hud.js — top bar + side panel for Divided States.
// Read-only on GameState. Calls back via handlers. No external deps.
import { currentPlayerId, playerById, statesOf } from "../engine/gamestate.js";
import { findSet } from "../engine/cards.js";
import { REGIONS } from "../data/regions.js";

const STYLE_ID = "hud-style";
const HUD_CSS = `
/* ===== Top bar ===== */
#hud-top .hud-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
#hud-top .hud-chip { width: 16px; height: 16px; border-radius: 4px; flex: 0 0 auto;
  border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 0 0 1px rgba(0,0,0,0.4),
  0 0 10px rgba(0,0,0,0.4); }
#hud-top .hud-player { font-weight: 800; font-size: 18px; letter-spacing: 0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#hud-top .hud-divider { width: 1px; align-self: stretch; margin: 12px 2px;
  background: var(--line); }
#hud-top .hud-phase { text-transform: uppercase; color: var(--ink-dim);
  background: var(--panel); border: 1px solid var(--line); border-radius: 999px;
  padding: 4px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; }
#hud-top .hud-phase.act-reinforce { color: var(--accent); border-color: var(--accent-line);
  background: var(--accent-soft); }
#hud-top .hud-phase.act-attack { color: var(--bad); border-color: rgba(226,84,95,0.5);
  background: rgba(226,84,95,0.12); }
#hud-top .hud-phase.act-fortify { color: var(--good); border-color: rgba(76,195,106,0.5);
  background: rgba(76,195,106,0.12); }
#hud-top .hud-reinforce { display: none; align-items: center; gap: 7px;
  background: var(--accent-soft); border: 1px solid var(--accent-line);
  color: var(--accent); border-radius: 999px; padding: 4px 13px;
  box-shadow: 0 0 14px rgba(79,195,247,0.18); }
#hud-top .hud-reinforce .rf-lbl { font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
  text-transform: uppercase; opacity: 0.85; }
#hud-top .hud-reinforce .rf-num { font-size: 21px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums; }
#hud-top .hud-spacer { flex: 1 1 auto; }
#hud-top .hud-turn { color: var(--ink-dim); font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
#hud-top .hud-turn b { display: block; color: var(--ink); font-size: 17px; font-weight: 800;
  letter-spacing: 0; font-variant-numeric: tabular-nums; }
#hud-top .hud-mute { font-size: 12px; padding: 7px 13px; display: inline-flex;
  align-items: center; gap: 6px; }
#hud-top .hud-mute.muted { color: var(--bad); border-color: rgba(226,84,95,0.55); }
#hud-top .hud-help { font-size: 12px; padding: 7px 13px; display: inline-flex;
  align-items: center; gap: 6px; }
#hud-top .hud-help:hover { color: var(--accent); border-color: var(--accent-line); }

/* ===== Side panel ===== */
#hud-side .hud-block { margin-bottom: 16px; }
#hud-side h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.13em; color: var(--ink-dim); font-weight: 800;
  display: flex; align-items: center; gap: 8px; }
#hud-side h3::after { content: ""; flex: 1 1 auto; height: 1px;
  background: linear-gradient(90deg, var(--line), transparent); }

#hud-side .hud-panel { background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 11px 12px; box-shadow: var(--shadow-1),
  var(--shadow-inset); }

/* Cards */
#hud-side .hud-cards-row { display: flex; align-items: center; gap: 10px; }
#hud-side .hud-card-count { font-size: 22px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums; flex: 0 0 auto; }
#hud-side .hud-card-count small { font-size: 11px; font-weight: 700; color: var(--ink-dim);
  text-transform: uppercase; letter-spacing: 0.08em; margin-left: 3px; }
#hud-side .hud-cards-row button { flex: 1 1 auto; }
#hud-side .hud-card-hint { font-size: 11px; line-height: 1.45; color: var(--bad);
  margin-top: 9px; }
#hud-side .hud-card-hint.muted { color: var(--ink-dim); }
#hud-side .hud-card-hint.empty { color: var(--ink-dim); margin-top: 0; }
/* Card chips */
#hud-side .hud-card-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
#hud-side .hud-chip-card { display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 800;
  background: var(--panel); border: 1px solid var(--line);
  box-shadow: var(--shadow-inset); }
#hud-side .hud-chip-card .cc-sym { font-size: 13px; line-height: 1; }
#hud-side .hud-chip-card .cc-state { font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em; color: var(--ink); }
#hud-side .hud-chip-card.sym-recruits { border-color: rgba(79,195,247,0.5); }
#hud-side .hud-chip-card.sym-recruits .cc-sym { color: var(--accent); }
#hud-side .hud-chip-card.sym-cavalry { border-color: rgba(76,195,106,0.5); }
#hud-side .hud-chip-card.sym-cavalry .cc-sym { color: var(--good); }
#hud-side .hud-chip-card.sym-artillery { border-color: rgba(226,84,95,0.5); }
#hud-side .hud-chip-card.sym-artillery .cc-sym { color: var(--bad); }
#hud-side .hud-chip-card.sym-wild { border-color: rgba(240,200,80,0.6);
  background: rgba(240,200,80,0.1); }
#hud-side .hud-chip-card.sym-wild .cc-sym { color: #f0c850; }
#hud-side .hud-chip-card.sym-wild .cc-state { color: #f0c850; }

/* Region tracker */
#hud-side .hud-region { display: flex; align-items: center; gap: 9px;
  padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;
  border: 1px solid transparent; cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease; }
#hud-side .hud-region + .hud-region { margin-top: 2px; }
#hud-side .hud-region:hover { background: var(--accent-soft);
  border-color: var(--accent-line); }
#hud-side .hud-region-hint { font-size: 10px; line-height: 1.4; color: var(--ink-dim);
  margin: -2px 0 8px; font-style: italic; }
#hud-side .hud-region.complete { background: var(--accent-soft);
  border-color: var(--accent-line); }
#hud-side .hud-region .r-main { flex: 1 1 auto; min-width: 0; }
#hud-side .hud-region .r-top { display: flex; align-items: baseline; gap: 6px;
  margin-bottom: 4px; }
#hud-side .hud-region .r-name { flex: 1 1 auto; font-weight: 700; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#hud-side .hud-region .r-prog { font-variant-numeric: tabular-nums; color: var(--ink-dim);
  font-weight: 700; font-size: 11px; flex: 0 0 auto; }
#hud-side .hud-region.complete .r-prog { color: var(--accent); }
#hud-side .hud-region .r-bar { height: 4px; border-radius: 3px; background: rgba(0,0,0,0.35);
  overflow: hidden; }
#hud-side .hud-region .r-fill { height: 100%; width: 0%; border-radius: 3px;
  background: linear-gradient(90deg, var(--accent-2), var(--accent));
  transition: width 0.25s ease; }
#hud-side .hud-region.complete .r-fill { box-shadow: 0 0 8px var(--accent-line); }
#hud-side .hud-region .r-bonus { flex: 0 0 auto; color: var(--good); font-weight: 800;
  font-size: 12px; font-variant-numeric: tabular-nums; min-width: 2.4em; text-align: right; }
#hud-side .hud-region:not(.complete) .r-bonus { color: var(--ink-dim); }

/* Commanders */
#hud-side .hud-pl { display: flex; align-items: center; gap: 9px; padding: 7px 9px;
  font-size: 13px; border-radius: var(--radius-sm); border: 1px solid transparent; }
#hud-side .hud-pl + .hud-pl { margin-top: 2px; }
#hud-side .hud-pl .pl-swatch { width: 13px; height: 13px; border-radius: 4px;
  flex: 0 0 auto; border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.35); }
#hud-side .hud-pl .pl-name { flex: 1 1 auto; font-weight: 700; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
#hud-side .hud-pl .pl-name .pl-tag { color: var(--ink-dim); font-weight: 600; font-size: 11px; }
#hud-side .hud-pl .pl-stats { color: var(--ink-dim); font-variant-numeric: tabular-nums;
  font-weight: 700; font-size: 12px; flex: 0 0 auto; letter-spacing: 0.02em; }
#hud-side .hud-pl.dead { opacity: 0.4; }
#hud-side .hud-pl.dead .pl-name { text-decoration: line-through; }
#hud-side .hud-pl.dead .pl-stats { opacity: 0.7; }
#hud-side .hud-pl.current { background: var(--accent-soft); border-color: var(--accent-line);
  box-shadow: inset 2px 0 0 var(--accent); }
#hud-side .hud-pl.current .pl-name { color: var(--ink); }

/* Action buttons */
#hud-side .hud-actions { display: flex; flex-direction: column; gap: 9px; margin-top: 2px; }
#hud-side .hud-actions button { width: 100%; padding: 11px 14px; font-weight: 800;
  font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  color: #05151f; box-shadow: 0 2px 10px rgba(79,195,247,0.22), var(--shadow-inset); }
#hud-side .hud-actions button:hover:not(:disabled) {
  background: linear-gradient(180deg, #6fd0fb, var(--accent)); border-color: var(--accent); }
#hud-side .hud-actions button:disabled {
  background: var(--panel-2); color: var(--ink-dim); border-color: var(--line);
  box-shadow: none; }
#hud-side .hud-wait { color: var(--ink-dim); font-style: italic; font-size: 13px;
  text-align: center; padding: 12px; background: var(--panel-2); border: 1px dashed var(--line);
  border-radius: var(--radius-sm); }
`;

const PHASE_LABEL = {
  setup: "Setup",
  draft: "Draft",
  reinforce: "Reinforce",
  attack: "Attack",
  fortify: "Fortify",
  fortifyDone: "Fortify",
  gameover: "Game Over",
};

const CARD_GLYPH = {
  recruits: "♟",
  cavalry: "♞",
  artillery: "⛏",
  wild: "★",
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createHud({ topEl, sideEl, handlers }) {
  const h = handlers || {};
  let muted = false;

  // Inject hud styles once.
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = HUD_CSS;
    document.head.appendChild(st);
  }

  // ---- Build top bar DOM once ----
  topEl.innerHTML = "";
  const idWrap = el("div", "hud-id");
  const tChip = el("span", "hud-chip");
  const tPlayer = el("span", "hud-player", "—");
  idWrap.append(tChip, tPlayer);
  const tPhase = el("span", "hud-phase", "—");

  const tReinforce = el("span", "hud-reinforce");
  const rfLbl = el("span", "rf-lbl", "Place");
  const rfNum = el("span", "rf-num", "0");
  tReinforce.append(rfLbl, rfNum);

  const tSpacer = el("div", "hud-spacer");

  const tTurn = el("span", "hud-turn");
  const turnTop = el("span", null, "Turn");
  const turnNum = el("b", null, "0");
  tTurn.append(turnTop, turnNum);

  const helpBtn = el("button", "hud-help", "❔ How to Play");
  helpBtn.type = "button";
  helpBtn.title = "How to Play";
  helpBtn.addEventListener("click", () => {
    if (h.onShowHelp) h.onShowHelp();
  });

  const muteBtn = el("button", "hud-mute", "🔊 Sound");
  muteBtn.type = "button";
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.classList.toggle("muted", muted);
    muteBtn.textContent = muted ? "🔇 Muted" : "🔊 Sound";
    if (h.onToggleMute) h.onToggleMute(muted);
  });
  topEl.append(idWrap, tPhase, tReinforce, tSpacer, tTurn, helpBtn, muteBtn);

  // ---- Build side panel DOM once ----
  sideEl.innerHTML = "";

  // Cards block
  const cardsBlock = el("div", "hud-block");
  cardsBlock.appendChild(el("h3", null, "Mandate Cards"));
  const cardsPanel = el("div", "hud-panel");
  const cardsRow = el("div", "hud-cards-row");
  const cardCount = el("span", "hud-card-count");
  const cardCountNum = el("span", null, "0");
  const cardCountLbl = el("small", null, "cards");
  cardCount.append(cardCountNum, cardCountLbl);
  const tradeBtn = el("button", null, "Trade Set");
  tradeBtn.type = "button";
  tradeBtn.addEventListener("click", () => {
    if (!tradeBtn.disabled && h.onTurnInCards) h.onTurnInCards();
  });
  cardsRow.append(cardCount, tradeBtn);
  const cardChips = el("div", "hud-card-chips");
  const cardHint = el("div", "hud-card-hint");
  cardsPanel.append(cardsRow, cardChips, cardHint);
  cardsBlock.appendChild(cardsPanel);

  // Region tracker block
  const regionBlock = el("div", "hud-block");
  regionBlock.appendChild(el("h3", null, "Region Control"));
  regionBlock.appendChild(
    el("div", "hud-region-hint", "Hover a region to see its states on the map.")
  );
  const regionRows = {}; // key -> { row, prog, fill }
  for (const key of Object.keys(REGIONS)) {
    const reg = REGIONS[key];
    const row = el("div", "hud-region");
    // Hover listeners are attached to the persistent row DOM (built once),
    // so they survive every render() repaint.
    row.addEventListener("mouseenter", () => {
      if (h.onRegionHover) h.onRegionHover(key);
    });
    row.addEventListener("mouseleave", () => {
      if (h.onRegionHover) h.onRegionHover(null);
    });
    const main = el("div", "r-main");
    const top = el("div", "r-top");
    const name = el("span", "r-name", reg.name);
    const prog = el("span", "r-prog", `0/${reg.states.length}`);
    top.append(name, prog);
    const bar = el("div", "r-bar");
    const fill = el("div", "r-fill");
    bar.appendChild(fill);
    main.append(top, bar);
    const bonus = el("span", "r-bonus", `+${reg.bonus}`);
    row.append(main, bonus);
    regionBlock.appendChild(row);
    regionRows[key] = { row, prog, fill };
  }

  // Players block
  const playersBlock = el("div", "hud-block");
  playersBlock.appendChild(el("h3", null, "Commanders"));
  const playersList = el("div");
  playersBlock.appendChild(playersList);
  // (player rows carry their own panel-like styling per-row)
  // Player rows built lazily on first render (count unknown until then).
  let playerRows = null;

  // Actions block
  const actionsBlock = el("div", "hud-block");
  const actions = el("div", "hud-actions");
  const wait = el("div", "hud-wait", "…");
  wait.style.display = "none";

  const mkBtn = (label, cb) => {
    const b = el("button", null, label);
    b.type = "button";
    b.addEventListener("click", () => {
      if (!b.disabled && cb) cb();
    });
    return b;
  };
  const endReinforceBtn = mkBtn("End Reinforcement", () => h.onEndReinforce && h.onEndReinforce());
  const endAttackBtn = mkBtn("End Attack", () => h.onEndAttack && h.onEndAttack());
  const endFortifyBtn = mkBtn("End Turn (skip fortify)", () => h.onEndFortify && h.onEndFortify());
  actions.append(endReinforceBtn, endAttackBtn, endFortifyBtn);
  actionsBlock.append(actions, wait);

  sideEl.append(cardsBlock, regionBlock, playersBlock, actionsBlock);

  // ---- render ----
  function render(state) {
    if (!state) return;
    const pid = currentPlayerId(state);
    const cur = playerById(state, pid);
    const phase = state.phase;
    const isAI = !!(cur && cur.isAI);
    const passive = phase === "gameover" || isAI;

    // ---- Top bar ----
    tPlayer.textContent = cur ? cur.name : "—";
    tPlayer.style.color = cur ? cur.color : "var(--ink)";
    tChip.style.background = cur ? cur.color : "var(--neutral)";
    tPhase.textContent = PHASE_LABEL[phase] || phase;
    tPhase.className = "hud-phase";
    if (phase === "reinforce") tPhase.classList.add("act-reinforce");
    else if (phase === "attack") tPhase.classList.add("act-attack");
    else if (phase === "fortify" || phase === "fortifyDone") tPhase.classList.add("act-fortify");
    turnNum.textContent = String(state.turnNumber);

    if (phase === "reinforce") {
      const n = state.reinforcementsRemaining | 0;
      rfNum.textContent = String(n);
      tReinforce.style.display = "inline-flex";
    } else {
      tReinforce.style.display = "none";
    }

    // ---- Cards ----
    const hand = (cur && cur.cards) || [];
    tradeBtn.style.display = "";
    cardCountNum.textContent = String(hand.length);
    cardCountLbl.textContent = hand.length === 1 ? "card" : "cards";
    const hasSet = hand.length >= 3 && findSet(hand) != null;
    const canTrade = phase === "reinforce" && !passive && hasSet;
    tradeBtn.disabled = !canTrade;

    // Render the actual cards as chips — grouped by type so matches sit together,
    // and ring the cards that form a tradeable set so it's obvious at a glance.
    cardChips.innerHTML = "";
    const setIdx = hand.length >= 3 ? findSet(hand) : null;
    const inSet = new Set(setIdx ? setIdx.map((i) => hand[i]) : []);
    const ORDER = { recruits: 0, cavalry: 1, artillery: 2, wild: 3 };
    const sorted = [...hand].sort(
      (a, b) => (ORDER[a.wild ? "wild" : a.symbol] ?? 9) - (ORDER[b.wild ? "wild" : b.symbol] ?? 9)
    );
    const TYPE_NAME = { recruits: "Recruits", cavalry: "Cavalry", artillery: "Artillery", wild: "Wild" };
    for (const card of sorted) {
      const sym = card.wild ? "wild" : card.symbol;
      const chip = el("span", `hud-chip-card sym-${sym}`);
      const glyph = el("span", "cc-sym", CARD_GLYPH[sym] || "•");
      // Only the TYPE matters for matching — show just the type so cards of the same
      // type look identical and obviously pair up. (The card's origin state is ignored.)
      const type = el("span", "cc-state", TYPE_NAME[sym] || sym);
      type.style.fontWeight = "700";
      chip.append(glyph, type);
      chip.title = card.wild
        ? "Wild card — counts as any type"
        : `${TYPE_NAME[sym]} — match it with other ${TYPE_NAME[sym]} cards (state doesn't matter)`;
      if (inSet.has(card)) { chip.style.boxShadow = "0 0 0 2px var(--warn)"; }
      cardChips.append(chip);
    }
    cardChips.style.display = hand.length ? "flex" : "none";

    if (hand.length === 0) {
      cardHint.textContent =
        "No cards yet — you earn one each turn you capture a state. There are just 3 " +
        "types (Recruits, Cavalry, Artillery, + Wilds); collect 3 of a type or one of each.";
      cardHint.className = "hud-card-hint empty";
    } else if (hand.length >= 5) {
      cardHint.textContent = "5+ cards — you must trade a set this turn.";
      cardHint.className = "hud-card-hint";
    } else if (hasSet) {
      cardHint.textContent = phase === "reinforce"
        ? "✓ You have a set (ringed) — trade it now for bonus armies!"
        : "✓ You have a matching set — trade it on your next Reinforce.";
      cardHint.className = "hud-card-hint muted";
    } else {
      cardHint.textContent = "Need 3 of one type — or one of each type — to trade (only 3 types exist).";
      cardHint.className = "hud-card-hint muted";
    }

    // ---- Region tracker ----
    for (const key of Object.keys(REGIONS)) {
      const reg = REGIONS[key];
      let owned = 0;
      for (const code of reg.states) if (state.owner[code] === pid) owned++;
      const total = reg.states.length;
      const complete = owned === total;
      const ref = regionRows[key];
      ref.prog.textContent = `${owned}/${total}`;
      ref.fill.style.width = (total ? (owned / total) * 100 : 0) + "%";
      ref.row.classList.toggle("complete", complete);
    }

    // ---- Players summary ----
    if (!playerRows || playerRows.length !== state.players.length) {
      playersList.innerHTML = "";
      playerRows = state.players.map((p) => {
        const row = el("div", "hud-pl");
        const sw = el("span", "pl-swatch");
        sw.style.background = p.color;
        const name = el("span", "pl-name");
        const nameText = el("span");
        const tag = el("span", "pl-tag");
        name.append(nameText, tag);
        const stats = el("span", "pl-stats", "");
        row.append(sw, name, stats);
        playersList.appendChild(row);
        return { row, nameText, tag, stats, sw };
      });
    }
    state.players.forEach((p, i) => {
      const ref = playerRows[i];
      const owned = statesOf(state, p.id);
      let totalArmies = 0;
      for (const c of owned) totalArmies += state.armies[c] | 0;
      ref.sw.style.background = p.color;
      ref.nameText.textContent = p.name;
      ref.tag.textContent = p.isAI ? " AI" : "";
      ref.stats.textContent = `${owned.length} ⬢   ${totalArmies} ⚔`;
      ref.row.classList.toggle("dead", p.alive === false);
      ref.row.classList.toggle("current", p.id === pid && p.alive !== false);
    });

    // ---- Phase action buttons ----
    endReinforceBtn.style.display = phase === "reinforce" ? "" : "none";
    endAttackBtn.style.display = phase === "attack" ? "" : "none";
    endFortifyBtn.style.display = phase === "fortify" ? "" : "none";

    endReinforceBtn.disabled = passive || (state.reinforcementsRemaining | 0) !== 0;
    endAttackBtn.disabled = passive;
    endFortifyBtn.disabled = passive;

    const anyActionForPhase =
      phase === "reinforce" || phase === "attack" || phase === "fortify";
    if (passive || !anyActionForPhase) {
      actions.style.display = "none";
      wait.style.display = "";
      wait.textContent =
        phase === "gameover"
          ? "Game over."
          : phase === "draft"
          ? (isAI ? `${cur ? cur.name : "AI"} is drafting…` : "Your pick — tap a territory on the map")
          : isAI
          ? `${cur ? cur.name : "AI"} is commanding…`
          : "…";
    } else {
      actions.style.display = "";
      wait.style.display = "none";
    }
  }

  return { render };
}
