// ============================================================
// Hôtel des ventes d'Aldenmoor (sans React) : ce sont les JOUEURS qui fixent les prix.
//
// Les joueurs simulés (bots) mettent en vente des ressources et de l'équipement à LEUR prix, et
// achètent les annonces qui leur semblent correctes. Toi aussi tu mets en vente à ton prix.
//   - Un bot est plus ou moins cupide (champ `greed`) : certains cassent les prix, d'autres abusent.
//     Quand une ressource se fait rare, les bots en remettent en vente un peu plus cher ; quand elle
//     abonde, ils baissent. Le prix du marché, c'est l'annonce la moins chère.
//   - TAXE : mettre en vente coûte TAX_RATE du montant demandé, payée tout de suite par le vendeur
//     et jamais remboursée (même si l'annonce expire ou est annulée). ACHETER N'EST JAMAIS TAXÉ.
//   - Tes annonces durent 48 h. Vendues : l'or arrive à ta prochaine visite. Expirées : tu récupères
//     la marchandise.
//   - Tout ce qui se passe quand tu es absent est rejoué à l'ouverture, à partir de l'heure seulement
//     (même heure = même marché), comme avant.
// player.market = { v:2, bucket, stock, hist, listings, nextId, proceeds, returns, sales }
//   stock    : stock « mondial » caché de chaque ressource ; il donne le prix de référence des bots
//   listings : { id, seller:"sim_001"|"player", kind:"res"|"item", rid, item?, qty, unit, exp }
//   proceeds : or gagné par tes ventes, pas encore encaissé ; returns : marchandise à récupérer
// ============================================================
import { RESOURCES, RESOURCE_ORDER } from "../data/resources.js";
import { ITEMS, ITEM_ORDER } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { makeRng, hashString } from "../sim/rng.js";
import { generatePopulation } from "../sim/population.js";
import { MASTERWORK_VALUE_RATE, isMasterwork } from "./perks.js";
import { ITEM_SELL_RATE, itemValue, itemSellPrice } from "./itemValue.js";
import { getPopulation } from "../sim/population.js";
import { SIM_START } from "../sim/config.js";
import { createLives, validWorld, stepLivesOne, isActive, stepOf } from "../sim/lives.js";
import { shoppingList, stash } from "../sim/lifeCraft.js";
import { drawFromBank, sellableOf, takeForSale } from "../sim/lifeBank.js";

export const STEP_MS = 10 * 60 * 1000;        // le marché évolue toutes les 10 minutes

// ---- marché relié aux joueurs simulés ----
// Quand il est activé (enableSimMarket), l'état du marché contient AUSSI le monde des simulés (`m.sims`, voir sim/lives.js) et
// les deux avancent ensemble, pas par pas : les annonces des « bots » sont celles de vrais simulés qui vendent ce qu'ils ont
// dans leur sac (et touchent l'or de la vente), ils achètent ici les ingrédients qui leur manquent pour fabriquer, et un
// Colporteur d'Aldenmoor comble les pénuries. Désactivé : l'ancien marché abstrait, inchangé (c'est le cas des tests).
let JOINT = false;
export const enableSimMarket = (on = true) => { JOINT = !!on; };
export const simMarketEnabled = () => JOINT;
const NPC = "npc";
// Le colporteur ne vend ni ressources rares, ni équipement au-dessus du commun (pièces fabriquées, épiques, reliques) : cela ne vient que des joueurs
const NPC_ITEMS = ITEM_ORDER.filter((id) => ITEMS[id].rarity === "commune");
const SIM_SELL_KEEP = 8;                       // un simulé garde au moins 8 unités de chaque ressource pour ses fabrications
const MAX_CATCHUP_JOINT = 1008;                // 7 jours de rattrapage quand les simulés vivent ici
const HOUR_STEPS = 6, HIST_LEN = 24, MAX_CATCHUP = 288;   // 48 h de rattrapage au plus
const REVERT = 0.02, NOISE = 0.07, EVENT_P = 0.004, EVENT = 0.5;
const EXPONENT = 0.6, MULT_MIN = 0.45, MULT_MAX = 2.3;
export const TAX_RATE = 0.10;                  // taxe de mise en vente : 10 % du montant, payée par le vendeur
export { ITEM_SELL_RATE, itemValue, itemSellPrice };
export const LISTING_STEPS = 288;              // une annonce du joueur dure 48 h
export const MAX_PLAYER_LISTINGS = 12;
export const MAX_UNIT_PRICE = 1_000_000;
const MAX_BOT_LISTINGS_PER_RESOURCE = 20, ITEM_LISTINGS_TARGET = 12, SALES_LOG = 30;

const TARGET = { commune: 120, peu_commune: 60, rare: 15 };           // offre « normale » en vente
const DEMAND = { commune: 1.3, peu_commune: 0.6, rare: 0.1 };         // demande des bots par tranche de 10 min
const LOT = { commune: [10, 22], peu_commune: [5, 12], rare: [1, 3] };
export const targetStock = (id) => TARGET[RESOURCES[id].rarity] || 60;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;
const bucketOf = (now) => Math.floor(now / STEP_MS);
const accept = (ratio) => clamp((1.5 - ratio) / 0.7, 0, 1);            // 1 jusqu'à 0,8 × la référence, 0 à partir de 1,5 ×

// ---- les bots du marché (toujours là, même si les joueurs simulés sont cachés dans la ville) ----
const ACTIVITY_WEIGHT = { marchand: 3, recolteur: 2, combattant: 1.5, flaneur: 0.5 };
let BOTS = null;
function bots() {
  if (!BOTS) {
    const list = generatePopulation();
    BOTS = { list, byId: Object.fromEntries(list.map((b) => [b.id, b])), weighted: list.map((b) => [b, ACTIVITY_WEIGHT[b.activity] || 1]) };
  }
  return BOTS;
}
export const sellerName = (id) => (id === "player" ? "Toi" : id === NPC ? "Colporteur d'Aldenmoor" : bots().byId[id]?.name || "Inconnu");
export const isMine = (l) => l.seller === "player";

// ---- prix de référence (cours « mondial » caché) ----
export const multiplier = (id, stock) => clamp(Math.pow(targetStock(id) / Math.max(stock, 1), EXPONENT), MULT_MIN, MULT_MAX);
export const refPrice = (m, id) => RESOURCES[id].value * multiplier(id, m.stock[id]);

function stepStock(id, stock, bucket) {
  const T = targetStock(id), r = makeRng(hashString(`${id}:${bucket}`));
  let s = stock + (T - stock) * REVERT + (r() - 0.5) * 2 * NOISE * T;
  if (r() < EVENT_P) s += (r() < 0.5 ? -1 : 1) * EVENT * T;        // caravane qui passe, pénurie...
  return clamp(s, 0.2 * T, 3 * T);
}

// Taxe de mise en vente sur un montant : TAX_RATE (10 %), au moins 1 or, sans jamais manger tout le montant
export const saleTax = (gross) => (gross <= 1 ? 0 : Math.min(gross - 1, Math.max(1, Math.ceil(gross * TAX_RATE))));

// ============================================================
// Simulation d'un pas de 10 minutes (appelée en boucle pour rattraper le temps écoulé)
// ============================================================
const sorted = (arr) => arr.slice().sort((a, b) => a.unit - b.unit || a.id - b.id);

// Activité du marché, par jour réel (les 14 derniers jours) : unités de ressources achetées par les simulés / par la demande
// générale, équipements vendus, annonces mises en vente
function tally(s, bucket, key, n = 1) {
  const day = Math.floor(bucket / 144);
  const v = (s.volume ||= []);
  let d = v[v.length - 1];
  if (!d || d.day !== day) { d = { day, simBuy: 0, demandBuy: 0, playerBuy: 0, items: 0, posted: 0 }; v.push(d); if (v.length > 14) v.shift(); }
  d[key] += n;
}

// L'or d'une vente va au vendeur : toi (en attente d'encaissement), un simulé (directement dans son personnage) ou le colporteur (perdu)
function creditSeller(s, l, take, bucket) {
  if (l.seller === "player") {
    s.proceeds += take * l.unit;
    s.sales.push({ b: bucket, kind: l.kind, rid: l.rid, qty: take, unit: l.unit, ...(l.kind === "item" ? { name: l.item?.name } : {}) });
  } else if (s.sims && s.sims.lives[l.seller]) s.sims.lives[l.seller].gold += take * l.unit;
}

// Une annonce de simulé qui expire : la marchandise retourne dans son sac
function returnToSim(s, l) {
  const life = s.sims?.lives[l.seller];
  if (!life) return;
  if (l.kind === "res") life.bag.res[l.rid] = (life.bag.res[l.rid] || 0) + l.qty;
  else stash(life, l.rid);
}

// Les simulés présents achètent ce qu'il leur manque pour leur prochaine fabrication (annonces les moins chères d'abord,
// jamais au-delà de 1,6 fois le cours, jamais les leurs), puis fabriquent au pas suivant
function simsShop(s, bucket, rng) {
  for (const b of getPopulation()) {
    const life = s.sims.lives[b.id];
    if (!life || life.gold < 1 || !isActive(b, bucket) || rng() > 0.4) continue;
    const want = drawFromBank(life, shoppingList(life, b));          // d'abord son coffre
    for (const [rid, qty] of Object.entries(want)) {
      if (!RESOURCES[rid]) continue;
      const cap = refPrice(s, rid) * 1.6;
      let left = qty;
      for (const l of sorted(s.listings.filter((x) => x.kind === "res" && x.rid === rid && x.seller !== b.id && x.unit <= cap))) {
        if (left < 1) break;
        const take = Math.min(l.qty, left, Math.floor(life.gold / l.unit));
        if (take < 1) break;
        l.qty -= take; left -= take;
        life.gold -= take * l.unit;
        life.bag.res[rid] = (life.bag.res[rid] || 0) + take;
        life.bought = (life.bought || 0) + take;
        tally(s, bucket, "simBuy", take);
        creditSeller(s, l, take, bucket);
      }
    }
  }
  s.listings = s.listings.filter((l) => l.qty > 0);
}

// Qui met en vente cette ressource ? Un simulé qui en a de trop (il paie la taxe et la sort de son sac) ; sinon, si le marché
// est presque vide, le colporteur. Renvoie { seller, greed, qty } ou null.
function pickSeller(s, id, lot, supplyTotal, T, ref, rng) {
  const [lo, hi] = lot;
  const cands = [];
  for (const b of getPopulation()) {
    const life = s.sims.lives[b.id];
    const spare = life ? sellableOf(life, id, SIM_SELL_KEEP) : 0;
    if (spare >= lo) cands.push([b, spare]);
  }
  if (cands.length) {
    const b = rng.weighted(cands), life = s.sims.lives[b.id];
    const qty = Math.min(sellableOf(life, id, SIM_SELL_KEEP), rng.int(lo, hi));
    return { seller: b.id, greed: b.greed, qty, life, bot: b };
  }
  if (RESOURCES[id].rarity !== "rare" && supplyTotal < 0.6 * T && rng() < 0.9) return { seller: NPC, greed: 0.12, qty: rng.int(lo, hi) };
  return null;
}

function stepListings(s, bucket) {
  const rng = makeRng(hashString(`mk:${bucket}`));
  const { weighted } = bots();
  const sims = s.sims && JOINT ? s.sims : null;
  if (!sims) s.sims = undefined;
  const live = sims && !(sims.mode === "fresh" && bucket < stepOf(sims.epoch));     // avant le fresh start, personne ne joue
  // l'or des ventes que tu as faites aux simulés depuis la dernière fois (achats à leurs annonces)
  if (sims) { for (const [id, gold] of Object.entries(s.credits || {})) if (sims.lives[id]) sims.lives[id].gold += gold; }
  s.credits = {};

  // 1. expiration
  s.listings = s.listings.filter((l) => {
    if (l.exp > bucket) return true;
    if (sims && l.seller !== "player") returnToSim(s, l);
    if (l.seller === "player") s.returns.push(l.kind === "res" ? { kind: "res", rid: l.rid, qty: l.qty } : { kind: "item", rid: l.rid, item: l.item });
    return false;
  });

  // 1b. les simulés vivent : ils achètent leurs ingrédients, puis jouent leur pas (combat, récolte, fabrication)
  if (live) { simsShop(s, bucket, rng); stepLivesOne(sims, getPopulation(), bucket, { merchant: false, keep: 120 }); }

  // 2. cours caché
  for (const id of RESOURCE_ORDER) s.stock[id] = stepStock(id, s.stock[id], bucket);

  // 3. chaque ressource : les bots achètent, puis des bots mettent en vente
  for (const id of RESOURCE_ORDER) {
    const res = RESOURCES[id], T = targetStock(id), ref = refPrice(s, id);
    let mine = s.listings.filter((l) => l.kind === "res" && l.rid === id);

    // achats : annonces de la moins chère à la plus chère
    let left = DEMAND[res.rarity] * Math.pow(multiplier(id, s.stock[id]), 0.8) * (0.5 + rng());
    for (const l of sorted(mine)) {
      if (left <= 0) break;
      const take = Math.min(l.qty, Math.floor(left * accept(l.unit / ref) + rng()));
      if (take < 1) continue;
      l.qty -= take; left -= take;
      tally(s, bucket, "demandBuy", take);
      creditSeller(s, l, take, bucket);
    }
    s.listings = s.listings.filter((l) => l.qty > 0);
    mine = s.listings.filter((l) => l.kind === "res" && l.rid === id);

    // mise en vente par un bot
    const total = mine.reduce((n, l) => n + l.qty, 0);
    const botCount = mine.filter((l) => l.seller !== "player").length;
    const pPost = clamp((T - total) / T, 0, 1) * 0.35 + 0.03;
    if (rng() < pPost && botCount < MAX_BOT_LISTINGS_PER_RESOURCE) {
      const lot = LOT[res.rarity];
      const pick = sims ? pickSeller(s, id, lot, total, T, ref, rng) : { seller: null, greed: null };
      const bot = sims ? null : rng.weighted(weighted);
      if (!sims || pick) {
        const greed = sims ? pick.greed : bot.greed;
        const supplyAdj = clamp(Math.pow(T / Math.max(total, 0.25 * T), 0.25), 0.88, 1.25);
        let price = ref * supplyAdj * (1 + greed + (rng() - 0.5) * 0.12);
        if (rng() < 0.4 && mine.length) {                                  // certains cassent le prix de la moins chère
          const cheapest = sorted(mine)[0].unit;
          if (cheapest - 1 >= 0.6 * ref) price = Math.min(price, cheapest - 1);
        }
        const unit = Math.max(1, Math.round(price));
        let qty = sims ? pick.qty : rng.int(lot[0], lot[1]);
        let ok = true;
        if (sims && pick.life) {                                           // le simulé paie la taxe de mise en vente et sort la marchandise de son sac
          const tax = saleTax(qty * unit);
          if (pick.life.gold < tax) ok = false;
          else { pick.life.gold -= tax; takeForSale(pick.life, id, qty); }
        }
        if (ok) tally(s, bucket, "posted");
        if (ok) s.listings.push({ id: s.nextId++, seller: sims ? pick.seller : bot.id, kind: "res", rid: id, qty, unit, exp: bucket + 144 + rng.int(0, 144) });
      }
    }
  }

  // 4. équipement : les bots en achètent, puis d'autres en proposent
  for (const l of s.listings) {
    if (l.kind !== "item") continue;
    const ratio = l.unit / ((l.item ? itemWorth(l.item) : itemValue(l.rid)) * 1.15);
    if (rng() < 0.025 * accept(ratio)) {
      l.qty = 0;
      tally(s, bucket, "items");
      creditSeller(s, l, 1, bucket);
    }
  }
  s.listings = s.listings.filter((l) => l.qty > 0);
  const itemsNow = s.listings.filter((l) => l.kind === "item" && l.seller !== "player").length;
  if (itemsNow < ITEM_LISTINGS_TARGET && rng() < 0.3) {
    if (sims) {
      // un simulé met en vente un équipement de son sac (ses fabrications d'entraînement, ses drops en trop) ; à défaut, le colporteur
      const holders = getPopulation().filter((b) => (sims.lives[b.id]?.bag.items.length || 0) > 0);
      if (holders.length) {
        const b = rng.pick(holders), life = sims.lives[b.id], rid = life.bag.items[life.bag.items.length - 1];
        const unit = Math.max(1, Math.round(itemValue(rid) * (1.15 + b.greed + (rng() - 0.5) * 0.16)));
        const tax = saleTax(unit);
        if (life.gold >= tax) { life.gold -= tax; life.bag.items.pop(); s.listings.push({ id: s.nextId++, seller: b.id, kind: "item", rid, qty: 1, unit, exp: bucket + 144 + rng.int(0, 144) }); }
      } else if (rng() < 0.2) {
        const rid = rng.pick(NPC_ITEMS);
        s.listings.push({ id: s.nextId++, seller: NPC, kind: "item", rid, qty: 1, unit: Math.max(1, Math.round(itemValue(rid) * 1.5)), exp: bucket + 144 + rng.int(0, 144) });
      }
    } else {
      const bot = rng.weighted(weighted), rid = rng.pick(ITEM_ORDER);
      const unit = Math.max(1, Math.round(itemValue(rid) * (1.15 + bot.greed + (rng() - 0.5) * 0.16)));
      s.listings.push({ id: s.nextId++, seller: bot.id, kind: "item", rid, qty: 1, unit, exp: bucket + 144 + rng.int(0, 144) });
    }
  }

  // 5. historique : toutes les heures, le prix du marché (annonce la moins chère) en coefficient de la valeur de base
  if (bucket % HOUR_STEPS === 0) {
    for (const id of RESOURCE_ORDER) s.hist[id] = [...s.hist[id], round2(coefficient(s, id))].slice(-HIST_LEN);
  }
  if (s.sales.length > SALES_LOG) s.sales = s.sales.slice(-SALES_LOG);
}

function coefficient(m, id) {
  const p = marketPrice(m, id);
  return (p ?? refPrice(m, id) * 1.25) / RESOURCES[id].value;
}

const simsValid = (m) => !!m.sims && validWorld(m.sims, SIM_START, getPopulation());

export function tickMarket(m, now = Date.now()) {
  const target = bucketOf(now);
  let b = Math.max(m.bucket, target - (JOINT ? MAX_CATCHUP_JOINT : MAX_CATCHUP));
  const needSims = JOINT && !simsValid(m);              // pas encore de simulés (ou un autre fresh start) : on les crée
  if (b >= target && !needSims) return m;
  const s = {
    ...m,
    stock: { ...m.stock },
    hist: Object.fromEntries(Object.entries(m.hist).map(([k, v]) => [k, [...v]])),
    listings: m.listings.map((l) => ({ ...l })),
    proceeds: m.proceeds, returns: [...m.returns], sales: [...m.sales], nextId: m.nextId,
    credits: { ...(m.credits || {}) },
    volume: (m.volume || []).map((d) => ({ ...d })),
  };
  if (JOINT) s.sims = needSims ? createLives({ population: getPopulation(), mode: SIM_START.mode, epoch: SIM_START.epoch, now }) : structuredClone(m.sims);
  for (; b < target; b++) stepListings(s, b + 1);
  s.bucket = Math.max(target, m.bucket);
  return s;
}

// Marché neuf : on rejoue 24 h pour avoir déjà des annonces et un historique à afficher
export function newMarket(now = Date.now()) {
  const stock = Object.fromEntries(RESOURCE_ORDER.map((id) => [id, targetStock(id)]));
  const hist = Object.fromEntries(RESOURCE_ORDER.map((id) => [id, []]));
  const start = bucketOf(now) - HOUR_STEPS * HIST_LEN - (bucketOf(now) % HOUR_STEPS);
  return tickMarket({ v: 2, bucket: start, stock, hist, listings: [], nextId: 1, proceeds: 0, returns: [], sales: [] }, now);
}

// Le marché du joueur mis à jour jusqu'à maintenant (sans modifier le joueur). Un ancien marché (v1) est remplacé.
export const marketOf = (player, now = Date.now()) => (player.market?.v === 2 ? tickMarket(player.market, now) : newMarket(now));

// ============================================================
// Lecture du marché
// ============================================================
export const listingsFor = (m, rid, kind = "res") => sorted(m.listings.filter((l) => l.kind === kind && l.rid === rid));
export const supplyOf = (m, id) => m.listings.reduce((n, l) => (l.kind === "res" && l.rid === id ? n + l.qty : n), 0);
export const cheapest = (m, id, { notMine = false } = {}) => listingsFor(m, id).find((l) => !(notMine && isMine(l))) || null;
// Prix du marché = annonce la moins chère (null si personne ne vend)
export const marketPrice = (m, id) => cheapest(m, id)?.unit ?? null;
export const myListings = (m) => m.listings.filter(isMine).sort((a, b) => a.exp - b.exp);
export const equipmentListings = (m) => sorted(m.listings.filter((l) => l.kind === "item"));
export const suggestedPrice = (m, id) => Math.max(1, Math.round(marketPrice(m, id) ?? refPrice(m, id)));
// Valeur d'un objet précis : un chef-d'œuvre vaut un peu plus que le même objet ordinaire
export const itemWorth = (item) => itemValue(item.id) * (isMasterwork(item) ? MASTERWORK_VALUE_RATE : 1);
export const suggestedItemPrice = (item) => Math.max(1, Math.round(itemWorth(item) * 1.15));
export const minutesLeft = (m, l) => Math.max(0, (l.exp - m.bucket) * (STEP_MS / 60000));

export function trend(m, id) {
  const h = m.hist[id] || [];
  const now = coefficient(m, id);
  const ref = h.length >= 4 ? h[h.length - 4] : h[0] ?? now;      // il y a ~3 h
  return { mult: now, change: ref ? (now - ref) / ref : 0, hist: h };
}
export const stockLabel = (m, id) => { const r = supplyOf(m, id) / targetStock(id); return r < 0.15 ? "Pénurie" : r < 0.55 ? "Rare" : r > 1.3 ? "Abondant" : "Normal"; };

// Devis d'achat : on prend les annonces de la moins chère à la plus chère (les tiennes exclues), dans la limite de l'or
export function quoteBuy(m, id, qty, gold = Infinity) {
  let left = Math.floor(qty), total = 0, n = 0;
  const lines = [];
  for (const l of listingsFor(m, id)) {
    if (isMine(l) || left < 1) continue;
    const k = Math.min(l.qty, left, Math.floor((gold - total) / l.unit));
    if (k < 1) break;                                                // les suivantes sont plus chères
    total += k * l.unit; n += k; left -= k;
    lines.push({ id: l.id, qty: k, unit: l.unit });
  }
  return { qty: n, total, lines };
}
export const maxAffordable = (m, id, gold) => quoteBuy(m, id, Infinity, gold).qty;
// Combien rapporterait une mise en vente : brut, taxe payée tout de suite, net si tout part
export function quotePost(qty, unit) {
  const gross = Math.floor(qty) * Math.floor(unit), tax = saleTax(gross);
  return { gross, tax, net: gross - tax };
}

// ============================================================
// Transactions (renvoient un nouveau joueur, jamais de modification en place)
// ============================================================
// Tes achats aux annonces de simulés : l'or leur sera versé au prochain pas du marché (`credits`)
const withCredits = (m, sales) => {
  const credits = { ...(m.credits || {}) };
  for (const [seller, gold] of sales) if (seller !== "player" && seller !== NPC) credits[seller] = (credits[seller] || 0) + gold;
  return { ...m, credits };
};

const fail = (player, reason) => ({ ok: false, reason, player, qty: 0, total: 0, gross: 0, tax: 0 });

const addResource = (res, id, q) => ({ ...res, [id]: (res[id] || 0) + q });
const takeResource = (res, id, q) => { const r = { ...res, [id]: (res[id] || 0) - q }; if (r[id] <= 0) delete r[id]; return r; };

// Encaisse ce que tes annonces ont rapporté et récupère les marchandises des annonces expirées
export function settleMarket(player, now = Date.now()) {
  const m = marketOf(player, now);
  let resources = player.resources, inventory = player.inventory;
  const returned = [];
  for (const r of m.returns) {
    if (r.kind === "res") resources = addResource(resources, r.rid, r.qty);
    else inventory = [...inventory, r.item];
    returned.push(r);
  }
  const earned = m.proceeds;
  const since = player.market?.v === 2 ? player.market.bucket : Infinity;
  const sold = m.sales.filter((x) => x.b > since);                    // ventes arrivées depuis la dernière visite
  const market = { ...m, proceeds: 0, returns: [] };
  return { player: { ...player, gold: player.gold + earned, resources, inventory, market }, earned, returned, sold };
}

export function buyFromListing(player, listingId, qty = 1, now = Date.now()) {
  const s = settleMarket(player, now), p = s.player, m = p.market;
  const l = m.listings.find((x) => x.id === listingId);
  if (!l) return fail(p, "introuvable");
  if (isMine(l)) return fail(p, "mienne");
  const n = Math.min(Math.floor(qty), l.qty, Math.floor(p.gold / l.unit));
  if (n < 1) return fail(p, p.gold < l.unit ? "or" : "aucun");
  const total = n * l.unit;                                          // aucune taxe à l'achat
  const listings = m.listings.map((x) => (x.id === l.id ? { ...x, qty: x.qty - n } : x)).filter((x) => x.qty > 0);
  const next = { ...p, gold: p.gold - total, market: withCredits({ ...m, listings }, [[l.seller, total]]) };
  if (l.kind === "res") next.resources = addResource(p.resources, l.rid, n);
  else next.inventory = [...p.inventory, { ...(l.item || ITEMS[l.rid]), uid: l.item?.uid || `mk-${l.id}-${m.bucket}` }];
  return { ok: true, qty: n, gross: total, tax: 0, total, listing: l, player: next };
}

// Achète `qty` unités d'une ressource en prenant les annonces les moins chères d'abord
export function buyCheapest(player, id, qty, now = Date.now()) {
  if (!RESOURCES[id]) return fail(player, "inconnu");
  const s = settleMarket(player, now), p = s.player, m = p.market;
  const q = quoteBuy(m, id, qty, p.gold);
  if (q.qty < 1) return fail(p, supplyOf(m, id) - supplyOf({ listings: m.listings.filter(isMine) }, id) < 1 ? "rupture" : "or");
  const take = Object.fromEntries(q.lines.map((x) => [x.id, x.qty]));
  const listings = m.listings.map((x) => (take[x.id] ? { ...x, qty: x.qty - take[x.id] } : x)).filter((x) => x.qty > 0);
  const sold = q.lines.map((x) => [m.listings.find((y) => y.id === x.id).seller, x.qty * x.unit]);
  return { ok: true, qty: q.qty, gross: q.total, tax: 0, total: q.total, player: { ...p, gold: p.gold - q.total, resources: addResource(p.resources, id, q.qty), market: withCredits({ ...m, listings }, sold) } };
}

// Met une annonce en vente à ton prix. spec : { kind:"res", rid, qty, unit } ou { kind:"item", uid, unit }
export function postListing(player, spec, now = Date.now()) {
  const s = settleMarket(player, now), p = s.player, m = p.market;
  const unit = Math.floor(spec.unit);
  if (!(unit >= 1) || unit > MAX_UNIT_PRICE) return fail(p, "prix");
  if (m.listings.filter(isMine).length >= MAX_PLAYER_LISTINGS) return fail(p, "limite");
  let listing, goods;
  if (spec.kind === "item") {
    const item = p.inventory.find((i) => i.uid === spec.uid);
    if (!item) return fail(p, "aucun");
    listing = { id: m.nextId, seller: "player", kind: "item", rid: item.id, item, qty: 1, unit, exp: m.bucket + LISTING_STEPS };
    goods = { inventory: p.inventory.filter((i) => i.uid !== spec.uid) };
  } else {
    if (!RESOURCES[spec.rid]) return fail(p, "inconnu");
    const have = p.resources[spec.rid] || 0, qty = Math.min(Math.floor(spec.qty), have);
    if (!(qty >= 1)) return fail(p, "aucun");
    listing = { id: m.nextId, seller: "player", kind: "res", rid: spec.rid, qty, unit, exp: m.bucket + LISTING_STEPS };
    goods = { resources: takeResource(p.resources, spec.rid, qty) };
  }
  const gross = listing.qty * unit, tax = saleTax(gross);
  if (tax > p.gold) return fail(p, "taxe");
  return { ok: true, qty: listing.qty, gross, tax, total: gross - tax, listing, player: { ...p, ...goods, gold: p.gold - tax, market: { ...m, nextId: m.nextId + 1, listings: [...m.listings, listing] } } };
}

// Retire une de tes annonces : la marchandise revient, la taxe payée reste payée
export function cancelListing(player, listingId, now = Date.now()) {
  const s = settleMarket(player, now), p = s.player, m = p.market;
  const l = m.listings.find((x) => x.id === listingId);
  if (!l || !isMine(l)) return fail(p, "introuvable");
  const next = { ...p, market: { ...m, listings: m.listings.filter((x) => x.id !== l.id) } };
  if (l.kind === "res") next.resources = addResource(p.resources, l.rid, l.qty);
  else next.inventory = [...p.inventory, l.item];
  return { ok: true, qty: l.qty, gross: 0, tax: 0, total: 0, listing: l, player: next };
}
