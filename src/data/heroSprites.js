// ============================================================
// Apparence du héros = un corps (masculin / féminin) + une tenue.
//
// La tenue affichée est, par ordre de priorité :
//   1. l'emplacement « Apparence » (player.appearance) s'il est rempli ;
//   2. le set dont on porte le plus de pièces (2 minimum) ;
//   3. la tenue de départ de la classe.
// L'apparence est purement cosmétique : elle ne change aucune stat.
//
// Un « look » est une chaîne "<corps>/<tenue>", ex. "m/veteran".
// Fichiers : public/assets/combat/hero/<corps>/<tenue>.webp
//            public/assets/hero/<corps>/<tenue>/<action>.webp
// ============================================================
import { CLASSES } from "./classes.js";
import { SETS } from "./items.js";

const HERO_BASE = "/assets/combat/hero";

export const HERO_OUTFITS = ["base", "veteran", "apprenti", "traqueur", "fossoyeur", "charognard", "brasier"];
export const OUTFIT_LABELS = { base: "Voyageur", veteran: "Vétéran", apprenti: "Apprenti", traqueur: "Traqueur", fossoyeur: "Fossoyeur", charognard: "Charognard", brasier: "Brasier" };
export const BODIES = { m: "Masculin", f: "Féminin" };

// Looks dont l'image de combat existe ; un look manquant retombe sur le corps masculin
const COMBAT_READY = new Set(HERO_OUTFITS.flatMap((o) => [`m/${o}`, `f/${o}`]));

function outfitFromSets(setBonuses = []) {
  let best = null;
  for (const b of setBonuses) {
    if (b.count >= 2 && HERO_OUTFITS.includes(b.set.key) && (!best || b.count > best.count)) best = b;
  }
  return best ? best.set.key : null;
}

// Apparence d'un simulé d'après les pièces qu'il porte (`life.gear`) : même règle que le joueur, 2 pièces ou plus d'un set
// qui a ses images (le set le plus complet l'emporte), sinon la tenue de sa classe.
export function outfitFromGear(gear = {}, classKey) {
  const worn = new Set(Object.values(gear || {}).filter(Boolean));
  let best = null, bestN = 1;
  for (const o of HERO_OUTFITS) {
    const n = (SETS[o]?.pieces || []).filter((id) => worn.has(id)).length;
    if (n > bestN) { best = o; bestN = n; }
  }
  return best || CLASSES[classKey]?.outfit || "base";
}

export function heroOutfit(player, stats) {
  if (HERO_OUTFITS.includes(player.appearance)) return player.appearance;
  return outfitFromSets(stats?.setBonuses) || CLASSES[player.classKey]?.outfit || "base";
}

export const heroBody = (player) => (player.gender === "f" ? "f" : "m");
export const heroLook = (player, stats) => `${heroBody(player)}/${heroOutfit(player, stats)}`;

// Look réellement disponible pour l'image de combat
export const resolveCombatLook = (look) => (COMBAT_READY.has(look) ? look : `m/${look.split("/")[1]}`);
export const heroSpriteUrl = (look) => `${HERO_BASE}/${resolveCombatLook(look)}.webp`;

// Tenues que le joueur peut choisir : celle de sa classe, "base", et les sets dont
// il possède au moins une pièce (portée ou dans le sac).
export function availableOutfits(player) {
  const owned = new Set([...Object.values(player.equipped || {}), ...(player.inventory || [])].filter(Boolean).map((i) => i.id));
  return HERO_OUTFITS.filter((o) =>
    o === "base" || o === CLASSES[player.classKey]?.outfit || (SETS[o]?.pieces || []).some((id) => owned.has(id)));
}
