// ============================================================
// Simulation d'équilibrage :  node scripts/simulate-combat.js
// Un joueur automatique (il lance le sort le plus rentable, vise
// l'ennemi le plus faible) affronte les groupes de la Région 1
// avec différents équipements. Sert à repérer les déséquilibres
// grossiers avant de jouer à la main.
// ============================================================

import { ITEMS, SETS } from "../src/data/items.js";
import { CLASSES } from "../src/data/classes.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn } from "../src/combat/engine.js";

const N = Number(process.argv[2]) || 300;

function gear(ids) {
  const equipped = {};
  for (const id of ids) equipped[ITEMS[id].type] = ITEMS[id];
  return equipped;
}

// Niveau en argument (3e) : node scripts/simulate-combat.js 300 5
const LEVEL = Number(process.argv[3]) || 1;
const LOADOUTS = {
  "Guerrier arme seule (épée)": { items: ["epee_milicien"], weapon: "epee", cls: "guerrier" },
  "Assassin arme seule (dague)": { items: ["dague_ebrechee"], weapon: "dague", cls: "assassin" },
  "Magicien arme seule (bâton)": { items: ["baton_noueux"], weapon: "baton", cls: "magicien" },
  "Guerrier DÉPART RÉEL": { items: ["epee_milicien", ...SETS.veteran.pieces.slice(0, 2)], weapon: "epee", cls: "guerrier" },
  "Assassin DÉPART RÉEL": { items: ["dague_ebrechee", ...SETS.traqueur.pieces.slice(0, 2)], weapon: "dague", cls: "assassin" },
  "Magicien DÉPART RÉEL": { items: ["baton_noueux", ...SETS.apprenti.pieces.slice(0, 2)], weapon: "baton", cls: "magicien" },
  "Guerrier Vétéran+Épée+Bouc.": { items: [...SETS.veteran.pieces, "epee_milicien", "bouclier_milicien"], weapon: "epee", cls: "guerrier" },
  "Guerrier Vétéran+Masse": { items: [...SETS.veteran.pieces, "masse_rouillee"], weapon: "marteau", cls: "guerrier" },
  "Assassin Traqueur+Dague": { items: [...SETS.traqueur.pieces, "dague_ebrechee"], weapon: "dague", cls: "assassin" },
  "Assassin Traqueur+Arc": { items: [...SETS.traqueur.pieces, "arc_chasse"], weapon: "arc", cls: "assassin" },
  "Magicien Apprenti+Bâton": { items: [...SETS.apprenti.pieces, "baton_noueux"], weapon: "baton", cls: "magicien" },
};

const GROUPS = {
  "3 loups": ["loup_des_plaines", "loup_des_plaines", "loup_des_plaines"],
  "2 sangliers": ["sanglier_sauvage", "sanglier_sauvage"],
  "2 bandits + loup": ["bandit_des_routes", "bandit_des_routes", "loup_des_plaines"],
  "Cavalier Déchu": ["cavalier_dechu"],
};

// Choix du sort : meilleur dégât par PA ; on ignore les buffs
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

function fight(stats, lo, enemyKeys, seed) {
  let state = createCombat({ stats, weaponType: lo.weapon, classKey: lo.cls, level: LEVEL, enemyKeys, seed });
  let guard = 0;
  while (state.phase !== "victory" && state.phase !== "defeat" && guard++ < 20000) {
    if (state.phase === "running") { state = advance(state).state; continue; }
    const spell = pickSpell(state);
    if (!spell) { state = endTurn(state).state; continue; }
    const target = state.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    state = castSpell(state, spell.id, target.id).state;
  }
  return state;
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nSimulation : ${N} combats par case, joueur niveau ${LEVEL} (sorts de classe débloqués), caractéristiques de départ de la classe seulement.\n`);
console.log(pad("", 28) + Object.keys(GROUPS).map((g) => pad(g, 20)).join(""));

for (const [name, lo] of Object.entries(LOADOUTS)) {
  const stats = calcStats({ caracs: CLASSES[lo.cls].startCaracs, baseHp: 100, equipped: gear(lo.items) });
  const cells = Object.values(GROUPS).map((keys) => {
    let wins = 0, hpLeft = 0, turns = 0;
    for (let seed = 1; seed <= N; seed++) {
      const end = fight(stats, lo, keys, seed);
      if (end.phase === "victory") { wins++; hpLeft += end.player.hp / end.player.maxHp; }
      turns += end.turns;
    }
    const wr = Math.round((wins / N) * 100);
    const hp = wins ? Math.round((hpLeft / wins) * 100) : 0;
    return pad(`${wr}% (PV ${hp}%, ${(turns / N).toFixed(1)}t)`, 20);
  });
  console.log(pad(name, 28) + cells.join(""));
}
console.log("\nLecture : % de victoires (PV restants moyens en cas de victoire, nombre de tours du joueur).");
