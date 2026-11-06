// ============================================================
// Apparence du héros en combat : la tenue affichée est celle du
// set dont on porte le plus de pièces (2 minimum), sinon la tenue
// de base. Fichiers : public/assets/combat/hero/<tenue>.png
// ============================================================

const HERO_BASE = "/assets/combat/hero";
// Tenues dont l'image existe (les autres retombent sur la tenue de base)
export const HERO_OUTFITS = ["base", "veteran", "apprenti", "traqueur"];

export function heroOutfitFor(setBonuses = []) {
  let best = null;
  for (const b of setBonuses) {
    if (b.count >= 2 && (!best || b.count > best.count)) best = b;
  }
  const key = best ? best.set.key : "base";
  return HERO_OUTFITS.includes(key) ? key : HERO_OUTFITS.includes("base") ? "base" : "veteran";
}

export const heroSpriteUrl = (outfit) => `${HERO_BASE}/${outfit}.png`;
