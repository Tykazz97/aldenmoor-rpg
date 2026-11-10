import { itemLabel } from "../../utils/upgrade.js";
import BannerHeader from "../shared/BannerHeader.jsx";
import { color, border, radius } from "../../styles/theme.js";
import { itemStatLines } from "../../utils/itemText.js";
import { canEquipAtLevel, equipLockText } from "../../utils/equipReq.js";

const RARITY_COLORS = {
  commune: "#9a95a8",
  rare: "#5fa3c4",
  epique: "#a855f7",
  legendaire: "#d9b568",
};

function ItemCard({ item, onEquip, level }) {
  const locked = !canEquipAtLevel(item, level);
  const rarityColor = RARITY_COLORS[item.rarity] || color.parchmentDim;

  const statLines = itemStatLines(item);

  return (
    <button
      onClick={() => !locked && onEquip(item)}
      {...(locked ? { "data-equip-locked": true, title: equipLockText(item), "aria-disabled": true } : {})}
      style={{
        opacity: locked ? 0.55 : 1, cursor: locked ? "not-allowed" : "pointer",
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
          {itemLabel(item)}
        </div>
        <div style={{ fontSize: 10, color: color.mist }}>{statLines.join(" · ")}</div>
        {locked && <div style={{ fontSize: 10, color: "#e0796a" }}>{equipLockText(item)}</div>}
      </div>
    </button>
  );
}

export default function InventoryPanel({ inventory, onEquip, level = 1, used = null, capacity = null }) {
  const full = capacity !== null && used >= capacity;
  return (
    <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <BannerHeader icon="🎒" title="Sac" right={capacity !== null ? `${used} / ${capacity} emplacements` : `${inventory.length} objet${inventory.length > 1 ? "s" : ""}`} />
      {full && <div data-bag-full style={{ margin: "8px 12px 0", padding: "6px 10px", fontSize: 11, color: "#e0796a", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 6 }}>Sac plein : on ne peut plus retirer une pièce équipée. Range ou vends des objets (onglet Sac).</div>}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {inventory.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: color.mist }}>
            Ton sac est vide.
          </div>
        ) : (
          inventory.map((item) => <ItemCard key={item.uid} item={item} onEquip={onEquip} level={level} />)
        )}
      </div>
    </div>
  );
}
