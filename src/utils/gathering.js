// ============================================================
// Logique de récolte — fonctions pures (sans React).
// ============================================================

import { NODES } from "../data/gathering.js";
import { gainProfessionXp } from "./crafting.js";
import { recordGather } from "./counters.js";
import { rollGather as rollGatherPerks } from "./perks.js";

export function canGather(player, nodeId) {
  const node = NODES[nodeId];
  if (!node) return { ok: false, unknown: true };
  const level = player.professions[node.profession]?.level ?? 1;
  return { ok: level >= node.minLevel, level, minLevel: node.minLevel, profession: node.profession };
}

// Quantité récoltée (tirée au hasard dans la fourchette du nœud)
export function rollYield(node, rng = Math.random) {
  const [min, max] = node.yield;
  return min + Math.floor(rng() * (max - min + 1));
}

// Tirage complet d'une récolte, avec les avantages du métier : { qty, doubled, find }
export function rollHarvest(player, nodeId, rng = Math.random) {
  const node = NODES[nodeId];
  const level = player.professions?.[node.profession]?.level ?? 1;
  return rollGatherPerks(level, node.profession, rollYield(node, rng), rng);
}

// Applique une récolte : ajoute la ressource (et la trouvaille éventuelle) et l'xp de métier.
// Renvoie le même joueur si le niveau est insuffisant.
export function applyGather(player, nodeId, qty, find = null) {
  const check = canGather(player, nodeId);
  if (!check.ok) return { player, gained: null, xp: 0, levelUp: false };
  const node = NODES[nodeId];
  const prof = player.professions[node.profession];
  const next = gainProfessionXp(prof, node.xp);
  const resources = { ...player.resources, [node.resource]: (player.resources[node.resource] || 0) + qty };
  for (const [id, n] of Object.entries(find || {})) resources[id] = (resources[id] || 0) + n;
  let after = recordGather({ ...player, resources, professions: { ...player.professions, [node.profession]: next } }, node.resource, qty);
  for (const [id, n] of Object.entries(find || {})) after = recordGather(after, id, n);
  return {
    player: after,
    gained: { [node.resource]: qty, ...(find || {}) },
    xp: node.xp,
    levelUp: next.level > prof.level,
  };
}
