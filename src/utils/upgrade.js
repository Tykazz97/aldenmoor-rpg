// ============================================================
// Amélioration de l'équipement (sans React) : +1 à +3, +10 % de stats par niveau, voir data/upgrade.js.
// Le niveau est écrit sur la pièce (`item.plus`, absent = 0) ; une pièce qu'on remplace emporte son amélioration avec elle.
// Coût d'un niveau : des éclats (zone, boss, donjon), la ressource rare de ta CLASSE (minerai, plantes ou arbres) et de l'or
// (valeur de la pièce × un multiple, plus la taxe de la ville, inscrite au registre `taxPaid`).
// ============================================================
import { UPGRADE_MAX, UPGRADE_BONUS, UPGRADE_STEPS, CLASS_RARE, UPGRADE_VALUE_RATE } from "../data/upgrade.js";
import { itemValue } from "./itemValue.js";
import { taxFee, recordTax } from "./cityTax.js";

// Une pièce s'améliore si elle occupe un emplacement d'équipement ordinaire (ni relique, ni clé)
export const isUpgradable = (item) => !!item && !!item.type && item.type !== "cle" && !item.type.startsWith("relique");
export const plusOf = (item) => (item && Number.isFinite(item.plus) ? Math.min(UPGRADE_MAX, Math.max(0, Math.floor(item.plus))) : 0);
export const plusFactor = (item) => (isUpgradable(item) ? 1 + UPGRADE_BONUS * plusOf(item) : 1);
export const itemLabel = (item) => (plusOf(item) > 0 ? `${item.name} +${plusOf(item)}` : item.name);
// Valeur de revente d'une pièce améliorée : + 50 % de sa valeur par niveau
export const plusValueFactor = (item) => 1 + UPGRADE_VALUE_RATE * plusOf(item);

// Ce que coûte le prochain niveau de `item` pour un joueur de la classe `classKey` : null si la pièce n'est pas améliorable ou déjà au maximum
export function upgradeNeeds(item, classKey, opts = {}) {
  if (!isUpgradable(item) || plusOf(item) >= UPGRADE_MAX) return null;
  const step = UPGRADE_STEPS[plusOf(item)];
  const base = Math.max(1, Math.round(itemValue(item.id) * step.goldRate));
  const tax = taxFee(base, opts.rate);
  return { to: plusOf(item) + 1, shard: step.shard, shardQty: step.shardQty, rare: CLASS_RARE[classKey] || null, rareQty: step.rareQty, gold: base, tax, total: base + tax };
}

// La pièce visée : portée (`ref` = emplacement) ou dans le sac (`ref` = uid)
const find = (player, ref) => {
  if (player.equipped?.[ref]) return { item: player.equipped[ref], slot: ref };
  const item = (player.inventory || []).find((i) => i.uid === ref);
  return item ? { item, slot: null } : null;
};

// Peut-on améliorer ? { ok, needs, lacks: { gold, shard, rare }, reason }
export function canUpgrade(player, ref, opts = {}) {
  const f = find(player, ref);
  if (!f) return { ok: false, reason: "Pièce introuvable", needs: null };
  if (!isUpgradable(f.item)) return { ok: false, reason: "Cette pièce ne s'améliore pas", needs: null };
  const needs = upgradeNeeds(f.item, player.classKey, opts);
  if (!needs) return { ok: false, reason: "Déjà au maximum (+3)", needs: null };
  const res = player.resources || {};
  const lacks = { gold: player.gold < needs.total, shard: (res[needs.shard] || 0) < needs.shardQty, rare: !needs.rare || (res[needs.rare] || 0) < needs.rareQty };
  const ok = !lacks.gold && !lacks.shard && !lacks.rare;
  return { ok, needs, lacks, reason: ok ? null : lacks.shard || lacks.rare ? "Ressources manquantes" : "Or insuffisant" };
}

// Améliore d'un niveau : paie, retire les ressources, inscrit la taxe. Sans effet (même joueur) si c'est impossible.
export function applyUpgrade(player, ref, opts = {}) {
  const c = canUpgrade(player, ref, opts);
  if (!c.ok) return { player, ok: false, reason: c.reason, needs: c.needs };
  const f = find(player, ref), n = c.needs;
  const resources = { ...player.resources, [n.shard]: player.resources[n.shard] - n.shardQty, [n.rare]: player.resources[n.rare] - n.rareQty };
  for (const k of [n.shard, n.rare]) if (resources[k] <= 0) delete resources[k];
  const up = { ...f.item, plus: n.to };
  let next = { ...player, gold: player.gold - n.total, resources };
  if (f.slot) next.equipped = { ...player.equipped, [f.slot]: up };
  else next.inventory = player.inventory.map((i) => (i.uid === ref ? up : i));
  next = recordTax(next, opts.city, n.tax);
  return { player: next, ok: true, reason: null, needs: n, item: up };
}

// Les pièces qu'on peut améliorer (portées d'abord, puis le sac) : [{ ref, item, slot }]
export function upgradablePieces(player) {
  const out = [];
  for (const [slot, item] of Object.entries(player.equipped || {})) if (isUpgradable(item)) out.push({ ref: slot, item, slot });
  for (const item of player.inventory || []) if (isUpgradable(item)) out.push({ ref: item.uid, item, slot: null });
  return out;
}
