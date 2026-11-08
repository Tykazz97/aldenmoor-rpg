import React from "react";
import { enemyDef } from "../../data/zones.js";

// Frise de l'ordre de jeu (comme dans Dofus)
export default function Timeline({ timeline, activeId, dead, cs, heroSrc, allySrc = {} }) {
  const ids = timeline.order.filter((id) => id === "player" || !dead[id]);
  const isAllyId = (id) => String(id).startsWith("ally");
  if (!ids.length) return null;
  const activeIdx = ids.indexOf(activeId);
  // numérotation des ennemis identiques (A, B, C)
  const letters = {};
  const counts = {};
  cs.enemies.forEach((e) => { counts[e.key] = (counts[e.key] || 0) + 1; });
  const seen = {};
  cs.enemies.forEach((e) => { if (counts[e.key] > 1) { seen[e.key] = (seen[e.key] || 0) + 1; letters[e.id] = String.fromCharCode(64 + seen[e.key]); } });
  return (
    <div className="cb-timeline">
      <span className="cb-tl-round">Tour {timeline.n}</span>
      {ids.map((id, i) => {
        const isHero = id === "player" || isAllyId(id);
        const ally = isAllyId(id) ? cs.allies.find((a) => a.id === id) : null;
        const en = isHero ? null : cs.enemies.find((e) => e.id === id);
        const src = id === "player" ? heroSrc : ally ? allySrc[id] : enemyDef(en.key).img;
        const state = i === activeIdx ? "active" : activeIdx >= 0 && i < activeIdx ? "done" : "";
        return (
          <div key={id} className={`cb-tl ${isHero ? "hero" : "foe"} ${ally ? "ally" : ""} ${state}`} title={id === "player" ? "Toi" : ally ? ally.name : en.name}>
            <img src={src} alt="" style={isHero ? { objectPosition: "50% 12%", transform: "scale(1.7) translateY(14%)" } : { transform: en.miniBoss ? "scale(1.3)" : "scale(1.4)" }} />
            {letters[id] && <b>{letters[id]}</b>}
          </div>
        );
      })}
    </div>
  );
}
