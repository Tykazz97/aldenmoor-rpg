// ============================================================
// LES PALIERS D'ÉQUIPEMENT : un seul tableau pour tout ce qui dépend du palier.
//   craftBase  : niveaux de métier ajoutés au niveau de base de l'emplacement (gants/ceinture 1, chapeau/jambières/arme/bouclier 2,
//                plastron 3) pour fabriquer une pièce du palier (professions.js) ; palier 4 : niveaux 28 à 30.
//   equipLevel : niveau du héros pour porter la pièce (utils/equipReq.js).
//   simFrom    : niveau à partir duquel un simulé vise ce palier (sim/partyBots.js : tierOf ; le palier 4 demande en plus d'avoir
//                fini le Manoir Englouti, voir lifeCraft.tierFor).
// Pour ajouter un palier (nouveaux sets) : une ligne ici, puis les objets avec `tier: N`. Le test scripts/test-tiers.js vérifie
// que les trois réglages restent cohérents entre eux.
// ============================================================
export const TIERS = {
  1: { craftBase: 0, equipLevel: 1, simFrom: 1 },
  2: { craftBase: 7, equipLevel: 8, simFrom: 10 },
  3: { craftBase: 16, equipLevel: 14, simFrom: 16 },
  4: { craftBase: 27, equipLevel: 20, simFrom: 20 },
};
export const TIER_KEYS = Object.keys(TIERS).map(Number).sort((a, b) => a - b);
export const craftBaseOf = (tier) => TIERS[tier || 1]?.craftBase ?? 0;
export const equipLevelOfTier = (tier) => TIERS[tier || 1]?.equipLevel ?? 1;
