// ============================================================
// RAFFINAGE — transformer les matières brutes en matières raffinées, à l'atelier.
// Clé = id de la ressource raffinée produite (voir resources.js). On en fabrique 1 à la fois (ou par lots).
// ingredients : { idRessourceBrute: quantité }   gold : coût en or par unité produite (puits d'or)
// profession  : métier de raffinage ;  minLevel : niveau de métier requis ;  xp : xp de métier par unité
//
// Règle : 2 matières brutes donnent 1 matière raffinée, et la matière raffinée vaut ~1,3 fois les deux brutes
// (voir resources.js) : raffiner rapporte un petit bénéfice, en échange de temps et d'un peu d'or.
// Les recettes d'équipement (recipes.js) demandent ces matières raffinées.
// ============================================================
export const REFINING = {
  lingot_de_fer: { profession: "fondeur", minLevel: 1, ingredients: { minerai_de_fer: 2 }, gold: 2, xp: 5, verb: "Fondre" },
  lingot_de_cuivre: { profession: "fondeur", minLevel: 3, ingredients: { minerai_de_cuivre: 2 }, gold: 8, xp: 14, verb: "Fondre" },
  planche_de_frene: { profession: "scieur", minLevel: 1, ingredients: { bois_de_frene: 2 }, gold: 2, xp: 5, verb: "Scier" },
  planche_de_chene: { profession: "scieur", minLevel: 3, ingredients: { bois_de_chene: 2 }, gold: 8, xp: 14, verb: "Scier" },
  cuir_de_sanglier: { profession: "tanneur", minLevel: 1, ingredients: { peau_de_sanglier: 2 }, gold: 2, xp: 5, verb: "Tanner" },
  etoffe: { profession: "tisserand", minLevel: 1, ingredients: { chiffon_rapiece: 2 }, gold: 2, xp: 5, verb: "Retisser" },
  fil_d_ortie: { profession: "tisserand", minLevel: 1, ingredients: { ortie: 2 }, gold: 2, xp: 5, verb: "Filer" },
};
export const REFINING_ORDER = Object.keys(REFINING);

// Recettes d'un métier de raffinage, triées par niveau requis
export const refiningOf = (professionKey) =>
  REFINING_ORDER.filter((id) => REFINING[id].profession === professionKey).sort((a, b) => REFINING[a].minLevel - REFINING[b].minLevel);
