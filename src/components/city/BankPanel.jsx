import React from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { bankOf, bankCapacity, bankUsed, bankFree, nextUpgradeCost, BANK_STEP } from "../../utils/bank.js";
import { itemStatLines } from "../../utils/itemText.js";

const RARITY = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };

const mini = { background: color.panelRaised, color: color.parchment, border, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: font.body };

function Icon({ src, name }) {
  return (
    <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 6, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt={name} width="30" height="30" style={{ objectFit: "contain" }} /> : <span style={{ color: color.mist }}>?</span>}
    </div>
  );
}

function ItemRow({ item, label, onClick, disabled }) {
  const c = RARITY[item.rarity] || color.parchmentDim;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
      <Icon src={item.img} name={item.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div>
      </div>
      <button style={{ ...mini, ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null) }} onClick={disabled ? undefined : onClick} title={disabled ? "Coffre plein" : undefined}>{label}</button>
    </div>
  );
}

function ResourceRow({ id, qty, arrow, onMove, disabled }) {
  const r = RESOURCES[id];
  const c = RESOURCE_RARITIES[r.rarity]?.color || color.mist;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
      <Icon src={r.img} name={r.name} />
      <div style={{ flex: 1, fontSize: 12, color: c, fontWeight: 600 }}>{r.name}</div>
      <span style={{ fontFamily: font.data, fontSize: 12, color: color.parchment, minWidth: 28, textAlign: "right" }}>{qty}</span>
      <button style={{ ...mini, ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null) }} onClick={disabled ? undefined : () => onMove(1)} title={disabled ? "Coffre plein" : undefined}>{arrow} 1</button>
      {qty > 1 && <button style={{ ...mini, ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null) }} onClick={disabled ? undefined : () => onMove(Infinity)} title={disabled ? "Coffre plein" : undefined}>{arrow} tout</button>}
    </div>
  );
}

function Column({ title, count, children, empty }) {
  const list = React.Children.toArray(children).flat();
  return (
    <div style={{ background: color.panel, border, borderRadius: radius.lg, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${color.line}`, display: "flex", justifyContent: "space-between", fontFamily: font.display, color: color.goldBright, fontSize: 14 }}>
        <span>{title}</span><span style={{ fontFamily: font.data, fontSize: 11, color: color.mist }}>{count}</span>
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
        {list.length === 0 ? <div style={{ padding: 18, textAlign: "center", fontSize: 12, color: color.mist }}>{empty}</div> : list}
      </div>
    </div>
  );
}

// Coffre : à gauche ton sac, à droite le coffre. Un clic déplace de l'un à l'autre.
// Il a un nombre d'emplacements limité (un objet ou un type de ressource = 1) et s'agrandit contre de l'or.
export default function BankPanel({ player, bank }) {
  const store = bankOf(player);
  const bagRes = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);
  const vaultRes = RESOURCE_ORDER.filter((id) => (store.resources[id] || 0) > 0);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const cap = bankCapacity(player), used = bankUsed(player), full = bankFree(player) < 1;
  const cost = nextUpgradeCost(player), canPay = cost !== null && player.gold >= cost;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: color.panel, border, borderRadius: radius.lg, padding: "8px 14px" }}>
        <div style={{ fontSize: 12, color: color.parchmentDim }}>Emplacements</div>
        <div style={{ flex: 1, minWidth: 140, height: 8, background: color.panelRaised, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (used / cap) * 100)}%`, height: "100%", background: full ? color.bloodBright : color.gold }} />
        </div>
        <div data-slots style={{ fontFamily: font.data, fontSize: 13, color: full ? "#e0796a" : color.goldBright }}>{used} / {cap}{full ? " · plein" : ""}</div>
        <div style={{ fontFamily: font.data, fontSize: 12, color: color.mist }}>🪙 {player.gold} or</div>
        {cost !== null ? (
          <button data-upgrade style={{ ...mini, padding: "5px 12px", opacity: canPay ? 1 : 0.5, cursor: canPay ? "pointer" : "not-allowed", borderColor: canPay ? color.gold : undefined }}
            onClick={() => canPay && bank.upgrade()} title={canPay ? "" : "Pas assez d'or"}>
            Agrandir (+{BANK_STEP}) · {cost} or
          </button>
        ) : <span style={{ fontSize: 11, color: color.mist }}>Taille maximale</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        <Column title="Ton sac" count={`${player.inventory.length} objet(s) · ${sum(player.resources)} ressource(s)`} empty="Ton sac est vide.">
          {player.inventory.map((it) => <ItemRow key={it.uid} item={it} label="Ranger →" disabled={full} onClick={() => bank.depositItem(it.uid)} />)}
          {bagRes.map((id) => <ResourceRow key={id} id={id} qty={player.resources[id]} arrow="→" disabled={full && !(store.resources[id] > 0)} onMove={(q) => bank.depositResource(id, q)} />)}
        </Column>
        <Column title="Coffre d'Aldenmoor" count={`${store.items.length} objet(s) · ${sum(store.resources)} ressource(s)`} empty="Le coffre est vide : range ici ce que tu ne veux pas porter.">
          {store.items.map((it) => <ItemRow key={it.uid} item={it} label="← Reprendre" onClick={() => bank.withdrawItem(it.uid)} />)}
          {vaultRes.map((id) => <ResourceRow key={id} id={id} qty={store.resources[id]} arrow="←" onMove={(q) => bank.withdrawResource(id, q)} />)}
        </Column>
      </div>
    </div>
  );
}
