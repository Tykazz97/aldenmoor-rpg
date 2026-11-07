// Générateur pseudo-aléatoire à graine (mulberry32) : une même graine donne toujours la même suite.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));      // entier dans [lo, hi]
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.weighted = (entries) => {                                         // [[valeur, poids], ...]
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = next() * total;
    for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
    return entries[entries.length - 1][0];
  };
  return next;
}
export const hashString = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
