// ============================================================
// Coffre des joueurs simulés : le même que le tien (utils/bank.js : emplacements, agrandissements payants, emplacements
// offerts par la réputation d'Aldenmoor). `life.bank = { items: [idObjet...], resources: { id: quantité }, upgrades }`.
//   - il y range les ressources en trop de son sac (au-delà de 30 unités : il en garde 15 sur lui) et les équipements
//     de réserve (au-delà de 12 dans le sac), plutôt que de les brader ;
//   - il en sort ce qu'il lui manque pour fabriquer, pour une quête de livraison, ou avant d'aller acheter au marché ;
//   - il reprend une pièce rangée si elle vaut mieux que ce qu'il porte ;
//   - quand le coffre est plein, il l'agrandit s'il a deux fois le prix en poche.
// Sans React, testable.
// ============================================================
import { bankCapacity, bankUsed, nextUpgradeCost, BANK_START } from "../utils/bank.js";
import { gearScore, acquireItem } from "./lifeCraft.js";
import { ITEMS } from "../data/items.js";
import { RESOURCES } from "../data/resources.js";
import { SELL_RATE } from "./lifeCraft.js";

export const BAG_RES_DEPOSIT = 30;          // au-delà : le surplus part au coffre
export const BAG_RES_KEEP = 15;             // ce qu'il garde sur lui
export const BANK_SELL_KEEP = 150;          // au-delà, le trop-plein du coffre part à l'hôtel des ventes
export const BANK_MAX_PER_RES = 400;        // au-delà, il brade le reste au marchand (60 %) : l'hôtel des ventes ne peut pas tout absorber
export const BAG_ITEMS_KEEP = 12;           // équipements de réserve gardés sur lui

export const emptyBank = () => ({ items: [], resources: {}, upgrades: 0 });
export const bankOfLife = (life) => life.bank || (life.bank = emptyBank());
const asPlayer = (life) => ({ bank: bankOfLife(life), quests: life.quests });
export const bankFreeSlots = (life) => bankCapacity(asPlayer(life)) - bankUsed(asPlayer(life));
export const bankHas = (life, id) => (life.bank?.resources?.[id]) || 0;

// Ressources qu'il peut mettre en vente : son sac au-delà de `bagKeep`, plus le trop-plein de son coffre
export const bankSurplus = (life, id) => Math.max(0, bankHas(life, id) - BANK_SELL_KEEP);
export const sellableOf = (life, id, bagKeep) => Math.max(0, (life.bag.res[id] || 0) - bagKeep) + bankSurplus(life, id);
// Retire `qty` à vendre : d'abord le trop-plein du coffre, puis le sac
export function takeForSale(life, id, qty) {
  const fromBank = Math.min(qty, bankSurplus(life, id));
  if (fromBank > 0) { life.bank.resources[id] -= fromBank; if (life.bank.resources[id] <= 0) delete life.bank.resources[id]; }
  const rest = qty - fromBank;
  if (rest > 0) { life.bag.res[id] = (life.bag.res[id] || 0) - rest; if (life.bag.res[id] <= 0) delete life.bag.res[id]; }
}

// Sort du coffre ce qui manque (`want` : { ressource: quantité } ; modifié : il ne reste que ce que le coffre n'a pas)
export function drawFromBank(life, want) {
  const bank = life.bank;
  if (!bank) return want;
  for (const [id, need] of Object.entries(want)) {
    const take = Math.min(need, bank.resources[id] || 0);
    if (take < 1) continue;
    bank.resources[id] -= take;
    if (bank.resources[id] <= 0) delete bank.resources[id];
    life.bag.res[id] = (life.bag.res[id] || 0) + take;
    want[id] = need - take;
    if (want[id] <= 0) delete want[id];
  }
  return want;
}

// Range le surplus, reprend le meilleur équipement, agrandit au besoin
export function bankStep(life) {
  const bank = bankOfLife(life);
  for (const [id, q] of Object.entries(life.bag.res)) {
    if (q <= BAG_RES_DEPOSIT) continue;
    if (!(bank.resources[id] > 0) && bankFreeSlots(life) < 1) continue;
    bank.resources[id] = (bank.resources[id] || 0) + (q - BAG_RES_KEEP);
    life.bag.res[id] = BAG_RES_KEEP;
  }
  for (const [id, q] of Object.entries(bank.resources)) if (q > BANK_MAX_PER_RES) { life.gold += Math.floor((q - BANK_MAX_PER_RES) * RESOURCES[id].value * SELL_RATE); bank.resources[id] = BANK_MAX_PER_RES; }
  while (life.bag.items.length > BAG_ITEMS_KEEP && bankFreeSlots(life) >= 1) bank.items.push(life.bag.items.shift());
  for (let i = bank.items.length - 1; i >= 0; i--) {
    const id = bank.items[i], it = ITEMS[id];
    if (it && life.gear[it.type] && gearScore(id) > gearScore(life.gear[it.type])) { bank.items.splice(i, 1); acquireItem(life, id); }
  }
  const cost = nextUpgradeCost(asPlayer(life));
  if (cost !== null && bankFreeSlots(life) <= 1 && life.gold >= cost * 2) { life.gold -= cost; bank.upgrades = (bank.upgrades || 0) + 1; }
  return life;
}
export { BANK_START };
