// Valeur de revente de l'équipement (sans dépendance au marché : partagée par le marché, l'économie et les simulés)
import { RESOURCES } from "../data/resources.js";
import { RECIPES } from "../data/recipes.js";

export const ITEM_SELL_RATE = 0.6;             // valeur de revente d'un équipement (économie)

export function itemValue(id) {
  const rec = RECIPES[id];
  if (!rec) return 60;                                              // armes qui tombent directement
  return Object.entries(rec.ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, 0) + rec.gold;
}
export const itemSellPrice = (id) => Math.max(1, Math.floor(itemValue(id) * ITEM_SELL_RATE));   // ordre de grandeur pour l'économie
