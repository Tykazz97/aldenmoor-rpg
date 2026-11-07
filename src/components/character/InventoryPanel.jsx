import React from "react";
import BannerHeader from "../shared/BannerHeader.jsx";
import { color, border, radius } from "../../styles/theme.js";
import { itemStatLines } from "../../utils/itemText.js";

const RARITY_COLORS = {
  commune: "#9a95a8",
  rare: "#5fa3c4",
  epique: "#a855f7",
  legendaire: "#d9b568",
};

function ItemCard({ item, onEquip }) {
  const rarityColor = RARITY_COLORS[item.rarity] || color.parchmentDim;

  const statLines = itemStatLines(item);

  return (
    <button
      onClick={() => onEquip(item)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: 10, width: "100%",
        background: color.panel, border: `1px solid ${rarityColor}44`,
        borderRadius: radius.md, textAlign: "left",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = rarityColor; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = rarityColor + "44"; }}
    >
      <div style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: radius.sm,
        background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.img ? (
          <img src={item.img} alt={item.name} width="36" height="36" style={{ objectFit: "contain", display: "block" }} />
        ) : (
          <span style={{ fontSize: 18 }}>?</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: rarityColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.name}
        </div>
        <div style={{ fontSize: 10, color: color.mist }}>{statLines.join(" · ")}</div>
      </div>
    </button>
  );
}

export default function InventoryPanel({ inventory, onEquip }) {
  return (
    <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <BannerHeader icon="🎒" title="Sac" right={`${inventory.length} objet${inventory.length > 1 ? "s" : ""}`} />
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {inventory.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: color.mist }}>
            Ton sac est vide.
          </div>
        ) : (
          inventory.map((item) => <ItemCard key={item.uid} item={item} onEquip={onEquip} />)
        )}
      </div>
    </div>
  );
}
