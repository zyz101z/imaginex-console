// PIG MERGE TYCOON — controller: game loop, input (drag-to-merge), effects, SFX,
// HUD/overlays, saves. Engine stays pure; all timing/randomness injected from here.

import * as E from "./engine.mjs";
import { W, H, PEN, STAND, penX, penY, drawScene, drawPig, drawTruffle, drawCrate, drawStar, drawHintRing, drawDecor, drawCritters } from "./render.mjs";

const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
// 👨‍👦 FARM SLOTS: two farms on one device (Dad + Noah). Slot 1 keeps the legacy
// key so existing saves stay put; the meta record tracks names + which is active.
const SLOT_KEYS = { 1: "pigmerge_save_v1", 2: "pigmerge_save_s2" };
const META_KEY = "pigmerge_slots";
let slotMeta = { active: 1, names: { 1: "Farm 1", 2: "Farm 2" } };
try { const m = JSON.parse(localStorage.getItem(META_KEY) || "null"); if (m && SLOT_KEYS[m.active]) slotMeta = m; } catch (e) {}
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(slotMeta)); } catch (e) {} };
const SAVE_KEY = SLOT_KEYS[slotMeta.active];
const nowSec = () => Date.now() / 1000;
const rng = Math.random;

// ---------------------------------------------------------------- state
let S = null;
try { S = E.deserialize(localStorage.getItem(SAVE_KEY) || ""); } catch (e) { S = null; }
const fresh = !S;
if (!S) S = E.newGame(nowSec());

// runtime animation layer, keyed by pig id (never saved)
const anim = new Map();   // id -> { px, py, tx, ty, phase, nextDig, dir, settle }
const fx = [];            // flying truffles / coin pops / rings / confetti
let cratePos = null;      // canvas position of the live crate
let drag = null;          // { id, dx, dy }
let arranging = false;    // ARRANGE FARM mode: drag decor instead of pigs
let decorDrag = null;     // { id } while arranging
let visiting = null;      // read-only view of the OTHER slot's farm { S, name }
// decor 0..1 space → canvas (grass strip through the pen)
const decorX = (u) => 30 + u * (W - 60);
const decorY = (v) => 168 + v * (H - 190);
let lastReportedScore = 0;
let toastT = 0;

function animFor(p) {
  let a = anim.get(p.id);
  if (!a) {
    a = { px: penX(p.x), py: penY(p.y), tx: penX(p.x), ty: penY(p.y),
      phase: rng() * 6, nextDig: nowSec() + E.digInterval(S) * (0.4 + rng()),
      dir: rng() < 0.5 ? -1 : 1, wanderAt: nowSec() + rng() * 3 };
    anim.set(p.id, a);
  }
  return a;
}

// ---------------------------------------------------------------- sfx + music
let AC = null, muted = false;
try { muted = localStorage.getItem("pigmerge_muted") === "1"; } catch (e) {}
// user-supplied background track; starts on the first tap (autoplay rules)
let music = null;
try {
  music = new Audio("Pig%20Merge%20Tycoon.mp3");
  music.loop = true; music.volume = 0.32; music.preload = "auto"; music.muted = muted;
} catch (e) { music = null; }
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state !== "running") { try { AC.resume().catch(() => {}); } catch (e) {} }
  if (music && music.paused && !muted) music.play().catch(() => {});
}
// Autoplay insurance: whatever element the FIRST real tap lands on counts as the
// unlock gesture (several overlay buttons didn't route through audio(), so music
// only started if you happened to click the "right" thing). Idempotent + also
// revives a suspended AudioContext after iOS focus changes.
document.addEventListener("pointerdown", audio);
document.addEventListener("keydown", audio);
function beep(f, dur, type = "square", vol = 0.12, slide = 0) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), AC.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}
const sfx = {
  oink(tier) { const f = 220 - tier * 6; beep(f * 1.6, 0.07, "square", 0.1, f); setTimeout(() => beep(f, 0.09, "square", 0.1, f * 0.7), 60); },
  pop() { beep(600, 0.06, "sine", 0.14, 900); },
  coin() { beep(1150, 0.06, "triangle", 0.1); setTimeout(() => beep(1500, 0.09, "triangle", 0.1), 50); },
  merge() { [440, 550, 660, 880].forEach((f, i) => setTimeout(() => beep(f, 0.12, "triangle", 0.14), i * 70)); },
  discover() { [523, 659, 784, 1047, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.16), i * 90)); },
  crack() { beep(160, 0.1, "square", 0.16, 60); setTimeout(() => beep(90, 0.12, "square", 0.14, 40), 70); },
  rebirth() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.15), i * 110)); },
  buy() { beep(500, 0.05, "triangle", 0.12, 700); },
  deny() { beep(140, 0.12, "square", 0.1, 90); },
  ribbon() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.15), i * 80)); setTimeout(() => beep(1568, 0.3, "sine", 0.12), 340); },
};

// 🎵 MUSIC BOX layers — all obey the global mute and the per-layer toggles.
// nature: birdsong by day / crickets on the night theme. choir: an occasional
// three-oink chord from the herd. djhog: a lo-fi beat that REPLACES the mp3
// while it's on (two music tracks at once is soup).
const musicOn = (k) => !muted && S.musicbox && S.musicbox.on.includes(k);
setInterval(() => {
  if (!AC || !musicOn("nature")) return;
  if (S.theme === "night") {
    for (let i = 0; i < 3; i++) setTimeout(() => beep(4200, 0.03, "square", 0.03), i * 90);   // cricket
  } else {
    const base = 1800 + Math.random() * 900;   // little bird phrase
    [0, 120, 260].forEach((d, i) => setTimeout(() => beep(base * (1 + i * 0.12), 0.09, "sine", 0.045, base * 1.4), d));
  }
}, 9000);
setInterval(() => {
  if (!AC || !musicOn("choir") || !S.pigs.length) return;
  const root = 180 - Math.min(60, S.bestTier * 2);
  [1, 1.26, 1.5].forEach((iv, i) => setTimeout(() => beep(root * iv * 1.6, 0.25, "square", 0.05, root * iv), i * 140));
}, 26000);
let djStep = 0;
setInterval(() => {
  const on = musicOn("djhog");
  if (music) {   // DJ Hog owns the speakers while enabled
    if (on && !music.paused) music.pause();
    else if (!on && music.paused && !muted && AC) music.play().catch(() => {});
  }
  if (!AC || !on) return;
  djStep = (djStep + 1) % 8;
  if (djStep % 4 === 0) beep(95, 0.18, "sine", 0.16, 38);                        // kick
  if (djStep % 2 === 1) beep(6800, 0.03, "square", 0.025);                       // hat
  if (djStep === 2 || djStep === 6) beep(2400, 0.06, "triangle", 0.05, 1800);    // snap
  const bass = [55, 55, 65, 49][Math.floor(djStep / 2)];
  if (djStep % 2 === 0) beep(bass, 0.22, "triangle", 0.07);
}, 250);
$("soundBtn").textContent = muted ? "♪ OFF" : "♪ ON";
$("soundBtn").onclick = () => {
  muted = !muted;
  try { localStorage.setItem("pigmerge_muted", muted ? "1" : "0"); } catch (e) {}
  $("soundBtn").textContent = muted ? "♪ OFF" : "♪ ON";
  if (music) { music.muted = muted; if (muted) music.pause(); }
  audio();
};

// ---------------------------------------------------------------- save + score
function save() {
  S.lastSeen = nowSec();
  try { localStorage.setItem(SAVE_KEY, E.serialize(S)); } catch (e) {}
}
function reportScore() {
  const sc = E.score(S);
  if (sc <= lastReportedScore) return;
  lastReportedScore = sc;
  try {
    window.parent.postMessage({ type: "imaginex-score", gameId: "pig-merge-tycoon", score: sc, nickname: "Farmer" }, "*");
  } catch (e) {}
}

// ---------------------------------------------------------------- fx helpers
function addTruffleFx(x, y, value, tier) {
  fx.push({ kind: "truffle", x, y, sx: x, sy: y, t: 0, dur: 0.8, value, tier });
}
function addPopText(x, y, text, col = "#ffe9a8") {
  fx.push({ kind: "text", x, y, t: 0, dur: 0.9, text, col });
}
function addRing(x, y, col = "#fff") { fx.push({ kind: "ring", x, y, t: 0, dur: 0.5, col }); }
function addConfetti(x, y, n = 18) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, sp = 60 + rng() * 160;
    fx.push({ kind: "conf", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
      t: 0, dur: 0.9 + rng() * 0.5, col: `hsl(${(rng() * 360) | 0},85%,65%)`, r: 3 + rng() * 3 });
  }
}
function addSplat(x, y) {
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, sp = 30 + rng() * 70;
    fx.push({ kind: "mudp", x, y: y + 14, vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp,
      t: 0, dur: 0.5 + rng() * 0.3, r: 3 + rng() * 4 });
  }
}
// 🎉 first-EVER creation of a tier: full celebration (banner + confetti + fanfare).
// Any path that mints pigs (merge, crate, shop) routes its discoveries here.
function celebrate(tier, x = W / 2, y = PEN.y + PEN.h / 2) {
  fx.push({ kind: "banner", t: 0, dur: 2.6, name: E.TIERS[tier - 1].name, tier });
  addConfetti(x, y, 40);
  addRing(x, y, "#ffd166");
  sfx.discover();
}
// pig just created (any source): first-ever tier = full celebration
function announcePig(pig, wasKnown, x, y) {
  if (!pig) return;
  if (!wasKnown) celebrate(pig.tier, x, y);
}

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").style.opacity = 1;
  toastT = nowSec() + 2.4;
}

// 🎀 ribbons: run after anything that changes state. Several can land at once
// (e.g. a merge that also discovers a tier) so celebrations queue up one at a time.
const ribbonQueue = [];
let ribbonNextAt = 0;
function checkRibbons() {
  const won = E.checkRibbons(S);
  if (!won.length) return;
  ribbonQueue.push(...won);
  save();
}
function drainRibbonQueue(t) {
  if (!ribbonQueue.length || t < ribbonNextAt) return;
  const { ribbon, reward } = ribbonQueue.shift();
  ribbonNextAt = t + 2.8;
  toast(`🎀 BLUE RIBBON — ${ribbon.name}! +🪙 ${E.fmt(reward)}`);
  toastT = t + 2.7;
  addConfetti(W / 2, 120, 30);
  addPopText(W / 2, 150, `${ribbon.icon} +🪙 ${E.fmt(reward)}`, "#ffd166");
  sfx.ribbon();
  refreshHud();
}

// ---------------------------------------------------------------- HUD
function refreshHud() {
  if (crateModalOpen) refreshCrateOpenBtn();
  $("coinTxt").textContent = E.fmt(S.coins);
  const bt = E.buyTier(S);
  $("buyBtn").innerHTML = `🐷 BUY ${E.TIERS[bt - 1].name.toUpperCase()}<small id="buyCost">🪙 ${E.fmt(E.pigletCost(S))}</small>`;
  $("buyBtn").disabled = S.coins < E.pigletCost(S) || S.pigs.length >= E.capacity(S);
  $("penTxt").textContent = `${S.pigs.length}/${E.capacity(S)}`;
  $("bestTxt").textContent = E.TIERS[S.bestTier - 1].name;
  $("multPill").style.display = S.rebirths > 0 ? "flex" : "none";
  $("multTxt").textContent = E.fmt(S.mult);
  const canRb = E.canRebirth(S);
  $("rebirthBtn").style.display =
    canRb || S.pigs.some(p => p.tier >= E.rebirthRequirement(S) - 2) ? "block" : "none";
  $("rebirthBtn").disabled = !canRb;
  $("rebirthBtn").textContent = canRb ? "💰 SELL FARM" : `💰 SELL @ ${E.TIERS[E.rebirthRequirement(S) - 1].name.toUpperCase()}`;
  $("ribbonBtn").textContent = `🎀 ${S.ribbons.length}/${E.RIBBONS.length}`;
}

// ---------------------------------------------------------------- actions
$("buyBtn").onclick = () => {
  audio();
  const known = S.discovered.includes(E.buyTier(S));
  const p = E.buyPiglet(S, rng);
  if (!p) { sfx.deny(); return; }
  const a = animFor(p);
  a.py -= 40;  // drop in with a hop
  addSplat(a.px, a.py + 30);
  sfx.buy(); sfx.oink(p.tier);
  announcePig(p, known, a.px, a.py);
  checkRibbons();
  refreshHud(); save(); reportScore();
};

// ---- 👨‍👦 FARM SLOTS panel: rename, switch, or visit the other farm ----
$("farmsBtn").onclick = () => { audio(); renderFarms(); $("farmsBox").classList.remove("hidden"); };
$("farmsClose").onclick = () => $("farmsBox").classList.add("hidden");
$("arrangeBtn").onclick = () => {
  arranging = false; decorDrag = null;
  $("arrangeBtn").classList.add("hidden");
  toast("🖐️ Farm arranged!");
  save();
};
$("visitLeave").onclick = () => {
  visiting = null;
  $("visitLeave").classList.add("hidden");
  $("stage").classList.remove("visiting");
};
function otherSlot() { return slotMeta.active === 1 ? 2 : 1; }
function renderFarms() {
  const rows = $("farmsRows");
  rows.innerHTML = "";
  for (const n of [1, 2]) {
    const mineNow = n === slotMeta.active;
    let peek = null;
    try { peek = E.deserialize(localStorage.getItem(SLOT_KEYS[n]) || ""); } catch (e) {}
    const desc = mineNow ? "this is your farm right now"
      : peek ? `best: ${E.TIERS[peek.bestTier - 1].name} · ${peek.rebirths} rebirths · 🪙 ${E.fmt(peek.coins)}`
      : "empty — switch here to start a fresh farm";
    const row = document.createElement("div");
    row.className = "prow" + (mineNow ? " won" : "");
    row.innerHTML = `<div class="ic">${mineNow ? "🐷" : peek ? "🚜" : "🌱"}</div>
      <div class="info"><b>${slotMeta.names[n]}</b> ${mineNow ? "<span class='small'>(active)</span>" : ""}<span>${desc}</span></div>
      <div style="display:flex;gap:0.4em;flex-wrap:wrap;justify-content:flex-end">
        <button data-a="rename" data-n="${n}">✏️</button>
        ${mineNow ? "" : `<button data-a="switch" data-n="${n}">SWITCH</button>`}
        ${!mineNow && peek ? `<button data-a="visit" data-n="${n}">👀 VISIT</button>` : ""}
      </div>`;
    rows.appendChild(row);
  }
  rows.querySelectorAll("button").forEach(b => b.onclick = () => {
    const n = +b.dataset.n, a = b.dataset.a;
    if (a === "rename") {
      const name = prompt("Name this farm:", slotMeta.names[n]);
      if (name && name.trim()) { slotMeta.names[n] = name.trim().slice(0, 16); saveMeta(); renderFarms(); }
    } else if (a === "switch") {
      save(); slotMeta.active = n; saveMeta();
      location.reload();   // cleanest world-swap there is
    } else if (a === "visit") {
      let other = null;
      try { other = E.deserialize(localStorage.getItem(SLOT_KEYS[n]) || ""); } catch (e) {}
      if (!other) { toast("That farm is empty"); return; }
      visiting = { S: other, name: slotMeta.names[n] };
      $("farmsBox").classList.add("hidden");
      $("visitLeave").classList.remove("hidden");
      $("stage").classList.add("visiting");   // hides YOUR hud — it's their farm on screen
      sfx.pop();
    }
  });
}

$("ribbonBtn").onclick = () => { audio(); renderRibbons(); $("ribbonBox").classList.remove("hidden"); };
$("ribbonClose").onclick = () => $("ribbonBox").classList.add("hidden");
function renderRibbons() {
  const rows = $("ribbonRows");
  rows.innerHTML = "";
  $("ribbonSub").textContent = `${S.ribbons.length} of ${E.RIBBONS.length} earned · each one pays out coins`;
  // earned first (newest on top), then the closest-to-done ones
  const list = E.RIBBONS.map(r => {
    const [cur, goal] = E.ribbonProgress(S, r);
    return { r, cur, goal, done: E.hasRibbon(S, r.id), k: cur / goal };
  });
  list.sort((a, b) => (b.done - a.done) || (b.k - a.k));
  for (const { r, cur, goal, done } of list) {
    const row = document.createElement("div");
    row.className = "prow" + (done ? " won" : "");
    const pct = Math.round(Math.min(1, cur / goal) * 100);
    row.innerHTML = `<div class="ic">${done ? "🎀" : r.icon}</div>
      <div class="info"><b>${r.name}</b><span>${r.desc}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="prog">${done ? "✓ EARNED" : `${E.fmt(cur)} / ${E.fmt(goal)}`}
        <small>${done ? "" : "🪙 " + E.fmt(E.ribbonReward(S, r))}</small></div>`;
    rows.appendChild(row);
  }
}

$("upgBtn").onclick = () => { audio(); renderUpgrades(); $("upgBox").classList.remove("hidden"); };
$("upgClose").onclick = () => $("upgBox").classList.add("hidden");
$("bookBtn").onclick = () => { audio(); renderBook(); $("bookBox").classList.remove("hidden"); };
$("bookClose").onclick = () => $("bookBox").classList.add("hidden");
$("helpClose").onclick = () => { $("helpBox").classList.add("hidden"); audio(); };
$("awayClose").onclick = () => { $("awayBox").classList.add("hidden"); sfx.coin(); };

$("rebirthBtn").onclick = () => {
  if (!E.canRebirth(S)) return;
  audio();
  $("rbText").innerHTML = `Trade the whole farm — every pig, coin and upgrade — for a
    <b>permanent ×2 profit multiplier</b> (yours would become <b>×${E.fmt(S.mult * 2)}</b>)
    plus a golden statue by the barn. The next farm grows twice as fast!`;
  $("rbConfirm").classList.remove("hidden");
};
$("rbNo").onclick = () => $("rbConfirm").classList.add("hidden");
$("rbGo").onclick = () => {
  $("rbConfirm").classList.add("hidden");
  if (!E.doRebirth(S)) return;
  anim.clear(); fx.length = 0; cratePos = null;
  addConfetti(W / 2, H / 2, 60);
  sfx.rebirth();
  toast(`🌟 REBIRTH ${S.rebirths}! Profits ×${E.fmt(S.mult)} forever`);
  ribbonNextAt = nowSec() + 2.6;   // let the rebirth toast finish first
  checkRibbons();
  refreshHud(); save(); reportScore();
};

function renderUpgrades() {
  const rows = $("upgRows");
  rows.innerHTML = "";
  const mk = (html) => { const d = document.createElement("div"); d.className = "prow"; d.innerHTML = html; return d; };
  for (const key of Object.keys(E.UPGRADES)) {
    const u = E.UPGRADES[key], lvl = S.upgrades[key];
    const maxed = lvl >= u.max;
    const eff = key === "feed" ? `digs every ${E.digInterval(S).toFixed(1)}s`
      : key === "market" ? `truffles +${(15 * lvl)}% value`
      : key === "stock" ? (maxed ? `shop sells ${E.TIERS[E.buyTier(S) - 1].name}s`
        : `shop sells ${E.TIERS[E.buyTier(S) - 1].name}s → next: ${E.TIERS[E.buyTier(S)].name}s (price resets!)`)
      : `crates ${(E.crateChance(S) * 100).toFixed(1)}% per dig`;
    const row = mk(`<div class="ic">${u.icon}</div>
      <div class="info"><b>${u.name} · Lv ${lvl}/${u.max}</b><span>${eff}</span></div>
      <button data-k="${key}" ${maxed || S.coins < E.upgradeCost(S, key) ? "disabled" : ""}>
        ${maxed ? "MAX" : "🪙 " + E.fmt(E.upgradeCost(S, key))}</button>`);
    rows.appendChild(row);
  }
  const ecost = E.expansionCost(S);
  const row = mk(`<div class="ic">🚧</div>
    <div class="info"><b>Pen Expansion · ${E.capacity(S)} pigs</b>
    <span>${ecost == null ? "the pen is as big as pens get" : "grow the pen to hold " + E.EXPANSIONS[S.expansion + 1] + " pigs"}</span></div>
    <button data-k="expand" ${ecost == null || S.coins < ecost ? "disabled" : ""}>
      ${ecost == null ? "MAX" : "🪙 " + E.fmt(ecost)}</button>`);
  rows.appendChild(row);
  // 🎨 farm styles — cosmetic reskins, buy once then switch freely
  const themeHd = document.createElement("div");
  themeHd.style.cssText = "margin:0.9em 0 0.2em;font-size:0.75em;font-weight:900;letter-spacing:2px;color:#8a6a48;";
  themeHd.textContent = "— 🎨 FARM STYLE —";
  rows.appendChild(themeHd);
  for (const [key, th] of Object.entries(E.THEMES)) {
    const owned = S.themesOwned.includes(key);
    const inUse = S.theme === key;
    const trow = mk(`<div class="ic">${th.icon}</div>
      <div class="info"><b>${th.name}</b>
      <span>${inUse ? "the farm right now" : owned ? "owned — tap to switch" : "reskins the whole farm"}</span></div>
      <button data-k="theme:${key}" ${inUse || (!owned && S.coins < th.cost) ? "disabled" : ""}>
        ${inUse ? "IN USE" : owned ? "USE" : "🪙 " + E.fmt(th.cost)}</button>`);
    rows.appendChild(trow);
  }
  // ---- 🪴 FARM CUSTOMIZATION (decor / paint / critters / music box) ----
  const hd = (txt) => {
    const el = document.createElement("div");
    el.style.cssText = "margin:0.9em 0 0.2em;font-size:0.75em;font-weight:900;letter-spacing:2px;color:#8a6a48;";
    el.textContent = txt;
    rows.appendChild(el);
  };
  hd("— 🪴 DECOR SHOP —");
  const arrangeRow = mk(`<div class="ic">🖐️</div>
    <div class="info"><b>Arrange the farm</b><span>${S.decor.length}/${E.DECOR_MAX} pieces placed — drag them anywhere; double-tap sells one back (half price)</span></div>
    <button data-k="arrange" ${S.decor.length ? "" : "disabled"}>ARRANGE</button>`);
  rows.appendChild(arrangeRow);
  for (const [key, d] of Object.entries(E.DECOR)) {
    const owned = S.decor.filter(p => p.k === key).length;
    const row = mk(`<div class="ic">${d.icon}</div>
      <div class="info"><b>${d.name}</b><span>${owned ? "placed ×" + owned : "adds character to the farm"}</span></div>
      <button data-k="decor:${key}" ${S.coins < d.cost || S.decor.length >= E.DECOR_MAX ? "disabled" : ""}>🪙 ${E.fmt(d.cost)}</button>`);
    rows.appendChild(row);
  }
  hd("— 🚧 FENCE STYLE —");
  for (const [key, f] of Object.entries(E.FENCES)) {
    const owned = S.paintOwned.fences.includes(key), inUse = S.paint.fence === key;
    const row = mk(`<div class="ic">🚧</div>
      <div class="info"><b>${f.name}</b><span>${inUse ? "around the pen right now" : owned ? "owned — tap to switch" : "a new look for the pen"}</span></div>
      <button data-k="fence:${key}" ${inUse || (!owned && S.coins < f.cost) ? "disabled" : ""}>${inUse ? "IN USE" : owned ? "USE" : "🪙 " + E.fmt(f.cost)}</button>`);
    rows.appendChild(row);
  }
  hd("— 🏠 BARN PAINT —");
  for (const [key, b2] of Object.entries(E.BARN_PAINTS)) {
    const owned = S.paintOwned.barns.includes(key), inUse = S.paint.barn === key;
    const row = mk(`<div class="ic"><span style="display:inline-block;width:0.9em;height:0.9em;border-radius:3px;background:${b2.wall[0]};border:2px solid rgba(0,0,0,0.25)"></span></div>
      <div class="info"><b>${b2.name}</b><span>${inUse ? "on the barn right now" : owned ? "owned — tap to repaint" : "a fresh coat for the barn"}</span></div>
      <button data-k="barn:${key}" ${inUse || (!owned && S.coins < b2.cost) ? "disabled" : ""}>${inUse ? "IN USE" : owned ? "USE" : "🪙 " + E.fmt(b2.cost)}</button>`);
    rows.appendChild(row);
  }
  hd("— 🐔 CRITTERS —");
  for (const [key, c] of Object.entries(E.CRITTERS)) {
    const owned = S.critters.includes(key);
    const row = mk(`<div class="ic">${c.icon}</div>
      <div class="info"><b>${c.name}</b><span>${c.desc}</span></div>
      <button data-k="critter:${key}" ${owned || S.coins < c.cost ? "disabled" : ""}>${owned ? "LIVES HERE" : "🪙 " + E.fmt(c.cost)}</button>`);
    rows.appendChild(row);
  }
  hd("— 🎵 MUSIC BOX —");
  for (const [key, m] of Object.entries(E.MUSICBOX)) {
    const owned = S.musicbox.owned.includes(key), on = S.musicbox.on.includes(key);
    const row = mk(`<div class="ic">${m.icon}</div>
      <div class="info"><b>${m.name}</b><span>${m.desc}</span></div>
      <button data-k="music:${key}" ${!owned && S.coins < m.cost ? "disabled" : ""}>${owned ? (on ? "🔊 ON" : "🔇 OFF") : "🪙 " + E.fmt(m.cost)}</button>`);
    rows.appendChild(row);
  }

  rows.querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    let ok;
    if (k === "arrange") {
      arranging = true;
      $("upgBox").classList.add("hidden");
      toast("🖐️ ARRANGE MODE — drag decor; double-tap sells; tap ARRANGE DONE to finish");
      $("arrangeBtn").classList.remove("hidden");
      return;
    } else if (k.startsWith("decor:")) {
      ok = !!E.buyDecor(S, k.slice(6), rng);
      if (ok) toast(`${E.DECOR[k.slice(6)].icon} Placed! Use ARRANGE to move it`);
    } else if (k.startsWith("fence:")) {
      const key = k.slice(6);
      ok = S.paintOwned.fences.includes(key) ? E.setFence(S, key) : E.buyFence(S, key);
      if (ok) toast(`🚧 ${E.FENCES[key].name}!`);
    } else if (k.startsWith("barn:")) {
      const key = k.slice(5);
      ok = S.paintOwned.barns.includes(key) ? E.setBarn(S, key) : E.buyBarn(S, key);
      if (ok) toast(`🏠 ${E.BARN_PAINTS[key].name}!`);
    } else if (k.startsWith("critter:")) {
      ok = E.buyCritter(S, k.slice(8));
      if (ok) toast(`${E.CRITTERS[k.slice(8)].icon} ${E.CRITTERS[k.slice(8)].name} moved in!`);
    } else if (k.startsWith("music:")) {
      const key = k.slice(6);
      ok = S.musicbox.owned.includes(key) ? E.toggleMusic(S, key) : E.buyMusic(S, key);
      if (ok) toast(`${E.MUSICBOX[key].icon} ${E.MUSICBOX[key].name} ${S.musicbox.on.includes(key) ? "ON" : "OFF"}`);
    } else if (k.startsWith("theme:")) {
      const key = k.slice(6);
      ok = S.themesOwned.includes(key) ? E.setTheme(S, key) : E.buyTheme(S, key);
      if (ok) toast(`🎨 ${E.THEMES[key].name}!`);
    } else {
      ok = k === "expand" ? E.buyExpansion(S) : E.buyUpgrade(S, k);
      if (ok) toast(k === "expand" ? "🚧 Pen expanded!" : "⬆ Upgraded!");
    }
    if (ok) sfx.coin(); else sfx.deny();
    checkRibbons();
    renderUpgrades(); refreshHud(); save();
  });
}

function renderBook() {
  const grid = $("bookGrid");
  grid.innerHTML = "";
  E.TIERS.forEach((t, i) => {
    const tier = i + 1, known = S.discovered.includes(tier);
    const cell = document.createElement("div");
    cell.className = "bookCell" + (known ? "" : " unknown");
    const cv = document.createElement("canvas");
    cv.width = 100; cv.height = 84;
    const c2 = cv.getContext("2d");
    if (known) drawPig(c2, { x: 50, y: 46 }, tier, { scale: Math.min(t.size, 1.1) * 0.75, phase: 0 });
    else {
      c2.fillStyle = "#b9a98a"; c2.font = "900 40px 'Segoe UI',sans-serif";
      c2.textAlign = "center"; c2.textBaseline = "middle"; c2.fillText("?", 50, 46);
    }
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = known ? `${tier}. ${t.name}` : `${tier}. ???`;
    cell.appendChild(cv); cell.appendChild(nm);
    grid.appendChild(cell);
  });
}

// ---------------------------------------------------------------- input (drag to merge)
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
}
function pigAt(x, y, exceptId = -1) {
  // topmost (last-drawn = lowest y sorts later; just search reverse by draw order)
  const sorted = [...S.pigs].sort((a, b) => animFor(a).py - animFor(b).py);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    if (p.id === exceptId) continue;
    const a = animFor(p);
    const s = E.TIERS[p.tier - 1].size * 30;
    if (Math.abs(x - a.px) < s * 1.3 && Math.abs(y - (a.py - s * 0.2)) < s * 1.25) return p;
  }
  return null;
}
// ---- crate preview modal: see the pulls + rates, pay to open, or walk away
let crateModalOpen = false;
function openCrateModal() {
  if (!S.crate) return;
  crateModalOpen = true;
  const def = E.CRATE_TYPES[S.crate.type];
  $("crateTitle").textContent = `${def.icon} ${def.name.toUpperCase()}`;
  const rows = $("crateRows");
  rows.innerHTML = "";
  for (const { tier, p } of E.cratePulls(S.crate)) {
    const row = document.createElement("div");
    row.className = "prow";
    const cv = document.createElement("canvas");
    cv.width = 74; cv.height = 56;
    drawPig(cv.getContext("2d"), { x: 37, y: 32 }, tier,
      { scale: Math.min(E.TIERS[tier - 1].size, 1.1) * 0.55, phase: 0 });
    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `<b>${E.TIERS[tier - 1].name}</b><span>tier ${tier}${S.discovered.includes(tier) ? "" : " · ✨ NEW!"}</span>`;
    const pct = document.createElement("div");
    pct.style.cssText = "font-weight:900;font-size:18px;color:#7a4a1e;min-width:56px;text-align:right;";
    pct.textContent = Math.round(p * 100) + "%";
    row.appendChild(cv); row.appendChild(info); row.appendChild(pct);
    rows.appendChild(row);
  }
  refreshCrateOpenBtn();
  $("crateBox").classList.remove("hidden");
}
// Live state for the OPEN button — re-run whenever coins change while the dialog
// is up (your pigs keep digging!), so "can't afford" turns into OPEN by itself.
function refreshCrateOpenBtn() {
  if (!S.crate) return;
  const full = S.pigs.length >= E.capacity(S);
  const broke = S.coins < S.crate.cost;
  $("crateOpen").disabled = full || broke;
  $("crateOpen").textContent = full ? "PEN IS FULL — MAKE ROOM"
    : broke ? `NEED 🪙 ${E.fmt(S.crate.cost)} (keep digging…)`
    : `OPEN — 🪙 ${E.fmt(S.crate.cost)}`;
}
function closeCrateModal() { crateModalOpen = false; $("crateBox").classList.add("hidden"); }
$("crateOpen").onclick = () => {
  const pos = cratePos;
  const before = new Set(S.discovered);
  const p = E.openCrate(S, rng, nowSec());
  closeCrateModal();
  if (p) {
    const a = animFor(p);
    if (pos) { a.px = pos.x; a.py = pos.y; a.tx = a.px; a.ty = a.py; }
    addConfetti(a.px, a.py, 26);
    sfx.crack(); sfx.oink(p.tier);
    if (before.has(p.tier)) toast(`📦 It's a ${E.TIERS[p.tier - 1].name}!`);
    announcePig(p, before.has(p.tier), a.px, a.py);
    cratePos = null;
    checkRibbons();
    refreshHud(); save(); reportScore();
  } else { sfx.deny(); if (!S.crate) { cratePos = null; toast("💨 The crate crumbled away!"); } }
};
// "Maybe later" just closes the dialog — the crate STAYS in the pen with its
// timer running (5 minutes is plenty). It only vanishes if you open it or let
// it expire; there's no way to lose it by mis-clicking anymore.
$("crateLeave").onclick = () => { closeCrateModal(); };

// ---- ARRANGE MODE + VISITING guards ride in front of normal pig input ----
let lastDecorTap = { id: -1, at: 0 };
canvas.addEventListener("pointerdown", (ev) => {
  audio();
  const { x, y } = canvasPos(ev);
  if (visiting) return;   // look, don't touch
  if (arranging) {
    // nearest decor piece within reach
    let best = null, bestD = 46;
    for (const p of S.decor) {
      const d = Math.hypot(x - decorX(p.x), y - (decorY(p.y) - 20));
      if (d < bestD) { best = p; bestD = d; }
    }
    if (best) {
      if (lastDecorTap.id === best.id && nowSec() - lastDecorTap.at < 0.45) {
        const refund = Math.floor(E.DECOR[best.k].cost / 2);
        if (confirm(`Sell this ${E.DECOR[best.k].name} back for 🪙 ${E.fmt(refund)}?`)) {
          E.removeDecor(S, best.id);
          sfx.coin(); toast(`💸 Sold for 🪙 ${E.fmt(refund)}`);
          refreshHud(); save();
        }
        lastDecorTap = { id: -1, at: 0 };
        return;
      }
      lastDecorTap = { id: best.id, at: nowSec() };
      decorDrag = { id: best.id };
      canvas.setPointerCapture(ev.pointerId);
    }
    return;
  }
  // crate first — opens the what's-inside dialog
  if (S.crate && cratePos && Math.hypot(x - cratePos.x, y - cratePos.y) < 42) {
    sfx.pop();
    openCrateModal();
    return;
  }
  const p = pigAt(x, y);
  if (p) {
    const a = animFor(p);
    drag = { id: p.id, dx: a.px - x, dy: a.py - y, sx: x, sy: y, at: nowSec(), moved: false };
    // merge hints: every pig that matches the one in hand gets a pulsing gold ring
    dragMatches = new Set(
      p.tier < E.MAX_TIER
        ? S.pigs.filter(q => q.id !== p.id && q.tier === p.tier).map(q => q.id)
        : []);
    canvas.setPointerCapture(ev.pointerId);
  }
});
let dragMatches = new Set();
// ---- naming dialog (double-tap a pig) ----
let namingPigId = null;
function openNameDialog(pig) {
  namingPigId = pig.id;
  $("nameTitle").textContent = pig.name ? `${pig.name} the ${E.TIERS[pig.tier - 1].name}` : `Your ${E.TIERS[pig.tier - 1].name}`;
  $("nameInput").value = pig.name || "";
  sellArmed = false;
  $("nameSell").textContent = `💸 SELL for 🪙 ${E.fmt(E.sellValue(S, pig))}`;
  $("nameBox").classList.remove("hidden");
  setTimeout(() => $("nameInput").focus(), 50);
}
// Sell is two taps (arm, then confirm) so a stray double-tap never loses a pig.
let sellArmed = false;
$("nameSell").onclick = () => {
  const p = S.pigs.find(q => q.id === namingPigId);
  if (!p) return;
  if (!sellArmed) {
    sellArmed = true;
    $("nameSell").textContent = `REALLY SELL ${p.name ? p.name.toUpperCase() : "THIS PIG"}? 🪙 ${E.fmt(E.sellValue(S, p))}`;
    return;
  }
  const a = animFor(p);
  const got = E.sellPig(S, p.id);
  anim.delete(p.id);
  namingPigId = null; sellArmed = false;
  $("nameBox").classList.add("hidden");
  addRing(a.px, a.py, "#ffd166");
  addPopText(a.px, a.py - 40, "+🪙 " + E.fmt(got), "#ffd166");
  addSplat(a.px, a.py);
  sfx.coin(); sfx.oink(p.tier);
  toast(`💸 Sold${p.name ? " " + p.name : ""} for 🪙 ${E.fmt(got)}`);
  checkRibbons();
  refreshHud(); save();
};
$("nameSave").onclick = () => {
  if (namingPigId != null) {
    E.namePig(S, namingPigId, $("nameInput").value);
    const p = S.pigs.find(q => q.id === namingPigId);
    if (p && p.name) { toast(`🐷 Say hello to ${p.name}!`); sfx.oink(p.tier); }
    checkRibbons();
    save();
  }
  namingPigId = null;
  $("nameBox").classList.add("hidden");
};
$("nameCancel").onclick = () => { namingPigId = null; $("nameBox").classList.add("hidden"); };
canvas.addEventListener("pointermove", (ev) => {
  if (decorDrag) {
    const { x, y } = canvasPos(ev);
    E.moveDecor(S, decorDrag.id, (x - 30) / (W - 60), (y + 20 - 168) / (H - 190));
    return;
  }
  if (!drag) return;
  const { x, y } = canvasPos(ev);
  const p = S.pigs.find(q => q.id === drag.id);
  if (!p) { drag = null; return; }
  if (Math.hypot(x - drag.sx, y - drag.sy) > 8) drag.moved = true;
  if (!drag.moved) return;   // still a tap until the finger truly moves
  const a = animFor(p);
  a.px = Math.max(PEN.x + 20, Math.min(PEN.x + PEN.w - 20, x + drag.dx));
  a.py = Math.max(PEN.y + 24, Math.min(PEN.y + PEN.h - 16, y + drag.dy));
  a.tx = a.px; a.ty = a.py;
});
let lastTap = { id: -1, at: 0 };
canvas.addEventListener("pointerup", (ev) => {
  if (decorDrag) { decorDrag = null; save(); return; }
  dragMatches = new Set();
  if (!drag) return;
  const p = S.pigs.find(q => q.id === drag.id);
  const wasDrag = drag; drag = null;
  if (!p) return;
  // TAP (no real movement): pig does a trick; a quick second tap opens naming
  if (!wasDrag.moved && nowSec() - wasDrag.at < 0.6) {
    if (lastTap.id === p.id && nowSec() - lastTap.at < 0.4) {
      lastTap = { id: -1, at: 0 };
      openNameDialog(p);
    } else {
      lastTap = { id: p.id, at: nowSec() };
      doTrick(p);
    }
    return;
  }
  const a = animFor(p);
  const target = pigAt(a.px, a.py, p.id);
  if (target && E.canMerge(S, p, target)) {
    const known = S.discovered.includes(p.tier + 1);
    const ta = animFor(target);
    const merged = E.mergePigs(S, target.id, p.id, rng);   // dragged pig disappears into target
    if (merged) {
      anim.delete(p.id);
      addRing(ta.px, ta.py, "#fff");
      addConfetti(ta.px, ta.py, 22);
      addSplat(ta.px, ta.py);
      addPopText(ta.px, ta.py - 55, E.TIERS[merged.tier - 1].name + "!", "#aef7ff");
      sfx.merge(); sfx.oink(merged.tier);
      announcePig(merged, known, ta.px, ta.py);
      checkRibbons();
      refreshHud(); save(); reportScore();
      return;
    }
  }
  if (target && target.tier !== p.tier) { addPopText(a.px, a.py - 45, "needs a match!", "#ffb3b3"); sfx.deny(); }
  // settle where dropped — write back to engine coords
  p.x = (a.px - PEN.x - 26) / (PEN.w - 52);
  p.y = (a.py - PEN.y - 30) / (PEN.h - 62);
  save();
});

// ---------------------------------------------------------------- pig tricks (Noah's feature)
// Tap a pig: it shows off. Hop, spin, mud roll, or a little oink solo.
function doTrick(p) {
  const a = animFor(p);
  if (a.trick) return;   // one trick at a time, ham
  const kind = ["hop", "spin", "roll", "sing"][Math.floor(rng() * 4)];
  a.trick = { kind, t: 0, dur: kind === "sing" ? 1.4 : kind === "roll" ? 1.0 : 0.7, noted: 0 };
  if (kind !== "sing") sfx.oink(p.tier);
}
function trickTransforms(p, a, dt) {
  const tr = a.trick;
  if (!tr) return { yOff: 0, rot: 0 };
  tr.t += dt;
  const k = Math.min(1, tr.t / tr.dur);
  let yOff = 0, rot = 0;
  if (tr.kind === "hop") {
    yOff = -Math.sin(Math.PI * k) * 30;
    if (k >= 1) addSplat(a.px, a.py);
  } else if (tr.kind === "spin") {
    rot = k * Math.PI * 2;
  } else if (tr.kind === "roll") {
    rot = Math.sin(k * Math.PI * 3) * 0.5;
    if (Math.random() < 0.15) addSplat(a.px + (Math.random() - 0.5) * 30, a.py + 8);
  } else if (tr.kind === "sing") {
    // three ascending oinks with floating notes
    const beats = [0.1, 0.55, 1.0];
    while (tr.noted < 3 && tr.t >= beats[tr.noted]) {
      const n = tr.noted++;
      sfx.oink(Math.max(1, p.tier - (2 - n) * 3));
      addPopText(a.px + (n - 1) * 16, a.py - 50, ["♪", "♫", "♪"][n], "#aef7ff");
    }
  }
  if (k >= 1) a.trick = null;
  return { yOff, rot };
}

// ---------------------------------------------------------------- game loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = nowSec();

  // wander + dig
  for (const p of S.pigs) {
    const a = animFor(p);
    if (drag && drag.id === p.id && drag.moved) { a.phase += dt * 4; continue; }
    if (a.trick) { a.trickFx = trickTransforms(p, a, dt); a.phase += dt * 6; continue; }
    a.trickFx = null;
    if (t >= a.wanderAt) {
      a.tx = penX(Math.random()); a.ty = penY(Math.random());
      a.wanderAt = t + 2.5 + Math.random() * 4;
    }
    const dx = a.tx - a.px, dy = a.ty - a.py;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const sp = 28 * dt;
      a.px += (dx / dist) * sp; a.py += (dy / dist) * sp;
      a.dir = dx >= 0 ? 1 : -1;
      a.phase += dt * 9;
    } else a.phase += dt * 2;
    if (t >= a.nextDig) {
      a.nextDig = t + E.digInterval(S) * (0.75 + Math.random() * 0.5);
      const res = E.doDig(S, p, rng, t);
      addTruffleFx(a.px + a.dir * 26, a.py + 8, res.value, p.tier);
      addSplat(a.px + a.dir * 22, a.py);
      sfx.pop();
      if (res.crate) {
        cratePos = { x: penX(Math.random()), y: penY(Math.random()) };
        const def = E.CRATE_TYPES[res.crate.type];
        toast(`${def.icon} A ${def.name} surfaced! Tap it to peek inside`);
      }
      checkRibbons();   // digs / lifetime-coin ribbons land mid-dig
      refreshHud();
    }
  }
  // crate expiry (frozen while the player is reading the crate dialog)
  if (S.crate && !crateModalOpen) { E.expireCrate(S, t); if (!S.crate) cratePos = null; }
  // toast fade + queued ribbon celebrations
  if (toastT && t > toastT) { $("toast").style.opacity = 0; toastT = 0; }
  drainRibbonQueue(t);

  // fx
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.kind === "conf" || f.kind === "mudp") {
      f.vy += 320 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    }
    if (f.t >= f.dur) {
      if (f.kind === "truffle") { addPopText(STAND.x, STAND.y + 30, "+🪙" + E.fmt(f.value)); sfx.coin(); }
      fx.splice(i, 1);
    }
  }

  render(t);
}

function render(t) {
  // 👀 VISITING: render the OTHER farm read-only and skip everything live
  const V = visiting ? visiting.S : null;
  const R = V || S;
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, { time: t, rebirths: R.rebirths, theme: R.theme, ribbons: R.ribbons.length,
    fence: R.paint.fence, barnCols: E.BARN_PAINTS[R.paint.barn], critters: undefined });
  drawCritters(ctx, R.critters, t);
  if (V) {
    // their pigs idle at their saved spots; their decor sits where they left it
    const drawables = [
      ...V.decor.map(p => ({ y: decorY(p.y), draw: () => drawDecor(ctx, decorX(p.x), decorY(p.y), p.k, t) })),
      ...V.pigs.map(p => ({ y: penY(p.y), draw: () => {
        drawPig(ctx, { x: penX(p.x), y: penY(p.y) }, p.tier, { phase: t * 2 + p.id });
        if (p.name) {
          const ps = E.TIERS[p.tier - 1].size * 30;
          ctx.font = "900 13px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(20,20,30,0.75)"; ctx.lineWidth = 3;
          ctx.strokeText(p.name, penX(p.x), penY(p.y) - ps * 1.35 - 8);
          ctx.fillText(p.name, penX(p.x), penY(p.y) - ps * 1.35 - 8);
        }
      } })),
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    ctx.fillStyle = "rgba(20,32,14,0.85)";
    ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 3;
    const bw = 540;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - bw / 2, 12, bw, 44, 14) : ctx.rect(W / 2 - bw / 2, 12, bw, 44);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffe9a8"; ctx.font = "900 19px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
    // tier NUMBER, not name: their best pig might be one you haven't discovered
    ctx.fillText(`👀 Visiting ${visiting.name} — best: tier ${V.bestTier} · ${V.rebirths} rebirths · look, don't touch!`, W / 2, 40);
    return;
  }

  // crate
  if (S.crate && cratePos) {
    drawCrate(ctx, cratePos.x, cratePos.y, t * 6, S.crate.type);
    const left = Math.max(0, S.crate.expiresAt - t);
    const mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, "0");
    ctx.fillStyle = "#ffd166"; ctx.font = "900 13px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
    if (!crateModalOpen) ctx.fillText(`${mm}:${ss}`, cratePos.x, cratePos.y - 40);
  }

  // merge hints: pulsing gold rings under every pig matching the one being dragged
  if (drag && dragMatches.size) {
    for (const p of S.pigs) {
      if (!dragMatches.has(p.id)) continue;
      const a = animFor(p);
      drawHintRing(ctx, a.px, a.py, E.TIERS[p.tier - 1].size * 30, t);
    }
  }

  // pigs + decor, y-sorted together for depth (a pig walks BEHIND the oak)
  for (const p of S.decor) {
    if (decorY(p.y) < PEN.y + 20) drawDecor(ctx, decorX(p.x), decorY(p.y), p.k, t);   // background strip
  }
  const sorted = [...S.pigs].sort((a, b) => animFor(a).py - animFor(b).py);
  const penDecor = S.decor.filter(p => decorY(p.y) >= PEN.y + 20).sort((a, b) => decorY(a.y) - decorY(b.y));
  let di = 0;
  const flushDecorUpTo = (yy) => {
    while (di < penDecor.length && decorY(penDecor[di].y) <= yy) {
      const p = penDecor[di++];
      drawDecor(ctx, decorX(p.x), decorY(p.y), p.k, t);
    }
  };
  for (const p of sorted) {
    const a = animFor(p);
    flushDecorUpTo(a.py);
    const tf = a.trickFx || { yOff: 0, rot: 0 };
    drawPig(ctx, { x: a.px, y: a.py + tf.yOff }, p.tier,
      { phase: a.phase, dir: a.dir, rot: tf.rot, lift: drag && drag.id === p.id && drag.moved });
    if (p.name) {
      const ps = E.TIERS[p.tier - 1].size * 30;
      ctx.font = "900 13px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(20,20,30,0.75)"; ctx.lineWidth = 3;
      ctx.strokeText(p.name, a.px, a.py + tf.yOff - ps * 1.35 - 8);
      ctx.fillText(p.name, a.px, a.py + tf.yOff - ps * 1.35 - 8);
    }
  }
  flushDecorUpTo(1e9);   // decor below the lowest pig
  if (arranging) {   // gentle pulse under every piece so they read as grabbable
    for (const p of S.decor) {
      ctx.strokeStyle = `rgba(255,209,102,${0.4 + 0.3 * Math.sin(t * 4)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(decorX(p.x), decorY(p.y) + 3, 34, 10, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // fx on top
  for (const f of fx) {
    if (f.kind === "truffle") {
      const k = f.t / f.dur;
      const x = f.sx + (STAND.x - f.sx) * k;
      const y = f.sy + (STAND.y + 40 - f.sy) * k - Math.sin(k * Math.PI) * 90;
      drawTruffle(ctx, x, y, f.tier || 1);
    } else if (f.kind === "text") {
      const k = f.t / f.dur;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = f.col;
      ctx.font = "900 17px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - k * 34);
      ctx.globalAlpha = 1;
    } else if (f.kind === "ring") {
      const k = f.t / f.dur;
      ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 5 - k * 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, 12 + k * 70, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.kind === "conf") {
      ctx.globalAlpha = 1 - f.t / f.dur;
      ctx.fillStyle = f.col;
      ctx.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r);
      ctx.globalAlpha = 1;
    } else if (f.kind === "mudp") {
      ctx.globalAlpha = 1 - f.t / f.dur;
      ctx.fillStyle = "#7d5229";
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (f.kind === "banner") {
      // 🎉 NEW PIG DISCOVERED — scale-in, hold, fade out; the pig poses beneath
      const k = f.t / f.dur;
      const inK = Math.min(1, f.t / 0.3);
      const scaleB = 0.6 + 0.4 * (1 - Math.pow(1 - inK, 3));
      ctx.save();
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.translate(W / 2, 250);
      ctx.scale(scaleB, scaleB);
      ctx.fillStyle = "rgba(20,32,14,0.82)";
      ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 4;
      const bw = 480, bh = 170;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 22) : ctx.rect(-bw / 2, -bh / 2, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffe9a8";
      ctx.font = "900 20px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
      ctx.fillText("✨ NEW PIG DISCOVERED! ✨", 0, -48);
      ctx.fillStyle = "#fff";
      ctx.font = "900 38px 'Segoe UI',sans-serif";
      ctx.fillText(f.name.toUpperCase(), 0, 0);
      drawPig(ctx, { x: 0, y: 52 }, f.tier, { scale: Math.min(E.TIERS[f.tier - 1].size, 1.2) * 0.8, phase: t * 6 });
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- boot
function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.985;
  const stage = $("stage");
  stage.style.width = W * scale + "px";
  stage.style.height = H * scale + "px";
  canvas.style.width = W * scale + "px";
  canvas.style.height = H * scale + "px";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // HUD scales with the stage: use zoom-like font scaling via transform on children? Keep simple:
  stage.style.fontSize = 16 * scale + "px";
}
window.addEventListener("resize", resize);
resize();

// offline earnings / first-run help
if (fresh) {
  $("helpBox").classList.remove("hidden");
} else {
  const gain = E.offlineEarnings(S, nowSec());
  if (gain > 0) {
    $("awayAmt").textContent = "+🪙 " + E.fmt(gain);
    $("awayBox").classList.remove("hidden");
  }
}
lastReportedScore = 0;
// older saves earn back-ribbons for what they already achieved; a fresh farm has none
if (!fresh) { ribbonNextAt = nowSec() + 1.5; checkRibbons(); }
refreshHud();
save();
setInterval(save, 5000);
setInterval(reportScore, 15000);
requestAnimationFrame(frame);

// debug hook for headless testing (freight-nation __rd pattern)
window.__pm = {
  get S() { return S; }, E, openCrateModal, renderRibbons, checkRibbons,
  buy: () => $("buyBtn").click(),
  pigAt, animFor,
  forceDig: (i = 0) => { const p = S.pigs[i]; if (p) { const a = animFor(p); a.nextDig = 0; } },
  mergeFirstPair: () => {
    for (const p of S.pigs) {
      const q = S.pigs.find(x => x.id !== p.id && x.tier === p.tier);
      if (q) { const a = animFor(q); return E.mergePigs(S, p.id, q.id, rng) && (anim.delete(q.id), refreshHud(), true); }
    }
    return false;
  },
};
