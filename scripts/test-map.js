// Tests de la carte (monde ouvert) :  node scripts/test-map.js
import assert from "node:assert/strict";
import { MAPS, initialWorld } from "../src/data/maps.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { NODES } from "../src/data/gathering.js";
import { findPath, pathToObject, stepMove, canStand, activeGroups, activeNodes, isWalkable, mapWidth, mapHeight, REACH } from "../src/utils/mapPath.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const map = MAPS.prairies_sauvages;
const W = mapWidth(map), H = mapHeight(map);
const objs = [...map.groups, ...map.nodes];
const blockedAll = new Set(objs.map((o) => `${o.x},${o.y}`));
const hero = { x: map.start.x + 0.5, y: map.start.y + 0.5 };

console.log("Carte");

test("toutes les lignes ont la même largeur, la carte est assez grande", () => {
  for (const r of map.rows) assert.equal(r.length, W);
  assert.ok(W >= 40 && H >= 24);
});
test("le départ est praticable et le héros peut s'y tenir", () => {
  assert.ok(isWalkable(map, map.start.x, map.start.y));
  assert.ok(canStand(map, hero.x, hero.y));
});
test("chaque groupe a une rencontre connue, chaque nœud un type connu", () => {
  for (const g of map.groups) assert.ok(ENCOUNTERS.find((e) => e.id === g.encounter), `rencontre inconnue : ${g.encounter}`);
  for (const nd of map.nodes) assert.ok(NODES[nd.node], `nœud inconnu : ${nd.node}`);
});
test("objets : tuile praticable, ids uniques, pas de chevauchement, pas sur le départ", () => {
  const ids = new Set(), tiles = new Set();
  for (const o of objs) {
    assert.ok(isWalkable(map, o.x, o.y), `${o.id} sur une tuile bloquée`);
    assert.ok(!ids.has(o.id), `id en double ${o.id}`); ids.add(o.id);
    const k = `${o.x},${o.y}`; assert.ok(!tiles.has(k), `${o.id} chevauche un autre objet`); tiles.add(k);
    assert.ok(Math.hypot(o.x + 0.5 - hero.x, o.y + 0.5 - hero.y) > 3, `${o.id} trop près du départ`);
  }
});
test("tous les objets sont atteignables, les autres étant bloquants", () => {
  for (const o of objs) {
    const others = new Set(objs.filter((p) => p !== o).map((p) => `${p.x},${p.y}`));
    const p = pathToObject(map, hero, o, others);
    assert.ok(p !== null, `${o.id} inatteignable`);
    const end = p.length ? p[p.length - 1] : hero;
    assert.ok(Math.hypot(end.x - (o.x + 0.5), end.y - (o.y + 0.5)) <= REACH + 0.6, `${o.id} : arrivée trop loin`);
  }
});
test("la carte propose tous les types de nœuds et toutes les rencontres du jeu", () => {
  const used = new Set(map.nodes.map((nd) => nd.node));
  for (const id of Object.keys(NODES)) assert.ok(used.has(id), `nœud ${id} absent`);
  const enc = new Set(map.groups.map((g) => g.encounter));
  for (const e of ENCOUNTERS) assert.ok(enc.has(e.id), `rencontre ${e.id} absente`);
});
test("un chemin lissé reste dans les zones libres et esquive les objets", () => {
  const far = map.groups.find((g) => g.encounter === "cavalier");
  const p = pathToObject(map, hero, far, blockedAll);
  assert.ok(p && p.length > 0);
  let prev = hero;
  for (const pt of p) {
    const d = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    for (let i = 0; i <= 20; i++) assert.ok(canStand(map, prev.x + (pt.x - prev.x) * i / 20, prev.y + (pt.y - prev.y) * i / 20, blockedAll), `collision entre ${JSON.stringify(prev)} et ${JSON.stringify(pt)} (${d.toFixed(1)})`);
    prev = pt;
  }
});
test("impossible d'aller dans une forêt ou sur un objet", () => {
  assert.equal(findPath(map, hero, { x: 0.5, y: 0.5 }), null);
  assert.equal(findPath(map, hero, { x: map.groups[0].x + 0.5, y: map.groups[0].y + 0.5 }, blockedAll), null);
});
test("le déplacement glisse le long d'un mur sans le traverser", () => {
  let pos = { x: 3.5, y: 15.5 };            // au départ, contre la lisière ouest
  for (let i = 0; i < 100; i++) pos = stepMove(map, pos, -0.08, 0.03);
  assert.ok(canStand(map, pos.x, pos.y));
  assert.ok(pos.y > 15.5, "doit avoir glissé vers le bas");
});
test("un groupe vaincu / un nœud récolté réapparaît après le délai (temps réel)", () => {
  const w = initialWorld(), t0 = 1_000_000;
  assert.equal(activeGroups(map, w, t0).length, map.groups.length);
  w.cleared[map.groups[0].id] = t0; w.cleared[map.nodes[0].id] = t0;
  assert.equal(activeGroups(map, w, t0 + 1000).length, map.groups.length - 1);
  assert.equal(activeNodes(map, w, t0 + 1000).length, map.nodes.length - 1);
  assert.equal(activeGroups(map, w, t0 + map.respawnMs).length, map.groups.length);
  assert.equal(activeNodes(map, w, t0 + map.nodeRespawnMs).length, map.nodes.length);
});

console.log(`\n${n} tests passent.`);
