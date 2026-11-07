// Tests de l'Alchimiste et des potions :  node scripts/test-alchemy.js
import assert from "node:assert/strict";
import { ALCHEMY, ALCHEMY_ORDER, alchemyOf } from "../src/data/alchemy.js";
import { RESOURCES } from "../src/data/resources.js";
import { PROFESSIONS, PROFESSION_ORDER } from "../src/data/professions.js";
import { canBrew, applyBrew, maxBrew, professionOf, gainProfessionXp } from "../src/utils/crafting.js";
import { perksFor, perkLines } from "../src/utils/perks.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { newMarket } from "../src/utils/market.js";
import { makeRng } from "../src/sim/rng.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Alchimie");

const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 500, resources: { ortie: 12, sauge: 12, ectoplasme: 6, voile_spectral: 4, pelage_maudit: 2 }, ...extra });
const at = (level) => ({ professions: { ...createPlayer({ classKey: "guerrier" }).professions, alchimiste: { level, xp: 0 } } });

test("le métier existe, les potions sont des ressources empilables non vendues par le colporteur", () => {
  assert.ok(PROFESSIONS.alchimiste && PROFESSION_ORDER.includes("alchimiste"));
  assert.equal(alchemyOf("alchimiste").length, ALCHEMY_ORDER.length);
  for (const id of ALCHEMY_ORDER) {
    assert.ok(RESOURCES[id] && RESOURCES[id].crafted && RESOURCES[id].source === "alchimie", id);
    assert.ok(ALCHEMY[id].heal > 0 || ALCHEMY[id].revive > 0, id);
    for (const r of Object.keys(ALCHEMY[id].ingredients)) assert.ok(RESOURCES[r] && !RESOURCES[r].dungeon, `${id} : ${r}`);
  }
  // les niveaux montent avec la puissance
  const lv = alchemyOf("alchimiste").map((id) => ALCHEMY[id].minLevel);
  assert.deepEqual(lv, [...lv].sort((a, b) => a - b));
  assert.equal(ALCHEMY.potion_mineure.minLevel, 1);
});

test("distiller : consomme herbes et or, ajoute les potions et l'xp du métier", () => {
  const p = base(), r = applyBrew(p, "potion_mineure", 2, () => 0.99);
  assert.equal(r.made, 2);
  assert.equal(r.player.resources.potion_mineure, 2);
  assert.equal(r.player.resources.ortie, 12 - 6);
  assert.equal(r.player.gold, 500 - 2 * ALCHEMY.potion_mineure.gold);
  assert.deepEqual(professionOf(r.player, "alchimiste"), gainProfessionXp({ level: 1, xp: 0 }, 2 * ALCHEMY.potion_mineure.xp));
  assert.equal(p.resources.ortie, 12, "le joueur d'origine n'est pas modifié");
});

test("niveau, matières et or sont exigés", () => {
  assert.ok(canBrew(base(), "potion_de_soin").lacksLevel);
  assert.equal(applyBrew(base(), "potion_de_soin").made, 0);
  assert.ok(canBrew(base(at(8)), "potion_de_soin").ok);
  assert.ok(canBrew(base({ resources: {} }), "potion_mineure").lacksResources);
  assert.ok(canBrew(base({ gold: 1 }), "potion_mineure").lacksGold);
  assert.equal(canBrew(base(), "nimporte_quoi").ok, false);
});

test("maxBrew : limité par le niveau, les herbes et l'or", () => {
  assert.equal(maxBrew(base(), "potion_mineure"), 4);                       // 12 orties / 3
  assert.equal(maxBrew(base({ gold: 13 }), "potion_mineure"), 2);           // 13 or / 6
  assert.equal(maxBrew(base(), "potion_de_soin"), 0);                       // niveau 8 requis
  assert.equal(maxBrew(base(at(24)), "elixir_de_rappel"), 2);               // 2 pelages maudits
});

test("avantage : chance d'une potion de plus, nulle au niveau 1, 40 % au niveau 100", () => {
  assert.equal(perksFor("alchimiste", 1).bonus, 0);
  assert.ok(Math.abs(perksFor("alchimiste", 100).bonus - 0.4) < 1e-9);
  assert.ok(perkLines("alchimiste", 10)[0].label.includes("potion"));
  const rng = makeRng(11);
  let made = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) made += applyBrew(base({ ...at(100), gold: 1e6, resources: { ortie: 3 } }), "potion_mineure", 1, rng).made;
  assert.ok(made / N > 1.33 && made / N < 1.47, `${made / N} potions par distillation`);
});

test("le marché suit les potions, sans les vendre au colporteur", () => {
  const m = newMarket(5);
  for (const id of ALCHEMY_ORDER) assert.ok(m.stock[id] !== undefined, id);
});

console.log(`\n${n} tests passent.`);
