// Tests du Veilleur Corrompu (boss de la Lisière), de l'appel d'esprits, des armes uniques et de la chaîne de quêtes :  node scripts/test-boss.js
import assert from "node:assert/strict";
import { ITEMS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { ENEMIES } from "../src/data/zones.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { MAPS } from "../src/data/maps.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn, SOLO_XP_MULT } from "../src/combat/engine.js";
import { activeGroups } from "../src/utils/mapPath.js";
import { boardFor, acceptQuest, completeQuest, progressOf, questsOf } from "../src/utils/quests.js";
import { createPlayer } from "../src/utils/newPlayer.js";
import { applyCraft, canCraft } from "../src/utils/crafting.js";
import { getCraftInfo, PROFESSIONS, recipesOfProfession } from "../src/data/professions.js";
import { RESOURCES } from "../src/data/resources.js";
import { perkLines } from "../src/utils/perks.js";
import { CLASSES } from "../src/data/classes.js";
import { CHAIN_QUESTS } from "../src/data/quests.js";
import { craftFee, unitFee, taxFee } from "../src/utils/cityTax.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Veilleur Corrompu");

const boss = ENEMIES.veilleur_corrompu;
const UNIQUE = { guerrier: "lame_du_veilleur", assassin: "croc_du_veilleur", magicien: "sceptre_du_veilleur" };
const relic = ITEMS.lame_du_veilleur;
const baseStats = (equipped = {}) => calcStats({ level: 20, baseHp: 400, caracs: {}, equipped });
// Combat contre le boss, au tour du héros, avec un héros quasi invincible (pour observer le boss sans mourir)
function bossFight(seed = 5, stats = { ...baseStats(), maxHp: 1e6, esquive: 0 }) {
  let st = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 20, enemyKeys: ["veilleur_corrompu"], seed });
  return advance(st).state;
}
const strike = (st) => {
  st.player.pa = 6;
  const spell = st.player.spells.find((sp) => sp.type !== "buff" && sp.pa <= 6);
  return castSpell(st, spell.id, "e0");
};

test("le boss est complet : stats, 3 phases de jeu, rencontre, groupe sur la carte au respawn normal", () => {
  assert.ok(boss.stats && boss.actions.length >= 5 && boss.phases.length === 2);
  assert.deepEqual(boss.phases[0].summon, ["esprit_errant", "esprit_errant"]);
  assert.ok(boss.phases[0].below > boss.phases[1].below && boss.phases[1].atkMult > 1);
  assert.ok(boss.actions.some((a) => a.effect?.kind === "paLoss") && boss.actions.some((a) => a.effect?.kind === "defDown"));
  const enc = ENCOUNTERS.find((e) => e.id === "veilleur_boss");
  assert.ok(enc && enc.boss && enc.enemies.length === 1 && enc.enemies[0] === "veilleur_corrompu");
  const g = MAPS.lisiere_des_ombres.groups.find((x) => x.encounter === "veilleur_boss");
  assert.ok(g && g.respawnMs === undefined, "pas de délai spécial : il revient comme les autres groupes");
  const world = { cleared: { [g.id]: 1000 } };
  assert.ok(!activeGroups(MAPS.lisiere_des_ombres, world, 1000 + 1000).includes(g));
  assert.ok(activeGroups(MAPS.lisiere_des_ombres, world, 1000 + MAPS.lisiere_des_ombres.respawnMs).includes(g));
  // un groupe peut quand même avoir son propre délai (fonctionnalité conservée)
  const custom = { respawnMs: 5000, groups: [{ id: "x", respawnMs: 600000 }, { id: "y" }] };
  assert.deepEqual(activeGroups(custom, { cleared: { x: 0, y: 0 } }, 6000).map((o) => o.id), ["y"]);
});

test("butin : plus de clé sur le boss (elle se fabrique), une essence, et une arme unique par classe, très rare et non fabricable", () => {
  assert.ok(!boss.drops.some((d) => d.id === "cle_du_manoir"), "la clé ne tombe plus sur le boss");
  assert.ok(boss.drops.some((d) => d.id === "essence_du_veilleur" && d.chance >= 0.5));
  assert.ok(!boss.drops.some((d) => d.id === "lanterne_du_veilleur") && !ITEMS.lanterne_du_veilleur, "plus de relique");
  const uniques = boss.drops.filter((d) => d.forClass);
  assert.deepEqual(uniques.map((d) => d.forClass).sort(), ["assassin", "guerrier", "magicien"], "une arme par classe");
  for (const d of uniques) {
    assert.equal(d.id, UNIQUE[d.forClass]);
    assert.ok(d.chance > 0 && d.chance <= 0.08, "5 % au plus");
    const it = ITEMS[d.id];
    assert.equal(it.type, "arme"); assert.equal(it.rarity, "legendaire"); assert.equal(it.classKey, d.forClass);
    assert.ok(!RECIPES[d.id], "ne se fabrique pas");
    assert.equal(it.weaponType, ITEMS[CLASSES[d.forClass].startWeapon].weaponType, "garde le type d'arme (donc les sorts) de sa classe");
  }
  assert.equal(new Set(uniques.map((d) => d.chance)).size, 1, "même chance pour chaque classe");
});

test("chaque arme unique dépasse nettement la meilleure arme de palier 3 de sa classe, et a un passif", () => {
  const power = (it) => ["atk_phys", "atk_magie"].reduce((s, k) => s + (it[k] || 0), 0);
  const best = { guerrier: ITEMS.epee_chevalier, assassin: ITEMS.dague_garou, magicien: ITEMS.baton_esprit };
  for (const [cls, id] of Object.entries(UNIQUE)) {
    assert.ok(power(ITEMS[id]) >= power(best[cls]) * 1.5, cls);
    assert.ok(Object.keys(ITEMS[id].passive).length === 1 && ITEMS[id].passiveDesc, cls);
  }
});

test("le butin d'arme unique est celui de la classe du joueur, jamais celui d'une autre", () => {
  const saved = boss.drops.map((d) => ({ ...d }));
  boss.drops.forEach((d) => { d.chance = 1; });                       // pour tester le tirage, on le rend certain
  try {
    for (const [cls, id] of Object.entries(UNIQUE)) {
      const stats = { ...baseStats(), maxHp: 1e6, esquive: 0, atkPhys: 5000 };
      let st = createCombat({ stats, weaponType: "epee", classKey: cls, level: 20, enemyKeys: ["veilleur_corrompu"], seed: 21 });
      st = advance(st).state;
      for (let i = 0; i < 30 && st.phase === "playerTurn"; i++) {
        st.player.pa = 6;
        const sp = st.player.spells.find((s2) => s2.type !== "buff" && s2.pa <= 6);
        st = castSpell(st, sp.id, st.enemies.find((e) => e.alive).id).state;
        if (st.phase === "playerTurn" && st.player.pa < 2) st = advance(endTurn(st).state).state;
      }
      assert.equal(st.phase, "victory", cls);
      assert.deepEqual(st.rewards.items, [id], cls);
    }
  } finally { boss.drops.splice(0, boss.drops.length, ...saved); }
});

test("les passifs d'armes uniques deviennent des effets de combat (vol de vie, mépris de l'armure, dernier souffle)", () => {
  const flags = (id, cls) => createCombat({ stats: baseStats({ arme: ITEMS[id] }), weaponType: ITEMS[id].weaponType, classKey: cls, level: 20, enemyKeys: ["veilleur_corrompu"], seed: 1 }).player.flags;
  assert.equal(flags("croc_du_veilleur", "assassin").lifesteal, 0.07);
  assert.equal(flags("sceptre_du_veilleur", "magicien").armorPen, 0.25);
  assert.equal(flags("lame_du_veilleur", "guerrier").lastStand, 0.35);
  assert.equal(flags("lame_du_veilleur", "guerrier").lifesteal, 0);
});

test("sous 66 % de vie, le Veilleur appelle 2 esprits : ils rejoignent l'ordre de jeu, sans dépasser 3 ennemis", () => {
  let st = bossFight();
  assert.equal(st.enemies.length, 1);
  st.enemies[0].hp = Math.round(st.enemies[0].maxHp * 0.655);
  const r = strike(st);                                   // ce coup fait passer sous 66 %
  const ev = r.events.find((e) => e.type === "summon");
  assert.ok(ev, "évènement d'appel");
  assert.equal(ev.enemies.length, 2);
  assert.equal(r.state.enemies.length, 3);
  for (const a of ev.enemies) {
    const e = r.state.enemies.find((x) => x.id === a.id);
    assert.ok(e && e.alive && e.summoned && e.key === "esprit_errant" && e.hp === e.maxHp);
    assert.ok(r.state.order.includes(a.id), "dans l'ordre de jeu");
  }
  assert.equal(new Set(r.state.order).size, r.state.order.length, "pas de doublon dans l'ordre");
  // l'appel n'a lieu qu'une fois
  const again = strike(endAndBack(r.state));
  assert.ok(!again.events.some((e) => e.type === "summon"));
  assert.ok(r.state.enemies.length <= 3);
});

function endAndBack(st) { const e = endTurn(st).state; return advance(e).state; }

test("les esprits appelés jouent leur tour, mais ne rapportent ni xp, ni or, ni butin", () => {
  let st = bossFight(9);
  st.enemies[0].hp = Math.round(st.enemies[0].maxHp * 0.6);
  st = strike(st).state;
  assert.equal(st.enemies.length, 3);
  let acted = false;
  for (let i = 0; i < 6 && !acted; i++) {
    const r = advance(endTurn(st).state);
    st = r.state;
    acted = r.events.some((e) => e.type === "cast" && e.from !== "player" && e.from !== "e0");
    if (st.phase !== "playerTurn") break;
  }
  assert.ok(acted, "un esprit a agi");
  // on tue tout le monde : seul le Veilleur compte dans les récompenses
  st.enemies.forEach((e) => { e.hp = 1; });
  st.player.pa = 6;
  let end = st;
  for (let i = 0; i < 12 && end.phase === "playerTurn"; i++) {
    end.player.pa = 6;
    const target = end.enemies.find((e) => e.alive).id;
    const sp = end.player.spells.find((s2) => s2.type !== "buff" && s2.pa <= 6);
    end = castSpell(end, sp.id, target).state;
  }
  assert.equal(end.phase, "victory");
  assert.equal(end.rewards.kills.veilleur_corrompu, 1);
  assert.equal(end.rewards.kills.esprit_errant, undefined);
  assert.equal(end.rewards.xp, Math.round(boss.xp * SOLO_XP_MULT));
  assert.ok(end.rewards.gold >= boss.gold[0] && end.rewards.gold <= boss.gold[1]);
  assert.ok(!("cle_du_manoir" in end.rewards.resources) && !end.rewards.items.includes("cle_du_manoir"));
});

test("sous 33 % de vie, le Veilleur se déchaîne (+40 % d'attaque) et débloque feu noir et poison — pas avant", () => {
  const labels = (st, rounds) => {
    const seen = new Set();
    for (let i = 0; i < rounds && st.phase === "playerTurn"; i++) {
      const r = advance(endTurn(st).state);
      st = r.state;
      r.events.filter((e) => e.type === "cast" && e.from === "e0").forEach((e) => seen.add(e.label));
    }
    return seen;
  };
  const calm = labels(bossFight(2), 25);
  assert.ok(!calm.has("Feu noir") && !calm.has("Souffle putride"), "pas d'action de rage avant la phase");
  assert.ok(calm.size >= 2);
  let st = bossFight(4);
  const atkBefore = st.enemies[0].stats.atkPhys;
  st.enemies[0].hp = Math.round(st.enemies[0].maxHp * 0.3);
  const r = strike(st);
  assert.equal(r.events.filter((e) => e.type === "phase").length, 2, "appel + rage");
  assert.equal(r.state.enemies[0].stats.atkPhys, atkBefore * 1.4);
  const raged = labels(r.state, 40);
  assert.ok(raged.has("Feu noir") || raged.has("Souffle putride"), "actions de rage utilisées");
});

test("Regard du néant retire 2 PA au héros pour son prochain tour", () => {
  let found = null;
  for (let seed = 1; seed < 40 && !found; seed++) {
    let st = bossFight(seed);
    const r = advance(endTurn(st).state);
    const loss = r.events.find((e) => e.type === "paLoss");
    if (loss) found = { r, loss };
  }
  assert.ok(found, "le regard finit par toucher");
  assert.equal(found.loss.amount, 2);
});

test("Lame du Veilleur : un coup mortel laisse 35 % des PV, une seule fois par combat", () => {
  const stats = { ...baseStats({ arme: relic }), esquive: 0 };
  assert.equal(stats.passives.lastStand, 0.35);
  assert.equal(baseStats().passives.lastStand, undefined);
  let st = createCombat({ stats, weaponType: "epee", classKey: "guerrier", level: 20, enemyKeys: ["veilleur_corrompu"], seed: 3 });
  assert.equal(st.player.flags.lastStand, 0.35);
  st = advance(st).state;
  st.player.hp = 1;
  const r1 = advance(endTurn(st).state);
  const ls = r1.events.find((e) => e.type === "lastStand");
  assert.ok(ls, "dernier souffle déclenché");
  assert.equal(ls.hpAfter, Math.round(stats.maxHp * 0.35));
  assert.ok(r1.state.player.alive);
  // deuxième coup mortel : plus de dernier souffle
  let st2 = r1.state;
  if (st2.phase === "playerTurn") {
    st2.player.hp = 1;
    const r2 = advance(endTurn(st2).state);
    assert.ok(!r2.events.some((e) => e.type === "lastStand"));
    assert.equal(r2.state.phase, "defeat");
  }
  // sans l'arme : la défaite est immédiate
  let nr = createCombat({ stats: { ...baseStats(), esquive: 0 }, weaponType: "epee", classKey: "guerrier", level: 20, enemyKeys: ["veilleur_corrompu"], seed: 3 });
  nr = advance(nr).state; nr.player.hp = 1;
  assert.equal(advance(endTurn(nr).state).state.phase, "defeat");
});

test("chaîne de quêtes : 3 étapes dans l'ordre, à partir du niveau 14, rendues une seule fois", () => {
  const p0 = { ...createPlayer({ classKey: "guerrier" }), level: 14 };
  const NOW = new Date(2026, 10, 7, 12).getTime();
  const chainIn = (p) => boardFor(p, NOW).filter((q) => q.chain).map((q) => q.tpl);
  assert.deepEqual(chainIn({ ...p0, level: 13 }), [], "avant le niveau 14 : rien");
  assert.deepEqual(chainIn(p0), ["chain_esprits"]);
  let p = p0;
  for (const [i, step] of CHAIN_QUESTS.entries()) {
    const q = boardFor(p, NOW).find((x) => x.tpl === step.id);
    assert.ok(q, step.id);
    assert.equal(q.rewards.gold > 0 && q.rewards.xp > 0, true);
    p = acceptQuest(p, q.id, NOW).player;
    assert.deepEqual(chainIn(p), [], "plus au tableau une fois acceptée");
    // on simule le travail : compteur de victoires
    const a = questsOf(p).active.find((x) => x.id === q.id);
    p = { ...p, quests: { ...questsOf(p), counters: { ...(questsOf(p).counters || {}), kills: { ...((questsOf(p).counters || {}).kills || {}), [step.target]: (((questsOf(p).counters || {}).kills || {})[step.target] || 0) + step.qty } } } };
    assert.ok(progressOf(p, a).done, `étape ${i + 1} terminable`);
    const done = completeQuest(p, q.id, NOW);
    assert.ok(done.ok, step.id);
    p = done.player;
  }
  assert.deepEqual(chainIn(p), [], "chaîne terminée : elle ne revient pas");
  assert.equal(questsOf(p).chain.length, 3);
  assert.ok(!CHAIN_QUESTS.some((c) => c.rewards?.item), "l'arme unique n'est jamais une récompense de quête");
});

test("Bricoleur : fabrique la Clé du Manoir (ingrédients dont l'Essence du Veilleur), qui ne s'équipe pas", () => {
  assert.ok(PROFESSIONS.bricoleur);
  const info = getCraftInfo("cle_du_manoir");
  assert.equal(info.profession, "bricoleur");
  assert.deepEqual(recipesOfProfession("bricoleur").map((r) => r.itemId), ["cle_du_manoir"]);
  for (const r of Object.keys(RECIPES.cle_du_manoir.ingredients)) assert.ok(RESOURCES[r], r);
  assert.ok(RECIPES.cle_du_manoir.ingredients.essence_du_veilleur >= 1, "elle demande le butin du boss");
  assert.equal(ITEMS.cle_du_manoir.type, "cle");
  const rich = (extra = {}) => ({ ...createPlayer({ classKey: "guerrier" }), gold: 5000, resources: { ...RECIPES.cle_du_manoir.ingredients }, ...extra });
  const low = rich();
  assert.equal(info.minLevel, 1, "accessible dès le niveau 1, pour pouvoir gagner de l'xp");
  const lvl = low;
  assert.ok(canCraft(lvl, "cle_du_manoir").ok);
  assert.ok(!canCraft({ ...lvl, resources: { ...lvl.resources, essence_du_veilleur: 2 } }, "cle_du_manoir").ok, "sans assez d'essence : impossible");
  const made = applyCraft(lvl, "cle_du_manoir", "k1", () => 0.99);
  assert.equal(made.inventory.filter((i) => i.id === "cle_du_manoir").length, 1);
  assert.equal(made.inventory[0].quality, undefined, "pas de chef-d'œuvre pour une clé");
  assert.equal(made.resources.essence_du_veilleur, undefined);
  assert.equal(made.gold, 5000 - craftFee("cle_du_manoir"));
  assert.ok(made.professions.bricoleur.xp > 0);
  // à haut niveau, les ressources peuvent être épargnées (l'or, lui, est toujours dépensé)
  const master = { ...lvl, professions: { ...lvl.professions, bricoleur: { level: 100, xp: 0 } } };
  const kept = applyCraft(master, "cle_du_manoir", "k2", () => 0);
  assert.equal(kept.inventory.filter((i) => i.id === "cle_du_manoir").length, 1);
  assert.deepEqual(kept.resources, master.resources, "ressources intactes");
  assert.equal(kept.gold, master.gold - craftFee("cle_du_manoir"));
  assert.equal(applyCraft(master, "cle_du_manoir", "k3", () => 0.99).resources.essence_du_veilleur, undefined, "sinon elles sont consommées");
  assert.ok(Math.abs(perkLines("bricoleur", 100, 100)[0].now.replace(",", ".").replace(" %", "") - 50) < 0.01, "50 % au niveau 100");
  assert.equal(perkLines("bricoleur", 1, 100)[0].now, "0 %");
  const lines = perkLines("bricoleur", 5, 100);
  assert.match(lines[0].label, /ressource/);
});

console.log(`\n${n} tests passent.`);
