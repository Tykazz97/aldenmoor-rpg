// ============================================================
// Commandes d'artisanat (sans React) : le « service d'atelier » de Dofus.
//
// Quand une pièce de ton set demande un niveau de métier que tu n'as pas encore, tu peux la faire fabriquer par un artisan de ce
// métier qui a le niveau : tu lui confies les ingrédients et un salaire en or, il fabrique, tu récupères la pièce. L'artisan garde
// le salaire et gagne l'xp du métier (comme s'il avait fabriqué pour lui).
//   - Une commande est un dépôt en séquestre : les ingrédients ET le salaire quittent le client tout de suite (sinon elle
//     n'existe pas). Si personne ne l'accepte avant 24 h, tout est rendu au client.
//   - Elle est ouverte à tous les artisans : un simulé (de niveau suffisant, connecté, qui trouve le salaire correct) ou toi.
//   - Les simulés commandent la pièce de leur palier qu'ils ne peuvent pas fabriquer (`orderTarget`, sim/lifeCraft.js), après
//     avoir acheté les ingrédients à l'hôtel des ventes ; le salaire proposé suit leur caractère et monte après un refus.
// m.orders = [{ id, client:"player"|"sim_001", item, mats:{ressource:qty}, fee, exp, city, crafter? }]   crafter : commande adressée à un artisan de l'annuaire (utils/workshop.js)   (m = player.market, voir market.js)
// m.deliveries : livraisons à faire à un simulé quand c'est TOI l'artisan { client, rid, back } (appliquées au pas suivant)
// ============================================================
import { hash01, orderInfo, simCanCraft, wageMin } from "./orderFee.js";
export { orderFeeBase, orderInfo, simCanCraft, wageMin } from "./orderFee.js";
import { isActive } from "../sim/lives.js";
import { orderTarget, asPlayer, acquireItem } from "../sim/lifeCraft.js";
import { applyCraft } from "./crafting.js";
import { taxFee } from "./cityTax.js";
import { CITIES, cityTaxRate } from "../data/cities.js";
import { tarifFor } from "./workshop.js";
import { getPopulation } from "../sim/population.js";

export const ORDER_CFG = { enabled: true };      // faux : plus aucune commande (pour comparer, ou en cas de souci)
export const ORDER_STEPS = 144;                 // une commande reste ouverte 24 h
export const MAX_PLAYER_ORDERS = 3;
export const MAX_ORDER_FEE = 1_000_000;
export const FREE_GOLD = 1e9;                  // or fictif de la copie sur laquelle on fabrique (la taxe de fabrication habituelle n'est pas prélevée)
// Ville de l'atelier : une commande se fait entre deux personnes de la MÊME ville (la même grande région : voir data/cities.js). Tous les simulés
// vivent aujourd'hui dans l'unique ville, Aldenmoor ; `simCity` est l'endroit où brancher d'autres villes. Une commande porte `city`.
export const simCity = () => CITIES.aldenmoor.key;
// Taxe d'atelier : le taux de la ville (1 % par défaut, réglable de 0 à 5 % plus tard) appliqué au salaire de la commande, retenue sur
// ce que touche l'artisan (au moins 1 or si le taux n'est pas nul), puis inscrite au registre des taxes de la ville
export const workshopTax = (fee, rate = cityTaxRate(null, simCity())) => taxFee(fee, rate);
export const netWage = (fee, rate) => fee - workshopTax(fee, rate);
// Y a-t-il au moins un artisan (autre que `exceptId`) qui sait fabriquer cette pièce : un simulé de niveau suffisant, ou toi si ton atelier est ouvert et visible ?
// Un simulé n'achète pas d'ingrédients et ne commande pas pour une pièce que personne ne sait faire. Mémorisé par pas.
let capCache = { s: null, bucket: -1, map: new Map() };
export function hasCrafter(s, itemId, exceptId = null, bucket = s.bucket) {
  if (capCache.s !== s || capCache.bucket !== bucket) capCache = { s, bucket, map: new Map() };
  let set = capCache.map.get(itemId);
  if (!set) {
    set = new Set();
    for (const b of getPopulation()) { const l = s.sims?.lives[b.id]; if (l && simCanCraft(l, itemId)) set.add(b.id); }
    if (tarifFor(s, "player", itemId) != null) set.add("player");
    capCache.map.set(itemId, set);
  }
  return set.size > (exceptId && set.has(exceptId) ? 1 : 0);
}
// Livre la pièce au client (simulé ou toi) et lui rend les ingrédients qui n'ont pas servi
function deliver(s, client, itemId, item, back = {}, uid = "") {
  if (client === "player") {
    s.returns.push({ kind: "item", rid: itemId, item: { ...(item || {}), uid: item?.uid || uid }, from: "order" });
    for (const [rid, qty] of Object.entries(back)) if (qty > 0) s.returns.push({ kind: "res", rid, qty, from: "order" });
    return;
  }
  const life = s.sims?.lives[client];
  if (!life) return;
  if (itemId) { acquireItem(life, itemId); life.orderDone = (life.orderDone || 0) + 1; life.orderFail = 0; }
  for (const [rid, qty] of Object.entries(back)) if (qty > 0) life.bag.res[rid] = (life.bag.res[rid] || 0) + qty;
}
// Rend tout au client (commande expirée ou retirée)
function refund(s, o, bucket) {
  if (o.client === "player") {
    s.proceeds += o.fee;
    for (const [rid, qty] of Object.entries(o.mats)) s.returns.push({ kind: "res", rid, qty, from: "order" });
    return;
  }
  const life = s.sims?.lives[o.client];
  if (!life) return;
  life.gold += o.fee;
  for (const [rid, qty] of Object.entries(o.mats)) life.bag.res[rid] = (life.bag.res[rid] || 0) + qty;
  life.orderFail = (life.orderFail || 0) + 1;
  life.orderCool = bucket + 72;                // il réessaie dans 12 h, avec un salaire plus généreux
}

// Un artisan simulé fabrique la commande. Renvoie vrai si c'est fait.
function craftBySim(s, o, crafterId, rng) {
  const life = s.sims.lives[crafterId];
  const pl = { ...asPlayer(life), resources: { ...o.mats }, gold: FREE_GOLD };       // on fabrique sur une copie « riche » : seule la taxe d'atelier (1 % du salaire) est retenue
  const after = applyCraft(pl, o.item, `ord-${o.id}`, rng);
  if (after === pl) return false;
  life.gold += netWage(o.fee, cityTaxRate(null, o.city || simCity()));
  life.pro = Object.fromEntries(Object.keys(after.professions).filter((k) => k !== life.prof.key).map((k) => [k, after.professions[k]]));
  life.crafted = (life.crafted || 0) + 1;
  life.orderWages = (life.orderWages || 0) + o.fee;
  deliver(s, o.client, o.item, after.inventory[0], after.resources, `ord-${o.id}`);
  return true;
}

// Un pas de 10 minutes : livraisons en attente, expirations, artisans qui acceptent, simulés qui commandent
export function ordersStep(s, bucket, rng, population, tally) {
  const sims = s.sims;
  if (!ORDER_CFG.enabled && !(s.orders?.length || s.deliveries?.length)) return;
  s.orders = s.orders || [];
  for (const d of s.deliveries || []) deliver(s, d.client, d.rid, null, d.back);
  s.deliveries = [];

  // expiration
  s.orders = s.orders.filter((o) => {
    if (o.exp > bucket) return true;
    refund(s, o, bucket);
    return false;
  });

  // les artisans simulés acceptent (les plus anciennes commandes d'abord)
  if (s.orders.length) {
    const online = population.filter((b) => sims.lives[b.id] && isActive(b, bucket) && !(sims.busy?.[b.id] >= bucket));
    for (const o of s.orders.slice()) {
      if (o.crafter === "player" || rng() > 0.6) continue;                  // adressée à toi : elle attend ton « Fabriquer »
      const city = o.city || simCity(), cands = online.filter((b) => simCity(b.id) === city && (o.crafter ? b.id === o.crafter && simCanCraft(sims.lives[b.id], o.item) : b.id !== o.client && simCanCraft(sims.lives[b.id], o.item) && o.fee >= wageMin(b.id, o.item)));
      if (!cands.length) continue;
      const b = cands[Math.floor(rng() * cands.length)];
      if (craftBySim(s, o, b.id, rng)) { s.orders = s.orders.filter((x) => x.id !== o.id); tally(s, bucket, "orders"); }
    }
  }

  // les simulés commandent la pièce qu'ils ne savent pas fabriquer
  if (!ORDER_CFG.enabled) return;
  const busyClients = new Set(s.orders.map((o) => o.client));
  for (const b of population) {
    const life = sims.lives[b.id];
    if (!life || busyClients.has(b.id) || !isActive(b, bucket) || (life.orderCool || 0) > bucket || rng() > 0.1) continue;
    const item = orderTarget(life, b, (id) => hasCrafter(s, id, b.id, bucket));
    if (!item) continue;
    const info = orderInfo(item);
    if (!Object.entries(info.mats).every(([r, q]) => (life.bag.res[r] || 0) >= q)) continue;           // il n'a pas encore tous les ingrédients
    // un artisan choisi dans l'annuaire (au tarif qu'il affiche, les moins chers de préférence) ; après deux refus, annonce ouverte à tous
    let crafter = null, fee = Math.round(info.fee * (0.9 + 0.5 * hash01(`${b.id}:offer`)) * (1 + 0.25 * Math.min(4, life.orderFail || 0)));
    if ((life.orderFail || 0) < 2 && rng() < 0.6) {
      const cands = ["player", ...population.map((x) => x.id)].filter((id) => id !== b.id).map((id) => [id, tarifFor(s, id, item)]).filter(([, t]) => t != null && t <= life.gold);
      if (cands.length) { [crafter, fee] = rng.weighted(cands.map(([id, t]) => [[id, t], 1 / (t * t)])); }
    }
    if (life.gold < fee) continue;
    life.gold -= fee;
    for (const [r, q] of Object.entries(info.mats)) { life.bag.res[r] -= q; if (life.bag.res[r] <= 0) delete life.bag.res[r]; }
    s.orders.push({ id: s.nextId++, client: b.id, item, mats: info.mats, fee, exp: bucket + ORDER_STEPS, city: simCity(b.id), ...(crafter ? { crafter } : {}) });
    tally(s, bucket, "ordersPosted");
  }
}
