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
import { autoDrink, POTION_IDS } from "../utils/potions.js";

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
export function autoFight(player, enemyKeys, seed, allies = [], carry = null) {
  const stats = calcStats(player);
  let st = createCombat({ stats, weaponType: BUILDS[player.classKey].wtype, classKey: player.classKey, level: player.level, enemyKeys, spells: buildSpellBar(player), seed, allies, carry });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    const target = st.enemies.filter((e) => e.alive).sort((a, b) => a.hp - b.hp)[0];
    st = castSpell(st, sp.id, target.id).state;
  }
  return st;
}

// Un donjon : les salles à la suite, PV reportés d'une salle à l'autre (un héros tombé se relève avec 20 % de ses PV max).
// Renvoie { cleared, rooms (nombre de salles gagnées), rewards (butin cumulé des salles gagnées), hp (PV à la fin) }.
// `potions` : { idPotion: quantité } qu'il peut boire entre deux salles (comme toi : à volonté, jusqu'à épuisement du sac) ; `used` dit ce qui a été bu.
export function autoDungeon(player, allies, rooms, seed, potions = null) {
  const rewards = { xp: 0, gold: 0, resources: {}, items: [], kills: {} };
  let carry = null, won = 0, hp = null;
  const used = {};
  for (const room of rooms) {
    const st = autoFight(player, room.enemies, seed * 31 + won, allies, carry);
    hp = { player: st.player.hp, allies: st.allies.map((a) => a.hp) };
    if (st.phase !== "victory") return { cleared: false, rooms: won, rewards, hp, used };
    const r = st.rewards;
    rewards.xp += r.xp; rewards.gold += r.gold;
    for (const [k, v] of Object.entries(r.resources)) rewards.resources[k] = (rewards.resources[k] || 0) + v;
    rewards.items.push(...r.items);
    for (const [k, v] of Object.entries(r.kills)) rewards.kills[k] = (rewards.kills[k] || 0) + v;
    carry = hp; won++;
    if (potions && won < rooms.length) {                              // la pause entre deux salles : il boit
      const stock = Object.fromEntries(Object.entries(potions).map(([id, q]) => [id, q - (used[id] || 0)]));
      const drink = autoDrink([st.player, ...st.allies].map((h) => ({ hp: h.hp, maxHp: h.maxHp })), stock);
      for (const [id, q] of Object.entries(drink.used)) used[id] = (used[id] || 0) + q;
      carry = { player: drink.party[0].hp, allies: drink.party.slice(1).map((h) => h.hp) };
    }
  }
  return { cleared: true, rooms: won, rewards, hp, used };
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

// Un donjon en groupe : probabilité de s'arrêter après n salles gagnées (n = 0 … nombre de salles ; la dernière = tout fini)
export const DUNGEON_SAMPLES = 4;
// Le sac de potions pris en compte par l'estimation : arrondi par paliers (0, 2, 4, 6 de chaque) pour que des profils voisins partagent le même résultat
export const kitBucket = (n) => (n >= 6 ? 6 : n >= 3 ? 4 : n >= 1 ? 2 : 0);
export const kitOfBag = (res = {}) => Object.fromEntries(POTION_IDS.map((id) => [id, kitBucket(res[id] || 0)]).filter(([, q]) => q > 0));
const DJ_CACHE = new Map();
// `kit` : les potions qu'il emporte (voir kitOfBag). Le résultat porte aussi `.used` : potions bues en moyenne par expédition.
export function dungeonOdds(bot, life, dungeon, allyClasses, kit = {}) {
  const style = buildOf(bot);
  const key = `${dungeon.key}|${bot.classKey}|${life.level >> 1}|${sig(life.gear)}${life.gear?.relique1 ? "R" : ""}|${Math.round(style.main * 10)}|${style.extra}|${style.rankCap}|${allyClasses.join("+")}|${POTION_IDS.map((id) => kit[id] || 0).join(",")}`;
  const hit = DJ_CACHE.get(key);
  if (hit) return hit;
  const player = makeBotPlayer(bot.classKey, life.level, life.gear, style);
  const allies = allyClasses.map((c) => botSpec(c, life.level));
  const reached = Array(dungeon.rooms.length + 1).fill(0);
  const usedSum = {};
  for (let seed = 1; seed <= DUNGEON_SAMPLES; seed++) {
    const r = autoDungeon(player, allies, dungeon.rooms, seed, kit);
    reached[r.rooms]++;
    for (const [id, q] of Object.entries(r.used)) usedSum[id] = (usedSum[id] || 0) + q;
  }
  const odds = reached.map((n) => n / DUNGEON_SAMPLES);
  odds.used = Object.fromEntries(Object.entries(usedSum).map(([id, q]) => [id, q / DUNGEON_SAMPLES]));
  DJ_CACHE.set(key, odds);
  return odds;
}
export const clearFightCache = () => { CACHE.clear(); DJ_CACHE.clear(); };
export const cacheSize = () => CACHE.size + DJ_CACHE.size;
