// CRAZY GOLF KINGDOM — physics battery. Run: node test/physics.test.mjs
import { compileWorld, newBall, shoot, step, simulateUntilRest, floorHeight, TILE, BALL_R, STEP, MAX_SHOT, MIN_SHOT, CUP_CAPTURE_SPEED } from '../src/physics.mjs';

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', n, d); } };
const straight = (n, extra = {}) => ({ tiles: Array.from({ length: n }, (_, i) => ({ x: i, z: 0, height: 0, surface: 'felt' })), tee: { x: 0, z: 0 }, cup: { x: n - 1, z: 0 }, obstacles: [], ...extra });

// 1. rolls and stops on felt
{ const w = compileWorld(straight(12)); const b = newBall(w); shoot(b, 1, 0, 0.3); const t = simulateUntilRest(w, b);
  check('ball moves +x', b.x > w.teeX + 1, b.x); check('ball rests', b.resting); check('stops within 20s', t < 20, t);
  check('stays in lane', Math.abs(b.z - w.teeZ) < 1e-6); }
// 2. wall bounce: shooting into the side wall reflects z velocity
{ const w = compileWorld(straight(6)); const b = newBall(w); shoot(b, 0, 1, 0.5); for (let i = 0; i < 30; i++) step(w, b, i * STEP);
  check('bounced off side wall', b.vz < 0, b.vz); check('inside lane after bounce', b.z > 0 && b.z < TILE); }
// 3. full power never tunnels through the end wall
{ const w = compileWorld(straight(3)); const b = newBall(w); shoot(b, 1, 0, 1); simulateUntilRest(w, b);
  check('no tunnelling at max power', b.x < 3 * TILE && b.x > 0, b.x); }
// 4. cup capture at low speed, lip-out at high speed
{ const w = compileWorld(straight(4)); const b = newBall(w); shoot(b, 1, 0, 0.42); simulateUntilRest(w, b);
  check('gentle putt drops', b.inCup, `x=${b.x.toFixed(2)} v=${Math.hypot(b.vx, b.vz).toFixed(2)}`); }
{ const w = compileWorld(straight(4)); const b = newBall(w); shoot(b, 1, 0, 1); let lip = false; for (let t = 0; t < 6; t += STEP) { step(w, b, t); if (b.events.some(e => e.type === 'lipout')) lip = true; }
  check('firing at max power lips out or bounces past', lip || !b.inCup); }
// 5. sand stops faster than felt
{ const w1 = compileWorld(straight(14)); const b1 = newBall(w1); shoot(b1, 1, 0, 0.25); simulateUntilRest(w1, b1);
  const h = straight(14); for (const t of h.tiles) t.surface = 'sand'; const w2 = compileWorld(h); const b2 = newBall(w2); shoot(b2, 1, 0, 0.25); simulateUntilRest(w2, b2);
  check('sand shorter than felt', b2.x < b1.x - 1, `${b1.x.toFixed(1)} vs ${b2.x.toFixed(1)}`);
  const hi = straight(14); for (const t of hi.tiles) t.surface = 'ice'; const w3 = compileWorld(hi); const b3 = newBall(w3); shoot(b3, 1, 0, 0.25); simulateUntilRest(w3, b3);
  check('ice longer than felt', b3.x > b1.x, `${b1.x.toFixed(1)} vs ${b3.x.toFixed(1)}`); }
// 6. ramp: weak shot rolls back, strong shot climbs
{ const h = straight(10); h.tiles[4].ramp = { dir: 'x', from: 0, to: 0.45 }; for (let i = 5; i < 10; i++) h.tiles[i].height = 0.45;
  const w = compileWorld(h); check('height interpolates on ramp', Math.abs(floorHeight(w, 4.5 * TILE, TILE / 2) - 0.225) < 0.01);
  const b = newBall(w); shoot(b, 1, 0, 0.12); simulateUntilRest(w, b); check('weak shot fails the ramp', b.x < 5 * TILE, b.x);
  const b2 = newBall(w); shoot(b2, 1, 0, 0.6); simulateUntilRest(w2 = w, b2); check('strong shot climbs the ramp', b2.x > 5 * TILE, b2.x); var w2; }
// 7. bumper adds energy and deflects
{ const h = straight(8); h.obstacles = [{ x: 3, z: 0, type: 'bumper', dx: 0, dz: 0.05, r: 0.3 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.35);
  let hit = false; for (let t = 0; t < 4; t += STEP) { step(w, b, t); if (b.events.some(e => e.type === 'bumper')) { hit = true; break; } }
  check('bumper hit registered', hit); check('bumper deflects in z', Math.abs(b.vz) > 0.1, b.vz); check('bumper speed floor', Math.hypot(b.vx, b.vz) >= 2.4); }
// 8. water resets to last spot with a penalty
{ const h = straight(8); h.obstacles = [{ x: 3, z: 0, type: 'water', r: 0.45 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.3); simulateUntilRest(w, b);
  check('water reset to tee', Math.abs(b.x - w.teeX) < 1e-6 && b.penalty === 1, `x=${b.x} pen=${b.penalty}`); }
// 9. block leaves a gap on each side of a corridor
{ const h = straight(8); h.obstacles = [{ x: 3, z: 0, type: 'block', w: 0.5, d: 0.28 }]; const w = compileWorld(h);
  const b = newBall(w); b.z = TILE * 0.13 + BALL_R; shoot(b, 1, 0, 0.5); simulateUntilRest(w, b); check('ball slips past block', b.x > 4 * TILE, b.x);
  const c = newBall(w); shoot(c, 1, 0, 0.5); simulateUntilRest(w, c); check('centered ball is blocked', c.x < 3.6 * TILE, c.x); }
// 10. windmill blades block sometimes, pass sometimes
{ const h = straight(8); h.obstacles = [{ x: 3, z: 0, type: 'windmill', speed: 1.2, phase: 0 }]; const w = compileWorld(h);
  let through = 0, blocked = 0; for (let k = 0; k < 12; k++) { const b = newBall(w); shoot(b, 1, 0, 0.5); simulateUntilRest(w, b, k * 0.45); if (b.x > 4 * TILE) through++; else blocked++; }
  check('windmill: some shots pass', through > 0, through); check('windmill: some shots blocked', blocked > 0, blocked); }
// 11. moving wall is deterministic in time
{ const h = straight(8); h.obstacles = [{ x: 3, z: 0, type: 'mover', axis: 'z', amp: 0.55, speed: 1.2, phase: 0 }]; const w = compileWorld(h);
  const r = []; for (let k = 0; k < 2; k++) { const b = newBall(w); shoot(b, 1, 0, 0.5); simulateUntilRest(w, b, 0); r.push(b.x); }
  check('determinism (same t0 → same result)', Math.abs(r[0] - r[1]) < 1e-9); }
// 12. boost pad speeds the ball up
{ const h = straight(14); const w0 = compileWorld(h); const b0 = newBall(w0); shoot(b0, 1, 0, 0.25); simulateUntilRest(w0, b0);
  h.obstacles = [{ x: 2, z: 0, type: 'boost', dirx: 1, dirz: 0, strength: 7 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.25); simulateUntilRest(w, b);
  check('boost carries further', b.x > b0.x + 1.5, `${b0.x.toFixed(1)} → ${b.x.toFixed(1)}`); }
// 13. teleporter moves the ball
{ const h = straight(10); h.obstacles = [{ x: 2, z: 0, type: 'teleport', tx: 7, tz: 0, id: 0 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.3); simulateUntilRest(w, b);
  check('teleported past the exit', b.x > 7 * TILE, b.x); }
// 14. cannon flies the ball to the target tile
{ const h = straight(10); h.obstacles = [{ x: 2, z: 0, type: 'cannon', tx: 7, tz: 0 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.3);
  let maxY = 0; let t = 0; while (!b.resting && t < 20) { step(w, b, t); t += STEP; maxY = Math.max(maxY, b.y); }
  check('cannon arc goes airborne', maxY > 1.5, maxY); check('cannon lands near target', Math.abs(b.x - 7.5 * TILE) < TILE * 1.5, b.x); }
// 15. off-course (no tile) resets
{ const h = straight(4); h.tiles.splice(2, 1); const w = compileWorld(h); const b = newBall(w); b.x = 2.5 * TILE; b.resting = false; b.vx = 1; step(w, b, 0);
  check('void tile resets ball', b.events.some(e => e.type === 'reset'), JSON.stringify(b.events)); }
// 16. low gravity rolls the same on flat (gravity only matters on slopes)
{ const h = straight(10); h.tiles[3].ramp = { dir: 'x', from: 0, to: 0.45 }; for (let i = 4; i < 10; i++) h.tiles[i].height = 0.45;
  const wN = compileWorld(h); const bN = newBall(wN); shoot(bN, 1, 0, 0.3); simulateUntilRest(wN, bN);
  const wL = compileWorld({ ...h, gravity: 4.9 }); const bL = newBall(wL); shoot(bL, 1, 0, 0.3); simulateUntilRest(wL, bL);
  check('low gravity climbs easier', bL.x >= bN.x - 1e-6, `${bN.x.toFixed(2)} vs ${bL.x.toFixed(2)}`); }
// 17. shot power maps to speed range
{ const w = compileWorld(straight(30)); const b = newBall(w); shoot(b, 1, 0, 0); check('min power', Math.abs(Math.hypot(b.vx, b.vz) - MIN_SHOT) < 1e-9); shoot(b, 1, 0, 1); check('max power', Math.abs(Math.hypot(b.vx, b.vz) - MAX_SHOT) < 1e-9); shoot(b, 1, 0, 5); check('power clamped', Math.hypot(b.vx, b.vz) <= MAX_SHOT + 1e-9); }
// 18. resting ball never drifts
{ const w = compileWorld(straight(5)); const b = newBall(w); for (let t = 0; t < 2; t += STEP) step(w, b, t); check('resting ball stays put', b.x === w.teeX && b.z === w.teeZ); }
// 19. cup capture speed threshold honoured
{ const w = compileWorld(straight(3)); const b = newBall(w); b.x = w.cupX - 0.1; b.z = w.cupZ; b.resting = false; b.vx = CUP_CAPTURE_SPEED - 0.1; step(w, b, 0); check('under threshold → in', b.inCup);
  const c = newBall(w); c.x = w.cupX - 0.1; c.z = w.cupZ; c.resting = false; c.vx = CUP_CAPTURE_SPEED + 3; step(w, c, 0); check('over threshold → not in', !c.inCup); }

// 20. turntable spins the ball sideways and never lets it rest on the disc
{ const h = straight(10); h.obstacles = [{ x: 4, z: 0, type: 'turntable', omega: 1.6 }]; const w = compileWorld(h); const b = newBall(w); shoot(b, 1, 0, 0.3); simulateUntilRest(w, b);
  check('turntable deflects the ball', Math.abs(b.z - w.teeZ) > 0.2 || b.x < 4 * TILE || b.x > 5 * TILE, `x=${b.x.toFixed(2)} z=${b.z.toFixed(2)}`);
  check('ball does not rest on the turntable', !(b.x > 4 * TILE && b.x < 5 * TILE) || !b.resting, b.x); }
// 21. jump pad: fast ball flies the gap and lands; slow ball falls in the gap and resets
{ const h = straight(10); h.tiles.splice(4, 1); h.gaps = [{ x: 4, z: 0 }]; h.obstacles = [{ x: 3, z: 0, type: 'jump', dirx: 1, dirz: 0, tx: 5, tz: 0, vy: 4.2, minSpeed: 4.6 }];
  const w = compileWorld(h); check('gap edges have no wall', !w.walls.some(s => Math.abs(s.ax - 4 * TILE) < 1e-6 && Math.abs(s.bx - 4 * TILE) < 1e-6 && s.az !== s.bz), w.walls.length);
  const b = newBall(w); shoot(b, 1, 0, 0.6); let maxY = 0, jumped = false, t = 0; while (!b.resting && t < 20) { step(w, b, t); t += STEP; maxY = Math.max(maxY, b.y); if (b.events.some(e => e.type === 'jump')) jumped = true; }
  check('jump pad launches', jumped && maxY > 0.5, `jumped=${jumped} maxY=${maxY.toFixed(2)}`); check('fast ball clears the gap', b.x > 5 * TILE && !b.penalty, `x=${b.x.toFixed(2)} pen=${b.penalty}`);
  const c = newBall(w); c.x = 3.9 * TILE; c.resting = false; c.vx = 1.5; c.jumpCooldown = 5; // creep off the edge without triggering the pad
  simulateUntilRest(w, c); check('slow ball falls into the gap and resets', c.penalty === 1 && c.events.some(e => e.type === 'reset' && (e.reason === 'gap' || e.reason === 'out')), JSON.stringify(c.events.map(e => e.type)));
  const d = newBall(w); shoot(d, 1, 0, 0.12); simulateUntilRest(w, d); check('a weak shot onto the pad still gets the minimum launch', d.events.some(e => e.type === 'jump') || d.x < 3 * TILE, d.x.toFixed(2)); }

console.log(`physics: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
