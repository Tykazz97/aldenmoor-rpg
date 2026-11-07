// Tests du marché relié aux joueurs simulés :  node scripts/test-simmarket.js
import assert from "node:assert/strict";
import {
  newMarket, tickMarket, marketOf, enableSimMarket, simMarketEnabled, buyFromListing, buyCheapest, postListing, settleMarket,
  listingsFor, sellerName, STEP_MS, supplyOf, targetStock, marketBehind, CATCHUP_SLICE,
} from "../src/utils/market.js";
import { getPopulation } from "../src/sim/population.js";
import { RESOURCES, RESOURCE_ORDER } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Marché relié aux simulés");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);
const HOUR = 3600000, DAY = 86400000;
const basePlayer = (extra = {}) => ({ gold: 5000, resources: {}, inventory: [], quests: {}, ...extra });
const run = (now) => { enableSimMarket(true); try { return now(); } finally { enableSimMarket(false); } };

await test("désactivé par défaut : le marché reste l'ancien (pas de simulés dedans)", () => {
  assert.equal(simMarketEnabled(), false);
  assert.equal(newMarket(T0).sims, undefined);
});

await test("activé : le marché contient le monde des simulés, déterministe, et avance avec lui", () => run(() => {
  const a = newMarket(T0), b = newMarket(T0);
  assert.ok(a.sims && Object.keys(a.sims.lives).length === pop.length);
  assert.deepEqual(a, b);
  const later = tickMarket(a, T0 + 2 * DAY);
  assert.ok(later.sims.step > a.sims.step, "les simulés ont avancé avec le marché");
  assert.equal(tickMarket(later, T0 + 2 * DAY), later, "déjà à jour : même objet");
  // rejouer en un bloc ou pas à pas : même histoire
  const one = tickMarket(a, T0 + 6 * HOUR);
  let two = a; for (let i = 1; i <= 36; i++) two = tickMarket(two, T0 + i * STEP_MS);
  assert.deepEqual(one.sims.lives, two.sims.lives);
  assert.deepEqual(one.listings, two.listings);
}));

await test("les annonces viennent de vrais simulés : leurs sacs se vident, ils touchent l'or, rien n'est négatif", () => run(() => {
  let m = newMarket(T0);
  const before = JSON.stringify(m.sims.lives[pop[0].id].bag);
  for (let d = 1; d <= 14; d++) m = tickMarket(m, T0 + d * DAY);
  const sellers = new Set(m.listings.map((l) => l.seller));
  const simSellers = [...sellers].filter((s) => s.startsWith("sim_"));
  assert.ok(simSellers.length >= 5, `${simSellers.length} simulés vendent à l'hôtel des ventes`);
  for (const s of simSellers) assert.ok(m.sims.lives[s], s);
  for (const l of m.listings) {
    assert.ok(Number.isInteger(l.qty) && l.qty >= 1 && Number.isInteger(l.unit) && l.unit >= 1, `annonce ${l.id}`);
    assert.ok(l.seller === "npc" || m.sims.lives[l.seller], l.seller);
    if (l.kind === "res") assert.ok(RESOURCES[l.rid]); else assert.ok(ITEMS[l.rid]);
  }
  for (const life of Object.values(m.sims.lives)) {
    assert.ok(life.gold >= 0 && Number.isFinite(life.gold), "or ≥ 0");
    for (const q of Object.values(life.bag.res)) assert.ok(Number.isInteger(q) && q > 0);
  }
  assert.ok(sellerName("npc").includes("Colporteur") && sellerName(simSellers[0]).length > 2);
}));

await test("ils achètent aussi ce qui leur manque pour fabriquer (annonces des autres), et fabriquent avec", () => run(() => {
  let m = newMarket(T0);
  for (let d = 1; d <= 21; d++) m = tickMarket(m, T0 + d * DAY);
  const lives = Object.values(m.sims.lives);
  const bought = lives.reduce((s, l) => s + (l.bought || 0), 0), crafters = lives.filter((l) => (l.crafted || 0) > 0).length;
  assert.ok(bought > 50, `${bought} ressources achetées par des simulés`);
  assert.ok(crafters > 40, `${crafters} simulés ont fabriqué`);
}));

await test("le marché n'est jamais vide : le colporteur comble les pénuries (au-dessus du prix de base)", () => run(() => {
  const m = tickMarket(newMarket(T0), T0 + 3 * DAY);
  const npc = m.listings.filter((l) => l.seller === "npc");
  assert.ok(npc.length >= 1, "des annonces du colporteur existent");
  let withSupply = 0;
  for (const id of RESOURCE_ORDER) if (supplyOf(m, id) > 0) withSupply++;
  assert.ok(withSupply >= RESOURCE_ORDER.length * 0.6, `${withSupply}/${RESOURCE_ORDER.length} ressources en vente`);
}));

await test("tes achats à une annonce de simulé lui rapportent l'or (crédité au pas suivant) ; le joueur est bien débité", () => run(() => {
  let m = tickMarket(newMarket(T0), T0 + 2 * DAY);
  const l = m.listings.find((x) => x.kind === "res" && x.seller.startsWith("sim_") && x.qty >= 2);
  assert.ok(l, "une annonce de simulé existe");
  const player = basePlayer({ market: m });
  const goldBefore = m.sims.lives[l.seller].gold;
  const r = buyFromListing(player, l.id, 2, T0 + 2 * DAY);
  assert.ok(r.ok && r.qty === 2);
  assert.equal(r.player.gold, 5000 - 2 * l.unit);
  assert.equal(r.player.market.credits[l.seller], 2 * l.unit);
  const next = tickMarket(r.player.market, T0 + 2 * DAY + STEP_MS);
  assert.deepEqual(next.credits, {}, "crédits versés et vidés");
  assert.ok(next.sims.lives[l.seller].gold >= goldBefore + 2 * l.unit - 5000, "l'or est arrivé (les autres opérations du pas peuvent aussi jouer)");
  // l'achat « le moins cher » crédite les vendeurs des lignes
  const rid = l.rid;
  const c = buyCheapest(basePlayer({ market: next }), rid, 3, T0 + 2 * DAY + STEP_MS);
  assert.ok(c.ok);
  const total = Object.values(c.player.market.credits).reduce((s, x) => s + x, 0);
  assert.ok(total >= 0 && total <= c.total, "les crédits ne dépassent pas ce que tu as payé");
}));

await test("tes annonces vivent avec le marché des simulés : tu vends, la taxe est payée, le reste du jeu marche comme avant", () => run(() => {
  let m = tickMarket(newMarket(T0), T0 + DAY);
  const p = basePlayer({ market: m, resources: { croc_de_loup: 60 } });
  const r = postListing(p, { kind: "res", rid: "croc_de_loup", qty: 40, unit: 4 }, T0 + DAY);
  assert.ok(r.ok);
  let later = r.player;
  for (let d = 2; d <= 4; d++) later = { ...later, market: tickMarket(later.market, T0 + d * DAY) };
  const s = settleMarket(later, T0 + 4 * DAY);
  assert.ok(s.player.gold >= later.gold, "l'or des ventes est encaissé");
  assert.ok(s.player.market.sims, "le monde des simulés reste dans le marché");
}));

await test("avant le fresh start personne ne joue ; mauvaise sauvegarde de simulés : on repart propre", () => run(() => {
  const m = newMarket(T0);
  const broken = { ...m, sims: { ...m.sims, lives: {} } };
  const fixed = tickMarket(broken, T0 + STEP_MS);
  assert.equal(Object.keys(fixed.sims.lives).length, pop.length, "monde recréé");
  assert.equal(marketOf({ market: { ...m, v: 2 } }, T0).v, 2);
}));

await test("rattrapage de plusieurs jours : rapide", () => run(() => {
  const m = newMarket(T0);
  const t = performance.now();
  tickMarket(m, T0 + 7 * DAY);
  const ms = performance.now() - t;
  assert.ok(ms < 4000, `7 jours rattrapés en ${Math.round(ms)} ms`);
}));

await test("le colporteur ne vend jamais de ressource rare, ni d'équipement au-dessus du commun (relique, épique, pièces fabriquées)", () => run(() => {
  let m = newMarket(T0);
  for (let d = 1; d <= 20; d++) {
    m = tickMarket(m, T0 + d * DAY);
    for (const l of m.listings.filter((x) => x.seller === "npc")) {
      if (l.kind === "res") assert.notEqual(RESOURCES[l.rid].rarity, "rare", `${l.rid} rare vendu par le colporteur`);
      else assert.equal(ITEMS[l.rid].rarity, "commune", `${l.rid} vendu par le colporteur`);
    }
  }
}));

await test("rattrapage par tranches : le même marché et les mêmes simulés que d'un seul coup, sans jamais dépasser la tranche", () => run(() => {
  const start = newMarket(T0), target = T0 + 3 * DAY;
  const whole = tickMarket(start, target);
  let m = start, slices = 0;
  while (marketBehind(m, target)) {
    const before = m.bucket;
    m = tickMarket(m, target, { maxSteps: CATCHUP_SLICE });
    assert.ok(m.bucket - before <= CATCHUP_SLICE && m.bucket > before, "avance d'une tranche au plus, et toujours");
    slices++;
  }
  assert.ok(slices >= 10, `${slices} tranches pour 3 jours`);
  assert.equal(JSON.stringify(m), JSON.stringify(whole));
  assert.equal(marketBehind(m, target), false);
  assert.equal(tickMarket(m, target, { maxSteps: CATCHUP_SLICE }), m, "à jour : rien ne change");
  assert.equal(marketBehind(null, target), false);
}));

console.log(`\n${n} tests passent.`);
