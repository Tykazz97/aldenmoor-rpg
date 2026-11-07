// ============================================================
// Simulation d'équilibrage des ZONES :  node scripts/simulate-zones.js [combats=200]
//
// Un joueur automatique de niveau L affronte les rencontres de chaque zone. Il a :
//  - la caractéristique principale de sa classe + de la vitalité (65 % / 35 % des points gagnés),
//  - la meilleure panoplie de départ de sa classe + son arme,
//  - l'équipement de son palier (sets des 3 régions, voir BUILDS ci-dessous),
//  - ses points de sort investis dans ses meilleurs sorts, et la barre de combat du grimoire.
// Il lance le sort le plus rentable (dégâts par PA) sur l'ennemi le plus faible ; il n'utilise ni
// parade ni sorts de soutien : c'est donc un joueur plutôt prudent, un humain fait mieux.
//
// Objectifs de réglage (au niveau conseillé de la zone) : groupes ordinaires gagnés ≥ 85 %
// avec 35 à 70 % de PV restants ; mini-boss gagné 50 à 80 % ; et trop dur 3 niveaux plus bas.
// ============================================================

import { ITEMS, SETS } from "../src/data/items.js";
import { CLASSES } from "../src/data/classes.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn } from "../src/combat/engine.js";
import { POINTS_PER_LEVEL, FREE_VITALITE_PER_LEVEL } from "../src/data/caracs.js";
import { buildSpellBar, rankUp, spellPointsLeft, rankCost, loadoutOf } from "../src/utils/spellbook.js";

const N = Number(process.argv[2]) || 200;
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;      // ex. : node ... 200 loups,cavalier

// Équipement par palier (voir src/data/gearTiers.js) : palier 1 jusqu'au niveau 9, palier 2 de 10 à 15, palier 3 à partir de 16.
// (On suppose que le joueur a fabriqué le set de la région précédente avant d'attaquer la suivante.)
const BUILDS = {
  guerrier: { wtype: "epee", main: "force", tiers: [
    { weapon: "epee_milicien", set: "veteran", shield: "bouclier_milicien" },
    { weapon: "epee_fossoyeur", set: "fossoyeur", shield: "bouclier_fossoyeur" },
    { weapon: "epee_chevalier", set: "chevalier", shield: "bouclier_chevalier" },
  ] },
  assassin: { wtype: "dague", main: "agilite", tiers: [
    { weapon: "dague_ebrechee", set: "traqueur" }, { weapon: "dague_charognard", set: "charognard" }, { weapon: "dague_garou", set: "garou" },
  ] },
  magicien: { wtype: "baton", main: "intelligence", tiers: [
    { weapon: "baton_noueux", set: "apprenti" }, { weapon: "baton_brasier", set: "brasier" }, { weapon: "baton_esprit", set: "esprit" },
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

function makePlayer(classKey, level) {
  const cls = CLASSES[classKey], b = BUILDS[classKey];
  const pts = POINTS_PER_LEVEL * (level - 1);
  const mainPts = Math.round(pts * 0.65);
  const caracs = { ...cls.startCaracs };
  caracs[b.main] = (caracs[b.main] || 0) + mainPts;
  caracs.vitalite = (caracs.vitalite || 0) + (pts - mainPts) + FREE_VITALITE_PER_LEVEL * (level - 1);
  let p = { classKey, level, gold: 0, caracs, baseHp: 100, equipped: gear(b, level), spellbook: { ranks: {}, loadout: null } };
  // points de sort : sur le sort le plus rentable de la barre, jusqu'au rang 3, puis le suivant…
  for (let guard = 0; guard < 200 && spellPointsLeft(p) > 0; guard++) {
    const bar = buildSpellBar(p).filter((s) => s.type !== "buff" && s.rank < 3);
    bar.sort((a, c) => (c.power * (c.aoe ? 2 : 1)) / c.pa - (a.power * (a.aoe ? 2 : 1)) / a.pa);
    const target = bar.find((s) => rankCost(s.rank) <= spellPointsLeft(p));
    if (!target) break;
    p = rankUp(p, target.id);
  }
  return p;
}

function pickSpell(state) {
  const living = state.enemies.filter((e) => e.alive).length;
  let best = null, bestScore = 0;
  for (const sp of state.player.spells) {
    if (sp.type === "buff" || sp.pa > state.player.pa) continue;
    const score = (sp.power * (sp.aoe ? living : 1)) / sp.pa;
    if (score > bestScore) { best = sp; bestScore = score; }
  }
  return best;
}

function fight(player, enemyKeys, seed) {
  const stats = calcStats(player);
  let st = createCombat({ stats, weaponType: BUILDS[player.classKey].wtype, classKey: player.classKey, level: player.level, enemyKeys, spells: buildSpellBar(player), seed });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    const target = st.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    st = castSpell(st, sp.id, target.id).state;
  }
  return st;
}

export function evaluate(classKey, level, enc, n = N) {
  const player = makePlayer(classKey, level);
  let wins = 0, hpLeft = 0, turns = 0;
  for (let seed = 1; seed <= n; seed++) {
    const end = fight(player, enc.enemies, seed);
    if (end.phase === "victory") { wins++; hpLeft += end.player.hp / end.player.maxHp; }
    turns += end.turns;
  }
  return { win: wins / n, hp: wins ? hpLeft / wins : 0, turns: turns / n };
}

// Niveaux testés par rencontre : [niveau conseillé bas, milieu, haut] de la zone, plus 3 niveaux sous le bas
export const PLAN = {
  loups: [1, 4, 8], sangliers: [1, 4, 8], bandits: [3, 6, 9], prairie: [4, 7, 10], cavalier: [6, 9, 12],
  squelettes: [8, 11, 14], corbeaux: [8, 11, 14], epouvantails: [8, 11, 14], champs: [9, 12, 15], epouvantail_boss: [10, 12, 14],
  garous: [14, 17, 20], esprits: [14, 17, 20], chevaliers: [14, 17, 20], lisiere: [16, 18, 20], veilleur_boss: [18, 20, 22],
};

if (process.argv[1].endsWith("simulate-zones.js")) {
  const pad = (s, n) => String(s).padEnd(n);
  const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
  console.log(`\n${N} combats par case. Case = victoires (PV restants moyens) · niveaux ${"bas / milieu / haut"} de la zone (+ 3 niveaux sous le bas)\n`);
  for (const enc of ENCOUNTERS) {
    const levels = PLAN[enc.id];
    if (!levels || (ONLY && !ONLY.includes(enc.id))) continue;
    console.log(`${enc.name}  [${enc.enemies.join(", ")}]  niveaux ${levels.join(" / ")}`);
    for (const cls of Object.keys(CLASSES)) {
      const cells = [Math.max(1, levels[0] - 3), ...levels].map((lv) => {
        const r = evaluate(cls, lv, enc);
        return pad(`niv ${lv}: ${pct(r.win)} (${pct(r.hp)})`, 21);
      });
      console.log("  " + pad(cls, 10) + cells.join(""));
    }
  }
}
