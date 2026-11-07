// ============================================================
// Logique de craft — fonctions pures (pas de React), faciles à
// tester et réutilisables côté bots/serveur plus tard.
// ============================================================

import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { getCraftInfo, xpForLevel, MAX_PROFESSION_LEVEL } from "../data/professions.js";
import { REFINING } from "../data/refining.js";
import { ALCHEMY } from "../data/alchemy.js";
import { recordCraft } from "./counters.js";
import { craftFee, unitFee, recordTax } from "./cityTax.js";
import { rollRefineBonus, rollMasterwork, rollSavedMaterials, makeMasterwork } from "./perks.js";

// État d'un métier (les saves d'avant les métiers de raffinage n'ont pas ces métiers : niveau 1 par défaut)
export const professionOf = (player, key) => player.professions?.[key] || { level: 1, xp: 0 };

export function emptyProfessions(keys) {
  return Object.fromEntries(keys.map((k) => [k, { level: 1, xp: 0 }]));
}

// `opts` (dernier paramètre des fonctions de l'atelier) : { rate, city } = taxe de la ville où l'on fabrique (défaut : 1 %, sans registre).
// L'or de la recette (`gold`) n'est plus dépensé : il compte dans le prix de l'objet et donne l'xp ; on paie la taxe de la ville.

// Vérifie si le joueur peut crafter l'objet et explique pourquoi sinon.
export function canCraft(player, itemId, opts = {}) {
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
  const fee = craftFee(itemId, opts.rate);
  const lacksGold = player.gold < fee;
  const lacksResources = Object.keys(missing).length > 0;

  return {
    ok: !lacksLevel && !lacksGold && !lacksResources,
    lacksLevel, lacksGold, lacksResources, missing, fee,
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
export function applyCraft(player, itemId, uid, rng = Math.random, opts = {}) {
  const check = canCraft(player, itemId, opts);
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

  return recordCraft(recordTax({
    ...player,
    gold: player.gold - check.fee,
    resources,
    inventory: [...player.inventory, { ...(masterwork ? makeMasterwork(ITEMS[itemId]) : ITEMS[itemId]), uid }],
    professions: {
      ...player.professions,
      [info.profession]: gainProfessionXp(professionOf(player, info.profession), info.xp),
    },
  }, opts.city, check.fee), itemId);
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
export function maxRefine(player, id, opts = {}) {
  const rec = REFINING[id];
  if (!rec || professionOf(player, rec.profession).level < rec.minLevel) return 0;
  let n = Infinity;
  for (const [r, q] of Object.entries(rec.ingredients)) n = Math.min(n, Math.floor((player.resources[r] || 0) / q));
  const fee = unitFee(id, opts.rate);
  if (fee > 0) n = Math.min(n, Math.floor(player.gold / fee));
  return Number.isFinite(n) ? n : 0;
}

export function canRefine(player, id, times = 1, opts = {}) {
  const rec = REFINING[id];
  if (!rec) return { ok: false, unknown: true };
  const level = professionOf(player, rec.profession).level;
  const missing = {};
  for (const [r, q] of Object.entries(rec.ingredients)) { const lack = q * times - (player.resources[r] || 0); if (lack > 0) missing[r] = lack; }
  const fee = unitFee(id, opts.rate);
  const lacksLevel = level < rec.minLevel, lacksGold = player.gold < fee * times, lacksResources = Object.keys(missing).length > 0;
  return { ok: !lacksLevel && !lacksGold && !lacksResources && times >= 1, lacksLevel, lacksGold, lacksResources, missing, level, minLevel: rec.minLevel, fee };
}

// Raffine `times` unités : consomme matières brutes et or, ajoute la ressource raffinée et l'xp du métier.
// Renvoie { player, made, bonus } ; le même joueur et made = 0 si c'est impossible.
// `bonus` = unités en plus offertes par le niveau du métier (made les inclut).
export function applyRefine(player, id, times = 1, rng = Math.random, opts = {}) {
  const n = Math.floor(times);
  if (!canRefine(player, id, n, opts).ok) return { player, made: 0 };
  const fee = unitFee(id, opts.rate) * n;
  const rec = REFINING[id];
  const resources = { ...player.resources };
  for (const [r, q] of Object.entries(rec.ingredients)) { resources[r] -= q * n; if (resources[r] <= 0) delete resources[r]; }
  const bonus = rollRefineBonus(professionOf(player, rec.profession).level, rec.profession, n, rng);
  resources[id] = (resources[id] || 0) + n + bonus;
  const prof = gainProfessionXp(professionOf(player, rec.profession), rec.xp * n);
  return { made: n + bonus, bonus, player: recordTax({ ...player, gold: player.gold - fee, resources, professions: { ...player.professions, [rec.profession]: prof } }, opts.city, fee) };
}

// ---- Alchimie (potions : voir alchemy.js) ----
// Même mécanique que le raffinage : par lots, une potion par unité, avec la chance du niveau d'en produire une de plus.
export function maxBrew(player, id, opts = {}) {
  const rec = ALCHEMY[id];
  if (!rec || professionOf(player, rec.profession).level < rec.minLevel) return 0;
  const fee = unitFee(id, opts.rate);
  let n = fee > 0 ? Math.floor(player.gold / fee) : Infinity;
  for (const [r, q] of Object.entries(rec.ingredients)) n = Math.min(n, Math.floor((player.resources[r] || 0) / q));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function canBrew(player, id, times = 1, opts = {}) {
  const rec = ALCHEMY[id];
  if (!rec) return { ok: false, unknown: true };
  const level = professionOf(player, rec.profession).level;
  const missing = {};
  for (const [r, q] of Object.entries(rec.ingredients)) { const lack = q * times - (player.resources[r] || 0); if (lack > 0) missing[r] = lack; }
  const fee = unitFee(id, opts.rate);
  const lacksLevel = level < rec.minLevel, lacksGold = player.gold < fee * times, lacksResources = Object.keys(missing).length > 0;
  return { ok: !lacksLevel && !lacksGold && !lacksResources && times >= 1, lacksLevel, lacksGold, lacksResources, missing, level, minLevel: rec.minLevel, fee };
}

// Distille `times` potions. Renvoie { player, made, bonus } ; le même joueur et made = 0 si c'est impossible.
export function applyBrew(player, id, times = 1, rng = Math.random, opts = {}) {
  const n = Math.floor(times);
  if (!canBrew(player, id, n, opts).ok) return { player, made: 0, bonus: 0 };
  const fee = unitFee(id, opts.rate) * n;
  const rec = ALCHEMY[id];
  const resources = { ...player.resources };
  for (const [r, q] of Object.entries(rec.ingredients)) { resources[r] -= q * n; if (resources[r] <= 0) delete resources[r]; }
  const bonus = rollRefineBonus(professionOf(player, rec.profession).level, rec.profession, n, rng);
  resources[id] = (resources[id] || 0) + n + bonus;
  const prof = gainProfessionXp(professionOf(player, rec.profession), rec.xp * n);
  return { made: n + bonus, bonus, player: recordTax({ ...player, gold: player.gold - fee, resources, professions: { ...player.professions, [rec.profession]: prof } }, opts.city, fee) };
}
