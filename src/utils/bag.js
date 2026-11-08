// ============================================================
// Le sac du joueur : une capacité en emplacements (sans React). Mêmes règles que le coffre (utils/bank.js) :
// un objet = 1 emplacement, un type de ressource = 1 emplacement (quelle que soit la quantité). Les objets portés n'en prennent pas.
// Il s'agrandit contre de l'or (`player.bagUpgrades` = nombre d'agrandissements, absent = 0).
//
// Un sac plein ne bloque que ce qui demanderait un NOUVEL emplacement : on peut toujours ajouter à une pile de ressources
// que l'on a déjà. Un joueur dont le sac dépasse la capacité (ancienne sauvegarde, remboursement d'une guilde dissoute…)
// n'est jamais amputé : il ne peut simplement plus rien ramasser avant d'avoir fait de la place. (À la lecture d'une ancienne
// sauvegarde, le sac est agrandi sans frais de ce qu'il faut pour tout contenir : grandfatherBag.)
//   - butin de combat : ce qui ne tient pas est perdu (fitRewards) ;
//   - fabrication, raffinage, potions, achats, retraits (coffre, guilde, annonces), équipement qui revient au sac : refusé (bagGuard).
// Les joueurs simulés ont leur propre sac (sim/lifeBank.js) : ils rangent le trop-plein au coffre, sans cette limite.
// ============================================================
export const BAG_START = 20;                                                // emplacements au départ
export const BAG_STEP = 5;                                                  // emplacements gagnés par agrandissement
export const BAG_UPGRADES = [150, 400, 900, 1800, 3200, 5500, 9000, 15000]; // prix de chaque agrandissement, dans l'ordre (60 emplacements au maximum)

export const bagUpgrades = (player) => player.bagUpgrades || 0;
export const bagCapacity = (player) => BAG_START + BAG_STEP * bagUpgrades(player);
export const resTypes = (player) => Object.values(player.resources || {}).filter((q) => q > 0).length;
export const bagUsed = (player) => (player.inventory || []).length + resTypes(player);
export const bagFree = (player) => bagCapacity(player) - bagUsed(player);
export const bagFull = (player) => bagFree(player) <= 0;
export const nextBagCost = (player) => BAG_UPGRADES[bagUpgrades(player)] ?? null;   // null = taille maximale

export function upgradeBag(player) {
  const cost = nextBagCost(player);
  if (cost === null || player.gold < cost) return player;
  return { ...player, gold: player.gold - cost, bagUpgrades: bagUpgrades(player) + 1 };
}

// Garde-fou des actions du joueur : si `next` demande plus de place que `prev` et dépasse la capacité, on garde `prev`.
export function bagGuard(prev, next) {
  if (next === prev) return prev;
  return bagUsed(next) > bagCapacity(next) && bagUsed(next) > bagUsed(prev) ? prev : next;
}

// Reste-t-il de la place pour que cette action produise `newItems` objets et les ressources `produces` (ids), après avoir consommé
// `consumes` ({ id: quantité }) ? Les piles entièrement consommées libèrent leur emplacement.
export function roomFor(player, { newItems = 0, produces = [], consumes = {} } = {}) {
  const res = player.resources || {};
  const freed = Object.entries(consumes).filter(([id, q]) => (res[id] || 0) > 0 && (res[id] || 0) <= q).length;
  const added = produces.filter((id) => !(res[id] > 0) || consumes[id] >= res[id]).length;
  return bagUsed(player) - freed + newItems + added <= bagCapacity(player) || newItems + added <= freed;
}

// Butin de combat : les ressources déjà en pile sont toujours rangées, puis les équipements et les nouvelles ressources tiennent dans les emplacements libres ; le reste est perdu.
// resources = { id: quantité }, itemIds = [idObjet]. Renvoie { resources, items, lost: { resources, items } }.
export function fitRewards(player, resources = {}, itemIds = []) {
  let free = bagFree(player);
  const kept = {}, lostRes = {};
  const owned = Object.entries(resources).filter(([id, q]) => q > 0 && player.resources?.[id] > 0);
  const fresh = Object.entries(resources).filter(([id, q]) => q > 0 && !(player.resources?.[id] > 0));
  for (const [id, q] of owned) kept[id] = q;
  const items = [], lostItems = [];
  for (const id of itemIds) { if (free >= 1) { items.push(id); free--; } else lostItems.push(id); }      // les équipements d'abord
  for (const [id, q] of fresh) { if (free >= 1) { kept[id] = q; free--; } else lostRes[id] = q; }
  return { resources: kept, items, lost: { resources: lostRes, items: lostItems } };
}
export const hasLost = (lost) => !!lost && (Object.keys(lost.resources || {}).length > 0 || (lost.items || []).length > 0);

// Reprise des anciennes sauvegardes (et mode test) : un sac qui contient déjà plus que la capacité est agrandi juste assez pour tout
// contenir, sans frais : on ne retire rien à un joueur. (`spare` = emplacements libres à prévoir en plus.) Sans effet sur un sac qui tient.
export function grandfatherBag(player, spare = 0) {
  const need = bagUsed(player) + spare - bagCapacity(player);
  return need > 0 ? { ...player, bagUpgrades: bagUpgrades(player) + Math.ceil(need / BAG_STEP) } : player;
}
