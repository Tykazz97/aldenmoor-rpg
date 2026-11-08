// ============================================================
// La fiche de la sentinelle d'une guilde (points de caractéristiques et sorts équipés) : `g.sentBuild = { pts: { vitalite, force, … }, spells: [id] }`.
// Une seule fiche par guilde, pour toutes ses sentinelles. Sans `spells`, la sentinelle équipe d'elle-même ses 3 meilleurs sorts.
// Pur (sans React ni moteur de combat).
// ============================================================
import { SENT_STAT_KEYS, SENT_POINTS_PER_LEVEL, SENT_SPELLS, SENT_SPELL_BY_ID, SENT_MAX_SPELLS, SENT_RESET_COST_PER_LEVEL, SENT_LOOT_SHARE, SENT_STAT_CAP, SENT_REF_POINTS } from "../data/sentinel.js";
import { makeRng, hashString } from "../sim/rng.js";

export const totalPoints = (guildLevel) => SENT_POINTS_PER_LEVEL * Math.max(1, Math.floor(guildLevel) || 1);
export const emptyPts = () => Object.fromEntries(SENT_STAT_KEYS.map((k) => [k, 0]));
export const ptsOf = (g) => { const out = emptyPts(); for (const k of SENT_STAT_KEYS) { const v = Math.floor(g?.sentBuild?.pts?.[k]); if (v > 0) out[k] = v; } return out; };
export const spentPoints = (g) => SENT_STAT_KEYS.reduce((n, k) => n + ptsOf(g)[k], 0);
export const freePoints = (g) => Math.max(0, totalPoints(g.level) - spentPoints(g));
// Part de chaque caractéristique (0 à 0,6) : points placés / total possible, mais au moins SENT_REF_POINTS (le total d'une guilde de niveau 20) :
// une jeune guilde n'a donc pas une sentinelle aussi forte qu'une grande, et un point de plus ne change pas tout (+33 PV au niveau 1, pas +800).
export const sharesOf = (g) => { const t = Math.max(totalPoints(g.level), SENT_REF_POINTS), p = ptsOf(g); return Object.fromEntries(SENT_STAT_KEYS.map((k) => [k, Math.min(SENT_STAT_CAP, p[k] / t)])); };

// Multiplicateur de butin selon la chance : 0,6 sans point, 1,44 au maximum (60 % du total en chance, atteint à partir d'une guilde de niveau 20) : de 0,3 à 0,72 tirage de joueur
export const lootMult = (g) => 0.6 + 1.4 * sharesOf(g).chance;
export const lootShareOf = (g) => SENT_LOOT_SHARE * lootMult(g);

// ---- sorts ----
export const unlockedSpells = (g) => SENT_SPELLS.filter((s) => s.level <= g.level);
export function equippedIds(g) {
  const un = new Set(unlockedSpells(g).map((s) => s.id));
  const chosen = Array.isArray(g?.sentBuild?.spells) ? [...new Set(g.sentBuild.spells)].filter((id) => un.has(id)).slice(0, SENT_MAX_SPELLS) : null;
  if (chosen && chosen.length) return chosen;
  return unlockedSpells(g).slice(-SENT_MAX_SPELLS).map((s) => s.id);       // par défaut : les 3 plus récents (donc les plus forts)
}
export const equippedSpells = (g) => equippedIds(g).map((id) => SENT_SPELL_BY_ID[id]);

// ---- écriture (modifient g) ----
// null = possible ; sinon la raison. `pts` : { vitalite, force, … } (entiers ≥ 0)
export function pointsProblem(g, pts) {
  let sum = 0;
  for (const k of SENT_STAT_KEYS) { const v = pts?.[k]; if (!Number.isInteger(v) || v < 0) return "points"; sum += v; }
  const cap = Math.ceil(totalPoints(g.level) * SENT_STAT_CAP);
  if (SENT_STAT_KEYS.some((k) => pts[k] > cap)) return "points_max";
  return sum > totalPoints(g.level) ? "points" : null;
}
export function setPoints(g, pts) { g.sentBuild = { ...(g.sentBuild || {}), pts: Object.fromEntries(SENT_STAT_KEYS.map((k) => [k, pts[k]])) }; }
export const resetCost = (g) => SENT_RESET_COST_PER_LEVEL * Math.max(1, g.level);
export function spellsProblem(g, ids) {
  if (!Array.isArray(ids) || ids.length > SENT_MAX_SPELLS || new Set(ids).size !== ids.length) return "sorts";
  const un = new Set(unlockedSpells(g).map((s) => s.id));
  return ids.every((id) => un.has(id)) ? null : "sorts";
}
export function setSpells(g, ids) { g.sentBuild = { ...(g.sentBuild || {}), spells: [...ids] }; }

// Les guildes des simulés répartissent leurs points d'elles-mêmes, à leur façon (tirée de l'id de la guilde, qui ne change pas)
export function autoAlloc(g) {
  if (freePoints(g) <= 0) return false;
  const r = makeRng(hashString(`sentbuild:${g.id}`));
  const w = Object.fromEntries(SENT_STAT_KEYS.map((k) => [k, 1 + r() * 2]));
  w.vitalite += 1.5; w.force += 1; w.chance += 0.5;                        // un sim aime la vie, les dégâts, et un peu de butin
  const sumW = SENT_STAT_KEYS.reduce((n, k) => n + w[k], 0), free = freePoints(g), pts = ptsOf(g);
  let left = free;
  const cap = Math.ceil(totalPoints(g.level) * SENT_STAT_CAP);
  for (const k of SENT_STAT_KEYS) { const add = Math.min(cap - pts[k], Math.floor((free * w[k]) / sumW)); pts[k] += add; left -= add; }
  for (let i = 0; left > 0 && i < 1000; i++) { const k = SENT_STAT_KEYS[i % SENT_STAT_KEYS.length]; if (pts[k] < cap) { pts[k] += 1; left--; } }
  setPoints(g, pts);
  return true;
}
