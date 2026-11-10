// Tests des magnats de l'hôtel des ventes :  node scripts/test-magnat.js
import assert from "node:assert/strict";
import { newMarket, tickMarket, enableSimMarket, marketPrice, refPrice, targetStock, supplyOf, MAGNAT_TOOLS, STEP_MS } from "../src/utils/market.js";
import { MAG, isMagnat, markupOf, wealthOf, magnatsTrade } from "../src/utils/magnats.js";
import { getPopulation } from "../src/sim/population.js";
import { traitsOf, isActive, shareOf, MAGNAT_SHARE } from "../src/sim/lives.js";
import { RESOURCES, RESOURCE_ORDER } from "../src/data/resources.js";
import { makeRng } from "../src/sim/rng.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Magnats");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12), DAY = 86400000;
const mags = pop.filter(isMagnat);
const run = (fn) => { enableSimMarket(true); try { return fn(); } finally { enableSimMarket(false); } };

// Un marché en cours, un pas où au moins deux magnats jouent, et une ressource commune de référence
function setup() {
  const m = structuredClone(newMarket(T0));
  let bucket = m.bucket;
  const online = () => mags.filter((b) => isActive(b, bucket));
  while (online().length < 2) bucket++;
  for (const b of mags) { const life = m.sims.lives[b.id]; life.magnat = undefined; life.gold = 0; }
  m.listings = [];
  return { m, bucket, on: online() };
}
const rid = RESOURCE_ORDER.find((id) => RESOURCES[id].rarity === "commune" && !RESOURCES[id].crafted);
const trade = (m, bucket, seed = 1) => magnatsTrade(m, bucket, makeRng(seed), MAGNAT_TOOLS);
const eager = (fn) => { const old = MAG.actP; MAG.actP = 1; try { return fn(); } finally { MAG.actP = old; } };
const seller = pop.find((b) => !isMagnat(b));
const put = (m, o) => { m.listings.push({ id: m.nextId++, seller: seller.id, kind: "res", rid, qty: 10, exp: m.bucket + 100, ...o }); };

await test("un tiers des acharnés sont des magnats, et eux seuls (profil stable)", () => {
  const ach = pop.filter((b) => traitsOf(b).profile === "acharne");
  assert.ok(mags.length > 0 && mags.every((b) => traitsOf(b).profile === "acharne"));
  assert.ok(Math.abs(mags.length / ach.length - MAGNAT_SHARE) < 0.12, `${mags.length}/${ach.length}`);
  assert.ok(pop.filter((b) => traitsOf(b).focus === "xp").length > 0 && pop.filter((b) => traitsOf(b).focus === "metiers").length > 0, "les autres acharnés gardent leurs objectifs");
  assert.ok(mags.length >= 5, "plusieurs magnats, pour qu'il y ait de la concurrence");
  const s = shareOf(mags[0], traitsOf(mags[0]));
  assert.ok(Math.abs(s.fight + s.gather + s.craft - 1) < 1e-9);
  assert.ok(mags.every((b) => markupOf(b) >= 0 && markupOf(b) <= 0.12));
});

await test("un magnat achète une annonce très bon marché, puis la remet en vente plus cher que ce qu'il a payé", () => run(() => {
  const { m, bucket, on } = setup();
  const b = on[0], life = m.sims.lives[b.id], ref = refPrice(m, rid);
  const cheap = Math.max(1, Math.floor(ref * 0.5));
  for (const o of on.slice(1)) m.sims.lives[o.id].gold = 0;         // un seul acheteur possible
  life.gold = 5000;
  put(m, { unit: cheap, qty: 10 });
  eager(() => trade(m, bucket));
  const st = life.magnat?.stock[rid];
  assert.ok(st && st.qty >= 1, "il a acheté");
  assert.ok(life.gold < 5000);
  assert.ok(st.cost <= ref * MAG.buyRes + 0.01);
  // il vend : une annonce de magnat, au-dessus du prix de revient avec la marge minimale, jamais au-delà de 1,15 × le cours
  eager(() => trade(m, bucket + 1));
  const mine = m.listings.filter((l) => l.seller === b.id && l.rid === rid);
  assert.ok(mine.length === 1, "une annonce posée");
  assert.ok(mine[0].mag != null && mine[0].mag <= ref * MAG.buyRes + 0.01);
  assert.ok(mine[0].unit >= mine[0].mag * MAG.minGain - 1, `${mine[0].unit} vs revient ${mine[0].mag}`);
  assert.ok(mine[0].unit <= Math.ceil(refPrice(m, rid) * MAG.sellMax), "plafond du prix");
}));

await test("pas d'affaire, pas d'achat : les annonces au prix normal et celles d'un autre magnat sont ignorées", () => run(() => {
  const { m, bucket, on } = setup();
  const life = m.sims.lives[on[0].id], ref = refPrice(m, rid);
  for (const o of on) m.sims.lives[o.id].gold = 5000;
  put(m, { unit: Math.round(ref), qty: 10 });
  put(m, { unit: Math.max(1, Math.floor(ref * 0.4)), qty: 10, seller: on[1].id, mag: 1 });      // annonce de magnat, très bon marché
  eager(() => trade(m, bucket));
  assert.equal(Object.keys(life.magnat?.stock || {}).length, 0);
  assert.equal(m.listings.find((l) => l.mag).qty, 10, "intacte");
}));

await test("garde-fous : stock plafonné par magnat et pour tous ensemble, 200 or gardés de côté", () => run(() => {
  const { m, bucket, on } = setup();
  const T = targetStock(rid), ref = refPrice(m, rid);
  for (const b of mags) m.sims.lives[b.id].gold = 1e6;
  for (let i = 0; i < 40; i++) put(m, { unit: Math.max(1, Math.floor(ref * 0.3)), qty: 20 });
  for (let k = 0; k < 6; k++) eager(() => trade(m, bucket, k + 1));
  let total = 0;
  for (const b of mags) { const q = m.sims.lives[b.id].magnat?.stock[rid]?.qty || 0; total += q; assert.ok(q <= Math.ceil(T * MAG.holdShareCheap), `un magnat tient ${q} > ${Math.ceil(T * MAG.holdShareCheap)}`); }
  assert.ok(total <= Math.ceil(T * MAG.allShare), `${total} > ${Math.ceil(T * MAG.allShare)}`);
  assert.ok(total > 0);
  // le magnat pauvre garde sa réserve
  const poor = on[0], life = m.sims.lives[poor.id];
  life.gold = MAG.reserve + 3; life.magnat = undefined; m.listings = [];
  put(m, { unit: 1, qty: 20 });
  eager(() => trade(m, bucket + 7));
  assert.ok(life.gold >= MAG.reserve, "la réserve n'est pas touchée");
}));

await test("marché saturé : un magnat ne vend pas ; marge insuffisante : il attend ; il vend quand le cours remonte", () => run(() => {
  const { m, bucket, on } = setup();
  const b = on[0], life = m.sims.lives[b.id], T = targetStock(rid), ref = refPrice(m, rid);
  life.gold = 5000;
  life.magnat = { stock: { [rid]: { qty: 10, cost: ref * 0.6, since: bucket } }, items: [] };
  put(m, { unit: Math.round(ref), qty: Math.ceil(T * MAG.flood) + 5 });         // le marché déborde
  eager(() => trade(m, bucket));
  assert.equal(m.listings.filter((l) => l.seller === b.id).length, 0, "saturé : rien");
  m.listings = [];
  life.magnat.stock[rid].cost = ref * 1.1;                                          // payé trop cher pour gagner quoi que ce soit
  eager(() => trade(m, bucket));
  assert.equal(m.listings.filter((l) => l.seller === b.id).length, 0, "attend");
  life.magnat.stock[rid].cost = ref * 0.6;
  eager(() => trade(m, bucket));
  assert.equal(m.listings.filter((l) => l.seller === b.id).length, 1, "vend");
}));

await test("une annonce de magnat qui expire retourne dans son stock de commerce (pas dans son sac)", () => run(() => {
  const { m, bucket, on } = setup();
  const b = on[0], life = m.sims.lives[b.id];
  const bagBefore = life.bag.res[rid] || 0;
  m.listings.push({ id: m.nextId++, seller: b.id, kind: "res", rid, qty: 7, unit: 99999, exp: m.bucket + 1, mag: 5 });
  const later = tickMarket(m, (m.bucket + 3) * STEP_MS);
  const l2 = later.sims.lives[b.id];
  assert.ok((l2.magnat?.stock[rid]?.qty || 0) >= 7, "dans le stock de commerce");
  assert.ok((l2.bag.res[rid] || 0) <= bagBefore + 40, "pas dans le sac");
  assert.equal(later.listings.filter((l) => l.mag != null && l.seller === b.id && l.unit === 99999).length, 0);
}));

await test("wealthOf : l'or plus le stock au prix de revient", () => {
  assert.equal(wealthOf({ gold: 100 }), 100);
  assert.equal(wealthOf({ gold: 100, magnat: { stock: { a: { qty: 4, cost: 10, since: 0 } }, items: [{ rid: "x", cost: 25, since: 0 }] } }), 165);
});

await test("6 jours de marché : les magnats commercent à plusieurs, les prix restent raisonnables, rien de négatif", () => run(() => {
  let m = newMarket(T0);
  m = tickMarket(m, T0 + 6 * DAY);
  const active = mags.filter((b) => (m.sims.lives[b.id].magnat?.bought || 0) > 0);
  assert.ok(active.length >= 3, `seulement ${active.length} magnats ont acheté`);
  const bought = mags.reduce((s, b) => s + (m.sims.lives[b.id].magnat?.bought || 0), 0);
  assert.ok(bought > 20, `${bought} unités achetées`);
  let sum = 0, k = 0;
  for (const id of RESOURCE_ORDER) {
    const p = marketPrice(m, id);
    if (p != null) { const c = p / RESOURCES[id].value; assert.ok(c > 0.3 && c < 3.5, `${id} × ${c.toFixed(2)}`); sum += c; k++; }
    assert.ok(supplyOf(m, id) <= 6 * targetStock(id), `${id}: offre démesurée`);
  }
  assert.ok(sum / k > 0.8 && sum / k < 2, `prix moyen × ${(sum / k).toFixed(2)}`);
  for (const b of pop) { const l = m.sims.lives[b.id]; assert.ok(l.gold >= 0 && Number.isFinite(l.gold)); for (const e of Object.values(l.magnat?.stock || {})) assert.ok(e.qty >= 1 && e.cost > 0); }
  // même histoire en une fois ou par tranches
  let two = newMarket(T0);
  for (let d = 1; d <= 6; d++) two = tickMarket(two, T0 + d * DAY);
  assert.ok(JSON.stringify(m.sims.lives) === JSON.stringify(two.sims.lives), "simulés différents");
  assert.ok(JSON.stringify(m.listings) === JSON.stringify(two.listings), "annonces différentes");
}));

console.log(`\n${n} tests OK`);
