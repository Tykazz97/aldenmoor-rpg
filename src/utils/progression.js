// ============================================================
// Progression du joueur : xp, niveaux et récompenses de combat.
// Fonctions pures (pas de React).
// ============================================================

import { ITEMS } from "../data/items.js";
import { POINTS_PER_LEVEL, FREE_VITALITE_PER_LEVEL } from "../data/caracs.js";
import { addResourcesTo } from "./crafting.js";

export const MAX_LEVEL = 50;

// xp nécessaire pour passer du niveau `level` au suivant
export function xpToNext(level) {
  return 40 + 20 * level; // niveau 1 -> 2 : 60 xp
}

// Applique l'xp gagnée (avec montées de niveau en cascade).
// Renvoie { player, levelsGained }.
export function gainXp(player, amount) {
  let { level, xp, caracPoints } = player;
  let caracs = player.caracs;
  let levelsGained = 0;
  xp += amount;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained += 1;
    caracPoints += POINTS_PER_LEVEL;
    caracs = { ...caracs, vitalite: (caracs.vitalite || 0) + FREE_VITALITE_PER_LEVEL };
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { player: { ...player, level, xp, caracPoints, caracs }, levelsGained };
}

// Applique les récompenses d'un combat gagné :
// rewards = { xp, gold, resources: { id: qty }, items: [itemId, ...] }
// `uidBase` sert à donner un identifiant unique aux objets reçus.
export function applyRewards(player, rewards, uidBase = "loot") {
  let next = { ...player, gold: player.gold + (rewards.gold || 0) };
  next = addResourcesTo(next, rewards.resources || {});
  const newItems = (rewards.items || []).map((id, i) => ({ ...ITEMS[id], uid: `${uidBase}-${i}` }));
  next = { ...next, inventory: [...next.inventory, ...newItems] };
  return gainXp(next, rewards.xp || 0);
}
