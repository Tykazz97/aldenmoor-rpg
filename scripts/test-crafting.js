import { canCraft, applyCraft, addResourcesTo, emptyProfessions } from "../src/utils/crafting.js";
import { PROFESSION_ORDER } from "../src/data/professions.js";
import { RESOURCE_ORDER, RESOURCES } from "../src/data/resources.js";
import assert from "node:assert/strict";

let p = { gold: 0, resources: {}, inventory: [], professions: emptyProfessions(PROFESSION_ORDER) };

// 1. rien => impossible
assert.equal(canCraft(p, "gants_veteran").ok, false);
assert.equal(applyCraft(p, "gants_veteran", "u1"), p);

// 2. ressources + or
const gains = Object.fromEntries(RESOURCE_ORDER.map((id) => [id, { commune: 30, peu_commune: 10, rare: 2 }[RESOURCES[id].rarity]]));
p = { ...addResourcesTo(p, gains), gold: 500 };
assert.equal(canCraft(p, "gants_veteran").ok, true);

// 3. plastron demande niveau 3
assert.equal(canCraft(p, "plastron_veteran").lacksLevel, true);

// 4. craft consomme et donne de l'xp
const before = p.resources.cuir_de_sanglier;
p = applyCraft(p, "gants_veteran", "u1");
assert.equal(p.resources.cuir_de_sanglier, before - 2);
assert.equal(p.gold, 500 - craftFee("gants_veteran"));
assert.equal(p.inventory.length, 1);
assert.equal(p.inventory[0].uid, "u1");
assert.deepEqual(p.professions.forgeron, { level: 1, xp: 25 });

// 5. montée de niveau (25 + 25 = 50 >= 30 -> niveau 2, reste 20)
p = applyCraft(p, "ceinture_veteran", "u2");
assert.deepEqual(p.professions.forgeron, { level: 2, xp: 20 });

// 6. les autres métiers ne bougent pas
assert.deepEqual(p.professions.tailleur, { level: 1, xp: 0 });

// 7. la ressource à 0 est supprimée de l'inventaire
let q = { gold: 100, resources: { cuir_de_sanglier: 2, lingot_de_fer: 1, defense_ebrechee: 1 }, inventory: [], professions: emptyProfessions(PROFESSION_ORDER) };
q = applyCraft(q, "gants_veteran", "x");
assert.deepEqual(q.resources, {});

// 8. progression complète du set vétéran jusqu'au plastron
let r = { ...addResourcesTo({ gold: 1000, resources: {}, inventory: [], professions: emptyProfessions(PROFESSION_ORDER) }, gains) };
for (const id of ["gants_veteran", "ceinture_veteran", "chapeau_veteran", "jambieres_veteran"]) {
  assert.equal(canCraft(r, id).ok, true, id);
  r = applyCraft(r, id, id);
}
assert.equal(r.professions.forgeron.level, 3);
assert.equal(canCraft(r, "plastron_veteran").ok, true);

// 9. niveau maximum des métiers : 100 (courbe de 30 xp × niveau)
import { gainProfessionXp } from "../src/utils/crafting.js";
import { MAX_PROFESSION_LEVEL, xpForLevel } from "../src/data/professions.js";
import { craftFee } from "../src/utils/cityTax.js";
assert.equal(MAX_PROFESSION_LEVEL, 100);
assert.equal(xpForLevel(1), 30);
assert.equal(xpForLevel(99), 2970);
let total = 0; for (let l = 1; l < MAX_PROFESSION_LEVEL; l++) total += xpForLevel(l);
assert.equal(total, 148500);
assert.deepEqual(gainProfessionXp({ level: 1, xp: 0 }, 30), { level: 2, xp: 0 });
assert.deepEqual(gainProfessionXp({ level: 10, xp: 0 }, 5), { level: 10, xp: 5 });               // l'ancien plafond (10) n'en est plus un
assert.deepEqual(gainProfessionXp({ level: 10, xp: 299 }, 1), { level: 11, xp: 0 });
assert.deepEqual(gainProfessionXp({ level: 1, xp: 0 }, 1350), { level: 10, xp: 0 });             // plusieurs niveaux d'un coup
assert.deepEqual(gainProfessionXp({ level: 1, xp: 0 }, total), { level: 100, xp: 0 });
assert.deepEqual(gainProfessionXp({ level: 99, xp: 2900 }, 5000), { level: 100, xp: 0 });        // plafonné : l'excédent est perdu
assert.deepEqual(gainProfessionXp({ level: 100, xp: 0 }, 50), { level: 100, xp: 0 });

console.log("craft : tous les tests passent");
