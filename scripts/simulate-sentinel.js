// Équilibrage de l'attaque d'une sentinelle :  node scripts/simulate-sentinel.js [combats=30]
// Un joueur automatique (voir simulate-zones.js) attaque la sentinelle d'une guilde de son niveau, seul puis à trois (avec ses 2 alliés bots).
// Objectif : seul c'est dur (10 à 40 %), à trois la sentinelle abandonnée tombe presque toujours (≥ 90 %) ; les défenseurs rendront le combat plus serré.
import { CLASSES } from "../src/data/classes.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn } from "../src/combat/engine.js";
import { buildSpellBar } from "../src/utils/spellbook.js";
import { BUILDS, makeBotPlayer, botSpec } from "../src/sim/partyBots.js";
import { ensureSentinelEnemy, SENT_ROUNDS } from "../src/utils/sentinelFight.js";
import { totalPoints } from "../src/utils/sentinelBuild.js";
import { SENT_STAT_KEYS } from "../src/data/sentinel.js";

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
// Une guilde de ce niveau avec une répartition de points : "equilibre" (20 % partout), "aucun", "vitalite" / "force" / "defense" (60 % + le reste ailleurs)
export function guildWith(level, plan = "equilibre") {
  const t = totalPoints(level), pts = Object.fromEntries(SENT_STAT_KEYS.map((k) => [k, 0]));
  if (plan === "equilibre") for (const k of SENT_STAT_KEYS) pts[k] = Math.floor(t / SENT_STAT_KEYS.length);
  else if (plan !== "aucun") { pts[plan] = Math.ceil(t * 0.6); pts[plan === "chance" ? "vitalite" : "chance"] = t - pts[plan]; }
  return { id: `sim-${plan}-${level}`, level, sentBuild: { pts } };
}
export function evaluate(classKey, level, party, n = N, plan = "equilibre") {
  const player = makeBotPlayer(classKey, level), key = ensureSentinelEnemy(guildWith(level, plan));
  let wins = 0, hp = 0, rounds = 0;
  for (let seed = 1; seed <= n; seed++) { const e = fight(player, key, seed, party); if (e.phase === "victory") { wins++; hp += e.player.hp / e.player.maxHp; } rounds += e.round; }
  return { win: wins / n, hp: wins ? hp / wins : 0, rounds: rounds / n };
}
if (process.argv[1].endsWith("simulate-sentinel.js")) {
  for (const level of [5, 10, 20, 30, 50]) {
    for (const plan of ["aucun", "equilibre", "vitalite", "force", "defense"]) {
      const cells = ["guerrier", "assassin", "magicien"].map((c) => { const a = evaluate(c, level, false, N, plan), b = evaluate(c, level, true, N, plan); return `${c.slice(0, 3)} ${(a.win * 100).toFixed(0).padStart(3)}/${(b.win * 100).toFixed(0).padStart(3)} %`; });
      const b = evaluate("guerrier", level, true, N, plan);
      console.log(`niv ${String(level).padStart(2)} ${plan.padEnd(9)} seul/à trois : ${cells.join("   ")}   (à trois : ${b.rounds.toFixed(1)} tours)`);
    }
  }
}
