// ============================================================
// Avantages des métiers : ce que chaque niveau de métier apporte (sans React).
//   Récolte  (bûcheron, mineur, herboriste) : récolte plus rapide, chance de récolte double, chance de trouvaille.
//   Raffinage (fondeur, scieur, tanneur, tisserand) : chance de produire 1 unité de plus, sans rien consommer de plus.
//   Fabrication (forgeron, tailleur, maroquinier, menuisier) : chance de « chef-d'œuvre », un objet aux stats +10 %.
// Chaque niveau au-dessus du premier ajoute le même pas ; au niveau 10, on atteint le maximum.
// Tous les tirages prennent un `rng` (0..1) pour pouvoir être testés.
// ============================================================
import { PROFESSIONS } from "../data/professions.js";

// Pas par niveau (au-dessus du niveau 1)
export const GATHER_SPEED_STEP = 0.04;       // récolte 4 % plus rapide par niveau (−32 % de durée au niveau 10)
export const GATHER_DOUBLE_STEP = 0.05;      // +5 % de chance de récolte double par niveau
export const GATHER_FIND_STEP = 0.02;        // +2 % de chance de trouvaille par niveau
export const REFINE_BONUS_STEP = 0.04;       // +4 % de chance d'une unité de plus par niveau
export const CRAFT_MASTERWORK_STEP = 0.03;   // +3 % de chance de chef-d'œuvre par niveau
export const MASTERWORK_RATE = 1.1;          // un chef-d'œuvre a +10 % de stats (au moins +1)
export const MASTERWORK_VALUE_RATE = 1.25;   // et se vend 25 % plus cher

// Trouvaille : ressource peu commune du même métier, trouvée en plus (1 unité)
export const FIND_RESOURCE = { bucheron: "bois_de_chene", mineur: "minerai_de_cuivre", herboriste: "sauge" };

const steps = (level) => Math.max(0, level - 1);
const kindOf = (key) => PROFESSIONS[key]?.kind || "craft";

export function perksFor(professionKey, level) {
  const s = steps(level), kind = kindOf(professionKey);
  if (kind === "gather") return { kind, speed: 1 - GATHER_SPEED_STEP * s, double: GATHER_DOUBLE_STEP * s, find: GATHER_FIND_STEP * s };
  if (kind === "refine") return { kind, bonus: REFINE_BONUS_STEP * s };
  return { kind, masterwork: CRAFT_MASTERWORK_STEP * s };
}

const pct = (v) => `${Math.round(v * 100)} %`;
// Lignes lisibles pour l'écran des métiers : { label, now, next } ; `next` est la valeur au niveau suivant (null au maximum)
export function perkLines(professionKey, level, maxLevel) {
  const now = perksFor(professionKey, level), nxt = level < maxLevel ? perksFor(professionKey, level + 1) : null;
  const row = (label, a, b, fmt = pct) => ({ label, now: fmt(a), next: nxt ? fmt(b) : null });
  if (now.kind === "gather") return [
    row("Récolte plus rapide de", 1 - now.speed, nxt && 1 - nxt.speed),
    row("Chance de récolte double", now.double, nxt?.double),
    row("Chance de trouvaille rare", now.find, nxt?.find),
  ];
  if (now.kind === "refine") return [row("Chance de produire 1 unité de plus", now.bonus, nxt?.bonus)];
  return [row("Chance de chef-d'œuvre (+10 % de stats)", now.masterwork, nxt?.masterwork)];
}

// ---- tirages ----
// Récolte : quantité (éventuellement doublée) et trouvaille éventuelle { idRessource: 1 }
export function rollGather(level, professionKey, baseQty, rng = Math.random) {
  const p = perksFor(professionKey, level);
  const doubled = rng() < p.double;
  const find = FIND_RESOURCE[professionKey] && rng() < p.find ? { [FIND_RESOURCE[professionKey]]: 1 } : null;
  return { qty: doubled ? baseQty * 2 : baseQty, doubled, find };
}
export const harvestDuration = (level, professionKey, baseMs) => Math.round(baseMs * perksFor(professionKey, level).speed);

// Raffinage : nombre d'unités bonus sur `times` unités produites
export function rollRefineBonus(level, professionKey, times, rng = Math.random) {
  const p = perksFor(professionKey, level).bonus;
  let extra = 0;
  for (let i = 0; i < times; i++) if (rng() < p) extra++;
  return extra;
}

// Fabrication : l'objet est-il un chef-d'œuvre ?
export const rollMasterwork = (level, professionKey, rng = Math.random) => rng() < perksFor(professionKey, level).masterwork;

const SCALED = ["atk_phys", "atk_magie", "def_phys", "def_magie", "hp", "esquive", "critique"];
export function makeMasterwork(item) {
  const out = { ...item, quality: "chef_d_oeuvre", name: `${item.name} (chef-d'œuvre)` };
  for (const k of SCALED) if (item[k]) out[k] = Math.max(item[k] + 1, Math.round(item[k] * MASTERWORK_RATE));
  return out;
}
export const isMasterwork = (item) => item?.quality === "chef_d_oeuvre";
