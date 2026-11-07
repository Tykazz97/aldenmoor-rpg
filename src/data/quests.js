// ============================================================
// QUÊTES — modèles du tableau d'Aldenmoor.
// Chaque jour, le tableau tire une sélection de ces modèles (même jour = même tableau) ; la quantité est tirée
// dans `qty`. Les récompenses (or, xp, réputation) sont calculées à partir du travail demandé (voir utils/quests.js).
//
// type "kill"    : vaincre `qty` ennemis `target` (compte les combats gagnés après l'acceptation)
// type "gather"  : récolter `qty` de la ressource `target` sur la carte (après l'acceptation)
// type "deliver" : rapporter `qty` de la ressource `target` (brute ou raffinée) ; elle est retirée du sac à la remise
// type "craft"   : fabriquer l'objet `target` (il reste au joueur)
// weight : fréquence d'apparition (le Cavalier Déchu est rare)
// ============================================================
export const TOWN = { id: "aldenmoor", name: "Aldenmoor" };

export const QUEST_TEMPLATES = [
  { id: "kill_loup", type: "kill", target: "loup_des_plaines", qty: [6, 12], title: "Les loups rôdent", text: "Les meutes s'approchent des fermes. Éclaircis leurs rangs.", weight: 3 },
  { id: "kill_sanglier", type: "kill", target: "sanglier_sauvage", qty: [4, 8], title: "Hardes dévastatrices", text: "Les sangliers ravagent les champs. Chasse-les.", weight: 3 },
  { id: "kill_bandit", type: "kill", target: "bandit_des_routes", qty: [4, 8], title: "Routes dangereuses", text: "Les caravanes n'osent plus passer. Débarrasse la route des bandits.", weight: 3 },
  { id: "kill_cavalier", type: "kill", target: "cavalier_dechu", qty: [1, 1], title: "Le Cavalier Déchu", text: "Un ancien protecteur des prairies a sombré. Mets fin à sa errance.", weight: 1 },

  { id: "gather_frene", type: "gather", target: "bois_de_frene", qty: [10, 24], title: "Bois pour les charpentiers", text: "La ville manque de bois. Abats des frênes.", weight: 2 },
  { id: "gather_fer", type: "gather", target: "minerai_de_fer", qty: [10, 24], title: "Fer pour les forges", text: "Les forgerons ont besoin de minerai. Va en extraire.", weight: 2 },
  { id: "gather_ortie", type: "gather", target: "ortie", qty: [10, 24], title: "Orties pour l'apothicaire", text: "L'apothicaire manque d'orties fraîches.", weight: 2 },
  { id: "gather_chene", type: "gather", target: "bois_de_chene", qty: [6, 14], title: "Chênes centenaires", text: "Un bois plus dense est demandé pour les ouvrages solides.", weight: 2 },
  { id: "gather_cuivre", type: "gather", target: "minerai_de_cuivre", qty: [6, 14], title: "Filons de cuivre", text: "Les artisans cherchent du cuivre.", weight: 2 },
  { id: "gather_sauge", type: "gather", target: "sauge", qty: [6, 14], title: "Sauge des prés", text: "L'herboriste réclame de la sauge.", weight: 2 },

  { id: "deliver_croc", type: "deliver", target: "croc_de_loup", qty: [10, 24], title: "Crocs pour l'armurier", text: "Des crocs de loup, en nombre, pour les talismans.", weight: 2 },
  { id: "deliver_peau", type: "deliver", target: "peau_de_sanglier", qty: [10, 24], title: "Peaux pour le tanneur", text: "Le tanneur manque de peaux de sanglier.", weight: 2 },
  { id: "deliver_chiffon", type: "deliver", target: "chiffon_rapiece", qty: [10, 24], title: "Chiffons pour les couturières", text: "Des chiffons à retisser pour les pauvres de la ville.", weight: 2 },
  { id: "deliver_fourrure", type: "deliver", target: "fourrure_grise", qty: [3, 8], title: "Fourrures de qualité", text: "Un marchand veut de belles fourrures grises.", weight: 2 },
  { id: "deliver_defense", type: "deliver", target: "defense_ebrechee", qty: [3, 8], title: "Défenses pour le sculpteur", text: "Un sculpteur cherche de l'ivoire sauvage.", weight: 2 },
  { id: "deliver_ferraille", type: "deliver", target: "ferraille_emoussee", qty: [3, 8], title: "Ferraille à fondre", text: "La forge récupère de la ferraille.", weight: 2 },

  { id: "deliver_lingot_fer", type: "deliver", target: "lingot_de_fer", qty: [4, 10], title: "Lingots pour le forgeron", text: "Le forgeron manque de lingots de fer prêts à travailler.", weight: 2 },
  { id: "deliver_planche_frene", type: "deliver", target: "planche_de_frene", qty: [4, 10], title: "Planches pour la charpente", text: "Des planches de frêne bien sèches, pour réparer les toits.", weight: 2 },
  { id: "deliver_cuir", type: "deliver", target: "cuir_de_sanglier", qty: [4, 10], title: "Cuir pour le sellier", text: "Le sellier réclame du cuir de sanglier tanné.", weight: 2 },
  { id: "deliver_etoffe", type: "deliver", target: "etoffe", qty: [4, 10], title: "Étoffe pour le drapier", text: "Le drapier veut de l'étoffe propre, pas des chiffons.", weight: 2 },
  { id: "deliver_lingot_cuivre", type: "deliver", target: "lingot_de_cuivre", qty: [2, 5], title: "Cuivre pour les artisans", text: "Les artisans paient bien le cuivre fondu.", weight: 1 },
  { id: "deliver_planche_chene", type: "deliver", target: "planche_de_chene", qty: [2, 5], title: "Chêne pour les ouvrages solides", text: "Des planches de chêne pour une charpente de qualité.", weight: 1 },

  { id: "craft_gants_veteran", type: "craft", target: "gants_veteran", qty: [1, 1], title: "Des gants solides", text: "La garde a besoin de gants du Vétéran.", weight: 1 },
  { id: "craft_ceinture_veteran", type: "craft", target: "ceinture_veteran", qty: [1, 1], title: "Une ceinture de garde", text: "Forge une ceinture du Vétéran pour la milice.", weight: 1 },
  { id: "craft_gants_apprenti", type: "craft", target: "gants_apprenti", qty: [1, 1], title: "Gants d'érudit", text: "L'académie commande des gants d'Apprenti.", weight: 1 },
  { id: "craft_ceinture_apprenti", type: "craft", target: "ceinture_apprenti", qty: [1, 1], title: "Ceinture d'érudit", text: "L'académie commande une ceinture d'Apprenti.", weight: 1 },
];

// Chaîne de quêtes de la Lisière des Ombres : toujours au tableau (pas tirée au hasard), une seule fois,
// dans l'ordre. Elle apparaît à partir de `minLevel` et la suivante s'ouvre quand la précédente est rendue.
// `rewards` fixe l'or, l'xp et la réputation (sinon calculés comme une quête de chasse, ×1,5).
// La relique du Veilleur n'est PAS une récompense : elle ne tombe que sur le boss, très rarement.
export const CHAIN_QUESTS = [
  { id: "chain_esprits", type: "kill", target: "esprit_errant", qty: 8, minLevel: 14, title: "Les murmures de la lisière",
    text: "Des esprits errants rôdent à la lisière et glacent les voyageurs. Fais taire huit de ces spectres." },
  { id: "chain_chevaliers", type: "kill", target: "chevalier_dechu", qty: 6, minLevel: 14, requires: "chain_esprits", title: "Les chevaliers sans repos",
    text: "Derrière les esprits, d'anciens soldats marchent encore, le feu noir aux mains. Mets six d'entre eux au repos." },
  { id: "chain_veilleur", type: "kill", target: "veilleur_corrompu", qty: 1, minLevel: 14, requires: "chain_chevaliers", title: "Le Veilleur Corrompu",
    text: "Au fond de la lisière, un gardien d'avant la corruption veille sur la route du Manoir Englouti. Brise sa garde.",
    rewards: { gold: 600, xp: 700, rep: 40 } },
];

// Réputation : de quoi passer du niveau n au niveau n+1, et titre de chaque niveau
export const MAX_STANDING = 10;
export const standingXpForLevel = (level) => 80 + 40 * level;
export const STANDING_TITLES = ["Étranger", "Visiteur", "Connu", "Apprécié", "Estimé", "Respecté", "Honoré", "Éminent", "Illustre", "Héros d'Aldenmoor"];
export const MAX_ACTIVE_QUESTS = 3;
export const BOARD_SIZE = 8;                        // modèles tirés chaque jour (on n'affiche que ceux que tu peux faire)
