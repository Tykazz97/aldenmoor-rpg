// ============================================================
// GRIMOIRE — rangs des sorts et barre de combat équipable.
// Fonctions pures (pas de React), testées par scripts/test-spellbook.js.
//
//  - Chaque niveau gagné donne 1 point de sort (niveau 2 → 1 point, niveau 50 → 49 points).
//  - Un sort monte du rang 1 au rang 5 ; passer du rang r au rang r+1 coûte r points
//    (10 points pour un sort au rang maximum). On ne peut pas tout monter : il faut choisir.
//  - Chaque rang renforce le sort ; le rang 5 réduit en plus son coût de 1 PA.
//  - La barre de combat contient le sort de l'arme (toujours) + quelques sorts de classe,
//    à choisir parmi ceux débloqués. Le nombre d'emplacements monte avec le niveau.
//
// Sauvegarde : player.spellbook = { ranks: { idDuSort: rang }, loadout: [ids] | null }
// (absent sur les anciennes sauvegardes : lu avec des valeurs par défaut, voir spellbookOf).
// ============================================================

import { classSpellsAt } from "../data/classes.js";
import { WEAPON_TYPES, UNARMED_SPELLS } from "../data/weapons.js";

export const MAX_RANK = 5;
export const RESET_GOLD_PER_LEVEL = 50;

// Renforcement par rang au-dessus de 1
export const RANK_BONUS = {
  power: 0.08,       // dégâts +8 % par rang
  critBonus: 2,      // +2 points de critique par rang
  lifesteal: 0.03,
  armorPen: 0.03,
  dot: 0.10,         // poison / brûlure +10 % par rang
  debuff: 0.03,      // affaiblissement / armure brisée : +3 points par rang (plafond 60 %)
  buff: 0.10,        // parade : DEF et contre-attaque +10 % par rang
};

// Emplacements de sorts de classe dans la barre (le sort de l'arme est en plus)
export const classSlots = (level) => 3 + (level >= 10 ? 1 : 0) + (level >= 25 ? 1 : 0);

// ------------------------------------------------------------
// Points de sort
// ------------------------------------------------------------
export const rankCost = (rank) => rank;                       // coût pour passer de `rank` à `rank + 1`
export const pointsSpentOn = (rank) => (rank * (rank - 1)) / 2;

export function spellbookOf(player) {
  const sb = player.spellbook || {};
  return { ranks: sb.ranks || {}, loadout: Array.isArray(sb.loadout) ? sb.loadout : null };
}
export const rankOf = (player, id) => Math.min(MAX_RANK, Math.max(1, spellbookOf(player).ranks[id] || 1));

export const spellPointsTotal = (level) => Math.max(0, level - 1);
export const spellPointsSpent = (player) =>
  Object.values(spellbookOf(player).ranks).reduce((sum, r) => sum + pointsSpentOn(Math.min(MAX_RANK, Math.max(1, r))), 0);
export const spellPointsLeft = (player) => spellPointsTotal(player.level) - spellPointsSpent(player);
export const resetCost = (player) => (spellPointsSpent(player) > 0 ? RESET_GOLD_PER_LEVEL * player.level : 0);

// ------------------------------------------------------------
// Un sort à un rang donné (copie : les données d'origine ne changent jamais)
// ------------------------------------------------------------
const r2 = (x) => Math.round(x * 100) / 100;

export function rankSpell(spell, rank = 1) {
  const k = Math.max(0, Math.min(MAX_RANK, rank) - 1);
  const s = { ...spell, rank: k + 1, maxRank: MAX_RANK };
  if (!k) return s;
  if (spell.power) s.power = r2(spell.power * (1 + RANK_BONUS.power * k));
  if (spell.critBonus) s.critBonus = spell.critBonus + RANK_BONUS.critBonus * k;
  if (spell.lifesteal) s.lifesteal = Math.min(0.9, r2(spell.lifesteal + RANK_BONUS.lifesteal * k));
  if (spell.armorPen) s.armorPen = Math.min(0.8, r2(spell.armorPen + RANK_BONUS.armorPen * k));
  if (spell.effect) {
    const e = { ...spell.effect };
    if (e.kind === "dot") e.ratio = r2(e.ratio * (1 + RANK_BONUS.dot * k));
    else if (e.kind === "weaken" || e.kind === "defDown") e.value = Math.min(0.6, r2(e.value + RANK_BONUS.debuff * k));
    else if (e.kind === "paLoss" && k + 1 >= MAX_RANK) e.value += 1;
    s.effect = e;
  }
  if (spell.selfEffect?.kind === "parade") {
    const f = { ...spell.selfEffect };
    f.defUp = Math.round(f.defUp * (1 + RANK_BONUS.buff * k));
    f.counter = r2(f.counter * (1 + RANK_BONUS.buff * k));
    if (k + 1 >= MAX_RANK) f.turns += 1;
    s.selfEffect = f;
  }
  if (k + 1 >= MAX_RANK) s.pa = Math.max(Math.min(spell.pa, 2), spell.pa - 1);
  return s;
}

// ------------------------------------------------------------
// Sorts connus et barre de combat
// ------------------------------------------------------------
export const weaponSpellOf = (player) => {
  const wt = WEAPON_TYPES[player.equipped?.arme?.weaponType];
  return wt ? wt.spell : UNARMED_SPELLS[0];
};

export const knownClassSpells = (player) => classSpellsAt(player.classKey, player.level);

// Ids des sorts de classe dans la barre, dans l'ordre : la préférence du joueur (si elle existe),
// complétée automatiquement par les sorts débloqués tant qu'il reste des emplacements libres.
export function loadoutOf(player) {
  const known = knownClassSpells(player).map((s) => s.id);
  const slots = classSlots(player.level);
  const out = [];
  for (const id of spellbookOf(player).loadout || []) if (known.includes(id) && !out.includes(id) && out.length < slots) out.push(id);
  for (const id of known) if (out.length < slots && !out.includes(id)) out.push(id);
  return out;
}

// La barre complète, prête pour le moteur de combat : sort d'arme puis sorts de classe, tous au bon rang
export function buildSpellBar(player) {
  const book = spellbookOf(player);
  const byId = Object.fromEntries(knownClassSpells(player).map((s) => [s.id, s]));
  const w = weaponSpellOf(player);
  return [rankSpell(w, rankOf(player, w.id)), ...loadoutOf(player).map((id) => rankSpell(byId[id], rankOf({ spellbook: book }, id)))];
}

// ------------------------------------------------------------
// Actions du joueur (renvoient un nouveau joueur, ou le même s'il ne se passe rien)
// ------------------------------------------------------------
export function rankUp(player, id) {
  const known = knownClassSpells(player).some((s) => s.id === id) || id === weaponSpellOf(player).id;
  if (!known) return player;
  const rank = rankOf(player, id);
  if (rank >= MAX_RANK || spellPointsLeft(player) < rankCost(rank)) return player;
  const book = spellbookOf(player);
  return { ...player, spellbook: { ...book, ranks: { ...book.ranks, [id]: rank + 1 } } };
}

// Met `id` dans l'emplacement `slot` (0 = premier sort de classe). S'il est déjà dans la barre, les deux sorts s'échangent.
export function equipSpell(player, slot, id) {
  const cur = loadoutOf(player);
  if (!knownClassSpells(player).some((s) => s.id === id) || slot < 0 || slot >= cur.length) return player;
  const next = [...cur];
  const from = next.indexOf(id);
  if (from >= 0) next[from] = next[slot];
  next[slot] = id;
  return { ...player, spellbook: { ...spellbookOf(player), loadout: next } };
}

// Remet tous les rangs à 1 contre de l'or (les points sont rendus)
export function resetRanks(player) {
  const cost = resetCost(player);
  if (!cost || player.gold < cost) return player;
  return { ...player, gold: player.gold - cost, spellbook: { ...spellbookOf(player), ranks: {} } };
}
