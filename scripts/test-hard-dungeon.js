// Tests du Manoir Englouti en version difficile (monstres, butin, clé, relique, simulés) :  node scripts/test-hard-dungeon.js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { RESOURCES } from "../src/data/resources.js";
import { ENEMIES, HARD_MULT, HARD_SUFFIX } from "../src/data/zones.js";
import { DUNGEONS, dungeonOfKey } from "../src/data/dungeons.js";
import { getCraftInfo } from "../src/data/professions.js";
import { calcStats } from "../src/utils/calcStats.js";
import { itemStatLines } from "../src/utils/itemText.js";
import { itemValue } from "../src/utils/itemValue.js";
import { createCombat } from "../src/combat/engine.js";
import { keyCount, consumeKey, roomEncounter, dungeonDrops } from "../src/utils/dungeon.js";
import { getPopulation } from "../src/sim/population.js";
import { initialLife } from "../src/sim/lives.js";
import { makeRng } from "../src/sim/rng.js";
import { acquireItem, tierGear } from "../src/sim/lifeCraft.js";
import { dungeonStep, keyCraftStep, keyShopping, djOf, djhOf, HARD_DUNGEON } from "../src/sim/lifeDungeon.js";
import { dungeonOdds } from "../src/sim/botFight.js";
import { makeBotPlayer } from "../src/sim/partyBots.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Donjon difficile");

const easy = DUNGEONS.manoir_englouti, hard = DUNGEONS.manoir_englouti_difficile;

test("même manoir, version difficile : mêmes salles et décors, monstres « _difficile », niveau minimum plus haut, accessible depuis l'entrée normale", () => {
  assert.equal(easy.hardKey, "manoir_englouti_difficile");
  assert.equal(hard.rooms.length, easy.rooms.length);
  hard.rooms.forEach((r, i) => {
    assert.equal(r.bg, easy.rooms[i].bg); assert.equal(r.boss, easy.rooms[i].boss);
    assert.deepEqual(r.enemies, easy.rooms[i].enemies.map((k) => k + HARD_SUFFIX));
    assert.equal(roomEncounter(hard, i).bg, r.bg);
  });
  assert.ok(hard.minLevel > easy.minLevel);
  assert.equal(dungeonOfKey("cle_du_manoir_difficile"), hard);
  assert.equal(dungeonOfKey("cle_du_manoir"), easy);
});

test("les monstres difficiles sont plus costauds, gardent leur visuel et rapportent plus ; le boss a un sort de plus et une phase plus dure", () => {
  for (const k of new Set(easy.rooms.flatMap((r) => r.enemies))) {
    const a = ENEMIES[k], h = ENEMIES[k + HARD_SUFFIX];
    assert.ok(h.hard && h.dungeon && h.baseKey === k, k);
    assert.equal(h.stats.hp, Math.round(a.stats.hp * HARD_MULT.hp));
    assert.ok(h.stats.defPhys > a.stats.defPhys && h.xp > a.xp && h.gold[0] > a.gold[0]);
    assert.ok(h.stats.atkPhys >= a.stats.atkPhys && h.stats.atkMagie >= a.stats.atkMagie);
    assert.equal(h.img, a.img); assert.ok(existsSync(`public${h.img}`));
    assert.equal(h.actions.length, a.actions.length + (a.boss ? 1 : 0));
  }
  const dame = ENEMIES.dame_en_deuil, hd = ENEMIES.dame_en_deuil_difficile;
  assert.ok(hd.phases[0].atkMult > dame.phases[0].atkMult);
  assert.ok(hd.actions.some((a) => a.id === "requiem_funebre"));
  assert.equal(ENEMIES.dame_en_deuil.actions.some((a) => a.id === "requiem_funebre"), false, "le boss normal ne change pas");
});

test("butin : éclats purs garantis (3 à 5) sur le boss, 25 % sur les autres ; le donjon normal ne change pas", () => {
  const shard = (e) => e.drops.find((d) => d.id === "eclat_pur");
  assert.deepEqual([shard(ENEMIES.dame_en_deuil_difficile).chance, shard(ENEMIES.dame_en_deuil_difficile).min, shard(ENEMIES.dame_en_deuil_difficile).max], [1, 3, 5]);
  assert.equal(shard(ENEMIES.garde_noye_difficile).chance, 0.25);
  assert.equal(shard(ENEMIES.garde_noye).chance, 0.1);
  assert.equal(shard(ENEMIES.dame_en_deuil).chance, 0.9);
  const boss = ENEMIES.dame_en_deuil_difficile;
  const rel = boss.drops.find((d) => d.id === "medaillon_veuvage_eternel");
  assert.equal(rel.chance, 0.003); assert.equal(rel.fixed, true);
  assert.ok(!ENEMIES.dame_en_deuil.drops.some((d) => d.id === "medaillon_veuvage_eternel"), "la relique supérieure n'est que du donjon difficile");
  assert.ok(dungeonDrops(hard, "guerrier").some((d) => d.id === "medaillon_veuvage_eternel"), "visible sur la fiche d'entrée");
  assert.ok(boss.drops.find((d) => d.id === "essence_de_deuil").min >= 2);
});

test("relique : +1 PA, +15 % de dommages finaux, 4 % de vol de vie et +10 % de butin ; elle remplace le Médaillon, elle ne s'y ajoute pas", () => {
  const rel = ITEMS.medaillon_veuvage_eternel, old = ITEMS.medaillon_dame_en_deuil;
  assert.equal(rel.type, "relique1"); assert.ok(existsSync(`public${rel.img}`));
  assert.deepEqual(rel.passive, { paBonus: 1, finalDamage: 0.15, lifesteal: 0.04 });
  assert.equal(rel.dropBonus, 10);
  assert.ok(rel.passive.finalDamage > old.passive.finalDamage);
  const base = { level: 30, baseHp: 400, caracs: {}, equipped: {} };
  const s = calcStats({ ...base, equipped: { relique1: rel } });
  assert.equal(s.paMax, 7);
  assert.equal(s.dropBonus, calcStats(base).dropBonus + 10);
  const st = createCombat({ stats: s, weaponType: "epee", classKey: "guerrier", level: 30, enemyKeys: ["garde_noye_difficile"], seed: 3 });
  assert.equal(st.player.paMax, 7);
  assert.equal(st.flags?.finalDamage ?? st.player.flags?.finalDamage, 0.15);
  assert.ok(itemStatLines(rel).some((l) => l.includes("+10% Butin")));
});

test("clé difficile : fabriquée par le Bricoleur, bien plus chère que la normale, avec le rare du boss (essence de deuil)", () => {
  const info = getCraftInfo("cle_du_manoir_difficile");
  assert.equal(info.profession, "bricoleur");
  const r = RECIPES.cle_du_manoir_difficile, e = RECIPES.cle_du_manoir;
  for (const id of Object.keys(r.ingredients)) assert.ok(RESOURCES[id], id);
  assert.ok(r.ingredients.essence_de_deuil >= 1);
  assert.ok(r.gold > e.gold * 2);
  assert.ok(itemValue("cle_du_manoir_difficile") > itemValue("cle_du_manoir") * 2);
  assert.equal(ITEMS.cle_du_manoir_difficile.type, "cle"); assert.ok(existsSync(`public${ITEMS.cle_du_manoir_difficile.img}`));
});

test("chaque clé ouvre son donjon et la consommer ne touche pas à l'autre", () => {
  const inv = [{ id: "cle_du_manoir", uid: "a" }, { id: "cle_du_manoir_difficile", uid: "b" }, { id: "cle_du_manoir_difficile", uid: "c" }];
  const p = { inventory: inv };
  assert.equal(keyCount(p, easy), 1); assert.equal(keyCount(p, hard), 2);
  const q = consumeKey(p, hard);
  assert.equal(keyCount(q, hard), 1); assert.equal(keyCount(q, easy), 1);
});

// ---- simulés ----
const pop = getPopulation();
const bot = pop.find((b) => b.classKey === "guerrier");
const strong = (level = 40) => ({ ...initialLife(bot, "fresh"), level, gold: 9e4, gear: tierGear("guerrier", level) });
const hardStock = () => ({ essence_de_deuil: 2, larme_de_deuil: 6, lingot_de_fer: 12, lingot_de_cuivre: 6, ectoplasme: 10 });
const KIT = { potion_de_soin: 8, grande_potion_de_soin: 6, elixir_de_rappel: 3 };       // les potions qu'un simulé emporte
const acquire = acquireItem, addXp = (l, x) => { l.xp += x; };

test("simulé : la clé difficile ne se prépare qu'après un premier donjon réussi, au niveau voulu, avec l'essence de deuil gagnée par lui", () => {
  const rng = makeRng(1);
  const a = strong(); a.bag.res = hardStock();
  assert.equal(keyCraftStep(a, rng, { merchant: false }), false, "il n'a pas fini le donjon normal : pas de clé difficile, ni de clé normale sans essence du Veilleur");
  assert.equal(djhOf(a).keys, 0);
  const b = strong(); djOf(b).clears = 1; b.bag.res = { ...hardStock(), essence_de_deuil: 0 }; delete b.bag.res.essence_de_deuil;
  assert.deepEqual(keyShopping(b), {}, "sans essence de deuil il n'achète rien");
  const low = strong(24); djOf(low).clears = 1; low.bag.res = hardStock();
  assert.equal(keyCraftStep(low, rng, { merchant: false }), false, "niveau 24 : trop bas pour la difficile");
  const c = strong(); djOf(c).clears = 1; c.bag.res = { essence_de_deuil: 2 }; c.pro = { bricoleur: { key: "bricoleur", level: 8, xp: 0 } };
  const want = keyShopping(c);
  assert.equal(want.larme_de_deuil, 6); assert.equal(want.lingot_de_fer, 12); assert.ok(!want.essence_de_deuil);
  c.bag.res = hardStock();
  assert.equal(keyCraftStep(c, rng, { merchant: false }), true);
  assert.equal(djhOf(c).keys, 1); assert.equal(djOf(c).keys, 0, "c'est bien la clé difficile");
  assert.equal(keyCraftStep(c, rng, { merchant: false }), false, "une seule clé à la fois");
});

test("simulé : la difficile est tentée d'abord s'il y est prêt (sa clé difficile est consommée), sinon il retombe sur la normale", () => {
  const l = strong(45); l.xp = 0; djhOf(l).keys = 1; djOf(l).keys = 1; l.bag.res = { ...KIT };
  const odds = dungeonOdds(bot, l, HARD_DUNGEON, ["assassin", "magicien"], KIT);
  assert.equal(odds.length, hard.rooms.length + 1);
  assert.ok(odds[4] >= 0.3, `niveau 45 en palier 4 : ${odds}`);
  let res = null;
  for (let i = 0; i < 20 && !res; i++) res = dungeonStep(l, bot, 50000 + i * 400, makeRng(900 + i), { acquire, addXp });
  assert.ok(res);
  assert.equal(djhOf(l).runs, 1); assert.equal(djhOf(l).keys, 0);
  assert.equal(djOf(l).runs, 0, "le donjon normal n'a pas servi"); assert.equal(djOf(l).keys, 1, "sa clé normale est intacte");
  // niveau 26 mal équipé : la difficile est trop dure, il garde sa clé difficile et peut faire la normale
  const weak = strong(26); weak.gear = tierGear("guerrier", 14); djhOf(weak).keys = 1; djOf(weak).keys = 1;
  let r2 = null;
  for (let i = 0; i < 20 && !r2; i++) r2 = dungeonStep(weak, bot, 90000 + i * 400, makeRng(700 + i), { acquire, addXp });
  assert.equal(djhOf(weak).runs, 0, "trop faible pour la difficile"); assert.equal(djhOf(weak).keys, 1);
  assert.ok(djOf(weak).runs <= 1);
});

test("simulé : il est plus dur à vaincre en difficile qu'en normal, et rapporte plus d'or et d'éclats purs", () => {
  const l = strong(32);
  const o1 = dungeonOdds(bot, l, easy, ["assassin", "magicien"], KIT), o2 = dungeonOdds(bot, l, hard, ["assassin", "magicien"], KIT);
  assert.ok(o2[4] <= o1[4], `${o1[4]} vs ${o2[4]}`);
  let shards = 0, gold = 0;
  for (let i = 0; i < 8; i++) {
    const x = strong(50); x.xp = 0; x.gold = 0; djhOf(x).keys = 1; x.bag.res = { ...KIT };
    dungeonStep(x, bot, 70000 + i * 400, makeRng(1200 + i), { acquire, addXp });
    shards += x.bag.res.eclat_pur || 0; gold += x.gold;
  }
  assert.ok(shards >= 8, `${shards} éclats purs sur 8 expéditions`);
  assert.ok(gold > 8 * 1500);
});

test("simulé : le Médaillon du Veuvage éternel remplace le Médaillon et lui est préféré ensuite ; le Médaillon normal ne le remplace pas", () => {
  const l = strong();
  acquireItem(l, "medaillon_dame_en_deuil");
  assert.equal(l.gear.relique1, "medaillon_dame_en_deuil");
  acquireItem(l, "medaillon_veuvage_eternel");
  assert.equal(l.gear.relique1, "medaillon_veuvage_eternel");
  acquireItem(l, "medaillon_dame_en_deuil");
  assert.equal(l.gear.relique1, "medaillon_veuvage_eternel");
  const base = makeBotPlayer("guerrier", 40, l.gear);
  assert.equal(calcStats(base).paMax, 7);
});

console.log(`\n${n} tests OK`);
