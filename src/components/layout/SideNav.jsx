import React from "react";
import { color, border, font } from "../../styles/theme.js";

const NAV_ITEMS = [
  { key: "personnage", label: "Personnage", icon: "🛡" },
  // Onglet Combat retiré pour l'instant (les combats se lancent depuis la carte).
  // Pour le remettre : { key: "combat", label: "Combat", icon: "⚔" } — l'écran existe toujours dans App.jsx.
  { key: "carte", label: "Carte", icon: "🗺" },
  // Raccourcis vers l'atelier et le coffre de la ville (les mêmes que dans les bâtiments).
  { key: "forge", label: "Atelier", icon: "⚒" },
  { key: "coffre", label: "Coffre", icon: "📦" },
  { key: "marche", label: "Marché", icon: "⚖" },
  { key: "sac", label: "Sac", icon: "🎒" },
  { key: "journal", label: "Journal", icon: "📜" },
  { key: "bestiaire", label: "Bestiaire", icon: "🐺" },
  { key: "classement", label: "Classement", icon: "🏆" },
  { key: "guilde", label: "Guilde", icon: "🏰" },
];

export default function SideNav({ active, onChange }) {
  return (
    <div
      style={{
        width: 220, background: color.panel, borderRight: border,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}
    >
      {/* Emblème / titre du jeu */}
      <div style={{ padding: "24px 20px", borderBottom: border }}>
        <div style={{ fontFamily: font.display, fontSize: 18, color: color.goldBright, letterSpacing: "0.04em" }}>
          ALDENMOOR
        </div>
        <div style={{ fontSize: 10, color: color.mist, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Les Prairies
        </div>
      </div>

      <nav style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 8,
                background: isActive ? color.panelRaised : "transparent",
                border: isActive ? `1px solid ${color.gold}` : "1px solid transparent",
                color: isActive ? color.goldBright : color.parchmentDim,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                textAlign: "left", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = color.panelRaised; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
