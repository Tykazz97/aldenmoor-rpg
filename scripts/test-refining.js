// Tests du raffinage :  node scripts/test-refining.js
import assert from "node:assert/strict";
import { REFINING, REFINING_ORDER, refiningOf } from "../src/data/refining.js";
import { RESOURCES } from "../src/data/resources.js";
import { RECIPES } from "../src/data/recipes.js";
import { PROFESSIONS, PROFESSION_ORDER } from "../src/data/professions.js";
import { canRefine, applyRefine, maxRefine, applyCraft, canCraft, professionOf, emptyProfessions } from "../src/utils/crafting.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { newMarket, listingsFor } from "../src/utils/market.js";
import { craftFee, unitFee, taxFee } from "../src/utils/cityTax.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Raffinage");

const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 200, resources: { minerai_de_fer: 10, bois_de_frene: 5, ortie: 4 }, ...extra });

test("chaque ressource raffinée a sa recette, son métier et vaut plus que ce qu'elle consomme", () => {
  for (const [id, rec] of Object.entries(REFINING)) {
    assert.equal(RESOURCES[id].source, "raffinage", id);
    assert.equal(PROFESSIONS[rec.profession].kind, "refine", id);
    const raw = Object.entries(rec.ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, 0);
    assert.ok(RESOURCES[id].value > raw, `${id} : ${RESOURCES[id].value} pour ${raw}`);
    assert.ok(RESOURCES[id].value <= raw * 1.6, `${id} : bénéfice trop gros`);
  }
  assert.ok(Object.values(RESOURCES).filter((r) => r.source === "raffinage").every((r) => REFINING[r.id]));
  assert.ok(["fondeur", "scieur", "tanneur", "tisserand"].every((k) => refiningOf(k).length >= 1 && PROFESSION_ORDER.includes(k)));
});

test("raffiner : 2 matières brutes + de l'or donnent 1 matière raffinée et de l'xp de métier", () => {
  const r = applyRefine(base(), "lingot_de_fer", 1);
  assert.equal(r.made, 1);
  assert.equal(r.player.resources.minerai_de_fer, 8);
  assert.equal(r.player.resources.lingot_de_fer, 1);
  assert.equal(r.player.gold, 200 - unitFee("lingot_de_fer"));
  assert.deepEqual(r.player.professions.fondeur, { level: 1, xp: REFINING.lingot_de_fer.xp });
  assert.equal(r.player.professions.forgeron.level, 1);
});

test("par lots : ×5 et maximum, coût et xp proportionnels", () => {
  const p = base();
  assert.equal(maxRefine(p, "lingot_de_fer"), 5);
  const r = applyRefine(p, "lingot_de_fer", 5);
  assert.equal(r.made, 5);
  assert.equal(r.player.resources.minerai_de_fer, undefined);                             // tout consommé : l'entrée disparaît
  assert.equal(r.player.resources.lingot_de_fer, 5);
  assert.equal(r.player.gold, 200 - 5 * unitFee("lingot_de_fer"));
  assert.deepEqual(r.player.professions.fondeur, { level: 1, xp: 25 });                    // 5 × 5 xp, il en faut 30 pour le niveau 2
  assert.equal(applyRefine({ ...p, resources: { minerai_de_fer: 12 }, gold: 100 }, "lingot_de_fer", 6).player.professions.fondeur.level, 2);
});

test("refus : pas assez de matières, d'or ou de niveau (le joueur ne change pas)", () => {
  const p = base();
  assert.equal(applyRefine(p, "lingot_de_fer", 6).player, p);
  const poor = { ...p, gold: 0 };
  assert.equal(applyRefine(poor, "lingot_de_fer", 1).player, poor);
  assert.equal(canRefine({ ...p, gold: 0 }, "lingot_de_fer").lacksGold, true);
  const copper = { ...p, resources: { minerai_de_cuivre: 10 } };
  assert.equal(canRefine(copper, "lingot_de_cuivre").lacksLevel, true);
  assert.equal(maxRefine(copper, "lingot_de_cuivre"), 0);
  assert.equal(applyRefine(copper, "lingot_de_cuivre", 1).made, 0);
  assert.equal(applyRefine(p, "n_importe_quoi", 1).made, 0);
  assert.equal(applyRefine(p, "lingot_de_fer", 0).made, 0);
  assert.equal(applyRefine(p, "lingot_de_fer", -2).made, 0);
});

test("le niveau du métier débloque le cuivre et le chêne", () => {
  let p = base({ resources: { minerai_de_cuivre: 10, minerai_de_fer: 40 }, gold: 1000 });
  assert.equal(canRefine(p, "lingot_de_cuivre").ok, false);
  while (professionOf(p, "fondeur").level < 3) p = applyRefine(p, "lingot_de_fer", 4).player;
  assert.ok(canRefine(p, "lingot_de_cuivre").ok);
});

test("anciennes sauvegardes sans métiers de raffinage : niveau 1 par défaut, rien ne plante", () => {
  const old = base(); old.professions = { forgeron: { level: 1, xp: 0 } };
  assert.deepEqual(professionOf(old, "fondeur"), { level: 1, xp: 0 });
  const r = applyRefine(old, "lingot_de_fer", 2);
  assert.equal(r.made, 2);
  assert.equal(r.player.professions.fondeur.xp, 2 * REFINING.lingot_de_fer.xp);
});

test("aucune recette d'équipement ne demande de matière brute qui se raffine", () => {
  const rawOfRefined = new Set(REFINING_ORDER.flatMap((id) => Object.keys(REFINING[id].ingredients)));
  for (const [item, rec] of Object.entries(RECIPES)) for (const r of Object.keys(rec.ingredients)) assert.ok(!rawOfRefined.has(r), `${item} demande ${r} (brut)`);
  const used = new Set(Object.values(RECIPES).flatMap((r) => Object.keys(r.ingredients)));
  for (const id of REFINING_ORDER) assert.ok(used.has(id), `${id} n'est utilisée par aucune recette`);
});

test("chaîne complète : récolte → raffinage → fabrication", () => {
  let p = base({ gold: 500, resources: { peau_de_sanglier: 4, minerai_de_fer: 2, defense_ebrechee: 1 }, professions: emptyProfessions(PROFESSION_ORDER) });
  assert.equal(canCraft(p, "gants_veteran").ok, false);                                   // les brutes ne suffisent plus
  p = applyRefine(p, "cuir_de_sanglier", 2).player;
  p = applyRefine(p, "lingot_de_fer", 1).player;
  assert.equal(canCraft(p, "gants_veteran").ok, true);
  const done = applyCraft(p, "gants_veteran", "g1");
  assert.equal(done.inventory.length, 1);
  assert.equal(done.resources.cuir_de_sanglier, undefined);
});

test("les ressources raffinées sont vendues à l'hôtel des ventes par les joueurs simulés", () => {
  const m = newMarket(Date.UTC(2026, 10, 7, 12));
  for (const id of REFINING_ORDER) assert.ok(listingsFor(m, id).length >= 1, `aucune annonce pour ${id}`);
});

console.log(`\n${n} tests passent.`);
