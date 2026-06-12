// menus.js — full-screen overlays (start / win / help) for "Divided States".
// Self-contained ES module. Read-only on GameState; talks back via the handlers
// passed to createMenus. Renders into #menu-root (a fixed full-screen overlay
// container defined in styles.css that hides itself when empty).

const STYLE_ID = "ds-menus-style";

const CSS = `
#menu-root .ds-card {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(180deg, rgba(35,47,62,0.55), rgba(20,28,38,0.92)),
    var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 34px 38px 30px;
  width: min(480px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  box-shadow:
    0 30px 80px rgba(0,0,0,0.6),
    0 0 0 1px rgba(79,195,247,0.07),
    inset 0 1px 0 rgba(255,255,255,0.04);
  color: var(--ink);
  text-align: center;
  animation: ds-rise 0.34s cubic-bezier(0.18, 0.9, 0.28, 1.1) both;
}
/* Faint stars/stripes + radial command-glow motif behind card content. */
#menu-root .ds-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  opacity: 0.5;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(79,195,247,0.16), transparent 60%),
    repeating-linear-gradient(
      180deg,
      rgba(79,195,247,0.035) 0px,
      rgba(79,195,247,0.035) 2px,
      transparent 2px,
      transparent 26px
    );
}
/* A subtle starfield in the top corner — tiny dots, very low-key. */
#menu-root .ds-card::after {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 120px;
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
  opacity: 0.35;
  background-image:
    radial-gradient(1.4px 1.4px at 20px 24px, rgba(231,238,246,0.7), transparent),
    radial-gradient(1.2px 1.2px at 70px 60px, rgba(231,238,246,0.5), transparent),
    radial-gradient(1.3px 1.3px at 130px 30px, rgba(231,238,246,0.6), transparent),
    radial-gradient(1.1px 1.1px at 200px 70px, rgba(231,238,246,0.45), transparent),
    radial-gradient(1.4px 1.4px at 300px 40px, rgba(231,238,246,0.55), transparent),
    radial-gradient(1.2px 1.2px at 380px 80px, rgba(231,238,246,0.5), transparent),
    radial-gradient(1.3px 1.3px at 440px 36px, rgba(231,238,246,0.5), transparent);
}

@keyframes ds-rise {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
@keyframes ds-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

/* ----- Title treatment ----- */
#menu-root .ds-crest {
  display: block;
  margin: 2px auto 14px;
  font-size: 11px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.85;
}
#menu-root .ds-crest::before,
#menu-root .ds-crest::after {
  content: "";
  display: inline-block;
  width: 26px;
  height: 1px;
  vertical-align: middle;
  margin: 0 10px;
  background: linear-gradient(90deg, transparent, var(--accent));
  opacity: 0.6;
}
#menu-root .ds-crest::after { transform: scaleX(-1); }

#menu-root .ds-title {
  margin: 0;
  font-size: 46px;
  font-weight: 900;
  letter-spacing: 6px;
  line-height: 1.0;
  text-transform: uppercase;
  background: linear-gradient(170deg, #ffffff 0%, var(--ink) 38%, var(--accent) 105%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 2px 24px rgba(79,195,247,0.18);
}
#menu-root .ds-title .ds-title-rule {
  display: block;
  width: 64px;
  height: 3px;
  margin: 16px auto 0;
  border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
#menu-root .ds-tagline {
  margin: 14px 0 28px;
  color: var(--ink-dim);
  font-size: 13.5px;
  letter-spacing: 0.6px;
}

/* ----- Fields / segmented controls ----- */
#menu-root .ds-field { text-align: left; margin: 18px 0; }
#menu-root .ds-field > .ds-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--ink-dim);
  margin-bottom: 9px;
}
#menu-root .ds-seg {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 5px;
}
#menu-root .ds-seg button {
  flex: 1 1 0;
  min-width: 40px;
  padding: 9px 6px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  color: var(--ink-dim);
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: color 0.14s, background 0.14s, border-color 0.14s, box-shadow 0.14s;
}
#menu-root .ds-seg button:hover:not(:disabled) {
  color: var(--ink);
  border-color: var(--line);
  background: rgba(79,195,247,0.06);
}
#menu-root .ds-seg button.is-active {
  background: linear-gradient(180deg, var(--panel-2), rgba(35,47,62,0.6));
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset, 0 4px 14px rgba(79,195,247,0.18);
}
#menu-root .ds-seg button:disabled { opacity: 0.28; }
#menu-root .ds-hint { margin-top: 8px; font-size: 12px; color: var(--ink-dim); }

/* ----- Actions / buttons ----- */
#menu-root .ds-actions { margin-top: 30px; display: flex; flex-direction: column; gap: 12px; }
#menu-root .ds-primary {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, var(--accent), #2ba6e0);
  color: #06121a;
  border: 1px solid var(--accent);
  font-weight: 800;
  font-size: 16px;
  padding: 14px 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(79,195,247,0.22);
  transition: filter 0.14s, transform 0.08s, box-shadow 0.14s;
}
#menu-root .ds-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 10px 30px rgba(79,195,247,0.32);
}
#menu-root .ds-primary:active:not(:disabled) { transform: translateY(1px); }
#menu-root .ds-link {
  background: transparent;
  border: none;
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 0.4px;
  padding: 4px;
  transition: color 0.14s;
}
#menu-root .ds-link:hover { color: var(--accent); }

/* ----- Win overlay ----- */
#menu-root .ds-win .ds-card,
#menu-root .ds-card.ds-win { text-align: center; }
#menu-root .ds-win-eyebrow {
  margin: 2px 0 10px;
  text-transform: uppercase;
  letter-spacing: 5px;
  font-size: 12px;
  color: var(--ink-dim);
  animation: ds-fade-up 0.4s 0.05s ease-out both;
}
#menu-root .ds-win-banner {
  margin: 0 0 18px;
  font-size: 52px;
  font-weight: 900;
  letter-spacing: 8px;
  text-transform: uppercase;
  line-height: 1.0;
  background: linear-gradient(180deg, #fff, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 4px 30px rgba(79,195,247,0.25);
  animation: ds-fade-up 0.45s 0.1s ease-out both;
}
#menu-root .ds-win-name {
  margin: 0;
  font-size: 36px;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: 0.5px;
  animation: ds-fade-up 0.45s 0.18s ease-out both;
}
#menu-root .ds-win-name .ds-win-dot {
  display: inline-block;
  width: 14px; height: 14px;
  border-radius: 50%;
  margin-right: 12px;
  vertical-align: middle;
  box-shadow: 0 0 0 4px rgba(255,255,255,0.06), 0 0 16px currentColor;
}
#menu-root .ds-win-sub {
  margin: 14px 0 4px;
  color: var(--ink-dim);
  font-size: 14px;
  animation: ds-fade-up 0.45s 0.26s ease-out both;
}

/* ----- Help overlay ----- */
#menu-root .ds-help { text-align: left; }
#menu-root .ds-help h2 {
  margin: 0 0 4px;
  font-size: 26px;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: center;
  background: linear-gradient(180deg, #fff, var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
#menu-root .ds-help .ds-help-rule {
  display: block;
  width: 48px; height: 3px;
  margin: 8px auto 4px;
  border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
#menu-root .ds-help h3 {
  margin: 22px 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--accent);
  padding-bottom: 5px;
  border-bottom: 1px solid var(--line);
}
#menu-root .ds-help p, #menu-root .ds-help li { color: var(--ink); font-size: 14px; line-height: 1.55; }
#menu-root .ds-help ul { margin: 8px 0; padding-left: 20px; }
#menu-root .ds-help li { margin: 5px 0; }
#menu-root .ds-help b { color: var(--accent); font-weight: 700; }
#menu-root .ds-help .ds-help-lede {
  text-align: center;
  margin: 2px 0 4px;
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 0.3px;
}
/* Numbered phase steps */
#menu-root .ds-help .ds-steps { list-style: none; padding-left: 0; margin: 10px 0; counter-reset: ds-step; }
#menu-root .ds-help .ds-steps > li {
  position: relative;
  padding: 10px 12px 10px 46px;
  margin: 8px 0;
  background: rgba(0,0,0,0.22);
  border: 1px solid var(--line);
  border-radius: 10px;
  counter-increment: ds-step;
}
#menu-root .ds-help .ds-steps > li::before {
  content: counter(ds-step);
  position: absolute;
  left: 10px; top: 10px;
  width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--accent), #2ba6e0);
  color: #06121a;
  font-weight: 800;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(79,195,247,0.25);
}
#menu-root .ds-help .ds-steps .ds-step-name {
  display: block;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: var(--ink);
  margin-bottom: 2px;
  text-transform: uppercase;
  font-size: 13px;
}
#menu-root .ds-help .ds-steps .ds-step-name b { color: var(--accent); }
/* Formula / inline chip */
#menu-root .ds-help .ds-chip {
  display: inline-block;
  padding: 1px 7px;
  margin: 0 1px;
  border-radius: 6px;
  background: rgba(79,195,247,0.10);
  border: 1px solid var(--line);
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink);
}
/* Dice callout box */
#menu-root .ds-help .ds-dice {
  margin: 10px 0;
  padding: 12px 14px;
  background: rgba(0,0,0,0.28);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
}
#menu-root .ds-help .ds-dice p { margin: 6px 0; }
#menu-root .ds-help .ds-roll {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
  flex-wrap: wrap;
}
#menu-root .ds-help .ds-roll .ds-roll-label {
  flex: 0 0 86px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-dim);
}
#menu-root .ds-help .ds-die {
  width: 30px; height: 30px;
  display: grid; place-items: center;
  border-radius: 7px;
  font-weight: 800;
  font-size: 15px;
  background: linear-gradient(180deg, #f4f8fb, #cdd8e2);
  color: #0c1722;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.4);
}
#menu-root .ds-help .ds-die.is-att { background: linear-gradient(180deg, #ffd9c2, #f0a679); }
#menu-root .ds-help .ds-die.is-def { background: linear-gradient(180deg, #c8e6ff, #8cbfe6); }
#menu-root .ds-help .ds-vs {
  font-size: 11px; font-weight: 800; color: var(--ink-dim);
  padding: 0 2px;
}
#menu-root .ds-help .ds-outcome {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ink-dim);
}
#menu-root .ds-help .ds-outcome b { color: var(--accent); }
/* Tips list with check markers */
#menu-root .ds-help .ds-tips { list-style: none; padding-left: 0; }
#menu-root .ds-help .ds-tips > li { position: relative; padding-left: 22px; }
#menu-root .ds-help .ds-tips > li::before {
  content: "▸";
  position: absolute; left: 4px; top: 0;
  color: var(--accent);
  font-size: 13px;
}
#menu-root .ds-help .ds-note {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-dim);
  font-style: italic;
}
`;

const DIFFICULTIES = [
  { key: "recruit", label: "Recruit" },
  { key: "officer", label: "Officer" },
  { key: "general", label: "General" },
];

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// A segmented control. options: [{value,label,disabled?}]. Calls onPick(value).
function segmented(options, current, onPick) {
  const wrap = el("div", { class: "ds-seg" });
  for (const opt of options) {
    const b = el("button", {
      type: "button",
      class: opt.value === current ? "is-active" : "",
      text: opt.label,
    });
    if (opt.disabled) b.disabled = true;
    b.addEventListener("click", () => onPick(opt.value));
    wrap.appendChild(b);
  }
  return wrap;
}

export function createMenus({ root, onNewGame, onShowHelp }) {
  injectStyle();

  function clear() {
    root.innerHTML = "";
  }

  function mount(card) {
    clear();
    root.appendChild(card);
  }

  function showStart() {
    // Local selection state.
    let playerCount = 4;
    let humanCount = 1;
    let difficulty = "officer";
    let setup = "random";
    const names = ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6"];

    const card = el("div", { class: "ds-card" });

    const playersField = el("div", { class: "ds-field" });
    const humansField = el("div", { class: "ds-field" });
    const namesField = el("div", { class: "ds-field" });
    const diffField = el("div", { class: "ds-field" });
    const setupField = el("div", { class: "ds-field" });

    function renderPlayers() {
      playersField.innerHTML = "";
      const opts = [2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));
      playersField.appendChild(el("span", { class: "ds-label", text: "Players" }));
      playersField.appendChild(
        segmented(opts, playerCount, (n) => {
          playerCount = n;
          if (humanCount > playerCount) humanCount = playerCount;
          renderPlayers();
          renderHumans();
          renderNames();
        })
      );
    }

    function renderHumans() {
      humansField.innerHTML = "";
      const opts = [];
      for (let n = 1; n <= 6; n++) {
        opts.push({ value: n, label: String(n), disabled: n > playerCount });
      }
      const aiCount = playerCount - humanCount;
      humansField.appendChild(el("span", { class: "ds-label", text: "Human players" }));
      humansField.appendChild(
        segmented(opts, humanCount, (n) => {
          if (n > playerCount) return;
          humanCount = n;
          renderHumans();
          renderNames();
        })
      );
      humansField.appendChild(
        el("div", {
          class: "ds-hint",
          text: aiCount === 0 ? "All players are human." : `${aiCount} AI opponent${aiCount === 1 ? "" : "s"}.`,
        })
      );
    }

    // Name inputs — only shown when 2+ humans share the device (hotseat).
    function renderNames() {
      namesField.innerHTML = "";
      if (humanCount < 2) return;
      namesField.appendChild(el("span", { class: "ds-label", text: "Player names" }));
      const wrap = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });
      for (let i = 0; i < humanCount; i++) {
        const input = el("input", {
          type: "text",
          maxlength: "14",
          value: names[i] || "Player " + (i + 1),
          placeholder: "Player " + (i + 1),
          style:
            "width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--line);" +
            "background:var(--bg);color:var(--ink);font:inherit;",
          onInput: (e) => { names[i] = e.target.value; },
        });
        wrap.appendChild(input);
      }
      namesField.appendChild(wrap);
    }

    function renderSetup() {
      setupField.innerHTML = "";
      setupField.appendChild(el("span", { class: "ds-label", text: "Starting territories" }));
      setupField.appendChild(
        segmented(
          [{ value: "random", label: "Random" }, { value: "draft", label: "Draft" }],
          setup,
          (v) => { setup = v; renderSetup(); }
        )
      );
      setupField.appendChild(
        el("div", {
          class: "ds-hint",
          text: setup === "draft"
            ? "Draft — take turns picking your starting states (more strategic)."
            : "Random — states are dealt out instantly (quick games).",
        })
      );
    }

    function renderDifficulty() {
      diffField.innerHTML = "";
      diffField.appendChild(el("span", { class: "ds-label", text: "AI difficulty" }));
      diffField.appendChild(
        segmented(
          DIFFICULTIES.map((d) => ({ value: d.key, label: d.label })),
          difficulty,
          (k) => {
            difficulty = k;
            renderDifficulty();
          }
        )
      );
    }

    renderPlayers();
    renderHumans();
    renderNames();
    renderDifficulty();
    renderSetup();

    const startBtn = el("button", {
      type: "button",
      class: "ds-primary",
      text: "Start Game",
      onClick: () =>
        onNewGame &&
        onNewGame({ playerCount, humanCount, difficulty, setup, names: names.slice(0, humanCount) }),
    });
    const helpBtn = el("button", {
      type: "button",
      class: "ds-link",
      text: "How to Play",
      onClick: () => showHelp(), // from the start screen, Back returns to start
    });

    card.appendChild(el("span", { class: "ds-crest", text: "Command Briefing" }));
    const title = el("h1", { class: "ds-title", text: "DIVIDED STATES" });
    title.appendChild(el("span", { class: "ds-title-rule" }));
    card.appendChild(title);
    card.appendChild(el("p", { class: "ds-tagline", text: "One nation, many banners. Conquer all 49 states." }));
    card.appendChild(playersField);
    card.appendChild(humansField);
    card.appendChild(namesField);
    card.appendChild(diffField);
    card.appendChild(setupField);
    card.appendChild(el("div", { class: "ds-actions" }, [startBtn, helpBtn]));

    mount(card);
  }

  function showWin(state) {
    const card = el("div", { class: "ds-card ds-win" });
    const winner =
      state && state.players && state.winner != null
        ? state.players.find((p) => p && p.id === state.winner) || state.players[state.winner]
        : null;
    const name = winner && winner.name ? winner.name : "Unknown";
    const color = (winner && winner.color) || "var(--accent)";

    card.appendChild(el("p", { class: "ds-win-eyebrow", text: "Total Domination" }));
    card.appendChild(el("h1", { class: "ds-win-banner", text: "Victory" }));

    const dot = el("span", { class: "ds-win-dot" });
    dot.style.background = color;
    dot.style.color = color;
    const nameEl = el("h2", { class: "ds-win-name" }, [dot, name]);
    nameEl.style.color = color;
    card.appendChild(nameEl);

    card.appendChild(
      el("p", { class: "ds-win-sub", text: "All 49 states united under one banner." })
    );
    card.appendChild(
      el("div", { class: "ds-actions" }, [
        el("button", {
          type: "button",
          class: "ds-primary",
          text: "New Game",
          onClick: () => showStart(),
        }),
      ])
    );
    mount(card);
  }

  function showHelp(onBack) {
    const card = el("div", { class: "ds-card ds-help" });
    card.innerHTML = `
      <h2>How to Play</h2>
      <span class="ds-help-rule"></span>
      <p class="ds-help-lede">Divided States is a war of conquest fought across the real US map.</p>

      <h3>The Goal</h3>
      <p><b>Domination.</b> Be the last commander standing — conquer the whole
         country by owning <b>all 49 states</b>. (Hawaii is not in play.)</p>

      <h3>Your Turn — 3 Phases</h3>
      <ol class="ds-steps">
        <li>
          <span class="ds-step-name"><b>Reinforce</b></span>
          You receive new armies, then click your own states to place them.
          Armies earned =
          <span class="ds-chip">max(3, your states ÷ 3 rounded down)</span>
          <b>+</b> any full <b>Region</b> bonuses you hold
          <b>+</b> any <b>Mandate</b> card set you trade in.
        </li>
        <li>
          <span class="ds-step-name"><b>Attack</b></span>
          Click one of your states (it needs <b>2+ armies</b>), then click an
          <b>adjacent enemy state</b> to strike it. Attack as many times as you
          like before moving on. (How the dice decide it is below.)
        </li>
        <li>
          <span class="ds-step-name"><b>Fortify</b></span>
          Make <b>one</b> move: shift armies from one of your states to another you
          own that's connected through a chain of your territory. This ends your turn.
          Fortifying is <b>optional</b> — you can skip it.
          <div class="ds-note">It's exactly one fortify move per turn — that's intentional, standard Risk rules.</div>
        </li>
      </ol>

      <h3>How the Dice Work</h3>
      <div class="ds-dice">
        <p>The <b>attacker</b> rolls up to <b>3 dice</b> — one die per attacking
           army beyond the first, capped at 3.</p>
        <p>The <b>defender</b> rolls up to <b>2 dice</b> — one per defending army, capped at 2.</p>
        <p>Both sides sort their dice <b>highest-first</b>, then compare pairs:
           highest vs. highest, and (if both have one) second vs. second.</p>

        <div class="ds-roll">
          <span class="ds-roll-label">Attacker</span>
          <span class="ds-die is-att">6</span>
          <span class="ds-die is-att">3</span>
          <span class="ds-die is-att">2</span>
        </div>
        <div class="ds-roll">
          <span class="ds-roll-label">Defender</span>
          <span class="ds-die is-def">6</span>
          <span class="ds-die is-def">3</span>
        </div>
        <p class="ds-outcome">
          Pair 1: <b>6 vs 6</b> → tie → <b>defender wins</b>, attacker loses 1 army.<br>
          Pair 2: <b>3 vs 3</b> → tie → <b>defender wins</b>, attacker loses 1 army.<br>
          (The attacker's spare <span class="ds-chip">2</span> isn't compared — only 2 pairs form.)
        </p>

        <p><b>Higher number wins each comparison. The defender wins ties.</b>
           The loser of each comparison removes one army from that territory.</p>
        <p>So a <b>3-vs-2</b> fight makes two comparisons, and two armies are lost
           in total each round, split by who lost.</p>
        <p>When a state's <b>last defending army</b> is destroyed, the attacker
           <b>captures</b> it and moves armies in.</p>
      </div>

      <h3>Regions — Bonus Armies</h3>
      <p>Holding <b>every state</b> in a region grants bonus reinforcements each turn
         (e.g. <b>Northeast +5</b>). Hover a region in the side panel to see which
         states it contains.</p>

      <h3>Mandate Cards</h3>
      <p>Each turn you capture <b>at least one state</b>, you earn one Mandate card.
         There are only <b>3 types</b> — Recruits, Cavalry, Artillery (plus Wilds).
         Only the <b>type</b> matters for matching; ignore the state shown on a card.
         Collect a <b>set of 3</b> — three of one type, or one of each type, wilds
         substituting — and trade it in during <b>Reinforce</b> for bonus armies.
         The payout <b>grows</b> each time any player cashes a set.</p>
      <p class="ds-note">Eliminate a rival and you seize their cards too.</p>

      <h3>Commander's Tips</h3>
      <ul class="ds-tips">
        <li>Concentrate your force on <b>one border</b> instead of spreading thin.</li>
        <li>Full regions are worth <b>defending</b> for the steady bonus.</li>
        <li>Don't <b>over-extend</b> — long, thin fronts are easy to break.</li>
      </ul>
    `;
    const back = el("button", {
      type: "button",
      class: "ds-primary",
      text: onBack ? "Back to Game" : "Back",
      onClick: () => (onBack ? onBack() : showStart()),
    });
    card.appendChild(el("div", { class: "ds-actions" }, [back]));
    mount(card);
  }

  function hide() {
    root.innerHTML = "";
  }

  return { showStart, showWin, showHelp, hide };
}
