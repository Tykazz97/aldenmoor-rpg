// Sac du joueur (capacité en emplacements) :  node scripts/test-bag.js
import assert from "node:assert/strict";
import {
  BAG_START, BAG_STEP, BAG_UPGRADES, bagCapacity, bagUsed, bagFree, bagFull, nextBagCost, upgradeBag, bagGuard, roomFor, fitRewards, hasLost, resTypes, grandfatherBag,
} from "../src/utils/bag.js";
import { applyRewards } from "../src/utils/progression.js";
import { applyCraft } from "../src/utils/crafting.js";
import { buyFromListing, buyCheapest, postListing, cancelListing, marketOf } from "../src/utils/market.js";
import { depositItem, withdrawItem, depositResource, withdrawResource } from "../src/utils/bank.js";
import { RESOURCE_ORDER } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { createPlayer, repairPlayer } from "../src/utils/newPlayer.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Sac");

const T0 = Date.UTC(2026, 10, 8, 12, 0, 0);
const it = (uid, id = Object.keys(ITEMS)[0]) => ({ ...ITEMS[id], uid });
const fill = (p, k) => ({ ...p, inventory: Array.from({ length: k }, (_, i) => it(`f${i}`)) });                       // k objets
const withRes = (p, ids) => ({ ...p, resources: Object.fromEntries(ids.map((id) => [id, 5])) });
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 100000, inventory: [], resources: {}, ...extra });

test("un sac neuf a 40 emplacements ; objets et types de ressources comptent, pas la quantité ni l'équipement", () => {
  const p = base();
  assert.equal(BAG_START, 40); assert.equal(bagCapacity(p), 40); assert.equal(bagUsed(p), 0); assert.equal(bagFree(p), 40);
  const q = { ...fill(p, 3), resources: { [RESOURCE_ORDER[0]]: 500, [RESOURCE_ORDER[1]]: 1, [RESOURCE_ORDER[2]]: 0 }, equipped: { ...p.equipped, arme: it("w") } };
  assert.equal(resTypes(q), 2); assert.equal(bagUsed(q), 5, "3 objets + 2 types (une pile vide ne compte pas)"); assert.equal(bagFree(q), 35);
  assert.equal(bagFull(fill(p, 40)), true); assert.equal(bagFull(fill(p, 39)), false);
});

test("agrandir : prix croissants, +5 emplacements, plafond de 80", () => {
  let p = base({ gold: 1e6 });
  assert.equal(nextBagCost(p), BAG_UPGRADES[0]);
  assert.equal(upgradeBag({ ...p, gold: BAG_UPGRADES[0] - 1 }).bagUpgrades, undefined, "pas assez d'or : rien ne change");
  for (let i = 0; i < BAG_UPGRADES.length; i++) {
    const gold = p.gold; p = upgradeBag(p);
    assert.equal(p.gold, gold - BAG_UPGRADES[i]); assert.equal(bagCapacity(p), BAG_START + BAG_STEP * (i + 1));
  }
  assert.equal(bagCapacity(p), 80); assert.equal(nextBagCost(p), null);
  assert.equal(upgradeBag(p), p, "taille maximale");
  assert.ok(BAG_UPGRADES.every((c, i) => i === 0 || c > BAG_UPGRADES[i - 1]));
});

test("bagGuard : refuse ce qui demande une place qu'il n'y a pas, laisse passer le reste, n'ampute jamais", () => {
  const full = fill(base(), 40);
  assert.equal(bagGuard(full, { ...full, inventory: [...full.inventory, it("x")] }), full, "41e objet refusé");
  const one = fill(base(), 39), more = { ...one, inventory: [...one.inventory, it("x")] };
  assert.equal(bagGuard(one, more), more, "le 40e passe");
  const same = { ...full, inventory: full.inventory.map((i, k) => (k ? i : it("swap"))) };
  assert.equal(bagGuard(full, same), same, "échange à égalité : permis");
  const over = fill(base(), 45);
  assert.equal(bagGuard(over, { ...over, inventory: over.inventory.slice(1) }).inventory.length, 44, "un sac qui déborde peut se vider");
  assert.equal(bagGuard(over, { ...over, inventory: [...over.inventory, it("y")] }), over, "mais pas se remplir davantage");
  assert.equal(over.inventory.length, 45, "rien n'est retiré de force");
});

test("roomFor : une pile entièrement consommée libère son emplacement", () => {
  const ids = RESOURCE_ORDER.slice(0, 40), p = withRes(base(), ids);               // 40 types : plein
  assert.equal(bagFull(p), true);
  assert.equal(roomFor(p, { newItems: 1 }), false);
  assert.equal(roomFor(p, { newItems: 1, consumes: { [ids[0]]: 5 } }), true, "la pile de 5 consommée entièrement libère une place");
  assert.equal(roomFor(p, { newItems: 1, consumes: { [ids[0]]: 2 } }), false, "il en reste : pas de place");
  assert.equal(roomFor(p, { produces: [ids[3]] }), true, "ajouter à une pile existante ne coûte rien");
  assert.equal(roomFor(p, { produces: [RESOURCE_ORDER[50]] }), false, "un nouveau type, si");
});

test("butin : les piles existantes sont toujours rangées, puis équipements, puis nouveaux types ; le reste est perdu", () => {
  const ids = RESOURCE_ORDER.slice(0, 38), p = withRes(base(), ids);               // 38 / 40
  const f = fitRewards(p, { [ids[0]]: 3, [RESOURCE_ORDER[50]]: 2, [RESOURCE_ORDER[51]]: 4 }, [Object.keys(ITEMS)[0], Object.keys(ITEMS)[1]]);
  assert.equal(f.resources[ids[0]], 3, "pile existante : toujours");
  assert.equal(f.items.length, 2, "les deux équipements prennent les deux dernières places");
  assert.deepEqual(f.lost.resources, { [RESOURCE_ORDER[50]]: 2, [RESOURCE_ORDER[51]]: 4 });
  assert.equal(hasLost(f.lost), true);
  const roomy = fitRewards(base(), { [RESOURCE_ORDER[0]]: 3 }, [Object.keys(ITEMS)[0]]);
  assert.equal(hasLost(roomy.lost), false);
});

test("récompenses de combat : sac plein, l'or et l'xp restent, l'objet et le nouveau type de ressource sont perdus", () => {
  const p = fill(base({ gold: 0 }), 40), id = Object.keys(ITEMS)[1];
  const r = applyRewards(p, { xp: 10, gold: 50, resources: { [RESOURCE_ORDER[0]]: 4 }, items: [id], kills: {} });
  assert.equal(r.player.gold, 50); assert.equal(r.player.inventory.length, 40); assert.equal(r.player.resources[RESOURCE_ORDER[0]], undefined);
  assert.equal(r.lost.items[0], id); assert.equal(r.lost.resources[RESOURCE_ORDER[0]], 4);
  const ok = applyRewards(fill(base(), 5), { xp: 0, gold: 0, resources: { [RESOURCE_ORDER[0]]: 4 }, items: [id], kills: {} });
  assert.equal(ok.player.inventory.length, 6); assert.equal(ok.player.resources[RESOURCE_ORDER[0]], 4); assert.equal(hasLost(ok.lost), false);
});

test("fabrication : un sac plein bloque l'objet, sauf si les ingrédients libèrent une place", () => {
  const itemId = Object.keys(RECIPES)[0], rec = RECIPES[itemId];
  const ingredients = Object.keys(rec.ingredients);
  const prof = Object.fromEntries(["forgeron", "tailleur", "cordonnier", "bijoutier", "bricoleur", "alchimiste"].map((k) => [k, { level: 99, xp: 0 }]));
  let p = base({ gold: 1e6, professions: { ...base().professions, ...prof } });
  p = { ...p, resources: Object.fromEntries(ingredients.map((id) => [id, rec.ingredients[id]])) };       // juste ce qu'il faut
  const fullOfItems = { ...p, inventory: Array.from({ length: 40 - ingredients.length }, (_, i) => it(`f${i}`)) };
  const crafted = bagGuard(fullOfItems, applyCraft(fullOfItems, itemId, "u1", () => 0.999));
  assert.equal(crafted.inventory.length, fullOfItems.inventory.length + 1, "les piles consommées libèrent assez de place");
  const blocked = { ...fullOfItems, resources: { ...fullOfItems.resources, [RESOURCE_ORDER.find((r) => !ingredients.includes(r))]: 1 }, inventory: [...fullOfItems.inventory, it("z")] };
  const after = applyCraft(blocked, itemId, "u2", () => 0.999);
  assert.ok(after !== blocked, "la fabrication elle-même est possible");
  if (bagUsed(after) > bagCapacity(after) && bagUsed(after) > bagUsed(blocked)) assert.equal(bagGuard(blocked, after), blocked);
});

test("coffre : retirer un objet ou une ressource d'un type nouveau demande une place libre", () => {
  const ids = RESOURCE_ORDER.slice(0, 40);
  let p = withRes(base(), ids);
  p = depositResource(p, ids[0], Infinity);                                          // 19 types dans le sac, 1 au coffre
  assert.equal(p.resources[ids[0]], undefined);
  const full = { ...p, resources: { ...p.resources, [RESOURCE_ORDER[40]]: 1 } };       // de nouveau plein
  assert.equal(bagFull(full), true);
  assert.equal(bagGuard(full, withdrawResource(full, ids[0], 1)), full, "nouveau type : refusé");
  const withItem = { ...p, inventory: [it("a")] };                                  // 19 types + 1 objet = plein
  assert.equal(bagFull(withItem), true);
  const q = depositItem(withItem, "a");
  assert.equal(bagFree(q), 1);
  assert.equal(bagGuard(q, withdrawItem(q, "a")).inventory.length, 1, "avec une place libre : permis");
  assert.equal(bagGuard(withItem, { ...withItem, inventory: [...withItem.inventory, it("b")] }), withItem, "sac plein : un autre objet est refusé");
});

test("marché : acheter ou reprendre une annonce avec un sac plein est refusé (raison sac_plein)", () => {
  let p = { ...base({ gold: 1e6 }), market: marketOf(base(), T0) };
  const listing = p.market.listings.find((l) => l.kind === "res" && l.seller !== "player");
  const full = { ...p, resources: Object.fromEntries(RESOURCE_ORDER.filter((r) => r !== listing.rid).slice(0, 40).map((r) => [r, 1])) };
  assert.equal(bagFull(full), true);
  const r = buyFromListing(full, listing.id, 1, T0);
  assert.equal(r.ok, false); assert.equal(r.reason, "sac_plein");
  assert.equal(buyCheapest(full, listing.rid, 1, T0).reason, "sac_plein");
  const ok = buyFromListing({ ...full, resources: { ...full.resources, [listing.rid]: 1 } }, listing.id, 1, T0);
  assert.equal(ok.ok, true, "une pile qu'on a déjà : aucune place requise");
  // reprendre sa propre annonce d'objet
  const own = { ...p, inventory: [it("mine")] };
  const posted = postListing(own, { kind: "item", uid: "mine", unit: 100 }, T0);
  assert.ok(posted.ok);
  const stuffed = { ...posted.player, inventory: Array.from({ length: 40 }, (_, i) => it(`f${i}`)) };
  assert.equal(cancelListing(stuffed, posted.listing.id, T0).reason, "sac_plein");
  assert.equal(cancelListing(posted.player, posted.listing.id, T0).ok, true);
});

test("ancienne sauvegarde : pas de bagUpgrades = 40 emplacements ; un sac qui déborde reste intact", () => {
  const old = { ...base() }; delete old.bagUpgrades;
  assert.equal(bagCapacity(old), 40);
  const big = fill(base(), 60);
  assert.equal(bagUsed(big), 60); assert.equal(bagFree(big), -20); assert.equal(bagFull(big), true);
});

test("sauvegardes déjà pleines et mode test : agrandi sans frais pour tout contenir, rien n'est retiré", () => {
  const big = fill(base(), 53), fixed = repairPlayer(big);
  assert.equal(fixed.inventory.length, 53); assert.ok(bagCapacity(fixed) >= 53); assert.equal(bagCapacity(fixed), 55, "juste ce qu'il faut, par paliers de 5");
  assert.equal(fixed.gold, big.gold, "gratuit");
  assert.equal(fixed.bagUpgrades, 3); assert.equal(repairPlayer(fixed).bagUpgrades, 3, "relire ne rajoute rien");
  assert.equal(grandfatherBag(base()).bagUpgrades, undefined, "un sac qui tient n'est pas touché");
  assert.equal(repairPlayer({ ...base(), bagUpgrades: "x" }).bagUpgrades, undefined, "valeur abîmée : ignorée");
  const t = createPlayer({ classKey: "guerrier", testMode: true });
  assert.ok(bagFree(t) >= 60, "le perso de test peut tout recevoir");
  assert.equal(bagCapacity(createPlayer({ classKey: "guerrier" })), 40);
});

console.log(`\n${n} tests OK`);
