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
import { buildSpellBar } from "../src/utils/spellbook.js";
import { BUILDS, tierOf, makeBotPlayer, botSpec } from "../src/sim/partyBots.js";

const N = Number(process.argv[2]) || 200;
const ONLY = process.argv[3] && process.argv[3] !== "-" ? process.argv[3].split(",") : null;
const PARTY = process.argv.includes("--groupe");      // le héros est accompagné de ses 2 alliés bots (les deux autres classes)
// (ex. : node scripts/simulate-zones.js 200 loups,cavalier --groupe)

// Joueur automatique et équipement par palier : voir src/sim/partyBots.js (les alliés bots des groupes l'utilisent aussi).
const makePlayer = makeBotPlayer;

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

function fight(player, enemyKeys, seed, party = false) {
  const stats = calcStats(player);
  let st = createCombat({ stats, weaponType: BUILDS[player.classKey].wtype, classKey: player.classKey, level: player.level, enemyKeys, spells: buildSpellBar(player), seed,
    allies: party ? Object.keys(CLASSES).filter((k) => k !== player.classKey).map((k) => botSpec(k, player.level)) : [] });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    const target = st.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    st = castSpell(st, sp.id, target.id).state;
  }
  return st;
}

export function evaluate(classKey, level, enc, n = N, party = false) {
  const player = makePlayer(classKey, level);
  let wins = 0, hpLeft = 0, turns = 0;
  for (let seed = 1; seed <= n; seed++) {
    const end = fight(player, enc.enemies, seed, party);
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
        const r = evaluate(cls, lv, enc, N, PARTY);
        return pad(`niv ${lv}: ${pct(r.win)} (${pct(r.hp)})`, 21);
      });
      console.log("  " + pad(cls, 10) + cells.join(""));
    }
  }
}
