// ============================================================
// Le groupe permanent (comme dans Dofus) : jusqu'à GROUP_MAX joueurs simulés qui combattent avec le joueur, entre les combats aussi. Sans React.
//   - on invite des simulés CONNECTÉS (ceux qui jouent en ce moment : leurs horaires, `isActive`), ceux de la guilde d'abord ;
//   - l'écart de niveau avec le joueur ne dépasse pas GROUP_LEVEL_WINDOW ;
//   - un membre qui se déconnecte sort du groupe (`cleanGroupAction`, appelé régulièrement) ;
//   - chaque membre gagne son propre xp, son or et son butin à chaque combat gagné ensemble (`creditGroup`, `sim/lives.js groupFightStep`).
// Le groupe est stocké dans `player.companions` (ids de simulés), comme les anciens compagnons.
// ============================================================
import { PARTY_SIZE } from "../sim/partyBots.js";
import { isActive, STEP_MS, groupFightStep } from "../sim/lives.js";
import { getLivePopulation } from "../sim/simWorld.js";
import { PARTY_DROP_MULT } from "../combat/engine.js";
import { makeRng, hashString } from "../sim/rng.js";

export const GROUP_MAX = PARTY_SIZE - 1;          // le joueur + 2 membres
export const GROUP_LEVEL_WINDOW = 10;             // écart de niveau maximal avec le joueur

export const GROUP_REASONS = {
  groupe_plein: "Ton groupe est complet (3 joueurs, toi compris).",
  hors_ligne: "Ce joueur n'est pas connecté en ce moment.",
  ecart_niveau: `L'écart de niveau est trop grand (${GROUP_LEVEL_WINDOW} niveaux au maximum).`,
  deja_groupe: "Ce joueur est déjà dans ton groupe.",
  inconnu: "Ce joueur n'existe pas.",
};

const stepOfNow = (now) => Math.floor(now / STEP_MS);
export const isOnline = (bot, now = Date.now()) => isActive(bot, stepOfNow(now));
const fail = (player, reason) => ({ ok: false, reason, player });
const lifeOf = (player, id) => player?.market?.sims?.lives?.[id] || null;

// Pendant qu'un simulé est dans mon groupe, sa vie simulée est en pause (`sims.busy[id]` = dernier pas où il est occupé) : il ne gagne qu'avec moi.
// La marque est renouvelée tant qu'il est dans le groupe (toutes les 10 s) et expire seule peu après son départ ou si je ferme le jeu.
const BUSY_STEPS = 2;
export function withBusy(player, now = Date.now()) {
  const sims = player?.market?.sims;
  if (!sims) return player;
  const want = stepOfNow(now) + BUSY_STEPS, ids = player.companions || [];
  const cur = sims.busy || {};
  const stale = Object.keys(cur).filter((id) => !ids.includes(id) || cur[id] < stepOfNow(now));
  if (ids.every((id) => cur[id] >= want) && !stale.length) return player;
  const busy = { ...cur };
  for (const id of stale) delete busy[id];
  for (const id of ids) busy[id] = want;
  return { ...player, market: { ...player.market, sims: { ...sims, busy } } };
}

// Mon groupe : { members: [bots présents (connectés)], gone: [ids qui ne le sont plus ou n'existent plus] }
export function groupOf(player, now = Date.now()) {
  const pop = getLivePopulation(player), byId = new Map(pop.map((b) => [b.id, b]));
  const members = [], gone = [];
  for (const id of player?.companions || []) {
    const b = byId.get(id);
    if (b && isOnline(b, now)) members.push(b); else gone.push(id);
  }
  return { members, gone };
}

// Les joueurs qu'on peut inviter : connectés, pas déjà dans le groupe, ceux de ma guilde d'abord puis les plus proches de mon niveau.
// Chaque entrée : { bot, guild (même guilde), ok, reason }
export function groupCandidates(player, now = Date.now(), { max = 40 } = {}) {
  const G = player?.market?.sims?.guilds, myGid = G?.of?.player, mine = new Set(player?.companions || []);
  const lvl = player?.level || 1;
  return getLivePopulation(player)
    .filter((b) => !mine.has(b.id) && isOnline(b, now))
    .map((bot) => ({ bot, guild: !!myGid && G.of[bot.id] === myGid, d: Math.abs(bot.level - lvl) }))
    .sort((a, b) => (b.guild - a.guild) || a.d - b.d || a.bot.name.localeCompare(b.bot.name))
    .slice(0, max)
    .map(({ bot, guild, d }) => ({ bot, guild, ok: d <= GROUP_LEVEL_WINDOW, reason: d <= GROUP_LEVEL_WINDOW ? null : "ecart_niveau" }));
}

export function inviteAction(player, id, now = Date.now()) {
  const bot = getLivePopulation(player).find((b) => b.id === id);
  if (!bot) return fail(player, "inconnu");
  const list = player.companions || [];
  if (list.includes(id)) return fail(player, "deja_groupe");
  if (list.length >= GROUP_MAX) return fail(player, "groupe_plein");
  if (!isOnline(bot, now)) return fail(player, "hors_ligne");
  if (Math.abs(bot.level - (player.level || 1)) > GROUP_LEVEL_WINDOW) return fail(player, "ecart_niveau");
  return { ok: true, bot, player: withBusy({ ...player, companions: [...list, id] }, now) };
}

export function kickAction(player, id, now = Date.now()) {
  const list = player.companions || [];
  if (!list.includes(id)) return fail(player, "inconnu");
  return { ok: true, player: withBusy({ ...player, companions: list.filter((x) => x !== id) }, now) };
}

// Retire du groupe ceux qui ne sont plus connectés (ou qui n'existent plus) et renouvelle la pause de la vie simulée des membres. Renvoie le même joueur s'il n'y a rien à changer.
export function cleanGroupAction(player, now = Date.now()) {
  if (!(player?.companions || []).length) return Object.keys(player?.market?.sims?.busy || {}).length ? withBusy(player, now) : player;
  const { members, gone } = groupOf(player, now);
  return withBusy(gone.length ? { ...player, companions: members.map((b) => b.id) } : player, now);
}

// Après un combat gagné à plusieurs : chaque membre (`ids`) reçoit son xp, son or et son butin. Renvoie un joueur dont les fiches ont été copiées
// (les autres ne bougent pas) ; `kills` = { monstre: nombre }.
export function creditGroup(player, ids, kills, seed = "g") {
  const sims = player?.market?.sims;
  if (!sims?.lives || !ids?.length || !kills || !Object.keys(kills).length) return player;
  const pop = getLivePopulation(player), byId = new Map(pop.map((b) => [b.id, b]));
  const lives = { ...sims.lives };
  const groupMult = PARTY_DROP_MULT[1 + ids.length] ?? PARTY_DROP_MULT[3];
  let changed = false;
  for (const id of ids) {
    const bot = byId.get(id), life = lives[id];
    if (!bot || !life) continue;
    const l = structuredClone(life);
    groupFightStep(l, bot, kills, makeRng(hashString(`grp:${seed}:${id}`)), { groupMult });
    lives[id] = l; changed = true;
  }
  return changed ? { ...player, market: { ...player.market, sims: { ...sims, lives } } } : player;
}
