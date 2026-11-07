// Tests de la récolte :  node scripts/test-gathering.js
import assert from "node:assert/strict";
import { NODES } from "../src/data/gathering.js";
import { PROFESSIONS, PROFESSION_ORDER } from "../src/data/professions.js";
import { RESOURCES } from "../src/data/resources.js";
import { canGather, applyGather, rollYield } from "../src/utils/gathering.js";
import { emptyProfessions } from "../src/utils/crafting.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const fresh = () => ({ gold: 0, resources: {}, inventory: [], professions: emptyProfessions(PROFESSION_ORDER) });

console.log("Récolte");

test("chaque nœud pointe vers un métier de récolte et une ressource existants", () => {
  for (const node of Object.values(NODES)) {
    assert.equal(PROFESSIONS[node.profession].kind, "gather", node.id);
    assert.ok(RESOURCES[node.resource], node.id);
  }
});
test("un niveau 1 peut récolter le frêne mais pas le chêne", () => {
  assert.equal(canGather(fresh(), "frene").ok, true);
  const c = canGather(fresh(), "chene");
  assert.equal(c.ok, false);
  assert.equal(c.minLevel, 3);
});
test("récolter ajoute la ressource et de l'xp au bon métier", () => {
  const r = applyGather(fresh(), "filon_de_fer", 2);
  assert.equal(r.player.resources.minerai_de_fer, 2);
  assert.deepEqual(r.player.professions.mineur, { level: 1, xp: 8 });
  assert.deepEqual(r.player.professions.bucheron, { level: 1, xp: 0 });
});
test("récolter refuse un nœud trop haut niveau", () => {
  const p = fresh();
  const r = applyGather(p, "sauge", 1);
  assert.equal(r.player, p);
  assert.equal(r.gained, null);
});
test("l'xp fait monter de niveau (30 xp pour passer niveau 2)", () => {
  let p = fresh(), up = false;
  for (let i = 0; i < 4; i++) { const r = applyGather(p, "ortie", 1); p = r.player; up = up || r.levelUp; }
  assert.equal(p.professions.herboriste.level, 2);
  assert.equal(up, true);
});
test("le rendement reste dans la fourchette du nœud", () => {
  for (const node of Object.values(NODES)) {
    for (let i = 0; i < 50; i++) { const q = rollYield(node); assert.ok(q >= node.yield[0] && q <= node.yield[1]); }
  }
});

console.log(`\n${n} tests passent.`);
