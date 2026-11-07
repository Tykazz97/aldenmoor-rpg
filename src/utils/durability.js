// ============================================================
// Durabilité de l'équipement (sans React). Chaque pièce porte une usure `wear` (0 à 100, absente = neuve).
// - Elle ne monte qu'à la fin d'un combat difficile : +10 si le héros est descendu sous 25 % de ses PV (combat gagné de justesse),
//   +25 s'il a perdu. Un combat gagné proprement n'use rien. Les reliques et les clés ne s'usent pas.
// - Une pièce usée perd jusqu'à 30 % de ses bonus (à 100 % d'usure). Elle ne casse jamais, rien n'est perdu.
// - Réparer, en n'importe quelle ville (même raccourci que l'atelier) : 10 % de la valeur de la pièce à 100 % d'usure (5 % à moitié usée),
//   plus la taxe de la ville, qui va au registre `taxPaid` comme celle de l'atelier. Moitié prix si l'on sait fabriquer la pièce.
// Les chiffres sont réglés avec scripts/audit-global.js (l'or des simulés).
// ============================================================
import { ITEMS } from "../data/items.js";
import { getCraftInfo } from "../data/professions.js";
import { itemValue } from "./itemValue.js";
import { taxFee, recordTax } from "./cityTax.js";

export const WEAR_MAX_MALUS = 0.3;     // part des bonus perdue à 100 % d'usure
export const WEAR_CLOSE = 10;          // combat gagné de justesse
export const WEAR_DEFEAT = 25;         // combat perdu
export const CLOSE_HP = 0.25;          // « de justesse » : le héros est descendu sous cette part de ses PV
export const REPAIR_RATE = 0.1;        // de la valeur de la pièce, à 100 % d'usure
export const REPAIR_CRAFTER_DISCOUNT = 0.5;

// Une pièce s'use si elle occupe un emplacement d'équipement ordinaire (ni relique, ni clé)
export const isWearable = (item) => !!item && !!item.type && item.type !== "cle" && !item.type.startsWith("relique");

export const wearOf = (item) => (item && Number.isFinite(item.wear) ? Math.min(100, Math.max(0, item.wear)) : 0);
// Multiplicateur appliqué aux bonus d'une pièce : 1 si neuve, 0,7 si détruite
export const wearFactor = (item) => (isWearable(item) ? 1 - WEAR_MAX_MALUS * (wearOf(item) / 100) : 1);

export function wearLabel(w) {
  if (w <= 0) return "Neuf";
  if (w < 25) return "Éraflé";
  if (w < 60) return "Usé";
  if (w < 90) return "Très usé";
  return "Délabré";
}

// Usure causée par un combat : `end` = { victory, low, maxHp } (low = PV les plus bas du héros pendant le combat)
export function fightWear({ victory, low, maxHp }) {
  if (!victory) return WEAR_DEFEAT;
  return maxHp > 0 && low <= maxHp * CLOSE_HP ? WEAR_CLOSE : 0;
}

// Ajoute `amount` points d'usure à chaque pièce portée (plafonné à 100)
export function wearEquipped(player, amount) {
  if (!(amount > 0)) return player;
  const equipped = {};
  for (const [slot, item] of Object.entries(player.equipped || {})) {
    equipped[slot] = isWearable(item) ? { ...item, wear: Math.min(100, wearOf(item) + amount) } : item;
  }
  return { ...player, equipped };
}

// Coût de réparation d'une pièce : { base, tax, total } (0 partout si elle est neuve)
export function repairCost(item, player = null, opts = {}) {
  const w = wearOf(item);
  if (!isWearable(item) || w <= 0) return { base: 0, tax: 0, total: 0 };
  let base = Math.max(1, Math.round(itemValue(item.id) * REPAIR_RATE * (w / 100)));
  const info = getCraftInfo(item.id);
  if (info && player?.professions?.[info.profession]?.level >= info.minLevel) base = Math.max(1, Math.round(base * (1 - REPAIR_CRAFTER_DISCOUNT)));
  const tax = taxFee(base, opts.rate);
  return { base, tax, total: base + tax };
}

// Les pièces usées du joueur : portées d'abord, puis le sac
export function wornPieces(player) {
  const out = [];
  for (const [slot, item] of Object.entries(player.equipped || {})) if (isWearable(item) && wearOf(item) > 0) out.push({ where: "equipped", slot, item });
  for (const item of player.inventory || []) if (isWearable(item) && wearOf(item) > 0) out.push({ where: "inventory", slot: null, item });
  return out;
}

const mend = (item) => { const { wear, ...rest } = item; return rest; };       // enlève l'usure

// Répare une pièce (portée : `ref` = emplacement ; dans le sac : `ref` = uid). Renvoie { player, ok, cost, reason }
export function repair(player, ref, opts = {}) {
  const item = player.equipped?.[ref] ?? (player.inventory || []).find((i) => i.uid === ref);
  if (!item || !isWearable(item)) return { player, ok: false, cost: 0, reason: "Pièce introuvable" };
  const cost = repairCost(item, player, opts);
  if (cost.total <= 0) return { player, ok: false, cost: 0, reason: "Cette pièce est déjà neuve" };
  if (player.gold < cost.total) return { player, ok: false, cost: cost.total, reason: "Pas assez d'or" };
  let next = { ...player, gold: player.gold - cost.total };
  if (player.equipped?.[ref]) next.equipped = { ...player.equipped, [ref]: mend(item) };
  else next.inventory = player.inventory.map((i) => (i.uid === ref ? mend(i) : i));
  next = recordTax(next, opts.city, cost.tax);
  return { player: next, ok: true, cost: cost.total, reason: null };
}

// Répare tout ce qui est porté (et le sac) tant que l'or suffit, de la pièce la plus usée à la moins usée
export function repairAll(player, opts = {}) {
  let cur = player, spent = 0, count = 0;
  const pieces = wornPieces(player).sort((a, b) => wearOf(b.item) - wearOf(a.item));
  for (const { slot, item } of pieces) {
    const r = repair(cur, slot ?? item.uid, opts);
    if (r.ok) { cur = r.player; spent += r.cost; count++; }
  }
  return { player: cur, spent, count };
}

// Coût total pour tout réparer
export function repairAllCost(player, opts = {}) {
  return wornPieces(player).reduce((s, { item }) => s + repairCost(item, player, opts).total, 0);
}
