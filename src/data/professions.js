// ============================================================
// MÉTIERS — chaque personnage peut tous les pratiquer.
// Chaque métier a son propre niveau et sa propre xp ; le niveau
// débloque les recettes par paliers (voir getCraftInfo).
//
// Pour l'instant : métiers de craft uniquement. La récolte
// (bûcheron, mineur, herboriste) viendra avec la carte, le
// Bijoutier et l'Alchimiste avec les capes/amulettes/consommables.
// ============================================================

import { ITEMS } from "./items.js";
import { RECIPES } from "./recipes.js";

export const MAX_PROFESSION_LEVEL = 10;

export const PROFESSIONS = {
  forgeron: {
    key: "forgeron", name: "Forgeron", icon: "🔨",
    desc: "Armures lourdes, épées, masses et boucliers.",
  },
  tailleur: {
    key: "tailleur", name: "Tailleur", icon: "🧵",
    desc: "Robes et vêtements de tissu pour les lanceurs de sorts.",
  },
  maroquinier: {
    key: "maroquinier", name: "Maroquinier", icon: "🥾",
    desc: "Cuirs et armures légères pour les chasseurs et assassins.",
  },
  menuisier: {
    key: "menuisier", name: "Menuisier", icon: "🪵",
    desc: "Arcs et bâtons.",
  },
};

export const PROFESSION_ORDER = Object.keys(PROFESSIONS);

// xp nécessaire pour passer du niveau `level` au niveau suivant
export function xpForLevel(level) {
  return 30 * level;
}

// Quel métier fabrique quoi
const SET_PROFESSION = { veteran: "forgeron", apprenti: "tailleur", traqueur: "maroquinier" };
const WEAPON_PROFESSION = {
  epee: "forgeron", marteau: "forgeron", dague: "forgeron",
  baton: "menuisier", arc: "menuisier",
  faux: "forgeron",
};

// Niveau de métier requis selon le type d'objet
const SLOT_MIN_LEVEL = {
  gants: 1, ceinture: 1,
  chapeau: 2, jambieres: 2, arme: 2, bouclier: 2,
  plastron: 3,
};

// Renvoie { profession, minLevel, xp } pour un objet craftable
// (l'xp gagnée = coût en or de la recette).
export function getCraftInfo(itemId) {
  const item = ITEMS[itemId];
  const recipe = RECIPES[itemId];
  if (!item || !recipe) return null;

  let profession;
  if (item.set) profession = SET_PROFESSION[item.set];
  else if (item.type === "bouclier") profession = "forgeron";
  else if (item.type === "arme") profession = WEAPON_PROFESSION[item.weaponType];
  if (!profession) return null;

  return {
    profession,
    minLevel: SLOT_MIN_LEVEL[item.type] || 1,
    xp: recipe.gold,
  };
}

// Recettes d'un métier, triées par niveau requis puis par nom
export function recipesOfProfession(professionKey) {
  return Object.keys(RECIPES)
    .map((itemId) => ({ itemId, info: getCraftInfo(itemId) }))
    .filter((r) => r.info && r.info.profession === professionKey)
    .sort((a, b) => a.info.minLevel - b.info.minLevel || ITEMS[a.itemId].name.localeCompare(ITEMS[b.itemId].name));
}
