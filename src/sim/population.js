// ============================================================
// Population de joueurs simulés ("simplayers").
// Chacun a la même forme qu'un futur vrai joueur : pseudo, classe, niveau, apparence,
// plus quelques traits de comportement. La population est déterministe : une même graine
// donne toujours les mêmes 200 aventuriers, sans rien à sauvegarder.
// ============================================================
import { CLASSES, CLASS_ORDER } from "../data/classes.js";
import { HERO_OUTFITS } from "../data/heroSprites.js";
import { MAX_LEVEL } from "../utils/progression.js";
import { makeRng, hashString } from "./rng.js";
import { makePseudo } from "./names.js";

export const POPULATION_SIZE = 200;
export const DEFAULT_SEED = 1337;
// Traits de caractère et objectifs du moment : de quoi donner une personnalité à chacun
const TRAITS = [
  "blagueur, adore taquiner", "timide et poli", "grognon mais serviable", "passionné d'artisanat", "radin, compte chaque pièce",
  "enthousiaste, plein d'énergie", "calme et posé", "compétitif, veut être le meilleur", "curieux, pose beaucoup de questions",
  "sarcastique", "serviable avec les débutants", "rêveur, aime l'ambiance du jeu", "pragmatique et direct", "bavard, raconte sa vie",
];
const GOALS = {
  combattant: ["tu veux monter de niveau en chassant", "tu cherches un groupe pour les Prairies", "tu veux battre le boss des prairies"],
  recolteur: ["tu montes ton métier de récolte", "il te manque des ressources pour un craft", "tu veux équiper ta classe en entier"],
  marchand: ["tu amasses un stock pour l'ouverture du marché", "tu surveilles les prix des ressources"],
  flaneur: ["tu découvres le jeu tranquillement", "tu cherches une guilde sympa", "tu discutes en attendant des amis"],
};
// Cupidité : de combien ce joueur majore ses prix à l'hôtel des ventes (négatif = il casse les prix)
const GREED = {
  "radin, compte chaque pièce": 0.28, "compétitif, veut être le meilleur": -0.04, "pragmatique et direct": 0.04, "serviable avec les débutants": -0.05,
  "grognon mais serviable": 0.02, "passionné d'artisanat": 0.06, "sarcastique": 0.1, "blagueur, adore taquiner": 0.08,
};
export const ACTIVITIES = ["combattant", "recolteur", "marchand", "flaneur"];

// niveaux : beaucoup de débutants, de moins en moins de vétérans
function rollLevel(rng) {
  const band = rng.weighted([[[1, 8], 38], [[9, 18], 30], [[19, 30], 20], [[31, 42], 9], [[43, MAX_LEVEL], 3]]);
  return rng.int(band[0], Math.min(band[1], MAX_LEVEL));
}

export function generateBot(rng, index, usedNames) {
  let name, guard = 0;
  do { name = makePseudo(rng); } while (usedNames.has(name.toLowerCase()) && ++guard < 50);
  if (usedNames.has(name.toLowerCase())) name = `${name}${index}`;
  usedNames.add(name.toLowerCase());

  const classKey = rng.weighted([["guerrier", 38], ["assassin", 27], ["magicien", 35]]);
  const gender = rng.chance(0.46) ? "f" : "m";
  const level = rollLevel(rng);
  const own = CLASSES[classKey].outfit;
  // tenue : le plus souvent celle de sa classe ; les débutants sortent parfois en voyageur, les autres s'amusent avec l'apparence
  let outfit = own;
  const r = rng();
  if (level < 8 && r < 0.22) outfit = "base";
  else if (r > 0.84) outfit = rng.pick(HERO_OUTFITS);
  const activity = rng.weighted([["combattant", 36], ["recolteur", 28], ["marchand", 12], ["flaneur", 24]]);
  const id = `sim_${String(index + 1).padStart(3, "0")}`;
  const prng = makeRng(hashString(id));            // tirage à part : n'influence pas le reste de la population
  const trait = prng.pick(TRAITS), goal = prng.pick(GOALS[activity]);
  const greed = Math.round(((GREED[trait] ?? 0.06) + (prng() - 0.5) * 0.08) * 100) / 100;
  return {
    id,
    name, classKey, gender, level,
    look: `${gender}/${outfit}`,
    activity,
    chatty: Math.round((0.15 + rng() * 0.85) * 100) / 100,   // 0 = muet, 1 = bavard
    casual: rng.chance(0.4),                                  // écrit en minuscules, sans ponctuation
    speed: Math.round((2.3 + rng() * 1.1) * 100) / 100,       // tuiles par seconde
    trait, goal, greed,
    sim: true,
  };
}

export function generatePopulation(seed = DEFAULT_SEED, n = POPULATION_SIZE) {
  const rng = makeRng(seed);
  const used = new Set();
  return Array.from({ length: n }, (_, i) => generateBot(rng, i, used));
}

// La population par défaut, générée une seule fois (partagée par la ville et le choix des compagnons)
let cached = null;
export function getPopulation() { return (cached ||= generatePopulation()); }
