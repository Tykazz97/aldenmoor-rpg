// Cohérence des paliers d'équipement (data/tiers.js) :  node scripts/test-tiers.js
import assert from "node:assert/strict";
import { TIERS, TIER_KEYS, craftBaseOf, equipLevelOfTier } from "../src/data/tiers.js";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { getCraftInfo } from "../src/data/professions.js";
import { CRAFT_PROFESSIONS, piecesOf, tiersOf } from "../src/utils/workshop.js";
import { gainProfessionXp } from "../src/utils/crafting.js";
import { equipLevelOf } from "../src/utils/equipReq.js";
import { tierOf } from "../src/sim/partyBots.js";
import { tierFor } from "../src/sim/lifeCraft.js";
import { MAX_PROFESSION_LEVEL } from "../src/data/professions.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Paliers d'équipement");

test("le tableau est continu (1, 2, 3…), croissant, et chaque palier a ses trois réglages", () => {
  assert.deepEqual(TIER_KEYS, TIER_KEYS.map((_, i) => i + 1));
  for (const t of TIER_KEYS) {
    const v = TIERS[t];
    for (const k of ["craftBase", "equipLevel", "simFrom"]) assert.ok(Number.isInteger(v[k]) && v[k] >= 0, `palier ${t} : ${k}`);
    if (t > 1) for (const k of ["craftBase", "equipLevel", "simFrom"]) assert.ok(v[k] > TIERS[t - 1][k], `palier ${t} : ${k} doit dépasser celui du palier ${t - 1}`);
  }
});

test("chaque pièce fabricable a un palier connu, et le niveau de métier croît avec le palier", () => {
  const byTier = {};
  for (const id of Object.keys(RECIPES)) {
    const it = ITEMS[id], c = getCraftInfo(id); if (!it || !c) continue;
    const t = it.tier || 1;
    assert.ok(TIERS[t], `${id} : palier ${t} inconnu`);
    (byTier[t] ||= []).push(c.minLevel);
    assert.ok(c.minLevel <= MAX_PROFESSION_LEVEL, `${id} : niveau de métier hors limite`);
  }
  for (const t of TIER_KEYS.slice(1)) {
    const prev = byTier[t - 1]?.length ? Math.max(...byTier[t - 1]) : 0;
    if (!byTier[t]) continue;
    // les sets (hors accessoires, clés) : un palier ne se fabrique pas avant la fin du précédent
    const sets = Object.keys(RECIPES).filter((id) => ITEMS[id]?.set && (ITEMS[id].tier || 1) === t).map((id) => getCraftInfo(id).minLevel);
    const prevSets = Object.keys(RECIPES).filter((id) => ITEMS[id]?.set && (ITEMS[id].tier || 1) === t - 1).map((id) => getCraftInfo(id).minLevel);
    assert.ok(Math.min(...sets) > Math.max(...prevSets), `palier ${t} : ses sets (${Math.min(...sets)}+) commencent après ceux du palier ${t - 1} (${Math.max(...prevSets)})`);
    void prev;
  }
});

test("palier 4 : les sets se fabriquent aux niveaux de métier 28 à 30", () => {
  const lv = Object.keys(RECIPES).filter((id) => ITEMS[id]?.set && ITEMS[id].tier === 4).map((id) => getCraftInfo(id).minLevel);
  assert.equal(Math.min(...lv), 28); assert.equal(Math.max(...lv), 30);
});

test("on peut porter une pièce dès que son palier est visé par les simulés ; l'équipement n'est jamais plus tardif que le palier simulé", () => {
  for (const t of TIER_KEYS) assert.ok(TIERS[t].equipLevel <= TIERS[t].simFrom, `palier ${t} : équipement (${TIERS[t].equipLevel}) avant que les simulés le visent (${TIERS[t].simFrom})`);
});

test("les seuils des simulés (tierOf / tierFor) suivent le tableau", () => {
  assert.equal(tierOf(TIERS[2].simFrom - 1), 0); assert.equal(tierOf(TIERS[2].simFrom), 1);
  assert.equal(tierOf(TIERS[3].simFrom - 1), 1); assert.equal(tierOf(TIERS[3].simFrom), 2);
  assert.equal(tierFor({ level: TIERS[4].simFrom, dj: { clears: 1 } }), 3, "palier 4 : donjon fini + niveau");
  assert.equal(tierFor({ level: TIERS[4].simFrom - 1, dj: { clears: 1 } }), tierOf(TIERS[4].simFrom - 1));
  assert.equal(tierFor({ level: 40, dj: { clears: 0 } }), 2, "sans donjon : reste au palier 3");
});

test("équipement : le niveau d'une pièce vient du tableau (sauf objets de boss sans palier)", () => {
  for (const it of Object.values(ITEMS)) if (it.tier) assert.equal(equipLevelOf(it), equipLevelOfTier(it.tier), it.id);
  assert.equal(craftBaseOf(undefined), 0); assert.equal(craftBaseOf(4), 27);
});

test("chaque métier de fabrication peut monter de zéro : une pièce au niveau 1, et jamais de palier sans de quoi y arriver", () => {
  for (const prof of CRAFT_PROFESSIONS) {
    const pieces = tiersOf(prof).flatMap((t) => piecesOf(prof, t)).map((id) => getCraftInfo(id));
    const top = Math.max(...pieces.map((p) => p.minLevel));
    let state = { level: 1, xp: 0 }, crafts = 0;
    // on fabrique toujours ce qui rapporte le plus d'xp parmi ce qu'on sait faire (les ingrédients ne sont pas comptés ici)
    while (state.level < top && crafts < 20000) {
      const can = pieces.filter((p) => p.minLevel <= state.level);
      assert.ok(can.length, `${prof} : bloqué au niveau ${state.level} (aucune pièce à ce niveau, il en faut jusqu'au niveau ${top})`);
      state = gainProfessionXp(state, Math.max(...can.map((p) => p.xp))); crafts++;
    }
    assert.ok(state.level >= top, `${prof} n'atteint jamais le niveau ${top}`);
  }
});

console.log(`${n} tests ok`);
