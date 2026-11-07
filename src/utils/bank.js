// ============================================================
// Coffre d'Aldenmoor : rangement d'objets et de ressources (sans React).
// player.bank = { items: [objet...], resources: { idRessource: quantité } }
// Les saves plus anciennes n'ont pas de coffre : on en crée un vide à la volée.
// ============================================================
export const emptyBank = () => ({ items: [], resources: {} });
export const bankOf = (player) => player.bank || emptyBank();

export function depositItem(player, uid) {
  const item = player.inventory.find((i) => i.uid === uid);
  if (!item) return player;
  const bank = bankOf(player);
  return { ...player, inventory: player.inventory.filter((i) => i.uid !== uid), bank: { ...bank, items: [...bank.items, item] } };
}

export function withdrawItem(player, uid) {
  const bank = bankOf(player);
  const item = bank.items.find((i) => i.uid === uid);
  if (!item) return player;
  return { ...player, inventory: [...player.inventory, item], bank: { ...bank, items: bank.items.filter((i) => i.uid !== uid) } };
}

// qty = nombre, ou Infinity pour « tout »
function moveResource(from, to, id, qty) {
  const n = Math.min(qty, from[id] || 0);
  if (!(n > 0)) return null;
  const nextFrom = { ...from, [id]: from[id] - n };
  if (nextFrom[id] <= 0) delete nextFrom[id];
  return { from: nextFrom, to: { ...to, [id]: (to[id] || 0) + n } };
}

export function depositResource(player, id, qty = 1) {
  const bank = bankOf(player);
  const r = moveResource(player.resources, bank.resources, id, qty);
  return r ? { ...player, resources: r.from, bank: { ...bank, resources: r.to } } : player;
}

export function withdrawResource(player, id, qty = 1) {
  const bank = bankOf(player);
  const r = moveResource(bank.resources, player.resources, id, qty);
  return r ? { ...player, resources: r.to, bank: { ...bank, resources: r.from } } : player;
}
