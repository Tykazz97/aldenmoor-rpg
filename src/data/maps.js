// ============================================================
// CARTES D'EXPLORATION — une carte par région.
//
// Légende des tuiles :
//   .  herbe (praticable)        :  chemin de terre (praticable)
//   #  forêt (bloque)            ~  étang (bloque)
//   r  rochers (bloque)          T  arbre mort (bloque)
//
// Les groupes d'ennemis sont posés sur des tuiles praticables et
// renvoient à une rencontre de data/encounters.js. Après une
// victoire, un groupe réapparaît au bout de `respawnSteps` pas.
// ============================================================

export const MAPS = {
  prairies_sauvages: {
    key: "prairies_sauvages",
    regionKey: "prairies_sauvages",
    rows: [
      "################",
      "#S.::..T....rr.#",
      "#..:...........#",
      "#..::..~~...T..#",
      "#T..:..~~.r....#",
      "#...::.....T...#",
      "#..r.:::::.....#",
      "#....T...:.rr..#",
      "#..:....::.....#",
      "################",
    ],
    start: { x: 1, y: 1 },
    respawnSteps: 24,
    groups: [
      { id: "loups", encounter: "loups", x: 10, y: 2 },
      { id: "sangliers", encounter: "sangliers", x: 3, y: 7 },
      { id: "bandits", encounter: "bandits", x: 9, y: 5 },
      { id: "prairie", encounter: "prairie", x: 13, y: 7 },
      { id: "cavalier", encounter: "cavalier", x: 13, y: 3 },
    ],
  },
};

export function initialWorld(mapKey = "prairies_sauvages") {
  const m = MAPS[mapKey];
  return { mapKey, pos: { ...m.start }, steps: 0, cleared: {} };   // cleared : { idGroupe: pasAuMomentDeLaVictoire }
}
