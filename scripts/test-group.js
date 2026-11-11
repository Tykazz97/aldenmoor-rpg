// Le groupe permanent (joueurs simulés connectés qui gagnent xp et butin avec toi) :  node scripts/test-group.js
import assert from "node:assert/strict";
import { createPlayer } from "../src/utils/newPlayer.js";
import { enableSimMarket, newMarket } from "../src/utils/market.js";
import { createLives, STEP_MS, stepLivesOne, isActive } from "../src/sim/lives.js";
import { getPopulation } from "../src/sim/population.js";
import { getLivePopulation } from "../src/sim/simWorld.js";
import { buildAllies } from "../src/sim/partyBots.js";
import { newGuilds, createGuild, addMember } from "../src/utils/guildCore.js";
import { groupOf, groupCandidates, acceptsInvite, acceptChance, inviteAction, kickAction, cleanGroupAction, creditGroup, previewGroup, isOnline, GROUP_MAX, GROUP_LEVEL_WINDOW } from "../src/utils/group.js";
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
const near = (p, now = T0) => groupCandidates(p, now, { max: 100 }).filter((c) => c.ok && acceptsInvite(p, c.bot, now)).map((c) => c.bot);   // ceux qui acceptent

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

test("une invitation peut être refusée : selon le profil, stable dans le même pas de 10 minutes, jamais pour tous", () => {
  const p = mk(10), cands = groupCandidates(p, T0, { max: 200 }).filter((c) => c.ok).map((c) => c.bot);
  const no = cands.filter((b) => !acceptsInvite(p, b, T0)), yes = cands.filter((b) => acceptsInvite(p, b, T0));
  assert.ok(yes.length > 0, "certains acceptent"); 
  // sur beaucoup de pas, le taux d'acceptation suit la probabilité du profil
  const sample = cands.slice(0, 12); let ok = 0, want = 0; const N = 400;      // plusieurs simulés : un seul peut tomber sur une série de tirages peu mélangés
  for (const bot of sample) { for (let i = 0; i < N; i++) if (acceptsInvite(p, bot, (Math.floor(T0 / STEP_MS) + i) * STEP_MS)) ok++; want += acceptChance(p, bot); }
  assert.ok(Math.abs(ok / (N * sample.length) - want / sample.length) < 0.06, `taux ${ok / (N * sample.length)} proche de ${want / sample.length}`);
  if (no.length) {
    const r = inviteAction(p, no[0].id, T0);
    assert.equal(r.ok, false); assert.equal(r.reason, "refuse"); assert.equal(r.bot.id, no[0].id); assert.equal(r.player, p, "rien ne change");
    assert.equal(inviteAction(p, no[0].id, T0 + 60000).reason, "refuse", "insister dans le même pas ne change rien");
  }
  // ceux de ma guilde disent plus souvent oui (+10 points)
  const mate = cands.find((b) => acceptChance(p, b) <= 0.87), base = acceptChance(p, mate);
  const sims = p.market.sims, G = sims.guilds = newGuilds(), g = createGuild(G, { founder: "player", name: "Les Veilleurs", step: sims.step });
  addMember(G, g, mate.id, sims.step);
  assert.ok(Math.abs(acceptChance(p, mate) - (base + 0.1)) < 1e-9, "ma guilde : +10 points");
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

test("fenêtre de fin de combat : l'aperçu de chaque membre (xp, or, butin, niveau) est exactement ce qu'il reçoit ensuite", () => {
  const p = mk(10), c = near(p), ids = [c[0].id, c[1].id];
  const kills = { loup_des_plaines: 30, sanglier_sauvage: 30 };
  const rep = previewGroup(p, ids, kills, "fenetre");
  assert.equal(rep.length, 2);
  assert.deepEqual(rep.map((r) => r.id), ids);
  const q = creditGroup(p, ids, kills, "fenetre");
  for (const r of rep) {
    const a = p.market.sims.lives[r.id], b = q.market.sims.lives[r.id];
    assert.ok(r.name && r.xp > 0 && r.gold >= 0, "nom, xp, or");
    assert.equal(r.level, a.level, "niveau avant");
    assert.equal(r.levelAfter, b.level, "niveau après");
    assert.equal(r.xpAfter, b.xp, "xp après");
    assert.equal(b.gold, a.gold + r.gold, "l'or annoncé est l'or reçu");
    assert.ok(Array.isArray(r.items) && typeof r.resources === "object");
  }
  assert.ok(rep.some((r) => Object.keys(r.resources).length || r.items.length), "sur 60 victoires, du butin tombe chez au moins un membre");
  assert.equal(JSON.stringify(p.market.sims.lives[ids[0]]), JSON.stringify(structuredClone(p.market.sims.lives[ids[0]])), "l'aperçu ne modifie rien");
  assert.deepEqual(previewGroup(p, ids, kills, "fenetre"), rep, "même graine : même aperçu");
  assert.deepEqual(previewGroup(p, [], kills, "x"), []);
});

test("même graine = même butin ; les gains du joueur ne changent pas avec ou sans groupe", () => {
  const p = mk(10), c = near(p), ids = [c[0].id];
  const kills = { loup_des_plaines: 5 };
  assert.equal(JSON.stringify(creditGroup(p, ids, kills, "s").market.sims.lives[ids[0]]), JSON.stringify(creditGroup(p, ids, kills, "s").market.sims.lives[ids[0]]));
  const rewards = { xp: 10, gold: 7, resources: {}, items: [], kills };
  const a = applyRewards(p, rewards, "x").player, b = applyRewards(creditGroup(p, ids, kills, "s"), rewards, "x").player;
  assert.equal(a.gold, b.gold); assert.equal(a.xp, b.xp);
});

test("en groupe, la vie simulée d'un membre est en pause (il ne gagne qu'avec moi) ; elle reprend quand il part", () => {
  const p0 = mk(10), step = Math.floor(T0 / STEP_MS);
  const live = getLivePopulation(p0).filter((b) => Math.abs(b.level - 10) <= GROUP_LEVEL_WINDOW);
  const bot = live.find((b) => isActive(b, step) && acceptsInvite(p0, b, step * STEP_MS)), id = bot.id;
  const run = (sims, from, k) => { const w = structuredClone(sims); for (let i = 0; i < k; i++) stepLivesOne(w, pop, from + i, { merchant: false, keep: 120 }); return w; };
  // un pas où il joue vraiment
  const s0 = step;
  const free = run(p0.market.sims, s0, 1).lives[id];
  assert.ok(free.played > p0.market.sims.lives[id].played, "libre : il joue");
  const inv = inviteAction(p0, id, s0 * STEP_MS);
  assert.ok(inv.ok); assert.ok(inv.player.market.sims.busy[id] >= s0);
  const held = run(inv.player.market.sims, s0, 1).lives[id];
  assert.equal(JSON.stringify(held), JSON.stringify(inv.player.market.sims.lives[id]), "en groupe : rien ne bouge");
  assert.equal(p0.market.sims.busy?.[id], undefined, "l'ancien joueur n'est pas modifié");
  // renouvelé tant qu'il est là, expiré si je ferme le jeu
  const renewed = cleanGroupAction(inv.player, s0 * STEP_MS + 3 * STEP_MS);
  assert.ok(renewed.market.sims.busy[id] >= s0 + 3 || !isOnline(bot, s0 + 3), "renouvelé tant qu'il est connecté dans le groupe");
  const kick = kickAction(inv.player, id, s0 * STEP_MS);
  assert.ok(kick.ok); assert.equal(kick.player.market.sims.busy[id], undefined, "exclu : la pause est levée");
  assert.ok(run(kick.player.market.sims, s0, 1).lives[id].played > p0.market.sims.lives[id].played, "il reprend sa vie");
  // une pause ancienne (jeu fermé) ne bloque rien : le rattrapage joue les pas
  const stale = { ...inv.player.market.sims, busy: { [id]: s0 - 1 } };
  assert.ok(run(stale, s0, 1).lives[id].played > p0.market.sims.lives[id].played);
});

console.log(`${n} tests ok`);
