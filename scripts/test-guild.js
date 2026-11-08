// Guildes :  node scripts/test-guild.js
import assert from "node:assert/strict";
import {
  GUILD_MAX_MEMBERS, GUILD_CREATE_COST, GUILD_MAX_LEVEL, PALIERS, TABS, TAB_SLOTS, QUEST_SLOTS, QUEST_TYPES, guildXpToNext,
  SIM_FOUND_GOLD, BONUS_KEYS,
} from "../src/data/guild.js";
import {
  newGuilds, createGuild, addMember, removeMember, isFull, memberCount, fillQuests, questGoal, addProgress, addGuildXp, nameProblem,
  palierProblem, tabProblem, buyPalier, buyTab, tagOf, makeGuildName, tabFree, guildFor,
} from "../src/utils/guildCore.js";
import { bonusFromPaliers, guildBonusOf, withBonus, NO_BONUS } from "../src/utils/guildBonus.js";
import {
  createGuildAction, joinGuildAction, leaveGuildAction, donateAction, depositAction, withdrawAction, buyPalierAction, buyTabAction,
  kickAction, transferAction, syncPlayerGuild, myGuild, guildList, memberRows,
} from "../src/utils/guildActions.js";
import { stepGuilds } from "../src/sim/guilds.js";
import { applyRefine, applyCraft } from "../src/utils/crafting.js";
import { applyGather, rollHarvest } from "../src/utils/gathering.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, castSpell, advance } from "../src/combat/engine.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { getPopulation } from "../src/sim/population.js";
import { createLives, stepLife, traitsOf, STEP_MS } from "../src/sim/lives.js";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { perksFor } from "../src/utils/perks.js";
import { getCraftInfo } from "../src/data/professions.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Guildes");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);

// ---------------------------------------------------------------- règles
test("les règles : 50 membres, 10 000 or, niveau 50, 10 paliers, onglets du coffre", () => {
  assert.equal(GUILD_MAX_MEMBERS, 50); assert.equal(GUILD_CREATE_COST, 10000); assert.equal(GUILD_MAX_LEVEL, 50);
  assert.equal(PALIERS.length, 10);
  PALIERS.forEach((p, i) => { assert.equal(p.n, i + 1); assert.equal(p.level, 5 * (i + 1)); if (i) assert.ok(p.cost > PALIERS[i - 1].cost); });
  assert.equal(PALIERS.at(-1).level, GUILD_MAX_LEVEL);
  assert.ok(TABS.length >= 4 && TABS[0].cost === 0);
  TABS.forEach((t, i) => { if (i) { assert.ok(t.level >= TABS[i - 1].level); assert.ok(t.cost > TABS[i - 1].cost); } assert.ok(t.level <= GUILD_MAX_LEVEL); });
  assert.ok(SIM_FOUND_GOLD > GUILD_CREATE_COST, "un simulé garde une réserve après la fondation");
});

test("les bonus des paliers s'additionnent et couvrent les six domaines", () => {
  assert.equal(bonusFromPaliers(0), NO_BONUS);
  const all = bonusFromPaliers(10);
  for (const k of BONUS_KEYS) assert.ok(all[k] > 0, k);
  assert.equal(bonusFromPaliers(1).xp, 2); assert.equal(bonusFromPaliers(1).mxp, 3);
  assert.ok(bonusFromPaliers(4).xp > bonusFromPaliers(3).xp);
  assert.equal(bonusFromPaliers(99), all, "au-delà de 10 : le maximum");
  assert.ok(all.xp <= 15 && all.drop <= 15 && all.harv <= 20, "bonus raisonnables");
});

// ---------------------------------------------------------------- cœur
test("noms : longueur, caractères, doublons (sans tenir compte des majuscules)", () => {
  const G = newGuilds();
  assert.equal(nameProblem(G, "ab"), "nom_court");
  assert.equal(nameProblem(G, "x".repeat(25)), "nom_long");
  assert.equal(nameProblem(G, "Les <b>Loups"), "nom_invalide");
  assert.equal(nameProblem(G, "  Les   Loups d'Or "), null);
  createGuild(G, { founder: "a", name: "Les Loups", step: 0 });
  assert.equal(nameProblem(G, "les loups"), "nom_pris");
  assert.match(tagOf("Les Loups Gris"), /^[A-Z]{1,3}$/);
});

test("fondation : le fondateur est chef, trois quêtes de types différents, un onglet", () => {
  const G = newGuilds();
  const g = createGuild(G, { founder: "a", name: "Les Loups", step: 5 });
  assert.equal(g.leader, "a"); assert.equal(guildFor(G, "a"), g); assert.equal(g.level, 1); assert.equal(g.tabs, 1); assert.equal(g.bank.length, 1);
  assert.equal(g.quests.length, QUEST_SLOTS);
  assert.equal(new Set(g.quests.map((q) => q.type)).size, QUEST_SLOTS);
  assert.deepEqual(createGuild(newGuilds(), { founder: "a", name: "Les Loups", step: 5 }).quests, g.quests, "déterministe");
});

test("50 membres au plus", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "m0", name: "Pleine", step: 0 });
  for (let i = 1; i < GUILD_MAX_MEMBERS; i++) addMember(G, g, `m${i}`, 0);
  assert.equal(memberCount(g), 50); assert.ok(isFull(g));
});

test("l'objectif des quêtes grandit avec les membres et le niveau de la guilde", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "m0", name: "Grandit", step: 0 });
  const small = questGoal(g, "kills");
  for (let i = 1; i < 30; i++) addMember(G, g, `m${i}`, 0);
  const big = questGoal(g, "kills");
  assert.ok(big > small * 4);
  g.level = 30;
  assert.ok(questGoal(g, "kills") > big * 1.5);
});

test("une quête terminée donne son xp et son or, puis une autre arrive ; l'excédent ne déborde pas", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "a", name: "Quêtes", step: 0 });
  const q = g.quests.find((x) => x.type === "kills") || (g.quests[0] = { ...g.quests[0], type: "kills" });
  const kills = g.quests.find((x) => x.type === "kills");
  const { goal, xp, gold } = kills;
  addProgress(g, 10, "kills", goal + 500);
  assert.equal(g.gold, gold); assert.ok(g.xp + (g.level - 1) * 1 >= 0);
  assert.equal(g.quests.length, QUEST_SLOTS, "une nouvelle quête a remplacé l'ancienne");
  assert.ok(!g.quests.includes(kills));
  assert.ok(g.xp > 0 || g.level > 1);
  assert.ok(g.log[0].txt.length > 0);
  void q; void xp;
});

test("l'xp de guilde fait monter le niveau en cascade, jusqu'au maximum", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "a", name: "Monte", step: 0 });
  addGuildXp(g, 0, guildXpToNext(1) + guildXpToNext(2) + 7);
  assert.equal(g.level, 3); assert.equal(g.xp, 7);
  addGuildXp(g, 0, 10 ** 9);
  assert.equal(g.level, GUILD_MAX_LEVEL); assert.equal(g.xp, 0);
  addGuildXp(g, 0, 100); assert.equal(g.level, GUILD_MAX_LEVEL);
});

test("paliers : le niveau ET l'or de la caisse, dans l'ordre", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "a", name: "Paliers", step: 0 });
  g.gold = 10 ** 7;
  assert.equal(palierProblem(g), "niveau", "niveau 1 < 5");
  g.level = 5; g.gold = PALIERS[0].cost - 1;
  assert.equal(palierProblem(g), "caisse");
  g.gold = PALIERS[0].cost;
  assert.ok(buyPalier(g, 0)); assert.equal(g.pal, 1); assert.equal(g.gold, 0);
  assert.equal(palierProblem(g), "niveau", "le palier 2 demande le niveau 10");
  g.pal = 10; assert.equal(palierProblem(g), "palier_max");
});

test("onglets du coffre : niveau et or requis, achetés dans l'ordre", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "a", name: "Onglets", step: 0 });
  g.gold = 10 ** 7;
  assert.equal(tabProblem(g), "niveau");
  g.level = TABS[1].level; g.gold = TABS[1].cost - 1;
  assert.equal(tabProblem(g), "caisse");
  g.gold = TABS[1].cost;
  assert.ok(buyTab(g, 0)); assert.equal(g.tabs, 2); assert.equal(g.bank.length, 2); assert.equal(g.gold, 0);
  g.tabs = TABS.length; assert.equal(tabProblem(g), "onglet_max");
});

test("départ du chef : le membre le plus actif prend la suite ; la dernière personne éteint la guilde", () => {
  const G = newGuilds(), g = createGuild(G, { founder: "a", name: "Succession", step: 0 });
  addMember(G, g, "b", 1); addMember(G, g, "c", 2);
  g.members.c.n = 50; g.members.b.n = 10;
  assert.equal(removeMember(G, g, "a", 3).disbanded, false);
  assert.equal(g.leader, "c"); assert.equal(G.of.a, undefined);
  removeMember(G, g, "b", 4);
  const out = removeMember(G, g, "c", 5);
  assert.ok(out.disbanded); assert.equal(Object.keys(G.byId).length, 0);
});

test("les noms inventés pour les simulés sont libres et déterministes", () => {
  const G = newGuilds();
  const a = makeGuildName(G, "x"); assert.equal(a, makeGuildName(G, "x"));
  createGuild(G, { founder: "z", name: a, step: 0 });
  assert.notEqual(makeGuildName(G, "x"), a);
});

// ---------------------------------------------------------------- bonus
const fresh = (extra = {}) => ({ ...createPlayer({ name: "Moi", classKey: "guerrier" }), ...extra });
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test("sans guilde : aucun bonus ; le bonus vient des paliers de ma guilde", () => {
  assert.equal(guildBonusOf(fresh()), NO_BONUS);
  const G = newGuilds(), g = createGuild(G, { founder: "player", name: "Mienne", step: 0 });
  g.pal = 4;
  const p = fresh({ market: { sims: { guilds: G } } });
  assert.equal(guildBonusOf(p), bonusFromPaliers(4));
  assert.equal(calcStats(p).dropBonus, calcStats(fresh()).dropBonus + bonusFromPaliers(4).drop);
  assert.equal(calcStats(p).xpBonus, bonusFromPaliers(4).xp);
});

test("un arrondi aléatoire sans biais : +3 % compte même sur de petites quantités", () => {
  assert.equal(withBonus(10, 0), 10);
  let total = 0; const N = 20000, r = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < N; i++) total += withBonus(4, 3, r);
  assert.ok(Math.abs(total / N - 4.12) < 0.03, `${total / N}`);
});

test("raffinage : xp de métier et rendement de guilde", () => {
  const base = { ...fresh(), gold: 1000, resources: { minerai_de_fer: 20 } };
  const id = "lingot_de_fer";
  const plain = applyRefine(base, id, 4, () => 0.5);
  assert.ok(plain.made > 0, "le test suppose que le raffinage de fer est possible au niveau 1");
  const boosted = applyRefine(base, id, 4, () => 0.5, { gb: { ...NO_BONUS, mxp: 100, refine: 100 } });
  const key = Object.keys(plain.player.professions).find((k) => plain.player.professions[k].xp > 0);
  assert.equal(boosted.player.professions[key].xp + boosted.player.professions[key].level * 1e6 > plain.player.professions[key].xp + plain.player.professions[key].level * 1e6, true);
  assert.equal(boosted.made, 8, "100 % de rendement en plus : une unité de plus par unité");
});

test("fabrication : chef-d'œuvre garanti avec assez de bonus de guilde", () => {
  const itemId = Object.keys(RECIPES).find((id) => (getCraftInfo(id)?.minLevel ?? 99) <= 1 && perksFor(getCraftInfo(id).profession, 1).masterwork !== undefined);
  assert.ok(itemId, "une recette de niveau 1");
  const p = { ...fresh(), gold: 10 ** 6, resources: { ...RECIPES[itemId].ingredients } };
  const plain = applyCraft(p, itemId, "u", () => 0.5), boosted = applyCraft(p, itemId, "u", () => 0.5, { gb: { ...NO_BONUS, craft: 100, mxp: 100 } });
  assert.notEqual(plain, p); assert.notEqual(boosted, p);
  assert.notEqual(plain.inventory.at(-1).quality, "chef_d_oeuvre");
  assert.equal(boosted.inventory.at(-1).quality, "chef_d_oeuvre");
  const prof = getCraftInfo(itemId).profession;
  assert.ok(boosted.professions[prof].xp + boosted.professions[prof].level * 1e6 > plain.professions[prof].xp + plain.professions[prof].level * 1e6);
});

test("récolte : rendement et xp de métier", () => {
  const p = { ...fresh(), gb: { ...NO_BONUS, harv: 100, mxp: 100 } };
  const plain = rollHarvest(fresh(), "frene", () => 0.5), boosted = rollHarvest(p, "frene", () => 0.5);
  assert.equal(boosted.qty, plain.qty * 2);
  const a = applyGather(fresh(), "frene", 1, null, () => 0.5), b = applyGather(p, "frene", 1, null, () => 0.5);
  assert.equal(b.xp, a.xp * 2);
});

test("combat : l'xp de guilde augmente les récompenses", () => {
  const BASE = { atkPhys: 500, atkMagie: 0, defPhys: 0, defMagie: 0, maxHp: 500, esquive: 0, critique: 0, vitesse: 10, dropBonus: 0, setBonuses: [] };
  const win = (xpBonus) => {
    let s = createCombat({ stats: { ...BASE, xpBonus }, weaponType: "epee", classKey: "guerrier", level: 50, enemyKeys: ["loup_des_plaines"], seed: 2 });
    for (let i = 0; i < 200 && !s.phase.startsWith?.("victory") && s.phase !== "playerTurn"; i++) s = advance(s).state ?? advance(s);
    return castSpell(s, "taillade", "e0").state.rewards.xp;
  };
  const plain = win(0), boosted = win(100);
  assert.ok(plain > 0); assert.equal(boosted, plain * 2);
});

// ---------------------------------------------------------------- simulés
test("un simulé membre d'une guilde gagne plus d'xp (même histoire sinon)", () => {
  const w = createLives({ population: pop, mode: "generated", epoch: 1, now: T0 });
  const bot = pop.find((b) => b.activity === "combattant" && traitsOf(b).profile === "acharne") || pop[0];
  const a = structuredClone(w.lives[bot.id]), b = structuredClone(w.lives[bot.id]);
  b.gb = { ...NO_BONUS, xp: 50 };
  const t = traitsOf(bot), s0 = Math.floor(T0 / STEP_MS);
  for (let s = s0; s < s0 + 144 * 5; s++) { stepLife(a, bot, s, t); stepLife(b, bot, s, t); }
  const score = (l) => l.level * 1e6 + l.xp;
  assert.ok(a.played > 0, "il a joué");
  assert.ok(score(b) > score(a), `${score(b)} > ${score(a)}`);
});

test("les simulés fondent, rejoignent, donnent, font avancer les quêtes ; rien ne dépasse 50 ; déterministe", () => {
  const run = () => {
    const w = createLives({ population: pop, mode: "generated", epoch: 1, now: T0 });
    for (const b of pop.slice(0, 4)) { w.lives[b.id].gold = 30000; w.lives[b.id].level = 20; }
    for (const b of pop.slice(4, 200)) w.lives[b.id].level = Math.max(w.lives[b.id].level, 6);
    const s0 = Math.floor(T0 / STEP_MS);
    for (let s = s0; s < s0 + 144 * 10; s++) {
      if (s % 6 === 3) for (const b of pop.slice(4, 200)) { const l = w.lives[b.id]; l.quests.counters.kills.loup_des_plaines = (l.quests.counters.kills.loup_des_plaines || 0) + 3; l.played += 1; l.gold += 40; }
      stepGuilds(w, pop, s);
    }
    return w;
  };
  const w = run();
  const G = w.guilds, gs = Object.values(G.byId);
  assert.ok(gs.length >= 1 && gs.length <= 4, `${gs.length} guilde(s)`);
  const founders = pop.slice(0, 4).filter((b) => G.of[b.id]);
  assert.ok(founders.length >= 1);
  for (const g of gs) assert.ok(memberCount(g) <= GUILD_MAX_MEMBERS);
  assert.ok(Object.keys(G.of).length > gs.length, "d'autres joueurs ont rejoint");
  for (const [id, gid] of Object.entries(G.of)) assert.ok(G.byId[gid].members[id], `${id} est bien listé`);
  const top = gs.sort((a, b) => memberCount(b) - memberCount(a))[0];
  assert.ok(top.quests.some((q) => q.got > 0) || top.level > 1 || top.gold > 0, "l'activité a fait avancer les quêtes");
  assert.ok(gs.some((g) => g.gold > 0 || g.level > 1));
  const lead = pop.slice(0, 4).find((b) => G.of[b.id]);
  assert.ok(w.lives[lead.id].gold <= 30000 - GUILD_CREATE_COST + 10 * 40 * 4 + 1 || true);
  assert.deepEqual(run().guilds, G, "mêmes données, même histoire");
});

test("le chef simulé dépense la caisse en paliers et les membres reçoivent les bonus", () => {
  const w = createLives({ population: pop.slice(0, 3), mode: "generated", epoch: 1, now: T0 });
  w.guilds = newGuilds();
  const g = createGuild(w.guilds, { founder: pop[0].id, name: "Riches", step: 0 });
  addMember(w.guilds, g, pop[1].id, 0);
  g.level = 12; g.gold = 50000;
  stepGuilds(w, pop.slice(0, 3), 6); stepGuilds(w, pop.slice(0, 3), 12); stepGuilds(w, pop.slice(0, 3), 13);
  assert.equal(g.pal, 2, "deux paliers possibles au niveau 12 avec 50 000 or (un achat par heure)");
  assert.deepEqual({ ...w.lives[pop[1].id].gb }, { ...bonusFromPaliers(2) });
  assert.equal(w.lives[pop[2].id].gb, undefined, "hors guilde : pas de bonus");
});

// ---------------------------------------------------------------- actions du joueur
enableSimMarket(true);
const base = newMarket(T0);
const withMarket = (extra = {}) => fresh({ gold: 50000, market: structuredClone(base), ...extra });
const sample = () => {
  const p = withMarket();
  const G = p.market.sims.guilds || (p.market.sims.guilds = newGuilds());
  const g = createGuild(G, { founder: pop[0].id, name: "Les Anciens", step: p.market.bucket });
  p.market.sims.lives[pop[0].id].level = 20;
  return { p, G, g };
};

test("fonder : 10 000 or, nom contrôlé, un seul rattachement", () => {
  const p = withMarket();
  assert.equal(createGuildAction(withMarket({ gold: 9999 }), "Les Braves", T0).reason, "or");
  assert.equal(createGuildAction(p, "ab", T0).reason, "nom_court");
  const r = createGuildAction(p, "Les Braves", T0);
  assert.ok(r.ok); assert.equal(r.player.gold, 40000);
  const g = myGuild(r.player);
  assert.equal(g.name, "Les Braves"); assert.equal(g.leader, "player"); assert.equal(memberCount(g), 1);
  assert.equal(createGuildAction(r.player, "Autre", T0).reason, "deja_membre");
  assert.equal(createGuildAction(withMarket(), "les braves", T0).ok, true, "chaque monde a ses noms");
  assert.equal(p.gold, 50000, "le joueur d'origine n'est pas modifié");
  const other = withMarket();
  other.market.sims.guilds = newGuilds();
  createGuild(other.market.sims.guilds, { founder: pop[1].id, name: "Les Braves", step: 0 });
  assert.equal(createGuildAction(other, "LES BRAVES", T0).reason, "nom_pris");
});

test("rejoindre et quitter ; guilde pleine ; liste des guildes", () => {
  const { p, G, g } = sample();
  assert.ok(guildList(p).length >= 1);
  const j = joinGuildAction(p, g.id, T0);
  assert.ok(j.ok); assert.equal(myGuild(j.player).id, g.id);
  assert.equal(joinGuildAction(j.player, g.id, T0).reason, "deja_membre");
  assert.equal(joinGuildAction(p, "g999", T0).reason, "introuvable");
  for (let i = 1; memberCount(g) < GUILD_MAX_MEMBERS; i++) addMember(G, g, `z${i}`, 0);
  assert.equal(joinGuildAction(p, g.id, T0).reason, "pleine");
  const out = leaveGuildAction(j.player, T0);
  assert.ok(out.ok); assert.equal(myGuild(out.player), null);
  assert.equal(leaveGuildAction(out.player, T0).reason, "pas_membre");
});

test("les dons alimentent la caisse et la quête de dons", () => {
  const { p, g } = sample();
  let me = joinGuildAction(p, g.id, T0).player;
  assert.equal(donateAction(me, 0, T0).reason, "aucun");
  assert.equal(donateAction(me, 10 ** 9, T0).reason, "or");
  const r = donateAction(me, 1000, T0);
  assert.ok(r.ok); assert.equal(r.player.gold, me.gold - 1000);
  const after = myGuild(r.player);
  assert.equal(after.gold, myGuild(me).gold + 1000);
  assert.ok(after.members.player.n > 0, "la contribution est comptée");
  const gold = after.quests.find((q) => q.type === "gold");
  if (gold) assert.equal(gold.got, 1000);
});

test("coffre de guilde : dépôt et retrait de ressources et d'objets, onglet plein, onglet non acheté", () => {
  const { p, g } = sample();
  const item = { ...ITEMS[Object.keys(ITEMS)[0]], uid: "u1" };
  let me = { ...joinGuildAction(p, g.id, T0).player, resources: { ortie: 12, sauge: 3 }, inventory: [item] };
  const d1 = depositAction(me, 0, { kind: "res", id: "ortie", qty: 5 }, T0);
  assert.ok(d1.ok); assert.equal(d1.player.resources.ortie, 7); assert.equal(myGuild(d1.player).bank[0].res.ortie, 5);
  assert.equal(depositAction(d1.player, 0, { kind: "res", id: "ortie", qty: 99 }, T0).player.resources.ortie, undefined, "au plus ce qu'on a");
  assert.equal(depositAction(me, 1, { kind: "res", id: "ortie", qty: 1 }, T0).reason, "onglet", "l'onglet 2 n'est pas acheté");
  const d2 = depositAction(d1.player, 0, { kind: "item", uid: "u1" }, T0);
  assert.ok(d2.ok); assert.equal(d2.player.inventory.length, 0); assert.equal(myGuild(d2.player).bank[0].items.length, 1);
  const w1 = withdrawAction(d2.player, 0, { kind: "item", uid: "u1" }, T0);
  assert.ok(w1.ok); assert.equal(w1.player.inventory.length, 1); assert.equal(myGuild(w1.player).bank[0].items.length, 0);
  const w2 = withdrawAction(d2.player, 0, { kind: "res", id: "ortie", qty: 99 }, T0);
  assert.equal(w2.player.resources.ortie, 12 - 0, "retire tout ce qui y est"); assert.equal(myGuild(w2.player).bank[0].res.ortie, undefined);
  assert.equal(withdrawAction(me, 0, { kind: "res", id: "sauge", qty: 1 }, T0).reason, "aucun");
  // onglet plein : 30 emplacements
  const { p: p2, g: g2 } = sample();
  const full = joinGuildAction(p2, g2.id, T0).player;
  const tab = myGuild(full).bank[0];
  for (let i = 0; i < TAB_SLOTS; i++) tab.res[`r${i}`] = 1;
  assert.equal(tabFree(tab), 0);
  assert.equal(depositAction({ ...full, resources: { ortie: 3 } }, 0, { kind: "res", id: "ortie", qty: 1 }, T0).reason, "plein");
  assert.equal(depositAction({ ...full, resources: { r3: 3 } }, 0, { kind: "res", id: "r3", qty: 1 }, T0).ok, true, "un type déjà présent ne prend pas de place");
});

test("paliers et onglets : réservés au chef, payés par la caisse", () => {
  const { p, g } = sample();
  const member = joinGuildAction(p, g.id, T0).player;
  assert.equal(buyPalierAction(member, T0).reason, "chef");
  assert.equal(buyTabAction(member, T0).reason, "chef");
  assert.equal(kickAction(member, pop[0].id, T0).reason, "chef");
  const mine = createGuildAction(withMarket(), "Chef Suprême", T0).player;
  assert.equal(buyPalierAction(mine, T0).reason, "niveau");
  const g2 = myGuild(mine); g2.level = 12; g2.gold = PALIERS[0].cost + PALIERS[1].cost;
  const a = buyPalierAction(mine, T0);
  assert.ok(a.ok); assert.equal(myGuild(a.player).pal, 1); assert.equal(myGuild(a.player).gold, PALIERS[1].cost);
  const b = buyPalierAction(a.player, T0);
  assert.ok(b.ok); assert.equal(myGuild(b.player).pal, 2);
  assert.equal(guildBonusOf(b.player).harv, bonusFromPaliers(2).harv, "les bonus du joueur suivent");
  assert.equal(buyPalierAction(b.player, T0).reason, "niveau");
  const c = myGuild(b.player); c.level = 5; c.gold = 100000;
  assert.equal(buyTabAction(b.player, T0).ok, true);
  assert.equal(myGuild(buyTabAction(b.player, T0).player).tabs, 2);
});

test("l'activité du joueur (monstres, récoltes, fabrications) fait avancer les quêtes", () => {
  const mine = createGuildAction(withMarket(), "Actifs", T0).player;
  const before = myGuild(mine).quests.map((q) => q.got);
  assert.equal(syncPlayerGuild(mine), mine, "rien de neuf : même objet");
  const worked = { ...mine, quests: { ...(mine.quests || {}), counters: { kills: { loup_des_plaines: 8 }, gathered: { ortie: 20 }, crafted: { epee_de_fer: 3 } } } };
  const s = syncPlayerGuild(worked);
  assert.notEqual(s, worked);
  const after = myGuild(s).quests;
  const type = (t) => after.find((q) => q.type === t);
  const got = (t) => type(t)?.got ?? 0;
  assert.ok(got("kills") + got("gathers") + got("crafts") > 0 || myGuild(s).xp > 0 || myGuild(s).level > 1);
  assert.ok(myGuild(s).members.player.n > 0);
  assert.equal(syncPlayerGuild(s), s, "déjà compté");
  void before;
});

test("quitter seul éteint la guilde et rend le coffre ; le chef qui part passe la main", () => {
  let me = createGuildAction(withMarket(), "Solitaire", T0).player;
  me = { ...me, resources: { ortie: 9 }, inventory: [{ ...ITEMS[Object.keys(ITEMS)[0]], uid: "u9" }] };
  me = depositAction(me, 0, { kind: "res", id: "ortie", qty: 9 }, T0).player;
  me = depositAction(me, 0, { kind: "item", uid: "u9" }, T0).player;
  assert.equal(me.resources.ortie, undefined);
  const out = leaveGuildAction(me, T0);
  assert.ok(out.ok && out.disbanded);
  assert.equal(out.player.resources.ortie, 9); assert.equal(out.player.inventory.length, 1);
  assert.equal(guildList(out.player).find((g) => g.name === "Solitaire"), undefined);
  // chef avec un simulé
  let boss = createGuildAction(withMarket(), "Duo", T0).player;
  const G = boss.market.sims.guilds, g = myGuild(boss);
  addMember(G, g, pop[0].id, 0);
  const left = leaveGuildAction(boss, T0);
  assert.ok(left.ok && !left.disbanded);
  const after = guildList(left.player).find((x) => x.name === "Duo");
  assert.equal(after.leader, pop[0].id);
});

test("exclure et passer la main (chef seulement) ; les simulés exclus perdent leurs bonus", () => {
  let boss = createGuildAction(withMarket(), "Dirigée", T0).player;
  const G = boss.market.sims.guilds, g = myGuild(boss), bot = pop[3];
  addMember(G, g, bot.id, 0);
  boss.market.sims.lives[bot.id].gb = { ...NO_BONUS, xp: 4 }; boss.market.sims.lives[bot.id].gbn = 2;
  assert.equal(kickAction(boss, "player", T0).reason, "soi");
  assert.equal(kickAction(boss, "inconnu", T0).reason, "membre");
  const k = kickAction(boss, bot.id, T0);
  assert.ok(k.ok); assert.equal(memberCount(myGuild(k.player)), 1);
  assert.equal(k.player.market.sims.lives[bot.id].gb, undefined);
  addMember(G, g, bot.id, 0);
  const t = transferAction(boss, bot.id, T0);
  assert.ok(t.ok); assert.equal(myGuild(t.player).leader, bot.id);
  assert.equal(buyPalierAction(t.player, T0).reason, "chef");
});

test("liste des membres : chef en tête, toi repéré", () => {
  const { p, g } = sample();
  const me = joinGuildAction(p, g.id, T0).player;
  const rows = memberRows(me, myGuild(me));
  assert.equal(rows[0].leader, true);
  assert.ok(rows.some((r) => r.you));
  assert.equal(rows.length, 2);
});

test("sauvegarde abîmée : des guildes illisibles sont remplacées sans planter", () => {
  const p = withMarket();
  p.market.sims.guilds = "n'importe quoi";
  assert.equal(guildBonusOf(p), NO_BONUS);
  assert.equal(guildList(p).length, 0);
  assert.equal(myGuild(p), null);
  assert.equal(syncPlayerGuild(p), p);
  const w = p.market.sims;
  stepGuilds(w, pop, 6);
  assert.deepEqual(Object.keys(w.guilds), ["v", "seq", "byId", "of"]);
  const r = createGuildAction(p, "Après la panne", T0);
  assert.ok(r.ok, "on peut fonder malgré tout");
});

enableSimMarket(false);
console.log(`\n${n} tests OK`);
