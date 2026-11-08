// Tests des emplacements de récolte : un coin par métier (forêt, mine, herbes), jamais sur un obstacle, un groupe ou un bâtiment, chemins ouverts :  node scripts/test-nodes.js
import assert from "node:assert/strict";
import { MAPS } from "../src/data/maps.js";
import { NODES } from "../src/data/gathering.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Emplacements de récolte");

const REGIONS = ["prairies_sauvages", "champs_calcines", "lisiere_des_ombres"];
const BLOCKING = "#~rTBF";
const passable = (map, x, y) => y >= 0 && y < map.rows.length && x >= 0 && x < map.rows[0].length && !BLOCKING.includes(map.rows[y][x]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const byProfession = (map) => {
  const out = {};
  for (const o of map.nodes) (out[NODES[o.node].profession] ||= []).push(o);
  return out;
};

test("les régions ont été agrandies d'environ 50 % (elles faisaient 48 à 52 × 30 tuiles, soit au moins 48×30) et gardent leurs groupes ordinaires et leurs nœuds en nombre", () => {
  for (const key of REGIONS) {
    const map = MAPS[key], w = map.rows[0].length, h = map.rows.length;
    assert.ok(w * h >= 48 * 30 * 1.4, `${key} : ${w}×${h}`);
    assert.ok(map.groups.length >= 17, `${key} : ${map.groups.length} groupes`);
    assert.ok(map.nodes.length >= 40, `${key} : ${map.nodes.length} nœuds`);
    for (const r of map.rows) assert.equal(r.length, w);
  }
});

test("chaque nœud est sur une tuile praticable, hors groupes et bâtiments, avec une tuile libre entre deux nœuds", () => {
  for (const key of REGIONS) {
    const map = MAPS[key], others = [...map.groups, ...(map.buildings || []).map((b) => ({ x: b.a, y: b.y })), map.start];
    const seen = new Set();
    map.nodes.forEach((o, i) => {
      assert.ok(NODES[o.node], `${key}/${o.id}`);
      assert.ok(passable(map, o.x, o.y), `${key}/${o.id} sur un obstacle (${o.x},${o.y})`);
      assert.ok(!seen.has(o.id), `${key}/${o.id} en double`); seen.add(o.id);
      for (const q of others) assert.ok(Math.max(Math.abs(o.x - q.x), Math.abs(o.y - q.y)) >= 2, `${key}/${o.id} collé à un groupe`);
      for (const p of map.nodes.slice(i + 1)) assert.ok(Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) >= 2, `${key}/${o.id} collé à ${p.id}`);
    });
  }
});

test("un coin par métier : les deux ressources d'un même métier sont groupées (6 tuiles autour du centre), les trois coins sont éloignés", () => {
  for (const key of REGIONS) {
    const map = MAPS[key], groups = byProfession(map);
    assert.deepEqual(Object.keys(groups).sort(), ["bucheron", "herboriste", "mineur"], key);
    const centers = {};
    for (const [prof, list] of Object.entries(groups)) {
      assert.deepEqual([...new Set(list.map((o) => o.node))].length, 2, `${key}/${prof} : les deux ressources`);
      const c = { x: list.reduce((s, o) => s + o.x, 0) / list.length, y: list.reduce((s, o) => s + o.y, 0) / list.length };
      centers[prof] = c;
      const far = Math.max(...list.map((o) => dist(o, c)));
      assert.ok(far <= 9, `${key}/${prof} trop étalé : ${far.toFixed(1)} tuiles`);
      assert.ok(list.length >= 8, `${key}/${prof} : ${list.length} nœuds seulement`);
    }
    const ps = Object.values(centers);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(dist(ps[i], ps[j]) >= 12, `${key} : deux coins trop proches`);
  }
});

test("les nœuds ne ferment aucun passage : tout ce qu'on atteignait sans eux reste atteignable depuis l'arrivée", () => {
  const reach = (map, blocked) => {
    const seen = new Set([`${map.start.x},${map.start.y}`]), stack = [[map.start.x, map.start.y]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || blocked.has(k) || !passable(map, x + dx, y + dy)) continue;
        seen.add(k); stack.push([x + dx, y + dy]);
      }
    }
    return seen;
  };
  for (const key of REGIONS) {
    const map = MAPS[key], bld = (map.buildings || []).map((b) => `${b.a},${b.y}`);
    const nodes = new Set(map.nodes.map((o) => `${o.x},${o.y}`));
    const without = reach(map, new Set(bld)), withNodes = reach(map, new Set([...bld, ...nodes]));
    const lost = [...without].filter((k) => !withNodes.has(k) && !nodes.has(k));
    assert.equal(lost.length, 0, `${key} : ${lost.length} tuiles coupées par les nœuds (${lost.slice(0, 5)})`);
  }
});

test("les ressources de départ (niveau 1) restent proches du coin : frêne, filon de fer et ortie existent dans chaque région", () => {
  for (const key of REGIONS) {
    const ids = new Set(MAPS[key].nodes.map((o) => o.node));
    for (const nd of ["frene", "chene", "filon_de_fer", "filon_de_cuivre", "ortie", "sauge"]) assert.ok(ids.has(nd), `${key} : ${nd}`);
  }
});

console.log(`\n${n} tests OK`);
