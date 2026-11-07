// ============================================================
// Animations du héros sur la carte (feuilles générées avec Ludo,
// assemblées par scripts/build-hero-anims.py).
//   walk  marche            mine  coups de pioche
//   chop  coups de hache    herb  cueillette
// Une feuille par tenue et par action : /assets/hero/<tenue>/<action>.webp
// ============================================================
import ANIMS from "./heroAnims.json";
import { HERO_OUTFITS } from "./heroSprites.js";

export const HERO_ACTION_FOR_PROFESSION = { bucheron: "chop", mineur: "mine", herboriste: "herb" };
export const HERO_HEIGHT_CQ = 10.5;   // hauteur du héros à l'écran (unités de sprite : 6.25 = une tuile)

export const heroAnimMeta = (outfit) => ANIMS[HERO_OUTFITS.includes(outfit) && ANIMS[outfit] ? outfit : "base"];
export const heroSheetUrl = (outfit, action) => `/assets/hero/${ANIMS[outfit] ? outfit : "base"}/${action}.webp`;

// Taille d'affichage d'une frame et position du point d'appui (en unités de sprite)
export function heroFrameLayout(outfit) {
  const m = heroAnimMeta(outfit);
  const k = HERO_HEIGHT_CQ / m.pngH / m.scale;       // unités de sprite par pixel de feuille
  return { w: m.w * k, h: m.h * k, ax: m.anchor[0] * k, ay: m.anchor[1] * k };
}

// Position de fond (en %) d'une frame dans une feuille en grille
export function frameBackground(meta, i) {
  const c = i % meta.cols, r = Math.floor(i / meta.cols);
  return `${meta.cols > 1 ? (c / (meta.cols - 1)) * 100 : 0}% ${meta.rows > 1 ? (r / (meta.rows - 1)) * 100 : 0}%`;
}
