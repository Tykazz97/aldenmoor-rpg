// ============================================================
// Récolte automatique : choisit la prochaine ressource à aller récolter. Sans React.
// Le héros prend la plus proche (par le chemin à parcourir) parmi les ressources présentes sur la carte qu'il peut récolter
// (niveau de métier suffisant, place dans le sac) et atteindre à pied. Quand il n'y en a plus, on attend la repousse.
// ============================================================
import { NODES } from "../data/gathering.js";
import { canGather } from "./gathering.js";
import { roomFor } from "./bag.js";
import { pathToObject } from "./mapPath.js";

export const AUTO_RETRY_MS = 20000;     // une ressource inatteignable n'est pas retentée avant ce délai
export const AUTO_LOOKUP = 8;           // nombre de ressources les plus proches dont on calcule le chemin

const pathLength = (from, pts) => { let len = 0, x = from.x, y = from.y; for (const p of pts) { len += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; } return len; };

// `nodes` : les ressources présentes (repoussées) sur la carte ; `skip` : Map id -> instant avant lequel on l'ignore.
// Renvoie { node, path, unreachable } s'il y a une cible, sinon { node: null, wait, unreachable } avec wait :
//   "respawn" (rien de disponible : on attend la repousse), "bag" (sac plein), "locked" (niveau de métier trop bas), "unreachable".
export function pickAutoNode({ map, pos, nodes, blocked, player, skip = new Map(), now = Date.now(), lookup = AUTO_LOOKUP }) {
  let bagFull = false, locked = 0, skipped = 0;
  const cands = [];
  for (const n of nodes) {
    const def = NODES[n.node];
    if (!def) continue;
    if ((skip.get(n.id) ?? 0) > now) { skipped++; continue; }
    if (!canGather(player, n.node).ok) { locked++; continue; }
    if (!roomFor(player, { produces: [def.resource] })) { bagFull = true; continue; }
    cands.push({ n, d: Math.hypot(n.x + 0.5 - pos.x, n.y + 0.5 - pos.y) });
  }
  cands.sort((a, b) => a.d - b.d);
  let best = null;
  const unreachable = [];
  for (const c of cands.slice(0, lookup)) {
    const p = pathToObject(map, pos, c.n, blocked);
    if (p === null) { unreachable.push(c.n.id); continue; }
    const len = pathLength(pos, p);
    if (!best || len < best.len) best = { node: c.n, path: p, len };
  }
  if (best) return { node: best.node, path: best.path, unreachable };
  const wait = cands.length ? "unreachable" : bagFull ? "bag" : locked && !skipped ? "locked" : "respawn";
  return { node: null, wait, unreachable };
}

export const AUTO_WAIT_TEXT = {
  respawn: "en attente de la repousse des ressources…",
  bag: "sac plein, en pause (vends ou range des ressources)",
  locked: "les ressources restantes demandent un niveau de métier supérieur",
  unreachable: "aucune ressource accessible pour le moment…",
};
