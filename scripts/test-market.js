// Tests du marché :  node scripts/test-market.js
import assert from "node:assert/strict";
import { newMarket, tickMarket, marketOf, multiplier, midPrice, unitPrice, saleTax, TAX_RATE, quoteBuy, quoteSell, availableToBuy, maxAffordable, buyResource, sellResource, sellItem, itemValue, itemSellPrice, trend, targetStock, STEP_MS } from "../src/utils/market.js";
import { RESOURCE_ORDER, RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { createPlayer } from "../src/utils/newPlayer.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Marché");

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 1000, resources: { bois_de_frene: 50, croc_de_loup: 20 }, ...extra });

test("marché neuf : toutes les ressources, 24 points d'historique, prix proches de la valeur de base", () => {
  const m = newMarket(T0);
  for (const id of RESOURCE_ORDER) {
    assert.ok(m.stock[id] > 0 && m.hist[id].length === 24, id);
    const mult = multiplier(id, m.stock[id]);
    assert.ok(mult > 0.45 && mult < 2.3);
  }
  assert.deepEqual(newMarket(T0), newMarket(T0));                  // déterministe
});

test("l'évolution ne dépend que de l'heure : rattraper d'un coup ou pas à pas donne le même marché", () => {
  const m = newMarket(T0);
  const once = tickMarket(m, T0 + 6 * 3600e3);
  let step = m; for (let i = 1; i <= 36; i++) step = tickMarket(step, T0 + i * STEP_MS);
  assert.deepEqual(once.stock, step.stock);
  assert.equal(tickMarket(m, T0), m);                               // rien ne bouge sans temps écoulé
});

test("les prix fluctuent vraiment, sans dérive folle, sur une semaine", () => {
  let m = newMarket(T0), lo = 9, hi = 0, moved = 0, sum = 0, cnt = 0;
  for (let i = 1; i <= 7 * 24; i++) {
    m = tickMarket(m, T0 + i * 3600e3);
    for (const id of RESOURCE_ORDER) { const k = multiplier(id, m.stock[id]); lo = Math.min(lo, k); hi = Math.max(hi, k); sum += k; cnt++; }
  }
  for (const id of RESOURCE_ORDER) if (Math.max(...m.hist[id]) - Math.min(...m.hist[id]) > 0.08) moved++;
  assert.ok(hi - lo > 0.4, `amplitude ${(hi - lo).toFixed(2)}`);
  assert.ok(lo >= 0.45 && hi <= 2.3);
  assert.ok(Math.abs(sum / cnt - 1) < 0.2, `moyenne ${(sum / cnt).toFixed(2)}`);
  assert.ok(moved >= RESOURCE_ORDER.length * 0.6, `${moved} ressources ont bougé`);
});

test("vendre fait baisser le prix, acheter le fait monter ; le stock revient vers sa cible avec le temps", () => {
  const p = base(), m0 = marketOf(p, T0);
  const sold = sellResource(p, "bois_de_frene", 50, T0);
  assert.ok(unitPrice(sold.player.market, "bois_de_frene") < unitPrice(m0, "bois_de_frene"));
  const bought = buyResource(p, "croc_de_loup", 40, T0);
  assert.ok(unitPrice(bought.player.market, "croc_de_loup") > unitPrice(m0, "croc_de_loup"));
  const later = marketOf(sold.player, T0 + 48 * 3600e3);
  const gap = (mm) => Math.abs(mm.stock.bois_de_frene - targetStock("bois_de_frene"));
  assert.ok(gap(later) < gap(sold.player.market));
});

test("taxe : seule la mise en vente est taxée (5 %, au moins 1 or) ; acheter ne coûte que le prix affiché", () => {
  assert.equal(TAX_RATE, 0.05);
  assert.equal(saleTax(1), 0); assert.equal(saleTax(2), 1); assert.equal(saleTax(10), 1); assert.equal(saleTax(100), 5); assert.equal(saleTax(101), 6); assert.equal(saleTax(1000), 50);
  const p = base(), m = marketOf(p, T0);
  // achat : aucune taxe, un lot d'une unité coûte exactement le prix affiché
  const b1 = buyResource(p, "bois_de_frene", 1, T0);
  assert.equal(b1.total, unitPrice(m, "bois_de_frene")); assert.equal(b1.tax, 0);
  // vente : net = brut - taxe, et la taxe est bien retirée de l'or reçu
  const s = sellResource(p, "bois_de_frene", 40, T0);
  assert.equal(s.tax, saleTax(s.gross)); assert.equal(s.total, s.gross - s.tax); assert.equal(s.player.gold, p.gold + s.total);
  assert.ok(s.tax >= 1 && s.tax <= Math.ceil(s.gross * TAX_RATE));
});

test("racheter ce qu'on vient de vendre coûte toujours plus cher (taxe + variation du cours)", () => {
  for (const id of ["bois_de_frene", "croc_de_loup", "oeil_de_loup_argente"]) for (const qty of [1, 10]) {
    const p = base({ resources: { [id]: 10 } });
    const s = sellResource(p, id, qty, T0);
    const b = buyResource({ ...s.player, gold: 100000 }, id, qty, T0);
    assert.ok(b.total > s.total, `${id} ×${qty} : reçu ${s.total}, racheté ${b.total}`);
  }
});

test("les devis sont exacts : le montant payé est celui annoncé, l'or et les ressources suivent", () => {
  const p = base(), m = marketOf(p, T0);
  const q = quoteBuy(m, "bois_de_frene", 10);
  const r = buyResource(p, "bois_de_frene", 10, T0);
  assert.equal(r.total, q.total); assert.equal(r.player.gold, p.gold - q.total); assert.equal(r.player.resources.bois_de_frene, 60);
  const sq = quoteSell(m, "croc_de_loup", 5), s = sellResource(p, "croc_de_loup", 5, T0);
  assert.equal(s.total, sq.net); assert.equal(s.tax, sq.tax); assert.equal(s.player.gold, p.gold + sq.net); assert.equal(s.player.resources.croc_de_loup, 15);
  assert.notEqual(r.player, p); assert.equal(p.gold, 1000);          // le joueur d'origine n'est pas modifié
});

test("limites : pas plus que ce qu'on possède, achat limité par l'or, rupture de stock, quantité nulle", () => {
  const p = base();
  assert.equal(sellResource(p, "croc_de_loup", 999, T0).qty, 20);
  assert.equal(sellResource(p, "croc_de_loup", 20, T0).player.resources.croc_de_loup, undefined);   // plus aucune ligne à 0
  assert.equal(sellResource(p, "ortie", 5, T0).ok, false);
  const poor = base({ gold: 25 }), r = buyResource(poor, "bois_de_frene", 100, T0);
  assert.ok(r.ok && r.qty > 0 && r.qty < 100 && r.player.gold >= 0 && r.player.gold < 25);
  assert.equal(r.qty, maxAffordable(marketOf(poor, T0), "bois_de_frene", 25));
  assert.equal(buyResource(base({ gold: 0 }), "bois_de_frene", 1, T0).ok, false);
  const m = marketOf(p, T0), avail = availableToBuy(m, "oeil_de_loup_argente");
  const big = buyResource({ ...p, gold: 1e7 }, "oeil_de_loup_argente", 1000, T0);
  assert.equal(big.qty, avail); assert.ok(big.player.market.stock.oeil_de_loup_argente >= 0.25 * targetStock("oeil_de_loup_argente") - 1);
  assert.equal(buyResource(p, "bois_de_frene", 0, T0).ok, false);
});

test("un ancien joueur sans marché en reçoit un à la première transaction", () => {
  const old = base(); delete old.market;
  const r = sellResource(old, "bois_de_frene", 1, T0);
  assert.ok(r.player.market && r.player.market.stock.bois_de_frene > 0);
});

test("équipement : chaque objet a une valeur, la vente retire l'objet du sac et paie 60 % moins la taxe", () => {
  for (const id of Object.keys(ITEMS)) assert.ok(itemValue(id) > 0 && itemSellPrice(id) > 0, id);
  assert.ok(itemValue("plastron_veteran") > itemValue("chapeau_veteran"));
  const p = createPlayer({ classKey: "guerrier", testMode: true }), it = p.inventory[0];
  const r = sellItem(p, it.uid);
  assert.equal(r.player.inventory.length, p.inventory.length - 1); assert.equal(r.player.gold, p.gold + itemSellPrice(it.id) - saleTax(itemSellPrice(it.id))); assert.equal(r.tax, saleTax(itemSellPrice(it.id)));
  assert.ok(itemSellPrice(it.id) < itemValue(it.id));
  assert.equal(sellItem(p, "nope").ok, false);
  assert.ok(Object.values(p.equipped).filter(Boolean).every((e) => p.inventory.every((i) => i.uid !== e.uid)));   // l'équipé n'est pas dans le sac : donc pas vendable
});

test("tendance : variation sur ~3 h et historique disponibles pour l'affichage", () => {
  const m = tickMarket(newMarket(T0), T0 + 5 * 3600e3);
  for (const id of RESOURCE_ORDER) { const t = trend(m, id); assert.ok(Number.isFinite(t.change) && t.hist.length === 24 && t.mult > 0); }
  assert.ok(Math.abs(midPrice(m, "bois_de_frene") - RESOURCES.bois_de_frene.value) < RESOURCES.bois_de_frene.value * 1.4);
});

console.log(`\n${n} tests passent.`);
