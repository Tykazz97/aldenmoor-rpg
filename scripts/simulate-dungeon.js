// Équilibrage du Manoir Englouti : un groupe de trois héros (un par classe) enchaîne les 4 salles sans soin.
// Usage : node scripts/simulate-dungeon.js [niveau=22] [palier=3|4] [essais=40] [potions=0|1|2|3]
// Avec potions, le groupe boit entre les salles comme un joueur : 1 = sac plein (6 de chaque + 2 élixirs), 2 = 3 potions de soin + 2 grandes, 3 = 2 potions de soin + 1 grande.
import { DUNGEONS } from "../src/data/dungeons.js";
import { ITEMS } from "../src/data/items.js";
import { makeBotPlayer, botSpec, BUILDS } from "../src/sim/partyBots.js";
import { autoDungeon } from "../src/sim/botFight.js";

const level = Number(process.argv[2] || 22), tier = Number(process.argv[3] || 3), N = Number(process.argv[4] || 40);
const KITS = { 1: { potion_mineure: 6, potion_de_soin: 6, grande_potion_de_soin: 6, elixir_de_rappel: 2 }, 2: { potion_de_soin: 3, grande_potion_de_soin: 2 }, 3: { potion_de_soin: 2, grande_potion_de_soin: 1 } };
const KIT = KITS[process.argv[5]] || null;
const SETS4 = { guerrier: { weapon: "epee_garde_noye", set: "garde_noye", shield: "bouclier_garde_noye" }, assassin: { weapon: "dague_veneur", set: "veneur" }, magicien: { weapon: "baton_veuve", set: "veuve" } };

import { SETS } from "../src/data/items.js";
function gearOf(classKey) {
  const t = tier === 4 ? SETS4[classKey] : BUILDS[classKey].tiers[2];
  const ids = [t.weapon, ...SETS[t.set].pieces, ...(t.shield ? [t.shield] : [])];
  return Object.fromEntries(ids.map((id) => [ITEMS[id].type, id]));
}
const dj = DUNGEONS.manoir_englouti;
const classes = Object.keys(BUILDS);
console.log(`Manoir Englouti — niveau ${level}, équipement palier ${tier}, ${N} essais par composition${KIT ? ", avec potions" : ", sans potion"}`);
for (const lead of classes) {
  const others = classes.filter((c) => c !== lead);
  const player = makeBotPlayer(lead, level, gearOf(lead));
  const allies = others.map((c) => botSpec(c, level, { gear: gearOf(c) }));
  const reached = [0, 0, 0, 0, 0]; let clears = 0, relics = 0; const drunk = {};
  for (let seed = 1; seed <= N; seed++) {
    const r = autoDungeon(player, allies, dj.rooms, seed, KIT);
    for (const [id, q] of Object.entries(r.used || {})) drunk[id] = (drunk[id] || 0) + q;
    reached[r.rooms]++; if (r.cleared) clears++;
    relics += r.rewards.items.filter((i) => i === "medaillon_dame_en_deuil").length;
  }
  const row = reached.map((n, i) => `${i === 4 ? "fini" : "mort salle " + (i + 1)}: ${Math.round((100 * n) / N)} %`).join("  ");
  const pots = Object.entries(drunk).map(([id, q]) => `${id} ${(q / N).toFixed(1)}`).join(", ");
  console.log(`  joueur ${lead.padEnd(9)} + ${others.join("/")}  →  ${row}${KIT ? `   [bu par essai : ${pots || "rien"}]` : ""}`);
}
