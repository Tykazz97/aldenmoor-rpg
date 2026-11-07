// ============================================================
// Économie du jeu : combien rapporte une activité ? (sans React)
// Sert au script `node scripts/simulate-economy.js` et au test qui impose la règle ci-dessous
// à toute nouvelle région : on équilibre ici, avant de jouer.
//
// RÈGLE : dans le revenu moyen d'un combat (or + valeur de revente des drops), l'or pur représente
// entre 25 % et 55 %. Ni un combat qui ne donne que des ressources, ni un combat qui noie le joueur
// sous l'or : l'or sert à fabriquer et à agrandir le coffre, les ressources à fabriquer et à vendre.
// ============================================================
import { ENEMIES } from "../data/zones.js";
import { ENCOUNTERS } from "../data/encounters.js";
import { NODES, NODE_ORDER } from "../data/gathering.js";
import { RESOURCES } from "../data/resources.js";
import { RECIPES } from "../data/recipes.js";
import { ITEMS } from "../data/items.js";
import { itemSellPrice } from "./market.js";

export const GOLD_SHARE_MIN = 0.25, GOLD_SHARE_MAX = 0.55;
export const RESALE = 0.92;                    // une ressource se revend ~92 % de sa valeur (écart du marché)
const avg = (a, b) => (a + b) / 2;

// Revenu moyen d'une rencontre : { gold, drops, total, goldShare }
export function encounterIncome(enc) {
  let gold = 0, drops = 0;
  for (const k of enc.enemies) {
    const e = ENEMIES[k];
    if (e.gold) gold += avg(e.gold[0], e.gold[1]);
    for (const d of e.drops || []) {
      const qty = d.chance * avg(d.min ?? 1, d.max ?? 1);
      drops += d.type === "resource" ? qty * RESOURCES[d.id].value * RESALE : qty * itemSellPrice(d.id);
    }
  }
  return { gold, drops, total: gold + drops, goldShare: gold + drops ? gold / (gold + drops) : 0 };
}
export const allEncounterIncomes = () => ENCOUNTERS.map((enc) => ({ enc, ...encounterIncome(enc) }));

// Revenu moyen d'une récolte, en or (valeur de revente de ce qu'on récolte)
export const nodeIncome = (node) => avg(node.yield[0], node.yield[1]) * RESOURCES[node.resource].value * RESALE;
export const allNodeIncomes = () => NODE_ORDER.map((id) => ({ node: NODES[id], income: nodeIncome(NODES[id]) }));

// Coût de fabrication d'un ensemble (pièces d'un même set) : or de fabrication + valeur des ingrédients
export function setCosts() {
  const sets = {};
  for (const [id, rc] of Object.entries(RECIPES)) {
    const key = ITEMS[id].set || "armes";
    const s = (sets[key] ||= { pieces: 0, craftGold: 0, resources: 0 });
    s.pieces++; s.craftGold += rc.gold;
    s.resources += Object.entries(rc.ingredients).reduce((t, [r, q]) => t + RESOURCES[r].value * q, 0);
  }
  for (const s of Object.values(sets)) s.total = s.craftGold + s.resources;
  return sets;
}
