// Tests de la sauvegarde (IndexedDB, reprise de l'ancienne sauvegarde localStorage, filet de fermeture, repli) :  node scripts/test-save.js
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("Sauvegarde");

// un localStorage de test, avec un quota réglable
const store = new Map(); let quota = Infinity;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (String(v).length > quota) throw new Error("QuotaExceededError"); store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const { loadSave, writeSave, flushSave, clearSave, settleSave, exportSave, parseSave, SAVE_KEY, DB_NAME } = await import("../src/utils/save.js");

const player = (extra = {}) => ({ classKey: "guerrier", name: "Test", level: 3, gold: 10, ...extra });
const world = { mapKey: "ville" };
const rawOf = (p, savedAt) => JSON.stringify({ version: 1, savedAt, player: p, world });
const idbRaw = () => new Promise((res) => { const r = indexedDB.open(DB_NAME); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("save"); g.onsuccess = () => res(g.result ?? null); }; });
const reset = async () => { await clearSave(); await settleSave(); store.clear(); quota = Infinity; };

await test("rien de sauvegardé : null ; une partie écrite se relit à l'identique, dans l'IndexedDB et pas dans le localStorage", async () => {
  await reset();
  assert.equal(await loadSave(), null);
  await writeSave(player({ gold: 42 }), world);
  const d = await loadSave();
  assert.equal(d.player.gold, 42); assert.deepEqual(d.world, world); assert.equal(d.version, 1);
  assert.equal(store.has(SAVE_KEY), false, "le localStorage n'est pas utilisé");
  assert.ok(await idbRaw());
});

await test("ancienne sauvegarde du localStorage : recopiée dans l'IndexedDB, vérifiée, puis seulement effacée", async () => {
  await reset();
  const raw = rawOf(player({ level: 9, gold: 777 }), 1000);
  store.set(SAVE_KEY, raw);
  const d = await loadSave();
  assert.equal(d.player.level, 9);
  assert.equal(await idbRaw(), raw, "copie identique");
  assert.equal(store.has(SAVE_KEY), false, "ancienne copie effacée");
  assert.equal((await loadSave()).player.gold, 777, "et relue depuis l'IndexedDB");
});

await test("si la copie échoue, l'ancienne sauvegarde n'est JAMAIS effacée", async () => {
  await reset();
  const raw = rawOf(player({ gold: 5 }), 1000);
  store.set(SAVE_KEY, raw);
  // une base qui refuse toute écriture : la copie échoue
  const db = await new Promise((res) => { const r = indexedDB.open(DB_NAME); r.onsuccess = () => res(r.result); });
  const proto = Object.getPrototypeOf(db);
  const original = proto.transaction;
  proto.transaction = function (s, mode) { if (mode === "readwrite") throw new Error("lecture seule"); return original.call(this, s, mode); };
  try {
    const d = await loadSave();
    assert.equal(d.player.gold, 5, "la partie est quand même chargée");
    assert.equal(store.get(SAVE_KEY), raw, "l'ancienne sauvegarde est intacte");
    assert.equal(await idbRaw(), null, "et rien n'a été écrit dans la base");
  } finally { proto.transaction = original; }
});

await test("la copie la plus récente gagne (et la périmée est effacée)", async () => {
  await reset();
  await writeSave(player({ gold: 1 }), world);                         // savedAt = maintenant
  store.set(SAVE_KEY, rawOf(player({ gold: 999 }), 5));                  // très ancienne copie locale
  assert.equal((await loadSave()).player.gold, 1);
  assert.equal(store.has(SAVE_KEY), false);
  store.set(SAVE_KEY, rawOf(player({ gold: 2222 }), Date.now() + 60_000));   // copie locale plus récente (filet de fermeture)
  assert.equal((await loadSave()).player.gold, 2222);
  assert.equal(JSON.parse(await idbRaw()).player.gold, 2222);
});

await test("fermeture de la page : flushSave met une copie immédiate dans le localStorage, reprise puis effacée au chargement suivant", async () => {
  await reset();
  const p = flushSave(player({ gold: 31337 }), world);
  assert.ok(store.has(SAVE_KEY), "copie synchrone, avant même la fin de l'écriture IndexedDB");
  await p;
  const d = await loadSave();
  assert.equal(d.player.gold, 31337);
  assert.equal(store.has(SAVE_KEY), false);
});

await test("écritures rapprochées : regroupées, la dernière gagne, et une grosse sauvegarde dépasse le quota du localStorage sans problème", async () => {
  await reset();
  quota = 1000;                                                          // le localStorage ne pourrait rien stocker
  const big = player({ pad: "x".repeat(300_000) });
  const ps = [];
  for (let i = 1; i <= 30; i++) ps.push(writeSave({ ...big, gold: i }, world));
  await settleSave();
  const d = await loadSave();
  assert.equal(d.player.gold, 30);
  assert.equal(d.player.pad.length, 300_000);
  assert.equal(store.has(SAVE_KEY), false);
});

await test("nouvelle partie : clearSave efface tout, même une écriture en attente ; rien ne ressuscite", async () => {
  await reset();
  await writeSave(player(), world);
  store.set(SAVE_KEY, rawOf(player({ gold: 3 }), 1));
  writeSave(player({ gold: 8 }), world);                                // en attente
  await clearSave();
  await settleSave();
  assert.equal(await loadSave(), null);
  assert.equal(store.has(SAVE_KEY), false);
  assert.equal(await idbRaw(), null);
});

await test("données abîmées ou d'une autre version : ignorées, sans planter", async () => {
  await reset();
  store.set(SAVE_KEY, "{pas du json");
  assert.equal(await loadSave(), null);
  store.set(SAVE_KEY, JSON.stringify({ version: 99, player: player(), world }));
  assert.equal(await loadSave(), null);
  assert.equal(parseSave("n'importe quoi"), null);
  const d = parseSave(exportSave(player({ gold: 12 }), world));
  assert.equal(d.player.gold, 12);
});

await test("sans IndexedDB (navigation privée, vieux navigateur) : repli sur le localStorage comme avant", async () => {
  await reset();
  const saved = globalThis.indexedDB; delete globalThis.indexedDB;
  try {
    const m = await import("../src/utils/save.js?sansidb");
    assert.equal(await m.loadSave(), null);
    await m.writeSave(player({ gold: 64 }), world);
    assert.ok(store.has(SAVE_KEY), "écrit dans le localStorage");
    assert.equal((await m.loadSave()).player.gold, 64);
    await m.clearSave(); await m.settleSave();
    assert.equal(store.has(SAVE_KEY), false);
  } finally { globalThis.indexedDB = saved; }
});

console.log(`\n${n} tests passent.`);
