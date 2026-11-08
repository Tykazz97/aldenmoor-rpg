// Hôtel des ventes (présentation) :  node scripts/test-marketbook.js
import assert from "node:assert/strict";
import { RESOURCES, RESOURCE_ORDER } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { newMarket, marketOf, postListing, quoteBuy, listingSlots } from "../src/utils/market.js";
import { CATEGORIES, resourceCategory, itemCategory, buyCatalog, sellCatalog, offerCounts, slotBoard, lotPrice, LOTS } from "../src/utils/marketBook.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Hôtel des ventes (présentation)");

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const m0 = newMarket(T0);

test("chaque ressource et chaque équipement (hors clés) a une catégorie connue", () => {
  const keys = new Set(CATEGORIES.map((c) => c.key));
  for (const id of RESOURCE_ORDER) assert.ok(keys.has(resourceCategory(id)), id);
  for (const it of Object.values(ITEMS)) { const c = itemCategory(it); assert.equal(c === null, it.type === "cle", it.id); if (c) assert.ok(keys.has(c), it.id); }
});

test("catalogue : une ligne par objet ; « tout » = somme des catégories ; filtre par catégorie et par nom", () => {
  const all = buyCatalog(m0, { onlyOffers: false });
  assert.equal(new Set(all.map((r) => `${r.kind}:${r.id}`)).size, all.length, "pas de doublon");
  assert.equal(all.filter((r) => r.kind === "res").length, RESOURCE_ORDER.length);
  const sum = CATEGORIES.filter((c) => c.group).reduce((s, c) => s + buyCatalog(m0, { category: c.key, onlyOffers: false }).length, 0);
  assert.equal(sum, all.length);
  assert.ok(buyCatalog(m0, { category: "r_potion" }).every((r) => r.category === "r_potion"));
  assert.deepEqual(buyCatalog(m0, { query: "croc de loup", onlyOffers: false }).map((r) => r.id).includes("croc_de_loup"), true);
  assert.equal(buyCatalog(m0, { query: "zzzzzz", onlyOffers: false }).length, 0);
});

test("seules les offres des autres comptent : l'équipement sans offre n'apparaît pas", () => {
  const eq = buyCatalog(m0, { category: "e_arme" });
  assert.ok(eq.every((r) => r.kind === "item" && r.offers.length >= 1 && r.best === r.offers[0].unit));
  for (const r of buyCatalog(m0)) if (r.kind === "res") assert.ok(r.offers.length >= 1 && r.offers.every((l) => l.seller !== "player"));
});

test("prix par lot : 1 / 10 / 100 correspondent au vrai devis d'achat, null s'il n'y en a pas assez", () => {
  const rows = buyCatalog(m0).filter((r) => r.kind === "res");
  const r = rows[0];
  LOTS.forEach((q, i) => {
    const quote = quoteBuy(m0, r.id, q);
    if (quote.qty >= q) assert.deepEqual(r.lots[i], { qty: q, total: quote.total, unit: quote.total / q });
    else assert.equal(r.lots[i], null);
  });
  assert.equal(lotPrice(m0, r.id, 10 ** 9), null);
  assert.ok(lotPrice(m0, r.id, 1).total <= (lotPrice(m0, r.id, 10)?.total ?? Infinity) / 10 + 1e-9, "le lot de 10 coûte au moins 10 fois le moins cher");
});

test("catalogue de vente : ressources et équipements du sac, pas ceux qu'on porte", () => {
  const p = { ...createPlayer({ classKey: "guerrier" }), resources: { bois_de_frene: 5, croc_de_loup: 2 }, inventory: [{ ...ITEMS.plastron_fossoyeur, uid: "a" }, { ...ITEMS.cle_manoir_englouti || ITEMS[Object.keys(ITEMS).find((k) => ITEMS[k].type === "cle")], uid: "k" }] };
  const rows = sellCatalog(p);
  assert.deepEqual(rows.map((r) => r.id).sort(), ["bois_de_frene", "croc_de_loup", "plastron_fossoyeur"].sort());
  assert.equal(sellCatalog(p, { category: "e_plastron" }).length, 1);
  assert.equal(sellCatalog(p, { query: "bois" }).length, 1);
  assert.ok(!rows.some((r) => r.id === p.equipped.arme.id), "l'arme portée n'est pas en vente");
});

test("emplacements : occupés, libres, à débloquer (avec le niveau requis)", () => {
  let p = { ...createPlayer({ classKey: "guerrier" }), gold: 5000, resources: { bois_de_frene: 50 } };
  p = { ...p, market: marketOf(p, T0) };
  p = postListing(p, { kind: "res", rid: "bois_de_frene", qty: 5, unit: 10 }, T0).player;
  const b = slotBoard(p, p.market);
  assert.equal(b.total, listingSlots(1));
  assert.deepEqual([b.used, b.free, b.next], [1, 2, 5]);
  assert.equal(b.slots.length, 12);
  assert.deepEqual(b.slots.slice(0, 4).map((s) => s.state), ["used", "free", "free", "locked"]);
  assert.equal(b.slots[3].level, 5);
  assert.equal(b.slots[11].level, 45);
});

test("compteurs de la liste de gauche : tout = ressources + équipements", () => {
  const c = offerCounts(m0);
  assert.equal(c.tout, buyCatalog(m0).length);
  assert.equal(c["g_Ressources"] + c["g_Équipement"], c.tout);
});

console.log(`\n${n} tests OK`);
