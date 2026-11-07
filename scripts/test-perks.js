// Tests des avantages de métier :  node scripts/test-perks.js
import assert from "node:assert/strict";
import {
  perksFor, perkLines, rollGather, harvestDuration, rollRefineBonus, rollMasterwork, makeMasterwork, isMasterwork,
  PERK_MAX, perkProgress, FIND_RESOURCE,
} from "../src/utils/perks.js";
import { applyGather, rollHarvest } from "../src/utils/gathering.js";
import { applyRefine, applyCraft, canCraft, emptyProfessions, professionOf } from "../src/utils/crafting.js";
import { PROFESSIONS, PROFESSION_ORDER, MAX_PROFESSION_LEVEL } from "../src/data/professions.js";
import { ITEMS } from "../src/data/items.js";
import { RESOURCES } from "../src/data/resources.js";
import { calcStats } from "../src/utils/calcStats.js";
import { itemWorth, itemValue } from "../src/utils/market.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { makeRng } from "../src/sim/rng.js";
import { HARVEST_MS } from "../src/components/map/mapConstants.js";
import { craftFee, unitFee, taxFee } from "../src/utils/cityTax.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Avantages de métier");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const withLevel = (p, key, level) => ({ ...p, professions: { ...p.professions, [key]: { level, xp: 0 } } });
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 5000, resources: {}, ...extra });
const ALWAYS = () => 0, NEVER = () => 0.9999;

test("niveau 1 : aucun avantage ; niveau 100 : le maximum de chaque famille", () => {
  const g1 = perksFor("mineur", 1), g100 = perksFor("mineur", 100);
  assert.deepEqual([g1.speed, g1.double, g1.find], [1, 0, 0]);
  assert.ok(near(g100.speed, 1 - PERK_MAX.speed) && near(g100.double, PERK_MAX.double) && near(g100.find, PERK_MAX.find));
  assert.equal(perksFor("fondeur", 1).bonus, 0);
  assert.ok(near(perksFor("scieur", 100).bonus, PERK_MAX.bonus));
  assert.equal(perksFor("forgeron", 1).masterwork, 0);
  assert.ok(near(perksFor("tailleur", 100).masterwork, PERK_MAX.masterwork));
  assert.equal(MAX_PROFESSION_LEVEL, 100);
});

test("la courbe monte à chaque niveau, plus vite au début, et ne dépasse jamais le maximum", () => {
  let prev = -1, firstHalf = 0;
  for (let l = 1; l <= 100; l++) {
    const k = perkProgress(l);
    assert.ok(k > prev - 1e-12 && k >= 0 && k <= 1, `niveau ${l}`);
    if (l === 50) firstHalf = k;
    prev = k;
  }
  assert.ok(firstHalf > 0.5, "le niveau 50 devrait déjà donner plus de la moitié du maximum");
  assert.equal(perkProgress(0), 0);
  assert.equal(perkProgress(500), 1);                                                   // au-delà du maximum : plafonné
  assert.ok(perksFor("mineur", 10).double > 0 && perksFor("mineur", 10).double < PERK_MAX.double * 0.25);   // le niveau 10 reste modeste
  assert.ok(perksFor("mineur", 500).double <= PERK_MAX.double + 1e-9);
});

test("les avantages restent raisonnables au niveau maximum", () => {
  const p = perksFor("bucheron", 100);
  assert.ok(p.speed >= 0.2 - 1e-9 && p.double <= 0.5 && p.find <= 0.25);
  assert.ok(perksFor("fondeur", 100).bonus <= 0.4 && perksFor("forgeron", 100).masterwork <= 0.3);
});

test("chaque métier a ses avantages, affichables, avec la valeur du niveau suivant (sauf au maximum)", () => {
  for (const key of PROFESSION_ORDER) {
    const l5 = perkLines(key, 5, MAX_PROFESSION_LEVEL), lmax = perkLines(key, MAX_PROFESSION_LEVEL, MAX_PROFESSION_LEVEL);
    assert.ok(l5.length >= 1 && l5.every((l) => l.label && l.now.endsWith("%") && l.next), key);
    assert.ok(lmax.every((l) => l.next === null), key);
  }
  assert.equal(perkLines("mineur", 1, 100)[0].now, "0 %");
  assert.match(perkLines("mineur", 50, 100)[1].now, /^\d+(,\d)? %$/);                      // une décimale, virgule française
});

test("récolte : double et trouvaille sont tirées avec le niveau ; une trouvaille est un autre type de ressource du métier", () => {
  assert.deepEqual(rollGather(1, "mineur", 2, ALWAYS), { qty: 2, doubled: false, find: { veine_d_acier: 1 } }, "niveau 1 : pas de trouvaille de métier, mais la ressource rare de classe se trouve déjà");
  const lucky = rollGather(100, "mineur", 2, ALWAYS);
  assert.deepEqual(lucky, { qty: 4, doubled: true, find: { minerai_de_cuivre: 1, veine_d_acier: 1 } });
  const unlucky = rollGather(100, "mineur", 2, NEVER);
  assert.deepEqual(unlucky, { qty: 2, doubled: false, find: null });
  for (const [prof, res] of Object.entries(FIND_RESOURCE)) { assert.equal(PROFESSIONS[prof].kind, "gather"); assert.ok(RESOURCES[res]); assert.equal(RESOURCES[res].rarity, "peu_commune"); }
});

test("récolte : fréquences sur de nombreux tirages proches des pourcentages annoncés", () => {
  const rng = makeRng(42), p = perksFor("herboriste", 60);
  let d = 0, f = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const r = rollGather(60, "herboriste", 1, rng); if (r.doubled) d++; if (r.find?.sauge) f++; }
  assert.ok(Math.abs(d / N - p.double) < 0.02, `double ${d / N} au lieu de ${p.double}`);
  assert.ok(Math.abs(f / N - p.find) < 0.02, `trouvaille ${f / N} au lieu de ${p.find}`);
});

test("la durée de récolte baisse avec le niveau : 5 s au niveau 1, 1 s au niveau 100", () => {
  assert.equal(HARVEST_MS, 5000);
  assert.equal(harvestDuration(1, "bucheron", HARVEST_MS), 5000);
  assert.ok(harvestDuration(5, "bucheron", HARVEST_MS) < 5000);
  assert.ok(harvestDuration(50, "bucheron", HARVEST_MS) < harvestDuration(10, "bucheron", HARVEST_MS));
  assert.equal(harvestDuration(100, "bucheron", HARVEST_MS), 1000);
  for (let l = 1; l < 100; l++) assert.ok(harvestDuration(l, "mineur", HARVEST_MS) >= harvestDuration(l + 1, "mineur", HARVEST_MS), `niveau ${l}`);
  assert.ok(harvestDuration(500, "mineur", HARVEST_MS) >= 1000);                       // jamais en dessous de 1 s
});

test("applyGather ajoute la trouvaille en plus de la ressource, et compte pour les quêtes", () => {
  const p = base();
  const r = applyGather(p, "filon_de_fer", 3, { minerai_de_cuivre: 1 });
  assert.equal(r.player.resources.minerai_de_fer, 3);
  assert.equal(r.player.resources.minerai_de_cuivre, 1);
  assert.equal(r.player.quests.counters.gathered.minerai_de_cuivre, 1);
  assert.deepEqual(r.gained, { minerai_de_fer: 3, minerai_de_cuivre: 1 });
  assert.equal(applyGather(p, "filon_de_fer", 3).player.resources.minerai_de_cuivre, undefined);       // sans trouvaille : rien en plus
  const roll = rollHarvest(withLevel(p, "bucheron", 100), "frene", ALWAYS);
  assert.ok(roll.qty >= 2 && roll.doubled && roll.find.bois_de_chene === 1);
});

test("raffinage : une unité de plus avec le niveau, sans consommer plus", () => {
  assert.equal(rollRefineBonus(1, "fondeur", 50, ALWAYS), 0);
  assert.equal(rollRefineBonus(100, "fondeur", 5, ALWAYS), 5);
  assert.equal(rollRefineBonus(100, "fondeur", 5, NEVER), 0);
  const p = withLevel(base({ resources: { minerai_de_fer: 10 } }), "fondeur", 100);
  const r = applyRefine(p, "lingot_de_fer", 5, ALWAYS);
  assert.equal(r.bonus, 5);
  assert.equal(r.made, 10);
  assert.equal(r.player.resources.lingot_de_fer, 10);
  assert.equal(r.player.resources.minerai_de_fer, undefined);                                    // on n'a consommé que pour 5
  assert.equal(r.player.gold, p.gold - 5 * unitFee("lingot_de_fer"));
  const none = applyRefine(p, "lingot_de_fer", 5, NEVER);
  assert.deepEqual([none.made, none.bonus, none.player.resources.lingot_de_fer], [5, 0, 5]);
});

test("raffinage : fréquence du bonus proche de la valeur annoncée (niveau 40)", () => {
  const rng = makeRng(7), p = perksFor("tanneur", 40).bonus;
  const extra = rollRefineBonus(40, "tanneur", 20000, rng);
  assert.ok(Math.abs(extra / 20000 - p) < 0.02, `${extra / 20000} au lieu de ${p}`);
});

test("chef-d'œuvre : +10 % de stats (au moins +1), marqué, de même identité", () => {
  const base_ = ITEMS.chapeau_veteran, mw = makeMasterwork(base_);
  assert.ok(isMasterwork(mw) && !isMasterwork(base_));
  assert.equal(mw.id, base_.id);
  assert.ok(mw.name.includes("chef-d'œuvre"));
  assert.ok(mw.def_phys > base_.def_phys && mw.hp > base_.hp);
  assert.equal(mw.def_phys, Math.max(base_.def_phys + 1, Math.round(base_.def_phys * 1.1)));
  assert.equal(mw.set, base_.set);
  assert.equal(mw.type, base_.type);
  for (const id of Object.keys(ITEMS)) { const m = makeMasterwork(ITEMS[id]); for (const k of ["atk_phys", "atk_magie", "def_phys", "def_magie", "hp"]) if (ITEMS[id][k]) assert.ok(m[k] > ITEMS[id][k], `${id}.${k}`); }
  assert.equal(base_.name.includes("chef"), false);                                              // l'objet d'origine n'est pas modifié
});

test("fabrication : niveau 1 jamais de chef-d'œuvre ; niveau haut, il peut sortir et l'objet est équipable avec ses stats", () => {
  const mats = { cuir_de_sanglier: 5, lingot_de_fer: 5, defense_ebrechee: 5 };
  const lvl1 = base({ resources: mats, professions: emptyProfessions(PROFESSION_ORDER) });
  const a = applyCraft(lvl1, "gants_veteran", "g1", ALWAYS);
  assert.equal(isMasterwork(a.inventory[a.inventory.length - 1]), false);
  const lvl10 = withLevel(lvl1, "forgeron", 100);
  const b = applyCraft(lvl10, "gants_veteran", "g2", ALWAYS);
  const it = b.inventory[b.inventory.length - 1];
  assert.ok(isMasterwork(it) && it.uid === "g2" && it.id === "gants_veteran");
  assert.equal(b.quests.counters.crafted.gants_veteran, 1);                                      // compte pour les quêtes
  assert.equal(isMasterwork(applyCraft(lvl10, "gants_veteran", "g3", NEVER).inventory.at(-1)), false);
  const normal = { ...lvl1, equipped: { ...lvl1.equipped, gants: a.inventory.at(-1) } };
  const master = { ...lvl1, equipped: { ...lvl1.equipped, gants: it } };
  assert.ok(calcStats(master).defPhys > calcStats(normal).defPhys, "les stats du chef-d'œuvre comptent");
  assert.ok(canCraft(lvl10, "gants_veteran").ok);
});

test("fabrication : fréquence de chef-d'œuvre proche de la valeur annoncée (niveau 70)", () => {
  const rng = makeRng(99), p = perksFor("forgeron", 70).masterwork;
  let c = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (rollMasterwork(70, "forgeron", rng)) c++;
  assert.ok(Math.abs(c / N - p) < 0.02, `${c / N} au lieu de ${p}`);
});

test("un chef-d'œuvre vaut 25 % de plus à l'hôtel des ventes", () => {
  const it = makeMasterwork(ITEMS.chapeau_veteran);
  assert.ok(Math.abs(itemWorth(it) - itemValue("chapeau_veteran") * 1.25) < 1e-9);
  assert.equal(itemWorth(ITEMS.chapeau_veteran), itemValue("chapeau_veteran"));
});

test("anciennes sauvegardes (métiers absents) : niveau 1, aucun avantage, aucune erreur", () => {
  const old = base({ resources: { minerai_de_fer: 4 } }); old.professions = {};
  assert.equal(professionOf(old, "fondeur").level, 1);
  assert.equal(applyRefine(old, "lingot_de_fer", 2).made, 2);
  assert.ok(rollHarvest(old, "frene").qty >= 1);
});

console.log(`\n${n} tests passent.`);
