// ============================================================
// ZONES — chaque zone contient des régions + un donjon final.
// Zone 1 uniquement pour l'instant : on approfondit avant
// d'ajouter du contenu.
// ============================================================

export const ZONES = {
  aldenmoor: {
    key: "aldenmoor",
    name: "Les Prairies d'Aldenmoor",
    regions: [
      {
        key: "prairies_sauvages",
        name: "Prairies Sauvages",
        difficulty: "facile", levels: "Niveaux 1 à 8",
        desc: "Herbes hautes et fermes abandonnées — les premiers signes de troubles.",
        enemies: ["loup_des_plaines", "sanglier_sauvage", "bandit_des_routes"],
        miniBoss: "cavalier_dechu",
      },
      {
        key: "champs_calcines",
        name: "Champs Calcinés",
        difficulty: "intermédiaire", levels: "Niveaux 8 à 14",
        desc: "La corruption se voit désormais — terres brûlées, cultures pourries, ciel assombri.",
        enemies: ["squelette_fermier", "corbeau_charognard", "epouvantail_hante"],
        miniBoss: "epouvantail_ancestral",
      },
      {
        key: "lisiere_des_ombres",
        name: "Lisière des Ombres",
        difficulty: "difficile", levels: "Niveaux 14 à 20",
        desc: "À la frontière de la prairie et d'une forêt sombre, la magie corrompue est manifeste.",
        enemies: ["loup_garou", "esprit_errant", "chevalier_dechu"],
        miniBoss: "veilleur_corrompu",
      },
    ],
    dungeon: {
      key: "manoir_englouti",
      name: "Le Manoir Englouti",
      desc: "Ancien manoir seigneurial, siège du rituel qui a corrompu toute la région.",
      boss: "dame_en_deuil",
    },
  },
};

// ============================================================
// ENNEMIS — regroupés par région
// ============================================================

export const ENEMIES = {
  // --- Région 1 : Prairies Sauvages ---
  // drops : { type: "resource" | "item", id, chance (0-1), min, max }
  // gold   : [min, max]. Les chances sont de base ; la Chance du joueur
  // (dropBonus) les multiplie au moment du tirage.
  loup_des_plaines: {
    key: "loup_des_plaines", name: "Loup des plaines",
    desc: "Rapide, attaque en meute, dégâts physiques faibles mais nombreux.",
    stats: { hp: 70, atkPhys: 3, atkMagie: 0, defPhys: 2, defMagie: 0, esquive: 8, critique: 5, vitesse: 13, pa: 6 },
    xp: 12,
    actions: [
      { id: "morsure", name: "Morsure", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "bond", name: "Bond", pa: 4, type: "phys", power: 1.3, weight: 1 },
    ],
    gold: [3, 8],
    drops: [
      { type: "resource", id: "croc_de_loup", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "fourrure_grise", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "oeil_de_loup_argente", chance: 0.02, min: 1, max: 1 },
    ],
  },
  sanglier_sauvage: {
    key: "sanglier_sauvage", name: "Sanglier sauvage",
    desc: "Tanky, charge puissante, dégâts physiques moyens.",
    stats: { hp: 130, atkPhys: 6, atkMagie: 0, defPhys: 8, defMagie: 0, esquive: 2, critique: 3, vitesse: 8, pa: 6 },
    xp: 18,
    actions: [
      { id: "coup_de_defense", name: "Coup de défense", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "charge", name: "Charge", pa: 5, type: "phys", power: 1.6, weight: 1 },
    ],
    gold: [4, 10],
    drops: [
      { type: "resource", id: "peau_de_sanglier", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "defense_ebrechee", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "coeur_de_sanglier", chance: 0.02, min: 1, max: 1 },
      { type: "item", id: "masse_rouillee", chance: 0.03, min: 1, max: 1 },
    ],
  },
  bandit_des_routes: {
    key: "bandit_des_routes", name: "Bandit des routes",
    desc: "Arme simple, vole parfois de l'or.",
    stats: { hp: 95, atkPhys: 4, atkMagie: 0, defPhys: 4, defMagie: 0, esquive: 10, critique: 8, vitesse: 11, pa: 6 },
    xp: 15,
    actions: [
      { id: "coup_de_gourdin", name: "Coup de gourdin", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "coup_bas", name: "Coup bas", pa: 3, type: "phys", power: 0.7, weight: 1, effect: { kind: "defDown", turns: 2, value: 0.2 } },
    ],
    gold: [6, 15],
    drops: [
      { type: "resource", id: "chiffon_rapiece", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "ferraille_emoussee", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "parchemin_froisse", chance: 0.02, min: 1, max: 1 },
      { type: "item", id: "dague_ebrechee", chance: 0.03, min: 1, max: 1 },
    ],
  },
  cavalier_dechu: {
    key: "cavalier_dechu", name: "Le Cavalier Déchu", miniBoss: true,
    desc: "Ancien chevalier protecteur des prairies, corrompu. Coup chargé infligeant un debuff DEF, phase de rage à bas HP.",
    stats: { hp: 520, atkPhys: 14, atkMagie: 0, defPhys: 15, defMagie: 5, esquive: 3, critique: 8, vitesse: 9, pa: 6 },
    xp: 150,
    actions: [
      { id: "coup_d_epee", name: "Coup d'épée", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "coup_charge", name: "Coup chargé", pa: 5, type: "phys", power: 1.7, weight: 2, effect: { kind: "defDown", turns: 2, value: 0.3 } },
    ],
    // phase de rage quand les PV passent sous le seuil (part de la vie max)
    phases: [
      { below: 0.5, atkMult: 1.45, announce: "Le Cavalier Déchu entre en rage !" },
    ],
    gold: [40, 80],
    drops: [
      { type: "resource", id: "fragment_armure_maudite", chance: 0.6, min: 1, max: 2 },
      { type: "resource", id: "eperon_corrompu", chance: 0.2, min: 1, max: 1 },
    ],
  },

  // --- Région 2 : Champs Calcinés ---
  // Niveaux conseillés 8 à 14. Les stats de ces monstres sont réglées avec scripts/simulate-zones.js.
  squelette_fermier: {
    key: "squelette_fermier", name: "Squelette de fermier",
    desc: "Mort-vivant lent mais résistant, armé d'une faux rouillée.",
    stats: { hp: 420, atkPhys: 25, atkMagie: 0, defPhys: 20, defMagie: 2, esquive: 0, critique: 3, vitesse: 7, pa: 6 },
    xp: 40,
    actions: [
      { id: "coup_de_faux", name: "Coup de faux", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "fauchage", name: "Fauchage", pa: 5, type: "phys", power: 1.5, weight: 1 },
    ],
    gold: [10, 20],
    drops: [
      { type: "resource", id: "os_jauni", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "lame_de_faux_rouillee", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "crane_de_fermier", chance: 0.02, min: 1, max: 1 },
      { type: "item", id: "faux_ebrechee", chance: 0.03, min: 1, max: 1 },
    ],
  },
  corbeau_charognard: {
    key: "corbeau_charognard", name: "Corbeau charognard",
    desc: "Vole, rapide, attaque en groupe, inflige un léger Poison.",
    stats: { hp: 150, atkPhys: 14, atkMagie: 0, defPhys: 3, defMagie: 0, esquive: 18, critique: 8, vitesse: 16, pa: 6 },
    xp: 28,
    actions: [
      { id: "coup_de_bec", name: "Coup de bec", pa: 2, type: "phys", power: 0.7, weight: 3 },
      { id: "picore_empoisonne", name: "Picorement venimeux", pa: 3, type: "phys", power: 0.8, weight: 2, effect: { kind: "dot", element: "poison", turns: 3, ratio: 0.2 } },
    ],
    gold: [6, 14],
    drops: [
      { type: "resource", id: "plume_noire", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "serre_de_corbeau", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "oeil_de_charognard", chance: 0.02, min: 1, max: 1 },
    ],
  },
  epouvantail_hante: {
    key: "epouvantail_hante", name: "Épouvantail hanté",
    desc: "Statique puis s'anime, inflige des dégâts de Feu.",
    stats: { hp: 300, atkPhys: 8, atkMagie: 26, defPhys: 12, defMagie: 16, esquive: 0, critique: 4, vitesse: 6, pa: 6 },
    xp: 46,
    actions: [
      { id: "etincelle", name: "Étincelle", pa: 3, type: "mag", power: 1.1, weight: 3, effect: { kind: "dot", element: "feu", turns: 2, ratio: 0.25 } },
      { id: "embrasement", name: "Embrasement", pa: 5, type: "mag", power: 1.6, weight: 1 },
    ],
    gold: [10, 22],
    drops: [
      { type: "resource", id: "paille_calcinee", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "jute_hantee", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "braise_vivante", chance: 0.02, min: 1, max: 1 },
    ],
  },
  epouvantail_ancestral: {
    key: "epouvantail_ancestral", name: "L'Épouvantail Ancestral", miniBoss: true,
    desc: "Version massive et maléfique de l'épouvantail. Ses corbeaux inflignent le Poison, ses braises le Feu ; entre en fureur à mi-vie.",
    stats: { hp: 1600, atkPhys: 26, atkMagie: 38, defPhys: 24, defMagie: 22, esquive: 0, critique: 6, vitesse: 8, pa: 6 },
    xp: 260,
    actions: [
      { id: "coup_de_branche", name: "Coup de branche", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "nuee_de_corbeaux", name: "Nuée de corbeaux", pa: 4, type: "phys", power: 0.9, weight: 2, effect: { kind: "dot", element: "poison", turns: 3, ratio: 0.3 } },
      { id: "brasier_maudit", name: "Brasier maudit", pa: 5, type: "mag", power: 1.5, weight: 2, effect: { kind: "dot", element: "feu", turns: 3, ratio: 0.35 } },
    ],
    phases: [
      { below: 0.5, atkMult: 1.35, announce: "L'Épouvantail Ancestral s'embrase !" },
    ],
    gold: [80, 140],
    drops: [
      { type: "resource", id: "branche_ancestrale", chance: 0.6, min: 1, max: 2 },
      { type: "resource", id: "coeur_de_braise", chance: 0.2, min: 1, max: 1 },
    ],
  },

  // --- Région 3 : Lisière des Ombres ---
  // Niveaux conseillés 14 à 20.
  loup_garou: {
    key: "loup_garou", name: "Loup-garou",
    desc: "Évolution corrompue du loup, rapide, dégâts physiques élevés, rage à bas HP.",
    stats: { hp: 560, atkPhys: 33, atkMagie: 0, defPhys: 18, defMagie: 6, esquive: 14, critique: 12, vitesse: 15, pa: 6 },
    xp: 75,
    actions: [
      { id: "griffure", name: "Griffure", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "morsure_sauvage", name: "Morsure sauvage", pa: 4, type: "phys", power: 1.4, weight: 2 },
      { id: "dechiquetage", name: "Déchiquetage", pa: 5, type: "phys", power: 1.7, weight: 1, effect: { kind: "defDown", turns: 2, value: 0.2 } },
    ],
    phases: [
      { below: 0.4, atkMult: 1.3, announce: "Le loup-garou hurle à la lune !" },
    ],
    gold: [18, 34],
    drops: [
      { type: "resource", id: "griffe_de_garou", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "pelage_maudit", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "croc_de_pleine_lune", chance: 0.02, min: 1, max: 1 },
    ],
  },
  esprit_errant: {
    key: "esprit_errant", name: "Esprit errant",
    desc: "Spectre, dégâts magiques qui contournent l'armure, inflige parfois Givre.",
    stats: { hp: 380, atkPhys: 0, atkMagie: 29, defPhys: 26, defMagie: 14, esquive: 14, critique: 6, vitesse: 12, pa: 6 },
    xp: 70,
    actions: [
      { id: "toucher_glacial", name: "Toucher glacial", pa: 3, type: "mag", power: 1.0, weight: 3, effect: { kind: "weaken", element: "givre", turns: 2, value: 0.15 } },
      { id: "hurlement_spectral", name: "Hurlement spectral", pa: 5, type: "mag", power: 1.5, weight: 1, effect: { kind: "paLoss", value: 1 } },
    ],
    gold: [14, 28],
    drops: [
      { type: "resource", id: "ectoplasme", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "voile_spectral", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "larme_d_ame", chance: 0.02, min: 1, max: 1 },
    ],
  },
  chevalier_dechu: {
    key: "chevalier_dechu", name: "Chevalier déchu",
    desc: "Ancien soldat corrompu, équilibre ATK/DEF, capacité de Feu noir.",
    stats: { hp: 720, atkPhys: 34, atkMagie: 24, defPhys: 32, defMagie: 16, esquive: 4, critique: 8, vitesse: 9, pa: 6 },
    xp: 95,
    actions: [
      { id: "coup_d_epee_noire", name: "Coup d'épée noire", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "feu_noir", name: "Feu noir", pa: 4, type: "mag", power: 1.5, weight: 2, effect: { kind: "dot", element: "feu", turns: 2, ratio: 0.3 } },
      { id: "frappe_brise_garde", name: "Frappe brise-garde", pa: 5, type: "phys", power: 1.6, weight: 1, effect: { kind: "defDown", turns: 2, value: 0.25 } },
    ],
    gold: [22, 38],
    drops: [
      { type: "resource", id: "plaque_noircie", chance: 0.5, min: 1, max: 2 },
      { type: "resource", id: "maille_corrompue", chance: 0.15, min: 1, max: 1 },
      { type: "resource", id: "flamme_noire", chance: 0.02, min: 1, max: 1 },
    ],
  },
  veilleur_corrompu: {
    key: "veilleur_corrompu", name: "Le Veilleur Corrompu", miniBoss: true,
    desc: "Gardien d'avant la corruption, mi-spectre mi-chevalier. Sa garde brise l'armure et son regard retire des PA ; sous 66 % de vie il appelle deux esprits errants, sous 33 % il entre en rage (feu noir et poison).",
    stats: { hp: 2200, atkPhys: 31, atkMagie: 27, defPhys: 30, defMagie: 22, esquive: 0, critique: 8, vitesse: 11, pa: 6 },
    xp: 700,
    actions: [
      { id: "coup_de_garde", name: "Coup de garde", pa: 3, type: "phys", power: 1.0, weight: 3 },
      { id: "frappe_ecrase_garde", name: "Frappe écrase-garde", pa: 5, type: "phys", power: 1.7, weight: 2, effect: { kind: "defDown", turns: 2, value: 0.3 } },
      { id: "regard_du_neant", name: "Regard du néant", pa: 4, type: "mag", power: 1.2, weight: 2, effect: { kind: "paLoss", value: 2 } },
      // actions de la phase de rage (needsPhase = indice de la phase qui les débloque)
      { id: "feu_noir_veilleur", name: "Feu noir", pa: 5, type: "mag", power: 1.5, weight: 2, needsPhase: 1, effect: { kind: "dot", element: "feu", turns: 3, ratio: 0.3 } },
      { id: "souffle_putride", name: "Souffle putride", pa: 4, type: "mag", power: 1.2, weight: 2, needsPhase: 1, effect: { kind: "dot", element: "poison", turns: 3, ratio: 0.3 } },
    ],
    phases: [
      { below: 0.66, summon: ["esprit_errant", "esprit_errant"], announce: "Le Veilleur appelle les esprits de la lisière !" },
      { below: 0.33, atkMult: 1.4, announce: "Le Veilleur Corrompu se déchaîne !" },
    ],
    gold: [200, 300],
    drops: [
      { type: "resource", id: "cle_du_manoir", chance: 1, min: 1, max: 1 },
      { type: "item", id: "lanterne_du_veilleur", chance: 0.05, min: 1, max: 1 },
    ],
  },

  // --- Donjon : Le Manoir Englouti ---
  dame_en_deuil: {
    key: "dame_en_deuil", name: "La Dame en Deuil", boss: true,
    desc: "Noble ayant invoqué une magie interdite pour ramener son époux (le Cavalier Déchu). Combat en 2 phases : magie/Givre, puis rituel final incontrôlable (Feu/Poison/Givre).",
  },
};

// Visuel de combat de chaque ennemi jouable : public/assets/combat/enemies/<key>.png
// (un ennemi est "jouable" dès qu'il a des stats de combat)
export const ENEMY_IMG_BASE = "/assets/combat/enemies";
// Hauteur d'affichage (px) dans l'arène : les images ont des proportions variées
const SPRITE_HEIGHT = {
  loup_des_plaines: 150, sanglier_sauvage: 170, bandit_des_routes: 215, cavalier_dechu: 290,
  corbeau_charognard: 130, squelette_fermier: 215, epouvantail_hante: 235, epouvantail_ancestral: 305,
  loup_garou: 240, esprit_errant: 250, chevalier_dechu: 265, veilleur_corrompu: 330,
};
for (const enemy of Object.values(ENEMIES)) {
  if (enemy.stats) {
    enemy.img = `${ENEMY_IMG_BASE}/${enemy.key}.png`;
    enemy.spriteHeight = SPRITE_HEIGHT[enemy.key] || 200;
  }
}
