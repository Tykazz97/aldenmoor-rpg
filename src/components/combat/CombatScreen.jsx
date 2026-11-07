import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./combat.css";
import { createCombat, advance, castSpell, endTurn, canCast } from "../../combat/engine.js";
import { ENEMIES } from "../../data/zones.js";
import { buildSpellBar } from "../../utils/spellbook.js";
import { heroLook, heroSpriteUrl } from "../../data/heroSprites.js";
import { sfx } from "./sfx.js";
import { HERO_X, HERO_B, HERO_H } from "./stage.js";
import { useFightPlayback } from "./useFightPlayback.js";
import EncounterSelect from "./EncounterSelect.jsx";
import CombatHud from "./CombatHud.jsx";
import ResultOverlay from "./ResultOverlay.jsx";
import Timeline from "./Timeline.jsx";
import Bars from "./Bars.jsx";
import Backdrop from "./Backdrop.jsx";
import Fx from "./Fx.jsx";

// ============================================================
// Écran principal : choix de la rencontre, puis combat
// ============================================================
export default function CombatScreen({ player, stats, onRewards }) {
  const [encounter, setEncounter] = useState(null);
  const [fightKey, setFightKey] = useState(0);

  const weaponType = player.equipped.arme?.weaponType || null;
  const heroSrc = heroSpriteUrl(heroLook(player, stats));

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

// Combat lancé depuis la carte : onExit(true) si victoire (butin récupéré)
export function EncounterFight({ encounter, player, stats, onRewards, onExit }) {
  const [fightKey, setFightKey] = useState(0);
  const weaponType = player.equipped.arme?.weaponType || null;
  const heroSrc = heroSpriteUrl(heroLook(player, stats));
  return (
    <Fight key={fightKey} encounter={encounter} player={player} stats={stats} weaponType={weaponType} heroSrc={heroSrc}
      onRewards={onRewards} onRestart={() => setFightKey((k) => k + 1)} onExit={onExit} backLabel="Retour à la carte" />
  );
}

// ------------------------------------------------------------
// Un combat : règles (état du moteur, actions du joueur) ici,
// mise en scène dans useFightPlayback, affichage dans les composants.
// ------------------------------------------------------------
function Fight({ encounter, player, stats, weaponType, heroSrc, onRewards, onRestart, onExit, backLabel = "Changer d'adversaire" }) {
  const initial = useMemo(() => createCombat({ stats, weaponType, classKey: player.classKey, level: player.level, enemyKeys: encounter.enemies, spells: buildSpellBar(player) }), []); // eslint-disable-line
  const [cs, setCs] = useState(initial);
  const csRef = useRef(initial);
  const [speed, setSpeed] = useState(1);
  const [target, setTarget] = useState("e0");
  const [hover, setHover] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const commit = useCallback((state) => { csRef.current = state; setCs(state); }, []);

  // Quand le joueur reprend la main, garde une cible vivante
  const keepTarget = useCallback(() => {
    setTarget((t) => (csRef.current.enemies.find((e) => e.id === t && e.alive) ? t : csRef.current.enemies.find((e) => e.alive)?.id));
  }, []);

  const pb = useFightPlayback({ initial, csRef, speed, onIdle: keepTarget });
  const { busy, busyRef, play, showBanner, hpView, ghost, dead, enraged, floats, fxs, banner, ended, timeline, activeId, slots, spriteRefs, shakeRef } = pb;

  // Fait jouer les ennemis (dans l'ordre d'initiative, fixé au début du combat) jusqu'au tour du joueur
  const step = useCallback(() => {
    const r = advance(csRef.current);
    commit(r.state);
    if (r.events.length) play(r.events);
  }, [commit, play]);

  // Introduction puis démarrage
  useEffect(() => {
    showBanner(encounter.boss ? encounter.name : "Combat !", "", 1300);
    const t = setTimeout(() => step(), 1100);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // --- actions du joueur ---
  const living = cs.enemies.filter((e) => e.alive);
  const currentTarget = living.find((e) => e.id === target) ? target : living[0]?.id;
  const myTurn = cs.phase === "playerTurn" && !busy;

  const cast = (spell) => {
    const st = csRef.current;
    if (busyRef.current || st.phase !== "playerTurn" || !canCast(st, spell)) return;
    const r = castSpell(st, spell.id, currentTarget);
    if (!r.events.length) return;
    commit(r.state); play(r.events);
  };
  const finishTurn = () => {
    if (busyRef.current || csRef.current.phase !== "playerTurn") return;
    sfx.click();
    const r = endTurn(csRef.current);
    commit(r.state);
    step();
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
    onExit(true);
  };

  const p = cs.player;
  const hoverSpell = p.spells.find((s) => s.id === hover);
  const hasAoeHover = !!hoverSpell?.aoe;
  const outfitClass = p.flags.shadowDodge ? "cb-hero-shadow" : "";

  return (
    <div className="cb-root">
      {/* ---------- ARÈNE ---------- */}
      <div className="cb-arena">
        <div className="cb-shaker" ref={shakeRef}>
          <Backdrop />

          {/* Héros */}
          <div className={`cb-actor ${ended === "defeat" ? "hero-dead" : ""} ${activeId === "player" ? "active" : ""}`} style={{ left: `${HERO_X}%`, bottom: HERO_B, zIndex: 5 }}>
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
                className={`cb-actor ${dead[en.id] ? "dead" : "target"} ${activeId === en.id ? "active" : ""}`}
                style={{ left: `${sl.x}%`, bottom: sl.b, zIndex: 10 - Math.round(sl.b / 20) }}
                onClick={() => { if (!dead[en.id] && en.alive) { sfx.click(); setTarget(en.id); } }}
              >
                {!dead[en.id] && (isTarget || hasAoeHover) && <div className="cb-target-mark" style={{ top: -14 }}>▼</div>}
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

          <Timeline timeline={timeline} activeId={activeId} dead={dead} cs={cs} heroSrc={heroSrc} />

          {/* Effets */}
          {fxs.map((f) => <Fx key={f.key} fx={f} />)}
          {floats.map((f) => (
            <div key={f.key} className={`cb-float ${f.cls}`} style={{ left: `${f.x}%`, bottom: f.y }}>{f.text}</div>
          ))}
          {banner && <div key={banner.key} className={`cb-banner ${banner.cls}`}>{banner.text}</div>}
          <div className="cb-vignette" />
        </div>

        <ResultOverlay ended={ended} cs={cs} encounter={encounter} player={player} backLabel={backLabel} onClaim={claim} onRestart={onRestart} onExit={onExit} />
      </div>

      {/* ---------- INTERFACE ---------- */}
      <CombatHud
        cs={cs} hpView={hpView} timeline={timeline} ended={ended} busy={busy} myTurn={myTurn}
        speed={speed} onSpeed={() => setSpeed((s) => (s === 1 ? 2 : 1))}
        hoverSpell={hoverSpell} onHover={setHover}
        onCast={cast} onFinish={finishTurn} onExit={onExit}
      />
    </div>
  );
}
