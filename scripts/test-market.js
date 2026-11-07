// Tests de l'hôtel des ventes :  node scripts/test-market.js
import assert from "node:assert/strict";
import {
  newMarket, tickMarket, marketOf, settleMarket, buyFromListing, buyCheapest, postListing, cancelListing,
  listingsFor, marketPrice, refPrice, supplyOf, targetStock, myListings, equipmentListings, quoteBuy, quotePost, trend, minutesLeft,
  saleTax, TAX_RATE, itemValue, itemSellPrice, STEP_MS, LISTING_STEPS, MAX_PLAYER_LISTINGS, sellerName,
} from "../src/utils/market.js";
import { RESOURCE_ORDER, RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { generatePopulation } from "../src/sim/population.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Hôtel des ventes");

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const HOUR = 3600e3;
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 1000, resources: { bois_de_frene: 50, croc_de_loup: 20 }, ...extra });
const withMarket = (p, now = T0) => ({ ...p, market: marketOf(p, now) });
const sword = (uid = "u1") => ({ ...ITEMS[Object.keys(ITEMS)[0]], uid });

test("marché neuf : annonces de bots partout, 24 points d'historique, déterministe", () => {
  const m = newMarket(T0);
  for (const id of RESOURCE_ORDER) {
    assert.equal(m.hist[id].length, 24, id);
    assert.ok(listingsFor(m, id).length >= 1, `aucune annonce pour ${id}`);
  }
  assert.ok(equipmentListings(m).length >= 6);
  assert.deepEqual(newMarket(T0), newMarket(T0));
  assert.ok(m.listings.every((l) => l.seller.startsWith("sim_") && l.unit >= 1 && l.qty >= 1));
});

test("les vendeurs sont de vrais joueurs simulés, avec leur nom et leur cupidité", () => {
  const pop = generatePopulation();
  assert.ok(pop.every((b) => Number.isFinite(b.greed) && b.greed > -0.2 && b.greed < 0.5));
  const m = newMarket(T0);
  const names = new Set(m.listings.map((l) => sellerName(l.seller)));
  assert.ok(names.size > 10 && !names.has("Inconnu"));
  assert.equal(sellerName("player"), "Toi");
  assert.deepEqual(generatePopulation().map((b) => b.name), pop.map((b) => b.name));      // les noms n'ont pas bougé
});

test("les prix sont fixés par les bots : proches du cours de référence, offre autour de la cible, jamais de rupture", () => {
  let m = newMarket(T0), ratio = 0, cnt = 0, empty = 0, sup = 0;
  for (let i = 1; i <= 7 * 24; i++) {
    m = tickMarket(m, T0 + i * HOUR);
    for (const id of RESOURCE_ORDER) {
      const p = marketPrice(m, id);
      if (p == null) { empty++; continue; }
      ratio += p / refPrice(m, id); cnt++; sup += supplyOf(m, id) / targetStock(id);
    }
  }
  assert.equal(empty, 0);
  const avgRatio = ratio / cnt, avgSup = sup / cnt;
  assert.ok(avgRatio > 0.85 && avgRatio < 1.2, `prix/référence ${avgRatio.toFixed(2)}`);
  assert.ok(avgSup > 0.5 && avgSup < 1.3, `offre/cible ${avgSup.toFixed(2)}`);
});

test("l'évolution ne dépend que de l'heure : rattraper d'un coup ou pas à pas donne le même marché", () => {
  const m = newMarket(T0);
  const once = tickMarket(m, T0 + 6 * HOUR);
  let step = m; for (let i = 1; i <= 36; i++) step = tickMarket(step, T0 + i * STEP_MS);
  assert.deepEqual(once.listings, step.listings);
  assert.deepEqual(once.stock, step.stock);
  assert.equal(tickMarket(m, T0), m);
});

test("rattraper 48 h d'absence reste rapide", () => {
  const m = newMarket(T0), t = Date.now();
  tickMarket(m, T0 + 5 * 24 * HOUR);
  assert.ok(Date.now() - t < 500, `${Date.now() - t} ms`);
});

test("les prix bougent vraiment sur une semaine (historique non plat)", () => {
  let m = newMarket(T0);
  for (let i = 1; i <= 7 * 24; i++) m = tickMarket(m, T0 + i * HOUR);
  let moved = 0;
  for (const id of RESOURCE_ORDER) { const h = m.hist[id]; if (Math.max(...h) - Math.min(...h) > 0.05) moved++; const t = trend(m, id); assert.ok(Number.isFinite(t.change) && t.hist.length === 24); }
  assert.ok(moved >= RESOURCE_ORDER.length * 0.7, `${moved} ressources ont bougé`);
});

test("TAXE : mettre en vente retire 10 % tout de suite et enlève la marchandise du sac", () => {
  const p = withMarket(base());
  const r = postListing(p, { kind: "res", rid: "bois_de_frene", qty: 40, unit: 10 }, T0);
  assert.ok(r.ok);
  assert.equal(r.gross, 400);
  assert.equal(r.tax, saleTax(400));
  assert.equal(r.tax, Math.ceil(400 * TAX_RATE));
  assert.equal(r.player.gold, 1000 - r.tax);
  assert.equal(r.player.resources.bois_de_frene, 10);
  assert.equal(myListings(r.player.market).length, 1);
  const l = myListings(r.player.market)[0];
  assert.deepEqual([l.qty, l.unit, l.kind], [40, 10, "res"]);
  assert.equal(minutesLeft(r.player.market, l), LISTING_STEPS * 10);
});

test("ACHAT : jamais de taxe, total exact, ressources créditées, or débité", () => {
  const p = withMarket(base());
  const m = p.market, l = listingsFor(m, "bois_de_frene")[0];
  const r = buyFromListing(p, l.id, 3, T0);
  assert.ok(r.ok);
  assert.equal(r.tax, 0);
  assert.equal(r.total, 3 * l.unit);
  assert.equal(r.player.gold, 1000 - 3 * l.unit);
  assert.equal(r.player.resources.bois_de_frene, 53);
  assert.equal(r.player.market.listings.find((x) => x.id === l.id)?.qty ?? 0, l.qty - 3);
});

test("achat au moins cher : prend plusieurs annonces dans l'ordre des prix, sans taxe", () => {
  const p = withMarket(base({ gold: 100000 }));
  const lines = listingsFor(p.market, "croc_de_loup");
  const first = lines[0], want = first.qty + 2;
  const q = quoteBuy(p.market, "croc_de_loup", want);
  assert.equal(q.qty, want);
  const r = buyCheapest(p, "croc_de_loup", want, T0);
  assert.ok(r.ok && r.tax === 0);
  assert.equal(r.total, q.total);
  assert.ok(r.total >= want * first.unit);
  assert.equal(r.player.gold, 100000 - r.total);
  assert.equal(r.player.resources.croc_de_loup, 20 + want);
  assert.ok(!r.player.market.listings.some((x) => x.id === first.id));                    // la moins chère est vidée
});

test("l'or limite l'achat (on achète ce qu'on peut payer), et zéro or = refus", () => {
  const p = withMarket(base({ gold: 12 }));
  const r = buyCheapest(p, "minerai_de_fer", 50, T0);
  if (r.ok) assert.ok(r.total <= 12 && r.player.gold >= 0);
  const poor = buyCheapest(withMarket(base({ gold: 0 })), "minerai_de_fer", 5, T0);
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, "or");
  const l = listingsFor(p.market, "oeil_de_loup_argente")[0];
  assert.equal(buyFromListing(p, l.id, 1, T0).ok, false);
});

test("équipement : on achète à un bot, l'objet arrive dans le sac avec un identifiant unique", () => {
  const p = withMarket(base({ gold: 100000 }));
  const l = equipmentListings(p.market)[0];
  const r = buyFromListing(p, l.id, 1, T0);
  assert.ok(r.ok && r.tax === 0 && r.total === l.unit);
  const got = r.player.inventory.find((i) => i.id === l.rid && i.uid.startsWith("mk-"));
  assert.ok(got);
  assert.equal(r.player.inventory.length, p.inventory.length + 1);
  assert.equal(r.player.market.listings.some((x) => x.id === l.id), false);
});

test("on ne peut pas acheter sa propre annonce", () => {
  const posted = postListing(withMarket(base()), { kind: "res", rid: "bois_de_frene", qty: 5, unit: 7 }, T0).player;
  const mine = myListings(posted.market)[0];
  assert.equal(buyFromListing(posted, mine.id, 1, T0).reason, "mienne");
  const r = buyCheapest(posted, "bois_de_frene", 1000, T0);
  assert.ok(!r.ok || r.player.market.listings.find((x) => x.id === mine.id)?.qty === 5);   // l'achat au moins cher ignore tes annonces
});

test("un bot achète ton annonce bon marché et l'or est crédité exactement", () => {
  let p = withMarket(base({ resources: { croc_de_loup: 200 } }));
  p = postListing(p, { kind: "res", rid: "croc_de_loup", qty: 100, unit: 1 }, T0).player;     // très bon marché
  const goldAfterPost = p.gold;
  const s = settleMarket(p, T0 + 6 * HOUR);
  const left = myListings(s.player.market)[0]?.qty ?? 0;
  assert.ok(left < 100, "rien n'a été acheté");
  assert.equal(s.earned, 100 - left);                                                       // 1 or l'unité
  assert.equal(s.player.gold, goldAfterPost + s.earned);
  assert.ok(s.sold.length >= 1 && s.sold.every((x) => x.rid === "croc_de_loup" && x.unit === 1));
  assert.equal(s.player.market.proceeds, 0);
  const again = settleMarket(s.player, T0 + 6 * HOUR);                                       // encaisser deux fois ne rapporte rien
  assert.equal(again.earned, 0);
  assert.equal(again.player.gold, s.player.gold);
});

test("une annonce hors de prix ne se vend pas : elle expire et la marchandise revient (taxe perdue)", () => {
  let p = withMarket(base({ gold: 100000 }));
  const r = postListing(p, { kind: "res", rid: "bois_de_frene", qty: 30, unit: 5000 }, T0);
  p = r.player;
  const goldPaid = p.gold;
  const later = T0 + (LISTING_STEPS + 5) * STEP_MS;
  const s = settleMarket(p, later);
  assert.equal(s.earned, 0);
  assert.equal(s.player.resources.bois_de_frene, 50);                                        // les 20 restants + les 30 rendus
  assert.equal(s.player.gold, goldPaid);                                                     // la taxe n'est pas remboursée
  assert.equal(myListings(s.player.market).length, 0);
  assert.equal(s.returned.length, 1);
});

test("annuler une annonce rend la marchandise sans rembourser la taxe", () => {
  const posted = postListing(withMarket(base()), { kind: "res", rid: "croc_de_loup", qty: 20, unit: 30 }, T0);
  const id = myListings(posted.player.market)[0].id;
  const r = cancelListing(posted.player, id, T0);
  assert.ok(r.ok);
  assert.equal(r.player.resources.croc_de_loup, 20);
  assert.equal(r.player.gold, posted.player.gold);
  assert.equal(myListings(r.player.market).length, 0);
  assert.equal(cancelListing(r.player, id, T0).ok, false);
});

test("équipement du joueur : taxe à la mise en vente, retiré du sac, récupéré à l'annulation ou à l'expiration", () => {
  const item = sword("mine-1");
  const p = withMarket(base({ inventory: [item], gold: 100000 }));
  const price = itemValue(item.id) + 40;
  const r = postListing(p, { kind: "item", uid: "mine-1", unit: price }, T0);
  assert.ok(r.ok);
  assert.equal(r.tax, saleTax(price));
  assert.equal(r.player.inventory.length, 0);
  assert.equal(r.player.gold, 100000 - r.tax);
  const back = cancelListing(r.player, myListings(r.player.market)[0].id, T0);
  assert.equal(back.player.inventory[0].uid, "mine-1");
  const exp = settleMarket(postListing(p, { kind: "item", uid: "mine-1", unit: 99999 }, T0).player, T0 + (LISTING_STEPS + 2) * STEP_MS);
  assert.equal(exp.player.inventory.length, 1);
  assert.equal(exp.player.inventory[0].uid, "mine-1");
});

test("un équipement à bon prix finit par être acheté par un bot", () => {
  const item = sword("mine-2");
  let p = withMarket(base({ inventory: [item] }));
  p = postListing(p, { kind: "item", uid: "mine-2", unit: Math.max(1, Math.floor(itemValue(item.id) * 0.7)) }, T0).player;
  const g = p.gold;
  const s = settleMarket(p, T0 + 40 * HOUR);
  assert.ok(s.earned > 0, "pas vendu en 40 h");
  assert.equal(s.player.gold, g + s.earned);
  assert.equal(s.sold[0].kind, "item");
});

test("refus propres : prix invalide, rien à vendre, taxe impayable, trop d'annonces", () => {
  const p = withMarket(base());
  assert.equal(postListing(p, { kind: "res", rid: "bois_de_frene", qty: 5, unit: 0 }, T0).reason, "prix");
  assert.equal(postListing(p, { kind: "res", rid: "bois_de_frene", qty: 5, unit: -3 }, T0).reason, "prix");
  assert.equal(postListing(p, { kind: "res", rid: "ortie", qty: 5, unit: 5 }, T0).reason, "aucun");
  assert.equal(postListing(p, { kind: "item", uid: "nope", unit: 5 }, T0).reason, "aucun");
  const broke = withMarket(base({ gold: 0 }));
  assert.equal(postListing(broke, { kind: "res", rid: "bois_de_frene", qty: 50, unit: 100 }, T0).reason, "taxe");
  let q = withMarket(base({ resources: { bois_de_frene: 500 } }));
  for (let i = 0; i < MAX_PLAYER_LISTINGS; i++) q = postListing(q, { kind: "res", rid: "bois_de_frene", qty: 1, unit: 50 + i }, T0).player;
  assert.equal(myListings(q.market).length, MAX_PLAYER_LISTINGS);
  assert.equal(postListing(q, { kind: "res", rid: "bois_de_frene", qty: 1, unit: 99 }, T0).reason, "limite");
});

test("quantité demandée supérieure au sac : on met en vente ce qu'on a", () => {
  const r = postListing(withMarket(base()), { kind: "res", rid: "croc_de_loup", qty: 999, unit: 5 }, T0);
  assert.equal(r.qty, 20);
  assert.equal(r.player.resources.croc_de_loup, undefined);
});

test("mettre en vente beaucoup fait baisser le prix du marché (offre accrue), en acheter le fait monter", () => {
  const p = withMarket(base({ gold: 1e7, resources: { croc_de_loup: 3000 } }));
  const before = marketPrice(p.market, "croc_de_loup");
  const flooded = postListing(p, { kind: "res", rid: "croc_de_loup", qty: 3000, unit: Math.max(1, before - 1) }, T0).player;
  assert.ok(marketPrice(flooded.market, "croc_de_loup") <= before - 1 || before === 1);
  const bought = buyCheapest(p, "bois_de_chene", 10000, T0).player;                       // on vide le marché
  assert.ok(supplyOf(bought.market, "bois_de_chene") < supplyOf(p.market, "bois_de_chene") * 0.1);
  const later = tickMarket(bought.market, T0 + 24 * HOUR);
  assert.ok(supplyOf(later, "bois_de_chene") > supplyOf(bought.market, "bois_de_chene"));  // les bots remettent en vente
});

test("un ancien marché (v1) est remplacé sans perte de joueur", () => {
  const old = { ...base(), market: { bucket: 1, stock: { bois_de_frene: 100 }, hist: {} } };
  const m = marketOf(old, T0);
  assert.equal(m.v, 2);
  const s = settleMarket(old, T0);
  assert.equal(s.player.gold, 1000);
  assert.equal(s.player.market.v, 2);
  assert.equal(marketOf({ ...base() }, T0).v, 2);                                          // aussi pour une vieille sauvegarde sans marché
});

test("règle de taxe : 10 %, minimum 1 or, jamais tout le montant", () => {
  assert.equal(TAX_RATE, 0.1);
  assert.equal(saleTax(0), 0);
  assert.equal(saleTax(1), 0);
  assert.equal(saleTax(2), 1);
  assert.equal(saleTax(100), 10);
  assert.equal(saleTax(101), 11);
  const q = quotePost(10, 50);
  assert.deepEqual(q, { gross: 500, tax: 50, net: 450 });
});

test("valeur d'équipement et prix de revente de référence cohérents (utilisés par l'économie)", () => {
  for (const id of Object.keys(ITEMS)) { assert.ok(itemValue(id) >= 1); assert.ok(itemSellPrice(id) >= 1 && itemSellPrice(id) <= itemValue(id)); }
  assert.ok(RESOURCES.bois_de_frene.value > 0);
});

console.log(`\n${n} tests passent.`);
