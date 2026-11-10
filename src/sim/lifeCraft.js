// ============================================================
// Équipement, raffinage et fabrication des joueurs simulés. Sans React, testable.
//
// Un simulé fait comme un vrai joueur : il porte de l'équipement (`life.gear`, un id par emplacement), raffine ses
// matières brutes à l'atelier et fabrique les pièces de son palier avec les MÊMES règles que toi (applyRefine /
// applyCraft : niveau de métier, ressources, or, xp de métier). Il vise le set de son palier de niveau (partyBots.js),
// et quand son métier est trop bas il s'entraîne sur ce qu'il sait faire. Ce qu'il lui manque, il l'achète à un
// marchand (prix de base x1,3, plus cher pour les ressources rares) ; ses surplus de matières brutes sont revendus
// 60 % de leur valeur. (Les échanges avec les autres joueurs via l'hôtel des ventes viendront ensuite.)
// ============================================================
import { ITEMS, SETS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { RESOURCES } from "../data/resources.js";
import { REFINING } from "../data/refining.js";
import { CLASSES } from "../data/classes.js";
import { getCraftInfo, recipesOfProfession } from "../data/professions.js";
import { applyCraft, applyRefine, professionOf } from "../utils/crafting.js";
import { itemSellPrice } from "../utils/itemValue.js";
import { BUILDS, tierOf } from "./partyBots.js";
import { TIERS } from "../data/tiers.js";
import { orderFeeBase } from "../utils/orderFee.js";
import { UPGRADE_BONUS } from "../data/upgrade.js";
import { plusValueFactor } from "../utils/upgrade.js";

export const BAG_ITEMS_MAX = 24;                 // équipements gardés dans le sac (au-delà : revente du plus ancien)
export const BUY_RATE = 1.3;                     // le marchand vend à 130 % de la valeur de base
export const BUY_RARITY = { commune: 1, peu_commune: 1.25, rare: 1.8 };
export const SELL_RATE = 0.6;                    // et rachète à 60 %
export const STOCK_KEEP = 40;                    // au-delà de 40 unités d'une ressource, il revend le surplus au marchand de secours

// Valeur d'un équipement pour comparer deux pièces du même emplacement (somme de ses statistiques)
const NON_STAT = new Set(["tier", "craftLevel", "value"]);
const SCORES = new Map();
export function gearScore(id) {
  let s = SCORES.get(id);
  if (s === undefined) {
    const it = ITEMS[id];
    s = it ? Object.entries(it).reduce((sum, [k, v]) => (typeof v === "number" && !NON_STAT.has(k) ? sum + v : sum), 0) : -1;
    SCORES.set(id, s);
  }
  return s;
}

export function starterGear(classKey) {
  const c = CLASSES[classKey], g = {};
  for (const id of [c.startWeapon, ...c.startGear]) g[ITEMS[id].type] = id;
  return g;
}
export function targetPieces(classKey, tierIdx) {
  const t = BUILDS[classKey].tiers[tierIdx];
  return [t.weapon, ...SETS[t.set].pieces, ...(t.shield ? [t.shield] : [])];
}
// Les bijoux qu'un simulé vise en plus de son set (bijoutier : anneaux et amulettes d'apprentissage, les mêmes pour toutes les classes),
// du moins bon au meilleur : il les porte, les fabrique ou les commande comme le reste. Ils ne font pas partie de son équipement de
// départ (tierGear) : il doit les gagner.
export const JEWELS_BY_TIER = [["anneau_cuivre", "amulette_fer"], ["anneau_fer"], ["amulette_cuivre"], []];
export const wishPieces = (classKey, tierIdx) => [...targetPieces(classKey, tierIdx), ...(JEWELS_BY_TIER[tierIdx] || [])];
export function tierGear(classKey, level) {
  const g = {};
  for (const id of targetPieces(classKey, tierOf(level))) g[ITEMS[id].type] = id;
  return g;
}

// Garde un équipement dans le sac ; plafonné : le plus ancien est revendu
export function stash(life, id) {
  life.bag.items.push(id);
  while (life.bag.items.length > BAG_ITEMS_MAX) life.gold += itemSellPrice(life.bag.items.shift());
}
// Reçoit un équipement : il le porte s'il est meilleur que ce qu'il a (l'ancienne pièce va dans le sac), sinon il le garde
// Pièces améliorées à vendre (`life.plusStock`, au plus PLUS_STOCK_MAX) : elles gardent leur +N, à l'inverse du sac qui ne garde que des identifiants.
// Au-delà, la plus ancienne est cédée tout de suite au prix du marché (avec le supplément d'amélioration).
export const PLUS_STOCK_MAX = 4;
export function stashPlus(life, id, plus) {
  if (!(plus > 0)) return stash(life, id);
  const list = (life.plusStock ||= []);
  list.push({ id, plus });
  while (list.length > PLUS_STOCK_MAX) { const o = list.shift(); life.gold += Math.round(itemSellPrice(o.id) * plusValueFactor({ plus: o.plus })); }
}
// Score d'une pièce avec son niveau d'amélioration
export const scoreWithPlus = (id, plus = 0) => gearScore(id) * (1 + UPGRADE_BONUS * plus);

// `plus` : niveau d'amélioration de la pièce acquise (achetée déjà améliorée)
export function acquireItem(life, id, plus = 0) {
  const it = ITEMS[id];
  if (!it) return;
  const slot = it.type;
  const cur = life.gear[slot];
  const blocked = (slot === "bouclier" && ITEMS[life.gear.arme]?.twoHanded) || (slot === "arme" && it.twoHanded && life.gear.bouclier);
  if (slot in { chapeau: 1, cape: 1, plastron: 1, amulette: 1, gants: 1, ceinture: 1, anneau: 1, jambieres: 1, arme: 1, bouclier: 1, relique1: 1 } && !blocked && (!cur || scoreWithPlus(id, plus) > scoreWithPlus(cur, life.upg?.[slot] || 0))) {
    const curPlus = life.upg?.[slot] || 0;
    life.gear[slot] = id;
    if (plus > 0) (life.upg ||= {})[slot] = plus; else if (life.upg) delete life.upg[slot];
    if (cur) stashPlus(life, cur, curPlus);         // l'ancienne pièce garde son amélioration, pour la vendre
  } else stashPlus(life, id, plus);
}

// --- Fabrication ------------------------------------------------------------------------------------------------------
export const priceOf = (resId) => Math.ceil(RESOURCES[resId].value * BUY_RATE * (BUY_RARITY[RESOURCES[resId].rarity] || 1));

export const asPlayer = (life) => ({ gold: life.gold, resources: { ...life.bag.res }, inventory: [], professions: { ...life.pro, [life.prof.key]: life.prof }, quests: {}, gb: life.gb });

// Prépare les ingrédients de `itemId` sur la copie `p` : raffine ce qu'il peut, achète le reste. Renvoie la copie, ou null
function gather(p, itemId, rng, merchant = true) {
  const rec = RECIPES[itemId];
  for (const [resId, qty] of Object.entries(rec.ingredients)) {
    let need = qty - (p.resources[resId] || 0);
    if (need <= 0) continue;
    const ref = REFINING[resId];
    if (ref && professionOf(p, ref.profession).level >= ref.minLevel) {
      // raffinage : on rachète les matières brutes qui manquent, puis on raffine (les surplus de métier sont gardés)
      const times = need;
      for (const [raw, q] of Object.entries(ref.ingredients)) {
        const lack = q * times - (p.resources[raw] || 0);
        if (lack > 0) {
          if (!merchant) return null;                      // sans marchand : ce qui manque s'achète à l'hôtel des ventes (market.js)
          p.gold -= lack * priceOf(raw); p.resources[raw] = (p.resources[raw] || 0) + lack;
        }
      }
      if (p.gold < 0) return null;
      const r = applyRefine(p, resId, times, rng);
      if (!r.made) return null;
      p = r.player;
    } else {
      if (!merchant) return null;
      p.gold -= need * priceOf(resId);                   // ressource de monstre ou matière dont le raffinage lui est fermé
      p.resources[resId] = (p.resources[resId] || 0) + need;
    }
    if (p.gold < 0) return null;
  }
  return p;
}

// Le palier qu'il vise : celui de son niveau ; une fois le Manoir Englouti fini, il a de quoi viser le palier 4
export const tierFor = (life) => (life.dj?.clears > 0 && life.level >= TIERS[4].simFrom ? 3 : tierOf(life.level));

// Les pièces qu'il peut viser maintenant, dans l'ordre : manquantes de son palier (les moins chères d'abord), sinon de quoi
// entraîner le métier qui le bloque
function chooseTargets(life, bot) {
  const base = asPlayer(life);
  const can = (id) => { const info = getCraftInfo(id); return info && professionOf(base, info.profession).level >= info.minLevel; };
  const cost = (id) => Object.entries(RECIPES[id].ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, RECIPES[id].gold);
  const tier = tierFor(life);
  // 1) les pièces qui lui manquent, du palier visé vers les paliers plus bas, les moins chères d'abord
  let picks = [];
  for (let t = tier; t >= 0 && !picks.length; t--) {
    picks = wishPieces(bot.classKey, t).filter((id) => RECIPES[id] && can(id) && gearScore(id) > gearScore(life.gear[ITEMS[id].type] || "") && !life.bag.items.includes(id));
  }
  if (picks.length) return { base, picks: picks.sort((a, b) => cost(a) - cost(b)).slice(0, 3) };
  // 2) sinon il s'entraîne : les métiers qui le bloquent (niveau trop bas pour les pièces de son palier) montent en fabriquant
  //    ce qu'il sait faire, le plus d'xp pour le moins cher ; les objets en trop sont revendus avec le sac
  const blockers = new Set();
  for (const id of wishPieces(bot.classKey, tier)) {
    const info = getCraftInfo(id);
    if (info && RECIPES[id] && gearScore(id) > gearScore(life.gear[ITEMS[id].type] || "") && !can(id)) blockers.add(info.profession);
  }
  const pool = [...blockers].flatMap((pr) => recipesOfProfession(pr).filter((r) => can(r.itemId)).map((r) => r.itemId));
  return { base, picks: pool.sort((a, b) => RECIPES[b].gold / cost(b) - RECIPES[a].gold / cost(a)).slice(0, 3) };
}

// La pièce de son palier qu'il ne peut PAS fabriquer encore (niveau de métier trop bas) et qui le ferait progresser : c'est celle qu'il fait
// fabriquer par un artisan (commande d'artisanat, voir utils/orders.js). Les moins chères d'abord. Renvoie l'id ou null.
// `can(id)` : y a-t-il quelqu'un pour la fabriquer ? (un simulé ne commande pas une pièce que personne ne sait faire : il s'entraîne plutôt)
export function orderTarget(life, bot, can = () => true) {
  const base = asPlayer(life);
  const cost = (id) => Object.entries(RECIPES[id].ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, RECIPES[id].gold);
  const picks = wishPieces(bot.classKey, tierFor(life)).filter((id) => {
    const info = getCraftInfo(id);
    return RECIPES[id] && info && professionOf(base, info.profession).level < info.minLevel
      && gearScore(id) > gearScore(life.gear[ITEMS[id].type] || "") && !life.bag.items.includes(id) && can(id);
  });
  return picks.sort((a, b) => cost(a) - cost(b))[0] || null;
}
// Ce qu'il lui reste à acheter pour cette commande : { idRessource: quantité } (les ingrédients tels quels : l'artisan ne raffine pas pour lui)
export function orderShopping(life, bot, can = () => true) {
  const id = orderTarget(life, bot, can);
  if (!id) return {};
  const want = {};
  let price = 0;
  for (const [r, q] of Object.entries(RECIPES[id].ingredients)) { const need = q - (life.bag.res[r] || 0); if (need > 0) { want[r] = need; price += need * RESOURCES[r].value; } }
  // un simulé fauché n'achète pas d'ingrédients pour une commande qu'il ne pourrait pas payer : il continue de farmer et de fabriquer lui-même
  return life.gold >= price + Math.ceil(orderFeeBase(id)) ? want : {};
}

// Un essai de fabrication : le plus utile qu'il sache faire. Renvoie l'id fabriqué ou null.
// `merchant` : faux quand l'hôtel des ventes fournit les ingrédients (il n'achète alors rien au marchand de secours)
export function craftStep(life, bot, rng, { merchant = true } = {}) {
  const { base, picks } = chooseTargets(life, bot);
  return tryCraft(life, base, picks, rng, merchant);
}

// Fabrique UN objet précis (la clé d'un donjon, par exemple) avec ce qu'il a ; il ne l'équipe pas. Renvoie l'id ou null.
export function craftOne(life, itemId, rng, merchant = true) {
  return tryCraft(life, asPlayer(life), [itemId], rng, merchant, false);
}

// Ce qu'il lui faut acheter pour sa prochaine fabrication : { idRessource: quantité } (matières brutes quand il sait raffiner)
export function shoppingList(life, bot) {
  const { base, picks } = chooseTargets(life, bot);
  if (!picks.length) return {};
  const rec = RECIPES[picks[0]], want = {};
  for (const [resId, qty] of Object.entries(rec.ingredients)) {
    const need = qty - (life.bag.res[resId] || 0);
    if (need <= 0) continue;
    const ref = REFINING[resId];
    if (ref && professionOf(base, ref.profession).level >= ref.minLevel) {
      for (const [raw, q] of Object.entries(ref.ingredients)) { const lack = q * need - (life.bag.res[raw] || 0); if (lack > 0) want[raw] = (want[raw] || 0) + lack; }
    } else want[resId] = (want[resId] || 0) + need;
  }
  return want;
}

const bumpCraft = (life, id) => { const q = life.quests || (life.quests = { active: [], done: { day: -1, ids: [] }, rep: {}, chain: [], counters: { kills: {}, gathered: {}, crafted: {} } }); const c = q.counters || (q.counters = { kills: {}, gathered: {}, crafted: {} }); (c.crafted || (c.crafted = {}))[id] = ((c.crafted || {})[id] || 0) + 1; };

// Essaie de fabriquer l'une des pièces (ingrédients raffinés ou achetés au besoin) ; renvoie l'id fabriqué ou null
function tryCraft(life, base, picks, rng, merchant = true, equip = true) {
  for (const id of picks) {
    let p = gather({ ...base, resources: { ...base.resources } }, id, rng, merchant);
    if (!p) continue;
    const after = applyCraft(p, id, "sim", rng);
    if (after === p) continue;                            // impossible (or, niveau...) : applyCraft rend le même joueur
    life.gold = after.gold;
    life.bag.res = after.resources;
    const craftKeys = Object.keys(after.professions).filter((k) => k !== life.prof.key);
    life.pro = Object.fromEntries(craftKeys.map((k) => [k, after.professions[k]]));
    life.crafted = (life.crafted || 0) + 1;
    bumpCraft(life, id);
    if (equip) acquireItem(life, id);
    return id;
  }
  return null;
}

// Revend ce qui dépasse 40 unités d'une ressource (elles s'accumulent sinon sans fin)
export function sellSurplus(life, keep = STOCK_KEEP) {
  for (const [id, q] of Object.entries(life.bag.res)) {
    if (q <= keep) continue;
    life.gold += Math.floor((q - keep) * RESOURCES[id].value * SELL_RATE);
    life.bag.res[id] = keep;
  }
}
