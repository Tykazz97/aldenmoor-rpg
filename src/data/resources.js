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

  // --- Squelette de fermier ---
  os_jauni: {
    id: "os_jauni", name: "Os jaunis", rarity: "commune", value: 9,
    source: "squelette_fermier",
  },
  lame_de_faux_rouillee: {
    id: "lame_de_faux_rouillee", name: "Lame de faux rouillée", rarity: "peu_commune", value: 35,
    source: "squelette_fermier",
  },
  crane_de_fermier: {
    id: "crane_de_fermier", name: "Crâne de fermier", rarity: "rare", value: 260,
    source: "squelette_fermier",
  },

  // --- Corbeau charognard ---
  plume_noire: {
    id: "plume_noire", name: "Plume noire", rarity: "commune", value: 9,
    source: "corbeau_charognard",
  },
  serre_de_corbeau: {
    id: "serre_de_corbeau", name: "Serre de corbeau", rarity: "peu_commune", value: 35,
    source: "corbeau_charognard",
  },
  oeil_de_charognard: {
    id: "oeil_de_charognard", name: "Œil de charognard", rarity: "rare", value: 260,
    source: "corbeau_charognard",
  },

  // --- Épouvantail hanté ---
  paille_calcinee: {
    id: "paille_calcinee", name: "Paille calcinée", rarity: "commune", value: 9,
    source: "epouvantail_hante",
  },
  jute_hantee: {
    id: "jute_hantee", name: "Jute hantée", rarity: "peu_commune", value: 35,
    source: "epouvantail_hante",
  },
  braise_vivante: {
    id: "braise_vivante", name: "Braise vivante", rarity: "rare", value: 260,
    source: "epouvantail_hante",
  },

  // --- L'Épouvantail Ancestral ---
  branche_ancestrale: {
    id: "branche_ancestrale", name: "Branche ancestrale", rarity: "peu_commune", value: 160,
    source: "epouvantail_ancestral",
  },
  coeur_de_braise: {
    id: "coeur_de_braise", name: "Cœur de braise", rarity: "rare", value: 600,
    source: "epouvantail_ancestral",
  },

  // --- Loup-garou ---
  griffe_de_garou: {
    id: "griffe_de_garou", name: "Griffe de garou", rarity: "commune", value: 16,
    source: "loup_garou",
  },
  pelage_maudit: {
    id: "pelage_maudit", name: "Pelage maudit", rarity: "peu_commune", value: 60,
    source: "loup_garou",
  },
  croc_de_pleine_lune: {
    id: "croc_de_pleine_lune", name: "Croc de pleine lune", rarity: "rare", value: 420,
    source: "loup_garou",
  },

  // --- Esprit errant ---
  ectoplasme: {
    id: "ectoplasme", name: "Ectoplasme", rarity: "commune", value: 16,
    source: "esprit_errant",
  },
  voile_spectral: {
    id: "voile_spectral", name: "Voile spectral", rarity: "peu_commune", value: 60,
    source: "esprit_errant",
  },
  larme_d_ame: {
    id: "larme_d_ame", name: "Larme d'âme", rarity: "rare", value: 420,
    source: "esprit_errant",
  },

  // --- Chevalier déchu ---
  plaque_noircie: {
    id: "plaque_noircie", name: "Plaque noircie", rarity: "commune", value: 16,
    source: "chevalier_dechu",
  },
  maille_corrompue: {
    id: "maille_corrompue", name: "Maille corrompue", rarity: "peu_commune", value: 60,
    source: "chevalier_dechu",
  },
  flamme_noire: {
    id: "flamme_noire", name: "Flamme noire", rarity: "rare", value: 420,
    source: "chevalier_dechu",
  },

  // --- Le Veilleur Corrompu (boss de la Lisière) ---
  // Essence du Veilleur : ingrédient de la Clé du Manoir Englouti (fabriquée par le Bricoleur).
  essence_du_veilleur: {
    id: "essence_du_veilleur", name: "Essence du Veilleur", rarity: "rare", value: 260,
    source: "veilleur_corrompu",
  },

  // --- Le Manoir Englouti (donjon) : ressources exclusives, pour les sets du palier 4 ---
  soie_funeraire: { id: "soie_funeraire", name: "Soie funéraire", rarity: "commune", value: 30, source: "serviteur_spectral", dungeon: true },
  cuir_de_molosse: { id: "cuir_de_molosse", name: "Cuir de molosse", rarity: "commune", value: 30, source: "molosse_du_manoir", dungeon: true },
  plaque_noyee: { id: "plaque_noyee", name: "Plaque noyée", rarity: "commune", value: 30, source: "garde_noye", dungeon: true },
  larme_de_deuil: { id: "larme_de_deuil", name: "Larme de deuil", rarity: "peu_commune", value: 110, source: "pleureuse", dungeon: true },
  essence_de_deuil: { id: "essence_de_deuil", name: "Essence de deuil", rarity: "rare", value: 700, source: "dame_en_deuil", dungeon: true },

  // --- Ressources RAFFINÉES : on ne les trouve pas, on les fabrique à l'atelier (voir refining.js) ---
  lingot_de_fer: { id: "lingot_de_fer", name: "Lingot de fer", rarity: "commune", value: 16, source: "raffinage" },
  lingot_de_cuivre: { id: "lingot_de_cuivre", name: "Lingot de cuivre", rarity: "peu_commune", value: 62, source: "raffinage" },
  planche_de_frene: { id: "planche_de_frene", name: "Planche de frêne", rarity: "commune", value: 16, source: "raffinage" },
  planche_de_chene: { id: "planche_de_chene", name: "Planche de chêne", rarity: "peu_commune", value: 62, source: "raffinage" },
  cuir_de_sanglier: { id: "cuir_de_sanglier", name: "Cuir de sanglier", rarity: "commune", value: 13, source: "raffinage" },
  etoffe: { id: "etoffe", name: "Étoffe", rarity: "commune", value: 10, source: "raffinage" },
  fil_d_ortie: { id: "fil_d_ortie", name: "Fil d'ortie", rarity: "commune", value: 13, source: "raffinage" },
};

// Chaque ressource a son icône : public/assets/icons/resources/<id>.png
for (const res of Object.values(RESOURCES)) {
  res.img = `${RES_BASE}/${res.id}.png`;
}

export const RESOURCE_ORDER = Object.keys(RESOURCES);
