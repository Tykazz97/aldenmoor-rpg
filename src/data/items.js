// ============================================================
// ITEMS — équipement du jeu, organisé par set.
// Les 3 sets communs (Vétéran/Guerrier, Mage, Assassin) dropent
// dans toute la Zone 1, indépendamment des régions.
// ============================================================

const ICON_BASE = "/assets/icons/items";

export const ITEMS = {
  // ---------------------------------------------------------
  // SET VÉTÉRAN — Guerrier : DEF Phys / HP
  // ---------------------------------------------------------
  chapeau_veteran: {
    id: "chapeau_veteran",
    name: "Heaume du Vétéran",
    type: "chapeau",
    rarity: "commune",
    set: "veteran",
    img: `${ICON_BASE}/veteran/chapeau_veteran.png`,
    def_phys: 6,
    hp: 10,
  },
  plastron_veteran: {
    id: "plastron_veteran",
    name: "Cuirasse du Vétéran",
    type: "plastron",
    rarity: "commune",
    set: "veteran",
    img: `${ICON_BASE}/veteran/plastron_veteran.png`,
    def_phys: 12,
    hp: 20,
  },
  gants_veteran: {
    id: "gants_veteran",
    name: "Gantelets du Vétéran",
    type: "gants",
    rarity: "commune",
    set: "veteran",
    img: `${ICON_BASE}/veteran/gants_veteran.png`,
    def_phys: 4,
    atk_phys: 3,
  },
  ceinture_veteran: {
    id: "ceinture_veteran",
    name: "Ceinture du Vétéran",
    type: "ceinture",
    rarity: "commune",
    set: "veteran",
    img: `${ICON_BASE}/veteran/ceinture_veteran.png`,
    def_phys: 5,
    hp: 10,
  },
  jambieres_veteran: {
    id: "jambieres_veteran",
    name: "Jambières du Vétéran",
    type: "jambieres",
    rarity: "commune",
    set: "veteran",
    img: `${ICON_BASE}/veteran/jambieres_veteran.png`,
    def_phys: 6,
    hp: 10,
  },

  // ---------------------------------------------------------
  // SET APPRENTI — Mage : ATK Magie / DEF Magie
  // ---------------------------------------------------------
  chapeau_apprenti: {
    id: "chapeau_apprenti",
    name: "Capuche de l'Apprenti",
    type: "chapeau",
    rarity: "commune",
    set: "apprenti",
    img: `${ICON_BASE}/apprenti/chapeau_apprenti.png`,
    atk_magie: 4,
    def_magie: 3,
  },
  plastron_apprenti: {
    id: "plastron_apprenti",
    name: "Robe de l'Apprenti",
    type: "plastron",
    rarity: "commune",
    set: "apprenti",
    img: `${ICON_BASE}/apprenti/plastron_apprenti.png`,
    atk_magie: 8,
    hp: 10,
  },
  gants_apprenti: {
    id: "gants_apprenti",
    name: "Gants de l'Apprenti",
    type: "gants",
    rarity: "commune",
    set: "apprenti",
    img: `${ICON_BASE}/apprenti/gants_apprenti.png`,
    atk_magie: 2,
    def_magie: 4,
  },
  ceinture_apprenti: {
    id: "ceinture_apprenti",
    name: "Ceinture de l'Apprenti",
    type: "ceinture",
    rarity: "commune",
    set: "apprenti",
    img: `${ICON_BASE}/apprenti/ceinture_apprenti.png`,
    atk_magie: 3,
    def_magie: 3,
  },
  jambieres_apprenti: {
    id: "jambieres_apprenti",
    name: "Bottes de l'Apprenti",
    type: "jambieres",
    rarity: "commune",
    set: "apprenti",
    img: `${ICON_BASE}/apprenti/jambieres_apprenti.png`,
    atk_magie: 4,
    hp: 5,
  },

  // ---------------------------------------------------------
  // SET TRAQUEUR — Assassin : Esquive / Critique
  // ---------------------------------------------------------
  chapeau_traqueur: {
    id: "chapeau_traqueur",
    name: "Capuche du Traqueur",
    type: "chapeau",
    rarity: "commune",
    set: "traqueur",
    img: `${ICON_BASE}/traqueur/chapeau_traqueur.png`,
    esquive: 3,
    critique: 2,
    atk_phys: 2,
  },
  plastron_traqueur: {
    id: "plastron_traqueur",
    name: "Veste du Traqueur",
    type: "plastron",
    rarity: "commune",
    set: "traqueur",
    img: `${ICON_BASE}/traqueur/plastron_traqueur.png`,
    esquive: 5,
    critique: 3,
    atk_phys: 4,
  },
  gants_traqueur: {
    id: "gants_traqueur",
    name: "Gants du Traqueur",
    type: "gants",
    rarity: "commune",
    set: "traqueur",
    img: `${ICON_BASE}/traqueur/gants_traqueur.png`,
    critique: 2,
    atk_phys: 4,
  },
  ceinture_traqueur: {
    id: "ceinture_traqueur",
    name: "Ceinture du Traqueur",
    type: "ceinture",
    rarity: "commune",
    set: "traqueur",
    img: `${ICON_BASE}/traqueur/ceinture_traqueur.png`,
    esquive: 3,
    critique: 2,
    atk_phys: 2,
  },
  jambieres_traqueur: {
    id: "jambieres_traqueur",
    name: "Bottes du Traqueur",
    type: "jambieres",
    rarity: "commune",
    set: "traqueur",
    img: `${ICON_BASE}/traqueur/jambieres_traqueur.png`,
    esquive: 4,
    critique: 2,
    atk_phys: 3,
  },

  // ---------------------------------------------------------
  // ARMES — chacune débloque les 3 sorts de son type (voir weapons.js)
  // twoHanded: true => le slot bouclier se désactive automatiquement
  // ---------------------------------------------------------
  dague_ebrechee: {
    id: "dague_ebrechee",
    name: "Dague Émoussée",
    type: "arme",
    weaponType: "dague",
    rarity: "commune",
    twoHanded: false,
    img: `${ICON_BASE}/weapons/dague_ebrechee.png`,
    atk_phys: 14,
    critique: 2,
  },
  epee_milicien: {
    id: "epee_milicien",
    name: "Épée du Milicien",
    type: "arme",
    weaponType: "epee",
    rarity: "commune",
    twoHanded: false,
    img: `${ICON_BASE}/weapons/epee_milicien.png`,
    atk_phys: 16,
    def_phys: 2,
  },
  baton_noueux: {
    id: "baton_noueux",
    name: "Bâton Noueux",
    type: "arme",
    weaponType: "baton",
    rarity: "commune",
    twoHanded: true,
    img: `${ICON_BASE}/weapons/baton_noueux.png`,
    atk_magie: 12,
    def_magie: 3,
  },
  arc_chasse: {
    id: "arc_chasse",
    name: "Arc de Chasse",
    type: "arme",
    weaponType: "arc",
    rarity: "commune",
    twoHanded: true,
    img: `${ICON_BASE}/weapons/arc_chasse.png`,
    atk_phys: 17,
    esquive: 3,
    critique: 2,
  },
  masse_rouillee: {
    id: "masse_rouillee",
    name: "Masse Rouillée",
    type: "arme",
    weaponType: "marteau",
    rarity: "commune",
    twoHanded: true,
    img: `${ICON_BASE}/weapons/masse_rouillee.png`,
    atk_phys: 20,
  },
  faux_ebrechee: {
    id: "faux_ebrechee",
    name: "Faux Émoussée",
    type: "arme",
    weaponType: "faux",
    rarity: "commune",
    twoHanded: true,
    img: `${ICON_BASE}/weapons/faux_ebrechee.png`,
    atk_phys: 10,
    atk_magie: 8,
  },
  bouclier_milicien: {
    id: "bouclier_milicien",
    name: "Bouclier du Milicien",
    type: "bouclier",
    rarity: "commune",
    img: `${ICON_BASE}/weapons/bouclier_milicien.png`,
    def_phys: 10,
    def_magie: 5,
  },
};

export const ITEM_ORDER = Object.keys(ITEMS);

// ============================================================
// SETS — bonus cumulatifs selon le nombre de pièces équipées
// ============================================================

export const SETS = {
  veteran: {
    key: "veteran",
    name: "Harnois du Vétéran",
    color: "#c2603f",
    pieces: ["chapeau_veteran", "plastron_veteran", "gants_veteran", "ceinture_veteran", "jambieres_veteran"],
    bonuses: {
      2: { desc: "+10 DEF Physique, +20 HP", def_phys: 10, hp: 20 },
      5: { desc: "+25 DEF Physique, +60 HP, 15% de chance de riposte", def_phys: 25, hp: 60, riposte: 0.15 },
    },
  },
  apprenti: {
    key: "apprenti",
    name: "Robes de l'Apprenti",
    color: "#5fa3c4",
    pieces: ["chapeau_apprenti", "plastron_apprenti", "gants_apprenti", "ceinture_apprenti", "jambieres_apprenti"],
    bonuses: {
      2: { desc: "+6 ATK Magique, +8 DEF Magique", atk_magie: 6, def_magie: 8 },
      5: { desc: "+14 ATK Magique, +20 DEF Magique, +20 PV, le premier sort de chaque tour coûte 1 PA de moins", atk_magie: 14, def_magie: 20, hp: 20, firstSpellDiscount: 1 },
    },
  },
  traqueur: {
    key: "traqueur",
    name: "Cuirs du Traqueur",
    color: "#6f9c4a",
    pieces: ["chapeau_traqueur", "plastron_traqueur", "gants_traqueur", "ceinture_traqueur", "jambieres_traqueur"],
    bonuses: {
      2: { desc: "+6% Esquive, +4% Critique", esquive: 6, critique: 4 },
      5: { desc: "+12% Esquive, +8% Critique, +5 ATK Physique, le premier coup de chaque combat est un critique garanti", esquive: 12, critique: 8, atk_phys: 5, guaranteedFirstCrit: true },
    },
  },
};

// Calcule les bonus de set actifs à partir des items équipés
export function calcSetBonuses(equipped) {
  const results = [];
  for (const setDef of Object.values(SETS)) {
    const equippedIds = Object.values(equipped)
      .filter(Boolean)
      .map((item) => item.id);
    const count = setDef.pieces.filter((pieceId) => equippedIds.includes(pieceId)).length;

    // Le bonus actif est le plus haut palier atteint
    const thresholds = Object.keys(setDef.bonuses).map(Number).sort((a, b) => b - a);
    for (const threshold of thresholds) {
      if (count >= threshold) {
        results.push({ set: setDef, count, threshold, bonus: setDef.bonuses[threshold] });
        break;
      }
    }
  }
  return results;
}
