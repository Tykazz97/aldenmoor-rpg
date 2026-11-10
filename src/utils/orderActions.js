// ============================================================
// Commandes d'artisanat : ce que le JOUEUR peut faire (sans React). La mécanique des simulés est dans orders.js.
//   postOrder    : tu commandes une pièce à un artisan : les ingrédients et le salaire partent en séquestre
//   cancelOrder  : tu retires ta commande, tout te revient
//   acceptOrder  : tu es l'artisan : tu fabriques la pièce d'un simulé avec SES ingrédients, tu touches le salaire et tu gagnes l'xp
// Les pièces fabriquées pour toi arrivent comme les ventes de l'hôtel des ventes : au prochain settleMarket (marchandise à récupérer).
// ============================================================
import { settleMarket } from "./market.js";
import { ORDER_STEPS, MAX_PLAYER_ORDERS, MAX_ORDER_FEE, FREE_GOLD, simCity, workshopTax, orderInfo } from "./orders.js";
import { recordTax } from "./cityTax.js";
import { applyCraft, professionOf } from "./crafting.js";
import { tarifFor, withWorkshop, workshopOf, CRAFT_PROFESSIONS } from "./workshop.js";

const fail = (player, reason) => ({ ok: false, reason, player });
export const myOrders = (m) => (m.orders || []).filter((o) => o.client === "player");
// Les commandes que tu peux prendre : celles ouvertes à tous, et celles qu'on t'adresse (les autres sont réservées à leur artisan)
export const openOrders = (m) => (m.orders || []).filter((o) => o.client !== "player" && (!o.crafter || o.crafter === "player"));
export const orderMinutesLeft = (m, o) => Math.max(0, (o.exp - m.bucket) * 10);

// Pourquoi on ne peut pas (encore) commander cette pièce, ou null si c'est possible
// `city` : la ville où tu te trouves ({ key, rate, … } de data/cities.js) : il faut être dans la même ville que l'artisan (aujourd'hui tous les simulés sont à Aldenmoor)
export function postOrderIssue(player, itemId, fee = 1, crafter = null, city = null) {
  const info = orderInfo(itemId);
  if (!info) return "inconnu";
  if (city && city.key !== simCity()) return "ville";
  if (!player.market?.sims) return "indisponible";
  if (crafter) { const t = crafter === "player" ? null : tarifFor(player.market, crafter, itemId); if (t == null) return "artisan"; fee = t; }       // au tarif de l'annuaire
  const f = Math.floor(fee);
  if (!(f >= 1) || f > MAX_ORDER_FEE) return "prix";
  if (myOrders(player.market).length >= MAX_PLAYER_ORDERS) return "limite";
  if (Object.entries(info.mats).some(([r, q]) => (player.resources[r] || 0) < q)) return "ressources";
  if (player.gold < f) return "or";
  return null;
}

export function postOrder(player, { item, fee, crafter = null, city = null }, now = Date.now()) {
  const p = settleMarket(player, now).player, m = p.market;
  const why = postOrderIssue(p, item, fee, crafter, city);
  if (why) return fail(p, why);
  const info = orderInfo(item), f = crafter ? tarifFor(m, crafter, item) : Math.floor(fee);
  const resources = { ...p.resources };
  for (const [r, q] of Object.entries(info.mats)) { resources[r] -= q; if (resources[r] <= 0) delete resources[r]; }
  const order = { id: m.nextId, client: "player", item, mats: info.mats, fee: f, exp: m.bucket + ORDER_STEPS, city: city?.key || simCity(), ...(crafter ? { crafter } : {}) };
  return { ok: true, order, player: { ...p, resources, gold: p.gold - f, market: { ...m, nextId: m.nextId + 1, orders: [...(m.orders || []), order] } } };
}

export function cancelOrder(player, orderId, now = Date.now()) {
  const p = settleMarket(player, now).player, m = p.market;
  const o = myOrders(m).find((x) => x.id === orderId);
  if (!o) return fail(p, "introuvable");
  const resources = { ...p.resources };
  for (const [r, q] of Object.entries(o.mats)) resources[r] = (resources[r] || 0) + q;
  return { ok: true, order: o, player: { ...p, resources, gold: p.gold + o.fee, market: { ...m, orders: m.orders.filter((x) => x.id !== o.id) } } };
}

// Peux-tu fabriquer cette commande ? null si oui, sinon la raison : "ville" | "niveau" | "introuvable"
export function acceptIssue(player, order, city = null) {
  const info = order && orderInfo(order.item);
  if (!info) return "introuvable";
  if (city && city.key !== (order.city || simCity())) return "ville";                 // il faut être dans la ville du client
  if (professionOf(player, info.profession).level < info.minLevel) return "niveau";
  return null;
}

// `city` : la ville où tu te trouves ({ key, rate }) ; sa taxe d'atelier est retenue sur le salaire et inscrite à ton registre
export function acceptOrder(player, orderId, now = Date.now(), rng = Math.random, city = null) {
  const p = settleMarket(player, now).player, m = p.market;
  const o = openOrders(m).find((x) => x.id === orderId);
  if (!o) return fail(p, "introuvable");
  const why = acceptIssue(p, o, city);
  if (why) return fail(p, why);
  // on fabrique sur une copie qui ne contient que les ingrédients du client : ni ton stock ni ton sac ne sont touchés
  const temp = { ...p, resources: { ...o.mats }, inventory: [], gold: FREE_GOLD };            // seuls le niveau et les ingrédients du client comptent ; la taxe d'atelier (1 %) est retenue sur le salaire
  const after = applyCraft(temp, o.item, `ord-${o.id}`, rng);
  if (after === temp) return fail(p, "or");
  const made = after.inventory[0];
  const key = city?.key || o.city || simCity(), tax = workshopTax(o.fee, city ? city.rate : undefined);
  const next = {
    ...recordTax(after, key, tax), resources: p.resources, inventory: p.inventory, gold: p.gold + o.fee - tax,
    market: { ...m, orders: m.orders.filter((x) => x.id !== o.id), deliveries: [...(m.deliveries || []), { client: o.client, rid: o.item, back: after.resources }] },
  };
  return { ok: true, order: o, made, fee: o.fee, tax, net: o.fee - tax, xp: (after.professions[orderInfo(o.item).profession].xp || 0), player: next };
}

// --- Ton atelier (annuaire) : voir utils/workshop.js ---
// Règle un métier : { open, listed, prices: { palier: or } } ; ton niveau de métier du moment est rangé avec
export function setWorkshop(player, profession, patch, now = Date.now()) {
  if (!CRAFT_PROFESSIONS.includes(profession)) return fail(player, "inconnu");
  const p = settleMarket(player, now).player;
  return { ok: true, player: { ...p, market: withWorkshop(p.market, profession, patch, professionOf(p, profession).level) } };
}
// Met à jour ton niveau de métier dans les réglages (les simulés ne t'adressent que des pièces à ta portée) ; le même joueur s'il n'y a rien à changer
export function syncWorkshop(player) {
  const m = player.market, w = m?.workshop;
  if (!w) return player;
  let changed = false;
  const next = {};
  for (const [k, v] of Object.entries(w)) { const level = professionOf(player, k).level; if (level !== v.level) changed = true; next[k] = { ...v, level }; }
  return changed ? { ...player, market: { ...m, workshop: next } } : player;
}
export { workshopOf };
