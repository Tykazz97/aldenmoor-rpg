// ============================================================
// SENTINELLES — un golem de pierre que la guilde pose dans une région. Il se comporte comme un joueur invisible de plus dans
// tous les combats de la région : il a son propre tirage de butin (or et ressources) et ne prend rien aux autres combattants.
// Son butin s'accumule dans son stock ; le chef ou le bras droit vient le relever (l'or va à la caisse, les ressources au coffre).
// (Données pures, rien d'autre ici.)
// ============================================================
import { ZONES } from "./zones.js";

// Part d'un tirage de joueur que la sentinelle gagne à chaque combat de sa région (or ET chances de drop) : à régler pour l'économie
export const SENT_LOOT_SHARE = 0.5;

// Régions qui peuvent recevoir une sentinelle (les donjons, non), avec le prix de pose (or de la caisse)
export const SENT_COSTS = [2000, 5000, 10000];
export const SENT_REGIONS = ZONES.aldenmoor.regions.map((r, i) => ({
  key: r.key, name: r.name, levels: r.levels, cost: SENT_COSTS[i] ?? SENT_COSTS[SENT_COSTS.length - 1],
  enemies: [...r.enemies, r.miniBoss].filter(Boolean),
}));
export const SENT_BY_KEY = Object.fromEntries(SENT_REGIONS.map((r) => [r.key, r]));
// La région d'un monstre (null : un monstre de donjon ou inconnu)
export const REGION_OF_ENEMY = {};
for (const r of SENT_REGIONS) for (const k of r.enemies) REGION_OF_ENEMY[k] = r.key;

// Nombre de sentinelles qu'une guilde peut tenir : 1, puis une de plus tous les 10 niveaux de guilde
export const sentinelSlots = (guildLevel) => 1 + Math.floor(Math.max(1, guildLevel) / 10);
// Le stock d'une sentinelle est limité (il faut venir le relever) : l'or, et chaque type de ressource
export const sentinelGoldCap = (guildLevel) => 1000 + 400 * Math.max(1, guildLevel);
export const sentinelResCap = (guildLevel) => 50 + 10 * Math.max(1, guildLevel);
