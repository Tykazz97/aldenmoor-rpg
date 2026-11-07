// ============================================================
// Marché d'Aldenmoor : prix qui bougent selon l'offre et la demande (sans React).
//
// Pour chaque ressource, le marché garde un STOCK. Plus il y en a, plus le prix baisse ;
// plus il est rare, plus il monte :   prix = valeur de base × (stock cible / stock)^0,6
//   - Quand le joueur VEND, le stock monte (le prix baisse). Quand il ACHÈTE, le stock baisse.
//   - Avec le temps, le stock revient vers sa cible et fluctue (autres marchands, caravanes, pénuries).
//     Cette évolution ne dépend que de l'heure : on la rejoue à l'ouverture, même après des heures d'absence.
//   - Un seul prix par ressource, le même pour acheter et vendre. ACHETER N'EST JAMAIS TAXÉ.
//     Mettre en vente (ressource ou équipement) est taxé : TAX_RATE du montant, retiré au vendeur.
//     Racheter ce qu'on vient de vendre fait donc toujours perdre de l'or (taxe + variation du cours).
// player.market = { bucket, stock: { id: n }, hist: { id: [coefficients horaires] } }
// Les saves sans marché en reçoivent un à la volée. Plus tard, les vrais joueurs et les simulés
// viendront remplir ce même marché avec leurs propres annonces.
// ============================================================
import { RESOURCES, RESOURCE_ORDER } from "../data/resources.js";
import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { makeRng, hashString } from "../sim/rng.js";

export const STEP_MS = 10 * 60 * 1000;        // le marché évolue toutes les 10 minutes
const HOUR_STEPS = 6, HIST_LEN = 24, MAX_CATCHUP = 288;   // 48 h de rattrapage au plus
const REVERT = 0.02, NOISE = 0.07, EVENT_P = 0.004, EVENT = 0.5;
const EXPONENT = 0.6, MULT_MIN = 0.45, MULT_MAX = 2.3;
export const TAX_RATE = 0.05;                  // taxe de mise en vente : 5 % du montant, payée par le vendeur
const MIN_FLOOR = 0.25;                        // le marché ne vend pas en dessous de 25 % de son stock cible
export const ITEM_SELL_RATE = 0.6;             // un équipement se revend 60 % de sa valeur

const TARGET = { commune: 120, peu_commune: 60, rare: 15 };
export const targetStock = (id) => TARGET[RESOURCES[id].rarity] || 60;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const bucketOf = (now) => Math.floor(now / STEP_MS);

export const multiplier = (id, stock) => clamp(Math.pow(targetStock(id) / Math.max(stock, 1), EXPONENT), MULT_MIN, MULT_MAX);

function stepStock(id, stock, bucket) {
  const T = targetStock(id), r = makeRng(hashString(`${id}:${bucket}`));
  let s = stock + (T - stock) * REVERT + (r() - 0.5) * 2 * NOISE * T;
  if (r() < EVENT_P) s += (r() < 0.5 ? -1 : 1) * EVENT * T;        // caravane qui passe, pénurie...
  return clamp(s, 0.2 * T, 3 * T);
}

export function tickMarket(m, now = Date.now()) {
  const target = bucketOf(now);
  let b = Math.max(m.bucket, target - MAX_CATCHUP);
  if (b >= target) return m;
  const stock = { ...m.stock }, hist = Object.fromEntries(Object.entries(m.hist).map(([k, v]) => [k, [...v]]));
  for (; b < target; b++) {
    const bucket = b + 1;
    for (const id of RESOURCE_ORDER) {
      stock[id] = stepStock(id, stock[id], bucket);
      if (bucket % HOUR_STEPS === 0) hist[id] = [...hist[id], round2(multiplier(id, stock[id]))].slice(-HIST_LEN);
    }
  }
  return { bucket: target, stock, hist };
}
const round2 = (v) => Math.round(v * 100) / 100;

// Marché neuf : on rejoue 24 h d'évolution depuis le stock cible, pour avoir déjà un historique à afficher
export function newMarket(now = Date.now()) {
  const stock = Object.fromEntries(RESOURCE_ORDER.map((id) => [id, targetStock(id)]));
  const hist = Object.fromEntries(RESOURCE_ORDER.map((id) => [id, []]));
  const start = bucketOf(now) - HOUR_STEPS * HIST_LEN - (bucketOf(now) % HOUR_STEPS);
  return tickMarket({ bucket: start, stock, hist }, now);
}

// Le marché du joueur, mis à jour jusqu'à maintenant (sans modifier le joueur)
export const marketOf = (player, now = Date.now()) => (player.market ? tickMarket(player.market, now) : newMarket(now));

const baseValue = (id) => RESOURCES[id].value;
export const midPrice = (m, id) => baseValue(id) * multiplier(id, m.stock[id]);
const unitAt = (mid) => Math.max(1, Math.round(mid));
export const unitPrice = (m, id) => unitAt(midPrice(m, id));        // prix affiché, à l'achat comme à la vente

// Taxe de mise en vente sur un montant : 5 %, au moins 1 or, sans jamais manger tout le montant
export const saleTax = (gross) => (gross <= 1 ? 0 : Math.min(gross - 1, Math.max(1, Math.ceil(gross * TAX_RATE))));

// Combien le marché peut-il vendre ? (il garde un plancher de stock)
export const availableToBuy = (m, id) => Math.max(0, Math.floor(m.stock[id] - MIN_FLOOR * targetStock(id)));

// Devis exact pour `qty` unités : le prix bouge à chaque unité échangée
export function quoteBuy(m, id, qty) {
  let stock = m.stock[id], total = 0, n = 0;
  const floor = MIN_FLOOR * targetStock(id);
  while (n < qty && stock - 1 >= floor) { total += unitAt(baseValue(id) * multiplier(id, stock)); stock -= 1; n++; }
  return { qty: n, total };
}
// Mise en vente de `qty` unités : montant brut, taxe, et net reçu par le vendeur
export function quoteSell(m, id, qty) {
  let stock = m.stock[id], gross = 0;
  for (let n = 0; n < qty; n++) { gross += unitAt(baseValue(id) * multiplier(id, stock)); stock += 1; }
  const tax = saleTax(gross);
  return { qty, gross, tax, net: gross - tax };
}

// Plus grand lot achetable avec `gold`
export function maxAffordable(m, id, gold) {
  let stock = m.stock[id], left = gold, n = 0;
  const floor = MIN_FLOOR * targetStock(id);
  for (;;) {
    const p = unitAt(baseValue(id) * multiplier(id, stock));
    if (left < p || stock - 1 < floor) return n;
    left -= p; stock -= 1; n++;
  }
}

export function trend(m, id) {
  const h = m.hist[id] || [];
  const now = multiplier(id, m.stock[id]);
  const ref = h.length >= 4 ? h[h.length - 4] : h[0] ?? now;      // il y a ~3 h
  return { mult: now, change: ref ? (now - ref) / ref : 0, hist: h };
}
export const stockLabel = (m, id) => { const r = m.stock[id] / targetStock(id); return r < 0.5 ? "Pénurie" : r < 0.85 ? "Stock bas" : r > 1.6 ? "Abondant" : "Normal"; };

// ---- transactions (renvoient un nouveau joueur, jamais de modification en place) ----
// total = ce qui a été payé (achat) ou reçu net (vente) ; gross et tax détaillent une vente
const fail = (player, reason) => ({ ok: false, reason, player, qty: 0, total: 0, gross: 0, tax: 0 });

export function buyResource(player, id, qty, now = Date.now()) {
  if (!RESOURCES[id]) return fail(player, "inconnu");
  const m = marketOf(player, now);
  const q = quoteBuy(m, id, Math.floor(qty));
  if (q.qty < 1) return fail(player, "rupture");
  // si l'or manque, on achète ce qu'on peut payer
  const n = q.total <= player.gold ? q.qty : maxAffordable(m, id, player.gold);
  if (n < 1) return fail(player, "or");
  const real = quoteBuy(m, id, n);
  const next = { ...m, stock: { ...m.stock, [id]: m.stock[id] - real.qty } };
  return { ok: true, qty: real.qty, gross: real.total, tax: 0, total: real.total, player: { ...player, gold: player.gold - real.total, resources: { ...player.resources, [id]: (player.resources[id] || 0) + real.qty }, market: next } };
}

export function sellResource(player, id, qty, now = Date.now()) {
  if (!RESOURCES[id]) return fail(player, "inconnu");
  const have = player.resources[id] || 0;
  const n = Math.min(Math.floor(qty), have);
  if (n < 1) return fail(player, "aucun");
  const m = marketOf(player, now);
  const q = quoteSell(m, id, n);
  const res = { ...player.resources, [id]: have - n };
  if (res[id] <= 0) delete res[id];
  return { ok: true, qty: n, gross: q.gross, tax: q.tax, total: q.net, player: { ...player, gold: player.gold + q.net, resources: res, market: { ...m, stock: { ...m.stock, [id]: m.stock[id] + n } } } };
}

// ---- équipement : prix fixe (60 % de la valeur de fabrication), puis taxe de mise en vente ----
export function itemValue(id) {
  const rec = RECIPES[id];
  if (!rec) return 60;                                              // armes qui tombent directement
  return Object.entries(rec.ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, 0) + rec.gold;
}
export const itemSellPrice = (id) => Math.max(1, Math.floor(itemValue(id) * ITEM_SELL_RATE));

export function sellItem(player, uid) {
  const item = player.inventory.find((i) => i.uid === uid);
  if (!item) return fail(player, "aucun");
  const gross = itemSellPrice(item.id), tax = saleTax(gross);
  return { ok: true, qty: 1, gross, tax, total: gross - tax, player: { ...player, gold: player.gold + gross - tax, inventory: player.inventory.filter((i) => i.uid !== uid) } };
}
