// ============================================================
// ARMES — chaque arme équipée donne UN seul sort, propre à son type.
// Tous les autres sorts viennent de la classe du personnage et se
// débloquent avec le niveau (voir classes.js).
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
    spell: { id: "laceration", name: "Lacération", pa: 2, type: "phys", power: 0.9, desc: "Dégâts physiques faibles, +30% critique sur ce coup", critBonus: 30 },
  },
  epee: {
    key: "epee",
    label: "Épée",
    icon: "⚔️",
    style: "Guerrier — équilibré, défense/attaque",
    damageType: "phys",
    spell: { id: "taillade", name: "Taillade", pa: 2, type: "phys", power: 1.0, desc: "Dégâts physiques standards, fiable" },
  },
  baton: {
    key: "baton",
    label: "Bâton",
    icon: "🪄",
    style: "Mage — dégâts magiques, zone, feu",
    damageType: "mag",
    spell: { id: "projectile_arcanique", name: "Projectile Arcanique", pa: 2, type: "mag", power: 1.0, desc: "Dégâts magiques standards" },
  },
  arc: {
    key: "arc",
    label: "Arc",
    icon: "🏹",
    style: "Rôdeur — distance, précision, zone",
    damageType: "phys",
    spell: { id: "tir_rapide", name: "Tir Rapide", pa: 2, type: "phys", power: 0.8, desc: "Dégâts physiques faibles, ignore une partie de l'esquive ennemie", ignoreEsquive: 0.6 },
  },
  marteau: {
    key: "marteau",
    label: "Marteau de guerre",
    icon: "🔨",
    style: "Berserker — dégâts bruts, contrôle",
    damageType: "phys",
    spell: { id: "ecrasement", name: "Écrasement", pa: 3, type: "phys", power: 1.8, desc: "Gros dégâts physiques, coup lent mais puissant" },
  },
  faux: {
    key: "faux",
    label: "Faux",
    icon: "🩸",
    style: "Nécromancien — hybride, drain, ombre",
    damageType: "mag",
    spell: { id: "vol_de_vie", name: "Vol de Vie", pa: 3, type: "mag", power: 1.0, desc: "Dégâts magiques + soigne le joueur d'un % des dégâts infligés", lifesteal: 0.4 },
  },
};

export const WEAPON_ORDER = ["dague", "epee", "baton", "arc", "marteau", "faux"];
