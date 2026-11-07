// ============================================================
// Animations du héros sur la carte (feuilles générées avec Ludo,
// assemblées par scripts/build-hero-anims.py).
//   walk  marche            mine  coups de pioche
//   chop  coups de hache    herb  cueillette
// Une feuille par corps, tenue et action : /assets/hero/<corps>/<tenue>/<action>.webp
// ============================================================
import ANIMS from "./heroAnims.json";

export const HERO_ACTION_FOR_PROFESSION = { bucheron: "chop", mineur: "mine", herboriste: "herb" };
export const HERO_HEIGHT_CQ = 10.5;   // hauteur du héros à l'écran (unités de sprite : 6.25 = une tuile)

// `look` = "<corps>/<tenue>" (ex. "m/veteran"). Si les feuilles du look n'existent pas
// encore (corps féminin), on retombe sur le corps masculin.
const resolveLook = (look) => (ANIMS[look] ? look : ANIMS[`m/${String(look).split("/")[1]}`] ? `m/${String(look).split("/")[1]}` : "m/base");
export const heroAnimMeta = (look) => ANIMS[resolveLook(look)];
export const heroSheetUrl = (look, action) => `/assets/hero/${resolveLook(look)}/${action}.webp`;

// Taille d'affichage d'une frame et position du point d'appui (en unités de sprite)
export function heroFrameLayout(look) {
  const m = heroAnimMeta(look);
  const k = HERO_HEIGHT_CQ / m.pngH / m.scale;       // unités de sprite par pixel de feuille
  return { w: m.w * k, h: m.h * k, ax: m.anchor[0] * k, ay: m.anchor[1] * k };
}

// Position de fond (en %) d'une frame dans une feuille en grille
export function frameBackground(meta, i) {
  const c = i % meta.cols, r = Math.floor(i / meta.cols);
  return `${meta.cols > 1 ? (c / (meta.cols - 1)) * 100 : 0}% ${meta.rows > 1 ? (r / (meta.rows - 1)) * 100 : 0}%`;
}
