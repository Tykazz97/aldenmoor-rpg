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
