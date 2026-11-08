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
import { winAttackAction, loseAttackAction, attackCheck } from "../src/utils/guildActions.js";
import { attackProblem } from "../src/utils/sentinel.js";
import { ensureSentinelEnemy, sentinelStats, sentinelEncounter, SENT_ROUNDS, SENT_SHIELD_MS } from "../src/utils/sentinelFight.js";
import { ENEMY_EXTRA, enemyDef } from "../src/data/zones.js";
import { createCombat, advance } from "../src/combat/engine.js";
import { calcStats } from "../src/utils/calcStats.js";
import { makeBotPlayer, botSpec } from "../src/sim/partyBots.js";
import { evaluate, fight } from "./simulate-sentinel.js";
import { bagFree } from "../src/utils/bag.js";
import { bankFree } from "../src/utils/bank.js";

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

// ---------------------------------------------------------------- attaquer une sentinelle
// Un monde où une guilde simulée tient la sentinelle des Prairies, avec un butin dans son stock
const worldWithSentinel = (stock = { gold: 500, res: { croc_de_loup: 12, fourrure_grise: 3 } }, extra = {}) => {
  const p = withMarket(extra);
  const sims = p.market.sims, G = sims.guilds || (sims.guilds = newGuilds());
  const g = createGuild(G, { founder: pop[0].id, name: "Les Gardiens", step: p.market.bucket });
  g.level = 8; g.gold = 9999;
  placeSentinel(G, g, "prairies_sauvages", p.market.bucket);
  Object.assign(sentinelsOf(g).prairies_sauvages, { gold: stock.gold, res: { ...stock.res } });
  return { p, G, g };
};

test("le monstre de la sentinelle : fabriqué à part, hors du bestiaire, plus fort avec le niveau de la guilde", () => {
  const before = Object.keys(ENEMIES).length;
  const k5 = ensureSentinelEnemy(5), k20 = ensureSentinelEnemy(20);
  assert.equal(Object.keys(ENEMIES).length, before, "le bestiaire n'a pas bougé");
  assert.ok(ENEMY_EXTRA[k5] && enemyDef(k5) === ENEMY_EXTRA[k5] && !ENEMIES[k5]);
  assert.ok(sentinelStats(20).hp > sentinelStats(5).hp && sentinelStats(20).atkPhys > sentinelStats(5).atkPhys);
  assert.equal(enemyDef(k5).actions.length, 3, "trois sorts de base");
  assert.equal(enemyDef(k5).img, "/assets/sentinel/golem.png");
  const { g } = worldWithSentinel();
  const enc = sentinelEncounter(g, "prairies_sauvages");
  assert.deepEqual(enc.enemies, [k5.replace("5", "8")]); assert.equal(enc.sentinel.maxRounds, SENT_ROUNDS); assert.equal(enc.sentinel.gid, g.id);
});

test("combat : la limite de tours donne la défaite ; la sentinelle ne rapporte ni xp, ni or, ni compte de monstres tués", () => {
  const pl = makeBotPlayer("guerrier", 8), key = ensureSentinelEnemy(8);
  const slow = fight(pl, key, 1, false, 1);
  assert.equal(slow.phase, "defeat", "un seul tour de table permis : la sentinelle a tenu");
  const win = fight(makeBotPlayer("guerrier", 8), key, 1, true);
  assert.equal(win.phase, "victory");
  assert.deepEqual(win.rewards, { xp: 0, gold: 0, resources: {}, items: [], kills: {} });
});

test("attaquer : impossible sans sentinelle, sur la sienne ; protégée 1 h après une défaite, puis de nouveau possible", () => {
  const { p } = worldWithSentinel();
  assert.equal(attackCheck(p, "champs_calcines", T0), "pas_de_sentinelle");
  assert.equal(attackCheck(p, "prairies_sauvages", T0), null);
  const lose = loseAttackAction(p, "prairies_sauvages", T0);
  assert.ok(lose.ok);
  assert.equal(attackCheck(lose.player, "prairies_sauvages", T0 + 1000), "protegee");
  assert.equal(attackCheck(lose.player, "prairies_sauvages", T0 + SENT_SHIELD_MS - 1000), "protegee");
  assert.equal(attackCheck(lose.player, "prairies_sauvages", T0 + SENT_SHIELD_MS + 1000), null);
  assert.equal(winAttackAction(lose.player, "prairies_sauvages", T0 + 1000).reason, "protegee");
  assert.equal(loseAttackAction(p, "champs_calcines", T0).reason, "pas_de_sentinelle");
  // ma propre sentinelle
  let q = myGuildP({ market: structuredClone(p.market) });
  q = donateAction(q, 6000, T0).player; q = placeSentinelAction(q, "champs_calcines", T0).player;
  assert.equal(attackCheck(q, "champs_calcines", T0), "sienne");
  assert.equal(winAttackAction(q, "champs_calcines", T0).reason, "sienne");
});

test("victoire : tout le stock va au joueur, la sentinelle disparaît et la guilde peut en reposer une", () => {
  const { p, g } = worldWithSentinel();
  const gold0 = p.gold;
  const r = winAttackAction(p, "prairies_sauvages", T0);
  assert.ok(r.ok); assert.equal(r.gold, 500); assert.equal(r.player.gold, gold0 + 500);
  assert.equal(r.player.resources.croc_de_loup, 12); assert.equal(r.player.resources.fourrure_grise, 3);
  assert.deepEqual(r.bank, {}); assert.deepEqual(r.lost, {});
  const G2 = guildsOf(r.player), g2 = G2.byId[g.id];
  assert.equal(sentinelsOf(g2).prairies_sauvages, undefined); assert.equal(G2.sent.prairies_sauvages, undefined);
  assert.ok(g2.log.some((l) => /détruite/.test(l.txt)));
  assert.equal(placeProblem(G2, g2, "prairies_sauvages"), null, "la guilde peut en poser une autre (elle repaie)");
  assert.equal(attackCheck(r.player, "prairies_sauvages", T0), "pas_de_sentinelle");
  assert.equal(winAttackAction(r.player, "prairies_sauvages", T0).reason, "pas_de_sentinelle");
});

test("victoire, sac plein : le butin file au coffre personnel ; si tout est plein, le reste est perdu", () => {
  const res = {}; for (let i = 0; i < 6; i++) res[`rare_${i}`] = 1;
  const { p } = worldWithSentinel({ gold: 0, res });
  // sac : une seule place libre
  const resources = {}, n = bagFree(p) - 1;
  for (let i = 0; i < n; i++) resources[`remplissage_${i}`] = 1;
  const full = { ...p, resources };
  assert.equal(bagFree(full), 1);
  const r = winAttackAction(full, "prairies_sauvages", T0);
  assert.equal(Object.keys(r.res).length, 1, "une ressource tient dans le sac");
  assert.equal(Object.keys(r.bank).length, 5, "le reste va au coffre");
  assert.equal(bagFree(r.player), 0); assert.equal(Object.keys(r.player.bank.resources).length, 5);
  // coffre aussi presque plein
  const bank = { items: [], resources: {} }; const bn = bankFree({ ...full, bank }) - 2;
  for (let i = 0; i < bn; i++) bank.resources[`coffre_${i}`] = 1;
  const r2 = winAttackAction({ ...full, bank }, "prairies_sauvages", T0);
  assert.equal(Object.keys(r2.res).length, 1); assert.equal(Object.keys(r2.bank).length, 2); assert.equal(Object.keys(r2.lost).length, 3);
  // ajouter à une pile déjà là ne demande pas de place
  const r3 = winAttackAction({ ...p, resources: { ...resources, rare_0: 4 } }, "prairies_sauvages", T0);
  assert.equal(r3.player.resources.rare_0, 5);
});

test("équilibre : trois attaquants viennent à bout d'une sentinelle seule ; seul, c'est plus dur (l'assassin y laisse sa peau)", () => {
  for (const level of [8, 20]) for (const cls of ["guerrier", "assassin", "magicien"]) {
    const party = evaluate(cls, level, true, 8);
    assert.ok(party.win >= 0.9, `à trois (${cls}, niv ${level}) : ${party.win}`);
    assert.ok(party.rounds >= 2 && party.rounds < SENT_ROUNDS, "le combat dure, sans atteindre la limite");
  }
  assert.ok(evaluate("assassin", 8, false, 8).win < 0.7, "seul, l'assassin n'y arrive pas à tous les coups");
});

enableSimMarket(false);
console.log(`\n${n} tests OK`);
