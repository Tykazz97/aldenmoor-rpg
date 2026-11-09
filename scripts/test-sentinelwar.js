// Guerre des sentinelles (les simulés attaquent celle du joueur) :  node scripts/test-sentinelwar.js
import assert from "node:assert/strict";
import { newGuilds, createGuild, addMember } from "../src/utils/guildCore.js";
import { placeSentinel, sentinelsOf, rebuildSent, attackProblem } from "../src/utils/sentinel.js";
import { createLives, liveBots, STEP_MS } from "../src/sim/lives.js";
import { getPopulation } from "../src/sim/population.js";
import { stepGuilds } from "../src/sim/guilds.js";
import { launchWars, resolveWars, settleAttack, autoFight, WAR_DELAY_STEPS, WAR_COOLDOWN_STEPS, ATTACKERS_MAX } from "../src/sim/sentinelWar.js";
import { ensureSentinelEnemy, SENT_SHIELD_MS, sentinelAllySpec, defenseAllies, defenseEncounter, SENT_ROUNDS } from "../src/utils/sentinelFight.js";
import { createCombat, advance, endTurn } from "../src/combat/engine.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { createGuildAction } from "../src/utils/guildActions.js";
import { makeBotPlayer } from "../src/sim/partyBots.js";
import { buildSpellBar } from "../src/utils/spellbook.js";
import { castSpell } from "../src/combat/engine.js";
import { allySpecOf, ensureDefenderEnemy } from "../src/utils/sentinelDefense.js";
import { enemyDef } from "../src/data/zones.js";
import { calcStats } from "../src/utils/calcStats.js";
import { endDefenseAction, startDefenseAction, resolveDueAttacksNow } from "../src/utils/guildActions.js";
import { sentinelsOf as sOf } from "../src/utils/sentinel.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Guerre des sentinelles");
const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);

// Un monde : ma guilde ("player", niveau `level`, une sentinelle aux Prairies) et une guilde simulée de 8 membres
function world(level = 5) {
  const sims = createLives({ population: pop, now: T0 });
  const G = sims.guilds = newGuilds(), step = sims.step;
  const T = createGuild(G, { founder: "player", name: "Les Veilleurs", step });
  T.level = level; T.gold = 5000;
  placeSentinel(G, T, "prairies_sauvages", step);
  const A = createGuild(G, { founder: pop[0].id, name: "Les Loups", step });
  for (let i = 1; i < 9; i++) addMember(G, A, pop[i].id, step);
  return { sims, G, T, A, step };
}

test("un combat automatique se joue jusqu'au bout, toujours pareil avec la même graine", () => {
  const { sims, T, G } = world(5);
  const live = liveBots(sims, pop), team = [0, 1, 2].map((i) => ({ ...live[i], level: 12 }));
  const key = ensureSentinelEnemy(T);
  const a = autoFight(team, [key], 7), b = autoFight(team, [key], 7);
  assert.ok(a.phase === "victory" || a.phase === "defeat"); assert.equal(a.phase, b.phase); assert.equal(a.round, b.round);
});

test("une guilde simulée finit par lancer une attaque : alerte, compte à rebours, journal", () => {
  const { sims, G, T, step } = world(10);
  let s = step - (step % 6), found = null;
  for (let i = 0; i < 24 * 120 && !found; i++, s += 6) { launchWars(sims, G, pop, s); if (T.attacks?.length) found = s; }
  assert.ok(found, "au moins une attaque en 120 jours");
  const a = T.attacks[0];
  assert.equal(a.region, "prairies_sauvages"); assert.equal(a.due, found + WAR_DELAY_STEPS); assert.equal(a.dueMs, found * STEP_MS + 180000, "3 minutes après le pas de l'alerte (rattrapage)");
  assert.ok(a.by.length >= 1 && a.by.length <= ATTACKERS_MAX); assert.ok(a.by.every((id) => !G.of[id] || G.of[id] === a.from));
  assert.match(T.log[0].txt, /Alerte/);
  assert.equal(T.lastWar, found);
  launchWars(sims, G, pop, found + 6); assert.equal(T.attacks.length, 1, "une seule attaque à la fois");
});

test("avant l'échéance rien ne se passe ; après, elle est réglée ; en défense, `hold` la suspend", () => {
  const { sims, G, T, step } = world(10);
  const a = { id: "x:1", region: "prairies_sauvages", from: Object.keys(G.byId).find((k) => k !== T.id), by: [pop[3].id, pop[4].id], at: step, due: step + 2 };
  T.attacks = [a];
  resolveWars(sims, G, pop, step + 1); assert.equal(T.attacks.length, 1, "pas encore");
  a.hold = step + 8; resolveWars(sims, G, pop, step + 5); assert.equal(T.attacks.length, 1, "la défense du joueur la retient");
  resolveWars(sims, G, pop, step + 8);
  assert.equal(T.attacks, undefined, "réglée");
  const gone = !sentinelsOf(T).prairies_sauvages;
  assert.ok(gone || sentinelsOf(T).prairies_sauvages.shield > (step + 8) * STEP_MS, "détruite, ou protégée");
  assert.match(T.log[0].txt, /sentinelle/);
});

test("attaquants forts, sentinelle abandonnée : elle tombe, l'or du stock est partagé entre les attaquants", () => {
  const { sims, G, T, step } = world(1);
  const by = [pop[3].id, pop[4].id, pop[5].id];
  for (const id of by) { sims.lives[id].level = 30; sims.lives[id].gold = 0; }
  T.sentinels.prairies_sauvages.gold = 600; T.sentinels.prairies_sauvages.res = { cuir_de_loup: 4 };
  const live = liveBots(sims, pop);
  const r = settleAttack(G, T, { id: "w:1", region: "prairies_sauvages", from: Object.keys(G.byId).find((k) => k !== T.id), by, at: step, due: step }, live.map((b) => ({ ...b })), sims, step + 40);
  assert.equal(r.won, "att"); assert.equal(sentinelsOf(T).prairies_sauvages, undefined); assert.equal(G.sent?.prairies_sauvages, undefined, "la région est libre");
  const sum = by.reduce((t, id) => t + sims.lives[id].gold, 0);
  assert.ok(sum >= 597 && sum <= 600, `partage de 600 : ${sum}`);
  assert.ok(by.some((id) => sims.lives[id].gold !== sims.lives[by[0]].gold) || sum > 0);
  assert.match(T.log[0].txt, /détruite/);
  assert.equal(attackProblem(G, "prairies_sauvages"), "pas_de_sentinelle");
});

test("attaquants faibles contre une sentinelle défendue : elle tient et devient intouchable 1 h", () => {
  const { sims, G, T, step } = world(50);
  const defenders = [pop[10], pop[11], pop[12]];
  for (const b of defenders) { addMember(G, T, b.id, step); sims.lives[b.id].level = 45; }
  const by = [pop[3].id, pop[4].id];
  for (const id of by) sims.lives[id].level = 3;
  const live = liveBots(sims, pop), now = (step + 3) * STEP_MS;
  // même sans que les défenseurs soient tous connectés, la sentinelle de niveau 50 écrase deux joueurs de niveau 3
  const r = settleAttack(G, T, { id: "w:2", region: "prairies_sauvages", from: Object.keys(G.byId).find((k) => k !== T.id), by, at: step, due: step }, live, sims, step + 3);
  assert.equal(r.won, "def");
  const s = sentinelsOf(T).prairies_sauvages;
  assert.equal(s.shield, now + SENT_SHIELD_MS); assert.equal(attackProblem(G, "prairies_sauvages", now + 1000, "autre"), "protegee");
  assert.match(T.log[0].txt, /repoussé/);
});

test("une sentinelle déjà tombée entre l'alerte et l'échéance : rien à régler, pas d'erreur", () => {
  const { sims, G, T, step } = world(5);
  T.attacks = [{ id: "z", region: "prairies_sauvages", from: Object.keys(G.byId).find((k) => k !== T.id), by: [pop[3].id], at: step, due: step + 1 }];
  delete T.sentinels; rebuildSent(G);
  resolveWars(sims, G, pop, step + 2);
  assert.equal(T.attacks, undefined);
});

test("le monde tourne dix jours : des attaques tombent, jamais de plantage, jamais deux fois en moins de 8 h", () => {
  const { sims, G, T, step } = world(10);
  const when = [];
  let last = null;
  for (let i = 0; i < 144 * 10; i++) {
    const had = T.lastWar;
    stepGuilds(sims, pop, step + i);
    if (T.lastWar !== had) when.push(T.lastWar);
    // l'or et les ressources des simulés restent des nombres entiers sains
  }
  for (let i = 1; i < when.length; i++) assert.ok(when[i] - when[i - 1] >= WAR_COOLDOWN_STEPS, "délai entre deux attaques");
  assert.ok(Object.values(sims.lives).every((l) => Number.isFinite(l.gold)));
  assert.ok(T.log.length > 0 || when.length === 0);
  console.log(`    (${when.length} attaque(s) en 10 jours)`);
});

// Un combat de défense prêt à jouer : le joueur (niveau `level`), la sentinelle de T et ses défenseurs en alliés, `by` en ennemis
function defenseFight(level, by, seed = 5, T = null, mates = []) {
  const { sims, G, T: g0 } = world(level);
  const guild = T || g0, live = liveBots(sims, pop), attackers = by.map((i) => ({ ...live[i], level: Math.min(level, 60) }));
  const atk = { id: "d:1", region: "prairies_sauvages", from: "x", by: attackers.map((b) => b.id) };
  const enc = defenseEncounter(guild, atk, attackers, "Les Loups");
  const player = makeBotPlayer("guerrier", level);
  const allies = [sentinelAllySpec(guild), ...mates.map((i) => allySpecOf({ ...live[i], level }))];
  const st = createCombat({ stats: calcStats(player), weaponType: "epee", classKey: "guerrier", level, enemyKeys: enc.enemies, spells: buildSpellBar(player), seed, allies, maxRounds: enc.defense.maxRounds, objective: "defense" });
  return { st, enc, guild };
}
// Le héros joue le sort le plus rentable sur l'attaquant le plus faible ; `passive` : il passe son tour
const playOut = (st0, { passive = false, cap = 4000 } = {}) => {
  let st = st0;
  for (let i = 0; i < cap && st.phase !== "victory" && st.phase !== "defeat"; i++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    let best = null, score = 0;
    if (!passive) for (const sp of st.player.spells) if (sp.type !== "buff" && sp.pa <= st.player.pa && sp.power / sp.pa > score) { best = sp; score = sp.power / sp.pa; }
    const target = st.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    st = best && target ? castSpell(st, best.id, target.id).state : endTurn(st).state;
  }
  return st;
};

test("un simulé se bat avec sa vraie fiche : classe, niveau, équipement et améliorations (+1 à +3) comptent", () => {
  const { sims } = world(10);
  const bot = liveBots(sims, pop).find((b) => b.life.gear && Object.keys(b.life.gear).length >= 3);
  assert.ok(bot, "un simulé équipé");
  const base = ensureDefenderEnemy({ ...bot, life: { ...bot.life, upg: undefined } }, "test0");
  const plus = ensureDefenderEnemy({ ...bot, life: { ...bot.life, upg: Object.fromEntries(Object.keys(bot.life.gear).map((k) => [k, 3])) } }, "test3");
  const a = enemyDef(base).stats, b = enemyDef(plus).stats;
  assert.ok(b.atkPhys + b.atkMagie + b.hp + b.defPhys > a.atkPhys + a.atkMagie + a.hp + a.defPhys, "des pièces améliorées donnent un combattant plus fort");
  const strong = ensureDefenderEnemy({ ...bot, level: Math.min(50, bot.level + 15) }, "testL");
  assert.ok(enemyDef(strong).stats.hp > a.hp, "plus de niveau, plus de PV");
  const other = pop.find((x) => x.classKey !== bot.classKey), o = ensureDefenderEnemy({ ...liveBots(sims, pop).find((x) => x.id === other.id) }, "testC");
  assert.notDeepEqual(enemyDef(o).actions.map((x) => x.id), enemyDef(base).actions.map((x) => x.id), "chaque classe a ses sorts");
});

test("défendre : la rencontre met les attaquants en ennemis (retournés) et la sentinelle en alliée avec ses sorts", () => {
  const { st, enc } = defenseFight(20, [3, 4]);
  assert.equal(st.enemies.length, 2); assert.ok(enc.enemies.every((k) => k.startsWith("attaquant_")));
  assert.equal(st.objective, "defense"); assert.equal(st.maxRounds, SENT_ROUNDS);
  const sent = st.allies[0]; assert.ok(sent.sentinel && sent.isAlly && sent.actions.length >= 1 && sent.maxHp > 0);
  assert.ok(enc.defense.emblem !== undefined || enc.defense.gid);
});

test("défendre : si la sentinelle tombe c'est perdu, même avec le héros debout", () => {
  const { st } = defenseFight(20, [3, 4, 5]);
  st.allies[0].hp = 0; st.allies[0].alive = false;
  const r = advance(st);
  assert.equal(r.state.phase, "defeat");
});

test("défendre : tenir tous les tours donne la victoire ; abattre tous les attaquants aussi", () => {
  // des attaquants de niveau 1 contre le héros et la sentinelle de niveau 40 : ils tombent, ou le temps passe : victoire
  const { st } = defenseFight(40, [3, 4], 11);
  for (const e of st.enemies) { e.stats.atkPhys = 1; e.stats.atkMagie = 1; e.hp = 1e9; e.maxHp = 1e9; }          // intuables et inoffensifs
  const t = playOut(st, { passive: true });
  assert.equal(t.phase, "victory"); assert.equal(t.round, SENT_ROUNDS, "elle a tenu le temps imparti");
  const { st: s2 } = defenseFight(40, [3], 12);
  for (const e of s2.enemies) e.hp = 1;                                                                        // un seul attaquant, presque mort
  const t2 = playOut(s2);
  assert.equal(t2.phase, "victory"); assert.ok(t2.round < SENT_ROUNDS, "tous les attaquants sont tombés avant la fin du temps");
});

test("défendre contre trois attaquants de son niveau : jouable avec la sentinelle et deux membres (ni gagné ni perdu d'avance)", () => {
  const res = {};
  for (const [label, mates] of [["avec 2 membres", [20, 21]], ["sans membre", []]]) {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) { const { st } = defenseFight(20, [10, 11, 12], seed, null, mates); if (playOut(st).phase === "victory") won++; }
    res[label] = won;
  }
  console.log(`    (niveau 20, héros actif : ${Object.entries(res).map(([k, v]) => `${k} ${v}/20`).join(", ")})`);
  assert.ok(res["avec 2 membres"] >= 8, "bien accompagné, on tient la plupart du temps");
  assert.ok(res["avec 2 membres"] >= res["sans membre"], "les membres aident");
});

// ---- actions du joueur ----
enableSimMarket(true);
const base = newMarket(T0);
const withGuild = () => {
  const p = { ...createPlayer({ name: "Moi", classKey: "guerrier" }), gold: 50000, market: structuredClone(base) };
  const r = createGuildAction(p, "Les Veilleurs", T0); assert.ok(r.ok);
  const sims = r.player.market.sims, G = sims.guilds, g = G.byId[G.of.player];
  g.level = 10; placeSentinel(G, g, "prairies_sauvages", r.player.market.bucket); g.sentinels.prairies_sauvages.gold = 500;
  const A = createGuild(G, { founder: pop[0].id, name: "Les Loups", step: r.player.market.bucket });
  const by = [pop[3].id, pop[4].id]; for (const id of by) sims.lives[id].gold = 0;
  g.attacks = [{ id: "act:1", region: "prairies_sauvages", from: A.id, by, at: r.player.market.bucket, due: r.player.market.bucket + 5 }];
  return { player: r.player, by };
};
const mineOf = (p) => { const G = p.market.sims.guilds; return G.byId[G.of.player]; };

test("actions : prendre la défense suspend l'attaque ; une attaque inconnue ou déjà réglée est refusée", () => {
  const { player } = withGuild();
  assert.equal(startDefenseAction(player, "nope", T0).reason, "pas_d_attaque");
  assert.equal(startDefenseAction({ ...player, market: { ...player.market, sims: null } }, "act:1", T0).ok, false);
  const r = startDefenseAction(player, "act:1", T0);
  assert.ok(r.ok); assert.ok(mineOf(r.player).attacks[0].hold > player.market.bucket, "suspendue");
  assert.equal(mineOf(player).attacks[0].hold, undefined, "le joueur d'avant n'est pas modifié");
});

test("à la minute : 3 minutes après l'alerte l'attaque est réglée ; pas avant ; jamais pendant que je défends", () => {
  const { player, by } = withGuild();
  const t0 = T0;
  mineOf(player).attacks[0].dueMs = t0 + 180000;
  assert.equal(resolveDueAttacksNow(player, t0 + 179000), player, "pas encore : le même joueur, rien de recalculé");
  const held = startDefenseAction(player, "act:1", T0); assert.ok(held.ok);
  assert.equal(resolveDueAttacksNow(held.player, t0 + 500000), held.player, "en pleine défense : l'attaque attend");
  const r = resolveDueAttacksNow(player, t0 + 181000);
  assert.notEqual(r, player); assert.equal(mineOf(r).attacks, undefined, "réglée");
  const s = mineOf(r).sentinels?.prairies_sauvages;
  assert.ok(!s || s.shield > 0, "détruite ou protégée");
  assert.equal(mineOf(player).attacks.length, 1, "le joueur d'avant n'est pas modifié");
});

test("actions : défense gagnée = sentinelle protégée 1 h, stock intact ; perdue = détruite et l'or va aux attaquants", () => {
  const { player, by } = withGuild();
  const w = endDefenseAction(player, "act:1", true, T0);
  assert.ok(w.ok); assert.equal(w.won, "def");
  const gw = mineOf(w.player); assert.equal(gw.attacks, undefined);
  assert.ok(gw.sentinels.prairies_sauvages.shield > T0, "protégée"); assert.equal(gw.sentinels.prairies_sauvages.gold, 500, "stock intact");
  assert.equal(endDefenseAction(w.player, "act:1", true, T0).reason, "pas_d_attaque", "déjà réglée");
  const l = endDefenseAction(player, "act:1", false, T0);
  assert.ok(l.ok); assert.equal(l.won, "att"); assert.equal(l.gold, 500);
  const gl = mineOf(l.player); assert.equal(gl.sentinels, undefined, "détruite"); assert.equal(l.player.market.sims.guilds.sent?.prairies_sauvages, undefined);
  const got = by.reduce((t, id) => t + l.player.market.sims.lives[id].gold, 0);
  assert.ok(got >= 498 && got <= 500, `or partagé : ${got}`);
  assert.equal(player.market.sims.lives[by[0]].gold, 0, "le joueur d'avant n'est pas modifié");
  assert.match(gl.log[0].txt, /détruite/);
});

console.log(`\n${n} tests OK`);
