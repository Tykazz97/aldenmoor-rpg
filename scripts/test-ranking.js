// Classement :  node scripts/test-ranking.js
import assert from "node:assert/strict";
import { createPlayer } from "../src/utils/newPlayer.js";
import { buildRanking, sortRows, ranksFor, professionOf, formatHours, STEP_HOURS } from "../src/utils/ranking.js";
import { getPopulation } from "../src/sim/population.js";
import { createLives, advanceLives, liveBots, traitsOf } from "../src/sim/lives.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Classement");

const bot = (id, level, gold, profs, played, classKey = "guerrier") => ({ id, name: id, classKey, level, gold, life: { xp: 0, played, pro: profs, prof: null } });
const me = { ...createPlayer({ name: "Moi", classKey: "magicien" }), level: 10, xp: 50, gold: 500, playSec: 3 * 3600, professions: { forgeron: { level: 12, xp: 0 }, mineur: { level: 3, xp: 0 } } };
const bots = [bot("a", 20, 100, { tailleur: { level: 30, xp: 5 } }, 600), bot("b", 5, 9000, { forgeron: { level: 12, xp: 40 } }, 60), bot("c", 10, 500, { mineur: { level: 2, xp: 0 } }, 18)];
const rows = buildRanking(me, bots);

test("le joueur est dans le classement, avec ses heures de jeu", () => {
  assert.equal(rows.length, 4);
  const mine = rows.find((r) => r.isMe);
  assert.equal(mine.id, "me"); assert.equal(mine.hours, 3); assert.equal(mine.name, "Moi");
  assert.equal(rows.find((r) => r.id === "a").hours, 600 * STEP_HOURS);        // 100 h
});

test("tri par niveau (puis xp), fortune, métier (puis xp) et heures", () => {
  assert.equal(sortRows(rows, "niveau")[0].id, "a");
  assert.equal(sortRows(rows, "niveau")[1].id, "me");               // niveau 10 comme « c », mais 50 xp contre 0
  assert.equal(sortRows(rows, "or")[0].id, "b");
  assert.equal(sortRows(rows, "metier")[0].id, "a");                // tailleur 30
  assert.equal(sortRows(rows, "metier")[1].id, "b");                // forgeron 12 avec plus d'xp que le joueur
  assert.equal(sortRows(rows, "heures")[0].id, "a");
  assert.equal(sortRows(rows, "heures").at(-1).id, "c");
});

test("un métier précis classe sur ce métier seulement", () => {
  const f = sortRows(rows, "metier", "forgeron").map((r) => r.id);
  assert.deepEqual(f.slice(0, 2), ["b", "me"]);
  assert.equal(professionOf(rows.find((r) => r.id === "a"), "forgeron"), null);
  assert.equal(professionOf(rows.find((r) => r.id === "me"), null).key, "forgeron");
});

test("rangs : 1 = premier, les ex æquo partagent le rang", () => {
  const r = ranksFor(rows, "niveau");
  assert.deepEqual([r.a, r.me, r.c, r.b], [1, 2, 3, 4]);
  const tie = ranksFor(buildRanking(me, [bot("x", 10, 500, {}, 0), bot("y", 10, 500, {}, 0)]), "or");
  assert.equal(tie.x, tie.y);
});

test("format des heures", () => {
  assert.equal(formatHours(0.5), "30 min");
  assert.equal(formatHours(3), "3 h");
  assert.equal(formatHours(12.34), "12,3 h");
  assert.equal(formatHours(250.4), "250 h");
});

test("les simulés accumulent des heures de jeu en jouant ; les acharnés plus que les occasionnels", () => {
  const pop = getPopulation();
  const t0 = Date.UTC(2026, 10, 8, 0, 0, 0);
  const w = createLives({ population: pop, mode: "fresh", epoch: t0, now: t0 });
  assert.ok(pop.every((b) => w.lives[b.id].played === 0), "départ à zéro");
  advanceLives(w, pop, t0 + 14 * 86400000);
  const hrs = (profile) => { const g = pop.filter((b) => traitsOf(b).profile === profile); return g.reduce((s, b) => s + w.lives[b.id].played, 0) / g.length * STEP_HOURS; };
  const occ = hrs("occasionnel"), ach = hrs("acharne");
  assert.ok(occ > 5 && occ < 120, `occasionnels ${occ.toFixed(1)} h en 14 jours`);
  assert.ok(ach > occ * 1.8, `acharnés ${ach.toFixed(1)} h contre ${occ.toFixed(1)} h`);
  assert.ok(ach < 14 * 24 * 0.7, "personne ne joue 24 h sur 24");
  const bots2 = liveBots(w, pop), r = buildRanking(me, bots2);
  assert.equal(r.length, pop.length + 1);
  assert.ok(sortRows(r, "heures")[0].hours > ach, "le plus assidu dépasse la moyenne des acharnés");
});

console.log(`\n${n} tests OK`);
