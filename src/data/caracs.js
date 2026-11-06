// ============================================================
// CARACTÉRISTIQUES — 6 stats réparties par le joueur en montant
// de niveau. DEF Physique/Magique ne sont PAS des caracs : elles
// viennent uniquement de l'équipement.
// ============================================================

export const CARACS = {
  force: {
    key: "force",
    label: "Force",
    color: "#c2603f",
    desc: "Dégâts physiques (+2/pt)",
    effect: (val) => ({ atkPhys: val * 2 }),
  },
  intelligence: {
    key: "intelligence",
    label: "Intelligence",
    color: "#7c6fd9",
    desc: "Dégâts magiques (+2/pt)",
    effect: (val) => ({ atkMagie: val * 2 }),
  },
  agilite: {
    key: "agilite",
    label: "Agilité",
    color: "#6f9c4a",
    desc: "Esquive (+1%/pt) + Critique (+0.5%/pt)",
    effect: (val) => ({ esquive: val * 1, critique: val * 0.5 }),
  },
  vitalite: {
    key: "vitalite",
    label: "Vitalité",
    color: "#b03a3a",
    desc: "HP max (+10/pt)",
    effect: (val) => ({ maxHpBonus: val * 10 }),
  },
  chance: {
    key: "chance",
    label: "Chance",
    color: "#d9b568",
    desc: "Qualité de drop (+0.5%/pt)",
    effect: (val) => ({ dropBonus: val * 0.5 }),
  },
  vitesse: {
    key: "vitesse",
    label: "Vitesse",
    color: "#5fa3c4",
    desc: "Initiative en combat — remplit la jauge ATB plus vite",
    effect: (val) => ({ vitesse: 10 + val }), // 10 = vitesse de base
  },
};

export const CARAC_ORDER = ["force", "intelligence", "agilite", "vitalite", "chance", "vitesse"];

export const POINTS_PER_LEVEL = 3;
export const FREE_VITALITE_PER_LEVEL = 1;

// Calcule l'ensemble des bonus de caracs à partir d'un objet {force: 3, ...}
export function applyCaracEffects(caracsValues) {
  const out = { atkPhys: 0, atkMagie: 0, esquive: 0, critique: 0, maxHpBonus: 0, dropBonus: 0, vitesse: 10 };
  for (const key of CARAC_ORDER) {
    const val = caracsValues[key] || 0;
    const effect = CARACS[key].effect(val);
    for (const [statKey, statVal] of Object.entries(effect)) {
      if (statKey === "vitesse") out.vitesse = statVal; // vitesse ne s'additionne pas, elle EST la valeur
      else out[statKey] = (out[statKey] || 0) + statVal;
    }
  }
  return out;
}
