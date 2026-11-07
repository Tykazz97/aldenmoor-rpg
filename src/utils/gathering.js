// ============================================================
// Logique de récolte — fonctions pures (sans React).
// ============================================================

import { NODES } from "../data/gathering.js";
import { gainProfessionXp } from "./crafting.js";

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

// Applique une récolte : ajoute la ressource et l'xp de métier.
// Renvoie le même joueur si le niveau est insuffisant.
export function applyGather(player, nodeId, qty) {
  const check = canGather(player, nodeId);
  if (!check.ok) return { player, gained: null, xp: 0, levelUp: false };
  const node = NODES[nodeId];
  const prof = player.professions[node.profession];
  const next = gainProfessionXp(prof, node.xp);
  return {
    player: {
      ...player,
      resources: { ...player.resources, [node.resource]: (player.resources[node.resource] || 0) + qty },
      professions: { ...player.professions, [node.profession]: next },
    },
    gained: { [node.resource]: qty },
    xp: node.xp,
    levelUp: next.level > prof.level,
  };
}
