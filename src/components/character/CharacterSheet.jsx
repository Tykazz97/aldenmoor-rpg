import React from "react";
import EquipmentPanel from "./EquipmentPanel.jsx";
import StatsPanel from "./StatsPanel.jsx";
import InventoryPanel from "./InventoryPanel.jsx";
import { color, border, radius, font } from "../../styles/theme.js";
import { xpToNext } from "../../utils/progression.js";

function ResourceBar({ label, value, max, colorFrom, colorTo }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: color.mist, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontFamily: font.data }}>{value}/{max}</span>
      </div>
      <div style={{ height: 8, background: color.void, borderRadius: 4, overflow: "hidden", border }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

export default function CharacterSheet({ player, stats, onEquipSlotClick, onUnequip, onAddCaracPoint, onEquipItem }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* En-tête personnage */}
      <div style={{
        background: color.panel, borderRadius: radius.lg, border,
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 24,
      }}>
        <div>
          <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright, letterSpacing: "0.02em" }}>
            {player.name}
          </div>
          <div style={{ fontSize: 12, color: color.mist }}>Niveau {player.level}</div>
        </div>
        <div style={{ display: "flex", gap: 20, flex: 1 }}>
          <ResourceBar label="Points de Vie (pleins avant chaque combat)" value={stats.maxHp} max={stats.maxHp} colorFrom="#6b1f1f" colorTo={color.blood} />
          <ResourceBar label="Expérience" value={player.xp} max={xpToNext(player.level)} colorFrom="#6b5a1f" colorTo={color.goldBright} />
        </div>
      </div>

      {/* Contenu trois colonnes — équipement, stats, sac */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr 320px", gap: 20, flex: 1, minHeight: 0 }}>
        <EquipmentPanel equipped={player.equipped} onEquipSlotClick={onEquipSlotClick} onUnequip={onUnequip} />
        <div style={{ overflowY: "auto" }}>
          <StatsPanel player={player} stats={stats} onAddCaracPoint={onAddCaracPoint} />
        </div>
        <InventoryPanel inventory={player.inventory} onEquip={onEquipItem} />
      </div>
    </div>
  );
}
