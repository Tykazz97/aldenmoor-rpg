// ============================================================
// Attaquer une sentinelle : le monstre qui la représente au combat, la rencontre, et ce qui se passe après (butin, disparition,
// protection). Sans React. Le combat lui-même est le combat normal (combat/engine.js) : la sentinelle est un monstre fabriqué
// au moment de l'attaque (ENEMY_EXTRA), de la force d'un héros du niveau de sa guilde.
// ============================================================
import { ENEMY_EXTRA } from "../data/zones.js";
import { SENT_BY_KEY } from "../data/sentinel.js";
import { makeBotPlayer } from "../sim/partyBots.js";
import { calcStats } from "./calcStats.js";
import { sharesOf, equippedSpells } from "./sentinelBuild.js";
import { ensureDefenderEnemy, defenderBots, allySpecOf, DEFENDERS_MAX } from "./sentinelDefense.js";

export const SENT_ROUNDS = 12;                 // tours de table à tenir pour que la défense gagne
export const SENT_SHIELD_MS = 60 * 60 * 1000;  // une sentinelle qui a tenu bon est intouchable pendant 1 h
export const SENT_IMG = "/assets/sentinel/golem.webp";

const BASE = new Map();
const heroStats = (level) => {
  const L = Math.max(1, Math.min(50, Math.round(level)));
  if (!BASE.has(L)) BASE.set(L, calcStats(makeBotPlayer("guerrier", L)));
  return BASE.get(L);
};

// Les caractéristiques de la sentinelle d'une guilde : celles d'un héros du niveau de la guilde (guerrier de référence), modulées par
// les points que la guilde a placés (part de chaque caractéristique dans le total possible, plafonnée à 60 %).
// À 20 % de points partout (le total réparti à parts égales) : 3,5 fois les PV et 70 % de l'attaque et de la défense d'un héros ;
// sans aucun point : 1,5 fois les PV, 30 % de l'attaque et de la défense.
export function sentinelStats(guild) {
  const h = heroStats(guild.level), f = sharesOf(guild);
  const atk = Math.round(h.atkPhys * (0.3 + 2 * f.force)), def = (base) => Math.round(base * (0.3 + 2 * f.defense));
  return {
    hp: Math.round(h.maxHp * (1.5 + 10 * f.vitalite)), atkPhys: atk, atkMagie: Math.round(atk * 0.8),
    defPhys: def(h.defPhys), defMagie: def(h.defMagie), esquive: Math.round(h.esquive * 0.5), critique: Math.round(h.critique * 0.5),
    vitesse: Math.max(1, Math.round(h.vitesse * (0.4 + 1.5 * f.vitesse))), pa: 6,
  };
}

// Fabrique le monstre de la sentinelle de cette guilde (une entrée par guilde, remise à jour à chaque attaque) ; renvoie sa clé
export function ensureSentinelEnemy(guild) {
  const key = `sentinelle_${guild.id}`;
  ENEMY_EXTRA[key] = {
    key, name: "Sentinelle", desc: "Un golem de pierre qui garde sa région pour une guilde.", stats: sentinelStats(guild), xp: 0,
    actions: equippedSpells(guild).map(({ id, name, pa, type, power, weight, effect, aoe, self }) => ({ id, name, pa, type, power, weight, effect, aoe, self })),
    gold: null, drops: [], img: SENT_IMG, spriteHeight: 320, extra: true,
  };
  return key;
}

// La rencontre à jouer (comme les autres rencontres, avec en plus `sentinel` : ce qui sert à régler l'issue). La sentinelle est toujours le
// premier ennemi (e0) : l'attaque est gagnée dès qu'elle tombe ; les défenseurs (bots de la guilde connectés, 3 au plus) la suivent.
export function sentinelEncounter(guild, region, defenders = []) {
  const key = ensureSentinelEnemy(guild);
  const defs = defenders.map((b) => ensureDefenderEnemy(b));
  return {
    id: `sentinelle:${region}`, name: `Sentinelle de ${guild.name}`, level: `Guilde niv. ${guild.level}`, enemies: [key, ...defs],
    banner: `Sentinelle de ${guild.name}`,
    desc: defs.length ? `Abats la sentinelle avant la fin du ${SENT_ROUNDS}e tour, malgré ses ${defs.length} défenseur${defs.length > 1 ? "s" : ""}.` : `Abats la sentinelle avant la fin du ${SENT_ROUNDS}e tour.`,
    sentinel: { region, gid: guild.id, maxRounds: SENT_ROUNDS, emblem: guild.emblem, defenders: defenders.map((b) => ({ id: b.id, name: b.name, classKey: b.classKey, level: b.level })) },
  };
}

// ---- défendre sa propre sentinelle ----
// La sentinelle devient l'alliée du joueur (même caractéristiques et mêmes sorts que lorsqu'on l'attaque) ; ses attaquants sont les ennemis.
export function sentinelAllySpec(guild) {
  const s = sentinelStats(guild);
  return {
    name: "Sentinelle", sentinel: true, level: guild.level, img: SENT_IMG, emblem: guild.emblem, gid: guild.id, weaponType: null, classKey: null, spells: [],
    stats: { maxHp: s.hp, atkPhys: s.atkPhys, atkMagie: s.atkMagie, defPhys: s.defPhys, defMagie: s.defMagie, esquive: s.esquive, critique: s.critique, vitesse: s.vitesse },
    actions: equippedSpells(guild).map(({ id, name, pa, type, power, weight, effect, aoe, self }) => ({ id, name, pa, type, power, weight, effect, aoe, self })),
  };
}

// Les alliés du joueur qui défend : la sentinelle d'abord, puis jusqu'à DEFENDERS_MAX - 1 membres connectés de la guilde (hors attaquants)
export function defenseAllies(guild, population, attackerIds = [], now = Date.now()) {
  const mates = defenderBots(guild, population, now).filter((b) => !attackerIds.includes(b.id)).slice(0, DEFENDERS_MAX - 1);
  return [sentinelAllySpec(guild), ...mates.map(allySpecOf)];
}

// La rencontre de défense : `attack` = { id, region, from, by }, `attackers` = leurs personnages (population vivante)
export function defenseEncounter(guild, attack, attackers, fromName = "une guilde") {
  const r = SENT_BY_KEY[attack.region];
  return {
    id: `defense:${attack.id}`, name: `Défense de ${r.name}`, level: `Guilde niv. ${guild.level}`,
    enemies: attackers.map((b) => ensureDefenderEnemy(b, "attaquant")),
    banner: "Défends ta sentinelle !",
    desc: `${fromName} attaque ta sentinelle. Tiens ${SENT_ROUNDS} tours ou abats tous les attaquants ; si la sentinelle tombe, tout son stock est perdu.`,
    defense: { region: attack.region, attackId: attack.id, maxRounds: SENT_ROUNDS, emblem: guild.emblem, gid: guild.id, from: fromName },
  };
}
