// Map renderer — real US geography. Renders each of the 49 states as its true
// SVG <path> (from states-paths.js, projected via geoAlbersUsa), filled by owner.
// Each state carries a "unit marker" — a wargame-style military counter centered at
// its centroid: a beveled owner-colored medallion with a dark rim, a thin white inner
// ring, a small star glyph, and the bold army count in white.
// The 2-letter state code is shown inline where there's room; for the cramped little
// Northeast states it's placed in the ocean margin with a thin leader line so nothing
// overlaps. Full name + count is always available via the hover <title>.
//
// Public API (unchanged contract): createMap({svg,onStateClick}) -> { render, setHighlights, setSelectable }

import { STATE_CODES, STATE_BY_CODE } from "../data/states.js";
import { STATE_PATHS, STATE_CENTROIDS, MAP_VIEWBOX } from "../data/states-paths.js";

const SVGNS = "http://www.w3.org/2000/svg";

// States too small to carry an inline code label — their code goes to the ocean
// margin on a leader line instead. Picked from projected path bbox (min dim < ~45px).
const TINY_STATES = new Set(["RI", "CT", "NJ", "DE", "MD", "MA", "NH", "VT"]);

// Hand-tuned anchor points (in the 1100x740 viewBox) for the external NE code labels,
// stacked down the right ocean margin. Leader lines run from here to each token.
const MARGIN_LABELS = {
  ME: [1086, 132],
  NH: [1086, 158],
  VT: [1086, 184],
  MA: [1086, 210],
  RI: [1086, 236],
  CT: [1086, 262],
  NJ: [1086, 288],
  DE: [1086, 314],
  MD: [1086, 340],
};

function el(name, attrs) {
  const e = document.createElementNS(SVGNS, name);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// A small 5-point star path centered on (cx,cy) with outer radius r. Used as the
// "military" glyph tucked above the count on the counter.
function starPath(cx, cy, r) {
  const inner = r * 0.42;
  let p = "";
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0) ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    p += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }
  return p + "Z";
}

export function createMap({ svg, onStateClick }) {
  svg.setAttribute("viewBox", MAP_VIEWBOX);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  injectStyle();

  buildDefs(svg);

  // Ocean backdrop (gradient + faint texture, defined in <defs>).
  svg.appendChild(el("rect", { x: 0, y: 0, width: 1100, height: 740, class: "map-ocean" }));
  svg.appendChild(el("rect", { x: 0, y: 0, width: 1100, height: 740, class: "map-ocean-grid" }));

  // Layer order: landmass shapes (with shared drop shadow) -> leader lines ->
  // unit markers -> code labels. Markers/labels always sit above neighboring shapes.
  const landGroup = el("g", { class: "land-layer" });
  const shapesLayer = el("g");
  landGroup.appendChild(shapesLayer);
  const leaderLayer = el("g", { class: "leader-layer" });
  const tokenLayer = el("g", { class: "token-layer" });
  const labelLayer = el("g", { class: "label-layer" });
  svg.appendChild(landGroup);
  svg.appendChild(leaderLayer);
  svg.appendChild(tokenLayer);
  svg.appendChild(labelLayer);

  const tiles = {}; // code -> render handles
  const selectable = new Set();
  const highlightSets = { attack: new Set(), fortify: new Set(), selected: new Set(), region: new Set() };

  for (const code of STATE_CODES) {
    const d = STATE_PATHS[code];
    if (!d) continue;
    const [cx, cy] = STATE_CENTROIDS[code] || [550, 370];

    // Landmass shape.
    const path = el("path", { d, class: "tile" });
    path.dataset.code = code;
    const title = el("title");
    path.appendChild(title);
    const fire = () => { if (selectable.has(code)) onStateClick(code); };
    path.addEventListener("click", fire);
    shapesLayer.appendChild(path);

    const tiny = TINY_STATES.has(code);
    const base = tiny ? 9.5 : 12;

    // Unit marker: a layered military "counter" centered on the centroid.
    //   rim   — dark beveled outer ring (the metal edge / highlight target)
    //   disc  — owner-colored body with a radial top-light bevel gradient
    //   inner — thin white inner ring just inside the body
    //   star  — small glyph above the number (dropped on tiny states)
    //   army  — the bold count
    // Group so we can scale-on-hover and toggle state classes.
    const token = el("g", { class: "token" });
    token.dataset.code = code;
    token.style.setProperty("--tx", cx);
    token.style.setProperty("--ty", cy);

    const rim = el("circle", { class: "token-rim", cx, cy, r: base + 1.6 });
    const disc = el("circle", { class: "token-disc", cx, cy, r: base });
    const sheen = el("circle", { class: "token-sheen", cx, cy, r: base });
    const ring = el("circle", { class: "token-ring", cx, cy, r: base - 2.2 });

    let star = null;
    if (!tiny) {
      star = el("path", { class: "token-star", d: starPath(cx, cy - base * 0.42, base * 0.34) });
    }

    const army = el("text", { class: "token-army", x: cx, y: tiny ? cy : cy + base * 0.2 });
    if (tiny) army.classList.add("token-army-sm");
    army.appendChild(document.createTextNode(""));

    // Clicking the marker should behave like clicking the state.
    token.addEventListener("click", fire);
    token.appendChild(rim);
    token.appendChild(disc);
    token.appendChild(sheen);
    token.appendChild(ring);
    if (star) token.appendChild(star);
    token.appendChild(army);
    tokenLayer.appendChild(token);

    let label, leader;
    if (tiny && MARGIN_LABELS[code]) {
      // External code label in the ocean margin + leader line into the marker.
      const [lx, ly] = MARGIN_LABELS[code];
      leader = el("line", { class: "leader", x1: cx, y1: cy, x2: lx - 13, y2: ly });
      leaderLayer.appendChild(leader);
      label = el("text", { class: "tile-label tile-label-ext", x: lx, y: ly });
      label.textContent = code;
      labelLayer.appendChild(label);
    } else if (!tiny) {
      // Inline code label sitting just above the marker.
      label = el("text", { class: "tile-label", x: cx, y: cy - base - 5 });
      label.textContent = code;
      labelLayer.appendChild(label);
    }

    tiles[code] = { path, token, rim, disc, sheen, ring, star, army, title, label, leader, cx, cy, tiny };
  }

  function colorFor(state, code) {
    const owner = state.owner[code];
    if (owner === null || owner === undefined) return "var(--neutral)";
    const p = state.players[owner];
    return p ? p.color : "var(--neutral)";
  }

  function render(state) {
    for (const code of STATE_CODES) {
      const t = tiles[code];
      if (!t) continue;
      const fill = colorFor(state, code);
      t.path.style.fill = fill;
      // Marker body shares the owner color; the dark rim/inner ring read as a counter.
      t.disc.style.fill = fill;
      t.rim.style.stroke = fill;
      const n = state.armies[code] ?? 0;
      t.army.firstChild.nodeValue = String(n);
      // Grow the counter a touch for 2+ digit stacks so big numbers stay legible.
      const wide = n >= 10;
      const base = (t.tiny ? 9.5 : 12) + (wide ? (t.tiny ? 2.5 : 2.2) : 0);
      t.disc.setAttribute("r", base);
      t.sheen.setAttribute("r", base);
      t.rim.setAttribute("r", base + 1.6);
      t.ring.setAttribute("r", base - 2.2);
      if (t.star) {
        t.star.setAttribute("d", starPath(t.cx, t.cy - base * 0.42, base * 0.34));
      }
      t.army.setAttribute("y", t.tiny ? t.cy : t.cy + base * 0.2);
      const name = STATE_BY_CODE[code]?.name || code;
      t.title.textContent = `${name} — ${n} ${n === 1 ? "army" : "armies"}`;
    }
  }

  function setSelectable(codes) {
    selectable.clear();
    const has = codes && codes.length;
    for (const code of STATE_CODES) {
      const t = tiles[code];
      if (!t) continue;
      if (!has) {
        t.path.classList.remove("selectable", "dimmed");
        t.token.classList.remove("dimmed");
        continue;
      }
      if (codes.includes(code)) {
        selectable.add(code);
        t.path.classList.add("selectable");
        t.path.classList.remove("dimmed");
        t.token.classList.remove("dimmed");
        t.token.classList.add("selectable");
      } else {
        t.path.classList.add("dimmed");
        t.path.classList.remove("selectable");
        t.token.classList.add("dimmed");
        t.token.classList.remove("selectable");
      }
    }
  }

  function setHighlights(codes, kind) {
    const set = highlightSets[kind];
    if (!set) return;
    for (const code of set) {
      const t = tiles[code];
      if (!t) continue;
      t.path.classList.remove(`hl-${kind}`);
      t.token.classList.remove(`hl-${kind}`);
    }
    set.clear();
    for (const code of codes || []) {
      const t = tiles[code];
      if (!t) continue;
      t.path.classList.add(`hl-${kind}`);
      t.token.classList.add(`hl-${kind}`);
      set.add(code);
    }
  }

  return { render, setHighlights, setSelectable };
}

// SVG <defs>: ocean gradient, faint grid pattern, landmass drop shadow, counter bevel,
// counter drop shadow, and the highlighted-marker glow.
function buildDefs(svg) {
  if (svg.querySelector("#ds-map-defs")) return;
  const defs = el("defs", { id: "ds-map-defs" });

  const ocean = el("linearGradient", { id: "ds-ocean", x1: 0, y1: 0, x2: 0, y2: 1 });
  ocean.appendChild(el("stop", { offset: "0%", "stop-color": "#0e2233" }));
  ocean.appendChild(el("stop", { offset: "55%", "stop-color": "#0b1a28" }));
  ocean.appendChild(el("stop", { offset: "100%", "stop-color": "#081320" }));
  defs.appendChild(ocean);

  // Faint diagonal grid for a subtle "war-room chart" texture.
  const grid = el("pattern", {
    id: "ds-ocean-grid", width: 46, height: 46,
    patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)",
  });
  grid.appendChild(el("path", {
    d: "M0,0 L0,46 M0,0 L46,0", stroke: "rgba(120,170,210,0.05)", "stroke-width": 1, fill: "none",
  }));
  defs.appendChild(grid);

  // Drop shadow under the whole landmass for depth.
  const shadow = el("filter", {
    id: "ds-land-shadow", x: "-6%", y: "-6%", width: "112%", height: "112%",
  });
  shadow.appendChild(el("feDropShadow", {
    dx: 0, dy: 3, stdDeviation: 4, "flood-color": "#000", "flood-opacity": "0.55",
  }));
  defs.appendChild(shadow);

  // Counter shadow — small tight shadow so each marker sits like a physical chip.
  const tshadow = el("filter", {
    id: "ds-token-shadow", x: "-50%", y: "-50%", width: "200%", height: "200%",
  });
  tshadow.appendChild(el("feDropShadow", {
    dx: 0, dy: 1.2, stdDeviation: 1.3, "flood-color": "#000", "flood-opacity": "0.55",
  }));
  defs.appendChild(tshadow);

  // Radial bevel "sheen": bright top-left highlight fading to a dark bottom edge,
  // overlaid on the owner-colored body so the counter looks domed/metallic.
  const sheen = el("radialGradient", {
    id: "ds-token-sheen", cx: "35%", cy: "30%", r: "75%",
  });
  sheen.appendChild(el("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": "0.55" }));
  sheen.appendChild(el("stop", { offset: "42%", "stop-color": "#ffffff", "stop-opacity": "0.08" }));
  sheen.appendChild(el("stop", { offset: "72%", "stop-color": "#000000", "stop-opacity": "0.04" }));
  sheen.appendChild(el("stop", { offset: "100%", "stop-color": "#000000", "stop-opacity": "0.42" }));
  defs.appendChild(sheen);

  // Soft glow used by highlighted markers.
  const glow = el("filter", {
    id: "ds-token-glow", x: "-60%", y: "-60%", width: "220%", height: "220%",
  });
  glow.appendChild(el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 2.4, result: "b" }));
  const merge = el("feMerge");
  merge.appendChild(el("feMergeNode", { in: "b" }));
  merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
  glow.appendChild(merge);
  defs.appendChild(glow);

  svg.appendChild(defs);
}

function injectStyle() {
  if (document.getElementById("map-style")) return;
  const s = document.createElement("style");
  s.id = "map-style";
  s.textContent = `
    #map-svg { background: transparent; }

    /* ---- Ocean backdrop ---- */
    #map-svg .map-ocean { fill: url(#ds-ocean); }
    #map-svg .map-ocean-grid { fill: url(#ds-ocean-grid); }

    /* ---- Landmass ---- */
    #map-svg .land-layer { filter: url(#ds-land-shadow); }
    #map-svg .tile {
      stroke: #0a1119; stroke-width: 1.1; stroke-linejoin: round; stroke-linecap: round;
      fill: var(--neutral, #5a6b7b);
      transition: fill .18s ease, opacity .14s ease, filter .14s ease;
      cursor: default;
    }
    /* Subtle top-light inner depth on every state. */
    #map-svg .tile { paint-order: stroke fill; }

    #map-svg .tile.selectable { cursor: pointer; }
    #map-svg .tile.selectable:hover {
      filter: brightness(1.22) saturate(1.08);
      stroke: #f4f7fb; stroke-width: 1.6;
    }
    #map-svg .tile.dimmed { opacity: .42; }

    /* Highlight outlines on the landmass — drawn thick + bright over the dark seams. */
    #map-svg .tile.hl-attack   { stroke: #ff5252; stroke-width: 3; }
    #map-svg .tile.hl-fortify  { stroke: #4fd27a; stroke-width: 3; }
    #map-svg .tile.hl-selected { stroke: #ffd54a; stroke-width: 3.4; }
    #map-svg .tile.hl-region   { stroke: #8af3ff; stroke-width: 4.5;
      filter: brightness(1.32) drop-shadow(0 0 8px #8af3ff); animation: ds-region-pulse 1.1s ease-in-out infinite; }
    #map-svg .token.hl-region .token-rim { stroke: #8af3ff !important; stroke-width: 3; }
    @keyframes ds-region-pulse {
      0%, 100% { filter: brightness(1.22) drop-shadow(0 0 4px #8af3ff); }
      50%      { filter: brightness(1.45) drop-shadow(0 0 12px #8af3ff); }
    }

    /* ---- Leader lines (NE margin labels) ---- */
    #map-svg .leader {
      stroke: rgba(180,210,235,.45); stroke-width: 1; stroke-dasharray: 2.5 2.5;
    }

    /* ---- Code labels ---- */
    #map-svg .tile-label {
      font-size: 12px; font-weight: 800; letter-spacing: .5px;
      fill: #eaf2fb; text-anchor: middle; dominant-baseline: middle;
      pointer-events: none; paint-order: stroke;
      stroke: rgba(4,10,16,.7); stroke-width: 3px; stroke-linejoin: round;
    }
    #map-svg .tile-label-ext {
      font-size: 11px; fill: #cde0f2; text-anchor: end;
      stroke: rgba(4,10,16,.85); stroke-width: 2.5px;
    }

    /* ---- Unit markers (military counters) ---- */
    #map-svg .token {
      transition: transform .12s ease, filter .12s ease, opacity .14s ease;
      transform-box: fill-box; transform-origin: center; cursor: default;
      filter: url(#ds-token-shadow);
    }
    #map-svg .token.selectable { cursor: pointer; }
    #map-svg .token.dimmed { opacity: .5; }

    /* Outer rim — the metal edge of the counter; its stroke is the owner color,
       darkened, and it's the element the highlight states recolor. */
    #map-svg .token-rim {
      fill: rgba(4,9,14,.95);
      stroke: var(--neutral, #5a6b7b); stroke-width: 1.4;
      filter: brightness(.7);
    }
    /* Owner-colored body. */
    #map-svg .token-disc {
      fill: var(--neutral, #5a6b7b);
      stroke: rgba(3,8,13,.55); stroke-width: .6;
    }
    /* Bevel sheen overlay — domes the body. Non-interactive. */
    #map-svg .token-sheen {
      fill: url(#ds-token-sheen); pointer-events: none;
    }
    /* Thin bright inner ring inside the body. */
    #map-svg .token-ring {
      fill: none; stroke: rgba(255,255,255,.82); stroke-width: 1.1;
      pointer-events: none;
    }
    /* Small star glyph tucked above the count. */
    #map-svg .token-star {
      fill: rgba(255,255,255,.92); stroke: rgba(2,6,10,.55); stroke-width: .5;
      pointer-events: none;
    }
    /* The army count — the headline info, kept bold + outlined for legibility. */
    #map-svg .token-army {
      font-size: 14px; font-weight: 900; fill: #fff; text-anchor: middle;
      dominant-baseline: central; pointer-events: none; paint-order: stroke;
      stroke: rgba(2,6,10,.9); stroke-width: 2.8px; stroke-linejoin: round;
    }
    #map-svg .token-army-sm { font-size: 11.5px; stroke-width: 2.3px; }

    /* Selectable markers lift + glow on hover for clear feedback. */
    #map-svg .token.selectable:hover { transform: scale(1.18); filter: url(#ds-token-glow); }

    /* Highlighted markers recolor the rim to the action color + add a glow. */
    #map-svg .token.hl-attack   .token-rim { stroke: #ff5252 !important; stroke-width: 2.6; filter: none; }
    #map-svg .token.hl-fortify  .token-rim { stroke: #4fd27a !important; stroke-width: 2.6; filter: none; }
    #map-svg .token.hl-selected .token-rim { stroke: #ffd54a !important; stroke-width: 3; filter: none; }
    #map-svg .token.hl-selected,
    #map-svg .token.hl-attack,
    #map-svg .token.hl-fortify { filter: url(#ds-token-glow); }
  `;
  document.head.appendChild(s);
}
