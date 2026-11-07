// ============================================================
// Donjons : clé, entrée, enchaînement des salles (sans React). Les données sont dans data/dungeons.js.
// La clé est consommée à l'entrée, même en cas de défaite ; le butin de chaque salle gagnée est gardé.
// ============================================================
import { DUNGEONS } from "../data/dungeons.js";
import { ENEMIES } from "../data/zones.js";

export const keyCount = (player, dungeon) => (player.inventory || []).filter((i) => i.id === dungeon.keyItem).length;

// Retire UNE clé de l'inventaire (renvoie le même joueur s'il n'en a pas)
export function consumeKey(player, dungeon) {
  const idx = (player.inventory || []).findIndex((i) => i.id === dungeon.keyItem);
  if (idx < 0) return player;
  return { ...player, inventory: player.inventory.filter((_, i) => i !== idx) };
}

export const canEnter = (player, dungeon) => keyCount(player, dungeon) > 0 && (player.level || 1) >= 1;

// La salle `index` comme une « rencontre » que l'écran de combat sait jouer
export function roomEncounter(dungeon, index) {
  const room = dungeon.rooms[index];
  return {
    id: `${dungeon.key}:${room.id}`, name: room.name, level: `Salle ${index + 1}/${dungeon.rooms.length}`, enemies: room.enemies, desc: room.desc,
    boss: !!room.boss, banner: `Salle ${index + 1} — ${room.name}`,
  };
}

// Butin possible de tout le donjon (pour la fiche d'entrée) : ressources et objets, sans doublon
export function dungeonDrops(dungeon, classKey) {
  const seen = new Set(), out = [];
  for (const room of dungeon.rooms) for (const k of room.enemies) for (const d of ENEMIES[k].drops || []) {
    if (d.forClass && d.forClass !== classKey) continue;
    const id = `${d.type}:${d.id}`;
    if (!seen.has(id)) { seen.add(id); out.push(d); }
  }
  return out;
}

// Cumule le butin de plusieurs salles (pour le récapitulatif de fin d'expédition)
export function addRewards(total, r) {
  const res = { ...total.resources };
  for (const [k, v] of Object.entries(r.resources || {})) res[k] = (res[k] || 0) + v;
  return { xp: total.xp + (r.xp || 0), gold: total.gold + (r.gold || 0), resources: res, items: [...total.items, ...(r.items || [])] };
}
export const emptyRewards = () => ({ xp: 0, gold: 0, resources: {}, items: [] });
export const dungeonOf = (key) => DUNGEONS[key] || null;
