// ============================================================
// Logique de craft — fonctions pures (pas de React), faciles à
// tester et réutilisables côté bots/serveur plus tard.
// ============================================================

import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { getCraftInfo, xpForLevel, MAX_PROFESSION_LEVEL } from "../data/professions.js";
import { REFINING } from "../data/refining.js";
import { recordCraft } from "./counters.js";
import { rollRefineBonus, rollMasterwork, rollSavedMaterials, makeMasterwork } from "./perks.js";

// État d'un métier (les saves d'avant les métiers de raffinage n'ont pas ces métiers : niveau 1 par défaut)
export const professionOf = (player, key) => player.professions?.[key] || { level: 1, xp: 0 };

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
export function applyCraft(player, itemId, uid, rng = Math.random) {
  const check = canCraft(player, itemId);
  if (!check.ok) return player;

  const recipe = RECIPES[itemId];
  const info = getCraftInfo(itemId);

  const level = professionOf(player, info.profession).level;
  const masterwork = rollMasterwork(level, info.profession, rng);
  const saved = rollSavedMaterials(level, info.profession, rng);
  const resources = { ...player.resources };
  if (!saved) {
    for (const [resId, qty] of Object.entries(recipe.ingredients)) {
      resources[resId] -= qty;
      if (resources[resId] <= 0) delete resources[resId];
    }
  }

  return recordCraft({
    ...player,
    gold: player.gold - recipe.gold,
    resources,
    inventory: [...player.inventory, { ...(masterwork ? makeMasterwork(ITEMS[itemId]) : ITEMS[itemId]), uid }],
    professions: {
      ...player.professions,
      [info.profession]: gainProfessionXp(professionOf(player, info.profession), info.xp),
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

// ---- Raffinage ----
// Combien d'unités peut-on raffiner d'un coup ? (limité par le niveau, les matières brutes et l'or)
export function maxRefine(player, id) {
  const rec = REFINING[id];
  if (!rec || professionOf(player, rec.profession).level < rec.minLevel) return 0;
  let n = Infinity;
  for (const [r, q] of Object.entries(rec.ingredients)) n = Math.min(n, Math.floor((player.resources[r] || 0) / q));
  if (rec.gold > 0) n = Math.min(n, Math.floor(player.gold / rec.gold));
  return Number.isFinite(n) ? n : 0;
}

export function canRefine(player, id, times = 1) {
  const rec = REFINING[id];
  if (!rec) return { ok: false, unknown: true };
  const level = professionOf(player, rec.profession).level;
  const missing = {};
  for (const [r, q] of Object.entries(rec.ingredients)) { const lack = q * times - (player.resources[r] || 0); if (lack > 0) missing[r] = lack; }
  const lacksLevel = level < rec.minLevel, lacksGold = player.gold < rec.gold * times, lacksResources = Object.keys(missing).length > 0;
  return { ok: !lacksLevel && !lacksGold && !lacksResources && times >= 1, lacksLevel, lacksGold, lacksResources, missing, level, minLevel: rec.minLevel };
}

// Raffine `times` unités : consomme matières brutes et or, ajoute la ressource raffinée et l'xp du métier.
// Renvoie { player, made, bonus } ; le même joueur et made = 0 si c'est impossible.
// `bonus` = unités en plus offertes par le niveau du métier (made les inclut).
export function applyRefine(player, id, times = 1, rng = Math.random) {
  const n = Math.floor(times);
  if (!canRefine(player, id, n).ok) return { player, made: 0 };
  const rec = REFINING[id];
  const resources = { ...player.resources };
  for (const [r, q] of Object.entries(rec.ingredients)) { resources[r] -= q * n; if (resources[r] <= 0) delete resources[r]; }
  const bonus = rollRefineBonus(professionOf(player, rec.profession).level, rec.profession, n, rng);
  resources[id] = (resources[id] || 0) + n + bonus;
  const prof = gainProfessionXp(professionOf(player, rec.profession), rec.xp * n);
  return { made: n + bonus, bonus, player: { ...player, gold: player.gold - rec.gold * n, resources, professions: { ...player.professions, [rec.profession]: prof } } };
}
