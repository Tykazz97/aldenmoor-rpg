// ============================================================
// DONJONS — suites de salles à enchaîner avec un groupe. Entre deux salles, le groupe arrive dans la suivante (décor `bg`, groupe de monstres
// visible) et peut boire des potions à volonté avant de lancer le combat ; rien d'autre ne soigne.
// Les PV des héros sont reportés d'une salle à l'autre ; un héros tombé se relève avec 20 % de ses PV max
// (DUNGEON_REVIVE, voir combat/engine.js). Si le joueur tombe, l'expédition s'arrête.
// La clé est consommée à l'entrée, même en cas de défaite. Le butin de chaque salle gagnée est conservé.
// ============================================================

export const DUNGEONS = {
  manoir_englouti: {
    key: "manoir_englouti",
    name: "Le Manoir Englouti",
    desc: "Ancien manoir seigneurial, siège du rituel qui a corrompu toute la région. Quatre salles, un groupe de trois : les PV ne reviennent pas tout seuls entre les salles, seules les potions soignent.",
    keyItem: "cle_du_manoir",
    levels: "Niveaux 20 à 26",
    minLevel: 20,
    partySize: 3,
    relic: "medaillon_dame_en_deuil",
    rooms: [
      { id: "hall", bg: "/assets/dungeons/manoir_englouti/hall.webp", name: "Le Hall inondé", enemies: ["serviteur_spectral", "molosse_du_manoir", "serviteur_spectral"],
        desc: "L'eau noire clapote sur le marbre. Les domestiques n'ont jamais quitté leur poste." },
      { id: "salle_a_manger", bg: "/assets/dungeons/manoir_englouti/salle_a_manger.webp", name: "La Salle à manger", enemies: ["molosse_du_manoir", "garde_noye", "pleureuse"],
        desc: "Une table dressée pour des convives morts depuis des siècles." },
      { id: "galerie", bg: "/assets/dungeons/manoir_englouti/galerie.webp", name: "La Galerie des portraits", enemies: ["garde_noye", "pleureuse", "garde_noye"],
        desc: "Les regards des ancêtres suivent chaque pas. La garde du manoir veille." },
      { id: "chapelle", bg: "/assets/dungeons/manoir_englouti/chapelle.webp", name: "La Chapelle ardente", enemies: ["dame_en_deuil", "pleureuse", "pleureuse"],
        desc: "La Dame en Deuil veille son époux. Ses pleureuses l'entourent.", boss: true },
    ],
  },
};
export const DUNGEON_ORDER = Object.keys(DUNGEONS);
export const dungeonOfKey = (itemId) => Object.values(DUNGEONS).find((d) => d.keyItem === itemId) || null;
