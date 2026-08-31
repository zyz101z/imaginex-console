// PIG MERGE TYCOON — controller: game loop, input (drag-to-merge), effects, SFX,
// HUD/overlays, saves. Engine stays pure; all timing/randomness injected from here.

import * as E from "./engine.mjs";
import { W, H, PEN, STAND, penX, penY, drawScene, drawPig, drawTruffle, drawCrate, drawStar, drawHintRing } from "./render.mjs";

const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
const SAVE_KEY = "pigmerge_save_v1";
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
};
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
  refreshHud(); save(); reportScore();
};

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
  rows.querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    const ok = k === "expand" ? E.buyExpansion(S) : E.buyUpgrade(S, k);
    if (ok) { sfx.coin(); toast(k === "expand" ? "🚧 Pen expanded!" : "⬆ Upgraded!"); }
    else sfx.deny();
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
    refreshHud(); save(); reportScore();
  } else { sfx.deny(); if (!S.crate) { cratePos = null; toast("💨 The crate crumbled away!"); } }
};
// "Maybe later" just closes the dialog — the crate STAYS in the pen with its
// timer running (5 minutes is plenty). It only vanishes if you open it or let
// it expire; there's no way to lose it by mis-clicking anymore.
$("crateLeave").onclick = () => { closeCrateModal(); };

canvas.addEventListener("pointerdown", (ev) => {
  audio();
  const { x, y } = canvasPos(ev);
  // crate first — opens the what's-inside dialog
  if (S.crate && cratePos && Math.hypot(x - cratePos.x, y - cratePos.y) < 42) {
    sfx.pop();
    openCrateModal();
    return;
  }
  const p = pigAt(x, y);
  if (p) {
    const a = animFor(p);
    drag = { id: p.id, dx: a.px - x, dy: a.py - y };
    // merge hints: every pig that matches the one in hand gets a pulsing gold ring
    dragMatches = new Set(
      p.tier < E.MAX_TIER
        ? S.pigs.filter(q => q.id !== p.id && q.tier === p.tier).map(q => q.id)
        : []);
    canvas.setPointerCapture(ev.pointerId);
  }
});
let dragMatches = new Set();
canvas.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  const { x, y } = canvasPos(ev);
  const p = S.pigs.find(q => q.id === drag.id);
  if (!p) { drag = null; return; }
  const a = animFor(p);
  a.px = Math.max(PEN.x + 20, Math.min(PEN.x + PEN.w - 20, x + drag.dx));
  a.py = Math.max(PEN.y + 24, Math.min(PEN.y + PEN.h - 16, y + drag.dy));
  a.tx = a.px; a.ty = a.py;
});
canvas.addEventListener("pointerup", (ev) => {
  dragMatches = new Set();
  if (!drag) return;
  const p = S.pigs.find(q => q.id === drag.id);
  const wasDrag = drag; drag = null;
  if (!p) return;
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
    if (drag && drag.id === p.id) { a.phase += dt * 4; continue; }
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
      refreshHud();
    }
  }
  // crate expiry (frozen while the player is reading the crate dialog)
  if (S.crate && !crateModalOpen) { E.expireCrate(S, t); if (!S.crate) cratePos = null; }
  // toast fade
  if (toastT && t > toastT) { $("toast").style.opacity = 0; toastT = 0; }

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
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, { time: t, rebirths: S.rebirths });

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

  // pigs, y-sorted for depth
  const sorted = [...S.pigs].sort((a, b) => animFor(a).py - animFor(b).py);
  for (const p of sorted) {
    const a = animFor(p);
    drawPig(ctx, { x: a.px, y: a.py }, p.tier,
      { phase: a.phase, dir: a.dir, lift: drag && drag.id === p.id });
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
refreshHud();
save();
setInterval(save, 5000);
setInterval(reportScore, 15000);
requestAnimationFrame(frame);

// debug hook for headless testing (freight-nation __rd pattern)
window.__pm = {
  get S() { return S; }, E, openCrateModal,
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
