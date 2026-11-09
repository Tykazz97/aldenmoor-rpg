// Le groupe permanent (joueurs simulés connectés qui gagnent xp et butin avec toi) :  node scripts/test-group.js
import assert from "node:assert/strict";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { createLives, STEP_MS } from "../src/sim/lives.js";
import { getPopulation } from "../src/sim/population.js";
import { getLivePopulation } from "../src/sim/simWorld.js";
import { buildAllies } from "../src/sim/partyBots.js";
import { newGuilds, createGuild, addMember } from "../src/utils/guildCore.js";
import { groupOf, groupCandidates, inviteAction, kickAction, cleanGroupAction, creditGroup, isOnline, GROUP_MAX, GROUP_LEVEL_WINDOW } from "../src/utils/group.js";
import { applyRewards } from "../src/utils/progression.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Groupe permanent");
enableSimMarket(true);
const pop = getPopulation();
// un instant où il y a du monde connecté
let T0 = Date.UTC(2027, 0, 4, 19);
const online = (now) => getLivePopulation({ market: { sims: createLives({ population: pop, now }) } });
while (online(T0).filter((b) => isOnline(b, T0)).length < 12) T0 += 3600_000;
const mk = (level = 10) => {
  const market = newMarket(T0);
  const p = { ...createPlayer({ name: "Moi", classKey: "guerrier" }), level, market: structuredClone(market) };
  return p;
};
const near = (p, now = T0) => groupCandidates(p, now, { max: 100 }).filter((c) => c.ok).map((c) => c.bot);

test("les candidats sont connectés, proches de mon niveau, ceux de ma guilde d'abord", () => {
  const p = mk(10);
  const all = groupCandidates(p, T0, { max: 200 });
  assert.ok(all.length >= 6);
  assert.ok(all.every((c) => isOnline(c.bot, T0)), "tous connectés");
  assert.ok(all.every((c) => c.ok === (Math.abs(c.bot.level - 10) <= GROUP_LEVEL_WINDOW)));
  // une guilde avec des joueurs connectés : ils passent devant
  const sims = p.market.sims, G = sims.guilds = newGuilds();
  const mine = createGuild(G, { founder: "player", name: "Les Veilleurs", step: sims.step });
  const far = near(p).slice(-3);
  for (const b of far) addMember(G, mine, b.id, sims.step);
  const sorted = groupCandidates(p, T0, { max: 200 });
  assert.deepEqual(sorted.slice(0, 3).map((c) => c.guild), [true, true, true]);
  assert.ok(sorted.slice(3).every((c) => !c.guild));
});

test("inviter : connecté, écart de niveau, pas deux fois, pas plus de 2 ; exclure", () => {
  const p = mk(10), c = near(p);
  const r1 = inviteAction(p, c[0].id, T0); assert.ok(r1.ok); assert.deepEqual(r1.player.companions, [c[0].id]);
  assert.equal(p.companions?.length || 0, 0, "le joueur d'avant n'est pas modifié");
  assert.equal(inviteAction(r1.player, c[0].id, T0).reason, "deja_groupe");
  const r2 = inviteAction(r1.player, c[1].id, T0); assert.ok(r2.ok);
  assert.equal(inviteAction(r2.player, c[2].id, T0).reason, "groupe_plein");
  assert.equal(GROUP_MAX, 2);
  assert.equal(inviteAction(p, "sim_inconnu", T0).reason, "inconnu");
  const off = getLivePopulation(p).find((b) => !isOnline(b, T0) && Math.abs(b.level - 10) <= GROUP_LEVEL_WINDOW);
  assert.equal(inviteAction(p, off.id, T0).reason, "hors_ligne");
  const faraway = getLivePopulation(p).find((b) => isOnline(b, T0) && Math.abs(b.level - 10) > GROUP_LEVEL_WINDOW);
  if (faraway) assert.equal(inviteAction(p, faraway.id, T0).reason, "ecart_niveau");
  const k = kickAction(r2.player, c[0].id); assert.ok(k.ok); assert.deepEqual(k.player.companions, [c[1].id]);
  assert.equal(kickAction(k.player, c[0].id).reason, "inconnu");
});

test("un membre qui se déconnecte sort du groupe ; un groupe intact reste le même objet", () => {
  const p0 = mk(10), c = near(p0);
  let p = inviteAction(inviteAction(p0, c[0].id, T0).player, c[1].id, T0).player;
  assert.equal(cleanGroupAction(p, T0), p, "rien à nettoyer");
  assert.equal(groupOf(p, T0).members.length, 2);
  // plus tard : au moins un des deux est hors ligne (horaires) -> retiré
  let later = T0 + 3600_000;
  while (isOnline(c[0], later) && isOnline(c[1], later) && later < T0 + 48 * 3600_000) later += 3600_000;
  assert.ok(later < T0 + 48 * 3600_000, "ils finissent par se déconnecter");
  const q = cleanGroupAction(p, later);
  assert.ok(q.companions.length < 2);
  assert.ok(q.companions.every((id) => isOnline(getLivePopulation(p).find((b) => b.id === id), later)));
  assert.equal(p.companions.length, 2, "l'ancien joueur n'est pas modifié");
});

test("buildAllies sans complément (fill:false) : seulement les vrais joueurs, avec leur id ; donjon (fill) : complété", () => {
  const p = mk(10), c = near(p), pp = getLivePopulation(p);
  assert.equal(buildAllies(p, [], pp, { fill: false }).length, 0);
  const one = buildAllies(p, [c[0].id], pp, { fill: false });
  assert.equal(one.length, 1); assert.equal(one[0].botId, c[0].id); assert.equal(one[0].name, c[0].name);
  const filled = buildAllies(p, [c[0].id], pp);
  assert.equal(filled.length, 2); assert.equal(filled[0].botId, c[0].id); assert.ok(!filled[1].botId, "l'allié générique n'est pas un joueur");
});

test("après une victoire : chaque membre gagne son xp, son or et ses drops ; le reste du monde ne bouge pas", () => {
  const p = mk(10), c = near(p), ids = [c[0].id, c[1].id];
  const kills = { loup_des_plaines: 6, sanglier_sauvage: 4 };
  const before = Object.fromEntries(ids.map((id) => [id, structuredClone(p.market.sims.lives[id])]));
  const other = Object.keys(p.market.sims.lives).find((id) => !ids.includes(id));
  const otherBefore = JSON.stringify(p.market.sims.lives[other]);
  const q = creditGroup(p, ids, kills, "t1");
  assert.notEqual(q, p);
  for (const id of ids) {
    const a = before[id], b = q.market.sims.lives[id];
    assert.ok(b.kills > a.kills, "kills"); 
    assert.ok(b.xp > a.xp || b.level > a.level, "xp");
    assert.ok(b.gold >= a.gold, "or");
  }
  assert.equal(JSON.stringify(q.market.sims.lives[other]), otherBefore);
  assert.equal(JSON.stringify(p.market.sims.lives[ids[0]]), JSON.stringify(before[ids[0]]), "l'ancien état n'est pas modifié (copie)");
  assert.deepEqual(creditGroup(q, ids, kills, "t1").market.sims.lives[ids[0]].kills, q.market.sims.lives[ids[0]].kills + 10, "recréditer = encore 10 kills");
  assert.equal(creditGroup(p, [], kills), p); assert.equal(creditGroup(p, ids, {}), p); assert.equal(creditGroup(p, ["nope"], kills), p);
});

test("les drops existent : sur beaucoup de victoires, des ressources ou de l'or tombent chez les membres", () => {
  const p = mk(10), id = near(p)[0].id;
  const q = creditGroup(p, [id], { loup_des_plaines: 60, sanglier_sauvage: 60 }, "big");
  assert.notEqual(JSON.stringify(q.market.sims.lives[id].bag), JSON.stringify(p.market.sims.lives[id].bag), "le sac change");
  assert.ok(q.market.sims.lives[id].gold > p.market.sims.lives[id].gold);
});

test("même graine = même butin ; les gains du joueur ne changent pas avec ou sans groupe", () => {
  const p = mk(10), c = near(p), ids = [c[0].id];
  const kills = { loup_des_plaines: 5 };
  assert.equal(JSON.stringify(creditGroup(p, ids, kills, "s").market.sims.lives[ids[0]]), JSON.stringify(creditGroup(p, ids, kills, "s").market.sims.lives[ids[0]]));
  const rewards = { xp: 10, gold: 7, resources: {}, items: [], kills };
  const a = applyRewards(p, rewards, "x").player, b = applyRewards(creditGroup(p, ids, kills, "s"), rewards, "x").player;
  assert.equal(a.gold, b.gold); assert.equal(a.xp, b.xp);
});

console.log(`${n} tests ok`);
