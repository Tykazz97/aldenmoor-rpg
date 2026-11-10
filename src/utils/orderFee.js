// ============================================================
// Base des commandes d'artisanat (sans React, sans dépendance vers le monde des simulés) : salaire de référence d'une pièce,
// ce qu'il faut pour la commander, et savoir si un artisan simulé a le niveau. Utilisé par orders.js et workshop.js.
// ============================================================
import { RECIPES } from "../data/recipes.js";
import { RESOURCES } from "../data/resources.js";
import { getCraftInfo } from "../data/professions.js";
import { hashString } from "../sim/rng.js";

export const hash01 = (s) => hashString(s) / 4294967296;
const FEE_MATS = 0.10, FEE_LABOR = 0.35, MIN_FEE = 8;

// Salaire de référence d'une pièce : une part de ses ingrédients et de sa main-d'œuvre (la recette)
export function orderFeeBase(itemId) {
  const rec = RECIPES[itemId];
  if (!rec) return 0;
  const mats = Object.entries(rec.ingredients).reduce((n, [r, q]) => n + RESOURCES[r].value * q, 0);
  return Math.max(MIN_FEE, Math.round(FEE_MATS * mats + FEE_LABOR * rec.gold));
}
// Ce qu'il faut pour commander cette pièce : { profession, minLevel, mats, fee }, ou null si on ne la fabrique pas
export function orderInfo(itemId) {
  const info = getCraftInfo(itemId), rec = RECIPES[itemId];
  if (!info || !rec) return null;
  return { profession: info.profession, minLevel: info.minLevel, mats: { ...rec.ingredients }, fee: orderFeeBase(itemId) };
}
// Un artisan simulé (niveau du métier) peut-il fabriquer cette pièce ?
export const levelOf = (life, profession) => (life.prof.key === profession ? life.prof.level : life.pro?.[profession]?.level ?? 1);
export const simCanCraft = (life, itemId) => { const i = getCraftInfo(itemId); return !!i && levelOf(life, i.profession) >= i.minLevel; };
// Le salaire minimum qu'un artisan simulé accepte (de 80 à 120 % du salaire de référence, selon son caractère)
export const wageMin = (crafterId, itemId) => orderFeeBase(itemId) * (0.8 + 0.4 * hash01(`${crafterId}:wage`));

