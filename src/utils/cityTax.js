// ============================================================
// Taxe de fabrication des villes (sans React). Plus de « coût de fabrication » fixe : fabriquer, raffiner ou distiller à l'atelier
// d'une ville coûte une TAXE, un pourcentage du prix de ce qu'on obtient (le prix moyen de l'objet fini : ses ingrédients plus sa
// main-d'œuvre, voir itemValue.js ; pour une matière raffinée ou une potion, sa valeur). Par défaut 1 % ; la guilde qui contrôlera
// la ville pourra la régler entre 0 % et 5 % (`world.cities[ville].taxRate`, voir data/cities.js). Au moins 1 or dès que la taxe n'est pas nulle.
// La taxe payée est inscrite au registre du joueur (`player.taxPaid[ville]`) : c'est ce que la guilde percevra plus tard.
// ============================================================
import { RESOURCES } from "../data/resources.js";
import { itemValue } from "./itemValue.js";

export const DEFAULT_TAX_RATE = 0.01;
export const TAX_MIN = 0;
export const TAX_MAX = 0.05;
export const clampTaxRate = (r) => (Number.isFinite(r) ? Math.min(TAX_MAX, Math.max(TAX_MIN, r)) : DEFAULT_TAX_RATE);

// Taxe sur une chose valant `value` or
export const taxFee = (value, rate = DEFAULT_TAX_RATE) => { const r = clampTaxRate(rate); return r > 0 ? Math.max(1, Math.round(value * r)) : 0; };
export const craftFee = (itemId, rate = DEFAULT_TAX_RATE) => taxFee(itemValue(itemId), rate);                 // un objet fabriqué
export const unitFee = (resourceId, rate = DEFAULT_TAX_RATE) => taxFee(RESOURCES[resourceId].value, rate);     // une unité raffinée ou une potion

// Inscrit `amount` or de taxe payée à la ville `cityKey` (le joueur inchangé s'il n'y a rien à inscrire)
export function recordTax(player, cityKey, amount) {
  if (!cityKey || !(amount > 0)) return player;
  return { ...player, taxPaid: { ...(player.taxPaid || {}), [cityKey]: ((player.taxPaid || {})[cityKey] || 0) + amount } };
}
