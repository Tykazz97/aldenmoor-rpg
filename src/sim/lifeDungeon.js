// ============================================================
// Les simulés au Manoir Englouti. Sans React, testable.
// Comme toi : il lui faut une clé (fabriquée par le Bricoleur, avec 3 Essences du Veilleur qu'il doit avoir gagnées lui-même),
// le niveau conseillé et deux amis (les deux autres classes). Il n'y va que si le VRAI moteur de combat lui donne assez de
// chances (botFight.js : classe, niveau, équipement et style de chacun, PV reportés d'une salle à l'autre). La clé est
// consommée à l'entrée. Les salles gagnées rapportent le butin du jeu (xp, or, ressources du donjon, relique à 0,5 %) ;
// une expédition qui échoue garde le butin des salles déjà gagnées. Il fait ensuite des pièces du palier 4 avec ce butin.
// `life.dj = { keys, last, runs, clears, fails, relics }`
// ============================================================
import { DUNGEONS } from "../data/dungeons.js";
import { ENEMIES } from "../data/zones.js";
import { RECIPES } from "../data/recipes.js";
import { CLASSES } from "../data/classes.js";
import { PARTY_DROP_MULT } from "../combat/engine.js";
import { dungeonOdds } from "./botFight.js";
import { craftOne } from "./lifeCraft.js";
import { drawFromBank } from "./lifeBank.js";
import { rollDrop } from "./lifeBoss.js";

export const DUNGEON = DUNGEONS.manoir_englouti;
export const DJ_COOLDOWN_STEPS = 288;              // au plus une expédition tous les 2 jours réels
export const DJ_MIN_CHANCE = 0.3;                  // il n'y va qu'avec au moins 30 % de chances d'en voir le bout
export const DJ_FRIENDS = 0.8;                     // chance de trouver deux amis libres
const KEY = DUNGEON.keyItem;

export const djOf = (life) => life.dj || (life.dj = { keys: 0, last: -1e9, runs: 0, clears: 0, fails: 0, relics: 0 });
const eligible = (life) => life.level >= DUNGEON.minLevel;

// Le rare (essence du Veilleur) doit venir de ses propres combats ; le reste (lingots, ectoplasme) s'achète.
const rareOf = (life) => Object.entries(RECIPES[KEY].ingredients).filter(([id]) => id === "essence_du_veilleur");
const haveRare = (life) => rareOf(life).every(([id, q]) => (life.bag.res[id] || 0) + (life.bank?.resources?.[id] || 0) >= q);

// Ce qu'il doit acheter à l'hôtel des ventes pour la clé : seulement quand il a déjà l'essence et le niveau, et pas de clé en poche
export function keyShopping(life) {
  const st = djOf(life);
  if (!eligible(life) || st.keys > 0 || !haveRare(life)) return {};
  const want = {};
  for (const [id, q] of Object.entries(RECIPES[KEY].ingredients)) {
    if (id === "essence_du_veilleur") continue;
    const need = q - (life.bag.res[id] || 0) - (life.bank?.resources?.[id] || 0);
    if (need > 0) want[id] = need;
  }
  return want;
}

// À l'atelier : il fabrique la clé s'il a tout (il sort du coffre ce qu'il faut) ; renvoie true s'il l'a faite
export function keyCraftStep(life, rng, { merchant = true } = {}) {
  const st = djOf(life);
  if (!eligible(life) || st.keys > 0 || !haveRare(life)) return false;
  drawFromBank(life, Object.fromEntries(Object.entries(RECIPES[KEY].ingredients).map(([id, q]) => [id, Math.max(0, q - (life.bag.res[id] || 0))])));
  if (!craftOne(life, KEY, rng, merchant)) return false;
  st.keys++;
  return true;
}

// Tente le donjon ; renvoie "clear" / "partial" / "fail" / null (rien tenté)
export function dungeonStep(life, bot, step, rng, { acquire, addXp, xpMult = 1 } = {}) {
  const st = djOf(life);
  if (!eligible(life) || st.keys < 1 || step - st.last < DJ_COOLDOWN_STEPS) return null;
  if (rng() >= DJ_FRIENDS) return null;
  const others = Object.keys(CLASSES).filter((c) => c !== bot.classKey);
  const odds = dungeonOdds(bot, life, DUNGEON, others);
  if (odds[odds.length - 1] < DJ_MIN_CHANCE) return null;       // trop faible : il attend de monter ou de mieux s'équiper
  st.keys--; st.last = step; st.runs++;
  // jusqu'où va-t-il ? tirage dans la répartition mesurée
  let r = rng(), rooms = 0;
  for (; rooms < odds.length - 1; rooms++) { r -= odds[rooms]; if (r < 0) break; }
  const cleared = rooms >= DUNGEON.rooms.length;
  let xp = 0, gold = 0;
  const get = (l, id) => { if (id === DUNGEON.relic) st.relics++; acquire(l, id); };      // la relique, si elle tombe, est comptée puis portée
  for (const room of DUNGEON.rooms.slice(0, rooms)) {
    for (const k of room.enemies) {
      const def = ENEMIES[k];
      xp += def.xp; gold += rng.int(def.gold[0], def.gold[1]);
      rollDrop(life, bot, def, PARTY_DROP_MULT[3], rng, get);
    }
  }
  life.gold += gold;
  addXp(life, Math.round(xp * xpMult));
  if (cleared) st.clears++; else st.fails++;
  return cleared ? "clear" : rooms > 0 ? "partial" : "fail";
}
