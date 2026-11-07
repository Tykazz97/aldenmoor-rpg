// ============================================================
// Compteurs d'activité du joueur (sans dépendance, pour éviter les imports circulaires).
// player.quests.counters = { kills: {idEnnemi: n}, gathered: {idRessource: n}, crafted: {idObjet: n} }
// Les quêtes mesurent leur progression en comparant ces compteurs à leur valeur au moment de l'acceptation.
// Les saves plus anciennes n'ont rien : tout est créé à la volée.
// ============================================================
export const emptyCounters = () => ({ kills: {}, gathered: {}, crafted: {} });
export const countersOf = (player) => ({ ...emptyCounters(), ...(player.quests?.counters || {}) });
export const counterValue = (player, kind, id) => countersOf(player)[kind][id] || 0;

function bump(player, kind, entries) {
  const q = player.quests || {};
  const counters = countersOf(player);
  const table = { ...counters[kind] };
  for (const [id, n] of Object.entries(entries)) if (n > 0) table[id] = (table[id] || 0) + n;
  return { ...player, quests: { ...q, counters: { ...counters, [kind]: table } } };
}
export const recordKills = (player, kills) => (kills && Object.keys(kills).length ? bump(player, "kills", kills) : player);
export const recordGather = (player, resourceId, qty) => bump(player, "gathered", { [resourceId]: qty });
export const recordCraft = (player, itemId) => bump(player, "crafted", { [itemId]: 1 });
