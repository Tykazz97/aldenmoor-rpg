// ============================================================
// Bonus de guilde : ce que les paliers débloqués apportent à un membre (sans React, sans dépendance lourde).
// Les valeurs sont en points de pourcentage : { xp: 4 } = +4 % d'xp de personnage.
// ============================================================
import { PALIERS, BONUS_KEYS } from "../data/guild.js";

export const NO_BONUS = Object.freeze({ xp: 0, mxp: 0, drop: 0, harv: 0, refine: 0, craft: 0 });
const CACHE = [NO_BONUS];

// Bonus cumulés des `n` premiers paliers
export function bonusFromPaliers(n = 0) {
  const k = Math.max(0, Math.min(PALIERS.length, Math.floor(n) || 0));
  if (CACHE[k]) return CACHE[k];
  const out = { ...NO_BONUS };
  for (const p of PALIERS.slice(0, k)) for (const [key, v] of Object.entries(p.bonus)) out[key] += v;
  return (CACHE[k] = Object.freeze(out));
}

// La guilde du joueur dans le monde des simulés (null sans guilde)
export function guildOfPlayer(player) {
  const G = player?.market?.sims?.guilds;
  const gid = G?.of?.player;
  return (gid && G.byId?.[gid]) || null;
}

export function guildBonusOf(player) {
  if (player?.gb) return player.gb;                      // joueur « de papier » d'un simulé (voir sim/lifeCraft.js)
  const g = guildOfPlayer(player);
  return g ? bonusFromPaliers(g.pal) : NO_BONUS;
}

// Tirage d'un entier à partir d'une valeur fractionnaire, sans biais : 2,4 → 2 (60 %) ou 3 (40 %)
export const roundRandom = (x, rng = Math.random) => Math.floor(x + rng());

// Quantité après un bonus de pourcentage (récolte, xp de métier...) : l'arrondi est tiré au hasard pour que +3 % compte même sur 4 unités
export const withBonus = (amount, pct, rng = Math.random) => (pct > 0 ? roundRandom(amount * (1 + pct / 100), rng) : amount);

export const hasBonus = (b) => !!b && BONUS_KEYS.some((k) => b[k] > 0);
