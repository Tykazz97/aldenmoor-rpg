// ============================================================
// LIVRE D'ÉQUIPEMENT — logique pure (pas de React) : tous les équipements du jeu, leurs stats, leur recette et la provenance des ressources.
// Alimente la vue « Équipements » du Bestiaire.
// ============================================================
import { ITEMS, SETS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { getCraftInfo, PROFESSIONS } from "../data/professions.js";
import { REFINING } from "../data/refining.js";
import { NODES } from "../data/gathering.js";
import { RESOURCES } from "../data/resources.js";
import { ENEMIES } from "../data/zones.js";
import { CLASSES } from "../data/classes.js";
import { WEAPON_TYPES, WEAPON_ORDER } from "../data/weapons.js";

export const SLOT_LABEL = {
  chapeau: "Tête", plastron: "Torse", gants: "Mains", ceinture: "Ceinture", jambieres: "Jambes",
  arme: "Arme", bouclier: "Bouclier", anneau: "Anneau", amulette: "Amulette", cape: "Cape", relique1: "Relique",
};

// Stats affichables, dans l'ordre : [clé, libellé, suffixe]
export const STAT_DEFS = [
  ["atk_phys", "Attaque phys.", ""], ["atk_magie", "Attaque magie", ""], ["def_phys", "Défense phys.", ""], ["def_magie", "Défense magie", ""],
  ["hp", "Points de vie", ""], ["esquive", "Esquive", " %"], ["critique", "Critique", " %"], ["dropBonus", "Bonus de butin", " %"],
];

// Stats d'un objet : [{ key, label, value, suffix }]
export function itemStats(item) {
  return STAT_DEFS.filter(([k]) => item[k]).map(([key, label, suffix]) => ({ key, label, value: item[key], suffix }));
}

// Les trois premiers sets n'ont pas de classe dans leurs données : on la déduit de leurs stats
const LEGACY_SET_CLASS = { veteran: "guerrier", apprenti: "magicien", traqueur: "assassin" };
export const setClass = (set) => set.classKey || LEGACY_SET_CLASS[set.key] || null;
export const classLabel = (key) => CLASSES[key]?.label || null;
export const setTier = (set) => set.tier || 1;

// Total des stats des cinq pièces d'un set
export function setTotals(set) {
  const total = {};
  for (const id of set.pieces) for (const { key, value } of itemStats(ITEMS[id])) total[key] = (total[key] || 0) + value;
  return STAT_DEFS.filter(([k]) => total[k]).map(([key, label, suffix]) => ({ key, label, value: total[key], suffix }));
}

// Recette d'un équipement : { profession, icon, minLevel, gold, ingredients: [{ id, qty }] } — null s'il ne se fabrique pas
export function recipeOf(itemId) {
  const rec = RECIPES[itemId], info = getCraftInfo(itemId);
  if (!rec || !info) return null;
  const prof = PROFESSIONS[info.profession];
  return { profession: prof.name, icon: prof.icon, minLevel: info.minLevel, gold: rec.gold, ingredients: Object.entries(rec.ingredients).map(([id, qty]) => ({ id, qty })) };
}

const dropsOf = (e) => (e.drops || []);

// Monstres qui lâchent un objet ou une ressource : [{ key, name, drop }] — la version difficile est omise si la normale lâche déjà la même chose
export function droppedBy(kind, id) {
  const out = [];
  for (const e of Object.values(ENEMIES)) {
    const d = dropsOf(e).find((x) => x.type === kind && x.id === id);
    if (!d) continue;
    if (e.hard && dropsOf(ENEMIES[e.baseKey]).some((x) => x.type === kind && x.id === id)) continue;
    out.push({ key: e.key, name: e.name, drop: d });
  }
  return out.sort((a, b) => b.drop.chance - a.drop.chance);
}

// D'où vient une ressource : raffinage, récolte et/ou monstres. [{ kind: "refine"|"gather"|"drop", ... }]
export function resourceSources(resId) {
  const out = [];
  const ref = REFINING[resId];
  if (ref) out.push({ kind: "refine", profession: PROFESSIONS[ref.profession].name, minLevel: ref.minLevel, verb: ref.verb, inputs: Object.entries(ref.ingredients).map(([id, qty]) => ({ id, qty })), gold: ref.gold });
  for (const n of Object.values(NODES)) if (n.resource === resId) out.push({ kind: "gather", node: n.name, profession: PROFESSIONS[n.profession].name, minLevel: n.minLevel, yield: n.yield });
  for (const m of droppedBy("resource", resId)) out.push({ kind: "drop", key: m.key, name: m.name, drop: m.drop });
  return out;
}

// Comment obtenir un équipement qui ne se fabrique pas : monstres qui le lâchent
export const itemDrops = (itemId) => droppedBy("item", itemId);

const RARITY_ORDER = { commune: 0, rare: 1, epique: 2, legendaire: 3 };
const byTier = (a, b) => (a.tier || 1) - (b.tier || 1) || RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
const entry = (item) => ({ key: item.id, item });

// Sections du livre d'équipement : sets (par palier), armes, boucliers, accessoires, reliques
export function gearSections() {
  const sections = [];
  const sets = Object.values(SETS).sort((a, b) => setTier(a) - setTier(b));
  for (const set of sets) {
    sections.push({ id: `set_${set.key}`, name: set.name, kind: "set", set, hint: `Palier ${setTier(set)}${setClass(set) ? ` · ${classLabel(setClass(set))}` : ""}`, entries: set.pieces.map((id) => entry(ITEMS[id])) });
  }
  const all = Object.values(ITEMS).filter((i) => i.type !== "cle");
  const weapons = all.filter((i) => i.type === "arme").sort((a, b) => byTier(a, b) || WEAPON_ORDER.indexOf(a.weaponType) - WEAPON_ORDER.indexOf(b.weaponType));
  sections.push({ id: "armes", name: "Armes", kind: "group", hint: "Épées, dagues, bâtons, arcs…", entries: weapons.map(entry) });
  sections.push({ id: "boucliers", name: "Boucliers", kind: "group", hint: "Main gauche", entries: all.filter((i) => i.type === "bouclier").sort(byTier).map(entry) });
  sections.push({ id: "accessoires", name: "Anneaux, amulettes et capes", kind: "group", hint: "Trophées de boss", entries: all.filter((i) => ["anneau", "amulette", "cape"].includes(i.type)).sort(byTier).map(entry) });
  sections.push({ id: "reliques", name: "Reliques", kind: "group", hint: "Butin de donjon", entries: all.filter((i) => i.type === "relique1").map(entry) });
  return sections.filter((s) => s.entries.length);
}

export const weaponLabel = (item) => WEAPON_TYPES[item.weaponType]?.label || null;

// Nombre total d'équipements du livre
export const gearCount = () => gearSections().reduce((n, s) => n + s.entries.length, 0);

// Recherche : nom de l'objet, du set, ou d'un de ses ingrédients
export function gearMatches(item, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  const set = item.set && SETS[item.set];
  if (set && set.name.toLowerCase().includes(q)) return true;
  const r = recipeOf(item.id);
  return !!r && r.ingredients.some((g) => (RESOURCES[g.id]?.name || "").toLowerCase().includes(q));
}
