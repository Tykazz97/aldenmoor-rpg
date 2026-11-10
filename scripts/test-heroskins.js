// Tests des apparences du héros :  node scripts/test-heroskins.js
// Chaque tenue proposée doit avoir ses images de combat (2 corps), ses 4 feuilles d'animation (2 corps) et ses métadonnées.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { HERO_OUTFITS, OUTFIT_LABELS, heroOutfit, availableOutfits, outfitFromGear } from "../src/data/heroSprites.js";
import { SETS, ITEMS } from "../src/data/items.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { generatePopulation } from "../src/sim/population.js";
import { CLASSES } from "../src/data/classes.js";
import { calcStats } from "../src/utils/calcStats.js";
import { liveBots, initialLife } from "../src/sim/lives.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Apparences du héros");
const anims = JSON.parse(readFileSync("src/data/heroAnims.json", "utf8"));

test("chaque tenue a un nom, ses images de combat et ses animations pour les deux corps", () => {
  for (const o of HERO_OUTFITS) {
    assert.ok(OUTFIT_LABELS[o], `nom de ${o}`);
    for (const b of ["m", "f"]) {
      assert.ok(existsSync(`public/assets/combat/hero/${b}/${o}.webp`), `image de combat ${b}/${o}`);
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

test("la liste d'apparence ne propose que les tenues possédées (classe, voyageur, sets dont on a une pièce)", () => {
  const p = createPlayer({ classKey: "guerrier" });
  assert.deepEqual(availableOutfits(p), ["base", "veteran"]);
});

test("chaque simulé porte uniquement la tenue de sa classe", () => {
  const pop = generatePopulation();
  assert.ok(pop.length >= 200);
  for (const b of pop) assert.equal(b.look.split("/")[1], CLASSES[b.classKey].outfit, `${b.name}`);
});

// Les simulés prennent l'apparence du set qu'ils portent, comme le joueur (palier 2 : un set par classe)
const TIER2 = [["guerrier", "fossoyeur"], ["assassin", "charognard"], ["magicien", "brasier"]];
const gearOf = (setKey, n) => Object.fromEntries(SETS[setKey].pieces.slice(0, n).map((id) => [ITEMS[id].type, id]));

test("un simulé qui porte 2 pièces ou plus d'un set du palier 2 prend l'apparence de ce set, une seule pièce ne change rien", () => {
  const pop = generatePopulation(), world = { lives: {} };
  for (const [classKey, set] of TIER2) {
    const bot = pop.find((b) => b.classKey === classKey);
    const body = bot.look.split("/")[0];
    world.lives[bot.id] = { ...initialLife(bot), level: 25, gear: gearOf(set, 1) };
    assert.equal(liveBots(world, [bot])[0].look, `${body}/${CLASSES[classKey].outfit}`, `${set} : 1 pièce`);
    for (const n of [2, 5]) {
      world.lives[bot.id].gear = gearOf(set, n);
      const look = liveBots(world, [bot])[0].look;
      assert.equal(look, `${body}/${set}`, `${set} : ${n} pièces`);
      assert.ok(anims[look], `animations de la carte pour ${look}`);
      for (const act of ["walk", "mine", "chop", "herb"]) assert.ok(existsSync(`public/assets/hero/${look}/${act}.webp`), `${look}/${act}`);
      assert.ok(existsSync(`public/assets/combat/hero/${look}.webp`), `image de combat ${look}`);
    }
  }
});

test("un simulé mélangeant deux sets porte celui dont il a le plus de pièces ; sans set, la tenue de sa classe", () => {
  const bot = generatePopulation().find((b) => b.classKey === "guerrier"), body = bot.look.split("/")[0];
  const a = SETS.fossoyeur.pieces.slice(0, 3), b = SETS.veteran.pieces.filter((id) => !a.some((x) => ITEMS[x].type === ITEMS[id].type)).slice(0, 2);
  assert.equal(b.length, 2);
  assert.equal(outfitFromGear(Object.fromEntries([...a, ...b].map((id) => [ITEMS[id].type, id])), "guerrier"), "fossoyeur");
  assert.equal(outfitFromGear({}, "guerrier"), CLASSES.guerrier.outfit);
  const world = { lives: { [bot.id]: { ...initialLife(bot), gear: {} } } };
  assert.equal(liveBots(world, [bot])[0].look, `${body}/${CLASSES.guerrier.outfit}`);
});

console.log(`\n${n} tests OK`);
