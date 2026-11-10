// ============================================================
// Tests classes / création de personnage / apparence / sauvegarde :
//   node scripts/test-classes.js
// ============================================================
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const ANIMS = JSON.parse(readFileSync("src/data/heroAnims.json", "utf8"));
import { CLASSES, CLASS_ORDER, classSpellsAt, newSpellsAt } from "../src/data/classes.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { calcStats } from "../src/utils/calcStats.js";
import { heroOutfit, heroLook, availableOutfits, heroSpriteUrl } from "../src/data/heroSprites.js";
import { exportSave, parseSave } from "../src/utils/save.js";
import { gainXp } from "../src/utils/progression.js";
import { ITEMS } from "../src/data/items.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Classes et personnage");

test("3 classes, chacune avec un sort au niveau 1 et des sorts triés par niveau", () => {
  assert.deepEqual(CLASS_ORDER, ["guerrier", "assassin", "magicien"]);
  for (const c of Object.values(CLASSES)) {
    assert.ok(classSpellsAt(c.key, 1).length >= 1);
    assert.deepEqual(c.spells.map((s) => s.level), [...c.spells.map((s) => s.level)].sort((a, b) => a - b));
  }
  assert.equal(newSpellsAt("guerrier", 3)[0].id, "coup_devastateur");
});

test("création : kit de départ de la classe, arme équipée, tenue de la classe", () => {
  for (const key of CLASS_ORDER) {
    const p = createPlayer({ name: "  Aël  ", classKey: key, gender: "f" });
    const stats = calcStats(p);
    assert.equal(p.name, "Aël");
    assert.equal(p.gender, "f");
    assert.equal(p.equipped.arme.id, CLASSES[key].startWeapon);
    assert.equal(p.inventory.length, 0);
    assert.equal(heroOutfit(p, stats), CLASSES[key].outfit);       // 2 pièces du set de la classe
    assert.equal(heroLook(p, stats), `f/${CLASSES[key].outfit}`);
  }
  assert.equal(createPlayer({ name: "", classKey: "guerrier" }).name, "Héros");
  assert.ok(createPlayer({ classKey: "magicien", testMode: true }).inventory.length > 10);
});

test("apparence : le choix cosmétique prime sur l'équipement, sans changer les stats", () => {
  const p = createPlayer({ classKey: "guerrier" });
  const before = calcStats(p);
  const q = { ...p, appearance: "traqueur" };
  assert.equal(heroOutfit(q, calcStats(q)), "traqueur");
  assert.deepEqual({ ...calcStats(q), setBonuses: 0 }, { ...before, setBonuses: 0 });
  assert.equal(heroOutfit({ ...p, appearance: "n_importe_quoi" }, before), "veteran");
});

test("sans set (déséquipé) on retombe sur la tenue de la classe", () => {
  const p = createPlayer({ classKey: "assassin" });
  const bare = { ...p, equipped: { ...p.equipped, chapeau: null, plastron: null } };
  assert.equal(heroOutfit(bare, calcStats(bare)), "traqueur");
});

test("tenues proposées : celle de la classe, base, et les sets possédés", () => {
  const p = createPlayer({ classKey: "guerrier" });
  assert.deepEqual(availableOutfits(p).sort(), ["base", "veteran"]);
  const q = { ...p, inventory: [{ ...ITEMS.chapeau_apprenti, uid: "x" }] };
  assert.deepEqual(availableOutfits(q).sort(), ["apprenti", "base", "veteran"]);
});

test("carte : chaque tenue a de quoi calculer sa taille d'affichage (un NaN rend le héros et les simulés invisibles)", () => {
  const src = readFileSync("src/data/heroAnims.js", "utf8");
  const used = [...src.matchAll(/\bm\.(\w+)/g)].map((x) => x[1]);          // les champs lus par heroFrameLayout
  assert.ok(used.includes("pngH"), "heroFrameLayout lit la hauteur de feuille");
  for (const look of Object.keys(ANIMS)) {
    for (const k of used) assert.ok(typeof ANIMS[look][k] === "number" || Array.isArray(ANIMS[look][k]), `${look} : champ « ${k} » absent de heroAnims.json`);
    assert.ok(ANIMS[look].pngH > 0 && ANIMS[look].scale > 0, look);
  }
});

test("corps féminin : images de combat et animations présentes pour chaque tenue", () => {
  for (const o of ["base", "veteran", "apprenti", "traqueur"]) {
    assert.equal(heroSpriteUrl(`f/${o}`), `/assets/combat/hero/f/${o}.webp`);
    assert.ok(existsSync(`public/assets/combat/hero/f/${o}.webp`));
    for (const a of ["walk", "mine", "chop", "herb"]) assert.ok(existsSync(`public/assets/hero/f/${o}/${a}.webp`), `f/${o}/${a}`);
    assert.ok(ANIMS[`f/${o}`].actions.walk && ANIMS[`f/${o}`].pngH === ANIMS[`m/${o}`].pngH);
  }
});

test("niveaux : de nouveaux sorts de classe se débloquent", () => {
  const p = createPlayer({ classKey: "magicien" });
  assert.equal(classSpellsAt("magicien", p.level).length, 1);
  assert.equal(classSpellsAt("magicien", 3).length, 2);
  const up = gainXp(p, 200);
  assert.ok(up.player.level >= 3);
  assert.ok(classSpellsAt("magicien", up.player.level).length >= 2);
});

test("sauvegarde : export puis import identique, fichier invalide refusé", () => {
  const p = createPlayer({ name: "Test", classKey: "assassin", gender: "f" });
  const world = { mapKey: "prairies_sauvages", pos: { x: 3.5, y: 15.5 }, cleared: { g1: 123 } };
  const back = parseSave(exportSave(p, world));
  assert.deepEqual(back.player, p);
  assert.deepEqual(back.world, world);
  assert.equal(parseSave("n'importe quoi"), null);
  assert.equal(parseSave(JSON.stringify({ version: 999, player: p })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, player: { name: "x" } })), null);
});

console.log(`\n${n} tests passent.`);
