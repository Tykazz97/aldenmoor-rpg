// ============================================================
// CLASSEMENT — niveau, fortune, métiers, heures jouées : tous les aventuriers (les simulés et toi) dans une même liste.
// Logique pure : on lui donne le joueur et la population « vivante » (sim/simWorld.js), elle rend les lignes triées.
// ============================================================
import { PROFESSIONS } from "../data/professions.js";
import { CLASSES } from "../data/classes.js";

export const SORTS = { niveau: "Niveau", or: "Fortune", metier: "Métier", heures: "Heures jouées" };
export const STEP_HOURS = 1 / 6;                    // un pas de simulation = 10 minutes

const profsOfLife = (life) => ({ ...(life?.pro || {}), ...(life?.prof ? { [life.prof.key]: life.prof } : {}) });
const bestOf = (profs, only = null) => {
  let best = null;
  for (const [key, p] of Object.entries(profs || {})) {
    if (!PROFESSIONS[key] || (only && key !== only)) continue;
    const level = p?.level || 1, xp = p?.xp || 0;
    if (!best || level > best.level || (level === best.level && xp > best.xp)) best = { key, level, xp };
  }
  return best;
};

// Une ligne par aventurier : { id, name, classKey, level, xp, gold, profs, hours, isMe }
export function buildRanking(player, bots) {
  const rows = [];
  for (const b of bots || []) {
    const life = b.life;
    rows.push({ id: b.id, name: b.name, classKey: b.classKey, level: b.level, xp: life?.xp || 0, gold: Math.round(b.gold ?? life?.gold ?? 0), profs: profsOfLife(life), hours: (life?.played || 0) * STEP_HOURS, isMe: false });
  }
  if (player) rows.push({ id: "me", name: player.name, classKey: player.classKey, level: player.level || 1, xp: player.xp || 0, gold: Math.round(player.gold || 0), profs: player.professions || {}, hours: (player.playSec || 0) / 3600, isMe: true });
  return rows;
}

// Trie (sans modifier la liste). `metier` : un métier précis, ou null pour le meilleur de chacun.
export function sortRows(rows, sort = "niveau", metier = null) {
  const prof = (r) => bestOf(r.profs, metier);
  const key = {
    niveau: (a, b) => b.level - a.level || b.xp - a.xp,
    or: (a, b) => b.gold - a.gold,
    metier: (a, b) => (prof(b)?.level || 0) - (prof(a)?.level || 0) || (prof(b)?.xp || 0) - (prof(a)?.xp || 0),
    heures: (a, b) => b.hours - a.hours,
  }[sort] || (() => 0);
  return rows.slice().sort((a, b) => key(a, b) || b.level - a.level || b.xp - a.xp || (a.name > b.name ? 1 : -1));
}

export const professionOf = (row, metier = null) => bestOf(row.profs, metier);

// Rang de chaque ligne (1 = premier) pour un tri donné : { id: rang }. Les ex æquo gardent le même rang.
export function ranksFor(rows, sort, metier = null) {
  const sorted = sortRows(rows, sort, metier);
  const val = (r) => (sort === "niveau" ? `${r.level}:${r.xp}` : sort === "or" ? r.gold : sort === "heures" ? Math.round(r.hours * 10) : `${professionOf(r, metier)?.level || 0}:${professionOf(r, metier)?.xp || 0}`);
  const out = {}; let rank = 0, last = null;
  sorted.forEach((r, i) => { const v = val(r); if (v !== last) { rank = i + 1; last = v; } out[r.id] = rank; });
  return out;
}

export const formatHours = (h) => (h < 1 ? `${Math.round(h * 60)} min` : h < 100 ? `${Math.round(h * 10) / 10} h`.replace(".", ",") : `${Math.round(h)} h`);
export const classLabel = (key) => CLASSES[key]?.label || key;
export const classIcon = (key) => CLASSES[key]?.icon || "";
