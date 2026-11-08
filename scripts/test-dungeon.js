// Tests du donjon (moteur : PA bonus, dommages finaux, PV reportés ; données : salles, butin, sets du palier 4) :  node scripts/test-dungeon.js
import assert from "node:assert/strict";
import { ITEMS, SETS } from "../src/data/items.js";
import { RECIPES } from "../src/data/recipes.js";
import { RESOURCES } from "../src/data/resources.js";
import { ENEMIES } from "../src/data/zones.js";
import { DUNGEONS, dungeonOfKey } from "../src/data/dungeons.js";
import { getCraftInfo } from "../src/data/professions.js";
import { calcStats } from "../src/utils/calcStats.js";
import { createCombat, advance, castSpell, endTurn, DUNGEON_REVIVE } from "../src/combat/engine.js";
import { autoDungeon, autoFight } from "../src/sim/botFight.js";
import { makeBotPlayer, botSpec } from "../src/sim/partyBots.js";
import { keyCount, consumeKey, roomEncounter, dungeonDrops, addRewards, emptyRewards } from "../src/utils/dungeon.js";
import { MAPS, buildingObjects } from "../src/data/maps.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("  ✓", name); };
console.log("Donjon : Le Manoir Englouti");

const dj = DUNGEONS.manoir_englouti;
const relic = ITEMS.medaillon_dame_en_deuil;
const stats = (equipped = {}) => calcStats({ level: 24, baseHp: 400, caracs: {}, equipped });

test("4 salles : 3 de monstres, puis la Dame en Deuil avec 2 monstres", () => {
  assert.equal(dj.rooms.length, 4);
  for (const r of dj.rooms) { assert.ok(r.enemies.length >= 1 && r.enemies.length <= 3); r.enemies.forEach((k) => assert.ok(ENEMIES[k]?.stats, k)); }
  const last = dj.rooms[3];
  assert.equal(last.enemies.length, 3);
  assert.equal(last.enemies[0], "dame_en_deuil");
  assert.ok(dj.rooms.slice(0, 3).every((r) => !r.enemies.includes("dame_en_deuil")));
  assert.equal(dj.partySize, 3);
});

test("la clé du manoir ouvre ce donjon", () => {
  assert.equal(dungeonOfKey("cle_du_manoir")?.key, "manoir_englouti");
  assert.equal(ITEMS.cle_du_manoir.dungeon, "manoir_englouti");
  assert.ok(RECIPES.cle_du_manoir);
});

test("relique : universelle, +1 PA et +10 % de dommages finaux", () => {
  assert.equal(relic.passive.paBonus, 1);
  assert.equal(relic.passive.finalDamage, 0.1);
  assert.ok(!relic.classKey && !relic.forClass);
  assert.equal(relic.type, "relique1");
  for (const classKey of ["guerrier", "assassin", "magicien"]) {
    const s = calcStats({ level: 24, baseHp: 400, caracs: {}, equipped: { relique1: relic } });
    assert.equal(s.paMax, 7, classKey);
  }
  assert.equal(stats().paMax, 6);
});

test("la relique donne bien 7 PA en combat", () => {
  const st = createCombat({ stats: stats({ relique1: relic }), weaponType: "epee", classKey: "guerrier", level: 24, enemyKeys: ["garde_noye"], seed: 3 });
  assert.equal(st.player.paMax, 7);
  const r = advance(st);
  assert.equal(r.state.phase, "playerTurn");
  assert.equal(r.state.player.pa, 7);
  const plain = advance(createCombat({ stats: stats(), weaponType: "epee", classKey: "guerrier", level: 24, enemyKeys: ["garde_noye"], seed: 3 }));
  assert.equal(plain.state.player.pa, 6);
});

// Dégâts du même coup, avec et sans la relique (mêmes graines, esquive et critique à 0 : tout est déterministe)
function firstHit(equipped, classKey, weaponType, atk) {
  const s = { ...stats(equipped), atkPhys: 100, atkMagie: 100, esquive: 0, critique: 0, maxHp: 1e6 };
  let st = createCombat({ stats: s, weaponType, classKey, level: 24, enemyKeys: ["garde_noye"], seed: 11 });
  st = advance(st).state;
  const sp = st.player.spells.find((x) => x.type === atk);
  const before = st.enemies[0].hp;
  const r = castSpell(st, sp.id, "e0");
  return before - r.state.enemies[0].hp;
}
test("dommages finaux +10 % : physiques comme magiques", () => {
  for (const [classKey, weaponType, type] of [["guerrier", "epee", "phys"], ["magicien", "baton", "mag"]]) {
    const base = firstHit({}, classKey, weaponType, type), withRelic = firstHit({ relique1: relic }, classKey, weaponType, type);
    assert.ok(base > 0);
    assert.ok(Math.abs(withRelic / base - 1.1) < 0.03, `${type} : ${base} -> ${withRelic}`);
  }
});

test("PV reportés d'une salle à l'autre (carry) ; un héros tombé se relève à 20 %", () => {
  const s = stats();
  const st = createCombat({ stats: s, weaponType: "epee", classKey: "guerrier", level: 24, enemyKeys: ["molosse_du_manoir"], seed: 1,
    allies: [botSpec("assassin", 24), botSpec("magicien", 24)], carry: { player: 100, allies: [0, 99999] } });
  assert.equal(st.player.hp, 100);
  assert.equal(st.allies[0].hp, Math.ceil(st.allies[0].maxHp * DUNGEON_REVIVE));
  assert.equal(st.allies[1].hp, st.allies[1].maxHp);
  const fresh = createCombat({ stats: s, weaponType: "epee", classKey: "guerrier", level: 24, enemyKeys: ["molosse_du_manoir"], seed: 1 });
  assert.equal(fresh.player.hp, fresh.player.maxHp);
});

test("butin de la Dame : essence et larmes ; relique à 0,5 % exactement, sans bonus de groupe ni de Chance", () => {
  const dame = ENEMIES.dame_en_deuil;
  assert.ok(dame.drops.some((d) => d.id === "essence_de_deuil"));
  const d = dame.drops.find((x) => x.id === "medaillon_dame_en_deuil");
  assert.equal(d.chance, 0.005);
  assert.ok(d.fixed && !d.forClass);
  // 4 000 victoires simulées avec Chance et groupe : le taux reste ≈ 0,5 %
  const s = { ...stats(), dropBonus: 200 };
  let got = 0;
  const allies = [botSpec("assassin", 24), botSpec("magicien", 24)];
  for (let seed = 1; seed <= 4000; seed++) {
    const st = createCombat({ stats: { ...s, atkPhys: 1e6, esquive: 75 }, weaponType: "epee", classKey: "guerrier", level: 24, enemyKeys: ["dame_en_deuil"], seed, allies });
    let cur = advance(st).state;
    for (let g = 0; g < 50 && cur.phase !== "victory"; g++) {
      if (cur.phase === "running") { cur = advance(cur).state; continue; }
      cur = castSpell(cur, cur.player.spells[0].id, "e0").state;
      if (cur.phase === "playerTurn") cur = endTurn(cur).state;
    }
    assert.equal(cur.phase, "victory");
    got += cur.rewards.items.filter((i) => i === "medaillon_dame_en_deuil").length;
  }
  assert.ok(got >= 6 && got <= 40, `${got} reliques sur 4000 (attendu ≈ 20)`);
});

test("ressources exclusives du donjon, lâchées par ses monstres", () => {
  const ids = ["soie_funeraire", "cuir_de_molosse", "plaque_noyee", "larme_de_deuil", "essence_de_deuil"];
  for (const id of ids) {
    assert.ok(RESOURCES[id], id);
    assert.ok(Object.values(ENEMIES).some((e) => e.drops?.some((d) => d.id === id)), `${id} ne tombe nulle part`);
  }
  assert.equal(RESOURCES.essence_de_deuil.rarity, "rare");
  assert.ok(ids.every((id) => RESOURCES[id].dungeon), "marquées « donjon » : le colporteur ne les vend pas");
});

test("trois sets du palier 4, un par classe, fabricables avec les ressources du donjon", () => {
  const sets = { garde_noye: "guerrier", veneur: "assassin", veuve: "magicien" };
  for (const [key, classKey] of Object.entries(sets)) {
    const set = SETS[key];
    assert.ok(set && set.pieces.length === 5 && set.classKey === classKey, key);
    for (const id of set.pieces) {
      assert.equal(ITEMS[id].tier, 4);
      assert.ok(RECIPES[id], id);
      const info = getCraftInfo(id);
      assert.ok(info && info.minLevel >= 10, `${id} niveau de métier ${info?.minLevel}`);
    }
    const t3 = { guerrier: "chevalier", assassin: "garou", magicien: "esprit" }[classKey];
    const sum = (k, f) => SETS[k].pieces.reduce((a, id) => a + (ITEMS[id][f] || 0), 0);
    const main = classKey === "guerrier" ? "def_phys" : classKey === "magicien" ? "atk_magie" : "critique";
    assert.ok(sum(key, main) > sum(t3, main) * 1.2, `${key} plus fort que ${t3}`);
  }
  for (const id of ["epee_garde_noye", "dague_veneur", "baton_veuve", "bouclier_garde_noye"]) assert.ok(ITEMS[id] && RECIPES[id], id);
  // l'essence de deuil (rare) n'est demandée que pour le plastron
  for (const [id, r] of Object.entries(RECIPES)) if (r.ingredients.essence_de_deuil) assert.ok(id.startsWith("plastron_") || id === "cle_du_manoir_difficile", id);
});

test("un groupe de trois niveau 24 en palier 4 passe le donjon plus souvent qu'en palier 3 (PV reportés, butin cumulé)", () => {
  const SETS4 = { guerrier: { weapon: "epee_garde_noye", set: "garde_noye", shield: "bouclier_garde_noye" }, assassin: { weapon: "dague_veneur", set: "veneur" }, magicien: { weapon: "baton_veuve", set: "veuve" } };
  const gear = (c) => Object.fromEntries([SETS4[c].weapon, ...SETS[SETS4[c].set].pieces, ...(SETS4[c].shield ? [SETS4[c].shield] : [])].map((id) => [ITEMS[id].type, id]));
  const run = (tier4) => {
    const g = (c) => (tier4 ? gear(c) : null);
    const player = makeBotPlayer("assassin", 24, g("assassin"));
    const allies = ["guerrier", "magicien"].map((c) => botSpec(c, 24, { gear: g(c) }));
    let clears = 0, loot = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = autoDungeon(player, allies, dj.rooms, seed);
      if (r.cleared) clears++;
      loot += r.rewards.gold;
      assert.ok(r.rooms >= 0 && r.rooms <= 4);
    }
    return { clears, loot };
  };
  const t4 = run(true), t3 = run(false);
  assert.ok(t4.clears > t3.clears, `palier 4 : ${t4.clears}/12, palier 3 : ${t3.clears}/12`);
  assert.ok(t4.loot > 0);
});

test("clé : comptée, consommée une par une, même sans clé (rien ne change)", () => {
  const key = (uid) => ({ ...ITEMS.cle_du_manoir, uid });
  const p = { inventory: [key("a"), ITEMS.epee_milicien, key("b")] };
  assert.equal(keyCount(p, dj), 2);
  const q = consumeKey(p, dj);
  assert.equal(keyCount(q, dj), 1);
  assert.equal(q.inventory.length, 2);
  assert.equal(keyCount(consumeKey(q, dj), dj), 0);
  const none = { inventory: [ITEMS.epee_milicien] };
  assert.equal(consumeKey(none, dj), none);
});

test("salles jouables comme des rencontres ; butin de la fiche d'entrée ; cumul du butin", () => {
  const enc = roomEncounter(dj, 3);
  assert.ok(enc.boss && enc.enemies[0] === "dame_en_deuil" && enc.banner.includes("Chapelle"));
  assert.ok(!roomEncounter(dj, 0).boss);
  const ids = dungeonDrops(dj, "guerrier").map((d) => d.id);
  for (const id of ["soie_funeraire", "cuir_de_molosse", "plaque_noyee", "larme_de_deuil", "essence_de_deuil", "medaillon_dame_en_deuil"]) assert.ok(ids.includes(id), id);
  const t = addRewards(addRewards(emptyRewards(), { xp: 10, gold: 5, resources: { plaque_noyee: 2 }, items: [] }), { xp: 1, gold: 1, resources: { plaque_noyee: 1, soie_funeraire: 1 }, items: ["medaillon_dame_en_deuil"] });
  assert.deepEqual(t, { xp: 11, gold: 6, resources: { plaque_noyee: 3, soie_funeraire: 1 }, items: ["medaillon_dame_en_deuil"] });
});

test("l'entrée du donjon est sur la carte de la Lisière, sur une case libre et atteignable", () => {
  const map = MAPS.lisiere_des_ombres;
  const b = buildingObjects(map).find((x) => x.kind === "donjon");
  assert.equal(b.dungeon, "manoir_englouti");
  assert.ok(DUNGEONS[b.dungeon]);
  const occupied = [...map.groups, ...map.nodes].some((o) => o.x === b.x && o.y === b.y);
  assert.ok(!occupied, "case déjà prise");
  assert.ok(".:".includes(map.rows[b.y][b.x]), "case non praticable");
});

console.log(`\n${n} tests OK`);
