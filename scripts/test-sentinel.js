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
import { SENT_SPELLS, SENT_STATS, SENT_STAT_KEYS, SENT_MAX_SPELLS, SENT_STAT_CAP } from "../src/data/sentinel.js";
import {
  totalPoints, freePoints, spentPoints, ptsOf, sharesOf, lootMult, lootShareOf, unlockedSpells, equippedIds, equippedSpells, pointsProblem, setPoints, resetCost,
  spellsProblem, setSpells, autoAlloc, emptyPts,
} from "../src/utils/sentinelBuild.js";
import { setSentinelPointsAction, resetSentinelPointsAction, setSentinelSpellsAction } from "../src/utils/guildActions.js";
import { ENEMY_EXTRA, enemyDef } from "../src/data/zones.js";
import { createCombat, advance, endTurn, castSpell } from "../src/combat/engine.js";
import { calcStats } from "../src/utils/calcStats.js";
import { makeBotPlayer, botSpec } from "../src/sim/partyBots.js";
import { evaluate, fight, guildWith } from "./simulate-sentinel.js";
import { bagFree } from "../src/utils/bag.js";
import { bankFree } from "../src/utils/bank.js";
import { defenderBots, ensureDefenderEnemy, DEFENDERS_MAX } from "../src/utils/sentinelDefense.js";
import { isActive, STEP_MS } from "../src/sim/lives.js";
import { enemySlots } from "../src/components/combat/stage.js";

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

test("le monstre de la sentinelle : fabriqué à part, hors du bestiaire, plus fort avec le niveau et les points de la guilde", () => {
  const before = Object.keys(ENEMIES).length;
  const g5 = guildWith(5), g20 = guildWith(20);
  const k5 = ensureSentinelEnemy(g5), k20 = ensureSentinelEnemy(g20);
  assert.equal(Object.keys(ENEMIES).length, before, "le bestiaire n'a pas bougé");
  assert.ok(ENEMY_EXTRA[k5] && enemyDef(k5) === ENEMY_EXTRA[k5] && !ENEMIES[k5]);
  assert.ok(sentinelStats(g20).hp > sentinelStats(g5).hp && sentinelStats(g20).atkPhys > sentinelStats(g5).atkPhys);
  assert.ok(sentinelStats(guildWith(20, "vitalite")).hp > sentinelStats(guildWith(20, "aucun")).hp * 3, "la vitalité fait les PV");
  const l1 = { id: "n", level: 1, sentBuild: { pts: { vitalite: 1 } } }, l1b = { id: "n", level: 1 };
  assert.ok(sentinelStats(l1).hp < sentinelStats(l1b).hp * 1.3, "niveau 1 : un point ne change pas tout (+33 PV sur 300, pas +800)");
  assert.ok(sentinelStats(guildWith(20, "force")).atkPhys > sentinelStats(guildWith(20, "aucun")).atkPhys * 3, "la force fait les dégâts");
  assert.ok(sentinelStats(guildWith(20, "defense")).defPhys > sentinelStats(guildWith(20, "aucun")).defPhys * 3, "la défense réduit les dégâts");
  assert.equal(enemyDef(k5).img, "/assets/sentinel/golem.webp");
  assert.deepEqual(enemyDef(k5).actions.map((a) => a.id), ["poing_de_pierre", "peau_de_granit"], "niveau 5 : deux sorts débloqués, tous deux équipés");
  const { g } = worldWithSentinel();
  const enc = sentinelEncounter(g, "prairies_sauvages");
  assert.deepEqual(enc.enemies, [`sentinelle_${g.id}`]); assert.equal(enc.sentinel.maxRounds, SENT_ROUNDS); assert.equal(enc.sentinel.gid, g.id);
});

test("la fiche : 3 points par niveau, 60 % au plus par caractéristique, la chance fait le butin", () => {
  const g = { id: "x", level: 10 };
  assert.equal(totalPoints(10), 30); assert.equal(freePoints(g), 30);
  assert.equal(pointsProblem(g, { ...emptyPts(), vitalite: 18 }), null);
  assert.equal(pointsProblem(g, { ...emptyPts(), vitalite: 19 }), "points_max", "plus de 60 %");
  assert.equal(pointsProblem(g, { ...emptyPts(), vitalite: 15, force: 16 }), "points", "plus que le total");
  assert.equal(pointsProblem(g, { ...emptyPts(), vitalite: -1 }), "points"); assert.equal(pointsProblem(g, { ...emptyPts(), vitalite: 1.5 }), "points");
  setPoints(g, { ...emptyPts(), vitalite: 10, chance: 18 });
  assert.equal(spentPoints(g), 28); assert.equal(freePoints(g), 2);
  assert.equal(sharesOf(g).chance, 0.3, "niveau 10 : 18 points sur la référence de 60");
  assert.equal(lootMult({ level: 10 }), 0.6, "sans point : 0,6");
  assert.ok(Math.abs(lootMult(g) - 1.02) < 1e-9);
  assert.ok(Math.abs(lootMult({ level: 30, sentBuild: { pts: { chance: 54 } } }) - 1.44) < 1e-9, "le maximum à partir du niveau 20");
  assert.ok(lootShareOf(g) > lootShareOf({ level: 10 }) * 1.5);
  assert.ok(lootShareOf(g) <= 1, "jamais plus qu'un tirage de joueur");
  assert.equal(SENT_STATS.length, 5); assert.deepEqual(SENT_STAT_KEYS, ["vitalite", "force", "defense", "vitesse", "chance"]);
  assert.equal(resetCost({ level: 10 }), 1000);
  // la chance se voit dans le butin réel
  const keys = ["loup_des_plaines", "sanglier_sauvage", "bandit_des_routes"], r1 = makeRng(5), r2 = makeRng(5);
  let low = 0, high = 0;
  for (let i = 0; i < 2000; i++) { low += lootRoll(keys, r1, lootShareOf({ level: 10 })).gold; high += lootRoll(keys, r2, lootShareOf(g)).gold; }
  assert.ok(high > low * 1.5, "beaucoup de chance : une fois et demie le butin");
});

test("les sorts : un de départ, un tous les 5 niveaux, 3 équipés au plus ; sans choix, les 3 plus forts débloqués", () => {
  assert.equal(SENT_SPELLS.length, 11); assert.equal(SENT_SPELLS[0].level, 1);
  SENT_SPELLS.slice(1).forEach((sp, i) => assert.equal(sp.level, 5 * (i + 1)));
  assert.equal(SENT_SPELLS.filter((sp) => sp.self).length, 5, "cinq soutiens");
  assert.equal(SENT_SPELLS.filter((sp) => !sp.self).length, 6, "six attaques (le poing de départ compris)");
  const power = (sp) => sp.power || 0; assert.ok(power(SENT_SPELLS.at(-1)) > Math.max(...SENT_SPELLS.slice(0, -1).map(power)), "le meilleur sort est au niveau 50");
  assert.deepEqual(unlockedSpells({ level: 4 }).map((s) => s.id), ["poing_de_pierre"]);
  assert.equal(unlockedSpells({ level: 50 }).length, 11);
  assert.deepEqual(equippedIds({ level: 4 }), ["poing_de_pierre"]);
  assert.deepEqual(equippedIds({ level: 50 }), ["carapace", "rempart", "colere_du_monolithe"]);
  const g = { level: 25 };
  assert.equal(spellsProblem(g, ["poing_de_pierre", "ecrasement", "regard_de_pierre"]), null);
  assert.equal(spellsProblem(g, ["poing_de_pierre", "ecrasement", "regard_de_pierre", "peau_de_granit"]), "sorts", "4 : trop");
  assert.equal(spellsProblem(g, ["secousse"]), "sorts", "pas encore débloqué"); assert.equal(spellsProblem(g, ["poing_de_pierre", "poing_de_pierre"]), "sorts");
  setSpells(g, ["ecrasement", "peau_de_granit"]);
  assert.deepEqual(equippedIds(g), ["ecrasement", "peau_de_granit"]);
  assert.deepEqual(equippedSpells(g).map((s) => s.name), ["Écrasement", "Peau de granit"]);
});

test("simulés : leurs points se placent tout seuls, sans dépasser le plafond, de façon stable", () => {
  const g = { id: "g1", level: 20 }, h = { id: "g1", level: 20 };
  assert.ok(autoAlloc(g)); autoAlloc(h);
  assert.equal(freePoints(g), 0); assert.deepEqual(ptsOf(g), ptsOf(h));
  const cap = Math.ceil(60 * SENT_STAT_CAP); for (const k of SENT_STAT_KEYS) assert.ok(ptsOf(g)[k] <= cap && ptsOf(g)[k] >= 0);
  assert.equal(autoAlloc(g), false, "plus rien à placer");
  g.level = 25; assert.ok(autoAlloc(g), "un niveau de plus : de nouveaux points"); assert.equal(freePoints(g), 0);
  const other = { id: "g2", level: 20 }; autoAlloc(other);
  assert.notDeepEqual(ptsOf(other), ptsOf(h), "chaque guilde a sa façon de jouer");
});

test("actions : le chef place les points, remet à zéro contre la caisse et choisit les sorts", () => {
  let p = myGuildP(); const g0 = myGuild(p);
  p = donateAction(p, 2000, T0).player;
  const pts = { ...emptyPts(), vitalite: 1, chance: 1 };
  assert.equal(setSentinelPointsAction(p, { ...emptyPts(), vitalite: 4 }, T0).reason, "points_max", "niveau 1 : 3 points, 2 au plus par caractéristique");
  assert.equal(setSentinelPointsAction(p, { ...emptyPts(), vitalite: 2, force: 2 }, T0).reason, "points");
  const r = setSentinelPointsAction(p, pts, T0); assert.ok(r.ok);
  assert.deepEqual(ptsOf(myGuild(r.player)), pts); assert.equal(freePoints(myGuild(r.player)), 1);
  const gold = myGuild(r.player).gold, rs = resetSentinelPointsAction(r.player, T0);
  assert.ok(rs.ok); assert.equal(rs.cost, 100); assert.equal(myGuild(rs.player).gold, gold - 100); assert.equal(spentPoints(myGuild(rs.player)), 0);
  assert.equal(resetSentinelPointsAction(myGuildP(), T0).reason, "caisse");
  assert.equal(setSentinelSpellsAction(p, ["secousse"], T0).reason, "sorts");
  const s = setSentinelSpellsAction(p, ["poing_de_pierre"], T0); assert.ok(s.ok); assert.deepEqual(equippedIds(myGuild(s.player)), ["poing_de_pierre"]);
  assert.equal(setSentinelPointsAction(withMarket(), pts, T0).reason, "pas_membre");
  assert.equal(g0.level, 1);
});

test("combat : la limite de tours donne la défaite ; la sentinelle ne rapporte ni xp, ni or, ni compte de monstres tués", () => {
  const pl = makeBotPlayer("guerrier", 8), key = ensureSentinelEnemy(guildWith(8));
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

test("victoire en groupe : le stock est partagé à parts égales entre le joueur et les simulés ; le reste de la division revient au joueur", () => {
  const { p, g } = worldWithSentinel();
  const lives = p.market.sims.lives, ids = Object.keys(lives).slice(0, 2);
  const before = ids.map((id) => ({ gold: lives[id].gold, croc: lives[id].bag?.res?.croc_de_loup || 0, fourr: lives[id].bag?.res?.fourrure_grise || 0 }));
  const r = winAttackAction(p, "prairies_sauvages", T0, ids);
  assert.ok(r.ok); assert.equal(r.group, 2);
  assert.deepEqual(r.each, { gold: 166, res: { croc_de_loup: 4, fourrure_grise: 1 } });
  assert.equal(r.gold, 168, "500 = 166 + 166 + 168 (le reste au joueur)");
  assert.equal(r.player.resources.croc_de_loup, 4); assert.equal(r.player.resources.fourrure_grise, 1);
  ids.forEach((id, i) => {
    const l = r.player.market.sims.lives[id];
    assert.equal(l.gold, before[i].gold + 166);
    assert.equal(l.bag.res.croc_de_loup, before[i].croc + 4); assert.equal(l.bag.res.fourrure_grise, before[i].fourr + 1);
  });
  assert.equal(p.market.sims.lives[ids[0]].gold, before[0].gold, "l'ancien état n'est pas modifié");
  // rien ne se perd : total = stock
  assert.equal(r.gold + 2 * r.each.gold, 500);
  assert.equal(r.player.resources.croc_de_loup + 2 * r.each.res.croc_de_loup, 12);
  assert.equal(r.player.resources.fourrure_grise + 2 * r.each.res.fourrure_grise, 3);
  // à deux : moitié-moitié
  const duo = winAttackAction(p, "prairies_sauvages", T0, [ids[0]]);
  assert.equal(duo.group, 1); assert.equal(duo.gold, 250); assert.equal(duo.each.gold, 250);
  assert.equal(duo.player.resources.croc_de_loup, 6); assert.equal(duo.each.res.croc_de_loup, 6);
  assert.equal(duo.player.market.sims.lives[ids[1]].gold, before[1].gold, "l'autre simulé ne reçoit rien");
  // un id inconnu est ignoré : tout revient au joueur
  const solo = winAttackAction(p, "prairies_sauvages", T0, ["inconnu"]);
  assert.equal(solo.gold, 500); assert.equal(solo.group, 0);
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
  assert.ok(evaluate("assassin", 20, false, 8).win < 0.7, "seul, l'assassin n'y arrive pas à tous les coups");
});

// ---------------------------------------------------------------- les sorts de soutien et de zone dans le moteur
test("moteur : soutiens (défense, régénération, bouclier, soin, rempart) et attaque de zone de la sentinelle", () => {
  const level = 50, pl = makeBotPlayer("guerrier", level), st = calcStats(pl);   // niveau 50 : tous les sorts sont débloqués
  const run = (spellIds, { allies = [], hurt = 0, rounds = 1, seed = 4 } = {}) => {
    const g = { ...guildWith(level), sentBuild: { pts: guildWith(level).sentBuild.pts, spells: spellIds } };
    const key = ensureSentinelEnemy(g);
    let s = createCombat({ stats: st, weaponType: "epee", classKey: "guerrier", level, enemyKeys: [key], spells: [], seed, allies });
    s.enemies[0].hp = Math.round(s.enemies[0].maxHp * (1 - hurt));
    const events = [];
    for (let i = 0; i < 40 && s.round <= rounds && s.phase !== "victory" && s.phase !== "defeat"; i++) {
      const r = advance(s); s = r.state; events.push(...r.events);
      if (s.phase === "playerTurn") s = endTurnState(s);
    }
    return { s, events, e: s.enemies[0] };
  };
  const endTurnState = (s) => endTurn(s).state;
  assert.ok(run(["peau_de_granit"]).e.effects.some((x) => x.kind === "armor" && x.value === 0.3), "Peau de granit : +30 % de défense");
  assert.ok(run(["mousse_vivante"]).e.effects.some((x) => x.kind === "hot"), "Mousse vivante : régénération");
  const hurt = run(["mousse_vivante"], { hurt: 0.5, rounds: 3 }); assert.ok(hurt.events.some((x) => x.type === "heal"), "elle se soigne à son tour");
  const sh = run(["bouclier_de_roche"]).e.effects.find((x) => x.kind === "shield"); assert.ok(sh && sh.value > 0, "un bouclier est posé");
  const carapace = run(["carapace"], { hurt: 0.5 }); assert.ok(carapace.e.hp > carapace.e.maxHp * 0.5, "Carapace soigne");
  assert.ok(run(["carapace"], { hurt: 0 }).events.every((x) => x.type !== "heal"), "inutile à pleine santé : elle ne le lance pas");
  assert.ok(run(["rempart"]).e.effects.some((x) => x.kind === "reduce" && x.value === 0.4), "Rempart");
  // Secousse touche tous les attaquants
  const allies = [botSpec("assassin", level), botSpec("magicien", level)];
  const aoe = run(["secousse"], { allies });
  const hits = aoe.events.filter((x) => (x.type === "hit" || x.type === "miss") && x.from === "e0");
  assert.ok(new Set(hits.map((h) => h.to)).size === 3, "les trois héros sont frappés par la même attaque");
  // un bouclier absorbe, un rempart réduit (côté héros, avec le même tirage)
  const hitOn = (effect) => {
    const g = { ...guildWith(level), sentBuild: { pts: guildWith(level).sentBuild.pts, spells: ["poing_de_pierre"] } };
    let c = createCombat({ stats: st, weaponType: "epee", classKey: "guerrier", level, enemyKeys: [ensureSentinelEnemy(g)], spells: [], seed: 9 });
    if (effect) c.player.effects.push(effect);
    for (let i = 0; i < 6; i++) { const r = advance(c); c = r.state; const h = r.events.find((x) => x.type === "hit" && x.from === "e0"); if (h) return { h, c }; if (c.phase === "playerTurn") c = endTurn(c).state; }
    return null;
  };
  const plain = hitOn(null).h.amount, reduced = hitOn({ kind: "reduce", turns: 3, value: 0.5 }).h.amount;
  assert.ok(reduced < plain * 0.7 && reduced > 0, `rempart : ${reduced} < ${plain}`);
  const sh2 = hitOn({ kind: "shield", turns: 3, value: 100000 });
  assert.equal(sh2.h.amount, 0); assert.ok(sh2.h.absorbed > 0); assert.equal(sh2.c.player.hp, sh2.c.player.maxHp, "tout est absorbé");
});

test("les défenseurs : des membres connectés de la guilde, 3 au plus, jamais d'étranger ni le joueur", () => {
  const sample = pop.slice(0, 40), members = Object.fromEntries(sample.map((b) => [b.id, {}]));
  const g = { id: "gdef", level: 20, members: { ...members, player: {} } };
  let found = null;
  for (let h = 0; h < 48 && !found; h++) { const t = T0 + h * 3600_000; const d = defenderBots(g, pop, t); if (d.length === DEFENDERS_MAX) found = { t, d }; }
  assert.ok(found, "à un moment, trois membres sont connectés");
  for (const b of found.d) { assert.ok(g.members[b.id] && b.id !== "player"); assert.ok(isActive(b, Math.floor(found.t / STEP_MS))); }
  assert.deepEqual(defenderBots(g, pop, found.t).map((b) => b.id), found.d.map((b) => b.id), "stable pendant l'heure");
  assert.equal(defenderBots({ id: "vide", members: {} }, pop, found.t).length, 0, "sans membre, pas de défenseur");
  assert.equal(defenderBots({ id: "x", members: { [pop[200].id]: {} } }, pop.slice(0, 100), found.t).length, 0, "un membre absent de la population est ignoré");
});

test("un défenseur est un monstre aux vraies caractéristiques du simulé, retourné, sans butin", () => {
  const bot = pop.find((b) => b.level >= 15) || pop[0];
  const k = ensureDefenderEnemy(bot), d = enemyDef(k);
  assert.ok(d.defender && d.flip && d.extra && d.img && d.stats.hp > 0 && d.stats.atkPhys + d.stats.atkMagie > 0);
  assert.ok(d.actions.length >= 1 && d.actions.every((a) => a.power > 0 && a.type !== "buff" && a.name), "sorts d'attaque seulement, tous nommés");
  assert.equal(d.xp, 0); assert.equal(d.gold, null); assert.deepEqual(d.drops, []);
});

test("rencontre défendue : la sentinelle d'abord, puis ses défenseurs ; quatre emplacements à l'écran", () => {
  const g = { ...guildWith(20), name: "Les Gardes", id: "gdef2" };
  const defs = pop.filter((b) => b.level >= 5).slice(0, 3);
  const enc = sentinelEncounter(g, "marais", defs);
  assert.equal(enc.enemies.length, 4); assert.ok(enc.enemies[0].startsWith("sentinelle_")); assert.ok(enc.enemies.slice(1).every((k) => k.startsWith("defenseur_")));
  assert.equal(enc.sentinel.defenders.length, 3); assert.match(enc.desc, /3 défenseurs/);
  assert.equal(sentinelEncounter(g, "marais").enemies.length, 1, "sans défenseur : la sentinelle seule");
  const slots = enemySlots(enc.enemies.map((key) => ({ key })));
  assert.equal(slots.length, 4); assert.equal(new Set(slots.map((x) => `${x.x}/${x.b}`)).size, 4, "quatre places distinctes");
});

test("objectif sentinelle : on gagne dès qu'elle tombe, ses défenseurs fussent-ils debout ; le temps joue pour eux", () => {
  const level = 10, g = { ...guildWith(level), name: "G", id: "gdef3" };
  const defs = [{ id: "d-a", name: "Aa", classKey: "guerrier", level }, { id: "d-b", name: "Bb", classKey: "magicien", level }];
  const keys = [ensureSentinelEnemy(g), ...defs.map(ensureDefenderEnemy)];
  const player = makeBotPlayer("guerrier", level), st = calcStats(player);
  let c = createCombat({ stats: st, weaponType: "epee", classKey: "guerrier", level, enemyKeys: keys, spells: [], seed: 3, objective: "sentinel", maxRounds: 12 });
  c.enemies[0].hp = 1; c.enemies[0].alive = false;      // la sentinelle est à terre, les défenseurs sont intacts
  const ev = []; const s2 = structuredClone(c);
  s2.phase = "running"; const r = advance(s2); assert.ok(r.events.some((x) => x.type === "victory") || r.state.phase === "victory", "victoire : la sentinelle est tombée");
  assert.ok(r.state.enemies[1].alive && r.state.enemies[2].alive, "les défenseurs sont toujours debout");
  // sans objectif, il faudrait tous les abattre
  const c2 = createCombat({ stats: st, weaponType: "epee", classKey: "guerrier", level, enemyKeys: keys, spells: [], seed: 3 });
  c2.enemies[0].alive = false; const r2 = advance(c2); assert.notEqual(r2.state.phase, "victory");
  // le temps : un joueur qui ne fait que passer son tour perd, sentinelle debout
  let t = createCombat({ stats: st, weaponType: "epee", classKey: "guerrier", level: 1, enemyKeys: [keys[0]], spells: [], seed: 4, objective: "sentinel", maxRounds: 2 });
  for (let i = 0; i < 200 && t.phase !== "defeat" && t.phase !== "victory"; i++) t = t.phase === "running" ? advance(t).state : endTurn(t).state;
  assert.notEqual(t.phase, "victory");
});

test("avec trois défenseurs l'attaque reste jouable à trois (niveau 20 : 25 à 90 %), et plus dure que sans défenseur", () => {
  const sans = evaluate("guerrier", 20, true, 24, "equilibre", 0), avec = evaluate("guerrier", 20, true, 24, "equilibre", 3);
  assert.ok(avec.win >= 0.2 && avec.win <= 0.92, `avec 3 défenseurs : ${avec.win}`);
  assert.ok(avec.win < sans.win, `${avec.win} < ${sans.win}`);
});

enableSimMarket(false);
console.log(`\n${n} tests OK`);
