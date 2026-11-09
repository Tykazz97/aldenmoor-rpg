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
  // la sauvegarde vit dans l'IndexedDB (clé « save » du magasin « kv », stockée en texte JSON)
  const rawSave = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open("aldenmoor"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("save"); g.onsuccess = () => { r.result.close(); res(g.result ?? null); }; g.onerror = () => res(null); }; r.onerror = () => res(null); }));
  const save = async () => { const raw = await rawSave(); return raw ? JSON.parse(raw) : null; };

  await step("création du personnage puis entrée dans le jeu (mode test)", async () => {
    await page.goto(URL); await page.waitForTimeout(400);
    await page.getByLabel(/Mode test/).check();
    await page.getByRole("button", { name: "Entrer à Aldenmoor" }).click();
    await tab("Carte").waitFor({ timeout: 10000 });
    assert.ok((await save()).player, "sauvegarde créée");
  });

  await step("tous les onglets s'ouvrent sans erreur", async () => {
    for (const n of ["Personnage", "Atelier", "Coffre", "Marché", "Sac", "Journal", "Bestiaire", "Classement", "Guilde", "Carte"]) {
      await tab(n).click(); await page.waitForTimeout(250);
      assert.equal(await page.locator("button", { hasText: n }).first().isVisible(), true, n);
    }
    assert.deepEqual(errors, []);
  });

  await step("Atelier : les trois sections de métiers sont là", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    const txt = (await page.locator("body").innerText()).toLowerCase();
    for (const w of ["Fabrication", "Récolte", "Raffinage"]) assert.ok(txt.includes(w.toLowerCase()), w);
    assert.match(await page.locator("[data-city-tax]").innerText(), /Atelier de Aldenmoor.*taxe de fabrication.*1 %/s, "la taxe de la ville est affichée");
    await page.locator("button", { hasText: "Forgeron" }).first().click(); await page.waitForTimeout(200);
    assert.ok((await page.locator("body").innerText()).includes("or de taxe"), "chaque recette indique sa taxe, plus de coût fixe");
    // la liste des métiers défile : sur un écran bas, le dernier métier reste atteignable
    const vp = page.viewportSize(); await page.setViewportSize({ width: vp.width, height: 560 }); await page.waitForTimeout(200);
    const box = page.locator("[data-professions-list]");
    assert.ok(await box.evaluate((e) => e.scrollHeight > e.clientHeight), "liste des métiers plus haute que l'écran");
    await box.evaluate((e) => { e.scrollTop = e.scrollHeight; });
    const last = box.locator("button").last(), lb = await last.boundingBox(), bb = await box.boundingBox();
    assert.ok(lb.y >= bb.y - 1 && lb.y + lb.height <= bb.y + bb.height + 1, "le dernier métier est visible après défilement");
    await page.setViewportSize(vp); await page.waitForTimeout(200);
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

  await step("Atelier : l'Alchimiste distille une potion de soin avec les herbes de test", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    const give = page.locator("button", { hasText: "+ Ressources" }).first();
    if (await give.count()) { await give.click(); await page.waitForTimeout(150); }
    await page.locator("button", { hasText: "+ 500 or" }).first().click(); await page.waitForTimeout(150);
    await page.locator("button", { hasText: "Alchimiste" }).first().click(); await page.waitForTimeout(250);
    const body = await page.locator("body").innerText();
    for (const w of ["Potion de soin mineure", "Grande potion de soin", "Élixir de rappel", "Chance de distiller"]) assert.ok(body.includes(w), w);
    const one = page.locator('[data-brew-recipe="potion_mineure"] [data-brew="1"]');
    assert.equal(await one.isEnabled(), true, "×1 disponible");
    await one.click(); await page.waitForTimeout(250);
    assert.match(await page.locator("body").innerText(), /Potion de soin mineure ×\d+ produit/);
    assert.deepEqual(errors, []);
  });

  await step("Atelier : on améliore une pièce portée (+1) avec éclat brut, ressource de classe et or ; la taxe est inscrite", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-upgrade]").count(), 0, "l'amélioration n'encombre plus les écrans de métiers");
    await page.locator("[data-upgrade-tab]").click(); await page.waitForTimeout(250);
    assert.ok(await page.locator("[data-upgrade]").isVisible(), "panneau d'amélioration");
    const btn = page.locator("[data-upgrade-row]:not([data-upgrade-row=bag]) [data-upgrade-btn]:not([disabled])").first();
    assert.equal(await btn.count(), 1, "une amélioration est possible avec les ressources de test");
    const row = btn.locator("xpath=ancestor::*[@data-upgrade-row][1]");
    const slot = await row.getAttribute("data-upgrade-row");
    const goldBefore = (await save()).player.gold;
    await btn.click(); await page.waitForTimeout(400);
    const p = (await save()).player;
    assert.equal(p.equipped[slot].plus, 1, "la pièce porte +1");
    assert.ok(p.gold < goldBefore, "l'or est dépensé");
    assert.ok(Object.values(p.taxPaid || {}).some((t) => t > 0), "la taxe de la ville est inscrite");
    assert.match(await page.locator(`[data-upgrade-row="${slot}"]`).innerText(), /\+1/);
    await tab("Personnage").click(); await page.waitForTimeout(300);
    assert.ok(await page.locator(`[data-plus="1"]`).first().isVisible(), "le badge +1 est visible sur l'équipement");
    assert.deepEqual(errors, []);
  });

  await step("Marché façon hôtel des ventes : catégories, achat d'un lot, mise en vente, emplacements limités au niveau", async () => {
    await tab("Marché").click(); await page.waitForTimeout(400);
    const msg = () => page.locator("[data-msg]").innerText();
    const gold = async () => Number((await page.locator("[data-gold]").innerText()).replace(/\D/g, ""));
    // catégories à gauche, liste au milieu
    assert.ok(await page.locator("[data-hv-cats]").isVisible(), "catégories");
    await page.locator('[data-cat="e_arme"]').click(); await page.waitForTimeout(150);
    await page.locator('[data-cat="tout"]').click(); await page.waitForTimeout(150);
    await page.locator('[data-hv-search]').fill("croc de loup"); await page.waitForTimeout(150);
    assert.equal(await page.locator("[data-hv-row]").count(), 1, "la recherche filtre la liste");
    await page.locator('[data-hv-search]').fill(""); await page.waitForTimeout(100);
    // achat d'un lot de 10 d'une ressource : l'or baisse, un message le dit
    await page.locator('[data-hv-row="res:croc_de_loup"]').click(); await page.waitForTimeout(250);
    assert.ok(await page.locator('[data-hv-detail="res:croc_de_loup"]').isVisible(), "fiche de l'objet");
    const g0 = await gold();
    await page.locator('[data-lot="10"]').click();
    await page.locator('[data-act="buy"]').click(); await page.waitForTimeout(250);
    assert.match(await msg(), /Acheté 10 × Croc de loup/);
    assert.ok((await gold()) < g0, "l'or baisse après l'achat");
    // vendre : 3 emplacements au niveau 1, la 4e annonce est impossible
    await page.locator('[data-tab="sell"]').click(); await page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) {
      await page.locator("[data-hv-sellrow]").first().click(); await page.waitForTimeout(150);
      await page.locator('[data-act="post"]').click(); await page.waitForTimeout(200);
      assert.match(await msg(), /Annonce publiée/, `annonce ${i + 1}`);
    }
    assert.match(await page.locator("[data-hv-slotchip]").innerText(), /3 \/ 3/);
    await page.locator("[data-hv-sellrow]").first().click(); await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-act="post"]').isDisabled(), true, "plus d'emplacement libre");
    assert.match(await page.locator("[data-hv-slots]").innerText(), /tous pris/);
    // mes ventes : emplacements occupés, libres et verrouillés par niveau
    await page.locator('[data-tab="mine"]').click(); await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-slot="used"]').count(), 3);
    assert.equal(await page.locator('[data-slot="locked"]').count(), 9);
    assert.match(await page.locator("[data-hv-slots-board]").innerText(), /niveau 5/);
    await page.locator('[data-act="cancel"]').first().click(); await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-slot="used"]').count(), 2);
    assert.deepEqual(errors, []);
  });

  await step("Classement : je suis dans la liste, le tri et la recherche fonctionnent", async () => {
    await tab("Classement").click(); await page.waitForTimeout(500);
    assert.ok(await page.locator("[data-ranking]").isVisible(), "écran du classement");
    assert.equal(await page.locator('[data-rank-row][data-me="1"]').count(), 1, "ma ligne est dans le classement");
    for (const s of ["niveau", "or", "metier", "heures"]) {
      await page.locator(`[data-rank-sort="${s}"]`).click(); await page.waitForTimeout(120);
      assert.ok((await page.locator("[data-rank-row]").count()) >= 100, `liste ${s}`);
      assert.equal(await page.locator('[data-rank-row][data-me="1"]').count(), 1, `ma ligne reste visible (${s})`);
    }
    // on peut descendre jusqu'au bas de la liste (le 100e de la liste est atteignable)
    const sc = await page.evaluate(() => { const el = document.querySelector("[data-ranking]"); el.scrollTop = el.scrollHeight; const rows = [...document.querySelectorAll("[data-rank-row]")], last = rows[rows.length - 1].getBoundingClientRect(); return { scrolled: el.scrollTop > 0, lastVisible: last.bottom <= window.innerHeight + 2 }; });
    assert.ok(sc.scrolled && sc.lastVisible, "la liste du classement défile jusqu'en bas");
    await page.locator("[data-rank-search]").fill("zzzzzz"); await page.waitForTimeout(150);
    assert.equal(await page.locator("[data-rank-row]").count(), 0);
    await page.locator("[data-rank-search]").fill("");
    assert.deepEqual(errors, []);
  });

  await step("Guilde : fonder, verser à la caisse, parcourir les onglets, quitter", async () => {
    const mod = JSON.stringify(await (async () => { const s = await save(); s.player.gold = 30000; s.savedAt = Date.now() + 2000; return s; })());
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-guilde")) { sessionStorage.setItem("ui-guilde", "1"); localStorage.setItem("aldenmoor:save", m); } }, mod);
    await page.reload(); await page.waitForTimeout(800);
    await tab("Guilde").click();
    await page.locator("[data-gd-create-name]").waitFor({ timeout: 20000 });
    assert.ok(await page.locator("[data-guild]").isVisible(), "écran des guildes");
    await page.locator("[data-gd-create-name]").fill("Les Veilleurs de Test");
    assert.ok(await page.locator("[data-gd-emblem-editor]").isVisible(), "éditeur de blason");
    for (const k of ["shape-3", "motif-5", "c1-9", "c2-0", "sym-2", "c3-12"]) await page.locator(`[data-gd-em="${k}"]`).click();
    await page.locator("[data-gd-em-random]").click(); await page.waitForTimeout(100);
    for (const k of ["shape-4", "motif-2", "c1-9", "c2-0", "sym-3", "c3-12"]) await page.locator(`[data-gd-em="${k}"]`).click();
    await page.screenshot({ path: "/tmp/claude-0/gd-create.png" });
    await page.locator("[data-gd-create]").click();
    await page.locator("[data-gd-name]").waitFor({ timeout: 5000 });
    assert.ok(await page.locator("[data-gd-name]").locator("xpath=ancestor::div[contains(@class,'gd-top')]").locator("[data-emblem]").isVisible(), "blason affiché en en-tête");
    assert.match(await page.locator("[data-gd-name]").innerText(), /Les Veilleurs de Test/);
    assert.equal((await page.locator("[data-gd-level]").innerText()).trim(), "1");
    assert.equal(await page.locator("[data-gd-quest]").count(), 3, "trois quêtes en cours");
    await page.locator("[data-gd-donate-amount]").fill("500");
    await page.locator("[data-gd-donate]").click(); await page.waitForTimeout(200);
    assert.match((await page.locator("[data-gd-treasury]").innerText()).replace(/\s/g, ""), /^500$/, "500 or dans la caisse");
    assert.equal((await page.locator("[data-gd-minlevel]").innerText()).trim(), "aucun", "recrutement ouvert à tous");
    await page.locator("[data-gd-minlevel-input]").fill("7");
    await page.locator("[data-gd-minlevel-save]").click(); await page.waitForTimeout(200);
    assert.equal((await page.locator("[data-gd-minlevel]").innerText()).trim(), "7", "niveau minimum enregistré");
    await page.locator("[data-gd-donate-amount]").fill("2500");
    await page.locator("[data-gd-donate]").click(); await page.waitForTimeout(200);
    await page.locator('[data-gd-tab="sentinelles"]').click();
    assert.ok(await page.locator("[data-gd-sentinels]").isVisible(), "onglet des sentinelles");
    assert.equal(await page.locator("[data-gd-sent-region]").count(), 3, "trois régions");
    assert.equal(await page.locator("[data-sentinel-sprite]").count(), 0, "aucune sentinelle posée");
    await page.locator('[data-gd-sent-place="champs_calcines"]').waitFor();
    assert.ok(await page.locator('[data-gd-sent-place="champs_calcines"]').isDisabled(), "caisse trop juste pour les Champs Calcinés");
    await page.locator('[data-gd-sent-place="prairies_sauvages"]').click(); await page.waitForTimeout(200);
    assert.equal(await page.locator("[data-sentinel-sprite]").count(), 1, "la sentinelle est posée, avec sa bannière");
    assert.ok(await page.locator("[data-sentinel-sprite] [data-emblem]").isVisible(), "le blason de la guilde est sur la hampe");
    assert.equal((await page.locator("[data-gd-sent-count]").innerText()).trim(), "1");
    assert.ok(await page.locator('[data-gd-sent-collect="prairies_sauvages"]').isDisabled(), "stock vide : rien à relever");
    assert.ok(await page.locator("[data-gd-sentsheet]").isVisible(), "fiche de la sentinelle");
    assert.equal((await page.locator("[data-gd-sent-free]").innerText()).trim(), "3", "3 points au niveau 1");
    await page.locator('[data-gd-sent-plus="vitalite"]').click(); await page.waitForTimeout(150);
    await page.locator('[data-gd-sent-plus="vitalite"]').click(); await page.waitForTimeout(150);
    assert.equal((await page.locator('[data-gd-sent-pts="vitalite"]').innerText()).trim(), "2");
    assert.equal((await page.locator("[data-gd-sent-free]").innerText()).trim(), "1");
    assert.ok(await page.locator('[data-gd-sent-plus="vitalite"]').isDisabled(), "60 % au plus dans une caractéristique");
    assert.equal(await page.locator('[data-gd-sent-spell="poing_de_pierre"]').getAttribute("data-state"), "on", "sort de départ équipé");
    assert.equal(await page.locator('[data-gd-sent-spell="peau_de_granit"]').getAttribute("data-state"), "locked", "sort du niveau 5 pas encore là");
    await page.screenshot({ path: process.env.SHOT_SENT || "/tmp/claude-0/gd-sentinel.png" });
    await page.locator('[data-gd-sent-remove="prairies_sauvages"]').click(); await page.waitForTimeout(200);
    assert.equal(await page.locator("[data-sentinel-sprite]").count(), 0, "sentinelle retirée");
    await page.locator('[data-gd-tab="paliers"]').click();
    assert.equal(await page.locator("[data-gd-pal]").count(), 10, "dix paliers");
    assert.equal(await page.locator('[data-gd-pal="1"]').getAttribute("data-state"), "next");
    await page.locator('[data-gd-tab="coffre"]').click();
    assert.ok(await page.locator("[data-gd-vault]").isVisible(), "coffre de guilde");
    assert.equal(await page.locator("[data-gd-vtab]").count(), 6, "six onglets (un seul acheté)");
    await page.locator('[data-gd-tab="membres"]').click();
    assert.equal(await page.locator("[data-gd-member]").count(), 1, "je suis seul");
    assert.equal(await page.locator("[data-gd-myrank]").getAttribute("data-gd-myrank"), "chef", "le fondateur est chef");
    await page.locator("[data-gd-leave]").click();
    await page.locator("[data-gd-leave-confirm]").click(); await page.waitForTimeout(300);
    assert.ok(await page.locator("[data-gd-create-name]").isVisible(), "retour à l'écran de fondation");
    assert.deepEqual(errors, []);
  });

  await step("grimoire : points de sort, montée de rang, barre de combat équipable", async () => {
    const mod = JSON.stringify(await (async () => { const s = await save(); s.player.level = 12; s.player.gold = 5000; s.savedAt = Date.now() + 2000; return s; })());
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

  await step("bestiaire : fiche d'un monstre, sorts, butin ; le groupe et la recherche changent les pourcentages", async () => {
    await tab("Bestiaire").click();
    await page.locator("[data-bestiary-detail]").waitFor();
    assert.ok((await page.locator("[data-bestiary-entry]").count()) >= 20, "tous les monstres sont listés");
    await page.locator('[data-bestiary-entry="loup_garou"]').click();
    assert.ok((await page.locator("[data-spell]").count()) >= 3, "sorts affichés");
    const rate = async (id) => (await page.locator(`[data-drop-row="${id}"] [data-drop-rate]`).innerText()).replace(/\s/g, " ");
    const solo = await rate("griffe_de_garou");
    await page.locator('[data-group-btn="3"]').click();
    const trio = await rate("griffe_de_garou");
    assert.notEqual(solo, trio, `le trio change le taux (${solo} → ${trio})`);
    await page.locator('[data-bestiary-entry="dame_en_deuil_difficile"]').click();
    const fixed = await page.locator('[data-drop-row="medaillon_veuvage_eternel"] [data-drop-rate]').innerText();
    assert.match(fixed, /0,3/, "taux fixe inchangé en trio");
    await page.locator("[data-bestiary-search]").fill("croc de pleine lune");
    assert.equal(await page.locator("[data-bestiary-entry]").count(), 1, "la recherche par butin retrouve le monstre");
    await page.locator("[data-bestiary-search]").fill("");
    assert.deepEqual(errors, []);
  });

  await step("bestiaire, équipements : fiche d'une pièce, recette avec ressources et provenance, set, recherche", async () => {
    await tab("Bestiaire").click();
    await page.locator('[data-mode-btn="equipements"]').click();
    await page.locator("[data-gearbook]").waitFor();
    assert.equal(await page.locator("[data-gear-entry]").count(), 88, "les 88 équipements sont listés");
    await page.locator('[data-gear-entry="plastron_garou"]').click();
    assert.equal(await page.locator("[data-ingredient]").count(), 5, "5 ingrédients pour la veste du Loup-Garou");
    assert.ok((await page.locator('[data-ingredient="griffe_de_garou"]').innerText()).includes("Loup-garou"), "provenance de la griffe");
    assert.equal(await page.locator("[data-set-piece]").count(), 5, "les 5 pièces du set");
    await page.locator('[data-set-piece="gants_garou"]').click();
    assert.ok(await page.locator('[data-gear-detail="gants_garou"]').isVisible(), "clic sur une pièce du set");
    await page.locator('[data-gear-entry="lame_du_veilleur"]').click();
    assert.ok((await page.locator("[data-item-source]").first().innerText()).includes("Veilleur"), "source d'une arme unique");
    await page.locator("[data-bestiary-search]").fill("croc de pleine lune");
    assert.ok((await page.locator("[data-gear-entry]").count()) >= 1 && (await page.locator("[data-gear-entry]").count()) < 10, "recherche par ressource");
    await page.locator("[data-bestiary-search]").fill("");
    await page.locator('[data-mode-btn="monstres"]').click();
    await page.locator("[data-bestiary-detail]").waitFor();
    assert.deepEqual(errors, []);
  });

  await step("combat complet : carte → monstres → victoire → butin → retour à la carte", async () => {
    // on place le héros dans les Prairies, près des loups (et on vérifie que la barre du grimoire est bien celle du combat)
    const mod = JSON.stringify(await (async () => { const s = await save(); s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 }; return s; })());
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-test")) { sessionStorage.setItem("ui-test", "1"); localStorage.setItem("aldenmoor:save", m); } }, mod);
    await page.reload(); await page.waitForTimeout(800);
    await tab("Carte").click(); await page.waitForTimeout(1000);
    const goldBefore = (await save()).player.gold;
    await page.evaluate(() => {
      const v = document.querySelector(".mp-map").getBoundingClientRect();
      const cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;
      const d = (e) => { const r = e.getBoundingClientRect(); return Math.hypot((r.left + r.right) / 2 - cx, (r.top + r.bottom) / 2 - cy); };
      const c = [...document.querySelectorAll(".mp-group:not(.boss):not(.busy)")].sort((a, b) => d(a) - d(b));   // le plus proche du centre de l'écran (la carte est grande : il n'y en a pas toujours un à l'écran)
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
    // le groupe permanent : on invite 2 joueurs connectés dans l'onglet Groupe, puis on revient sur la carte
    await tab("Groupe").click(); await page.waitForTimeout(500);
    await page.locator("[data-group-cand]").first().waitFor({ timeout: 15000 });
    for (let i = 0; i < 2; i++) { await page.locator("[data-group-invite]:not([disabled])").first().click(); await page.waitForTimeout(300); }
    assert.equal(await page.locator("[data-group-member]").count(), 2, "les 2 joueurs invités sont dans le groupe");
    assert.equal(await page.locator("[data-group-invite]:not([disabled])").count(), 0, "groupe complet : plus d'invitation possible");
    await page.waitForTimeout(800);
    const members = (await save()).player.companions;
    assert.equal(members.length, 2, "le groupe est enregistré");
    const killsOf = async () => { const l = (await save()).player.market.sims.lives; return members.map((id) => l[id].kills); };
    const kills0 = await killsOf();
    await tab("Carte").click(); await page.waitForTimeout(800);
    await page.evaluate(() => {
      const v = document.querySelector(".mp-map").getBoundingClientRect();
      const cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;
      const d = (e) => { const r = e.getBoundingClientRect(); return Math.hypot((r.left + r.right) / 2 - cx, (r.top + r.bottom) / 2 - cy); };
      const c = [...document.querySelectorAll(".mp-group:not(.boss):not(.busy)")].sort((a, b) => d(a) - d(b));   // le plus proche du centre de l'écran (la carte est grande : il n'y en a pas toujours un à l'écran)
      c[0].click();
    });
    await page.locator("[data-engage-member]").first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator("[data-engage-member]").count(), 2, "les 2 membres du groupe apparaissent dans la fenêtre d'engagement");
    await page.locator("button", { hasText: "En groupe" }).click({ timeout: 15000 });
    await page.locator(".cb-tl.ally").first().waitFor({ timeout: 30000 });
    const heroBars = await page.locator(".cb-timeline .cb-tl.hero").count();
    assert.equal(heroBars, 3, "la frise d'initiative montre le héros et ses 2 alliés");
    assert.equal(await page.locator(".cb-tl.ally").count(), 2);
    assert.ok((await page.locator(".cb-actor").count()) >= 5, "héros + 2 alliés + au moins 2 ennemis à l'écran");
    await page.waitForTimeout(1500);
    // à trois, le combat peut déjà être gagné avant le premier tour du héros : on sort par le bouton disponible
    const loot = page.locator("button", { hasText: "Récupérer" });
    if (await loot.count()) {
      await loot.click(); await page.waitForTimeout(1200);
      const kills1 = await killsOf();
      assert.ok(kills1.every((k, i) => k > kills0[i]), "chaque membre du groupe a ses propres victoires (xp et butin à lui)");
    } else { await page.keyboard.press("1"); await page.waitForTimeout(800); await page.locator(".cb-btn", { hasText: "Quitter" }).click(); }
    await page.waitForTimeout(500);
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

  await step("donjon : clé fabriquée chez le Bricoleur, entrée du Manoir Englouti sur la Lisière, salle 1 en groupe, clé consommée", async () => {
    await tab("Atelier").click(); await page.waitForTimeout(250);
    for (let i = 0; i < 3; i++) await page.locator("button", { hasText: "+ Ressources" }).click();
    await page.locator("button", { hasText: "+ 500 or" }).click();
    await page.locator("button", { hasText: "Bricoleur" }).first().click(); await page.waitForTimeout(300);
    await page.locator("div", { hasText: /^Clé du Manoir Englouti(?! \(difficile\))/ }).last().locator("xpath=ancestor::div[contains(@style,'border')][1]").locator("button:not([disabled])", { hasText: "Crafter" }).first().click();
    await page.waitForTimeout(400);
    const keys = (s) => s.player.inventory.filter((i) => i.id === "cle_du_manoir").length;
    const k0 = keys(await save());
    assert.ok(k0 >= 1, "la clé est dans le sac");
    await tab("Carte").click(); await page.waitForTimeout(500);
    const bld = page.locator(".mp-building", { hasText: "Manoir Englouti" });
    assert.equal(await bld.count(), 1, "l'entrée du donjon est sur la carte de la Lisière");
    await bld.evaluate((e) => e.click());   // hors de la vue : on déclenche le clic, le héros marche jusqu'à l'entrée
    await page.locator(".mp-popup").waitFor({ timeout: 120000 });
    const pop = (await page.locator(".mp-popup").innerText()).toLowerCase();
    for (const w of ["Hall inondé", "Chapelle ardente", "Niveaux 20 à 26"]) assert.ok(pop.includes(w.toLowerCase()), w);
    assert.equal(await page.locator("button", { hasText: "Combattre seul" }).count(), 0, "pas de solo dans un donjon");
    await page.locator('[data-mode="hard"]').click(); await page.waitForTimeout(200);
    const hardPop = await page.locator(".mp-popup").innerText();
    assert.match(hardPop, /difficile/i, "la fiche passe en version difficile");
    assert.match(hardPop, /Niveaux 26 et plus/i);
    assert.match(hardPop, /Médaillon du Veuvage éternel|éternel/i, "la fiche annonce la relique supérieure");
    assert.equal(await page.locator("button", { hasText: "Entrer avec mon groupe" }).isDisabled(), false, "le mode test donne une clé difficile : l'entrée est ouverte");
    assert.equal(await page.locator(`.mp-pop-drops img[alt="Médaillon du Veuvage éternel"]`).count(), 1, "la relique supérieure est dans le butin possible");
    await page.locator('[data-mode="normal"]').click(); await page.waitForTimeout(200);
    await page.locator("button", { hasText: "Entrer avec mon groupe" }).click();
    await page.locator('[data-room-scene="hall"]').waitFor({ timeout: 15000 });
    assert.equal(await page.locator("[data-room-enemies] img").count(), 3, "le groupe de monstres de la salle est visible");
    assert.equal(await page.locator("[data-room-hero]").count(), 3, "trois héros avec leurs PV");
    assert.ok((await page.locator('[data-drink^="0:"]').count()) >= 1, "des potions sont proposées (sac de test)");
    assert.equal(await page.locator('[data-drink^="0:"]:not([disabled])').count(), 0, "PV pleins : rien à boire");
    await page.waitForTimeout(1500);
    assert.equal(keys(await save()), k0 - 1, "une clé est consommée dès l'arrivée dans le manoir");
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });   // coup d'œil à la main : SHOT=/chemin.png npm run test:ui
    await page.locator("[data-room-fight]").click();
    await page.locator(".cb-tl.ally").first().waitFor({ timeout: 30000 });
    assert.equal(await page.locator(".cb-tl.ally").count(), 2, "trois héros dans le donjon");
    await page.waitForTimeout(1500);
    assert.equal(keys(await save()), k0 - 1, "une clé est consommée dès l'entrée");
    await page.locator(".cb-btn", { hasText: "Quitter" }).click();
    await page.locator(".mp-map").waitFor({ timeout: 10000 });
    assert.deepEqual(errors, []);
  });

  await step("Sentinelle : la plaque s'affiche sur la carte, on l'attaque en groupe, on la détruit et son stock est à nous", async () => {
    const { createGuild } = await import("../src/utils/guildCore.js");
    const { placeSentinel, sentinelsOf, rebuildSent } = await import("../src/utils/sentinel.js");
    const s = await save();
    const sims = s.player.market?.sims; assert.ok(sims && sims.lives, "le monde des simulés est dans la sauvegarde");
    const G = sims.guilds || (sims.guilds = { v: 1, seq: 1, byId: {}, of: {} });
    const founder = Object.keys(sims.lives)[0];
    const g = createGuild(G, { founder, name: "Les Gardiens de Test", step: s.player.market.bucket });
    g.level = 3; g.gold = 9999;
    // un membre connecté en ce moment (le plus jeune, pour que l'attaque réussisse ; SENT_DEF_NEAR=1 : les plus proches de mon niveau, pour la capture d'écran) : ils défendent la sentinelle
    const { getPopulation } = await import("../src/sim/population.js");
    const { isActive, STEP_MS } = await import("../src/sim/lives.js");
    const { addMember } = await import("../src/utils/guildCore.js");
    const online = getPopulation().filter((b) => sims.lives[b.id] && b.id !== founder && isActive(b, Math.floor(Date.now() / STEP_MS))).sort((a, b) => process.env.SENT_DEF_NEAR ? Math.abs(sims.lives[a.id].level - s.player.level) - Math.abs(sims.lives[b.id].level - s.player.level) : sims.lives[a.id].level - sims.lives[b.id].level).slice(0, 1);
    for (const b of online) addMember(G, g, b.id, s.player.market.bucket);
    placeSentinel(G, g, "prairies_sauvages", s.player.market.bucket);
    Object.assign(sentinelsOf(g).prairies_sauvages, { gold: 400, res: { croc_de_loup: 7 } });
    rebuildSent(G);
    s.player.resources = {}; s.player.inventory = (s.player.inventory || []).slice(0, 6);
    s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 }; s.savedAt = Date.now() + 2000;
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-sentinelle")) { sessionStorage.setItem("ui-sentinelle", "1"); localStorage.setItem("aldenmoor:save", m); } }, JSON.stringify(s));
    await page.reload(); await page.waitForTimeout(800);
    await tab("Carte").click(); await page.waitForTimeout(1000);
    const gold0 = (await save()).player.gold;
    await page.locator('[data-map-sentinel="prairies_sauvages"]').waitFor({ timeout: 15000 });
    assert.match(await page.locator('[data-map-sentinel]').innerText(), /Les Gardiens de Test/);
    const nDef = online.length + 0;
    if (nDef) assert.match(await page.locator('[data-map-sentinel]').innerText(), /défenseur/, "la plaque annonce les défenseurs connectés");
    if (process.env.SHOT_SENT_MAP) await page.screenshot({ path: process.env.SHOT_SENT_MAP });
    await page.locator('[data-sentinel-attack="group"]').click();
    await page.locator(".cb-spell:not([disabled]), .cb-overlay").first().waitFor({ timeout: 20000 });   // (une sentinelle sans point tombe parfois avant le premier tour du joueur)
    if (process.env.SHOT_SENT_FIGHT) await page.screenshot({ path: process.env.SHOT_SENT_FIGHT });
    if (nDef) assert.equal(await page.locator(".cb-actor").count(), 3 + 1 + nDef, "les défenseurs sont à l'écran avec la sentinelle (un défenseur trop faible peut déjà être à terre)");
    for (let i = 0; i < 300 && !(await page.locator(".cb-overlay").count()); i++) {
      const sp = page.locator(".cb-spell:not([disabled])");
      if (await sp.count()) await sp.first().click();
      else if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
      await page.waitForTimeout(400);
    }
    assert.match((await page.locator(".cb-card h2").innerText()).toLowerCase(), /sentinelle détruite/);
    await page.locator("[data-sentinel-claim]").click(); await page.waitForTimeout(800);
    assert.equal(await page.locator(".cb-root").count(), 0, "retour à la carte");
    assert.equal(await page.locator("[data-map-sentinel]").count(), 0, "la sentinelle a disparu de la région");
    const after = (await save()).player;
    assert.ok(after.gold >= gold0 + 400, "les 400 or du stock sont à moi");
    assert.equal(after.resources.croc_de_loup, 7, "les ressources du stock aussi");
    assert.deepEqual(errors, []);
  });

  await step("Défense : l'alerte d'attaque, l'onglet Défense, le combat avec la sentinelle à mes côtés, puis le résultat", async () => {
    const { createGuild, addMember } = await import("../src/utils/guildCore.js");
    const { placeSentinel, sentinelsOf, rebuildSent } = await import("../src/utils/sentinel.js");
    const { getPopulation } = await import("../src/sim/population.js");
    const { isActive, STEP_MS } = await import("../src/sim/lives.js");
    const s = await save();
    const sims = s.player.market.sims, G = sims.guilds, step0 = s.player.market.bucket;
    const lone = Object.values(G.byId).find((x) => x.name === "Les Gardiens de Test");
    assert.ok(lone, "la guilde de l'étape précédente est là");
    const g = createGuild(G, { founder: "player", name: "Les Veilleurs", step: step0 });
    g.level = 12; g.gold = 5000;
    const byLevel = getPopulation().filter((b) => sims.lives[b.id] && !G.of[b.id]).sort((a, b) => sims.lives[a.id].level - sims.lives[b.id].level);
    const online = byLevel.filter((b) => isActive(b, Math.floor(Date.now() / STEP_MS))).slice(-2);          // deux membres connectés, forts
    for (const b of online) addMember(G, g, b.id, step0);
    placeSentinel(G, g, "prairies_sauvages", step0);
    Object.assign(sentinelsOf(g).prairies_sauvages, { gold: 300, res: {} });
    rebuildSent(G);
    const by = byLevel.slice(0, 2).map((b) => b.id);                                                       // deux attaquants débutants
    g.attacks = [{ id: "ui:1", region: "prairies_sauvages", from: lone.id, by, at: step0, due: step0 + 50 }];
    s.world.mapKey = "prairies_sauvages"; s.savedAt = Date.now() + 2000;
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-defense")) { sessionStorage.setItem("ui-defense", "1"); localStorage.setItem("aldenmoor:save", m); } }, JSON.stringify(s));
    await page.reload(); await page.waitForTimeout(1000);
    await tab("Personnage").click();
    await page.locator("[data-defense-alert]").waitFor({ timeout: 10000 });
    assert.match(await page.locator("[data-defense-alert]").innerText(), /attaquée/);
    await page.locator("[data-defense-alert] button").click();
    await page.locator("[data-gd-defense]").waitFor({ timeout: 10000 });
    assert.equal(await page.locator("[data-gd-attack]").count(), 1);
    assert.match(await page.locator("[data-gd-def-timer]").innerText(), /min/);
    await page.locator('[data-gd-defend="ui:1"]').click();
    await page.locator(".cb-spell:not([disabled]), .cb-overlay").first().waitFor({ timeout: 20000 });
    if (process.env.SHOT_DEFENSE) await page.screenshot({ path: process.env.SHOT_DEFENSE });
    assert.ok((await page.locator(".cb-actor").count()) >= 4, "moi, la sentinelle, des alliés et les attaquants sont à l'écran");
    assert.equal(await page.locator("[data-sentinel-sprite]").count(), 1, "la sentinelle est à mes côtés");
    for (let i = 0; i < 300 && !(await page.locator(".cb-overlay").count()); i++) {
      const sp = page.locator(".cb-spell:not([disabled])");
      if (await sp.count()) await sp.first().click();
      else if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
      await page.waitForTimeout(400);
    }
    const title = (await page.locator(".cb-card h2").innerText()).toLowerCase();
    assert.match(title, /sentinelle (sauvée|détruite)/);
    await page.locator("[data-defense-done]").click(); await page.waitForTimeout(1500);
    assert.equal(await page.locator(".cb-root").count(), 0, "retour à la guilde");
    const after = (await save()).player.market.sims.guilds, mine = Object.values(after.byId).find((x) => x.name === "Les Veilleurs");
    assert.equal(mine.attacks, undefined, "l'attaque est réglée");
    const sentinel = sentinelsOf(mine).prairies_sauvages;
    if (/sauvée/.test(title)) assert.ok(sentinel && sentinel.shield > Date.now(), "sentinelle protégée 1 h");
    else assert.equal(sentinel, undefined, "sentinelle détruite");
    assert.deepEqual(errors, []);
  });

  await step("Défense : une attaque réglée sans moi (3 minutes écoulées) affiche son résultat à l'écran et dans le journal", async () => {
    const { placeSentinel, sentinelsOf, rebuildSent } = await import("../src/utils/sentinel.js");
    const { getPopulation } = await import("../src/sim/population.js");
    const s = await save();
    const sims = s.player.market.sims, G = sims.guilds, step0 = s.player.market.bucket;
    const g = Object.values(G.byId).find((x) => x.name === "Les Veilleurs"), lone = Object.values(G.byId).find((x) => x.name === "Les Gardiens de Test");
    delete g.sentinels; rebuildSent(G); placeSentinel(G, g, "prairies_sauvages", step0);       // une sentinelle neuve, sans protection
    const by = getPopulation().filter((b) => sims.lives[b.id] && !G.of[b.id]).sort((a, b) => sims.lives[a.id].level - sims.lives[b.id].level).slice(0, 2).map((b) => b.id);
    g.attacks = [{ id: "ui:2", region: "prairies_sauvages", from: lone.id, by, at: step0, due: step0 + 50, dueMs: Date.now() + 9000 }];
    s.savedAt = Date.now() + 2000;
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-defense2")) { sessionStorage.setItem("ui-defense2", "1"); localStorage.setItem("aldenmoor:save", m); } }, JSON.stringify(s));
    await page.reload(); await page.waitForTimeout(800);
    await tab("Personnage").click();
    assert.equal(await page.locator("[data-war-msg]").count(), 0, "pas de message avant la fin du compte à rebours");
    await page.locator("[data-defense-alert]").waitFor({ timeout: 8000 });
    await page.locator("[data-war-msg]").waitFor({ timeout: 30000 });
    assert.match(await page.locator("[data-war-msg]").innerText(), /Ta sentinelle de Prairies Sauvages (a été détruite par|a repoussé)/);
    assert.equal(await page.locator("[data-defense-alert]").count(), 0, "l'alerte a disparu");
    await page.waitForTimeout(1500);
    const mine = Object.values((await save()).player.market.sims.guilds.byId).find((x) => x.name === "Les Veilleurs");
    assert.equal(mine.attacks, undefined, "attaque réglée"); assert.match(mine.log[0].txt, /Ta sentinelle de Prairies Sauvages/);
    assert.deepEqual(errors, []);
  });

  await step("Sac : emplacements, objets et ressources, agrandissement payant, rangement au coffre", async () => {
    const mod = JSON.stringify(await (async () => { const s = await save(); s.player.gold = 5000; s.player.inventory = s.player.inventory.slice(0, 6); s.player.resources = {}; delete s.player.bagUpgrades; s.savedAt = Date.now() + 2000; return s; })());
    await page.addInitScript((m) => { if (!sessionStorage.getItem("ui-sac")) { sessionStorage.setItem("ui-sac", "1"); localStorage.setItem("aldenmoor:save", m); } }, mod);
    await page.reload(); await page.waitForTimeout(800);
    await tab("Sac").click(); await page.waitForTimeout(300);
    assert.ok(await page.locator("[data-bag]").isVisible(), "écran du sac");
    const read = async () => (await page.locator("[data-bag-count]").innerText()).replace(/\s/g, "").match(/^(\d+)\/(\d+)$/).slice(1).map(Number);
    const [used, cap] = await read();
    assert.equal(cap, 40, "40 emplacements au départ");
    assert.equal(used, (await page.locator("[data-bag-item]").count()) + (await page.locator("[data-bag-res]").count()), "emplacements = objets + types de ressources");
    await page.locator("[data-bag-upgrade]").click(); await page.waitForTimeout(200);
    assert.equal((await read())[1], 45, "agrandi de 5");
    if (process.env.SHOT_SAC) await page.screenshot({ path: process.env.SHOT_SAC });
    const items = await page.locator("[data-bag-item]").count();
    if (items) { await page.locator("[data-bag-deposit-item]").first().click(); await page.waitForTimeout(200); assert.equal(await page.locator("[data-bag-item]").count(), items - 1, "objet rangé au coffre"); assert.equal((await read())[0], used - 1); }
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
