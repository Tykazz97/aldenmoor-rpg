// Tests des combats en groupe (le joueur + 2 alliés bots) :  node scripts/test-party.js
import assert from "node:assert/strict";
import { createCombat, advance, castSpell, endTurn, PARTY_HP_SCALE, PARTY_DROP_MULT } from "../src/combat/engine.js";
import { defaultAllies, botSpec, makeBotPlayer, PARTY_SIZE } from "../src/sim/partyBots.js";
import { ENEMIES } from "../src/data/zones.js";
import { CLASSES } from "../src/data/classes.js";
import { ITEMS } from "../src/data/items.js";
import { calcStats } from "../src/utils/calcStats.js";
import { buildSpellBar } from "../src/utils/spellbook.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Combat en groupe");

const hero = (cls, level) => { const p = makeBotPlayer(cls, level); return { player: p, stats: calcStats(p), spells: buildSpellBar(p) }; };
const wtype = { guerrier: "epee", assassin: "dague", magicien: "baton" };
function fightOf(cls, level, enemyKeys, { party = true, seed = 1, tweak } = {}) {
  const h = hero(cls, level);
  const allies = party ? defaultAllies({ ...h.player, name: "Test" }) : [];
  let st = createCombat({ stats: h.stats, weaponType: wtype[cls], classKey: cls, level, enemyKeys, spells: h.spells, allies, seed });
  if (tweak) tweak(st);
  return st;
}
// Le joueur joue en pilote automatique (sort le plus rentable sur l'ennemi le plus faible)
function autoplay(st, maxSteps = 5000) {
  const events = [];
  for (let g = 0; st.phase !== "victory" && st.phase !== "defeat" && g < maxSteps; g++) {
    if (st.phase === "running") { const r = advance(st); st = r.state; events.push(...r.events); continue; }
    const living = st.enemies.filter((e) => e.alive);
    let best = null, bs = 0;
    for (const sp of st.player.spells) { if (sp.type === "buff" || sp.pa > st.player.pa) continue; const sc = (sp.power * (sp.aoe ? living.length : 1)) / sp.pa; if (sc > bs) { best = sp; bs = sc; } }
    if (!best) { const r = endTurn(st); st = r.state; events.push(...r.events); continue; }
    const r = castSpell(st, best.id, living.sort((a, b) => a.hp - b.hp)[0].id);
    st = r.state; events.push(...r.events);
  }
  return { st, events };
}

test("les alliés par défaut sont les deux autres classes, au niveau du joueur, avec l'équipement de leur palier — toujours les mêmes", () => {
  const a = defaultAllies({ name: "Grégoire", classKey: "guerrier", level: 18 });
  assert.equal(PARTY_SIZE, 3);
  assert.deepEqual(a.map((x) => x.classKey).sort(), ["assassin", "magicien"]);
  for (const x of a) {
    assert.equal(x.level, 18);
    assert.ok(x.stats.maxHp > 100 && x.spells.length >= 3 && x.name && /^[mf]\//.test(x.look));
  }
  assert.ok(a.find((x) => x.classKey === "magicien").stats.atkMagie > a.find((x) => x.classKey === "assassin").stats.atkMagie, "chacun a la stat de sa classe");
  assert.equal(a.find((x) => x.classKey === "assassin").stats.setBonuses[0].set.key, "garou", "palier 3 au niveau 18");
  assert.deepEqual(defaultAllies({ name: "Grégoire", classKey: "guerrier", level: 18 }).map((x) => x.name), a.map((x) => x.name));
  assert.deepEqual(defaultAllies({ name: "X", classKey: "magicien", level: 5 }).map((x) => x.classKey).sort(), ["assassin", "guerrier"]);
});

test("en groupe : 2 alliés dans l'état, ordre de jeu mixte, mêmes ennemis qu'en solo ; seul : rien ne change", () => {
  const solo = fightOf("guerrier", 14, ["chevalier_dechu", "chevalier_dechu"], { party: false });
  assert.deepEqual(solo.allies, []); assert.equal(solo.hpScale, 1);
  assert.equal(solo.enemies[0].maxHp, ENEMIES.chevalier_dechu.stats.hp);
  const g = fightOf("guerrier", 14, ["chevalier_dechu", "chevalier_dechu"]);
  assert.equal(g.allies.length, 2);
  assert.deepEqual(g.allies.map((a) => a.id), ["ally0", "ally1"]);
  assert.ok(g.allies.every((a) => a.isAlly && a.isPlayer && a.alive && a.hp === a.maxHp));
  assert.equal(g.hpScale, PARTY_HP_SCALE[3]);
  assert.equal(g.enemies[0].maxHp, Math.round(ENEMIES.chevalier_dechu.stats.hp * PARTY_HP_SCALE[3]));
  const r = advance(g);
  const round = r.events.find((e) => e.type === "round");
  assert.equal(new Set(round.order).size, 5);
  for (const id of ["player", "ally0", "ally1", "e0", "e1"]) assert.ok(round.order.includes(id), id);
});

test("les alliés jouent seuls à leur tour : ils lancent des sorts et blessent les ennemis, sans jamais bloquer le combat", () => {
  let st = fightOf("magicien", 14, ["chevalier_dechu", "chevalier_dechu"], { seed: 4 });
  const events = [];
  for (let i = 0; i < 4 && st.phase !== "victory" && st.phase !== "defeat"; i++) {
    const r = advance(st); st = r.state; events.push(...r.events);
    if (st.phase === "playerTurn") st = endTurn(st).state;
  }
  const casts = (id) => events.filter((e) => e.type === "cast" && e.from === id);
  assert.ok(casts("ally0").length > 0 && casts("ally1").length > 0, "les deux alliés ont lancé des sorts");
  assert.ok(events.some((e) => e.type === "hit" && e.from.startsWith("ally")), "ils touchent");
  assert.ok(st.enemies.some((e) => e.hp < e.maxHp), "les ennemis perdent des PV sans que le joueur agisse");
  assert.ok(st.allies.every((a) => a.pa === 0), "PA remis à zéro après leur tour");
});

test("les ennemis frappent tous les héros, pas seulement le joueur", () => {
  const targets = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    const { events } = autoplay(fightOf("guerrier", 14, ["chevalier_dechu", "chevalier_dechu"], { seed }), 800);
    events.filter((e) => e.type === "hit" && !e.from.startsWith("ally") && e.from !== "player").forEach((e) => targets.add(e.to));
  }
  assert.ok(targets.has("player") && targets.has("ally0") && targets.has("ally1"), [...targets].join(","));
});

test("un allié à terre ne joue plus mais le combat continue ; c'est la mort du joueur qui perd", () => {
  let st = fightOf("guerrier", 14, ["chevalier_dechu", "chevalier_dechu"], { seed: 3, tweak: (s) => { s.allies[0].alive = false; s.allies[0].hp = 0; } });
  const r = advance(st);
  assert.ok(!r.events.some((e) => e.type === "turn" && e.id === "ally0"), "l'allié mort saute son tour");
  assert.ok(r.events.some((e) => e.type === "turn" && e.id === "ally1"));
  assert.equal(r.state.phase === "playerTurn" || r.state.phase === "running", true);
  // tous les alliés morts, joueur vivant : le combat n'est pas perdu
  let alone = fightOf("guerrier", 14, ["chevalier_dechu"], { seed: 5, tweak: (s) => s.allies.forEach((a) => { a.alive = false; a.hp = 0; }) });
  alone = advance(alone).state;
  assert.notEqual(alone.phase, "defeat");
  // joueur à 1 PV : un coup l'achève, même avec ses alliés en vie
  let low = fightOf("guerrier", 14, ["chevalier_dechu", "chevalier_dechu"], { seed: 6 });
  low = advance(low).state; low.player.hp = 1;
  let phase = low.phase;
  for (let i = 0; i < 12 && phase !== "defeat" && phase !== "victory"; i++) { low = advance(endTurn(low).state).state; phase = low.phase; low.player.hp = Math.min(low.player.hp, 1); }
  assert.equal(phase, "defeat");
  assert.ok(low.allies.some((a) => a.alive), "au moins un allié était encore debout");
});

test("les récompenses sont celles du seul joueur (même xp et or qu'en solo) et les renforts d'esprits ont des PV adaptés", () => {
  const e = ENEMIES.chevalier_dechu;
  const { st } = autoplay(fightOf("guerrier", 20, ["chevalier_dechu"], { seed: 2 }));
  assert.equal(st.phase, "victory");
  assert.equal(st.rewards.xp, e.xp);
  assert.ok(st.rewards.gold >= e.gold[0] && st.rewards.gold <= e.gold[1]);
  const boss = fightOf("guerrier", 20, ["veilleur_corrompu"], { seed: 9 });
  let s2 = advance(boss).state;
  s2.enemies[0].hp = Math.round(s2.enemies[0].maxHp * 0.6);
  s2.player.pa = 6;
  const r = castSpell(s2, s2.player.spells.find((x) => x.type !== "buff").id, "e0");
  const ev = r.events.find((x) => x.type === "summon");
  assert.ok(ev && r.state.enemies.length <= 3);
  for (const sp of ev.enemies) assert.equal(sp.maxHp, Math.round(ENEMIES.esprit_errant.stats.hp * PARTY_HP_SCALE[3]));
});

test("les passifs d'armes uniques et les sets des alliés bots sont pris en compte comme pour le joueur", () => {
  const spec = botSpec("guerrier", 20);
  assert.ok(spec.stats.setBonuses.length >= 1);
  const st = createCombat({ stats: spec.stats, weaponType: "epee", classKey: "guerrier", level: 20, enemyKeys: ["loup_garou"], allies: [{ ...spec, stats: calcStats({ level: 20, baseHp: 400, caracs: {}, equipped: { arme: ITEMS.croc_du_veilleur } }), weaponType: "dague", classKey: "assassin" }], seed: 1 });
  assert.equal(st.allies[0].flags.lifesteal, 0.07);
  assert.equal(st.player.flags.lifesteal, 0);
});

test("équilibre : en groupe, le même combat est gagné au moins aussi souvent qu'en solo, et le combat est plus court", () => {
  const stats = { win: [0, 0], rounds: [0, 0] };
  for (let seed = 1; seed <= 20; seed++) {
    [false, true].forEach((party, i) => {
      const { st } = autoplay(fightOf("magicien", 16, ["loup_garou", "esprit_errant", "chevalier_dechu"], { party, seed }));
      if (st.phase === "victory") stats.win[i]++;
      stats.rounds[i] += st.round;
    });
  }
  assert.ok(stats.win[1] >= stats.win[0], `groupe ${stats.win[1]}/20 contre solo ${stats.win[0]}/20`);
  assert.ok(stats.win[1] >= 14, "un groupe au niveau conseillé gagne le plus souvent");
  assert.ok(stats.rounds[1] < stats.rounds[0], "à trois, on termine plus vite");
});

test("chaque classe peut mener un groupe (les 3 profils fonctionnent comme joueur et comme alliés)", () => {
  for (const cls of Object.keys(CLASSES)) {
    const { st } = autoplay(fightOf(cls, 12, ["squelette_fermier", "corbeau_charognard", "epouvantail_hante"], { seed: 7 }));
    assert.ok(st.phase === "victory" || st.phase === "defeat", cls);
    assert.equal(st.allies.length, 2);
  }
});


test("en groupe, les ennemis ne sont pas plus costauds et le butin est meilleur (x1,25 à 2, x1,5 à 3)", () => {
  assert.deepEqual(PARTY_HP_SCALE, { 1: 1, 2: 1, 3: 1 });
  assert.deepEqual(PARTY_DROP_MULT, { 1: 1, 2: 1.25, 3: 1.5 });
  const g = fightOf("guerrier", 14, ["chevalier_dechu"]);
  assert.equal(g.enemies[0].maxHp, ENEMIES.chevalier_dechu.stats.hp);
  // Statistique : une ressource à 30 % tombe plus souvent en groupe qu'en solo (mêmes graines)
  const key = "loup_des_plaines";
  const d = (ENEMIES[key].drops || []).find((x) => x.type === "resource" && x.chance < 0.5 && x.chance > 0.1);
  assert.ok(d, "un drop de test existe");
  const count = (party) => { let c = 0; for (let seed = 1; seed <= 400; seed++) { const { st } = autoplay(fightOf("guerrier", 14, [key], { party, seed, tweak: (x) => { x.enemies[0].hp = 1; } })); assert.equal(st.phase, "victory"); c += st.rewards.resources[d.id] ? 1 : 0; } return c; };
  const solo = count(false), grp = count(true);
  assert.ok(grp > solo * 1.15, `groupe ${grp} > solo ${solo}`);
});

console.log(`\n${n} tests passent.`);
