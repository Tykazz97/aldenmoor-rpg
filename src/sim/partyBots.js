// ============================================================
// Alliés bots des groupes de combat : un bot a une classe, le niveau du joueur, l'équipement de son palier,
// ses caractéristiques réparties (65 % dans la principale, le reste en vitalité) et ses points de sort investis
// dans ses meilleurs sorts. Même logique que le joueur automatique de scripts/simulate-zones.js (qui l'utilise).
// Pur (sans React) : sert à l'écran de combat, aux tests et aux simulations.
// ============================================================
import { isUpgradable } from "../utils/upgrade.js";
import { ITEMS, SETS } from "../data/items.js";
import { CLASSES } from "../data/classes.js";
import { POINTS_PER_LEVEL, FREE_VITALITE_PER_LEVEL } from "../data/caracs.js";
import { calcStats } from "../utils/calcStats.js";
import { buildSpellBar, rankUp, spellPointsLeft, rankCost } from "../utils/spellbook.js";
import { makeRng, hashString } from "./rng.js";
import { makePseudo } from "./names.js";

export const PARTY_SIZE = 3;       // le joueur + 2 alliés

// Équipement par palier (voir data/gearTiers.js) : palier 1 jusqu'au niveau 9, palier 2 de 10 à 15, palier 3 à partir de 16.
export const BUILDS = {
  guerrier: { wtype: "epee", main: "force", tiers: [
    { weapon: "epee_milicien", set: "veteran", shield: "bouclier_milicien" },
    { weapon: "epee_fossoyeur", set: "fossoyeur", shield: "bouclier_fossoyeur" },
    { weapon: "epee_chevalier", set: "chevalier", shield: "bouclier_chevalier" },
    { weapon: "epee_garde_noye", set: "garde_noye", shield: "bouclier_garde_noye" },    // palier 4 : butin du donjon, jamais celui d'un niveau
  ] },
  assassin: { wtype: "dague", main: "agilite", tiers: [
    { weapon: "dague_ebrechee", set: "traqueur" }, { weapon: "dague_charognard", set: "charognard" }, { weapon: "dague_garou", set: "garou" },
    { weapon: "dague_veneur", set: "veneur" },
  ] },
  magicien: { wtype: "baton", main: "intelligence", tiers: [
    { weapon: "baton_noueux", set: "apprenti" }, { weapon: "baton_brasier", set: "brasier" }, { weapon: "baton_esprit", set: "esprit" },
    { weapon: "baton_veuve", set: "veuve" },
  ] },
};
export const tierOf = (level) => (level < 10 ? 0 : level < 16 ? 1 : 2);

function gear(build, level) {
  const t = build.tiers[tierOf(level)];
  const items = [t.weapon, ...SETS[t.set].pieces, ...(t.shield ? [t.shield] : [])];
  const equipped = {};
  for (const id of items) equipped[ITEMS[id].type] = ITEMS[id];
  return equipped;
}

// --- Le style de jeu d'un simulé (caractéristiques et grimoire), propre à chacun et qui ne change pas ---------------------
// Comme un vrai joueur, il répartit ses points de caractéristiques (3 par niveau) et ses points de sort (1 par niveau)
// à sa façon : plus ou moins concentré sur sa caractéristique principale, une caractéristique secondaire (chance, vitesse…),
// un goût pour les sorts de zone, et des sorts montés haut (peu de sorts) ou répartis. Tiré de son id : rien à sauvegarder,
// et sa répartition est recalculée à chaque niveau gagné, exactement comme si tu avais dépensé les points un par un.
export const DEFAULT_BUILD = { main: 0.65, extra: null, extraShare: 0, aoe: 1, rankCap: 3 };
const EXTRA_CARACS = [["chance", 3], ["vitesse", 3], ["agilite", 2], ["force", 2], ["intelligence", 2]];
const BUILD_CACHE = new Map();
export function buildOf(bot) {
  const hit = BUILD_CACHE.get(bot.id);
  if (hit) return hit;
  const r = makeRng(hashString(`build:${bot.id}`));
  const mainKey = BUILDS[bot.classKey].main;
  const main = Math.round((0.5 + r() * 0.3) * 100) / 100;
  const extra = r.weighted(EXTRA_CARACS.filter(([k]) => k !== mainKey));
  const build = { main, extra, extraShare: Math.round(r() * Math.min(0.3, 0.92 - main) * 100) / 100, aoe: Math.round((0.5 + r() * 1.2) * 100) / 100, rankCap: r.int(2, 4) };
  BUILD_CACHE.set(bot.id, build);
  return build;
}

// Un personnage complet (comme un joueur) de classe et niveau donnés
export function makeBotPlayer(classKey, level, gearIds = null, style = DEFAULT_BUILD, plus = 0) {  // `plus` : niveau d'amélioration de toutes ses pièces (0 à 3)
  const cls = CLASSES[classKey], b = BUILDS[classKey];
  const pts = POINTS_PER_LEVEL * (level - 1);
  const mainPts = Math.round(pts * style.main);
  const extraPts = style.extra ? Math.round(pts * style.extraShare) : 0;
  const caracs = { ...cls.startCaracs };
  caracs[b.main] = (caracs[b.main] || 0) + mainPts;
  if (style.extra) caracs[style.extra] = (caracs[style.extra] || 0) + extraPts;
  caracs.vitalite = (caracs.vitalite || 0) + (pts - mainPts - extraPts) + FREE_VITALITE_PER_LEVEL * (level - 1);
  let p = { classKey, level, gold: 0, caracs, baseHp: 100, equipped: gearIds ? Object.fromEntries(Object.entries(gearIds).filter(([, id]) => ITEMS[id]).map(([slot, id]) => [slot, plus > 0 && isUpgradable(ITEMS[id]) ? { ...ITEMS[id], plus } : ITEMS[id]])) : gear(b, level), spellbook: { ranks: {}, loadout: null } };
  // points de sort : sur le sort le plus rentable de la barre (les sorts de zone pèsent selon son goût), jusqu'à son rang préféré, puis le suivant…
  let cap = style.rankCap;
  for (let guard = 0; guard < 200 && spellPointsLeft(p) > 0; guard++) {
    const bar = buildSpellBar(p).filter((s) => s.type !== "buff" && s.rank < cap);
    if (!bar.length) { if (cap >= 5) break; cap += 1; continue; }
    bar.sort((a, c) => (c.power * (c.aoe ? 1 + style.aoe : 1)) / c.pa - (a.power * (a.aoe ? 1 + style.aoe : 1)) / a.pa);
    const target = bar.find((s) => rankCost(s.rank) <= spellPointsLeft(p));
    if (!target) break;
    p = rankUp(p, target.id);
  }
  return p;
}

// Ce que createCombat attend pour un allié : { name, stats, weaponType, classKey, level, spells } (+ look pour l'affichage)
export function botSpec(classKey, level, { name, body = "m", look, gear: gearIds = null, style = DEFAULT_BUILD, plus = 0 } = {}) {
  const player = makeBotPlayer(classKey, level, gearIds, style, plus);
  return {
    name: name || CLASSES[classKey].label,
    classKey, level,
    stats: calcStats(player),
    weaponType: BUILDS[classKey].wtype,
    spells: buildSpellBar(player),
    look: look || `${body}/${CLASSES[classKey].outfit}`,       // apparence de combat : tenue de la classe (ou celle du simulé)
  };
}

// Le groupe par défaut : les deux autres classes, au niveau du joueur. Pseudos et corps tirés de façon stable
// (même joueur => mêmes compagnons) pour que le groupe ne change pas à chaque combat.
export function defaultAllies(player) {
  const rng = makeRng(hashString(`party:${player.name || ""}:${player.classKey}`));
  return Object.keys(CLASSES)
    .filter((k) => k !== player.classKey)
    .slice(0, PARTY_SIZE - 1)
    .map((k) => botSpec(k, player.level || 1, { name: makePseudo(rng), body: rng.chance(0.5) ? "m" : "f" }));
}

// ------------------------------------------------------------
// Compagnons choisis : des joueurs simulés (sim/population.js) qui combattent à tes côtés avec leur propre
// classe, niveau, pseudo et apparence. Pour rester honnête, seuls ceux de niveau proche du tien sont proposés.
// ------------------------------------------------------------
export const COMPANION_LEVEL_WINDOW = 5;      // écart de niveau maximal proposé
export const COMPANION_LIST_MAX = 30;

export function companionCandidates(player, population, { max = COMPANION_LIST_MAX } = {}) {
  const lvl = player.level || 1;
  const ranked = population
    .map((b) => ({ b, d: Math.abs(b.level - lvl) }))
    .sort((x, y) => x.d - y.d || x.b.level - y.b.level || x.b.name.localeCompare(y.b.name));
  const near = ranked.filter((r) => r.d <= COMPANION_LEVEL_WINDOW);
  return (near.length >= 6 ? near : ranked.slice(0, 6)).slice(0, max).map((r) => r.b);
}

// Le groupe de combat : les compagnons choisis (ids de simulés), complétés par des alliés génériques des classes
// absentes du groupe quand il en manque (jusqu'à 2 alliés). Un id inconnu est ignoré.
export function buildAllies(player, companionIds = [], population = []) {
  const byId = new Map(population.map((b) => [b.id, b]));
  const chosen = [];
  for (const id of companionIds || []) {
    const b = byId.get(id);
    if (b && !chosen.includes(b)) chosen.push(b);
    if (chosen.length >= PARTY_SIZE - 1) break;
  }
  const specs = chosen.map((b) => botSpec(b.classKey, b.level, { name: b.name, look: b.look, gear: b.life?.gear, style: buildOf(b) }));
  if (specs.length >= PARTY_SIZE - 1) return specs;
  const generic = defaultAllies(player);
  const have = new Set([player.classKey, ...specs.map((s) => s.classKey)]);
  // d'abord les classes absentes du groupe, puis les autres génériques
  const pool = [...generic.filter((g) => !have.has(g.classKey)), ...generic.filter((g) => have.has(g.classKey))];
  return [...specs, ...pool].slice(0, PARTY_SIZE - 1);
}
