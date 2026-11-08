// ============================================================
// Sentinelles : les règles, sur les données (sans React). Une guilde garde ses sentinelles dans `g.sentinels` :
//   g.sentinels = { [clé de région]: { placed (pas), gold, res: { [ressource]: qté } } }
// et `G.sent = { [clé de région]: idGuilde }` est l'annuaire (une seule sentinelle par région ; la première arrivée garde la place).
// Utilisé par le joueur (guildActions.js, combats) et par les simulés (market.js → stepLife).
// ============================================================
import { ENEMIES } from "../data/zones.js";
import { SENT_BY_KEY, REGION_OF_ENEMY, SENT_LOOT_SHARE, sentinelSlots, sentinelGoldCap, sentinelResCap } from "../data/sentinel.js";
import { makeRng, hashString } from "../sim/rng.js";
import { logOf, tabFree } from "./guildCore.js";

export const sentinelsOf = (g) => (g && g.sentinels && typeof g.sentinels === "object" ? g.sentinels : {});
export const sentinelCount = (g) => Object.keys(sentinelsOf(g)).length;
export const sentinelOwner = (G, region) => (G?.sent && G.byId[G.sent[region]]) || null;
export const stockEmpty = (s) => !(s.gold > 0) && !Object.keys(s.res || {}).length;
export const regionOfFight = (enemyKeys) => { for (const k of enemyKeys) if (REGION_OF_ENEMY[k]) return REGION_OF_ENEMY[k]; return null; };

// Remet l'annuaire d'aplomb à partir des guildes (les guildes font foi) : régions inconnues et doublons retirés
export function rebuildSent(G) {
  const sent = {};
  for (const g of Object.values(G.byId)) {
    if (!g.sentinels || typeof g.sentinels !== "object") { delete g.sentinels; continue; }
    for (const key of Object.keys(g.sentinels)) {
      const s = g.sentinels[key];
      if (!SENT_BY_KEY[key] || sent[key] || !s || typeof s !== "object") { delete g.sentinels[key]; continue; }
      if (!(s.gold >= 0)) s.gold = 0;
      if (!s.res || typeof s.res !== "object") s.res = {};
      sent[key] = g.id;
    }
    if (!Object.keys(g.sentinels).length) delete g.sentinels;
  }
  if (G.sent || Object.keys(sent).length) G.sent = sent;
  return G;
}

// ---- poser / retirer ----
// null = possible ; sinon la raison
export function placeProblem(G, g, region) {
  if (!SENT_BY_KEY[region]) return "zone";
  if (sentinelsOf(g)[region]) return "deja_posee";
  const owner = sentinelOwner(G, region);
  if (owner) return "zone_prise";
  if (sentinelCount(g) >= sentinelSlots(g.level)) return "sentinelle_max";
  if (g.gold < SENT_BY_KEY[region].cost) return "caisse";
  return null;
}
export function placeSentinel(G, g, region, step) {
  g.gold -= SENT_BY_KEY[region].cost;
  g.sentinels = { ...sentinelsOf(g), [region]: { placed: step, gold: 0, res: {} } };
  G.sent = { ...(G.sent || {}), [region]: g.id };
  logOf(g, step, `Une sentinelle veille désormais sur ${SENT_BY_KEY[region].name}.`);
}
export function removeProblem(g, region) {
  const s = sentinelsOf(g)[region];
  if (!s) return "pas_de_sentinelle";
  if (!stockEmpty(s)) return "stock_plein";                  // on relève d'abord
  return null;
}
export function removeSentinel(G, g, region, step) {
  const next = { ...sentinelsOf(g) }; delete next[region];
  if (Object.keys(next).length) g.sentinels = next; else delete g.sentinels;
  if (G.sent?.[region] === g.id) { G.sent = { ...G.sent }; delete G.sent[region]; }
  logOf(g, step, `La sentinelle de ${SENT_BY_KEY[region].name} est retirée.`);
}

// ---- le butin : un tirage « de joueur » sur les monstres vaincus ----
// Même table de drops que pour un joueur, réduite de SENT_LOOT_SHARE ; seulement de l'or et des ressources (pas d'équipement)
export function lootRoll(enemyKeys, rng) {
  const out = { gold: 0, res: {} };
  for (const k of enemyKeys) {
    const def = ENEMIES[k];
    if (!def) continue;
    if (def.gold) out.gold += rng.int(def.gold[0], def.gold[1]) * SENT_LOOT_SHARE;
    for (const d of def.drops || []) {
      if (d.type !== "resource" || d.forClass) continue;
      if (rng() >= d.chance * SENT_LOOT_SHARE) continue;
      out.res[d.id] = (out.res[d.id] || 0) + rng.int(d.min, d.max);
    }
  }
  out.gold = Math.round(out.gold);
  return out;
}

// Ajoute un butin au stock de la sentinelle, dans la limite de ses plafonds (modifie g)
export function addLoot(g, region, loot) {
  const s = sentinelsOf(g)[region];
  if (!s) return false;
  const gcap = sentinelGoldCap(g.level), rcap = sentinelResCap(g.level);
  s.gold = Math.min(gcap, (s.gold || 0) + loot.gold);
  for (const [id, q] of Object.entries(loot.res)) s.res[id] = Math.min(rcap, (s.res[id] || 0) + q);
  return true;
}

// Un combat de simulé dans une région : si une sentinelle y veille, elle tire son butin (modifie la guilde)
export function feedFight(G, region, enemyKeys, seed) {
  const gid = G?.sent?.[region];
  const g = gid && G.byId[gid];
  if (!g) return;
  addLoot(g, region, lootRoll(enemyKeys, makeRng(hashString(`sent:${seed}`))));
}
// Le crochet donné aux simulés (`opts.onFight`) : lit les guildes au moment de l'appel
export const sentinelFeeder = (sims) => (region, enemyKeys, seed) => { if (sims.guilds?.sent?.[region]) feedFight(sims.guilds, region, enemyKeys, seed); };

// Un combat du joueur : on lit la région d'après les monstres tués ; la sentinelle y tire son butin à part (le joueur ne perd rien)
export function creditPlayerFight(player, kills, seed = `${Date.now()}`) {
  const G = player?.market?.sims?.guilds;
  if (!G || !G.sent) return player;
  const keys = Object.entries(kills || {}).flatMap(([k, n]) => Array(Math.min(Math.max(0, n | 0), 20)).fill(k));
  const region = regionOfFight(keys);
  const gid = region && G.sent[region], g0 = gid && G.byId[gid];
  if (!g0 || !sentinelsOf(g0)[region]) return player;
  const g = structuredClone(g0);
  addLoot(g, region, lootRoll(keys, makeRng(hashString(`sent:${seed}`))));
  return { ...player, market: { ...player.market, sims: { ...player.market.sims, guilds: { ...G, byId: { ...G.byId, [gid]: g } } } } };
}

// ---- relever ----
// Vide le stock de la sentinelle : l'or va à la caisse, les ressources au coffre (là où il y a de la place) ; le reste attend sur place
// Renvoie { gold, moved (nombre de ressources déplacées), left (ressources restées) } (modifie g)
export function collectStock(g, region, step) {
  const s = sentinelsOf(g)[region];
  if (!s) return null;
  const gold = Math.floor(s.gold || 0);
  g.gold += gold; s.gold = (s.gold || 0) - gold;
  let moved = 0, left = 0;
  for (const id of Object.keys(s.res)) {
    let q = s.res[id];
    if (!(q > 0)) { delete s.res[id]; continue; }
    const tab = g.bank.slice(0, g.tabs).find((t) => t.res[id] > 0 || tabFree(t) >= 1);
    if (!tab) { left += q; continue; }
    tab.res[id] = (tab.res[id] || 0) + q; moved += q; delete s.res[id];
  }
  if (gold || moved) logOf(g, step, `Relève de la sentinelle de ${SENT_BY_KEY[region].name} : ${gold} or, ${moved} ressource${moved > 1 ? "s" : ""}.`);
  return { gold, moved, left };
}
