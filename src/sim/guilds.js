// ============================================================
// Les guildes des joueurs simulés. Sans React, déterministe : tout se rejoue à partir de l'heure (un pas = 10 minutes, comme la vie
// des simulés et le marché). Les guildes elles-mêmes vivent dans `sims.guilds` (règles : utils/guildCore.js).
//
// Comme de vrais joueurs :
//   - un simulé assez riche (13 000 or et plus, niveau 10 minimum) fonde une guilde (10 000 or) ; son nom est inventé ;
//   - les autres rejoignent une guilde qui a de la place (plus ou moins vite selon leur caractère) et en partent rarement ;
//   - toute l'activité des membres (monstres vaincus, ressources récoltées, objets fabriqués) fait avancer les quêtes de la guilde ;
//   - ils donnent une part de leur or au-delà de 3 000 à la caisse ;
//   - le chef (simulé) dépense la caisse : le palier de bonus quand il peut, sinon un onglet de coffre ;
//   - les bonus des paliers s'appliquent à chaque membre (`life.gb`, lu par lives.js et lifeCraft.js).
// ============================================================
import { hashString, makeRng } from "./rng.js";
import {
  newGuilds, activityOf, addProgress, addContribution, createGuild, addMember, removeMember, makeGuildName, isFull, memberCount,
  palierProblem, tabProblem, buyPalier, buyTab, nextTab, guildFor, rankOf, setRank,
} from "../utils/guildCore.js";
import { bonusFromPaliers } from "../utils/guildBonus.js";
import { rebuildSent, placeProblem, placeSentinel, collectStock, sentinelsOf } from "../utils/sentinel.js";
import { SENT_REGIONS } from "../data/sentinel.js";
import { autoAlloc } from "../utils/sentinelBuild.js";
import { GUILD_CREATE_COST, SIM_FOUND_GOLD, SIM_FOUND_MIN_LEVEL, SIM_DONATE_ABOVE, SIM_DONATE_SHARE, QUEST_TYPES } from "../data/guild.js";

export const HOUR_STEPS = 6;                              // les décisions sociales se prennent une fois par heure
export const SIM_JOIN_MIN_LEVEL = 5;
export const JOIN_P_BASE = 0.002, JOIN_P_SOCIAL = 0.010;  // par heure : de ~5 %/jour (réservé) à ~25 %/jour (sociable)
export const LEAVE_P = 0.0003;                            // par heure et par membre : environ 0,7 % par jour
export const FOUND_P = 0.05;                              // par heure, quand il en a les moyens
export const DONATE_P = 0.2;                              // par heure : il donne de temps en temps, pas à chaque heure

const h01 = (s) => hashString(s) / 4294967296;
export const socialOf = (id) => h01(`${id}:social`);

const setBonus = (life, g) => { if (life.gbn !== g.pal) { life.gb = bonusFromPaliers(g.pal); life.gbn = g.pal; } };
const clearBonus = (life) => { if (life) { delete life.gb; delete life.gbn; } };

// L'activité des membres simulés depuis leur dernière lecture fait avancer les quêtes ; les bonus à jour
function syncGuild(g, lives, step) {
  for (const [id, m] of Object.entries(g.members)) {
    if (id === "player") continue;
    const life = lives[id];
    if (!life) continue;
    setBonus(life, g);
    if (life.played === m.pl) continue;                   // n'a pas joué depuis
    const a = activityOf(life.quests);
    const dk = Math.max(0, a.k - m.k), dg = Math.max(0, a.g - m.g), dc = Math.max(0, a.c - m.c);
    m.k = a.k; m.g = a.g; m.c = a.c; m.pl = life.played;
    if (dk) { addProgress(g, step, "kills", dk); addContribution(g, id, dk * QUEST_TYPES.kills.xpPer); }
    if (dg) { addProgress(g, step, "gathers", dg); addContribution(g, id, dg * QUEST_TYPES.gathers.xpPer); }
    if (dc) { addProgress(g, step, "crafts", dc); addContribution(g, id, dc * QUEST_TYPES.crafts.xpPer); }
  }
}

// Un don d'or à la caisse (compte pour la quête de dons)
export function donate(g, step, id, amount) {
  g.gold += amount;
  addProgress(g, step, "gold", amount);
  addContribution(g, id, amount * QUEST_TYPES.gold.xpPer);
}

// Le chef simulé nomme son bras droit (le plus actif) et un officier pour 8 membres, parmi les plus actifs. Il ne touche pas au rang du joueur.
export const OFFICER_PER = 8, DEPUTY_MIN_MEMBERS = 6;
export function appointRanks(g, step) {
  const size = memberCount(g);
  if (size < DEPUTY_MIN_MEMBERS) return;
  const pool = Object.entries(g.members).filter(([id, m]) => id !== g.leader && id !== "player" && m.n > 0).sort((a, b) => b[1].n - a[1].n || a[1].j - b[1].j || (a[0] < b[0] ? -1 : 1));
  if (!g.deputy && pool.length) { const top = pool.find(([id]) => rankOf(g, id) === "recrue" || rankOf(g, id) === "officier"); if (top) setRank(g, top[0], "bras", step); }
  let officers = Object.keys(g.members).filter((id) => rankOf(g, id) === "officier").length;
  const want = Math.floor(size / OFFICER_PER);
  for (const [id] of pool) { if (officers >= want) break; if (rankOf(g, id) === "recrue") { setRank(g, id, "officier", step); officers++; } }
}

export function stepGuilds(sims, population, step) {
  const G = sims.guilds && typeof sims.guilds.byId === "object" && typeof sims.guilds.of === "object" ? sims.guilds : (sims.guilds = newGuilds());   // sauvegarde abîmée : on repart de zéro
  const lives = sims.lives;
  if (step % HOUR_STEPS === 0) rebuildSent(G);                   // l'annuaire des sentinelles est remis d'aplomb à chaque heure
  for (const g of Object.values(G.byId)) syncGuild(g, lives, step);
  if (step % HOUR_STEPS !== 0) return;

  // dons, puis dépenses du chef
  for (const g of Object.values(G.byId)) {
    for (const id of Object.keys(g.members)) {
      if (id === "player") continue;
      const life = lives[id];
      if (!life || life.gold <= SIM_DONATE_ABOVE || h01(`${id}:don:${step}`) >= DONATE_P) continue;
      const amount = Math.floor((life.gold - SIM_DONATE_ABOVE) * SIM_DONATE_SHARE);
      if (amount >= 1) { life.gold -= amount; donate(g, step, id, amount); }
    }
    if (g.leader !== "player") {
      appointRanks(g, step);
      const pp = palierProblem(g);
      if (!pp) buyPalier(g, step);
      else if (pp !== "caisse" && !tabProblem(g) && g.gold >= nextTab(g).cost * 1.2) buyTab(g, step);
      autoAlloc(g);                                                                                     // il place les points de sa sentinelle à sa façon
      for (const key of Object.keys(sentinelsOf(g))) collectStock(g, key, step);                       // le chef relève ses sentinelles
      if (pp) for (const r of [...SENT_REGIONS].reverse()) if (g.gold >= r.cost * 1.5 && !placeProblem(G, g, r.key)) { placeSentinel(G, g, r.key, step); break; }   // et en pose une quand il peut
    }
  }

  // fondation, arrivées et départs
  for (const bot of population) {
    const life = lives[bot.id];
    if (!life) continue;
    const id = bot.id, g = guildFor(G, id);
    if (g) {
      if (g.leader !== id && h01(`${id}:leave:${step}`) < LEAVE_P) { removeMember(G, g, id, step); clearBonus(life); }
      continue;
    }
    if (life.gold >= SIM_FOUND_GOLD && life.level >= SIM_FOUND_MIN_LEVEL && h01(`${id}:found:${step}`) < FOUND_P) {
      life.gold -= GUILD_CREATE_COST;
      createGuild(G, { founder: id, name: makeGuildName(G, `${id}:${G.seq}`), step, act: activityOf(life.quests), pl: life.played });
      continue;
    }
    if (life.level >= SIM_JOIN_MIN_LEVEL && h01(`${id}:join:${step}`) < JOIN_P_BASE + JOIN_P_SOCIAL * socialOf(id)) {
      const open = Object.values(G.byId).filter((x) => !isFull(x) && life.level >= (x.minLevel || 0));
      if (!open.length) continue;
      const pick = makeRng(hashString(`gj:${id}:${step}`)).weighted(open.map((x) => [x, memberCount(x) + 3]));
      addMember(G, pick, id, step, activityOf(life.quests), life.played);
    }
  }
}
