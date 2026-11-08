// Tests de l'usage des potions et de l'enchaînement des salles :  node scripts/test-potions.js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { potionResult, canDrink, consumePotion, drinkPotion, potionCount } from "../src/utils/potions.js";
import { DUNGEONS } from "../src/data/dungeons.js";
import { roomEncounter } from "../src/utils/dungeon.js";
import { ENEMIES } from "../src/data/zones.js";
import { createCombat, DUNGEON_REVIVE } from "../src/combat/engine.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { calcStats } from "../src/utils/calcStats.js";
import { botSpec } from "../src/sim/partyBots.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Potions et salles de donjon");

const bag = (resources) => ({ ...createPlayer({ classKey: "guerrier" }), resources });

test("potions de soin : part des PV max, plafonnée, inutile à PV pleins ou sur un héros tombé", () => {
  assert.equal(potionResult({ hp: 100, maxHp: 400 }, "potion_mineure"), 200);          // +25 %
  assert.equal(potionResult({ hp: 100, maxHp: 400 }, "potion_de_soin"), 300);          // +50 %
  assert.equal(potionResult({ hp: 300, maxHp: 400 }, "grande_potion_de_soin"), 400);   // plafonné aux PV max
  assert.equal(potionResult({ hp: 400, maxHp: 400 }, "potion_de_soin"), null);
  assert.equal(potionResult({ hp: 0, maxHp: 400 }, "potion_de_soin"), null);
  assert.equal(potionResult({ hp: 50, maxHp: 400 }, "pas_une_potion"), null);
});

test("élixir de rappel : relève un héros tombé à 40 %, inutile sur un vivant", () => {
  assert.equal(potionResult({ hp: 0, maxHp: 400 }, "elixir_de_rappel"), 160);
  assert.equal(potionResult({ hp: 10, maxHp: 400 }, "elixir_de_rappel"), null);
});

test("boire consomme la potion du sac, à volonté tant qu'il en reste, sans or", () => {
  let p = bag({ potion_de_soin: 2, ortie: 5 }), party = [{ hp: 50, maxHp: 400 }, { hp: 0, maxHp: 300 }];
  p = { ...p, gold: 7 };
  let r = drinkPotion(p, party, 0, "potion_de_soin");
  assert.ok(r.drunk); assert.equal(r.party[0].hp, 250); assert.equal(potionCount(r.player, "potion_de_soin"), 1); assert.equal(r.player.gold, 7);
  r = drinkPotion(r.player, r.party, 0, "potion_de_soin");
  assert.equal(r.party[0].hp, 400); assert.equal(potionCount(r.player, "potion_de_soin"), 0);
  assert.equal("potion_de_soin" in r.player.resources, false, "la ligne disparaît à zéro");
  assert.equal(r.player.resources.ortie, 5, "le reste du sac est intact");
  const again = drinkPotion(r.player, r.party, 0, "potion_de_soin");
  assert.equal(again.drunk, false);
  assert.equal(drinkPotion(bag({ potion_de_soin: 1 }), party, 1, "potion_de_soin").drunk, false, "pas de soin sur un héros tombé");
  assert.equal(canDrink(bag({}), party[0], "potion_de_soin"), false, "sans potion, rien à boire");
  assert.equal(consumePotion(bag({}), "potion_de_soin").resources.potion_de_soin, undefined);
});

test("chaque salle a son décor et son groupe de monstres, qui existent", () => {
  for (const d of Object.values(DUNGEONS)) d.rooms.forEach((room, i) => {
    assert.ok(room.bg && existsSync(`public${room.bg}`), `${d.key}/${room.id} : décor absent`);
    assert.ok(room.enemies.length >= 1 && room.enemies.every((k) => ENEMIES[k]), room.id);
    assert.equal(roomEncounter(d, i).bg, room.bg);
    for (const k of room.enemies) assert.ok(existsSync(`public${ENEMIES[k].img}`), k);
  });
});

test("les PV soignés entre deux salles sont ceux du combat suivant (et un tombé relevé par l'élixir reste à 40 %)", () => {
  const player = createPlayer({ classKey: "guerrier" }), stats = calcStats(player);
  const ally = botSpec("magicien", 25, { name: "Ami" });
  const enemyKeys = DUNGEONS.manoir_englouti.rooms[1].enemies;
  const half = Math.round(stats.maxHp / 2);
  const cs = createCombat({ stats, classKey: "guerrier", level: 25, enemyKeys, allies: [ally], carry: { player: half, allies: [0] }, seed: 1 });
  assert.equal(cs.player.hp, half);
  assert.equal(cs.allies[0].hp, Math.ceil(cs.allies[0].maxHp * DUNGEON_REVIVE), "sans élixir : relevé à 20 %");
  const revived = potionResult({ hp: 0, maxHp: cs.allies[0].maxHp }, "elixir_de_rappel");
  const cs2 = createCombat({ stats, classKey: "guerrier", level: 25, enemyKeys, allies: [ally], carry: { player: half, allies: [revived] }, seed: 1 });
  assert.equal(cs2.allies[0].hp, revived, "avec l'élixir : 40 %");
  assert.ok(cs2.allies[0].hp > cs.allies[0].hp);
});

console.log(`\n${n} tests passent.`);
