// Réparation des sauvegardes anciennes ou abîmées :  node scripts/test-repair.js
import assert from "node:assert/strict";
import { createPlayer, repairPlayer, modernizeImages } from "../src/utils/newPlayer.js";
import { ITEMS } from "../src/data/items.js";
import { marketOf, newMarket } from "../src/utils/market.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Réparation des sauvegardes");

test("une sauvegarde saine ressort identique", () => {
  const p = createPlayer({ name: "Aldric", classKey: "guerrier", testMode: true });
  assert.deepEqual(repairPlayer(p), p);
});

test("champs manquants : coffre, ressources, métiers, caractéristiques, équipement", () => {
  const p = createPlayer({ name: "Aldric", classKey: "magicien" });
  const old = { ...p, gold: 42 }; delete old.bank; delete old.resources; delete old.caracs; delete old.equipped; old.professions = { forgeron: p.professions.forgeron };
  const r = repairPlayer(old);
  assert.equal(r.gold, 42);
  assert.deepEqual(r.bank, { items: [], resources: {} });
  assert.deepEqual(r.resources, {});
  assert.ok(r.caracs && r.equipped && Object.keys(r.professions).length === Object.keys(p.professions).length);
});

test("objets sans identifiant retirés du sac, valeurs absurdes remplacées", () => {
  const p = createPlayer({ name: "A", classKey: "assassin" });
  const r = repairPlayer({ ...p, inventory: [null, { uid: "x" }, { id: "epee_milicien", uid: "y" }], gold: NaN, level: "9" });
  assert.equal(r.inventory.length, 1);
  assert.equal(r.gold, 0);
  assert.equal(r.level, 1);
});

test("marché abîmé : complété, les annonces du joueur sont gardées", () => {
  const now = Date.now(), base = newMarket(now);
  const mine = { id: 9999, seller: "player", kind: "res", rid: base.listings[0].rid, qty: 3, unit: 5, exp: base.bucket + 10000 };
  const m = marketOf({ market: { ...base, listings: [...base.listings, mine], stock: {}, hist: {}, returns: undefined, sales: undefined } }, now);
  assert.ok(m.listings.some((l) => l.id === 9999), "l'annonce du joueur est conservée");
  assert.ok(Object.keys(m.stock).length > 0 && Array.isArray(m.returns) && Array.isArray(m.sales));
  assert.equal(marketOf({ market: { v: 1, junk: true } }, now).v, 2);
  assert.equal(marketOf({}, now).v, 2);
});

test("images : les objets d'une ancienne sauvegarde (chemins .png supprimés à la conversion en WebP) retrouvent leur image", () => {
  const p = createPlayer({ name: "Aldric", classKey: "guerrier", testMode: true });
  const png = (id) => ({ ...ITEMS[id], img: ITEMS[id].img.replace(/\.webp$/, ".png") });
  const old = { ...p, inventory: [png("epee_milicien"), { id: "objet_disparu", img: "/assets/icons/items/x/objet_disparu.png" }], equipped: { ...p.equipped, arme: png("masse_rouillee") },
    bank: { ...p.bank, items: [png("chapeau_veteran")] }, market: { listings: [{ id: 1, item: png("arc_chasse") }], sims: { lives: { a: { gear: { arme: "epee_milicien" } } } } } };
  const r = repairPlayer(old);
  assert.equal(r.inventory[0].img, ITEMS.epee_milicien.img, "sac");
  assert.equal(r.inventory[1].img, "/assets/icons/items/x/objet_disparu.webp", "objet inconnu : .webp");
  assert.equal(r.equipped.arme.img, ITEMS.masse_rouillee.img, "équipement");
  assert.equal(r.bank.items[0].img, ITEMS.chapeau_veteran.img, "coffre");
  assert.equal(r.market.listings[0].item.img, ITEMS.arc_chasse.img, "annonces");
  assert.ok(!JSON.stringify(r).includes(".png"), "plus aucun .png");
  assert.equal(r.market.sims, old.market.sims, "ce qui n'a pas à changer garde son objet");
  assert.equal(modernizeImages(p), p, "une sauvegarde saine : le même objet");
  assert.equal(repairPlayer(r).inventory[0], r.inventory[0], "relire ne change rien");
});

console.log(`\n${n} tests OK`);
