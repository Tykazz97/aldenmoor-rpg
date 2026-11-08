// ============================================================
// Les simulés face aux mini-boss (Cavalier Déchu, Épouvantail Ancestral, Veilleur Corrompu). Sans React, testable.
// Un simulé assez haut niveau tente un boss au plus une fois par jour réel et par boss. Sa chance de victoire vient du VRAI
// moteur de combat (botFight.js : même classe, même niveau, même équipement et même style que lui), seul ou, s'il est faible, en
// groupe avec deux amis (le groupe gagne presque toujours, comme pour toi). Le butin est celui du jeu : xp et or du boss,
// ressources, armes uniques (5 %, celle de sa classe), avec les bonus de groupe et de solo du moteur. Chaque victoire compte
// pour ses quêtes de chasse, y compris la fin de la chaîne (le Veilleur).
// ============================================================
import { ENEMIES } from "../data/zones.js";
import { PARTY_DROP_MULT, SOLO_XP_MULT } from "../combat/engine.js";
import { CLASSES } from "../data/classes.js";
import { winChance } from "./botFight.js";
import { bump } from "./lifeQuests.js";

export const BOSSES = [
  { key: "cavalier_dechu", rec: 6 },
  { key: "epouvantail_ancestral", rec: 10 },
  { key: "veilleur_corrompu", rec: 18 },
];
export const BOSS_COOLDOWN_STEPS = 144;          // un jour réel : au plus un boss par jour et par simulé
export const BOSS_SOLO_OK = 0.75;                // en dessous, il cherche des amis
export const BOSS_MIN_CHANCE = 0.4;              // en dessous, seul, il renonce et attend de monter
export const FRIENDS_AVAILABLE = 0.7;            // chance de trouver deux amis disponibles

export const bossOf = (life) => life.boss || (life.boss = { last: {}, kills: {}, deaths: 0, groupKills: 0 });
export const reachableBosses = (life) => BOSSES.filter((b) => life.level >= b.rec);
export const rollDrop = (life, bot, def, mult0, rng, acquire) => {
  const mult = mult0 * (1 + (life.gb?.drop || 0) / 100);          // + butin de guilde
  for (const d of def.drops || []) {
    if (d.forClass && d.forClass !== bot.classKey) continue;
    if (rng() >= Math.min(1, d.fixed ? d.chance : d.chance * mult)) continue;
    const qty = rng.int(d.min, d.max);
    if (d.type === "resource") life.bag.res[d.id] = (life.bag.res[d.id] || 0) + qty;
    else for (let i = 0; i < qty; i++) acquire(life, d.id);
  }
};

// Tente un boss ; renvoie "win" / "lose" / null (rien tenté). `hunt` : l'ennemi de sa quête de chasse en cours.
export function bossStep(life, bot, step, rng, { hunt = null, acquire, addXp, xpMult = 1 } = {}) {
  const st = bossOf(life);
  if (step - (st.lastAny ?? -1e9) < BOSS_COOLDOWN_STEPS) return null;
  const ready = reachableBosses(life).filter((b) => step - (st.last[b.key] ?? -1e9) >= BOSS_COOLDOWN_STEPS);
  if (!ready.length) return null;
  const wanted = ready.find((b) => b.key === hunt);
  const boss = wanted || rng.weighted(ready.map((b) => [b, b.rec >= life.level - 8 ? 3 : 1]));
  const others = Object.keys(CLASSES).filter((c) => c !== bot.classKey);
  const pSolo = winChance(bot, life, [boss.key]);
  let group = false, p = pSolo;
  if (pSolo < BOSS_SOLO_OK) {
    if (rng() < FRIENDS_AVAILABLE) { group = true; p = winChance(bot, life, [boss.key], others); }
    else if (pSolo < BOSS_MIN_CHANCE) return null;
  }
  st.last[boss.key] = step; st.lastAny = step;
  if (rng() >= p) { st.deaths++; return "lose"; }
  const def = ENEMIES[boss.key];
  st.kills[boss.key] = (st.kills[boss.key] || 0) + 1;
  if (group) st.groupKills++;
  bump(life, "kills", boss.key);
  life.kills += 1;
  life.gold += rng.int(def.gold[0], def.gold[1]);
  addXp(life, Math.round(def.xp * (group ? 1 : SOLO_XP_MULT) * xpMult));
  rollDrop(life, bot, def, group ? PARTY_DROP_MULT[3] : 1, rng, acquire);
  return "win";
}
