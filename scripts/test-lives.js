// Tests de la vie des joueurs simulés (personnages persistants) :  node scripts/test-lives.js
import assert from "node:assert/strict";
import { getPopulation } from "../src/sim/population.js";
import {
  createLives, advanceLives, liveBots, validWorld, stepOf, isActive, traitsOf, overlevelMult, regionFor, initialLife,
  STEP_MS, MAX_CATCHUP_STEPS, BAG_ITEMS_MAX, migrateWorld, rollDrops, emptyBag,
} from "../src/sim/lives.js";
import { MAX_LEVEL, xpToNext } from "../src/utils/progression.js";
import { RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { makeRng } from "../src/sim/rng.js";
import { MAX_PROFESSION_LEVEL } from "../src/data/professions.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Vie des joueurs simulés");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);               // un lundi à midi
const DAY = 86400000;
const fresh = (now = T0) => createLives({ population: pop, mode: "fresh", epoch: now, now });
const run = (w, days, from = T0) => { for (let d = 1; d <= days; d++) advanceLives(w, pop, from + d * DAY); return w; };
const lv = (w) => Object.values(w.lives).map((l) => l.level).sort((a, b) => a - b);
const med = (a) => a[Math.floor(a.length / 2)];

await test("fresh start : tout le monde commence au niveau 1, sans or ni xp ; rien ne bouge avant le lancement", () => {
  const w = fresh();
  assert.equal(Object.keys(w.lives).length, pop.length);
  for (const l of Object.values(w.lives)) { assert.equal(l.level, 1); assert.equal(l.xp, 0); assert.equal(l.gold, 0); assert.equal(l.prof.level, 1); }
  const future = createLives({ population: pop, mode: "fresh", epoch: T0 + 5 * DAY, now: T0 });
  assert.equal(advanceLives(future, pop, T0 + 2 * DAY), 0, "avant l'epoch : aucun pas");
  assert.ok(lv(future).every((x) => x === 1));
});

await test("mode « generated » : chacun démarre au niveau de la population", () => {
  const w = createLives({ population: pop, mode: "generated", epoch: 1, now: T0 });
  for (const b of pop) assert.equal(w.lives[b.id].level, b.level);
  assert.deepEqual(liveBots(w, pop).map((b) => b.level), pop.map((b) => b.level));
});

await test("déterministe, et rejouer en un seul bloc ou en plusieurs donne exactement la même histoire", () => {
  const a = run(fresh(), 10);
  const b = run(fresh(), 10);
  assert.deepEqual(a, b);
  const c = fresh();
  for (const d of [1, 4, 4.5, 7, 10]) advanceLives(c, pop, T0 + d * DAY);
  assert.deepEqual(c.lives, a.lives);
  assert.equal(c.step, a.step);
});

await test("ils ne jouent pas tout le temps : séances de quelques heures, de préférence le soir, certains jours seulement", () => {
  const bot = pop[0], tr = traitsOf(bot);
  let active = 0, steps = 0, evening = 0, night = 0, eveningSteps = 0, nightSteps = 0;
  const all = pop.map((b) => [b, traitsOf(b)]);
  for (let s = stepOf(T0); s < stepOf(T0) + 14 * 144; s++) {
    const hour = ((s * STEP_MS + 3600000) % DAY) / 3600000;
    for (const [b, t] of all) {
      const on = isActive(b, s, t);
      steps++; if (on) active++;
      if (hour >= 18 && hour < 22) { eveningSteps++; if (on) evening++; }
      if (hour >= 2 && hour < 6) { nightSteps++; if (on) night++; }
    }
  }
  const frac = active / steps;
  assert.ok(frac > 0.05 && frac < 0.35, `part du temps en jeu ${frac.toFixed(2)}`);
  assert.ok(evening / eveningSteps > 2 * (night / nightSteps), "plus de monde le soir que la nuit");
  assert.ok(tr.hours >= 2 && tr.hours <= 6 && tr.diligence > 0.4 && tr.diligence < 1.4);
  assert.deepEqual(traitsOf(bot), traitsOf(bot), "traits stables");
});

await test("ils progressent : niveaux qui montent sans jamais baisser, métiers aussi, avec une vraie dispersion", () => {
  const w = fresh();
  for (let d = 1; d <= 40; d++) advanceLives(w, pop, T0 + d * DAY);
  const lives = pop.map((b) => w.lives[b.id]);
  for (const l of lives) { assert.ok(l.level >= 1 && l.level <= MAX_LEVEL); assert.ok(l.xp >= 0 && l.xp < xpToNext(l.level)); assert.ok(l.prof.level >= 1 && l.prof.level <= MAX_PROFESSION_LEVEL && l.gold >= 0); }
  const sorted = lv(w);
  assert.ok(med(sorted) >= 8 && med(sorted) <= 30, `niveau médian ${med(sorted)} après 40 jours`);
  assert.ok(sorted[sorted.length - 1] > med(sorted) + 3, "il y a des écarts entre joueurs");
  // monotone : un jour de plus ne fait jamais reculer personne
  const snap = Object.fromEntries(Object.entries(w.lives).map(([k, l]) => [k, [l.level, l.gold, l.kills]]));
  advanceLives(w, pop, T0 + 41 * DAY);
  for (const [k, l] of Object.entries(w.lives)) assert.ok(l.level >= snap[k][0] && l.gold >= snap[k][1] && l.kills >= snap[k][2]);
});

await test("les combattants montent plus vite en niveau, les récolteurs plus vite en métier", () => {
  const w = run(fresh(), 30);
  const avg = (act, f) => { const bs = pop.filter((b) => b.activity === act); return bs.reduce((s, b) => s + f(w.lives[b.id]), 0) / bs.length; };
  assert.ok(avg("combattant", (l) => l.level) > avg("recolteur", (l) => l.level));
  assert.ok(avg("recolteur", (l) => l.prof.level) > avg("combattant", (l) => l.prof.level));
});

await test("plafond du contenu : au-delà du niveau de la dernière région, l'xp s'effondre", () => {
  assert.equal(overlevelMult(10), 1);
  assert.equal(overlevelMult(20), 1);
  assert.ok(overlevelMult(22) < 0.6 && overlevelMult(28) < 0.1);
  assert.equal(regionFor(1).key, "prairies_sauvages"); assert.equal(regionFor(9).key, "champs_calcines"); assert.equal(regionFor(40).key, "lisiere_des_ombres");
  const w = run(fresh(), 90);
  assert.ok(lv(w).pop() <= 40, "personne n'atteint le niveau max faute de contenu");
});

await test("rattrapage : au plus 7 jours rejoués, même après une très longue absence", () => {
  const w = fresh();
  const played = advanceLives(w, pop, T0 + 100 * DAY);
  assert.equal(played, MAX_CATCHUP_STEPS);
  assert.equal(w.step, stepOf(T0 + 100 * DAY));
  assert.equal(advanceLives(w, pop, T0 + 100 * DAY), 0, "déjà à jour");
});

await test("sauvegarde : une sauvegarde valide est reconnue, une autre version, un autre départ ou une donnée abîmée sont refusés", () => {
  const w = run(fresh(), 3);
  const copy = JSON.parse(JSON.stringify(w));
  assert.ok(validWorld(copy, { mode: "fresh", epoch: T0 }, pop));
  assert.ok(!validWorld(copy, { mode: "fresh", epoch: T0 + 1 }, pop), "autre epoch : on repart de zéro");
  assert.ok(!validWorld(copy, { mode: "generated", epoch: T0 }, pop));
  assert.ok(!validWorld({ ...copy, v: 2 }, { mode: "fresh", epoch: T0 }, pop));
  assert.ok(!validWorld(null, { mode: "fresh", epoch: T0 }, pop) && !validWorld("x", { mode: "fresh", epoch: T0 }, pop));
  const broken = JSON.parse(JSON.stringify(w)); delete broken.lives[pop[5].id];
  assert.ok(!validWorld(broken, { mode: "fresh", epoch: T0 }, pop));
  const bad = JSON.parse(JSON.stringify(w)); bad.lives[pop[0].id].level = "x";
  assert.ok(!validWorld(bad, { mode: "fresh", epoch: T0 }, pop));
  // et la reprise après rechargement donne la même suite
  const reloaded = JSON.parse(JSON.stringify(w));
  advanceLives(reloaded, pop, T0 + 6 * DAY); advanceLives(w, pop, T0 + 6 * DAY);
  assert.deepEqual(reloaded.lives, w.lives);
});

await test("navigateur : la liste vivante vient du localStorage, se rattrape à l'heure et survit à une sauvegarde abîmée", async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  store["aldenmoor:sims"] = "{ pas du json";
  const { getLivePopulation, getLiveWorld, LIVES_KEY } = await import("../src/sim/simWorld.js");
  const list = getLivePopulation();
  assert.equal(list.length, pop.length);
  assert.ok(list.every((b) => b.level >= 1 && b.life));
  const saved = JSON.parse(store[LIVES_KEY]);
  assert.equal(saved.v, 1); assert.equal(Object.keys(saved.lives).length, pop.length);
  assert.equal(getLivePopulation(), list, "même tableau tant que rien ne change");
  const later = getLivePopulation(Date.now() + 3 * DAY);
  assert.notEqual(later, list);
  assert.ok(JSON.parse(store[LIVES_KEY]).step > saved.step, "la sauvegarde avance avec l'heure");
  assert.ok(getLiveWorld());
});

await test("sac : ils gardent les drops et la récolte, équipement de leur classe seulement, sac d'équipement plafonné", () => {
  const w = run(fresh(), 40);
  const lives = pop.map((b) => [b, w.lives[b.id]]);
  let withRes = 0;
  for (const [b, l] of lives) {
    assert.ok(l.bag && typeof l.bag.res === "object" && Array.isArray(l.bag.items));
    for (const [id, q] of Object.entries(l.bag.res)) assert.ok(RESOURCES[id] && Number.isInteger(q) && q > 0, `ressource ${id}`);
    assert.ok(l.bag.items.length <= BAG_ITEMS_MAX);
    for (const id of l.bag.items) { const it = ITEMS[id]; assert.ok(it, id); if (it.classKey) assert.equal(it.classKey, b.classKey, "pas d'arme d'une autre classe"); }
    if (Object.keys(l.bag.res).length) withRes++;
  }
  assert.ok(withRes > 150, `${withRes} sacs avec des ressources`);
  // la récolte arrive dans le sac : un récolteur actif a de sa ressource de métier
  const gatherer = lives.filter(([b, l]) => b.activity === "recolteur" && l.gathers > 50)[0];
  assert.ok(gatherer, "un récolteur actif existe");
  const own = { bucheron: ["bois_de_frene", "bois_de_chene"], mineur: ["minerai_de_fer", "minerai_de_cuivre"], herboriste: ["ortie", "sauge"] }[gatherer[1].prof.key];
  assert.ok(own.some((id) => gatherer[1].bag.res[id] > 0), "ses récoltes sont dans son sac");
  // un combattant a des drops de monstres
  const fighter = lives.filter(([b, l]) => b.activity === "combattant" && l.kills > 100)[0];
  assert.ok(Object.keys(fighter[1].bag.res).length >= 2);
});

await test("sac : l'équipement en trop est revendu (or), et les anciennes sauvegardes reçoivent un sac vide", () => {
  const b = pop.find((x) => x.classKey === "guerrier");
  const life = { gold: 0, bag: emptyBag() };
  const sure = { drops: [{ type: "item", id: "epee_milicien", chance: 1, min: 1, max: 1 }, { type: "resource", id: "croc_de_loup", chance: 1, min: 2, max: 2 }, { type: "item", id: "croc_du_veilleur", chance: 1, min: 1, max: 1, forClass: "assassin" }] };
  const rng = makeRng(1);
  for (let i = 0; i < BAG_ITEMS_MAX; i++) rollDrops(life, b, sure, rng);
  assert.equal(life.bag.items.length, BAG_ITEMS_MAX); assert.equal(life.gold, 0);
  assert.equal(life.bag.res.croc_de_loup, 2 * BAG_ITEMS_MAX);
  assert.ok(!life.bag.items.includes("croc_du_veilleur"), "arme d'assassin ignorée par un guerrier");
  rollDrops(life, b, sure, rng);
  assert.equal(life.bag.items.length, BAG_ITEMS_MAX, "sac plafonné");
  assert.ok(life.gold > 0, "le plus ancien est revendu");
  const old = { v: 1, mode: "fresh", epoch: T0, step: 1, lives: { a: { id: "a", level: 3, prof: { key: "mineur", level: 1, xp: 0 } } } };
  migrateWorld(old);
  assert.deepEqual(old.lives.a.bag, { res: {}, items: [] });
  assert.ok(!validWorld({ ...old, lives: { ...old.lives, a: { ...old.lives.a, bag: undefined } } }, { mode: "fresh", epoch: T0 }, [{ id: "a" }]));
});

console.log(`\n${n} tests passent.`);
