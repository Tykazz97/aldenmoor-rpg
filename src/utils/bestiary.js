// ============================================================
// BESTIAIRE — logique pure (pas de React) : classement des monstres, taux de drop personnalisés, texte des sorts.
// Le calcul du drop reproduit exactement celui du combat (combat/engine.js, rollRewards).
// ============================================================
import { ENEMIES, ZONES } from "../data/zones.js";
import { MINIBOSS_HP_SCALE } from "../combat/engine.js";
import { DUNGEONS } from "../data/dungeons.js";
import { PARTY_DROP_MULT } from "../combat/engine.js";

export const GROUP_SIZES = [1, 2, 3];

// Multiplicateur total appliqué aux drops ordinaires : bonus de butin du joueur × bonus de groupe
export function dropMultiplier(dropBonus = 0, groupSize = 1) {
  const group = PARTY_DROP_MULT[groupSize] ?? PARTY_DROP_MULT[3];
  return (1 + (dropBonus || 0) / 100) * group;
}

// Chance réelle d'un drop pour ce joueur, dans ce groupe. Un drop « fixed » n'est jamais modifié ; le tout est plafonné à 100 %.
// { base, rate, boosted, fixed, capped }  (base et rate sont des fractions entre 0 et 1)
export function dropRate(drop, dropBonus = 0, groupSize = 1) {
  const base = drop.chance;
  const rate = Math.min(1, drop.fixed ? base : base * dropMultiplier(dropBonus, groupSize));
  return { base, rate, fixed: !!drop.fixed, boosted: rate > base + 1e-9, capped: !drop.fixed && base * dropMultiplier(dropBonus, groupSize) > 1 && rate >= 1 };
}

// Un butin réservé à une classe n'est affiché comme possible que pour cette classe
export function dropVisibleFor(drop, classKey) {
  return !drop.forClass || drop.forClass === classKey;
}

// Quantité moyenne attendue par combat : chance × (min+max)/2
export function expectedQty(drop, dropBonus = 0, groupSize = 1) {
  return dropRate(drop, dropBonus, groupSize).rate * (drop.min + drop.max) / 2;
}

export const pct = (x) => {
  const v = x * 100;
  if (v >= 99.995) return "100 %";
  if (v >= 10) return `${Math.round(v * 10) / 10} %`.replace(".", ",");
  if (v >= 1) return `${Math.round(v * 100) / 100} %`.replace(".", ",");
  return `${Math.round(v * 1000) / 1000} %`.replace(".", ",");
};

const ELEMENTS = { feu: "Feu", poison: "Poison", givre: "Givre" };
const pctInt = (v) => `${Math.round(v * 100)} %`;

// Texte lisible de l'effet d'un sort ennemi
export function effectText(effect, type = "phys") {
  if (!effect) return null;
  const el = ELEMENTS[effect.element] || null;
  switch (effect.kind) {
    case "defDown": return `Réduit ta défense de ${pctInt(effect.value)} pendant ${effect.turns} tours`;
    case "weaken": return `${el ? `${el} : ` : ""}réduit tes dégâts de ${pctInt(effect.value)} pendant ${effect.turns} tours`;
    case "dot": {
      const verb = effect.element === "feu" ? "Brûle" : effect.element === "poison" ? "Empoisonne" : "Inflige des dégâts";
      return `${verb} pendant ${effect.turns} tours (${pctInt(effect.ratio)} de son attaque par tour)`;
    }
    case "paLoss": return `Te retire ${effect.value} PA au prochain tour`;
    default: return null;
  }
}

// Sorts d'un monstre, prêts à afficher. needsPhase : le sort n'est utilisé qu'à partir d'une phase donnée du combat.
// Points de vie d'un monstre selon la taille du groupe de héros (1, 2 ou 3) : seuls les mini-boss en gagnent (voir MINIBOSS_HP_SCALE du moteur)
export function hpFor(enemy, group = 1) {
  return Math.round(enemy.stats.hp * (enemy.miniBoss ? (MINIBOSS_HP_SCALE[group] ?? 1) : 1));
}

export function spellsOf(enemy) {
  return (enemy.actions || []).map((a) => ({
    id: a.id, name: a.name, pa: a.pa, type: a.type, power: a.power, weight: a.weight, aoe: !!a.aoe,
    text: effectText(a.effect, a.type), element: a.effect?.element || null,
    // sort réservé à la seconde phase : seuil de PV (en %) sous lequel le monstre commence à l'utiliser
    belowHp: a.needsPhase != null && enemy.phases?.[a.needsPhase] ? Math.round(enemy.phases[a.needsPhase].below * 100) : null,
  }));
}

// Probabilité d'utiliser chaque sort : { id: { first, second } }. « first » = part du sort dans la première phase (les sorts de seconde phase en sont exclus),
// « second » = part une fois la seconde phase entamée (tous les sorts sont alors disponibles). Poids relatifs, sans tenir compte des PA restants.
export function spellFrequencies(enemy) {
  const list = enemy.actions || [];
  const w = (a) => a.weight || 1;
  const open = list.filter((a) => a.needsPhase == null);
  const totalAll = list.reduce((s, a) => s + w(a), 0) || 1;
  const totalOpen = open.reduce((s, a) => s + w(a), 0) || 1;
  return Object.fromEntries(list.map((a) => [a.id, { first: a.needsPhase == null ? w(a) / totalOpen : 0, second: w(a) / totalAll }]));
}

// Phases du combat : { below (%), lines[], announce }. Une phase peut renforcer ses attaques et/ou appeler des renforts.
export function phasesOf(enemy) {
  return (enemy.phases || []).map((ph) => {
    const lines = [];
    if (ph.atkMult) lines.push(`ses attaques sont multipliées par ×${String(ph.atkMult).replace(".", ",")}`);
    if (ph.summon?.length) {
      const names = ph.summon.map((k) => ENEMIES[k]?.name).filter(Boolean);
      const counts = names.reduce((m, n) => ({ ...m, [n]: (m[n] || 0) + 1 }), {});
      lines.push(`il appelle ${Object.entries(counts).map(([n, c]) => (c > 1 ? `${c} × ${n}` : n)).join(", ")} en renfort`);
    }
    if (enemy.actions?.some((a) => a.needsPhase != null && enemy.phases[a.needsPhase] === ph)) lines.push("il débloque de nouveaux sorts");
    return { below: Math.round(ph.below * 100), lines, announce: ph.announce };
  });
}

const entry = (key, role) => ({ key, role, enemy: ENEMIES[key] });

// Sections du bestiaire : régions du monde, puis donjon (normal et difficile)
export function bestiarySections() {
  const sections = [];
  for (const r of ZONES.aldenmoor.regions) {
    sections.push({
      id: r.key, name: r.name, hint: "Région",
      entries: [...r.enemies.map((k) => entry(k, "monstre")), entry(r.miniBoss, "miniboss")],
    });
  }
  const dj = DUNGEONS.manoir_englouti;
  const roomKeys = [...new Set(dj.rooms.flatMap((room) => room.enemies))];
  const boss = ZONES.aldenmoor.dungeon.boss;
  const normal = roomKeys.filter((k) => k !== boss).map((k) => entry(k, "monstre")).concat(entry(boss, "boss"));
  sections.push({ id: "manoir", name: dj.name, hint: "Donjon", entries: normal });
  const hard = normal.map((e) => entry(e.key + "_difficile", e.role));
  sections.push({ id: "manoir_difficile", name: `${dj.name} — difficile`, hint: "Donjon", entries: hard });
  return sections;
}

export const ROLE_LABEL = { monstre: "Monstre", miniboss: "Mini-boss", boss: "Boss" };

// Recherche : le nom du monstre OU d'un de ses butins correspond
export function matchesSearch(enemy, query, nameOfDrop) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  if (enemy.name.toLowerCase().includes(q)) return true;
  return (enemy.drops || []).some((d) => (nameOfDrop(d) || "").toLowerCase().includes(q));
}
