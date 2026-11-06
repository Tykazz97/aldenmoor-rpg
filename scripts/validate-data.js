// ============================================================
// Vérifie la cohérence des données du jeu :
//   node scripts/validate-data.js
// Échoue (code 1) si une référence pointe vers un objet,
// une ressource ou un ennemi qui n'existe pas.
// ============================================================

import { ITEMS, SETS } from "../src/data/items.js";
import { RESOURCES } from "../src/data/resources.js";
import { RECIPES } from "../src/data/recipes.js";
import { ENEMIES, ZONES } from "../src/data/zones.js";
import { getCraftInfo } from "../src/data/professions.js";

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Recettes -> objets et ressources existants
for (const [itemId, recipe] of Object.entries(RECIPES)) {
  if (!ITEMS[itemId]) err(`Recette pour un objet inconnu : ${itemId}`);
  for (const [resId, qty] of Object.entries(recipe.ingredients)) {
    if (!RESOURCES[resId]) err(`Recette ${itemId} : ressource inconnue ${resId}`);
    if (!(qty > 0)) err(`Recette ${itemId} : quantité invalide pour ${resId}`);
  }
}

// Chaque recette doit être rattachée à un métier
for (const itemId of Object.keys(RECIPES)) {
  if (!getCraftInfo(itemId)) err(`Recette ${itemId} : aucun métier ne la fabrique`);
}

// Drops des ennemis -> ressources / objets existants
const dropped = new Set();
for (const [enemyId, enemy] of Object.entries(ENEMIES)) {
  for (const d of enemy.drops || []) {
    const table = d.type === "resource" ? RESOURCES : d.type === "item" ? ITEMS : null;
    if (!table) { err(`Ennemi ${enemyId} : type de drop inconnu ${d.type}`); continue; }
    if (!table[d.id]) err(`Ennemi ${enemyId} : drop inconnu ${d.type}:${d.id}`);
    if (!(d.chance > 0 && d.chance <= 1)) err(`Ennemi ${enemyId} : chance invalide pour ${d.id}`);
    dropped.add(`${d.type}:${d.id}`);
  }
}

// Ressources : source existante, et dropée par cette source
for (const [resId, res] of Object.entries(RESOURCES)) {
  if (!ENEMIES[res.source]) err(`Ressource ${resId} : source inconnue ${res.source}`);
  else if (!dropped.has(`resource:${resId}`)) warn(`Ressource ${resId} : aucun ennemi ne la lâche`);
}

// Sets : pièces existantes et craftables
for (const [setId, set] of Object.entries(SETS)) {
  for (const pieceId of set.pieces) {
    if (!ITEMS[pieceId]) err(`Set ${setId} : pièce inconnue ${pieceId}`);
    else if (!RECIPES[pieceId] && !dropped.has(`item:${pieceId}`)) {
      warn(`Set ${setId} : ${pieceId} n'a ni recette ni drop`);
    }
  }
}

// Ennemis des régions -> existent
for (const zone of Object.values(ZONES)) {
  for (const region of zone.regions) {
    for (const eid of [...region.enemies, region.miniBoss]) {
      if (!ENEMIES[eid]) err(`Région ${region.key} : ennemi inconnu ${eid}`);
    }
  }
}

// Ressources jamais utilisées dans une recette (information)
const used = new Set(Object.values(RECIPES).flatMap((r) => Object.keys(r.ingredients)));
for (const resId of Object.keys(RESOURCES)) {
  if (!used.has(resId)) warn(`Ressource ${resId} : utilisée dans aucune recette (pour l'instant)`);
}

// Objets de la Région 1 sans aucune source
for (const itemId of Object.keys(ITEMS)) {
  if (!RECIPES[itemId] && !dropped.has(`item:${itemId}`)) {
    warn(`Objet ${itemId} : aucune source (ni recette ni drop)`);
  }
}

warnings.forEach((w) => console.log("⚠ ", w));
errors.forEach((e) => console.log("✖ ", e));
console.log(
  errors.length
    ? `\n${errors.length} erreur(s), ${warnings.length} avertissement(s).`
    : `\nDonnées cohérentes (${warnings.length} avertissement(s)).`
);
process.exit(errors.length ? 1 : 0);
