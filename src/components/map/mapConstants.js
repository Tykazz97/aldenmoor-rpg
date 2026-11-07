// Constantes et petits outils communs aux fichiers de la carte.
import { ENCOUNTERS } from "../../data/encounters.js";

export const VIEW_W = 14;        // largeur visible : 14 tuiles
export const SPEED = 4.4;        // vitesse du héros, en tuiles par seconde
export const TOUCH = 0.95;       // distance à laquelle on "touche" un objet en marchant au clavier
export const HARVEST_MS = 2000;  // durée d'une récolte (un cycle complet de l'animation de métier)
export const WALK_CYCLE = 0.72;  // durée d'un cycle de marche, en secondes
export const cq = (n) => `calc(var(--cq) * ${n})`;
export const key = (x, y) => `${x},${y}`;
export const encounterOf = (id) => ENCOUNTERS.find((e) => e.id === id);
export const MOVE_KEYS = {
  ArrowLeft: [-1, 0], q: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
  ArrowUp: [0, -1], z: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
};
