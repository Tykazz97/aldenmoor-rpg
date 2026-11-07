// ============================================================
// CARTES D'EXPLORATION — une carte (monde ouvert) par région.
//
// Légende des tuiles :
//   .  herbe (praticable)        :  chemin de terre (praticable)
//   #  forêt (bloque)            ~  étang (bloque)
//   r  rochers (bloque)          T  arbre mort (bloque)
//   S  point d'arrivée (praticable)
//
// Les coordonnées (x, y) des groupes et nœuds sont des tuiles. Le
// héros, lui, se déplace librement (coordonnées décimales).
//
// Les groupes d'ennemis renvoient à une rencontre de data/encounters.js
// et les nœuds à une ressource de data/gathering.js. Après une victoire
// ou une récolte, ils réapparaissent au bout de `respawnMs` /
// `nodeRespawnMs` (temps réel, comme dans un MMO).
// ============================================================

export const MAPS = {
  prairies_sauvages: {
    key: "prairies_sauvages",
    regionKey: "prairies_sauvages",
    rows: [
      "################################################",
      "###.#################...####.#####.##.##.#..####",
      "###.....#.######..#.#.#.......#.#..............#",
      "##...........rr...........................T...##",
      "###..........###..............................##",
      "##..........#####...................T..rr.....##",
      "##.........#######............#.........:::....#",
      "#.......T...#####.r.........#.###.....:::::...##",
      "##...........###...........#######..::::::.#.###",
      "##..........................####::::::::#####.##",
      "#.#......................T...::::::::.....##..##",
      "#..........................:::::::...........###",
      "###........rrrT............:::..........~.....##",
      "###............~~~~~.....#:::..........~~~..::##",
      "##....::::::..r~~~~~.Tr.##::#.........~~~:::::##",
      "###S:::::::::..~~~~~.....#::..::::::..T~:::::.##",
      "##.:::::..:::::..::::::..:::::::::::::::::.....#",
      "###.........:::::::::::::::::::::::::::::.T...##",
      "##...........:::::...r::::::::...:::###......###",
      "###..........:::........::::.T...:::####.....###",
      "##...........::....###...........#::::##......##",
      "##..........:::..#######.........##:::::::...###",
      "##..rr......::...#######..........###:::::::.###",
      "###.....#.##::::.#######.........rr...T.::::..##",
      "###T...#####.::::..#::::::.....~~~~~.........###",
      "##.....##.##..::::::::::::....~~~~~~~........###",
      "##..............::::::.........~~~~~.........###",
      "##.#...#..........###....#.##.......##..#.....##",
      "#####.################..#######.###.###..#.##.##",
      "################################################",
    ],
    start: { x: 3, y: 15 },
    respawnMs: 60000,
    nodeRespawnMs: 45000,
    groups: [
      { id: "loups_1", encounter: "loups", x: 6, y: 4 },
      { id: "loups_2", encounter: "loups", x: 19, y: 4 },
      { id: "loups_3", encounter: "loups", x: 14, y: 10 },
      { id: "sangliers_1", encounter: "sangliers", x: 9, y: 20 },
      { id: "sangliers_2", encounter: "sangliers", x: 11, y: 4 },
      { id: "sangliers_3", encounter: "sangliers", x: 13, y: 15 },
      { id: "bandits_1", encounter: "bandits", x: 31, y: 12 },
      { id: "bandits_2", encounter: "bandits", x: 32, y: 5 },
      { id: "bandits_3", encounter: "bandits", x: 20, y: 10 },
      { id: "prairie_1", encounter: "prairie", x: 29, y: 21 },
      { id: "prairie_2", encounter: "prairie", x: 42, y: 5 },
      { id: "prairie_3", encounter: "prairie", x: 38, y: 26 },
      { id: "cavalier_1", encounter: "cavalier", x: 43, y: 19 },
    ],
    nodes: [
      { id: "frene_1", node: "frene", x: 10, y: 8 },
      { id: "frene_2", node: "frene", x: 10, y: 12 },
      { id: "frene_3", node: "frene", x: 23, y: 16 },
      { id: "frene_4", node: "frene", x: 7, y: 7 },
      { id: "frene_5", node: "frene", x: 17, y: 19 },
      { id: "frene_6", node: "frene", x: 24, y: 9 },
      { id: "chene_1", node: "chene", x: 42, y: 26 },
      { id: "chene_2", node: "chene", x: 28, y: 24 },
      { id: "chene_3", node: "chene", x: 37, y: 5 },
      { id: "chene_4", node: "chene", x: 32, y: 19 },
      { id: "fer_1", node: "filon_de_fer", x: 23, y: 26 },
      { id: "fer_2", node: "filon_de_fer", x: 28, y: 6 },
      { id: "fer_3", node: "filon_de_fer", x: 6, y: 22 },
      { id: "fer_4", node: "filon_de_fer", x: 33, y: 14 },
      { id: "fer_5", node: "filon_de_fer", x: 26, y: 4 },
      { id: "cuivre_1", node: "filon_de_cuivre", x: 39, y: 23 },
      { id: "cuivre_2", node: "filon_de_cuivre", x: 35, y: 7 },
      { id: "cuivre_3", node: "filon_de_cuivre", x: 36, y: 15 },
      { id: "ortie_1", node: "ortie", x: 5, y: 26 },
      { id: "ortie_2", node: "ortie", x: 25, y: 12 },
      { id: "ortie_3", node: "ortie", x: 4, y: 6 },
      { id: "ortie_4", node: "ortie", x: 25, y: 20 },
      { id: "ortie_5", node: "ortie", x: 10, y: 17 },
      { id: "ortie_6", node: "ortie", x: 15, y: 22 },
      { id: "ortie_7", node: "ortie", x: 22, y: 3 },
      { id: "sauge_1", node: "sauge", x: 27, y: 10 },
      { id: "sauge_2", node: "sauge", x: 35, y: 3 },
      { id: "sauge_3", node: "sauge", x: 38, y: 11 },
      { id: "sauge_4", node: "sauge", x: 42, y: 12 },
    ],
  },
};

// État du monde (en mémoire pour l'instant) :
//   pos     position du héros en tuiles (décimales)
//   cleared { idObjet: horodatage (ms) du moment où il a été vaincu / récolté }
export function initialWorld(mapKey = "prairies_sauvages") {
  const m = MAPS[mapKey];
  return { mapKey, pos: { x: m.start.x + 0.5, y: m.start.y + 0.5 }, cleared: {} };
}
