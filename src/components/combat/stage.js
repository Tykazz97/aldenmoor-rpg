// Constantes de mise en scène et petites fonctions pures du combat (sans React).
import { enemyDef } from "../../data/zones.js";

export const HERO_X = 17;       // % de la largeur de l'arène
export const HERO_B = 64;       // px depuis le bas
export const HERO_H = 250;      // hauteur d'affichage du héros (px)

export const ELEMENT_COLOR = { feu: "#ff9a4d", poison: "#8fdc5a", givre: "#8fd3f5", arcane: "#a99bff", phys: "#ffe7a8" };
export const RANGED = new Set(["tir_rapide", "tir_percant", "pluie_de_fleches"]);
export const STATUS_LABEL = { dot: { feu: "Brûlure", poison: "Poison" }, paLoss: "PA retirés", weaken: "Affaibli", defDown: "Armure brisée", parade: "Parade", shadow: "Disparition", armor: "Défense accrue", reduce: "Rempart", shield: "Bouclier", hot: "Régénération" };
export const BADGE = { feu: "🔥", poison: "☠️", weaken: "❄️", defDown: "💔", parade: "🛡️", paLoss: "🔻", shadow: "🌑", armor: "🪨", reduce: "🏰", shield: "🛡️", hot: "🌿" };

// Alliés bots : un peu en retrait du héros (le premier derrière, le second devant)
export const ALLY_POS = [{ x: 6, b: 108 }, { x: 28, b: 30 }];
export const ALLY_H = 225;       // un peu plus petits que le héros (ils sont plus loin ou à demi-cachés)
export const isHeroId = (id) => id === "player" || String(id).startsWith("ally");

// Renforts que les ennemis du combat peuvent appeler (phases avec `summon`), dans l'ordre d'apparition
export function plannedSummons(list) {
  return list.flatMap((e) => (enemyDef(e.key).phases || []).flatMap((ph) => ph.summon || []));
}

// Emplacements des renforts : devant le boss, entre lui et le héros
const SUMMON_POS = [{ x: 40, b: 78 }, { x: 53, b: 44 }];

// Un emplacement par ennemi du combat, puis un par renfort prévu
export function enemySlots(list) {
  const n = list.length;
  const xs = n === 1 ? [72] : n === 2 ? [62, 82] : [57, 72, 87];
  const bs = n === 3 ? [78, 52, 78] : n === 2 ? [66, 66] : [60];
  const base = list.map((e, i) => ({ x: xs[i], b: bs[i], h: enemyDef(e.key).spriteHeight || 200 }));
  const extra = plannedSummons(list).slice(0, SUMMON_POS.length).map((key, i) => ({ ...SUMMON_POS[i], h: enemyDef(key).spriteHeight || 200 }));
  return [...base, ...extra];
}

// Animations des sprites (Web Animations API : pas de remontage du DOM)
export const ANIMS = {
  attackR: { frames: [{ transform: "translateX(0)" }, { transform: "translateX(-14px) scale(1.02)", offset: 0.25 }, { transform: "translateX(150px)", offset: 0.5 }, { transform: "translateX(0)" }], ms: 480, easing: "cubic-bezier(.3,0,.3,1)" },
  attackL: { frames: [{ transform: "translateX(0)" }, { transform: "translateX(12px)", offset: 0.25 }, { transform: "translateX(-120px) scale(1.06)", offset: 0.5 }, { transform: "translateX(0)" }], ms: 520, easing: "cubic-bezier(.3,0,.3,1)" },
  cast: { frames: [{ transform: "translateY(0)", filter: "brightness(1)" }, { transform: "translateY(-14px) scale(1.04)", filter: "brightness(1.6) saturate(1.4)", offset: 0.4 }, { transform: "translateY(0)", filter: "brightness(1)" }], ms: 480, easing: "ease-out" },
  hurt: { frames: [{ transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(var(--kb, 12px))", filter: "brightness(2.4) sepia(1) hue-rotate(-30deg) saturate(5)", offset: 0.2 }, { transform: "translateX(calc(var(--kb, 12px) * -.4))", filter: "brightness(1.3)", offset: 0.5 }, { transform: "translateX(0)", filter: "brightness(1)" }], ms: 380, easing: "ease-out" },
  dodge: { frames: [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(var(--dg, -34px))", opacity: 0.55, offset: 0.4 }, { transform: "translateX(0)", opacity: 1 }], ms: 420, easing: "ease-out" },
  stun: { frames: [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0)" }], ms: 600, easing: "linear" },
  rage: { frames: [{ transform: "scale(1)" }, { transform: "scale(1.14)", offset: 0.3 }, { transform: "scale(1)" }], ms: 700, easing: "ease-out" },
};

export const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Découpe une liste d'évènements en "actions" jouées l'une après l'autre
export function groupEvents(events) {
  const groups = [];
  let cur = null;
  for (const e of events) {
    const starts = ["cast", "dot", "turn", "round", "playerTurn", "endTurn", "victory", "defeat"].includes(e.type);
    if (!cur || starts) { cur = []; groups.push(cur); }
    cur.push(e);
  }
  return groups;
}
