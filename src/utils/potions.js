// ============================================================
// Usage des potions (sans React) : entre deux salles d'un donjon, à volonté et sans payer (la potion bue est consommée du sac).
// Un héros est { hp, maxHp }. Une potion de soin rend une part des PV max à un héros vivant et blessé ; l'élixir de rappel relève un héros tombé.
// ============================================================
import { ALCHEMY, ALCHEMY_ORDER } from "../data/alchemy.js";

export const POTION_IDS = ALCHEMY_ORDER;
export const potionCount = (player, id) => player.resources?.[id] || 0;

// PV du héros après avoir bu la potion, ou null si elle ne servirait à rien (ou n'existe pas)
export function potionResult(hero, potionId) {
  const rec = ALCHEMY[potionId];
  if (!rec || !(hero.maxHp > 0)) return null;
  const down = hero.hp <= 0;
  if (rec.revive) return down ? Math.min(hero.maxHp, Math.ceil(hero.maxHp * rec.revive)) : null;
  if (down || hero.hp >= hero.maxHp) return null;
  return Math.min(hero.maxHp, hero.hp + Math.ceil(hero.maxHp * rec.heal));
}
export const canDrink = (player, hero, potionId) => potionCount(player, potionId) > 0 && potionResult(hero, potionId) !== null;

// Retire UNE potion du sac (le même joueur s'il n'en a pas)
export function consumePotion(player, potionId) {
  if (!ALCHEMY[potionId] || potionCount(player, potionId) < 1) return player;
  const resources = { ...player.resources, [potionId]: player.resources[potionId] - 1 };
  if (resources[potionId] <= 0) delete resources[potionId];
  return { ...player, resources };
}

// Boit une potion pour le héros n° `index` du groupe (liste de { hp, maxHp }). Renvoie { player, party } ; rien ne change si c'est inutile.
export function drinkPotion(player, party, index, potionId) {
  const hero = party[index];
  if (!hero || !canDrink(player, hero, potionId)) return { player, party, drunk: false };
  return {
    player: consumePotion(player, potionId),
    party: party.map((h, i) => (i === index ? { ...h, hp: potionResult(h, potionId) } : h)),
    drunk: true,
  };
}

// Un joueur simulé (ou un groupe qui joue seul) boit entre deux salles : un tombé d'abord (élixir), puis le plus blessé tant qu'il est sous
// `threshold` de ses PV, avec la plus petite potion qui comble son manque (sinon la plus grande). `party` : [{ hp, maxHp }] ; `stock` : { potion: n }.
// Renvoie { party, used } sans rien modifier.
export function autoDrink(party, stock, { threshold = 0.7, maxDrinks = 12 } = {}) {
  const hp = party.map((h) => ({ ...h })), used = {};
  const have = (id) => (stock[id] || 0) - (used[id] || 0);
  const heals = ALCHEMY_ORDER.filter((id) => ALCHEMY[id].heal).sort((a, b) => ALCHEMY[a].heal - ALCHEMY[b].heal);
  for (let n = 0; n < maxDrinks; n++) {
    const fallen = hp.findIndex((h) => h.hp <= 0);
    if (fallen >= 0 && have("elixir_de_rappel") > 0) { hp[fallen].hp = potionResult(hp[fallen], "elixir_de_rappel"); used.elixir_de_rappel = (used.elixir_de_rappel || 0) + 1; continue; }
    let idx = -1, worst = threshold;
    hp.forEach((h, i) => { if (h.hp > 0 && h.hp / h.maxHp < worst) { worst = h.hp / h.maxHp; idx = i; } });
    if (idx < 0) break;
    const h = hp[idx], deficit = h.maxHp - h.hp, own = heals.filter((id) => have(id) > 0);
    if (!own.length) break;
    const pick = own.find((id) => Math.ceil(h.maxHp * ALCHEMY[id].heal) >= deficit) || own[own.length - 1];
    h.hp = potionResult(h, pick); used[pick] = (used[pick] || 0) + 1;
  }
  return { party: hp, used };
}
