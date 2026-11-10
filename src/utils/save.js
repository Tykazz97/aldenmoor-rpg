// ============================================================
// Sauvegarde locale : personnage + position sur la carte + monde des simulés.
// Stockée dans l'IndexedDB du navigateur (des centaines de Mo possibles, écriture en arrière-plan sans bloquer le jeu) ;
// le localStorage (≈ 5 Mo, écriture bloquante) ne sert plus que :
//   - de ANCIENNE sauvegarde à reprendre : au premier chargement elle est recopiée dans l'IndexedDB, relue pour vérifier que la
//     copie est identique, et seulement ensuite effacée (jamais de perte) ;
//   - de FILET quand la page se ferme (l'écriture IndexedDB n'est alors pas garantie) : la copie est reprise au chargement suivant ;
//   - de REPLI si l'IndexedDB est indisponible (navigation privée de certains navigateurs…) : on retombe sur l'ancien comportement.
// La plus récente des deux copies gagne. Versionnée : si le format change on migre (ou on ignore) au lieu de planter.
// FRESH START : chaque sauvegarde porte l'`epoch` du monde (SIM_START, sim/config.js) ; une sauvegarde d'un autre epoch est ignorée (les
// sauvegardes d'avant ce champ valent l'epoch 1). Changer l'epoch fait donc repartir de zéro le joueur ET les simulés : il faut refaire un personnage.
// ============================================================
import { SIM_START } from "../sim/config.js";

export const SAVE_KEY = "aldenmoor:save";
export const SAVE_VERSION = 1;
export const DB_NAME = "aldenmoor";
const STORE = "kv", IDB_KEY = "save";

const parse = (raw) => {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : null;
    return data && data.version === SAVE_VERSION && data.player && data.player.classKey && (data.epoch ?? 1) === SIM_START.epoch ? data : null;
  } catch { return null; }
};

// --- localStorage (ancienne sauvegarde, filet, repli) ---
const readLocal = () => { try { const raw = localStorage.getItem(SAVE_KEY); const data = parse(raw); return data ? { raw, data } : null; } catch { return null; } };
const writeLocal = (raw) => { try { localStorage.setItem(SAVE_KEY, raw); return true; } catch { return false; } };
const removeLocal = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignoré */ } };

// --- IndexedDB ---
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const idb = globalThis.indexedDB;
      if (!idb) return resolve(null);
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch { /* existe déjà */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
const idbGet = (db) => new Promise((resolve) => {
  try { const r = db.transaction(STORE).objectStore(STORE).get(IDB_KEY); r.onsuccess = () => resolve({ ok: true, value: r.result ?? null }); r.onerror = () => resolve({ ok: false }); }
  catch { resolve({ ok: false }); }
});
const idbPut = (db, raw) => new Promise((resolve) => {
  try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(raw, IDB_KEY); tx.oncomplete = () => resolve(true); tx.onerror = tx.onabort = () => resolve(false); }
  catch { resolve(false); }
});
const idbDelete = (db) => new Promise((resolve) => {
  try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(IDB_KEY); tx.oncomplete = () => resolve(true); tx.onerror = tx.onabort = () => resolve(false); }
  catch { resolve(false); }
});

// Lit la sauvegarde (asynchrone) : IndexedDB, avec reprise de l'ancienne sauvegarde du localStorage
export async function loadSave() {
  const local = readLocal();
  const db = await openDb();
  if (!db) return local ? local.data : null;                               // pas d'IndexedDB : comme avant
  try { navigator.storage?.persist?.(); } catch { /* ignoré */ }            // demande au navigateur de ne pas effacer nos données
  const got = await idbGet(db);
  if (!got.ok) return local ? local.data : null;                           // lecture impossible : on ne touche à rien
  const stored = parse(got.value);
  if (local && (!stored || local.data.savedAt >= stored.savedAt)) {
    // la copie locale est la plus récente (ancienne sauvegarde, ou filet de fermeture) : on la recopie, on vérifie, puis on l'efface
    const copied = (await idbPut(db, local.raw)) && (await idbGet(db)).value === local.raw;
    if (copied) removeLocal();
    return local.data;
  }
  if (local) removeLocal();                                                // copie locale périmée
  return stored;
}

// Écritures : une à la fois, et regroupées (seule la plus récente compte)
let chain = Promise.resolve(), pendingRaw = null, queued = false;
async function flushPending() {
  queued = false;
  const raw = pendingRaw; pendingRaw = null;
  if (raw === null) return true;
  const db = await openDb();
  if (db && (await idbPut(db, raw))) return true;
  return writeLocal(raw);                                                  // IndexedDB indisponible ou en échec : repli
}
const serialize = (player, world) => JSON.stringify({ version: SAVE_VERSION, epoch: SIM_START.epoch, savedAt: Date.now(), player, world });

export function writeSave(player, world) {
  try { pendingRaw = serialize(player, world); } catch { return Promise.resolve(false); }
  if (!queued) { queued = true; chain = chain.then(flushPending, flushPending); }
  return chain;
}

// À la fermeture de la page : écriture normale + copie immédiate dans le localStorage (la seule garantie avant que la page disparaisse)
export function flushSave(player, world) {
  let raw;
  try { raw = serialize(player, world); } catch { return Promise.resolve(false); }
  pendingRaw = raw;
  writeLocal(raw);
  if (!queued) { queued = true; chain = chain.then(flushPending, flushPending); }
  return chain;
}

export function clearSave() {
  pendingRaw = null;                                                       // une écriture en attente ne doit pas ressusciter la partie
  removeLocal();
  chain = chain.then(async () => { const db = await openDb(); if (db) await idbDelete(db); removeLocal(); }, () => {});
  return chain;
}

// Attend la fin des écritures en cours (tests)
export const settleSave = () => chain;

// Export / import d'un fichier de sauvegarde (texte JSON)
export const exportSave = (player, world) => JSON.stringify({ version: SAVE_VERSION, epoch: SIM_START.epoch, savedAt: Date.now(), player, world }, null, 1);

export function parseSave(text) {
  return parse(text);
}
