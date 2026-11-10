// ============================================================
// ÉQUIPEMENT DES PALIERS 2 ET 3 (régions 2 et 3 de la zone 1)
//
// Palier 1 : Vétéran / Apprenti / Traqueur (items.js), niveaux 1 à 8.
// Palier 2 : Champs Calcinés (niveaux 8 à 14), un set par classe :
//            Fossoyeur (guerrier), Charognard (assassin), Brasier (magicien).
// Palier 3 : Lisière des Ombres (niveaux 14 à 20), un set par classe :
//            Chevalier Déchu (guerrier), Loup-Garou (assassin), Esprit Errant (magicien).
//
// Chaque set a 5 pièces, plus une arme de la classe (le guerrier a aussi un bouclier).
// Les stats sont celles du palier 1 multipliées par environ 1,35 (palier 2) et 1,9 (palier 3) :
// c'est ce que suppose scripts/simulate-zones.js pour équilibrer les monstres.
// Les pièces se fabriquent avec les drops de la région (voir RECIPES en bas).
//
// Les objets de boss (anneau, amulettes, cape) sont communs à toutes les classes.
// `craftLevel` (facultatif) : niveau de métier requis, qui remplace le calcul par palier (voir professions.js).
// ============================================================

const ICON = "/assets/icons/items";
const SLOTS = ["chapeau", "plastron", "gants", "ceinture", "jambieres"];

// stats par pièce : [chapeau, plastron, gants, ceinture, jambières]
const SETS_DEF = [
  {
    key: "fossoyeur", tier: 2, rarity: "rare", name: "Plates du Fossoyeur", color: "#b9a77a", classKey: "guerrier",
    names: ["Heaume du Fossoyeur", "Cuirasse du Fossoyeur", "Gantelets du Fossoyeur", "Ceinture du Fossoyeur", "Jambières du Fossoyeur"],
    stats: [{ def_phys: 8, hp: 14 }, { def_phys: 16, hp: 27 }, { def_phys: 6, atk_phys: 4 }, { def_phys: 7, hp: 14 }, { def_phys: 8, hp: 13 }],
    bonuses: {
      2: { desc: "+13 DEF Physique, +26 PV", def_phys: 13, hp: 26 },
      5: { desc: "+32 DEF Physique, +80 PV, 25 % de chance de riposte", def_phys: 32, hp: 80, riposte: 0.25 },
    },
  },
  {
    key: "charognard", tier: 2, rarity: "rare", name: "Plumage du Charognard", color: "#7a6aa8", classKey: "assassin",
    names: ["Capuche du Charognard", "Veste du Charognard", "Gants du Charognard", "Ceinture du Charognard", "Jambières du Charognard"],
    stats: [{ esquive: 4, critique: 3, atk_phys: 3 }, { esquive: 6, critique: 4, atk_phys: 6 }, { critique: 3, atk_phys: 5 }, { esquive: 4, critique: 2, atk_phys: 3 }, { esquive: 4, critique: 2, atk_phys: 3 }],
    bonuses: {
      2: { desc: "+7 % Esquive, +5 % Critique", esquive: 7, critique: 5 },
      5: { desc: "+14 % Esquive, +10 % Critique, +7 ATK Physique, +40 PV, le premier coup de chaque combat est un critique garanti", esquive: 14, critique: 10, atk_phys: 7, hp: 40, guaranteedFirstCrit: true },
    },
  },
  {
    key: "brasier", tier: 2, rarity: "rare", name: "Atours du Brasier", color: "#e08a3c", classKey: "magicien",
    names: ["Chapeau du Brasier", "Robe du Brasier", "Gants du Brasier", "Ceinture du Brasier", "Jambières du Brasier"],
    stats: [{ atk_magie: 5, def_magie: 4 }, { atk_magie: 11, hp: 20 }, { atk_magie: 3, def_magie: 5 }, { atk_magie: 4, def_magie: 4 }, { atk_magie: 5, hp: 14 }],
    bonuses: {
      2: { desc: "+8 ATK Magique, +10 DEF Magique", atk_magie: 8, def_magie: 10 },
      5: { desc: "+18 ATK Magique, +26 DEF Magique, +50 PV, le premier sort de chaque tour coûte 1 PA de moins", atk_magie: 18, def_magie: 26, hp: 50, firstSpellDiscount: 1 },
    },
  },
  {
    key: "chevalier", tier: 3, rarity: "epique", name: "Harnois du Chevalier Déchu", color: "#8d5fd0", classKey: "guerrier",
    names: ["Heaume du Chevalier Déchu", "Cuirasse du Chevalier Déchu", "Gantelets du Chevalier Déchu", "Ceinture du Chevalier Déchu", "Jambières du Chevalier Déchu"],
    stats: [{ def_phys: 11, hp: 20 }, { def_phys: 23, hp: 38 }, { def_phys: 8, atk_phys: 6 }, { def_phys: 10, hp: 18 }, { def_phys: 11, hp: 19 }],
    bonuses: {
      2: { desc: "+16 DEF Physique, +32 PV", def_phys: 16, hp: 32 },
      5: { desc: "+40 DEF Physique, +100 PV, 25 % de chance de riposte, 20 % des dégâts reçus sont renvoyés en feu noir", def_phys: 40, hp: 100, riposte: 0.25, thorns: 0.2 },
    },
  },
  {
    key: "garou", tier: 3, rarity: "epique", name: "Pelage du Loup-Garou", color: "#c9a13f", classKey: "assassin",
    names: ["Capuche du Loup-Garou", "Veste du Loup-Garou", "Gants du Loup-Garou", "Ceinture du Loup-Garou", "Jambières du Loup-Garou"],
    stats: [{ esquive: 5, critique: 4, atk_phys: 4 }, { esquive: 7, critique: 5, atk_phys: 9 }, { critique: 4, atk_phys: 7 }, { esquive: 5, critique: 2, atk_phys: 4 }, { esquive: 4, critique: 2, atk_phys: 5 }],
    bonuses: {
      2: { desc: "+8 % Esquive, +6 % Critique", esquive: 8, critique: 6 },
      5: { desc: "+15 % Esquive, +12 % Critique, +7 ATK Physique, +50 PV, premier coup critique garanti, 4 % des dégâts infligés rendus en PV", esquive: 15, critique: 12, atk_phys: 7, hp: 50, guaranteedFirstCrit: true, lifesteal: 0.04 },
    },
  },
  {
    key: "esprit", tier: 3, rarity: "epique", name: "Mante de l'Esprit Errant", color: "#4fc3b8", classKey: "magicien",
    names: ["Capuche de l'Esprit Errant", "Robe de l'Esprit Errant", "Gants de l'Esprit Errant", "Ceinture de l'Esprit Errant", "Jambières de l'Esprit Errant"],
    stats: [{ atk_magie: 8, def_magie: 6 }, { atk_magie: 15, hp: 28 }, { atk_magie: 4, def_magie: 7 }, { atk_magie: 6, def_magie: 6 }, { atk_magie: 7, hp: 20 }],
    bonuses: {
      2: { desc: "+10 ATK Magique, +13 DEF Magique", atk_magie: 10, def_magie: 13 },
      5: { desc: "+22 ATK Magique, +32 DEF Magique, +70 PV, le premier sort de chaque tour coûte 1 PA de moins, tes sorts ignorent 15 % de la défense", atk_magie: 22, def_magie: 32, hp: 70, firstSpellDiscount: 1, armorPen: 0.15 },
    },
  },
  // --- Palier 4 : Le Manoir Englouti (donjon, niveaux 20 à 26) ---
  {
    key: "garde_noye", tier: 4, rarity: "epique", name: "Armure du Garde Noyé", color: "#3fa7a0", classKey: "guerrier",
    names: ["Grand heaume du Garde Noyé", "Cuirasse du Garde Noyé", "Gantelets du Garde Noyé", "Ceinture du Garde Noyé", "Jambières du Garde Noyé"],
    stats: [{ def_phys: 15, hp: 28 }, { def_phys: 32, hp: 53 }, { def_phys: 11, atk_phys: 8 }, { def_phys: 14, hp: 25 }, { def_phys: 15, hp: 27 }],
    bonuses: {
      2: { desc: "+22 DEF Physique, +45 PV", def_phys: 22, hp: 45 },
      5: { desc: "+56 DEF Physique, +140 PV, 30 % de chance de riposte, 25 % des dégâts reçus sont renvoyés en feu noir", def_phys: 56, hp: 140, riposte: 0.3, thorns: 0.25 },
    },
  },
  {
    key: "veneur", tier: 4, rarity: "epique", name: "Cuir du Veneur", color: "#b5533c", classKey: "assassin",
    names: ["Capuche du Veneur", "Veste du Veneur", "Gants du Veneur", "Ceinture du Veneur", "Jambières du Veneur"],
    stats: [{ esquive: 7, critique: 6, atk_phys: 6 }, { esquive: 10, critique: 7, atk_phys: 13 }, { critique: 6, atk_phys: 10 }, { esquive: 7, critique: 3, atk_phys: 6 }, { esquive: 6, critique: 3, atk_phys: 7 }],
    bonuses: {
      2: { desc: "+11 % Esquive, +8 % Critique", esquive: 11, critique: 8 },
      5: { desc: "+20 % Esquive, +16 % Critique, +10 ATK Physique, +70 PV, premier coup critique garanti, 6 % des dégâts infligés rendus en PV", esquive: 20, critique: 16, atk_phys: 10, hp: 70, guaranteedFirstCrit: true, lifesteal: 0.06 },
    },
  },
  {
    key: "veuve", tier: 4, rarity: "epique", name: "Atours de la Veuve", color: "#9a7fe0", classKey: "magicien",
    names: ["Voilette de la Veuve", "Robe de deuil de la Veuve", "Gants de la Veuve", "Ceinture de la Veuve", "Jambières de la Veuve"],
    stats: [{ atk_magie: 11, def_magie: 8 }, { atk_magie: 21, hp: 39 }, { atk_magie: 6, def_magie: 10 }, { atk_magie: 8, def_magie: 8 }, { atk_magie: 10, hp: 28 }],
    bonuses: {
      2: { desc: "+14 ATK Magique, +18 DEF Magique", atk_magie: 14, def_magie: 18 },
      5: { desc: "+31 ATK Magique, +45 DEF Magique, +100 PV, le premier sort de chaque tour coûte 1 PA de moins, tes sorts ignorent 20 % de la défense", atk_magie: 31, def_magie: 45, hp: 100, firstSpellDiscount: 1, armorPen: 0.2 },
    },
  },
];

export const TIER_ITEMS = {};
export const TIER_SETS = {};

for (const def of SETS_DEF) {
  const pieces = [];
  SLOTS.forEach((type, i) => {
    const id = `${type}_${def.key}`;
    pieces.push(id);
    TIER_ITEMS[id] = { id, name: def.names[i], type, rarity: def.rarity, set: def.key, tier: def.tier, img: `${ICON}/${def.key}/${id}.webp`, ...def.stats[i] };
  });
  TIER_SETS[def.key] = { key: def.key, name: def.name, color: def.color, tier: def.tier, classKey: def.classKey, pieces, bonuses: def.bonuses };
}

// --- Armes et boucliers : chacun reprend le type d'arme du palier 1 (donc ses sorts) ---
const weapon = (id, name, tier, rarity, weaponType, twoHanded, img, stats, extra = {}) => {
  TIER_ITEMS[id] = { id, name, type: "arme", weaponType, rarity, twoHanded, tier, img: `${ICON}/weapons/${img}.webp`, ...stats, ...extra };
};
weapon("epee_fossoyeur", "Épée du Fossoyeur", 2, "rare", "epee", false, "epee_fossoyeur", { atk_phys: 22, def_phys: 3 });
weapon("dague_charognard", "Dague du Charognard", 2, "rare", "dague", false, "dague_charognard", { atk_phys: 19, critique: 3 });
weapon("baton_brasier", "Bâton du Brasier", 2, "rare", "baton", true, "baton_brasier", { atk_magie: 16, def_magie: 4 });
weapon("epee_chevalier", "Lame du Chevalier Déchu", 3, "epique", "epee", false, "epee_chevalier", { atk_phys: 30, def_phys: 4 });
weapon("dague_garou", "Dague du Loup-Garou", 3, "epique", "dague", false, "dague_garou", { atk_phys: 25, critique: 4 });
weapon("baton_esprit", "Bâton de l'Esprit Errant", 3, "epique", "baton", true, "baton_esprit", { atk_magie: 23, def_magie: 6 });
weapon("epee_garde_noye", "Lame du Garde Noyé", 4, "epique", "epee", false, "epee_garde_noye", { atk_phys: 42, def_phys: 6 });
weapon("dague_veneur", "Dague du Veneur", 4, "epique", "dague", false, "dague_veneur", { atk_phys: 35, critique: 5 });
weapon("baton_veuve", "Bâton de la Veuve", 4, "epique", "baton", true, "baton_veuve", { atk_magie: 32, def_magie: 8 });
TIER_ITEMS.bouclier_garde_noye = { id: "bouclier_garde_noye", name: "Bouclier du Garde Noyé", type: "bouclier", rarity: "epique", tier: 4, img: `${ICON}/weapons/bouclier_garde_noye.webp`, def_phys: 27, def_magie: 14 };
TIER_ITEMS.bouclier_fossoyeur = { id: "bouclier_fossoyeur", name: "Bouclier du Fossoyeur", type: "bouclier", rarity: "rare", tier: 2, img: `${ICON}/weapons/bouclier_fossoyeur.webp`, def_phys: 14, def_magie: 7 };
TIER_ITEMS.bouclier_chevalier = { id: "bouclier_chevalier", name: "Bouclier du Chevalier Déchu", type: "bouclier", rarity: "epique", tier: 3, img: `${ICON}/weapons/bouclier_chevalier.webp`, def_phys: 19, def_magie: 10 };

// --- Objets des boss (cape, amulettes, anneau), communs à toutes les classes ---
const accessory = (id, name, type, rarity, stats, craftLevel) => {
  TIER_ITEMS[id] = { id, name, type, rarity, img: `${ICON}/accessories/${id}.webp`, craftLevel, ...stats };
};
accessory("anneau_cavalier", "Anneau du Cavalier Déchu", "anneau", "rare", { critique: 4, esquive: 3, hp: 15 }, 18);
accessory("amulette_armure_maudite", "Amulette de l'Armure Maudite", "amulette", "rare", { def_phys: 8, def_magie: 8, hp: 25 }, 18);
accessory("cape_epouvantail", "Cape de l'Épouvantail Ancestral", "cape", "epique", { def_phys: 6, def_magie: 10, hp: 30 }, 4);
accessory("amulette_coeur_de_braise", "Amulette du Cœur de Braise", "amulette", "epique", { atk_phys: 8, atk_magie: 8, critique: 3, hp: 20 }, 9);

// ============================================================
// RECETTES — comme au palier 1, la ressource rare n'est demandée que pour le plastron.
// ============================================================
export const TIER_RECIPES = {
  // --- Plates du Fossoyeur (squelettes : os jaunis, lames de faux, crâne) ---
  chapeau_fossoyeur: { ingredients: { os_jauni: 4, lingot_de_fer: 2, lame_de_faux_rouillee: 1 }, gold: 80 },
  plastron_fossoyeur: { ingredients: { os_jauni: 6, lingot_de_fer: 3, lame_de_faux_rouillee: 3, lingot_de_cuivre: 2, crane_de_fermier: 1 }, gold: 160 },
  gants_fossoyeur: { ingredients: { os_jauni: 4, lingot_de_fer: 2, lame_de_faux_rouillee: 1 }, gold: 70 },
  ceinture_fossoyeur: { ingredients: { os_jauni: 4, cuir_de_sanglier: 2, lame_de_faux_rouillee: 1 }, gold: 70 },
  jambieres_fossoyeur: { ingredients: { os_jauni: 5, lingot_de_fer: 3, lame_de_faux_rouillee: 2 }, gold: 95 },
  epee_fossoyeur: { ingredients: { lingot_de_fer: 3, os_jauni: 4, lame_de_faux_rouillee: 3, cuir_de_sanglier: 1 }, gold: 120 },
  bouclier_fossoyeur: { ingredients: { lingot_de_fer: 3, os_jauni: 5, lame_de_faux_rouillee: 2, planche_de_chene: 1 }, gold: 110 },

  // --- Plumage du Charognard (corbeaux : plumes, serres, œil) ---
  chapeau_charognard: { ingredients: { plume_noire: 4, cuir_de_sanglier: 2, serre_de_corbeau: 1 }, gold: 80 },
  plastron_charognard: { ingredients: { plume_noire: 6, cuir_de_sanglier: 3, serre_de_corbeau: 3, fil_d_ortie: 2, oeil_de_charognard: 1 }, gold: 160 },
  gants_charognard: { ingredients: { plume_noire: 4, cuir_de_sanglier: 2, serre_de_corbeau: 1 }, gold: 70 },
  ceinture_charognard: { ingredients: { plume_noire: 4, cuir_de_sanglier: 2, serre_de_corbeau: 1 }, gold: 70 },
  jambieres_charognard: { ingredients: { plume_noire: 5, cuir_de_sanglier: 3, serre_de_corbeau: 2 }, gold: 95 },
  dague_charognard: { ingredients: { lingot_de_fer: 2, plume_noire: 4, serre_de_corbeau: 3 }, gold: 110 },

  // --- Atours du Brasier (épouvantails : paille, jute, braise) ---
  chapeau_brasier: { ingredients: { paille_calcinee: 4, etoffe: 2, jute_hantee: 1 }, gold: 80 },
  plastron_brasier: { ingredients: { paille_calcinee: 6, etoffe: 3, jute_hantee: 3, fil_d_ortie: 2, braise_vivante: 1 }, gold: 160 },
  gants_brasier: { ingredients: { paille_calcinee: 4, etoffe: 2, jute_hantee: 1 }, gold: 70 },
  ceinture_brasier: { ingredients: { paille_calcinee: 4, etoffe: 2, jute_hantee: 1 }, gold: 70 },
  jambieres_brasier: { ingredients: { paille_calcinee: 5, etoffe: 3, jute_hantee: 2 }, gold: 95 },
  baton_brasier: { ingredients: { planche_de_chene: 2, paille_calcinee: 4, jute_hantee: 3, etoffe: 1 }, gold: 110 },

  // --- Harnois du Chevalier Déchu (plaques noircies, mailles corrompues, flamme noire) ---
  chapeau_chevalier: { ingredients: { plaque_noircie: 4, lingot_de_fer: 3, maille_corrompue: 1 }, gold: 180 },
  plastron_chevalier: { ingredients: { plaque_noircie: 6, lingot_de_cuivre: 3, lingot_de_fer: 3, maille_corrompue: 3, flamme_noire: 1 }, gold: 340 },
  gants_chevalier: { ingredients: { plaque_noircie: 4, lingot_de_fer: 2, maille_corrompue: 1 }, gold: 150 },
  ceinture_chevalier: { ingredients: { plaque_noircie: 4, cuir_de_sanglier: 2, maille_corrompue: 1 }, gold: 150 },
  jambieres_chevalier: { ingredients: { plaque_noircie: 5, lingot_de_fer: 3, maille_corrompue: 2 }, gold: 200 },
  epee_chevalier: { ingredients: { lingot_de_cuivre: 3, plaque_noircie: 5, maille_corrompue: 4, lingot_de_fer: 2 }, gold: 260 },
  bouclier_chevalier: { ingredients: { lingot_de_cuivre: 2, plaque_noircie: 6, maille_corrompue: 3, planche_de_chene: 1 }, gold: 240 },

  // --- Pelage du Loup-Garou (griffes, pelage maudit, croc de pleine lune) ---
  chapeau_garou: { ingredients: { griffe_de_garou: 4, cuir_de_sanglier: 2, pelage_maudit: 1 }, gold: 180 },
  plastron_garou: { ingredients: { griffe_de_garou: 6, cuir_de_sanglier: 3, pelage_maudit: 3, fil_d_ortie: 2, croc_de_pleine_lune: 1 }, gold: 340 },
  gants_garou: { ingredients: { griffe_de_garou: 4, cuir_de_sanglier: 2, pelage_maudit: 1 }, gold: 150 },
  ceinture_garou: { ingredients: { griffe_de_garou: 4, cuir_de_sanglier: 2, pelage_maudit: 1 }, gold: 150 },
  jambieres_garou: { ingredients: { griffe_de_garou: 5, cuir_de_sanglier: 3, pelage_maudit: 2 }, gold: 200 },
  dague_garou: { ingredients: { lingot_de_cuivre: 2, griffe_de_garou: 5, pelage_maudit: 4, cuir_de_sanglier: 1 }, gold: 240 },

  // --- Mante de l'Esprit Errant (ectoplasme, voile spectral, larme d'âme) ---
  chapeau_esprit: { ingredients: { ectoplasme: 4, etoffe: 2, voile_spectral: 1 }, gold: 180 },
  plastron_esprit: { ingredients: { ectoplasme: 6, etoffe: 3, voile_spectral: 3, fil_d_ortie: 2, larme_d_ame: 1 }, gold: 340 },
  gants_esprit: { ingredients: { ectoplasme: 4, etoffe: 2, voile_spectral: 1 }, gold: 150 },
  ceinture_esprit: { ingredients: { ectoplasme: 4, etoffe: 2, voile_spectral: 1 }, gold: 150 },
  jambieres_esprit: { ingredients: { ectoplasme: 5, etoffe: 3, voile_spectral: 2 }, gold: 200 },
  baton_esprit: { ingredients: { planche_de_chene: 3, ectoplasme: 5, voile_spectral: 4, etoffe: 1 }, gold: 240 },

  // --- Palier 4 : Le Manoir Englouti (ressources exclusives du donjon ; l'essence de deuil, rare, n'est demandée que pour le plastron) ---
  chapeau_garde_noye: { ingredients: { plaque_noyee: 5, lingot_de_fer: 3, larme_de_deuil: 1 }, gold: 360 },
  plastron_garde_noye: { ingredients: { plaque_noyee: 8, lingot_de_cuivre: 3, lingot_de_fer: 3, larme_de_deuil: 3, essence_de_deuil: 1 }, gold: 680 },
  gants_garde_noye: { ingredients: { plaque_noyee: 5, lingot_de_fer: 2, larme_de_deuil: 1 }, gold: 300 },
  ceinture_garde_noye: { ingredients: { plaque_noyee: 5, cuir_de_molosse: 2, larme_de_deuil: 1 }, gold: 300 },
  jambieres_garde_noye: { ingredients: { plaque_noyee: 6, lingot_de_fer: 3, larme_de_deuil: 2 }, gold: 400 },
  epee_garde_noye: { ingredients: { lingot_de_cuivre: 3, plaque_noyee: 6, larme_de_deuil: 4, lingot_de_fer: 2 }, gold: 520 },
  bouclier_garde_noye: { ingredients: { lingot_de_cuivre: 2, plaque_noyee: 7, larme_de_deuil: 3, planche_de_chene: 1 }, gold: 480 },

  chapeau_veneur: { ingredients: { cuir_de_molosse: 5, cuir_de_sanglier: 2, larme_de_deuil: 1 }, gold: 360 },
  plastron_veneur: { ingredients: { cuir_de_molosse: 8, cuir_de_sanglier: 3, larme_de_deuil: 3, fil_d_ortie: 2, essence_de_deuil: 1 }, gold: 680 },
  gants_veneur: { ingredients: { cuir_de_molosse: 5, cuir_de_sanglier: 2, larme_de_deuil: 1 }, gold: 300 },
  ceinture_veneur: { ingredients: { cuir_de_molosse: 5, cuir_de_sanglier: 2, larme_de_deuil: 1 }, gold: 300 },
  jambieres_veneur: { ingredients: { cuir_de_molosse: 6, cuir_de_sanglier: 3, larme_de_deuil: 2 }, gold: 400 },
  dague_veneur: { ingredients: { lingot_de_cuivre: 2, cuir_de_molosse: 6, larme_de_deuil: 4, cuir_de_sanglier: 1 }, gold: 480 },

  chapeau_veuve: { ingredients: { soie_funeraire: 5, etoffe: 2, larme_de_deuil: 1 }, gold: 360 },
  plastron_veuve: { ingredients: { soie_funeraire: 8, etoffe: 3, larme_de_deuil: 3, fil_d_ortie: 2, essence_de_deuil: 1 }, gold: 680 },
  gants_veuve: { ingredients: { soie_funeraire: 5, etoffe: 2, larme_de_deuil: 1 }, gold: 300 },
  ceinture_veuve: { ingredients: { soie_funeraire: 5, etoffe: 2, larme_de_deuil: 1 }, gold: 300 },
  jambieres_veuve: { ingredients: { soie_funeraire: 6, etoffe: 3, larme_de_deuil: 2 }, gold: 400 },
  baton_veuve: { ingredients: { planche_de_chene: 3, soie_funeraire: 6, larme_de_deuil: 4, etoffe: 1 }, gold: 480 },

  // --- Objets de boss ---
  anneau_cavalier: { ingredients: { eperon_corrompu: 1, lingot_de_cuivre: 2, defense_ebrechee: 2 }, gold: 100 },
  amulette_armure_maudite: { ingredients: { fragment_armure_maudite: 3, lingot_de_cuivre: 2, lingot_de_fer: 2 }, gold: 100 },
  cape_epouvantail: { ingredients: { branche_ancestrale: 2, etoffe: 3, jute_hantee: 3, fil_d_ortie: 2 }, gold: 170 },
  amulette_coeur_de_braise: { ingredients: { coeur_de_braise: 1, branche_ancestrale: 1, lingot_de_cuivre: 3, paille_calcinee: 4 }, gold: 240 },
};
