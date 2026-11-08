// ============================================================
// GUILDES — règles et chiffres (données pures, rien d'autre ici).
//
//   - 50 membres au maximum ; fonder une guilde coûte 10 000 or (payés par le fondateur) ;
//   - niveau de guilde de 1 à 50 : la guilde monte avec ses quêtes (progression commune de tous les membres) ;
//   - la caisse de la guilde (or) est alimentée par les dons des membres et les quêtes ; le chef s'en sert pour débloquer
//     les paliers de bonus et acheter les onglets du coffre ;
//   - 10 paliers de bonus, un tous les 5 niveaux de guilde : il faut le niveau ET payer l'or, dans l'ordre ;
//   - coffre de guilde : plusieurs onglets, achetés avec de l'or et un niveau de guilde minimum ; tout membre y dépose et y retire.
// ============================================================

export const GUILD_MAX_MEMBERS = 50;
export const GUILD_CREATE_COST = 10000;
export const GUILD_MAX_LEVEL = 50;
export const MAX_JOIN_LEVEL = 50;                 // niveau minimum le plus haut qu'une guilde puisse exiger (le niveau maximum d'un personnage)
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 24;

// xp de guilde pour passer du niveau `level` au suivant
export const guildXpToNext = (level) => 300 + 80 * level;

// ---- Paliers de bonus ----
// Chaque palier : niveau de guilde requis, prix (or de la caisse), et les bonus qu'il ajoute (en points de pourcentage) :
//   xp    = xp de personnage            mxp    = xp de métier (récolte, raffinage, fabrication)
//   drop  = butin des monstres          harv   = rendement de récolte (quantité en plus)
//   refine = rendement de raffinage et d'alchimie (chance d'une unité de plus)
//   craft  = chance de chef-d'œuvre en fabrication
export const BONUS_KEYS = ["xp", "mxp", "drop", "harv", "refine", "craft"];
export const BONUS_LABELS = {
  xp: "XP de personnage", mxp: "XP de métier", drop: "Butin des monstres",
  harv: "Rendement de récolte", refine: "Rendement de raffinage", craft: "Chances de chef-d'œuvre",
};
export const BONUS_ICONS = { xp: "✨", mxp: "📘", drop: "🎁", harv: "🌾", refine: "⚗️", craft: "🔨" };

export const PALIERS = [
  { n: 1, level: 5, cost: 3000, bonus: { xp: 2, mxp: 3 } },
  { n: 2, level: 10, cost: 10000, bonus: { harv: 3, drop: 2 } },
  { n: 3, level: 15, cost: 24000, bonus: { refine: 2, craft: 1 } },
  { n: 4, level: 20, cost: 45000, bonus: { xp: 2, mxp: 3 } },
  { n: 5, level: 25, cost: 75000, bonus: { harv: 4, drop: 2 } },
  { n: 6, level: 30, cost: 115000, bonus: { refine: 3, craft: 1 } },
  { n: 7, level: 35, cost: 165000, bonus: { xp: 2, mxp: 3 } },
  { n: 8, level: 40, cost: 225000, bonus: { harv: 4, drop: 2 } },
  { n: 9, level: 45, cost: 300000, bonus: { refine: 3, craft: 1 } },
  { n: 10, level: 50, cost: 400000, bonus: { xp: 2, mxp: 3, harv: 4, drop: 2, refine: 2, craft: 1 } },
];

// ---- Coffre de guilde : onglets ----
export const TAB_SLOTS = 30;                    // emplacements par onglet : un objet = 1, un type de ressource = 1 (quelle que soit la quantité)
export const TABS = [
  { n: 1, level: 1, cost: 0 },                  // le premier onglet est offert à la fondation
  { n: 2, level: 5, cost: 5000 },
  { n: 3, level: 10, cost: 20000 },
  { n: 4, level: 20, cost: 50000 },
  { n: 5, level: 30, cost: 120000 },
  { n: 6, level: 40, cost: 250000 },
];

// ---- Quêtes de guilde ----
// Trois quêtes en cours à la fois, de types différents. L'objectif grandit avec le nombre de membres et le niveau de la guilde ;
// toute l'activité des membres (depuis leur arrivée) compte. Terminée : xp de guilde + or dans la caisse, et une nouvelle quête arrive.
export const QUEST_SLOTS = 3;
export const QUEST_TYPES = {
  kills: { label: "Monstres vaincus", verb: "Vaincre", unit: "monstres", per: 14, xpPer: 1.1, goldPer: 1.2 },
  gathers: { label: "Ressources récoltées", verb: "Récolter", unit: "ressources", per: 36, xpPer: 0.45, goldPer: 0.5 },
  crafts: { label: "Objets fabriqués", verb: "Fabriquer", unit: "objets", per: 4, xpPer: 4.5, goldPer: 6 },
  gold: { label: "Dons à la caisse", verb: "Donner", unit: "or", per: 260, xpPer: 0.07, goldPer: 0 },
};
export const QUEST_LEVEL_GROWTH = 0.045;        // l'objectif grandit de 4,5 % par niveau de guilde
export const QUEST_MIN_MEMBERS = 4;             // en dessous, l'objectif est calculé comme pour 4 membres

// ---- Rangs ----
// chef (un seul), bras droit (un seul), officiers, recrues. Dépôt et dons : tous. Dépenser la caisse (paliers, onglets) et retirer du coffre : chef et bras droit.
// Exclure : chacun peut exclure les rangs en dessous du sien (le bras droit ne peut pas exclure le chef). Nommer : le chef nomme tout le monde ; le bras droit nomme les officiers.
export const RANKS = ["chef", "bras", "officier", "recrue"];
export const RANK_LABELS = { chef: "Chef", bras: "Bras droit", officier: "Officier", recrue: "Recrue" };
export const RANK_ICONS = { chef: "♛", bras: "⚔", officier: "★", recrue: "" };
export const RANK_POWER = { chef: 3, bras: 2, officier: 1, recrue: 0 };
export const CAN_SPEND = ["chef", "bras"];          // paliers, onglets du coffre
export const CAN_WITHDRAW = ["chef", "bras"];       // retirer du coffre

// ---- Journal ----
export const LOG_MAX = 30;

// ---- Simulés ----
export const SIM_FOUND_GOLD = 13000;            // un simulé fonde une guilde à partir de cet or (10 000 pour la fondation, le reste de réserve)
export const SIM_FOUND_MIN_LEVEL = 10;
export const SIM_DONATE_ABOVE = 3000;           // il donne une part de son or au-delà
export const SIM_DONATE_SHARE = 0.18;

// ---- Noms ----
export const NAME_FIRST = ["Les Corbeaux", "Les Loups", "Les Veilleurs", "Les Gardiens", "Les Brumes", "Les Lames", "La Compagnie", "L'Ordre", "Les Ombres", "Les Sentinelles", "Les Ronces", "Les Faucons", "La Confrérie", "La Garde", "Les Forgerons", "Les Lanternes", "Les Cendres", "Les Pèlerins", "Les Sangliers", "Les Aigles"];
export const NAME_LAST = ["de Cendre", "d'Aldenmoor", "du Crépuscule", "de la Lande", "d'Argent", "du Vieux Chêne", "de Fer", "de la Brume", "du Nord", "des Marais", "de l'Aube", "du Bois Noir", "d'Écarlate", "des Tourbières", "du Serment", "de la Dernière Lueur", "de Givre", "du Gué", "de l'Épine", "du Hameau"];
