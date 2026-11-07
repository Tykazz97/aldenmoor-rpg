// ============================================================
// Les joueurs simulés dans le navigateur : sauvegarde (localStorage), rattrapage à l'heure actuelle, et la liste
// « vivante » (avec les niveaux du moment) que le reste du jeu consulte. Toute la logique est dans lives.js.
// ============================================================
import { getPopulation } from "./population.js";
import { SIM_START } from "./config.js";
import { createLives, advanceLives, liveBots, validWorld, migrateWorld } from "./lives.js";

export const LIVES_KEY = "aldenmoor:sims";
let world = null, cacheStep = -1, cacheList = null;

function read() { try { return JSON.parse(localStorage.getItem(LIVES_KEY) || "null"); } catch { return null; } }
function write(w) { try { localStorage.setItem(LIVES_KEY, JSON.stringify(w)); } catch { /* ignoré : le jeu marche sans */ } }

export function getLiveWorld(now = Date.now()) {
  const pop = getPopulation();
  if (!world) {
    const saved = migrateWorld(read());
    world = validWorld(saved, SIM_START, pop) ? saved : createLives({ population: pop, mode: SIM_START.mode, epoch: SIM_START.epoch, now });
    cacheStep = -1;
  }
  if (advanceLives(world, pop, now) > 0 || cacheStep < 0) { write(world); cacheStep = world.step; cacheList = null; }
  return world;
}

// La population avec les niveaux du moment (même tableau tant que rien n'a changé)
export function getLivePopulation(now = Date.now()) {
  const w = getLiveWorld(now);
  return (cacheList ||= liveBots(w, getPopulation()));
}
