// ============================================================
// ARMES — chaque arme équipée donne accès à 3 sorts fixes.
// C'est l'arme (pas une "classe") qui définit le style de jeu.
//
// Champs de combat d'un sort (lus par src/combat/engine.js) :
//   pa          coût en points d'action (le joueur en a 6 par tour)
//   type        "phys" | "mag" (dégâts) ou "buff" (sur soi)
//   power       multiplicateur appliqué à l'attaque du joueur
//   aoe         true => touche tous les ennemis, sans cible à choisir
//   critBonus   points de % de critique en plus sur ce sort
//   armorPen    part (0-1) de la défense de la cible ignorée
//   ignoreEsquive part (0-1) de l'esquive de la cible ignorée
//   lifesteal   part (0-1) des dégâts infligés rendue en PV
//   effect      effet appliqué à la cible :
//     { kind: "dot", element, turns, ratio }   dégâts par tour = ratio × attaque
//     { kind: "weaken", turns, value }         la cible inflige `value` (0-1) de dégâts en moins
//     { kind: "defDown", turns, value }        défense réduite de `value` (0-1)
//     { kind: "paLoss", value }                la cible perd `value` PA à son prochain tour
//   selfEffect  effet appliqué au lanceur (sorts de type "buff") :
//     { kind: "parade", turns, defUp, counter }
//     { kind: "shadow" }  prochaine attaque reçue esquivée + prochain coup critique
// ============================================================

// Types de dégâts élémentaires additionnels aux dégâts phys/mag de base
export const ELEMENTS = {
  feu: { key: "feu", label: "Feu", color: "#e0742f", desc: "Brûlure : dégâts sur la durée" },
  poison: { key: "poison", label: "Poison", color: "#6f9c4a", desc: "Dégâts sur la durée" },
  givre: { key: "givre", label: "Givre", color: "#5fa3c4", desc: "Affaiblit la cible : ses dégâts sont réduits" },
};

// Sorts de base quand aucune arme n'est équipée
export const UNARMED_SPELLS = [
  { id: "coup_de_poing", name: "Coup de poing", pa: 2, type: "phys", power: 0.7, desc: "Un coup à mains nues, faible" },
];

export const WEAPON_TYPES = {
  dague: {
    key: "dague",
    label: "Dague",
    icon: "🗡️",
    style: "Assassin — critique, poison, esquive",
    damageType: "phys",
    spells: [
      { id: "laceration", name: "Lacération", pa: 2, type: "phys", power: 0.9, desc: "Dégâts physiques faibles, +30% critique sur ce coup", critBonus: 30 },
      { id: "frappe_empoisonnee", name: "Frappe Empoisonnée", pa: 3, type: "phys", power: 0.8, desc: "Dégâts physiques + applique Poison (3 tours)", applyElement: "poison",
        effect: { kind: "dot", element: "poison", turns: 3, ratio: 0.3 } },
      { id: "disparition", name: "Disparition", pa: 4, type: "buff", desc: "Esquive garantie la prochaine attaque + prochain coup porté = critique auto",
        selfEffect: { kind: "shadow" } },
    ],
  },
  epee: {
    key: "epee",
    label: "Épée",
    icon: "⚔️",
    style: "Guerrier — équilibré, défense/attaque",
    damageType: "phys",
    spells: [
      { id: "taillade", name: "Taillade", pa: 2, type: "phys", power: 1.0, desc: "Dégâts physiques standards, fiable" },
      { id: "parade", name: "Parade", pa: 2, type: "buff", desc: "+DEF Physique temporaire (2 tours) + contre-attaque légère si touché",
        selfEffect: { kind: "parade", turns: 2, defUp: 15, counter: 0.5 } },
      { id: "coup_devastateur", name: "Coup Dévastateur", pa: 5, type: "phys", power: 2.2, desc: "Gros dégâts physiques, ignore une partie de la DEF ennemie", armorPen: 0.4 },
    ],
  },
  baton: {
    key: "baton",
    label: "Bâton",
    icon: "🪄",
    style: "Mage — dégâts magiques, zone, feu",
    damageType: "mag",
    spells: [
      { id: "projectile_arcanique", name: "Projectile Arcanique", pa: 2, type: "mag", power: 1.0, desc: "Dégâts magiques standards" },
      { id: "brasier", name: "Brasier", pa: 3, type: "mag", power: 0.8, desc: "Dégâts magiques + applique Feu (3 tours)", applyElement: "feu",
        effect: { kind: "dot", element: "feu", turns: 3, ratio: 0.3 } },
      { id: "explosion_arcanique", name: "Explosion Arcanique", pa: 5, type: "mag", power: 1.3, desc: "Gros dégâts magiques sur tous les ennemis", aoe: true },
    ],
  },
  arc: {
    key: "arc",
    label: "Arc",
    icon: "🏹",
    style: "Rôdeur — distance, précision, zone",
    damageType: "phys",
    spells: [
      { id: "tir_rapide", name: "Tir Rapide", pa: 2, type: "phys", power: 0.8, desc: "Dégâts physiques faibles, ignore une partie de l'esquive ennemie", ignoreEsquive: 0.6 },
      { id: "tir_percant", name: "Tir Perçant", pa: 3, type: "phys", power: 1.1, desc: "Dégâts physiques moyens + réduit la DEF Physique de la cible (2 tours)",
        effect: { kind: "defDown", turns: 2, value: 0.3 } },
      { id: "pluie_de_fleches", name: "Pluie de Flèches", pa: 5, type: "phys", power: 1.0, desc: "Dégâts physiques sur tous les ennemis, réduits par cible", aoe: true },
    ],
  },
  marteau: {
    key: "marteau",
    label: "Marteau de guerre",
    icon: "🔨",
    style: "Berserker — dégâts bruts, contrôle",
    damageType: "phys",
    spells: [
      { id: "ecrasement", name: "Écrasement", pa: 3, type: "phys", power: 1.8, desc: "Gros dégâts physiques, coup lent mais puissant" },
      { id: "choc_sonnant", name: "Choc Sonnant", pa: 4, type: "phys", power: 1.1, desc: "Dégâts physiques moyens + retire 3 PA à la cible à son prochain tour",
        effect: { kind: "paLoss", value: 3 } },
      { id: "seisme", name: "Séisme", pa: 6, type: "phys", power: 1.2, desc: "Dégâts physiques sur tous les ennemis + affaiblit leurs attaques de 25% (2 tours)", aoe: true, applyElement: "givre",
        effect: { kind: "weaken", turns: 2, value: 0.25 } },
    ],
  },
  faux: {
    key: "faux",
    label: "Faux",
    icon: "🩸",
    style: "Nécromancien — hybride, drain, ombre",
    damageType: "mag",
    spells: [
      { id: "fauchaison", name: "Fauchaison", pa: 3, type: "phys", power: 0.9, desc: "Dégâts physiques sur tous les ennemis en ligne", aoe: true },
      { id: "vol_de_vie", name: "Vol de Vie", pa: 3, type: "mag", power: 1.0, desc: "Dégâts magiques + soigne le joueur d'un % des dégâts infligés", lifesteal: 0.4 },
      { id: "etreinte_glaciale", name: "Étreinte Glaciale", pa: 4, type: "mag", power: 1.1, desc: "Dégâts magiques + applique Givre (ses dégâts -30%, 2 tours)", applyElement: "givre",
        effect: { kind: "weaken", turns: 2, value: 0.3 } },
    ],
  },
};

export const WEAPON_ORDER = ["dague", "epee", "baton", "arc", "marteau", "faux"];
