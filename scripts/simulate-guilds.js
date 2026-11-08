// Équilibrage des guildes : fait vivre le marché et les simulés (départ « fresh » par défaut) et affiche l'état des guildes.
//   node scripts/simulate-guilds.js [fresh|generated] [jours=60]
import { enableSimMarket, newMarket, tickMarket } from "../src/utils/market.js";
import { SIM_START } from "../src/sim/config.js";
import { GUILD_MAX_MEMBERS, PALIERS } from "../src/data/guild.js";

const mode = process.argv[2] === "generated" ? "generated" : "fresh";
const DAYS = Number(process.argv[3]) || 60;
const T0 = Date.UTC(2027, 0, 4, 12);
SIM_START.mode = mode; SIM_START.epoch = mode === "fresh" ? T0 : 1;
enableSimMarket(true);
let m = newMarket(T0);
const T = (d) => T0 + d * 86400000;
const report = (day) => {
  const w = m.sims, lives = Object.values(w.lives);
  const rich = lives.filter((l) => l.gold >= 13000).length, gs = Object.values(w.guilds?.byId || {});
  const inG = Object.keys(w.guilds?.of || {}).length;
  const gold = lives.map((l) => l.gold).sort((a, b) => a - b);
  console.log(`\n== jour ${day} : ${gs.length} guilde(s), ${inG} membres/${lives.length} simulés ; or des simulés : médian ${gold[250]}, p90 ${gold[450]}, max ${gold[499]} ; riches (>=13000) : ${rich}`);
  for (const g of gs.sort((a, b) => b.level - a.level).slice(0, 8)) {
    console.log(`  ${g.name.padEnd(28)} niv ${String(g.level).padStart(2)} (${g.xp} xp)  membres ${String(Object.keys(g.members).length).padStart(2)}  caisse ${String(g.gold).padStart(7)}  paliers ${g.pal}/${PALIERS.length}  onglets ${g.tabs}  quêtes ${g.quests.map((q) => `${q.type}:${q.got}/${q.goal}`).join(" ")}`);
  }
};
const marks = new Set([1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180].filter((d) => d <= DAYS));
const t0 = Date.now();
for (let d = 1; d <= DAYS; d++) { m = tickMarket(m, T(d)); if (marks.has(d)) report(d); }
console.log(`\n${DAYS} jours simulés en ${((Date.now() - t0) / 1000).toFixed(1)} s (${GUILD_MAX_MEMBERS} membres max)`);
