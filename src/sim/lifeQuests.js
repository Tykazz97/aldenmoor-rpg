// ============================================================
// Quêtes des joueurs simulés : ils lisent le même tableau que toi (boardFor), acceptent, progressent et rendent leurs quêtes
// avec les MÊMES fonctions (acceptQuest / completeQuest : récompenses, bonus de réputation, chaîne de quêtes). Leur état de
// quêtes (`life.quests`) a la forme exacte de `player.quests` (quêtes actives, faites du jour, réputation, compteurs).
//   - chasse : ils chassent en priorité l'ennemi demandé (la progression vient de leurs victoires, voir lives.js) ;
//   - récolte : la progression vient de leurs récoltes ;
//   - livraison : ils ne l'acceptent que s'ils ont déjà les ressources dans leur sac ;
//   - ni fabrication (pas encore), ni boss (pas encore).
// Sans React, testable.
// ============================================================
import { boardFor, acceptQuest, completeQuest, abandonQuest, progressOf, dayKey } from "../utils/quests.js";
import { MAX_ACTIVE_QUESTS } from "../data/quests.js";
import { ENEMIES } from "../data/zones.js";
import { emptyCounters } from "../utils/counters.js";

export const emptyQuests = () => ({ active: [], done: { day: -1, ids: [] }, rep: {}, chain: [], counters: emptyCounters() });
export const QUEST_STALE_DAYS = 2;                 // une quête non terminée au bout de 2 jours est abandonnée

// Les préférences de type de quête selon l'activité
const PREF = {
  combattant: { kill: 3, gather: 0.5, deliver: 1 }, recolteur: { kill: 0.5, gather: 3, deliver: 2 },
  marchand: { kill: 0.5, gather: 1, deliver: 3 }, flaneur: { kill: 1, gather: 1, deliver: 1 },
};

// Un joueur « de papier » pour appeler les fonctions de quêtes du jeu
const asPlayer = (life) => ({
  level: life.level, xp: life.xp, caracPoints: 0, caracs: {}, gold: life.gold, inventory: [],
  resources: { ...life.bag.res }, professions: { ...life.pro, [life.prof.key]: life.prof }, quests: life.quests || emptyQuests(),
});
function commit(life, p) {
  life.level = p.level; life.xp = p.xp; life.gold = p.gold; life.bag.res = p.resources; life.quests = p.quests;
}

// Compteurs d'activité (comme player.quests.counters) : la progression des quêtes de chasse, récolte et fabrication en dépend
export function bump(life, kind, id, n = 1) {
  const q = life.quests || (life.quests = emptyQuests());
  const c = q.counters || (q.counters = emptyCounters());
  const k = c[kind] || (c[kind] = {});
  k[id] = (k[id] || 0) + n;
}

// Ennemis que le simulé peut chasser dans sa région (jamais un mini-boss)
export const feasibleKill = (quest, pool) => !ENEMIES[quest.target]?.miniBoss && pool.has(quest.target);

// Un tour de quêtes : rend ce qui est terminé, abandonne ce qui traîne, puis en accepte une au besoin.
// `pool` : ensemble des ennemis de sa région ; renvoie le nombre de quêtes rendues.
export function questStep(life, bot, nowMs, rng, pool) {
  let p = asPlayer(life), done = 0;
  const day = dayKey(nowMs);
  for (const q of [...p.quests.active]) {
    if (progressOf(p, q).done) { const r = completeQuest(p, q.id, nowMs); if (r.ok) { p = r.player; done++; } }
    else if (day - (q.day ?? day) > QUEST_STALE_DAYS) { const r = abandonQuest(p, q.id); if (r.ok) p = r.player; }
  }
  if (p.quests.active.length < MAX_ACTIVE_QUESTS && rng() < 0.6) {
    const pref = PREF[bot.activity] || PREF.flaneur;
    const options = boardFor(p, nowMs).filter((q) => {
      if (q.type === "kill") return feasibleKill(q, pool);
      if (q.type === "deliver") return (p.resources[q.target] || 0) >= q.qty;
      return q.type === "gather";
    });
    if (options.length) {
      const q = rng.weighted(options.map((x) => [x, pref[x.type] || 1]));
      const r = acceptQuest(p, q.id, nowMs);
      if (r.ok) p = r.player;
    }
  }
  commit(life, p);
  return done;
}

// Ce que le simulé chasse en priorité (l'ennemi de sa quête de chasse en cours), sinon null
export function huntTarget(life) {
  const q = (life.quests?.active || []).find((a) => a.type === "kill");
  return q ? q.target : null;
}
