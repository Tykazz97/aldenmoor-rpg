// ============================================================
// RECETTES — ce qu'il faut pour crafter un objet.
// Clé = id de l'objet (voir items.js).
// ingredients : { idRessource: quantité }  (voir resources.js)
// gold        : coût en or du craft (puits d'or de l'économie)
//
// Règle de conception : la ressource rare n'est demandée que pour
// UNE pièce par set (le plastron), les autres pièces se font avec
// les ressources communes et peu communes.
// Les ressources du Cavalier Déchu ne sont pas encore utilisées :
// elles serviront pour un set / des pièces dédiés (à définir).
// ============================================================

export const RECIPES = {
  // --- Harnois du Vétéran (sanglier + bandit) ---
  chapeau_veteran: { ingredients: { peau_de_sanglier: 3, ferraille_emoussee: 1, defense_ebrechee: 1 }, gold: 30 },
  plastron_veteran: { ingredients: { peau_de_sanglier: 4, defense_ebrechee: 2, ferraille_emoussee: 2, coeur_de_sanglier: 1 }, gold: 60 },
  gants_veteran: { ingredients: { peau_de_sanglier: 3, ferraille_emoussee: 1, defense_ebrechee: 1 }, gold: 25 },
  ceinture_veteran: { ingredients: { peau_de_sanglier: 3, defense_ebrechee: 1, ferraille_emoussee: 1 }, gold: 25 },
  jambieres_veteran: { ingredients: { peau_de_sanglier: 4, ferraille_emoussee: 2, defense_ebrechee: 1 }, gold: 35 },

  // --- Robes de l'Apprenti (chiffon en quantité + fourrure + parchemin) ---
  chapeau_apprenti: { ingredients: { chiffon_rapiece: 5, fourrure_grise: 1 }, gold: 30 },
  plastron_apprenti: { ingredients: { chiffon_rapiece: 6, fourrure_grise: 2, parchemin_froisse: 1 }, gold: 60 },
  gants_apprenti: { ingredients: { chiffon_rapiece: 4, fourrure_grise: 1 }, gold: 25 },
  ceinture_apprenti: { ingredients: { chiffon_rapiece: 4, fourrure_grise: 1 }, gold: 25 },
  jambieres_apprenti: { ingredients: { chiffon_rapiece: 5, fourrure_grise: 1 }, gold: 35 },

  // --- Cuirs du Traqueur (loup + chiffon) ---
  chapeau_traqueur: { ingredients: { croc_de_loup: 3, chiffon_rapiece: 2, fourrure_grise: 1 }, gold: 30 },
  plastron_traqueur: { ingredients: { fourrure_grise: 3, croc_de_loup: 4, chiffon_rapiece: 2, oeil_de_loup_argente: 1 }, gold: 60 },
  gants_traqueur: { ingredients: { croc_de_loup: 3, chiffon_rapiece: 2, fourrure_grise: 1 }, gold: 25 },
  ceinture_traqueur: { ingredients: { croc_de_loup: 3, chiffon_rapiece: 2, fourrure_grise: 1 }, gold: 25 },
  jambieres_traqueur: { ingredients: { croc_de_loup: 4, chiffon_rapiece: 2, fourrure_grise: 2 }, gold: 35 },

  // --- Armes et bouclier craftables (la dague et la masse tombent directement) ---
  epee_milicien: { ingredients: { ferraille_emoussee: 4, defense_ebrechee: 1, peau_de_sanglier: 2 }, gold: 40 },
  baton_noueux: { ingredients: { chiffon_rapiece: 3, ferraille_emoussee: 1, fourrure_grise: 1 }, gold: 40 },
  arc_chasse: { ingredients: { croc_de_loup: 3, fourrure_grise: 2, ferraille_emoussee: 1 }, gold: 40 },
  bouclier_milicien: { ingredients: { peau_de_sanglier: 4, ferraille_emoussee: 3, defense_ebrechee: 2 }, gold: 45 },
};

// Objets qui ne se craftent pas mais tombent directement sur un monstre :
// dague_ebrechee et masse_rouillee (voir drops dans zones.js).
