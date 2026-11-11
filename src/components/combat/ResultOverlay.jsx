import { RESOURCES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { classSpellsAt } from "../../data/classes.js";
import { applyRewards, xpToNext } from "../../utils/progression.js";
import { color } from "../../styles/theme.js";
import { hasLost } from "../../utils/bag.js";

// Écran de fin de combat : butin en cas de victoire, relance en cas de défaite
// `dungeon` : { index, total } quand c'est une salle de donjon (on enchaîne la suite, et une défaite met fin à l'expédition)
export default function ResultOverlay({ ended, cs, encounter, player, heroSrc = null, members = [], backLabel, dungeon = null, onClaim, onRestart, onExit }) {
  if (encounter.defense && (ended === "victory" || ended === "defeat")) {
    const won = ended === "victory";
    return (
      <div className="cb-overlay">
        <div className={`cb-card${won ? "" : " lose"}`}>
          <h2>{won ? "Sentinelle sauvée" : "Sentinelle détruite"}</h2>
          <div className="sub">{won ? "L'attaque est repoussée : ta sentinelle est protégée pendant 1 h. Pas de butin, mais son stock est sauf." : "Les attaquants emportent son stock, et ta guilde pourra en poser une autre."}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" data-defense-done onClick={() => onExit(won, { finished: true })}>Retour à la guilde</button>
          </div>
        </div>
      </div>
    );
  }
  if (ended === "victory" && encounter.sentinel) {
    return (
      <div className="cb-overlay">
        <div className="cb-card">
          <h2>Sentinelle détruite</h2>
          <div className="sub">{encounter.name}. Son stock te revient, et la guilde pourra en poser une autre.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" data-sentinel-claim onClick={onClaim}>Récupérer le butin</button>
          </div>
        </div>
      </div>
    );
  }
  if (ended === "victory" && cs.rewards) {
    const preview = applyRewards(player, cs.rewards);
    const newSpells = classSpellsAt(player.classKey, preview.player.level).filter((sp) => sp.level > player.level);
    const { rewards } = cs;
    const foes = Object.values(rewards.kills || {}).reduce((a, b) => a + b, 0);
    // une ligne par joueur, comme dans Dofus : toi d'abord, puis les membres du groupe (chacun a son propre xp, son or et son butin)
    const rows = [
      { id: "hero", you: true, name: player.name || "Héros", img: heroSrc, level: player.level, levelAfter: preview.player.level, xp: rewards.xp, xpAfter: preview.player.xp, gold: rewards.gold, resources: rewards.resources || {}, items: rewards.items || [] },
      ...members,
    ];
    return (
      <div className="cb-overlay">
        <div className="cb-card cb-result" data-victory>
          <h2>Victoire</h2>
          <div className="sub">{encounter.name}{foes > 0 ? ` · ${foes} ennemi${foes > 1 ? "s" : ""} vaincu${foes > 1 ? "s" : ""}` : ""}</div>
          <div className="cb-rows">
            {rows.map((r) => {
              const up = r.levelAfter > r.level, max = xpToNext(r.levelAfter), pct = max ? Math.min(100, Math.round((r.xpAfter / max) * 100)) : 100;
              const empty = !Object.keys(r.resources).length && !r.items.length;
              return (
                <div key={r.id} className={`cb-row${r.you ? " you" : ""}`} data-result-row={r.you ? "hero" : r.id}>
                  <div className="cb-row-face">{r.img ? <img src={r.img} alt="" draggable={false} /> : <span>⚔</span>}</div>
                  <div className="cb-row-main">
                    <div className="cb-row-top">
                      <b className="cb-row-name">{r.name}{r.you ? " (toi)" : ""}</b>
                      <span className="cb-row-lvl">{up ? `Niv ${r.level} → ${r.levelAfter}` : `Niv ${r.levelAfter}`}</span>
                      {up && <span className="cb-row-up">Niveau supérieur !</span>}
                    </div>
                    <div className="cb-xpbar" title={`${r.xpAfter} / ${max}`}><i style={{ width: `${pct}%` }} /><em>{r.xpAfter} / {max}</em></div>
                    <div className="cb-row-gain">
                      <span className="cb-chip xp">✨ +{r.xp} XP</span>
                      <span className="cb-chip">🪙 +{r.gold} or</span>
                    </div>
                    <div className="cb-row-loot">
                      {Object.entries(r.resources).map(([id, q]) => (
                        <span key={id} className="cb-chip"><img src={RESOURCES[id].img} alt="" />{RESOURCES[id].name} ×{q}</span>
                      ))}
                      {r.items.map((id, i) => (
                        <span key={`${id}${i}`} className="cb-chip" style={{ borderColor: color.gold }}><img src={ITEMS[id].img} alt="" />{ITEMS[id].name}</span>
                      ))}
                      {empty && <span className="cb-none">Aucun butin</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
            <button className="cb-btn primary" data-claim onClick={onClaim}>{dungeon ? (dungeon.index + 1 < dungeon.total ? "Récupérer le butin et avancer" : "Récupérer le butin et sortir") : "Récupérer le butin"}</button>
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
  if (ended === "defeat" && encounter.sentinel) {
    return (
      <div className="cb-overlay">
        <div className="cb-card lose">
          <h2>La sentinelle a tenu bon</h2>
          <div className="sub">Elle est protégée pendant 1 h : personne ne peut l'attaquer d'ici là. Tu ne perds rien.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="cb-btn primary" onClick={() => onExit(false)}>{backLabel}</button>
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
