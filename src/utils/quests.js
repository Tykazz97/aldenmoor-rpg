// ============================================================
// Quêtes d'Aldenmoor et réputation de la ville (sans React).
// player.quests = { counters, active: [quête...], done: { day, ids }, rep: { aldenmoor: xp } }
//   - Le tableau change chaque jour (même jour = même tableau) ; on y accepte jusqu'à MAX_ACTIVE_QUESTS quêtes et on y rend ses quêtes.
//   - Kill/récolte/fabrication se mesurent avec les compteurs d'activité : seul ce qui est fait APRÈS l'acceptation compte.
//   - Livraison : la ressource est prise dans le sac à la remise (on peut donc l'acheter au marché).
//   - La réputation d'Aldenmoor monte avec les quêtes ; chaque niveau améliore les récompenses d'or, et tous les deux niveaux le coffre gagne 5 emplacements.
// ============================================================
import { QUEST_TEMPLATES, CHAIN_QUESTS, TOWN, MAX_STANDING, standingXpForLevel, STANDING_TITLES, MAX_ACTIVE_QUESTS, BOARD_SIZE } from "../data/quests.js";
import { RESOURCES } from "../data/resources.js";
import { ITEMS } from "../data/items.js";
import { RECIPES } from "../data/recipes.js";
import { ENEMIES } from "../data/zones.js";
import { NODES, NODE_ORDER } from "../data/gathering.js";
import { getCraftInfo } from "../data/professions.js";
import { REFINING } from "../data/refining.js";
import { makeRng, hashString } from "../sim/rng.js";
import { gainXp } from "./progression.js";
import { counterValue } from "./counters.js";

const KIND = { kill: "kills", gather: "gathered", craft: "crafted" };
const avg = (a, b) => (a + b) / 2;

export const questsOf = (player) => ({ active: [], done: { day: -1, ids: [] }, rep: {}, chain: [], ...(player.quests || {}) });

// Jour local (change à minuit, heure du joueur)
export const dayKey = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

// ---------- réputation ----------
export function standingOf(player, town = TOWN.id) {
  let xp = questsOf(player).rep[town] || 0, level = 1;
  while (level < MAX_STANDING && xp >= standingXpForLevel(level)) { xp -= standingXpForLevel(level); level++; }
  const max = level >= MAX_STANDING;
  return { level, xp: max ? 0 : xp, next: max ? null : standingXpForLevel(level), max, title: STANDING_TITLES[level - 1] };
}
// Avantages de la réputation d'Aldenmoor
export function perksOf(player) {
  const { level } = standingOf(player);
  return { bankSlots: 5 * Math.floor((level - 1) / 2), goldBonus: 0.03 * (level - 1) };
}

// ---------- définition d'une quête ----------
const nodeFor = (resourceId) => NODE_ORDER.map((id) => NODES[id]).find((n) => n.resource === resourceId);

function reward(tpl, target, qty) {
  let gold, xp, rep;
  if (tpl.type === "kill") {
    const def = ENEMIES[target];
    gold = qty * avg(...def.gold) * 1.2; xp = qty * def.xp * 0.8; rep = tpl.id === "kill_cavalier" ? 30 : 3 + qty * 0.6;
  } else if (tpl.type === "gather") {
    gold = qty * RESOURCES[target].value * 1.2; xp = qty * 2; rep = 3 + qty * 0.35;
  } else if (tpl.type === "deliver") {
    const v = RESOURCES[target].value;
    gold = qty * v * 1.1; xp = qty * 1.5; rep = Math.min(15, 3 + (qty * v) / 14);
  } else {
    const rec = RECIPES[target];
    const value = Object.entries(rec.ingredients).reduce((s, [r, q]) => s + RESOURCES[r].value * q, 0) + rec.gold;
    gold = value * 0.5; xp = 20; rep = 8;
  }
  return { gold: Math.max(5, Math.round(gold)), xp: Math.round(xp), rep: Math.round(rep) };
}

function build(tpl, day) {
  const r = makeRng(hashString(`q:${day}:${tpl.id}`));
  const qty = r.int(tpl.qty[0], tpl.qty[1]);
  return { id: `${day}:${tpl.id}`, tpl: tpl.id, day, type: tpl.type, target: tpl.target, qty, title: tpl.title, text: tpl.text, rewards: reward(tpl, tpl.target, qty) };
}

function buildChain(c) {
  const base = reward({ type: c.type, id: c.id }, c.target, c.qty);
  const rewards = c.rewards || { gold: Math.round(base.gold * 1.5), xp: Math.round(base.xp * 1.5), rep: Math.round(base.rep * 1.5) + 10 };
  return { id: `chain:${c.id}`, tpl: c.id, chain: true, type: c.type, target: c.target, qty: c.qty, title: c.title, text: c.text, rewards };
}

// Le joueur peut-il faire cette quête ? (niveau de métier, ennemi connu)
function eligible(player, q) {
  if (q.type === "gather") { const n = nodeFor(q.target); return !!n && (player.professions?.[n.profession]?.level ?? 1) >= n.minLevel; }
  if (q.type === "deliver" && REFINING[q.target]) return (player.professions?.[REFINING[q.target].profession]?.level ?? 1) >= REFINING[q.target].minLevel;
  if (q.type === "craft") { const i = getCraftInfo(q.target); return !!i && (player.professions?.[i.profession]?.level ?? 1) >= i.minLevel; }
  return true;
}

export const questLabel = (q) => {
  if (q.type === "kill") return `Vaincre ${q.qty} × ${ENEMIES[q.target].name}`;
  if (q.type === "gather") return `Récolter ${q.qty} × ${RESOURCES[q.target].name}`;
  if (q.type === "deliver") return `Rapporter ${q.qty} × ${RESOURCES[q.target].name}`;
  return `Fabriquer : ${ITEMS[q.target].name}`;
};

// Tableau du jour : modèles tirés selon le jour, sans les quêtes déjà prises ou rendues aujourd'hui
export function boardFor(player, now = Date.now()) {
  const day = dayKey(now), r = makeRng(hashString(`board:${day}`));
  const pool = QUEST_TEMPLATES.filter((t) => t.type !== "craft" || (RECIPES[t.target] && getCraftInfo(t.target)));
  const picked = [];
  const left = pool.slice();
  while (picked.length < BOARD_SIZE && left.length) {
    const t = r.weighted(left.map((x) => [x, x.weight]));
    picked.push(t); left.splice(left.indexOf(t), 1);
  }
  const q = questsOf(player), taken = new Set([...q.active.map((a) => a.id), ...(q.done.day === day ? q.done.ids : [])]);
  const daily = picked.map((t) => build(t, day)).filter((x) => !taken.has(x.id) && eligible(player, x));
  // chaîne de quêtes : la prochaine étape non faite, si le joueur a le niveau
  const doneChain = q.chain || [];
  const chain = CHAIN_QUESTS
    .filter((c) => !doneChain.includes(c.id) && (!c.requires || doneChain.includes(c.requires)) && (player.level || 1) >= c.minLevel)
    .map(buildChain).filter((x) => !taken.has(x.id));
  return [...chain, ...daily];
}

// ---------- progression ----------
export function progressOf(player, quest) {
  const need = quest.qty;
  const have = quest.type === "deliver" ? player.resources[quest.target] || 0 : Math.max(0, counterValue(player, KIND[quest.type], quest.target) - (quest.base || 0));
  return { have: Math.min(have, need), need, done: have >= need };
}

// ---------- actions ----------
const fail = (player, reason) => ({ ok: false, reason, player });

export function acceptQuest(player, questId, now = Date.now()) {
  const q = questsOf(player);
  if (q.active.length >= MAX_ACTIVE_QUESTS) return fail(player, "limite");
  const quest = boardFor(player, now).find((x) => x.id === questId);
  if (!quest) return fail(player, "introuvable");
  const base = quest.type === "deliver" ? 0 : counterValue(player, KIND[quest.type], quest.target);
  return { ok: true, quest, player: { ...player, quests: { ...q, active: [...q.active, { ...quest, base }] } } };
}

export function abandonQuest(player, questId) {
  const q = questsOf(player);
  if (!q.active.some((a) => a.id === questId)) return fail(player, "introuvable");
  return { ok: true, player: { ...player, quests: { ...q, active: q.active.filter((a) => a.id !== questId) } } };
}

// Rend une quête terminée : retire les ressources livrées, donne or (avec bonus de réputation), xp et réputation
export function completeQuest(player, questId, now = Date.now()) {
  const q = questsOf(player), quest = q.active.find((a) => a.id === questId);
  if (!quest) return fail(player, "introuvable");
  if (!progressOf(player, quest).done) return fail(player, "incomplete");
  const before = standingOf(player).level;
  let resources = player.resources;
  if (quest.type === "deliver") {
    resources = { ...resources, [quest.target]: (resources[quest.target] || 0) - quest.qty };
    if (resources[quest.target] <= 0) delete resources[quest.target];
  }
  const gold = Math.round(quest.rewards.gold * (1 + perksOf(player).goldBonus)), day = dayKey(now);
  const done = quest.chain ? q.done : q.done.day === day ? { day, ids: [...q.done.ids, quest.id] } : { day, ids: [quest.id] };
  const chain = quest.chain ? [...(q.chain || []), quest.tpl] : q.chain || [];
  let next = {
    ...player, resources, gold: player.gold + gold,
    quests: { ...q, chain, active: q.active.filter((a) => a.id !== quest.id), done, rep: { ...q.rep, [TOWN.id]: (q.rep[TOWN.id] || 0) + quest.rewards.rep } },
  };
  const g = gainXp(next, quest.rewards.xp);
  next = g.player;
  const after = standingOf(next).level;
  return { ok: true, quest, player: next, gold, xp: quest.rewards.xp, rep: quest.rewards.rep, levelUp: g.levelsGained > 0, standingUp: after > before ? after : null };
}
