// Niveau minimum pour s'équiper :  node scripts/test-equipreq.js
import assert from "node:assert/strict";
import { ITEMS } from "../src/data/items.js";
import { CLASSES } from "../src/data/classes.js";
import { equipLevelOf, canEquipAtLevel, equipLockText, TIER_EQUIP_LEVEL, EQUIP_LEVEL_OVERRIDES } from "../src/utils/equipReq.js";
import { tierGear, starterGear } from "../src/sim/lifeCraft.js";
import { tierOf } from "../src/sim/partyBots.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { equipOn } from "../src/utils/equip.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Niveau minimum d'équipement");
const SLOTS = ["arme", "bouclier", "chapeau", "cape", "plastron", "amulette", "gants", "ceinture", "anneau", "jambieres"];
const wearable = Object.values(ITEMS).filter((it) => SLOTS.includes(it.type));

test("niveau par palier : 1 / 8 / 14 / 20 ; pas de palier = aucun minimum", () => {
  assert.deepEqual(TIER_EQUIP_LEVEL, { 1: 1, 2: 8, 3: 14, 4: 20 });
  assert.equal(equipLevelOf({ id: "x", tier: 2 }), 8);
  assert.equal(equipLevelOf({ id: "x", tier: 3 }), 14);
  assert.equal(equipLevelOf({ id: "x", tier: 4 }), 20);
  assert.equal(equipLevelOf({ id: "x" }), 1, "objet de départ");
  assert.equal(equipLevelOf(null), 1);
  assert.equal(equipLockText({ id: "x", tier: 3 }), "Niveau 14 requis");
});

test("on peut équiper à partir du niveau requis, pas avant ; un niveau absent compte pour 1", () => {
  const it = { id: "x", tier: 3 };
  assert.equal(canEquipAtLevel(it, 13), false);
  assert.equal(canEquipAtLevel(it, 14), true);
  assert.equal(canEquipAtLevel(it, 50), true);
  assert.equal(canEquipAtLevel(it, undefined), false);
  assert.equal(canEquipAtLevel({ id: "y" }, undefined), true);
});

test("les objets de boss sans palier ont le niveau de leur région ; chaque exception existe vraiment", () => {
  for (const id of Object.keys(EQUIP_LEVEL_OVERRIDES)) assert.ok(ITEMS[id], `objet inconnu : ${id}`);
  assert.equal(equipLevelOf(ITEMS.cape_epouvantail), 5);
  assert.equal(equipLevelOf(ITEMS.amulette_coeur_de_braise), 8);
  assert.equal(equipLevelOf(ITEMS.anneau_cavalier), 14);
  assert.equal(equipLevelOf(ITEMS.lame_du_veilleur), 20);
});

test("tous les équipements : niveau entre 1 et 20, et jamais plus bas que celui de leur palier", () => {
  assert.ok(wearable.length > 80, "des équipements existent");
  for (const it of wearable) {
    const L = equipLevelOf(it);
    assert.ok(L >= 1 && L <= 20, `${it.id} : niveau ${L}`);
    if (it.tier) assert.ok(L >= TIER_EQUIP_LEVEL[it.tier] - 0, `${it.id}`);
  }
});

test("le héros de départ peut porter tout son équipement de départ", () => {
  for (const classKey of Object.keys(CLASSES)) {
    const p = createPlayer({ name: "T", classKey, gender: "m" });
    for (const it of [...Object.values(p.equipped).filter(Boolean), ...p.inventory]) assert.ok(canEquipAtLevel(it, p.level), `${classKey} : ${it.id}`);
  }
});

test("les simulés ne portent jamais une pièce au-dessus de leur niveau", () => {
  for (const classKey of Object.keys(CLASSES)) {
    for (let level = 1; level <= 30; level++) {
      const g = tierGear(classKey, level);
      for (const id of Object.values(g)) assert.ok(canEquipAtLevel(ITEMS[id], level), `${classKey} niveau ${level} porte ${id} (niveau ${equipLevelOf(ITEMS[id])} requis)`);
    }
    for (const id of Object.values(starterGear(classKey) || {})) assert.ok(canEquipAtLevel(ITEMS[id], 1), `départ ${classKey} : ${id}`);
  }
  // le palier 3 des simulés (donjon) commence à 20, comme la règle
  assert.equal(tierOf(9), 0); assert.equal(tierOf(10), 1); assert.equal(tierOf(16), 2);
});

test("equipOn : refuse une pièce trop haute (même appelée directement), accepte au bon niveau, renvoie l'ancienne pièce au sac", () => {
  const piece = (id) => ({ ...structuredClone(ITEMS[id]), uid: `u-${id}` });
  const base = createPlayer({ name: "T", classKey: "guerrier", gender: "m" });
  base.equipped = { ...base.equipped, chapeau: piece("chapeau_veteran") };
  base.inventory = [piece("chapeau_fossoyeur"), piece("plastron_chevalier")];
  base.level = 7;
  assert.equal(equipOn(base, piece("chapeau_fossoyeur")), base, "palier 2 refusé au niveau 7 : même objet renvoyé");
  assert.equal(equipOn(base, piece("plastron_chevalier")), base, "palier 3 refusé au niveau 7");
  const l8 = { ...base, level: 8 };
  const r = equipOn(l8, l8.inventory[0]);
  assert.equal(r.equipped.chapeau.id, "chapeau_fossoyeur", "équipé au niveau 8");
  assert.ok(r.inventory.some((i) => i.id === "chapeau_veteran"), "l'ancien heaume revient au sac");
  assert.ok(!r.inventory.some((i) => i.id === "chapeau_fossoyeur"), "la pièce quitte le sac");
  const l13 = { ...base, level: 13 };
  assert.equal(equipOn(l13, base.inventory[1]), l13, "palier 3 toujours refusé au niveau 13");
  assert.equal(equipOn({ ...base, level: 14 }, base.inventory[1]).equipped.plastron.id, "plastron_chevalier", "accepté au niveau 14");
});

test("equipOn : une pièce déjà portée au-dessus du niveau (vieille sauvegarde) reste portée", () => {
  const p = createPlayer({ name: "T", classKey: "guerrier", gender: "m" });
  p.level = 3; p.equipped = { ...p.equipped, plastron: { ...structuredClone(ITEMS.plastron_chevalier), uid: "w" } };
  assert.equal(p.equipped.plastron.id, "plastron_chevalier");
  const other = { ...structuredClone(ITEMS.plastron_veteran), uid: "v" };
  const r = equipOn({ ...p, inventory: [other] }, other);       // on peut changer pour une pièce de son niveau
  assert.equal(r.equipped.plastron.id, "plastron_veteran");
});

console.log(`${n} tests ok`);
