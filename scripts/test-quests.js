// Tests des quêtes et de la réputation :  node scripts/test-quests.js
import assert from "node:assert/strict";
import {
  questsOf, dayKey, boardFor, acceptQuest, abandonQuest, completeQuest, progressOf, standingOf, perksOf, questLabel,
} from "../src/utils/quests.js";
import { applyRewards } from "../src/utils/progression.js";
import { applyGather } from "../src/utils/gathering.js";
import { applyCraft } from "../src/utils/crafting.js";
import { bankCapacity, BANK_START } from "../src/utils/bank.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { QUEST_TEMPLATES, MAX_ACTIVE_QUESTS, BOARD_SIZE, MAX_STANDING, standingXpForLevel } from "../src/data/quests.js";
import { ENEMIES } from "../src/data/zones.js";
import { RESOURCES } from "../src/data/resources.js";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Quêtes");

const NOW = new Date(2026, 10, 7, 12, 0, 0).getTime();
const DAY = 86400e3;
const base = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), ...extra });
const find = (p, tplId, now = NOW) => boardFor(p, now).find((q) => q.tpl === tplId);

test("les modèles sont cohérents avec les données du jeu", () => {
  for (const t of QUEST_TEMPLATES) {
    assert.ok(t.qty[0] >= 1 && t.qty[1] >= t.qty[0], t.id);
    if (t.type === "kill") assert.ok(ENEMIES[t.target]?.gold && ENEMIES[t.target].xp, t.id);
    if (t.type === "gather" || t.type === "deliver") assert.ok(RESOURCES[t.target], t.id);
    if (t.type === "craft") assert.ok(ITEMS[t.target] && RECIPES[t.target], t.id);
  }
  assert.equal(new Set(QUEST_TEMPLATES.map((t) => t.id)).size, QUEST_TEMPLATES.length);
});

test("le tableau est le même toute la journée, change le lendemain, et reste raisonnable", () => {
  const p = base();
  const a = boardFor(p, NOW), b = boardFor(p, NOW + 3 * 3600e3), c = boardFor(p, NOW + DAY);
  assert.deepEqual(a, boardFor(p, NOW));
  assert.ok(a.length >= 4 && a.length <= BOARD_SIZE);
  assert.deepEqual(a.map((q) => q.id).slice(0, 2), b.map((q) => q.id).slice(0, 2));
  assert.notDeepEqual(a.map((q) => q.id), c.map((q) => q.id));
  assert.ok(a.every((q) => q.rewards.gold >= 5 && q.rewards.xp >= 0 && q.rewards.rep >= 3 && q.qty >= 1));
  assert.ok(dayKey(NOW + DAY) === dayKey(NOW) + 1);
});

test("une quête de récolte de niveau 3 n'apparaît pas à un joueur de métier niveau 1", () => {
  for (let d = 0; d < 40; d++) {
    const board = boardFor(base(), NOW + d * DAY);
    assert.ok(!board.some((q) => ["gather_chene", "gather_cuivre", "gather_sauge"].includes(q.tpl)));
  }
  let seen = false;
  const pro = { ...base(), professions: { ...base().professions, bucheron: { level: 3, xp: 0 } } };
  for (let d = 0; d < 40; d++) if (boardFor(pro, NOW + d * DAY).some((q) => q.tpl === "gather_chene")) seen = true;
  assert.ok(seen, "jamais proposée à un bûcheron niveau 3");
});

test("accepter : maximum 3 quêtes, une même quête ne s'accepte pas deux fois", () => {
  let p = base();
  const ids = boardFor(p, NOW).map((q) => q.id);
  for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) { const r = acceptQuest(p, ids[i], NOW); assert.ok(r.ok); p = r.player; }
  assert.equal(questsOf(p).active.length, MAX_ACTIVE_QUESTS);
  assert.equal(acceptQuest(p, ids[3], NOW).reason, "limite");
  const one = acceptQuest(base(), ids[0], NOW).player;
  assert.equal(acceptQuest(one, ids[0], NOW).reason, "introuvable");
  assert.ok(!boardFor(one, NOW).some((q) => q.id === ids[0]));
  assert.equal(acceptQuest(base(), "n'importe-quoi", NOW).reason, "introuvable");
});

test("kill : seuls les combats gagnés APRÈS l'acceptation comptent, jusqu'à la quantité demandée", () => {
  let p = applyRewards(base(), { xp: 0, gold: 0, resources: {}, items: [], kills: { loup_des_plaines: 5 } }).player;   // avant : ne compte pas
  let q = find(p, "kill_loup") || boardFor(p, NOW).find((x) => x.type === "kill");
  const target = q.target;
  p = acceptQuest(p, q.id, NOW).player;
  assert.equal(progressOf(p, questsOf(p).active[0]).have, 0);
  p = applyRewards(p, { xp: 0, gold: 0, resources: {}, items: [], kills: { [target]: 2 } }).player;
  assert.equal(progressOf(p, questsOf(p).active[0]).have, 2);
  p = applyRewards(p, { xp: 0, gold: 0, resources: {}, items: [], kills: { [target]: 100 } }).player;
  const pr = progressOf(p, questsOf(p).active[0]);
  assert.ok(pr.done && pr.have === pr.need);                                               // plafonné à la quantité
  const other = Object.keys(ENEMIES).find((k) => k !== target && ENEMIES[k].gold);
  assert.ok(applyRewards(base(), { kills: { [other]: 3 } }).player.quests.counters.kills[other] === 3);
});

test("récolte et fabrication comptent aussi", () => {
  let p = base({ resources: {}, gold: 1000 });
  const g = find(p, "gather_frene");
  if (g) {
    p = acceptQuest(p, g.id, NOW).player;
    p = applyGather(p, "frene", 4).player;
    assert.equal(progressOf(p, questsOf(p).active[0]).have, 4);
  }
  let c = base({ gold: 1000, resources: { peau_de_sanglier: 10, minerai_de_fer: 10, defense_ebrechee: 5 } });
  let cq; for (let d = 0; d < 60 && !cq; d++) { cq = boardFor(c, NOW + d * DAY).find((q) => q.tpl === "craft_gants_veteran"); if (cq) c = acceptQuest(c, cq.id, NOW + d * DAY).player; }
  assert.ok(cq, "quête de fabrication jamais proposée");
  assert.equal(progressOf(c, questsOf(c).active[0]).have, 0);
  c = applyCraft(c, "gants_veteran", "u-1");
  assert.ok(progressOf(c, questsOf(c).active[0]).done);
});

test("livraison : refusée tant qu'il manque des ressources ; à la remise, les ressources partent et l'or arrive", () => {
  let p = base({ resources: {} });
  let q, day; for (let d = 0; d < 60 && !q; d++) { q = boardFor(p, NOW + d * DAY).find((x) => x.type === "deliver"); day = NOW + d * DAY; }
  p = acceptQuest(p, q.id, day).player;
  assert.equal(completeQuest(p, q.id, day).reason, "incomplete");
  p = { ...p, resources: { [q.target]: q.qty + 3 } };
  const r = completeQuest(p, q.id, day);
  assert.ok(r.ok);
  assert.equal(r.player.resources[q.target], 3);
  assert.equal(r.gold, q.rewards.gold);                                                   // réputation 1 : pas de bonus
  assert.equal(r.player.gold, p.gold + q.rewards.gold);
  assert.equal(questsOf(r.player).active.length, 0);
  assert.equal(completeQuest(r.player, q.id, day).reason, "introuvable");               // pas de double récompense
  assert.ok(!boardFor(r.player, day).some((x) => x.id === q.id));                        // plus au tableau aujourd'hui
});

test("remettre exactement la quantité retire la ressource du sac", () => {
  let p = base({ resources: {} });
  let q, day; for (let d = 0; d < 60 && !q; d++) { q = boardFor(p, NOW + d * DAY).find((x) => x.type === "deliver"); day = NOW + d * DAY; }
  p = { ...acceptQuest(p, q.id, day).player, resources: { [q.target]: q.qty } };
  const r = completeQuest(p, q.id, day);
  assert.equal(r.player.resources[q.target], undefined);
});

test("récompenses : xp donnée (niveaux gagnés), réputation, et le niveau de réputation monte", () => {
  let p = base({ resources: {} });
  let q, day; for (let d = 0; d < 60 && !q; d++) { q = boardFor(p, NOW + d * DAY).find((x) => x.type === "deliver"); day = NOW + d * DAY; }
  p = { ...acceptQuest(p, q.id, day).player, resources: { [q.target]: q.qty } };
  const r = completeQuest(p, q.id, day);
  assert.ok(r.player.xp > 0 || r.player.level > 1);
  assert.equal(questsOf(r.player).rep.aldenmoor, q.rewards.rep);
  const lots = { ...r.player, quests: { ...questsOf(r.player), rep: { aldenmoor: standingXpForLevel(1) } } };
  assert.equal(standingOf(lots).level, 2);
});

test("réputation : paliers, titre, maximum, et avantages (or +3 %/niveau, coffre +5 emplacements tous les 2 niveaux)", () => {
  const withRep = (xp) => ({ ...base(), quests: { active: [], done: { day: -1, ids: [] }, rep: { aldenmoor: xp } } });
  assert.deepEqual([standingOf(base()).level, standingOf(base()).title], [1, "Étranger"]);
  assert.equal(standingOf(withRep(standingXpForLevel(1) - 1)).level, 1);
  assert.equal(standingOf(withRep(standingXpForLevel(1))).level, 2);
  assert.equal(standingOf(withRep(1e9)).level, MAX_STANDING);
  assert.equal(standingOf(withRep(1e9)).next, null);
  assert.deepEqual(perksOf(base()), { bankSlots: 0, goldBonus: 0 });
  assert.equal(perksOf(withRep(1e9)).bankSlots, 20);
  assert.ok(Math.abs(perksOf(withRep(1e9)).goldBonus - 0.27) < 1e-9);
  assert.equal(bankCapacity(base()), BANK_START);
  assert.equal(bankCapacity(withRep(1e9)), BANK_START + 20);
});

test("le bonus de réputation augmente l'or de la quête", () => {
  let p = base({ resources: {} });
  let q, day; for (let d = 0; d < 60 && !q; d++) { q = boardFor(p, NOW + d * DAY).find((x) => x.type === "deliver"); day = NOW + d * DAY; }
  p = { ...acceptQuest(p, q.id, day).player, resources: { [q.target]: q.qty } };
  p = { ...p, quests: { ...questsOf(p), rep: { aldenmoor: 1e9 } } };
  const r = completeQuest(p, q.id, day);
  assert.equal(r.gold, Math.round(q.rewards.gold * 1.27));
});

test("abandonner une quête la retire (sans récompense) et elle peut être reprise", () => {
  let p = base();
  const q = boardFor(p, NOW)[0];
  p = acceptQuest(p, q.id, NOW).player;
  const r = abandonQuest(p, q.id);
  assert.ok(r.ok && questsOf(r.player).active.length === 0 && r.player.gold === p.gold);
  assert.ok(boardFor(r.player, NOW).some((x) => x.id === q.id));
  assert.equal(abandonQuest(r.player, q.id).ok, false);
});

test("anciennes sauvegardes (sans quêtes) fonctionnent ; libellés lisibles", () => {
  const old = base(); delete old.quests;
  assert.equal(questsOf(old).active.length, 0);
  assert.ok(boardFor(old, NOW).length > 0);
  for (const q of boardFor(old, NOW)) assert.ok(questLabel(q).length > 5 && !questLabel(q).includes("undefined"));
});

test("l'or des quêtes reste proche de la valeur du travail : au plus 1,25 × le prix du marché ou des monstres", () => {
  const strong = { ...base(), professions: Object.fromEntries(Object.keys(base().professions).map((k) => [k, { level: 3, xp: 0 }])) };
  let checked = 0;
  for (let d = 0; d < 60; d++) {
    for (const q of boardFor(strong, NOW + d * DAY)) {
      checked++;
      if (q.type === "gather" || q.type === "deliver") assert.ok(q.rewards.gold <= Math.ceil(1.25 * q.qty * RESOURCES[q.target].value) + 5, q.id);
      if (q.type === "kill") { const [lo, hi] = ENEMIES[q.target].gold; assert.ok(q.rewards.gold <= Math.ceil(1.3 * q.qty * (lo + hi) / 2) + 5, q.id); }
      assert.ok(q.rewards.gold < 600, `${q.id} : ${q.rewards.gold} or`);
    }
  }
  assert.ok(checked > 200);
});

console.log(`\n${n} tests passent.`);
