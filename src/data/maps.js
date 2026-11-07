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
// Les nœuds de récolte repoussent au bout de `nodeRespawnSteps` pas.
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
    // Nœuds de récolte (voir data/gathering.js). Ils bloquent leur tuile ;
    // on les récolte depuis une case voisine, puis ils repoussent.
    nodeRespawnSteps: 30,
    nodes: [
      { id: "frene_1", node: "frene", x: 6, y: 1 },
      { id: "frene_2", node: "frene", x: 2, y: 5 },
      { id: "frene_3", node: "frene", x: 11, y: 8 },
      { id: "chene_1", node: "chene", x: 14, y: 5 },
      { id: "fer_1", node: "filon_de_fer", x: 1, y: 3 },
      { id: "fer_2", node: "filon_de_fer", x: 14, y: 1 },
      { id: "cuivre_1", node: "filon_de_cuivre", x: 14, y: 8 },
      { id: "ortie_1", node: "ortie", x: 5, y: 3 },
      { id: "ortie_2", node: "ortie", x: 8, y: 7 },
      { id: "sauge_1", node: "sauge", x: 11, y: 4 },
    ],
  },
};

export function initialWorld(mapKey = "prairies_sauvages") {
  const m = MAPS[mapKey];
  return { mapKey, pos: { ...m.start }, steps: 0, cleared: {} };   // cleared : { idGroupe: pasAuMomentDeLaVictoire }
}
