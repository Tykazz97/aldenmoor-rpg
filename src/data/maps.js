// ============================================================
// CARTES D'EXPLORATION — une carte (monde ouvert) par région.
//
// Légende des tuiles :
//   .  herbe (praticable)        :  chemin de terre (praticable)
//   #  forêt (bloque)            ~  étang (bloque)
//   r  rochers (bloque)          T  arbre mort (bloque)
//   S  point d'arrivée (praticable)
//   P  pavé (ville, praticable)   B  bâtiment (bloque)   F  fontaine (bloque)
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

// ------------------------------------------------------------
// VILLE — le hub : pas de monstres ni de ressources, mais des lieux où l'on entre
// en cliquant dessus (atelier, coffre, marché, tableau de quêtes, portail).
// Un bâtiment occupe un rectangle de `fw` × `fh` tuiles dont `y` est la rangée du bas ;
// la porte est la tuile du milieu de cette rangée. `w` = largeur du dessin, en tuiles.
// ------------------------------------------------------------
export const CITY_KEY = "aldenmoor_ville";
export const CITY = { key: CITY_KEY, name: "Aldenmoor", difficulty: "ville", desc: "Le cœur du royaume : atelier, coffre, marché et portail vers les régions." };

export const CITY_BUILDINGS = [
  { id: "atelier", kind: "atelier", name: "Atelier", hint: "Forger et fabriquer", img: "/assets/map/city/atelier.png", a: 6, y: 7, fw: 4.4, fh: 2, w: 5.6 },
  { id: "coffre", kind: "coffre", name: "Coffre d'Aldenmoor", hint: "Ranger tes objets et ressources", img: "/assets/map/city/coffre.png", a: 18, y: 7, fw: 4.2, fh: 2, w: 5 },
  { id: "marche", kind: "marche", name: "Marché", hint: "Hôtel des ventes : acheter et vendre", img: "/assets/map/city/marche.png", a: 28, y: 7, fw: 4.4, fh: 2, w: 5.2 },
  { id: "panneau", kind: "panneau", name: "Tableau de quêtes", hint: "Quêtes du jour et réputation", img: "/assets/map/city/panneau.png", a: 12, y: 16, fw: 2.2, fh: 1, w: 3 },
  { id: "portail", kind: "portail", name: "Portail des régions", hint: "Voyager vers une région", img: "/assets/map/city/portail.png", a: 18, y: 22, fw: 3.4, fh: 1, w: 4.4 },
];

// Tuile de la porte d'un bâtiment, et objet prêt à être traité comme un nœud (x, y = la porte)
export const buildingObjects = (map) => (map.buildings || []).map((b) => ({ ...b, x: b.a + Math.floor(b.fw / 2), y: b.y, cx: b.a + b.fw / 2 }));

function buildCity() {
  const W = 40, H = 26;
  const g = Array.from({ length: H }, () => Array(W).fill("."));
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };
  rect(0, 0, W - 1, 1, "#"); rect(0, H - 2, W - 1, H - 1, "#"); rect(0, 0, 1, H - 1, "#"); rect(W - 2, 0, W - 1, H - 1, "#");
  rect(2, 2, 5, 4, "#"); rect(34, 2, 37, 4, "#"); rect(2, 22, 6, 23, "#"); rect(33, 22, 37, 23, "#");
  rect(10, 8, 29, 21, "P");                       // place pavée
  rect(2, 14, 9, 15, ":"); rect(30, 14, 37, 15, ":");   // chemins de terre vers l'ouest et l'est
  rect(19, 12, 20, 13, "F");                      // fontaine
  [[2, 9], [3, 18], [36, 9], [35, 18], [24, 3], [14, 3], [25, 23], [14, 23]].forEach(([x, y]) => { g[y][x] = "r"; });
  for (const b of buildingObjects({ buildings: CITY_BUILDINGS })) rect(b.a, b.y - b.fh + 1, b.a + b.fw - 1, b.y, "B");
  return g.map((r) => r.join(""));
}

MAPS[CITY_KEY] = {
  key: CITY_KEY,
  kind: "city",
  regionKey: CITY_KEY,
  rows: buildCity(),
  start: { x: 20, y: 15 },
  respawnMs: 0,
  nodeRespawnMs: 0,
  groups: [],
  nodes: [],
  buildings: CITY_BUILDINGS,
};

// État du monde (en mémoire pour l'instant) :
//   pos     position du héros en tuiles (décimales)
//   cleared { idObjet: horodatage (ms) du moment où il a été vaincu / récolté }
export function initialWorld(mapKey = CITY_KEY) {
  const m = MAPS[mapKey];
  return { mapKey, pos: { x: m.start.x + 0.5, y: m.start.y + 0.5 }, cleared: {} };
}
