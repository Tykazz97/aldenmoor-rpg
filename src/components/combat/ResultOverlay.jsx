import React from "react";
import { RESOURCES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { classSpellsAt } from "../../data/classes.js";
import { applyRewards, xpToNext } from "../../utils/progression.js";
import { color } from "../../styles/theme.js";
import { hasLost } from "../../utils/bag.js";

// Écran de fin de combat : butin en cas de victoire, relance en cas de défaite
// `dungeon` : { index, total } quand c'est une salle de donjon (on enchaîne la suite, et une défaite met fin à l'expédition)
export default function ResultOverlay({ ended, cs, encounter, player, backLabel, dungeon = null, onClaim, onRestart, onExit }) {
  if (ended === "victory" && cs.rewards) {
    const preview = applyRewards(player, cs.rewards);
    const newSpells = classSpellsAt(player.classKey, preview.player.level).filter((sp) => sp.level > player.level);
    const { rewards } = cs;
    return (
      <div className="cb-overlay">
        <div className="cb-card">
          <h2>Victoire</h2>
          <div className="sub">{encounter.name}</div>
          <div className="cb-reward-row">
            <span className="cb-chip">✨ +{rewards.xp} XP</span>
            <span className="cb-chip">🪙 +{rewards.gold} or</span>
          </div>
          {(Object.keys(rewards.resources).length > 0 || rewards.items.length > 0) ? (
            <div className="cb-reward-row">
              {Object.entries(rewards.resources).map(([id, q]) => (
                <span key={id} className="cb-chip"><img src={RESOURCES[id].img} alt="" />{RESOURCES[id].name} ×{q}</span>
              ))}
              {rewards.items.map((id, i) => (
                <span key={i} className="cb-chip" style={{ borderColor: color.gold }}><img src={ITEMS[id].img} alt="" />{ITEMS[id].name}</span>
              ))}
            </div>
          ) : <div className="sub">Aucun butin cette fois.</div>}
          {hasLost(preview.lost) && (
            <div data-bag-lost style={{ margin: "6px 0 10px", padding: "8px 10px", border: "1px solid #5a2a2a", background: "#2a1616", borderRadius: 8, fontSize: 12, color: "#e0796a" }}>
              🎒 Sac plein : perdu {[...Object.entries(preview.lost.resources).map(([id, q]) => `${RESOURCES[id].name} ×${q}`), ...preview.lost.items.map((id) => ITEMS[id].name)].join(", ")}
            </div>
          )}
          {preview.levelsGained > 0 && (
            <div className="cb-levelup">
              Niveau {preview.player.level} atteint ! +{3 * preview.levelsGained} points de caractéristiques, +{preview.levelsGained} point{preview.levelsGained > 1 ? "s" : ""} de sort
              {newSpells.length > 0 && <div>Nouveau sort : {newSpells.map((sp) => sp.name).join(", ")}</div>}
            </div>
          )}
          <div style={{ fontSize: 11, color: color.mist, marginBottom: 14 }}>
            Expérience : {preview.player.xp} / {xpToNext(preview.player.level)}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" onClick={onClaim}>{dungeon ? (dungeon.index + 1 < dungeon.total ? "Récupérer le butin et avancer" : "Récupérer le butin et sortir") : "Récupérer le butin"}</button>
          </div>
        </div>
      </div>
    );
  }
  if (ended === "defeat" && dungeon) {
    return (
      <div className="cb-overlay">
        <div className="cb-card lose">
          <h2>Expédition perdue</h2>
          <div className="sub">Le groupe est repoussé hors du manoir. Le butin des salles déjà gagnées est à toi, mais la clé est perdue.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" onClick={() => onExit(false)}>Sortir du manoir</button>
          </div>
        </div>
      </div>
    );
  }
  if (ended === "defeat") {
    return (
      <div className="cb-overlay">
        <div className="cb-card lose">
          <h2>Défaite</h2>
          <div className="sub">Tu es à terre… mais tu ne perds rien. Ajuste ton équipement et retente ta chance.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" onClick={onRestart}>Recommencer</button>
            <button className="cb-btn" onClick={() => onExit(false)}>{backLabel}</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
