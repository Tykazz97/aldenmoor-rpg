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
        difficulty: "facile",
        desc: "Herbes hautes et fermes abandonnées — les premiers signes de troubles.",
        enemies: ["loup_des_plaines", "sanglier_sauvage", "bandit_des_routes"],
        miniBoss: "cavalier_dechu",
      },
      {
        key: "champs_calcines",
        name: "Champs Calcinés",
        difficulty: "intermédiaire",
        desc: "La corruption se voit désormais — terres brûlées, cultures pourries, ciel assombri.",
        enemies: ["squelette_fermier", "corbeau_charognard", "epouvantail_hante"],
        miniBoss: "epouvantail_ancestral",
      },
      {
        key: "lisiere_des_ombres",
        name: "Lisière des Ombres",
        difficulty: "difficile",
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
    stats: { hp: 70, atkPhys: 9, atkMagie: 0, defPhys: 2, defMagie: 0, esquive: 8, critique: 5, vitesse: 13 },
    xp: 12,
    actions: [
      { id: "morsure", name: "Morsure", type: "phys", power: 1.0, weight: 3 },
      { id: "bond", name: "Bond", type: "phys", power: 1.3, weight: 1 },
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
    stats: { hp: 130, atkPhys: 13, atkMagie: 0, defPhys: 8, defMagie: 0, esquive: 2, critique: 3, vitesse: 8 },
    xp: 18,
    actions: [
      { id: "coup_de_defense", name: "Coup de défense", type: "phys", power: 1.0, weight: 3 },
      { id: "charge", name: "Charge", type: "phys", power: 1.6, weight: 1 },
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
    stats: { hp: 95, atkPhys: 11, atkMagie: 0, defPhys: 4, defMagie: 0, esquive: 10, critique: 8, vitesse: 11 },
    xp: 15,
    actions: [
      { id: "coup_de_gourdin", name: "Coup de gourdin", type: "phys", power: 1.0, weight: 3 },
      { id: "coup_bas", name: "Coup bas", type: "phys", power: 0.7, weight: 1, effect: { kind: "defDown", turns: 2, value: 0.2 } },
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
    stats: { hp: 430, atkPhys: 20, atkMagie: 0, defPhys: 15, defMagie: 5, esquive: 3, critique: 8, vitesse: 9 },
    xp: 150,
    actions: [
      { id: "coup_d_epee", name: "Coup d'épée", type: "phys", power: 1.0, weight: 3 },
      { id: "coup_charge", name: "Coup chargé", type: "phys", power: 1.7, weight: 2, effect: { kind: "defDown", turns: 2, value: 0.3 } },
    ],
    // phase de rage quand les PV passent sous le seuil (part de la vie max)
    phases: [
      { below: 0.5, atkMult: 1.35, vitesseAdd: 2, announce: "Le Cavalier Déchu entre en rage !" },
    ],
    gold: [40, 80],
    drops: [
      { type: "resource", id: "fragment_armure_maudite", chance: 0.6, min: 1, max: 2 },
      { type: "resource", id: "eperon_corrompu", chance: 0.2, min: 1, max: 1 },
    ],
  },

  // --- Région 2 : Champs Calcinés ---
  squelette_fermier: { key: "squelette_fermier", name: "Squelette de fermier", desc: "Mort-vivant lent mais résistant, armé d'une faux rouillée." },
  corbeau_charognard: { key: "corbeau_charognard", name: "Corbeau charognard", desc: "Vole, rapide, attaque en groupe, inflige un léger Poison." },
  epouvantail_hante: { key: "epouvantail_hante", name: "Épouvantail hanté", desc: "Statique puis s'anime, inflige des dégâts de Feu." },
  epouvantail_ancestral: {
    key: "epouvantail_ancestral", name: "L'Épouvantail Ancestral", miniBoss: true,
    desc: "Version massive et maléfique de l'épouvantail. Invoque des corbeaux, inflige Feu + Poison.",
  },

  // --- Région 3 : Lisière des Ombres ---
  loup_garou: { key: "loup_garou", name: "Loup-garou", desc: "Évolution corrompue du loup, rapide, dégâts physiques élevés, rage à bas HP." },
  esprit_errant: { key: "esprit_errant", name: "Esprit errant", desc: "Spectre, dégâts magiques qui ignorent une partie de la DEF Phys, inflige parfois Givre." },
  chevalier_dechu: { key: "chevalier_dechu", name: "Chevalier déchu", desc: "Ancien soldat corrompu, équilibre ATK/DEF, capacité de Feu noir." },
  veilleur_corrompu: {
    key: "veilleur_corrompu", name: "Le Veilleur Corrompu", miniBoss: true,
    desc: "Mi-spectre mi-chevalier, dégâts physiques et magiques, inflige Givre, invoque un esprit errant.",
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
const SPRITE_HEIGHT = { loup_des_plaines: 150, sanglier_sauvage: 170, bandit_des_routes: 215, cavalier_dechu: 290 };
for (const enemy of Object.values(ENEMIES)) {
  if (enemy.stats) {
    enemy.img = `${ENEMY_IMG_BASE}/${enemy.key}.png`;
    enemy.spriteHeight = SPRITE_HEIGHT[enemy.key] || 200;
  }
}
