// ============================================================
// RESSOURCES — matières lâchées par les monstres, utilisées pour
// crafter l'équipement (voir recipes.js) et vendues/échangées.
//
// rarity : "commune" (~50 %), "peu_commune" (~15 %), "rare" (~2 %)
// value  : prix de base en or, point de départ de l'économie.
//          Le prix réel variera avec l'offre et la demande.
// img    : null tant que le visuel n'existe pas (à générer avec Ludo).
// ============================================================

const RES_BASE = "/assets/icons/resources";

export const RESOURCE_RARITIES = {
  commune: { label: "Commune", color: "#9a9a9a", baseChance: 0.5 },
  peu_commune: { label: "Peu commune", color: "#5fa3c4", baseChance: 0.15 },
  rare: { label: "Rare", color: "#c9a13f", baseChance: 0.02 },
};

export const RESOURCES = {
  // --- Loup des plaines ---
  croc_de_loup: {
    id: "croc_de_loup", name: "Croc de loup", rarity: "commune", value: 5,
    source: "loup_des_plaines", img: null,
  },
  fourrure_grise: {
    id: "fourrure_grise", name: "Fourrure grise", rarity: "peu_commune", value: 20,
    source: "loup_des_plaines", img: null,
  },
  oeil_de_loup_argente: {
    id: "oeil_de_loup_argente", name: "Œil de loup argenté", rarity: "rare", value: 150,
    source: "loup_des_plaines", img: null,
  },

  // --- Sanglier sauvage ---
  peau_de_sanglier: {
    id: "peau_de_sanglier", name: "Peau de sanglier", rarity: "commune", value: 5,
    source: "sanglier_sauvage", img: null,
  },
  defense_ebrechee: {
    id: "defense_ebrechee", name: "Défense ébréchée", rarity: "peu_commune", value: 20,
    source: "sanglier_sauvage", img: null,
  },
  coeur_de_sanglier: {
    id: "coeur_de_sanglier", name: "Cœur de sanglier", rarity: "rare", value: 150,
    source: "sanglier_sauvage", img: null,
  },

  // --- Bandit des routes ---
  chiffon_rapiece: {
    id: "chiffon_rapiece", name: "Chiffon rapiécé", rarity: "commune", value: 4,
    source: "bandit_des_routes", img: null,
  },
  ferraille_emoussee: {
    id: "ferraille_emoussee", name: "Ferraille émoussée", rarity: "peu_commune", value: 18,
    source: "bandit_des_routes", img: null,
  },
  parchemin_froisse: {
    id: "parchemin_froisse", name: "Parchemin froissé", rarity: "rare", value: 160,
    source: "bandit_des_routes", img: null,
  },

  // --- Cavalier Déchu (mini-boss, exclusives) ---
  eperon_corrompu: {
    id: "eperon_corrompu", name: "Éperon corrompu", rarity: "rare", value: 400,
    source: "cavalier_dechu", img: null,
  },
  fragment_armure_maudite: {
    id: "fragment_armure_maudite", name: "Fragment d'armure maudite", rarity: "peu_commune", value: 90,
    source: "cavalier_dechu", img: null,
  },
};

export const RESOURCE_ORDER = Object.keys(RESOURCES);
