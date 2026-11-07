// Tests de l'amélioration de l'équipement (+1 à +3) :  node scripts/test-upgrade.js
import assert from "node:assert/strict";
import { UPGRADE_MAX, UPGRADE_STEPS, CLASS_RARE, RARE_OF_PROFESSION, SHARD_IDS } from "../src/data/upgrade.js";
import { isUpgradable, plusOf, plusFactor, itemLabel, upgradeNeeds, canUpgrade, applyUpgrade, upgradablePieces } from "../src/utils/upgrade.js";
import { calcStats } from "../src/utils/calcStats.js";
import { itemWorth } from "../src/utils/market.js";
import { itemStatLines } from "../src/utils/itemText.js";
import { makeBotPlayer } from "../src/sim/partyBots.js";
import { ITEMS } from "../src/data/items.js";
import { RESOURCES } from "../src/data/resources.js";
import { ENEMIES } from "../src/data/zones.js";
import { CLASSES } from "../src/data/classes.js";
import { rareFindChance, rollRareFind } from "../src/utils/perks.js";
import { nextUpgrade, upgradeStep, upgradeShopping, plusBucket } from "../src/sim/lifeUpgrade.js";
import { acquireItem, tierGear, stashPlus, PLUS_STOCK_MAX, scoreWithPlus } from "../src/sim/lifeCraft.js";
import { getPopulation } from "../src/sim/population.js";
import { SIM_START } from "../src/sim/config.js";
import { enableSimMarket, newMarket, tickMarket, buyFromListing } from "../src/utils/market.js";

const T0 = Date.UTC(2027, 0, 4, 12), DAY = 86400000;
import { emptyBag } from "../src/sim/lives.js";
import { emptyQuests } from "../src/sim/lifeQuests.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Amélioration de l'équipement");

const hero = (classKey = "guerrier", extra = {}) => ({ ...makeBotPlayer(classKey, 30), gold: 1e6, resources: {}, inventory: [], ...extra });
const stocked = (classKey, p = hero(classKey)) => ({ ...p, resources: { eclat_brut: 9, eclat_dense: 9, eclat_pur: 9, [CLASS_RARE[classKey]]: 20 } });

test("les données : éclats et ressources rares existent, chaque classe a sa ressource, chaque métier de récolte aussi", () => {
  for (const id of [...SHARD_IDS, ...Object.values(CLASS_RARE)]) assert.ok(RESOURCES[id], id);
  assert.deepEqual(Object.keys(CLASS_RARE).sort(), Object.keys(CLASSES).sort());
  assert.equal(new Set(Object.values(CLASS_RARE)).size, 3);
  assert.equal(UPGRADE_STEPS.length, UPGRADE_MAX);
  assert.deepEqual(Object.values(CLASS_RARE).sort(), Object.values(RARE_OF_PROFESSION).sort());
});

test("les éclats tombent : zone (brut), boss de zone (dense), donjon (pur)", () => {
  const dropped = (id) => Object.values(ENEMIES).filter((e) => (e.drops || []).some((d) => d.id === id));
  assert.ok(dropped("eclat_brut").length >= 6 && dropped("eclat_brut").every((e) => !e.miniBoss && !e.dungeon), "éclat brut sur les monstres de zone");
  assert.ok(dropped("eclat_dense").every((e) => e.miniBoss), "éclat dense : seulement les boss");
  assert.ok(dropped("eclat_dense").length >= 3);
  assert.ok(dropped("eclat_pur").every((e) => e.dungeon) && dropped("eclat_pur").length >= 2, "éclat pur : donjon");
});

test("+10 % par niveau sur les stats, sauf chance de butin et vitesse", () => {
  const w = ITEMS.epee_de_fer || Object.values(ITEMS).find((i) => i.type === "arme" && i.atk_phys > 20);
  const base = { classKey: "guerrier", level: 30, baseHp: 100, caracs: { force: 10 }, equipped: { arme: w } };
  const s0 = calcStats(base).atkPhys;
  for (let k = 1; k <= 3; k++) {
    const s = calcStats({ ...base, equipped: { arme: { ...w, plus: k } } }).atkPhys;
    assert.equal(s - s0, Math.round(w.atk_phys * (1 + 0.1 * k)) - w.atk_phys, `+${k}`);
    assert.ok(s > s0);
  }
  assert.equal(plusFactor({ ...w, plus: 9 }), 1.3, "plafonné à +3");
  const lines = itemStatLines({ ...w, plus: 3 }).join(" ");
  assert.ok(lines.includes(String(Math.round(w.atk_phys * 1.3))), lines);
});

test("pas d'amélioration sur les reliques ni les clés ; le libellé porte le +N", () => {
  assert.equal(isUpgradable({ type: "relique1" }), false);
  assert.equal(isUpgradable({ type: "cle" }), false);
  assert.equal(isUpgradable(null), false);
  assert.equal(upgradeNeeds({ id: "x", type: "relique2" }, "guerrier"), null);
  const w = ITEMS.epee_de_fer || Object.values(ITEMS).find((i) => i.type === "arme");
  assert.equal(itemLabel({ ...w, plus: 2 }), `${w.name} +2`);
  assert.equal(itemLabel(w), w.name);
});

test("coût : éclat du palier, ressource rare de la classe, or croissant, taxe à 1 % par défaut", () => {
  const w = ITEMS.plastron_veteran;
  let prev = 0;
  UPGRADE_STEPS.forEach((st, k) => {
    const nd = upgradeNeeds({ ...w, plus: k }, "guerrier");
    assert.equal(nd.to, k + 1);
    assert.equal(nd.shard, st.shard);
    assert.equal(nd.rare, "veine_d_acier");
    assert.equal(nd.rareQty, st.rareQty);
    assert.ok(nd.gold > prev, "l'or monte à chaque niveau"); prev = nd.gold;
    assert.equal(nd.total, nd.gold + nd.tax);
    assert.ok(nd.tax >= 1);
  });
  assert.equal(upgradeNeeds({ ...w, plus: 3 }, "guerrier"), null);
  assert.equal(upgradeNeeds(w, "magicien").rare, "petale_d_ame");
  assert.equal(upgradeNeeds(w, "assassin").rare, "seve_d_ambre");
});

test("améliorer : paie or + éclats + rare, la taxe est inscrite à la ville, +1 puis +2 puis +3, jamais au-delà", () => {
  let p = stocked("guerrier");
  const g0 = p.gold;
  const r1 = applyUpgrade(p, "arme", { city: "aldenmoor" });
  assert.ok(r1.ok); p = r1.player;
  assert.equal(plusOf(p.equipped.arme), 1);
  assert.equal(p.resources.eclat_brut, 9 - UPGRADE_STEPS[0].shardQty);
  assert.equal(p.resources.veine_d_acier, 20 - UPGRADE_STEPS[0].rareQty);
  assert.equal(p.gold, g0 - r1.needs.total);
  assert.equal(p.taxPaid.aldenmoor, r1.needs.tax);
  p = applyUpgrade(p, "arme").player; p = applyUpgrade(p, "arme").player;
  assert.equal(plusOf(p.equipped.arme), 3);
  const r4 = applyUpgrade(p, "arme");
  assert.equal(r4.ok, false); assert.equal(r4.player, p);
});

test("refus : or insuffisant, éclat ou ressource rare manquants ; aucune ressource consommée", () => {
  const rich = stocked("guerrier");
  const poor = { ...rich, gold: 0 };
  let r = applyUpgrade(poor, "arme"); assert.equal(r.ok, false); assert.equal(r.player, poor); assert.match(r.reason, /Or/);
  const noShard = { ...rich, resources: { veine_d_acier: 5 } };
  r = canUpgrade(noShard, "arme"); assert.equal(r.ok, false); assert.ok(r.lacks.shard && !r.lacks.rare);
  const noRare = { ...rich, resources: { eclat_brut: 9 } };
  r = canUpgrade(noRare, "arme"); assert.equal(r.ok, false); assert.ok(r.lacks.rare);
  const wrongClass = { ...rich, resources: { eclat_brut: 9, petale_d_ame: 9 } };
  assert.equal(canUpgrade(wrongClass, "arme").ok, false, "la ressource d'une autre classe ne sert pas");
  assert.equal(canUpgrade(rich, "inexistant").ok, false);
});

test("pièce du sac : améliorée par son uid, et la pièce garde son niveau", () => {
  const w = ITEMS.plastron_veteran;
  const p = stocked("guerrier", { ...hero("guerrier"), inventory: [{ ...w, uid: "u1" }] });
  const r = applyUpgrade(p, "u1");
  assert.ok(r.ok); assert.equal(plusOf(r.player.inventory[0]), 1);
  assert.ok(upgradablePieces(p).some((x) => x.ref === "u1"));
});

test("la valeur de revente monte avec les niveaux", () => {
  const w = ITEMS[tierGear("guerrier", 30).arme];
  assert.ok(itemWorth({ ...w, plus: 2 }) > itemWorth({ ...w, plus: 1 }) && itemWorth({ ...w, plus: 1 }) > itemWorth(w));
});

test("ressource rare à la récolte : seulement le métier lié, et plus souvent avec le niveau", () => {
  assert.equal(rareFindChance(50, "forgeron"), 0);
  assert.equal(rollRareFind(50, "forgeron", () => 0), null);
  for (const [prof, id] of Object.entries(RARE_OF_PROFESSION)) {
    assert.equal(rollRareFind(1, prof, () => 0), id);
    assert.equal(rollRareFind(1, prof, () => 0.99), null);
    assert.ok(rareFindChance(100, prof) > rareFindChance(1, prof));
    assert.ok(Math.abs(rareFindChance(100, prof) - 0.2) < 1e-9);
  }
});

// ---- simulés ----
const mkLife = (classKey = "guerrier", level = 30, gold = 1e6) => ({ id: "t", level, xp: 0, gold, gear: tierGear(classKey, level), bag: emptyBag(), bank: null, quests: emptyQuests(), pro: {}, prof: { key: "mineur", level: 1, xp: 0 } });
const bot = (classKey = "guerrier") => ({ id: "t", classKey, level: 30 });

test("simulé : sans ressource rien ne se passe ; avec ce qu'il faut il améliore d'abord l'arme, puis les autres pièces au même niveau", () => {
  const life = mkLife();
  assert.equal(upgradeStep(life, bot()), false);
  life.bag.res = { eclat_brut: 99, veine_d_acier: 99 };
  const g0 = life.gold;
  assert.ok(upgradeStep(life, bot()));
  assert.equal(life.upg.arme, 1);
  assert.ok(life.gold < g0);
  assert.equal(life.upgraded, 1); assert.equal(life.upgradeGold, g0 - life.gold);
  assert.equal(nextUpgrade(life, bot()).slot, "plastron", "tous les +1 avant les +2");
  const bk = { ...life.bag.res };
  while (upgradeStep(life, bot()));
  assert.ok(Object.values(life.upg).every((v) => v === 1), "sans éclat dense, il s'arrête à +1 partout");
  assert.ok(Object.keys(life.upg).length >= 4);
  assert.ok(life.bag.res.eclat_brut < bk.eclat_brut);
});

test("simulé : jamais d'amélioration sans l'or ; l'or manquant ne fait pas acheter d'éclats", () => {
  const life = mkLife("guerrier", 30, 5);
  life.bag.res = { eclat_brut: 99, veine_d_acier: 99 };
  assert.equal(upgradeStep(life, bot()), false);
  assert.deepEqual(upgradeShopping(life, bot()), {});
});

test("simulé : il achète à l'hôtel des ventes ce qui lui manque (éclats et ressource de sa classe)", () => {
  const life = mkLife();
  const want = upgradeShopping(life, bot());
  assert.equal(want.eclat_brut, UPGRADE_STEPS[0].shardQty);
  assert.equal(want.veine_d_acier, UPGRADE_STEPS[0].rareQty);
  life.bag.res = { eclat_brut: 1, veine_d_acier: 1 };
  assert.deepEqual(upgradeShopping(life, bot()), { eclat_brut: UPGRADE_STEPS[0].shardQty - 1 });
  assert.equal(upgradeShopping(mkLife("magicien"), bot("magicien")).petale_d_ame, 1);
});

test("simulé : une pièce remplacée perd son amélioration ; le niveau moyen sert aux chances de victoire", () => {
  const life = mkLife("guerrier", 5);
  life.bag.res = { eclat_brut: 99, veine_d_acier: 99 };
  while (upgradeStep(life, bot()));
  const slots = Object.keys(life.upg);
  assert.ok(plusBucket(life) >= 0);
  const slot = slots[0], old = life.gear[slot];
  const better = ITEMS[tierGear("guerrier", 45)[slot]];
  assert.notEqual(better.id, old);
  acquireItem(life, better.id); assert.equal(life.upg[slot], undefined, "amélioration perdue avec l'ancienne pièce");
  const l2 = mkLife(); l2.upg = Object.fromEntries(["arme", "plastron", "jambieres", "chapeau", "gants", "ceinture", "bouclier", "cape", "amulette", "anneau"].map((s) => [s, 3]));
  assert.equal(plusBucket(l2), 3);
  assert.equal(plusBucket(mkLife()), 0);
});

test("le bot de combat porte ses améliorations : plus fort à +3 qu'à +0", () => {
  const g = tierGear("guerrier", 30);
  const a = calcStats(makeBotPlayer("guerrier", 30, g)), b = calcStats(makeBotPlayer("guerrier", 30, g, undefined, 3));
  assert.ok(b.atkPhys > a.atkPhys && b.maxHp >= a.maxHp && b.defPhys > a.defPhys);
});

test("simulé : la pièce remplacée garde son +N dans un stock à vendre (4 au plus, le surplus est cédé)", () => {
  const life = mkLife("guerrier", 5);
  const slot = "arme", old = life.gear[slot];
  life.upg = { [slot]: 2 };
  const better = ITEMS[tierGear("guerrier", 45)[slot]];
  acquireItem(life, better.id);
  assert.deepEqual(life.plusStock, [{ id: old, plus: 2 }]);
  assert.equal(life.upg[slot], undefined);
  assert.ok(!life.bag.items.includes(old), "pas dans le sac ordinaire");
  const g = life.gold;
  for (let i = 0; i < 5; i++) stashPlus(life, old, 1);
  assert.equal(life.plusStock.length, PLUS_STOCK_MAX);
  assert.ok(life.gold > g, "le surplus est cédé");
});

test("simulé : acheter une pièce déjà améliorée la fait porter avec son niveau", () => {
  const life = mkLife("guerrier", 5);
  const slot = "arme", cur = life.gear[slot];
  const better = ITEMS[tierGear("guerrier", 45)[slot]];
  acquireItem(life, better.id, 2);
  assert.equal(life.gear[slot], better.id); assert.equal(life.upg[slot], 2);
  // une pièce +2 vaut mieux qu'une pièce neuve du même palier, mais pas qu'un palier au-dessus
  assert.ok(scoreWithPlus(better.id, 2) > scoreWithPlus(better.id, 0));
});

test("marché : un simulé met en vente sa pièce améliorée avec son +N, un joueur l'achète avec son niveau", () => {
  SIM_START.mode = "fresh"; SIM_START.epoch = T0;
  enableSimMarket(true);
  let m = newMarket(T0);
  m = tickMarket(m, T0 + DAY);
  const sellers = getPopulation().slice(0, 40);
  const piece = tierGear("guerrier", 30).arme;
  for (const b of sellers) { const l = m.sims.lives[b.id]; l.gold = 1e5; l.plusStock = [{ id: piece, plus: 2 }]; }
  let seen = null, day = 1;
  for (let d = 2; d <= 12 && !seen; d++) { m = tickMarket(m, T0 + d * DAY); day = d; seen = m.listings.find((x) => x.kind === "item" && x.item?.plus === 2); }
  assert.ok(seen, "une annonce porte la pièce +2");
  assert.equal(seen.rid, piece);
  assert.ok(seen.unit > Math.round(itemWorth({ ...ITEMS[piece], plus: 0 })), "plus chère qu'une pièce neuve");
  const buyer = { ...hero("guerrier"), gold: 1e7, inventory: [] };
  const r = buyFromListing({ ...buyer, market: m }, seen.id, 1, T0 + day * DAY);
  assert.ok(r.ok, JSON.stringify(r.reason ?? r.err ?? ""));
  assert.ok(r.player.inventory.some((i) => i.id === piece && i.plus === 2), "le joueur la reçoit en +2");
});

console.log(`\n${n} tests OK`);
