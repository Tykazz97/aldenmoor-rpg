// Tests des commandes d'artisanat :  node scripts/test-orders.js
import assert from "node:assert/strict";
import { newMarket, tickMarket, enableSimMarket, settleMarket, STEP_MS } from "../src/utils/market.js";
import { orderInfo, orderFeeBase, wageMin, simCanCraft, ORDER_CFG, ORDER_STEPS, MAX_PLAYER_ORDERS } from "../src/utils/orders.js";
import { postOrder, cancelOrder, acceptOrder, myOrders, openOrders, postOrderIssue, acceptIssue, setWorkshop, syncWorkshop } from "../src/utils/orderActions.js";
import { CRAFT_PROFESSIONS, tiersOf, baseRate, defaultPrices, directory, tarifFor, simListed, simTarif, tierOfItem, piecesOf } from "../src/utils/workshop.js";
import { orderTarget, orderShopping, tierFor } from "../src/sim/lifeCraft.js";
import { getPopulation } from "../src/sim/population.js";
import { isActive } from "../src/sim/lives.js";
import { RECIPES } from "../src/data/recipes.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Commandes d'artisanat");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12), DAY = 86400000;
const ITEM = "chapeau_chevalier";            // forgeron 18
const info = orderInfo(ITEM);
const run = (fn) => { enableSimMarket(true); try { return fn(); } finally { enableSimMarket(false); } };
const player = (market, extra = {}) => ({ gold: 5000, level: 20, resources: { ...info.mats }, inventory: [], quests: {}, professions: { forgeron: { level: 5, xp: 0 } }, market, ...extra });
const nowOf = (m) => m.bucket * STEP_MS;

await test("une commande : métier, niveau, ingrédients de la recette et salaire de référence", () => {
  assert.equal(info.profession, "forgeron"); assert.equal(info.minLevel, 18);
  assert.deepEqual(info.mats, RECIPES[ITEM].ingredients);
  assert.ok(info.fee >= 3 && info.fee === orderFeeBase(ITEM));
  assert.equal(orderInfo("epee_inconnue"), null);
  const w = wageMin("sim_001", ITEM); assert.ok(w >= info.fee * 0.8 - 1e-9 && w <= info.fee * 1.2 + 1e-9);
});

await test("le joueur commande : ingrédients et salaire partent en séquestre ; limites et refus", () => run(() => {
  const m = newMarket(T0), p = player(m);
  assert.equal(postOrderIssue(p, ITEM, 100), null);
  const r = postOrder(p, { item: ITEM, fee: 100 }, nowOf(m));
  assert.ok(r.ok, r.reason);
  assert.equal(r.player.gold, 4900);
  assert.deepEqual(r.player.resources, {});
  assert.equal(myOrders(r.player.market).length, 1);
  assert.equal(r.order.exp - r.player.market.bucket, ORDER_STEPS);
  assert.equal(postOrder(r.player, { item: ITEM, fee: 100 }, nowOf(m)).reason, "ressources", "plus d'ingrédients");
  assert.equal(postOrder(p, { item: ITEM, fee: 0 }, nowOf(m)).reason, "prix");
  assert.equal(postOrder({ ...p, gold: 50 }, { item: ITEM, fee: 100 }, nowOf(m)).reason, "or");
  assert.equal(postOrder(p, { item: "nimporte_quoi", fee: 10 }, nowOf(m)).reason, "inconnu");
  // 3 commandes au plus
  let q = p;
  for (let i = 0; i < MAX_PLAYER_ORDERS; i++) { q = { ...q, resources: { ...info.mats } }; const x = postOrder(q, { item: ITEM, fee: 20 }, nowOf(m)); assert.ok(x.ok); q = x.player; }
  assert.equal(postOrder({ ...q, resources: { ...info.mats } }, { item: ITEM, fee: 20 }, nowOf(m)).reason, "limite");
}));

await test("sans le monde des simulés (marché abstrait) : pas d'artisans, donc pas de commande", () => {
  const m = newMarket(T0);
  assert.equal(m.sims, undefined);
  const r = postOrder(player(m), { item: ITEM, fee: 100 }, nowOf(m));
  assert.equal(r.ok, false); assert.equal(r.reason, "indisponible");
});

await test("retirer sa commande rend tout, tout de suite", () => run(() => {
  const m = newMarket(T0), p = player(m), r = postOrder(p, { item: ITEM, fee: 100 }, nowOf(m));
  const c = cancelOrder(r.player, r.order.id, nowOf(m));
  assert.ok(c.ok); assert.equal(c.player.gold, 5000); assert.deepEqual(c.player.resources, info.mats); assert.equal(myOrders(c.player.market).length, 0);
  assert.equal(cancelOrder(c.player, r.order.id, nowOf(m)).reason, "introuvable");
}));

// Un artisan simulé de niveau 50 en forgeron, connecté au pas suivant
function withCrafter(m) {
  let bucket = m.bucket;
  const online = () => pop.filter((b) => isActive(b, bucket + 1));
  while (online().length < 8) bucket++;
  const t = tickMarket(m, bucket * STEP_MS);
  for (const b of online()) { const l = t.sims.lives[b.id]; if (l.prof.key !== "forgeron") l.pro = { ...(l.pro || {}), forgeron: { level: 50, xp: 0 } }; else l.prof.level = 50; }
  return t;
}

await test("un artisan simulé de niveau suffisant prend la commande : pièce livrée, salaire et xp pour lui", () => run(() => {
  const base = withCrafter(newMarket(T0));
  const p = player(base), r = postOrder(p, { item: ITEM, fee: 5000 }, nowOf(base)), goldBefore = Object.fromEntries(pop.map((b) => [b.id, r.player.market.sims.lives[b.id].gold]));
  let m = r.player.market, p2 = r.player, steps = 0;
  while (myOrders(m).length && steps < 144) { steps++; m = tickMarket(m, (m.bucket + 1) * STEP_MS); }
  assert.equal(myOrders(m).length, 0, "prise");
  const done = m.returns.filter((x) => x.from === "order" && x.kind === "item");
  assert.equal(done.length, 1); assert.equal(done[0].rid, ITEM);
  const wages0 = (b) => r.player.market.sims.lives[b.id].orderWages || 0;
  const winners = pop.filter((b) => (m.sims.lives[b.id].orderWages || 0) - wages0(b) >= 5000);
  assert.equal(winners.length, 1, "un seul artisan touche le salaire");
  const w = m.sims.lives[winners[0].id];
  assert.ok(w.gold >= goldBefore[winners[0].id] + 5000 - 100, "il touche le salaire (moins la taxe d'atelier)");
  assert.equal(w.crafted > 0, true);
  // récupération par le joueur comme une marchandise
  const s = settleMarket({ ...p2, market: m }, nowOf(m));
  assert.ok(s.player.inventory.some((i) => i.id === ITEM), "la pièce est dans son sac");
  assert.equal(s.player.gold, 5000 - 5000, "le salaire payé, rien d'autre ne bouge");
}));

await test("sans preneur (salaire trop bas) la commande expire : ingrédients et salaire rendus", () => run(() => {
  const base = withCrafter(newMarket(T0)), p = player(base);
  const r = postOrder(p, { item: ITEM, fee: 1 }, nowOf(base));
  let m = r.player.market;
  m = tickMarket(m, (m.bucket + ORDER_STEPS + 2) * STEP_MS);
  assert.equal(myOrders(m).length, 0);
  const s = settleMarket({ ...r.player, market: m }, nowOf(m));
  assert.equal(s.player.gold, 5000, "salaire rendu");
  assert.deepEqual(s.player.resources, info.mats, "ingrédients rendus");
  assert.ok(!s.player.inventory.length);
}));

await test("le joueur est l'artisan : il fabrique pour un simulé avec ses ingrédients, touche le salaire, gagne l'xp ; niveau trop bas refusé", () => run(() => {
  const m0 = newMarket(T0), client = pop[7], life = m0.sims.lives[client.id];
  const cl = structuredClone(m0);
  cl.sims.lives[client.id].gold = 0;
  cl.orders = [{ id: cl.nextId++, client: client.id, item: ITEM, mats: { ...info.mats }, fee: 300, exp: cl.bucket + 100 }];
  const id = cl.orders[0].id;
  const low = player(cl, { professions: { forgeron: { level: 5, xp: 0 } } });
  assert.equal(acceptIssue(low, cl.orders[0]), "niveau");
  assert.equal(acceptOrder(low, id, nowOf(cl)).reason, "niveau");
  const pro = player(cl, { resources: { plaque_noircie: 1 }, professions: { forgeron: { level: 30, xp: 0 } } });
  const a = acceptOrder(pro, id, nowOf(cl), () => 0.99);               // pas de chef-d'œuvre ni d'économie de matières
  assert.ok(a.ok, a.reason);
  assert.ok(a.player.gold >= 5000 + 300 - 20 && a.player.gold <= 5300, "salaire touché, moins la petite taxe d'atelier");
  assert.deepEqual(a.player.resources, { plaque_noircie: 1 }, "ses propres ressources ne bougent pas");
  assert.equal(a.player.inventory.length, 0, "la pièce part chez le client");
  assert.ok(a.player.professions.forgeron.xp > 0 || a.player.professions.forgeron.level > 30, "xp de métier gagnée");
  assert.equal(openOrders(a.player.market).length, 0);
  assert.equal(acceptOrder(a.player, id, nowOf(cl)).reason, "introuvable", "déjà prise");
  // au pas suivant, le client reçoit la pièce
  const t = tickMarket(a.player.market, (a.player.market.bucket + 1) * STEP_MS), got = t.sims.lives[client.id];
  const has = Object.values(got.gear).includes(ITEM) || got.bag.items.includes(ITEM) || (got.plusStock || []).some((x) => x.id === ITEM);
  assert.ok(has, "le client a la pièce"); assert.equal(got.orderDone, 1);
  assert.equal(life.orderDone || 0, 0);
}));

await test("annuaire : les métiers, leurs paliers, les prix conseillés ; les artisans simulés listés, par niveau décroissant", () => run(() => {
  assert.ok(CRAFT_PROFESSIONS.includes("forgeron") && CRAFT_PROFESSIONS.includes("tailleur"));
  assert.deepEqual(tiersOf("forgeron"), [1, 2, 3, 4]);
  assert.equal(tierOfItem(ITEM), 3);
  assert.ok(piecesOf("forgeron", 3).includes(ITEM));
  const d = defaultPrices("forgeron");
  assert.ok(d[1] < d[2] && d[2] < d[3] && d[3] < d[4], "plus cher à chaque palier");
  assert.equal(d[3], baseRate("forgeron", 3));
  const base = withCrafter(newMarket(T0));
  const dir = directory(base, "forgeron", base.bucket + 1, (id) => id);
  assert.ok(dir.length >= 5, `${dir.length} artisans`);
  for (let i = 1; i < dir.length; i++) assert.ok(dir[i - 1].level >= dir[i].level, "classés par niveau");
  for (const e of dir) { assert.ok(!e.isMe); assert.ok(simListed(pop.find((b) => b.id === e.id))); assert.deepEqual(Object.keys(e.prices).map(Number), [1, 2, 3, 4]); assert.equal(e.prices[3], simTarif(e.id, "forgeron", 3)); const b = baseRate("forgeron", 3); assert.ok(e.prices[3] >= b * 0.8 - 1 && e.prices[3] <= b * 1.2 + 1); }
  assert.ok(dir.some((e) => e.online) && dir.some((e) => e.level >= 50), "des connectés, des hauts niveaux");
  // les occasionnels y figurent peu, les acharnés « métiers » tous
  const listed = pop.filter(simListed).length; assert.ok(listed > 100 && listed < pop.length, `${listed} listés sur ${pop.length}`);
}));

await test("ton atelier : disponible, visible, prix par palier, niveau du métier ; sans réglage tu n'es pas dans l'annuaire", () => run(() => {
  const m = newMarket(T0), p = player(m, { professions: { forgeron: { level: 25, xp: 0 } } });
  assert.equal(directory(m, "forgeron").some((e) => e.isMe), false);
  assert.equal(tarifFor(m, "player", ITEM), null);
  const a = setWorkshop(p, "forgeron", { open: true, listed: true, prices: { 3: 250, 4: "abc", 1: 40 } }, nowOf(m));
  assert.ok(a.ok);
  const w = a.player.market.workshop.forgeron;
  assert.deepEqual(w, { open: true, listed: true, prices: { 3: 250, 1: 40 }, level: 25 });
  assert.equal(setWorkshop(p, "alchimie_inconnue", {}, nowOf(m)).reason, "inconnu");
  const me = directory(a.player.market, "forgeron").find((e) => e.isMe);
  assert.ok(me && me.level === 25 && me.prices[3] === 250 && me.online);
  const M = a.player.market;
  assert.equal(tarifFor(M, "player", ITEM), 250, "ton prix du palier 3");
  assert.equal(tarifFor(M, "player", piecesOf("forgeron", 2)[0]), null, "pas de prix fixé pour le palier 2");
  assert.equal(tarifFor(M, "player", piecesOf("forgeron", 4)[0]), null, "palier 4 : niveau trop bas");
  assert.equal(tarifFor(setWorkshop(a.player, "forgeron", { open: false }, nowOf(m)).player.market, "player", ITEM), null, "indisponible");
  assert.equal(tarifFor(setWorkshop(a.player, "forgeron", { listed: false }, nowOf(m)).player.market, "player", ITEM), null, "hors annuaire");
  // ton niveau de métier est tenu à jour dans les réglages
  const grown = syncWorkshop({ ...a.player, professions: { forgeron: { level: 40, xp: 0 } } });
  assert.equal(grown.market.workshop.forgeron.level, 40);
  assert.equal(syncWorkshop(a.player), a.player, "rien à changer : même objet");
}));

await test("commande adressée à un artisan de l'annuaire : au tarif affiché, lui seul la prend", () => run(() => {
  const base = withCrafter(newMarket(T0));
  const dir = directory(base, "forgeron", base.bucket + 1, (id) => id).filter((e) => e.level >= 30);
  const x = dir[0], y = dir[1];
  const p = player(base);
  assert.equal(postOrder(p, { item: ITEM, fee: 1, crafter: "inconnu_99" }, nowOf(base)).reason, "artisan");
  assert.equal(postOrder(p, { item: ITEM, fee: 1, crafter: "player" }, nowOf(base)).reason, "artisan", "pas à soi-même");
  const r = postOrder(p, { item: ITEM, fee: 1, crafter: x.id }, nowOf(base));
  assert.ok(r.ok, r.reason);
  assert.equal(r.order.fee, x.prices[3], "le salaire est le tarif affiché, pas celui passé en paramètre");
  assert.equal(r.order.crafter, x.id);
  assert.equal(r.player.gold, 5000 - x.prices[3]);
  let m = r.player.market, steps = 0;
  const before = (id) => r.player.market.sims.lives[id].orderWages || 0;
  while (myOrders(m).length && steps < 144) { steps++; m = tickMarket(m, (m.bucket + 1) * STEP_MS); }
  assert.equal(myOrders(m).length, 0, "prise par l'artisan choisi");
  assert.equal((m.sims.lives[x.id].orderWages || 0) - before(x.id), x.prices[3], "c'est lui qui touche le salaire");
  assert.equal((m.sims.lives[y.id].orderWages || 0) - before(y.id) < x.prices[3], true, "pas l'autre (qui a pu toucher d'autres commandes)");
  // une commande adressée à un autre n'est ni visible ni prenable ; une commande adressée à toi l'est, et aucun simulé ne la prend
  const c = structuredClone(base); const clientId = pop[9].id;
  c.orders = [{ id: c.nextId++, client: clientId, item: ITEM, mats: { ...info.mats }, fee: 100, exp: c.bucket + 500, crafter: x.id }, { id: c.nextId++, client: clientId, item: ITEM, mats: { ...info.mats }, fee: 120, exp: c.bucket + 500, crafter: "player" }];
  assert.deepEqual(openOrders(c).map((o) => o.fee), [120]);
  const pro = player(c, { professions: { forgeron: { level: 30, xp: 0 } } });
  assert.equal(acceptOrder(pro, c.orders[0].id, nowOf(c)).reason, "introuvable");
  let q = c; for (let i = 0; i < 80; i++) q = tickMarket(q, (q.bucket + 1) * STEP_MS);
  assert.ok(q.orders.some((o) => o.crafter === "player"), "elle attend ton « Fabriquer »");
  const ok = acceptOrder({ ...pro, market: q }, c.orders[1].id, nowOf(q));
  assert.ok(ok.ok, ok.reason);
}));

await test("les simulés commandent la pièce de leur palier qu'ils ne savent pas faire (et seulement avec tous les ingrédients)", () => run(() => {
  const m = newMarket(T0);
  const found = pop.map((b) => ({ b, l: m.sims.lives[b.id], id: orderTarget(m.sims.lives[b.id], b) })).filter((x) => x.id);
  assert.ok(found.length > 20, `${found.length} simulés bloqués`);
  for (const x of found.slice(0, 30)) {
    assert.ok(!simCanCraft(x.l, x.id), "il ne peut pas la fabriquer");
    const want = orderShopping(x.l, x.b);
    for (const [r, q] of Object.entries(want)) assert.ok(q > 0 && RECIPES[x.id].ingredients[r] >= q);
  }
  assert.ok(tierFor(found[0].l) >= 0);
}));

await test("6 jours : les commandes circulent, plusieurs artisans, rien de négatif ; même histoire en une fois ou par tranches", () => run(() => {
  let seenDirected = false, m = newMarket(T0);
  for (let d = 1; d <= 6; d++) { m = tickMarket(m, T0 + d * DAY); if (m.orders.some((o) => o.crafter)) seenDirected = true; }
  assert.ok(seenDirected, "des simulés commandent chez un artisan de l'annuaire");
  const L = pop.map((b) => m.sims.lives[b.id]);
  const delivered = L.reduce((s, l) => s + (l.orderDone || 0), 0), crafters = L.filter((l) => l.orderWages).length;
  assert.ok(delivered > 10, `${delivered} pièces livrées`); assert.ok(crafters >= 5, `${crafters} artisans`);
  for (const l of L) { assert.ok(l.gold >= 0 && Number.isFinite(l.gold)); for (const q of Object.values(l.bag.res)) assert.ok(q > 0); }
  for (const o of m.orders) { assert.ok(o.fee >= 1 && o.exp > m.bucket - 1); for (const q of Object.values(o.mats)) assert.ok(q > 0); }
  let two = newMarket(T0);
  for (let d = 1; d <= 6; d++) two = tickMarket(two, T0 + d * DAY);
  assert.ok(JSON.stringify(m.sims.lives) === JSON.stringify(two.sims.lives), "simulés différents");
  assert.ok(JSON.stringify(m.orders) === JSON.stringify(two.orders), "commandes différentes");
}));

await test("interrupteur : sans commandes, personne ne commande ni n'achète pour commander", () => run(() => {
  ORDER_CFG.enabled = false;
  try { const m = tickMarket(newMarket(T0), T0 + 2 * DAY); assert.equal((m.orders || []).length, 0); assert.equal(pop.filter((b) => m.sims.lives[b.id].orderDone).length, 0); }
  finally { ORDER_CFG.enabled = true; }
}));

console.log(`\n${n} tests OK`);
