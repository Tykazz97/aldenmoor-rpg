// Équilibrage de l'attaque d'une sentinelle :  node scripts/simulate-sentinel.js [combats=60]
// Un joueur automatique (voir simulate-zones.js) attaque la sentinelle d'une guilde de son niveau, seul puis à trois (avec ses 2 alliés bots).
// Objectif : seul c'est dur (10 à 40 %), à trois la sentinelle abandonnée tombe presque toujours (≥ 90 %) ; les défenseurs rendront le combat plus serré.
import { CLASSES } from "../src/data/classes.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn } from "../src/combat/engine.js";
import { buildSpellBar } from "../src/utils/spellbook.js";
import { BUILDS, makeBotPlayer, botSpec } from "../src/sim/partyBots.js";
import { ensureSentinelEnemy, SENT_ROUNDS } from "../src/utils/sentinelFight.js";

const N = Number(process.argv[2]) || 60;
function pickSpell(state) {
  let best = null, bestScore = 0;
  for (const sp of state.player.spells) {
    if (sp.type === "buff" || sp.pa > state.player.pa) continue;
    const score = sp.power / sp.pa;
    if (score > bestScore) { best = sp; bestScore = score; }
  }
  return best;
}
export function fight(player, key, seed, party, maxRounds = SENT_ROUNDS) {
  const stats = calcStats(player);
  let st = createCombat({ stats, weaponType: BUILDS[player.classKey].wtype, classKey: player.classKey, level: player.level, enemyKeys: [key], spells: buildSpellBar(player), seed, maxRounds,
    allies: party ? Object.keys(CLASSES).filter((k) => k !== player.classKey).map((k) => botSpec(k, player.level)) : [] });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    st = castSpell(st, sp.id, st.enemies.find((e) => e.alive).id).state;
  }
  return st;
}
export function evaluate(classKey, level, party, n = N) {
  const player = makeBotPlayer(classKey, level), key = ensureSentinelEnemy(level);
  let wins = 0, hp = 0, rounds = 0;
  for (let seed = 1; seed <= n; seed++) { const e = fight(player, key, seed, party); if (e.phase === "victory") { wins++; hp += e.player.hp / e.player.maxHp; } rounds += e.round; }
  return { win: wins / n, hp: wins ? hp / wins : 0, rounds: rounds / n };
}
if (process.argv[1].endsWith("simulate-sentinel.js")) {
  for (const level of [3, 8, 14, 20, 30, 40]) {
    for (const classKey of Object.keys(CLASSES)) {
      const a = evaluate(classKey, level, false), b = evaluate(classKey, level, true);
      console.log(`niv ${String(level).padStart(2)} ${classKey.padEnd(9)} seul ${(a.win * 100).toFixed(0).padStart(3)} % (PV ${(a.hp * 100).toFixed(0)} %, ${a.rounds.toFixed(1)} tours)   à trois ${(b.win * 100).toFixed(0).padStart(3)} % (PV ${(b.hp * 100).toFixed(0)} %, ${b.rounds.toFixed(1)} tours)`);
    }
  }
}
