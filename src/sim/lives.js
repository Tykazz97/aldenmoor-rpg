// ============================================================
// Vie des joueurs simulés : chacun a SON personnage (niveau, xp, or, métier) qui progresse avec le temps réel,
// même quand tu n'es pas là. Sans React, testable. Rien n'est tiré « en direct » : tout est rejoué à partir de
// l'heure seulement, par pas de 10 minutes (comme le marché), avec une graine par simulé et par pas.
// Même heure = même histoire, et rejouer en une fois ou en plusieurs morceaux donne le même résultat.
//
// Un simulé ne joue pas 24 h sur 24 : il a des horaires (quelques heures par jour, de préférence le soir), des jours sans
// jouer, et un zèle propre. Quand il joue, selon son activité (combattant, récolteur, marchand, flâneur) :
//   - il enchaîne des combats dans la région de son niveau (xp, or) ; au-delà du niveau de la région l'xp s'effondre,
//     faute de contenu plus difficile (ce plafond disparaîtra avec les nouvelles régions) ;
//   - ou il récolte et monte son métier de récolte.
// Il garde dans son SAC ce qu'il ramasse : les ressources des drops et de la récolte, et l'équipement qui tombe (celui de sa
// classe seulement, comme pour toi). Quand son sac d'équipement déborde, il vend le plus ancien pour de l'or.
// Il porte de l'équipement, raffine et fabrique les pièces de son palier avec les mêmes règles que toi (lifeCraft.js).
// Étape suivante prévue : achats et ventes à l'hôtel des ventes avec les autres joueurs (aujourd'hui : un marchand).
// ============================================================
import { ENEMIES } from "../data/zones.js";
import { ENCOUNTERS } from "../data/encounters.js";
import { NODES } from "../data/gathering.js";
import { MAPS } from "../data/maps.js";
import { ZONES } from "../data/zones.js";
import { xpToNext, MAX_LEVEL } from "../utils/progression.js";
import { xpForLevel, MAX_PROFESSION_LEVEL } from "../data/professions.js";
import { BAG_ITEMS_MAX, starterGear, tierGear, acquireItem, craftStep, sellSurplus } from "./lifeCraft.js";
import { makeRng, hashString } from "./rng.js";
import { bankStep, drawFromBank } from "./lifeBank.js";
import { shoppingList } from "./lifeCraft.js";
import { bossStep, reachableBosses } from "./lifeBoss.js";
import { dungeonStep, keyCraftStep } from "./lifeDungeon.js";
import { wantsPotions, brewStep, BREW_CHANCE } from "./lifePotions.js";
import { emptyQuests, bump, questStep, huntTarget } from "./lifeQuests.js";
import { upgradeStep } from "./lifeUpgrade.js";
import { rollRareFind } from "../utils/perks.js";
import { withBonus } from "../utils/guildBonus.js";

export const STEP_MS = 10 * 60 * 1000;                 // un pas de simulation = 10 minutes
export const MAX_CATCHUP_STEPS = 7 * 144;              // au plus 7 jours rejoués à la fois
export const FIGHTS_PER_STEP = 0.6;                    // combats par pas de 10 min d'un simulé zélé : un simulé n'est pas un joueur acharné (à régler avec scripts/simulate-lives.js)
export const GATHERS_PER_STEP = 2;                     // récoltes par pas de 10 min
export { BAG_ITEMS_MAX };
export const OVERLEVEL_HALF = 2;                       // au-delà du niveau max de la région : l'xp est divisée par 2 tous les 2 niveaux
const BOSS_CHANCE = 0.04;                              // chance de tenter un boss plutôt que des combats ordinaires (quand l'un est disponible)
const DUNGEON_CHANCE = 0.1;                            // chance de tenter le donjon (s'il a une clé et que le cooldown est passé) plutôt que des combats ordinaires
const QUEST_CHANCE = 0.5;                              // chance de passer au tableau des quêtes pendant un pas actif
const PROFESSIONS_OF_GATHER = ["bucheron", "mineur", "herboriste"];

const hash01 = (s) => hashString(s) / 4294967296;

// --- Régions : niveaux et groupes de monstres ordinaires -------------------------------------------------------------
function buildRegions() {
  const out = [];
  for (const r of ZONES.aldenmoor.regions) {
    const m = /(\d+)\D+(\d+)/.exec(r.levels || "");
    const map = Object.values(MAPS).find((x) => x.regionKey === r.key);
    if (!m || !map) continue;
    const encs = [...new Set(map.groups.map((g) => g.encounter))].map((id) => ENCOUNTERS.find((e) => e.id === id)).filter((e) => e && !e.boss);
    const enemyKeys = new Set(encs.flatMap((e) => e.enemies));
    out.push({ key: r.key, lo: Number(m[1]), hi: Number(m[2]), enemyKeys, encounters: encs.map((e) => ({ enemies: e.enemies, xp: e.enemies.reduce((s, k) => s + (ENEMIES[k].xp || 0), 0), gold: e.enemies.reduce((s, k) => s + ((ENEMIES[k].gold?.[0] + ENEMIES[k].gold?.[1]) / 2 || 0), 0) })) });
  }
  return out.sort((a, b) => a.lo - b.lo);
}
const REGIONS = buildRegions();
export const regionFor = (level) => [...REGIONS].reverse().find((r) => level >= r.lo) || REGIONS[0];
export const overlevelMult = (level) => { const hi = regionFor(level).hi; return level > hi ? Math.pow(0.5, (level - hi) / OVERLEVEL_HALF) : 1; };

// --- Traits de caractère qui ne changent pas (déduits de l'id, rien à sauvegarder) -----------------------------------
const START_HOURS = [[17, 3], [18, 4], [19, 4], [20, 4], [21, 3], [22, 2], [13, 2], [14, 1], [9, 2], [10, 2], [15, 1]];
export const PROFILE_MIX = { occasionnel: 0.6, regulier: 0.3, acharne: 0.1 };      // part de chaque profil (le reste : acharnés)
const TRAITS_CACHE = new Map();
export function traitsOf(bot) {
  const hit = TRAITS_CACHE.get(bot.id);
  if (hit) return hit;
  const r = makeRng(hashString(`life:${bot.id}`));
  const traits = {
    diligence: Math.round((0.45 + r() * 0.85) * 100) / 100,        // zèle : 0,45 à 1,3
    start: r.weighted(START_HOURS),                              // heure de début de séance (heure de Suisse)
    hours: r.int(2, 6),                                          // durée d'une séance
    playDay: Math.round((0.55 + r() * 0.4) * 100) / 100,         // probabilité de jouer un jour donné
    primary: r.pick(PROFESSIONS_OF_GATHER),                      // métier de récolte
  };
  // Profil de joueur (tiré après le reste : les traits de base ne bougent pas). Comme sur un vrai serveur : beaucoup d'occasionnels,
  // une bonne part de joueurs réguliers, et quelques acharnés qui ont un objectif (monter vite en niveau, ou monter les métiers).
  const rp = r(), rf = r();
  traits.profile = rp < PROFILE_MIX.occasionnel ? "occasionnel" : rp < PROFILE_MIX.occasionnel + PROFILE_MIX.regulier ? "regulier" : "acharne";
  traits.focus = traits.profile === "acharne" ? (rf < 0.5 ? "xp" : "metiers") : null;
  if (traits.profile === "occasionnel") {                         // une heure ou deux, pas tous les jours, sans se presser
    traits.diligence = Math.round(traits.diligence * 0.7 * 100) / 100;
    traits.hours = Math.max(1, Math.round(traits.hours * 0.6));
    traits.playDay = Math.round(traits.playDay * 0.8 * 100) / 100;
  } else if (traits.profile === "acharne") {                      // de longues séances, presque tous les jours, à fond
    traits.diligence = Math.round((1.35 + (traits.diligence - 0.45) * 0.4) * 100) / 100;
    traits.hours = traits.hours + 3;
    traits.playDay = 0.93;
  }
  TRAITS_CACHE.set(bot.id, traits);
  return traits;
}

// Joue-t-il pendant ce pas ?
export function isActive(bot, step, traits = traitsOf(bot)) {
  const ms = step * STEP_MS + 3600_000;                          // UTC+1 : heure de Suisse
  const day = Math.floor(ms / 86400000);
  const hour = (ms % 86400000) / 3600000;
  if (hash01(`${bot.id}:day:${day}`) >= traits.playDay) return false;
  return ((hour - traits.start + 24) % 24) < traits.hours;
}

// Part de ses séances passée à combattre / récolter, selon l'activité. Un acharné suit son objectif : l'xp (combats, donjon) ou les métiers (récolte, raffinage, fabrication)
const SHARES = { combattant: { fight: 0.75, gather: 0.1, craft: 0.15 }, recolteur: { fight: 0.15, gather: 0.6, craft: 0.25 }, artisan: { fight: 0.12, gather: 0.18, craft: 0.7 }, marchand: { fight: 0.25, gather: 0.25, craft: 0.5 }, flaneur: { fight: 0.25, gather: 0.1, craft: 0.15 } };
const RUSH_XP = { fight: 0.85, gather: 0.04, craft: 0.11 }, RUSH_METIERS = { fight: 0.06, gather: 0.5, craft: 0.44 };
// un acharné des métiers suit sa vocation : le récolteur passe ses séances à récolter, l'artisan à raffiner et fabriquer
const RUSH_RECOLTE = { fight: 0.05, gather: 0.78, craft: 0.17 }, RUSH_ARTISAN = { fight: 0.05, gather: 0.2, craft: 0.75 };
export const shareOf = (bot, traits) => (traits.focus === "xp" ? RUSH_XP : traits.focus === "metiers" ? (bot.activity === "recolteur" ? RUSH_RECOLTE : bot.activity === "artisan" ? RUSH_ARTISAN : RUSH_METIERS) : SHARES[bot.activity] || SHARES.flaneur);

// --- État d'un simulé --------------------------------------------------------------------------------------------------
// { id, level, xp, gold, kills, gathers, crafted, prof: { key, level, xp }  (métier de récolte),
//   pro: { métier: { level, xp } }  (métiers de raffinage et de fabrication),
//   gear: { emplacement: idObjet }  (équipement porté),  bag: { res: { idRessource: quantité }, items: [idObjet, ...] } }
export function initialLife(bot, mode = "generated", seed = 1) {
  const t = traitsOf(bot);
  if (mode === "fresh") return { id: bot.id, played: 0, level: 1, xp: 0, gold: 0, kills: 0, gathers: 0, prof: { key: t.primary, level: 1, xp: 0 }, pro: {}, crafted: 0, gear: starterGear(bot.classKey), bag: emptyBag(), quests: emptyQuests() };
  const r = makeRng(hashString(`init:${bot.id}:${seed}`));
  const level = bot.level;
  const profLevel = Math.max(1, Math.min(MAX_PROFESSION_LEVEL, Math.round(level * (bot.activity === "recolteur" ? 1.3 : 0.6) * (0.7 + r() * 0.6))));
  return { id: bot.id, played: Math.round(level * 9), level, xp: Math.floor(r() * xpToNext(level)), gold: Math.round(level * (20 + r() * 60)), kills: level * 12, gathers: profLevel * 8, prof: { key: t.primary, level: profLevel, xp: Math.floor(r() * xpForLevel(profLevel)) }, pro: {}, crafted: 0, gear: tierGear(bot.classKey, level), bag: emptyBag(), quests: emptyQuests() };
}

export const emptyBag = () => ({ res: {}, items: [] });

function addXp(life, amount) {
  let { level, xp } = life;
  xp += amount;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level += 1; }
  if (level >= MAX_LEVEL) xp = 0;
  life.level = level; life.xp = xp;
}
function addProfXp(prof, amount) {
  prof.xp += amount;
  while (prof.level < MAX_PROFESSION_LEVEL && prof.xp >= xpForLevel(prof.level)) { prof.xp -= xpForLevel(prof.level); prof.level += 1; }
  if (prof.level >= MAX_PROFESSION_LEVEL) prof.xp = 0;
}
const bestNode = (profKey, level) => Object.values(NODES).filter((n) => n.profession === profKey && n.minLevel <= level).sort((a, b) => b.minLevel - a.minLevel)[0];

// Les drops d'un monstre vaincu vont dans le sac (équipement : seulement celui de sa classe)
export function rollDrops(life, bot, enemy, rng) {
  const dm = 1 + (life.gb?.drop || 0) / 100;                     // butin de guilde
  for (const d of enemy.drops || []) {
    if (d.forClass && d.forClass !== bot.classKey) continue;
    if (rng() >= (dm > 1 && !d.fixed ? Math.min(1, d.chance * dm) : d.chance)) continue;
    const qty = rng.int(d.min, d.max);
    if (d.type === "resource") life.bag.res[d.id] = (life.bag.res[d.id] || 0) + qty;
    else for (let i = 0; i < qty; i++) acquireItem(life, d.id);
  }
}

// Un pas de 10 minutes (modifie `life`)
export function stepLife(life, bot, step, traits = traitsOf(bot), opts = {}) {
  if (!isActive(bot, step, traits)) return life;
  life.played = (life.played || 0) + 1;                          // pas de 10 minutes passés en jeu (affiché en heures au classement)
  const rng = makeRng(hashString(`${bot.id}:${step}`));
  const share = shareOf(bot, traits);
  const gb = life.gb || null;                                    // bonus de guilde (voir sim/guilds.js)
  const gx = 1 + (gb?.xp || 0) / 100;                            // xp de personnage
  const roll = rng();
  if (roll < share.fight) {
    const region = regionFor(life.level);
    const hunt0 = huntTarget(life);
    const bossTry = rng() < (hunt0 && ENEMIES[hunt0]?.miniBoss ? 0.9 : BOSS_CHANCE);
    if (life.level >= 20 && rng() < (traits.focus === "xp" ? DUNGEON_CHANCE * 2 : DUNGEON_CHANCE) && dungeonStep(life, bot, step, rng, { acquire: acquireItem, addXp, xpMult: overlevelMult(life.level) * gx })) { bankStep(life); sellSurplus(life, opts.keep); return life; }
    if (bossTry && bossStep(life, bot, step, rng, { hunt: hunt0, acquire: acquireItem, addXp, xpMult: overlevelMult(life.level) * gx })) { bankStep(life); sellSurplus(life, opts.keep); return life; }
    const n = Math.floor(FIGHTS_PER_STEP * traits.diligence * (0.6 + rng() * 0.8) + rng());   // arrondi au hasard : 0,4 combat = 4 chances sur 10 d'en faire un
    const mult = overlevelMult(life.level);
    let xp = 0, gold = 0;
    const hunt = huntTarget(life);                                // il chasse en priorité l'ennemi de sa quête
    for (let i = 0; i < n; i++) {
      const e = rng.weighted(region.encounters.map((x) => [x, hunt && x.enemies.includes(hunt) ? 6 : 1])); xp += e.xp; gold += e.gold;
      for (const k of e.enemies) { rollDrops(life, bot, ENEMIES[k], rng); bump(life, "kills", k); }
      opts.onFight?.(region.key, e.enemies, `${bot.id}:${step}:${i}`);   // la sentinelle de la région tire son butin
    }
    life.kills += n;
    life.gold += Math.round(gold);
    addXp(life, Math.round(xp * mult * gx));
  } else if (roll < share.fight + share.gather) {
    const n = Math.floor(GATHERS_PER_STEP * traits.diligence * (0.6 + rng() * 0.8) + rng());
    const node = bestNode(life.prof.key, life.prof.level);
    if (node) {
      life.gathers += n; addProfXp(life.prof, gb?.mxp ? withBonus(n * node.xp, gb.mxp, rng) : n * node.xp);
      for (let i = 0; i < n; i++) {
        let q = rng.int(node.yield[0], node.yield[1]); if (gb?.harv) q = withBonus(q, gb.harv, rng); life.bag.res[node.resource] = (life.bag.res[node.resource] || 0) + q; bump(life, "gathered", node.resource, q);
        const rare = rollRareFind(life.prof.level, life.prof.key, rng);          // ressource rare d'une classe, trouvée en récoltant (data/upgrade.js)
        if (rare) life.bag.res[rare] = (life.bag.res[rare] || 0) + 1;
      }
    }
  } else {
    upgradeStep(life, bot);                                    // à l'atelier : il améliore une pièce s'il a l'or et les ressources
    if (life.bank && Object.keys(life.bank.resources).length) drawFromBank(life, shoppingList(life, bot));   // il sort du coffre ce dont l'atelier a besoin
    if (!keyCraftStep(life, rng, { merchant: opts.merchant !== false }) && !(wantsPotions(life) && rng() < BREW_CHANCE && brewStep(life, rng, { merchant: opts.merchant !== false }))) craftStep(life, bot, rng, { merchant: opts.merchant !== false });   // atelier : la clé du donjon d'abord, sinon raffiner, fabriquer, s'équiper
  }
  if (rng() < QUEST_CHANCE) questStep(life, bot, step * STEP_MS, rng, new Set([...regionFor(life.level).enemyKeys, ...reachableBosses(life).map((b) => b.key)]));   // tableau des quêtes
  bankStep(life);                                                // il range le surplus au coffre
  sellSurplus(life, opts.keep);
  return life;
}

// --- Le monde des simulés ------------------------------------------------------------------------------------------------
// { v:1, mode, epoch, step, lives: { id: life } } : `step` = prochain pas à jouer
export const stepOf = (ms) => Math.floor(ms / STEP_MS);

export function createLives({ population, mode = "generated", epoch = 1, now = Date.now() }) {
  const start = mode === "fresh" ? Math.max(stepOf(epoch), 0) : stepOf(now);
  const lives = {};
  for (const b of population) lives[b.id] = initialLife(b, mode, epoch);
  return { v: 1, mode, epoch, step: start, lives };
}

// Un seul pas de simulation (utilisé aussi par le marché, qui fait avancer les simulés en même temps que lui)
export function stepLivesOne(world, population, step, opts = {}, traits = null) {
  for (const b of population) {
    const life = world.lives[b.id];
    if (life) stepLife(life, b, step, traits?.get(b.id) ?? traitsOf(b), opts);
  }
  world.step = step + 1;
}

// Rejoue tous les pas jusqu'à `now` (au plus MAX_CATCHUP_STEPS). Renvoie le nombre de pas joués.
export function advanceLives(world, population, now = Date.now(), opts = {}) {
  const target = stepOf(now);
  if (target <= world.step) return 0;
  if (target - world.step > MAX_CATCHUP_STEPS) world.step = target - MAX_CATCHUP_STEPS;
  const traits = new Map(population.map((b) => [b.id, traitsOf(b)]));
  let played = 0;
  while (world.step < target) { stepLivesOne(world, population, world.step, opts, traits); played++; }
  return played;
}

// La population « vivante » : les mêmes aventuriers, avec leur niveau du moment
export function liveBots(world, population) {
  return population.map((b) => { const l = world.lives[b.id]; return l ? { ...b, level: l.level, gold: l.gold, life: l } : b; });
}

// Une sauvegarde lue du navigateur est-elle utilisable ? (bonne version, même départ, même population)
// Anciennes sauvegardes (sans sac) : on ajoute un sac vide plutôt que de tout effacer
export function migrateWorld(w, population = []) {
  const byId = new Map(population.map((b) => [b.id, b]));
  if (w && w.lives && typeof w.lives === "object") for (const l of Object.values(w.lives)) if (l && typeof l === "object") { if (!l.bag) l.bag = emptyBag(); if (!l.quests) l.quests = emptyQuests(); if (!l.pro) l.pro = {}; if (l.played == null) l.played = Math.round((l.level || 1) * 9); if (l.crafted == null) l.crafted = 0; if (!l.gear) { const b = byId?.get(l.id); l.gear = b ? tierGear(b.classKey, l.level) : {}; } }
  return w;
}

export function validWorld(w, { mode, epoch }, population) {
  return !!w && w.v === 1 && w.mode === mode && w.epoch === epoch && Number.isFinite(w.step) && w.lives && typeof w.lives === "object"
    && population.every((b) => { const l = w.lives[b.id]; return l && Number.isFinite(l.level) && l.level >= 1 && l.prof && Number.isFinite(l.prof.level) && l.bag && typeof l.bag.res === "object" && Array.isArray(l.bag.items) && l.gear && typeof l.gear === "object" && l.pro && typeof l.pro === "object" && l.quests && Array.isArray(l.quests.active); });
}
