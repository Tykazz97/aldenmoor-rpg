// Sentinelles (étape 1) :  node scripts/test-sentinel.js
import assert from "node:assert/strict";
import { SENT_REGIONS, SENT_BY_KEY, REGION_OF_ENEMY, SENT_LOOT_SHARE, sentinelSlots, sentinelGoldCap, sentinelResCap } from "../src/data/sentinel.js";
import { ZONES, ENEMIES } from "../src/data/zones.js";
import { newGuilds, createGuild, addMember, removeMember, tabFree } from "../src/utils/guildCore.js";
import {
  sentinelsOf, rebuildSent, placeProblem, placeSentinel, removeProblem, removeSentinel, lootRoll, addLoot, feedFight, collectStock,
  creditPlayerFight, sentinelFeeder, regionOfFight,
} from "../src/utils/sentinel.js";
import { createGuildAction, placeSentinelAction, removeSentinelAction, collectSentinelAction, myGuild, guildsOf, donateAction } from "../src/utils/guildActions.js";
import { stepGuilds } from "../src/sim/guilds.js";
import { stepLivesOne, createLives } from "../src/sim/lives.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { getPopulation } from "../src/sim/population.js";
import { makeRng } from "../src/sim/rng.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Sentinelles");
const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);

test("les régions : trois, chacune avec ses monstres, sans monstre en double", () => {
  assert.equal(SENT_REGIONS.length, ZONES.aldenmoor.regions.length);
  const seen = new Set();
  for (const r of SENT_REGIONS) { assert.ok(r.cost > 0); for (const k of r.enemies) { assert.ok(ENEMIES[k], k); assert.ok(!seen.has(k), `${k} en double`); seen.add(k); assert.equal(REGION_OF_ENEMY[k], r.key); } }
  assert.ok(SENT_REGIONS[0].cost < SENT_REGIONS[2].cost, "plus la région est dure, plus la pose coûte");
  assert.equal(regionOfFight(["loup_des_plaines", "sanglier_sauvage"]), "prairies_sauvages");
  assert.equal(regionOfFight(["inconnu"]), null);
});

test("emplacements et plafonds grandissent avec le niveau de guilde", () => {
  assert.equal(sentinelSlots(1), 1); assert.equal(sentinelSlots(9), 1); assert.equal(sentinelSlots(10), 2); assert.equal(sentinelSlots(50), 6);
  assert.ok(sentinelGoldCap(20) > sentinelGoldCap(1)); assert.ok(sentinelResCap(20) > sentinelResCap(1));
});

const mk = (gold = 20000, level = 1) => {
  const G = newGuilds();
  const g = createGuild(G, { founder: "a", name: "Les Anciens", step: 0 });
  g.gold = gold; g.level = level;
  return { G, g };
};

test("poser : coût payé par la caisse, une seule sentinelle par région, plafond du niveau", () => {
  const { G, g } = mk(2000);
  assert.equal(placeProblem(G, g, "nulle_part"), "zone");
  assert.equal(placeProblem(G, g, "champs_calcines"), "caisse");
  assert.equal(placeProblem(G, g, "prairies_sauvages"), null);
  placeSentinel(G, g, "prairies_sauvages", 5);
  assert.equal(g.gold, 0); assert.equal(G.sent.prairies_sauvages, g.id); assert.ok(sentinelsOf(g).prairies_sauvages);
  assert.equal(placeProblem(G, g, "prairies_sauvages"), "deja_posee");
  g.gold = 99999;
  assert.equal(placeProblem(G, g, "champs_calcines"), "sentinelle_max", "niveau 1 : une seule");
  g.level = 10;
  assert.equal(placeProblem(G, g, "champs_calcines"), null);
  const other = createGuild(G, { founder: "b", name: "Les Autres", step: 0 }); other.gold = 99999;
  assert.equal(placeProblem(G, other, "prairies_sauvages"), "zone_prise", "la première arrivée garde la place");
});

test("le butin : tirage de joueur réduit, seulement or et ressources, sans équipement", () => {
  const keys = ["loup_des_plaines", "sanglier_sauvage", "bandit_des_routes"];
  let gold = 0, ref = 0, res = 0; const ids = new Set();
  const N = 4000, r = makeRng(7);
  for (let i = 0; i < N; i++) {
    const l = lootRoll(keys, r); gold += l.gold; for (const [id, q] of Object.entries(l.res)) { res += q; ids.add(id); }
    for (const k of keys) { const d = ENEMIES[k].gold; if (d) ref += (d[0] + d[1]) / 2; }
  }
  assert.ok(Math.abs(gold / ref - SENT_LOOT_SHARE) < 0.08, `or ≈ ${SENT_LOOT_SHARE} d'un joueur (${(gold / ref).toFixed(2)})`);
  assert.ok(res > 0 && ids.size > 0, "il ramasse des ressources");
  for (const id of ids) assert.ok(keys.some((k) => ENEMIES[k].drops.some((d) => d.type === "resource" && d.id === id)), `${id} vient bien d'un drop de ressource`);
  assert.deepEqual(lootRoll(["inconnu"], makeRng(1)), { gold: 0, res: {} });
});

test("le stock est plafonné ; relever : l'or à la caisse, les ressources au coffre", () => {
  const { G, g } = mk(5000);
  placeSentinel(G, g, "prairies_sauvages", 1);
  addLoot(g, "prairies_sauvages", { gold: 999999, res: { bois_commun: 999999 } });
  const s = sentinelsOf(g).prairies_sauvages;
  assert.equal(s.gold, sentinelGoldCap(1)); assert.equal(s.res.bois_commun, sentinelResCap(1));
  const before = g.gold;
  const c = collectStock(g, "prairies_sauvages", 3);
  assert.equal(c.gold, sentinelGoldCap(1)); assert.equal(g.gold, before + c.gold);
  assert.equal(g.bank[0].res.bois_commun, sentinelResCap(1)); assert.equal(s.gold, 0); assert.deepEqual(s.res, {});
  assert.equal(c.left, 0);
});

test("relever : une ressource qui ne tient pas dans le coffre reste sur place", () => {
  const { G, g } = mk(5000);
  placeSentinel(G, g, "prairies_sauvages", 1);
  const free = tabFree(g.bank[0]);
  for (let i = 0; i < free; i++) g.bank[0].res[`remplissage_${i}`] = 1;
  assert.equal(tabFree(g.bank[0]), 0);
  addLoot(g, "prairies_sauvages", { gold: 10, res: { fer_commun: 5 } });
  const c = collectStock(g, "prairies_sauvages", 3);
  assert.equal(c.gold, 10); assert.equal(c.moved, 0); assert.equal(c.left, 5);
  assert.equal(sentinelsOf(g).prairies_sauvages.res.fer_commun, 5);
  assert.equal(removeProblem(g, "prairies_sauvages"), "stock_plein");
  g.bank[0].res.fer_commun = 1; delete g.bank[0].res.remplissage_0;                       // une place se libère
  assert.equal(collectStock(g, "prairies_sauvages", 4).moved, 5);
  assert.equal(removeProblem(g, "prairies_sauvages"), null);
  removeSentinel(G, g, "prairies_sauvages", 5);
  assert.equal(sentinelsOf(g).prairies_sauvages, undefined); assert.equal(G.sent.prairies_sauvages, undefined);
});

test("un combat de simulé dans la région : seule la guilde qui y veille gagne du butin", () => {
  const { G, g } = mk(5000);
  placeSentinel(G, g, "prairies_sauvages", 1);
  const keys = ["loup_des_plaines", "sanglier_sauvage"];
  for (let i = 0; i < 300; i++) feedFight(G, "prairies_sauvages", keys, `t${i}`);
  assert.ok(sentinelsOf(g).prairies_sauvages.gold > 0);
  const gold = sentinelsOf(g).prairies_sauvages.gold;
  for (let i = 0; i < 300; i++) feedFight(G, "champs_calcines", ["squelette_fermier"], `u${i}`);    // autre région : rien
  assert.equal(sentinelsOf(g).prairies_sauvages.gold, gold);
  const a = mk(5000), b = mk(5000);
  placeSentinel(a.G, a.g, "prairies_sauvages", 1); placeSentinel(b.G, b.g, "prairies_sauvages", 1);
  feedFight(a.G, "prairies_sauvages", keys, "same"); feedFight(b.G, "prairies_sauvages", keys, "same");
  assert.deepEqual(sentinelsOf(a.g), sentinelsOf(b.g), "déterministe");
});

test("la guilde qui disparaît libère ses régions ; l'annuaire se répare tout seul", () => {
  const { G, g } = mk(5000);
  placeSentinel(G, g, "prairies_sauvages", 1);
  const out = removeMember(G, g, "a", 9);
  assert.ok(out.disbanded); assert.equal(G.sent.prairies_sauvages, undefined);
  const x = mk(5000); const y = createGuild(x.G, { founder: "b", name: "Les Autres", step: 0 });
  x.g.sentinels = { prairies_sauvages: { placed: 0, gold: 5, res: {} }, nulle_part: { placed: 0, gold: 1, res: {} } };
  y.sentinels = { prairies_sauvages: { placed: 0, gold: 5, res: {} }, champs_calcines: "abîmé" };
  x.G.sent = { prairies_sauvages: "fantome" };
  rebuildSent(x.G);
  assert.equal(Object.keys(x.G.sent).length, 1); const owner = x.G.sent.prairies_sauvages;
  assert.ok(owner === x.g.id || owner === y.id);
  assert.equal(sentinelsOf(x.g).nulle_part, undefined); assert.equal(sentinelsOf(y).champs_calcines, undefined);
  assert.ok(!(owner === x.g.id ? y.sentinels : x.g.sentinels), "le perdant n'a plus rien");
});

// ---------------------------------------------------------------- actions du joueur et combats
enableSimMarket(true);
const base = newMarket(T0);
const withMarket = (extra = {}) => ({ ...createPlayer({ name: "Moi", classKey: "guerrier" }), gold: 50000, market: structuredClone(base), ...extra });
const myGuildP = (extra = {}) => { const r = createGuildAction(withMarket(extra), "Les Braves", T0); assert.ok(r.ok); return r.player; };

test("actions : poser, relever, retirer — réservées au chef et au bras droit, rien sans guilde", () => {
  const p0 = withMarket();
  assert.equal(placeSentinelAction(p0, "prairies_sauvages", T0).reason, "pas_membre");
  let p = myGuildP();
  assert.equal(placeSentinelAction(p, "prairies_sauvages", T0).reason, "caisse", "la caisse est vide");
  p = donateAction(p, 6000, T0).player;
  assert.equal(placeSentinelAction(p, "nulle_part", T0).reason, "zone");
  const r = placeSentinelAction(p, "prairies_sauvages", T0);
  assert.ok(r.ok); p = r.player;
  const g = myGuild(p);
  assert.equal(g.gold, 6000 - SENT_BY_KEY.prairies_sauvages.cost); assert.ok(sentinelsOf(g).prairies_sauvages);
  assert.equal(guildsOf(p).sent.prairies_sauvages, g.id);
  assert.equal(placeSentinelAction(p, "prairies_sauvages", T0).reason, "deja_posee");
  assert.equal(collectSentinelAction(p, "prairies_sauvages", T0).reason, "aucun", "stock vide");
  assert.equal(collectSentinelAction(p, "champs_calcines", T0).reason, "pas_de_sentinelle");
  assert.equal(removeSentinelAction(p, "champs_calcines", T0).reason, "pas_de_sentinelle");
  // butin pendant mes combats
  const kills = { loup_des_plaines: 2, sanglier_sauvage: 1 };
  for (let i = 0; i < 100; i++) p = creditPlayerFight(p, kills, `k${i}`);
  const s = sentinelsOf(myGuild(p)).prairies_sauvages;
  assert.ok(s.gold > 0, "la sentinelle a gagné de l'or sur mes combats");
  assert.equal(removeSentinelAction(p, "prairies_sauvages", T0).reason, "stock_plein");
  const goldBefore = myGuild(p).gold, stock = s.gold;
  const c = collectSentinelAction(p, "all", T0);
  assert.ok(c.ok); assert.equal(c.gold, stock);
  assert.equal(myGuild(c.player).gold, goldBefore + stock);
  const rem = removeSentinelAction(c.player, "prairies_sauvages", T0);
  assert.ok(rem.ok); assert.equal(guildsOf(rem.player).sent.prairies_sauvages, undefined);
});

test("mes combats : rien de pris au joueur, rien pour une région sans sentinelle ou un donjon", () => {
  let p = myGuildP(); p = donateAction(p, 6000, T0).player; p = placeSentinelAction(p, "prairies_sauvages", T0).player;
  const gold0 = p.gold;
  const q = creditPlayerFight(p, { champs_calcines_inconnu: 3 }, "x");
  assert.equal(q, p, "monstre inconnu : le joueur est renvoyé tel quel");
  const q2 = creditPlayerFight(p, { squelette_fermier: 2 }, "x");
  assert.equal(q2, p, "autre région : rien");
  const q3 = creditPlayerFight(p, { loup_des_plaines: 1 }, "y");
  assert.equal(q3.gold, gold0); assert.deepEqual(q3.resources, p.resources); assert.deepEqual(q3.inventory, p.inventory);
  assert.equal(creditPlayerFight(withMarket(), { loup_des_plaines: 1 }, "z").gold, 50000, "sans guilde : inchangé");
});

test("les simulés : le monde tourne, les sentinelles se remplissent et sont relevées", () => {
  const p = withMarket();
  const sims = p.market.sims;
  const G = sims.guilds || (sims.guilds = newGuilds());
  const founder = pop[0].id;
  const g = createGuild(G, { founder, name: "Les Anciens", step: p.market.bucket });
  g.gold = 5000; g.level = 5;
  placeSentinel(G, g, "prairies_sauvages", p.market.bucket);
  for (let i = 1; i < 12; i++) addMember(G, g, pop[i].id, p.market.bucket);
  const feeder = sentinelFeeder(sims);
  let step = sims.step;
  for (let i = 0; i < 6 * 12; i++) { stepLivesOne(sims, pop, step, { merchant: false, keep: 120, onFight: feeder }); stepGuilds(sims, pop, step); step++; }
  assert.ok(g.log.some((l) => /Relève de la sentinelle/.test(l.txt)), "le chef a relevé du butin gagné par les simulés");
});

enableSimMarket(false);
console.log(`\n${n} tests OK`);
