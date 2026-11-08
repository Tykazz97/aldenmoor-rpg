// Test de robustesse de l'interface :  node scripts/test-ui-stress.mjs [dossier_dist=dist]
// 1. de vieilles sauvegardes (champs manquants, objet disparu du jeu, marché abîmé) doivent s'ouvrir sans écran de crash, onglet par onglet ;
// 2. toutes les fiches du Bestiaire (monstres et équipements) s'ouvrent sans erreur.
// Nécessite Playwright et un `npm run build` récent (ou un dossier construit avec une autre configuration, ex. fresh start).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { cpSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
// copie du jeu construit + une page vide du même site : on y écrit la sauvegarde sans que le jeu (qui se sauvegarde en se fermant) ne l'écrase
const DIST = join(mkdtempSync(join(tmpdir(), "aldenmoor-stress-")), "dist");
cpSync(process.argv[2] || "dist", DIST, { recursive: true });
writeFileSync(join(DIST, "blank.html"), "<!doctype html><title>vide</title>");
const PORT = 4190 + Math.floor(Math.random() * 50);
const URL = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--outDir", DIST], { stdio: "ignore", detached: true });   // détaché : on arrête tout le groupe (npx + vite), sinon un serveur reste actif
const stopServer = () => { try { process.kill(-server.pid); } catch { /* déjà arrêté */ } };
process.on("exit", () => { stopServer(); try { rmSync(DIST, { recursive: true, force: true }); } catch { /* déjà effacé */ } });
for (let i = 0; i < 50; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 200)); }

let passed = 0;
const step = async (name, fn) => { try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}\n    ${e.message.split("\n").slice(0, 8).join("\n    ")}`); throw e; } };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 960 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|403|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const tab = (name) => page.locator("button", { hasText: name }).first();
  const readSave = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open("aldenmoor"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("save"); g.onsuccess = () => { r.result.close(); res(g.result ?? null); }; }; }));
  const writeSave = async (raw) => { await page.goto(URL + "blank.html"); await page.waitForTimeout(1200); await writeOnBlank(raw); await page.waitForTimeout(300); };
  // le jeu garde aussi une copie « filet » dans le localStorage à la fermeture (la plus récente gagne) : on l'efface
  const writeOnBlank = (raw) => page.evaluate((v) => new Promise((res, rej) => { localStorage.removeItem("aldenmoor:save"); const r = indexedDB.open("aldenmoor"); r.onsuccess = () => { const t = r.result.transaction("kv", "readwrite"); t.objectStore("kv").put(v, "save"); t.oncomplete = () => { r.result.close(); res(true); }; t.onerror = () => rej(t.error); }; }), raw);
  const TABS = ["Personnage", "Atelier", "Coffre", "Marché", "Sac", "Journal", "Bestiaire", "Classement", "Carte"];
  const crashed = async () => (await page.getByText("Télécharger ma sauvegarde").count()) > 0;

  const openAllTabs = async (label) => {
    await page.goto(URL); await page.waitForTimeout(700);
    assert.equal(await crashed(), false, `${label} : écran de crash au chargement`);
    for (const n of TABS) {
      await tab(n).click(); await page.waitForTimeout(250);
      assert.equal(await crashed(), false, `${label} : écran de crash sur l'onglet ${n} — ${errors.slice(0, 2).join(" / ").slice(0, 300)}`);
    }
    assert.deepEqual(errors, [], `${label} : erreurs`);
  };

  await step("partie neuve (mode test) : tous les onglets", async () => {
    await page.goto(URL); await page.waitForTimeout(800);
    await page.getByLabel(/Mode test/).check({ timeout: 10000 });
    await page.getByRole("button", { name: "Entrer à Aldenmoor" }).click();
    await tab("Carte").waitFor({ timeout: 10000 });
    await openAllTabs("partie neuve");
  });

  const base = JSON.parse(await readSave());
  const variants = {
    "très vieille sauvegarde : sans coffre, métiers de départ seulement, sans ressources": (d) => { delete d.player.bank; delete d.player.resources; d.player.professions = Object.fromEntries(["forgeron", "tailleur", "maroquinier", "menuisier"].map((k) => [k, d.player.professions[k]])); },
    "caractéristiques et équipement incomplets": (d) => { d.player.caracs = {}; d.player.equipped = {}; delete d.player.caracPoints; delete d.player.appearance; },
    "objet disparu du jeu (dans le sac et porté)": (d) => { d.player.inventory = [{ id: "objet_disparu", uid: "x1" }, ...d.player.inventory]; d.player.equipped = { ...d.player.equipped, chapeau: { id: "objet_disparu", uid: "x2" } }; },
    "sans monde (position sur la carte)": (d) => { delete d.world; },
    "marché abîmé : stocks et historiques absents": (d) => { d.player.market = { v: 2, step: 5, stock: {}, hist: {}, listings: [] }; },
    "marché d'une autre version": (d) => { d.player.market = { v: 1, junk: true }; },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    await step(name, async () => {
      const d = JSON.parse(JSON.stringify(base)); mutate(d); d.savedAt = Date.now(); d.player.name = `Test${Object.keys(variants).indexOf(name)}`;
      await writeSave(JSON.stringify(d));
      errors.length = 0;
      await openAllTabs(name);
      // le jeu a bien relu NOTRE sauvegarde abîmée (et non celle que l'ancienne page a écrite en fermant)
      assert.equal(JSON.parse(await readSave()).player.name, `Test${Object.keys(variants).indexOf(name)}`, "la sauvegarde abîmée a été utilisée");
    });
  }

  await step("Bestiaire : chaque fiche de monstre et d'équipement s'ouvre sans erreur", async () => {
    await writeSave(JSON.stringify(base)); errors.length = 0;
    await page.goto(URL); await page.waitForTimeout(600);
    await tab("Bestiaire").click();
    const mobs = await page.locator("[data-bestiary-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-bestiary-entry")));
    for (const k of mobs) { await page.locator(`[data-bestiary-entry="${k}"]`).click(); await page.locator(`[data-bestiary-detail="${k}"]`).waitFor({ timeout: 3000 }); }
    await page.locator('[data-mode-btn="equipements"]').click();
    const gear = await page.locator("[data-gear-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-gear-entry")));
    for (const k of gear) { await page.locator(`[data-gear-entry="${k}"]`).click(); await page.locator(`[data-gear-detail="${k}"]`).waitFor({ timeout: 3000 }); assert.equal(await crashed(), false, k); }
    assert.ok(mobs.length >= 22 && gear.length === 88, `${mobs.length} monstres, ${gear.length} équipements`);
    assert.deepEqual(errors, []);
  });

  console.log(`${passed} étapes réussies`);
} finally { await browser.close(); stopServer(); }
