// ============================================================
// Déplacements sur la carte : tuiles praticables et plus court
// chemin (parcours en largeur, 4 directions). Sans React.
// ============================================================

const BLOCKING = new Set(["#", "~", "r", "T"]);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const mapWidth = (map) => map.rows[0].length;
export const mapHeight = (map) => map.rows.length;
export const tileAt = (map, x, y) => (map.rows[y] ? map.rows[y][x] : undefined);
export const inBounds = (map, x, y) => x >= 0 && y >= 0 && y < map.rows.length && x < map.rows[0].length;
export const isWalkable = (map, x, y) => inBounds(map, x, y) && !BLOCKING.has(tileAt(map, x, y));

// `blocked` : ensemble de "x,y" occupés (groupes d'ennemis présents)
export function findPath(map, from, to, blocked = new Set()) {
  if (!isWalkable(map, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [[from.x, from.y]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (prev.has(k) || !isWalkable(map, nx, ny)) continue;
      if (blocked.has(k) && !(nx === to.x && ny === to.y)) continue;
      prev.set(k, [cx, cy]);
      if (nx === to.x && ny === to.y) {
        const path = [];
        let cur = [nx, ny];
        while (cur && !(cur[0] === from.x && cur[1] === from.y)) { path.push({ x: cur[0], y: cur[1] }); cur = prev.get(key(cur[0], cur[1])); }
        return path.reverse();
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Chemin le plus court jusqu'à une tuile voisine d'une cible (pour engager un groupe)
export function pathToAdjacent(map, from, target, blocked = new Set()) {
  if (Math.abs(from.x - target.x) + Math.abs(from.y - target.y) === 1) return [];
  let best = null;
  for (const [dx, dy] of DIRS) {
    const to = { x: target.x + dx, y: target.y + dy };
    if (!isWalkable(map, to.x, to.y) || blocked.has(`${to.x},${to.y}`)) continue;
    const p = findPath(map, from, to, blocked);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

// Groupes présents sur la carte (ceux qui n'ont pas été vaincus récemment)
export function activeGroups(map, world) {
  return map.groups.filter((g) => {
    const at = world.cleared[g.id];
    return at === undefined || world.steps - at >= map.respawnSteps;
  });
}
