// ============================================================
// BLASONS DE GUILDE — le joueur compose le sien à la création, comme dans Dofus : une forme d'écu, un motif, deux couleurs pour
// le fond, un symbole et sa couleur. Données pures (le dessin est dans components/guild/Emblem.jsx).
// Un blason = { shape, motif, c1, c2, sym, c3 } : des numéros (forme, motif, symbole : rang dans les listes ci-dessous ; couleurs : rang dans PALETTE).
// Les symboles sont des silhouettes (images à fond transparent générées avec Ludo, ou petits dessins vectoriels) : on les teint de
// n'importe quelle couleur.
// ============================================================
import { makeRng, hashString } from "../sim/rng.js";

export const PALETTE = [
  { name: "Or", hex: "#d9b568" }, { name: "Or sombre", hex: "#b8923f" }, { name: "Écarlate", hex: "#c0392b" }, { name: "Bordeaux", hex: "#7a1f1f" },
  { name: "Orange", hex: "#e67e22" }, { name: "Jaune", hex: "#f1c40f" }, { name: "Émeraude", hex: "#2e8b57" }, { name: "Vert forêt", hex: "#14532d" },
  { name: "Azur", hex: "#2980b9" }, { name: "Bleu nuit", hex: "#1a2a5a" }, { name: "Pourpre", hex: "#7d3c98" }, { name: "Rose", hex: "#d98fb0" },
  { name: "Ivoire", hex: "#ecf0f1" }, { name: "Cendre", hex: "#95a5a6" }, { name: "Ardoise", hex: "#34495e" }, { name: "Noir", hex: "#0b0b10" },
];

// Formes d'écu : tracés dans un cadre 100 × 120
export const SHAPES = [
  { name: "Écu", d: "M10 8 H90 V60 C90 90 68 108 50 114 C32 108 10 90 10 60 Z" },
  { name: "Écu pointu", d: "M10 8 H90 V50 L50 114 L10 50 Z" },
  { name: "Écu arrondi", d: "M10 14 Q50 0 90 14 V62 Q90 96 50 114 Q10 96 10 62 Z" },
  { name: "Rond", d: "M50 14 A46 46 0 1 1 49.9 14 Z" },
  { name: "Bannière", d: "M14 8 H86 V106 L50 88 L14 106 Z" },
  { name: "Losange", d: "M50 6 L92 60 L50 114 L8 60 Z" },
  { name: "Hexagone", d: "M50 6 L90 30 V86 L50 114 L10 86 V30 Z" },
  { name: "Carré", d: "M12 12 H88 V108 H12 Z" },
];

// Motifs peints avec la seconde couleur sur le fond (tracés dans le même cadre, découpés par la forme)
export const MOTIFS = [
  { name: "Uni", d: "" },
  { name: "Parti", d: "M0 0 H50 V120 H0 Z" },
  { name: "Coupé", d: "M0 0 H100 V60 H0 Z" },
  { name: "Fasce", d: "M0 46 H100 V76 H0 Z" },
  { name: "Pal", d: "M38 0 H62 V120 H38 Z" },
  { name: "Croix", d: "M38 0 H62 V120 H38 Z M0 46 H100 V74 H0 Z" },
  { name: "Chevron", d: "M0 74 L50 36 L100 74 V96 L50 58 L0 96 Z" },
];

// Symboles : `img` = silhouette générée (public/assets/emblems), `svg` = dessin vectoriel (cadre 100 × 100, en currentColor)
const IMG = "/assets/emblems";
export const SYMBOLS = [
  { id: "wolf", name: "Loup", img: `${IMG}/wolf.png` },
  { id: "raven", name: "Corbeau", img: `${IMG}/raven.png` },
  { id: "swords", name: "Épées croisées", img: `${IMG}/swords.png` },
  { id: "crown", name: "Couronne", img: `${IMG}/crown.png` },
  { id: "star", name: "Étoile", svg: '<polygon fill="currentColor" points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38"/>' },
  { id: "moon", name: "Croissant", svg: '<path fill="currentColor" d="M62 8 A44 44 0 1 0 92 66 A36 36 0 0 1 62 8 Z"/>' },
  { id: "sun", name: "Soleil", svg: '<circle cx="50" cy="50" r="19" fill="currentColor"/><g stroke="currentColor" stroke-width="8" stroke-linecap="round"><path d="M50 8V22M50 78V92M8 50H22M78 50H92M20 20L30 30M70 70L80 80M80 20L70 30M30 70L20 80"/></g>' },
  { id: "cross", name: "Croix", svg: '<polygon fill="currentColor" points="40,6 60,6 60,40 94,40 94,60 60,60 60,94 40,94 40,60 6,60 6,40 40,40"/>' },
  { id: "lozenge", name: "Losange", svg: '<polygon fill="currentColor" points="50,6 86,50 50,94 14,50"/>' },
  { id: "flame", name: "Flamme", svg: '<path fill="currentColor" d="M50 6 C58 28 82 40 82 64 A32 32 0 0 1 18 64 C18 48 30 40 36 30 C38 40 44 44 48 44 C54 34 50 20 50 6 Z"/>' },
  { id: "tower", name: "Tour", svg: '<path fill="currentColor" d="M22 94 V40 H30 V26 H41 V40 H46 V26 H54 V40 H59 V26 H70 V40 H78 V94 Z"/>' },
  { id: "lion", name: "Lion", img: `${IMG}/lion.png` },
  { id: "dragon", name: "Dragon", img: `${IMG}/dragon.png` },
  { id: "eagle", name: "Aigle", img: `${IMG}/eagle.png` },
  { id: "stag", name: "Cerf", img: `${IMG}/stag.png` },
  { id: "boar", name: "Sanglier", img: `${IMG}/boar.png` },
  { id: "bear", name: "Ours", img: `${IMG}/bear.png` },
  { id: "skull", name: "Crâne", img: `${IMG}/skull.png` },
  { id: "axe", name: "Hache", img: `${IMG}/axe.png` },
  { id: "tree", name: "Arbre", img: `${IMG}/tree.png` },
  { id: "hammer", name: "Marteau", img: `${IMG}/hammer.png` },
  { id: "rose", name: "Rose", img: `${IMG}/rose.png` },
  { id: "key", name: "Clé", img: `${IMG}/key.png` },
  { id: "fist", name: "Poing", img: `${IMG}/fist.png` },
  { id: "snake", name: "Serpent", img: `${IMG}/snake.png` },
  { id: "owl", name: "Hibou", img: `${IMG}/owl.png` },
  { id: "fox", name: "Renard", img: `${IMG}/fox.png` },
  { id: "horse", name: "Cheval", img: `${IMG}/horse.png` },
  { id: "bow", name: "Arc", img: `${IMG}/bow.png` },
  { id: "spider", name: "Araignée", img: `${IMG}/spider.png` },
];

export const EMBLEM_DEFAULT = Object.freeze({ shape: 0, motif: 3, c1: 3, c2: 1, sym: 0, c3: 0 });

const inRange = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
// Un blason toujours valide (valeurs hors liste ou manquantes remplacées par celles du blason par défaut)
export function cleanEmblem(e) {
  const o = e && typeof e === "object" ? e : {};
  return {
    shape: inRange(o.shape, SHAPES.length, EMBLEM_DEFAULT.shape), motif: inRange(o.motif, MOTIFS.length, EMBLEM_DEFAULT.motif),
    c1: inRange(o.c1, PALETTE.length, EMBLEM_DEFAULT.c1), c2: inRange(o.c2, PALETTE.length, EMBLEM_DEFAULT.c2),
    sym: inRange(o.sym, SYMBOLS.length, EMBLEM_DEFAULT.sym), c3: inRange(o.c3, PALETTE.length, EMBLEM_DEFAULT.c3),
  };
}

// Luminosité approximative d'une couleur de la palette (pour éviter un symbole invisible sur le fond)
const lum = (i) => { const h = PALETTE[i].hex; const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return 0.3 * r + 0.59 * g + 0.11 * b; };
// Un blason tiré au hasard à partir d'une graine (mêmes graines : même blason), avec un symbole lisible sur le fond
export function randomEmblem(seed) {
  const r = makeRng(hashString(`emblem:${seed}`));
  const c1 = r.int(0, PALETTE.length - 1);
  let c2 = r.int(0, PALETTE.length - 1); if (c2 === c1) c2 = (c2 + 5) % PALETTE.length;
  let c3 = r.int(0, PALETTE.length - 1);
  for (let k = 0; k < PALETTE.length && (c3 === c1 || Math.abs(lum(c3) - lum(c1)) < 70); k++) c3 = (c3 + 1) % PALETTE.length;
  return { shape: r.int(0, SHAPES.length - 1), motif: r.int(0, MOTIFS.length - 1), c1, c2, sym: r.int(0, SYMBOLS.length - 1), c3 };
}
