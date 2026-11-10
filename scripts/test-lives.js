// Tests de la vie des joueurs simulés (personnages persistants) :  node scripts/test-lives.js
import assert from "node:assert/strict";
import { getPopulation } from "../src/sim/population.js";
import {
  createLives, advanceLives, liveBots, validWorld, stepOf, isActive, traitsOf, shareOf, PROFILE_MIX, overlevelMult, regionFor, initialLife,
  STEP_MS, MAX_CATCHUP_STEPS, BAG_ITEMS_MAX, migrateWorld, rollDrops, emptyBag,
} from "../src/sim/lives.js";
import { MAX_LEVEL, xpToNext } from "../src/utils/progression.js";
import { RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { makeRng } from "../src/sim/rng.js";
import { craftStep, starterGear, tierGear, gearScore, acquireItem, sellSurplus, STOCK_KEEP, wishPieces, orderTarget } from "../src/sim/lifeCraft.js";
import { botSpec, buildOf, makeBotPlayer, DEFAULT_BUILD } from "../src/sim/partyBots.js";
import { emptyQuests, questStep, bump, huntTarget } from "../src/sim/lifeQuests.js";
import { boardFor, progressOf, dayKey } from "../src/utils/quests.js";
import { bossStep, BOSSES, bossOf, BOSS_COOLDOWN_STEPS, reachableBosses } from "../src/sim/lifeBoss.js";
import { winChance, clearFightCache } from "../src/sim/botFight.js";
import { bankStep, drawFromBank, bankFreeSlots, emptyBank, sellableOf, takeForSale, BANK_SELL_KEEP, BANK_MAX_PER_RES, BAG_RES_KEEP, BAG_ITEMS_KEEP } from "../src/sim/lifeBank.js";
import { bankCapacity, bankUsed, BANK_START } from "../src/utils/bank.js";
import { RECIPES } from "../src/data/recipes.js";
import { MAX_PROFESSION_LEVEL } from "../src/data/professions.js";
import { craftFee } from "../src/utils/cityTax.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Vie des joueurs simulés");

const pop = getPopulation();
const T0 = Date.UTC(2027, 0, 4, 12);               // un lundi à midi
const DAY = 86400000;
const fresh = (now = T0) => createLives({ population: pop, mode: "fresh", epoch: now, now });
const run = (w, days, from = T0) => { for (let d = 1; d <= days; d++) advanceLives(w, pop, from + d * DAY); return w; };
const lv = (w) => Object.values(w.lives).map((l) => l.level).sort((a, b) => a - b);
const med = (a) => a[Math.floor(a.length / 2)];

await test("fresh start : tout le monde commence au niveau 1, sans or ni xp ; rien ne bouge avant le lancement", () => {
  const w = fresh();
  assert.equal(Object.keys(w.lives).length, pop.length);
  for (const l of Object.values(w.lives)) { assert.equal(l.level, 1); assert.equal(l.xp, 0); assert.equal(l.gold, 0); assert.equal(l.prof.level, 1); }
  const future = createLives({ population: pop, mode: "fresh", epoch: T0 + 5 * DAY, now: T0 });
  assert.equal(advanceLives(future, pop, T0 + 2 * DAY), 0, "avant l'epoch : aucun pas");
  assert.ok(lv(future).every((x) => x === 1));
});

await test("mode « generated » : chacun démarre au niveau de la population", () => {
  const w = createLives({ population: pop, mode: "generated", epoch: 1, now: T0 });
  for (const b of pop) assert.equal(w.lives[b.id].level, b.level);
  assert.deepEqual(liveBots(w, pop).map((b) => b.level), pop.map((b) => b.level));
});

await test("déterministe, et rejouer en un seul bloc ou en plusieurs donne exactement la même histoire", () => {
  const a = run(fresh(), 10);
  const b = run(fresh(), 10);
  assert.deepEqual(a, b);
  const c = fresh();
  for (const d of [1, 4, 4.5, 7, 10]) advanceLives(c, pop, T0 + d * DAY);
  assert.deepEqual(c.lives, a.lives);
  assert.equal(c.step, a.step);
});

await test("ils ne jouent pas tout le temps : séances de quelques heures, de préférence le soir, certains jours seulement", () => {
  const bot = pop[0], tr = traitsOf(bot);
  let active = 0, steps = 0, evening = 0, night = 0, eveningSteps = 0, nightSteps = 0;
  const all = pop.map((b) => [b, traitsOf(b)]);
  for (let s = stepOf(T0); s < stepOf(T0) + 14 * 144; s++) {
    const hour = ((s * STEP_MS + 3600000) % DAY) / 3600000;
    for (const [b, t] of all) {
      const on = isActive(b, s, t);
      steps++; if (on) active++;
      if (hour >= 18 && hour < 22) { eveningSteps++; if (on) evening++; }
      if (hour >= 2 && hour < 6) { nightSteps++; if (on) night++; }
    }
  }
  const frac = active / steps;
  assert.ok(frac > 0.05 && frac < 0.35, `part du temps en jeu ${frac.toFixed(2)}`);
  assert.ok(evening / eveningSteps > 2 * (night / nightSteps), "plus de monde le soir que la nuit");
  assert.ok(tr.hours >= 1 && tr.hours <= 10 && tr.diligence > 0.2 && tr.diligence < 2.1);   // selon le profil (occasionnel à acharné)
  assert.deepEqual(traitsOf(bot), traitsOf(bot), "traits stables");
});

await test("ils progressent : niveaux qui montent sans jamais baisser, métiers aussi, avec une vraie dispersion", () => {
  const w = fresh();
  for (let d = 1; d <= 40; d++) advanceLives(w, pop, T0 + d * DAY);
  const lives = pop.map((b) => w.lives[b.id]);
  for (const l of lives) { assert.ok(l.level >= 1 && l.level <= MAX_LEVEL); assert.ok(l.xp >= 0 && l.xp < xpToNext(l.level)); assert.ok(l.prof.level >= 1 && l.prof.level <= MAX_PROFESSION_LEVEL && l.gold >= 0); }
  const sorted = lv(w);
  assert.ok(med(sorted) >= 8 && med(sorted) <= 30, `niveau médian ${med(sorted)} après 40 jours`);
  assert.ok(sorted[sorted.length - 1] > med(sorted) + 3, "il y a des écarts entre joueurs");
  // monotone : un jour de plus ne fait jamais reculer personne (l'or peut baisser : ils dépensent, mais jamais sous zéro)
  const snap = Object.fromEntries(Object.entries(w.lives).map(([k, l]) => [k, [l.level, l.gold, l.kills]]));
  advanceLives(w, pop, T0 + 41 * DAY);
  for (const [k, l] of Object.entries(w.lives)) assert.ok(l.level >= snap[k][0] && l.kills >= snap[k][2] && l.gold >= 0);
});

await test("les combattants montent plus vite en niveau, les récolteurs plus vite en métier", () => {
  const w = run(fresh(), 30);
  const avg = (act, f) => { const bs = pop.filter((b) => b.activity === act); return bs.reduce((s, b) => s + f(w.lives[b.id]), 0) / bs.length; };
  assert.ok(avg("combattant", (l) => l.level) > avg("recolteur", (l) => l.level));
  assert.ok(avg("recolteur", (l) => l.prof.level) > avg("combattant", (l) => l.prof.level));
});

await test("plafond du contenu : au-delà du niveau de la dernière région, l'xp s'effondre", () => {
  assert.equal(overlevelMult(10), 1);
  assert.equal(overlevelMult(20), 1);
  assert.ok(overlevelMult(22) < 0.6 && overlevelMult(28) < 0.1);
  assert.equal(regionFor(1).key, "prairies_sauvages"); assert.equal(regionFor(9).key, "champs_calcines"); assert.equal(regionFor(40).key, "lisiere_des_ombres");
  const w = run(fresh(), 90);
  assert.ok(lv(w).pop() <= 40, "personne n'atteint le niveau max faute de contenu");
});

await test("rattrapage : au plus 7 jours rejoués, même après une très longue absence", () => {
  const w = fresh();
  const played = advanceLives(w, pop, T0 + 100 * DAY);
  assert.equal(played, MAX_CATCHUP_STEPS);
  assert.equal(w.step, stepOf(T0 + 100 * DAY));
  assert.equal(advanceLives(w, pop, T0 + 100 * DAY), 0, "déjà à jour");
});

await test("sauvegarde : une sauvegarde valide est reconnue, une autre version, un autre départ ou une donnée abîmée sont refusés", () => {
  const w = run(fresh(), 3);
  const copy = JSON.parse(JSON.stringify(w));
  assert.ok(validWorld(copy, { mode: "fresh", epoch: T0 }, pop));
  assert.ok(!validWorld(copy, { mode: "fresh", epoch: T0 + 1 }, pop), "autre epoch : on repart de zéro");
  assert.ok(!validWorld(copy, { mode: "generated", epoch: T0 }, pop));
  assert.ok(!validWorld({ ...copy, v: 2 }, { mode: "fresh", epoch: T0 }, pop));
  assert.ok(!validWorld(null, { mode: "fresh", epoch: T0 }, pop) && !validWorld("x", { mode: "fresh", epoch: T0 }, pop));
  const broken = JSON.parse(JSON.stringify(w)); delete broken.lives[pop[5].id];
  assert.ok(!validWorld(broken, { mode: "fresh", epoch: T0 }, pop));
  const bad = JSON.parse(JSON.stringify(w)); bad.lives[pop[0].id].level = "x";
  assert.ok(!validWorld(bad, { mode: "fresh", epoch: T0 }, pop));
  // et la reprise après rechargement donne la même suite
  const reloaded = JSON.parse(JSON.stringify(w));
  advanceLives(reloaded, pop, T0 + 6 * DAY); advanceLives(w, pop, T0 + 6 * DAY);
  assert.deepEqual(reloaded.lives, w.lives);
});

await test("vue du jeu : la liste vivante vient du monde rangé dans le marché du joueur ; sans simulés, la population de départ", async () => {
  const { getLivePopulation } = await import("../src/sim/simWorld.js");
  assert.equal(getLivePopulation(null), pop);
  assert.equal(getLivePopulation({}), pop);
  const sims = run(fresh(), 5);
  const player = { market: { sims } };
  const list = getLivePopulation(player);
  assert.equal(list.length, pop.length);
  assert.ok(list.every((b) => b.level >= 1 && b.life));
  assert.equal(getLivePopulation(player), list, "même tableau tant que rien ne change");
  assert.ok(list.some((b) => b.level > 1), "les niveaux du moment");
});

await test("sac : ils gardent les drops et la récolte, équipement de leur classe seulement, sac d'équipement plafonné", () => {
  const w = run(fresh(), 40);
  const lives = pop.map((b) => [b, w.lives[b.id]]);
  let withRes = 0;
  for (const [b, l] of lives) {
    assert.ok(l.bag && typeof l.bag.res === "object" && Array.isArray(l.bag.items));
    for (const [id, q] of Object.entries(l.bag.res)) assert.ok(RESOURCES[id] && Number.isInteger(q) && q > 0, `ressource ${id}`);
    assert.ok(l.bag.items.length <= BAG_ITEMS_MAX);
    for (const id of l.bag.items) { const it = ITEMS[id]; assert.ok(it, id); if (it.classKey) assert.equal(it.classKey, b.classKey, "pas d'arme d'une autre classe"); }
    if (Object.keys(l.bag.res).length) withRes++;
  }
  assert.ok(withRes > 150, `${withRes} sacs avec des ressources`);
  // la récolte arrive dans le sac : un récolteur actif a de sa ressource de métier
  const gatherer = lives.filter(([b, l]) => b.activity === "recolteur" && l.gathers > 50)[0];
  assert.ok(gatherer, "un récolteur actif existe");
  const own = { bucheron: ["bois_de_frene", "bois_de_chene"], mineur: ["minerai_de_fer", "minerai_de_cuivre"], herboriste: ["ortie", "sauge"] }[gatherer[1].prof.key];
  assert.ok(own.some((id) => gatherer[1].bag.res[id] > 0), "ses récoltes sont dans son sac");
  // un combattant a des drops de monstres
  const fighter = lives.filter(([b, l]) => b.activity === "combattant" && l.kills > 100)[0];
  assert.ok(Object.keys(fighter[1].bag.res).length >= 2);
});

await test("sac : l'équipement en trop est revendu (or), et les anciennes sauvegardes reçoivent un sac vide", () => {
  const b = pop.find((x) => x.classKey === "guerrier");
  const life = { gold: 0, bag: emptyBag(), gear: { arme: "epee_milicien" } };   // déjà équipé : les doublons vont dans le sac
  const sure = { drops: [{ type: "item", id: "epee_milicien", chance: 1, min: 1, max: 1 }, { type: "resource", id: "croc_de_loup", chance: 1, min: 2, max: 2 }, { type: "item", id: "croc_du_veilleur", chance: 1, min: 1, max: 1, forClass: "assassin" }] };
  const rng = makeRng(1);
  for (let i = 0; i < BAG_ITEMS_MAX; i++) rollDrops(life, b, sure, rng);
  assert.equal(life.bag.items.length, BAG_ITEMS_MAX); assert.equal(life.gold, 0);
  assert.equal(life.bag.res.croc_de_loup, 2 * BAG_ITEMS_MAX);
  assert.ok(!life.bag.items.includes("croc_du_veilleur"), "arme d'assassin ignorée par un guerrier");
  rollDrops(life, b, sure, rng);
  assert.equal(life.bag.items.length, BAG_ITEMS_MAX, "sac plafonné");
  assert.ok(life.gold > 0, "le plus ancien est revendu");
  const old = { v: 1, mode: "fresh", epoch: T0, step: 1, lives: { a: { id: "a", level: 3, prof: { key: "mineur", level: 1, xp: 0 } } } };
  migrateWorld(old);
  assert.deepEqual(old.lives.a.bag, { res: {}, items: [] });
  assert.ok(!validWorld({ ...old, lives: { ...old.lives, a: { ...old.lives.a, bag: undefined } } }, { mode: "fresh", epoch: T0 }, [{ id: "a" }]));
});

const warrior = () => pop.find((x) => x.classKey === "guerrier");
const freshLife = (b) => ({ id: b.id, level: 5, xp: 0, gold: 0, kills: 0, gathers: 0, crafted: 0, prof: { key: "mineur", level: 1, xp: 0 }, pro: {}, gear: starterGear(b.classKey), bag: emptyBag() });

await test("fabrication : avec les ressources et l'or, il fabrique une pièce manquante, la porte, et paie comme un vrai joueur", () => {
  const b = warrior(), life = freshLife(b);
  const missing = Object.keys(RECIPES).filter((id) => ITEMS[id]?.set === "veteran" && !Object.values(life.gear).includes(id));
  assert.ok(missing.length >= 2, "des pièces du Vétéran manquent au départ");
  life.gold = 500;
  for (const id of missing) for (const [r, q] of Object.entries(RECIPES[id].ingredients)) life.bag.res[r] = (life.bag.res[r] || 0) + q;
  const made = craftStep(life, b, makeRng(7));
  assert.ok(made && missing.includes(made), `fabriqué ${made}`);
  assert.equal(life.gear[ITEMS[made].type], made, "il la porte");
  assert.equal(life.crafted, 1);
  assert.ok(life.gold <= 500 - craftFee(made), "la taxe de la ville est payée");
  assert.ok(Object.values(life.pro).some((p) => p.xp > 0 || p.level > 1), "xp de métier gagnée");
  for (const [r, q] of Object.entries(life.bag.res)) assert.ok(q >= 0, r);
});

await test("fabrication : sans or ni ressources rien ne se passe ; il achète ce qui manque seulement s'il en a les moyens", () => {
  const b = warrior();
  const poor = freshLife(b);
  assert.equal(craftStep(poor, b, makeRng(1)), null);
  assert.deepEqual(poor.bag, emptyBag()); assert.equal(poor.gold, 0);
  const rich = freshLife(b); rich.gold = 400;
  const made = craftStep(rich, b, makeRng(2));
  assert.ok(made, "avec 400 or il achète ses ingrédients et fabrique");
  assert.ok(rich.gold >= 0 && rich.gold < 400);
});

await test("équipement : une pièce meilleure est portée (l'ancienne va au sac), une moins bonne est gardée ; surplus de ressources revendu", () => {
  const b = warrior(), life = freshLife(b);
  life.gear.arme = "epee_milicien";
  const better = ["epee_fossoyeur", "epee_chevalier"].find((id) => gearScore(id) > gearScore("epee_milicien"));
  acquireItem(life, better);
  assert.equal(life.gear.arme, better); assert.deepEqual(life.bag.items, ["epee_milicien"]);
  acquireItem(life, "epee_milicien");
  assert.equal(life.gear.arme, better, "une moins bonne ne remplace pas");
  life.bag.res.croc_de_loup = STOCK_KEEP + 30;
  const g0 = life.gold; sellSurplus(life);
  assert.equal(life.bag.res.croc_de_loup, STOCK_KEEP); assert.ok(life.gold > g0);
});

await test("la progression d'équipement est réelle : après un mois, beaucoup ont fabriqué, et ce qu'ils portent est cohérent", () => {
  const w = run(fresh(), 30);
  let crafted = 0, tier2 = 0;
  for (const b of pop) {
    const l = w.lives[b.id];
    if (l.crafted > 0) crafted++;
    for (const [slot, id] of Object.entries(l.gear)) { const it = ITEMS[id]; assert.ok(it && it.type === slot, `${id} dans ${slot}`); assert.ok(!it.classKey || it.classKey === b.classKey); }
    if (Object.values(l.gear).some((id) => (ITEMS[id].tier || 1) >= 2)) tier2++;
    assert.ok(l.gold >= 0 && Object.values(l.bag.res).every((q) => q >= 0));
    assert.ok(l.bag.items.length <= BAG_ITEMS_MAX);
  }
  assert.ok(crafted > 100, `${crafted} simulés ont fabriqué quelque chose`);
  assert.ok(tier2 > 30, `${tier2} portent du palier 2 ou plus`);
});

await test("les compagnons combattent avec leur vrai équipement : un simulé mal équipé est plus faible qu'un bien équipé", () => {
  const b = warrior();
  const weak = botSpec("guerrier", 20, { name: "A", gear: starterGear("guerrier") });
  const strong = botSpec("guerrier", 20, { name: "B", gear: tierGear("guerrier", 20) });
  const dflt = botSpec("guerrier", 20, { name: "C" });
  assert.ok(strong.stats.maxHp > weak.stats.maxHp && strong.stats.defPhys > weak.stats.defPhys);
  assert.equal(dflt.stats.maxHp, strong.stats.maxHp, "sans équipement connu : celui du palier, comme avant");
});

await test("quêtes : après un mois, les simulés ont rendu des quêtes du vrai tableau (réputation, chaîne, compteurs), sans fabrication", () => {
  const w = run(fresh(), 30);
  let withRep = 0, chain = 0, counters = 0, boss = 0;
  for (const b of pop) {
    const q = w.lives[b.id].quests;
    assert.ok(Array.isArray(q.active) && q.active.length <= 3 && q.done && q.rep && Array.isArray(q.chain));
    if (Object.values(q.rep).some((v) => v > 0)) withRep++;
    if (q.chain.length) chain++;
    if (Object.values(q.counters.kills).some((v) => v > 0)) counters++;
    if (q.chain.includes("chain_veilleur")) { boss++; assert.ok(w.lives[b.id].level >= 18 && (w.lives[b.id].boss?.kills.veilleur_corrompu || 0) >= 1, "fin de chaîne = Veilleur vaincu"); }
    for (const a of q.active) assert.ok(a.type !== "craft", `quête interdite ${a.id}`);
  }
  assert.ok(withRep > 150, `${withRep} simulés ont de la réputation`);
  assert.ok(counters > 150 && chain > 20, `${counters} compteurs, ${chain} chaînes`);
});

await test("quêtes : questStep utilise les vraies règles (acceptation, progression par compteurs, récompenses) et rend l'or et l'xp", () => {
  const bot = pop.find((b) => b.activity === "combattant");
  const life = initialLife(bot, "fresh");
  const pool = regionFor(1).enemyKeys;
  const now = Date.UTC(2027, 0, 4, 12);
  const rng = makeRng(7);
  // le tableau du jour ne propose que ce que le joueur peut faire ; on force l'acceptation d'une quête de chasse
  for (let i = 0; i < 40 && !life.quests.active.length; i++) questStep(life, bot, now, rng, pool);
  assert.ok(life.quests.active.length >= 1);
  const q = life.quests.active[0];
  assert.ok(boardFor({ level: 1, quests: emptyQuests() }, now).some((x) => x.id === q.id) || q.chain);
  assert.equal(progressOf({ resources: life.bag.res, quests: life.quests }, q).done, false);
  // on fait ce que la quête demande : ses compteurs avancent, puis il la rend
  if (q.type === "kill") bump(life, "kills", q.target, q.qty);
  else if (q.type === "gather") bump(life, "gathered", q.target, q.qty);
  else life.bag.res[q.target] = q.qty;
  const g0 = life.gold, xp0 = life.xp + life.level * 1e6;
  for (let i = 0; i < 40 && life.quests.active.some((a) => a.id === q.id); i++) questStep(life, bot, now, rng, pool);
  assert.ok(!life.quests.active.some((a) => a.id === q.id), "quête rendue");
  assert.ok(life.gold > g0 && life.xp + life.level * 1e6 > xp0, "or et xp reçus");
  assert.ok(Object.values(life.quests.rep).reduce((a, b) => a + b, 0) > 0, "réputation reçue");
  assert.ok(life.quests.done.ids.includes(q.id) || q.chain);
});

await test("quêtes : une quête de chasse en cours oriente son combat ; une quête qui traîne est abandonnée ; les anciennes sauvegardes reçoivent un carnet vide", () => {
  const bot = pop[3], life = initialLife(bot, "fresh");
  life.quests.active.push({ id: "x:kill", type: "kill", target: "loup", qty: 3, base: 0, day: dayKey(T0), rewards: { gold: 1, xp: 1, rep: 1 } });
  assert.equal(huntTarget(life), "loup");
  life.quests.active.push({ id: "old:gather", type: "gather", target: "ortie", qty: 99, base: 0, day: dayKey(T0) - 5, rewards: { gold: 1, xp: 1, rep: 1 } });
  questStep(life, bot, T0, makeRng(1), regionFor(1).enemyKeys);
  assert.ok(!life.quests.active.some((a) => a.id === "old:gather"), "quête abandonnée");
  const w = fresh(); delete w.lives[pop[0].id].quests;
  assert.equal(validWorld(w, { mode: "fresh", epoch: T0 }, pop), false);
  migrateWorld(w, pop);
  assert.ok(validWorld(w, { mode: "fresh", epoch: T0 }, pop));
});

await test("quêtes : même histoire en une fois ou en plusieurs morceaux (déterminisme)", () => {
  const a = run(fresh(), 6);
  const b = fresh(); for (let h = 1; h <= 6 * 24; h += 7) advanceLives(b, pop, T0 + h * 3600000); advanceLives(b, pop, T0 + 6 * DAY);
  const pick = (w) => JSON.stringify(pop.slice(0, 20).map((x) => [w.lives[x.id].quests, w.lives[x.id].level, w.lives[x.id].gold]));
  assert.equal(pick(a), pick(b));
});

await test("styles de jeu : chaque simulé répartit ses caractéristiques et son grimoire à sa façon (stable, propre à lui, plus fort ou plus faible selon le choix)", () => {
  const warriors = pop.filter((b) => b.classKey === "guerrier").slice(0, 40);
  const distinct = new Set(warriors.map((b) => JSON.stringify(buildOf(b))));
  assert.ok(distinct.size > 25, `${distinct.size} styles différents sur 40 guerriers`);
  assert.equal(JSON.stringify(buildOf(warriors[0])), JSON.stringify(buildOf(warriors[0])));
  for (const b of warriors) { const s = buildOf(b); assert.ok(s.main >= 0.5 && s.main + s.extraShare <= 0.93 && s.rankCap >= 2 && s.rankCap <= 4 && s.aoe > 0); }
  // les points sont tous dépensés : somme des caracs = départ + 3/niveau + 1 vitalité gratuite par niveau
  for (const b of warriors.slice(0, 10)) {
    const p = makeBotPlayer("guerrier", 20, null, buildOf(b));
    const total = Object.values(p.caracs).reduce((a, c) => a + c, 0);
    assert.equal(total, 5 + 4 * 19);
  }
  // un style tout en force frappe plus fort qu'un style tout en vitalité
  const glass = botSpec("guerrier", 20, { style: { ...DEFAULT_BUILD, main: 0.9 } }), tank = botSpec("guerrier", 20, { style: { ...DEFAULT_BUILD, main: 0.3 } });
  assert.ok(glass.stats.maxHp < tank.stats.maxHp);
  // style par défaut inchangé
  assert.equal(JSON.stringify(botSpec("magicien", 12).stats), JSON.stringify(botSpec("magicien", 12, { style: DEFAULT_BUILD }).stats));
});

await test("coffre : le surplus de ressources et les équipements de réserve y sont rangés, dans la limite des emplacements", () => {
  const bot = pop.find((b) => b.classKey === "guerrier"), life = initialLife(bot, "fresh");
  life.gear = tierGear("guerrier", 20);
  life.bag.res = { bois_de_frene: 80, ortie: 10, fer: 31 };
  life.bag.items = Array.from({ length: 16 }, () => "epee_milicien");
  bankStep(life);
  assert.equal(life.bag.res.bois_de_frene, BAG_RES_KEEP);
  assert.equal(life.bank.resources.bois_de_frene, 80 - BAG_RES_KEEP);
  assert.equal(life.bag.res.ortie, 10, "sous le seuil : rien ne bouge");
  assert.equal(life.bag.items.length, BAG_ITEMS_KEEP);
  assert.equal(life.bank.items.length, 4);
  // coffre plein : rien de plus n'entre, et l'agrandissement n'a lieu que s'il a deux fois le prix
  life.bank = emptyBank();
  life.bank.items = Array.from({ length: BANK_START }, () => "epee_milicien");
  assert.equal(bankFreeSlots(life), 0);
  life.bag.res = { bois_de_frene: 99 }; life.gold = 150;
  bankStep(life);
  assert.equal(life.bag.res.bois_de_frene, 99, "plein : tout reste dans le sac");
  assert.equal(life.bank.upgrades, 0, "pas assez d'or pour agrandir");
  life.gold = 250; bankStep(life);
  assert.equal(life.bank.upgrades, 1); assert.equal(life.gold, 150);
  assert.equal(bankCapacity({ bank: life.bank, quests: life.quests }), BANK_START + 10);
});

await test("coffre : il en sort ce qui manque (fabrication, achats) et reprend une pièce meilleure que la sienne", () => {
  const bot = pop.find((b) => b.classKey === "guerrier"), life = initialLife(bot, "fresh");
  life.bank = { items: [], resources: { fer: 12, ortie: 3 }, upgrades: 0 };
  const left = drawFromBank(life, { fer: 5, ortie: 9, bois: 2 });
  assert.deepEqual(left, { ortie: 6, bois: 2 });
  assert.equal(life.bag.res.fer, 5); assert.equal(life.bag.res.ortie, 3); assert.equal(life.bank.resources.fer, 7); assert.ok(!("ortie" in life.bank.resources));
  const better = tierGear("guerrier", 20).arme;
  life.bank.items.push(better);
  bankStep(life);
  assert.equal(life.gear.arme, better);
  assert.ok(!life.bank.items.includes(better));
});

await test("coffre : après un mois, la plupart des simulés ont un coffre bien rempli, sans dépasser sa capacité, et le marché reste alimenté", () => {
  const w = run(fresh(), 30);
  let withBank = 0;
  for (const b of pop) {
    const l = w.lives[b.id], pl = { bank: l.bank, quests: l.quests };
    if (!l.bank) continue;
    assert.ok(bankUsed(pl) <= bankCapacity(pl), `${b.id} coffre ${bankUsed(pl)}/${bankCapacity(pl)}`);
    assert.ok(Object.values(l.bank.resources).every((q) => q > 0) && l.bank.items.every((id) => ITEMS[id]));
    if (bankUsed(pl) > 0) withBank++;
  }
  assert.ok(withBank > 120, `${withBank} simulés utilisent leur coffre`);
});

await test("coffre : seul le trop-plein est vendu (d'abord celui du coffre), et au-delà du plafond le reste est bradé au marchand", () => {
  const life = initialLife(pop[0], "fresh");
  life.bag.res = { ortie: 20 }; life.bank = { items: [], resources: { ortie: BANK_SELL_KEEP + 30, bois_de_frene: 100 }, upgrades: 0 };
  assert.equal(sellableOf(life, "ortie", 8), 12 + 30);
  assert.equal(sellableOf(life, "bois_de_frene", 8), 0, "sous le seuil : rien à vendre");
  takeForSale(life, "ortie", 35);
  assert.equal(life.bank.resources.ortie, BANK_SELL_KEEP, "le coffre est vidé du trop-plein en premier");
  assert.equal(life.bag.res.ortie, 15);
  life.bank.resources.bois_de_frene = BANK_MAX_PER_RES + 100; const g = life.gold;
  bankStep(life);
  assert.equal(life.bank.resources.bois_de_frene, BANK_MAX_PER_RES);
  assert.ok(life.gold > g, "le surplus est bradé contre de l'or");
});

await test("rôles : récolteur, artisan, combattant… passent leurs séances différemment, et les acharnés suivent leur vocation", () => {
  const acts = new Set(pop.map((b) => b.activity));
  for (const a of ["combattant", "recolteur", "artisan", "marchand", "flaneur"]) assert.ok(acts.has(a), `rôle ${a} présent`);
  const share = (activity, focus = null) => shareOf({ activity }, { focus });
  assert.ok(share("recolteur").gather > 0.5 && share("artisan").craft > 0.6 && share("combattant").fight > 0.7);
  assert.ok(share("recolteur", "metiers").gather > share("artisan", "metiers").gather, "l'acharné récolteur récolte plus que l'acharné artisan");
  assert.ok(share("artisan", "metiers").craft > share("recolteur", "metiers").craft, "l'acharné artisan fabrique plus");
  assert.ok(share("flaneur", "xp").fight > 0.8);
  for (const a of ["combattant", "recolteur", "artisan", "marchand", "flaneur", "acharné"]) { const s = a === "acharné" ? share("flaneur", "xp") : share(a); assert.ok(s.fight + s.gather <= 1 + 1e-9 && s.fight > 0 && s.gather > 0, a); }   // le reste des séances va à l'atelier
});

await test("profils de joueur : occasionnels, réguliers et acharnés (xp ou métiers), stables et dans les bonnes proportions", () => {
  const count = (f) => pop.filter((b) => f(traitsOf(b))).length;
  const occ = count((t) => t.profile === "occasionnel"), reg = count((t) => t.profile === "regulier"), ach = count((t) => t.profile === "acharne");
  assert.equal(occ + reg + ach, pop.length);
  assert.ok(Math.abs(occ / pop.length - PROFILE_MIX.occasionnel) < 0.1, `occasionnels ${occ}`);
  assert.ok(Math.abs(reg / pop.length - PROFILE_MIX.regulier) < 0.1, `réguliers ${reg}`);
  assert.ok(ach / pop.length >= 0.04 && ach / pop.length <= 0.18, `acharnés ${ach}`);
  assert.ok(count((t) => t.focus === "xp") >= 1 && count((t) => t.focus === "metiers") >= 1, "les deux objectifs existent");
  for (const b of pop) { const t = traitsOf(b); assert.equal(t.focus !== null, t.profile === "acharne"); assert.deepEqual(traitsOf(b), t, "stable"); }
  const avg = (profile, key) => { const g = pop.map(traitsOf).filter((t) => t.profile === profile); return g.reduce((s, t) => s + t[key], 0) / g.length; };
  for (const key of ["diligence", "hours", "playDay"]) assert.ok(avg("occasionnel", key) < avg("regulier", key) && avg("regulier", key) < avg("acharne", key), `${key} croît avec l'engagement`);
  const bot = pop[0];
  assert.deepEqual(shareOf(bot, { focus: "xp" }), { fight: 0.85, gather: 0.04, craft: 0.11 });
  assert.ok(shareOf(bot, { focus: "metiers" }).fight < 0.1 && shareOf(bot, { focus: "metiers" }).craft + shareOf(bot, { focus: "metiers" }).gather > 0.9);
  assert.equal(shareOf(bot, { focus: null }).fight > 0, true, "sans objectif : la part de son activité habituelle");
});

await test("profils de joueur : après dix jours à partir de zéro, les acharnés (xp) devancent les réguliers, eux-mêmes devant les occasionnels ; les acharnés « métiers » ont les meilleurs métiers", () => {
  const w = run(fresh(), 10);
  const lives = pop.map((b) => ({ t: traitsOf(b), l: w.lives[b.id] }));
  const mean = (g, f) => g.reduce((s, x) => s + f(x.l), 0) / Math.max(1, g.length);
  const of = (pf, fc) => lives.filter((x) => x.t.profile === pf && (!fc || x.t.focus === fc));
  const lvl = (l) => l.level, pro = (l) => Math.max(l.prof.level, ...Object.values(l.pro || {}).map((p) => p.level));
  const o = mean(of("occasionnel"), lvl), r = mean(of("regulier"), lvl), x = mean(of("acharne", "xp"), lvl);
  assert.ok(o < r && r < x, `niveaux moyens : occasionnels ${o.toFixed(1)}, réguliers ${r.toFixed(1)}, acharnés xp ${x.toFixed(1)}`);
  const m = mean(of("acharne", "metiers"), pro), rp = mean(of("regulier"), pro), op = mean(of("occasionnel"), pro);
  assert.ok(m > rp && rp > op, `meilleur métier : acharnés métiers ${m.toFixed(1)}, réguliers ${rp.toFixed(1)}, occasionnels ${op.toFixed(1)}`);
  assert.ok(mean(of("acharne", "metiers"), lvl) < x, "les acharnés « métiers » montent moins vite en niveau que ceux de l'xp");
});

await test("boss : un simulé trop faible n'en tente aucun ; un boss ne se retente pas avant un jour ; la chance de victoire vient du vrai moteur de combat", () => {
  const bot = pop.find((b) => b.classKey === "assassin"), rng = makeRng(5);
  const low = initialLife(bot, "fresh");
  assert.deepEqual(reachableBosses(low), []);
  assert.equal(bossStep(low, bot, 1000, rng, { acquire: acquireItem, addXp: () => {} }), null);
  // niveau 22 bien équipé : le Cavalier est une formalité, le Veilleur en solo est incertain
  const high = { ...initialLife(bot, "fresh"), level: 22, gear: tierGear("assassin", 22) };
  clearFightCache();                                  // les estimations des tests précédents (profils voisins) ne comptent pas ici
  assert.equal(winChance(bot, high, ["cavalier_dechu"]), 1);
  const pv = winChance(bot, high, ["veilleur_corrompu"]);
  assert.ok(pv > 0 && pv <= 1);
  assert.ok(winChance(bot, high, ["veilleur_corrompu"], ["guerrier", "magicien"]) >= pv, "à trois c'est plus facile");
  const weak = { ...high, level: 8, gear: starterGear("assassin") };
  assert.ok(winChance(bot, weak, ["epouvantail_ancestral"]) < 0.5, "trop faible pour l'Épouvantail");
  // une victoire : xp, or, kills et compteurs de quête ; puis cooldown d'un jour
  let res = null, step = 5000;
  for (let i = 0; i < 20 && res !== "win"; i++, step += BOSS_COOLDOWN_STEPS) { high.xp = 0; res = bossStep(high, bot, step, makeRng(100 + i), { hunt: "cavalier_dechu", acquire: acquireItem, addXp: (l, x) => { l.xp += x; } }); }
  assert.equal(res, "win");
  assert.ok(high.quests.counters.kills.cavalier_dechu >= 1 && bossOf(high).kills.cavalier_dechu >= 1 && high.kills >= 1 && high.xp > 0);
  assert.equal(bossStep(high, bot, step - BOSS_COOLDOWN_STEPS + 10, makeRng(1), { acquire: acquireItem, addXp: () => {} }), null, "un jour de repos");
});

await test("boss : après un mois, beaucoup ont vaincu des boss (jamais sous le niveau conseillé, au plus un par jour), les armes uniques sont rares et de leur classe", () => {
  const w = run(fresh(), 30);
  let withBoss = 0, total = 0, relics = 0;
  const rec = Object.fromEntries(BOSSES.map((x) => [x.key, x.rec]));
  for (const b of pop) {
    const l = w.lives[b.id], st = l.boss;
    if (!st) continue;
    const kills = Object.entries(st.kills);
    if (kills.length) withBoss++;
    let n = 0;
    for (const [k, v] of kills) { n += v; assert.ok(l.level >= rec[k], `${b.id} niveau ${l.level} a vaincu ${k}`); assert.ok(l.quests.counters.kills[k] >= v); }
    total += n;
    assert.ok(n <= 31, `${b.id} : ${n} boss en 30 jours`);
    for (const id of [...Object.values(l.gear), ...l.bag.items, ...(l.bank?.items || [])]) if (ITEMS[id]?.rarity === "legendaire" && ITEMS[id].classKey) { relics++; assert.equal(ITEMS[id].classKey, b.classKey, `${id} sur un ${b.classKey}`); }
  }
  assert.ok(withBoss > 100 && total > 300, `${withBoss} simulés, ${total} victoires`);
  assert.ok(relics <= 0.2 * pop.length, `${relics} armes uniques`);
});

console.log(`\n${n} tests passent.`);
