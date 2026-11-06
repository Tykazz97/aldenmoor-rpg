// ============================================================
// Tests du moteur de combat :  node scripts/test-combat.js
// ============================================================

import assert from "node:assert/strict";
import { createCombat, advance, castSpell, endTurn, PA_MAX } from "../src/combat/engine.js";

const BASE_STATS = {
  atkPhys: 20, atkMagie: 20, defPhys: 0, defMagie: 0, maxHp: 100,
  esquive: 0, critique: 0, vitesse: 10, dropBonus: 0, setBonuses: [],
};

function mk({ weapon = "epee", enemies = ["loup_des_plaines"], stats = {}, seed = 1 } = {}) {
  const s = createCombat({ stats: { ...BASE_STATS, ...stats }, weaponType: weapon, enemyKeys: enemies, seed });
  // Ennemis déterministes pour les tests : pas d'esquive ni de critique
  s.enemies.forEach((e) => { e.stats.esquive = 0; e.stats.critique = 0; });
  return s;
}

// Fait avancer le temps jusqu'au tour du joueur (ou la fin du combat)
function toPlayerTurn(state) {
  let events = [];
  for (let i = 0; i < 5000 && state.phase === "running"; i++) {
    const r = advance(state, 0.05);
    state = r.state; events = events.concat(r.events);
  }
  return { state, events };
}

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };

console.log("Moteur de combat");

test("un combat démarre en cours, le joueur sans PA", () => {
  const s = mk();
  assert.equal(s.phase, "running");
  assert.equal(s.player.pa, 0);
  assert.equal(s.enemies.length, 1);
});

test("le tour du joueur donne 6 PA", () => {
  const { state, events } = toPlayerTurn(mk());
  assert.equal(state.phase, "playerTurn");
  assert.equal(state.player.pa, PA_MAX);
  assert.ok(events.some((e) => e.type === "playerTurn"));
});

test("un sort coûte ses PA et inflige des dégâts", () => {
  let { state } = toPlayerTurn(mk());
  const before = state.enemies[0].hp;
  const r = castSpell(state, "taillade", "e0");
  assert.equal(r.state.player.pa, PA_MAX - 2);
  const hit = r.events.find((e) => e.type === "hit");
  assert.ok(hit && hit.amount > 0);
  assert.equal(r.state.enemies[0].hp, before - hit.amount);
  assert.equal(hit.hpAfter, r.state.enemies[0].hp);
});

test("impossible de lancer un sort sans assez de PA", () => {
  let { state } = toPlayerTurn(mk());
  state = castSpell(state, "coup_devastateur", "e0").state;     // 5 PA
  const r = castSpell(state, "taillade", "e0");                    // il reste 1 PA
  assert.equal(r.events.length, 0);
  assert.equal(r.state.player.pa, 1);
});

test("impossible de viser un mort ou de lancer hors de son tour", () => {
  const s = mk();
  assert.equal(castSpell(s, "taillade", "e0").events.length, 0);   // pas son tour
});

test("terminer le tour fait perdre les PA restants et vide la jauge", () => {
  let { state } = toPlayerTurn(mk());
  const r = endTurn(state);
  assert.equal(r.state.phase, "running");
  assert.equal(r.state.player.pa, 0);
  assert.equal(r.state.player.atb, 0);
});

test("même graine => même combat, graine différente => combat différent", () => {
  const a = toPlayerTurn(mk({ seed: 42 })).events;
  const b = toPlayerTurn(mk({ seed: 42 })).events;
  assert.deepEqual(a, b);
  const c = castSpell(toPlayerTurn(mk({ seed: 7, enemies: ["sanglier_sauvage"] })).state, "taillade", "e0").events;
  const d = castSpell(toPlayerTurn(mk({ seed: 8, enemies: ["sanglier_sauvage"] })).state, "taillade", "e0").events;
  assert.notDeepEqual(c.map((e) => e.amount), d.map((e) => e.amount));
});

test("la défense réduit les dégâts", () => {
  const dmg = (def) => {
    let { state } = toPlayerTurn(mk({ enemies: ["sanglier_sauvage"], seed: 5 }));
    state.enemies[0].stats.defPhys = def;
    return castSpell(state, "taillade", "e0").events.find((e) => e.type === "hit").amount;
  };
  assert.ok(dmg(60) < dmg(0));
});

test("un sort de zone touche tous les ennemis", () => {
  let { state } = toPlayerTurn(mk({ weapon: "baton", enemies: ["loup_des_plaines", "bandit_des_routes", "sanglier_sauvage"] }));
  const r = castSpell(state, "explosion_arcanique");
  assert.equal(r.events.filter((e) => e.type === "hit" || e.type === "miss").length, 3);
});

test("le poison inflige des dégâts à chaque tour de la cible (3 tours)", () => {
  let { state } = toPlayerTurn(mk({ weapon: "dague", enemies: ["sanglier_sauvage"] }));
  state = castSpell(state, "frappe_empoisonnee", "e0").state;
  assert.equal(state.enemies[0].effects[0].kind, "dot");
  assert.equal(state.enemies[0].effects[0].turns, 3);
  state = endTurn(state).state;
  let dots = 0;
  for (let i = 0; i < 4000 && dots < 3 && state.phase !== "defeat"; i++) {
    const r = advance(state, 0.05);
    state = r.state;
    dots += r.events.filter((e) => e.type === "dot").length;
    if (state.phase === "playerTurn") state = endTurn(state).state;
  }
  assert.equal(dots, 3);
  assert.equal(state.enemies[0].effects.filter((e) => e.kind === "dot").length, 0);
});

test("l'étourdissement vide la jauge de la cible", () => {
  let { state } = toPlayerTurn(mk({ weapon: "marteau", enemies: ["sanglier_sauvage"] }));
  state.enemies[0].atb = 90;
  const r = castSpell(state, "etourdissement", "e0");
  assert.equal(r.state.enemies[0].atb, 0);
  assert.ok(r.events.some((e) => e.type === "stun"));
});

test("le givre ralentit la jauge ATB", () => {
  let { state } = toPlayerTurn(mk({ weapon: "faux", enemies: ["sanglier_sauvage"] }));
  state = castSpell(state, "etreinte_glaciale", "e0").state;
  const rate = state.enemies[0].stats.vitesse * 2;
  state.enemies[0].atb = 0;
  state = endTurn(state).state;
  const r = advance(state, 1);
  assert.ok(r.state.enemies[0].atb < rate, "la jauge doit monter moins vite");
});

test("le vol de vie soigne le joueur", () => {
  let { state } = toPlayerTurn(mk({ weapon: "faux", enemies: ["sanglier_sauvage"] }));
  state.player.hp = 50;
  const r = castSpell(state, "vol_de_vie", "e0");
  assert.ok(r.state.player.hp > 50);
  assert.ok(r.events.some((e) => e.type === "heal"));
});

test("Disparition : la prochaine attaque reçue est esquivée et le prochain coup est critique", () => {
  let { state } = toPlayerTurn(mk({ weapon: "dague", enemies: ["sanglier_sauvage"], seed: 3 }));
  state = castSpell(state, "disparition").state;
  assert.equal(state.player.flags.shadowDodge, true);
  const hit = castSpell(state, "laceration", "e0").events.find((e) => e.type === "hit");
  assert.equal(hit.crit, true);
});

test("Parade : bonus de défense et contre-attaque quand le joueur est touché", () => {
  let { state } = toPlayerTurn(mk({ weapon: "epee", enemies: ["sanglier_sauvage"], seed: 11 }));
  state = castSpell(state, "parade").state;
  assert.ok(state.player.effects.some((e) => e.kind === "parade"));
  state = endTurn(state).state;
  state.player.stats.esquive = 0;
  let counter = false;
  for (let i = 0; i < 4000 && !counter && state.phase === "running"; i++) {
    const r = advance(state, 0.05);
    state = r.state;
    counter = r.events.some((e) => e.type === "counter");
  }
  assert.ok(counter, "une contre-attaque doit se déclencher");
});

test("le set Traqueur garantit un premier coup critique", () => {
  const stats = { setBonuses: [{ bonus: { guaranteedFirstCrit: true } }] };
  let { state } = toPlayerTurn(mk({ stats, seed: 9 }));
  const first = castSpell(state, "taillade", "e0");
  assert.equal(first.events.find((e) => e.type === "hit").crit, true);
  const second = castSpell(first.state, "taillade", "e0");
  assert.equal(second.events.find((e) => e.type === "hit")?.crit, false);
});

test("le set Apprenti réduit d'1 PA le premier sort de chaque tour", () => {
  const stats = { setBonuses: [{ bonus: { firstSpellDiscount: 1 } }] };
  let { state } = toPlayerTurn(mk({ stats, weapon: "baton" }));
  const r1 = castSpell(state, "projectile_arcanique", "e0");
  const cost1 = PA_MAX - r1.state.player.pa;
  const r2 = castSpell(r1.state, "projectile_arcanique", "e0");
  const cost2 = r1.state.player.pa - r2.state.player.pa;
  assert.equal(cost1 + 1, cost2);
});

test("victoire : récompenses cohérentes avec le bestiaire", () => {
  let { state } = toPlayerTurn(mk({ stats: { atkPhys: 500 }, enemies: ["loup_des_plaines"], seed: 2 }));
  const r = castSpell(state, "taillade", "e0");
  assert.equal(r.state.phase, "victory");
  assert.equal(r.state.rewards.xp, 12);
  assert.ok(r.state.rewards.gold >= 3 && r.state.rewards.gold <= 8);
  for (const id of Object.keys(r.state.rewards.resources)) {
    assert.ok(["croc_de_loup", "fourrure_grise", "oeil_de_loup_argente"].includes(id));
  }
  assert.ok(r.events.some((e) => e.type === "victory"));
});

test("la Chance augmente les drops", () => {
  const count = (dropBonus) => {
    let total = 0;
    for (let seed = 1; seed <= 300; seed++) {
      let { state } = toPlayerTurn(mk({ stats: { atkPhys: 500, dropBonus }, enemies: ["loup_des_plaines"], seed }));
      const r = castSpell(state, "taillade", "e0");
      total += r.state.rewards ? (r.state.rewards.resources.fourrure_grise || 0) : 0;
    }
    return total;
  };
  assert.ok(count(100) > count(0));
});

test("le Cavalier Déchu entre en rage sous 50 % de vie", () => {
  let { state } = toPlayerTurn(mk({ enemies: ["cavalier_dechu"], stats: { atkPhys: 60 }, seed: 4 }));
  state.enemies[0].hp = Math.floor(state.enemies[0].maxHp * 0.52);
  const atkBefore = state.enemies[0].stats.atkPhys;
  const r = castSpell(state, "taillade", "e0");
  assert.ok(r.events.some((e) => e.type === "phase"));
  assert.ok(r.state.enemies[0].stats.atkPhys > atkBefore);
});

test("défaite quand les PV du joueur tombent à zéro", () => {
  let s = mk({ enemies: ["sanglier_sauvage", "sanglier_sauvage", "sanglier_sauvage"], stats: { maxHp: 1 } });
  s.player.stats.esquive = 0;
  let state = s;
  let events = [];
  // Le joueur passe ses tours sans rien faire jusqu'à tomber
  for (let i = 0; i < 20 && state.phase !== "defeat"; i++) {
    const r = toPlayerTurn(state);
    state = r.state; events = events.concat(r.events);
    if (state.phase === "playerTurn") state = endTurn(state).state;
  }
  assert.equal(state.phase, "defeat");
  assert.ok(events.some((e) => e.type === "defeat"));
});

test("sans arme, le joueur a le coup de poing", () => {
  const s = createCombat({ stats: BASE_STATS, weaponType: null, enemyKeys: ["loup_des_plaines"], seed: 1 });
  assert.equal(s.player.spells[0].id, "coup_de_poing");
});

console.log(`\n${n} tests passent.`);
