// CRAZY GOLF KINGDOM — finale holes: hole 9 of every kingdom is hand-laid in code (ASCII grid + obstacle list),
// each built around a signature mechanic. No editor, no hand-placed meshes: the grid is the whole "level".
//
// Grid legend: '.' felt, 'T' tee, 'C' cup, ' ' void, 's' sand, 'i' ice, 'y' syrup, '#' gap (jump pit)

const FINALES = {
  meadow: {
    name: 'The Gauntlet', blurb: 'Three windmills. One ball. Good luck.', par: 5, waypoints: [[10, 0], [10, 3], [0, 3], [0, 6]],
    grid: [
      'T..........',
      '          .',
      '          .',
      '...........',
      '.          ',
      '.          ',
      '.....C     ',
    ],
    obstacles: [
      { at: [3, 0], type: 'windmill', speed: 1.0, phase: 0, len: 2.2 * 0.7 }, { at: [6, 0], type: 'windmill', speed: 1.3, phase: 2.1, len: 2.2 * 0.7 }, { at: [9, 0], type: 'windmill', speed: 1.6, phase: 4.2, len: 2.2 * 0.7 },
      { at: [5, 3], type: 'bumper', dx: 0, dz: 0, r: 0.3 }, { at: [2, 3], type: 'bumper', dx: 0, dz: 0, r: 0.3 },
      { at: [0, 5], type: 'model', model: 'gnome', r: 0.45, rot: 1.2 },
      { at: [3, 6], type: 'sand' },
    ],
    decor: [{ at: [4, -2], model: 'mushroom' }, { at: [12, 2], model: 'windmill' }, { at: [-2, 5], model: 'mushroom' }],
  },
  candy: {
    name: 'Rolling Lollipop', blurb: 'A giant lollipop patrols the green. Time it.', par: 4, waypoints: [[4, 0], [4, 2], [2, 7]],
    grid: [
      'T....',
      '    .',
      '.....',
      '.....',
      '.....',
      '.....',
      '.   .',
      '.....',
      '  C  ',
    ],
    obstacles: [
      { at: [2, 3], type: 'mover', axis: 'x', amp: 0.9, speed: 0.9, phase: 0, model: 'lollipop', hw: 0.2, hd: 0.55 },
      { at: [2, 5], type: 'mover', axis: 'x', amp: 0.9, speed: 1.3, phase: 2.5, model: 'cupcake', hw: 0.2, hd: 0.55 },
      { at: [4, 1], type: 'boost', dirx: 0, dirz: 1, strength: 6 },
      { at: [0, 6], type: 'syrup' }, { at: [4, 6], type: 'syrup' },
      { at: [2, 7], type: 'bumper', dx: 0.3, dz: 0, r: 0.26 }, { at: [2, 7], type: 'bumper', dx: -0.3, dz: 0, r: 0.26 },
    ],
    decor: [{ at: [-2, 3], model: 'gingerbread' }, { at: [7, 4], model: 'lollipop' }],
  },
  dino: {
    name: 'Tail Sweep', blurb: 'The T-rex is friendly. Its tail is not.', par: 4, waypoints: [[6, 0], [6, 2], [6, 6], [6, 8]],
    grid: [
      'T......',
      '      .',
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      '      .',
      '......C',
    ],
    obstacles: [
      { at: [3, 4], type: 'spinner', speed: 1.4, phase: 0, len: 2.2 * 2.6, model: 'trex', hubR: 0.5 },
      { at: [1, 2], type: 'water', r: 0.3 }, { at: [5, 6], type: 'water', r: 0.3 },
      { at: [0, 8], type: 'sand' }, { at: [3, 8], type: 'sand' },
      { at: [6, 0], type: 'bumper', dx: 0, dz: 0, r: 0.3 },
    ],
    decor: [{ at: [-2, 4], model: 'palm' }, { at: [9, 2], model: 'volcano' }, { at: [9, 7], model: 'palm' }],
  },
  castle: {
    name: 'Spooky Portals', blurb: 'The ghost picks where you come out.', par: 4, waypoints: [[5, 0], [5, 1], [0, 7], [4, 8]],
    grid: [
      'T.....',
      '     .',
      '...  .',
      '.....',
      '.   ..',
      '.    .',
      '.   ..',
      '.....',
      '   ..',
      '   .C',
    ],
    obstacles: [
      { at: [5, 1], type: 'teleport', exits: [[0, 3], [4, 3], [0, 7]], id: 1 },
      { at: [0, 3], type: 'portal_exit', id: 1 }, { at: [4, 3], type: 'portal_exit', id: 1 }, { at: [0, 7], type: 'portal_exit', id: 1 },
      { at: [2, 3], type: 'mover', axis: 'z', amp: 0.4, speed: 1.2, phase: 0 },
      { at: [2, 7], type: 'mover', axis: 'z', amp: 0.4, speed: 1.6, phase: 1.5 },
      { at: [3, 8], type: 'model', model: 'ghost', r: 0.4, rot: 0.6 },
      { at: [5, 5], type: 'ice' },
    ],
    decor: [{ at: [-2, 5], model: 'tower' }, { at: [7, 8], model: 'pumpkin' }, { at: [7, 1], model: 'tower' }],
  },
  space: {
    name: 'Tractor Beam', blurb: 'The UFO bends everything toward it. Use that.', par: 4, waypoints: [[8, 0], [8, 2], [8, 6], [0, 6], [0, 8]],
    grid: [
      'T........',
      '        .',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.        ',
      '........C',
    ],
    obstacles: [
      { at: [4, 4], type: 'attractor', r: 2.2 * 2.0, strength: 3.2, core: 0.45, model: 'ufo' },
      { at: [1, 2], type: 'turntable', omega: 1.6 }, { at: [6, 3], type: 'turntable', omega: -1.6 },
      { at: [8, 1], type: 'ice' }, { at: [0, 7], type: 'ice' },
      { at: [4, 8], type: 'bumper', dx: 0, dz: 0, r: 0.3 },
    ],
    decor: [{ at: [-2, 4], model: 'rocket' }, { at: [11, 3], model: 'alien' }],
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
    if (o.type === 'teleport') { rest.exits = o.exits.map(([ex, ez]) => ({ tx: ex, tz: ez })); rest.tx = o.exits[0][0]; rest.tz = o.exits[0][1]; }
    obstacles.push({ x, z, ...rest });
  }
  const decor = F.decor.map(d => ({ x: d.at[0], z: d.at[1], model: d.model, rot: (d.at[0] * 7 + d.at[1] * 3) % 6, scale: 1.0 }));
  const xs = tiles.map(t => t.x), zs = tiles.map(t => t.z);
  // path = tiles in reading order (only used for bounds/decor by the renderer)
  return { kingdom, index: 8, seed: 0, attempt: 0, finale: true, name: F.name, blurb: F.blurb, waypoints: F.waypoints || [], tiles, tee, cup, obstacles, gaps, decor, par: F.par, gravity: K.gravity,
           path: tiles.map(t => ({ x: t.x, z: t.z })), bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
}
export const FINALE_KINGDOMS = Object.keys(FINALES);
