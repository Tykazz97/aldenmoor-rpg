// Tests du bestiaire :  node scripts/test-bestiary.js
// Le point important : les pourcentages affichés doivent être exactement ceux que le combat applique (engine.js, rollRewards).
import assert from "node:assert/strict";
import { ENEMIES } from "../src/data/zones.js";
import { RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { createCombat, advance, castSpell, endTurn, PARTY_DROP_MULT } from "../src/combat/engine.js";
import { dropMultiplier, dropRate, dropVisibleFor, bestiarySections, spellsOf, spellFrequencies, phasesOf, effectText, matchesSearch, pct, expectedQty } from "../src/utils/bestiary.js";

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

console.log(`\n${n} tests OK`);
