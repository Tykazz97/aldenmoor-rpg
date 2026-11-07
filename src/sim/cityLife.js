// ============================================================
// Vie des joueurs simulés dans la ville d'Aldenmoor. Sans React, testable.
//
// Une vingtaine de simulés sont présents en même temps, choisis dans la population de 200.
// Ils se promènent entre les lieux selon leur activité (les combattants vers le portail et le
// panneau, les récolteurs vers l'atelier et le coffre, les marchands vers le marché...), entrent
// parfois dans un bâtiment, discutent, et de temps en temps l'un d'eux repart par le portail
// pendant qu'un autre arrive : la ville ne se fige jamais.
// ============================================================
import { findPath, canStand, isWalkable } from "../utils/mapPath.js";
import { buildingObjects } from "../data/maps.js";
import { makeRng } from "./rng.js";
import { sayLine, replyLine } from "./chat.js";

export const CITY_POPULATION = 28;
const NONE = new Set();

// Où peut-on aller ? Devant chaque bâtiment, autour de la fontaine, sur la place.
function pointsOfInterest(map) {
  const bs = buildingObjects(map);
  const front = (b) => ({ id: b.id, kind: b.kind, x: b.x + 0.5, y: b.y + 1.5 });
  const fountain = [];
  for (let y = 0; y < map.rows.length; y++) for (let x = 0; x < map.rows[0].length; x++) if (map.rows[y][x] === "F") fountain.push({ x, y });
  const plaza = [];
  for (let y = 0; y < map.rows.length; y++) for (let x = 0; x < map.rows[0].length; x++) if (map.rows[y][x] === "P") plaza.push({ x: x + 0.5, y: y + 0.5 });
  const fx = fountain.length ? fountain.reduce((s, f) => s + f.x, 0) / fountain.length + 0.5 : map.rows[0].length / 2;
  const fy = fountain.length ? fountain.reduce((s, f) => s + f.y, 0) / fountain.length + 0.5 : map.rows.length / 2;
  const byKind = Object.fromEntries(bs.map((b) => [b.kind, front(b)]));
  return { byKind, plaza, fountain: { x: fx, y: fy }, portal: byKind.portail };
}

const WEIGHTS = {
  combattant: [["portail", 30], ["panneau", 30], ["plaza", 25], ["fontaine", 15]],
  recolteur: [["atelier", 30], ["coffre", 30], ["plaza", 25], ["fontaine", 15]],
  marchand: [["marche", 55], ["coffre", 15], ["plaza", 20], ["fontaine", 10]],
  flaneur: [["fontaine", 35], ["plaza", 40], ["marche", 8], ["atelier", 8], ["panneau", 9]],
};

function pickDestination(life, agent) {
  const { rng, poi } = life;
  const kind = rng.weighted(WEIGHTS[agent.bot.activity] || WEIGHTS.flaneur);
  let p, building = null;
  if (kind === "plaza") p = rng.pick(poi.plaza);
  else if (kind === "fontaine") { const a = rng() * Math.PI * 2, r = 2.1 + rng() * 1.2; p = { x: poi.fountain.x + Math.cos(a) * r, y: poi.fountain.y + Math.sin(a) * r }; }
  else { const f = poi.byKind[kind]; p = { x: f.x + (rng() - 0.5) * 1.6, y: f.y + (rng() - 0.5) * 0.6 }; building = kind; }
  return { p, building };
}

function sendTo(life, agent, dest, then) {
  let path = findPath(life.map, { x: agent.x, y: agent.y }, dest.p, NONE);
  if (!path) { const q = life.rng.pick(life.poi.plaza); path = findPath(life.map, { x: agent.x, y: agent.y }, q, NONE); then = null; }
  if (!path) return false;
  agent.path = path; agent.then = then; agent.state = "walk";
  return true;
}

function spawnAgent(life, bot, at) {
  const agent = { id: bot.id, bot, x: at.x, y: at.y, facing: life.rng.chance(0.5) ? 1 : -1, state: "idle", path: [], then: null, timer: 1 + life.rng() * 6 };
  life.agents.push(agent);
  return agent;
}

function randomPlazaPoint(life) {
  for (let i = 0; i < 40; i++) { const p = life.rng.pick(life.poi.plaza); if (canStand(life.map, p.x, p.y, NONE)) return { ...p }; }
  return { ...life.map.start, x: life.map.start.x + 0.5, y: life.map.start.y + 0.5 };
}

export function createCityLife({ map, population, seed = 1, count = CITY_POPULATION }) {
  const rng = makeRng(seed);
  const poi = pointsOfInterest(map);
  const life = { map, rng, poi, population, agents: [], clock: 0, nextChat: 3, nextSwap: 10, pending: [], history: [] };
  const order = population.map((b) => b).sort(() => rng() - 0.5);
  life.pool = order.slice(count);
  for (const bot of order.slice(0, count)) {
    const a = spawnAgent(life, bot, randomPlazaPoint(life));
    if (rng.chance(0.6)) { const d = pickDestination(life, a); sendTo(life, a, d, d.building); }
  }
  // quelques lignes déjà dites, pour que le fil de discussion ne soit pas vide à l'arrivée
  const talkers = life.agents.filter((a) => a.bot.chatty > 0.4).slice(0, 5);
  talkers.forEach((a, i) => life.history.push({ t: -40 + i * 8, id: a.id, name: a.bot.name, level: a.bot.level, text: sayLine(rng, a.bot) }));
  return life;
}

const say = (life, agent, text) => ({ type: "say", t: life.clock, id: agent.id, name: agent.bot.name, level: agent.bot.level, text });

// Le joueur écrit dans le fil : un simulé répond parfois
export function playerSays(life, text) {
  const candidates = life.agents.filter((a) => a.state !== "inside");
  if (!candidates.length) return;
  if (life.rng.chance(0.7)) life.pending.push({ at: life.clock + 2 + life.rng() * 3.5, id: life.rng.pick(candidates).id, to: text });
}

export function stepCityLife(life, dt) {
  const { rng, map } = life;
  const events = [];
  life.clock += dt;

  for (const a of life.agents) {
    if (a.state === "inside") {
      a.timer -= dt;
      if (a.timer <= 0) { a.state = "idle"; a.timer = 2 + rng() * 5; }
      continue;
    }
    if (a.state === "walk" || a.state === "leaving") {
      let step = a.bot.speed * dt;
      while (step > 0 && a.path.length) {
        const tg = a.path[0], d = Math.hypot(tg.x - a.x, tg.y - a.y);
        if (Math.abs(tg.x - a.x) > 0.05) a.facing = tg.x > a.x ? 1 : -1;
        if (d <= step) { a.x = tg.x; a.y = tg.y; step -= d; a.path.shift(); }
        else { a.x += ((tg.x - a.x) / d) * step; a.y += ((tg.y - a.y) / d) * step; step = 0; }
      }
      if (!a.path.length) {
        if (a.state === "leaving") { a.gone = true; continue; }
        const b = a.then; a.then = null;
        // devant un bâtiment (sauf portail et panneau) : on y entre parfois
        if (b && b !== "portail" && b !== "panneau" && rng.chance(0.55)) { a.state = "inside"; a.timer = 4 + rng() * 9; }
        else { a.state = "idle"; a.timer = 2 + rng() * 8; }
      }
      continue;
    }
    // idle
    a.timer -= dt;
    if (a.timer <= 0) { const d = pickDestination(life, a); if (!sendTo(life, a, d, d.building)) a.timer = 2; }
  }

  // départs par le portail, arrivées par le portail
  const leaving = life.agents.filter((a) => a.gone);
  for (const a of leaving) { life.agents = life.agents.filter((x) => x !== a); life.pool.push(a.bot); }
  if (life.clock >= life.nextSwap) {
    life.nextSwap = life.clock + 9 + rng() * 14;
    const movable = life.agents.filter((a) => a.state === "idle" || a.state === "walk");
    if (movable.length > 10 && life.pool.length) {
      const a = rng.pick(movable);
      const p = life.poi.portal;
      a.state = "leaving"; a.then = null;
      a.path = findPath(map, { x: a.x, y: a.y }, { x: p.x, y: p.y }, NONE) || [];
      if (!a.path.length) a.gone = true;
      const bot = life.pool.splice(rng.int(0, life.pool.length - 1), 1)[0];
      const n = spawnAgent(life, bot, { x: p.x, y: p.y });
      n.timer = 0.5;
      events.push({ type: "arrive", t: life.clock, id: bot.id });
    }
  }

  // bavardage
  if (life.clock >= life.nextChat) {
    life.nextChat = life.clock + 5 + rng() * 9;
    const talkers = life.agents.filter((a) => a.state !== "inside");
    const total = talkers.reduce((s, a) => s + a.bot.chatty, 0);
    if (total > 0) {
      let r = rng() * total, who = talkers[0];
      for (const a of talkers) { r -= a.bot.chatty; if (r <= 0) { who = a; break; } }
      const ev = say(life, who, sayLine(rng, who.bot));
      events.push(ev);
      const others = talkers.filter((a) => a !== who);
      if (others.length && rng.chance(0.4)) life.pending.push({ at: life.clock + 2.5 + rng() * 4, id: rng.pick(others).id, to: ev.text });
    }
  }
  // réponses programmées
  life.pending = life.pending.filter((p) => {
    if (p.at > life.clock) return true;
    const a = life.agents.find((x) => x.id === p.id);
    const line = a ? (p.text ?? replyLine(rng, a.bot, p.to)) : null;
    if (line) events.push(say(life, a, line));
    return false;
  });
  return events;
}

// Où se trouve un simulé, dit en français (pour que le modèle de langage sache de quoi il parle)
const PLACE = { atelier: "devant l'atelier", coffre: "devant le coffre", marche: "devant le marché", panneau: "devant le panneau de recrutement", portail: "près du portail des régions" };
export function whereIs(life, agent) {
  let best = "sur la place d'Aldenmoor", bd = 3.2;
  for (const [kind, f] of Object.entries(life.poi.byKind)) { const d = Math.hypot(f.x - agent.x, f.y - agent.y); if (d < bd) { bd = d; best = PLACE[kind] || best; } }
  if (Math.hypot(life.poi.fountain.x - agent.x, life.poi.fountain.y - agent.y) < 3.4) best = "près de la fontaine";
  return best;
}

// Qui répond au joueur ? Celui dont le pseudo est cité, sinon le plus proche (à portée de voix).
export function pickResponder(life, text, near) {
  const cands = life.agents.filter((a) => a.state !== "inside");
  if (!cands.length) return null;
  const t = String(text).toLowerCase();
  const named = cands.find((a) => t.includes(a.bot.name.toLowerCase()));
  if (named) return named;
  const reach = near ? cands.filter((a) => Math.hypot(a.x - near.x, a.y - near.y) < 9) : [];
  const pool = reach.length ? reach : cands;
  const total = pool.reduce((s, a) => s + 0.2 + a.bot.chatty, 0);
  let r = life.rng() * total;
  for (const a of pool) { r -= 0.2 + a.bot.chatty; if (r <= 0) return a; }
  return pool[0];
}

// Fait dire une phrase toute faite (réponse du modèle de langage) à un simulé, après un délai de frappe
export function queueSay(life, id, text, delay = 1) {
  life.pending.push({ at: life.clock + delay, id, text });
}

export const agentCount = (life) => life.agents.length;
export const visibleAgents = (life) => life.agents.filter((a) => a.state !== "inside");
export { isWalkable };
