import { useState } from "react";
import { spellCost, PA_MAX } from "../../combat/engine.js";
import { isMuted, setMuted, getVolume, setVolume } from "./sfx.js";

// Interface du combat : PV, tour, PA, vitesse/son/quitter, sorts, fin de tour
export default function CombatHud({ cs, hpView, timeline, ended, busy, myTurn, speed, onSpeed, hoverSpell, onHover, onCast, onFinish, onExit }) {
  const [mute, setMute] = useState(isMuted());
  const [vol, setVol] = useState(getVolume());
  const p = cs.player;
  return (
    <div className="cb-hud">
      <div className="cb-hud-top">
        <div className="cb-meter">
          <div className="cb-meter-label"><span>Points de vie</span><b>{Math.max(0, hpView.player)} / {p.maxHp}</b></div>
          <div className="cb-bar hp"><i style={{ width: `${(Math.max(0, hpView.player) / p.maxHp) * 100}%` }} /></div>
        </div>
        <div className="cb-meter" style={{ flex: "0 1 220px" }}>
          <div className="cb-meter-label"><span>Tour {timeline.n || 1}</span><b>{cs.phase === "playerTurn" ? "À toi de jouer" : ended ? "—" : "Les ennemis jouent…"}</b></div>
          <div className={`cb-turnbar ${cs.phase === "playerTurn" && !busy ? "mine" : ""}`} />
        </div>
        <div className="cb-pa" title="Points d'action : ceux que tu ne dépenses pas sont perdus">
          <span className="cb-pa-label">PA</span>
          {Array.from({ length: p.paMax ?? PA_MAX }, (_, i) => {
            const cost = hoverSpell && myTurn ? spellCost(cs, hoverSpell) : 0;
            const on = i < p.pa;
            const preview = on && cost > 0 && i >= p.pa - cost;
            return <div key={i} className={`cb-pip ${on ? "on" : ""} ${preview ? "preview" : ""}`} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="cb-btn small" onClick={onSpeed} title="Vitesse du combat">×{speed}</button>
          <button className="cb-btn small" onClick={() => { setMuted(!mute); setMute(!mute); }} title="Son">{mute ? "🔇" : "🔊"}</button>
          <input className="cb-vol" type="range" min="0" max="1" step="0.05" value={vol} aria-label="Volume" title="Volume"
            onChange={(e) => { const v = Number(e.target.value); setVol(v); setVolume(v); if (mute && v > 0) { setMuted(false); setMute(false); } }} />
          <button className="cb-btn small" onClick={() => onExit(false)} title="Abandonner le combat (rien n'est perdu)">Quitter</button>
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
              onClick={() => onCast(sp)}
              onMouseEnter={() => onHover(sp.id)}
              onMouseLeave={() => onHover(null)}
            >
              <div className="nm">{sp.name}{sp.rank > 1 && <span style={{ color: "#e8c766", fontSize: 10, marginLeft: 5 }}>{"★".repeat(sp.rank - 1)}</span>}</div>
              <div className="sub">{sp.type === "buff" ? "Sur soi" : sp.aoe ? "Tous les ennemis" : sp.type === "mag" ? "Magique" : "Physique"}{sp.effect?.kind === "dot" ? ` · ${sp.applyElement === "feu" ? "Feu" : "Poison"}` : ""}</div>
              <div className="cost" title={discounted ? `Réduit de ${sp.pa - cost} PA par ton set` : ""} style={discounted ? { background: "radial-gradient(circle at 35% 30%, #eaffd0, #6fe08a 60%, #2f8f46)" } : undefined}>{cost}</div>
              <div className="key">{i + 1}</div>
            </button>
          );
        })}
        <button className="cb-btn" onClick={onFinish} disabled={!myTurn} style={{ marginLeft: "auto", alignSelf: "stretch", minWidth: 130 }}>
          Fin du tour<div style={{ fontSize: 10, color: "#74748a", fontWeight: 400 }}>Espace · PA perdus</div>
        </button>
      </div>
      <div className="cb-hint">
        {hoverSpell ? hoverSpell.desc : myTurn ? "Clique sur un ennemi pour le cibler, puis lance un sort (touches 1-9)." : ended ? "" : "Chacun joue à son tour, toujours dans l'ordre de la frise, fixé par l'initiative au début du combat."}
      </div>
    </div>
  );
}
