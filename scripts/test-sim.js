// Tests des joueurs simulés :  node scripts/test-sim.js
import assert from "node:assert/strict";
import { generatePopulation, POPULATION_SIZE } from "../src/sim/population.js";
import { createCityLife, stepCityLife, playerSays, visibleAgents, pickResponder, queueSay, whereIs, CITY_POPULATION } from "../src/sim/cityLife.js";
import { MAPS, CITY_KEY } from "../src/data/maps.js";
import { canStand } from "../src/utils/mapPath.js";
import { CLASSES } from "../src/data/classes.js";
import { MAX_LEVEL } from "../src/utils/progression.js";
import ANIMS from "../src/data/heroAnims.json" with { type: "json" };

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Joueurs simulés");

const pop = generatePopulation(1337);
const city = MAPS[CITY_KEY];

test("200 aventuriers, tous différents, déterministes", () => {
  assert.equal(pop.length, POPULATION_SIZE);
  assert.equal(new Set(pop.map((b) => b.name.toLowerCase())).size, pop.length);
  assert.equal(new Set(pop.map((b) => b.id)).size, pop.length);
  assert.deepEqual(generatePopulation(1337), pop);
  assert.notDeepEqual(generatePopulation(2).map((b) => b.name), pop.map((b) => b.name));
});

test("chaque simulé a une classe, un niveau et un look valides (feuilles d'animation présentes)", () => {
  for (const b of pop) {
    assert.ok(CLASSES[b.classKey], b.name);
    assert.ok(b.level >= 1 && b.level <= MAX_LEVEL);
    assert.ok(ANIMS[b.look]?.actions.walk, `${b.name} : look ${b.look}`);
    assert.ok(b.name.length >= 3 && b.name.length <= 20 && !/\s/.test(b.name), b.name);
  }
});

test("la population ressemble à un vrai serveur : beaucoup de débutants, peu de vétérans, les 3 classes et les 2 corps", () => {
  const low = pop.filter((b) => b.level <= 18).length, high = pop.filter((b) => b.level >= 35).length;
  assert.ok(low > pop.length * 0.5 && high < pop.length * 0.2 && high > 0, `${low}/${high}`);
  for (const c of Object.keys(CLASSES)) assert.ok(pop.filter((b) => b.classKey === c).length > 20, c);
  assert.ok(pop.filter((b) => b.gender === "f").length > 60 && pop.filter((b) => b.gender === "m").length > 60);
});

test("ville : une trentaine de présents, chacun sur une tuile praticable, et ça reste vrai après 10 minutes", () => {
  const life = createCityLife({ map: city, population: pop, seed: 7 });
  assert.equal(life.agents.length, CITY_POPULATION);
  const posOk = () => life.agents.forEach((a) => assert.ok(canStand(city, a.x, a.y, new Set(), 0.1), `${a.bot.name} bloqué en ${a.x.toFixed(2)},${a.y.toFixed(2)}`));
  posOk();
  const said = [];
  for (let t = 0; t < 600 * 10; t++) { for (const e of stepCityLife(life, 0.1)) if (e.type === "say") said.push(e); if (t % 50 === 0) posOk(); }
  assert.ok(Math.abs(life.agents.length - CITY_POPULATION) <= 3, `${life.agents.length}`);
  assert.ok(said.length > 40, `${said.length} messages`);
  assert.equal(new Set(life.agents.map((a) => a.id)).size, life.agents.length);     // personne en double
  assert.equal(life.agents.length + life.pool.length, pop.length);                   // personne ne disparaît
  assert.ok(visibleAgents(life).length > 10);
});

test("les simulés bougent, entrent dans les bâtiments, arrivent et repartent", () => {
  const life = createCityLife({ map: city, population: pop, seed: 11 });
  const start = new Map(life.agents.map((a) => [a.id, a.x]));
  const seen = new Set(), arrivals = [];
  let inside = 0;
  for (let t = 0; t < 3000; t++) {
    for (const e of stepCityLife(life, 0.1)) if (e.type === "arrive") arrivals.push(e.id);
    for (const a of life.agents) { if (a.state === "inside") inside++; seen.add(a.id); }
  }
  assert.ok(life.agents.some((a) => start.has(a.id) && Math.abs(a.x - start.get(a.id)) > 1));
  assert.ok(inside > 0, "personne n'est entré dans un bâtiment");
  assert.ok(arrivals.length >= 5, `${arrivals.length} arrivées`);
  assert.ok(seen.size > CITY_POPULATION);
});

test("le fil de discussion : phrases correctes, et un simulé répond au joueur", () => {
  const life = createCityLife({ map: city, population: pop, seed: 3 });
  assert.ok(life.history.length >= 3);
  for (const h of life.history) assert.ok(h.text && !/\{|undefined/.test(h.text), h.text);
  let replies = 0;
  for (let k = 0; k < 20; k++) {
    playerSays(life, "Salut tout le monde");
    for (let t = 0; t < 80; t++) for (const e of stepCityLife(life, 0.1)) if (e.type === "say" && !/\{|undefined/.test(e.text)) replies++;
  }
  assert.ok(replies > 10, `${replies}`);
});

test("chaque simulé a une personnalité et un objectif, sans changer les pseudos de la population", () => {
  for (const b of pop) assert.ok(b.trait && b.goal, b.name);
  assert.ok(new Set(pop.map((b) => b.trait)).size >= 8);
});

test("répondre au joueur : le pseudo cité répond, sinon un simulé proche ; la réponse du modèle est dite après un délai", () => {
  const life = createCityLife({ map: city, population: pop, seed: 5 });
  const target = life.agents.find((a) => a.state !== "inside");
  assert.equal(pickResponder(life, `eh ${target.bot.name.toUpperCase()} t'es où ?`, { x: 20, y: 15 }), target);
  const r = pickResponder(life, "quelqu'un ?", { x: 20, y: 15 });
  assert.ok(r && r.state !== "inside");
  assert.ok(/devant|près|sur la place/.test(whereIs(life, r)));
  queueSay(life, r.id, "salut toi", 1.5);
  const said = [];
  for (let t = 0; t < 40; t++) for (const e of stepCityLife(life, 0.1)) if (e.type === "say" && e.id === r.id && e.text === "salut toi") said.push(e);
  assert.equal(said.length, 1);
  assert.ok(said[0].t >= 1.5);
});

console.log(`\n${n} tests passent.`);
