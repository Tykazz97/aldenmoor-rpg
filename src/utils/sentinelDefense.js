// ============================================================
// Les défenseurs d'une sentinelle : jusqu'à 3 membres de la guilde, connectés à ce moment-là, qui combattent à ses côtés
// quand on l'attaque. Sans React. Un défenseur est un monstre fabriqué au moment du combat (ENEMY_EXTRA) à partir du
// personnage du simulé : ses vraies caractéristiques et ses sorts d'attaque, son apparence (retournée, il fait face aux héros).
// ============================================================
import { ENEMY_EXTRA } from "../data/zones.js";
import { botSpec, buildOf } from "../sim/partyBots.js";
import { isActive, STEP_MS } from "../sim/lives.js";
import { plusBucket } from "../sim/lifeUpgrade.js";
import { hashString } from "../sim/rng.js";
import { heroSpriteUrl } from "../data/heroSprites.js";

export const DEFENDERS_MAX = 3;
// Le niveau moyen d'amélioration (+0 à +3) des pièces d'un simulé : il compte dans ses caractéristiques de combat
export const plusOf = (bot) => (bot.life ? plusBucket(bot.life) : 0);
const SPRITE_H = 200;

// Les membres de la guilde (hors joueur) qui sont connectés à `now`, dans un ordre stable pour l'heure en cours, 3 au plus
export function defenderBots(guild, population, now = Date.now()) {
  const step = Math.floor(now / STEP_MS), hour = Math.floor(now / 3600_000);
  return (population || [])
    .filter((b) => guild.members && guild.members[b.id] && b.id !== "player" && isActive(b, step))
    .map((b) => ({ b, k: hashString(`def:${guild.id}:${hour}:${b.id}`) }))
    .sort((x, y) => x.k - y.k)
    .slice(0, DEFENDERS_MAX)
    .map((x) => x.b);
}

// Fabrique le monstre d'un défenseur ; renvoie sa clé
// `prefix` : « defenseur » (il se bat pour la sentinelle qu'on attaque) ou « attaquant » (il l'attaque, quand c'est le joueur qui défend)
export function ensureDefenderEnemy(bot, prefix = "defenseur") {
  const key = `${prefix}_${bot.id}`;
  const spec = botSpec(bot.classKey, bot.level, { name: bot.name, look: bot.look, gear: bot.life?.gear, style: buildOf(bot), plus: plusOf(bot) });
  const s = spec.stats;
  const actions = spec.spells.filter((x) => x.type !== "buff" && x.power > 0).map((x) => ({
    id: x.id, name: x.name || x.id, pa: x.pa, type: x.type, power: x.power, weight: x.aoe ? 1 : 2, effect: x.effect, aoe: !!x.aoe,
  }));
  ENEMY_EXTRA[key] = {
    key, name: bot.name, desc: `${bot.name}, niveau ${bot.level}, ${prefix === "defenseur" ? "défend la sentinelle" : "attaque la sentinelle"}.`, xp: 0, gold: null, drops: [],
    stats: { hp: s.maxHp, atkPhys: s.atkPhys, atkMagie: s.atkMagie, defPhys: s.defPhys, defMagie: s.defMagie, esquive: s.esquive, critique: s.critique, vitesse: s.vitesse, pa: s.paMax || 6 },
    actions, img: heroSpriteUrl(spec.look), flip: true, spriteHeight: SPRITE_H, extra: true, defender: true,
  };
  return key;
}

// Un membre simulé comme allié du joueur dans un combat (quand le joueur défend sa propre sentinelle)
export function allySpecOf(bot) {
  return botSpec(bot.classKey, bot.level, { name: bot.name, look: bot.look, gear: bot.life?.gear, style: buildOf(bot), plus: plusOf(bot) });
}
