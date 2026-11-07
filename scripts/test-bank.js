// Tests du coffre :  node scripts/test-bank.js
import assert from "node:assert/strict";
import { depositItem, withdrawItem, depositResource, withdrawResource, bankOf, bankCapacity, bankUsed, bankFree, nextUpgradeCost, upgradeBank, BANK_START, BANK_STEP, BANK_UPGRADES } from "../src/utils/bank.js";
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

test("capacité : 20 emplacements au départ ; un objet = 1, un type de ressource = 1 quel que soit le nombre", () => {
  let p = { ...base(), gold: 0 };
  assert.equal(bankCapacity(p), BANK_START); assert.equal(bankUsed(p), 0);
  p = depositResource(p, "fer", 5);
  assert.equal(bankUsed(p), 1);
  p = depositResource(p, "fer", 5);                         // même ressource : pas d'emplacement de plus
  assert.equal(bankUsed(p), 1);
  p = depositItem(p, p.inventory[0].uid);
  assert.equal(bankUsed(p), 2); assert.equal(bankFree(p), BANK_START - 2);
});

test("coffre plein : plus d'objet ni de nouvelle ressource, mais on peut toujours compléter une pile ou reprendre", () => {
  let p = { ...base(), resources: { fer: 5, bois: 2 } };
  while (bankFree(p) > 0) p = depositItem(p, p.inventory[0].uid);
  assert.equal(bankUsed(p), BANK_START);
  const blockedItem = depositItem(p, p.inventory[0].uid), blockedRes = depositResource(p, "fer", 1);
  assert.equal(blockedItem, p); assert.equal(blockedRes, p);
  const withdrawn = withdrawItem(p, p.bank.items[0].uid);
  assert.equal(bankFree(withdrawn), 1);                     // reprendre libère la place
  assert.equal(bankUsed(depositResource(withdrawn, "fer", 1)), BANK_START);
  let q = depositResource({ ...base(), resources: { fer: 5 } }, "fer", 2);     // pile existante dans un coffre déjà plein
  while (bankFree(q) > 0) q = depositItem(q, q.inventory[0].uid);
  assert.equal(depositResource(q, "fer", 2).bank.resources.fer, 4);
});

test("agrandir : coûte de l'or, ajoute 10 emplacements, prix croissants, plafond, jamais sans l'or", () => {
  assert.deepEqual([...BANK_UPGRADES].sort((a, b) => a - b), BANK_UPGRADES);
  let p = { ...base(), gold: 0 };
  assert.equal(upgradeBank(p), p);                           // pas d'or : rien ne change
  p = { ...p, gold: 100 + 250 + 5 };
  p = upgradeBank(p);
  assert.equal(p.gold, 255); assert.equal(bankCapacity(p), BANK_START + BANK_STEP); assert.equal(nextUpgradeCost(p), 250);
  p = upgradeBank(p);
  assert.equal(p.gold, 5); assert.equal(bankCapacity(p), BANK_START + 2 * BANK_STEP);
  assert.equal(upgradeBank(p), p);
  let r = { ...base(), gold: 1e9 };
  for (let i = 0; i < BANK_UPGRADES.length; i++) r = upgradeBank(r);
  assert.equal(nextUpgradeCost(r), null); assert.equal(bankCapacity(r), BANK_START + BANK_STEP * BANK_UPGRADES.length);
  assert.equal(upgradeBank(r), r);                           // taille maximale
  assert.equal(r.bank.items.length, 0);                      // l'agrandissement ne touche pas au contenu
});

console.log(`\n${n} tests passent.`);
