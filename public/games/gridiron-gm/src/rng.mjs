// Seeded RNG (mulberry32) — sim must be deterministic given a seed for testability.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    f: next,                                   // [0,1)
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss: () => {                             // approx normal(0,1)
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return (s - 3) / 0.7071;
    },
    chance: (p) => next() < p,
  };
}
