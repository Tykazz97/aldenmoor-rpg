// ============================================================
// Les magnats de l'hôtel des ventes (sans React).
//
// Un tiers des joueurs acharnés (focus "magnat", voir sim/lives.js) jouent surtout l'économie : ils produisent un peu (récolte,
// fabrication) mais leur vrai métier, c'est le commerce. À chaque séance ils :
//   - ACHÈTENT les annonces très bon marché : ressources à moins de 68 % du cours (85 % quand le cours est déprimé, c'est-à-dire
//     que la ressource abonde : ils en stockent alors davantage), équipement à moins de 75 % de sa valeur ;
//   - REVENDENT au prix du marché plus une majoration propre à chaque magnat (0 à 12 %), jamais au-delà de 1,15 fois le cours, et
//     seulement si ça rapporte au moins 35 % sur le prix de revient : la taxe de mise en vente est de 10 % et se paie aussi sur les
//     annonces qui expirent, en dessous les petites marges ne couvrent rien. Ils s'alignent sur le moins cher des autres vendeurs
//     tant qu'ils gardent ces 35 %. Sinon ils attendent que le cours remonte ; après 4 jours ils acceptent de vendre au cours, mais
//     jamais en dessous de 90 % de ce qu'ils ont payé.
// Plusieurs magnats se font concurrence (ordre de passage tiré au hasard à chaque pas, chacun sa majoration) : pas de monopole.
// GARDE-FOUS, pour qu'ils ne fassent ni flamber ni s'effondrer les prix :
//   - stock limité : chaque magnat garde au plus 30 % de l'offre normale d'une ressource (60 % si elle est bradée), et tous
//     les magnats ensemble au plus 70 % ; l'équipement : 3 pièces chacun ;
//   - ils n'achètent jamais les annonces d'un autre magnat, ne vendent pas quand le marché est déjà saturé (offre > 1,5 fois
//     la normale), ont au plus 6 annonces, gardent 200 or de côté et n'engagent que 70 % de leur or disponible à la fois.
// Leurs comptes : m.gain (bénéfice des ventes), m.taxes (taxes de mise en vente payées), m.bought (unités achetées).
// Leur stock (hors du sac, pour qu'il ne serve pas aux fabrications) : life.magnat = { stock: { rid: { qty, cost, since } }, items: [{ rid, item?, cost, since }] }
// Une annonce de magnat porte `mag` = prix de revient unitaire : si elle expire, la marchandise retourne dans son stock.
// ============================================================
import { hashString } from "../sim/rng.js";
import { traitsOf, isActive } from "../sim/lives.js";

export const MAG = {
  reserve: 200, invest: 0.7, actP: 0.6, slots: 6,
  buyRes: 0.68, buyItem: 0.75, sellMax: 1.15, itemSellMax: 1.3,
  holdShare: 0.3, holdShareCheap: 0.6, allShare: 0.7, flood: 1.5, itemsHeld: 3,
  minGain: 1.35, dumpAfter: 576, buyResCheap: 0.85, dumpFloor: 0.9, minItemPrice: 15, cheapBelow: 0.9,
};
export const isMagnat = (bot) => traitsOf(bot).focus === "magnat";
// Majoration de chaque magnat sur le cours : de 0 à +12 % (ils vendent au prix du marché, pas « prix de revient + marge » : la taxe de 10 % mange les petites marges)
export const markupOf = (bot) => 0.12 * ((hashString(`mag:${bot.id}`) % 1000) / 1000);
// Fortune d'un magnat : son or + son stock au prix de revient
export function wealthOf(life) {
  const m = life.magnat;
  if (!m) return life.gold;
  return life.gold + Object.values(m.stock).reduce((n, e) => n + e.qty * e.cost, 0) + m.items.reduce((n, e) => n + e.cost, 0);
}

// Une annonce de magnat qui expire : la marchandise retourne dans son stock (avec son prix de revient)
export function returnToMagnat(life, l, bucket) {
  const m = (life.magnat ||= { stock: {}, items: [] });
  m.expired = (m.expired || 0) + (l.kind === "res" ? l.qty : 1);
  if (l.kind === "res") addStock(m, l.rid, l.qty, l.mag, bucket);
  else m.items.push({ rid: l.rid, ...(l.item ? { item: l.item } : {}), cost: l.mag, since: bucket });
}
function addStock(m, rid, qty, cost, bucket) {
  const e = m.stock[rid];
  if (!e) m.stock[rid] = { qty, cost, since: bucket };
  else { e.cost = (e.cost * e.qty + cost * qty) / (e.qty + qty); e.qty += qty; }
}

// h : les outils du marché { population, refPrice, multiplier, targetStock, lotMax, saleTax, creditSeller, tally, worthOf }
export function magnatsTrade(s, bucket, rng, h) {
  const sims = s.sims;
  const mags = h.population.filter((b) => isMagnat(b) && sims.lives[b.id]);
  if (!mags.length) return;
  // offre de chaque ressource tenue par les magnats (stock + annonces), pour le plafond collectif
  const held = {};
  for (const b of mags) for (const [rid, e] of Object.entries(sims.lives[b.id].magnat?.stock || {})) held[rid] = (held[rid] || 0) + e.qty;
  for (const l of s.listings) if (l.mag != null && l.kind === "res") held[l.rid] = (held[l.rid] || 0) + l.qty;
  const refs = {};
  const refOf = (rid) => (refs[rid] ??= h.refPrice(s, rid));

  const order = mags.filter((b) => isActive(b, bucket) && !(sims.busy?.[b.id] >= bucket));
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }   // ordre de passage tiré au hasard
  for (const b of order) {
    if (rng() > MAG.actP) continue;
    const life = sims.lives[b.id], m = (life.magnat ||= { stock: {}, items: [] }), margin = markupOf(b);
    sell(s, b, life, m, margin, bucket, rng, h, refOf);
    buy(s, b, life, m, bucket, h, refOf, held);
  }
  s.listings = s.listings.filter((l) => l.qty > 0);
}

function sell(s, b, life, m, margin, bucket, rng, h, refOf) {
  let used = s.listings.filter((l) => l.seller === b.id).length;
  for (const rid of Object.keys(m.stock)) {
    const e = m.stock[rid];
    if (used >= MAG.slots) return;
    if (!e || e.qty < 1) { delete m.stock[rid]; continue; }
    const T = h.targetStock(rid), ref = refOf(rid);
    const mineRes = s.listings.filter((l) => l.kind === "res" && l.rid === rid);
    if (mineRes.reduce((n, l) => n + l.qty, 0) > MAG.flood * T) continue;                 // marché saturé : il attend
    const aged = bucket - e.since > MAG.dumpAfter;
    let price = Math.min(ref * (1 + margin), ref * MAG.sellMax);
    const rivals = mineRes.filter((l) => l.seller !== b.id).map((l) => l.unit);
    const cheapest = rivals.length ? Math.min(...rivals) : Infinity;
    if (cheapest - 1 >= e.cost * MAG.minGain && cheapest - 1 < price) price = cheapest - 1;
    if (aged) price = Math.min(price, ref * 0.98);
    if (price < e.cost * (aged ? MAG.dumpFloor : MAG.minGain)) continue;           // pas rentable pour l'instant : il garde (même après 4 jours, il ne brade pas à perte sèche)
    const unit = Math.max(1, Math.round(price)), qty = Math.min(e.qty, h.lotMax(rid));
    const tax = h.saleTax(qty * unit);
    if (life.gold < tax) continue;
    life.gold -= tax; m.taxes = (m.taxes || 0) + tax;
    e.qty -= qty; if (e.qty < 1) delete m.stock[rid];
    m.posted = (m.posted || 0) + qty;
    s.listings.push({ id: s.nextId++, seller: b.id, kind: "res", rid, qty, unit, exp: bucket + 144 + (aged ? 0 : rng.int(0, 144)), mag: e.cost });
    h.tally(s, bucket, "posted");
    used++;
  }
  for (let i = 0; i < m.items.length && used < MAG.slots; i++) {
    const e = m.items[i], worth = e.item ? h.worthOf({ item: e.item }) : h.worthOf({ rid: e.rid });
    const aged = bucket - e.since > MAG.dumpAfter;
    let price = Math.min(worth * 1.15 * (1 + margin), worth * MAG.itemSellMax);
    if (aged) price = Math.min(price, worth * 1.15);
    else if (price < e.cost * MAG.minGain) continue;
    const unit = Math.max(1, Math.round(price)), tax = h.saleTax(unit);
    if (life.gold < tax) continue;
    life.gold -= tax; m.taxes = (m.taxes || 0) + tax;
    m.items.splice(i--, 1);
    s.listings.push({ id: s.nextId++, seller: b.id, kind: "item", rid: e.rid, ...(e.item ? { item: e.item } : {}), qty: 1, unit, exp: bucket + 144 + (aged ? 0 : rng.int(0, 144)), mag: e.cost });
    h.tally(s, bucket, "posted");
    used++;
  }
}

function buy(s, b, life, m, bucket, h, refOf, held) {
  for (let n = 0; n < 2; n++) {
    const budget = (life.gold - MAG.reserve) * MAG.invest;
    if (budget < 5) return;
    // la meilleure affaire en ressources (plus forte remise sur le cours)
    let best = null, bestDisc = 0;
    for (const l of s.listings) {
      if (l.kind !== "res" || l.mag != null || l.qty < 1 || l.seller === b.id || l.unit > budget) continue;
      const ref = refOf(l.rid);
      const T = h.targetStock(l.rid), cheap = h.multiplier(l.rid, s.stock[l.rid]) < MAG.cheapBelow;     // cours déprimé : on achète plus large
      if (l.unit > ref * (cheap ? MAG.buyResCheap : MAG.buyRes)) continue;
      const room = Math.min(Math.ceil(T * (cheap ? MAG.holdShareCheap : MAG.holdShare)) - (m.stock[l.rid]?.qty || 0), Math.ceil(T * MAG.allShare) - (held[l.rid] || 0));
      if (room < 1) continue;
      const disc = 1 - l.unit / ref;
      if (disc > bestDisc) { best = { l, room }; bestDisc = disc; }
    }
    if (best) {
      const { l, room } = best, take = Math.min(l.qty, room, Math.floor(budget / l.unit));
      if (take < 1) return;
      l.qty -= take; life.gold -= take * l.unit;
      h.creditSeller(s, l, take, bucket);
      addStock(m, l.rid, take, l.unit, bucket);
      m.bought = (m.bought || 0) + take;
      held[l.rid] = (held[l.rid] || 0) + take;
      h.tally(s, bucket, "simBuy", take);
      continue;
    }
    // sinon, une pièce d'équipement bradée
    if (m.items.length >= MAG.itemsHeld) return;
    let bi = null, bd = 0;
    for (const l of s.listings) {
      if (l.kind !== "item" || l.mag != null || l.qty < 1 || l.seller === b.id || l.unit > budget || l.unit < MAG.minItemPrice) continue;
      const worth = h.worthOf(l), disc = 1 - l.unit / worth;
      if (l.unit <= worth * MAG.buyItem && disc > bd) { bi = l; bd = disc; }
    }
    if (!bi) return;
    bi.qty = 0; life.gold -= bi.unit;
    h.creditSeller(s, bi, 1, bucket);
    m.items.push({ rid: bi.rid, ...(bi.item ? { item: bi.item } : {}), cost: bi.unit, since: bucket });
    h.tally(s, bucket, "items");
  }
}
