import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./combat.css";
import { createCombat, advance, castSpell, endTurn, canCast, spellCost, spellsFor, PA_MAX } from "../../combat/engine.js";
import { ENEMIES } from "../../data/zones.js";
import { ENCOUNTERS } from "../../data/encounters.js";
import { RESOURCES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { WEAPON_TYPES } from "../../data/weapons.js";
import { heroOutfitFor, heroSpriteUrl } from "../../data/heroSprites.js";
import { applyRewards, xpToNext } from "../../utils/progression.js";
import { sfx, isMuted, setMuted } from "./sfx.js";
import { color, font } from "../../styles/theme.js";

// ------------------------------------------------------------
// Constantes de mise en scène
// ------------------------------------------------------------
const HERO_X = 17;       // % de la largeur de l'arène
const HERO_B = 64;       // px depuis le bas
const HERO_H = 250;      // hauteur d'affichage du héros (px)

const ELEMENT_COLOR = { feu: "#ff9a4d", poison: "#8fdc5a", givre: "#8fd3f5", arcane: "#a99bff", phys: "#ffe7a8" };
const RANGED = new Set(["tir_rapide", "tir_percant", "pluie_de_fleches"]);
const STATUS_LABEL = { dot: { feu: "Brûlure", poison: "Poison" }, slow: "Ralenti", defDown: "Armure brisée", parade: "Parade", shadow: "Disparition" };
const BADGE = { feu: "🔥", poison: "☠️", slow: "❄️", defDown: "💔", parade: "🛡️", stun: "💫", shadow: "🌑" };

function enemySlots(list) {
  const n = list.length;
  const xs = n === 1 ? [72] : n === 2 ? [62, 82] : [57, 72, 87];
  const bs = n === 3 ? [78, 52, 78] : n === 2 ? [66, 66] : [60];
  return list.map((e, i) => ({ x: xs[i], b: bs[i], h: ENEMIES[e.key].spriteHeight || 200 }));
}

// Animations des sprites (Web Animations API : pas de remontage du DOM)
const ANIMS = {
  attackR: { frames: [{ transform: "translateX(0)" }, { transform: "translateX(-14px) scale(1.02)", offset: 0.25 }, { transform: "translateX(150px)", offset: 0.5 }, { transform: "translateX(0)" }], ms: 480, easing: "cubic-bezier(.3,0,.3,1)" },
  attackL: { frames: [{ transform: "translateX(0)" }, { transform: "translateX(12px)", offset: 0.25 }, { transform: "translateX(-120px) scale(1.06)", offset: 0.5 }, { transform: "translateX(0)" }], ms: 520, easing: "cubic-bezier(.3,0,.3,1)" },
  cast: { frames: [{ transform: "translateY(0)", filter: "brightness(1)" }, { transform: "translateY(-14px) scale(1.04)", filter: "brightness(1.6) saturate(1.4)", offset: 0.4 }, { transform: "translateY(0)", filter: "brightness(1)" }], ms: 480, easing: "ease-out" },
  hurt: { frames: [{ transform: "translateX(0)", filter: "brightness(1)" }, { transform: "translateX(var(--kb, 12px))", filter: "brightness(2.4) sepia(1) hue-rotate(-30deg) saturate(5)", offset: 0.2 }, { transform: "translateX(calc(var(--kb, 12px) * -.4))", filter: "brightness(1.3)", offset: 0.5 }, { transform: "translateX(0)", filter: "brightness(1)" }], ms: 380, easing: "ease-out" },
  dodge: { frames: [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(var(--dg, -34px))", opacity: 0.55, offset: 0.4 }, { transform: "translateX(0)", opacity: 1 }], ms: 420, easing: "ease-out" },
  stun: { frames: [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0)" }], ms: 600, easing: "linear" },
  rage: { frames: [{ transform: "scale(1)" }, { transform: "scale(1.14)", offset: 0.3 }, { transform: "scale(1)" }], ms: 700, easing: "ease-out" },
};

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
let fxCounter = 0;

// Découpe une liste d'évènements en "actions" jouées l'une après l'autre
function groupEvents(events) {
  const groups = [];
  let cur = null;
  for (const e of events) {
    const starts = ["cast", "dot", "playerTurn", "endTurn", "victory", "defeat"].includes(e.type);
    if (!cur || starts) { cur = []; groups.push(cur); }
    cur.push(e);
  }
  return groups;
}

// ============================================================
// Écran principal : choix de la rencontre, puis combat
// ============================================================
export default function CombatScreen({ player, stats, onRewards }) {
  const [encounter, setEncounter] = useState(null);
  const [fightKey, setFightKey] = useState(0);

  const weaponType = player.equipped.arme?.weaponType || null;
  const outfit = heroOutfitFor(stats.setBonuses);
  const heroSrc = heroSpriteUrl(outfit);

  if (!encounter) {
    return <EncounterSelect player={player} stats={stats} weaponType={weaponType} heroSrc={heroSrc} onPick={(enc) => { sfx.click(); setEncounter(enc); setFightKey((k) => k + 1); }} />;
  }
  return (
    <Fight
      key={fightKey}
      encounter={encounter}
      player={player}
      stats={stats}
      weaponType={weaponType}
      heroSrc={heroSrc}
      onRewards={onRewards}
      onRestart={() => setFightKey((k) => k + 1)}
      onExit={() => setEncounter(null)}
    />
  );
}

// ------------------------------------------------------------
// Sélection de la rencontre
// ------------------------------------------------------------
function EncounterSelect({ player, stats, weaponType, heroSrc, onPick }) {
  const spells = spellsFor(weaponType);
  const weapon = player.equipped.arme;
  return (
    <div className="cb-select">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 4 }}>
        <div>
          <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright, letterSpacing: "0.04em" }}>Prairies Sauvages</div>
          <div style={{ fontSize: 12, color: color.mist, marginTop: 2 }}>Choisis ton adversaire. Perdre ne coûte rien : tu peux toujours recommencer.</div>
        </div>
        {ENCOUNTERS.map((enc) => (
          <button key={enc.id} className={`cb-enc ${enc.boss ? "boss" : ""}`} onClick={() => onPick(enc)}>
            <div className="thumbs">
              {enc.enemies.map((k, i) => <img key={i} src={ENEMIES[k].img} alt="" style={{ height: `${Math.min(100, (ENEMIES[k].spriteHeight / 290) * 100 + 18)}%` }} />)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {enc.name}<span className={`cb-tag ${enc.boss ? "boss" : ""}`}>{enc.level}</span>
              </div>
              <div style={{ fontSize: 12, color: color.parchmentDim, marginTop: 3 }}>{enc.desc}</div>
            </div>
            <div style={{ color: color.gold, fontSize: 20 }}>⚔</div>
          </button>
        ))}
      </div>

      <div style={{ background: color.panel, border: "1px solid #2a2a3d", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", height: 190, background: "radial-gradient(ellipse at 50% 90%, rgba(255,160,80,.18), transparent 70%)", borderRadius: 10 }}>
          <img src={heroSrc} alt="Héros" style={{ height: 180, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.6))" }} />
        </div>
        <div style={{ textAlign: "center", fontFamily: font.display, color: color.goldBright }}>{player.name} · Niveau {player.level}</div>
        <div style={{ fontSize: 12, color: color.mist, textAlign: "center" }}>
          {weapon ? <>Arme : <span style={{ color: color.parchment }}>{weapon.name}</span> ({WEAPON_TYPES[weaponType]?.style})</> : "À mains nues — équipe une arme dans l'onglet Personnage !"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11, textAlign: "center" }}>
          <Mini label="PV" value={stats.maxHp} c="#c0392b" />
          <Mini label="Vitesse" value={stats.vitesse} c={color.frost} />
          <Mini label="PA" value={PA_MAX} c={color.goldBright} />
          <Mini label="ATK Phys" value={stats.atkPhys} c={color.phys} />
          <Mini label="ATK Mag" value={stats.atkMagie} c={color.mag} />
          <Mini label="Esquive" value={`${Math.round(stats.esquive)}%`} c={color.success} />
        </div>
        <div style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".08em" }}>Sorts disponibles</div>
        {spells.map((sp) => (
          <div key={sp.id} style={{ fontSize: 12, color: color.parchmentDim, borderLeft: `3px solid ${sp.type === "mag" ? color.mag : sp.type === "buff" ? color.frost : color.phys}`, paddingLeft: 8 }}>
            <span style={{ color: color.parchment, fontWeight: 600 }}>{sp.name}</span> <span style={{ color: color.gold }}>· {sp.pa} PA</span>
            <div style={{ fontSize: 11 }}>{sp.desc}</div>
          </div>
        ))}
        {stats.setBonuses.length > 0 && (
          <div style={{ fontSize: 11, color: color.mist }}>
            {stats.setBonuses.map((b) => <div key={b.set.key} style={{ color: b.set.color }}>{b.set.name} ({b.count}/5) — {b.bonus.desc}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

const Mini = ({ label, value, c }) => (
  <div style={{ background: "#0a0a0f", border: "1px solid #2a2a3d", borderRadius: 8, padding: "5px 2px" }}>
    <div style={{ color: "#74748a", fontSize: 10 }}>{label}</div>
    <div style={{ color: c, fontFamily: font.data, fontSize: 14 }}>{value}</div>
  </div>
);

// ------------------------------------------------------------
// Un combat
// ------------------------------------------------------------
function Fight({ encounter, player, stats, weaponType, heroSrc, onRewards, onRestart, onExit }) {
  const initial = useMemo(() => createCombat({ stats, weaponType, enemyKeys: encounter.enemies }), []); // eslint-disable-line
  const [cs, setCs] = useState(initial);
  const csRef = useRef(initial);
  const busyRef = useRef(true);
  const aliveRef = useRef(true);
  const speedRef = useRef(1);
  const spriteRefs = useRef({});
  const shakeRef = useRef(null);

  const [busy, setBusy] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mute, setMute] = useState(isMuted());
  const [hpView, setHpView] = useState(() => Object.fromEntries([initial.player, ...initial.enemies].map((a) => [a.id, a.hp])));
  const [ghost, setGhost] = useState(() => Object.fromEntries([initial.player, ...initial.enemies].map((a) => [a.id, a.hp])));
  const [dead, setDead] = useState({});
  const [enraged, setEnraged] = useState({});
  const [floats, setFloats] = useState([]);
  const [fxs, setFxs] = useState([]);
  const [banner, setBanner] = useState(null);
  const [target, setTarget] = useState("e0");
  const [hover, setHover] = useState(null);
  const [ended, setEnded] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const slots = useMemo(() => enemySlots(initial.enemies), [initial]);
  const slotOf = (id) => slots[Number(id.slice(1))];
  const anchor = (id) => (id === "player" ? { x: HERO_X, y: HERO_B + HERO_H * 0.5 } : { x: slotOf(id).x, y: slotOf(id).b + slotOf(id).h * 0.5 });

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const commit = useCallback((state) => { csRef.current = state; setCs(state); }, []);
  const sleep = useCallback((ms) => sleepMs(ms / speedRef.current), []);

  // --- petites aides visuelles ---
  const pulse = useCallback((id, name, vars) => {
    const el = spriteRefs.current[id]; const a = ANIMS[name];
    if (!el || !a || !el.animate) return;
    if (vars) Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.animate(a.frames, { duration: a.ms / speedRef.current, easing: a.easing });
  }, []);
  const shake = useCallback((strong) => {
    const el = shakeRef.current; if (!el || !el.animate) return;
    const m = strong ? 9 : 5;
    el.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-m}px,${m / 2}px)` }, { transform: `translate(${m}px,${-m / 2}px)` }, { transform: `translate(${-m / 2}px,0)` }, { transform: "translate(0,0)" }], { duration: 320, easing: "ease-out" });
  }, []);
  const addFloat = useCallback((id, text, cls, dy = 0) => {
    const a = anchor(id); const key = ++fxCounter;
    setFloats((f) => [...f, { key, x: a.x + (Math.random() * 3 - 1.5), y: a.y + 40 + dy, text, cls }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 1150);
  }, []); // eslint-disable-line
  const addFx = useCallback((id, kind, opts = {}) => {
    const a = anchor(id); const key = ++fxCounter;
    setFxs((f) => [...f, { key, x: a.x, y: a.y, kind, ...opts }]);
    setTimeout(() => setFxs((f) => f.filter((x) => x.key !== key)), 1100);
  }, []); // eslint-disable-line
  const showBanner = useCallback((text, cls = "", ms = 1200) => {
    const key = ++fxCounter; setBanner({ key, text, cls });
    setTimeout(() => setBanner((b) => (b && b.key === key ? null : b)), ms);
  }, []);

  // --- lecture d'une action (liste d'évènements du moteur) ---
  const playGroup = useCallback(async (g) => {
    const cast = g.find((e) => e.type === "cast");
    const isHero = cast?.from === "player";

    if (cast) {
      if (isHero) {
        const ranged = RANGED.has(cast.spellId) || cast.spellType === "mag";
        if (cast.spellType === "buff") { pulse("player", "cast"); sfx.buff(); }
        else if (ranged) { pulse("player", "cast"); cast.spellType === "mag" ? sfx.magic() : sfx.swing(); }
        else { pulse("player", "attackR"); setTimeout(sfx.swing, 120 / speedRef.current); }
        addFloat("player", cast.label, "label", 70);
        await sleep(cast.spellType === "buff" ? 400 : ranged ? 300 : 250);
        if (ranged && cast.spellType !== "buff") {
          const from = anchor("player");
          cast.targets.forEach((tid) => {
            const to = anchor(tid); const key = ++fxCounter;
            const col = ELEMENT_COLOR[cast.element] || (cast.spellType === "mag" ? ELEMENT_COLOR.arcane : null);
            setFxs((f) => [...f, { key, kind: "proj", x0: from.x + 6, y0: from.y, x1: to.x, y1: to.y, col, arrow: cast.spellType !== "mag" }]);
            setTimeout(() => setFxs((f) => f.filter((x) => x.key !== key)), 400);
          });
          await sleep(250);
        }
      } else {
        pulse(cast.from, "attackL");
        addFloat(cast.from, cast.label, "label", 90);
        sfx.swing();
        await sleep(300);
      }
    }

    for (const e of g) {
      switch (e.type) {
        case "hit": {
          setHpView((v) => ({ ...v, [e.to]: e.hpAfter }));
          setTimeout(() => setGhost((v) => ({ ...v, [e.to]: e.hpAfter })), 450);
          pulse(e.to, "hurt", { "--kb": e.to === "player" ? "-14px" : "14px" });
          const kind = e.element === "feu" ? "fire" : e.element === "poison" ? "poison" : e.element === "givre" ? "frost" : e.dmgType === "mag" ? "arcane" : "slash";
          addFx(e.to, kind, { flip: e.to === "player" });
          addFx(e.to, "spark", { crit: e.crit });
          addFloat(e.to, e.crit ? `${e.amount} !` : `${e.amount}`, e.crit ? "crit" : e.to === "player" ? "dmgP" : "dmg");
          if (e.crit) shake(true); else if (e.to === "player") shake(false);
          sfx.hit(e.crit);
          if (cast?.aoe) await sleep(120);
          break;
        }
        case "miss":
          addFloat(e.to, "Esquive", "miss");
          pulse(e.to, "dodge", { "--dg": e.to === "player" ? "-40px" : "40px" });
          sfx.miss();
          break;
        case "death":
          setDead((d) => ({ ...d, [e.id]: true }));
          sfx.death();
          await sleep(200);
          break;
        case "dot":
          setHpView((v) => ({ ...v, [e.id]: e.hpAfter }));
          setTimeout(() => setGhost((v) => ({ ...v, [e.id]: e.hpAfter })), 450);
          pulse(e.id, "hurt");
          addFx(e.id, e.element === "feu" ? "fire" : "poison");
          addFloat(e.id, `${e.amount}`, e.element || "dmg");
          sfx.hit(false);
          await sleep(450);
          break;
        case "heal":
          setHpView((v) => ({ ...v, [e.id]: e.hpAfter }));
          setGhost((v) => ({ ...v, [e.id]: e.hpAfter }));
          addFx(e.id, "heal");
          addFloat(e.id, `+${e.amount}`, "heal");
          sfx.heal();
          break;
        case "effect": {
          const label = e.kind === "dot" ? STATUS_LABEL.dot[e.element] : STATUS_LABEL[e.kind];
          if (label) addFloat(e.id, label, `status ${e.element || ""}`, 36);
          if (e.kind === "parade") addFx(e.id, "shield");
          if (e.kind === "shadow") addFx(e.id, "smoke");
          if (e.kind === "slow") addFx(e.id, "frost");
          break;
        }
        case "stun":
          addFloat(e.id, "Étourdi", "status", 36);
          pulse(e.id, "stun");
          break;
        case "counter":
          addFloat("player", "Contre-attaque", "label", 70);
          pulse("player", "attackR");
          await sleep(220);
          break;
        case "phase":
          setEnraged((r) => ({ ...r, [e.id]: true }));
          showBanner(e.text, "rage small", 1500);
          pulse(e.id, "rage"); shake(true); sfx.roar();
          await sleep(1000);
          break;
        case "playerTurn":
          showBanner("À vous !", "small", 800); sfx.turn();
          await sleep(350);
          break;
        case "victory": sfx.win(); await sleep(500); break;
        case "defeat": sfx.lose(); await sleep(600); break;
        default: break;
      }
    }
    await sleep(cast ? 380 : 120);
  }, []); // eslint-disable-line

  const play = useCallback(async (events) => {
    busyRef.current = true; setBusy(true);
    for (const g of groupEvents(events)) {
      if (!aliveRef.current) return;
      await playGroup(g);
    }
    if (!aliveRef.current) return;
    busyRef.current = false; setBusy(false);
    const ph = csRef.current.phase;
    if (ph === "victory" || ph === "defeat") setEnded(ph);
    else if (ph === "playerTurn") {
      setTarget((t) => (csRef.current.enemies.find((e) => e.id === t && e.alive) ? t : csRef.current.enemies.find((e) => e.alive)?.id));
    }
  }, [playGroup]);

  // Introduction puis démarrage
  useEffect(() => {
    showBanner(encounter.boss ? encounter.name : "Combat !", "", 1300);
    const t = setTimeout(() => { busyRef.current = false; setBusy(false); }, 1100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // Boucle de temps : la jauge ATB avance tant que personne n'agit
  useEffect(() => {
    let raf; let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!busyRef.current && csRef.current.phase === "running") {
        const r = advance(csRef.current, dt * speedRef.current);
        commit(r.state);
        if (r.events.length) play(r.events);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [commit, play]);

  // --- actions du joueur ---
  const living = cs.enemies.filter((e) => e.alive);
  const currentTarget = living.find((e) => e.id === target) ? target : living[0]?.id;
  const myTurn = cs.phase === "playerTurn" && !busy;

  const cast = (spell) => {
    const st = csRef.current;
    if (busyRef.current || st.phase !== "playerTurn" || !canCast(st, spell)) return;
    const tid = currentTarget;
    const r = castSpell(st, spell.id, tid);
    if (!r.events.length) return;
    commit(r.state); play(r.events);
  };
  const finishTurn = () => {
    if (busyRef.current || csRef.current.phase !== "playerTurn") return;
    sfx.click();
    const r = endTurn(csRef.current);
    commit(r.state);
  };

  // Raccourcis clavier : 1-3 sorts, Espace = fin de tour
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.target.tagName === "INPUT") return;
      const sp = csRef.current.player.spells;
      const n = Number(ev.key);
      if (n >= 1 && n <= sp.length) cast(sp[n - 1]);
      else if (ev.code === "Space") { ev.preventDefault(); finishTurn(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const claim = () => {
    if (claimed) return;
    setClaimed(true);
    onRewards(cs.rewards);
    onExit();
  };

  const p = cs.player;
  const hasAoeHover = hover && p.spells.find((s) => s.id === hover)?.aoe;
  const hoverSpell = p.spells.find((s) => s.id === hover);
  const rewardsPreview = ended === "victory" && cs.rewards ? applyRewards(player, cs.rewards) : null;
  const outfitClass = p.flags.shadowDodge ? "cb-hero-shadow" : "";

  return (
    <div className="cb-root">
      {/* ---------- ARÈNE ---------- */}
      <div className="cb-arena">
        <div className="cb-shaker" ref={shakeRef}>
          <Backdrop />

          {/* Héros */}
          <div className={`cb-actor ${ended === "defeat" ? "hero-dead" : ""}`} style={{ left: `${HERO_X}%`, bottom: HERO_B, zIndex: 5 }}>
            <Bars actor={p} hp={hpView.player} ghost={ghost.player} isPlayer />
            <div className="cb-body" style={{ position: "relative" }}>
              <div className="cb-shadow" />
              <div className="cb-idle">
                <div ref={(el) => { spriteRefs.current.player = el; }}>
                  <img className={`cb-sprite ${outfitClass}`} src={heroSrc} alt="Héros" style={{ height: HERO_H }} draggable={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Ennemis */}
          {cs.enemies.map((en, i) => {
            const sl = slots[i];
            const isTarget = myTurn && currentTarget === en.id && !hasAoeHover;
            return (
              <div
                key={en.id}
                className={`cb-actor ${dead[en.id] ? "dead" : "target"}`}
                style={{ left: `${sl.x}%`, bottom: sl.b, zIndex: 10 - Math.round(sl.b / 20) }}
                onClick={() => { if (!dead[en.id] && en.alive) { sfx.click(); setTarget(en.id); } }}
              >
                {!dead[en.id] && (isTarget || hasAoeHover) && <div className="cb-target-mark" style={{ top: -30 }}>▼</div>}
                <Bars actor={en} hp={hpView[en.id]} ghost={ghost[en.id]} />
                <div className="cb-body" style={{ position: "relative" }}>
                  <div className="cb-shadow" />
                  <div className="cb-idle" style={{ animationDelay: `${i * 0.5}s` }}>
                    <div ref={(el) => { spriteRefs.current[en.id] = el; }}>
                      <img className={`cb-sprite ${enraged[en.id] ? "rage" : ""}`} src={ENEMIES[en.key].img} alt={en.name} style={{ height: sl.h }} draggable={false} />
                    </div>
                  </div>
                </div>
                <div className="cb-hit-area" />
              </div>
            );
          })}

          {/* Effets */}
          {fxs.map((f) => <Fx key={f.key} fx={f} />)}
          {floats.map((f) => (
            <div key={f.key} className={`cb-float ${f.cls}`} style={{ left: `${f.x}%`, bottom: f.y }}>{f.text}</div>
          ))}
          {banner && <div key={banner.key} className={`cb-banner ${banner.cls}`}>{banner.text}</div>}
          <div className="cb-vignette" />
        </div>

        {/* Fin de combat */}
        {ended === "victory" && cs.rewards && (
          <div className="cb-overlay">
            <div className="cb-card">
              <h2>Victoire</h2>
              <div className="sub">{encounter.name}</div>
              <div className="cb-reward-row">
                <span className="cb-chip">✨ +{cs.rewards.xp} XP</span>
                <span className="cb-chip">🪙 +{cs.rewards.gold} or</span>
              </div>
              {(Object.keys(cs.rewards.resources).length > 0 || cs.rewards.items.length > 0) ? (
                <div className="cb-reward-row">
                  {Object.entries(cs.rewards.resources).map(([id, q]) => (
                    <span key={id} className="cb-chip"><img src={RESOURCES[id].img} alt="" />{RESOURCES[id].name} ×{q}</span>
                  ))}
                  {cs.rewards.items.map((id, i) => (
                    <span key={i} className="cb-chip" style={{ borderColor: color.gold }}><img src={ITEMS[id].img} alt="" />{ITEMS[id].name}</span>
                  ))}
                </div>
              ) : <div className="sub">Aucun butin cette fois.</div>}
              {rewardsPreview && rewardsPreview.levelsGained > 0 && (
                <div className="cb-levelup">Niveau {rewardsPreview.player.level} atteint ! +{3 * rewardsPreview.levelsGained} points de caractéristiques</div>
              )}
              <div style={{ fontSize: 11, color: color.mist, marginBottom: 14 }}>
                Expérience : {rewardsPreview ? rewardsPreview.player.xp : player.xp} / {xpToNext(rewardsPreview ? rewardsPreview.player.level : player.level)}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="cb-btn primary" onClick={claim}>Récupérer le butin</button>
              </div>
            </div>
          </div>
        )}
        {ended === "defeat" && (
          <div className="cb-overlay">
            <div className="cb-card lose">
              <h2>Défaite</h2>
              <div className="sub">Tu es à terre… mais tu ne perds rien. Ajuste ton équipement et retente ta chance.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="cb-btn primary" onClick={onRestart}>Recommencer</button>
                <button className="cb-btn" onClick={onExit}>Changer d'adversaire</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------- INTERFACE ---------- */}
      <div className="cb-hud">
        <div className="cb-hud-top">
          <div className="cb-meter">
            <div className="cb-meter-label"><span>Points de vie</span><b>{Math.max(0, hpView.player)} / {p.maxHp}</b></div>
            <div className="cb-bar hp"><i style={{ width: `${(Math.max(0, hpView.player) / p.maxHp) * 100}%` }} /></div>
          </div>
          <div className="cb-meter">
            <div className="cb-meter-label"><span>Initiative</span><b>{cs.phase === "playerTurn" ? "À toi de jouer" : cs.phase === "running" ? "En attente…" : "—"}</b></div>
            <div className={`cb-bar atb ${p.atb >= 100 || cs.phase === "playerTurn" ? "full" : ""}`}>
              <i style={{ width: `${cs.phase === "playerTurn" ? 100 : p.atb}%` }} />
            </div>
          </div>
          <div className="cb-pa" title="Points d'action : ceux que tu ne dépenses pas sont perdus">
            <span className="cb-pa-label">PA</span>
            {Array.from({ length: PA_MAX }, (_, i) => {
              const cost = hoverSpell && myTurn ? spellCost(cs, hoverSpell) : 0;
              const on = i < p.pa;
              const preview = on && cost > 0 && i >= p.pa - cost;
              return <div key={i} className={`cb-pip ${on ? "on" : ""} ${preview ? "preview" : ""}`} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="cb-btn small" onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} title="Vitesse du combat">×{speed}</button>
            <button className="cb-btn small" onClick={() => { setMuted(!mute); setMute(!mute); }} title="Son">{mute ? "🔇" : "🔊"}</button>
            <button className="cb-btn small" onClick={onExit} title="Abandonner le combat (rien n'est perdu)">Quitter</button>
          </div>
        </div>

        <div className="cb-spells">
          {p.spells.map((sp, i) => {
            const cost = spellCost(cs, sp);
            const discounted = cost < sp.pa;
            return (
              <button
                key={sp.id}
                className={`cb-spell ${sp.type} ${myTurn ? "cb-turn-glow" : ""}`}
                disabled={!myTurn || cs.player.pa < cost}
                onClick={() => cast(sp)}
                onMouseEnter={() => setHover(sp.id)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="nm">{sp.name}</div>
                <div className="sub">{sp.type === "buff" ? "Sur soi" : sp.aoe ? "Tous les ennemis" : sp.type === "mag" ? "Magique" : "Physique"}{sp.effect?.kind === "dot" ? ` · ${sp.applyElement === "feu" ? "Feu" : "Poison"}` : ""}</div>
                <div className="cost" title={discounted ? `Réduit de ${sp.pa - cost} PA par ton set` : ""} style={discounted ? { background: "radial-gradient(circle at 35% 30%, #eaffd0, #6fe08a 60%, #2f8f46)" } : undefined}>{cost}</div>
                <div className="key">{i + 1}</div>
              </button>
            );
          })}
          <button className="cb-btn" onClick={finishTurn} disabled={!myTurn} style={{ marginLeft: "auto", alignSelf: "stretch", minWidth: 130 }}>
            Fin du tour<div style={{ fontSize: 10, color: "#74748a", fontWeight: 400 }}>Espace · PA perdus</div>
          </button>
        </div>
        <div className="cb-hint">
          {hoverSpell ? hoverSpell.desc : myTurn ? "Clique sur un ennemi pour le cibler, puis lance un sort (touches 1-3)." : ended ? "" : "La jauge d'initiative se remplit… plus ta Vitesse est haute, plus tu joues souvent."}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Barres au-dessus d'un combattant
// ------------------------------------------------------------
function Bars({ actor, hp, ghost, isPlayer }) {
  const pct = Math.max(0, (hp / actor.maxHp) * 100);
  const gpct = Math.max(0, (ghost / actor.maxHp) * 100);
  const badges = [];
  for (const e of actor.effects) {
    if (e.kind === "dot") badges.push([`dot-${e.element}`, BADGE[e.element], `${STATUS_LABEL.dot[e.element]} (${e.turns})`]);
    else badges.push([e.kind, BADGE[e.kind], `${STATUS_LABEL[e.kind]} (${e.turns})`]);
  }
  if (isPlayer && actor.flags.shadowDodge) badges.push(["shadow", BADGE.shadow, "Disparition : prochaine attaque esquivée"]);
  return (
    <div className="cb-bars">
      <div className="cb-badges">{badges.map(([k, ic, t]) => <span key={k} className="cb-badge" title={t}>{ic}</span>)}</div>
      <div className="cb-name">{actor.name}</div>
      <div className="cb-hp"><b style={{ width: `${gpct}%` }} /><i style={{ width: `${pct}%` }} /></div>
      {!isPlayer && <div className={`cb-atb ${actor.atb >= 85 ? "ready" : ""}`}><i style={{ width: `${actor.atb}%` }} /></div>}
    </div>
  );
}

// ------------------------------------------------------------
// Décor : crépuscule sur la prairie
// ------------------------------------------------------------
const EMBERS = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 1.7) % 9, dur: 7 + ((i * 13) % 6), dx: ((i * 29) % 80) - 40 }));

function Backdrop() {
  return (
    <>
      <div className="cb-sky" />
      <div className="cb-sun" />
      <svg className="cb-hills" viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 270 C120 220 220 250 330 235 C450 215 520 255 640 240 C760 225 880 250 1000 225 L1000 440 L0 440Z" fill="#2a2036" opacity=".85" />
        <path d="M0 305 C100 270 210 300 330 285 C470 268 560 305 700 290 C820 278 920 300 1000 285 L1000 440 L0 440Z" fill="#1d1828" />
        {/* arbre mort + tour en ruine */}
        <g fill="#14111c" opacity=".95">
          <path d="M120 300 L124 215 L110 190 M124 240 L142 218 M124 255 L108 238" stroke="#14111c" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M610 292 L610 215 L624 215 L624 232 L640 232 L640 215 L654 215 L654 292Z" />
        </g>
        <path d="M0 340 C150 320 300 345 480 332 C660 320 820 345 1000 330 L1000 440 L0 440Z" fill="#16131d" />
      </svg>
      <div className="cb-fog" />
      <div className="cb-ground" />
      {EMBERS.map((e, i) => (
        <span key={i} className="cb-ember" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, "--dx": `${e.dx}px` }} />
      ))}
    </>
  );
}

// ------------------------------------------------------------
// Effets visuels ponctuels
// ------------------------------------------------------------
function Fx({ fx }) {
  const pos = { left: `${fx.x}%`, bottom: fx.y };
  switch (fx.kind) {
    case "slash":
      return <div className="cb-fx cb-slash" style={{ ...pos, transform: `translate(-50%, 50%) rotate(${fx.flip ? 25 : -20}deg) scaleX(${fx.flip ? -1 : 1})` }} />;
    case "spark": {
      const n = fx.crit ? 14 : 8;
      return (
        <div className="cb-fx cb-spark" style={pos}>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = (fx.crit ? 70 : 45) + Math.random() * 25;
            return <i key={i} style={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, background: fx.crit ? "#ffd23f" : undefined }} />;
          })}
        </div>
      );
    }
    case "fire": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #fff1b0, #ff8a2a 40%, rgba(255,60,0,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#ff8a2a" }} /></>;
    case "poison": return <div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #d7ff9a, #6fbf3a 40%, rgba(60,140,30,0) 70%)" }} />;
    case "frost": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #ffffff, #8fd3f5 40%, rgba(80,160,230,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#8fd3f5" }} /></>;
    case "arcane": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #ffffff, #a99bff 40%, rgba(124,111,217,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#a99bff" }} /></>;
    case "shield": return <div className="cb-fx cb-shield" style={pos} />;
    case "smoke": return <div className="cb-fx cb-smoke" style={pos} />;
    case "heal":
      return (
        <div className="cb-fx cb-heal-p" style={pos}>
          {[-30, -12, 8, 26].map((dx, i) => <i key={i} style={{ "--dx": `${dx}px`, animationDelay: `${i * 0.12}s` }}>+</i>)}
        </div>
      );
    case "proj":
      return (
        <div
          className={`cb-proj ${fx.arrow ? "arrow" : ""}`}
          style={{
            "--x0": `${fx.x0}%`, "--y0": `${fx.y0}px`, "--x1": `${fx.x1}%`, "--y1": `${fx.y1}px`,
            ...(fx.arrow ? {} : { background: `radial-gradient(circle, #fff, ${fx.col || "#a99bff"} 45%, transparent 72%)`, boxShadow: `0 0 18px ${fx.col || "#a99bff"}` }),
          }}
        />
      );
    default: return null;
  }
}
