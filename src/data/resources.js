// ============================================================
// RESSOURCES — matières lâchées par les monstres, utilisées pour
// crafter l'équipement (voir recipes.js) et vendues/échangées.
//
// rarity : "commune" (~50 %), "peu_commune" (~15 %), "rare" (~2 %)
// value  : prix de base en or, point de départ de l'économie.
//          Le prix réel variera avec l'offre et la demande.
// img    : ajouté automatiquement plus bas à partir de l'id.
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
    source: "loup_des_plaines",
  },
  fourrure_grise: {
    id: "fourrure_grise", name: "Fourrure grise", rarity: "peu_commune", value: 20,
    source: "loup_des_plaines",
  },
  oeil_de_loup_argente: {
    id: "oeil_de_loup_argente", name: "Œil de loup argenté", rarity: "rare", value: 150,
    source: "loup_des_plaines",
  },

  // --- Sanglier sauvage ---
  peau_de_sanglier: {
    id: "peau_de_sanglier", name: "Peau de sanglier", rarity: "commune", value: 5,
    source: "sanglier_sauvage",
  },
  defense_ebrechee: {
    id: "defense_ebrechee", name: "Défense ébréchée", rarity: "peu_commune", value: 20,
    source: "sanglier_sauvage",
  },
  coeur_de_sanglier: {
    id: "coeur_de_sanglier", name: "Cœur de sanglier", rarity: "rare", value: 150,
    source: "sanglier_sauvage",
  },

  // --- Bandit des routes ---
  chiffon_rapiece: {
    id: "chiffon_rapiece", name: "Chiffon rapiécé", rarity: "commune", value: 4,
    source: "bandit_des_routes",
  },
  ferraille_emoussee: {
    id: "ferraille_emoussee", name: "Ferraille émoussée", rarity: "peu_commune", value: 18,
    source: "bandit_des_routes",
  },
  parchemin_froisse: {
    id: "parchemin_froisse", name: "Parchemin froissé", rarity: "rare", value: 160,
    source: "bandit_des_routes",
  },

  // --- Récolte (nœuds de la carte, voir gathering.js) ---
  bois_de_frene: { id: "bois_de_frene", name: "Bois de frêne", rarity: "commune", value: 6, source: "recolte" },
  bois_de_chene: { id: "bois_de_chene", name: "Bois de chêne", rarity: "peu_commune", value: 24, source: "recolte" },
  minerai_de_fer: { id: "minerai_de_fer", name: "Minerai de fer", rarity: "commune", value: 6, source: "recolte" },
  minerai_de_cuivre: { id: "minerai_de_cuivre", name: "Minerai de cuivre", rarity: "peu_commune", value: 24, source: "recolte" },
  ortie: { id: "ortie", name: "Ortie", rarity: "commune", value: 5, source: "recolte" },
  sauge: { id: "sauge", name: "Sauge", rarity: "peu_commune", value: 22, source: "recolte" },

  // --- Cavalier Déchu (mini-boss, exclusives) ---
  eperon_corrompu: {
    id: "eperon_corrompu", name: "Éperon corrompu", rarity: "rare", value: 400,
    source: "cavalier_dechu",
  },
  fragment_armure_maudite: {
    id: "fragment_armure_maudite", name: "Fragment d'armure maudite", rarity: "peu_commune", value: 90,
    source: "cavalier_dechu",
  },
};

// Chaque ressource a son icône : public/assets/icons/resources/<id>.png
for (const res of Object.values(RESOURCES)) {
  res.img = `${RES_BASE}/${res.id}.png`;
}

export const RESOURCE_ORDER = Object.keys(RESOURCES);
