// Garde-fous de l'économie :  node scripts/test-economy.js   (bilan détaillé : node scripts/simulate-economy.js)
import assert from "node:assert/strict";
import { allEncounterIncomes, allNodeIncomes, setCosts, GOLD_SHARE_MIN, GOLD_SHARE_MAX } from "../src/utils/economy.js";
import { ZONES } from "../src/data/zones.js";
import { BANK_UPGRADES } from "../src/utils/bank.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Économie");

test("règle de l'or : dans chaque combat, l'or pur fait 25 à 55 % du revenu (à respecter pour toute nouvelle région)", () => {
  for (const r of allEncounterIncomes()) assert.ok(r.goldShare >= GOLD_SHARE_MIN && r.goldShare <= GOLD_SHARE_MAX, `${r.enc.id} : ${(r.goldShare * 100).toFixed(0)} %`);
});

test("un boss rapporte nettement plus qu'un combat normal de sa région, mais pas plus de 6 fois", () => {
  const rows = allEncounterIncomes();
  for (const region of ZONES.aldenmoor.regions) {
    const mine = new Set([...region.enemies, region.miniBoss]);
    const inRegion = rows.filter((r) => r.enc.enemies.every((k) => mine.has(k)));
    const normal = inRegion.filter((r) => !r.enc.boss), bosses = inRegion.filter((r) => r.enc.boss);
    const top = Math.max(...normal.map((r) => r.total));
    for (const b of bosses) assert.ok(b.total > top * 1.5 && b.total < top * 6, `${b.enc.id} : ${b.total.toFixed(0)} vs ${top.toFixed(0)}`);
  }
});

test("récolter rapporte de l'or, et les nœuds de niveau supérieur rapportent plus que ceux du niveau 1 de leur métier", () => {
  const rows = allNodeIncomes();
  for (const r of rows) assert.ok(r.income > 0, r.node.id);
  for (const prof of new Set(rows.map((r) => r.node.profession))) {
    const mine = rows.filter((r) => r.node.profession === prof).sort((a, b) => a.node.minLevel - b.node.minLevel);
    for (let i = 1; i < mine.length; i++) assert.ok(mine[i].income > mine[i - 1].income, `${prof}`);
  }
});

test("la fabrication a un coût en or réel (sinon l'or ne servirait à rien) et les ingrédients valent plus que l'or de fabrication", () => {
  const sets = setCosts();
  for (const [k, s] of Object.entries(sets)) assert.ok(s.craftGold > 0 && s.resources > s.craftGold, k);
});

test("agrandissements du coffre : chers par rapport aux revenus d'un combat, mais le premier reste accessible rapidement", () => {
  const normal = allEncounterIncomes().filter((r) => !r.enc.boss), perFight = normal.reduce((s, r) => s + r.total, 0) / normal.length;
  assert.ok(BANK_UPGRADES[0] / perFight <= 4, "le premier agrandissement doit coûter au plus ~4 combats");
  assert.ok(BANK_UPGRADES.at(-1) / perFight >= 100, "le dernier doit rester un vrai objectif long terme");
});

console.log(`\n${n} tests passent.`);
