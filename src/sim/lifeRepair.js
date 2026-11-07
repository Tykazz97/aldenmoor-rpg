// ============================================================
// Usure et réparation de l'équipement des simulés (règles de utils/durability.js). Sans React, testable.
// Toutes leurs pièces s'usent ensemble (`life.wear`, 0 à 100) : elles subissent les mêmes combats, et ils réparent tout d'un coup.
// - Donjon : +10 par salle gagnée de justesse (mesuré par le moteur), +25 si l'expédition échoue.  Boss perdu : +25.
// - Zone : un petit risque, à chaque combat, de s'en sortir de justesse (+10).
// - Ils réparent en ville dès que l'usure atteint REPAIR_AT, ou avant un donjon, s'ils ont l'or (taxe de la ville comprise).
// ============================================================
import { repairCost, isWearable, WEAR_CLOSE, WEAR_DEFEAT } from "../utils/durability.js";
import { ITEMS } from "../data/items.js";
import { asPlayer } from "./lifeCraft.js";

export const ZONE_CLOSE_CHANCE = 0.04;       // par combat de zone : chance de gagner de justesse
export const REPAIR_AT = 35;                 // usure à partir de laquelle il passe à l'atelier
export const REPAIR_BEFORE_DUNGEON = 12;     // et avant une expédition, dès cette usure

export const wearOfLife = (life) => Math.min(100, Math.max(0, life.wear || 0));
export function wearLife(life, amount) { if (amount > 0) life.wear = Math.min(100, wearOfLife(life) + amount); return life; }
export const closeWear = () => WEAR_CLOSE;
export const defeatWear = () => WEAR_DEFEAT;

// Coût pour tout remettre à neuf
export function lifeRepairCost(life, opts = {}) {
  const w = wearOfLife(life);
  if (w <= 0) return 0;
  const p = asPlayer(life);
  let total = 0;
  for (const id of Object.values(life.gear || {})) {
    const base = ITEMS[id];
    if (base && isWearable(base)) total += repairCost({ ...base, wear: w }, p, opts).total;
  }
  return total;
}

// Répare tout si l'usure dépasse `at` et que l'or suffit ; renvoie l'or dépensé (0 sinon)
export function repairStep(life, at = REPAIR_AT, opts = {}) {
  if (wearOfLife(life) < at) return 0;
  const cost = lifeRepairCost(life, opts);
  if (cost <= 0 || life.gold < cost) return 0;
  life.gold -= cost; life.wear = 0;
  life.repaired = (life.repaired || 0) + cost;               // total dépensé en réparations (pour l'audit)
  return cost;
}
