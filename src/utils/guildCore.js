// ============================================================
// Guildes : le cœur des règles, sur les données (sans React, sans marché). Utilisé par les simulés (sim/guilds.js) et par le joueur
// (utils/guildActions.js). Les guildes vivent dans `sims.guilds` (le monde des simulés, rangé dans la sauvegarde du joueur) :
//   G = { v:1, seq, byId: { [idGuilde]: guilde }, of: { [idMembre]: idGuilde } }   (le joueur a l'id "player")
//   guilde = { id, name, tag, leader, founded (pas), level, xp, gold (caisse), pal (paliers débloqués), tabs (onglets achetés),
//              bank: [ { res: { id: qté }, items: [objet] } ... ] (un par onglet acheté),
//              quests: [ { id, type, goal, got, xp, gold } ], qseq, members: { [id]: { j (arrivée, en pas), k, g, c (compteurs de
//              départ), pl (pas joués vus), n (points de contribution) } }, log: [ { t (pas), txt } ] }
// Tout est déterministe : mêmes données, mêmes noms, mêmes quêtes.
// ============================================================
import { cleanEmblem, randomEmblem } from "../data/emblems.js";
import {
  GUILD_MAX_MEMBERS, GUILD_MAX_LEVEL, GUILD_NAME_MIN, GUILD_NAME_MAX, guildXpToNext, PALIERS, TABS, TAB_SLOTS,
  QUEST_SLOTS, QUEST_TYPES, QUEST_LEVEL_GROWTH, QUEST_MIN_MEMBERS, LOG_MAX, NAME_FIRST, NAME_LAST, RANK_POWER, CAN_SPEND, CAN_WITHDRAW,
} from "../data/guild.js";
import { makeRng, hashString } from "../sim/rng.js";

export const newGuilds = () => ({ v: 1, seq: 1, byId: {}, of: {} });
export const memberCount = (g) => Object.keys(g.members).length;
export const isFull = (g) => memberCount(g) >= GUILD_MAX_MEMBERS;
export const guildFor = (G, id) => (G?.of?.[id] && G.byId[G.of[id]]) || null;

// ---- compteurs d'activité d'un membre ----
// Les compteurs de quêtes (kills, gathered, crafted) existent pour le joueur et pour chaque simulé, avec la même forme.
const sum = (o) => { let n = 0; for (const k in o) n += o[k] || 0; return n; };
export const activityOf = (quests) => {
  const c = quests?.counters;
  return c ? { k: sum(c.kills), g: sum(c.gathered), c: sum(c.crafted) } : { k: 0, g: 0, c: 0 };
};

// ---- noms ----
export const cleanName = (name) => String(name ?? "").replace(/\s+/g, " ").trim();
export const nameTaken = (G, name) => Object.values(G.byId).some((g) => g.name.toLowerCase() === cleanName(name).toLowerCase());
// null si le nom est bon, sinon la raison
export function nameProblem(G, name) {
  const n = cleanName(name);
  if (n.length < GUILD_NAME_MIN) return "nom_court";
  if (n.length > GUILD_NAME_MAX) return "nom_long";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’\-]*$/u.test(n)) return "nom_invalide";
  if (nameTaken(G, n)) return "nom_pris";
  return null;
}
export function tagOf(name) {
  const words = cleanName(name).split(/[\s'’-]+/).filter((w) => w.length > 2 || /^\d/.test(w));
  const letters = (words.length >= 2 ? words.map((w) => w[0]).join("") : (words[0] || name)).replace(/[^\p{L}\p{N}]/gu, "");
  return letters.slice(0, 3).toUpperCase();
}
// Un nom inventé et libre, pour les guildes fondées par les simulés
export function makeGuildName(G, seed) {
  const r = makeRng(hashString(`gname:${seed}`));
  for (let i = 0; i < 60; i++) {
    const n = `${r.pick(NAME_FIRST)} ${r.pick(NAME_LAST)}`;
    if (!nameTaken(G, n)) return n;
  }
  return `Guilde ${G.seq}`;
}

// ---- journal ----
export function logOf(g, step, txt) {
  g.log.unshift({ t: step, txt });
  if (g.log.length > LOG_MAX) g.log.length = LOG_MAX;
}

// ---- quêtes ----
const niceGoal = (x) => (x >= 100 ? Math.round(x / 10) * 10 : x >= 30 ? Math.round(x / 5) * 5 : Math.max(1, Math.round(x)));
export function questGoal(g, type) {
  const T = QUEST_TYPES[type];
  return niceGoal(T.per * Math.max(QUEST_MIN_MEMBERS, memberCount(g)) * (1 + QUEST_LEVEL_GROWTH * g.level));
}
export function makeQuest(g, type) {
  const T = QUEST_TYPES[type], goal = questGoal(g, type);
  return { id: `q${g.qseq++}`, type, goal, got: 0, xp: Math.round(goal * T.xpPer), gold: Math.round(goal * T.goldPer) };
}
// Remplit les emplacements vides avec des quêtes de types encore absents ; le type est tiré de façon déterministe
export function fillQuests(g) {
  const types = Object.keys(QUEST_TYPES);
  while (g.quests.length < QUEST_SLOTS) {
    const free = types.filter((t) => !g.quests.some((q) => q.type === t));
    if (!free.length) break;
    const r = makeRng(hashString(`gq:${g.id}:${g.qseq}`));
    g.quests.push(makeQuest(g, r.pick(free)));
  }
}

// L'xp de guilde monte, le niveau avec (au niveau maximum, l'xp ne s'accumule plus)
export function addGuildXp(g, step, amount) {
  if (g.level >= GUILD_MAX_LEVEL || !(amount > 0)) return;
  g.xp += amount;
  while (g.level < GUILD_MAX_LEVEL && g.xp >= guildXpToNext(g.level)) {
    g.xp -= guildXpToNext(g.level);
    g.level += 1;
    logOf(g, step, `La guilde passe au niveau ${g.level} !`);
  }
  if (g.level >= GUILD_MAX_LEVEL) g.xp = 0;
}

// Fait avancer les quêtes du type donné de `n` unités ; une quête terminée donne son xp et son or, puis une nouvelle arrive
export function addProgress(g, step, type, n) {
  if (!(n > 0)) return;
  let done = false;
  for (const q of g.quests) {
    if (q.type !== type || q.got >= q.goal) continue;
    q.got = Math.min(q.goal, q.got + n);
    if (q.got >= q.goal) done = true;
  }
  if (!done) return;
  g.quests = g.quests.filter((q) => {
    if (q.got < q.goal) return true;
    g.gold += q.gold;
    logOf(g, step, `Quête terminée : ${QUEST_TYPES[q.type].verb} ${q.goal} ${QUEST_TYPES[q.type].unit} (+${q.xp} xp de guilde${q.gold ? `, +${q.gold} or` : ""}).`);
    addGuildXp(g, step, q.xp);
    return false;
  });
  fillQuests(g);
}

// ---- création, arrivées et départs ----
export function createGuild(G, { founder, name, step, act = { k: 0, g: 0, c: 0 }, pl = 0, emblem }) {
  const id = `g${G.seq++}`;
  const g = {
    id, name: cleanName(name), tag: tagOf(name), leader: founder, deputy: null, founded: step, level: 1, xp: 0, gold: 0, pal: 0, tabs: 1,
    bank: [{ res: {}, items: [] }], quests: [], qseq: 1, members: {}, log: [],
    emblem: emblem ? cleanEmblem(emblem) : randomEmblem(`${id}:${name}`),
  };
  G.byId[id] = g;
  addMember(G, g, founder, step, act, pl);
  fillQuests(g);
  logOf(g, step, `${g.name} est fondée.`);
  return g;
}

export function addMember(G, g, id, step, act = { k: 0, g: 0, c: 0 }, pl = 0) {
  g.members[id] = { j: step, k: act.k, g: act.g, c: act.c, pl, n: 0 };
  G.of[id] = g.id;
}

// Retire un membre. Si c'est le chef, le membre le plus actif (à égalité : le plus ancien) prend la suite ; la guilde vide disparaît.
// Renvoie { disbanded, bank } (le contenu du coffre quand la guilde disparaît, pour le rendre)
export function removeMember(G, g, id, step) {
  delete g.members[id];
  delete G.of[id];
  if (g.deputy === id) g.deputy = null;
  const left = Object.entries(g.members);
  if (!left.length) {
    const bank = g.bank;
    delete G.byId[g.id];
    return { disbanded: true, bank };
  }
  if (g.leader === id) {
    left.sort((a, b) => b[1].n - a[1].n || a[1].j - b[1].j || (a[0] < b[0] ? -1 : 1));
    g.leader = g.deputy && g.members[g.deputy] ? g.deputy : left[0][0];       // le bras droit prend la suite
    if (g.deputy === g.leader) g.deputy = null;
    logOf(g, step, "Un nouveau chef prend la tête de la guilde.");
  }
  return { disbanded: false };
}

// Contribution d'un membre (affichée au classement interne)
export function addContribution(g, id, points) {
  const m = g.members[id];
  if (m && points > 0) m.n += points;
}

// ---- paliers et coffre : dépenses de la caisse ----
export const nextPalier = (g) => PALIERS[g.pal] || null;
export const nextTab = (g) => TABS[g.tabs] || null;
// null = possible ; sinon la raison
export function palierProblem(g) {
  const p = nextPalier(g);
  if (!p) return "palier_max";
  if (g.level < p.level) return "niveau";
  if (g.gold < p.cost) return "caisse";
  return null;
}
export function tabProblem(g) {
  const t = nextTab(g);
  if (!t) return "onglet_max";
  if (g.level < t.level) return "niveau";
  if (g.gold < t.cost) return "caisse";
  return null;
}
export function buyPalier(g, step) {
  if (palierProblem(g)) return false;
  const p = nextPalier(g);
  g.gold -= p.cost; g.pal += 1;
  logOf(g, step, `Palier ${p.n} débloqué (-${p.cost} or).`);
  return true;
}
export function buyTab(g, step) {
  if (tabProblem(g)) return false;
  const t = nextTab(g);
  g.gold -= t.cost; g.tabs += 1; g.bank.push({ res: {}, items: [] });
  logOf(g, step, `Onglet ${t.n} du coffre acheté (-${t.cost} or).`);
  return true;
}

// ---- coffre ----
export const tabUsed = (tab) => tab.items.length + Object.keys(tab.res).length;
export const tabFree = (tab) => TAB_SLOTS - tabUsed(tab);

// ---- rangs ----
export const rankOf = (g, id) => (g.leader === id ? "chef" : g.deputy === id ? "bras" : g.members[id]?.r === "officier" ? "officier" : "recrue");
export const canSpend = (g, id) => CAN_SPEND.includes(rankOf(g, id));
export const canWithdraw = (g, id) => CAN_WITHDRAW.includes(rankOf(g, id));
// Exclure : seulement un rang strictement plus bas que le sien, et au moins officier pour le faire
export const canKick = (g, actor, target) => { const a = rankOf(g, actor), t = rankOf(g, target); return actor !== target && RANK_POWER[a] >= 1 && RANK_POWER[a] > RANK_POWER[t]; };
// Les rangs que `actor` peut donner à `target` (hors passation du commandement) : le chef nomme bras droit, officier, recrue ; le bras droit nomme officier et recrue
export function ranksAssignable(g, actor, target) {
  const a = rankOf(g, actor), t = rankOf(g, target);
  if (actor === target || t === "chef") return [];
  if (a === "chef") return ["bras", "officier", "recrue"].filter((r) => r !== t);
  if (a === "bras" && (t === "officier" || t === "recrue")) return ["officier", "recrue"].filter((r) => r !== t);
  return [];
}
// Donne un rang (un seul bras droit : l'ancien devient officier)
export function setRank(g, id, rank, step) {
  if (rank === "bras") {
    if (g.deputy && g.deputy !== id && g.members[g.deputy]) g.members[g.deputy].r = "officier";
    g.deputy = id; g.members[id].r = "recrue";
  } else {
    if (g.deputy === id) g.deputy = null;
    g.members[id].r = rank === "officier" ? "officier" : "recrue";
  }
  logOf(g, step, `Nouveau rang : ${rank === "bras" ? "bras droit" : rank}.`);
}
// Passe le commandement : l'ancien chef devient bras droit
export function passLead(g, to, step) {
  const old = g.leader;
  g.leader = to;
  if (g.deputy === to) g.deputy = null;
  if (g.deputy && g.members[g.deputy]) g.members[g.deputy].r = "officier";
  g.deputy = g.members[old] ? old : null;
  logOf(g, step, "Le chef passe la main.");
}
