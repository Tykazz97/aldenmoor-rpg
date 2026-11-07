// ============================================================
// Logique de craft — fonctions pures (pas de React), faciles à
// tester et réutilisables côté bots/serveur plus tard.
// ============================================================

import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { getCraftInfo, xpForLevel, MAX_PROFESSION_LEVEL } from "../data/professions.js";
import { recordCraft } from "./counters.js";

export function emptyProfessions(keys) {
  return Object.fromEntries(keys.map((k) => [k, { level: 1, xp: 0 }]));
}

// Vérifie si le joueur peut crafter l'objet et explique pourquoi sinon.
export function canCraft(player, itemId) {
  const recipe = RECIPES[itemId];
  const info = getCraftInfo(itemId);
  if (!recipe || !info) return { ok: false, unknown: true };

  const level = player.professions[info.profession]?.level ?? 1;
  const missing = {};
  for (const [resId, qty] of Object.entries(recipe.ingredients)) {
    const have = player.resources[resId] || 0;
    if (have < qty) missing[resId] = qty - have;
  }
  const lacksLevel = level < info.minLevel;
  const lacksGold = player.gold < recipe.gold;
  const lacksResources = Object.keys(missing).length > 0;

  return {
    ok: !lacksLevel && !lacksGold && !lacksResources,
    lacksLevel, lacksGold, lacksResources, missing,
    level, minLevel: info.minLevel,
  };
}

// Ajoute de l'xp à un métier et gère les montées de niveau.
export function gainProfessionXp(prof, amount) {
  let { level, xp } = prof;
  xp += amount;
  while (level < MAX_PROFESSION_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }
  if (level >= MAX_PROFESSION_LEVEL) xp = 0;
  return { level, xp };
}

// Applique un craft : consomme ressources et or, ajoute l'objet au sac,
// donne de l'xp au métier. Renvoie le même joueur si le craft est impossible.
export function applyCraft(player, itemId, uid) {
  const check = canCraft(player, itemId);
  if (!check.ok) return player;

  const recipe = RECIPES[itemId];
  const info = getCraftInfo(itemId);

  const resources = { ...player.resources };
  for (const [resId, qty] of Object.entries(recipe.ingredients)) {
    resources[resId] -= qty;
    if (resources[resId] <= 0) delete resources[resId];
  }

  return recordCraft({
    ...player,
    gold: player.gold - recipe.gold,
    resources,
    inventory: [...player.inventory, { ...ITEMS[itemId], uid }],
    professions: {
      ...player.professions,
      [info.profession]: gainProfessionXp(player.professions[info.profession], info.xp),
    },
  }, itemId);
}

// Ajoute des ressources { idRessource: quantité } à un joueur
export function addResourcesTo(player, gains) {
  const resources = { ...player.resources };
  for (const [resId, qty] of Object.entries(gains)) {
    resources[resId] = (resources[resId] || 0) + qty;
  }
  return { ...player, resources };
}
