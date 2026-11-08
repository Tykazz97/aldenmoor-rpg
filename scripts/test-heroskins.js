// Tests des apparences du héros :  node scripts/test-heroskins.js
// Chaque tenue proposée doit avoir ses images de combat (2 corps), ses 4 feuilles d'animation (2 corps) et ses métadonnées.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { HERO_OUTFITS, OUTFIT_LABELS, heroOutfit, availableOutfits } from "../src/data/heroSprites.js";
import { SETS } from "../src/data/items.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { calcStats } from "../src/utils/calcStats.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Apparences du héros");
const anims = JSON.parse(readFileSync("src/data/heroAnims.json", "utf8"));

test("chaque tenue a un nom, ses images de combat et ses animations pour les deux corps", () => {
  for (const o of HERO_OUTFITS) {
    assert.ok(OUTFIT_LABELS[o], `nom de ${o}`);
    for (const b of ["m", "f"]) {
      assert.ok(existsSync(`public/assets/combat/hero/${b}/${o}.png`), `image de combat ${b}/${o}`);
      assert.ok(anims[`${b}/${o}`], `métadonnées ${b}/${o}`);
      for (const act of ["walk", "mine", "chop", "herb"]) assert.ok(existsSync(`public/assets/hero/${b}/${o}/${act}.webp`), `feuille ${b}/${o}/${act}`);
    }
  }
});

test("une tenue de set correspond à un vrai set du jeu", () => {
  for (const o of HERO_OUTFITS) if (!["base", "veteran", "apprenti", "traqueur"].includes(o)) assert.ok(SETS[o], `${o} est un set`);
});

test("porter 2 pièces du Fossoyeur change l'apparence, et le skin devient choisissable", () => {
  const p = createPlayer({ classKey: "guerrier" });
  const piece = (id, type) => ({ id, type, set: "fossoyeur", uid: id });
  const wearing = { ...p, equipped: { ...p.equipped, chapeau: piece("chapeau_fossoyeur", "chapeau"), plastron: piece("plastron_fossoyeur", "plastron") } };
  const stats = calcStats(wearing);
  assert.equal(heroOutfit(wearing, stats), "fossoyeur");
  assert.ok(availableOutfits(wearing).includes("fossoyeur"));
  assert.ok(!availableOutfits(p).includes("fossoyeur"), "pas sans pièce");
});

console.log(`\n${n} tests OK`);
