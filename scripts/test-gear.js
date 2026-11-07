// Tests de l'équipement des paliers 2 et 3 :  node scripts/test-gear.js
import assert from "node:assert/strict";
import { ITEMS, SETS, calcSetBonuses } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { getCraftInfo } from "../src/data/professions.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn } from "../src/combat/engine.js";
import { CLASSES } from "../src/data/classes.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Équipement par paliers");

const sum = (ids, key) => ids.reduce((t, id) => t + (ITEMS[id][key] || 0), 0);
const CLASS_SETS = { guerrier: ["veteran", "fossoyeur", "chevalier"], assassin: ["traqueur", "charognard", "garou"], magicien: ["apprenti", "brasier", "esprit"] };
const MAIN = { guerrier: "def_phys", assassin: "atk_phys", magicien: "atk_magie" };

test("chaque classe a 3 sets (un par palier), de 5 pièces chacun, tous fabricables", () => {
  for (const sets of Object.values(CLASS_SETS)) for (const key of sets) {
    const s = SETS[key];
    assert.ok(s, key); assert.equal(s.pieces.length, 5, key);
    for (const id of s.pieces) { assert.ok(ITEMS[id] && RECIPES[id], `${id} : objet ou recette manquant`); assert.equal(ITEMS[id].set, key); }
    assert.ok(s.bonuses[2] && s.bonuses[5], `${key} : paliers 2 et 5`);
  }
});

test("chaque palier est plus fort que le précédent (stat principale du set, bonus de 5 pièces)", () => {
  for (const [cls, sets] of Object.entries(CLASS_SETS)) {
    const stat = MAIN[cls];
    for (let i = 1; i < sets.length; i++) {
      assert.ok(sum(SETS[sets[i]].pieces, stat) > sum(SETS[sets[i - 1]].pieces, stat), `${cls} : ${sets[i]} doit dépasser ${sets[i - 1]}`);
      assert.ok((SETS[sets[i]].bonuses[5][stat] || 0) >= (SETS[sets[i - 1]].bonuses[5][stat] || 0), `${cls} : bonus de ${sets[i]}`);
    }
  }
});

test("les stats d'un set restent proches de ×1,35 (palier 2) et ×1,9 (palier 3) du palier 1", () => {
  for (const [cls, sets] of Object.entries(CLASS_SETS)) {
    const base = sum(SETS[sets[0]].pieces, MAIN[cls]);
    const r2 = sum(SETS[sets[1]].pieces, MAIN[cls]) / base, r3 = sum(SETS[sets[2]].pieces, MAIN[cls]) / base;
    assert.ok(r2 > 1.15 && r2 < 1.6, `${cls} palier 2 : ×${r2.toFixed(2)}`);
    assert.ok(r3 > 1.6 && r3 < 2.3, `${cls} palier 3 : ×${r3.toFixed(2)}`);
  }
});

test("armes, bouclier et objets de boss : fabricables, avec leur métier et un niveau requis raisonnable", () => {
  const ids = ["epee_fossoyeur", "bouclier_fossoyeur", "dague_charognard", "baton_brasier", "epee_chevalier", "bouclier_chevalier", "dague_garou", "baton_esprit", "anneau_cavalier", "amulette_armure_maudite", "cape_epouvantail", "amulette_coeur_de_braise"];
  for (const id of ids) {
    const info = getCraftInfo(id);
    assert.ok(RECIPES[id] && info, id);
    assert.ok(info.minLevel >= 1 && info.minLevel <= 10, `${id} : niveau ${info.minLevel}`);
  }
  assert.equal(getCraftInfo("anneau_cavalier").profession, "bijoutier");
  assert.equal(getCraftInfo("cape_epouvantail").profession, "tailleur");
  assert.equal(ITEMS.epee_chevalier.weaponType, "epee");              // même type que l'épée du palier 1 : mêmes sorts d'arme
});

test("un set de palier supérieur se fabrique plus tard (niveau de métier requis) que celui du palier 1", () => {
  for (const sets of Object.values(CLASS_SETS)) for (const slot of ["gants", "chapeau", "plastron"]) {
    const lv = sets.map((k) => getCraftInfo(SETS[k].pieces.find((id) => ITEMS[id].type === slot)).minLevel);
    assert.ok(lv[0] < lv[1] && lv[1] < lv[2], `${slot} : ${lv}`);
  }
});

test("la cape, l'amulette et l'anneau s'équipent dans leur emplacement et comptent dans les stats", () => {
  const base = { level: 10, baseHp: 100, caracs: {}, equipped: {} };
  const eq = { cape: ITEMS.cape_epouvantail, amulette: ITEMS.amulette_coeur_de_braise, anneau: ITEMS.anneau_cavalier };
  for (const [slot, it] of Object.entries(eq)) assert.equal(it.type, slot);
  const a = calcStats(base), b = calcStats({ ...base, equipped: eq });
  assert.equal(b.atkPhys - a.atkPhys, 8); assert.equal(b.maxHp - a.maxHp, 30 + 20 + 15); assert.equal(b.critique - a.critique, 3 + 4);
});

// --- effets de combat des nouveaux sets ---
const fullSet = (key) => Object.fromEntries(SETS[key].pieces.map((id) => [ITEMS[id].type, ITEMS[id]]));
const statsOf = (key, extra = {}) => calcStats({ level: 20, baseHp: 400, caracs: {}, equipped: { ...fullSet(key), ...extra } });

test("le bonus de 5 pièces est bien actif avec le set complet, et seulement celui du palier 2 avec 2 pièces", () => {
  assert.equal(calcSetBonuses(fullSet("chevalier"))[0].threshold, 5);
  const two = Object.fromEntries(SETS.garou.pieces.slice(0, 2).map((id) => [ITEMS[id].type, ITEMS[id]]));
  assert.equal(calcSetBonuses(two)[0].threshold, 2);
});

test("Chevalier Déchu : les dégâts reçus brûlent l'attaquant (épines), jusqu'à pouvoir le tuer", () => {
  const stats = { ...statsOf("chevalier"), esquive: 0 };
  let st = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 20, enemyKeys: ["squelette_fermier"], seed: 7 });
  assert.equal(st.player.flags.thorns, 0.2);
  st = advance(st).state;                       // le héros joue en premier : on passe son tour pour laisser frapper le squelette
  st = endTurn(st).state;
  const { events } = advance(st);
  const taken = events.filter((e) => e.type === "hit" && e.to === "player").reduce((t, e) => t + e.amount, 0);
  const burn = events.filter((e) => e.type === "dot" && e.id === "e0" && e.element === "feu");
  assert.ok(taken > 0, "le squelette doit toucher");
  assert.ok(burn.length >= 1 && burn[0].amount === Math.max(1, Math.round(events.find((e) => e.type === "hit" && e.to === "player").amount * 0.2)), "les épines renvoient 20 % des dégâts");
});

test("Pelage du Loup-Garou : une part des dégâts infligés est rendue en PV, même avec un sort sans vol de vie", () => {
  const stats = statsOf("garou");
  let st = createCombat({ stats, weaponType: "dague", classKey: "assassin", level: 20, enemyKeys: ["squelette_fermier"], seed: 3 });
  assert.equal(st.player.flags.lifesteal, 0.04);
  st = advance(st).state;
  st.player.hp = Math.round(st.player.maxHp / 2);
  st.player.flags.firstCrit = false;
  const spell = st.player.spells.find((sp) => sp.type !== "buff" && sp.pa <= st.player.pa);
  const r = castSpell(st, spell.id, "e0");
  assert.ok(r.events.some((e) => e.type === "heal"), "un soin doit être déclenché");
});

test("Mante de l'Esprit Errant : les sorts ignorent 15 % de la défense (les dégâts augmentent)", () => {
  const hit = (armorPen) => {
    let st = createCombat({ stats: statsOf("esprit"), weaponType: "baton", classKey: "magicien", level: 20, enemyKeys: ["chevalier_dechu"], seed: 11 });
    st = advance(st).state;
    st.player.flags.armorPen = armorPen; st.player.pa = 6;
    const spell = st.player.spells.find((sp) => sp.type === "phys") || st.player.spells[0];
    const r = castSpell(st, spell.id, "e0");
    return r.events.find((e) => e.type === "hit" && e.from === "player")?.amount || 0;
  };
  assert.equal(statsOf("esprit").setBonuses[0].bonus.armorPen, 0.15);
  assert.ok(hit(0.15) > hit(0), "ignorer de la défense augmente les dégâts");
});

console.log(`\n${n} tests passent.`);
