// ============================================================
// RECETTES — ce qu'il faut pour crafter un objet.
// Clé = id de l'objet (voir items.js).
// ingredients : { idRessource: quantité }  (voir resources.js)
// gold        : coût en or du craft (puits d'or de l'économie)
//
// Règle de conception : la ressource rare n'est demandée que pour
// UNE pièce par set (le plastron), les autres pièces se font avec
// les ressources communes et peu communes.
// Les matières premières (bois, minerai, plantes) se récoltent sur la carte
// (gathering.js) ; les drops de monstres complètent. Bois, minerai, peaux, chiffons et orties
// passent d'abord par le RAFFINAGE (refining.js) : deux matières brutes donnent une matière raffinée,
// et les recettes ci-dessous demandent les matières raffinées. Les ressources du
// Cavalier Déchu servent à l'anneau et à l'amulette de boss (gearTiers.js).
// ============================================================

import { TIER_RECIPES } from "./gearTiers.js";

export const RECIPES = {
  // --- Clés de donjon (Bricoleur) ---
  cle_du_manoir: { ingredients: { essence_du_veilleur: 3, lingot_de_fer: 6, lingot_de_cuivre: 3, ectoplasme: 5 }, gold: 500 },

  // --- Harnois du Vétéran (sanglier + bandit) ---
  chapeau_veteran: { ingredients: { cuir_de_sanglier: 2, lingot_de_fer: 1, defense_ebrechee: 1 }, gold: 30 },
  plastron_veteran: { ingredients: { cuir_de_sanglier: 2, defense_ebrechee: 2, lingot_de_fer: 2, lingot_de_cuivre: 1, coeur_de_sanglier: 1 }, gold: 60 },
  gants_veteran: { ingredients: { cuir_de_sanglier: 2, lingot_de_fer: 1, defense_ebrechee: 1 }, gold: 25 },
  ceinture_veteran: { ingredients: { cuir_de_sanglier: 2, defense_ebrechee: 1, lingot_de_fer: 1 }, gold: 25 },
  jambieres_veteran: { ingredients: { cuir_de_sanglier: 2, lingot_de_fer: 2, defense_ebrechee: 1 }, gold: 35 },

  // --- Robes de l'Apprenti (chiffon en quantité + fourrure + parchemin) ---
  chapeau_apprenti: { ingredients: { etoffe: 2, fil_d_ortie: 1, fourrure_grise: 1 }, gold: 30 },
  plastron_apprenti: { ingredients: { etoffe: 3, fil_d_ortie: 2, sauge: 2, fourrure_grise: 2, parchemin_froisse: 1 }, gold: 60 },
  gants_apprenti: { ingredients: { etoffe: 2, fil_d_ortie: 1, fourrure_grise: 1 }, gold: 25 },
  ceinture_apprenti: { ingredients: { etoffe: 2, fil_d_ortie: 1, fourrure_grise: 1 }, gold: 25 },
  jambieres_apprenti: { ingredients: { etoffe: 2, fil_d_ortie: 1, fourrure_grise: 1 }, gold: 35 },

  // --- Cuirs du Traqueur (loup + chiffon) ---
  chapeau_traqueur: { ingredients: { croc_de_loup: 3, etoffe: 1, fourrure_grise: 1 }, gold: 30 },
  plastron_traqueur: { ingredients: { fourrure_grise: 3, croc_de_loup: 4, etoffe: 1, sauge: 2, oeil_de_loup_argente: 1 }, gold: 60 },
  gants_traqueur: { ingredients: { croc_de_loup: 3, etoffe: 1, fourrure_grise: 1 }, gold: 25 },
  ceinture_traqueur: { ingredients: { croc_de_loup: 3, etoffe: 1, fourrure_grise: 1 }, gold: 25 },
  jambieres_traqueur: { ingredients: { croc_de_loup: 4, etoffe: 1, fourrure_grise: 2 }, gold: 35 },

  // --- Armes et bouclier craftables (la dague et la masse tombent directement) ---
  epee_milicien: { ingredients: { lingot_de_fer: 2, ferraille_emoussee: 2, defense_ebrechee: 1, cuir_de_sanglier: 1 }, gold: 40 },
  baton_noueux: { ingredients: { planche_de_frene: 2, planche_de_chene: 1, etoffe: 1, fourrure_grise: 1 }, gold: 40 },
  arc_chasse: { ingredients: { planche_de_frene: 2, planche_de_chene: 1, croc_de_loup: 2, fourrure_grise: 2 }, gold: 40 },
  bouclier_milicien: { ingredients: { planche_de_chene: 1, lingot_de_fer: 2, cuir_de_sanglier: 2, defense_ebrechee: 2 }, gold: 45 },
};

// Paliers 2 et 3 (sets des Champs Calcinés et de la Lisière, objets de boss) : voir gearTiers.js
Object.assign(RECIPES, TIER_RECIPES);

// Objets qui ne se craftent pas mais tombent directement sur un monstre :
// dague_ebrechee et masse_rouillee (voir drops dans zones.js).
