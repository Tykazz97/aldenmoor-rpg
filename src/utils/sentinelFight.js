// ============================================================
// Attaquer une sentinelle : le monstre qui la représente au combat, la rencontre, et ce qui se passe après (butin, disparition,
// protection). Sans React. Le combat lui-même est le combat normal (combat/engine.js) : la sentinelle est un monstre fabriqué
// au moment de l'attaque (ENEMY_EXTRA), de la force d'un héros du niveau de sa guilde.
// ============================================================
import { ENEMY_EXTRA } from "../data/zones.js";
import { SENT_BY_KEY } from "../data/sentinel.js";
import { makeBotPlayer } from "../sim/partyBots.js";
import { calcStats } from "./calcStats.js";

export const SENT_STAT_SHARE = 0.7;           // attaque et défense : une part de celles d'un héros du niveau de la guilde
export const SENT_HP_MULT = 3.5;               // la sentinelle est seule : elle encaisse plus qu'un héros
export const SENT_ROUNDS = 12;                 // tours de table à tenir pour que la défense gagne
export const SENT_SHIELD_MS = 60 * 60 * 1000;  // une sentinelle qui a tenu bon est intouchable pendant 1 h
export const SENT_IMG = "/assets/sentinel/golem.png";

// Les sorts de base de la sentinelle (l'étape des sorts à acheter les remplacera)
export const SENT_BASE_SPELLS = [
  { id: "poing_de_pierre", name: "Poing de pierre", pa: 3, type: "phys", power: 1.0, weight: 3 },
  { id: "jet_de_roche", name: "Jet de roche", pa: 4, type: "phys", power: 1.3, weight: 2 },
  { id: "ecrasement", name: "Écrasement", pa: 5, type: "phys", power: 1.7, weight: 1 },
];

const BASE = new Map();
const heroStats = (level) => {
  const L = Math.max(1, Math.min(50, Math.round(level)));
  if (!BASE.has(L)) BASE.set(L, calcStats(makeBotPlayer("guerrier", L)));
  return BASE.get(L);
};

// Les caractéristiques de la sentinelle d'une guilde de ce niveau
export function sentinelStats(guildLevel) {
  const h = heroStats(guildLevel), k = SENT_STAT_SHARE;
  return {
    hp: Math.round(h.maxHp * SENT_HP_MULT), atkPhys: Math.round(h.atkPhys * k), atkMagie: 0,
    defPhys: Math.round(h.defPhys * k), defMagie: Math.round(h.defMagie * k),
    esquive: Math.round(h.esquive * k), critique: Math.round(h.critique * k), vitesse: Math.max(1, Math.round(h.vitesse * k)), pa: 6,
  };
}

// Fabrique (une fois par niveau et par jeu de sorts) le monstre de la sentinelle ; renvoie sa clé
export function ensureSentinelEnemy(guildLevel, spells = SENT_BASE_SPELLS) {
  const L = Math.max(1, Math.min(50, Math.round(guildLevel)));
  const key = `sentinelle_${L}`;
  ENEMY_EXTRA[key] = {
    key, name: "Sentinelle", desc: "Un golem de pierre qui garde sa région pour une guilde.", stats: sentinelStats(L), xp: 0,
    actions: spells.map((a) => ({ ...a })), gold: null, drops: [], img: SENT_IMG, spriteHeight: 320, extra: true,
  };
  return key;
}

// La rencontre à jouer (comme les autres rencontres, avec en plus `sentinel` : ce qui sert à régler l'issue)
export function sentinelEncounter(guild, region) {
  const r = SENT_BY_KEY[region];
  const key = ensureSentinelEnemy(guild.level);
  return {
    id: `sentinelle:${region}`, name: `Sentinelle de ${guild.name}`, level: `Guilde niv. ${guild.level}`, enemies: [key],
    banner: `Sentinelle de ${guild.name}`, desc: `Tue la sentinelle avant la fin du ${SENT_ROUNDS}e tour.`,
    sentinel: { region, gid: guild.id, maxRounds: SENT_ROUNDS, emblem: guild.emblem },
  };
}
