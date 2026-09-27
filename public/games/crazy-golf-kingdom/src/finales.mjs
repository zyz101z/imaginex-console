// CRAZY GOLF KINGDOM — finale holes: hole 9 of every kingdom is hand-laid in code (ASCII grid + obstacle list),
// each built around a signature mechanic. No editor, no hand-placed meshes: the grid is the whole "level".
//
// Grid legend: '.' felt, 'T' tee, 'C' cup, ' ' void, 's' sand, 'i' ice, 'y' syrup, '#' gap (jump pit)

const FINALES = {
  meadow: {
    name: 'The Gauntlet', blurb: 'Three windmills. One ball. Time it.', par: 5, waypoints: [[10, 0], [10, 3], [0, 3], [0, 6]],
    grid: [
      'T..........',
      '          .',
      '          .',
      '...........',
      '.          ',
      '.          ',
      '.....C     ',
    ],
    // full-width blades: no slipping past along the wall — you wait for the gap
    obstacles: [
      { at: [3, 0], type: 'windmill', speed: 1.0, phase: 0, len: 2.2 * 0.92 }, { at: [6, 0], type: 'windmill', speed: 1.3, phase: 2.1, len: 2.2 * 0.92 }, { at: [9, 0], type: 'windmill', speed: 1.6, phase: 4.2, len: 2.2 * 0.92 },
      { at: [5, 3], type: 'bumper', dx: 0, dz: 0, r: 0.3 }, { at: [2, 3], type: 'bumper', dx: 0, dz: 0, r: 0.3 },
      { at: [0, 5], type: 'model', model: 'gnome', r: 0.45, rot: 1.2 },
      { at: [3, 6], type: 'sand' },
    ],
    decor: [{ at: [4, -2], model: 'mushroom' }, { at: [12, 2], model: 'windmill' }, { at: [-2, 5], model: 'mushroom' }],
  },
  candy: {
    name: 'Rolling Lollipop', blurb: 'Two sweets patrol a 3-wide lane. Time it or get squashed.', par: 3, waypoints: [[2, 0], [2, 8]],
    grid: [
      ' T.  ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' .C. ',
    ],
    // movers span the whole 3-wide lane (hd 1.45 tiles ≈ 3.2 m); amplitude sweeps them wall to wall
    obstacles: [
      { at: [2, 3], type: 'mover', axis: 'x', amp: 0.75, speed: 1.1, phase: 0, model: 'lollipop', hw: 0.18, hd: 0.72 },
      { at: [2, 6], type: 'mover', axis: 'x', amp: 0.75, speed: 1.5, phase: 2.6, model: 'cupcake', hw: 0.18, hd: 0.72 },
      { at: [1, 1], type: 'syrup' }, { at: [3, 1], type: 'syrup' },
      { at: [2, 4], type: 'boost', dirx: 0, dirz: 1, strength: 5 },
    ],
    decor: [{ at: [-2, 3], model: 'gingerbread' }, { at: [6, 5], model: 'lollipop' }, { at: [-2, 7], model: 'cupcake' }],
  },
  dino: {
    name: 'Tail Sweep', blurb: 'The T-rex blocks the only lane. Its tail sweeps it clean.', par: 3, waypoints: [[3, 0], [3, 8]],
    grid: [
      ' T.  ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' ... ',
      ' .C. ',
    ],
    // tail length = lane width, so there is no shoulder to hide on; the hub itself is a solid collider
    obstacles: [
      { at: [2, 4], type: 'spinner', speed: 1.3, phase: 0, len: 2.2 * 2.85, model: 'trex', hubR: 0.42 },
      { at: [1, 2], type: 'water', r: 0.3 }, { at: [3, 6], type: 'water', r: 0.3 },
      { at: [2, 1], type: 'sand' },
    ],
    decor: [{ at: [-2, 3], model: 'palm' }, { at: [6, 2], model: 'volcano' }, { at: [6, 7], model: 'palm' }],
  },
  castle: {
    name: 'Spooky Portals', blurb: 'The portal is the only way out. The ghost picks your exit.', par: 4, waypoints: [[5, 0], [5, 1], [0, 7], [4, 8]],
    grid: [
      'T.....',
      '     .',
      '...   ',
      '.....',
      '.   ..',
      '.    .',
      '.   ..',
      '.....',
      '   ..',
      '   .C',
    ],
    // (5,1) is a dead end: the portal there is the ONLY exit from the first corridor
    obstacles: [
      { at: [5, 1], type: 'teleport', exits: [[0, 2], [4, 3], [0, 7]], id: 1, r: 0.7 },
      { at: [0, 2], type: 'portal_exit', id: 1 }, { at: [4, 3], type: 'portal_exit', id: 1 }, { at: [0, 7], type: 'portal_exit', id: 1 },
      { at: [2, 3], type: 'mover', axis: 'z', amp: 0.4, speed: 1.2, phase: 0 },
      { at: [2, 7], type: 'mover', axis: 'z', amp: 0.4, speed: 1.6, phase: 1.5 },
      { at: [3, 8], type: 'model', model: 'ghost', r: 0.4, rot: 0.6 },
      { at: [5, 5], type: 'ice' },
    ],
    decor: [{ at: [-2, 5], model: 'tower' }, { at: [7, 8], model: 'pumpkin' }, { at: [7, 1], model: 'tower' }],
  },
  space: {
    name: 'Tractor Beam', blurb: 'The well spans the whole lane. Cross it fast, or use it.', par: 3, waypoints: [[4, 1], [8, 1]],
    grid: [
      '.........',
      'T.......C',
      '.........',
    ],
    // the well radius (1.6 tiles) covers all three rows: every route to the cup passes through it
    obstacles: [
      { at: [4, 1], type: 'attractor', r: 2.2 * 1.6, strength: 4.0, core: 0.42, model: 'ufo' },
      { at: [2, 0], type: 'turntable', omega: 1.5 }, { at: [6, 2], type: 'turntable', omega: -1.5 },
      { at: [1, 2], type: 'ice' }, { at: [7, 0], type: 'ice' },
    ],
    decor: [{ at: [4, -2], model: 'rocket' }, { at: [4, 4], model: 'alien' }, { at: [10, 1], model: 'alien' }],
  },
};

export function finaleFor(kingdom) { return FINALES[kingdom] || null; }

// Convert a finale spec into the same hole object the procedural generator produces.
export function buildFinale(kingdom, K) {
  const F = FINALES[kingdom]; if (!F) return null;
  const tiles = []; const gaps = []; let tee = null, cup = null; const surfaces = {};
  F.grid.forEach((row, z) => { [...row].forEach((ch, x) => {
    if (ch === ' ') return;
    if (ch === '#') { gaps.push({ x, z }); return; }
    const t = { x, z, height: 0, surface: ch === 's' ? 'sand' : ch === 'i' ? 'ice' : ch === 'y' ? 'syrup' : 'felt' };
    if (ch === 'T') tee = { x, z }; if (ch === 'C') cup = { x, z };
    tiles.push(t);
  }); });
  const obstacles = [];
  for (const o of F.obstacles) {
    const [x, z] = o.at; const rest = { ...o }; delete rest.at;
    if (o.type === 'sand' || o.type === 'ice' || o.type === 'syrup') { const t = tiles.find(t => t.x === x && t.z === z); if (t) t.surface = o.type; obstacles.push({ x, z, type: 'patch', surface: o.type }); continue; }
    if (o.type === 'teleport') { rest.exits = o.exits.map(([ex, ez]) => ({ tx: ex, tz: ez })); rest.tx = o.exits[0][0]; rest.tz = o.exits[0][1]; if (o.r) rest.r = o.r; }
    obstacles.push({ x, z, ...rest });
  }
  const decor = F.decor.map(d => ({ x: d.at[0], z: d.at[1], model: d.model, rot: (d.at[0] * 7 + d.at[1] * 3) % 6, scale: 1.0 }));
  const xs = tiles.map(t => t.x), zs = tiles.map(t => t.z);
  // path = tiles in reading order (only used for bounds/decor by the renderer)
  return { kingdom, index: 8, seed: 0, attempt: 0, finale: true, name: F.name, blurb: F.blurb, waypoints: F.waypoints || [], tiles, tee, cup, obstacles, gaps, decor, par: F.par, gravity: K.gravity,
           path: tiles.map(t => ({ x: t.x, z: t.z })), bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
}
export const FINALE_KINGDOMS = Object.keys(FINALES);
