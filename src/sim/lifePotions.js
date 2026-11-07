// ============================================================
// Les simulés et les potions. Sans React, testable.
// Un simulé qui s'intéresse au Manoir Englouti (niveau 20 passé, et une clé, une expédition déjà faite ou de l'essence du Veilleur)
// distille ses propres potions à l'atelier, avec les MÊMES règles que toi (applyBrew : niveau d'Alchimiste, herbes, or, xp du métier),
// pour avoir de quoi se soigner entre les salles : 3 potions de soin, 2 grandes potions, 1 élixir de rappel.
// Quand son niveau d'Alchimiste ne permet pas encore la potion visée, il s'entraîne sur la meilleure qu'il sait faire.
// Les herbes viennent de sa récolte, de l'hôtel des ventes (`potionShopping`) ou, à défaut, du marchand de secours.
// Les potions en trop (plus de 8) sont mises en vente à l'hôtel des ventes avec le reste de ses surplus : tu peux les lui acheter.
// ============================================================
import { ALCHEMY, ALCHEMY_ORDER } from "../data/alchemy.js";
import { DUNGEONS } from "../data/dungeons.js";
import { applyBrew, maxBrew, professionOf } from "../utils/crafting.js";
import { RESOURCES } from "../data/resources.js";
import { asPlayer, priceOf, SELL_RATE } from "./lifeCraft.js";

export const POTION_KIT = { potion_de_soin: 3, grande_potion_de_soin: 2, elixir_de_rappel: 1 };   // ce qu'il veut emporter
// Ce qu'il garde sur lui de chaque potion : sa trousse (et 4 mineures) ; le reste est mis en vente à l'hôtel des ventes
export const POTION_KEEP = { potion_mineure: 4, potion_de_soin: 3, grande_potion_de_soin: 2, elixir_de_rappel: 1 };
export const TRAINING_STOCK = 12;               // il ne s'entraîne plus sur une potion dont il a déjà 12 exemplaires
export const TRAINING_KEEP = 6;                 // sans hôtel des ventes, il revend au marchand ce qui dépasse 6 potions d'entraînement
export const BREW_BATCH = 5;                    // potions distillées d'un coup
export const BREW_CHANCE = 0.4;                 // part de ses passages à l'atelier consacrée aux potions, quand il en veut
const MIN_LEVEL = DUNGEONS.manoir_englouti.minLevel;

const stock = (life, id) => (life.bag.res[id] || 0) + (life.bank?.resources?.[id] || 0);
export const wantsPotions = (life) => life.level >= MIN_LEVEL && ((life.dj?.keys || 0) > 0 || (life.dj?.runs || 0) > 0 || stock(life, "essence_du_veilleur") >= 1);

// Que distiller maintenant ? { id, n, training } ou null
export function brewPlan(life) {
  if (!wantsPotions(life)) return null;
  const level = professionOf(asPlayer(life), "alchimiste").level;
  for (const id of [...ALCHEMY_ORDER].reverse()) {
    const want = POTION_KIT[id] || 0;
    if (want > 0 && level >= ALCHEMY[id].minLevel && stock(life, id) < want) return { id, n: Math.min(BREW_BATCH, want - stock(life, id)), training: false };
  }
  if (!ALCHEMY_ORDER.some((id) => POTION_KIT[id] > 0 && ALCHEMY[id].minLevel > level)) return null;        // tout ce qu'il vise est débloqué et en stock
  const best = [...ALCHEMY_ORDER].reverse().find((id) => level >= ALCHEMY[id].minLevel && stock(life, id) < TRAINING_STOCK);
  return best ? { id: best, n: BREW_BATCH, training: true } : null;
}

// Ce qu'il doit acheter à l'hôtel des ventes pour sa prochaine distillation : { ressource: quantité }
export function potionShopping(life) {
  const plan = brewPlan(life);
  if (!plan) return {};
  const want = {};
  for (const [r, q] of Object.entries(ALCHEMY[plan.id].ingredients)) {
    const lack = q * plan.n - (life.bag.res[r] || 0) - (life.bank?.resources?.[r] || 0);
    if (lack > 0) want[r] = lack;
  }
  return want;
}

// À l'atelier : une distillation. `merchant` : faux quand l'hôtel des ventes fournit les herbes (il distille alors ce que son sac permet).
// Renvoie le nombre de potions obtenues (0 s'il n'a rien pu faire).
export function brewStep(life, rng, { merchant = true } = {}) {
  const plan = brewPlan(life);
  if (!plan) return 0;
  const rec = ALCHEMY[plan.id];
  let p = asPlayer(life);
  for (const [r, q] of Object.entries(rec.ingredients)) {                  // ce qui manque dans le sac : sorti du coffre, sinon acheté au marchand
    let lack = q * plan.n - (p.resources[r] || 0);
    const fromBank = Math.min(Math.max(lack, 0), life.bank?.resources?.[r] || 0);
    if (fromBank > 0) { life.bank.resources[r] -= fromBank; if (life.bank.resources[r] <= 0) delete life.bank.resources[r]; life.bag.res[r] = (life.bag.res[r] || 0) + fromBank; p.resources[r] = (p.resources[r] || 0) + fromBank; lack -= fromBank; }
    if (lack > 0 && merchant) { p.gold -= lack * priceOf(r); p.resources[r] = (p.resources[r] || 0) + lack; }
  }
  if (p.gold < 0) return 0;
  const n = Math.min(plan.n, maxBrew(p, plan.id));
  if (n < 1) return 0;
  const r = applyBrew(p, plan.id, n, rng);
  if (!r.made) return 0;
  life.gold = r.player.gold;
  life.bag.res = r.player.resources;
  life.pro = Object.fromEntries(Object.keys(r.player.professions).filter((k) => k !== life.prof.key).map((k) => [k, r.player.professions[k]]));
  const extra = plan.training && merchant ? (life.bag.res[plan.id] || 0) - TRAINING_KEEP : 0;     // entraînement : le surplus part au marchand (à l'hôtel des ventes, il est mis en vente comme le reste)
  if (extra > 0) { life.gold += Math.floor(extra * RESOURCES[plan.id].value * SELL_RATE); life.bag.res[plan.id] -= extra; }
  return r.made;
}
