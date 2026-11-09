// ============================================================
// RÉCOLTE — nœuds posés sur la carte (arbres, filons, plantes).
// Chaque nœud dépend d'un métier de récolte (professions.js) et
// demande un niveau minimum. Récolter donne la ressource et de
// l'xp de métier ; le nœud réapparaît après quelques pas.
//
// yield  : [min, max] unités récoltées
// size   : hauteur d'affichage sur la carte (1 = une tuile)
// ============================================================

const NODE_IMG_BASE = "/assets/map/nodes";

export const NODES = {
  frene: { id: "frene", name: "Frêne", profession: "bucheron", minLevel: 1, resource: "bois_de_frene", yield: [1, 3], xp: 8, verb: "Abattre", size: 2.3 },
  chene: { id: "chene", name: "Chêne", profession: "bucheron", minLevel: 3, resource: "bois_de_chene", yield: [1, 2], xp: 18, verb: "Abattre", size: 2.5 },
  filon_de_fer: { id: "filon_de_fer", name: "Filon de fer", profession: "mineur", minLevel: 1, resource: "minerai_de_fer", yield: [1, 3], xp: 8, verb: "Miner", size: 1.15 },
  filon_de_cuivre: { id: "filon_de_cuivre", name: "Filon de cuivre", profession: "mineur", minLevel: 3, resource: "minerai_de_cuivre", yield: [1, 2], xp: 18, verb: "Miner", size: 1.2 },
  ortie: { id: "ortie", name: "Ortie", profession: "herboriste", minLevel: 1, resource: "ortie", yield: [1, 3], xp: 8, verb: "Cueillir", size: 0.9 },
  sauge: { id: "sauge", name: "Sauge", profession: "herboriste", minLevel: 3, resource: "sauge", yield: [1, 2], xp: 18, verb: "Cueillir", size: 1.0 },
};

for (const node of Object.values(NODES)) node.img = `${NODE_IMG_BASE}/${node.id}.webp`;

export const NODE_ORDER = Object.keys(NODES);

// Nœuds d'un métier, par niveau requis (pour l'affichage dans la Forge)
export const nodesOfProfession = (professionKey) =>
  NODE_ORDER.map((id) => NODES[id]).filter((n) => n.profession === professionKey).sort((a, b) => a.minLevel - b.minLevel);
