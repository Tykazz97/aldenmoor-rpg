import React from "react";
import { ENEMIES } from "../../data/zones.js";

// Frise de l'ordre de jeu (comme dans Dofus)
export default function Timeline({ timeline, activeId, dead, cs, heroSrc }) {
  const ids = timeline.order.filter((id) => id === "player" || !dead[id]);
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
        const isHero = id === "player";
        const en = isHero ? null : cs.enemies.find((e) => e.id === id);
        const src = isHero ? heroSrc : ENEMIES[en.key].img;
        const state = i === activeIdx ? "active" : activeIdx >= 0 && i < activeIdx ? "done" : "";
        return (
          <div key={id} className={`cb-tl ${isHero ? "hero" : "foe"} ${state}`} title={isHero ? "Toi" : en.name}>
            <img src={src} alt="" style={isHero ? { objectPosition: "50% 12%", transform: "scale(1.7) translateY(14%)" } : { transform: en.miniBoss ? "scale(1.3)" : "scale(1.4)" }} />
            {letters[id] && <b>{letters[id]}</b>}
          </div>
        );
      })}
    </div>
  );
}
