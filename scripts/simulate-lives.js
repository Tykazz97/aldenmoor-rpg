// Courbes de progression des joueurs simulés :  node scripts/simulate-lives.js [fresh|generated] [jours=30]
import { getPopulation } from "../src/sim/population.js";
import { ITEMS } from "../src/data/items.js";
import { gearScore, tierGear } from "../src/sim/lifeCraft.js";
import { createLives, advanceLives, regionFor, FIGHTS_PER_STEP, GATHERS_PER_STEP } from "../src/sim/lives.js";

const mode = process.argv[2] === "generated" ? "generated" : "fresh";
const DAYS = Number(process.argv[3]) || 30;
const pop = getPopulation();
const now = Date.UTC(2027, 0, 4, 12);
const world = createLives({ population: pop, mode, epoch: now, now });
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
console.log(`Simulés (${pop.length}), départ « ${mode} », ${FIGHTS_PER_STEP} combat(s) et ${GATHERS_PER_STEP} récolte(s) par pas de 10 min pour un simulé zélé\n`);
console.log("jour  niveau : min  25 %  médian  75 %  max   | région la plus fréquentée       | métier : médian  max   | or médian");
const marks = new Set([1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90].filter((d) => d <= DAYS));
let t = now;
for (let d = 1; d <= DAYS; d++) {
  t += 86400000;
  advanceLives(world, pop, t);
  if (!marks.has(d)) continue;
  const lives = Object.values(world.lives);
  const lv = lives.map((l) => l.level).sort((a, b) => a - b), pf = lives.map((l) => l.prof.level).sort((a, b) => a - b), gd = lives.map((l) => l.gold).sort((a, b) => a - b);
  const reg = {}; for (const l of lives) { const k = regionFor(l.level).key; reg[k] = (reg[k] || 0) + 1; }
  const top = Object.entries(reg).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace("_sauvages", "").replace("_calcines", "").replace("_des_ombres", "")} ${n}`).join(", ");
  const pieces = pop.map((b) => Object.keys(world.lives[b.id].gear).length), crafted = lives.map((l) => l.crafted || 0).sort((a, b) => a - b);
  const better = pop.filter((b) => Object.entries(world.lives[b.id].gear).reduce((s, [, id]) => s + gearScore(id), 0) >= Object.values(tierGear(b.classKey, world.lives[b.id].level)).reduce((s, id) => s + gearScore(id), 0) * 0.9).length;
  console.log(`      équipement : pièces portées médiane ${[...pieces].sort((a, b) => a - b)[100]}, fabriqués médiane ${q(crafted, 0.5)} max ${crafted[crafted.length - 1]}, ${better} sur ${pop.length} ont ≥ 90 % de l'équipement de leur palier`);
  console.log(`${String(d).padStart(3)}   ${[lv[0], q(lv, 0.25), q(lv, 0.5), q(lv, 0.75), lv[lv.length - 1]].map((x) => String(x).padStart(6)).join("")}   | ${top.padEnd(30)} | ${String(q(pf, 0.5)).padStart(6)} ${String(pf[pf.length - 1]).padStart(6)}   | ${q(gd, 0.5)}`);
}
