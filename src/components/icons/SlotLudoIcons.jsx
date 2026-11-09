// ============================================================
// Icônes de slots — vraies images Ludo (utilisées en priorité).
// Fallback vers les SVG dessinés (SlotIcons.jsx) si absent.
//
// Fichiers réels dans /public/assets/icons/slots/ — Vite les sert
// directement à la racine, pas d'import ni de base64 inline.
// Ça garde le bundle JS léger même en ajoutant beaucoup d'assets.
// ============================================================

const BASE = "/assets/icons/slots";

const SLOT_LUDO_ICONS = {
  chapeau: `${BASE}/chapeau.webp`,
  cape: `${BASE}/cape.webp`,
  plastron: `${BASE}/plastron.webp`,
  amulette: `${BASE}/amulette.webp`,
  gants: `${BASE}/gants.webp`,
  ceinture: `${BASE}/ceinture.webp`,
  anneau: `${BASE}/anneau.webp`,
  jambieres: `${BASE}/jambieres.webp`,
  arme: `${BASE}/arme.webp`,
  bouclier: `${BASE}/bouclier.webp`,
  relique1: `${BASE}/relique1.webp`,
  relique2: `${BASE}/relique2.webp`,
  relique3: `${BASE}/relique3.webp`,
  relique4: `${BASE}/relique4.webp`,
};

export default SLOT_LUDO_ICONS;
