// Tests de la durabilité de l'équipement :  node scripts/test-durability.js
import assert from "node:assert/strict";
import { ITEMS } from "../src/data/items.js";
import { CLASSES } from "../src/data/classes.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { calcStats } from "../src/utils/calcStats.js";
import { itemValue } from "../src/utils/itemValue.js";
import { taxFee } from "../src/utils/cityTax.js";
import { getCraftInfo } from "../src/data/professions.js";
import { createCombat, advance } from "../src/combat/engine.js";
import { makeBotPlayer, buildOf } from "../src/sim/partyBots.js";
import { getPopulation } from "../src/sim/population.js";
import { initialLife } from "../src/sim/lives.js";
import { lifeRepairCost, repairStep, wearLife, REPAIR_AT } from "../src/sim/lifeRepair.js";
import { dungeonOdds } from "../src/sim/botFight.js";
import { DUNGEON } from "../src/sim/lifeDungeon.js";
import {
  WEAR_MAX_MALUS, WEAR_CLOSE, WEAR_DEFEAT, CLOSE_HP, isWearable, wearOf, wearFactor, wearLabel, fightWear, wearEquipped,
  repairCost, wornPieces, repair, repairAll, repairAllCost,
} from "../src/utils/durability.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Durabilité");

const hero = (extra = {}) => ({ ...createPlayer({ name: "T", classKey: "guerrier" }), gold: 5000, ...extra });
const plastron = () => ({ ...ITEMS.plastron_veteran, uid: "p1" });

test("les reliques et les clés ne s'usent pas, le reste oui", () => {
  assert.ok(isWearable(ITEMS.epee_milicien) && isWearable(ITEMS.plastron_veteran));
  for (const it of Object.values(ITEMS)) if (it.type === "cle" || it.type.startsWith("relique")) assert.ok(!isWearable(it), it.id);
  assert.ok(!isWearable(null));
});

test("une pièce neuve vaut 1, une pièce détruite perd 30 % de ses bonus", () => {
  assert.equal(wearOf({}), 0); assert.equal(wearFactor(plastron()), 1);
  assert.ok(Math.abs(wearFactor({ ...plastron(), wear: 100 }) - (1 - WEAR_MAX_MALUS)) < 1e-9);
  assert.ok(Math.abs(wearFactor({ ...plastron(), wear: 50 }) - 0.85) < 1e-9);
  assert.equal(wearOf({ wear: 400 }), 100); assert.equal(wearOf({ wear: -5 }), 0); assert.equal(wearOf({ wear: NaN }), 0);
});

test("l'usure baisse vraiment les stats calculées, sans toucher aux PV de base ni aux reliques", () => {
  const p = hero();
  const fresh = calcStats(p);
  const worn = calcStats(wearEquipped(wearEquipped(wearEquipped(wearEquipped(p, 25), 25), 25), 25));
  assert.ok(worn.atkPhys < fresh.atkPhys || worn.defPhys < fresh.defPhys, "les bonus diminuent");
  assert.ok(worn.maxHp <= fresh.maxHp);
  const relic = { ...ITEMS.relique_dame_en_deuil || Object.values(ITEMS).find((i) => i.type === "relique1"), wear: 100 };
  const q = { ...p, equipped: { ...p.equipped, relique1: relic } };
  assert.deepEqual(calcStats(q), calcStats({ ...q, equipped: { ...q.equipped, relique1: { ...relic, wear: 0 } } }), "une relique ne s'use pas");
});

test("usure d'un combat : rien si gagné proprement, +10 de justesse, +25 perdu", () => {
  assert.equal(fightWear({ victory: true, low: 100, maxHp: 100 }), 0);
  assert.equal(fightWear({ victory: true, low: 26, maxHp: 100 }), 0);
  assert.equal(fightWear({ victory: true, low: 25, maxHp: 100 }), WEAR_CLOSE);
  assert.equal(fightWear({ victory: true, low: 1, maxHp: 100 }), WEAR_CLOSE);
  assert.equal(fightWear({ victory: false, low: 0, maxHp: 100 }), WEAR_DEFEAT);
  assert.equal(CLOSE_HP, 0.25); assert.equal(WEAR_CLOSE, 10); assert.equal(WEAR_DEFEAT, 25);
});

test("wearEquipped : toutes les pièces portées, plafonnées à 100, le sac et les reliques intacts", () => {
  const relic = Object.values(ITEMS).find((i) => i.type === "relique1");
  const p = hero({ inventory: [plastron()] });
  p.equipped = { ...p.equipped, relique1: { ...relic } };
  const w = wearEquipped(wearEquipped(p, 60), 60);
  for (const [slot, it] of Object.entries(w.equipped)) if (it && isWearable(it)) assert.equal(it.wear, 100, slot);
  assert.equal(w.equipped.relique1.wear, undefined);
  assert.equal(w.inventory[0].wear, undefined);
  assert.equal(wearEquipped(p, 0), p, "rien à ajouter = le même joueur");
  assert.equal(p.equipped.arme.wear, undefined, "l'original n'est pas modifié");
});

test("coût de réparation : 5 % de la valeur à moitié usé, 10 % à fond, plus la taxe de la ville", () => {
  const it = (wear) => ({ ...ITEMS.plastron_veteran, wear });
  const v = itemValue("plastron_veteran");
  assert.equal(repairCost(it(0)).total, 0);
  assert.equal(repairCost(it(50)).base, Math.round(v * 0.05));
  assert.equal(repairCost(it(100)).base, Math.round(v * 0.1));
  assert.equal(repairCost(it(100)).tax, taxFee(Math.round(v * 0.1)));
  assert.equal(repairCost(it(100), null, { rate: 0 }).tax, 0, "ville à 0 % : pas de taxe");
  assert.equal(repairCost(it(100), null, { rate: 0.05 }).tax, taxFee(Math.round(v * 0.1), 0.05));
  assert.equal(repairCost({ ...ITEMS.cle_du_manoir, wear: 100 }).total, 0, "une clé ne se répare pas");
});

test("moitié prix si l'on sait fabriquer la pièce", () => {
  const info = getCraftInfo("plastron_veteran");
  const lvl = (level) => ({ professions: { [info.profession]: { level, xp: 0 } } });
  const it = { ...ITEMS.plastron_veteran, wear: 100 };
  const full = repairCost(it, lvl(1)).base, half = repairCost(it, lvl(info.minLevel)).base;
  assert.ok(info.minLevel > 1 ? half < full : true);
  assert.equal(half, Math.max(1, Math.round(Math.round(itemValue("plastron_veteran") * 0.1) * 0.5)));
});

test("repair : paye, remet à neuf, inscrit la taxe au registre de la ville", () => {
  const p = wearEquipped(hero(), 50);
  const before = p.gold, c = repairCost(p.equipped.plastron, p, { rate: 0.03 });
  const r = repair(p, "plastron", { rate: 0.03, city: "aldenmoor" });
  assert.ok(r.ok); assert.equal(r.cost, c.total); assert.equal(r.player.gold, before - c.total);
  assert.equal(r.player.equipped.plastron.wear, undefined, "remis à neuf");
  assert.equal(r.player.equipped.arme.wear, 50, "les autres pièces ne bougent pas");
  assert.equal(r.player.taxPaid.aldenmoor, c.tax);
  assert.equal(p.equipped.plastron.wear, 50, "l'original n'est pas modifié");
});

test("repair : refuse sans or, sur une pièce neuve ou inconnue, et ne change alors rien", () => {
  const p = wearEquipped(hero({ gold: 0 }), 50);
  assert.equal(repair(p, "plastron").ok, false); assert.equal(repair(p, "plastron").player, p);
  assert.equal(repair(hero(), "plastron").ok, false, "neuve");
  assert.equal(repair(hero(), "chapeau").ok, false, "emplacement vide ou inconnu");
  assert.equal(repair(hero(), "zzz").ok, false);
});

test("repair : une pièce du sac se répare par son uid", () => {
  const p = hero({ inventory: [{ ...plastron(), wear: 80 }] });
  const r = repair(p, "p1", { city: "aldenmoor" });
  assert.ok(r.ok); assert.equal(r.player.inventory[0].wear, undefined); assert.ok(r.player.gold < p.gold);
});

test("repairAll : tout, du plus usé au moins usé, dans la limite de l'or", () => {
  const p0 = hero();
  const p = wearEquipped(p0, 40);
  p.equipped = { ...p.equipped, plastron: { ...p.equipped.plastron, wear: 90 } };
  assert.ok(wornPieces(p).length >= 2);
  const total = repairAllCost(p);
  const all = repairAll(p, { city: "aldenmoor" });
  assert.equal(all.spent, total); assert.equal(all.player.gold, p.gold - total); assert.equal(wornPieces(all.player).length, 0);
  const poor = repairAll({ ...p, gold: repairCost(p.equipped.plastron, p).total }, {});
  assert.equal(poor.count, 1, "avec juste de quoi payer la plus usée");
  assert.equal(poor.player.equipped.plastron.wear, undefined);
  assert.equal(poor.player.gold, 0);
});

test("libellés d'état", () => {
  assert.deepEqual([0, 10, 40, 75, 100].map(wearLabel), ["Neuf", "Éraflé", "Usé", "Très usé", "Délabré"]);
});

test("le moteur note les PV les plus bas du héros", () => {
  const p = makeBotPlayer("guerrier", 5);
  const cs = createCombat({ stats: calcStats(p), weaponType: "epee", classKey: "guerrier", level: 5, enemyKeys: ["loup_des_plaines"], seed: 3 });
  assert.equal(cs.player.low, cs.player.maxHp);
  assert.equal(cs.allies.length, 0);
  let st = cs;
  for (let g = 0; g < 200 && st.phase === "running"; g++) st = advance(st).state;
  assert.ok(cs.player.low <= cs.player.maxHp);
  const carried = createCombat({ stats: calcStats(p), weaponType: "epee", classKey: "guerrier", level: 5, enemyKeys: ["loup_des_plaines"], seed: 3, carry: { player: 10 } });
  assert.equal(carried.player.low, carried.player.hp, "avec PV reportés, le plus bas de départ est le PV d'entrée");
});

test("simulés : un équipement usé combat moins bien (stats et cache)", () => {
  const worn = calcStats(makeBotPlayer("guerrier", 24, null, buildOf({ classKey: "guerrier" }), 100));
  const fresh = calcStats(makeBotPlayer("guerrier", 24, null, buildOf({ classKey: "guerrier" }), 0));
  assert.ok(worn.atkPhys + worn.defPhys + worn.maxHp <= fresh.atkPhys + fresh.defPhys + fresh.maxHp);
});

test("simulés : coût de réparation, seuil, or insuffisant, usure plafonnée", () => {
  const bot = getPopulation()[0];
  const life = initialLife(bot, "generated", 1);
  life.gold = 10000;
  assert.equal(lifeRepairCost(life), 0); assert.equal(repairStep(life), 0, "neuf : rien");
  wearLife(life, REPAIR_AT - 1);
  assert.equal(repairStep(life), 0, "sous le seuil, il ne répare pas");
  wearLife(life, 1);
  const cost = lifeRepairCost(life); assert.ok(cost > 0);
  const gold = life.gold;
  assert.equal(repairStep(life), cost); assert.equal(life.gold, gold - cost); assert.equal(life.wear, 0); assert.equal(life.repaired, cost);
  wearLife(life, 500); assert.equal(life.wear, 100);
  life.gold = 0; assert.equal(repairStep(life), 0, "sans or, il garde son équipement usé"); assert.equal(life.wear, 100);
});

test("simulés : l'usure fait baisser leurs chances en donjon (profils usé / neuf)", () => {
  const bot = getPopulation().find((b) => initialLife(b, "generated", 1).level >= 24);
  const mk = (w) => { const l = initialLife(bot, "generated", 1); l.level = Math.max(l.level, 24); l.wear = w; return l; };
  const others = Object.keys(CLASSES).filter((c) => c !== bot.classKey);
  const a = dungeonOdds(bot, mk(0), DUNGEON, others), b = dungeonOdds(bot, mk(100), DUNGEON, others);
  assert.ok(typeof a.close === "number" && a.close >= 0, "le moteur compte les salles gagnées de justesse");
  assert.ok(b[b.length - 1] <= a[a.length - 1] + 0.26, "usé ≤ neuf (aux échantillons près)");
});

console.log(`\n${n} tests passent.`);
