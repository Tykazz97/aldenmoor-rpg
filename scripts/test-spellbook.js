// ============================================================
// Tests du grimoire : rangs, points de sort, barre de combat équipable.
//   node scripts/test-spellbook.js
// ============================================================
import assert from "node:assert/strict";
import { CLASSES, CLASS_ORDER } from "../src/data/classes.js";
import { WEAPON_TYPES } from "../src/data/weapons.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell } from "../src/combat/engine.js";
import { MAX_RANK, classSlots, rankCost, pointsSpentOn, spellPointsTotal, spellPointsLeft, spellPointsSpent, resetCost, rankSpell, rankOf, loadoutOf, buildSpellBar, rankUp, equipSpell, resetRanks, spellbookOf } from "../src/utils/spellbook.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Grimoire");
const at = (classKey, level, extra = {}) => ({ ...createPlayer({ classKey, name: "T" }), level, ...extra });

test("10 sorts de classe par classe, répartis jusqu'au niveau 42", () => {
  for (const key of CLASS_ORDER) {
    const lv = CLASSES[key].spells.map((s) => s.level);
    assert.equal(lv.length, 10, key);
    assert.deepEqual(lv, [1, 3, 5, 7, 9, 12, 18, 26, 34, 42]);
  }
});

test("emplacements : 3 au départ, 4 au niveau 10, 5 au niveau 25", () => {
  assert.deepEqual([1, 9, 10, 24, 25, 50].map(classSlots), [3, 3, 4, 4, 5, 5]);
});

test("points de sort : 1 par niveau, un rang r → r+1 coûte r, rang 5 = 10 points", () => {
  assert.equal(spellPointsTotal(1), 0);
  assert.equal(spellPointsTotal(50), 49);
  assert.deepEqual([1, 2, 3, 4].map(rankCost), [1, 2, 3, 4]);
  assert.equal(pointsSpentOn(MAX_RANK), 10);
  assert.ok(spellPointsTotal(50) < 3 * 10 + 10 * 10, "on ne peut pas tout monter au maximum");
});

test("rang 1 = sort d'origine ; chaque rang renforce ; le rang 5 coûte 1 PA de moins (sans descendre sous 2)", () => {
  for (const c of Object.values(CLASSES)) for (const sp of c.spells) {
    const r1 = rankSpell(sp, 1);
    assert.equal(r1.pa, sp.pa); assert.equal(r1.power, sp.power);
    let prev = r1;
    for (let r = 2; r <= MAX_RANK; r++) {
      const s = rankSpell(sp, r);
      if (sp.power) assert.ok(s.power > prev.power, `${sp.id} rang ${r} : dégâts en hausse`);
      assert.ok(s.pa <= prev.pa, `${sp.id} : le coût ne monte jamais`);
      assert.ok(s.pa >= 1 && s.pa <= 6);
      prev = s;
    }
    const top = rankSpell(sp, MAX_RANK);
    assert.equal(top.pa, Math.max(Math.min(sp.pa, 2), sp.pa - 1), sp.id);
    assert.deepEqual(sp, c.spells.find((x) => x.id === sp.id), "les données d'origine ne bougent pas");
  }
  assert.equal(rankSpell(CLASSES.guerrier.spells[0], 99).rank, MAX_RANK);        // rang plafonné
});

test("effets renforcés : poison, affaiblissement, perte de PA, parade", () => {
  const poison = CLASSES.assassin.spells.find((s) => s.id === "frappe_empoisonnee");
  assert.ok(rankSpell(poison, 5).effect.ratio > poison.effect.ratio);
  const choc = CLASSES.guerrier.spells.find((s) => s.id === "choc_sonnant");
  assert.equal(rankSpell(choc, 4).effect.value, choc.effect.value);              // +1 PA seulement au rang 5
  assert.equal(rankSpell(choc, 5).effect.value, choc.effect.value + 1);
  const brise = CLASSES.guerrier.spells.find((s) => s.id === "brise_armure");
  assert.ok(rankSpell(brise, 5).effect.value > brise.effect.value && rankSpell(brise, 5).effect.value <= 0.6);
  const parade = CLASSES.guerrier.spells[0];
  const p5 = rankSpell(parade, 5).selfEffect;
  assert.ok(p5.defUp > parade.selfEffect.defUp && p5.counter > parade.selfEffect.counter && p5.turns === parade.selfEffect.turns + 1);
});

test("barre de combat : sort d'arme + sorts de classe, au plus 'emplacements' sorts de classe", () => {
  for (const [lv, expected] of [[1, 2], [3, 3], [7, 4], [12, 5], [25, 6], [50, 6]]) {
    const bar = buildSpellBar(at("guerrier", lv));
    assert.equal(bar.length, expected, `niveau ${lv}`);
    assert.equal(bar[0].id, "taillade", "le sort de l'arme est toujours en tête");
  }
  assert.equal(buildSpellBar({ ...at("magicien", 1), equipped: { ...at("magicien", 1).equipped, arme: null } })[0].id, "coup_de_poing");
});

test("par défaut la barre prend les sorts dans l'ordre de déblocage ; équiper échange ou remplace", () => {
  const p = at("guerrier", 12);
  assert.deepEqual(loadoutOf(p), ["parade", "coup_devastateur", "choc_sonnant", "brise_armure"]);
  const q = equipSpell(p, 3, "seisme");                                          // remplace le 4e emplacement
  assert.deepEqual(loadoutOf(q), ["parade", "coup_devastateur", "choc_sonnant", "seisme"]);
  const r = equipSpell(q, 0, "seisme");                                          // déjà dans la barre : échange
  assert.deepEqual(loadoutOf(r), ["seisme", "coup_devastateur", "choc_sonnant", "parade"]);
  assert.deepEqual(buildSpellBar(r).map((s) => s.id).slice(1), loadoutOf(r));
  assert.equal(equipSpell(p, 0, "bastion").spellbook?.loadout?.[0], "bastion");  // niveau 12 : bastion est débloqué
});

test("équiper un sort verrouillé ou hors emplacement est refusé", () => {
  const p = at("guerrier", 5);
  assert.equal(equipSpell(p, 0, "bastion"), p);
  assert.equal(equipSpell(p, 7, "parade"), p);
  assert.equal(equipSpell(p, -1, "parade"), p);
});

test("un sort débloqué prend la place libre ; une préférence ancienne est filtrée", () => {
  const p = at("guerrier", 1, { spellbook: { ranks: {}, loadout: ["parade", "bastion", "parade"] } });
  assert.deepEqual(loadoutOf(p), ["parade"]);                                    // bastion verrouillé, doublon ignoré
  assert.deepEqual(loadoutOf({ ...p, level: 3 }), ["parade", "coup_devastateur"]);
});

test("monter un sort : coûte des points, s'arrête au rang max, refuse sans points", () => {
  let p = at("guerrier", 11);                                                    // 10 points
  assert.equal(spellPointsLeft(p), 10);
  p = rankUp(p, "parade"); p = rankUp(p, "parade"); p = rankUp(p, "parade"); p = rankUp(p, "parade");
  assert.equal(rankOf(p, "parade"), 5);
  assert.equal(spellPointsLeft(p), 0);
  assert.equal(rankUp(p, "parade"), p, "rang maximum");
  assert.equal(rankUp(p, "taillade"), p, "plus de points");
  assert.equal(rankUp(at("guerrier", 2), "coup_devastateur").spellbook, undefined, "sort verrouillé");
  assert.equal(rankUp(at("guerrier", 9), "disparition").spellbook, undefined, "sort d'une autre classe");
  const w = rankUp(at("guerrier", 3), "taillade");                               // le sort de l'arme se monte aussi
  assert.equal(rankOf(w, "taillade"), 2);
  assert.equal(buildSpellBar(w)[0].rank, 2);
});

test("réinitialiser : coûte de l'or, rend les points, refuse sans or", () => {
  let p = at("guerrier", 10, { gold: 1000 });
  p = rankUp(rankUp(p, "parade"), "parade");
  assert.equal(spellPointsSpent(p), 3);
  assert.equal(resetCost(p), 500);
  assert.equal(resetCost(at("guerrier", 10)), 0, "rien à réinitialiser : gratuit");
  assert.equal(resetRanks({ ...p, gold: 10 }).gold, 10, "pas assez d'or");
  const q = resetRanks(p);
  assert.equal(q.gold, 500); assert.equal(spellPointsLeft(q), 9); assert.equal(rankOf(q, "parade"), 1);
});

test("anciennes sauvegardes (sans grimoire) : valeurs par défaut, aucune erreur", () => {
  const old = at("assassin", 12); delete old.spellbook;
  assert.deepEqual(spellbookOf(old), { ranks: {}, loadout: null });
  assert.equal(spellPointsLeft(old), 11);
  assert.equal(buildSpellBar(old).length, 5);
  assert.ok(buildSpellBar(old).every((s) => s.rank === 1));
  assert.deepEqual(spellbookOf({ ...old, spellbook: { ranks: { parade: 3 } } }).loadout, null);
});

test("en combat : la barre du joueur est utilisée, avec les rangs", () => {
  const p = rankUp(rankUp(at("guerrier", 6, { gold: 0 }), "taillade"), "taillade");   // taillade rang 3
  const stats = calcStats(p);
  const spells = buildSpellBar(p);
  const s = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 6, enemyKeys: ["loup_des_plaines"], spells, seed: 7 });
  assert.deepEqual(s.player.spells.map((x) => x.id), spells.map((x) => x.id));
  assert.equal(s.player.spells[0].rank, 3);
  assert.equal(s.player.spells[0].power, rankSpell(WEAPON_TYPES.epee.spell, 3).power);
  const legacy = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 6, enemyKeys: ["loup_des_plaines"], seed: 7 });
  assert.equal(legacy.player.spells.length, 1 + 3, "sans barre fournie : tous les sorts débloqués (ancien comportement)");
});

test("un sort de rang élevé fait plus de dégâts qu'au rang 1 (même graine)", () => {
  const dmg = (rank) => {
    const p = at("guerrier", 3);
    const stats = calcStats(p);
    const spells = buildSpellBar(p).map((sp) => (sp.id === "taillade" ? rankSpell(WEAPON_TYPES.epee.spell, rank) : sp));
    let st = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 3, enemyKeys: ["sanglier_sauvage"], spells, seed: 42 });
    st = advance(st).state;
    const r = castSpell(st, "taillade", "e0");
    return r.events.find((e) => e.type === "hit")?.amount ?? 0;
  };
  assert.ok(dmg(5) > dmg(1), `${dmg(5)} > ${dmg(1)}`);
});

test("les 12 nouveaux sorts sont utilisables en combat (aucun plante, coût ≤ 6 PA)", () => {
  for (const key of CLASS_ORDER) {
    const p = at(key, 50);
    const stats = calcStats(p);
    for (const sp of CLASSES[key].spells.filter((s) => s.level >= 18)) {
      for (const rank of [1, MAX_RANK]) {
        const spells = [rankSpell(sp, rank)];
        let st = createCombat({ stats: { ...stats, maxHp: 99999 }, weaponType: null, classKey: key, level: 50, enemyKeys: ["loup_des_plaines", "loup_des_plaines"], spells, seed: 3 });
        st = advance(st).state;
        if (st.phase !== "playerTurn") continue;
        st.player.pa = 6;
        const r = castSpell(st, sp.id, "e0");
        assert.ok(r.events.length > 0, `${sp.id} rang ${rank}`);
      }
    }
  }
});

console.log(`\n${n} tests passent.`);
