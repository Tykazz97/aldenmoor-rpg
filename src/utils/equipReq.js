// ============================================================
// NIVEAU MINIMUM POUR S'ÉQUIPER
//
// Chaque pièce demande un niveau de héros, selon son palier : le niveau où commence la région dont elle vient.
//   palier 1 (Prairies, niveaux 1 à 8) : aucun ; palier 2 (Champs Calcinés) : 8 ; palier 3 (Lisière) : 14 ; palier 4 (donjon) : 20.
// Les objets de boss sans palier (capes, anneaux, amulettes, armes du Veilleur) ont le niveau de leur région d'origine.
// Ce n'est qu'une règle d'équipement : on peut fabriquer, ranger, vendre ou échanger une pièce trop haute.
// Les simulés s'équipent plus tard que ces niveaux (partyBots.tierOf : 10 / 16 ; donjon : 20), ils n'ont donc rien à vérifier.
// Une pièce déjà portée (vieille sauvegarde) reste portée ; seul le fait de l'équiper demande le niveau.
// ============================================================
export const TIER_EQUIP_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20 };

// objets sans palier : niveau de la région où se trouve leur boss
export const EQUIP_LEVEL_OVERRIDES = {
  cape_epouvantail: 5,            // Épouvantail Ancestral (Prairies)
  amulette_coeur_de_braise: 8,    // Champs Calcinés
  anneau_cavalier: 14,            // Cavalier Déchu (Lisière)
  amulette_armure_maudite: 14,    // Armure Maudite (Lisière)
  lame_du_veilleur: 20, croc_du_veilleur: 20, sceptre_du_veilleur: 20,   // Veilleur Corrompu (donjon)
};

export const equipLevelOf = (item) => (item ? EQUIP_LEVEL_OVERRIDES[item.id] ?? TIER_EQUIP_LEVEL[item.tier || 1] ?? 1 : 1);
export const canEquipAtLevel = (item, level) => (level || 1) >= equipLevelOf(item);
export const equipLockText = (item) => `Niveau ${equipLevelOf(item)} requis`;
