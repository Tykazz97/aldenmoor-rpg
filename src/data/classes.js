// ============================================================
// CLASSES — le personnage en choisit une à la création.
//
// Une classe donne :
//   - un kit de départ (arme, 2 pièces de son set, caractéristiques)
//   - ses sorts, qui se débloquent avec le niveau (champ `level`)
// L'arme équipée ajoute en plus UN sort propre à son type (weapons.js).
//
// Les sorts utilisent les mêmes champs que dans weapons.js
// (voir la liste en tête de ce fichier-là).
// ============================================================

export const CLASSES = {
  guerrier: {
    key: "guerrier",
    label: "Guerrier",
    icon: "⚔️",
    outfit: "veteran",                 // apparence de départ (set Vétéran)
    startWeapon: "epee_milicien",
    startGear: ["chapeau_veteran", "plastron_veteran"],
    startCaracs: { force: 3, vitalite: 2 },
    desc: "Solide en première ligne. Il encaisse, brise les armures et contrôle le rythme du combat en retirant des PA à l'ennemi.",
    spells: [
      { level: 1, id: "parade", name: "Parade", pa: 2, type: "buff", desc: "+DEF Physique temporaire (2 tours) + contre-attaque légère si touché",
        selfEffect: { kind: "parade", turns: 2, defUp: 15, counter: 0.5 } },
      { level: 3, id: "coup_devastateur", name: "Coup Dévastateur", pa: 5, type: "phys", power: 2.2, armorPen: 0.4, desc: "Gros dégâts physiques, ignore une partie de la DEF ennemie" },
      { level: 5, id: "choc_sonnant", name: "Choc Sonnant", pa: 4, type: "phys", power: 1.1, desc: "Dégâts physiques moyens + retire 3 PA à la cible à son prochain tour",
        effect: { kind: "paLoss", value: 3 } },
      { level: 7, id: "brise_armure", name: "Brise-Armure", pa: 3, type: "phys", power: 1.1, desc: "Dégâts physiques moyens + réduit la DEF Physique de la cible (2 tours)",
        effect: { kind: "defDown", turns: 2, value: 0.35 } },
      { level: 9, id: "seisme", name: "Séisme", pa: 6, type: "phys", power: 1.2, aoe: true, applyElement: "givre", desc: "Dégâts physiques sur tous les ennemis + affaiblit leurs attaques de 25% (2 tours)",
        effect: { kind: "weaken", turns: 2, value: 0.25 } },
      { level: 12, id: "bastion", name: "Bastion", pa: 3, type: "buff", exclusive: true, desc: "Posture inébranlable : +30 DEF Physique (3 tours) et contre-attaque puissante",
        selfEffect: { kind: "parade", turns: 3, defUp: 30, counter: 1.0 } },
    ],
  },

  assassin: {
    key: "assassin",
    label: "Assassin",
    icon: "🗡️",
    outfit: "traqueur",
    startWeapon: "dague_ebrechee",
    startGear: ["chapeau_traqueur", "plastron_traqueur"],
    startCaracs: { agilite: 3, vitalite: 2 },
    desc: "Fragile mais mortel. Il joue sur l'esquive, les coups critiques et le poison.",
    spells: [
      { level: 1, id: "disparition", name: "Disparition", pa: 4, type: "buff", desc: "Esquive garantie la prochaine attaque + prochain coup porté = critique auto",
        selfEffect: { kind: "shadow" } },
      { level: 3, id: "frappe_empoisonnee", name: "Frappe Empoisonnée", pa: 3, type: "phys", power: 0.8, applyElement: "poison", desc: "Dégâts physiques + applique Poison (3 tours)",
        effect: { kind: "dot", element: "poison", turns: 3, ratio: 0.3 } },
      { level: 5, id: "estoc_fatal", name: "Estoc Fatal", pa: 3, type: "phys", power: 1.3, critBonus: 40, desc: "Dégâts physiques moyens, +40% critique sur ce coup" },
      { level: 7, id: "nuee_de_lames", name: "Nuée de Lames", pa: 5, type: "phys", power: 1.0, aoe: true, critBonus: 20, desc: "Lames lancées sur tous les ennemis, +20% critique" },
      { level: 9, id: "execution", name: "Exécution", pa: 5, type: "phys", power: 2.4, critBonus: 25, armorPen: 0.3, desc: "Très gros dégâts, +25% critique, ignore une partie de la DEF" },
      { level: 12, id: "poison_mortel", name: "Poison Mortel", pa: 4, type: "phys", power: 0.6, applyElement: "poison", exclusive: true, desc: "Dégâts faibles + un poison violent (4 tours)",
        effect: { kind: "dot", element: "poison", turns: 4, ratio: 0.5 } },
    ],
  },

  magicien: {
    key: "magicien",
    label: "Magicien",
    icon: "🪄",
    outfit: "apprenti",
    startWeapon: "baton_noueux",
    startGear: ["chapeau_apprenti", "plastron_apprenti"],
    startCaracs: { intelligence: 3, vitesse: 2 },
    desc: "Dégâts magiques, zone et feu. Il joue tôt grâce à l'initiative, mais ne résiste pas longtemps au corps à corps.",
    spells: [
      { level: 1, id: "brasier", name: "Brasier", pa: 3, type: "mag", power: 0.8, applyElement: "feu", desc: "Dégâts magiques + applique Feu (3 tours)",
        effect: { kind: "dot", element: "feu", turns: 3, ratio: 0.3 } },
      { level: 3, id: "etreinte_glaciale", name: "Étreinte Glaciale", pa: 4, type: "mag", power: 1.1, applyElement: "givre", desc: "Dégâts magiques + applique Givre (ses dégâts -30%, 2 tours)",
        effect: { kind: "weaken", turns: 2, value: 0.3 } },
      { level: 5, id: "explosion_arcanique", name: "Explosion Arcanique", pa: 5, type: "mag", power: 1.3, aoe: true, desc: "Gros dégâts magiques sur tous les ennemis" },
      { level: 7, id: "drain_arcanique", name: "Drain Arcanique", pa: 3, type: "mag", power: 1.0, lifesteal: 0.4, desc: "Dégâts magiques + soigne d'un % des dégâts infligés" },
      { level: 9, id: "entrave_arcanique", name: "Entrave Arcanique", pa: 3, type: "mag", power: 0.9, desc: "Dégâts magiques + retire 2 PA à la cible à son prochain tour",
        effect: { kind: "paLoss", value: 2 } },
      { level: 12, id: "pluie_de_meteores", name: "Pluie de Météores", pa: 6, type: "mag", power: 1.6, aoe: true, applyElement: "feu", exclusive: true, desc: "Dégâts magiques dévastateurs sur tous les ennemis + brûlure (2 tours)",
        effect: { kind: "dot", element: "feu", turns: 2, ratio: 0.3 } },
    ],
  },
};

export const CLASS_ORDER = ["guerrier", "assassin", "magicien"];

// Sorts de classe débloqués à ce niveau (dans l'ordre de déblocage)
export const classSpellsAt = (classKey, level) =>
  (CLASSES[classKey]?.spells || []).filter((sp) => sp.level <= level);

// Sorts qui se débloquent exactement à ce niveau
export const newSpellsAt = (classKey, level) =>
  (CLASSES[classKey]?.spells || []).filter((sp) => sp.level === level);
