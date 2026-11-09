// Tests du bestiaire :  node scripts/test-bestiary.js
// Le point important : les pourcentages affichés doivent être exactement ceux que le combat applique (engine.js, rollRewards).
import assert from "node:assert/strict";
import { ENEMIES } from "../src/data/zones.js";
import { RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { createCombat, advance, castSpell, endTurn, PARTY_DROP_MULT } from "../src/combat/engine.js";
import { gearSections, gearCount, recipeOf, itemDrops, resourceSources, setTotals, itemStats, gearMatches, setClass } from "../src/utils/gearbook.js";
import { SETS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { dropMultiplier, dropRate, dropVisibleFor, bestiarySections, spellsOf, spellFrequencies, phasesOf, effectText, matchesSearch, pct, expectedQty, hpFor } from "../src/utils/bestiary.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Bestiaire");

test("le bonus de butin et le groupe se multiplient, comme au combat", () => {
  assert.equal(dropMultiplier(0, 1), 1);
  assert.ok(Math.abs(dropMultiplier(20, 1) - 1.2) < 1e-9);
  assert.ok(Math.abs(dropMultiplier(20, 2) - 1.2 * PARTY_DROP_MULT[2]) < 1e-9);
  assert.ok(Math.abs(dropMultiplier(0, 3) - PARTY_DROP_MULT[3]) < 1e-9);
});

test("dropRate : bonus appliqué, plafond à 100 %, drop fixe jamais modifié", () => {
  const r = dropRate({ chance: 0.1 }, 50, 2);
  assert.ok(Math.abs(r.rate - 0.1 * 1.5 * PARTY_DROP_MULT[2]) < 1e-9);
  assert.equal(r.boosted, true);
  assert.equal(dropRate({ chance: 0.9 }, 50, 3).rate, 1);
  assert.equal(dropRate({ chance: 0.9 }, 50, 3).capped, true);
  const fixed = dropRate({ chance: 0.003, fixed: true }, 300, 3);
  assert.equal(fixed.rate, 0.003);
  assert.equal(fixed.boosted, false);
  assert.equal(dropRate({ chance: 0.5 }, 0, 1).boosted, false);
});

test("les butins réservés à une classe ne sont possibles que pour elle", () => {
  const d = { chance: 0.05, forClass: "guerrier" };
  assert.equal(dropVisibleFor(d, "guerrier"), true);
  assert.equal(dropVisibleFor(d, "magicien"), false);
  assert.equal(dropVisibleFor({ chance: 0.5 }, "magicien"), true);
});

test("la quantité moyenne attendue suit le taux affiché", () => {
  const d = { chance: 0.5, min: 1, max: 3 };
  assert.ok(Math.abs(expectedQty(d, 0, 1) - 1) < 1e-9);
});

test("format des pourcentages", () => {
  assert.equal(pct(0.5), "50 %");
  assert.equal(pct(1), "100 %");
  assert.equal(pct(0.003), "0,3 %");
  assert.equal(pct(0.0125), "1,25 %");
});

test("tous les monstres du jeu sont dans le bestiaire, une seule fois, avec visuel et butin connu", () => {
  const sections = bestiarySections();
  const keys = sections.flatMap((s) => s.entries.map((e) => e.key));
  assert.equal(new Set(keys).size, keys.length, "pas de doublon");
  const summonedOnly = [];   // renforts appelés en combat : pas de butin, donc pas dans le bestiaire (déjà listés ailleurs)
  for (const k of Object.keys(ENEMIES)) if (!keys.includes(k) && !summonedOnly.includes(k)) assert.fail(`monstre absent du bestiaire : ${k}`);
  for (const s of sections) for (const e of s.entries) {
    assert.ok(e.enemy, `${e.key} existe`);
    assert.ok(e.enemy.img, `${e.key} a une image`);
    for (const d of e.enemy.drops) assert.ok(d.type === "resource" ? RESOURCES[d.id] : ITEMS[d.id], `${e.key} : butin inconnu ${d.id}`);
  }
  assert.ok(sections.some((s) => s.id === "manoir_difficile"), "version difficile du donjon");
});

test("les pourcentages affichés correspondent au vrai tirage en combat", () => {
  // loup des plaines, joueur avec +30 % de butin : la fréquence observée sur de vrais combats colle au taux affiché
  const stats = { atkPhys: 900, atkMagie: 0, defPhys: 0, defMagie: 0, maxHp: 99999, esquive: 0, critique: 0, vitesse: 20, dropBonus: 30, setBonuses: [] };
  const target = ENEMIES.loup_des_plaines.drops.find((d) => d.id === "fourrure_grise");
  const expected = dropRate(target, 30, 1).rate;
  let hits = 0; const N = 2500;
  for (let i = 0; i < N; i++) {
    let st = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 50, enemyKeys: ["loup_des_plaines"], seed: i + 1 });
    for (let g = 0; g < 60 && !st.rewards; g++) {
      st = advance(st).state;
      if (st.phase === "playerTurn") {
        const r = castSpell(st, "taillade", st.enemies.find((e) => e.alive)?.id);
        st = r.state;
        if (!st.rewards) st = endTurn(st).state;
      }
    }
    assert.ok(st.rewards, "le combat se termine");
    if (st.rewards.resources.fourrure_grise) hits++;
  }
  const seen = hits / N;
  assert.ok(Math.abs(seen - expected) < 0.035, `observé ${seen.toFixed(3)} vs affiché ${expected.toFixed(3)}`);
});

test("sorts : texte, phases et fréquences", () => {
  const dame = ENEMIES.dame_en_deuil;
  const sp = spellsOf(dame);
  assert.equal(sp.length, dame.actions.length);
  assert.ok(sp.find((x) => x.id === "flamme_du_rituel").belowHp === 50, "sort de seconde phase signalé");
  assert.equal(sp.find((x) => x.id === "plainte_glaciale").belowHp, null);
  assert.ok(sp.every((x) => x.pa > 0 && x.power > 0));
  const f = spellFrequencies(dame);
  const first = Object.values(f).reduce((s, x) => s + x.first, 0), second = Object.values(f).reduce((s, x) => s + x.second, 0);
  assert.ok(Math.abs(first - 1) < 1e-9 && Math.abs(second - 1) < 1e-9, "les fréquences font 100 % dans chaque phase");
  assert.match(effectText({ kind: "paLoss", value: 2 }), /2 PA/);
  assert.match(effectText({ kind: "defDown", turns: 2, value: 0.3 }), /30 %/);
  assert.match(effectText({ kind: "dot", element: "feu", turns: 3, ratio: 0.3 }), /Brûle/);
  assert.equal(effectText(null), null);
});

test("phases : renforts et bonus d'attaque, sans « NaN »", () => {
  const v = phasesOf(ENEMIES.veilleur_corrompu);
  assert.equal(v.length, 2);
  assert.match(v[0].lines.join(" "), /2 × Esprit errant/);
  assert.match(v[1].lines.join(" "), /×1,4/);
  for (const e of Object.values(ENEMIES)) for (const p of phasesOf(e)) assert.ok(!p.lines.join(" ").includes("NaN") && p.lines.length > 0, e.key);
});

test("recherche : par nom de monstre ou de butin", () => {
  const nameOf = (d) => (d.type === "resource" ? RESOURCES[d.id].name : ITEMS[d.id].name);
  assert.equal(matchesSearch(ENEMIES.loup_des_plaines, "loup", nameOf), true);
  assert.equal(matchesSearch(ENEMIES.loup_des_plaines, "croc de loup", nameOf), true);
  assert.equal(matchesSearch(ENEMIES.sanglier_sauvage, "croc de loup", nameOf), false);
  assert.equal(matchesSearch(ENEMIES.sanglier_sauvage, "", nameOf), true);
});

test("livre d'équipement : tous les équipements du jeu y sont, une seule fois (clés de donjon exclues)", () => {
  const ids = gearSections().flatMap((s) => s.entries.map((e) => e.key));
  assert.equal(new Set(ids).size, ids.length, "pas de doublon");
  assert.equal(gearCount(), ids.length);
  for (const it of Object.values(ITEMS)) assert.equal(ids.includes(it.id), it.type !== "cle", `${it.id}`);
  for (const set of Object.values(SETS)) assert.equal(set.pieces.length, 5, set.key);
});

test("chaque équipement a une origine : une recette complète ou un monstre qui le lâche", () => {
  for (const id of gearSections().flatMap((s) => s.entries.map((e) => e.key))) {
    const r = recipeOf(id), d = itemDrops(id);
    assert.ok(r || d.length, `${id} : ni recette ni drop`);
    if (r) {
      assert.deepEqual(Object.fromEntries(r.ingredients.map((g) => [g.id, g.qty])), RECIPES[id].ingredients, `${id} : ingrédients identiques à la recette`);
      assert.ok(r.minLevel >= 1 && r.gold > 0 && r.profession);
      for (const g of r.ingredients) assert.ok(RESOURCES[g.id], `${id} : ressource inconnue ${g.id}`);
    }
  }
});

test("chaque ressource d'une recette a une provenance connue (raffinage, récolte ou monstre)", () => {
  for (const id of gearSections().flatMap((s) => s.entries.map((e) => e.key))) {
    for (const g of recipeOf(id)?.ingredients || []) assert.ok(resourceSources(g.id).length > 0, `${id} : d'où vient ${g.id} ?`);
  }
});

test("stats du livre : celles de l'objet, total du set = somme des pièces, classe de chaque set connue", () => {
  const it = ITEMS.plastron_fossoyeur;
  assert.deepEqual(itemStats(it).map((s) => [s.key, s.value]), [["def_phys", 16], ["hp", 27]]);
  const set = SETS.fossoyeur, tot = Object.fromEntries(setTotals(set).map((s) => [s.key, s.value]));
  assert.equal(tot.def_phys, set.pieces.reduce((n, id) => n + (ITEMS[id].def_phys || 0), 0));
  for (const s of Object.values(SETS)) assert.ok(setClass(s), `classe du set ${s.key}`);
  assert.equal(setClass(SETS.veteran), "guerrier");
});

test("les armes uniques et reliques ont des sources avec le bon taux", () => {
  const veilleur = itemDrops("lame_du_veilleur");
  assert.equal(veilleur.length, 1);
  assert.equal(veilleur[0].drop.forClass, "guerrier");
  assert.equal(itemDrops("medaillon_veuvage_eternel")[0].drop.fixed, true);
});

test("recherche d'équipement : par nom, par set ou par ressource de la recette", () => {
  assert.equal(gearMatches(ITEMS.plastron_garou, "veste"), true);
  assert.equal(gearMatches(ITEMS.plastron_garou, "loup-garou"), true);
  assert.equal(gearMatches(ITEMS.plastron_garou, "croc de pleine lune"), true);
  assert.equal(gearMatches(ITEMS.plastron_veteran, "croc de pleine lune"), false);
  assert.equal(gearMatches(ITEMS.plastron_veteran, ""), true);
});

test("mini-boss : PA, PV selon le groupe (le même que le combat) et attaques de zone signalées ; les autres monstres ne changent pas", () => {
  for (const key of ["cavalier_dechu", "epouvantail_ancestral", "veilleur_corrompu"]) {
    const e = ENEMIES[key];
    assert.equal(e.stats.pa, 8, `${key} : 8 PA`);
    assert.deepEqual([1, 2, 3].map((g) => hpFor(e, g)), [e.stats.hp, e.stats.hp * 2, e.stats.hp * 3]);
    // la fiche annonce les mêmes PV que le combat
    for (const g of [1, 2, 3]) {
      const allies = Array.from({ length: g - 1 }, () => ({ name: "A", stats: { atkPhys: 1, atkMagie: 0, defPhys: 0, defMagie: 0, maxHp: 100, esquive: 0, critique: 0, vitesse: 1, dropBonus: 0, setBonuses: [] }, weaponType: "epee", classKey: "guerrier", level: 10 }));
      const st = createCombat({ stats: { atkPhys: 1, atkMagie: 0, defPhys: 0, defMagie: 0, maxHp: 100, esquive: 0, critique: 0, vitesse: 1, dropBonus: 0, setBonuses: [] }, weaponType: "epee", classKey: "guerrier", level: 10, enemyKeys: [key], allies, seed: 1 });
      assert.equal(st.enemies[0].maxHp, hpFor(e, g), `${key} en groupe de ${g}`);
    }
  }
  assert.equal(hpFor(ENEMIES.loup_des_plaines, 3), ENEMIES.loup_des_plaines.stats.hp, "un monstre ordinaire ne change pas");
  assert.equal(ENEMIES.dame_en_deuil.stats.pa, 8);
  assert.equal(ENEMIES.dame_en_deuil_difficile.stats.pa, 8);
  for (const key of ["cavalier_dechu", "veilleur_corrompu"]) assert.ok(spellsOf(ENEMIES[key]).some((sp) => sp.aoe), `${key} : une attaque de zone affichée`);
  assert.ok(!spellsOf(ENEMIES.loup_des_plaines).some((sp) => sp.aoe));
});

console.log(`\n${n} tests OK`);
