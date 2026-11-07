// ============================================================
// Vie des joueurs simulés sur les cartes de région. Sans React, testable.
//
// Quelques groupes de 1 à 3 aventuriers (tirés de la population, de niveau adapté à la région) y vivent comme
// de vrais joueurs : ils se promènent ensemble, choisissent un groupe de monstres libre, vont l'affronter, le
// vainquent (le groupe est alors vraiment éliminé : il réapparaît après son délai habituel, comme si tu l'avais
// tué toi-même) puis repartent. Ils évitent les mini-boss et tout groupe que le joueur est en train d'engager.
//
// Même forme d'agent que cityLife.js ({ id, bot, x, y, facing, state, path }) pour partager le rendu (CityCrowd).
// ============================================================
import { findPath, canStand } from "../utils/mapPath.js";
import { ENCOUNTERS } from "../data/encounters.js";
import { ZONES } from "../data/zones.js";
import { makeRng } from "./rng.js";

export const MAP_PARTIES = 3;                 // groupes d'aventuriers présents sur une carte
export const FIGHT_COOLDOWN = [14, 30];       // secondes minimum entre deux victoires sur une même carte
const NONE = new Set();

// Niveaux conseillés de la région (« Niveaux 8 à 14 » → [8, 14])
export function regionLevels(map) {
  const r = ZONES.aldenmoor.regions.find((x) => x.key === map.regionKey);
  const m = /(\d+)\D+(\d+)/.exec(r?.levels || "");
  return m ? [Number(m[1]), Number(m[2])] : [1, 8];
}

const encOf = (g) => ENCOUNTERS.find((e) => e.id === g.encounter);
const centerOf = (g) => ({ x: g.x + 0.5, y: g.y + 0.5 });

// Places autour d'un groupe de monstres où les aventuriers se tiennent pour combattre
const AROUND = [[-1.1, 1.2], [1.1, 1.2], [0, 1.6], [-1.6, 0.2], [1.6, 0.2], [-0.8, -1.2], [0.8, -1.2]];
function standPoints(life, g, n) {
  const c = centerOf(g), pts = [];
  for (const [dx, dy] of AROUND) {
    const p = { x: c.x + dx, y: c.y + dy };
    if (canStand(life.map, p.x, p.y, life.blocked)) pts.push(p);
    if (pts.length === n) break;
  }
  return pts.length === n ? pts : null;
}

function randomStandable(life, near = null, radius = 12) {
  const { map, rng } = life;
  for (let i = 0; i < 80; i++) {
    const x = near ? near.x + (rng() - 0.5) * 2 * radius : 1 + rng() * (map.rows[0].length - 2);
    const y = near ? near.y + (rng() - 0.5) * 2 * radius : 1 + rng() * (map.rows.length - 2);
    if (canStand(map, x, y, life.blocked)) return { x, y };
  }
  return null;
}

// Forme les groupes : un chef de niveau adapté à la région, puis des compagnons de niveau proche
function formParties(life, population, count) {
  const { rng } = life;
  const [lo, hi] = regionLevels(life.map);
  const pool = population.filter((b) => b.level >= lo && b.level <= hi).sort(() => rng() - 0.5);
  const used = new Set();
  const parties = [];
  for (let i = 0; i < count; i++) {
    const size = rng.weighted([[1, 3], [2, 4], [3, 4]]);
    const leader = pool.find((b) => !used.has(b.id));
    if (!leader) break;
    used.add(leader.id);
    const members = [leader];
    for (const b of pool) {
      if (members.length >= size) break;
      if (!used.has(b.id) && Math.abs(b.level - leader.level) <= 3) { members.push(b); used.add(b.id); }
    }
    parties.push(members);
  }
  return parties;
}

export function createMapLife({ map, population, seed = 1, parties = MAP_PARTIES, blocked = NONE }) {
  const rng = makeRng(seed);
  const life = { map, rng, population: [], agents: [], parties: [], clock: 0, nextFight: 8 + rng() * 10, blocked, activeGroups: map.groups || [], avoid: new Set(), engaged: new Map() };
  formParties(life, population, parties).forEach((bots, i) => {
    const at = randomStandable(life) || { x: map.start.x + 0.5, y: map.start.y + 0.5 };
    const party = { id: `party${i}`, members: [], state: "idle", timer: 1 + rng() * 5, then: null };
    bots.forEach((bot, k) => {
      const agent = { id: bot.id, bot, x: at.x + k * 0.5, y: at.y, facing: rng.chance(0.5) ? 1 : -1, state: "idle", path: [], then: null, partyId: party.id };
      if (!canStand(map, agent.x, agent.y, life.blocked)) { agent.x = at.x; agent.y = at.y; }
      party.members.push(agent); life.agents.push(agent); life.population.push(bot);
    });
    life.parties.push(party);
  });
  return life;
}

// Envoie tout le groupe vers des points (un par membre) ; faux si un chemin manque
function sendParty(life, party, points, then) {
  const paths = [];
  for (let i = 0; i < party.members.length; i++) {
    const a = party.members[i];
    const path = findPath(life.map, { x: a.x, y: a.y }, points[i], life.blocked);
    if (!path) return false;
    paths.push(path);
  }
  party.members.forEach((a, i) => { a.path = paths[i]; a.state = "walk"; });
  party.state = "walk"; party.then = then;
  return true;
}

const namesOf = (party) => party.members.map((a) => a.bot.name).join(", ");
const say = (life, a, text) => ({ type: "say", t: life.clock, id: a.id, name: a.bot.name, level: a.bot.level, text });

// Un groupe de monstres libre, ordinaire, que ce groupe d'aventuriers peut affronter
function pickTarget(life, party) {
  const free = (life.activeGroups || []).filter((g) => {
    const enc = encOf(g);
    return enc && !enc.boss && !life.engaged.has(g.id) && !life.avoid.has(g.id);
  });
  free.sort(() => life.rng() - 0.5);
  for (const g of free.slice(0, 4)) {
    const pts = standPoints(life, g, party.members.length);
    if (pts && sendParty(life, party, pts, { fight: g.id })) return true;
  }
  return false;
}

function release(life, party) {
  for (const [id, p] of life.engaged) if (p === party) life.engaged.delete(id);
}

export function stepMapLife(life, dt) {
  const { rng } = life;
  const events = [];
  life.clock += dt;

  for (const a of life.agents) {
    if (a.state !== "walk") continue;
    let step = a.bot.speed * dt;
    while (step > 0 && a.path.length) {
      const tg = a.path[0], d = Math.hypot(tg.x - a.x, tg.y - a.y);
      if (Math.abs(tg.x - a.x) > 0.05) a.facing = tg.x > a.x ? 1 : -1;
      if (d <= step) { a.x = tg.x; a.y = tg.y; step -= d; a.path.shift(); }
      else { a.x += ((tg.x - a.x) / d) * step; a.y += ((tg.y - a.y) / d) * step; step = 0; }
    }
    if (!a.path.length) a.state = "idle";
  }

  for (const party of life.parties) {
    if (party.state === "walk") {
      if (party.members.some((a) => a.state === "walk")) {
        // la cible a disparu (le joueur l'a prise, ou il l'engage) : on renonce
        const gid = party.then?.fight;
        if (gid && (life.avoid.has(gid) || !(life.activeGroups || []).some((g) => g.id === gid))) { party.state = "idle"; party.timer = 2; party.members.forEach((a) => { a.state = "idle"; a.path = []; }); party.then = null; }
        continue;
      }
      const gid = party.then?.fight;
      const g = gid && (life.activeGroups || []).find((x) => x.id === gid);
      if (g && !life.avoid.has(gid) && !life.engaged.has(gid)) {
        party.state = "fight"; party.timer = 7 + rng() * 5; party.target = g.id;
        life.engaged.set(g.id, party);
        for (const a of party.members) a.facing = g.x + 0.5 >= a.x ? 1 : -1;
        events.push(say(life, rng.pick(party.members), "⚔ À l'attaque !"));
      } else { party.state = "idle"; party.timer = 3 + rng() * 5; }
      party.then = null;
      continue;
    }
    if (party.state === "fight") {
      party.timer -= dt;
      const g = (life.activeGroups || []).find((x) => x.id === party.target);
      if (!g || life.avoid.has(party.target)) { release(life, party); party.state = "idle"; party.timer = 3; continue; }
      if (party.timer <= 0) {
        release(life, party);
        events.push({ type: "cleared", id: g.id, by: party.members.map((a) => a.id), names: namesOf(party) });
        if (rng.chance(0.6)) events.push(say(life, rng.pick(party.members), rng.pick(["Victoire !", "Facile.", "Au suivant !", "Pas mal, ce butin."])));
        life.nextFight = life.clock + FIGHT_COOLDOWN[0] + rng() * (FIGHT_COOLDOWN[1] - FIGHT_COOLDOWN[0]);
        party.state = "idle"; party.timer = 3 + rng() * 6; party.target = null;
      }
      continue;
    }
    // idle : se promener ou aller se battre
    party.timer -= dt;
    if (party.timer > 0) continue;
    party.timer = 2 + rng() * 4;
    if (life.clock >= life.nextFight && rng.chance(0.6) && pickTarget(life, party)) continue;
    const lead = party.members[0];
    const dest = randomStandable(life, { x: lead.x, y: lead.y }, 10);
    if (!dest) continue;
    const pts = party.members.map((_, i) => ({ x: dest.x + i * 0.6, y: dest.y }));
    if (!sendParty(life, party, pts.map((p, i) => (canStand(life.map, p.x, p.y, life.blocked) ? p : dest)), null)) party.timer = 2;
  }
  return events;
}

// Qui affronte ce groupe de monstres en ce moment ? (pour prévenir le joueur)
export function whoFights(life, groupId) {
  const p = life.engaged.get(groupId);
  return p ? namesOf(p) : null;
}
