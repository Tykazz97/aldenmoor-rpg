// ============================================================
// Déplacements sur la carte (monde ouvert). Sans React.
//
// Le héros se déplace librement (coordonnées décimales, en tuiles) ;
// la grille ne sert qu'aux collisions et au calcul du chemin :
//   - isWalkable : la tuile est-elle praticable ?
//   - canStand   : le héros (un petit carré) peut-il se tenir ici ?
//   - findPath / pathToObject : plus court chemin (8 directions, sans
//     couper les coins) puis lissage, pour des trajectoires naturelles
//   - stepMove   : avance avec glissement le long des obstacles
// ============================================================

const BLOCKING = new Set(["#", "~", "r", "T"]);
export const HERO_RADIUS = 0.27;

export const mapWidth = (map) => map.rows[0].length;
export const mapHeight = (map) => map.rows.length;
export const tileAt = (map, x, y) => (map.rows[y] ? map.rows[y][x] : undefined);
export const inBounds = (map, x, y) => x >= 0 && y >= 0 && y < map.rows.length && x < map.rows[0].length;
export const isWalkable = (map, x, y) => inBounds(map, x, y) && !BLOCKING.has(tileAt(map, x, y));

// `blocked` : ensemble de "x,y" (tuiles entières) occupées par un groupe / un nœud
const tkey = (x, y) => `${x},${y}`;
const isFree = (map, x, y, blocked) => isWalkable(map, x, y) && !blocked.has(tkey(x, y));

export function canStand(map, x, y, blocked = new Set(), r = HERO_RADIUS) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!isFree(map, tx, ty, blocked)) return false;
  return true;
}

// Ligne droite libre entre a et b ? (échantillonnée)
function lineClear(map, a, b, blocked) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d / 0.12));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!canStand(map, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, blocked)) return false;
  }
  return true;
}

// Retire les points de passage inutiles (le héros coupe en ligne droite quand c'est possible)
function smooth(map, start, pts, blocked) {
  const out = [];
  let from = start, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(map, from, pts[j], blocked)) j--;
    out.push(pts[j]);
    from = pts[j];
    i = j + 1;
  }
  return out;
}

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// BFS 8 directions depuis la tuile de `from` vers l'une des tuiles de `goals` (Set de "x,y")
function bfs(map, from, goals, blocked) {
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  const prev = new Map([[tkey(sx, sy), null]]);
  const queue = [[sx, sy]];
  for (let qi = 0; qi < queue.length; qi++) {
    const [cx, cy] = queue[qi];
    if (goals.has(tkey(cx, cy))) {
      const tiles = [];
      let cur = [cx, cy];
      while (cur) { tiles.push({ x: cur[0] + 0.5, y: cur[1] + 0.5 }); cur = prev.get(tkey(cur[0], cur[1])); }
      return tiles.reverse().slice(1);
    }
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy, k = tkey(nx, ny);
      if (prev.has(k) || !isFree(map, nx, ny, blocked)) continue;
      if (dx && dy && (!isFree(map, cx + dx, cy, blocked) || !isFree(map, cx, cy + dy, blocked))) continue; // pas de coin coupé
      prev.set(k, [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Chemin jusqu'à un point (x, y) de la carte. Renvoie une liste de points de passage
// (le dernier est le point visé, ou le centre de sa tuile si le point est trop près d'un mur).
export function findPath(map, from, to, blocked = new Set()) {
  const gx = Math.floor(to.x), gy = Math.floor(to.y);
  if (!isFree(map, gx, gy, blocked)) return null;
  const tiles = bfs(map, from, new Set([tkey(gx, gy)]), blocked);
  if (tiles === null) return null;
  const end = canStand(map, to.x, to.y, blocked) ? { x: to.x, y: to.y } : { x: gx + 0.5, y: gy + 0.5 };
  if (!tiles.length) return lineClear(map, from, end, blocked) ? [end] : [{ x: gx + 0.5, y: gy + 0.5 }];
  tiles[tiles.length - 1] = end;
  return smooth(map, from, tiles, blocked);
}

// Chemin jusqu'à une tuile voisine d'un objet (groupe, nœud) pour l'engager / le récolter.
// Renvoie [] si on est déjà à portée.
export const REACH = 1.15;
export function pathToObject(map, from, target, blocked = new Set()) {
  const cx = target.x + 0.5, cy = target.y + 0.5;
  if (Math.hypot(from.x - cx, from.y - cy) <= REACH) return [];
  const goals = new Set();
  for (const [dx, dy] of DIRS8) {
    const x = target.x + dx, y = target.y + dy;
    if (isFree(map, x, y, blocked)) goals.add(tkey(x, y));
  }
  const tiles = bfs(map, from, goals, blocked);
  if (tiles === null) return null;
  return smooth(map, from, tiles, blocked);
}

// Déplacement avec glissement : on essaie l'axe X puis l'axe Y séparément.
export function stepMove(map, pos, dx, dy, blocked = new Set()) {
  let { x, y } = pos;
  if (dx && canStand(map, x + dx, y, blocked)) x += dx;
  if (dy && canStand(map, x, y + dy, blocked)) y += dy;
  return { x, y };
}

// ---- objets présents sur la carte (respawn en temps réel) ----
const alive = (cleared, id, delay, now) => cleared[id] === undefined || now - cleared[id] >= delay;
export const activeGroups = (map, world, now = Date.now()) => map.groups.filter((g) => alive(world.cleared, g.id, map.respawnMs, now));
export const activeNodes = (map, world, now = Date.now()) => (map.nodes || []).filter((n) => alive(world.cleared, n.id, map.nodeRespawnMs, now));
