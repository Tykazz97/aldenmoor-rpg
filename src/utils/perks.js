// ============================================================
// Avantages des métiers : ce que chaque niveau de métier apporte (sans React).
//   Récolte  (bûcheron, mineur, herboriste) : récolte plus rapide, chance de récolte double, chance de trouvaille.
//   Raffinage (fondeur, scieur, tanneur, tisserand) : chance de produire 1 unité de plus, sans rien consommer de plus.
//   Fabrication (forgeron, tailleur, maroquinier, menuisier, bijoutier) : chance de « chef-d'œuvre », un objet aux stats +10 %.
//   Bricoleur (clés de donjon, rien à améliorer) : chance de fabriquer une clé en plus.
// Niveau 1 : aucun avantage ; niveau 100 : le maximum (PERK_MAX) ; entre les deux, une courbe qui monte plus vite au début.
// Tous les tirages prennent un `rng` (0..1) pour pouvoir être testés.
// ============================================================
import { PROFESSIONS, MAX_PROFESSION_LEVEL } from "../data/professions.js";

// Valeur maximale de chaque avantage, atteinte au niveau maximum du métier (100)
export const PERK_MAX = {
  speed: 0.80,        // durée de récolte divisée par 5 au niveau 100 (5 s → 1 s)
  double: 0.50,       // 50 % de chance de récolte double
  find: 0.20,         // 20 % de chance de trouvaille
  bonus: 0.40,        // 40 % de chance d'une unité de plus au raffinage
  masterwork: 0.30,   // 30 % de chance de chef-d'œuvre
  spareKey: 0.25,     // Bricoleur : 25 % de chance de fabriquer une clé en plus
};
// Les premiers niveaux comptent plus que les derniers : progression = ((niveau − 1) / (niveau max − 1)) ^ PERK_CURVE
export const PERK_CURVE = 0.7;
export const MASTERWORK_RATE = 1.1;          // un chef-d'œuvre a +10 % de stats (au moins +1)
export const MASTERWORK_VALUE_RATE = 1.25;   // et se vend 25 % plus cher

// Trouvaille : ressource peu commune du même métier, trouvée en plus (1 unité)
export const FIND_RESOURCE = { bucheron: "bois_de_chene", mineur: "minerai_de_cuivre", herboriste: "sauge" };

export const perkProgress = (level) => Math.pow(Math.min(1, Math.max(0, (level - 1) / (MAX_PROFESSION_LEVEL - 1))), PERK_CURVE);
const kindOf = (key) => PROFESSIONS[key]?.kind || "craft";
const isKeysmith = (key) => key === "bricoleur";

export function perksFor(professionKey, level) {
  const k = perkProgress(level), kind = kindOf(professionKey);
  if (kind === "gather") return { kind, speed: 1 - PERK_MAX.speed * k, double: PERK_MAX.double * k, find: PERK_MAX.find * k };
  if (kind === "refine") return { kind, bonus: PERK_MAX.bonus * k };
  if (isKeysmith(professionKey)) return { kind: "keys", spare: PERK_MAX.spareKey * k };
  return { kind, masterwork: PERK_MAX.masterwork * k };
}

const pct = (v) => `${String(Math.round(v * 1000) / 10).replace(".", ",")} %`;      // une décimale, virgule française
// Lignes lisibles pour l'écran des métiers : { label, now, next } ; `next` est la valeur au niveau suivant (null au maximum)
export function perkLines(professionKey, level, maxLevel = MAX_PROFESSION_LEVEL) {
  const now = perksFor(professionKey, level), nxt = level < maxLevel ? perksFor(professionKey, level + 1) : null;
  const row = (label, a, b, fmt = pct) => ({ label, now: fmt(a), next: nxt ? fmt(b) : null });
  if (now.kind === "gather") return [
    row("Récolte plus rapide de", 1 - now.speed, nxt && 1 - nxt.speed),
    row("Chance de récolte double", now.double, nxt?.double),
    row("Chance de trouvaille rare", now.find, nxt?.find),
  ];
  if (now.kind === "refine") return [row("Chance de produire 1 unité de plus", now.bonus, nxt?.bonus)];
  if (now.kind === "keys") return [row("Chance de fabriquer une clé en plus", now.spare, nxt?.spare)];
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
export const rollMasterwork = (level, professionKey, rng = Math.random) => rng() < (perksFor(professionKey, level).masterwork || 0);
// Bricoleur : la clé fabriquée est-elle doublée (sans rien consommer de plus) ?
export const rollSpareKey = (level, professionKey, rng = Math.random) => rng() < (perksFor(professionKey, level).spare || 0);

const SCALED = ["atk_phys", "atk_magie", "def_phys", "def_magie", "hp", "esquive", "critique"];
export function makeMasterwork(item) {
  const out = { ...item, quality: "chef_d_oeuvre", name: `${item.name} (chef-d'œuvre)` };
  for (const k of SCALED) if (item[k]) out[k] = Math.max(item[k] + 1, Math.round(item[k] * MASTERWORK_RATE));
  return out;
}
export const isMasterwork = (item) => item?.quality === "chef_d_oeuvre";
