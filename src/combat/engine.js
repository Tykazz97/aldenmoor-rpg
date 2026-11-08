// ============================================================
// MOTEUR DE COMBAT PAR TOURS (ordre selon l'initiative) — pur, sans React ni DOM.
//
// Le moteur ne dessine rien : il reçoit un état, des actions, et
// renvoie { state, events }. Les `events` décrivent ce qui s'est
// passé (coup, esquive, mort...) pour que l'écran les anime. Comme
// il est indépendant de l'interface, il peut être testé et simulé
// en ligne de commande, et réutilisé plus tard pour le PvP.
//
// Cycle d'un combat :
//   createCombat(...)             crée l'état
//   advance(state)               fait jouer les ennemis et les alliés bots dans
//                                 l'ordre d'initiative jusqu'au tour du joueur
//                                 (ou la fin du combat)
//   castSpell(state, id, cible)   le joueur lance un sort (coûte des PA)
//   endTurn(state)                le joueur termine son tour (PA perdus)
// phase : "running" | "playerTurn" | "victory" | "defeat"
// ============================================================

import { ENEMIES } from "../data/zones.js";
import { WEAPON_TYPES, UNARMED_SPELLS } from "../data/weapons.js";
import { classSpellsAt } from "../data/classes.js";

export const PA_MAX = 6;
export const CRIT_MULT = 1.5;
export const BASE_ATK = 5;       // attaque minimale ajoutée à celle du joueur
export const DAMAGE_VARIANCE = 0.1;

// ------------------------------------------------------------
// Aléatoire reproductible (mulberry32) : même graine => même combat
// ------------------------------------------------------------
function rand(s) {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s, min, max) => min + Math.floor(rand(s) * (max - min + 1));

// ------------------------------------------------------------
// Création
// ------------------------------------------------------------
// Sorts disponibles : celui de l'arme équipée (ou le coup de poing à mains nues),
// puis les sorts de la classe débloqués au niveau du joueur.
export function spellsFor(weaponType, classKey = null, level = 1) {
  const weaponSpells = WEAPON_TYPES[weaponType] ? [WEAPON_TYPES[weaponType].spell] : UNARMED_SPELLS;
  return [...weaponSpells, ...classSpellsAt(classKey, level)];
}

// Un héros (le joueur ou un allié bot) à partir de ses stats calculées (calcStats), son arme et ses sorts.
function makeHero({ id, name, stats, weaponType = null, classKey = null, level = 1, spells = null, ally = false }) {
  const bonuses = (stats.setBonuses || []).map((b) => b.bonus);
  const pv = stats.passives || {};                                            // passifs d'objets (armes uniques) : mêmes drapeaux que les sets
  const riposte = Math.max(0, ...bonuses.map((b) => b.riposte || 0));
  const firstCrit = bonuses.some((b) => b.guaranteedFirstCrit);
  const spellDiscount = Math.max(0, pv.spellDiscount || 0, ...bonuses.map((b) => b.firstSpellDiscount || 0));
  const thorns = Math.max(0, pv.thorns || 0, ...bonuses.map((b) => b.thorns || 0));          // part des dégâts reçus renvoyée en feu noir
  const lifesteal = Math.max(0, pv.lifesteal || 0, ...bonuses.map((b) => b.lifesteal || 0));    // part des dégâts infligés rendue en PV
  const armorPen = Math.max(0, pv.armorPen || 0, ...bonuses.map((b) => b.armorPen || 0));      // part de DEF ignorée par tous les sorts
  const lastStand = pv.lastStand || 0;                                       // un coup fatal laisse ce % de PV (une fois par combat)
  const paBonus = Math.max(0, pv.paBonus || 0);                              // +1 PA définitif : le porteur a 7 PA au lieu de 6 (relique de la Dame en Deuil)
  const finalDamage = Math.max(0, pv.finalDamage || 0);                      // dommages finaux en plus, physiques comme magiques (0,10 = +10 %)
  return {
    id,
    name,
    classKey,
    isPlayer: true,                // « côté héros » : le joueur ET ses alliés
    isAlly: ally,                  // allié piloté par le moteur (bot)
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    stats: {
      atkPhys: stats.atkPhys, atkMagie: stats.atkMagie,
      defPhys: stats.defPhys, defMagie: stats.defMagie,
      esquive: stats.esquive, critique: stats.critique, vitesse: stats.vitesse, // vitesse = initiative
    },
    dropBonus: stats.dropBonus || 0,
    pa: 0,
    paMax: PA_MAX + paBonus,
    effects: [],
    flags: { finalDamage, firstCrit, riposte, spellDiscount, thorns, lifesteal, armorPen, lastStand, lastStandUsed: false, discountReady: false, shadowDodge: false, shadowCrit: false },
    spells: spells || spellsFor(weaponType, classKey, level),
    alive: true,
  };
}

// Points de vie des ennemis selon la taille du groupe de héros : à plusieurs, les monstres encaissent davantage
// (valeurs réglées avec scripts/simulate-zones.js en mode groupe).
export const PARTY_HP_SCALE = { 1: 1, 2: 1, 3: 1 };   // plus de difficulté accrue en groupe
// Bonus d'xp en combat solo (en contrepartie du butin amélioré en groupe)
export const SOLO_XP_MULT = 1.25;
// Bonus de butin selon la taille du groupe : multiplie la chance de chaque drop
export const PARTY_DROP_MULT = { 1: 1, 2: 1.25, 3: 1.5 };

// `spells` : barre de sorts déjà composée (voir buildSpellBar dans utils/spellbook.js). Sans elle, tous les sorts débloqués.
// `allies` : alliés bots, chacun { name, stats, weaponType, classKey, level, spells } (voir sim/partyBots.js). Le joueur reste
// le seul à choisir ses actions ; les alliés jouent seuls à leur tour d'initiative.
// `carry` : PV des héros à l'entrée du combat, pour enchaîner des salles de donjon sans soin entre elles : { player: pv, allies: [pv, ...] }.
// Un héros tombé dans la salle précédente se relève avec au moins DUNGEON_REVIVE de ses PV max.
export const DUNGEON_REVIVE = 0.2;
export function createCombat({ stats, weaponType = null, classKey = null, level = 1, enemyKeys, spells = null, allies = [], seed = Date.now() >>> 0, carry = null }) {
  const s = { seed: seed >>> 0 };

  const player = makeHero({ id: "player", name: "Héros", stats, weaponType, classKey, level, spells });
  const allyHeroes = allies.map((a, i) => makeHero({ id: `ally${i}`, name: a.name || `Allié ${i + 1}`, stats: a.stats, weaponType: a.weaponType, classKey: a.classKey, level: a.level ?? level, spells: a.spells, ally: true }));
  if (carry) {
    const apply = (h, hp) => { if (Number.isFinite(hp)) h.hp = Math.min(h.maxHp, Math.max(Math.ceil(h.maxHp * DUNGEON_REVIVE), Math.round(hp))); };
    apply(player, carry.player);
    allyHeroes.forEach((a, i) => apply(a, carry.allies?.[i]));
  }
  const hpScale = PARTY_HP_SCALE[1 + allyHeroes.length] ?? PARTY_HP_SCALE[3];

  const enemies = enemyKeys.map((key, i) => {
    const def = ENEMIES[key];
    if (!def || !def.stats) throw new Error(`Ennemi sans stats de combat : ${key}`);
    const hp = Math.round(def.stats.hp * hpScale);
    return {
      id: `e${i}`,
      key,
      name: def.name,
      miniBoss: !!def.miniBoss,
      hp,
      maxHp: hp,
      stats: { ...def.stats },
      effects: [],
      alive: true,
      phasesDone: [],
    };
  });

  return {
    seed: s.seed,
    phase: "running",
    round: 0,       // numéro du tour de table en cours (chacun joue une fois par tour)
    order: [],      // ids des combattants dans l'ordre de jeu du tour en cours
    cursor: 0,      // position du prochain combattant à jouer dans `order`
    turns: 0,       // nombre de tours joués par le joueur
    hpScale,        // multiplicateur de PV des ennemis (aussi appliqué aux renforts appelés)
    player,
    allies: allyHeroes,
    enemies,
    rewards: null,
  };
}

// ------------------------------------------------------------
// Utilitaires internes
// ------------------------------------------------------------
const clone = (state) => structuredClone(state);
const aliveEnemies = (s) => s.enemies.filter((e) => e.alive);
const heroes = (s) => [s.player, ...(s.allies || [])];
const actorById = (s, id) => (id === "player" ? s.player : (s.allies || []).find((a) => a.id === id) || s.enemies.find((e) => e.id === id));
const maxEffect = (actor, kind, field = "value") =>
  Math.max(0, ...actor.effects.filter((e) => e.kind === kind).map((e) => e[field] || 0));

// Ordre de jeu : initiative décroissante, égalités tirées au sort.
// Comme dans Dofus, l'initiative est une stat FIXE (aucun sort ni effet ne la
// change) et l'ordre est calculé une seule fois, au début du combat.
function buildOrder(s) {
  return [...heroes(s), ...aliveEnemies(s)]
    .map((a) => ({ id: a.id, init: a.stats.vitesse, tie: rand(s) }))
    .sort((x, y) => y.init - x.init || x.tie - y.tie)
    .map((x) => x.id);
}

// Dernier souffle (relique) : un coup mortel laisse le héros à une part de ses PV, une seule fois par combat
function survivesFatal(events, target) {
  const f = target.flags;
  if (!target.isPlayer || !f || !(f.lastStand > 0) || f.lastStandUsed) return false;
  f.lastStandUsed = true;
  target.hp = Math.max(1, Math.round(target.maxHp * f.lastStand));
  events.push({ type: "lastStand", id: target.id, hpAfter: target.hp });
  return true;
}

function effectiveDef(actor, type, armorPen = 0) {
  let def = type === "mag" ? actor.stats.defMagie : actor.stats.defPhys;
  def *= 1 - maxEffect(actor, "defDown");
  if (type !== "mag") def += maxEffect(actor, "parade", "defUp");
  return Math.max(0, def * (1 - armorPen));
}

// ------------------------------------------------------------
// Une attaque (utilisée par les sorts, les ennemis et les ripostes)
// ------------------------------------------------------------
function attack(s, events, attacker, target, opts) {
  const { type, power, critBonus = 0, armorPen = 0, ignoreEsquive = 0, label, spellId, element, noCounter = false } = opts;

  // Esquive garantie (sort Disparition)
  const shadowed = target.isPlayer && target.flags.shadowDodge;
  const dodgeChance = Math.min(75, target.stats.esquive * (1 - ignoreEsquive)) / 100;
  if (shadowed || rand(s) < dodgeChance) {
    if (shadowed) target.flags.shadowDodge = false;
    events.push({ type: "miss", from: attacker.id, to: target.id, spellId, label });
    return { hit: false, damage: 0 };
  }

  const atk = (type === "mag" ? attacker.stats.atkMagie : attacker.stats.atkPhys) + BASE_ATK;
  const variance = 1 - DAMAGE_VARIANCE + rand(s) * DAMAGE_VARIANCE * 2;
  const reduction = 100 / (100 + effectiveDef(target, type, armorPen));

  let crit = false;
  if (attacker.isPlayer && attacker.flags.firstCrit) { crit = true; attacker.flags.firstCrit = false; }
  else if (attacker.isPlayer && attacker.flags.shadowCrit) { crit = true; attacker.flags.shadowCrit = false; }
  else crit = rand(s) * 100 < Math.min(75, attacker.stats.critique + critBonus);

  const weaken = 1 - maxEffect(attacker, "weaken");   // Givre : l'attaquant fait moins de dégâts
  const finalMult = 1 + (attacker.flags?.finalDamage || 0);                  // dommages finaux (relique)
  const damage = Math.max(1, Math.round(atk * power * variance * reduction * weaken * finalMult * (crit ? CRIT_MULT : 1)));
  const fatal = target.hp - damage <= 0;
  target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: "hit", from: attacker.id, to: target.id, amount: damage, crit,
    hpAfter: target.hp, spellId, label, element, dmgType: type,
  });
  if (fatal) survivesFatal(events, target);

  if (target.hp <= 0) {
    target.alive = false;
    events.push({ type: "death", id: target.id });
  } else if (!target.isPlayer) {
    checkPhases(s, events, target);
  }

  // Épines (set du Chevalier Déchu) : une part des dégâts reçus est renvoyée à l'attaquant en feu noir
  if (target.isPlayer && target.alive && target.flags.thorns > 0 && attacker.alive && !noCounter) {
    const back = Math.max(1, Math.round(damage * target.flags.thorns));
    attacker.hp = Math.max(0, attacker.hp - back);
    events.push({ type: "dot", id: attacker.id, amount: back, element: "feu", hpAfter: attacker.hp });
    if (attacker.hp <= 0) { attacker.alive = false; events.push({ type: "death", id: attacker.id }); }
    else if (!attacker.isPlayer) checkPhases(s, events, attacker);
  }

  // Contre-attaque du joueur : Parade (sort) ou Riposte (bonus du set Vétéran)
  if (target.isPlayer && target.alive && !noCounter && attacker.alive) {
    const parade = target.effects.find((e) => e.kind === "parade");
    let counterPower = 0;
    if (parade) counterPower = parade.counter;
    else if (target.flags.riposte > 0 && rand(s) < target.flags.riposte) counterPower = 0.5;
    if (counterPower > 0) {
      events.push({ type: "counter", from: target.id, to: attacker.id });
      attack(s, events, target, attacker, { type: "phys", power: counterPower, label: "Riposte", noCounter: true });
    }
  }

  return { hit: true, damage, crit };
}

// Appel de renforts : les nouveaux ennemis rejoignent le combat, juste après l'invocateur dans l'ordre de jeu
const MAX_ENEMIES = 3;
function summonEnemies(s, events, summoner, keys) {
  const room = MAX_ENEMIES - aliveEnemies(s).length;
  const added = [];
  for (const key of keys.slice(0, Math.max(0, room))) {
    const def = ENEMIES[key];
    const id = `e${s.enemies.length}`;
    const hp = Math.round(def.stats.hp * (s.hpScale || 1));
    const en = { id, key, name: def.name, miniBoss: false, hp, maxHp: hp, stats: { ...def.stats }, effects: [], alive: true, phasesDone: [], summoned: true };
    s.enemies.push(en);
    added.push({ id, key, name: en.name, hp: en.hp, maxHp: en.maxHp });
  }
  if (!added.length) return;
  const at = s.order.indexOf(summoner.id) + 1;
  s.order.splice(at, 0, ...added.map((a) => a.id));
  if (at < s.cursor) s.cursor += added.length;   // l'invocateur a déjà joué ce tour : le curseur garde sa place
  events.push({ type: "summon", from: summoner.id, enemies: added });
}

// Phase de rage des mini-boss quand leurs PV passent sous un seuil
function checkPhases(s, events, enemy) {
  const def = ENEMIES[enemy.key];
  (def.phases || []).forEach((ph, i) => {
    if (enemy.phasesDone.includes(i)) return;
    if (enemy.hp / enemy.maxHp < ph.below) {
      enemy.phasesDone.push(i);
      if (ph.atkMult) { enemy.stats.atkPhys *= ph.atkMult; enemy.stats.atkMagie *= ph.atkMult; }
      events.push({ type: "phase", id: enemy.id, text: ph.announce });
      if (ph.summon) summonEnemies(s, events, enemy, ph.summon);
    }
  });
}

// Applique l'effet d'un sort ou d'une action à une cible touchée
function applyEffect(s, events, source, target, effect, atkType = "phys") {
  if (!effect || !target.alive) return;
  if (effect.kind === "paLoss") {
    // Retrait de PA : la cible aura moins de PA à son prochain tour (puis ça passe)
    const existing = target.effects.find((e) => e.kind === "paLoss");
    if (existing) existing.value += effect.value;
    else target.effects.push({ kind: "paLoss", turns: 1, value: effect.value });
    events.push({ type: "paLoss", id: target.id, amount: effect.value });
    return;
  }
  const entry = { kind: effect.kind, turns: effect.turns, value: effect.value, element: effect.element };
  if (effect.kind === "dot") {
    // Dégâts par tour = ratio × attaque du lanceur (physique ou magique selon le sort)
    const atk = atkType === "mag" ? source.stats.atkMagie : source.stats.atkPhys;
    entry.damage = Math.max(1, Math.round((atk + BASE_ATK) * effect.ratio));
  }
  // Un même effet n'est pas cumulé : on rafraîchit sa durée
  const existing = target.effects.find((e) => e.kind === effect.kind && e.element === effect.element);
  if (existing) Object.assign(existing, entry);
  else target.effects.push(entry);
  events.push({ type: "effect", id: target.id, kind: effect.kind, element: effect.element, turns: effect.turns });
}

// Début de tour d'un combattant : dégâts sur la durée, puis les effets durent un tour de moins
function startTurn(s, events, actor) {
  for (const e of actor.effects.filter((x) => x.kind === "dot")) {
    if (!actor.alive) break;
    const fatal = actor.hp - e.damage <= 0;
    actor.hp = Math.max(0, actor.hp - e.damage);
    events.push({ type: "dot", id: actor.id, amount: e.damage, element: e.element, hpAfter: actor.hp });
    if (fatal) survivesFatal(events, actor);
    if (actor.hp <= 0) {
      actor.alive = false;
      events.push({ type: "death", id: actor.id });
    }
  }
  actor.effects.forEach((e) => { if (e.turns != null) e.turns -= 1; });
  actor.effects = actor.effects.filter((e) => e.turns == null || e.turns > 0);
}

// ------------------------------------------------------------
// Fin de combat
// ------------------------------------------------------------
function rollRewards(s) {
  const rewards = { xp: 0, gold: 0, resources: {}, items: [], kills: {} };
  const groupMult = PARTY_DROP_MULT[1 + (s.allies || []).length] ?? PARTY_DROP_MULT[3];
  const soloXp = (s.allies || []).length === 0 ? SOLO_XP_MULT : 1;
  const mult = (1 + (s.player.dropBonus || 0) / 100) * groupMult;
  for (const e of s.enemies) {
    if (e.summoned) continue;   // les renforts appelés en combat ne rapportent rien
    const def = ENEMIES[e.key];
    rewards.xp += Math.round((def.xp || 0) * soloXp);
    rewards.kills[e.key] = (rewards.kills[e.key] || 0) + 1;
    if (def.gold) rewards.gold += randInt(s, def.gold[0], def.gold[1]);
    for (const d of def.drops || []) {
      if (d.forClass && d.forClass !== s.player.classKey) continue;   // butin propre à une classe (armes uniques)
      if (rand(s) < Math.min(1, d.fixed ? d.chance : d.chance * mult)) {
        const qty = randInt(s, d.min, d.max);
        if (d.type === "resource") rewards.resources[d.id] = (rewards.resources[d.id] || 0) + qty;
        else for (let i = 0; i < qty; i++) rewards.items.push(d.id);
      }
    }
  }
  return rewards;
}

function checkEnd(s, events) {
  if (s.phase === "victory" || s.phase === "defeat") return;
  if (!s.player.alive) {
    s.phase = "defeat";
    events.push({ type: "defeat" });
  } else if (aliveEnemies(s).length === 0) {
    s.phase = "victory";
    s.rewards = rollRewards(s);
    events.push({ type: "victory", rewards: s.rewards });
  }
}

// ------------------------------------------------------------
// Tour d'un ennemi
// ------------------------------------------------------------
const ACTION_PA = 3;   // coût par défaut d'une action ennemie
const ENEMY_PA = 6;    // PA par tour d'un ennemi, sauf indication contraire

function chooseAction(s, actions) {
  const total = actions.reduce((sum, a) => sum + a.weight, 0);
  let r = rand(s) * total;
  for (const a of actions) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return actions[actions.length - 1];
}

// Cible d'une action ennemie : un héros vivant au hasard (sans tirage quand il n'y en a qu'un)
function pickHeroTarget(s) {
  const alive = heroes(s).filter((h) => h.alive);
  if (alive.length <= 1) return alive[0] || null;
  return alive[Math.floor(rand(s) * alive.length)];
}

// Un ennemi dépense ses PA en enchaînant des actions, comme le joueur
function enemyAct(s, events, enemy, budget) {
  let pa = budget;
  const all = ENEMIES[enemy.key].actions;
  while (pa > 0 && enemy.alive && s.phase === "running") {
    const options = all.filter((a) => (a.pa ?? ACTION_PA) <= pa && (a.needsPhase == null || enemy.phasesDone.includes(a.needsPhase)));
    if (!options.length) break;
    const action = chooseAction(s, options);
    pa -= action.pa ?? ACTION_PA;
    const target = pickHeroTarget(s);
    if (!target) break;
    events.push({ type: "cast", from: enemy.id, label: action.name, spellType: action.type, targets: [target.id] });
    const res = attack(s, events, enemy, target, { type: action.type, power: action.power, label: action.name });
    if (res.hit && action.effect) applyEffect(s, events, enemy, target, action.effect);
    checkEnd(s, events);
  }
}

// ------------------------------------------------------------
// Boucle des tours
// ------------------------------------------------------------
// Fait jouer les combattants suivants dans l'ordre, jusqu'à ce que
// ce soit au joueur de jouer, ou que le combat soit fini.
export function advance(state) {
  if (state.phase !== "running") return { state, events: [] };
  const s = clone(state);
  const events = [];

  let guard = 0;
  while (s.phase === "running" && guard++ < 1000) {
    if (s.cursor >= s.order.length) {
      s.round += 1;
      if (s.order.length === 0) s.order = buildOrder(s);   // une seule fois : l'ordre ne change plus
      s.cursor = 0;
      events.push({ type: "round", n: s.round, order: [...s.order] });
    }
    const actor = actorById(s, s.order[s.cursor++]);
    if (!actor.alive) continue;

    events.push({ type: "turn", id: actor.id, round: s.round });
    // Retrait de PA subi : lu avant que startTurn ne fasse expirer l'effet
    const paLoss = actor.effects.filter((e) => e.kind === "paLoss").reduce((sum, e) => sum + e.value, 0);
    startTurn(s, events, actor);          // dégâts sur la durée, durée des effets
    if (!actor.alive) { checkEnd(s, events); continue; }
    const basePa = actor.isPlayer ? (actor.paMax ?? PA_MAX) : (actor.stats.pa ?? ENEMY_PA);   // joueur et alliés : 6 PA (+ bonus de relique)
    const pa = Math.max(0, basePa - paLoss);
    if (pa === 0) { events.push({ type: "skip", id: actor.id }); continue; }

    if (actor.id === "player") {
      s.turns += 1;
      s.player.pa = pa;
      s.player.flags.discountReady = s.player.flags.spellDiscount > 0;
      s.phase = "playerTurn";
      events.push({ type: "playerTurn", pa });
    } else if (actor.isAlly) {
      actor.pa = pa;
      actor.flags.discountReady = actor.flags.spellDiscount > 0;
      allyAct(s, events, actor);
    } else {
      enemyAct(s, events, actor, pa);
    }
  }
  return { state: s, events };
}

// ------------------------------------------------------------
// Actions du joueur
// ------------------------------------------------------------
// Coût réel d'un sort : le set Apprenti (5 pièces) réduit le premier sort de chaque tour
const costFor = (hero, spell) => (hero.flags.discountReady ? Math.max(1, spell.pa - hero.flags.spellDiscount) : spell.pa);
export function spellCost(state, spell) {
  return costFor(state.player, spell);
}

export function canCast(state, spell) {
  return state.phase === "playerTurn" && state.player.pa >= spellCost(state, spell);
}

// Lance un sort pour un héros (le joueur ou un allié) sur l'état `s` (déjà copié) ; ajoute les évènements.
function performCast(s, events, caster, spell, targetId) {
  caster.pa -= costFor(caster, spell);
  caster.flags.discountReady = false;

  // Sorts sur soi
  if (spell.type === "buff") {
    events.push({ type: "cast", from: caster.id, spellId: spell.id, label: spell.name, spellType: "buff", targets: [caster.id] });
    const fx = spell.selfEffect;
    if (fx.kind === "parade") {
      caster.effects = caster.effects.filter((e) => e.kind !== "parade");
      caster.effects.push({ kind: "parade", turns: fx.turns, defUp: fx.defUp, counter: fx.counter });
      events.push({ type: "effect", id: caster.id, kind: "parade", turns: fx.turns });
    } else if (fx.kind === "shadow") {
      caster.flags.shadowDodge = true;
      caster.flags.shadowCrit = true;
      events.push({ type: "effect", id: caster.id, kind: "shadow" });
    }
    return;
  }

  const targets = spell.aoe ? aliveEnemies(s) : [actorById(s, targetId)];
  events.push({
    type: "cast", from: caster.id, spellId: spell.id, label: spell.name, spellType: spell.type,
    element: spell.applyElement, aoe: !!spell.aoe, targets: targets.map((t) => t.id),
  });

  let totalDamage = 0;
  for (const t of targets) {
    const res = attack(s, events, caster, t, {
      type: spell.type, power: spell.power, critBonus: spell.critBonus || 0,
      armorPen: Math.min(0.6, (spell.armorPen || 0) + (caster.flags.armorPen || 0)), ignoreEsquive: spell.ignoreEsquive || 0,
      label: spell.name, spellId: spell.id, element: spell.applyElement,
    });
    if (res.hit) {
      totalDamage += res.damage;
      if (spell.effect) applyEffect(s, events, caster, t, spell.effect, spell.type);
    }
  }

  const steal = (spell.lifesteal || 0) + (caster.flags.lifesteal || 0);
  if (steal > 0 && totalDamage > 0 && caster.alive) {
    const heal = Math.max(1, Math.round(totalDamage * steal));
    caster.hp = Math.min(caster.maxHp, caster.hp + heal);
    events.push({ type: "heal", id: caster.id, amount: heal, hpAfter: caster.hp });
  }
  checkEnd(s, events);
}

export function castSpell(state, spellId, targetId = null) {
  if (state.phase !== "playerTurn") return { state, events: [] };
  const spell = state.player.spells.find((sp) => sp.id === spellId);
  if (!spell || !canCast(state, spell)) return { state, events: [] };

  const needsTarget = spell.type !== "buff" && !spell.aoe;
  if (needsTarget) {
    const t = actorById(state, targetId);
    if (!t || !t.alive || t.isPlayer) return { state, events: [] };
  }

  const s = clone(state);
  const events = [];
  performCast(s, events, s.player, spell, targetId);
  return { state: s, events };
}

// ------------------------------------------------------------
// Tour d'un allié (bot) : il enchaîne le sort le plus rentable (dégâts par PA) sur l'ennemi le plus faible
// (comme le joueur automatique des simulations ; il n'utilise ni parade ni sorts de soutien).
// ------------------------------------------------------------
export function pickAllySpell(s, ally) {
  const living = aliveEnemies(s).length;
  let best = null, bestScore = 0;
  for (const sp of ally.spells) {
    if (sp.type === "buff" || costFor(ally, sp) > ally.pa) continue;
    const score = (sp.power * (sp.aoe ? living : 1)) / costFor(ally, sp);
    if (score > bestScore) { best = sp; bestScore = score; }
  }
  return best;
}

function allyAct(s, events, ally) {
  for (let guard = 0; guard < 20 && ally.alive && s.phase === "running"; guard++) {
    const spell = pickAllySpell(s, ally);
    const target = aliveEnemies(s).sort((a, b) => a.hp - b.hp)[0];
    if (!spell || !target) break;
    performCast(s, events, ally, spell, target.id);
  }
  ally.pa = 0;
}

export function endTurn(state) {
  if (state.phase !== "playerTurn") return { state, events: [] };
  const s = clone(state);
  s.player.pa = 0;     // les PA non utilisés sont perdus
  s.phase = "running";
  return { state: s, events: [{ type: "endTurn" }] };
}
