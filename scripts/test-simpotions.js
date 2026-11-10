// Tests des simulés et des potions (distillation, achats, usage entre les salles du donjon) :  node scripts/test-simpotions.js
import assert from "node:assert/strict";
import { getPopulation } from "../src/sim/population.js";
import { initialLife, stepLife } from "../src/sim/lives.js";
import { makeRng } from "../src/sim/rng.js";
import { acquireItem } from "../src/sim/lifeCraft.js";
import { djOf, dungeonStep, DUNGEON } from "../src/sim/lifeDungeon.js";
import { wantsPotions, brewPlan, brewStep, potionShopping, POTION_KIT } from "../src/sim/lifePotions.js";
import { dungeonOdds, kitOfBag, autoDungeon } from "../src/sim/botFight.js";
import { autoDrink } from "../src/utils/potions.js";
import { SETS, ITEMS } from "../src/data/items.js";
import { BUILDS, makeBotPlayer, botSpec } from "../src/sim/partyBots.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Simulés et potions");

const pop = getPopulation();
const bot = pop.find((b) => b.classKey === "guerrier");
const tier3 = (c) => { const t = BUILDS[c].tiers[2]; return Object.fromEntries([t.weapon, ...SETS[t.set].pieces, ...(t.shield ? [t.shield] : [])].map((id) => [ITEMS[id].type, id])); };
const life = (level = 24, extra = {}) => ({ ...initialLife(bot, "fresh"), level, gold: 3000, gear: tier3("guerrier"), ...extra });
const alch = (level) => ({ pro: { alchimiste: { level, xp: 0 } } });

test("autoDrink : le plus blessé d'abord, la plus petite potion qui suffit, l'élixir pour un tombé, jamais plus que le sac", () => {
  const party = [{ hp: 100, maxHp: 400 }, { hp: 0, maxHp: 300 }, { hp: 380, maxHp: 400 }];
  const r = autoDrink(party, { potion_de_soin: 1, grande_potion_de_soin: 1, elixir_de_rappel: 1 });
  assert.ok(r.party[1].hp >= 120, "le tombé est relevé");
  assert.ok(r.party[0].hp > 100);
  assert.equal(r.party[2].hp, 380, "le presque intact ne boit pas");
  for (const [id, q] of Object.entries(r.used)) assert.ok(q <= 1, id);
  assert.equal(party[0].hp, 100, "rien n'est modifié sur place");
  assert.deepEqual(autoDrink(party, {}).used, {});
  // 100/400 : manque 300 -> la grande potion (320) suffit, la potion de soin (200) non
  assert.equal(autoDrink([{ hp: 100, maxHp: 400 }], { potion_de_soin: 5, grande_potion_de_soin: 5 }, { threshold: 0.3 }).used.grande_potion_de_soin, 1);
});

test("les potions changent le résultat d'un donjon : mêmes héros, plus de salles gagnées en moyenne", () => {
  const player = makeBotPlayer("guerrier", 22, tier3("guerrier"));
  const allies = ["assassin", "magicien"].map((c) => botSpec(c, 22, { gear: tier3(c) }));
  const kit = { potion_de_soin: 4, grande_potion_de_soin: 4, elixir_de_rappel: 2 };
  let a = 0, b = 0, drunk = 0;
  for (let seed = 1; seed <= 12; seed++) {
    a += autoDungeon(player, allies, DUNGEON.rooms, seed).rooms;
    const r = autoDungeon(player, allies, DUNGEON.rooms, seed, kit);
    b += r.rooms; drunk += Object.values(r.used).reduce((s, x) => s + x, 0);
  }
  assert.ok(b > a, `${b} salles avec potions contre ${a} sans`);
  assert.ok(drunk > 0);
});

test("une estimation tient compte du sac de potions et dit combien il en boit", () => {
  const l = life(22);
  const without = dungeonOdds(bot, l, DUNGEON, ["assassin", "magicien"]);
  const withKit = dungeonOdds(bot, l, DUNGEON, ["assassin", "magicien"], kitOfBag({ potion_de_soin: 5, grande_potion_de_soin: 5 }));
  assert.ok(withKit[4] >= without[4], `${withKit[4]} contre ${without[4]}`);
  assert.deepEqual(kitOfBag({ potion_de_soin: 5, ortie: 9, elixir_de_rappel: 0 }), { potion_de_soin: 4 });
  assert.equal(Object.keys(without.used).length, 0, "sans potion, rien n'est bu");
});

test("expédition : les potions bues sortent du sac et sont comptées", () => {
  const addXp = (l, x) => { l.xp += x; };
  let used = 0;
  for (let i = 0; i < 6; i++) {
    const l = life(24); l.bag.res = { potion_de_soin: 6, grande_potion_de_soin: 6 }; djOf(l).keys = 1;
    const before = 12;
    const r = dungeonStep(l, bot, 40000 + i, makeRng(900 + i), { acquire: acquireItem, addXp });
    const left = (l.bag.res.potion_de_soin || 0) + (l.bag.res.grande_potion_de_soin || 0);
    if (r) { assert.ok(left <= before); assert.equal(before - left, djOf(l).potions || 0); used += before - left; }
  }
  assert.ok(used > 0, "au moins une potion bue sur 6 expéditions");
});

test("qui distille ? seulement un simulé que le donjon intéresse (niveau, et clé, essence ou expédition déjà faite)", () => {
  assert.equal(wantsPotions(life(15)), false);
  assert.equal(wantsPotions(life(24)), false, "niveau 24 mais aucun intérêt pour le donjon");
  const k = life(24); djOf(k).keys = 1; assert.equal(wantsPotions(k), true);
  const e = life(24); e.bag.res.essence_du_veilleur = 1; assert.equal(wantsPotions(e), true);
  assert.equal(brewPlan(life(24)), null);
});

test("plan : il s'entraîne tant que sa potion visée est hors de portée, puis il vise sa trousse", () => {
  const low = life(24, alch(1)); djOf(low).keys = 1;
  let plan = brewPlan(low);
  assert.equal(plan.id, "potion_mineure"); assert.ok(plan.training);
  const mid = life(24, alch(8)); djOf(mid).keys = 1;
  plan = brewPlan(mid);
  assert.equal(plan.id, "potion_de_soin"); assert.equal(plan.training, false); assert.equal(plan.n, 3);
  const top = life(24, alch(24)); djOf(top).keys = 1;
  assert.equal(brewPlan(top).id, "elixir_de_rappel");
  top.bag.res = { ...POTION_KIT }; assert.equal(brewPlan(top), null, "trousse complète : plus rien à faire");
});

test("distiller : herbes et or dépensés, potions dans le sac, xp d'Alchimiste ; sans marchand, il lui faut les herbes", () => {
  const l = life(24, alch(8)); djOf(l).keys = 1; l.bag.res = { ortie: 6, sauge: 6 };
  const gold = l.gold;
  const made = brewStep(l, makeRng(3), { merchant: false });
  assert.ok(made >= 3, String(made));
  assert.ok(l.bag.res.potion_de_soin >= 3);
  assert.ok(l.gold < gold);
  assert.ok(l.pro.alchimiste.xp > 0 || l.pro.alchimiste.level > 8);
  const poor = life(24, alch(8)); djOf(poor).keys = 1; poor.bag.res = {};
  assert.equal(brewStep(poor, makeRng(3), { merchant: false }), 0, "sans herbes ni marchand : rien");
  const buyer = life(24, alch(8)); djOf(buyer).keys = 1; buyer.bag.res = {};
  assert.ok(brewStep(buyer, makeRng(3), { merchant: true }) >= 3, "le marchand de secours fournit les herbes");
  assert.ok(buyer.gold < 3000);
});

test("achats : ce qui manque pour la prochaine distillation est demandé à l'hôtel des ventes", () => {
  const l = life(24, alch(8)); djOf(l).keys = 1; l.bag.res = { ortie: 2 };
  assert.deepEqual(potionShopping(l), { ortie: 4, sauge: 6 });          // 3 potions de soin : 6 orties et 6 sauges
  assert.deepEqual(potionShopping(life(24)), {});
});

test("vie entière : un simulé intéressé par le donjon finit par avoir des potions, en gardant ses autres activités", () => {
  const l = life(26, alch(1)); djOf(l).keys = 1;
  let made = 0, crafted0 = l.crafted;
  for (let s = 100000; s < 100000 + 144 * 20; s++) { stepLife(l, bot, s); }
  const stock = Object.entries(l.bag.res).filter(([id]) => id.includes("potion") || id === "elixir_de_rappel").reduce((t, [, q]) => t + q, 0);
  assert.ok(l.pro.alchimiste && (l.pro.alchimiste.level > 1 || l.pro.alchimiste.xp > 0), "son Alchimiste progresse");
  assert.ok(stock > 0 || (djOf(l).potions || 0) > 0, "il a distillé des potions");
  assert.ok(l.crafted >= crafted0);
});

console.log(`\n${n} tests passent.`);
