import { applyCaracEffects } from "../data/caracs.js";
import { calcSetBonuses } from "../data/items.js";

// ============================================================
// Calcule les stats finales d'un joueur = base + caracs + équipement
// Le joueur (player) a la forme :
// {
//   level, baseHp,
//   caracs: { force, intelligence, agilite, vitalite, chance, vitesse },
//   equipped: { chapeau: item|null, plastron: item|null, ... }
// }
// Chaque item d'équipement peut porter : atk_phys, atk_magie, def_phys,
// def_magie, hp, esquive, critique, dropBonus, vitesse
// ============================================================

const EQUIP_STAT_KEYS = [
  "atk_phys", "atk_magie", "def_phys", "def_magie",
  "hp", "esquive", "critique", "dropBonus", "vitesse",
];

export function calcStats(player) {
  const caracBonus = applyCaracEffects(player.caracs || {});

  // Passifs des reliques (ex. lastStand : un coup fatal laisse X% des PV, une fois par combat)
  const passives = {};
  const equip = { atk_phys: 0, atk_magie: 0, def_phys: 0, def_magie: 0, hp: 0, esquive: 0, critique: 0, dropBonus: 0, vitesse: 0 };
  const equipped = player.equipped || {};
  for (const item of Object.values(equipped)) {
    if (!item) continue;
    for (const key of EQUIP_STAT_KEYS) {
      if (item[key]) equip[key] += item[key];
    }
    for (const [k, v] of Object.entries(item.passive || {})) passives[k] = Math.max(passives[k] || 0, v);
  }

  // Bonus de set (ex: 2/5 pièces du Set Vétéran équipées)
  const setBonuses = calcSetBonuses(equipped);
  const setBonus = { def_phys: 0, def_magie: 0, atk_phys: 0, atk_magie: 0, hp: 0, esquive: 0, critique: 0 };
  for (const { bonus } of setBonuses) {
    for (const key of Object.keys(setBonus)) {
      if (bonus[key]) setBonus[key] += bonus[key];
    }
  }

  return {
    atkPhys: (caracBonus.atkPhys || 0) + equip.atk_phys + setBonus.atk_phys,
    atkMagie: (caracBonus.atkMagie || 0) + equip.atk_magie + setBonus.atk_magie,
    defPhys: equip.def_phys + setBonus.def_phys, // DEF uniquement via équipement
    defMagie: equip.def_magie + setBonus.def_magie,
    maxHp: (player.baseHp || 100) + (caracBonus.maxHpBonus || 0) + equip.hp + setBonus.hp,
    esquive: Math.min(75, (caracBonus.esquive || 0) + equip.esquive + setBonus.esquive),
    critique: Math.min(75, (caracBonus.critique || 0) + equip.critique + setBonus.critique),
    dropBonus: (caracBonus.dropBonus || 0) + equip.dropBonus,
    vitesse: (caracBonus.vitesse || 10) + equip.vitesse,
    paMax: 6 + (passives.paBonus || 0), // base fixe (+ relique de la Dame en Deuil), non modifiable par caracs pour l'instant
    passives,
    setBonuses, // exposé pour affichage (nom du set, palier atteint)
  };
}
