// ============================================================
// Les simulés améliorent leur équipement (règles de utils/upgrade.js : +1 à +3, éclats, ressource rare de leur classe, or + taxe).
// `life.upg = { emplacement: niveau }` : l'amélioration reste sur la pièce, elle disparaît si la pièce est remplacée (lifeCraft.acquireItem).
// Ordre : d'abord +1 sur toutes les pièces (arme, plastron…), puis +2, puis +3. Les éclats tombent des monstres ; la ressource rare de leur
// classe vient de leur récolte (si leur métier est le bon), sinon de l'hôtel des ventes (`upgradeShopping`). Sans React, testable.
// ============================================================
import { ITEMS } from "../data/items.js";
import { UPGRADE_MAX } from "../data/upgrade.js";
import { upgradeNeeds, isUpgradable } from "../utils/upgrade.js";
import { drawFromBank } from "./lifeBank.js";

export const UPGRADE_PRIORITY = ["arme", "plastron", "jambieres", "chapeau", "gants", "ceinture", "bouclier", "cape", "amulette", "anneau"];

export const plusOfSlot = (life, slot) => life.upg?.[slot] || 0;
// Niveau moyen d'amélioration de ses pièces, arrondi (0 à 3) : sert à estimer ses chances de victoire
export function plusBucket(life) {
  if (!life.upg) return 0;
  const slots = Object.entries(life.gear || {}).filter(([s, id]) => ITEMS[id] && isUpgradable(ITEMS[id]) && UPGRADE_PRIORITY.includes(s));
  if (!slots.length) return 0;
  return Math.min(UPGRADE_MAX, Math.round(slots.reduce((n, [s]) => n + plusOfSlot(life, s), 0) / slots.length));
}

// La prochaine pièce à améliorer : { slot, id, needs } ou null
export function nextUpgrade(life, bot) {
  for (let level = 0; level < UPGRADE_MAX; level++) {
    for (const slot of UPGRADE_PRIORITY) {
      const id = life.gear?.[slot];
      if (!id || !ITEMS[id] || plusOfSlot(life, slot) !== level) continue;
      const needs = upgradeNeeds({ id, type: slot, plus: level }, bot.classKey);
      if (needs) return { slot, id, needs };
    }
  }
  return null;
}

const have = (life, id) => (life.bag.res[id] || 0) + (life.bank?.resources?.[id] || 0);

// Ce qu'il doit acheter à l'hôtel des ventes pour sa prochaine amélioration : { ressource: quantité } (seulement s'il a l'or pour la payer)
export function upgradeShopping(life, bot) {
  const t = nextUpgrade(life, bot);
  if (!t || life.gold < t.needs.total) return {};
  const want = {};
  const lackShard = t.needs.shardQty - have(life, t.needs.shard), lackRare = t.needs.rare ? t.needs.rareQty - have(life, t.needs.rare) : 0;
  if (lackShard > 0) want[t.needs.shard] = lackShard;
  if (lackRare > 0) want[t.needs.rare] = lackRare;
  return want;
}

// À l'atelier : une amélioration si l'or, les éclats et la ressource rare sont là ; renvoie vrai s'il en a fait une
export function upgradeStep(life, bot) {
  const t = nextUpgrade(life, bot);
  if (!t || !t.needs.rare || life.gold < t.needs.total) return false;
  const n = t.needs;
  drawFromBank(life, { [n.shard]: Math.max(0, n.shardQty - (life.bag.res[n.shard] || 0)), [n.rare]: Math.max(0, n.rareQty - (life.bag.res[n.rare] || 0)) });
  if ((life.bag.res[n.shard] || 0) < n.shardQty || (life.bag.res[n.rare] || 0) < n.rareQty) return false;
  for (const [id, q] of [[n.shard, n.shardQty], [n.rare, n.rareQty]]) { life.bag.res[id] -= q; if (life.bag.res[id] <= 0) delete life.bag.res[id]; }
  life.gold -= n.total;
  (life.upg ||= {})[t.slot] = n.to;
  life.upgraded = (life.upgraded || 0) + 1;
  life.upgradeGold = (life.upgradeGold || 0) + n.total;       // or dépensé en améliorations (pour l'audit)
  return true;
}
