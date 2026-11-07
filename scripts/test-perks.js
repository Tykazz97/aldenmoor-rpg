// Tests des avantages de métier :  node scripts/test-perks.js
import assert from "node:assert/strict";
import {
  perksFor, perkLines, rollGather, harvestDuration, rollRefineBonus, rollMasterwork, makeMasterwork, isMasterwork,
  GATHER_SPEED_STEP, GATHER_DOUBLE_STEP, GATHER_FIND_STEP, REFINE_BONUS_STEP, CRAFT_MASTERWORK_STEP, FIND_RESOURCE,
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

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Avantages de métier");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const withLevel = (p, key, level) => ({ ...p, professions: { ...p.professions, [key]: { level, xp: 0 } } });
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 5000, resources: {}, ...extra });
const ALWAYS = () => 0, NEVER = () => 0.9999;

test("niveau 1 : aucun avantage ; niveau 10 : le maximum de chaque famille", () => {
  const g1 = perksFor("mineur", 1), g10 = perksFor("mineur", 10);
  assert.deepEqual([g1.speed, g1.double, g1.find], [1, 0, 0]);
  assert.ok(near(g10.speed, 1 - 9 * GATHER_SPEED_STEP) && near(g10.double, 9 * GATHER_DOUBLE_STEP) && near(g10.find, 9 * GATHER_FIND_STEP));
  assert.equal(perksFor("fondeur", 1).bonus, 0);
  assert.ok(near(perksFor("scieur", 10).bonus, 9 * REFINE_BONUS_STEP));
  assert.equal(perksFor("forgeron", 1).masterwork, 0);
  assert.ok(near(perksFor("tailleur", 10).masterwork, 9 * CRAFT_MASTERWORK_STEP));
  assert.equal(MAX_PROFESSION_LEVEL, 10);
});

test("les avantages restent raisonnables au niveau maximum", () => {
  const p = perksFor("bucheron", 10);
  assert.ok(p.speed >= 0.6 && p.double <= 0.5 && p.find <= 0.25);
  assert.ok(perksFor("fondeur", 10).bonus <= 0.4 && perksFor("forgeron", 10).masterwork <= 0.3);
});

test("chaque métier a ses avantages, affichables, avec la valeur du niveau suivant (sauf au maximum)", () => {
  for (const key of PROFESSION_ORDER) {
    const l5 = perkLines(key, 5, MAX_PROFESSION_LEVEL), l10 = perkLines(key, MAX_PROFESSION_LEVEL, MAX_PROFESSION_LEVEL);
    assert.ok(l5.length >= 1 && l5.every((l) => l.label && l.now.endsWith("%") && l.next), key);
    assert.ok(l10.every((l) => l.next === null), key);
  }
  assert.equal(perkLines("mineur", 1, 10)[0].now, "0 %");
});

test("récolte : double et trouvaille sont tirées avec le niveau ; une trouvaille est un autre type de ressource du métier", () => {
  assert.deepEqual(rollGather(1, "mineur", 2, ALWAYS), { qty: 2, doubled: false, find: null });
  const lucky = rollGather(10, "mineur", 2, ALWAYS);
  assert.deepEqual(lucky, { qty: 4, doubled: true, find: { minerai_de_cuivre: 1 } });
  const unlucky = rollGather(10, "mineur", 2, NEVER);
  assert.deepEqual(unlucky, { qty: 2, doubled: false, find: null });
  for (const [prof, res] of Object.entries(FIND_RESOURCE)) { assert.equal(PROFESSIONS[prof].kind, "gather"); assert.ok(RESOURCES[res]); assert.equal(RESOURCES[res].rarity, "peu_commune"); }
});

test("récolte : fréquences sur de nombreux tirages proches des pourcentages annoncés", () => {
  const rng = makeRng(42);
  let d = 0, f = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const r = rollGather(6, "herboriste", 1, rng); if (r.doubled) d++; if (r.find) f++; }
  assert.ok(Math.abs(d / N - 0.25) < 0.02, `double ${d / N}`);
  assert.ok(Math.abs(f / N - 0.10) < 0.02, `trouvaille ${f / N}`);
});

test("la durée de récolte baisse avec le niveau, jamais en dessous de 60 %", () => {
  assert.equal(harvestDuration(1, "bucheron", 2000), 2000);
  assert.ok(harvestDuration(5, "bucheron", 2000) < 2000);
  assert.equal(harvestDuration(10, "bucheron", 2000), Math.round(2000 * (1 - 9 * GATHER_SPEED_STEP)));
  assert.ok(harvestDuration(10, "bucheron", 2000) >= 1200);
});

test("applyGather ajoute la trouvaille en plus de la ressource, et compte pour les quêtes", () => {
  const p = base();
  const r = applyGather(p, "filon_de_fer", 3, { minerai_de_cuivre: 1 });
  assert.equal(r.player.resources.minerai_de_fer, 3);
  assert.equal(r.player.resources.minerai_de_cuivre, 1);
  assert.equal(r.player.quests.counters.gathered.minerai_de_cuivre, 1);
  assert.deepEqual(r.gained, { minerai_de_fer: 3, minerai_de_cuivre: 1 });
  assert.equal(applyGather(p, "filon_de_fer", 3).player.resources.minerai_de_cuivre, undefined);       // sans trouvaille : rien en plus
  const roll = rollHarvest(withLevel(p, "bucheron", 10), "frene", ALWAYS);
  assert.ok(roll.qty >= 2 && roll.doubled && roll.find.bois_de_chene === 1);
});

test("raffinage : une unité de plus avec le niveau, sans consommer plus", () => {
  assert.equal(rollRefineBonus(1, "fondeur", 50, ALWAYS), 0);
  assert.equal(rollRefineBonus(10, "fondeur", 5, ALWAYS), 5);
  assert.equal(rollRefineBonus(10, "fondeur", 5, NEVER), 0);
  const p = withLevel(base({ resources: { minerai_de_fer: 10 } }), "fondeur", 10);
  const r = applyRefine(p, "lingot_de_fer", 5, ALWAYS);
  assert.equal(r.bonus, 5);
  assert.equal(r.made, 10);
  assert.equal(r.player.resources.lingot_de_fer, 10);
  assert.equal(r.player.resources.minerai_de_fer, undefined);                                    // on n'a consommé que pour 5
  assert.equal(r.player.gold, p.gold - 5 * 2);
  const none = applyRefine(p, "lingot_de_fer", 5, NEVER);
  assert.deepEqual([none.made, none.bonus, none.player.resources.lingot_de_fer], [5, 0, 5]);
});

test("raffinage : fréquence du bonus proche de 36 % au niveau 10", () => {
  const rng = makeRng(7);
  const extra = rollRefineBonus(10, "tanneur", 20000, rng);
  assert.ok(Math.abs(extra / 20000 - 0.36) < 0.02, `${extra / 20000}`);
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
  const lvl10 = withLevel(lvl1, "forgeron", 10);
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

test("fabrication : fréquence de chef-d'œuvre proche de 27 % au niveau 10", () => {
  const rng = makeRng(99);
  let c = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (rollMasterwork(10, "forgeron", rng)) c++;
  assert.ok(Math.abs(c / N - 0.27) < 0.02, `${c / N}`);
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
