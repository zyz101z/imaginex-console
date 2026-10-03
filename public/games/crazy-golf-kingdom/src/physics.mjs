// CRAZY GOLF KINGDOM — ball physics. Pure module (no DOM), driven by test/physics.test.mjs
// and by main.js. Units: metres, seconds. Y is up. The course lives in the XZ plane.
//
// A Hole (from coursegen) is compiled into a World here: height field + wall segments +
// circle colliders + dynamic pieces (windmills, spinners, moving walls) + surface patches.

export const BALL_R = 0.12;
export const TILE = 2.2;               // metres per grid tile
export const CUP_R = 0.2;
export const CUP_CAPTURE_D = 0.15;
export const CUP_CAPTURE_SPEED = 2.6;
export const MAX_STROKES = 8;
export const MIN_SHOT = 1.5, MAX_SHOT = 13;
export const REST_SPEED = 0.05;
export const STEP = 1 / 120;

export const SURFACE = {
  felt:  { friction: 0.9,  name: 'felt' },
  sand:  { friction: 4.0,  name: 'sand' },
  ice:   { friction: 0.15, name: 'ice' },
  syrup: { friction: 3.0,  name: 'syrup' },
};

// ---------- small vector helpers ----------
const len = (x, z) => Math.hypot(x, z);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- World compilation ----------
// hole: { w, h, tiles: Map key "x,z" -> {x,z,height,surface,ramp?:{dir,from,to}}, tee:{x,z}, cup:{x,z},
//         obstacles:[...], gravity }
export function compileWorld(hole) {
  const tiles = new Map();
  for (const t of hole.tiles) tiles.set(t.x + ',' + t.z, t);
  const walls = [];      // {ax,az,bx,bz, kind:'wall'|'block'}
  const circles = [];    // {x,z,r,kind:'bumper'|'model', rest}
  const dynamics = [];   // {type:'windmill'|'spinner'|'mover', ...}
  const pads = [];       // {x,z,r,type:'boost'|'teleport'|'cannon', dirx,dirz,strength,tx,tz}
  const waters = [];     // circles that reset the ball {x,z,r}

  const gaps = new Set((hole.gaps || []).map(g => g.x + ',' + g.z));
  const has = (x, z) => tiles.has(x + ',' + z) || gaps.has(x + ',' + z);
  // outer walls: every tile edge without a neighbour gets a wall segment (gap edges stay open)
  for (const t of hole.tiles) {
    const x0 = t.x * TILE, z0 = t.z * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
    if (!has(t.x, t.z - 1)) walls.push({ ax: x0, az: z0, bx: x1, bz: z0, kind: 'wall' });
    if (!has(t.x, t.z + 1)) walls.push({ ax: x1, az: z1, bx: x0, bz: z1, kind: 'wall' });
    if (!has(t.x - 1, t.z)) walls.push({ ax: x0, az: z1, bx: x0, bz: z0, kind: 'wall' });
    if (!has(t.x + 1, t.z)) walls.push({ ax: x1, az: z0, bx: x1, bz: z1, kind: 'wall' });
  }
  for (const o of hole.obstacles || []) {
    const cx = (o.x + 0.5) * TILE, cz = (o.z + 0.5) * TILE;
    switch (o.type) {
      case 'bumper': circles.push({ x: cx + (o.dx || 0), z: cz + (o.dz || 0), r: o.r || 0.32, kind: 'bumper', rest: 1.15 }); break;
      case 'model':  circles.push({ x: cx, z: cz, r: o.r || 0.55, kind: 'model', rest: 0.6 }); break;
      case 'block': { // axis-aligned box inside the tile, expressed as 4 walls
        const hw = (o.w || 0.5) * TILE / 2, hd = (o.d || 0.5) * TILE / 2;
        const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;
        walls.push({ ax: x0, az: z0, bx: x1, bz: z0, kind: 'block' }, { ax: x1, az: z0, bx: x1, bz: z1, kind: 'block' },
                   { ax: x1, az: z1, bx: x0, bz: z1, kind: 'block' }, { ax: x0, az: z1, bx: x0, bz: z0, kind: 'block' });
        break; }
      case 'windmill': dynamics.push({ type: 'windmill', x: cx, z: cz, len: o.len || TILE * 0.95, speed: o.speed || 1.2, phase: o.phase || 0, blades: 2 }); break;
      case 'spinner':  dynamics.push({ type: 'spinner', x: cx, z: cz, len: o.len || TILE * 0.8, speed: o.speed || 2.0, phase: o.phase || 0, blades: 1 }); if (o.hubR) circles.push({ x: cx, z: cz, r: o.hubR, kind: 'model', rest: 0.6 }); break;
      case 'mover': dynamics.push({ type: 'mover', x: cx, z: cz, axis: o.axis || 'x', amp: (o.amp || 0.6) * TILE, speed: o.speed || 1.0, phase: o.phase || 0, hw: o.hw != null ? o.hw * TILE : 0.14, hd: o.hd != null ? o.hd * TILE : TILE * 0.42 }); break;
      case 'attractor': pads.push({ type: 'attractor', x: cx, z: cz, r: o.r || TILE * 2, strength: o.strength || 5, core: o.core || 0.4 }); circles.push({ x: cx, z: cz, r: o.core || 0.4, kind: 'model', rest: 0.85 }); break;
      case 'boost': pads.push({ type: 'boost', x: cx, z: cz, r: TILE * 0.42, dirx: o.dirx, dirz: o.dirz, strength: o.strength || 7 }); break;
      case 'teleport': pads.push({ type: 'teleport', x: cx, z: cz, r: o.r || 0.45, tx: (o.tx + 0.5) * TILE, tz: (o.tz + 0.5) * TILE, id: o.id, exits: o.exits ? o.exits.map(e => ({ tx: (e.tx + 0.5) * TILE, tz: (e.tz + 0.5) * TILE })) : null }); break;
      case 'cannon': pads.push({ type: 'cannon', x: cx, z: cz, r: 0.34, tx: (o.tx + 0.5) * TILE, tz: (o.tz + 0.5) * TILE }); break;
      case 'water': waters.push({ x: cx, z: cz, r: (o.r || 0.42) * TILE }); break;
      case 'tide': waters.push({ x: cx, z: cz, r: (o.r || 0.42) * TILE, period: o.period || 5.0, phase: o.phase || 0, duty: o.duty || 0.5 }); break;
      case 'whirlpool': pads.push({ type: 'attractor', x: cx, z: cz, r: o.r || TILE * 1.2, strength: o.strength || 4.5, core: o.core || 0.3, sink: true }); waters.push({ x: cx, z: cz, r: o.core || 0.3, sink: true }); break;
      case 'turntable': pads.push({ type: 'turntable', x: cx, z: cz, r: TILE * 0.48, omega: o.omega || 1.6 }); break;
      case 'jump': pads.push({ type: 'jump', x: cx, z: cz, r: 0.36, dirx: o.dirx, dirz: o.dirz, vy: o.vy || 4.2, minSpeed: o.minSpeed || 4.6 }); break;
    }
  }
  return { hole, tiles, gaps, walls, circles, dynamics, pads, waters, gravity: hole.gravity || 9.8,
           teeX: (hole.tee.x + 0.5) * TILE, teeZ: (hole.tee.z + 0.5) * TILE,
           cupX: (hole.cup.x + 0.5) * TILE, cupZ: (hole.cup.z + 0.5) * TILE };
}

// a tide pool is full (deadly) for `duty` of each period; render + physics share this
export function tideLevel(w, t) { if (!w.period) return 1; const u = ((t + w.phase) % w.period) / w.period; const edge = 0.12; const d = w.duty; if (u < d - edge) return 1; if (u < d) return 1 - (u - (d - edge)) / edge; if (u < 1 - edge) return 0; return (u - (1 - edge)) / edge; }
export function tileAt(world, x, z) {
  return world.tiles.get(Math.floor(x / TILE) + ',' + Math.floor(z / TILE)) || null;
}

// Height of the floor at (x,z). Ramp tiles interpolate linearly from `from` to `to` along dir.
export function floorHeight(world, x, z) {
  const t = tileAt(world, x, z);
  if (!t) return -Infinity;
  if (!t.ramp) return t.height;
  const fx = x / TILE - t.x, fz = z / TILE - t.z;  // 0..1 inside tile
  const u = t.ramp.dir === 'x' ? fx : t.ramp.dir === '-x' ? 1 - fx : t.ramp.dir === 'z' ? fz : 1 - fz;
  return t.ramp.from + (t.ramp.to - t.ramp.from) * clamp(u, 0, 1);
}

export function surfaceAt(world, x, z) {
  const t = tileAt(world, x, z);
  return SURFACE[(t && t.surface) || 'felt'];
}

// slope gradient (dh/dx, dh/dz) by finite difference
function gradient(world, x, z) {
  const e = 0.02;
  const hx0 = floorHeight(world, x - e, z), hx1 = floorHeight(world, x + e, z);
  const hz0 = floorHeight(world, x, z - e), hz1 = floorHeight(world, x, z + e);
  const gx = (isFinite(hx0) && isFinite(hx1)) ? (hx1 - hx0) / (2 * e) : 0;
  const gz = (isFinite(hz0) && isFinite(hz1)) ? (hz1 - hz0) / (2 * e) : 0;
  return [gx, gz];
}

// ---------- Ball ----------
export function newBall(world) {
  return { x: world.teeX, z: world.teeZ, y: floorHeight(world, world.teeX, world.teeZ), vx: 0, vz: 0, vy: 0,
           airborne: false, resting: true, lastX: world.teeX, lastZ: world.teeZ, inCup: false,
           rotAxisX: 0, rotAxisZ: 0, spin: 0, cannonT: 0, cannonFrom: null, cannonTo: null, cannonY: 0,
           teleportCooldown: 0, air: false, vy0: 0, jumpCooldown: 0, events: [] };
}

export function shoot(ball, dirx, dirz, power) {
  const l = len(dirx, dirz) || 1;
  const s = MIN_SHOT + (MAX_SHOT - MIN_SHOT) * clamp(power, 0, 1);
  ball.vx = dirx / l * s; ball.vz = dirz / l * s;
  ball.resting = false; ball.lastX = ball.x; ball.lastZ = ball.z;
  ball.events.push({ type: 'shot', power });
}

// dynamic piece segment(s) at time t
export function dynamicSegments(d, t) {
  const segs = [];
  if (d.type === 'windmill' || d.type === 'spinner') {
    const a = d.phase + t * d.speed;
    for (let i = 0; i < d.blades; i++) {
      const ang = a + i * Math.PI / d.blades;
      const dx = Math.cos(ang) * d.len / 2, dz = Math.sin(ang) * d.len / 2;
      segs.push({ ax: d.x - dx, az: d.z - dz, bx: d.x + dx, bz: d.z + dz, vel: ang, dyn: d });
    }
  } else if (d.type === 'mover') {
    const off = Math.sin(d.phase + t * d.speed) * d.amp;
    const cx = d.axis === 'x' ? d.x + off : d.x, cz = d.axis === 'z' ? d.z + off : d.z;
    const hw = d.axis === 'x' ? d.hw : d.hd, hd = d.axis === 'x' ? d.hd : d.hw;
    segs.push({ ax: cx - hw, az: cz - hd, bx: cx + hw, bz: cz - hd }, { ax: cx + hw, az: cz - hd, bx: cx + hw, bz: cz + hd },
              { ax: cx + hw, az: cz + hd, bx: cx - hw, bz: cz + hd }, { ax: cx - hw, az: cz + hd, bx: cx - hw, bz: cz - hd });
    for (const s of segs) s.dyn = d;
  }
  return segs;
}

export function moverOffset(d, t) { return Math.sin(d.phase + t * d.speed) * d.amp; }
export function bladeAngle(d, t) { return d.phase + t * d.speed; }

// circle vs segment: returns {nx,nz,pen} or null
function circleSeg(px, pz, r, s) {
  const abx = s.bx - s.ax, abz = s.bz - s.az;
  const l2 = abx * abx + abz * abz || 1e-9;
  let u = ((px - s.ax) * abx + (pz - s.az) * abz) / l2; u = clamp(u, 0, 1);
  const cx = s.ax + abx * u, cz = s.az + abz * u;
  const dx = px - cx, dz = pz - cz; const d = len(dx, dz);
  if (d >= r) return null;
  if (d < 1e-6) { // on the line — push along segment normal
    const nl = Math.sqrt(l2); return { nx: -abz / nl, nz: abx / nl, pen: r };
  }
  return { nx: dx / d, nz: dz / d, pen: r - d };
}

// One fixed sub-step. Mutates ball. `t` = world time (drives dynamics).
export function step(world, ball, t, dt = STEP) {
  if (ball.inCup) return;
  // --- cannon flight: scripted arc from -> to over 1.1 s ---
  if (ball.cannonFrom) {
    ball.cannonT += dt / 1.1;
    const u = clamp(ball.cannonT, 0, 1);
    ball.x = ball.cannonFrom.x + (ball.cannonTo.x - ball.cannonFrom.x) * u;
    ball.z = ball.cannonFrom.z + (ball.cannonTo.z - ball.cannonFrom.z) * u;
    const fh = floorHeight(world, ball.x, ball.z);
    ball.y = (isFinite(fh) ? fh : ball.cannonY) + Math.sin(u * Math.PI) * 2.2;
    if (u >= 1) {
      const dx = ball.cannonTo.x - ball.cannonFrom.x, dz = ball.cannonTo.z - ball.cannonFrom.z, l = len(dx, dz) || 1;
      ball.vx = dx / l * 2.0; ball.vz = dz / l * 2.0; ball.cannonFrom = null; ball.cannonTo = null;
      ball.y = floorHeight(world, ball.x, ball.z); ball.events.push({ type: 'land' });
    }
    return;
  }
  if (ball.resting) return;
  if (ball.teleportCooldown > 0) ball.teleportCooldown -= dt;
  if (ball.jumpCooldown > 0) ball.jumpCooldown -= dt;
  // --- airborne: ballistic flight, nothing on the ground can touch it ---
  if (ball.air) {
    ball.vy -= world.gravity * dt; ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.y += ball.vy * dt;
    const fh = floorHeight(world, ball.x, ball.z);
    if (isFinite(fh)) { if (ball.y <= fh && ball.vy <= 0) { ball.y = fh; ball.vy = 0; ball.air = false; ball.vx *= 0.85; ball.vz *= 0.85; ball.events.push({ type: 'land' }); } }
    else if (ball.y < -1.2) { ball.air = false; ball.vy = 0; resetBall(world, ball, 'gap'); }
    return;
  }

  const g = world.gravity;
  // --- slope acceleration ---
  const [gx, gz] = gradient(world, ball.x, ball.z);
  ball.vx -= g * gx * dt; ball.vz -= g * gz * dt;
  // --- boost pads / patches (continuous while inside) ---
  for (const p of world.pads) {
    if (p.type !== 'boost') continue;
    if (len(ball.x - p.x, ball.z - p.z) < p.r) {
      ball.vx += p.dirx * p.strength * dt * 3; ball.vz += p.dirz * p.strength * dt * 3;
      const sp = len(ball.vx, ball.vz); if (sp > MAX_SHOT) { ball.vx *= MAX_SHOT / sp; ball.vz *= MAX_SHOT / sp; }
      if (!ball._boosting) { ball.events.push({ type: 'boost' }); ball._boosting = true; }
    }
  }
  for (const p of world.pads) {
    if (p.type === 'attractor') {
      const rx = p.x - ball.x, rz = p.z - ball.z; const d = len(rx, rz);
      if (d < p.r && d > 1e-3) { const f = p.strength * (1 - d / p.r) * (1 - d / p.r) + 0.6; ball.vx += rx / d * f * dt; ball.vz += rz / d * f * dt; if (!ball._pulled) { ball.events.push({ type: 'attract' }); ball._pulled = true; } }
      else if (d >= p.r) ball._pulled = false;
    }
    if (p.type === 'turntable') {
      const rx = ball.x - p.x, rz = ball.z - p.z; if (len(rx, rz) < p.r) { const svx = -rz * p.omega, svz = rx * p.omega; const k = Math.min(1, dt * 4); ball.vx += (svx - ball.vx) * k; ball.vz += (svz - ball.vz) * k; if (!ball._spinning) { ball.events.push({ type: 'turntable' }); ball._spinning = true; } }
    }
  }
  // --- friction ---
  const surf = surfaceAt(world, ball.x, ball.z);
  const sp = len(ball.vx, ball.vz);
  if (sp > 0) {
    const f = surf.friction * dt;
    if (sp <= f) { ball.vx = 0; ball.vz = 0; } else { ball.vx -= ball.vx / sp * f; ball.vz -= ball.vz / sp * f; }
  }
  // --- integrate ---
  ball.x += ball.vx * dt; ball.z += ball.vz * dt;
  // --- static walls ---
  for (const s of world.walls) {
    const c = circleSeg(ball.x, ball.z, BALL_R, s);
    if (!c) continue;
    ball.x += c.nx * c.pen; ball.z += c.nz * c.pen;
    const vn = ball.vx * c.nx + ball.vz * c.nz;
    if (vn < 0) { const rest = 0.75; ball.vx -= (1 + rest) * vn * c.nx; ball.vz -= (1 + rest) * vn * c.nz; if (-vn > 0.8) ball.events.push({ type: 'wall', x: ball.x, z: ball.z, v: -vn }); }
  }
  // --- dynamic pieces ---
  for (const d of world.dynamics) {
    for (const s of dynamicSegments(d, t)) {
      const c = circleSeg(ball.x, ball.z, BALL_R + 0.02, s);
      if (!c) continue;
      ball.x += c.nx * c.pen; ball.z += c.nz * c.pen;
      // blade surface velocity adds a push
      let pvx = 0, pvz = 0;
      if (d.type === 'mover') { const w = Math.cos(d.phase + t * d.speed) * d.amp * d.speed; if (d.axis === 'x') pvx = w; else pvz = w; }
      else { const rx = ball.x - d.x, rz = ball.z - d.z; pvx = -rz * d.speed; pvz = rx * d.speed; }
      const rvx = ball.vx - pvx, rvz = ball.vz - pvz;
      const vn = rvx * c.nx + rvz * c.nz;
      if (vn < 0) { ball.vx = rvx - 1.6 * vn * c.nx + pvx; ball.vz = rvz - 1.6 * vn * c.nz + pvz; ball.events.push({ type: 'wall', x: ball.x, z: ball.z, v: -vn }); }
      else { ball.vx += pvx * 0.5 * dt * 60 * 0.1; ball.vz += pvz * 0.5 * dt * 60 * 0.1; }
    }
  }
  // --- circles (bumpers, model proxies) ---
  for (const c of world.circles) {
    const dx = ball.x - c.x, dz = ball.z - c.z, d = len(dx, dz), rr = c.r + BALL_R;
    if (d >= rr || d < 1e-6) continue;
    const nx = dx / d, nz = dz / d;
    ball.x += nx * (rr - d); ball.z += nz * (rr - d);
    const vn = ball.vx * nx + ball.vz * nz;
    if (vn < 0) {
      ball.vx -= (1 + c.rest) * vn * nx; ball.vz -= (1 + c.rest) * vn * nz;
      if (c.kind === 'bumper') { const s2 = len(ball.vx, ball.vz), mn = 2.5; if (s2 < mn) { ball.vx *= mn / s2; ball.vz *= mn / s2; } }
      const s3 = len(ball.vx, ball.vz); if (s3 > MAX_SHOT) { ball.vx *= MAX_SHOT / s3; ball.vz *= MAX_SHOT / s3; }
      ball.events.push({ type: c.kind, x: ball.x, z: ball.z, v: -vn });
    }
  }
  // --- pads: teleport / cannon (trigger once, near centre) ---
  for (const p of world.pads) {
    if (p.type === 'boost') continue;
    if (len(ball.x - p.x, ball.z - p.z) > p.r) continue;
    if (p.type === 'teleport' && ball.teleportCooldown <= 0) {
      let tx = p.tx, tz = p.tz; if (p.exits && p.exits.length) { const h = Math.abs(Math.sin(ball.x * 12.9898 + ball.z * 78.233 + ball.vx * 3.7 + ball.vz * 1.3)) * p.exits.length; const e = p.exits[Math.min(p.exits.length - 1, Math.floor(h))]; tx = e.tx; tz = e.tz; }
      ball.x = tx; ball.z = tz; ball.teleportCooldown = 0.6; ball.events.push({ type: 'teleport' });
    } else if (p.type === 'jump' && ball.jumpCooldown <= 0) {
      const sp = len(ball.vx, ball.vz); const along = (ball.vx * p.dirx + ball.vz * p.dirz);
      if (along > 0.3) { // launched in the pad's direction; slow balls get a helping push to the minimum
        const s2 = Math.max(sp, p.minSpeed); ball.vx = p.dirx * s2; ball.vz = p.dirz * s2; ball.vy = p.vy * Math.sqrt(world.gravity / 9.8); ball.air = true; ball.jumpCooldown = 1.0; ball.events.push({ type: 'jump' }); return;
      }
    } else if (p.type === 'cannon') {
      ball.cannonFrom = { x: p.x, z: p.z }; ball.cannonTo = { x: p.tx, z: p.tz }; ball.cannonT = 0; ball.cannonY = floorHeight(world, p.x, p.z);
      ball.events.push({ type: 'cannon' }); return;
    }
  }
  // --- height / off-course ---
  const fh = floorHeight(world, ball.x, ball.z);
  if (!isFinite(fh)) { resetBall(world, ball, 'out'); return; }
  ball.y = fh;
  // --- water ---
  for (const w of world.waters) if (len(ball.x - w.x, ball.z - w.z) < w.r && tideLevel(w, t) > 0.5) { resetBall(world, ball, w.sink ? 'whirlpool' : 'water'); return; }
  // --- cup ---
  const cd = len(ball.x - world.cupX, ball.z - world.cupZ);
  const spd = len(ball.vx, ball.vz);
  if (cd < CUP_CAPTURE_D && spd < CUP_CAPTURE_SPEED) { ball.inCup = true; ball.x = world.cupX; ball.z = world.cupZ; ball.vx = ball.vz = 0; ball.resting = true; ball.events.push({ type: 'cup' }); return; }
  if (cd < CUP_R && spd >= CUP_CAPTURE_SPEED) { // lip-out: deflect + bleed speed
    const nx = (ball.x - world.cupX) / (cd || 1e-6), nz = (ball.z - world.cupZ) / (cd || 1e-6);
    ball.vx = (ball.vx * 0.55 + nx * 0.6); ball.vz = (ball.vz * 0.55 + nz * 0.6);
    if (!ball._lip) { ball.events.push({ type: 'lipout' }); ball._lip = true; }
  } else if (cd > CUP_R * 2) ball._lip = false;
  // --- rolling: rest detection ---
  const [gx2, gz2] = gradient(world, ball.x, ball.z);
  let onSlope = len(gx2, gz2) > 0.05;
  for (const p of world.pads) if ((p.type === 'turntable' || p.type === 'attractor') && len(ball.x - p.x, ball.z - p.z) < p.r) onSlope = true;
  if (onSlope && spd < REST_SPEED && world.pads.some(p => p.type === 'attractor' && !p.sink && len(ball.x - p.x, ball.z - p.z) < p.core + BALL_R + 0.05)) { ball.vx = ball.vz = 0; ball.resting = true; ball.events.push({ type: 'rest' }); }
  if (!world.pads.some(p => p.type === 'turntable' && len(ball.x - p.x, ball.z - p.z) < p.r)) ball._spinning = false;
  if (spd < REST_SPEED && !onSlope) { ball.vx = ball.vz = 0; ball.resting = true; ball._boosting = false; ball.events.push({ type: 'rest' }); }
  else if (spd < REST_SPEED * 0.4 && onSlope) { /* let gravity take it */ }
}

export function resetBall(world, ball, reason) {
  ball.x = ball.lastX; ball.z = ball.lastZ; ball.y = floorHeight(world, ball.x, ball.z);
  ball.vx = ball.vz = 0; ball.vy = 0; ball.air = false; ball.resting = true; ball.penalty = (ball.penalty || 0) + 1;
  ball.events.push({ type: 'reset', reason });
}

// Simulate until rest (or cup) — used by the ghost golfer and tests. Returns elapsed seconds.
export function simulateUntilRest(world, ball, t0 = 0, maxT = 20) {
  let t = t0;
  while (!ball.resting && t - t0 < maxT) { step(world, ball, t); t += STEP; }
  return t - t0;
}

// ---------- Ghost golfer: greedy shot search proving a hole is completable ----------
// With hole.waypoints, "distance" = remaining length along the tee→waypoints→cup polyline (progress, not proximity).
function pathRemaining(P, x, z, minJ = 0) {
  let best = null;
  for (let j = minJ; j < P.length - 1; j++) {
    const ax = P[j].x, az = P[j].z, bx = P[j + 1].x, bz = P[j + 1].z; const abx = bx - ax, abz = bz - az; const l2 = abx * abx + abz * abz || 1e-9;
    let u = ((x - ax) * abx + (z - az) * abz) / l2; u = clamp(u, 0, 1); const px = ax + abx * u, pz = az + abz * u; const off = len(x - px, z - pz);
    let rest = (1 - u) * Math.sqrt(l2); for (let m = j + 1; m < P.length - 1; m++) rest += len(P[m + 1].x - P[m].x, P[m + 1].z - P[m].z);
    if (j > minJ && off > TILE * 0.75) continue;   // only credit a later corridor if the ball is really on it
    const score = rest + off * 1.5; if (!best || score < best.score) best = { score, j, u, off };
  }
  return best;
}
export function ghostGolf(hole, maxStrokes = 12, rng = Math.random) {
  const world = compileWorld(hole);
  const ball = newBall(world);
  let strokes = 0, t = 0; const trace = [];
  const P = hole.waypoints && hole.waypoints.length ? [{ x: world.teeX, z: world.teeZ }, ...hole.waypoints.map(w => ({ x: (w[0] + 0.5) * TILE, z: (w[1] + 0.5) * TILE })), { x: world.cupX, z: world.cupZ }] : null;
  let minJ = 0;
  const scoreOf = (b) => b.inCup ? -1 : (P ? pathRemaining(P, b.x, b.z, minJ).score : len(world.cupX - b.x, world.cupZ - b.z)) + (b.penalty || 0) * 50;
  while (!ball.inCup && strokes < maxStrokes) {
    let best = null;
    let tgt = { x: world.cupX, z: world.cupZ };
    if (P) { const pr = pathRemaining(P, ball.x, ball.z, minJ); minJ = pr.j; tgt = pr.u > 0.85 && pr.j + 2 < P.length ? P[pr.j + 2] : P[pr.j + 1]; }
    const base = Math.atan2(tgt.z - ball.z, tgt.x - ball.x);
    const angles = [0, 0.18, -0.18, 0.4, -0.4, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6, Math.PI];
    const powers = [0.12, 0.25, 0.4, 0.55, 0.75, 1.0];
    const waits = world.dynamics.length ? [0, 0.7, 1.4] : [0];   // moving pieces: a player would wait for the gap
    for (const w of waits) for (const a of angles) for (const p of powers) {
      const trial = { ...ball, events: [] };
      shoot(trial, Math.cos(base + a), Math.sin(base + a), p);
      simulateUntilRest(world, trial, t + w, 14);
      const d = scoreOf(trial);
      if (!best || d < best.d) best = { d, a, p, w, trial };
      if (trial.inCup) break;
    }
    Object.assign(ball, best.trial, { events: [] });
    strokes++; t += 15 + (best.w || 0); trace.push({ x: +(ball.x / TILE).toFixed(1), z: +(ball.z / TILE).toFixed(1), pen: ball.penalty || 0, a: +best.a.toFixed(2), p: best.p, d: +best.d.toFixed(1) });
  }
  return { strokes, holed: ball.inCup, trace };
}
