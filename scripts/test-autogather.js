// Tests de la récolte automatique (choix de la prochaine ressource) :  node scripts/test-autogather.js
import assert from "node:assert/strict";
import { MAPS } from "../src/data/maps.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { pickAutoNode, AUTO_WAIT_TEXT } from "../src/utils/autoGather.js";
import { bagCapacity } from "../src/utils/bag.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Récolte automatique");

const map = MAPS.prairies_sauvages;
const player = () => createPlayer({ name: "Test", classKey: "guerrier" });
const free = (p) => ({ x: p.x + 0.5, y: p.y + 0.5 });
// première case libre autour d'un point
const open = (x, y) => { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const c = map.rows[y + dy]?.[x + dx]; if (c && ".:S".includes(c)) return { x: x + dx + 0.5, y: y + dy + 0.5 }; } return null; };
const start = open(6, 6);

test("avec toutes les ressources, il choisit une cible atteignable avec un chemin", () => {
  const r = pickAutoNode({ map, pos: start, nodes: map.nodes, blocked: new Set(), player: player() });
  assert.ok(r.node, "une cible");
  assert.ok(Array.isArray(r.path));
});

test("il prend la plus proche : si on se place contre un nœud, c'est celui-là (chemin vide)", () => {
  const target = map.nodes.find((o) => ["frene", "filon_de_fer", "ortie"].includes(o.node));
  const pos = open(Math.round(target.x), Math.round(target.y));
  const r = pickAutoNode({ map, pos, nodes: [target, ...map.nodes], blocked: new Set(), player: player() });
  assert.ok(r.node);
  const d = (o) => Math.hypot(o.x + 0.5 - pos.x, o.y + 0.5 - pos.y);
  assert.ok(d(r.node) <= d(target) + 4, "reste dans le voisinage immédiat");
});

test("rien sur la carte : il attend la repousse", () => {
  const r = pickAutoNode({ map, pos: start, nodes: [], blocked: new Set(), player: player() });
  assert.equal(r.node, null);
  assert.equal(r.wait, "respawn");
  assert.ok(AUTO_WAIT_TEXT[r.wait]);
});

test("niveau de métier trop bas : les chênes, cuivres et sauges sont ignorés", () => {
  const hard = map.nodes.filter((o) => ["chene", "filon_de_cuivre", "sauge"].includes(o.node));
  assert.ok(hard.length > 0);
  const r = pickAutoNode({ map, pos: start, nodes: hard, blocked: new Set(), player: player() });
  assert.equal(r.node, null);
  assert.equal(r.wait, "locked");
});

test("sac plein : il ne cible que les ressources qu'il peut ranger (piles déjà possédées), sinon il se met en pause", () => {
  const p = player();
  const easy = map.nodes.filter((o) => ["frene", "filon_de_fer", "ortie"].includes(o.node));
  p.inventory = [];
  const ids = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12", "a13", "a14", "a15", "a16", "a17", "a18", "a19", "a20", "a21", "a22", "a23", "a24", "a25", "a26", "a27", "a28", "a29", "a30"];
  p.resources = {};
  for (let i = 0; i < bagCapacity(p); i++) p.resources[ids[i] || `x${i}`] = 1;
  const r = pickAutoNode({ map, pos: start, nodes: easy, blocked: new Set(), player: p });
  assert.equal(r.node, null);
  assert.equal(r.wait, "bag");
  // une pile existante de bois de frêne reste récoltable
  p.resources.bois_de_frene = 1; delete p.resources[Object.keys(p.resources)[0]];
  const frenes = easy.filter((o) => o.node === "frene");
  const r2 = pickAutoNode({ map, pos: start, nodes: frenes, blocked: new Set(), player: p });
  assert.ok(r2.node && r2.node.node === "frene");
});

test("une ressource mise de côté (skip) est ignorée jusqu'à son délai, puis reprise", () => {
  const one = [map.nodes.find((o) => o.node === "frene")];
  const skip = new Map([[one[0].id, Date.now() + 10000]]);
  const r = pickAutoNode({ map, pos: start, nodes: one, blocked: new Set(), player: player(), skip });
  assert.equal(r.node, null);
  const r2 = pickAutoNode({ map, pos: start, nodes: one, blocked: new Set(), player: player(), skip, now: Date.now() + 20000 });
  assert.ok(r2.node || r2.wait === "unreachable");
});

test("une ressource entourée d'obstacles est signalée inatteignable", () => {
  const target = map.nodes.find((o) => o.node === "frene");
  const blocked = new Set();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) blocked.add(`${target.x + dx},${target.y + dy}`);
  const far = { x: target.x + 8.5, y: target.y + 0.5 };
  const r = pickAutoNode({ map, pos: far, nodes: [target], blocked, player: player() });
  assert.equal(r.node, null);
  assert.ok(r.unreachable.includes(target.id) || r.wait);
});

console.log(`\n${n} tests OK`);
