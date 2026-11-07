// ============================================================
// MÉTIERS — chaque personnage peut tous les pratiquer.
// Chaque métier a son propre niveau et sa propre xp ; le niveau
// débloque les recettes par paliers (voir getCraftInfo).
//
// Métiers de craft (forgeron, tailleur, maroquinier, menuisier), de
// récolte (bûcheron, mineur, herboriste : voir gathering.js) et de raffinage
// (fondeur, scieur, tanneur, tisserand : voir refining.js). Le
// Bijoutier fait les anneaux et les amulettes, le Bricoleur les clés des donjons ; l'Alchimiste distille les potions de soin (voir alchemy.js).
// ============================================================

import { ITEMS } from "./items.js";
import { RECIPES } from "./recipes.js";

export const MAX_PROFESSION_LEVEL = 100;      // niveau maximum de tous les métiers

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
  bijoutier: {
    key: "bijoutier", name: "Bijoutier", icon: "💍",
    desc: "Anneaux et amulettes, forgés avec les trophées des boss.",
  },
  bricoleur: {
    key: "bricoleur", name: "Bricoleur", icon: "🗝️",
    desc: "Fabrique les clés des donjons.",
  },
  alchimiste: {
    key: "alchimiste", name: "Alchimiste", icon: "⚗️",
    desc: "Distille des potions de soin avec les herbes et les trophées de la Lisière.",
  },
  // --- Récolte : se pratique sur la carte ---
  bucheron: {
    key: "bucheron", name: "Bûcheron", icon: "🪓", kind: "gather",
    desc: "Abat les arbres de la carte pour récupérer du bois.",
  },
  mineur: {
    key: "mineur", name: "Mineur", icon: "⛏️", kind: "gather",
    desc: "Extrait le minerai des filons.",
  },
  herboriste: {
    key: "herboriste", name: "Herboriste", icon: "🌿", kind: "gather",
    desc: "Cueille les plantes sauvages.",
  },
  // --- Raffinage : transforme les matières brutes à l'atelier (voir refining.js) ---
  fondeur: {
    key: "fondeur", name: "Fondeur", icon: "🔥", kind: "refine",
    desc: "Fond le minerai en lingots, la matière des armures lourdes et des armes.",
  },
  scieur: {
    key: "scieur", name: "Scieur", icon: "🪚", kind: "refine",
    desc: "Débite le bois en planches pour les arcs, bâtons et boucliers.",
  },
  tanneur: {
    key: "tanneur", name: "Tanneur", icon: "🦌", kind: "refine",
    desc: "Tanne les peaux en cuir solide.",
  },
  tisserand: {
    key: "tisserand", name: "Tisserand", icon: "🧶", kind: "refine",
    desc: "Retisse les chiffons en étoffe et file les orties.",
  },
};

export const PROFESSION_ORDER = Object.keys(PROFESSIONS);

// xp nécessaire pour passer du niveau `level` au niveau suivant
export function xpForLevel(level) {
  return 30 * level;                          // niveau 1 -> 2 : 30 xp ; 99 -> 100 : 2 970 xp (≈ 148 500 xp au total)
}

// Quel métier fabrique quoi
const SET_PROFESSION = {
  veteran: "forgeron", apprenti: "tailleur", traqueur: "maroquinier",
  fossoyeur: "forgeron", charognard: "maroquinier", brasier: "tailleur",
  chevalier: "forgeron", garou: "maroquinier", esprit: "tailleur",
  garde_noye: "forgeron", veneur: "maroquinier", veuve: "tailleur",
};
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
// Les paliers 2, 3 et 4 demandent un métier plus avancé (+3, +6 et +9 niveaux) ; `craftLevel` sur l'objet remplace ce calcul
const TIER_LEVEL_OFFSET = { 1: 0, 2: 3, 3: 6, 4: 9 };

// Renvoie { profession, minLevel, xp } pour un objet craftable
// (l'xp gagnée = coût en or de la recette).
export function getCraftInfo(itemId) {
  const item = ITEMS[itemId];
  const recipe = RECIPES[itemId];
  if (!item || !recipe) return null;

  let profession;
  if (item.set) profession = SET_PROFESSION[item.set];
  else if (item.type === "bouclier") profession = "forgeron";
  else if (item.type === "cape") profession = "tailleur";
  else if (item.type === "amulette" || item.type === "anneau") profession = "bijoutier";
  else if (item.type === "cle") profession = "bricoleur";
  else if (item.type === "arme") profession = WEAPON_PROFESSION[item.weaponType];
  if (!profession) return null;

  return {
    profession,
    minLevel: item.craftLevel ?? (SLOT_MIN_LEVEL[item.type] || 1) + TIER_LEVEL_OFFSET[item.tier || 1],
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
