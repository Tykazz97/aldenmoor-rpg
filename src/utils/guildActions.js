// ============================================================
// Guildes : ce que fait le joueur (fonder, rejoindre, quitter, donner, coffre, paliers, onglets, exclure, passer la main) et ce
// qu'il lit (liste des guildes, membres). Sans React. Chaque action renvoie { ok, reason?, player } : en cas d'échec le joueur
// est inchangé et `reason` dit pourquoi (voir REASONS pour les phrases).
// Les guildes vivent dans le monde des simulés (player.market.sims.guilds) : une action remet d'abord le marché à l'heure.
// Les actions du joueur (monstres vaincus, récoltes, fabrications) comptent pour les quêtes de sa guilde : on lit ses compteurs
// de quêtes (utils/counters.js) et on ajoute la différence depuis la dernière fois (syncPlayerGuild).
// ============================================================
import { pointsProblem, setPoints, resetCost, spellsProblem, setSpells, emptyPts } from "./sentinelBuild.js";
import { attackProblem, rebuildSent, placeProblem, placeSentinel, removeProblem, removeSentinel, collectStock, sentinelsOf } from "./sentinel.js";
import { marketOf } from "./market.js";
import { SENT_BY_KEY } from "../data/sentinel.js";
import { SENT_SHIELD_MS } from "./sentinelFight.js";
import { bagFree } from "./bag.js";
import { bankFree } from "./bank.js";
import { MAX_JOIN_LEVEL, GUILD_CREATE_COST, QUEST_TYPES, TAB_SLOTS, RANKS } from "../data/guild.js";
import {
  newGuilds, guildFor, activityOf, addProgress, addContribution, nameProblem, createGuild, addMember, removeMember, isFull, memberCount,
  palierProblem, tabProblem, buyPalier, buyTab, logOf, tabFree, cleanName, rankOf, canSpend, canWithdraw, canKick, ranksAssignable, setRank, passLead,
} from "./guildCore.js";
import { donate } from "../sim/guilds.js";
import { cleanEmblem } from "../data/emblems.js";
import { getPopulation } from "../sim/population.js";

export const REASONS = {
  pas_de_monde: "Les guildes ne sont pas encore disponibles (le monde des joueurs est en cours de chargement).",
  deja_membre: "Tu fais déjà partie d'une guilde.",
  pas_membre: "Tu ne fais partie d'aucune guilde.",
  nom_court: "Le nom est trop court (3 lettres au minimum).",
  nom_long: "Le nom est trop long (24 caractères au maximum).",
  nom_invalide: "Le nom contient des caractères non permis (lettres, chiffres, espaces, apostrophes et tirets).",
  nom_pris: "Ce nom est déjà pris.",
  or: "Il te manque de l'or.",
  introuvable: "Cette guilde n'existe plus.",
  pleine: "Cette guilde est pleine (50 membres).",
  chef: "Seul le chef de la guilde peut faire ça.",
  droit: "Ton rang dans la guilde ne te le permet pas.",
  caisse: "La caisse de la guilde ne contient pas assez d'or.",
  niveau: "Le niveau de la guilde est trop bas.",
  palier_max: "Tous les paliers sont débloqués.",
  onglet_max: "Tous les onglets sont achetés.",
  onglet: "Cet onglet n'est pas acheté.",
  plein: "Cet onglet est plein.",
  aucun: "Rien à déplacer.",
  sac_plein: "Ton sac est plein : fais de la place (range des objets au coffre ou vends-les).",
  membre: "Ce membre ne fait pas partie de la guilde.",
  soi: "Ce n'est pas possible pour toi-même.",
  zone: "Cette région n'existe pas.",
  deja_posee: "Ta guilde a déjà une sentinelle dans cette région.",
  zone_prise: "Une autre guilde veille déjà sur cette région.",
  sentinelle_max: "Ta guilde tient déjà autant de sentinelles que son niveau le permet.",
  pas_de_sentinelle: "Il n'y a pas de sentinelle dans cette région.",
  stock_plein: "Relève d'abord le butin de la sentinelle.",
  niveau_requis: "Ton niveau est trop bas pour rejoindre cette guilde.",
  sienne: "C'est la sentinelle de ta propre guilde.",
  points: "Ces points ne tiennent pas dans le total de la guilde.",
  points_max: "Une caractéristique ne peut recevoir que 60 % des points.",
  sorts: "Ces sorts ne sont pas permis (3 au maximum, et seulement ceux que la guilde a débloqués).",
  protegee: "Cette sentinelle vient de tenir bon : elle est protégée pour le moment.",
};

const fail = (player, reason) => ({ ok: false, reason, player });

// ---------- lecture ----------
export const guildsOf = (player) => { const G = player?.market?.sims?.guilds; return G && typeof G.byId === "object" && typeof G.of === "object" ? G : null; };
export const myGuild = (player) => { const G = guildsOf(player); return G ? guildFor(G, "player") : null; };
export const guildList = (player) => {
  const G = guildsOf(player);
  return G ? Object.values(G.byId).sort((a, b) => b.level - a.level || memberCount(b) - memberCount(a) || (a.name < b.name ? -1 : 1)) : [];
};
// Les membres d'une guilde, du plus actif au moins actif : { id, name, level, leader, you, points, since }
export function memberRows(player, g) {
  const lives = player?.market?.sims?.lives || {}, names = new Map(getPopulation().map((b) => [b.id, b]));
  return Object.entries(g.members).map(([id, m]) => {
    const bot = names.get(id), life = lives[id];
    return { id, name: id === "player" ? (player.name || "Toi") : bot?.name || id, level: id === "player" ? player.level : life?.level || bot?.level || 1, classKey: id === "player" ? player.classKey : bot?.classKey, leader: g.leader === id, rank: rankOf(g, id), you: id === "player", points: Math.round(m.n), since: m.j };
  }).sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || b.points - a.points || (a.name < b.name ? -1 : 1));
}

// ---------- écriture ----------
function open(player, now) {
  const m = marketOf(player, now);
  if (!m.sims) return null;
  return { m, G: structuredClone(guildsOf({ market: m }) || newGuilds()) };
}
const commit = (player, m, G, patch = {}, sims = null) => ({ ...player, ...patch, market: { ...m, sims: { ...(sims || m.sims), guilds: G } } });

// L'activité du joueur depuis la dernière lecture fait avancer les quêtes de sa guilde (modifie g)
function syncMember(g, player, step) {
  const mm = g.members.player;
  if (!mm) return false;
  const a = activityOf(player.quests);
  const dk = Math.max(0, a.k - mm.k), dg = Math.max(0, a.g - mm.g), dc = Math.max(0, a.c - mm.c);
  if (!dk && !dg && !dc && a.k === mm.k && a.g === mm.g && a.c === mm.c) return false;
  mm.k = a.k; mm.g = a.g; mm.c = a.c;
  if (dk) { addProgress(g, step, "kills", dk); addContribution(g, "player", dk * QUEST_TYPES.kills.xpPer); }
  if (dg) { addProgress(g, step, "gathers", dg); addContribution(g, "player", dg * QUEST_TYPES.gathers.xpPer); }
  if (dc) { addProgress(g, step, "crafts", dc); addContribution(g, "player", dc * QUEST_TYPES.crafts.xpPer); }
  return true;
}

// Appelé régulièrement par le jeu (sans remettre le marché à l'heure) : renvoie le même joueur s'il n'y a rien de neuf
export function syncPlayerGuild(player) {
  const G0 = guildsOf(player), gid = G0?.of?.player, g0 = gid && G0.byId[gid];
  if (!g0 || !g0.members?.player) return player;
  const a = activityOf(player.quests), mm = g0.members.player;
  if (a.k === mm.k && a.g === mm.g && a.c === mm.c) return player;
  const g = structuredClone(g0);
  syncMember(g, player, player.market.bucket);
  return { ...player, market: { ...player.market, sims: { ...player.market.sims, guilds: { ...G0, byId: { ...G0.byId, [gid]: g } } } } };
}

// Ouvre le marché, repère ma guilde (clonée) et met mon activité à jour ; null + raison si ce n'est pas possible
// `need` : "spend" (caisse), "withdraw" (coffre) ou "chef" ; sinon tout membre
function mine(player, now, { need = null } = {}) {
  const o = open(player, now);
  if (!o) return { error: "pas_de_monde" };
  const g = guildFor(o.G, "player");
  if (!g) return { error: "pas_membre" };
  if (need === "chef" && g.leader !== "player") return { error: "chef" };
  if (need === "spend" && !canSpend(g, "player")) return { error: "droit" };
  if (need === "withdraw" && !canWithdraw(g, "player")) return { error: "droit" };
  syncMember(g, player, o.m.bucket);
  return { ...o, g, step: o.m.bucket };
}

export function createGuildAction(player, name, now = Date.now(), emblem = null) {
  const o = open(player, now);
  if (!o) return fail(player, "pas_de_monde");
  if (guildFor(o.G, "player")) return fail(player, "deja_membre");
  const problem = nameProblem(o.G, name);
  if (problem) return fail(player, problem);
  if (player.gold < GUILD_CREATE_COST) return fail(player, "or");
  const g = createGuild(o.G, { founder: "player", name: cleanName(name), step: o.m.bucket, act: activityOf(player.quests), emblem: cleanEmblem(emblem) });
  return { ok: true, guild: g, player: commit(player, o.m, o.G, { gold: player.gold - GUILD_CREATE_COST }) };
}

export function joinGuildAction(player, gid, now = Date.now()) {
  const o = open(player, now);
  if (!o) return fail(player, "pas_de_monde");
  if (guildFor(o.G, "player")) return fail(player, "deja_membre");
  const g = o.G.byId[gid];
  if (!g) return fail(player, "introuvable");
  if (isFull(g)) return fail(player, "pleine");
  if ((player.level || 1) < (g.minLevel || 0)) return fail(player, "niveau_requis");
  addMember(o.G, g, "player", o.m.bucket, activityOf(player.quests));
  logOf(g, o.m.bucket, `${player.name || "Un aventurier"} rejoint la guilde.`);
  return { ok: true, guild: g, player: commit(player, o.m, o.G) };
}

// Quitter : le chef qui part passe la main au membre le plus actif ; seul, la guilde disparaît et son coffre te revient
export function leaveGuildAction(player, now = Date.now()) {
  const r = mine(player, now);
  if (r.error) return fail(player, r.error);
  const { m, G, g, step } = r;
  const out = removeMember(G, g, "player", step);
  let patch = {};
  if (out.disbanded) {
    const resources = { ...player.resources }, inventory = [...player.inventory];
    for (const tab of out.bank) { for (const [id, q] of Object.entries(tab.res)) resources[id] = (resources[id] || 0) + q; inventory.push(...tab.items); }
    patch = { resources, inventory };
  } else logOf(g, step, `${player.name || "Un aventurier"} quitte la guilde.`);
  return { ok: true, disbanded: out.disbanded, player: commit(player, m, G, patch) };
}

export function donateAction(player, amount, now = Date.now()) {
  const n = Math.floor(Number(amount));
  if (!(n >= 1)) return fail(player, "aucun");
  if (player.gold < n) return fail(player, "or");
  const r = mine(player, now);
  if (r.error) return fail(player, r.error);
  donate(r.g, r.step, "player", n);
  return { ok: true, amount: n, player: commit(player, r.m, r.G, { gold: player.gold - n }) };
}

// spec : { kind: "res", id, qty } ou { kind: "item", uid }
export function depositAction(player, tabIndex, spec, now = Date.now()) {
  const r = mine(player, now);
  if (r.error) return fail(player, r.error);
  const tab = r.g.bank[tabIndex];
  if (!tab || tabIndex >= r.g.tabs) return fail(player, "onglet");
  if (spec.kind === "item") {
    const item = player.inventory.find((i) => i.uid === spec.uid);
    if (!item) return fail(player, "aucun");
    if (tabFree(tab) < 1) return fail(player, "plein");
    tab.items.push(item);
    logOf(r.g, r.step, `${player.name || "Un membre"} dépose ${item.name}.`);
    return { ok: true, player: commit(player, r.m, r.G, { inventory: player.inventory.filter((i) => i.uid !== spec.uid) }) };
  }
  const have = player.resources[spec.id] || 0, qty = Math.min(Math.floor(Number(spec.qty)) || 0, have);
  if (!(qty >= 1)) return fail(player, "aucun");
  if (!(tab.res[spec.id] > 0) && tabFree(tab) < 1) return fail(player, "plein");
  tab.res[spec.id] = (tab.res[spec.id] || 0) + qty;
  const resources = { ...player.resources, [spec.id]: have - qty };
  if (resources[spec.id] <= 0) delete resources[spec.id];
  return { ok: true, qty, player: commit(player, r.m, r.G, { resources }) };
}

export function withdrawAction(player, tabIndex, spec, now = Date.now()) {
  const r = mine(player, now, { need: "withdraw" });
  if (r.error) return fail(player, r.error);
  const tab = r.g.bank[tabIndex];
  if (!tab || tabIndex >= r.g.tabs) return fail(player, "onglet");
  if (spec.kind === "item") {
    const item = tab.items.find((i) => i.uid === spec.uid);
    if (!item) return fail(player, "aucun");
    if (bagFree(player) < 1) return fail(player, "sac_plein");
    tab.items = tab.items.filter((i) => i.uid !== spec.uid);
    logOf(r.g, r.step, `${player.name || "Un membre"} retire ${item.name}.`);
    return { ok: true, player: commit(player, r.m, r.G, { inventory: [...player.inventory, item] }) };
  }
  const have = tab.res[spec.id] || 0, qty = Math.min(Math.floor(Number(spec.qty)) || 0, have);
  if (!(qty >= 1)) return fail(player, "aucun");
  if (!(player.resources[spec.id] > 0) && bagFree(player) < 1) return fail(player, "sac_plein");
  tab.res[spec.id] = have - qty;
  if (tab.res[spec.id] <= 0) delete tab.res[spec.id];
  return { ok: true, qty, player: commit(player, r.m, r.G, { resources: { ...player.resources, [spec.id]: (player.resources[spec.id] || 0) + qty } }) };
}

export function buyPalierAction(player, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const problem = palierProblem(r.g);
  if (problem) return fail(player, problem);
  buyPalier(r.g, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

export function buyTabAction(player, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const problem = tabProblem(r.g);
  if (problem) return fail(player, problem);
  buyTab(r.g, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

// Exclure un membre d'un rang plus bas que le sien (le simulé exclu perd les bonus de la guilde)
export function kickAction(player, id, now = Date.now()) {
  const r = mine(player, now);
  if (r.error) return fail(player, r.error);
  if (id === "player") return fail(player, "soi");
  if (!r.g.members[id]) return fail(player, "membre");
  if (!canKick(r.g, "player", id)) return fail(player, "droit");
  removeMember(r.G, r.g, id, r.step);
  const life = r.m.sims.lives[id];
  let sims = null;
  if (life) { const l = { ...life }; delete l.gb; delete l.gbn; sims = { ...r.m.sims, lives: { ...r.m.sims.lives, [id]: l } }; }
  return { ok: true, player: commit(player, r.m, r.G, {}, sims) };
}

// Passer le commandement (chef) : l'ancien chef devient bras droit
export function transferAction(player, id, now = Date.now()) {
  const r = mine(player, now, { need: "chef" });
  if (r.error) return fail(player, r.error);
  if (id === "player") return fail(player, "soi");
  if (!r.g.members[id]) return fail(player, "membre");
  passLead(r.g, id, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

// Donner un rang : "bras", "officier" ou "recrue" (le chef nomme tout ; le bras droit nomme les officiers)
export function setRankAction(player, id, rank, now = Date.now()) {
  const r = mine(player, now);
  if (r.error) return fail(player, r.error);
  if (id === "player") return fail(player, "soi");
  if (!r.g.members[id]) return fail(player, "membre");
  if (!ranksAssignable(r.g, "player", id).includes(rank)) return fail(player, "droit");
  setRank(r.g, id, rank, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

export { TAB_SLOTS, rankOf, canSpend, canWithdraw, canKick, ranksAssignable };

// ---- sentinelles ----
export function placeSentinelAction(player, region, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  rebuildSent(r.G);
  const problem = placeProblem(r.G, r.g, region);
  if (problem) return fail(player, problem);
  placeSentinel(r.G, r.g, region, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

export function removeSentinelAction(player, region, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const problem = removeProblem(r.g, region);
  if (problem) return fail(player, problem);
  removeSentinel(r.G, r.g, region, r.step);
  return { ok: true, player: commit(player, r.m, r.G) };
}

// region : la clé d'une région, ou "all" pour toutes les sentinelles de la guilde
export function collectSentinelAction(player, region = "all", now = Date.now()) {
  const r = mine(player, now, { need: "withdraw" });
  if (r.error) return fail(player, r.error);
  const keys = region === "all" ? Object.keys(sentinelsOf(r.g)) : [region];
  if (!keys.length || keys.some((k) => !sentinelsOf(r.g)[k])) return fail(player, "pas_de_sentinelle");
  const total = { gold: 0, moved: 0, left: 0 };
  for (const k of keys) { const c = collectStock(r.g, k, r.step); total.gold += c.gold; total.moved += c.moved; total.left += c.left; }
  if (!total.gold && !total.moved) return fail(player, total.left ? "plein" : "aucun");
  return { ok: true, ...total, player: commit(player, r.m, r.G) };
}

// Niveau minimum pour rejoindre (0 = ouvert à tous) ; chef et bras droit
export function setMinLevelAction(player, level, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const n = Math.min(MAX_JOIN_LEVEL, Math.max(0, Math.floor(Number(level)) || 0));
  if (n) r.g.minLevel = n; else delete r.g.minLevel;
  logOf(r.g, r.step, n ? `Niveau minimum pour rejoindre : ${n}.` : "La guilde est ouverte à tous les niveaux.");
  return { ok: true, level: n, player: commit(player, r.m, r.G) };
}

// Le joueur a battu la sentinelle : tout son stock lui revient (sac d'abord, puis coffre personnel ; ce qui ne tient nulle part est perdu),
// et la sentinelle disparaît : la guilde pourra en poser une autre.
// Renvoie { ok, gold, res (reçu dans le sac), bank (reçu au coffre), lost }
export function winAttackAction(player, region, now = Date.now()) {
  const o = open(player, now);
  if (!o) return fail(player, "pas_de_monde");
  rebuildSent(o.G);
  const problem = attackProblem(o.G, region, now);
  if (problem) return fail(player, problem);
  const g = o.G.byId[o.G.sent[region]], s = sentinelsOf(g)[region];
  const gold = Math.floor(s.gold || 0);
  const resources = { ...player.resources }, bank = { ...(player.bank || { items: [], resources: {} }), resources: { ...(player.bank?.resources || {}) } };
  let bagRoom = bagFree(player), bankRoom = bankFree(player);
  const got = { res: {}, bank: {}, lost: {} };
  for (const [id, q] of Object.entries(s.res || {})) {
    if (!(q > 0)) continue;
    if (resources[id] > 0) { resources[id] += q; got.res[id] = q; }
    else if (bagRoom > 0) { resources[id] = q; bagRoom--; got.res[id] = q; }
    else if (bank.resources[id] > 0) { bank.resources[id] += q; got.bank[id] = q; }
    else if (bankRoom > 0) { bank.resources[id] = q; bankRoom--; got.bank[id] = q; }
    else got.lost[id] = q;
  }
  removeSentinel(o.G, g, region, o.m.bucket);
  logOf(g, o.m.bucket, `Ta sentinelle de ${SENT_BY_KEY[region].name} a été détruite par ${player.name || "un aventurier"}.`);
  return { ok: true, gold, ...got, player: commit(player, o.m, o.G, { gold: player.gold + gold, resources, bank }) };
}

// Le joueur a perdu : la sentinelle a tenu bon, elle est intouchable pendant 1 h
export function loseAttackAction(player, region, now = Date.now()) {
  const o = open(player, now);
  if (!o) return fail(player, "pas_de_monde");
  rebuildSent(o.G);
  const g = o.G.sent?.[region] && o.G.byId[o.G.sent[region]];
  if (!g || !sentinelsOf(g)[region]) return fail(player, "pas_de_sentinelle");
  g.sentinels[region].shield = now + SENT_SHIELD_MS;
  return { ok: true, player: commit(player, o.m, o.G) };
}

// Peut-on attaquer ? (pour griser le bouton et dire pourquoi)
export function attackCheck(player, region, now = Date.now()) {
  const G = guildsOf(player);
  return G ? attackProblem(G, region, now) : "pas_de_monde";
}

// ---- la fiche de la sentinelle (chef et bras droit) ----
export function setSentinelPointsAction(player, pts, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const problem = pointsProblem(r.g, pts);
  if (problem) return fail(player, problem);
  setPoints(r.g, pts);
  return { ok: true, player: commit(player, r.m, r.G) };
}

// Remet tous les points à zéro (à replacer) : coûte de l'or de la caisse
export function resetSentinelPointsAction(player, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const cost = resetCost(r.g);
  if (r.g.gold < cost) return fail(player, "caisse");
  r.g.gold -= cost;
  setPoints(r.g, emptyPts());
  logOf(r.g, r.step, "Les points de la sentinelle sont remis à zéro.");
  return { ok: true, cost, player: commit(player, r.m, r.G) };
}

export function setSentinelSpellsAction(player, ids, now = Date.now()) {
  const r = mine(player, now, { need: "spend" });
  if (r.error) return fail(player, r.error);
  const problem = spellsProblem(r.g, ids);
  if (problem) return fail(player, problem);
  setSpells(r.g, ids);
  return { ok: true, player: commit(player, r.m, r.G) };
}
