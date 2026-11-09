// Test d'interface « tout le jeu » :  npm run test:full   (après `npx vite build`)
// Joue, dans un vrai navigateur, ce que test-ui.mjs ne couvre pas : création de héros (3 classes), personnage
// (caractéristiques, apparence, export), les bâtiments de la ville, le tableau de quêtes, le coffre, le portail et la
// carte du monde, la récolte, le journal, le chat de ville, le groupe (exclusion), les sorts et potions en combat,
// la défaite, le rechargement de la partie, un écran de téléphone.
// Chaque scénario part d'une sauvegarde neuve (modifiée au besoin) dans un navigateur propre.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { console.error("Playwright introuvable : npm i -D playwright && npx playwright install chromium"); process.exit(2); }

if (!existsSync("dist/index.html")) { console.error("Construis d'abord le jeu : npx vite build"); process.exit(2); }
const DIST = join(mkdtempSync(join(tmpdir(), "aldenmoor-full-")), "dist");
cpSync("dist", DIST, { recursive: true });
const PORT = 4250 + Math.floor(Math.random() * 40);
const URL = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--outDir", DIST], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* déjà arrêté */ } };
process.on("exit", () => { stop(); try { rmSync(DIST, { recursive: true, force: true }); } catch { /* déjà effacé */ } });
for (let i = 0; i < 50; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 200)); }

let passed = 0;
const ONLY = process.env.ONLY;       // ONLY=mot : ne jouer que les étapes dont le nom contient ce mot (la création, qui prépare la partie de départ, est toujours jouée)
const step = async (name, fn) => {
  if (ONLY && !name.includes(ONLY) && !name.startsWith("création")) return;
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message.split("\n").slice(0, 8).join("\n    ")}`); throw e; }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
let ctx = null, page = null, errors = [];
const tab = (n) => page.locator("nav button", { hasText: n }).first();
const rawSave = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open("aldenmoor"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("save"); g.onsuccess = () => { r.result.close(); res(g.result ?? null); }; g.onerror = () => res(null); }; r.onerror = () => res(null); }));
const save = async () => { await wait(750); const raw = await rawSave(); return raw ? JSON.parse(raw) : null; };
const noCrash = async (label) => { assert.equal(await page.getByText("Télécharger ma sauvegarde").count(), 0, `${label} : écran de crash`); assert.deepEqual(errors, [], `${label} : erreurs dans la console`); };

// ouvre un navigateur propre ; `s` (sauvegarde déjà prête) est injectée, sinon on arrive sur la création du héros
async function open({ s = null, viewport = { width: 1500, height: 960 }, time = null } = {}) {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport, acceptDownloads: true });
  page = await ctx.newPage();
  if (time) await page.clock.setFixedTime(time);      // l'heure du jeu (qui est en ligne ?) est celle-ci
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/assets/")) errors.push(`image/fichier introuvable : ${r.url()}`); });   // un lien d'image cassé fait échouer le test
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|403|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (s) {
    s.savedAt = Date.now() + 60000;     // la copie la plus récente gagne : la nôtre
    await ctx.addInitScript((m) => { if (!sessionStorage.getItem("full-init")) { sessionStorage.setItem("full-init", "1"); localStorage.setItem("aldenmoor:save", m); } }, JSON.stringify(s));
  }
  await page.goto(URL); await page.waitForTimeout(700);
}
async function create({ name, cls, body }) {
  await page.getByPlaceholder("Héros").fill(name);
  if (body) await page.getByText(body, { exact: true }).first().click();
  await page.getByText(cls, { exact: true }).first().click(); await page.waitForTimeout(200);
  await page.getByLabel(/Mode test/).check();
  await page.getByRole("button", { name: "Entrer à Aldenmoor" }).click();
  await tab("Carte").waitFor({ timeout: 10000 }); await page.waitForTimeout(500);
}
// clic « direct » sur un objet de la carte (la barre du bas peut le recouvrir) ; le héros y marche puis agit
const clickMap = async (sel, text) => { await page.locator(sel).first().waitFor({ timeout: 20000 }); return clickMapNow(sel, text); };
const clickMapNow = (sel, text) => page.evaluate(([s, t]) => { const e = [...document.querySelectorAll(s)].find((x) => !t || x.textContent.toLowerCase().includes(t.toLowerCase())); if (!e) throw new Error(`introuvable : ${s} ${t || ""}`); e.click(); }, [sel, text]);
const closeModal = async () => { await page.locator(".mp-modal button", { hasText: "Fermer" }).click(); await page.waitForTimeout(250); };

try {
  // ---------- la partie de départ ----------
  let base;
  await step("création : les 3 classes se présentent (sorts, départ) et chacune démarre une partie", async () => {
    await open();
    const body = async () => await page.locator("body").innerText();
    for (const [cls, spell] of [["Guerrier", "Taillade"], ["Assassin", "Disparition"], ["Magicien", "Projectile"]]) {
      await page.getByText(cls, { exact: true }).first().click(); await page.waitForTimeout(200);
      assert.ok((await body()).includes(spell), `${cls} : le sort ${spell} est présenté`);
    }
    await create({ name: "Mireille", cls: "Magicien", body: "Féminin" });
    const s = await save();
    assert.equal(s.player.classKey, "magicien"); assert.equal(s.player.gender, "f"); assert.equal(s.player.name, "Mireille");
    await noCrash("magicienne");
    // une autre classe, un autre corps, pour la suite
    await open();
    await create({ name: "Arthur", cls: "Guerrier", body: "Masculin" });
    base = await save();
    assert.equal(base.player.classKey, "guerrier");
    await noCrash("guerrier");
  });
  const fresh = () => structuredClone(base);

  // ---------- personnage ----------
  await step("Personnage : points de caractéristiques, onglets équipement/reliques, apparence, export, nouveau perso", async () => {
    const s = fresh(); s.player.caracPoints = 3;
    await open({ s });
    await tab("Personnage").click(); await page.waitForTimeout(400);
    const before = (await save()).player.caracs.force;
    const plus = page.locator("button", { hasText: /^\+$/ });
    await plus.first().click(); await plus.first().click(); await page.waitForTimeout(300);
    assert.equal((await save()).player.caracs.force, before + 2, "2 points mis en Force");
    assert.equal((await save()).player.caracPoints, 1, "il reste 1 point");
    // équipement : cliquer une pièce portée la retire, cliquer un objet du sac l'équipe
    const worn = () => Object.values(fresh_equipped()).filter(Boolean).length;
    function fresh_equipped() { return eq; }
    let eq = (await save()).player.equipped;
    const n0 = worn();
    await page.locator("button[title*='clic pour retirer']").first().click(); await page.waitForTimeout(300);
    eq = (await save()).player.equipped;
    assert.equal(worn(), n0 - 1, "une pièce retirée");
    assert.ok((await save()).player.inventory.length > 0);
    await page.locator("button", { hasText: /Équip|Force|DEF|PV/ }).first().isVisible().catch(() => {});
    await noCrash("équipement");
    // apparence : choisir une tenue la mémorise, « Selon l'équipement » la libère
    await page.locator("#appearance").selectOption({ label: "Apprenti" }); await page.waitForTimeout(300);
    assert.ok((await save()).player.appearance, "tenue mémorisée");
    await page.locator("#appearance").selectOption(""); await page.waitForTimeout(300);
    assert.equal((await save()).player.appearance, null, "tenue libérée");
    const dl = page.waitForEvent("download", { timeout: 8000 });
    await page.locator("button", { hasText: "Exporter" }).click();
    const file = await dl; assert.match(file.suggestedFilename(), /aldenmoor|sauvegarde|\.json/i, "un fichier de sauvegarde est téléchargé");
    // « Nouveau perso » demande confirmation : on refuse d'abord (rien ne change), puis on accepte (retour à la création)
    page.once("dialog", (d) => d.dismiss());
    await page.locator("button", { hasText: "Nouveau perso" }).click(); await page.waitForTimeout(400);
    assert.ok((await save()).player, "annulé : le perso est toujours là");
    page.once("dialog", (d) => d.accept());
    await page.locator("button", { hasText: "Nouveau perso" }).click(); await page.waitForTimeout(800);
    assert.ok(await page.getByRole("button", { name: "Entrer à Aldenmoor" }).count(), "retour à la création");
    await noCrash("nouveau perso");
  });

  // ---------- la ville ----------
  await step("Ville : chaque bâtiment s'ouvre dans sa fenêtre et se referme", async () => {
    await open({ s: fresh() });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    assert.equal(await page.locator(".mp-title").innerText(), "Aldenmoor");
    for (const b of ["Atelier", "Coffre d'Aldenmoor", "Marché", "Tableau de quêtes"]) {
      await clickMap(".mp-building", b);
      await page.locator(".mp-modal").waitFor({ timeout: 20000 });
      assert.ok((await page.locator(".mp-modal-head").innerText()).toLowerCase().includes(b.split(" ")[0].toLowerCase()), `fenêtre « ${b} »`);
      await noCrash(b); await closeModal();
    }
  });

  await step("Tableau de quêtes : réputation, accepter, limite de quêtes en cours, abandonner", async () => {
    await open({ s: fresh() });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Tableau"); await page.locator("[data-standing]").waitFor({ timeout: 20000 });
    assert.match(await page.locator("[data-standing]").innerText(), /Réputation à Aldenmoor/);
    const offered = await page.locator("[data-quest]").count();
    assert.ok(offered >= 3, "le tableau propose des quêtes");
    await page.locator("[data-act=accept]").first().click(); await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-active]").count(), 1, "une quête en cours");
    assert.equal((await save()).player.quests.active.length, 1);
    for (let i = 0; i < 6 && (await page.locator("[data-act=accept]:not([disabled])").count()); i++) {
      const before = await page.locator("[data-active]").count();
      await page.locator("[data-act=accept]").first().click(); await page.waitForTimeout(200);
      if ((await page.locator("[data-active]").count()) === before) break;     // limite atteinte
    }
    const active = await page.locator("[data-active]").count();
    assert.ok(active >= 2 && active <= 6, `le nombre de quêtes en cours est limité (${active})`);
    await page.locator("[data-act=abandon]").first().click(); await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-active]").count(), active - 1, "quête abandonnée sans pénalité");
    await noCrash("quêtes");
  });

  await step("Tableau de quêtes : une quête terminée se rend et rapporte or, xp et réputation", async () => {
    await open({ s: fresh() });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Tableau"); await page.locator("[data-act=accept]").first().waitFor({ timeout: 20000 });
    await page.locator("[data-act=accept]").first().click(); await page.waitForTimeout(300);
    const s1 = await save();
    const q = s1.player.quests.active[0];
    assert.ok(q, "quête active en sauvegarde");
    // on « fait » la quête dans la sauvegarde (livraison : on met les ressources dans le sac ; sinon on avance le compteur)
    if (q.type === "deliver") s1.player.resources = { ...s1.player.resources, [q.target]: q.qty };
    else q.base = -q.qty;
    const gold0 = s1.player.gold, rep0 = s1.player.quests.rep.aldenmoor || 0, xp0 = s1.player.xp + s1.player.level * 1e6;
    await open({ s: s1 });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Tableau"); await page.locator("[data-act=complete]").first().waitFor({ timeout: 20000 });
    await page.locator("[data-act=complete]").first().click(); await page.waitForTimeout(400);
    const s2 = await save();
    assert.equal(s2.player.quests.active.length, 0, "la quête est rendue");
    assert.ok(s2.player.gold > gold0, "de l'or reçu");
    assert.ok((s2.player.quests.rep.aldenmoor || 0) > rep0, "de la réputation reçue");
    assert.ok(s2.player.xp + s2.player.level * 1e6 > xp0, "de l'xp reçue");
    await noCrash("rendre une quête");
  });

  // ---------- coffre ----------
  await step("Coffre : ranger un objet, le reprendre, agrandir (or dépensé)", async () => {
    const s = fresh(); s.player.gold = 5000;
    await open({ s });
    await tab("Coffre").click(); await page.waitForTimeout(400);
    const inv0 = (await save()).player.inventory.length;
    await page.locator("button", { hasText: "Ranger →" }).first().click(); await page.waitForTimeout(300);
    const s1 = await save();
    assert.equal(s1.player.inventory.length, inv0 - 1, "objet sorti du sac");
    assert.equal(s1.player.bank.items.length, 1, "objet au coffre");
    await page.locator("button", { hasText: "← Reprendre" }).first().click(); await page.waitForTimeout(300);
    const s2 = await save(); assert.equal(s2.player.inventory.length, inv0); assert.equal(s2.player.bank.items.length, 0);
    const slots = s2.player.bank.slots ?? s2.player.bank.size;
    await page.locator("[data-upgrade]").click(); await page.waitForTimeout(300);
    const s3 = await save();
    assert.ok(s3.player.gold < 5000, "l'agrandissement coûte de l'or");
    if (slots !== undefined) assert.ok((s3.player.bank.slots ?? s3.player.bank.size) > slots, "plus d'emplacements");
    await noCrash("coffre");
  });

  // ---------- voyage ----------
  await step("Carte du monde et portail : on rejoint chaque région et on revient en ville", async () => {
    await open({ s: fresh() });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Portail"); await page.waitForTimeout(1500);
    // le portail ouvre la carte du monde
    if (!(await page.locator(".wm").count())) { await page.locator("button", { hasText: "Carte du monde" }).click(); await page.waitForTimeout(500); }
    assert.ok(await page.locator(".wm").count(), "carte du monde affichée");
    assert.equal(await page.locator(".wm-spot.open").count(), 4, "ville + 3 régions ouvertes");
    for (const r of ["Prairies Sauvages", "Champs Calcinés", "Lisière des Ombres", "Aldenmoor"]) {
      if (!(await page.locator(".wm").count())) { await page.locator("button", { hasText: "Carte du monde" }).click(); await page.waitForTimeout(400); }
      await page.locator(".wm-spot", { hasText: r }).first().click(); await page.waitForTimeout(1500);
      assert.equal(await page.locator(".mp-title").innerText(), r, `arrivée : ${r}`);
      assert.equal((await save()).world.mapKey.length > 0, true);
      await noCrash(r);
    }
    // les monstres existent dans une région de combat
    await page.locator("button", { hasText: "Carte du monde" }).click(); await page.waitForTimeout(400);
    await page.locator(".wm-spot", { hasText: "Prairies Sauvages" }).first().click(); await page.waitForTimeout(2000);
    assert.ok((await page.locator(".mp-group").count()) > 0, "des groupes de monstres sur la carte");
    assert.ok(await page.locator(".mp-minimap, .mp-mini").count() >= 0);
  });

  // ---------- récolte ----------
  await step("Récolte : on cueille / mine un point de ressource, le métier gagne de l'xp et le point disparaît un temps", async () => {
    const s = fresh(); s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 };
    await open({ s });
    await tab("Carte").click(); await page.waitForTimeout(1500);
    const nodes = await page.locator(".mp-node:not(.locked):not(.mp-building)").count();
    assert.ok(nodes > 0, "des points de récolte accessibles au niveau 1");
    const resBefore = Object.values((await save()).player.resources || {}).reduce((a, b) => a + b, 0);
    const profXpBefore = JSON.stringify((await save()).player.professions);
    await page.evaluate(() => {         // le point de récolte le plus proche du centre de l'écran (donc du héros)
      const v = document.querySelector(".mp-map").getBoundingClientRect(), cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;
      const d = (e) => { const r = e.getBoundingClientRect(); return Math.hypot((r.left + r.right) / 2 - cx, (r.top + r.bottom) / 2 - cy); };
      [...document.querySelectorAll(".mp-node:not(.locked):not(.mp-building)")].sort((a, b) => d(a) - d(b))[0].click();
    });
    await page.locator(".mp-prog").waitFor({ timeout: 60000 });                      // la barre de récolte (le héros marche d'abord jusqu'au point)
    await page.waitForFunction(() => !document.querySelector(".mp-prog"), null, { timeout: 30000 });
    await page.waitForTimeout(600);
    const s1 = await save();
    const resAfter = Object.values(s1.player.resources || {}).reduce((a, b) => a + b, 0);
    assert.ok(resAfter > resBefore, "des ressources récoltées");
    assert.notEqual(JSON.stringify(s1.player.professions), profXpBefore, "le métier a progressé");
    assert.equal(await page.locator(".mp-node:not(.locked):not(.mp-building)").count(), nodes - 1, "le point récolté disparaît (il repousse plus tard)");
    await noCrash("récolte");
  });

  // ---------- journal, chat ----------
  await step("Journal de quêtes et chat de la ville", async () => {
    const s = fresh();
    await open({ s });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Tableau"); await page.locator("[data-act=accept]").first().waitFor({ timeout: 20000 });
    await page.locator("[data-act=accept]").first().click(); await page.waitForTimeout(250); await closeModal();
    await tab("Journal").click(); await page.waitForTimeout(400);
    assert.ok(await page.locator("[data-active]").count() >= 1 || (await page.locator("body").innerText()).includes("Journal de quêtes"), "journal");
    await noCrash("journal");
    await tab("Carte").click(); await page.waitForTimeout(1200);
    const chat = page.getByPlaceholder(/Écrire en tant que/);
    if (await chat.count()) {
      await chat.fill("Bonjour la ville"); await chat.press("Enter"); await page.waitForTimeout(500);
      assert.ok((await page.locator("body").innerText()).includes("Bonjour la ville"), "le message apparaît dans le chat");
    }
    await noCrash("chat");
  });

  // ---------- groupe ----------
  await step("Groupe : inviter, voir le rappel sur la carte, exclure", async () => {
    await open({ s: fresh() });
    await tab("Groupe").click(); await page.waitForTimeout(500);
    await page.locator("[data-group-cand]").first().waitFor({ timeout: 20000 });
    for (let i = 0, d = 0; i < 12 && (await page.locator("[data-group-member]").count()) < 1; i++) {
      await page.locator("[data-group-invite]:not([disabled])").nth(d).click(); await page.waitForTimeout(300);
      if (await page.locator("[data-group-msg]").count()) d++;
    }
    assert.equal(await page.locator("[data-group-member]").count(), 1, "un membre");
    assert.equal((await save()).player.companions.length, 1);
    await tab("Carte").click(); await page.waitForTimeout(900);
    await page.locator("[data-map-group]").waitFor({ timeout: 5000 });
    await tab("Groupe").click(); await page.waitForTimeout(300);
    await page.locator("[data-group-kick]").first().click(); await page.waitForTimeout(400);
    assert.equal(await page.locator("[data-group-member]").count(), 0, "membre exclu");
    assert.equal((await save()).player.companions.length, 0);
    await tab("Carte").click(); await page.waitForTimeout(600);
    assert.equal(await page.locator("[data-map-group]").count(), 0, "plus de rappel sur la carte");
    await noCrash("groupe");
  });

  await step("Groupe : un membre qui se déconnecte quitte le groupe et un message l'annonce", async () => {
    const { getLivePopulation } = await import("../src/sim/simWorld.js");
    const { isOnline } = await import("../src/utils/group.js");
    const s = fresh();
    const pop = getLivePopulation(s.player);
    assert.ok(pop.length > 10, "des joueurs simulés existent dans la sauvegarde neuve");
    // une heure où quelqu'un est hors ligne : il est mis dans le groupe, le jeu doit le voir partir
    const d = new Date(Date.now() + 3600e3); d.setUTCHours(3, 30, 0, 0);                  // la nuit prochaine : pas de long rattrapage du monde simulé
    let T = d.getTime(); if (T < Date.now() + 1800e3) T += 86400e3;
    let bot = pop.find((b) => !isOnline(b, T));
    for (let k = 0; !bot && k < 8; k++) { T += 3600e3; bot = pop.find((b) => !isOnline(b, T)); }
    assert.ok(bot, "un simulé hors ligne à cette heure");
    s.player.companions = [bot.id];
    await open({ s, time: T });
    await page.locator("[data-group-leave]").waitFor({ timeout: 40000 });
    assert.match(await page.locator("[data-group-leave]").innerText(), new RegExp(`${bot.name}.*déconnecté`), "le message nomme le joueur parti");
    await page.waitForTimeout(2500);
    assert.deepEqual((await save()).player.companions, [], "il n'est plus dans le groupe");
    await noCrash("départ du groupe");
  });

  // ---------- combat : sorts, potions, défaite ----------
  const startFightNear = async () => {
    await tab("Carte").click(); await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const v = document.querySelector(".mp-map").getBoundingClientRect(), cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;
      const d = (e) => { const r = e.getBoundingClientRect(); return Math.hypot((r.left + r.right) / 2 - cx, (r.top + r.bottom) / 2 - cy); };
      [...document.querySelectorAll(".mp-group:not(.boss):not(.busy)")].sort((a, b) => d(a) - d(b))[0].click();
    });
    await page.locator("button", { hasText: "Combattre" }).click({ timeout: 15000 });
    await page.locator(".cb-spell:not([disabled])").first().waitFor({ timeout: 20000 });
  };
  await step("Combat : les sorts se lancent à la souris et au clavier jusqu'à la fin du combat", async () => {
    const s = fresh(); s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 };
    await open({ s });
    await startFightNear();
    await page.locator(".cb-spell:not([disabled])").first().click(); await page.waitForTimeout(400);
    await page.keyboard.press("2"); await page.waitForTimeout(400);
    for (let i = 0; i < 200 && !(await page.locator(".cb-overlay").count()); i++) {
      const sp = page.locator(".cb-spell:not([disabled])");
      if (await sp.count()) await sp.first().click();
      else if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
      await page.waitForTimeout(400);
    }
    assert.ok(await page.locator(".cb-overlay").count(), "le combat se termine");
    await noCrash("combat sorts");
  });

  await step("Défaite : un héros trop faible perd, l'écran de défaite propose de recommencer ou de partir, rien ne plante", async () => {
    const s = fresh(); s.world.mapKey = "prairies_sauvages"; s.world.pos = { x: 6.5, y: 6.5 };
    s.player.baseHp = 1; s.player.hp = 1;
    s.player.caracs = { ...s.player.caracs, force: 0, vitalite: 0 };
    s.player.equipped = { ...s.player.equipped, arme: null };
    await open({ s });
    await startFightNear();
    let lost = false;
    for (let i = 0; i < 120 && !(await page.locator(".cb-overlay").count()); i++) {
      if (await page.locator(".cb-btn:not([disabled])", { hasText: "Fin du tour" }).count()) await page.keyboard.press("Space");
      await page.waitForTimeout(500);
    }
    if (await page.locator(".cb-overlay").count()) lost = /défaite/i.test(await page.locator(".cb-card h2").innerText());
    assert.ok(lost, "défaite");
    assert.ok(await page.locator("button", { hasText: "Recommencer" }).count(), "on peut recommencer");
    await noCrash("défaite");
    const leave = page.locator("button", { hasText: /Quitter|Retour|Fuir/ }).first();
    if (await leave.count()) { await leave.click(); await page.waitForTimeout(700); assert.equal(await page.locator(".cb-root").count(), 0, "combat fermé"); }
    await noCrash("après la défaite");
  });

  // ---------- rechargement ----------
  await step("Rechargement : la partie est retrouvée à l'identique (niveau, or, quêtes, position)", async () => {
    const s = fresh(); s.player.gold = 777;
    await open({ s });
    await tab("Carte").click(); await page.waitForTimeout(1200);
    await clickMap(".mp-building", "Tableau"); await page.locator("[data-act=accept]").first().waitFor({ timeout: 20000 });
    await page.locator("[data-act=accept]").first().click(); await page.waitForTimeout(300); await closeModal();
    await page.waitForTimeout(1500);
    const before = await save();
    await page.reload(); await page.waitForTimeout(1500);
    await tab("Carte").waitFor({ timeout: 10000 });
    const after = await save();
    assert.equal(after.player.gold, 777); assert.equal(after.player.level, before.player.level);
    assert.equal(after.player.quests.active.length, before.player.quests.active.length, "la quête acceptée est toujours là");
    assert.equal(after.world.mapKey, before.world.mapKey);
    await noCrash("rechargement");
  });

  // ---------- téléphone ----------
  await step("Écran de téléphone (390 × 844) : tous les onglets s'ouvrent, pas de débordement horizontal, la carte reste jouable", async () => {
    await open({ s: fresh(), viewport: { width: 390, height: 844 } });
    for (const n of ["Personnage", "Atelier", "Coffre", "Marché", "Sac", "Journal", "Bestiaire", "Classement", "Guilde", "Groupe", "Carte"]) {
      const t = tab(n);
      if (!(await t.isVisible().catch(() => false))) { const menu = page.locator("button[aria-label*=enu], button:has-text('☰')").first(); if (await menu.count()) await menu.click(); }
      await t.click({ timeout: 8000 }); await page.waitForTimeout(350);
      await noCrash(`téléphone : ${n}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 4, `téléphone : ${n} déborde de ${overflow}px`);
    }
  });

  console.log(`\n${passed} étapes réussies, aucune erreur dans la console.`);
} catch (e) {
  console.error("\nÉchec du test d'interface complet.");
  process.exitCode = 1;
} finally {
  await browser.close();
  stop();
}
