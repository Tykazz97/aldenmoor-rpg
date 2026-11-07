// Tests de la taxe de fabrication des villes :  node scripts/test-citytax.js
import assert from "node:assert/strict";
import { DEFAULT_TAX_RATE, TAX_MIN, TAX_MAX, clampTaxRate, taxFee, craftFee, unitFee, recordTax } from "../src/utils/cityTax.js";
import { CITIES, cityOfMap, zoneOfMap, cityTaxRate, workshopOf } from "../src/data/cities.js";
import { MAPS, CITY_KEY } from "../src/data/maps.js";
import { itemValue } from "../src/utils/itemValue.js";
import { RESOURCES } from "../src/data/resources.js";
import { canCraft, applyCraft, canRefine, applyRefine, applyBrew, maxRefine, maxBrew, emptyProfessions } from "../src/utils/crafting.js";
import { PROFESSION_ORDER } from "../src/data/professions.js";
import { RECIPES } from "../src/data/recipes.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Taxe de fabrication");

const gear = "gants_veteran";
const player = (extra = {}) => ({ gold: 1000, resources: { ...RECIPES[gear].ingredients, minerai_de_fer: 20, ortie: 20 }, inventory: [], professions: emptyProfessions(PROFESSION_ORDER), ...extra });

test("la taxe par défaut est 1 %, réglable de 0 % à 5 % seulement", () => {
  assert.equal(DEFAULT_TAX_RATE, 0.01); assert.equal(TAX_MIN, 0); assert.equal(TAX_MAX, 0.05);
  assert.equal(clampTaxRate(0.2), 0.05); assert.equal(clampTaxRate(-1), 0); assert.equal(clampTaxRate(0.03), 0.03);
  assert.equal(clampTaxRate(undefined), 0.01); assert.equal(clampTaxRate(NaN), 0.01);
});

test("la taxe est un pourcentage du prix de ce qu'on obtient, au moins 1 or, nulle à 0 %", () => {
  assert.equal(taxFee(1000), 10); assert.equal(taxFee(1000, 0.05), 50); assert.equal(taxFee(1000, 0), 0);
  assert.equal(taxFee(8), 1, "1 or au minimum");
  assert.equal(taxFee(1000, 0.5), 50, "plafonnée à 5 %");
  for (const id of ["plastron_veteran", "cle_du_manoir", "epee_milicien"]) assert.equal(craftFee(id), Math.max(1, Math.round(itemValue(id) * 0.01)), id);
  assert.equal(unitFee("lingot_de_fer"), 1);
  assert.equal(unitFee("elixir_de_rappel"), Math.round(RESOURCES.elixir_de_rappel.value * 0.01));
  assert.ok(craftFee("cle_du_manoir", 0.05) > craftFee("cle_du_manoir") * 4);
});

test("fabriquer : la taxe remplace le coût de la recette, et elle est inscrite au registre de la ville", () => {
  const p = player(), fee = craftFee(gear);
  assert.ok(fee < RECIPES[gear].gold, "bien moins que l'ancien coût fixe");
  assert.equal(canCraft(p, gear).fee, fee);
  const after = applyCraft(p, gear, "u1", Math.random, { city: "aldenmoor" });
  assert.equal(after.gold, 1000 - fee);
  assert.deepEqual(after.taxPaid, { aldenmoor: fee });
  const again = applyCraft({ ...after, resources: { ...p.resources } }, gear, "u2", Math.random, { city: "aldenmoor" });
  assert.equal(again.taxPaid.aldenmoor, 2 * fee, "le registre s'additionne");
  assert.equal(after.professions.forgeron.xp + 30 * (after.professions.forgeron.level - 1) > 0, true, "l'xp de métier est inchangée");
});

test("taux de la ville : 0 % = gratuit, 5 % = cinq fois plus ; sans or pour la taxe, pas de fabrication", () => {
  const free = applyCraft(player(), gear, "u", Math.random, { rate: 0, city: "aldenmoor" });
  assert.equal(free.gold, 1000); assert.equal(free.taxPaid, undefined, "rien à inscrire");
  const dear = applyCraft(player(), gear, "u", Math.random, { rate: 0.05, city: "aldenmoor" });
  assert.equal(dear.gold, 1000 - craftFee(gear, 0.05));
  assert.ok(craftFee(gear, 0.05) >= 4 * craftFee(gear, 0.01));
  const poor = player({ gold: craftFee(gear, 0.05) - 1 });
  assert.equal(canCraft(poor, gear, { rate: 0.05 }).lacksGold, true);
  assert.equal(canCraft(poor, gear, { rate: 0.01 }).lacksGold, false, "mais la taxe par défaut passe");
  assert.equal(applyCraft(poor, gear, "u", Math.random, { rate: 0.05 }), poor);
});

test("raffiner et distiller : même taxe, par unité obtenue", () => {
  const p = player();
  const r = applyRefine(p, "lingot_de_fer", 4, () => 0.99, { city: "aldenmoor" });
  assert.equal(r.player.gold, 1000 - 4 * unitFee("lingot_de_fer")); assert.equal(r.player.taxPaid.aldenmoor, 4);
  assert.equal(maxRefine(player({ gold: 3 }), "lingot_de_fer"), 3);
  assert.equal(maxRefine(player({ gold: 0 }), "lingot_de_fer", { rate: 0 }), 10, "gratuit : limité par les matières");
  assert.equal(canRefine(player({ gold: 0 }), "lingot_de_fer").lacksGold, true);
  const alch = { ...p, professions: { ...p.professions, alchimiste: { level: 1, xp: 0 } } };
  const b = applyBrew(alch, "potion_mineure", 3, () => 0.99, { city: "aldenmoor", rate: 0.05 });
  assert.equal(b.player.gold, 1000 - 3 * unitFee("potion_mineure", 0.05)); assert.equal(b.player.taxPaid.aldenmoor, 3 * unitFee("potion_mineure", 0.05));
  assert.equal(maxBrew(player({ gold: 0 }), "potion_mineure", { rate: 0 }), 6, "gratuit : limité par les orties");
});

test("la ville dépend de la grande région : où que tu sois (ville, prairie, lisière), c'est la taxe d'Aldenmoor", () => {
  assert.equal(CITIES.aldenmoor.taxRate, 0.01); assert.equal(CITIES.aldenmoor.guild, null);
  for (const key of Object.keys(MAPS)) { assert.equal(cityOfMap(key)?.key, "aldenmoor", key); assert.equal(zoneOfMap(key), "aldenmoor"); }
  assert.equal(workshopOf({ mapKey: CITY_KEY }).place, null);
  assert.equal(workshopOf({ mapKey: "lisiere_des_ombres" }).place, "Lisière des Ombres");
  assert.equal(workshopOf({ mapKey: "prairies_sauvages" }).name, "Aldenmoor");
  assert.equal(workshopOf(null).key, "aldenmoor", "position inconnue : la ville par défaut");
});

test("la guilde fixera le taux dans world.cities, toujours entre 0 % et 5 %", () => {
  assert.equal(workshopOf({ mapKey: "champs_calcines" }).rate, 0.01);
  assert.equal(workshopOf({ mapKey: "champs_calcines", cities: { aldenmoor: { taxRate: 0.03 } } }).rate, 0.03);
  assert.equal(cityTaxRate({ cities: { aldenmoor: { taxRate: 0.5 } } }, "aldenmoor"), 0.05);
  assert.equal(cityTaxRate({ cities: { aldenmoor: { taxRate: -0.2 } } }, "aldenmoor"), 0);
  assert.equal(cityTaxRate({ cities: { aldenmoor: { taxRate: 0 } } }, "aldenmoor"), 0, "0 % est un vrai choix");
});

test("recordTax : rien à inscrire = le même joueur", () => {
  const p = player();
  assert.equal(recordTax(p, "aldenmoor", 0), p); assert.equal(recordTax(p, null, 5), p);
  assert.deepEqual(recordTax(recordTax(p, "aldenmoor", 5), "aldenmoor", 2).taxPaid, { aldenmoor: 7 });
});

console.log(`\n${n} tests passent.`);
