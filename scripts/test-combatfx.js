// Tests du son et des effets du combat :  node scripts/test-combatfx.js
// Tous les fichiers audio et images d'effets existent, les petites fonctions de mise en scène choisissent le bon bruit,
// et le son ne plante jamais (ici : pas de navigateur, donc pas d'audio, et rien ne doit lever d'erreur).
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { sfx, music, AUDIO_FILES, setVolume, getVolume, setMuted, isMuted } from "../src/components/combat/sfx.js";
import { deathKind, weaponOf, isHeroId } from "../src/components/combat/stage.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Son et effets du combat");

test("chaque bruitage, musique et ambiance existe, non vide, et reste léger", () => {
  for (const f of AUDIO_FILES.sfx) { const p = `public/assets/audio/sfx/${f}.mp3`; assert.ok(existsSync(p), p); assert.ok(statSync(p).size > 1000 && statSync(p).size < 60000, `${p} : taille`); }
  for (const f of AUDIO_FILES.music) { const p = `public/assets/audio/music/${f}.mp3`; assert.ok(existsSync(p), p); assert.ok(statSync(p).size > 20000 && statSync(p).size < 1500000, `${p} : taille`); }
  assert.ok(AUDIO_FILES.sfx.length >= 25 && AUDIO_FILES.music.length >= 6);
});

test("chaque image d'effet existe et Fx.jsx s'en sert", () => {
  const src = readFileSync("src/components/combat/Fx.jsx", "utf8");
  for (const f of ["slash_a", "slash_b", "fire", "frost", "poison", "arcane", "crit", "shield", "heal"]) {
    assert.ok(existsSync(`public/assets/combat/fx/${f}.webp`), f);
    assert.ok(src.includes(f), `Fx.jsx utilise ${f}`);
  }
});

test("le cri de mort dépend du monstre : bêtes, humains, morts-vivants, et héros pour les alliés", () => {
  const en = [{ id: "e0", key: "loup_des_plaines" }, { id: "e1", key: "squelette_fermier" }, { id: "e2", key: "bandit_des_routes" }];
  assert.equal(deathKind("e0", en), "beast");
  assert.equal(deathKind("e1", en), "undead");
  assert.equal(deathKind("e2", en), "hero");
  assert.equal(deathKind("player", en), "hero");
  assert.equal(deathKind("ally1", en), "hero");
  assert.equal(deathKind("e9", en), "undead");
  assert.ok(isHeroId("ally0") && !isHeroId("e0"));
});

test("l'arme qui fait le bruit : celle du joueur, dagues pour un allié assassin, arme blanche sinon", () => {
  const allies = [{ id: "ally0", classKey: "assassin" }, { id: "ally1", classKey: "guerrier" }];
  assert.equal(weaponOf("player", "arc", allies), "arc");
  assert.equal(weaponOf("ally0", "arc", allies), "dague");
  assert.equal(weaponOf("ally1", "arc", allies), "epee");
});

test("sans navigateur, aucune fonction de son ne plante, et le volume se règle entre 0 et 1", () => {
  for (const k of Object.keys(sfx)) assert.doesNotThrow(() => sfx[k](k === "hit" ? true : undefined, "fire"), k);
  assert.doesNotThrow(() => { music.start("boss", "amb_dungeon"); music.stinger("victory"); music.stop(); });
  setVolume(3); assert.equal(getVolume(), 1);
  setVolume(-1); assert.equal(getVolume(), 0);
  setVolume(0.7);
  setMuted(true); assert.equal(isMuted(), true);
  setMuted(false); assert.equal(isMuted(), false);
});

console.log(`\n${n} tests OK`);
