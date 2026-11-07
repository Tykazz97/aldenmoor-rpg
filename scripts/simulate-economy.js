// Bilan de l'économie :  node scripts/simulate-economy.js
import { REFINING } from "../src/data/refining.js";
import { RESOURCES } from "../src/data/resources.js";
import { allEncounterIncomes, allNodeIncomes, setCosts, GOLD_SHARE_MIN, GOLD_SHARE_MAX } from "../src/utils/economy.js";
import { BANK_UPGRADES, BANK_START, BANK_STEP } from "../src/utils/bank.js";

const f = (n) => n.toFixed(1).padStart(6);
console.log("COMBATS : revenu moyen (or + drops revendus)");
console.log("  rencontre".padEnd(26), "     or  drops  total  part d'or");
const fights = allEncounterIncomes();
for (const r of fights) {
  const bad = r.goldShare < GOLD_SHARE_MIN || r.goldShare > GOLD_SHARE_MAX;
  console.log(`  ${r.enc.id.padEnd(24)}${f(r.gold)}${f(r.drops)}${f(r.total)}   ${(r.goldShare * 100).toFixed(0).padStart(3)} %${bad ? "  ⚠ hors règle" : ""}`);
}
console.log("\nRÉCOLTE : revenu moyen par nœud");
for (const { node, income } of allNodeIncomes()) console.log(`  ${node.id.padEnd(24)}${f(income)} or  (métier niv. ${node.minLevel})`);

console.log("\nFABRICATION : coût d'un ensemble");
for (const [k, s] of Object.entries(setCosts())) console.log(`  ${k.padEnd(12)} ${String(s.pieces).padStart(2)} pièces · or de fabrication ${String(s.craftGold).padStart(4)} · ingrédients ${String(s.resources).padStart(4)} · total ${s.total}`);

const normal = fights.filter((r) => !r.enc.boss), perFight = normal.reduce((s, r) => s + r.gold, 0) / normal.length, perFightTotal = normal.reduce((s, r) => s + r.total, 0) / normal.length;
console.log("\nRAFFINAGE : 2 matières brutes → 1 matière raffinée");
for (const [id, r] of Object.entries(REFINING)) {
  const raw = Object.entries(r.ingredients).reduce((t, [k, q]) => t + RESOURCES[k].value * q, 0);
  console.log(`  ${id.padEnd(18)} ${r.profession.padEnd(10)} niv. ${r.minLevel} · brut ${String(raw).padStart(3)} or → raffiné ${String(RESOURCES[id].value).padStart(3)} or (+${RESOURCES[id].value - raw}) − ${r.gold} or de frais`);
}
console.log(`\nCOFFRE : ${BANK_START} emplacements au départ, +${BANK_STEP} par agrandissement`);
let cum = 0;
BANK_UPGRADES.forEach((c, i) => { cum += c; console.log(`  agrandissement ${i + 1} : ${String(c).padStart(5)} or (cumulé ${String(cum).padStart(5)}) ≈ ${(c / perFightTotal).toFixed(0)} combats de revenu moyen, ${(c / perFight).toFixed(0)} en or pur`); });
