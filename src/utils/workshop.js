// ============================================================
// Annuaire des artisans (sans React) : pour chaque métier de fabrication, qui propose ses services, à quel niveau, et combien il
// demande pour une pièce de chaque palier (palier 1, 2, 3, 4 : voir data/tiers.js).
//   - Un artisan SIMULÉ y figure si son caractère l'y pousse (les acharnés « métiers » et les magnats presque tous, les occasionnels
//     rarement) et s'il a le niveau d'au moins une pièce du métier. Son tarif par palier est stable (sa marge propre autour du salaire
//     de référence). « Connecté » : il joue en ce moment ; il prend les commandes qu'on lui adresse dès qu'il est là.
//   - TOI : tu règles ton atelier métier par métier (disponible ou non, visible dans l'annuaire ou non, ton prix par pièce de chaque
//     palier). Ces réglages sont rangés dans le marché (`m.workshop[métier]`), avec ton niveau de métier du moment, pour que les
//     simulés puissent te commander une pièce. Les commandes qui te sont adressées attendent ton « Fabriquer » (24 h).
// m.workshop = { forgeron: { open, listed, prices: { 1: or, 2: or, … }, level } }
// ============================================================
import { RECIPES } from "../data/recipes.js";
import { ITEMS } from "../data/items.js";
import { getCraftInfo } from "../data/professions.js";
import { traitsOf, isActive } from "../sim/lives.js";
import { getPopulation } from "../sim/population.js";
import { orderFeeBase, simCanCraft, levelOf, hash01 } from "./orderFee.js";

export const tierOfItem = (id) => ITEMS[id]?.tier || 1;

// Pièces de chaque métier, rangées par palier : { forgeron: { 1: [ids], 2: [...] } }
const BY_PROF = {};
for (const id of Object.keys(RECIPES)) {
  const info = getCraftInfo(id);
  if (!info || !ITEMS[id]) continue;
  ((BY_PROF[info.profession] ||= {})[tierOfItem(id)] ||= []).push(id);
}
export const CRAFT_PROFESSIONS = Object.keys(BY_PROF);
export const tiersOf = (profession) => Object.keys(BY_PROF[profession] || {}).map(Number).sort((a, b) => a - b);
export const piecesOf = (profession, tier) => BY_PROF[profession]?.[tier] || [];
export const minLevelOf = (profession) => Math.min(...Object.values(BY_PROF[profession] || {}).flat().map((id) => getCraftInfo(id).minLevel));
// Prix conseillé d'une pièce d'un palier : la moyenne des salaires de référence de ses pièces
export const baseRate = (profession, tier) => { const p = piecesOf(profession, tier); return p.length ? Math.max(1, Math.round(p.reduce((n, id) => n + orderFeeBase(id), 0) / p.length)) : 0; };
export const defaultPrices = (profession) => Object.fromEntries(tiersOf(profession).map((t) => [t, baseRate(profession, t)]));

// --- artisans simulés ---
const LISTED_P = { occasionnel: 0.25, regulier: 0.45, xp: 0.5, metiers: 1, magnat: 1 };
const botsById = () => (botsById.cache ||= Object.fromEntries(getPopulation().map((b) => [b.id, b])));
export const simListed = (bot) => { const t = traitsOf(bot); return hash01(`${bot.id}:listed`) < (LISTED_P[t.focus || t.profile] ?? 0.4); };
// Son tarif pour une pièce du palier : de 80 à 120 % du prix conseillé, selon lui
export const simTarif = (botId, profession, tier) => Math.max(1, Math.round(baseRate(profession, tier) * (0.8 + 0.4 * hash01(`${botId}:tarif`))));

export const workshopOf = (m, profession) => m.workshop?.[profession] || { open: false, listed: false, prices: {}, level: 1 };

// Le tarif demandé par `crafterId` pour cette pièce, ou null s'il ne la propose pas (pas dans l'annuaire, niveau, prix non fixé)
export function tarifFor(m, crafterId, itemId) {
  const info = getCraftInfo(itemId);
  if (!info) return null;
  const tier = tierOfItem(itemId);
  if (crafterId === "player") {
    const w = workshopOf(m, info.profession);
    return w.open && w.listed && w.level >= info.minLevel && w.prices?.[tier] >= 1 ? Math.floor(w.prices[tier]) : null;
  }
  const bot = botsById()[crafterId], life = m.sims?.lives[crafterId];
  if (!bot || !life || !simListed(bot) || !simCanCraft(life, itemId)) return null;
  return simTarif(crafterId, info.profession, tier);
}

// L'annuaire d'un métier : [{ id, name, level, online, isMe, prices: { palier: or }, ready: { palier: 'all'|'some'|'none' } }], les plus hauts niveaux d'abord
export function directory(m, profession, bucket = m.bucket, nameOf = (id) => id) {
  const tiers = tiersOf(profession), out = [];
  const status = (level, tier) => { const lv = piecesOf(profession, tier).map((id) => getCraftInfo(id).minLevel); return lv.every((x) => level >= x) ? "all" : lv.some((x) => level >= x) ? "some" : "none"; };
  const w = workshopOf(m, profession);
  if (w.listed) out.push({ id: "player", name: "Toi", level: w.level, online: w.open, isMe: true, open: w.open, prices: { ...w.prices }, ready: Object.fromEntries(tiers.map((t) => [t, status(w.level, t)])) });
  if (m.sims) {
    for (const b of getPopulation()) {
      const life = m.sims.lives[b.id];
      if (!life || !simListed(b)) continue;
      const level = levelOf(life, profession);
      if (level < minLevelOf(profession)) continue;
      out.push({ id: b.id, name: nameOf(b.id), level, online: isActive(b, bucket) && !(m.sims.busy?.[b.id] >= bucket), isMe: false, open: true,
        prices: Object.fromEntries(tiers.map((t) => [t, simTarif(b.id, profession, t)])), ready: Object.fromEntries(tiers.map((t) => [t, status(level, t)])) });
    }
  }
  return out.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

// Range tes réglages d'atelier pour un métier (renvoie le marché modifié) ; `level` = ton niveau de métier du moment
export function withWorkshop(m, profession, patch, level) {
  const cur = workshopOf(m, profession), prices = { ...cur.prices };
  for (const [t, v] of Object.entries(patch.prices || {})) { const x = Math.floor(Number(v)); if (x >= 1 && x <= 1_000_000) prices[t] = x; else delete prices[t]; }
  const next = { open: patch.open ?? cur.open, listed: patch.listed ?? cur.listed, prices, level: level ?? cur.level };
  return { ...m, workshop: { ...(m.workshop || {}), [profession]: next } };
}
