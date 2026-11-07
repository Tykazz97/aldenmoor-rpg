// ============================================================
// ALCHIMIE — les potions de soin, fabriquées par l'Alchimiste à l'atelier.
// Clé = id de la ressource produite (voir resources.js : source "alchimie", empilable comme n'importe quelle ressource).
// ingredients : { idRessource: quantité } pour UNE potion   gold : coût en or par potion   minLevel : niveau d'Alchimiste requis
// xp          : xp de métier par potion
// heal        : part des PV max rendue à un héros vivant      revive : part des PV max rendue à un héros tombé (élixir)
// Les herbes viennent de la récolte (ortie, sauge), le reste des monstres de la Lisière : pas de ressource de donjon.
// ============================================================
export const ALCHEMY = {
  potion_mineure: { profession: "alchimiste", minLevel: 1, ingredients: { ortie: 3 }, gold: 6, xp: 8, heal: 0.25, verb: "Distiller" },
  potion_de_soin: { profession: "alchimiste", minLevel: 8, ingredients: { ortie: 2, sauge: 2 }, gold: 25, xp: 25, heal: 0.5, verb: "Distiller" },
  grande_potion_de_soin: { profession: "alchimiste", minLevel: 16, ingredients: { sauge: 4, ectoplasme: 2, voile_spectral: 1 }, gold: 80, xp: 70, heal: 0.8, verb: "Distiller" },
  elixir_de_rappel: { profession: "alchimiste", minLevel: 24, ingredients: { sauge: 5, voile_spectral: 2, pelage_maudit: 1 }, gold: 200, xp: 160, revive: 0.4, verb: "Distiller" },
};
export const ALCHEMY_ORDER = Object.keys(ALCHEMY);
export const alchemyOf = (professionKey) =>
  ALCHEMY_ORDER.filter((id) => ALCHEMY[id].profession === professionKey).sort((a, b) => ALCHEMY[a].minLevel - ALCHEMY[b].minLevel);
