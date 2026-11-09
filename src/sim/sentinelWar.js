// ============================================================
// La guerre des sentinelles : les guildes simulées attaquent la sentinelle de la guilde du joueur. Sans React, déterministe.
//   - une fois par heure, une guilde simulée peut lancer une attaque (ses membres connectés, 1 à 3) : `g.attacks` de la guilde visée
//     reçoit une alerte avec un compte à rebours (`WAR_DELAY_STEPS` pas de 10 minutes) ; le journal de la guilde en parle ;
//   - à l'échéance (sauf si le joueur a pris la défense, `a.hold`), le combat est réglé tout seul : les attaquants contre la sentinelle et ses
//     défenseurs (les membres connectés de la guilde visée), avec les mêmes règles que le combat du joueur (`autoFight`) ;
//   - les attaquants gagnent : la sentinelle disparaît et son or est partagé au hasard entre eux (les ressources sont perdues) ;
//     les défenseurs gagnent : la sentinelle est intouchable pendant 1 h.
// ============================================================
import { hashString, makeRng } from "./rng.js";
import { liveBots, isActive, STEP_MS } from "./lives.js";
import { BUILDS, makeBotPlayer, botSpec, buildOf } from "./partyBots.js";
import { calcStats } from "../utils/calcStats.js";
import { buildSpellBar } from "../utils/spellbook.js";
import { createCombat, advance, castSpell, endTurn } from "../combat/engine.js";
import { logOf } from "../utils/guildCore.js";
import { sentinelsOf, removeSentinel, rebuildSent } from "../utils/sentinel.js";
import { SENT_BY_KEY, SENT_REGIONS } from "../data/sentinel.js";
import { ensureSentinelEnemy, SENT_ROUNDS, SENT_SHIELD_MS } from "../utils/sentinelFight.js";
import { defenderBots, ensureDefenderEnemy, plusOf } from "../utils/sentinelDefense.js";

export const WAR_DELAY_MS = 3 * 60 * 1000;     // de l'alerte au combat : 3 minutes (le jeu ouvert règle l'attaque à la minute près : `resolveDueAttacksNow`)
export const WAR_DELAY_STEPS = 1;          // hors connexion, le monde se rattrape par pas de 10 minutes : l'attaque est réglée au pas suivant
export const WAR_P = 0.02;                 // par heure et par guilde simulée : une attaque environ tous les 2 jours chacune
export const WAR_COOLDOWN_STEPS = 48;      // une guilde visée n'est pas attaquée plus d'une fois toutes les 8 h
export const WAR_SOLO_P = 0.3;             // un seul attaquant disponible : il ne s'y risque qu'une fois sur trois
export const ATTACKERS_MAX = 3;

const minLevelOf = (r) => Number((String(r.levels).match(/\d+/) || [1])[0]);   // « Niveaux 8 à 14 » : 8
const h01 = (s) => hashString(s) / 4294967296;

// Le joueur automatique d'un combat : il lance le sort le plus rentable (PA) sur le premier ennemi vivant, la sentinelle d'abord
function pickSpell(state) {
  let best = null, bestScore = 0;
  for (const sp of state.player.spells) {
    if (sp.type === "buff" || sp.pa > state.player.pa) continue;
    const score = sp.power / sp.pa;
    if (score > bestScore) { best = sp; bestScore = score; }
  }
  return best;
}

// Joue tout un combat d'attaque : `attackers` = 1 à 3 simulés (le premier tient les commandes, les autres sont ses alliés)
export function autoFight(attackers, enemyKeys, seed) {
  const [lead, ...rest] = attackers;
  const player = makeBotPlayer(lead.classKey, lead.level, lead.life?.gear || null, buildOf(lead), plusOf(lead));
  const allies = rest.map((b) => botSpec(b.classKey, b.level, { name: b.name, look: b.look, gear: b.life?.gear, style: buildOf(b), plus: plusOf(b) }));
  let st = createCombat({ stats: calcStats(player), weaponType: BUILDS[lead.classKey].wtype, classKey: lead.classKey, level: lead.level, enemyKeys, spells: buildSpellBar(player), seed, maxRounds: SENT_ROUNDS, objective: "sentinel", allies });
  for (let guard = 0; st.phase !== "victory" && st.phase !== "defeat" && guard < 20000; guard++) {
    if (st.phase === "running") { st = advance(st).state; continue; }
    const sp = pickSpell(st);
    if (!sp) { st = endTurn(st).state; continue; }
    st = castSpell(st, sp.id, st.enemies.find((e) => e.alive).id).state;
  }
  return st;
}

const playerGuild = (G) => (G.of?.player && G.byId[G.of.player]) || null;
const nameOf = (G, id) => G.byId[id]?.name || "une guilde";

// L'heure du combat : 3 minutes après l'alerte. En direct (on joue pendant ce pas), à partir de maintenant ; en rattrapage (le monde se remet à
// l'heure après une absence), à partir du pas où l'attaque a été lancée.
const dueMsAt = (step) => (Math.abs(Date.now() - step * STEP_MS) < 2 * STEP_MS ? Date.now() : step * STEP_MS) + WAR_DELAY_MS;

// ---- lancer des attaques (chaque heure) ----
export function launchWars(sims, G, population, step) {
  const T = playerGuild(G);
  if (!T || !T.sentinels) return;
  if (T.lastWar != null && step - T.lastWar < WAR_COOLDOWN_STEPS) return;
  if ((T.attacks || []).length) return;
  const now = step * STEP_MS;
  const free = Object.keys(sentinelsOf(T)).filter((k) => !((sentinelsOf(T)[k].shield || 0) > now));
  if (!free.length) return;
  let live = null;
  for (const A of Object.values(G.byId)) {
    if (A.id === T.id || A.members.player || A.leader === "player") continue;
    if (h01(`war:${A.id}:${step}`) >= WAR_P) continue;
    const region = free[hashString(`war:r:${A.id}:${step}`) % free.length], r = SENT_BY_KEY[region];
    live = live || liveBots(sims, population);
    const pool = live.filter((b) => A.members[b.id] && b.level >= minLevelOf(r) && isActive(b, step))
      .map((b) => ({ b, k: hashString(`war:a:${A.id}:${step}:${b.id}`) })).sort((x, y) => x.k - y.k).slice(0, ATTACKERS_MAX).map((x) => x.b);
    if (!pool.length || (pool.length === 1 && h01(`war:s:${A.id}:${step}`) >= WAR_SOLO_P)) continue;
    T.attacks = [{ id: `${A.id}:${step}`, region, from: A.id, by: pool.map((b) => b.id), at: step, due: step + WAR_DELAY_STEPS, dueMs: dueMsAt(step) }];
    T.lastWar = step;
    logOf(T, step, `Alerte : ${pool.length} membre${pool.length > 1 ? "s" : ""} de ${A.name} attaquent ta sentinelle de ${r.name} !`);
    return;                                                      // une attaque à la fois sur la guilde visée
  }
}

// ---- régler les attaques arrivées à échéance (chaque pas) ----
export function resolveWars(sims, G, population, step) {
  const T = playerGuild(G);
  if (!T || !T.attacks || !T.attacks.length) return;
  const ready = (a) => a.due <= step && !(a.hold > step);          // `hold` : le pas jusqu'auquel le joueur a pris la défense en main (son combat est en cours)
  const due = T.attacks.filter(ready), keep = T.attacks.filter((a) => !ready(a));
  if (!due.length) return;
  if (keep.length) T.attacks = keep; else delete T.attacks;
  const live = liveBots(sims, population);
  for (const a of due) settleAttack(G, T, a, live, sims, step);
}

// Règle une attaque avec les membres connectés comme défenseurs. `live` : la population vivante ; `forced` : "att" ou "def" quand le joueur a
// joué le combat lui-même (l'issue est alors connue)
export function settleAttack(G, T, a, live, sims, step, forced = null) {
  const s = sentinelsOf(T)[a.region], r = SENT_BY_KEY[a.region];
  if (!s) return null;                                           // déjà tombée ou retirée entre-temps
  const byId = new Map(live.map((b) => [b.id, b]));
  const attackers = a.by.map((id) => byId.get(id)).filter(Boolean);
  const from = nameOf(G, a.from);
  if (!attackers.length) return null;
  const defenders = defenderBots(T, live, step * STEP_MS).filter((b) => !a.by.includes(b.id));
  const enemyKeys = [ensureSentinelEnemy(T), ...defenders.map(ensureDefenderEnemy)];
  const won = forced ? forced === "att" : autoFight(attackers, enemyKeys, hashString(a.id)).phase === "victory";
  if (won) {
    const gold = Math.floor(s.gold || 0), rng = makeRng(hashString(`war:loot:${a.id}`));
    const w = attackers.map(() => rng() + 0.2), tot = w.reduce((x, y) => x + y, 0);
    attackers.forEach((b, i) => { const part = Math.floor(gold * w[i] / tot); if (b.life && sims.lives[b.id]) sims.lives[b.id].gold += part; });
    removeSentinel(G, T, a.region, step);
    logOf(T, step, `Ta sentinelle de ${r.name} a été détruite par ${from} (${gold} or perdu${defenders.length ? `, ${defenders.length} défenseur${defenders.length > 1 ? "s" : ""} ne l'ont pas sauvée` : ", personne ne la défendait"}).`);
    if (G.byId[a.from]) logOf(G.byId[a.from], step, `Votre attaque contre la sentinelle de ${T.name} sur ${r.name} a réussi.`);
    rebuildSent(G);
    return { won: "att", gold };
  }
  s.shield = step * STEP_MS + SENT_SHIELD_MS;
  logOf(T, step, `Ta sentinelle de ${r.name} a repoussé l'attaque de ${from}${defenders.length ? ` avec ${defenders.length} défenseur${defenders.length > 1 ? "s" : ""}` : " toute seule"} : elle est protégée pendant 1 h.`);
  if (G.byId[a.from]) logOf(G.byId[a.from], step, `Votre attaque contre la sentinelle de ${T.name} sur ${r.name} a échoué.`);
  return { won: "def" };
}
