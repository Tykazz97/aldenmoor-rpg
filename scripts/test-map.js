// Tests de la carte :  node scripts/test-map.js
import assert from "node:assert/strict";
import { MAPS, initialWorld } from "../src/data/maps.js";
import { NODES } from "../src/data/gathering.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { findPath, pathToAdjacent, activeGroups, activeNodes, isWalkable, mapWidth } from "../src/utils/mapPath.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const map = MAPS.prairies_sauvages;

console.log("Carte");

test("toutes les lignes ont la même largeur", () => {
  for (const r of map.rows) assert.equal(r.length, mapWidth(map));
});
test("le départ est praticable", () => assert.ok(isWalkable(map, map.start.x, map.start.y)));
test("chaque groupe est sur une tuile praticable, a une rencontre connue et est atteignable", () => {
  for (const g of map.groups) {
    assert.ok(isWalkable(map, g.x, g.y), `groupe ${g.id} sur une tuile bloquée`);
    assert.ok(ENCOUNTERS.find((e) => e.id === g.encounter), `rencontre inconnue : ${g.encounter}`);
    const others = new Set(map.groups.filter((o) => o !== g).map((o) => `${o.x},${o.y}`));
    assert.ok(pathToAdjacent(map, map.start, g, others) !== null, `groupe ${g.id} inatteignable`);
  }
});
test("le chemin évite les obstacles et ne traverse pas un groupe", () => {
  const blocked = new Set(map.groups.map((g) => `${g.x},${g.y}`));
  const p = findPath(map, map.start, { x: 13, y: 7 }, new Set([...blocked].filter((k) => k !== "13,7")));
  assert.ok(p && p.length > 0);
  for (const t of p) assert.ok(isWalkable(map, t.x, t.y));
  for (const t of p.slice(0, -1)) assert.ok(!blocked.has(`${t.x},${t.y}`));
});
test("impossible d'aller sur une tuile bloquée", () => assert.equal(findPath(map, map.start, { x: 0, y: 0 }), null));
test("un groupe vaincu réapparaît après le délai", () => {
  const w = initialWorld();
  assert.equal(activeGroups(map, w).length, map.groups.length);
  w.cleared.loups = 0; w.steps = 5;
  assert.equal(activeGroups(map, w).length, map.groups.length - 1);
  w.steps = map.respawnSteps;
  assert.equal(activeGroups(map, w).length, map.groups.length);
});

test("chaque nœud est sur une tuile praticable libre, connu, et atteignable (tout le reste bloqué)", () => {
  const occupied = [...map.groups, ...map.nodes];
  const seen = new Set();
  for (const nd of map.nodes) {
    assert.ok(NODES[nd.node], `nœud inconnu : ${nd.node}`);
    assert.ok(isWalkable(map, nd.x, nd.y), `${nd.id} sur une tuile bloquée`);
    const k = `${nd.x},${nd.y}`;
    assert.ok(!seen.has(k), `${nd.id} chevauche un autre objet`); seen.add(k);
    assert.ok(!(nd.x === map.start.x && nd.y === map.start.y));
    const others = new Set(occupied.filter((o) => o !== nd).map((o) => `${o.x},${o.y}`));
    assert.ok(pathToAdjacent(map, map.start, nd, others) !== null, `${nd.id} inatteignable`);
  }
  for (const g of map.groups) assert.ok(!seen.has(`${g.x},${g.y}`), `groupe ${g.id} sur un nœud`);
});
test("un nœud récolté repousse après le délai", () => {
  const w = initialWorld();
  assert.equal(activeNodes(map, w).length, map.nodes.length);
  w.cleared.frene_1 = 0; w.steps = 5;
  assert.equal(activeNodes(map, w).length, map.nodes.length - 1);
  w.steps = map.nodeRespawnSteps;
  assert.equal(activeNodes(map, w).length, map.nodes.length);
});
test("la carte propose tous les nœuds de récolte du jeu", () => {
  const used = new Set(map.nodes.map((nd) => nd.node));
  for (const id of Object.keys(NODES)) assert.ok(used.has(id), `nœud ${id} absent de la carte`);
});

console.log(`\n${n} tests passent.`);
