// ============================================================
// Combat automatique d'un simulé (même moteur que le jeu) : sert à savoir s'il bat un boss. Sans React, testable.
// Un simulé joue comme le « joueur automatique » de scripts/simulate-zones.js : le sort le plus rentable (dégâts par PA) sur
// l'ennemi le plus faible. Il peut venir seul ou avec deux compagnons. Les résultats sont gardés en cache, car un même
// profil (classe, niveau, équipement, style) refait toujours le même combat : on estime sa chance de victoire une fois.
// ============================================================
import { createCombat, advance, castSpell, endTurn } from "../combat/engine.js";
import { calcStats } from "../utils/calcStats.js";
import { buildSpellBar } from "../utils/spellbook.js";
import { BUILDS, makeBotPlayer, botSpec, buildOf } from "./partyBots.js";
import { gearScore } from "./lifeCraft.js";

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

// Un combat complet ; renvoie l'état final ({ phase: "victory" | "defeat", ... })
export function autoFight(player, enemyKeys, seed, allies = []) {
  const stats = calcStats(player);
  let st = createCombat({ stats, weaponType: BUILDS[player.classKey].wtype, classKey: player.classKey, level: player.level, enemyKeys, spells: buildSpellBar(player), seed, allies });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    const target = st.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    st = castSpell(st, sp.id, target.id).state;
  }
  return st;
}

export const FIGHT_SAMPLES = 4;
const CACHE = new Map();
// Profils voisins partagent le même résultat : équipement arrondi à sa valeur totale (par paquets de 12), style arrondi
const sig = (gear) => Math.round(Object.values(gear || {}).reduce((n, id) => n + Math.max(0, gearScore(id)), 0) / 12);

// Chance de victoire d'un simulé (seul, ou avec `allies` = [classKey, classKey]) contre `enemyKeys`
export function winChance(bot, life, enemyKeys, allyClasses = []) {
  const style = buildOf(bot);
  const key = `${bot.classKey}|${life.level >> 1}|${sig(life.gear)}|${Math.round(style.main * 10)}|${style.extra}|${style.rankCap}|${enemyKeys.join("+")}|${allyClasses.join("+")}`;
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const player = makeBotPlayer(bot.classKey, life.level, life.gear, style);
  const allies = allyClasses.map((c) => botSpec(c, life.level));
  let wins = 0;
  for (let seed = 1; seed <= FIGHT_SAMPLES; seed++) if (autoFight(player, enemyKeys, seed, allies).phase === "victory") wins++;
  const p = wins / FIGHT_SAMPLES;
  CACHE.set(key, p);
  return p;
}
export const clearFightCache = () => CACHE.clear();
export const cacheSize = () => CACHE.size;
