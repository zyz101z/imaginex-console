// log.js — battle log panel for Divided States.
// Renders state.log ({ turn, msg }) into #log-root, newest at the bottom,
// auto-scrolled. Appends only new entries for efficiency; rebuilds on reset.

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'ds-log-styles';
  style.textContent = `
    #log-root .ds-log-entry {
      display: flex;
      gap: 9px;
      align-items: baseline;
      padding: 4px 8px;
      margin: 0 -4px;
      line-height: 1.4;
      border-radius: 6px;
      border-left: 2px solid transparent;
    }
    #log-root .ds-log-entry + .ds-log-entry {
      border-top: 1px solid rgba(42, 56, 72, 0.5);
    }
    #log-root .ds-log-turn {
      flex: 0 0 auto;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
      color: var(--ink-dim);
      opacity: 0.65;
      min-width: 2.4em;
      text-align: right;
    }
    #log-root .ds-log-msg {
      flex: 1 1 auto;
      color: var(--ink-dim);
      word-break: break-word;
    }
    /* Emphasized events: tinted left rail + colored, weighted text */
    #log-root .ds-log-entry.ds-capture {
      border-left-color: var(--accent-line, rgba(79,195,247,0.5));
      background: rgba(79, 195, 247, 0.06);
    }
    #log-root .ds-log-entry.ds-capture .ds-log-msg { color: var(--accent); font-weight: 600; }
    #log-root .ds-log-entry.ds-eliminate {
      border-left-color: rgba(226, 84, 95, 0.6);
      background: rgba(226, 84, 95, 0.07);
    }
    #log-root .ds-log-entry.ds-eliminate .ds-log-msg { color: var(--bad); font-weight: 700; }
    #log-root .ds-log-entry.ds-win {
      border-left-color: rgba(76, 195, 106, 0.65);
      background: rgba(76, 195, 106, 0.09);
    }
    #log-root .ds-log-entry.ds-win .ds-log-msg { color: var(--good); font-weight: 800;
      letter-spacing: 0.01em; }
    #log-root .ds-log-empty { color: var(--ink-dim); opacity: 0.55; font-style: italic;
      padding: 6px 8px; }
  `;
  document.head.appendChild(style);
}

function classifyMsg(msg) {
  const m = String(msg).toLowerCase();
  if (/\b(win|wins|won|victory|conquer(?:ed|s)? (?:the world|all)|domination)\b/.test(m)) {
    return 'ds-win';
  }
  if (/\b(eliminat|defeat|knocked out|wiped out|destroyed)\b/.test(m)) {
    return 'ds-eliminate';
  }
  if (/\b(captur|conquer|took|seized|claims?)\b/.test(m)) {
    return 'ds-capture';
  }
  return '';
}

function buildEntry(entry) {
  const row = document.createElement('div');
  row.className = 'ds-log-entry';
  const cls = classifyMsg(entry && entry.msg);
  if (cls) row.classList.add(cls);

  const turn = document.createElement('span');
  turn.className = 'ds-log-turn';
  turn.textContent = entry && entry.turn != null ? 'T' + entry.turn : '';

  const msg = document.createElement('span');
  msg.className = 'ds-log-msg';
  msg.textContent = entry ? String(entry.msg) : '';

  row.appendChild(turn);
  row.appendChild(msg);
  return row;
}

export function createLog({ root }) {
  injectStyles();

  let renderedCount = 0;

  function clear() {
    root.textContent = '';
    renderedCount = 0;
  }

  function render(state) {
    const log = (state && state.log) || [];

    // Reset detection: the log shrank (new game) -> rebuild from scratch.
    if (log.length < renderedCount) {
      clear();
    }

    if (log.length === 0) {
      if (renderedCount === 0 && !root.firstChild) {
        const empty = document.createElement('div');
        empty.className = 'ds-log-empty';
        empty.textContent = 'No events yet.';
        root.appendChild(empty);
      }
      return;
    }

    // Drop the empty placeholder once we have real entries.
    if (renderedCount === 0 && root.firstChild) {
      root.textContent = '';
    }

    if (log.length === renderedCount) return; // nothing new

    const frag = document.createDocumentFragment();
    for (let i = renderedCount; i < log.length; i++) {
      frag.appendChild(buildEntry(log[i]));
    }
    root.appendChild(frag);
    renderedCount = log.length;

    // Auto-scroll to newest (bottom).
    root.scrollTop = root.scrollHeight;
  }

  return { render };
}
