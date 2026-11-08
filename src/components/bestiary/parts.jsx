import React, { useState } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { PARTY_DROP_MULT } from "../../combat/engine.js";
import { GROUP_SIZES, dropMultiplier } from "../../utils/bestiary.js";

// Petits éléments communs aux deux vues du Bestiaire (monstres et équipements).

export const ITEM_COLOR = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
export const ROLE_COLOR = { monstre: color.mist, miniboss: "#c9a13f", boss: color.bloodBright };
export const GROUP_LABEL = { 1: "Solo", 2: "Duo", 3: "Trio" };
export const ELEMENT_COLOR = { feu: color.fire, poison: color.poison, givre: color.frost };
export const mult = (x) => `×${(Math.round(x * 100) / 100).toString().replace(".", ",")}`;
export const num = (n) => Math.round(n).toLocaleString("fr-FR");


export function Portrait({ src, name, size, glow }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ width: size, height: size, borderRadius: radius.md, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center", color: color.mist, fontFamily: font.display, fontSize: size * 0.4 }}>{name[0]}</div>;
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} draggable={false} style={{ width: size, height: size, objectFit: "contain", display: "block", filter: glow ? `drop-shadow(0 6px 14px rgba(0,0,0,.7))` : "none" }} />;
}


export function Pill({ children, c = color.mist, title }) {
  return <span title={title} style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: c, border: `1px solid ${c}66`, background: `${c}18`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
}


// ---------- barre du haut : groupe, bonus, recherche ----------
export function Controls({ dropBonus, group, onGroup, query, onQuery, placeholder = "Chercher un monstre ou un butin…", left = null }) {
  const total = dropMultiplier(dropBonus, group);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
      {left}
      <input
        data-bestiary-search value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder}
        style={{ flex: "1 1 220px", maxWidth: 320, background: color.panel, border, borderRadius: radius.md, color: color.parchment, padding: "8px 12px", fontSize: 13, fontFamily: font.body, outline: "none" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>Je chasse en</span>
        <div style={{ display: "flex", background: color.panel, border, borderRadius: radius.md, overflow: "hidden" }}>
          {GROUP_SIZES.map((n) => (
            <button
              key={n} data-group-btn={n} onClick={() => onGroup(n)}
              title={n === 1 ? "Seul : pas de bonus de groupe, mais +25 % d'XP" : `Groupe de ${n} héros : ${mult(PARTY_DROP_MULT[n])} sur le butin`}
              style={{ padding: "7px 14px", fontSize: 12, fontFamily: font.body, cursor: "pointer", border: "none", background: group === n ? color.gold : "transparent", color: group === n ? color.void : color.parchmentDim, fontWeight: group === n ? 700 : 500 }}
            >{GROUP_LABEL[n]}</button>
          ))}
        </div>
      </div>
      <div
        data-bestiary-mult
        title="Bonus de butin du personnage × bonus de groupe. Il multiplie la chance de chaque butin ordinaire (les butins à taux fixe ne changent pas)."
        style={{ fontSize: 12, color: color.parchmentDim, background: color.panel, border, borderRadius: radius.md, padding: "7px 12px" }}
      >
        Bonus de butin <b style={{ color: color.gold, fontFamily: font.data }}>+{(dropBonus || 0).toFixed(1).replace(".", ",")} %</b>
        {group > 1 && <> · groupe <b style={{ color: color.gold, fontFamily: font.data }}>{mult(PARTY_DROP_MULT[group])}</b></>}
        {" "}= chances <b style={{ color: color.goldBright, fontFamily: font.data }}>{mult(total)}</b>
      </div>
    </div>
  );
}


// ---------- fiche : caractéristiques ----------
export function StatCell({ label, value, c = color.parchment, dim }) {
  return (
    <div style={{ background: color.void, border, borderRadius: radius.md, padding: "8px 10px", opacity: dim ? 0.45 : 1 }}>
      <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: font.data, fontSize: 16, color: c, marginTop: 2 }}>{value}</div>
    </div>
  );
}


export function Section({ title, hint, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, borderBottom: `1px solid ${color.line}`, paddingBottom: 6 }}>
        <span style={{ fontFamily: font.display, fontSize: 15, color: color.goldBright }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: color.mist }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

