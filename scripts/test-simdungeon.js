// Tests des simulés au Manoir Englouti (clé, expédition en groupe, butin, palier 4) :  node scripts/test-simdungeon.js
import assert from "node:assert/strict";
import { getPopulation } from "../src/sim/population.js";
import { initialLife } from "../src/sim/lives.js";
import { makeRng } from "../src/sim/rng.js";
import { acquireItem, craftStep, shoppingList, tierFor, tierGear, starterGear } from "../src/sim/lifeCraft.js";
import { dungeonStep, keyCraftStep, keyShopping, djOf, DJ_COOLDOWN_STEPS, DUNGEON } from "../src/sim/lifeDungeon.js";
import { dungeonOdds } from "../src/sim/botFight.js";
import { SETS, ITEMS } from "../src/data/items.js";
import { BUILDS } from "../src/sim/partyBots.js";
import { RECIPES } from "../src/data/recipes.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Simulés au Manoir Englouti");

const pop = getPopulation();
const bot = pop.find((b) => b.classKey === "assassin");
const tier4 = (c) => { const t = BUILDS[c].tiers[3]; return Object.fromEntries([t.weapon, ...SETS[t.set].pieces, ...(t.shield ? [t.shield] : [])].map((id) => [ITEMS[id].type, id])); };
const strong = (level = 26, gear = tier4("assassin")) => ({ ...initialLife(bot, "fresh"), level, gold: 5000, gear });
const keyStock = () => ({ essence_du_veilleur: 3, lingot_de_fer: 6, lingot_de_cuivre: 3, ectoplasme: 5 });

test("clé : fabriquée seulement avec l'essence du Veilleur qu'il a gagnée lui-même (le reste peut s'acheter)", () => {
  const rng = makeRng(1);
  const no = strong(); no.bag.res = { lingot_de_fer: 6, lingot_de_cuivre: 3, ectoplasme: 5 };
  assert.equal(keyCraftStep(no, rng), false, "sans essence : pas de clé, même avec de l'or");
  assert.deepEqual(keyShopping(no), {}, "et il n'achète rien tant qu'il n'a pas l'essence");
  const low = strong(15); low.bag.res = keyStock();
  assert.equal(keyCraftStep(low, rng), false, "trop bas niveau");
  const ok = strong(); ok.bag.res = { essence_du_veilleur: 3, lingot_de_fer: 2 };
  const want = keyShopping(ok);
  assert.equal(want.lingot_de_fer, 4); assert.equal(want.lingot_de_cuivre, 3); assert.equal(want.ectoplasme, 5); assert.ok(!want.essence_du_veilleur);
  ok.bag.res = keyStock();
  const gold = ok.gold;
  assert.equal(keyCraftStep(ok, rng, { merchant: false }), true);
  assert.equal(djOf(ok).keys, 1);
  assert.equal(ok.gold, gold - RECIPES.cle_du_manoir.gold, "500 or de fabrication");
  assert.ok(!ok.bag.res.essence_du_veilleur, "l'essence est consommée");
  assert.equal(ok.bag.items.length, 0, "la clé n'encombre pas le sac");
  assert.equal(keyCraftStep(ok, rng), false, "une seule clé à la fois");
});

test("expédition : sans clé ou avant le niveau, rien ; la clé est consommée à l'entrée ; deux jours de repos", () => {
  const acquire = acquireItem, addXp = (l, x) => { l.xp += x; };
  const l = strong(); const step = 10000;
  assert.equal(dungeonStep(l, bot, step, makeRng(1), { acquire, addXp }), null, "pas de clé");
  djOf(l).keys = 1;
  const low = strong(15); djOf(low).keys = 1;
  assert.equal(dungeonStep(low, bot, step, makeRng(1), { acquire, addXp }), null, "niveau 15 : trop bas");
  assert.equal(djOf(low).keys, 1, "il garde sa clé");
  let res = null, s = step;
  for (let i = 0; i < 10 && !res; i++, s++) res = dungeonStep(l, bot, s, makeRng(50 + i), { acquire, addXp });
  assert.ok(["clear", "partial", "fail"].includes(res), String(res));
  assert.equal(djOf(l).keys, 0);
  assert.equal(djOf(l).runs, 1);
  djOf(l).keys = 1;
  assert.equal(dungeonStep(l, bot, s + 10, makeRng(2), { acquire, addXp }), null, "repos de deux jours");
  assert.ok(DJ_COOLDOWN_STEPS >= 288);
});

test("un groupe qui y arrive gagne l'xp, l'or et les ressources du donjon ; un groupe trop faible n'y va pas", () => {
  const acquire = acquireItem, addXp = (l, x) => { l.xp += x; };
  const l = strong(); l.xp = 0;
  const odds = dungeonOdds(bot, l, DUNGEON, ["guerrier", "magicien"]);
  assert.equal(odds.length, DUNGEON.rooms.length + 1);
  assert.ok(Math.abs(odds.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(odds[4] >= 0.3, `niveau 26 en palier 4 : ${odds}`);
  let clears = 0, loot = 0;
  for (let i = 0; i < 12; i++) {
    const x = strong(); x.xp = 0; djOf(x).keys = 1;
    const r = dungeonStep(x, bot, 20000 + i, makeRng(300 + i), { acquire, addXp });
    if (r === "clear") { clears++; assert.ok(x.xp > 3000 && x.gold > 5000); assert.equal(djOf(x).clears, 1); }
    loot += (x.bag.res.larme_de_deuil || 0) + (x.bag.res.plaque_noyee || 0) + (x.bag.res.cuir_de_molosse || 0) + (x.bag.res.soie_funeraire || 0);
  }
  assert.ok(clears >= 3, `${clears} réussites sur 12`);
  assert.ok(loot > 10, "les ressources du donjon arrivent dans le sac");
  const weak = { ...initialLife(bot, "fresh"), level: 20, gear: starterGear("assassin") }; djOf(weak).keys = 1;
  assert.equal(dungeonStep(weak, bot, 30000, makeRng(1), { acquire, addXp }), null, "équipement de départ : il ne tente pas");
  assert.equal(djOf(weak).keys, 1);
});

test("relique : elle est portée par le simulé qui la reçoit (+1 PA, +10 %), comptée, et change son estimation", () => {
  const l = strong();
  const base = dungeonOdds(bot, l, DUNGEON, ["guerrier", "magicien"]);
  acquireItem(l, "medaillon_dame_en_deuil");
  assert.equal(l.gear.relique1, "medaillon_dame_en_deuil");
  assert.equal(l.bag.items.length, 0);
  const withRelic = dungeonOdds(bot, l, DUNGEON, ["guerrier", "magicien"]);
  assert.ok(withRelic[4] >= base[4], `${base[4]} -> ${withRelic[4]}`);
});

test("après le donjon, il vise le palier 4 et achète les ressources du donjon à l'hôtel des ventes", () => {
  const l = strong(24, tierGear("assassin", 24));
  assert.equal(tierFor(l), 2, "avant : palier 3");
  djOf(l).clears = 1;
  assert.equal(tierFor(l), 3, "après un donjon fini : palier 4");
  l.pro = { maroquinier: { key: "maroquinier", level: 14, xp: 0 } };
  const want = shoppingList(l, bot);
  const dj = Object.keys(want).filter((id) => ["cuir_de_molosse", "larme_de_deuil", "essence_de_deuil"].includes(id));
  assert.ok(dj.length >= 1, JSON.stringify(want));
  // avec les ressources en poche, il fabrique une pièce du Veneur
  l.bag.res = { cuir_de_molosse: 40, larme_de_deuil: 20, cuir_de_sanglier: 20, fil_d_ortie: 5, essence_de_deuil: 2, lingot_de_cuivre: 5 };
  let made = null;
  for (let i = 0; i < 6 && !made; i++) made = craftStep(l, bot, makeRng(i));
  assert.ok(made && ITEMS[made].tier === 4, String(made));
});

console.log(`\n${n} tests OK`);
