// PIG MERGE TYCOON — canvas renderer: the farm scene + procedural chunky pigs.
// Pure drawing; no game state mutation. Bright, rounded, Penguin-Tycoon-y.

import { TIERS } from "./engine.mjs";

export const W = 960, H = 640;
// The pen (where pigs live), in canvas px. Pigs' engine x/y (0..1) map into this.
export const PEN = { x: 70, y: 205, w: 820, h: 375 };
export const STAND = { x: 700, y: 108 };       // farm-stand truffle target
export const penX = (u) => PEN.x + 26 + u * (PEN.w - 52);
export const penY = (v) => PEN.y + 30 + v * (PEN.h - 62);

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Per-theme scene palettes (cosmetic reskins — bought in the upgrades drawer).
const SCENES = {
  classic: { skyTop: "#7ec8f7", skyBot: "#b7e3ff", grassTop: "#8fd05e", grassBot: "#5CA83E",
    mud0: "#a9743f", mud1: "#976536", mud2: "#7d5229", blotch: "rgba(120,80,40,0.5)",
    fence: "#8a5a33", fenceHi: "#a9713f", bush: "#5CA83E", bushHi: "#6fbf4e", cloud: "rgba(255,255,255,0.9)" },
  winter: { skyTop: "#a8cfe8", skyBot: "#eef6fb", grassTop: "#f2f8fc", grassBot: "#cfe2ee",
    mud0: "#b8a68f", mud1: "#a08b72", mud2: "#7d6a52", blotch: "rgba(255,255,255,0.4)",
    fence: "#7a5a3d", fenceHi: "#93755a", bush: "#dfeaf2", bushHi: "#ffffff",
    cloud: "rgba(255,255,255,0.95)", paleSun: true, snow: true },
  night: { skyTop: "#0e1734", skyBot: "#273a68", grassTop: "#2c5232", grassBot: "#1c3822",
    mud0: "#5a4028", mud1: "#4a3420", mud2: "#352414", blotch: "rgba(0,0,0,0.25)",
    fence: "#5a3d24", fenceHi: "#6f4e30", bush: "#234227", bushHi: "#2d5232",
    cloud: "rgba(180,190,220,0.25)", moon: true, stars: true, fireflies: true },
  beach: { skyTop: "#5ec2f7", skyBot: "#c8ecfb", grassTop: "#f0dc9e", grassBot: "#d9bd76",
    mud0: "#4db3e8", mud1: "#3897cc", mud2: "#2b7bab", blotch: "rgba(255,255,255,0.3)",
    fence: "#b09468", fenceHi: "#c8ad82", bush: "#7bc47a", bushHi: "#96d494",
    cloud: "rgba(255,255,255,0.9)", bigSun: true, waves: true },
};

export function drawScene(ctx, opts = {}) {
  const t = opts.time || 0;
  const P = SCENES[opts.theme] || SCENES.classic;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, 190);
  sky.addColorStop(0, P.skyTop); sky.addColorStop(1, P.skyBot);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 190);
  if (P.stars) {
    ctx.fillStyle = "#e8ecff";
    for (let i = 0; i < 26; i++) {
      const sx = (i * 137 + 40) % W, sy = (i * 71 + 12) % 150;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.beginPath(); ctx.arc(sx, sy, i % 3 === 0 ? 2 : 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon
  if (P.moon) {
    ctx.fillStyle = "#e8ecfa";
    ctx.beginPath(); ctx.arc(80, 52, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.skyTop;
    ctx.beginPath(); ctx.arc(92, 44, 21, 0, Math.PI * 2); ctx.fill();
  } else {
    const sr = P.bigSun ? 38 : 30;
    ctx.fillStyle = P.paleSun ? "#fff3c8" : "#ffe28a";
    ctx.beginPath(); ctx.arc(80, 52, sr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.paleSun ? "rgba(255,243,200,0.25)" : "rgba(255,226,138,0.35)";
    ctx.beginPath(); ctx.arc(80, 52, sr + 14 + Math.sin(t * 1.5) * 3, 0, Math.PI * 2); ctx.fill();
  }
  // clouds
  ctx.fillStyle = P.cloud;
  for (const [cx, cy, s] of [[240, 46, 1], [520, 66, 0.8], [850, 40, 1.1]]) {
    const dx = ((t * 6 * s) % (W + 160)) - 80;
    for (const [ox, oy, r] of [[0, 0, 22], [18, -8, 16], [-20, -4, 15], [34, 4, 13]]) {
      ctx.beginPath(); ctx.arc(cx + ox + dx * 0.15, cy + oy, r * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // field
  const grass = ctx.createLinearGradient(0, 150, 0, H);
  grass.addColorStop(0, P.grassTop); grass.addColorStop(1, P.grassBot);
  ctx.fillStyle = grass; ctx.fillRect(0, 150, W, H - 150);

  // ---- BARN (left) — planked walls, shingled gambrel roof, hayloft, big doors
  ctx.save();
  ctx.translate(150, 88);
  // soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath(); ctx.ellipse(0, 104, 118, 14, 0, 0, Math.PI * 2); ctx.fill();
  // wall with vertical plank shading
  const wall = ctx.createLinearGradient(0, 6, 0, 102);
  wall.addColorStop(0, "#d95548"); wall.addColorStop(1, "#b03a30");
  ctx.fillStyle = wall; rr(ctx, -95, 6, 190, 96, 8); ctx.fill();
  ctx.strokeStyle = "rgba(120,30,25,0.45)"; ctx.lineWidth = 2;
  for (let px = -80; px <= 80; px += 16) {
    ctx.beginPath(); ctx.moveTo(px, 8); ctx.lineTo(px, 100); ctx.stroke();
  }
  // white corner trim
  ctx.fillStyle = "#f5efe2";
  rr(ctx, -97, 6, 8, 96, 3); ctx.fill(); rr(ctx, 89, 6, 8, 96, 3); ctx.fill();
  // gambrel roof with shingle rows
  const roof = ctx.createLinearGradient(0, -58, 0, 12);
  roof.addColorStop(0, "#8a2a22"); roof.addColorStop(1, "#a83228");
  ctx.fillStyle = roof;
  ctx.beginPath(); ctx.moveTo(-112, 12); ctx.lineTo(-64, -40); ctx.lineTo(0, -58);
  ctx.lineTo(64, -40); ctx.lineTo(112, 12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(70,15,12,0.5)"; ctx.lineWidth = 2;
  for (let ry = 0; ry < 3; ry++) {
    const k = ry / 3;
    ctx.beginPath();
    ctx.moveTo(-112 + 48 * k, 12 - 52 * k * 0.92);
    ctx.quadraticCurveTo(0, -58 + 46 * (1 - k) - 46, 112 - 48 * k, 12 - 52 * k * 0.92);
    ctx.stroke();
  }
  // roof ridge cap + trim
  ctx.strokeStyle = "#f5efe2"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-64, -40); ctx.lineTo(0, -58); ctx.lineTo(64, -40); ctx.stroke();
  // hayloft door with hay poking out
  ctx.fillStyle = "#f5efe2"; rr(ctx, -20, -38, 40, 32, 5); ctx.fill();
  ctx.fillStyle = "#6a3d22"; rr(ctx, -16, -34, 32, 24, 4); ctx.fill();
  ctx.fillStyle = "#e8c25a";
  ctx.beginPath(); ctx.ellipse(0, -12, 16, 7, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = "#c9a13b"; ctx.lineWidth = 1.5;
  for (const [hx1, hy1, hx2, hy2] of [[-10, -12, -16, -4], [0, -12, 2, -3], [8, -12, 14, -5]]) {
    ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
  }
  // big double doors with cross bracing + hinges
  ctx.fillStyle = "#f5efe2"; rr(ctx, -36, 36, 72, 66, 6); ctx.fill();
  const door = ctx.createLinearGradient(0, 40, 0, 102);
  door.addColorStop(0, "#8a5a33"); door.addColorStop(1, "#6a3d22");
  ctx.fillStyle = door; rr(ctx, -31, 40, 62, 62, 5); ctx.fill();
  ctx.strokeStyle = "#4e2c17"; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-31, 44) ; ctx.lineTo(-2, 100); ctx.moveTo(-2, 44); ctx.lineTo(-31, 100);
  ctx.moveTo(2, 44); ctx.lineTo(31, 100); ctx.moveTo(31, 44); ctx.lineTo(2, 100);
  ctx.moveTo(0, 40); ctx.lineTo(0, 102);
  ctx.stroke();
  ctx.fillStyle = "#2f2f38";
  ctx.beginPath(); ctx.arc(-6, 72, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, 72, 2.5, 0, Math.PI * 2); ctx.fill();
  // round window
  ctx.fillStyle = "#f5efe2"; ctx.beginPath(); ctx.arc(-62, 28, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#bfe3f5"; ctx.beginPath(); ctx.arc(-62, 28, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f5efe2"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-71, 28); ctx.lineTo(-53, 28); ctx.moveTo(-62, 19); ctx.lineTo(-62, 37); ctx.stroke();
  ctx.fillStyle = "#f5efe2"; ctx.beginPath(); ctx.arc(62, 28, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#bfe3f5"; ctx.beginPath(); ctx.arc(62, 28, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f5efe2"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(53, 28); ctx.lineTo(71, 28); ctx.moveTo(62, 19); ctx.lineTo(62, 37); ctx.stroke();
  // 🎀 ribbon board — a plank right of the doors that fills with rosettes as you earn them
  if (opts.ribbons > 0) {
    ctx.fillStyle = "#c9915a"; rr(ctx, 42, 48, 46, 50, 4); ctx.fill();
    ctx.strokeStyle = "#6a3d22"; ctx.lineWidth = 2; rr(ctx, 42, 48, 46, 50, 4); ctx.stroke();
    const n = Math.min(12, opts.ribbons);
    for (let i = 0; i < n; i++) {
      const rx = 50 + (i % 3) * 15, ry = 56 + Math.floor(i / 3) * 12;
      ctx.strokeStyle = "#3f6fd8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx - 2, ry + 3); ctx.lineTo(rx - 3, ry + 9);
      ctx.moveTo(rx + 2, ry + 3); ctx.lineTo(rx + 3, ry + 9); ctx.stroke();
      ctx.fillStyle = "#4f86ff"; ctx.beginPath(); ctx.arc(rx, ry, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    if (opts.ribbons > 12) {
      ctx.fillStyle = "#3d2410"; ctx.font = "900 9px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
      ctx.fillText("+" + (opts.ribbons - 12), 65, 96);
    }
  }
  // weathervane pig on the ridge
  ctx.strokeStyle = "#4e3a2a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(0, -74); ctx.stroke();
  ctx.strokeStyle = "#7a6a52"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, -70); ctx.lineTo(10, -70); ctx.stroke();
  drawPig(ctx, { x: 0, y: -78 }, 1, { scale: 0.22, phase: 0 });
  // bushes at the base
  ctx.fillStyle = P.bush;
  for (const [bx, br] of [[-100, 11], [-86, 14], [96, 12], [82, 15]]) {
    ctx.beginPath(); ctx.arc(bx, 98, br, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = P.bushHi;
  for (const [bx, br] of [[-93, 9], [89, 10]]) {
    ctx.beginPath(); ctx.arc(bx, 92, br, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ---- TRUFFLE MARKET (right of center) — plank counter, baskets, hanging sign
  ctx.save();
  ctx.translate(STAND.x, STAND.y);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath(); ctx.ellipse(0, 70, 92, 13, 0, 0, Math.PI * 2); ctx.fill();
  // rear posts holding the awning
  ctx.fillStyle = "#6a3d22";
  rr(ctx, -80, -24, 9, 90, 4); ctx.fill(); rr(ctx, 71, -24, 9, 90, 4); ctx.fill();
  // counter with plank grain + skirt
  const cnt = ctx.createLinearGradient(0, 6, 0, 66);
  cnt.addColorStop(0, "#b07a45"); cnt.addColorStop(1, "#8a5a33");
  ctx.fillStyle = cnt; rr(ctx, -76, 14, 152, 52, 8); ctx.fill();
  ctx.strokeStyle = "rgba(90,55,28,0.55)"; ctx.lineWidth = 2;
  for (let py = 26; py <= 58; py += 11) {
    ctx.beginPath(); ctx.moveTo(-72, py); ctx.lineTo(72, py); ctx.stroke();
  }
  // counter top slab
  ctx.fillStyle = "#c9915a"; rr(ctx, -82, 6, 164, 12, 6); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)"; rr(ctx, -82, 6, 164, 4, 3); ctx.fill();
  // goods on the counter: two truffle baskets + coin jar
  for (const bx of [-46, 8]) {
    ctx.fillStyle = "#a9713f";
    ctx.beginPath(); ctx.moveTo(bx - 17, -2); ctx.lineTo(bx + 17, -2); ctx.lineTo(bx + 12, 8); ctx.lineTo(bx - 12, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#7a4a24"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx - 15, 1); ctx.lineTo(bx + 15, 1); ctx.moveTo(bx - 13, 4.5); ctx.lineTo(bx + 13, 4.5); ctx.stroke();
    ctx.fillStyle = "#4a3226";
    for (const [tx, ty, tr] of [[-8, -5, 5], [0, -7, 6], [8, -4, 5]]) {
      ctx.beginPath(); ctx.arc(bx + tx, ty, tr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#5d4232";
    ctx.beginPath(); ctx.arc(bx - 2, -8, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#d9e8f0"; rr(ctx, 48, -12, 22, 18, 4); ctx.fill();
  ctx.fillStyle = "#ffd166";
  for (const [cx2, cy2] of [[54, -2], [62, -4], [58, 1]]) {
    ctx.beginPath(); ctx.arc(cx2, cy2, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#b9c8d4"; ctx.lineWidth = 2; rr(ctx, 48, -12, 22, 18, 4); ctx.stroke();
  // scalloped awning
  const awn = ctx.createLinearGradient(0, -46, 0, -14);
  awn.addColorStop(0, "#f2645a"); awn.addColorStop(1, "#d9453c");
  ctx.fillStyle = awn;
  ctx.beginPath(); ctx.moveTo(-92, -16); ctx.lineTo(-78, -46); ctx.lineTo(78, -46); ctx.lineTo(92, -16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i * 22 - 9, -16); ctx.lineTo(i * 22 - 5, -46); ctx.lineTo(i * 22 + 17, -46); ctx.lineTo(i * 22 + 13, -16);
    ctx.closePath(); ctx.fill();
  }
  // scallop fringe
  for (let sx = -92; sx < 92; sx += 20.5) {
    const stripe = Math.floor((sx + 92) / 20.5) % 2 === 0;
    ctx.fillStyle = stripe ? "#d9453c" : "#fff";
    ctx.beginPath(); ctx.arc(sx + 10, -15, 10, 0, Math.PI); ctx.fill();
  }
  // hanging sign
  ctx.strokeStyle = "#4e3a2a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-34, -8); ctx.lineTo(-30, 22); ctx.moveTo(34, -8); ctx.lineTo(30, 22); ctx.stroke();
  ctx.fillStyle = "#f5efe2"; rr(ctx, -44, 22, 88, 34, 8); ctx.fill();
  ctx.strokeStyle = "#c9a13b"; ctx.lineWidth = 3; rr(ctx, -44, 22, 88, 34, 8); ctx.stroke();
  ctx.fillStyle = "#7a4a1e";
  ctx.font = "900 13px 'Segoe UI',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("🍄 TRUFFLE", 0, 36);
  ctx.fillText("MARKET", 0, 50);
  ctx.restore();

  // golden statues — one per rebirth, lined up by the barn
  for (let i = 0; i < Math.min(6, opts.rebirths || 0); i++) {
    ctx.save();
    ctx.translate(300 + i * 44, 158);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(0, 16, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c9a13b"; rr(ctx, -14, 6, 28, 10, 3); ctx.fill();
    // a PLAIN pig cast in gold (tier 2 = no accessories — tier 9 gave trophies knight helms!)
    drawPig(ctx, { x: 0, y: -6 }, 2, { scale: 0.42, golden: true, phase: 0 });
    ctx.restore();
  }

  // pen: mud wallow + fence
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  rr(ctx, PEN.x - 6, PEN.y - 4, PEN.w + 12, PEN.h + 14, 26); ctx.fill();
  const mud = ctx.createRadialGradient(PEN.x + PEN.w / 2, PEN.y + PEN.h / 2, 60, PEN.x + PEN.w / 2, PEN.y + PEN.h / 2, PEN.w / 2);
  mud.addColorStop(0, P.mud0); mud.addColorStop(0.72, P.mud1); mud.addColorStop(1, P.mud2);
  ctx.fillStyle = mud;
  rr(ctx, PEN.x, PEN.y, PEN.w, PEN.h, 24); ctx.fill();
  // mud blotches
  ctx.fillStyle = P.blotch;
  for (const [bx, by, brx, bry] of [[0.2, 0.3, 60, 24], [0.62, 0.62, 84, 30], [0.42, 0.8, 48, 18], [0.82, 0.25, 52, 20]]) {
    ctx.beginPath(); ctx.ellipse(PEN.x + bx * PEN.w, PEN.y + by * PEN.h, brx, bry, 0, 0, Math.PI * 2); ctx.fill();
  }
  // fence
  ctx.strokeStyle = P.fence; ctx.lineWidth = 7; ctx.lineCap = "round";
  rr(ctx, PEN.x, PEN.y, PEN.w, PEN.h, 24); ctx.stroke();
  ctx.strokeStyle = P.fenceHi; ctx.lineWidth = 3;
  rr(ctx, PEN.x, PEN.y - 5, PEN.w, PEN.h, 24); ctx.stroke();
  const posts = 14;
  ctx.fillStyle = P.fence;
  for (let i = 0; i <= posts; i++) {
    const px = PEN.x + (PEN.w / posts) * i;
    rr(ctx, px - 4, PEN.y - 12, 8, 20, 3); ctx.fill();
  }

  // ---- theme extras ----
  if (P.snow) {   // drifting snowflakes over everything
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 34; i++) {
      const sx = (i * 173 + t * (14 + (i % 5) * 5)) % (W + 20) - 10;
      const sy = (i * 97 + t * (26 + (i % 4) * 9)) % (H + 20) - 10;
      ctx.beginPath(); ctx.arc(sx, sy, i % 3 === 0 ? 2.6 : 1.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (P.fireflies) {   // lazy glowing dots wandering the pen
    for (let i = 0; i < 12; i++) {
      const fxx = PEN.x + 40 + ((Math.sin(t * 0.35 + i * 2.1) * 0.5 + 0.5) * (PEN.w - 80));
      const fy = PEN.y + 30 + ((Math.sin(t * 0.27 + i * 3.7) * 0.5 + 0.5) * (PEN.h - 60));
      ctx.fillStyle = "rgba(255,240,140," + (0.35 + 0.5 * Math.abs(Math.sin(t * 2 + i))) + ")";
      ctx.shadowColor = "#ffe45e"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(fxx, fy, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    // warm barn windows
    ctx.fillStyle = "rgba(255,214,102,0.85)";
    ctx.beginPath(); ctx.arc(88, 116, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(212, 116, 9, 0, Math.PI * 2); ctx.fill();
  }
  if (P.waves) {   // foam sparkles on the water wallow
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const wx = PEN.x + 80 + ((i * 211 + t * 18) % (PEN.w - 160));
      const wy = PEN.y + 50 + ((i * 137) % (PEN.h - 100));
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 9, wy - 4, wx + 18, wy); ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- pigs
// A chunky cartoon pig at (p.x, p.y) canvas px. tier = 1..16, opts.phase = walk anim.
export function drawPig(ctx, p, tier, opts = {}) {
  const T = TIERS[tier - 1] || TIERS[0];
  const s = (opts.scale != null ? opts.scale : T.size) * 30;   // body radius-ish
  const phase = opts.phase || 0;
  const bounce = Math.abs(Math.sin(phase)) * s * 0.10;
  const dir = opts.dir || 1;   // 1 = facing right
  const golden = opts.golden;
  const hue = golden ? 45 : T.hue;
  const sat = golden ? 85 : T.sat;
  const lit = golden ? 60 : (T.light || 72);         // per-tier base lightness
  const body = T.rainbow && !golden
    ? null
    : `hsl(${hue},${sat}%,${lit}%)`;
  const dark = `hsl(${hue},${sat}%,${golden ? 45 : lit - 14}%)`;

  ctx.save();
  ctx.translate(p.x, p.y - bounce);
  if (opts.rot) ctx.rotate(opts.rot);   // pig tricks: spins & rolls
  if (opts.lift) { ctx.translate(0, -8); ctx.scale(1.08, 1.08); }
  ctx.scale(dir, 1);

  // shadow (unscaled by dir flip is fine — symmetric)
  ctx.fillStyle = `rgba(0,0,0,${opts.lift ? 0.28 : 0.18})`;
  ctx.beginPath(); ctx.ellipse(0, s * 0.78 + bounce, s * 1.05, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();

  if (T.glow && !golden) {
    ctx.shadowColor = T.rainbow ? "#fff" : `hsl(${hue},90%,70%)`;
    ctx.shadowBlur = 16;
  }

  // legs (stubby, alternate with walk phase)
  ctx.fillStyle = dark;
  const legLift = Math.sin(phase) * s * 0.08;
  for (const [lx, lo] of [[-0.55, legLift], [-0.2, -legLift], [0.25, legLift], [0.6, -legLift]]) {
    rr(ctx, lx * s - s * 0.09, s * 0.4 - lo, s * 0.22, s * 0.4, s * 0.1); ctx.fill();
  }

  // body
  if (T.rainbow && !golden) {
    const g = ctx.createLinearGradient(-s, 0, s, 0);
    ["#ff6b6b", "#ffb347", "#ffe66d", "#7be07b", "#6bc7ff", "#c792ea"].forEach((c, i, arr) =>
      g.addColorStop(i / (arr.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.05, s * 0.82, 0, 0, Math.PI * 2); ctx.fill();
  // belly highlight
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.25, s * 0.6, s * 0.35, -0.3, 0, Math.PI * 2); ctx.fill();

  // spots
  if (T.spots) {
    ctx.fillStyle = "rgba(90,50,60,0.45)";
    for (const [sx, sy, sr] of [[-0.4, -0.1, 0.2], [0.15, 0.25, 0.16], [0.4, -0.25, 0.13]]) {
      ctx.beginPath(); ctx.arc(sx * s, sy * s, sr * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // mud patches
  if (T.mud) {
    ctx.fillStyle = "rgba(120,80,40,0.55)";
    for (const [sx, sy, sr] of [[-0.3, 0.35, 0.28], [0.35, 0.42, 0.22]]) {
      ctx.beginPath(); ctx.ellipse(sx * s, sy * s, sr * s * 1.4, sr * s, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // armor plate
  if (T.armor) {
    ctx.fillStyle = "#b9c4d4";
    rr(ctx, -s * 0.75, -s * 0.55, s * 1.1, s * 0.75, s * 0.25); ctx.fill();
    ctx.strokeStyle = "#8895a8"; ctx.lineWidth = 2;
    rr(ctx, -s * 0.75, -s * 0.55, s * 1.1, s * 0.75, s * 0.25); ctx.stroke();
    ctx.fillStyle = "#8895a8";
    for (const rx of [-0.5, -0.1, 0.3]) { ctx.beginPath(); ctx.arc(rx * s, -s * 0.15, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
  }
  // crystal facets
  if (T.crystal) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.3); ctx.lineTo(-s * 0.1, s * 0.1); ctx.lineTo(-s * 0.5, s * 0.4);
    ctx.moveTo(0.2 * s, -s * 0.5); ctx.lineTo(0.5 * s, 0); ctx.lineTo(0.1 * s, s * 0.3);
    ctx.stroke();
  }

  // head (front = +x), snout, ears
  const hx = s * 0.78;
  ctx.fillStyle = T.rainbow && !golden ? "#ffd1e8" : body || "#ffd1e8";
  ctx.beginPath(); ctx.arc(hx, -s * 0.12, s * 0.55, 0, Math.PI * 2); ctx.fill();
  // ears — hounds get long droopy flaps; everyone else the perky triangles
  ctx.fillStyle = dark;
  const flap = Math.sin(phase * 2) * 0.15;
  if (T.sniff) {
    for (const [ex, sway] of [[hx - s * 0.3, flap], [hx + s * 0.26, -flap]]) {
      ctx.save(); ctx.translate(ex, -s * 0.5); ctx.rotate(0.25 + sway);
      ctx.beginPath();
      ctx.ellipse(0, s * 0.34, s * 0.16, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsl(${hue},${sat}%,32%)`;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.4, s * 0.09, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = dark;
    }
  } else {
    for (const [ex, rot] of [[hx - s * 0.28, -0.9 + flap], [hx + s * 0.22, -0.4 - flap]]) {
      ctx.save(); ctx.translate(ex, -s * 0.55); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.3, -s * 0.42); ctx.lineTo(s * 0.42, s * 0.05); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  // hound kit: red collar with a gold tag + a freshly-found truffle at the snout
  if (T.sniff) {
    ctx.strokeStyle = "#d9453c"; ctx.lineWidth = s * 0.14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(hx * 0.55, -s * 0.05, s * 0.5, 0.35, Math.PI - 0.5, false); ctx.stroke();
    ctx.fillStyle = "#f4c542";
    ctx.beginPath(); ctx.arc(hx * 0.55, s * 0.44, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a3226";
    ctx.beginPath(); ctx.arc(hx + s * 0.62, s * 0.22, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe9a8";
    drawStar(ctx, hx + s * 0.72, s * 0.1, s * 0.07);
  }
  // eye
  ctx.fillStyle = "#2a2030";
  ctx.beginPath(); ctx.arc(hx + s * 0.12, -s * 0.24, s * 0.075, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(hx + s * 0.15, -s * 0.27, s * 0.025, 0, Math.PI * 2); ctx.fill();
  // snout
  ctx.fillStyle = golden ? "#e8c25a" : `hsl(${hue === -1 ? 340 : hue},${Math.min(90, sat + 10)}%,64%)`;
  ctx.beginPath(); ctx.ellipse(hx + s * 0.42, -s * 0.02, s * 0.26, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(60,20,40,0.55)";
  ctx.beginPath(); ctx.arc(hx + s * 0.36, -s * 0.04, s * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + s * 0.5, -s * 0.04, s * 0.045, 0, Math.PI * 2); ctx.fill();
  // tusks
  if (T.tusks) {
    ctx.strokeStyle = "#f5eed8"; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hx + s * 0.3, s * 0.14); ctx.quadraticCurveTo(hx + s * 0.44, s * 0.1, hx + s * 0.42, -s * 0.08); ctx.stroke();
  }
  // curly tail (back)
  ctx.strokeStyle = dark; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 1.0, -s * 0.1);
  ctx.bezierCurveTo(-s * 1.25, -s * 0.3, -s * 1.05, -s * 0.5, -s * 1.22, -s * 0.42);
  ctx.stroke();

  // accessories above
  ctx.shadowBlur = 0;
  if (T.armor) {
    // proper knight HELM: steel dome over the head, visor slit, red plume
    ctx.fillStyle = "#c4cede";
    ctx.beginPath(); ctx.arc(hx, -s * 0.2, s * 0.58, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = "#aab6c8";
    rr(ctx, hx - s * 0.58, -s * 0.28, s * 1.16, s * 0.2, s * 0.08); ctx.fill();
    ctx.strokeStyle = "#7a8698"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, -s * 0.2, s * 0.58, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke();
    // visor slit
    ctx.fillStyle = "#3a4450";
    rr(ctx, hx - s * 0.02, -s * 0.26, s * 0.5, s * 0.09, s * 0.04); ctx.fill();
    // rivet + plume
    ctx.fillStyle = "#7a8698";
    ctx.beginPath(); ctx.arc(hx - s * 0.4, -s * 0.24, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#d9453c"; ctx.lineWidth = s * 0.16; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.05, -s * 0.72);
    ctx.quadraticCurveTo(hx - s * 0.4, -s * 1.05, hx - s * 0.72, -s * 0.9);
    ctx.stroke();
  }
  if (T.magma) {
    // glowing magma cracks + embers
    ctx.strokeStyle = "#ffb028"; ctx.lineWidth = s * 0.07; ctx.lineCap = "round";
    ctx.shadowColor = "#ff7a20"; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.1); ctx.lineTo(-s * 0.4, s * 0.1); ctx.lineTo(-s * 0.5, s * 0.4);
    ctx.moveTo(-s * 0.1, -s * 0.5); ctx.lineTo(0.1 * s, -s * 0.1); ctx.lineTo(-s * 0.1, s * 0.25);
    ctx.moveTo(0.35 * s, -s * 0.35); ctx.lineTo(0.5 * s, 0); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffde59";
    for (let i = 0; i < 3; i++) {
      const a = phase * 1.6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.9, -s * 0.7 - Math.abs(Math.sin(a)) * s * 0.4, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (T.bolt) {
    // storm cloud + lightning bolt overhead
    ctx.fillStyle = "#8fa0b8";
    for (const [cx2, cy2, cr] of [[-0.15, -1.05, 0.22], [0.12, -1.12, 0.26], [0.38, -1.04, 0.2]]) {
      ctx.beginPath(); ctx.arc(cx2 * s, cy2 * s, cr * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffe45e";
    ctx.beginPath();
    ctx.moveTo(0.14 * s, -s * 0.95); ctx.lineTo(-0.02 * s, -s * 0.62); ctx.lineTo(0.1 * s, -s * 0.62);
    ctx.lineTo(-0.04 * s, -s * 0.3); ctx.lineTo(0.26 * s, -s * 0.68); ctx.lineTo(0.12 * s, -s * 0.68);
    ctx.closePath(); ctx.fill();
  }
  if (T.galaxy) {
    // nebula swirl + starfield speckles on the flank
    ctx.globalAlpha = 0.5;
    const ng = ctx.createRadialGradient(-s * 0.2, 0, s * 0.05, -s * 0.2, 0, s * 0.8);
    ng.addColorStop(0, "#ff9ec4"); ng.addColorStop(0.6, "#6bc7ff"); ng.addColorStop(1, "transparent");
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.ellipse(-s * 0.1, 0, s * 0.85, s * 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    for (const [gx, gy, gr] of [[-0.6, -0.2, 0.05], [-0.25, 0.25, 0.04], [0.1, -0.35, 0.055],
      [0.35, 0.2, 0.04], [-0.45, 0.05, 0.03], [0.5, -0.15, 0.035]]) {
      ctx.beginPath(); ctx.arc(gx * s, gy * s, gr * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (T.ribbon) {
    ctx.fillStyle = "#3f7de0";
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.85, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.78); ctx.lineTo(-s * 0.24, -s * 0.5); ctx.lineTo(-s * 0.05, -s * 0.58);
    ctx.lineTo(0.06 * s, -s * 0.5); ctx.closePath(); ctx.fill();
  }
  if (T.crown) {
    ctx.fillStyle = T.emperor ? "#ffd700" : "#f4c542";
    const cw = s * (T.emperor ? 0.62 : 0.45), cy = -s * (T.emperor ? 0.05 : 0.1) - s * 0.72;
    ctx.beginPath();
    ctx.moveTo(hx - cw / 2, cy + s * 0.22);
    ctx.lineTo(hx - cw / 2, cy);
    ctx.lineTo(hx - cw / 4, cy + s * 0.12); ctx.lineTo(hx, cy);
    ctx.lineTo(hx + cw / 4, cy + s * 0.12); ctx.lineTo(hx + cw / 2, cy);
    ctx.lineTo(hx + cw / 2, cy + s * 0.22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e84f4f";
    ctx.beginPath(); ctx.arc(hx, cy + s * 0.16, s * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  if (T.stars || T.emperor) {
    ctx.fillStyle = "#fff2a8";
    for (let i = 0; i < 3; i++) {
      const a = phase * 1.2 + (i * Math.PI * 2) / 3;
      drawStar(ctx, Math.cos(a) * s * 1.3, -s * 0.2 + Math.sin(a) * s * 0.75, s * 0.12);
    }
  }
  if (T.moon) {
    ctx.fillStyle = "#e8ecff";
    ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.95, s * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.rainbow ? "#000" : `hsl(${hue},${sat}%,72%)`;
    ctx.beginPath(); ctx.arc(s * 0.05, -s * 1.0, s * 0.16, 0, Math.PI * 2); ctx.fill();
  }
  if (T.sun) {
    ctx.strokeStyle = "#ffde59"; ctx.lineWidth = s * 0.07; ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + phase * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 1.15, Math.sin(a) * s * 0.95);
      ctx.lineTo(Math.cos(a) * s * 1.38, Math.sin(a) * s * 1.14);
      ctx.stroke();
    }
  }
  if (T.robo) {
    // antenna + panel seams + glowing sensor eye
    ctx.strokeStyle = "#7a8698"; ctx.lineWidth = s * 0.07; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.72); ctx.lineTo(-s * 0.12, -s * 1.05); ctx.stroke();
    ctx.fillStyle = "#7fe8ff";
    ctx.beginPath(); ctx.arc(-s * 0.12, -s * 1.1, s * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(90,105,125,0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.1); ctx.lineTo(s * 0.3, -s * 0.1);
    ctx.moveTo(-s * 0.3, -s * 0.55); ctx.lineTo(-s * 0.3, s * 0.45); ctx.stroke();
    ctx.fillStyle = "#7a8698";
    for (const [rx2, ry2] of [[-0.6, -0.3], [-0.05, 0.3], [0.2, -0.4]]) {
      ctx.beginPath(); ctx.arc(rx2 * s, ry2 * s, s * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#7fe8ff";
    ctx.beginPath(); ctx.arc(hx + s * 0.12, -s * 0.24, s * 0.09, 0, Math.PI * 2); ctx.fill();
  }
  if (T.dragon) {
    // flapping bat-wings + head horns + a puff of snout-fire
    ctx.fillStyle = `hsl(${hue},${sat + 10}%,${(T.light || 60) - 18}%)`;
    const wingFlap = Math.sin(phase * 2.2) * 0.25;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-s * 0.25 + side * s * 0.12, -s * 0.55);
      ctx.rotate(side * (0.5 + wingFlap));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.35, -s * 0.75, -s * 0.05, -s * 0.9);
      ctx.lineTo(s * 0.06, -s * 0.55); ctx.lineTo(s * 0.2, -s * 0.75); ctx.lineTo(s * 0.16, -s * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#f5eed8";
    for (const hx2 of [hx - s * 0.2, hx + s * 0.1]) {
      ctx.beginPath();
      ctx.moveTo(hx2, -s * 0.6); ctx.lineTo(hx2 + s * 0.08, -s * 0.88); ctx.lineTo(hx2 + s * 0.16, -s * 0.58);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,176,40,0.9)";
    const puff = 0.6 + Math.abs(Math.sin(phase * 1.4)) * 0.5;
    ctx.beginPath(); ctx.arc(hx + s * 0.78, -s * 0.02, s * 0.12 * puff, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,222,89,0.9)";
    ctx.beginPath(); ctx.arc(hx + s * 0.7, -s * 0.02, s * 0.08 * puff, 0, Math.PI * 2); ctx.fill();
  }
  if (T.phoenix) {
    // fiery crest + flaming tail feathers
    for (const [cols, shrink] of [[["#e84f4f", "#ff8c42"], 1], [["#ffde59", "#ffb028"], 0.6]]) {
      ctx.fillStyle = cols[0];
      for (const [fxx, h] of [[-0.25, 0.55], [0, 0.8], [0.25, 0.6]]) {
        const flick = Math.sin(phase * 3 + fxx * 9) * 0.1;
        ctx.beginPath();
        ctx.moveTo(fxx * s - s * 0.13 * shrink, -s * 0.7);
        ctx.quadraticCurveTo(fxx * s - s * 0.18, -s * (0.7 + h * 0.6), fxx * s + (flick * s), -s * (0.7 + h * shrink));
        ctx.quadraticCurveTo(fxx * s + s * 0.18, -s * (0.7 + h * 0.6), fxx * s + s * 0.13 * shrink, -s * 0.7);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = "#ffb028";
    ctx.beginPath(); ctx.arc(-s * 1.12, -s * 0.35, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffde59";
    ctx.beginPath(); ctx.arc(-s * 1.2, -s * 0.5, s * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  if (T.infinity) {
    // the ∞ halo + a rainbow rim ring around the whole hog
    ctx.strokeStyle = "#fff"; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(-s * 0.14, -s * 1.05, s * 0.14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 1.05, s * 0.14, 0, Math.PI * 2); ctx.stroke();
    const rim = ctx.createLinearGradient(-s, 0, s, 0);
    ["#ff6b6b", "#ffe66d", "#7be07b", "#6bc7ff", "#c792ea"].forEach((c, i, a2) => rim.addColorStop(i / (a2.length - 1), c));
    ctx.strokeStyle = rim; ctx.lineWidth = s * 0.08; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.16, s * 0.93, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (T.frost) {
    // ice crown of jagged spikes, icicles under the belly, drifting snowflakes
    ctx.fillStyle = "#dff6ff";
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.5, -s * 0.55);
    for (let i = 0; i < 5; i++) {
      const bx = hx - s * 0.5 + (i * s) / 4;
      ctx.lineTo(bx + s * 0.125, -s * (0.85 + (i % 2 ? 0.25 : 0.05)));
      ctx.lineTo(bx + s * 0.25, -s * 0.55);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#8fd4e8"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "rgba(230,248,255,0.95)";
    for (const [ix, h] of [[-0.7, 0.35], [-0.35, 0.55], [0.05, 0.4], [0.4, 0.6]]) {
      ctx.beginPath(); ctx.moveTo(ix * s - s * 0.08, s * 0.72); ctx.lineTo(ix * s, s * (0.72 + h)); ctx.lineTo(ix * s + s * 0.08, s * 0.72); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = phase * 0.7 + (i * Math.PI * 2) / 3;
      const fx2 = Math.cos(a) * s * 1.3, fy2 = -s * 0.3 + Math.sin(a) * s * 0.7;
      for (let k = 0; k < 3; k++) {
        const b = (k * Math.PI) / 3 + phase;
        ctx.beginPath(); ctx.moveTo(fx2 - Math.cos(b) * s * 0.1, fy2 - Math.sin(b) * s * 0.1); ctx.lineTo(fx2 + Math.cos(b) * s * 0.1, fy2 + Math.sin(b) * s * 0.1); ctx.stroke();
      }
    }
  }
  if (T.shadow) {
    // rising smoke wisps + glowing red eye
    for (let i = 0; i < 4; i++) {
      const k = ((phase * 0.5 + i * 0.7) % 2) / 2;
      ctx.fillStyle = `rgba(176,76,255,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(-s * 0.6 + i * s * 0.35 + Math.sin(k * 6 + i) * s * 0.1, -s * 0.4 - k * s * 1.0, s * (0.18 + k * 0.12), 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ff3b3b"; ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(hx + s * 0.12, -s * 0.24, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (T.ocean) {
    // dorsal fin, wave stripe along the flank, rising bubbles
    ctx.fillStyle = `hsl(${hue},${sat}%,${lit - 20}%)`;
    ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.7); ctx.quadraticCurveTo(-s * 0.2, -s * 1.35, s * 0.15, -s * 0.75); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(232,251,255,0.9)"; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-s * 0.85, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.35, -s * 0.15, s * 0.05); ctx.quadraticCurveTo(s * 0.2, s * 0.45, s * 0.55, s * 0.05); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = ((phase * 0.6 + i * 0.66) % 2) / 2;
      ctx.beginPath(); ctx.arc(hx + s * 0.55 + Math.sin(k * 8) * s * 0.08, -s * 0.2 - k * s * 1.1, s * (0.05 + k * 0.08), 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (T.titan) {
    // stone cracks, moss patches, glowing runes
    ctx.strokeStyle = "rgba(40,32,28,0.75)"; ctx.lineWidth = s * 0.05; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, -s * 0.2); ctx.lineTo(-s * 0.45, s * 0.05); ctx.lineTo(-s * 0.55, s * 0.45);
    ctx.moveTo(-s * 0.1, -s * 0.6); ctx.lineTo(0.05 * s, -s * 0.2); ctx.lineTo(-s * 0.15, s * 0.3);
    ctx.moveTo(0.4 * s, -s * 0.4); ctx.lineTo(0.55 * s, s * 0.1); ctx.stroke();
    ctx.fillStyle = "#6fa84f";
    for (const [mx, my, mr] of [[-0.6, 0.45, 0.22], [0.3, -0.55, 0.18], [0.6, 0.4, 0.16]]) {
      ctx.beginPath(); ctx.ellipse(mx * s, my * s, mr * s * 1.4, mr * s, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#ffb028"; ctx.lineWidth = s * 0.06; ctx.shadowColor = "#ffb028"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0.1 * s, -s * 0.05); ctx.lineTo(0.25 * s, 0.15 * s); ctx.lineTo(0.1 * s, 0.35 * s);
    ctx.moveTo(-0.35 * s, -s * 0.3); ctx.lineTo(-0.35 * s, -s * 0.0); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (T.angel) {
    // feathered wings that beat slowly + a gold halo
    const beat = Math.sin(phase * 1.4) * 0.18;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-s * 0.2 + side * s * 0.15, -s * 0.5);
      ctx.rotate(side * (0.35 + beat));
      ctx.fillStyle = "#fff";
      for (const [wx, wy, wr] of [[0, -0.55, 0.3], [-0.28, -0.95, 0.28], [-0.55, -1.25, 0.25]]) {
        ctx.beginPath(); ctx.ellipse(wx * s, wy * s, wr * s * 1.3, wr * s * 0.7, -0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,220,120,0.6)"; ctx.lineWidth = 1.2;
      for (const [wx, wy, wr] of [[0, -0.55, 0.3], [-0.28, -0.95, 0.28], [-0.55, -1.25, 0.25]]) {
        ctx.beginPath(); ctx.ellipse(wx * s, wy * s, wr * s * 1.3, wr * s * 0.7, -0.6, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = "#ffd700"; ctx.lineWidth = s * 0.08; ctx.shadowColor = "#ffe9a8"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(hx, -s * 0.95, s * 0.42, s * 0.13, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (T.omega) {
    // two tilted orbit rings spinning around the whole pig + a gold Ω overhead
    for (const [tilt, sp] of [[0.5, 1], [-0.6, -0.8]]) {
      ctx.save();
      ctx.rotate(tilt);
      ctx.strokeStyle = "rgba(255,215,0,0.85)"; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.45, s * 0.4 * Math.abs(Math.cos(phase * 0.3 * sp)) + s * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = "#ffd700"; ctx.lineWidth = s * 0.12; ctx.lineCap = "round";
    ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 1.25, s * 0.22, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 1.0); ctx.lineTo(-s * 0.22, -s * 1.0);
    ctx.moveTo(0.02 * s, -s * 1.0); ctx.lineTo(0.2 * s, -s * 1.0); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

export function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx[i === 0 ? "moveTo" : "lineTo"](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
}

// Truffle by pig TIER: bigger and fancier as tiers climb, so a high pig's payday
// reads at a glance. Bands 1-15 group by threes; every tier from 16 up digs its
// OWN signature truffle (imperial, magma, storm, galaxy, cosmic, robo, dragon,
// phoenix, infinity) so the new pigs never look like "just another gold one".
const TRUFFLE_STYLES = {
  //         body       highlight   glow
  brown:    ["#4a3226", "#5d4232",  null],
  fleck:    ["#4a3226", "#5d4232",  null],
  white:    ["#e8dcc8", "#f5efe2",  null],
  golden:   ["#e0a92b", "#f5c862",  "#ffd166"],
  crystal:  ["#8fd4e8", "#c8ecf5",  "#aef7ff"],
  imperial: ["#f5c33b", "#ffe28a",  "#fff2a8"],
  magma:    ["#3a2a26", "#54382c",  "#ff7a20"],
  storm:    ["#8fa0b8", "#c4d0e0",  "#cfe4ff"],
  galaxy:   ["#2c2050", "#4a3a80",  "#b39dff"],
  cosmic:   ["#3a3a52", "#6a6a8a",  "#ffffff"],
  robo:     ["#9aa7b8", "#d4dde8",  "#7fe8ff"],
  dragon:   ["#3f7d3a", "#66a85c",  "#a8ff8a"],
  phoenix:  ["#c9463c", "#f0973a",  "#ffb028"],
  infinity: ["#141020", "#2a2440",  "#e8d9ff"],
  frost:    ["#bfe6f5", "#e8f8ff",  "#aef0ff"],
  shadow:   ["#1a1226", "#2e2040",  "#b04cff"],
  ocean:    ["#1f7f8f", "#4fc3d0",  "#7fe8ff"],
  titan:    ["#5a5148", "#8a7f72",  "#ffb028"],
  angel:    ["#fff8e8", "#ffffff",  "#ffe9a8"],
  omega:    ["#0d0a14", "#3a2a50",  "#ffd700"],
};
const TIER_TRUFFLE = ["imperial", "magma", "storm", "galaxy", "cosmic", "robo", "dragon", "phoenix", "infinity",
  "frost", "shadow", "ocean", "titan", "angel", "omega"];
export function drawTruffle(ctx, x, y, tier = 1) {
  const r = 7 + Math.min(22, tier) * 0.85;                   // t1 ≈ 8px … t24 ≈ 26px
  const key = tier >= 16 ? (TIER_TRUFFLE[Math.min(TIER_TRUFFLE.length - 1, tier - 16)] || "infinity")
    : tier >= 13 ? "crystal" : tier >= 10 ? "golden" : tier >= 7 ? "white" : tier >= 4 ? "fleck" : "brown";
  const [bodyCol, hiCol, glow] = TRUFFLE_STYLES[key];
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12 + r * 0.3; }
  // lumpy silhouette: three overlapping blobs
  ctx.fillStyle = bodyCol;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - r * 0.45, y + r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hiCol;
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // signature decorations
  if (key === "fleck") {
    ctx.fillStyle = "#ffd166";
    for (const [fx2, fy2] of [[-0.4, 0.15], [0.25, -0.35], [0.45, 0.3]]) {
      ctx.beginPath(); ctx.arc(x + fx2 * r, y + fy2 * r, r * 0.13, 0, Math.PI * 2); ctx.fill();
    }
  } else if (key === "white") {
    ctx.strokeStyle = "#c9b998"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y); ctx.quadraticCurveTo(x, y - r * 0.4, x + r * 0.5, y + r * 0.1);
    ctx.moveTo(x - r * 0.3, y + r * 0.4); ctx.quadraticCurveTo(x + r * 0.1, y + r * 0.1, x + r * 0.4, y + r * 0.45);
    ctx.stroke();
  } else if (key === "crystal") {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    ["#ff9ec4", "#ffe66d", "#7be07b", "#6bc7ff"].forEach((c, i, a2) => g.addColorStop(i / (a2.length - 1), c));
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.2); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x - r * 0.3, y + r * 0.5);
    ctx.moveTo(x + r * 0.15, y - r * 0.5); ctx.lineTo(x + r * 0.45, y); ctx.stroke();
  } else if (key === "imperial") {
    ctx.fillStyle = "#fff";
    drawStar(ctx, x, y - r * 0.9, r * 0.42);
  } else if (key === "magma") {
    ctx.strokeStyle = "#ffb028"; ctx.lineWidth = r * 0.1; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y - r * 0.1); ctx.lineTo(x - r * 0.2, y + r * 0.15); ctx.lineTo(x - r * 0.35, y + r * 0.5);
    ctx.moveTo(x + r * 0.1, y - r * 0.45); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x + r * 0.1, y + r * 0.4);
    ctx.stroke();
  } else if (key === "storm") {
    ctx.fillStyle = "#ffe45e";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.1, y - r * 0.55); ctx.lineTo(x - r * 0.15, y + r * 0.05); ctx.lineTo(x + r * 0.05, y + r * 0.05);
    ctx.lineTo(x - r * 0.1, y + r * 0.6); ctx.lineTo(x + r * 0.35, y - r * 0.1); ctx.lineTo(x + r * 0.12, y - r * 0.1);
    ctx.closePath(); ctx.fill();
  } else if (key === "galaxy") {
    ctx.fillStyle = "#fff";
    for (const [gx, gy, gr] of [[-0.45, -0.2, 0.09], [0.1, 0.3, 0.07], [0.4, -0.3, 0.1], [-0.1, -0.45, 0.06]]) {
      ctx.beginPath(); ctx.arc(x + gx * r, y + gy * r, gr * r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (key === "cosmic") {
    // a tiny ringed planet
    const g = ctx.createLinearGradient(x - r, y, x + r, y);
    ["#ff9ec4", "#ffe66d", "#7be07b", "#6bc7ff", "#c792ea"].forEach((c, i, a2) => g.addColorStop(i / (a2.length - 1), c));
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 0.4, -0.35, 0, Math.PI * 2); ctx.stroke();
  } else if (key === "robo") {
    ctx.strokeStyle = "#5d6b7d"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x + r * 0.6, y);
    ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x, y + r * 0.55); ctx.stroke();
    ctx.fillStyle = "#7fe8ff";
    ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5d6b7d";
    for (const [rx, ry] of [[-0.4, -0.35], [-0.35, 0.35], [0.45, 0.3]]) {
      ctx.beginPath(); ctx.arc(x + rx * r, y + ry * r, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
  } else if (key === "dragon") {
    // scale arcs + a little flame
    ctx.strokeStyle = "#2c5a28"; ctx.lineWidth = 1.3;
    for (const [sx, sy] of [[-0.35, -0.15], [0.05, -0.3], [0.35, -0.05], [-0.1, 0.2], [0.25, 0.3]]) {
      ctx.beginPath(); ctx.arc(x + sx * r, y + sy * r, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = "#ffb028";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.75, y - r * 0.5); ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.9, x + r * 0.7, y - r * 1.05);
    ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.75, x + r * 0.55, y - r * 0.7); ctx.closePath(); ctx.fill();
  } else if (key === "phoenix") {
    // flame crest licking off the top
    ctx.fillStyle = "#ffde59";
    for (const [fxx, h] of [[-0.35, 0.7], [0, 1.0], [0.35, 0.75]]) {
      ctx.beginPath();
      ctx.moveTo(x + fxx * r - r * 0.14, y - r * 0.5);
      ctx.quadraticCurveTo(x + fxx * r - r * 0.2, y - r * (0.5 + h * 0.5), x + fxx * r, y - r * (0.5 + h));
      ctx.quadraticCurveTo(x + fxx * r + r * 0.2, y - r * (0.5 + h * 0.5), x + fxx * r + r * 0.14, y - r * 0.5);
      ctx.closePath(); ctx.fill();
    }
  } else if (key === "infinity") {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = r * 0.14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x - r * 0.28, y, r * 0.26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r * 0.28, y, r * 0.26, 0, Math.PI * 2); ctx.stroke();
  } else if (key === "frost") {
    // icicles dripping off the bottom + a snowflake
    ctx.fillStyle = "#e8f8ff";
    for (const [ix, h] of [[-0.5, 0.5], [-0.1, 0.8], [0.35, 0.6]]) {
      ctx.beginPath(); ctx.moveTo(x + ix * r - r * 0.12, y + r * 0.6); ctx.lineTo(x + ix * r, y + r * (0.6 + h)); ctx.lineTo(x + ix * r + r * 0.12, y + r * 0.6); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r * 0.45, y - Math.sin(a) * r * 0.45); ctx.lineTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45); ctx.stroke();
    }
  } else if (key === "shadow") {
    // wisps of purple smoke + two glowing eyes
    ctx.fillStyle = "rgba(176,76,255,0.45)";
    for (const [wx, wy, wr] of [[-0.5, -0.7, 0.28], [0.1, -0.95, 0.24], [0.55, -0.6, 0.2]]) {
      ctx.beginPath(); ctx.arc(x + wx * r, y + wy * r, wr * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.05, r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.2, y - r * 0.05, r * 0.11, 0, Math.PI * 2); ctx.fill();
  } else if (key === "ocean") {
    // wave stripe + bubbles
    ctx.strokeStyle = "#e8fbff"; ctx.lineWidth = r * 0.12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.05);
    ctx.quadraticCurveTo(x - r * 0.35, y - r * 0.35, x, y + r * 0.05); ctx.quadraticCurveTo(x + r * 0.35, y + r * 0.45, x + r * 0.7, y + r * 0.05); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.2;
    for (const [bx, by, br] of [[-0.4, -0.9, 0.12], [0.2, -1.15, 0.16], [0.55, -0.8, 0.1]]) {
      ctx.beginPath(); ctx.arc(x + bx * r, y + by * r, br * r, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (key === "titan") {
    // stone cracks + moss + a glowing rune
    ctx.strokeStyle = "#2f2a26"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x - r * 0.2, y + r * 0.1); ctx.lineTo(x - r * 0.3, y + r * 0.5);
    ctx.moveTo(x + r * 0.2, y - r * 0.5); ctx.lineTo(x + r * 0.4, y + r * 0.1); ctx.stroke();
    ctx.fillStyle = "#6fa84f";
    ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.45, r * 0.3, r * 0.14, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffb028"; ctx.lineWidth = r * 0.1; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - r * 0.05, y - r * 0.35); ctx.lineTo(x + r * 0.05, y - r * 0.05); ctx.lineTo(x - r * 0.1, y + r * 0.2); ctx.stroke();
  } else if (key === "angel") {
    // halo + tiny feather wings
    ctx.strokeStyle = "#ffd700"; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.ellipse(x, y - r * 1.05, r * 0.5, r * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + side * r * 0.6, y - r * 0.1);
      ctx.quadraticCurveTo(x + side * r * 1.35, y - r * 0.9, x + side * r * 1.3, y - r * 0.1);
      ctx.quadraticCurveTo(x + side * r * 1.0, y + r * 0.1, x + side * r * 0.6, y + r * 0.15); ctx.closePath(); ctx.fill();
    }
  } else if (key === "omega") {
    // gold Ω + a rainbow ring
    const g = ctx.createLinearGradient(x - r, y, x + r, y);
    ["#ff6b6b", "#ffe66d", "#7be07b", "#6bc7ff", "#c792ea"].forEach((c, i, a2) => g.addColorStop(i / (a2.length - 1), c));
    ctx.strokeStyle = g; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#ffd700"; ctx.lineWidth = r * 0.16; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.4, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.42); ctx.lineTo(x - r * 0.22, y + r * 0.42);
    ctx.moveTo(x + r * 0.22, y + r * 0.42); ctx.lineTo(x + r * 0.55, y + r * 0.42); ctx.stroke();
  }
  // sparkle (everyone gets one; brighter with a glow)
  ctx.fillStyle = glow ? "#ffffff" : "#ffe9a8";
  drawStar(ctx, x + r * 0.55, y - r * 0.55, r * 0.3);
  ctx.restore();
}

// pulsing gold ring under a pig — "this one matches what you're dragging!"
export function drawHintRing(ctx, x, y, radius, time) {
  const pulse = 1 + Math.sin(time * 6) * 0.12;
  ctx.save();
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3.5;
  ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.ellipse(x, y + radius * 0.55, radius * 1.25 * pulse, radius * 0.5 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

const CRATE_STYLE = {
  wooden: { body: "#c58b4e", edge: "#8a5a33", q: "#ffd166", glow: null },
  iron:   { body: "#9aa7b8", edge: "#5d6b7d", q: "#eaf2ff", glow: null, rivets: true },
  golden: { body: "#f2c94c", edge: "#b8860b", q: "#fff", glow: "#ffd166", star: true },
};
export function drawCrate(ctx, x, y, wob = 0, type = "wooden") {
  const st = CRATE_STYLE[type] || CRATE_STYLE.wooden;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(wob) * 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(0, 24, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (st.glow) { ctx.shadowColor = st.glow; ctx.shadowBlur = 18; }
  ctx.fillStyle = st.body; rr(ctx, -22, -20, 44, 42, 6); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = st.edge; ctx.lineWidth = 4;
  rr(ctx, -22, -20, 44, 42, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, 1); ctx.lineTo(22, 1); ctx.moveTo(0, -20); ctx.lineTo(0, 22); ctx.stroke();
  if (st.rivets) {
    ctx.fillStyle = "#5d6b7d";
    for (const [rx, ry] of [[-16, -14], [16, -14], [-16, 16], [16, 16]]) {
      ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = st.q;
  ctx.font = "900 22px 'Segoe UI',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", 0, -9);
  if (st.star) { ctx.fillStyle = "#fff"; drawStar(ctx, 16, -26, 7); }
  ctx.restore();
}
