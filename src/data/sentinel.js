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

// ---- La sentinelle comme un personnage de la guilde ----
// Chaque niveau de guilde donne 3 points de caractéristiques (comme un joueur), que le chef et le bras droit répartissent.
// Tous les points comptent en part du total possible (niveau × 3) : une sentinelle de niveau 5 qui a tout mis en vitalité est aussi
// « pleine de PV » qu'une de niveau 40. Points non placés = sentinelle plus faible.
export const SENT_POINTS_PER_LEVEL = 3;
export const SENT_STATS = [
  { key: "vitalite", label: "Vitalité", desc: "Points de vie" },
  { key: "force", label: "Force", desc: "Dégâts de ses attaques" },
  { key: "defense", label: "Défense", desc: "Réduit les dégâts reçus (physiques et magiques)" },
  { key: "vitesse", label: "Vitesse", desc: "Initiative : joue plus tôt dans le tour" },
  { key: "chance", label: "Chance", desc: "Butin : sa part du tirage de chaque combat de la région" },
];
export const SENT_STAT_KEYS = SENT_STATS.map((s) => s.key);
export const SENT_RESET_COST_PER_LEVEL = 100;             // remettre les points à zéro coûte 100 or par niveau de guilde (caisse)
export const SENT_MAX_SPELLS = 3;
export const SENT_REF_POINTS = 60;                         // points de référence (niveau de guilde 20) : en dessous, chaque point pèse moins qu'une part du total
export const SENT_STAT_CAP = 0.6;                         // une caractéristique ne peut recevoir plus de 60 % des points

// Les sorts : un de départ, puis un tous les 5 niveaux de guilde (les plus forts à la fin) ; 3 équipés au maximum.
// Chaque sort est une « action » du moteur de combat (combat/engine.js) : { pa, type, power, effect, aoe, self }.
export const SENT_SPELLS = [
  { id: "poing_de_pierre", level: 1, name: "Poing de pierre", desc: "Un coup physique simple.", pa: 3, type: "phys", power: 1.0, weight: 3 },
  { id: "peau_de_granit", level: 5, name: "Peau de granit", desc: "Soutien : +30 % de défense pendant 2 tours.", pa: 2, weight: 2, self: { effect: { kind: "armor", turns: 2, value: 0.3 } } },
  { id: "brise_garde", level: 10, name: "Brise-garde", desc: "Attaque qui baisse la défense de la cible de 20 % pendant 2 tours.", pa: 4, type: "phys", power: 0.9, weight: 2, effect: { kind: "defDown", turns: 2, value: 0.2 } },
  { id: "mousse_vivante", level: 15, name: "Mousse vivante", desc: "Soutien : se soigne de 6 % de ses PV à chaque tour, 3 tours.", pa: 3, weight: 2, self: { effect: { kind: "hot", turns: 3, value: 0.06 } } },
  { id: "ecrasement", level: 20, name: "Écrasement", desc: "Un gros coup physique.", pa: 5, type: "phys", power: 1.7, weight: 2 },
  { id: "regard_de_pierre", level: 25, name: "Regard de pierre", desc: "Dégâts magiques ; la cible perd 1 PA à son prochain tour.", pa: 4, type: "mag", power: 1.0, weight: 2, effect: { kind: "paLoss", value: 1 } },
  { id: "secousse", level: 30, name: "Secousse", desc: "Frappe tous les attaquants à la fois.", pa: 5, type: "phys", power: 0.9, aoe: true, weight: 2 },
  { id: "bouclier_de_roche", level: 35, name: "Bouclier de roche", desc: "Soutien : absorbe des dégâts à hauteur de 25 % de ses PV max, 3 tours.", pa: 3, weight: 2, self: { effect: { kind: "shield", turns: 3, value: 0.25 } } },
  { id: "carapace", level: 40, name: "Carapace", desc: "Soutien : se soigne de 20 % de ses PV max.", pa: 4, weight: 2, self: { heal: 0.2 } },
  { id: "rempart", level: 45, name: "Rempart", desc: "Soutien : −40 % de dégâts reçus pendant 2 tours.", pa: 3, weight: 2, self: { effect: { kind: "reduce", turns: 2, value: 0.4 } } },
  { id: "colere_du_monolithe", level: 50, name: "Colère du Monolithe", desc: "Le plus gros coup de la sentinelle ; la cible perd 1 PA.", pa: 6, type: "phys", power: 2.6, weight: 3, effect: { kind: "paLoss", value: 1 } },
];
export const SENT_SPELL_BY_ID = Object.fromEntries(SENT_SPELLS.map((s) => [s.id, s]));
