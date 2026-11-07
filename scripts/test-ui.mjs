// Test d'interface : lance le jeu construit dans un vrai navigateur (Playwright) et joue un parcours complet.
//   npm run test:ui
// Nécessite Playwright (npm i -D playwright && npx playwright install chromium). Volontairement hors de
// `npm test` : il demande un navigateur et prend ~30 s. Les tests de logique, eux, restent dans test-*.js.
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { console.error("Playwright introuvable : npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
if (!existsSync("dist/index.html")) { console.log("Construction du jeu…"); execSync("npm run build", { stdio: "inherit" }); }
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch { /* déjà arrêté */ } };
process.on("exit", stop);

async function waitServer() {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(URL)).ok) return; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("le serveur de prévisualisation ne répond pas");
}

let passed = 0;
const step = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message.split("\n").slice(0, 6).join("\n    ")}`); throw e; }
};

let browser;
try {
  await waitServer();
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 960 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|403|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const tab = (name) => page.locator("button", { hasText: name }).first();
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem("aldenmoor:save")));

  await step("création du personnage puis entrée dans le jeu (mode test)", async () => {
    await page.goto(URL); await page.waitForTimeout(400);
    await page.getByLabel(/Mode test/).check();
    await page.getByRole("button", { name: "Entrer à Aldenmoor" }).click();
    await tab("Carte").waitFor({ timeout: 10000 });
    assert.ok((await save()).player, "sauvegarde créée");
  });

  await step("tous les onglets s'ouvrent sans erreur", async () => {
    for (const n of ["Personnage", "Atelier", "Coffre", "Marché", "Sac", "Journal", "Carte"]) {
      await tab(n).click(); await page.waitForTimeout(250);
      assert.equal(await page.locator("button", { hasText: n }).first().isVisible(), true, n);
    }
    assert.deepEqual(errors, []);
  });

  await step("Atelier : les trois sections de métiers sont là", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    const txt = (await page.locator("body").innerText()).toLowerCase();
    for (const w of ["Fabrication", "Récolte", "Raffinage"]) assert.ok(txt.includes(w.toLowerCase()), w);
  });

  await step("Atelier : le Bijoutier, le Bricoleur et les sets des nouvelles régions sont fabricables", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    await page.locator("button", { hasText: "Bijoutier" }).first().click(); await page.waitForTimeout(250);
    assert.match(await page.locator("body").innerText(), /Anneau du Cavalier Déchu/);
    await page.locator("button", { hasText: "Bricoleur" }).first().click(); await page.waitForTimeout(250);
    assert.match(await page.locator("body").innerText(), /Clé du Manoir Englouti/);
    await page.locator("button", { hasText: "Forgeron" }).first().click(); await page.waitForTimeout(250);
    const forge = await page.locator("body").innerText();
    for (const w of ["Heaume du Fossoyeur", "Cuirasse du Chevalier Déchu", "Lame du Chevalier Déchu"]) assert.ok(forge.includes(w), w);
    assert.deepEqual(errors, []);
  });

  await step("Marché : les trois onglets Acheter / Vendre / Mes annonces", async () => {
    await tab("Marché").click(); await page.waitForTimeout(400);
    for (const t of ["Acheter", "Vendre", "Mes annonces"]) { await page.locator("button", { hasText: t }).first().click(); await page.waitForTimeout(150); }
    assert.deepEqual(errors, []);
  });

  await step("grimoire : points de sort, montée de rang, barre de combat équipable", async () => {
    const mod = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("aldenmoor:save")); s.player.level = 12; s.player.gold = 5000; return JSON.stringify(s); });
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-grimoire")) { sessionStorage.setItem("ui-grimoire", "1"); localStorage.setItem("aldenmoor:save", m); } }, mod);
    await page.reload(); await page.waitForTimeout(800);
    await tab("Personnage").click(); await page.waitForTimeout(300);
    const sb = page.locator("[data-spellbook]");
    assert.equal(await sb.locator("[data-points]").innerText(), "11");
    await sb.locator('[data-spell="parade"] [data-act="rank"]').click();
    await sb.locator('[data-spell="parade"] [data-act="rank"]').click();
    assert.equal(await sb.locator('[data-spell="parade"]').getAttribute("data-rank"), "3");
    assert.equal(await sb.locator("[data-points]").innerText(), "8");
    await sb.locator('[data-slot="3"]').click();                                   // 4e emplacement…
    await sb.locator('[data-spell="seisme"] [data-act="place"]').click();          // …remplacé par Séisme
    assert.match(await sb.locator('[data-spell="seisme"]').innerText(), /dans la barre/);
    assert.doesNotMatch(await sb.locator('[data-spell="brise_armure"]').innerText(), /dans la barre/);
    await page.waitForTimeout(500);
    const book = (await save()).player.spellbook;
    assert.equal(book.ranks.parade, 3);
    assert.ok(book.loadout.includes("seisme"));
    assert.deepEqual(errors, []);
  });

  await step("combat complet : carte → monstres → victoire → butin → retour à la carte", async () => {
    // on place le héros dans les Prairies, près des loups (et on vérifie que la barre du grimoire est bien celle du combat)
    const mod = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("aldenmoor:save")); s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 }; return JSON.stringify(s); });
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-test")) { sessionStorage.setItem("ui-test", "1"); localStorage.setItem("aldenmoor:save", m); } }, mod);
    await page.reload(); await page.waitForTimeout(800);
    await tab("Carte").click(); await page.waitForTimeout(1000);
    const goldBefore = (await save()).player.gold;
    await page.evaluate(() => {
      const v = document.querySelector(".mp-map").getBoundingClientRect();
      const c = [...document.querySelectorAll(".mp-group")].filter((e) => { const r = e.getBoundingClientRect(); return r.left > v.left && r.right < v.right && r.top > v.top && r.bottom < v.bottom; });
      c[0].click();
    });
    await page.locator("button", { hasText: "Combattre" }).click({ timeout: 15000 });
    await page.locator(".cb-spell:not([disabled])").first().waitFor({ timeout: 20000 });
    assert.equal(await page.locator(".cb-spell").count(), 5, "barre : arme + 4 sorts de classe");
    assert.match(await page.locator(".cb-spell", { hasText: "Parade" }).innerText(), /★★/, "rang 3 de Parade visible");
    assert.equal(await page.locator(".cb-spell", { hasText: "Séisme" }).count(), 1, "Séisme équipé");
    assert.equal(await page.locator(".cb-spell", { hasText: "Brise-Armure" }).count(), 0, "Brise-Armure retiré");
    await page.keyboard.press("1");                                    // raccourci clavier d'un sort
    for (let i = 0; i < 200 && !(await page.locator(".cb-overlay").count()); i++) {
      const sp = page.locator(".cb-spell:not([disabled])");
      if (await sp.count()) await sp.first().click();
      else if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
      await page.waitForTimeout(500);
    }
    const issue = await page.locator(".cb-card h2").innerText();
    if (issue.toLowerCase() === "défaite") {                           // un combat perdu est normal : on relance et on réessaie
      await page.locator("button", { hasText: "Recommencer" }).click();
      for (let i = 0; i < 200 && !(await page.locator(".cb-overlay").count()); i++) {
        const sp = page.locator(".cb-spell:not([disabled])");
        if (await sp.count()) await sp.first().click(); else if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
        await page.waitForTimeout(500);
      }
    }
    assert.match((await page.locator(".cb-card h2").innerText()).toLowerCase(), /victoire/);
    await page.locator("button", { hasText: "Récupérer" }).click(); await page.waitForTimeout(600);
    assert.equal(await page.locator(".cb-root").count(), 0, "le combat est fermé");
    assert.equal(await page.locator(".mp-map").count(), 1, "retour à la carte");
    assert.ok((await save()).player.gold > goldBefore, "l'or du butin est enregistré");
    assert.deepEqual(errors, []);
  });

  await step("combat en groupe : « En groupe » amène 2 alliés bots, qui jouent seuls ; le héros reste aux commandes", async () => {
    // on est encore sur la carte des Prairies : on engage un groupe visible
    await page.evaluate(() => {
      const v = document.querySelector(".mp-map").getBoundingClientRect();
      const c = [...document.querySelectorAll(".mp-group")].filter((e) => { const r = e.getBoundingClientRect(); return r.left > v.left && r.right < v.right && r.top > v.top && r.bottom < v.bottom; });
      c[0].click();
    });
    await page.locator("button", { hasText: "En groupe" }).click({ timeout: 15000 });
    await page.locator(".cb-spell:not([disabled])").first().waitFor({ timeout: 30000 });
    const heroBars = await page.locator(".cb-timeline .cb-tl.hero").count();
    assert.equal(heroBars, 3, "la frise d'initiative montre le héros et ses 2 alliés");
    assert.equal(await page.locator(".cb-tl.ally").count(), 2);
    assert.ok((await page.locator(".cb-actor").count()) >= 5, "héros + 2 alliés + au moins 2 ennemis à l'écran");
    await page.keyboard.press("1"); await page.waitForTimeout(800);
    await page.locator(".cb-btn", { hasText: "Quitter" }).click(); await page.waitForTimeout(500);
    assert.equal(await page.locator(".cb-root").count() <= 1, true);
    assert.deepEqual(errors, []);
  });

  await step("nouvelles régions : Champs Calcinés et Lisière des Ombres s'ouvrent, avec leurs monstres", async () => {
    for (const [key, name, levels] of [["champs_calcines", "Champs Calcinés", "Niveaux 8 à 14"], ["lisiere_des_ombres", "Lisière des Ombres", "Niveaux 14 à 20"]]) {
      await tab("Carte").click(); await page.waitForTimeout(500);
      if (await page.locator(".wm").count() === 0) await page.locator("button", { hasText: "Carte du monde" }).click();
      const spot = page.locator(".wm-spot", { hasText: name });
      assert.match(await spot.innerText(), new RegExp(levels, "i"), `${name} : niveaux affichés sur la carte du monde`);
      await spot.click(); await page.waitForTimeout(1000);
      assert.equal(await page.locator(".mp-map").count(), 1, `${key} : carte affichée`);
      assert.ok((await page.locator(".mp-group").count()) >= 10, `${key} : les groupes de monstres sont là`);
      assert.equal((await save()).world.mapKey, key, `${key} : le héros est bien dans cette région`);
    }
    assert.deepEqual(errors, []);
  });

  console.log(`\n${passed} étapes réussies, aucune erreur dans la console.`);
} catch (e) {
  console.error("\nÉchec du test d'interface.");
  process.exitCode = 1;
} finally {
  await browser?.close();
  stop();
}
