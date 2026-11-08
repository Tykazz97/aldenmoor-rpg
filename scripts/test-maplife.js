// Tests de la vie des joueurs simulés sur les cartes de région :  node scripts/test-maplife.js
import assert from "node:assert/strict";
import { createMapLife, stepMapLife, whoFights, regionLevels, partySizes, partiesFor, MAP_PARTIES } from "../src/sim/mapLife.js";
import { getPopulation } from "../src/sim/population.js";
import { MAPS } from "../src/data/maps.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { isWalkable } from "../src/utils/mapPath.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Joueurs simulés sur les cartes");

const pop = getPopulation();
const blockedOf = (map) => new Set([...map.groups, ...(map.nodes || [])].map((o) => `${o.x},${o.y}`));
const isBoss = (g) => ENCOUNTERS.find((e) => e.id === g.encounter)?.boss;
function run(mapKey, { seed = 5, seconds = 240, avoid = null } = {}) {
  const map = MAPS[mapKey];
  const life = createMapLife({ map, population: pop, seed, blocked: blockedOf(map) });
  life.activeGroups = [...map.groups];
  if (avoid) life.avoid = new Set(avoid);
  const events = [];
  const seenFight = new Set();
  for (let t = 0; t < seconds * 10; t++) {
    const ev = stepMapLife(life, 0.1);
    for (const e of ev) { events.push(e); if (e.type === "cleared") life.activeGroups = life.activeGroups.filter((g) => g.id !== e.id); }
    for (const id of life.engaged.keys()) seenFight.add(id);
    if (t % 50 === 0) for (const a of life.agents) assert.ok(isWalkable(map, Math.floor(a.x), Math.floor(a.y)), `${a.bot.name} dans un obstacle en (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
  }
  return { life, events, map, seenFight };
}

test("groupes équilibrés : solo, duo et trio en alternance (6 groupes au plus), et leur nombre suit celui des simulés du bon niveau", () => {
  assert.deepEqual([...partySizes(3, Math.random)].sort(), [1, 2, 3]);
  assert.deepEqual([...partySizes(6, Math.random)].sort(), [1, 1, 2, 2, 3, 3]);
  assert.equal(MAP_PARTIES, 6);
  assert.deepEqual([1, 8, 16, 24, 48, 200].map(partiesFor), [1, 1, 2, 3, 6, 6]);
  assert.equal(partiesFor(0), 0); assert.equal(partiesFor(1), 1); assert.equal(partiesFor(200), 6);
  // lancement : 200 simulés niveau 1 → les Prairies sont pleines (6 groupes = 12 aventuriers)
  const fresh = pop.map((b) => ({ ...b, level: 1 }));
  const map = MAPS.prairies_sauvages;
  for (let seed = 1; seed <= 6; seed++) {
    const life = createMapLife({ map, population: fresh, seed, blocked: blockedOf(map) });
    const sizes = life.parties.map((p) => p.members.length).sort().join("");
    assert.equal(sizes, "112233", `tailles ${sizes}`);
    assert.equal(life.agents.length, 12);
    for (const p of life.parties) { const lv = p.members.map((a) => a.bot.level); assert.ok(Math.max(...lv) - Math.min(...lv) <= 3); }
  }
  // peu de simulés dans la région : moins de groupes, jamais de doublon
  const few = pop.map((b, i) => ({ ...b, level: i < 10 ? 3 : 40 }));
  const life = createMapLife({ map, population: few, seed: 2, blocked: blockedOf(map) });
  assert.equal(life.parties.length, partiesFor(10));
  assert.equal(new Set(life.agents.map((a) => a.id)).size, life.agents.length);
});

test("régions : niveaux lus dans les données, groupes de 1 à 3 aventuriers de niveau adapté", () => {
  assert.deepEqual(regionLevels(MAPS.prairies_sauvages), [1, 8]);
  assert.deepEqual(regionLevels(MAPS.lisiere_des_ombres), [14, 20]);
  for (const key of ["prairies_sauvages", "champs_calcines", "lisiere_des_ombres"]) {
    const map = MAPS[key];
    const life = createMapLife({ map, population: pop, seed: 3, blocked: blockedOf(map) });
    const [lo, hi] = regionLevels(map);
    assert.ok(life.parties.length >= 1 && life.parties.length <= MAP_PARTIES, key);
    for (const p of life.parties) {
      assert.ok(p.members.length >= 1 && p.members.length <= 3);
      const lv = p.members.map((a) => a.bot.level);
      assert.ok(lv.every((l) => l >= lo && l <= hi), `${key} niveaux ${lv}`);
      assert.ok(Math.max(...lv) - Math.min(...lv) <= 3);
    }
    const ids = life.agents.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, "aucun simulé en double");
  }
});

test("ils vont se battre : des groupes de monstres ordinaires sont vraiment vaincus, jamais un mini-boss", () => {
  const { events, map, seenFight } = run("prairies_sauvages");
  const cleared = events.filter((e) => e.type === "cleared");
  assert.ok(cleared.length >= 3, `${cleared.length} victoires en 4 minutes`);
  // (ici les groupes ne réapparaissent pas : en jeu ils reviennent au bout d'une minute) il en reste au moins un
  assert.ok(cleared.length < map.groups.length, `ils ne vident pas la carte (${cleared.length}/${map.groups.length})`);
  for (const c of cleared) {
    const g = map.groups.find((x) => x.id === c.id);
    assert.ok(g && !isBoss(g), c.id);
    assert.ok(c.by.length >= 1 && c.names);
  }
  assert.equal(new Set(cleared.map((c) => c.id)).size, cleared.length, "un même groupe n'est pas vaincu deux fois sans réapparition");
  assert.ok(seenFight.size >= 1);
  assert.ok(events.some((e) => e.type === "say"), "ils parlent (bulles)");
});

test("ils respectent le joueur : un groupe engagé n'est jamais pris, et on sait qui combat quoi", () => {
  const map = MAPS.prairies_sauvages;
  const all = map.groups.map((g) => g.id);
  const { events } = run("prairies_sauvages", { avoid: all });
  assert.equal(events.filter((e) => e.type === "cleared").length, 0);
  // quand un groupe est attaqué par des simulés, whoFights les nomme
  const life = createMapLife({ map, population: pop, seed: 5, blocked: blockedOf(map) });
  life.activeGroups = [...map.groups];
  let named = null;
  for (let t = 0; t < 2400 && !named; t++) {
    stepMapLife(life, 0.1);
    for (const id of life.engaged.keys()) named = whoFights(life, id);
  }
  assert.ok(named && named.length > 2, "des noms sont renvoyés");
  assert.equal(whoFights(life, "inconnu"), null);
});

test("un groupe pris par le joueur en cours de route : ils renoncent sans rien éliminer", () => {
  const map = MAPS.prairies_sauvages;
  const life = createMapLife({ map, population: pop, seed: 9, blocked: blockedOf(map) });
  life.activeGroups = [...map.groups];
  const cleared = [];
  for (let t = 0; t < 3000; t++) {
    for (const e of stepMapLife(life, 0.1)) if (e.type === "cleared") cleared.push(e.id);
    // dès qu'un groupe est ciblé, le joueur l'a déjà éliminé : il disparaît de la carte
    for (const p of life.parties) if (p.then?.fight) life.activeGroups = life.activeGroups.filter((g) => g.id !== p.then.fight);
  }
  assert.ok(life.parties.every((p) => p.state !== "fight" || life.activeGroups.some((g) => g.id === p.target)));
  assert.ok(life.engaged.size <= life.parties.length);
});

test("déterministe à graine égale ; les simulés restent sur la carte", () => {
  const a = run("champs_calcines", { seed: 11, seconds: 90 });
  const b = run("champs_calcines", { seed: 11, seconds: 90 });
  assert.deepEqual(a.events.map((e) => `${e.type}:${e.id}`), b.events.map((e) => `${e.type}:${e.id}`));
  const W = a.map.rows[0].length, H = a.map.rows.length;
  for (const ag of a.life.agents) assert.ok(ag.x > 0 && ag.x < W && ag.y > 0 && ag.y < H);
});

console.log(`\n${n} tests passent.`);
