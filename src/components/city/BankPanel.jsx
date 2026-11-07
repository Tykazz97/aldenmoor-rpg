import React from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { bankOf } from "../../utils/bank.js";
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

function ItemRow({ item, label, onClick }) {
  const c = RARITY[item.rarity] || color.parchmentDim;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
      <Icon src={item.img} name={item.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div>
      </div>
      <button style={mini} onClick={onClick}>{label}</button>
    </div>
  );
}

function ResourceRow({ id, qty, arrow, onMove }) {
  const r = RESOURCES[id];
  const c = RESOURCE_RARITIES[r.rarity]?.color || color.mist;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
      <Icon src={r.img} name={r.name} />
      <div style={{ flex: 1, fontSize: 12, color: c, fontWeight: 600 }}>{r.name}</div>
      <span style={{ fontFamily: font.data, fontSize: 12, color: color.parchment, minWidth: 28, textAlign: "right" }}>{qty}</span>
      <button style={mini} onClick={() => onMove(1)}>{arrow} 1</button>
      {qty > 1 && <button style={mini} onClick={() => onMove(Infinity)}>{arrow} tout</button>}
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
export default function BankPanel({ player, bank }) {
  const store = bankOf(player);
  const bagRes = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);
  const vaultRes = RESOURCE_ORDER.filter((id) => (store.resources[id] || 0) > 0);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: "100%", minHeight: 0 }}>
      <Column title="Ton sac" count={`${player.inventory.length} objet(s) · ${sum(player.resources)} ressource(s)`} empty="Ton sac est vide.">
        {player.inventory.map((it) => <ItemRow key={it.uid} item={it} label="Ranger →" onClick={() => bank.depositItem(it.uid)} />)}
        {bagRes.map((id) => <ResourceRow key={id} id={id} qty={player.resources[id]} arrow="→" onMove={(q) => bank.depositResource(id, q)} />)}
      </Column>
      <Column title="Coffre d'Aldenmoor" count={`${store.items.length} objet(s) · ${sum(store.resources)} ressource(s)`} empty="Le coffre est vide : range ici ce que tu ne veux pas porter.">
        {store.items.map((it) => <ItemRow key={it.uid} item={it} label="← Reprendre" onClick={() => bank.withdrawItem(it.uid)} />)}
        {vaultRes.map((id) => <ResourceRow key={id} id={id} qty={store.resources[id]} arrow="←" onMove={(q) => bank.withdrawResource(id, q)} />)}
      </Column>
    </div>
  );
}
