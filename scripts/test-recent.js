// Test d'ensemble des nouveautés récentes (groupe permanent, sentinelles, guerres, défense) et des bonus de guilde de bout en bout :  node scripts/test-recent.js
//   - les six bonus de guilde (xp, xp de métier, butin, récolte, raffinage, fabrication), palier par palier, pour le joueur ET pour les simulés ;
//   - les bonus pendant les combats de groupe (le joueur et les membres de sa guilde en groupe) ;
//   - le groupe permanent de bout en bout, le partage du stock d'une sentinelle, la guerre des sentinelles et la défense.
import assert from "node:assert/strict";
import { PALIERS, BONUS_KEYS } from "../src/data/guild.js";
import { newGuilds, createGuild, addMember, removeMember } from "../src/utils/guildCore.js";
import { bonusFromPaliers, guildBonusOf, NO_BONUS } from "../src/utils/guildBonus.js";
import { stepGuilds } from "../src/sim/guilds.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn, PARTY_DROP_MULT } from "../src/combat/engine.js";
import { applyGather, rollHarvest } from "../src/utils/gathering.js";
import { applyRefine, applyCraft } from "../src/utils/crafting.js";
import { RECIPES } from "../src/data/recipes.js";
import { getCraftInfo } from "../src/data/professions.js";
import { perksFor } from "../src/utils/perks.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { getPopulation } from "../src/sim/population.js";
import { getLivePopulation } from "../src/sim/simWorld.js";
import { createLives, liveBots, stepLife, stepLivesOne, groupFightStep, traitsOf, isActive, STEP_MS } from "../src/sim/lives.js";
import { makeRng } from "../src/sim/rng.js";
import { groupCandidates, acceptsInvite, inviteAction, kickAction, cleanGroupAction, creditGroup, groupOf, GROUP_MAX } from "../src/utils/group.js";
import { buildAllies } from "../src/sim/partyBots.js";
import { placeSentinel, sentinelsOf } from "../src/utils/sentinel.js";
import { winAttackAction } from "../src/utils/guildActions.js";
import { launchWars, resolveWars } from "../src/sim/sentinelWar.js";
import { defenseAllies, defenseEncounter } from "../src/utils/sentinelFight.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Nouveautés récentes et bonus de guilde");

enableSimMarket(true);
const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 19);
let NOW = T0;
const onlineCount = (now) => getLivePopulation({ market: { sims: createLives({ population: pop, now }) } }).filter((b) => isActive(b, Math.floor(now / STEP_MS))).length;
while (onlineCount(NOW) < 12) NOW += 3600_000;

// Un joueur dans sa propre guilde, avec `pal` paliers débloqués (le monde des simulés est celui de son marché)
function playerIn(pal, { level = 10 } = {}) {
  const p = { ...createPlayer({ name: "Moi", classKey: "guerrier" }), level, market: newMarket(NOW) };
  const sims = p.market.sims, G = sims.guilds = newGuilds();
  const g = createGuild(G, { founder: "player", name: "Les Veilleurs", step: sims.step });
  g.pal = pal; g.level = 10;
  return { player: p, G, g, sims };
}

// ---------------------------------------------------------------- les six bonus, palier par palier (le joueur)
test("paliers : les bonus s'additionnent, jusqu'aux six domaines au palier 10 ; la fiche du joueur les reprend", () => {
  let prev = { ...NO_BONUS };
  for (let k = 0; k <= PALIERS.length; k++) {
    const { player } = playerIn(k), b = guildBonusOf(player);
    const want = { ...NO_BONUS }; for (const pl of PALIERS.slice(0, k)) for (const [key, v] of Object.entries(pl.bonus)) want[key] += v;
    assert.deepEqual({ ...b }, want, `palier ${k}`);
    for (const key of BONUS_KEYS) assert.ok(b[key] >= prev[key], `${key} ne baisse jamais`);
    const base = calcStats({ ...player, market: { ...player.market, sims: { ...player.market.sims, guilds: newGuilds() } } });
    const st = calcStats(player);
    assert.equal(st.xpBonus, want.xp); assert.equal(+(st.dropBonus - base.dropBonus).toFixed(6), want.drop);
    prev = { ...b };
  }
  assert.ok(BONUS_KEYS.every((k) => prev[k] > 0), "au palier 10 : les six bonus sont là");
  assert.equal(guildBonusOf(createPlayer({ name: "Seul", classKey: "guerrier" })), NO_BONUS, "sans guilde : rien");
});

// ---------------------------------------------------------------- combat : xp et butin
const BIG = { atkPhys: 5000, atkMagie: 0, defPhys: 0, defMagie: 0, maxHp: 5000, esquive: 0, critique: 0, vitesse: 10, dropBonus: 0, xpBonus: 0, setBonuses: [] };
function fight(stats, seed, enemyKeys = ["loup_des_plaines"], allies = []) {
  let s = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 40, enemyKeys, seed, allies });
  for (let i = 0; i < 400 && s.phase !== "victory" && s.phase !== "defeat"; i++) {
    if (s.phase === "playerTurn") { const e = s.enemies.find((x) => x.alive), r = castSpell(s, "taillade", e.id); s = r.events.length ? r.state : endTurn(s).state; }
    else { const r = advance(s); s = r.state ?? r; }
  }
  return s;
}
test("combat : le bonus d'xp du palier s'applique aux gains du joueur, le bonus de butin ne fait jamais perdre un drop", () => {
  const { player } = playerIn(10), st = calcStats(player), none = calcStats(playerIn(0).player);
  assert.ok(st.xpBonus > 0 && st.dropBonus > none.dropBonus);
  const a = fight({ ...BIG, xpBonus: none.xpBonus, dropBonus: none.dropBonus }, 3), b = fight({ ...BIG, xpBonus: st.xpBonus, dropBonus: st.dropBonus }, 3);
  assert.equal(b.rewards.xp, Math.round(a.rewards.xp * (1 + st.xpBonus / 100)), "xp × (1 + bonus)");
  let more = 0, fewer = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const x = fight({ ...BIG, dropBonus: none.dropBonus }, seed, ["loup_des_plaines", "sanglier_sauvage"]), y = fight({ ...BIG, dropBonus: st.dropBonus }, seed, ["loup_des_plaines", "sanglier_sauvage"]);
    const tot = (r) => Object.values(r.resources).reduce((s, q) => s + q, 0) + r.items.length;
    if (tot(y.rewards) > tot(x.rewards)) more++; if (tot(y.rewards) < tot(x.rewards)) fewer++;
  }
  assert.equal(fewer, 0, "avec les mêmes tirages, plus de bonus ne donne jamais moins");
  assert.ok(more > 0, "et parfois plus");
});

// ---------------------------------------------------------------- métiers : récolte, raffinage, fabrication
test("métiers : récolte, raffinage et fabrication profitent des bonus de la guilde du joueur", () => {
  const solo = playerIn(0).player, rich = playerIn(10).player, b = guildBonusOf(rich);
  // récolte : rendement et xp de métier
  let q0 = 0, q1 = 0; const r0 = makeRng(5), r1 = makeRng(5);
  for (let i = 0; i < 400; i++) { q0 += rollHarvest(solo, "frene", r0).qty; q1 += rollHarvest(rich, "frene", r1).qty; }
  assert.ok(q1 > q0, `récolte ${q1} > ${q0}`);
  const g0 = applyGather(solo, "frene", 1, null, () => 0.5), g1 = applyGather(rich, "frene", 1, null, () => 0.5);
  assert.ok(g1.xp >= g0.xp && b.mxp > 0);
  // raffinage : une unité de plus avec assez de rendement
  const mats = (p) => ({ ...p, gold: 1000, resources: { minerai_de_fer: 40 } });
  const f0 = applyRefine(mats(solo), "lingot_de_fer", 8, () => 0.5), f1 = applyRefine(mats(rich), "lingot_de_fer", 8, () => 0.5);
  assert.ok(f0.made > 0 && f1.made >= f0.made, `raffinage ${f1.made} >= ${f0.made}`);
  const prof = Object.keys(f1.player.professions).find((k) => f1.player.professions[k].xp > 0 || f1.player.professions[k].level > 1);
  const score = (pl) => pl.professions[prof].level * 1e6 + pl.professions[prof].xp;
  assert.ok(score(f1.player) >= score(f0.player), "xp de métier au moins égale");
  // fabrication : le bonus fait grimper les chances de chef-d'œuvre
  const itemId = Object.keys(RECIPES).find((id) => (getCraftInfo(id)?.minLevel ?? 99) <= 1 && perksFor(getCraftInfo(id).profession, 1).masterwork !== undefined);
  const stock = (p) => ({ ...p, gold: 10 ** 6, resources: { ...RECIPES[itemId].ingredients } });
  const m = (p, seed) => { const r = makeRng(seed); return applyCraft(stock(p), itemId, "u", () => r(), {}).inventory.at(-1).quality === "chef_d_oeuvre"; };
  let mw0 = 0, mw1 = 0; for (let s = 1; s <= 600; s++) { if (m(solo, s)) mw0++; if (m(rich, s)) mw1++; }
  assert.ok(mw1 >= mw0, `chefs-d'œuvre ${mw1} >= ${mw0}`);
});

// ---------------------------------------------------------------- les simulés : bonus reçus, perdus
test("simulés : un membre reçoit les bonus du palier, les perd en quittant ; les bonus jouent dans sa vie", () => {
  const w = createLives({ population: pop, mode: "generated", epoch: 1, now: NOW });
  w.guilds = newGuilds();
  const [a, b, c] = pop;
  const g = createGuild(w.guilds, { founder: a.id, name: "Riches", step: 0 });
  addMember(w.guilds, g, b.id, 0); g.pal = 10; g.level = 50;
  stepGuilds(w, pop, 6);
  assert.deepEqual({ ...w.lives[b.id].gb }, { ...bonusFromPaliers(10) });
  assert.equal(w.lives[c.id].gb, undefined, "hors guilde : rien");
  removeMember(w.guilds, g, b.id, 7); delete w.lives[b.id].gb; delete w.lives[b.id].gbn;
  assert.equal(w.lives[b.id].gb, undefined);
  // xp : même histoire, plus d'xp avec le bonus
  const bot = pop.find((x) => x.activity === "combattant" && traitsOf(x).profile === "acharne") || pop[0];
  const base = structuredClone(w.lives[bot.id]), boosted = structuredClone(base); boosted.gb = { ...bonusFromPaliers(10) };
  const t = traitsOf(bot), s0 = Math.floor(NOW / STEP_MS);
  for (let s = s0; s < s0 + 144 * 5; s++) { stepLife(base, bot, s, t); stepLife(boosted, bot, s, t); }
  assert.ok(boosted.level * 1e6 + boosted.xp > base.level * 1e6 + base.xp);
});

// ---------------------------------------------------------------- le groupe permanent, bonus de guilde compris
test("groupe : un membre de ma guilde gagne plus d'xp en groupe grâce à son bonus de guilde ; un autre non", () => {
  const { player: p0, G, g, sims } = playerIn(10);
  const cands = groupCandidates(p0, NOW, { max: 200 }).filter((c) => c.ok && acceptsInvite(p0, c.bot, NOW)).map((c) => c.bot);
  const [mate, other] = cands;
  addMember(G, g, mate.id, sims.step);
  stepGuilds(sims, pop, Math.floor(NOW / STEP_MS) - (Math.floor(NOW / STEP_MS) % 1));
  assert.deepEqual({ ...sims.lives[mate.id].gb }, { ...bonusFromPaliers(10) }, "il a reçu le bonus de ma guilde");
  const p = inviteAction(inviteAction(p0, mate.id, NOW).player, other.id, NOW).player;
  const kills = { loup_des_plaines: 12, sanglier_sauvage: 8 };
  // même vie, avec et sans bonus : le bonus d'xp joue dans le butin de groupe
  const plain = structuredClone(sims.lives[mate.id]); delete plain.gb;
  const q = { ...p, market: { ...p.market, sims: { ...p.market.sims, lives: { ...p.market.sims.lives, [mate.id]: plain } } } };
  const withGb = creditGroup(p, [mate.id], kills, "k").market.sims.lives[mate.id], without = creditGroup(q, [mate.id], kills, "k").market.sims.lives[mate.id];
  assert.ok(withGb.level * 1e6 + withGb.xp > without.level * 1e6 + without.xp, "avec le bonus de guilde : plus d'xp");
  const o = structuredClone(sims.lives[other.id]), after = creditGroup(p, [other.id], kills, "k").market.sims.lives[other.id];
  assert.ok(after.level * 1e6 + after.xp > o.level * 1e6 + o.xp, "l'autre gagne aussi (sans bonus)");
});

test("groupe de bout en bout : invitation, pause de leur vie, combat avec eux, victoire créditée, exclusion et reprise", () => {
  const p0 = { ...createPlayer({ name: "Moi", classKey: "guerrier" }), level: 10, market: newMarket(NOW) };
  const cands = groupCandidates(p0, NOW, { max: 200 }).filter((c) => c.ok && acceptsInvite(p0, c.bot, NOW)).map((c) => c.bot);
  assert.ok(cands.length >= 2);
  const [a, b] = cands;
  let p = inviteAction(p0, a.id, NOW).player; p = inviteAction(p, b.id, NOW).player;
  assert.equal(inviteAction(p, cands[2]?.id || "x", NOW).ok, false, "pas plus de 2 membres");
  assert.deepEqual(groupOf(p, NOW).members.map((x) => x.id).sort(), [a.id, b.id].sort());
  // ils combattent à mes côtés
  const allies = buildAllies(p, p.companions, getLivePopulation(p), { fill: false });
  assert.equal(allies.length, 2); assert.deepEqual(allies.map((x) => x.botId).sort(), [a.id, b.id].sort());
  const s = fight(BIG, 4, ["loup_des_plaines", "sanglier_sauvage"], allies);
  assert.equal(s.phase, "victory");
  assert.ok(Object.keys(s.rewards.kills).length > 0);
  // pause de leur vie pendant le groupe
  const step = Math.floor(NOW / STEP_MS);
  const frozen = structuredClone(p.market.sims); stepLivesOne(frozen, pop, step, { merchant: false, keep: 120 });
  for (const id of [a.id, b.id]) assert.equal(JSON.stringify(frozen.lives[id]), JSON.stringify(p.market.sims.lives[id]), "en pause");
  // victoire créditée, avec le bonus de butin de groupe
  const credited = creditGroup(p, [a.id, b.id], s.rewards.kills, "e2e");
  for (const id of [a.id, b.id]) assert.ok(credited.market.sims.lives[id].kills > p.market.sims.lives[id].kills);
  assert.equal(PARTY_DROP_MULT[3], 1.5);
  // exclusion : la vie reprend
  const k = kickAction(credited, a.id, NOW).player;
  const resumed = structuredClone(k.market.sims); stepLivesOne(resumed, pop, step, { merchant: false, keep: 120 });
  if (isActive(pop.find((x) => x.id === a.id), step)) assert.ok(resumed.lives[a.id].played > k.market.sims.lives[a.id].played, "il reprend sa vie");
  assert.deepEqual(k.companions, [b.id]);
  assert.equal(GROUP_MAX, 2);
  // déconnexion : un membre hors ligne sort tout seul
  let later = NOW; while (later < NOW + 72 * 3600_000 && groupOf(k, later).members.length === 1) later += 3600_000;
  assert.ok(cleanGroupAction(k, later).companions.length <= 1);
});

// ---------------------------------------------------------------- sentinelle : partage, guerre, défense
test("sentinelle : le stock se partage à parts égales ; guerre et défense tournent avec les bonus et les membres connectés", () => {
  // ma propre sentinelle ne s'attaque pas
  const { player: p0, G, g, sims } = playerIn(4);
  g.level = 12; placeSentinel(G, g, "prairies_sauvages", sims.step);
  assert.equal(winAttackAction(p0, "prairies_sauvages", NOW, Object.keys(sims.lives).slice(0, 2)).reason, "sienne");
  // une guilde étrangère possède celle qu'on attaque
  const { player: q, G: G2, sims: s2 } = playerIn(0);
  const A = createGuild(G2, { founder: pop[0].id, name: "Les Loups", step: s2.step });
  A.level = 12; placeSentinel(G2, A, "prairies_sauvages", s2.step);
  Object.assign(sentinelsOf(A).prairies_sauvages, { gold: 301, res: { croc_de_loup: 10 } });
  const w3 = winAttackAction(q, "prairies_sauvages", NOW, Object.keys(s2.lives).slice(0, 2));
  assert.ok(w3.ok); assert.equal(w3.group, 2); assert.equal(w3.gold + 2 * w3.each.gold, 301, "rien ne se perd");
  assert.deepEqual([w3.each.gold, w3.gold, w3.each.res.croc_de_loup], [100, 101, 3], "301 or à trois : 100 + 100 + 101 ; 10 crocs : 3 + 3 + 4");
  assert.equal(w3.player.resources.croc_de_loup + 2 * w3.each.res.croc_de_loup, 10);
  // guerre : une guilde simulée finit par attaquer la mienne, l'attaque se règle d'elle-même
  const { G: G3, g: T, sims: s3 } = playerIn(6);
  T.level = 10; T.gold = 5000; placeSentinel(G3, T, "prairies_sauvages", s3.step);
  const B = createGuild(G3, { founder: pop[0].id, name: "Les Corbeaux", step: s3.step });
  for (let i = 1; i < 9; i++) addMember(G3, B, pop[i].id, s3.step);
  let s = s3.step - (s3.step % 6), found = false;
  for (let i = 0; i < 24 * 120 && !found; i++, s += 6) { launchWars(s3, G3, pop, s); found = !!T.attacks?.length; }
  assert.ok(found, "une attaque est lancée");
  const a = T.attacks[0];
  resolveWars(s3, G3, getPopulation(), a.due + 1);
  assert.ok(!T.attacks?.length, "l'attaque est réglée");
  assert.ok(T.log.some((l) => /repoussé|détruite/.test(l.txt)), "le journal le dit");
  // défense : ma sentinelle et des membres connectés contre les attaquants
  const live = liveBots(s3, pop), attackers = a.by.map((id) => live.find((b) => b.id === id)).filter(Boolean);
  const allies = defenseAllies(T, live, a.by, NOW);
  assert.ok(allies.length >= 1 && allies[0].sentinel, "la sentinelle est mon premier allié");
  const enc = defenseEncounter(T, a, attackers, "Les Corbeaux");
  assert.ok(enc.defense && enc.enemies.length === attackers.length);
});

console.log(`${n} tests ok`);
