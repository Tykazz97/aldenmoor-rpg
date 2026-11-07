// ============================================================
// Création d'un personnage (sans React) : classe + corps + nom.
// ============================================================
import { ITEMS, ITEM_ORDER } from "../data/items.js";
import { CLASSES } from "../data/classes.js";
import { PROFESSION_ORDER } from "../data/professions.js";
import { emptyProfessions } from "./crafting.js";
import { emptyBank } from "./bank.js";

export const EMPTY_EQUIPPED = {
  chapeau: null, cape: null, plastron: null, amulette: null,
  gants: null, ceinture: null, anneau: null, jambieres: null,
  arme: null, bouclier: null,
  relique1: null, relique2: null, relique3: null, relique4: null,
};

// Mode test : tous les objets du jeu dans le sac
const testInventory = () => ITEM_ORDER.map((id, i) => ({ ...ITEMS[id], uid: `test-${i}` }));

export function createPlayer({ name, classKey, gender = "m", testMode = false }) {
  const cls = CLASSES[classKey];
  if (!cls) throw new Error(`Classe inconnue : ${classKey}`);
  const weapon = { ...ITEMS[cls.startWeapon], uid: "start-weapon" };
  const gear = Object.fromEntries(cls.startGear.map((id, i) => [ITEMS[id].type, { ...ITEMS[id], uid: `start-${i}` }]));
  return {
    name: (name || "").trim().slice(0, 16) || "Héros",
    classKey,
    gender: gender === "f" ? "f" : "m",
    appearance: null,                 // null = suit l'équipement, sinon une tenue choisie (cosmétique)
    level: 1,
    xp: 0,
    baseHp: 100,
    hp: 100,
    caracPoints: 0,
    caracs: { force: 0, intelligence: 0, agilite: 0, vitalite: 0, chance: 0, vitesse: 0, ...cls.startCaracs },
    equipped: { ...EMPTY_EQUIPPED, ...gear, arme: weapon },
    inventory: testMode ? testInventory() : [],
    gold: 0,
    resources: {},
    bank: emptyBank(),
    professions: emptyProfessions(PROFESSION_ORDER),
  };
}
