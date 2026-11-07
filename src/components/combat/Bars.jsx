import React from "react";
import { STATUS_LABEL, BADGE } from "./stage.js";

// Barres au-dessus d'un combattant : pastilles d'effets, nom, points de vie
export default function Bars({ actor, hp, ghost, isPlayer }) {
  const pct = Math.max(0, (hp / actor.maxHp) * 100);
  const gpct = Math.max(0, (ghost / actor.maxHp) * 100);
  const badges = [];
  for (const e of actor.effects) {
    if (e.kind === "dot") badges.push([`dot-${e.element}`, BADGE[e.element], `${STATUS_LABEL.dot[e.element]} (${e.turns})`]);
    else badges.push([e.kind, BADGE[e.kind], `${STATUS_LABEL[e.kind] || e.kind} (${e.turns})`]);
  }
  if (isPlayer && actor.flags.shadowDodge) badges.push(["shadow", BADGE.shadow, "Disparition : prochaine attaque esquivée"]);
  return (
    <div className="cb-bars">
      <div className="cb-badges">{badges.map(([k, ic, t]) => <span key={k} className="cb-badge" title={t}>{ic}</span>)}</div>
      <div className="cb-name">{actor.name}</div>
      <div className="cb-hp"><b style={{ width: `${gpct}%` }} /><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
