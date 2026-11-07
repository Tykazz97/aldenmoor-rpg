// ============================================================
// Coffre d'Aldenmoor : rangement d'objets et de ressources (sans React).
// player.bank = { items: [objet...], resources: { idRessource: quantité } }
// Les saves plus anciennes n'ont pas de coffre : on en crée un vide à la volée.
//
// Le coffre a une CAPACITÉ en emplacements : un objet = 1 emplacement, un type de ressource = 1 emplacement
// (quelle que soit la quantité). Il s'agrandit contre de l'or : c'est une des dépenses d'or du jeu.
// bank.upgrades = nombre d'agrandissements achetés (absent = 0).
// ============================================================
import { perksOf } from "./quests.js";

export const BANK_START = 20;                                           // emplacements au départ
export const BANK_STEP = 10;                                            // emplacements gagnés par agrandissement
export const BANK_UPGRADES = [100, 250, 500, 1000, 1800, 3000, 5000, 9000];   // prix de chaque agrandissement, dans l'ordre

export const emptyBank = () => ({ items: [], resources: {} });
export const bankOf = (player) => player.bank || emptyBank();

export const bankUpgrades = (player) => bankOf(player).upgrades || 0;
export const bankCapacity = (player) => BANK_START + BANK_STEP * bankUpgrades(player) + perksOf(player).bankSlots;   // + emplacements offerts par la réputation d'Aldenmoor
export const bankUsed = (player) => { const b = bankOf(player); return b.items.length + Object.keys(b.resources).length; };
export const bankFree = (player) => bankCapacity(player) - bankUsed(player);
export const nextUpgradeCost = (player) => BANK_UPGRADES[bankUpgrades(player)] ?? null;   // null = taille maximale

export function upgradeBank(player) {
  const cost = nextUpgradeCost(player);
  if (cost === null || player.gold < cost) return player;
  return { ...player, gold: player.gold - cost, bank: { ...bankOf(player), upgrades: bankUpgrades(player) + 1 } };
}

export function depositItem(player, uid) {
  const item = player.inventory.find((i) => i.uid === uid);
  if (!item || bankFree(player) < 1) return player;                    // coffre plein
  const bank = bankOf(player);
  return { ...player, inventory: player.inventory.filter((i) => i.uid !== uid), bank: { ...bank, items: [...bank.items, item] } };
}

export function withdrawItem(player, uid) {
  const bank = bankOf(player);
  const item = bank.items.find((i) => i.uid === uid);
  if (!item) return player;
  return { ...player, inventory: [...player.inventory, item], bank: { ...bank, items: bank.items.filter((i) => i.uid !== uid) } };
}

// qty = nombre, ou Infinity pour « tout »
function moveResource(from, to, id, qty) {
  const n = Math.min(qty, from[id] || 0);
  if (!(n > 0)) return null;
  const nextFrom = { ...from, [id]: from[id] - n };
  if (nextFrom[id] <= 0) delete nextFrom[id];
  return { from: nextFrom, to: { ...to, [id]: (to[id] || 0) + n } };
}

export function depositResource(player, id, qty = 1) {
  const bank = bankOf(player);
  if (!(bank.resources[id] > 0) && bankFree(player) < 1) return player;   // un nouveau type de ressource a besoin d'un emplacement libre
  const r = moveResource(player.resources, bank.resources, id, qty);
  return r ? { ...player, resources: r.from, bank: { ...bank, resources: r.to } } : player;
}

export function withdrawResource(player, id, qty = 1) {
  const bank = bankOf(player);
  const r = moveResource(bank.resources, player.resources, id, qty);
  return r ? { ...player, resources: r.to, bank: { ...bank, resources: r.from } } : player;
}
