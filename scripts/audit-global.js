// Audit global : fait vivre le marché et les 200 simulés plusieurs semaines (comme dans le jeu) et cherche des incohérences.
//   node scripts/audit-global.js [generated|fresh] [jours=60]
// Hors de `npm test` (une minute environ). Affiche les anomalies (✖) puis un petit tableau de bord ; code de sortie 1 s'il y en a.
import { getPopulation } from "../src/sim/population.js";
import { enableSimMarket, newMarket, tickMarket, marketBehind, STEP_MS } from "../src/utils/market.js";
import { SIM_START } from "../src/sim/config.js";
import { ITEMS } from "../src/data/items.js";
import { RESOURCES } from "../src/data/resources.js";
import { ALCHEMY, ALCHEMY_ORDER } from "../src/data/alchemy.js";
import { RECIPES } from "../src/data/recipes.js";
import { PROFESSIONS, getCraftInfo } from "../src/data/professions.js";
import { MAX_LEVEL, xpToNext } from "../src/utils/progression.js";
import { craftFee } from "../src/utils/cityTax.js";

const mode = process.argv[2] === "fresh" ? "fresh" : "generated";
const DAYS = Number(process.argv[3]) || 60;
const pop = getPopulation(), byId = new Map(pop.map((b) => [b.id, b]));
const problems = [];
const bad = (m) => { if (problems.length < 60) problems.push(m); else if (problems.length === 60) problems.push("… (trop d'anomalies, la suite est tronquée)"); };
const num = (x) => typeof x === "number" && Number.isFinite(x);

// ---------- 1. données ----------
for (const [id, r] of Object.entries(RECIPES)) {
  const info = getCraftInfo(id);
  if (!info) bad(`recette ${id} : aucun métier`);
  else if (info.minLevel > 100) bad(`recette ${id} : niveau ${info.minLevel} > 100`);
  if (craftFee(id) < 1) bad(`recette ${id} : taxe nulle à 1 %`);
  for (const rid of Object.keys(r.ingredients)) if (!RESOURCES[rid]) bad(`recette ${id} : ressource ${rid} inconnue`);
}
for (const id of ALCHEMY_ORDER) {
  if (!PROFESSIONS[ALCHEMY[id].profession]) bad(`alchimie ${id} : métier inconnu`);
  if (!RESOURCES[id]?.crafted) bad(`potion ${id} : ressource non marquée « crafted »`);
}

// ---------- 2. vie : marché + simulés ----------
const T0 = Date.UTC(2027, 0, 4, 12);
SIM_START.mode = mode; SIM_START.epoch = mode === "fresh" ? T0 : 1;
enableSimMarket(true);
let m = newMarket(T0);
const checkpoints = new Set([1, 7, 14, 30, 45, 60, 90].filter((d) => d <= DAYS));
const T = (d) => T0 + d * 86400000;
const audit = (day) => {
  const where = `jour ${day}`;
  const w = m.sims;
  if (!w) return bad(`${where} : pas de monde de simulés dans le marché`);
  for (const bot of pop) {
    const l = w.lives[bot.id];
    if (!l) { bad(`${where} : simulé ${bot.id} absent`); continue; }
    const who = `${bot.id} (${bot.classKey}, niv ${l.level})`;
    if (!(Number.isInteger(l.level) && l.level >= 1 && l.level <= MAX_LEVEL)) bad(`${where} ${who} : niveau invalide`);
    if (!num(l.xp) || l.xp < 0 || (l.level < MAX_LEVEL && l.xp >= xpToNext(l.level))) bad(`${where} ${who} : xp invalide ${l.xp}`);
    if (!num(l.gold) || l.gold < 0) bad(`${where} ${who} : or invalide ${l.gold}`);
    if (!Number.isInteger(l.gold)) bad(`${where} ${who} : or non entier ${l.gold}`);
    for (const [rid, q] of Object.entries(l.bag.res)) {
      if (!RESOURCES[rid]) bad(`${where} ${who} : ressource inconnue ${rid}`);
      if (!num(q) || q <= 0 || !Number.isInteger(q)) bad(`${where} ${who} : quantité ${q} de ${rid}`);
    }
    for (const [rid, q] of Object.entries(l.bank?.resources || {})) if (!RESOURCES[rid] || !num(q) || q <= 0) bad(`${where} ${who} : coffre ${rid}=${q}`);
    for (const id of [...l.bag.items, ...(l.bank?.items || [])]) if (!ITEMS[id]) bad(`${where} ${who} : objet inconnu ${id}`);
    for (const [slot, id] of Object.entries(l.gear)) {
      if (!ITEMS[id]) { bad(`${where} ${who} : équipement inconnu ${id}`); continue; }
      if (ITEMS[id].type !== slot) bad(`${where} ${who} : ${id} porté dans ${slot} (type ${ITEMS[id].type})`);
      if (ITEMS[id].classKey && ITEMS[id].classKey !== bot.classKey) bad(`${where} ${who} : porte ${id}, objet de ${ITEMS[id].classKey}`);
    }
    if (ITEMS[l.gear.arme]?.twoHanded && l.gear.bouclier) bad(`${where} ${who} : arme à deux mains et bouclier`);
    for (const [k, p] of Object.entries(l.pro || {})) if (!PROFESSIONS[k] || !(p.level >= 1 && p.level <= 100) || !(p.xp >= 0)) bad(`${where} ${who} : métier ${k} invalide ${JSON.stringify(p)}`);
    if (!(l.prof.level >= 1 && l.prof.level <= 100)) bad(`${where} ${who} : métier de récolte invalide`);
    const dj = l.dj;
    if (dj) {
      if (dj.keys < 0 || dj.runs < dj.clears + 0 || dj.clears > dj.runs || dj.fails > dj.runs || dj.relics < 0 || (dj.potions || 0) < 0) bad(`${where} ${who} : compteurs du donjon incohérents ${JSON.stringify(dj)}`);
      if (dj.runs > 0 && l.level < 20) bad(`${where} ${who} : a fait le donjon à ${l.level}`);
    }
    for (const id of ALCHEMY_ORDER) if ((l.bag.res[id] || 0) > 0 && !(l.pro?.alchimiste || (l.dj && l.dj.runs >= 0))) bad(`${where} ${who} : des potions sans jamais avoir distillé`);
    if (l.taxPaid) bad(`${where} ${who} : registre de taxe inattendu`);
  }
  // marché
  const ids = new Set();
  for (const l of m.listings) {
    if (ids.has(l.id)) bad(`${where} : annonce ${l.id} en double`); ids.add(l.id);
    if (!(Number.isInteger(l.qty) && l.qty >= 1) || !(Number.isInteger(l.unit) && l.unit >= 1)) bad(`${where} : annonce ${l.id} qty ${l.qty} prix ${l.unit}`);
    if (l.kind === "res" && !RESOURCES[l.rid]) bad(`${where} : annonce d'une ressource inconnue ${l.rid}`);
    if (l.kind === "item" && !ITEMS[l.rid]) bad(`${where} : annonce d'un objet inconnu ${l.rid}`);
    if (l.seller !== "npc" && l.seller !== "player" && !byId.has(l.seller)) bad(`${where} : vendeur inconnu ${l.seller}`);
    if (l.seller === "npc" && l.kind === "res") { const r = RESOURCES[l.rid]; if (r.rarity === "rare" || r.dungeon || r.crafted) bad(`${where} : le colporteur vend ${l.rid}`); }
    if (l.kind === "res" && l.seller === "npc" && ALCHEMY[l.rid]) bad(`${where} : le colporteur vend une potion`);
  }
  for (const id of Object.keys(RESOURCES)) { if (!num(m.stock[id]) || m.stock[id] <= 0) bad(`${where} : stock ${id} = ${m.stock[id]}`); if ((m.hist[id] || []).some((x) => !num(x))) bad(`${where} : historique de ${id} invalide`); }
  if (!num(m.proceeds)) bad(`${where} : produit des ventes invalide`);
  for (const [id, g] of Object.entries(m.credits || {})) if (!num(g) || g < 0) bad(`${where} : crédit ${id}=${g}`);
};

const t0 = Date.now();
for (let d = 1; d <= DAYS; d++) {
  m = tickMarket(m, T(d));
  if (marketBehind(m, T(d))) bad(`jour ${d} : le marché est resté en retard`);
  if (checkpoints.has(d)) audit(d);
}
audit(DAYS);

// ---------- 3. tableau de bord ----------
const L = Object.values(m.sims.lives);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const sum = (f) => L.reduce((s, l) => s + f(l), 0);
const potionStock = Object.fromEntries(ALCHEMY_ORDER.map((id) => [id, sum((l) => (l.bag.res[id] || 0) + (l.bank?.resources?.[id] || 0))]));
const potionListed = Object.fromEntries(ALCHEMY_ORDER.map((id) => [id, m.listings.filter((x) => x.kind === "res" && x.rid === id).reduce((s, x) => s + x.qty, 0)]));
const dj = L.reduce((a, l) => { if (l.dj) { a.runs += l.dj.runs; a.clears += l.dj.clears; a.relics += l.dj.relics; a.potions += l.dj.potions || 0; a.keys += l.dj.keys; } return a; }, { runs: 0, clears: 0, relics: 0, potions: 0, keys: 0 });
const tier4 = L.filter((l) => Object.values(l.gear).some((id) => ITEMS[id]?.tier === 4)).length;
console.log(`\nAudit « ${mode} » sur ${DAYS} jours (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(`  niveaux : médian ${med(L.map((l) => l.level))}, max ${Math.max(...L.map((l) => l.level))} ; or médian ${med(L.map((l) => l.gold))}`);
console.log(`  Alchimiste > 1 : ${L.filter((l) => (l.pro?.alchimiste?.level || 1) > 1).length} simulés, niveau max ${Math.max(...L.map((l) => l.pro?.alchimiste?.level || 1))}`);
console.log(`  potions en possession : ${JSON.stringify(potionStock)} ; en vente à l'hôtel des ventes : ${JSON.stringify(potionListed)}`);
console.log(`  donjon : ${dj.runs} expéditions, ${dj.clears} réussies, ${dj.relics} reliques, ${dj.potions} potions bues, ${dj.keys} clés en poche ; ${tier4} simulés portent du palier 4`);
console.log(`  annonces : ${m.listings.length} (dont ${m.listings.filter((x) => x.seller === "npc").length} du colporteur)`);
if (problems.length) { console.log(`\n${problems.length} anomalie(s) :`); problems.forEach((p) => console.log("  ✖", p)); process.exitCode = 1; }
else console.log("\nAucune anomalie.");
