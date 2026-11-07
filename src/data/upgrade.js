// ============================================================
// AMÉLIORATION de l'équipement : +1, +2, +3, chacun ajoute 10 % aux stats de la pièce (voir utils/upgrade.js).
// Chaque niveau coûte, à l'atelier de la ville :
//   - des ÉCLATS, selon le contenu : zone (+1), boss (+2), donjon (+3) ;
//   - la ressource RARE de sa classe, trouvée en récoltant : minerai (guerrier), plantes (magicien), arbres (assassin) ;
//   - de l'or : un multiple de la valeur de la pièce, plus la taxe de la ville.
// L'amélioration reste attachée à la pièce, sans chance d'échec.
// ============================================================
export const UPGRADE_MAX = 3;
export const UPGRADE_BONUS = 0.1;                      // +10 % de stats par niveau

// Ressource rare de chaque classe, et métier de récolte qui la fait trouver
export const CLASS_RARE = { guerrier: "veine_d_acier", magicien: "petale_d_ame", assassin: "seve_d_ambre" };
export const RARE_PROFESSION = { veine_d_acier: "mineur", petale_d_ame: "herboriste", seve_d_ambre: "bucheron" };
export const RARE_OF_PROFESSION = { mineur: "veine_d_acier", herboriste: "petale_d_ame", bucheron: "seve_d_ambre" };
export const RARE_FIND_BASE = 0.06;                    // chance de trouver la ressource rare à chaque récolte, au niveau 1 du métier…
export const RARE_FIND_PER_FIND = 0.7;                 // …plus cette part de la « trouvaille » du métier (jusqu'à 0,06 + 0,7 × 0,20 = 20 % au niveau 100)

export const SHARD_IDS = ["eclat_brut", "eclat_dense", "eclat_pur"];
// Un palier par niveau d'amélioration : [niveau obtenu − 1]
export const UPGRADE_STEPS = [
  { shard: "eclat_brut", shardQty: 3, rareQty: 1, goldRate: 3 },     // +1 : éclats de zone
  { shard: "eclat_dense", shardQty: 1, rareQty: 2, goldRate: 8 },      // +2 : éclats de boss
  { shard: "eclat_pur", shardQty: 2, rareQty: 3, goldRate: 20 },       // +3 : éclats de donjon
];
// Valeur de revente d'une pièce améliorée : + 50 % de sa valeur par niveau
export const UPGRADE_VALUE_RATE = 0.5;
