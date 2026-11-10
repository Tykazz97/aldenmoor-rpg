// ============================================================
// Les simulés au Manoir Englouti. Sans React, testable.
// Comme toi : il lui faut une clé (fabriquée par le Bricoleur, avec 3 Essences du Veilleur qu'il doit avoir gagnées lui-même),
// le niveau conseillé et deux amis (les deux autres classes). Il n'y va que si le VRAI moteur de combat lui donne assez de
// chances (botFight.js : classe, niveau, équipement et style de chacun, PV reportés d'une salle à l'autre). La clé est
// consommée à l'entrée. Les salles gagnées rapportent le butin du jeu (xp, or, ressources du donjon, relique à 0,5 %) ;
// une expédition qui échoue garde le butin des salles déjà gagnées. Il fait ensuite des pièces du palier 4 avec ce butin.
// Il emporte les potions de son sac et les boit entre les salles (lifePotions.js) : elles changent ses chances et sortent du sac.
// `life.dj = { keys, last, runs, clears, fails, relics, potions (bues en tout) }`
// ============================================================
import { DUNGEONS } from "../data/dungeons.js";
import { ENEMIES } from "../data/zones.js";
import { RECIPES } from "../data/recipes.js";
import { CLASSES } from "../data/classes.js";
import { PARTY_DROP_MULT } from "../combat/engine.js";
import { dungeonOdds, kitOfBag } from "./botFight.js";
import { craftOne } from "./lifeCraft.js";
import { drawFromBank } from "./lifeBank.js";
import { rollDrop } from "./lifeBoss.js";

export const DUNGEON = DUNGEONS.manoir_englouti;
export const HARD_DUNGEON = DUNGEONS.manoir_englouti_difficile;
export const DJ_COOLDOWN_STEPS = 288;              // au plus une expédition tous les 2 jours réels
export const DJ_MIN_CHANCE = 0.3;                  // il n'y va qu'avec au moins 30 % de chances d'en voir le bout
export const DJ_FRIENDS = 0.8;                     // chance de trouver deux amis libres

// Deux donjons : le normal (`life.dj`) et le difficile (`life.djh`, même forme). Le rare de la clé doit venir de ses propres combats :
// l'essence du Veilleur pour le normal, l'essence de deuil (butin de la Dame) pour le difficile ; le reste (lingots, ectoplasme, larmes) s'achète.
const NEW_DJ = () => ({ keys: 0, last: -1e9, runs: 0, clears: 0, fails: 0, relics: 0 });
export const djOf = (life) => life.dj || (life.dj = NEW_DJ());
export const djhOf = (life) => life.djh || (life.djh = NEW_DJ());
const MODES = {
  normal: { dungeon: DUNGEON, rare: "essence_du_veilleur", state: djOf },
  hard: { dungeon: HARD_DUNGEON, rare: "essence_de_deuil", state: djhOf },
};
const MODES_ALL = [MODES.hard, MODES.normal];
const eligible = (life, m = MODES.normal) => life.level >= m.dungeon.minLevel;
const rareOf = (m) => Object.entries(RECIPES[m.dungeon.keyItem].ingredients).filter(([id]) => id === m.rare);
const haveRare = (life, m = MODES.normal) => rareOf(m).every(([id, q]) => (life.bag.res[id] || 0) + (life.bank?.resources?.[id] || 0) >= q);
// Il vise la clé difficile quand il a de quoi (niveau, équipement déjà solide : il a réussi le donjon normal et porte du palier 4)
const aimsHard = (life) => eligible(life, MODES.hard) && djOf(life).clears > 0;

// Ce qu'il doit acheter à l'hôtel des ventes pour la clé : seulement quand il a déjà l'essence et le niveau, et pas de clé en poche
export function keyShopping(life) {
  const want = {};
  for (const m of [MODES.hard, MODES.normal]) {
    if (m === MODES.hard && !aimsHard(life)) continue;
    const st = m.state(life);
    if (!eligible(life, m) || st.keys > 0 || !haveRare(life, m)) continue;
    for (const [id, q] of Object.entries(RECIPES[m.dungeon.keyItem].ingredients)) {
      if (id === m.rare) continue;
      const need = q - (life.bag.res[id] || 0) - (life.bank?.resources?.[id] || 0);
      if (need > 0) want[id] = (want[id] || 0) + need;
    }
    break;                                  // une seule clé à la fois : la difficile d'abord, sinon la normale
  }
  return want;
}

// À l'atelier : il fabrique la clé s'il a tout (il sort du coffre ce qu'il faut) ; renvoie true s'il l'a faite
export function keyCraftStep(life, rng, { merchant = true } = {}) {
  for (const m of [MODES.hard, MODES.normal]) {
    if (m === MODES.hard && !aimsHard(life)) continue;
    const st = m.state(life), key = m.dungeon.keyItem;
    if (!eligible(life, m) || st.keys > 0 || !haveRare(life, m)) continue;
    drawFromBank(life, Object.fromEntries(Object.entries(RECIPES[key].ingredients).map(([id, q]) => [id, Math.max(0, q - (life.bag.res[id] || 0))])));
    if (!craftOne(life, key, rng, merchant)) continue;
    st.keys++;
    return true;
  }
  return false;
}

// Tente le donjon ; renvoie "clear" / "partial" / "fail" / null (rien tenté)
export function dungeonStep(life, bot, step, rng, ctx = {}) {
  // la difficile d'abord s'il en a la clé ; si elle est trop dure pour lui, il retombe sur la normale
  if (MODES_ALL.every((m) => !eligible(life, m) || m.state(life).keys < 1 || step - Math.max(djOf(life).last, djhOf(life).last) < DJ_COOLDOWN_STEPS)) return null;
  if (rng() >= DJ_FRIENDS) return null;                         // une seule fois : s'il ne trouve pas deux amis libres, rien aujourd'hui
  for (const m of [MODES.hard, MODES.normal]) {
    const st = m.state(life);
    if (!eligible(life, m) || st.keys < 1 || step - Math.max(djOf(life).last, djhOf(life).last) < DJ_COOLDOWN_STEPS) continue;
    const r = runDungeon(life, bot, step, rng, ctx, m);
    if (r) return r;
  }
  return null;
}

function runDungeon(life, bot, step, rng, { acquire, addXp, xpMult = 1 } = {}, m) {
  const DUNGEON = m.dungeon, st = m.state(life);
  const others = Object.keys(CLASSES).filter((c) => c !== bot.classKey);
  const odds = dungeonOdds(bot, life, DUNGEON, others, kitOfBag(life.bag.res));      // avec les potions de son sac, qu'il boit entre les salles
  if (odds[odds.length - 1] < DJ_MIN_CHANCE) return null;       // trop faible : il attend de monter ou de mieux s'équiper
  st.keys--; st.last = step; st.runs++;
  for (const [id, avg] of Object.entries(odds.used || {})) {            // les potions bues pendant l'expédition (moyenne mesurée, arrondie au hasard) sortent de son sac
    const q = Math.min(life.bag.res[id] || 0, Math.floor(avg + rng()));
    if (q > 0) { life.bag.res[id] -= q; if (life.bag.res[id] <= 0) delete life.bag.res[id]; st.potions = (st.potions || 0) + q; }
  }
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
