// ============================================================
// Création d'un personnage (sans React) : classe + corps + nom.
// ============================================================
import { grandfatherBag } from "./bag.js";
import { ITEMS, ITEM_ORDER } from "../data/items.js";
import { CLASSES } from "../data/classes.js";
import { PROFESSION_ORDER } from "../data/professions.js";
import { emptyProfessions } from "./crafting.js";
import { emptyBank } from "./bank.js";
import { gainXp, xpToNext, MAX_LEVEL } from "./progression.js";

export const EMPTY_EQUIPPED = {
  chapeau: null, cape: null, plastron: null, amulette: null,
  gants: null, ceinture: null, anneau: null, jambieres: null,
  arme: null, bouclier: null,
  relique1: null, relique2: null, relique3: null, relique4: null,
};

// Mode test : tous les objets du jeu dans le sac
const testInventory = () => ITEM_ORDER.map((id, i) => ({ ...ITEMS[id], uid: `test-${i}` }));

// Outil de test (bouton de la fiche du personnage) : niveau maximum (avec les points de caractéristiques qui vont avec) et un exemplaire de
// chaque objet du jeu dans le sac, pour essayer tous les sets et leur apparence. Ce que le joueur possède déjà n'est pas touché.
export function maxOutPlayer(player) {
  let p = player;
  if (p.level < MAX_LEVEL) {
    let need = 0;
    for (let l = p.level; l < MAX_LEVEL; l++) need += xpToNext(l);
    p = gainXp(p, need - (p.xp || 0)).player;
  }
  const owned = new Set([...Object.values(p.equipped || {}), ...(p.inventory || [])].filter(Boolean).map((i) => i.id));
  const uid = Date.now().toString(36);
  const added = ITEM_ORDER.filter((id) => !owned.has(id)).map((id, i) => ({ ...ITEMS[id], uid: `test-${uid}-${i}` }));
  return grandfatherBag({ ...p, hp: Math.max(p.hp || 0, p.baseHp || 100), inventory: [...(p.inventory || []), ...added] }, 120);
}

export function createPlayer({ name, classKey, gender = "m", testMode = false }) {
  return testMode ? grandfatherBag(buildPlayer({ name, classKey, gender, testMode }), 120) : buildPlayer({ name, classKey, gender, testMode });   // mode test : le sac contient tous les objets, avec de la place pour les ressources
}

function buildPlayer({ name, classKey, gender = "m", testMode = false }) {
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
    playSec: 0,                       // temps de jeu, en secondes (classement)
  };
}

// Les objets rangés dans une sauvegarde (sac, équipement, coffre, annonces…) gardent le chemin d'image qu'ils avaient à leur création. Depuis la
// conversion des images en WebP, ceux d'avant pointent vers un .png qui n'existe plus : on remet le chemin du catalogue (ou, à défaut, .webp).
// Parcours « copie à l'écriture » : ce qui n'a pas à changer garde son objet, et une sauvegarde saine ressort identique.
export function modernizeImages(v) {
  if (Array.isArray(v)) { let out = v; v.forEach((x, i) => { const y = modernizeImages(x); if (y !== x) { if (out === v) out = [...v]; out[i] = y; } }); return out; }
  if (!v || typeof v !== "object") return v;
  let out = v;
  for (const k of Object.keys(v)) {
    const x = v[k];
    let y;
    if (k === "img" && typeof x === "string" && x.startsWith("/assets/") && x.endsWith(".png")) y = (typeof v.id === "string" && ITEMS[v.id]?.img) || x.replace(/\.png$/, ".webp");
    else if (x && typeof x === "object") y = modernizeImages(x);
    else continue;
    if (y !== x) { if (out === v) out = { ...v }; out[k] = y; }
  }
  return out;
}

// Remet d'aplomb une sauvegarde ancienne ou abîmée : tout champ absent ou du mauvais type reprend sa valeur de départ.
// Ne retire rien et ne touche pas aux champs valides (une sauvegarde saine ressort identique).
export function repairPlayer(p) {
  if (!p || typeof p !== "object") return p;
  const fresh = createPlayer({ name: p.name, classKey: p.classKey, gender: p.gender });
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const out = { ...p };
  for (const k of ["level", "xp", "baseHp", "hp", "caracPoints", "gold", "playSec"]) if (typeof out[k] !== "number" || Number.isNaN(out[k])) out[k] = fresh[k];
  if (!Array.isArray(out.inventory)) out.inventory = [];
  out.inventory = out.inventory.filter((it) => it && typeof it === "object" && it.id);
  if (typeof out.bagUpgrades !== "number" || !(out.bagUpgrades >= 0)) delete out.bagUpgrades;
  for (const k of ["resources", "caracs", "equipped", "bank", "professions"]) if (!isObj(out[k])) out[k] = fresh[k];
  out.caracs = { ...fresh.caracs, ...out.caracs };
  out.equipped = { ...EMPTY_EQUIPPED, ...out.equipped };
  out.professions = { ...fresh.professions, ...out.professions };
  out.bank = { ...fresh.bank, ...out.bank };
  if (!Array.isArray(out.bank.items)) out.bank = { ...out.bank, items: [] };
  if (!isObj(out.bank.resources)) out.bank = { ...out.bank, resources: {} };
  return modernizeImages(grandfatherBag(out));     // un sac qui contient déjà plus que sa capacité est agrandi sans frais (voir utils/bag.js)
}
