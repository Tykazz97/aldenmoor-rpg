// Tests du coffre :  node scripts/test-bank.js
import assert from "node:assert/strict";
import { depositItem, withdrawItem, depositResource, withdrawResource, bankOf } from "../src/utils/bank.js";
import { createPlayer } from "../src/utils/newPlayer.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Coffre");

const base = () => ({ ...createPlayer({ classKey: "guerrier", testMode: true }), resources: { fer: 5, bois: 2 } });

test("un perso neuf a un coffre vide, un ancien sans coffre en reçoit un à la volée", () => {
  assert.deepEqual(createPlayer({ classKey: "guerrier" }).bank, { items: [], resources: {} });
  const old = { ...base() }; delete old.bank;
  assert.deepEqual(bankOf(old), { items: [], resources: {} });
});

test("ranger puis reprendre un objet : rien ne se perd, rien ne se duplique", () => {
  const p = base(), it = p.inventory[0], total = p.inventory.length;
  const a = depositItem(p, it.uid);
  assert.equal(a.inventory.length, total - 1);
  assert.equal(a.bank.items.length, 1);
  assert.ok(!a.inventory.some((i) => i.uid === it.uid));
  const b = withdrawItem(a, it.uid);
  assert.equal(b.inventory.length, total);
  assert.equal(b.bank.items.length, 0);
});

test("objet inconnu : rien ne change", () => {
  const p = base();
  assert.equal(depositItem(p, "nope"), p);
  assert.equal(withdrawItem(p, "nope"), p);
});

test("ressources : quantité, tout, et plafonné à ce qu'on possède", () => {
  let p = depositResource(base(), "fer", 2);
  assert.equal(p.resources.fer, 3); assert.equal(p.bank.resources.fer, 2);
  p = depositResource(p, "fer", Infinity);
  assert.equal(p.resources.fer, undefined); assert.equal(p.bank.resources.fer, 5);
  p = withdrawResource(p, "fer", 100);
  assert.equal(p.resources.fer, 5); assert.equal(p.bank.resources.fer, undefined);
  const q = base();
  assert.equal(depositResource(q, "absent", 3), q);
});

console.log(`\n${n} tests passent.`);
