// ============================================================
// Vérifie la cohérence des données du jeu :
//   node scripts/validate-data.js
// Échoue (code 1) si une référence pointe vers un objet,
// une ressource ou un ennemi qui n'existe pas.
// ============================================================

import { existsSync } from "node:fs";
import { ITEMS, SETS } from "../src/data/items.js";
import { RESOURCES } from "../src/data/resources.js";
import { NODES } from "../src/data/gathering.js";
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
  if (res.img && !existsSync(new URL(`../public${res.img}`, import.meta.url))) {
    err(`Ressource ${resId} : icône introuvable (${res.img})`);
  }
  if (res.source === "recolte") {
    if (!Object.values(NODES).some((nd) => nd.resource === resId)) err(`Ressource ${resId} : aucun nœud de récolte ne la donne`);
  } else if (!ENEMIES[res.source]) err(`Ressource ${resId} : source inconnue ${res.source}`);
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

// Ennemis jouables : stats, actions, visuel et sorts du joueur cohérents
import { WEAPON_TYPES } from "../src/data/weapons.js";
import { HERO_OUTFITS } from "../src/data/heroSprites.js";
for (const e of Object.values(ENEMIES)) {
  if (!e.stats) continue;
  for (const k of ["hp", "atkPhys", "atkMagie", "defPhys", "defMagie", "esquive", "critique", "vitesse"]) {
    if (typeof e.stats[k] !== "number") err(`Ennemi ${e.key} : stat manquante ${k}`);
  }
  if (!(e.xp > 0)) err(`Ennemi ${e.key} : xp manquante`);
  if (!e.actions?.length) err(`Ennemi ${e.key} : aucune action`);
  for (const a of e.actions || []) if (!(a.power > 0 && a.weight > 0 && a.pa >= 1)) err(`Ennemi ${e.key} : action invalide ${a.id}`);
  if (!existsSync(`public${e.img}`)) err(`Ennemi ${e.key} : image absente (${e.img})`);
}
import { CLASSES } from "../src/data/classes.js";
const checkSpell = (sp) => {
  if (sp.type !== "buff" && !(sp.power > 0)) err(`Sort ${sp.id} : puissance manquante`);
  if (!(sp.pa >= 1 && sp.pa <= 6)) err(`Sort ${sp.id} : coût en PA invalide`);
};
const spellIds = new Set();
for (const w of Object.values(WEAPON_TYPES)) {
  if (!w.spell) err(`Arme ${w.key} : sort manquant`);
  else { checkSpell(w.spell); spellIds.add(w.spell.id); }
}
for (const c of Object.values(CLASSES)) {
  if (!ITEMS[c.startWeapon]) err(`Classe ${c.key} : arme de départ inconnue`);
  for (const id of c.startGear) if (!ITEMS[id]) err(`Classe ${c.key} : pièce de départ inconnue ${id}`);
  if (!HERO_OUTFITS.includes(c.outfit)) err(`Classe ${c.key} : tenue inconnue`);
  if (!c.spells.some((sp) => sp.level === 1)) err(`Classe ${c.key} : aucun sort au niveau 1`);
  let last = 0;
  for (const sp of c.spells) {
    checkSpell(sp);
    if (sp.level < last) err(`Classe ${c.key} : sorts pas dans l'ordre des niveaux (${sp.id})`);
    last = sp.level;
    if (spellIds.has(sp.id)) err(`Sort ${sp.id} : identifiant en double`);
    spellIds.add(sp.id);
  }
}
for (const nd of Object.values(NODES)) {
  if (!existsSync(`public${nd.img}`)) err(`Nœud ${nd.id} : image absente (${nd.img})`);
}
for (const o of HERO_OUTFITS) for (const b of ["m", "f"]) {
  if (!existsSync(`public/assets/combat/hero/${b}/${o}.png`)) err(`Tenue du héros absente : ${b}/${o}`);
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
