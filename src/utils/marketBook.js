// ============================================================
// HÔTEL DES VENTES — logique d'affichage (pas de React) : catégories, fiches d'objets, prix par lot, emplacements.
// Le marché lui-même (annonces, prix, taxe) est dans market.js ; ici on ne fait que le présenter façon « hôtel des ventes » :
// un catalogue par catégorie, des prix pour 1 / 10 / 100, et le détail des offres de chaque objet.
// ============================================================
import { RESOURCES, RESOURCE_ORDER } from "../data/resources.js";
import { ITEMS, ITEM_ORDER } from "../data/items.js";
import { weaponLabel } from "./gearbook.js";
import { listingSlots, nextSlotLevel, slotUnlockLevel, MAX_PLAYER_LISTINGS, myListings, listingsFor, equipmentListings, isMine, quoteBuy, supplyOf } from "./market.js";

export const LOTS = [1, 10, 100];

// ---------- catégories ----------
export const CATEGORIES = [
  { key: "tout", label: "Tout", group: null },
  { key: "r_recolte", label: "Récoltes", group: "Ressources" },
  { key: "r_raffine", label: "Matériaux raffinés", group: "Ressources" },
  { key: "r_butin", label: "Butin de monstres", group: "Ressources" },
  { key: "r_eclat", label: "Éclats et trouvailles", group: "Ressources" },
  { key: "r_potion", label: "Potions", group: "Ressources" },
  { key: "e_arme", label: "Armes", group: "Équipement" },
  { key: "e_bouclier", label: "Boucliers", group: "Équipement" },
  { key: "e_chapeau", label: "Chapeaux", group: "Équipement" },
  { key: "e_plastron", label: "Plastrons", group: "Équipement" },
  { key: "e_gants", label: "Gants", group: "Équipement" },
  { key: "e_ceinture", label: "Ceintures", group: "Équipement" },
  { key: "e_jambieres", label: "Jambières", group: "Équipement" },
  { key: "e_cape", label: "Capes", group: "Équipement" },
  { key: "e_anneau", label: "Anneaux", group: "Équipement" },
  { key: "e_amulette", label: "Amulettes", group: "Équipement" },
  { key: "e_relique", label: "Reliques", group: "Équipement" },
];
export const GROUPS = ["Ressources", "Équipement"];
export const categoriesOf = (group) => CATEGORIES.filter((c) => c.group === group);

export function resourceCategory(id) {
  const r = RESOURCES[id];
  if (!r) return null;
  if (r.crafted || r.source === "alchimie") return "r_potion";
  if (r.source === "recolte") return "r_recolte";
  if (r.source === "raffinage") return "r_raffine";
  if (r.source === "amelioration" || r.source === "trouvaille") return "r_eclat";
  return "r_butin";
}
export function itemCategory(item) {
  if (!item?.type || item.type === "cle") return null;
  return item.type.startsWith("relique") ? "e_relique" : `e_${item.type}`;
}
const inCategory = (key, cat) => cat === "tout" || cat === key || (cat === "g_Ressources" && key?.startsWith("r_")) || (cat === "g_Équipement" && key?.startsWith("e_"));
export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;

// ---------- fiche d'un objet à vendre ou à acheter ----------
export const refOf = (kind, id) => (kind === "item" ? ITEMS[id] : RESOURCES[id]);
const fr = (a, b) => a.name.localeCompare(b.name, "fr");
export const matches = (name, query) => !query?.trim() || name.toLowerCase().includes(query.trim().toLowerCase());

// Prix pour un lot de `qty` unités au meilleur prix (les annonces du joueur ne comptent pas) : { qty, total, unit } ou null s'il n'y en a pas assez
export function lotPrice(m, id, qty) {
  const q = quoteBuy(m, id, qty);
  return q.qty >= qty ? { qty, total: q.total, unit: q.total / qty } : null;
}

// Le catalogue de l'onglet Acheter : une ligne par objet. Ressources : tous les types ; équipements : ceux qui sont en vente.
// onlyOffers : ne garde que ce qui a au moins une offre d'un autre vendeur.
export function buyCatalog(m, { category = "tout", query = "", onlyOffers = true } = {}) {
  const rows = [];
  for (const id of RESOURCE_ORDER) {
    const r = RESOURCES[id], cat = resourceCategory(id);
    if (!inCategory(cat, category) || !matches(r.name, query)) continue;
    const offers = listingsFor(m, id).filter((l) => !isMine(l));
    if (onlyOffers && offers.length === 0) continue;
    rows.push({ kind: "res", id, name: r.name, img: r.img, rarity: r.rarity, category: cat, offers, supply: offers.reduce((n, l) => n + l.qty, 0), best: offers[0]?.unit ?? null, lots: LOTS.map((q) => lotPrice(m, id, q)) });
  }
  const byItem = new Map();
  for (const l of equipmentListings(m)) { if (!isMine(l)) (byItem.get(l.rid) || byItem.set(l.rid, []).get(l.rid)).push(l); }
  for (const id of ITEM_ORDER) {
    const it = ITEMS[id], cat = itemCategory(it);
    if (!cat || !inCategory(cat, category) || !matches(it.name, query)) continue;
    const offers = byItem.get(id) || [];
    if (offers.length === 0) continue;
    rows.push({ kind: "item", id, name: it.name, img: it.img, rarity: it.rarity, category: cat, offers, supply: offers.length, best: offers[0].unit, lots: [{ qty: 1, total: offers[0].unit, unit: offers[0].unit }, null, null] });
  }
  const order = (r) => (r.kind === "res" ? 0 : 1);
  return rows.sort((a, b) => order(a) - order(b) || (a.supply === 0) - (b.supply === 0) || fr(a, b));
}

// Nombre d'objets ayant une offre, par catégorie (pour les pastilles de la liste de gauche)
export function offerCounts(m) {
  const counts = { tout: 0 };
  for (const r of buyCatalog(m, { onlyOffers: true })) { counts[r.category] = (counts[r.category] || 0) + 1; counts.tout += 1; }
  for (const g of GROUPS) counts[`g_${g}`] = categoriesOf(g).reduce((n, c) => n + (counts[c.key] || 0), 0);
  return counts;
}

// Ce que le joueur peut mettre en vente : ressources du sac et équipements du sac (pas ceux qu'il porte)
export function sellCatalog(player, { category = "tout", query = "" } = {}) {
  const rows = [];
  for (const id of RESOURCE_ORDER) {
    const have = player.resources?.[id] || 0;
    if (have < 1) continue;
    const r = RESOURCES[id], cat = resourceCategory(id);
    if (inCategory(cat, category) && matches(r.name, query)) rows.push({ kind: "res", id, key: id, name: r.name, img: r.img, rarity: r.rarity, category: cat, have });
  }
  for (const it of player.inventory || []) {
    const cat = itemCategory(it);
    if (cat && inCategory(cat, category) && matches(it.name, query)) rows.push({ kind: "item", id: it.id, key: it.uid, name: it.name, img: it.img, rarity: it.rarity, category: cat, have: 1, item: it });
  }
  return rows.sort((a, b) => (a.kind === "res" ? 0 : 1) - (b.kind === "res" ? 0 : 1) || fr(a, b));
}

export const weaponKind = (item) => (item?.type === "arme" ? weaponLabel(item) : null);

// ---------- emplacements de vente ----------
// used / total au niveau du joueur, et la liste des emplacements (occupés, libres, à débloquer) jusqu'au maximum
export function slotBoard(player, m) {
  const mine = myListings(m), total = listingSlots(player.level);
  const slots = [];
  for (let i = 0; i < MAX_PLAYER_LISTINGS; i++) {
    if (i < mine.length) slots.push({ n: i + 1, state: "used", listing: mine[i] });
    else if (i < total) slots.push({ n: i + 1, state: "free" });
    else slots.push({ n: i + 1, state: "locked", level: slotUnlockLevel(i + 1) });
  }
  return { used: mine.length, total, free: Math.max(0, total - mine.length), next: nextSlotLevel(player.level), slots };
}

export { supplyOf };
