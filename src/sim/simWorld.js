// ============================================================
// Les joueurs simulés vus du jeu : leur monde (niveaux, équipement, sacs...) vit dans le marché du joueur (`player.market.sims`,
// voir utils/market.js) et avance avec lui. Ici : la liste « vivante » (avec les niveaux du moment) que consultent les compagnons,
// les cartes et la ville. Sans monde de simulés (marché abstrait ou sauvegarde neuve), on retombe sur la population de départ.
// ============================================================
import { getPopulation } from "./population.js";
import { liveBots } from "./lives.js";

let cacheSims = null, cacheList = null;

export function getLivePopulation(player) {
  const sims = player?.market?.sims;
  if (!sims || !sims.lives) return getPopulation();
  if (sims !== cacheSims) { cacheSims = sims; cacheList = liveBots(sims, getPopulation()); }
  return cacheList;
}
