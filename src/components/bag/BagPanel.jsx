import React from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { itemStatLines } from "../../utils/itemText.js";
import { itemLabel } from "../../utils/upgrade.js";
import { bagCapacity, bagUsed, bagFree, nextBagCost, BAG_STEP } from "../../utils/bag.js";
import { bankFree, bankOf } from "../../utils/bank.js";

const RARITY = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
const mini = { background: color.panelRaised, color: color.parchment, border, borderRadius: 6, padding: "3px 9px", fontSize: 11, cursor: "pointer", fontFamily: font.body };
const off = { opacity: 0.4, cursor: "not-allowed" };
const num = (n) => Math.round(n).toLocaleString("fr-FR");

function Icon({ src, name }) {
  return (
    <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 6, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt={name} width="30" height="30" style={{ objectFit: "contain" }} /> : <span style={{ color: color.mist }}>?</span>}
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
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {list.length === 0 ? <div style={{ padding: 18, textAlign: "center", fontSize: 12, color: color.mist }}>{empty}</div> : list}
      </div>
    </div>
  );
}

// L'onglet Sac : ce que le joueur porte (objets et ressources), la place qu'il reste, les agrandissements, le rangement au coffre
export default function BagPanel({ player, onEquip, bank, bag }) {
  const cap = bagCapacity(player), used = bagUsed(player), free = bagFree(player), cost = nextBagCost(player);
  const full = free <= 0, over = used > cap;
  const bankRoom = bankFree(player), inBank = bankOf(player).resources;
  const resIds = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);
  const pct = Math.min(100, Math.round((used / cap) * 100));
  return (
    <div data-bag style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", minHeight: 0 }}>
      <div style={{ background: color.panel, border, borderRadius: radius.lg, padding: 14, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: color.parchmentDim, marginBottom: 6 }}>
            <span>Emplacements</span>
            <span data-bag-count style={{ fontFamily: font.data, color: full ? "#e0796a" : color.goldBright }}>{used} / {cap}</span>
          </div>
          <div style={{ height: 10, background: color.void, border, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: full ? "linear-gradient(90deg,#7a2a2a,#e0796a)" : `linear-gradient(90deg, ${color.gold}88, ${color.goldBright})` }} />
          </div>
          <div style={{ fontSize: 11, color: full ? "#e0796a" : color.mist, marginTop: 6, lineHeight: 1.5 }}>
            {over ? "Ton sac déborde : fais de la place avant de ramasser quoi que ce soit."
              : full ? "Sac plein : le butin des nouveaux types est perdu, la récolte, la fabrication et les achats sont bloqués."
              : "Un objet prend 1 emplacement ; une ressource aussi, quelle que soit la quantité. Ce que tu portes sur toi n'en prend pas."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {cost === null ? <span style={{ fontSize: 12, color: color.mist }}>Taille maximale atteinte</span> : (
            <button data-bag-upgrade disabled={player.gold < cost} onClick={bag.upgrade}
              style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: radius.sm, background: player.gold >= cost ? color.gold : color.panelRaised, color: player.gold >= cost ? color.void : color.mist, border: `1px solid ${player.gold >= cost ? color.goldBright : color.line}`, cursor: player.gold >= cost ? "pointer" : "not-allowed" }}>
              Agrandir (+{BAG_STEP}) · {num(cost)} or
            </button>
          )}
          <span style={{ fontSize: 11, color: color.mist }}>Tu as <span style={{ fontFamily: font.data, color: color.goldBright }}>{num(player.gold)}</span> or</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, flex: 1, minHeight: 0 }}>
        <Column title="Objets" count={player.inventory.length} empty="Aucun objet dans ton sac.">
          {player.inventory.map((item) => {
            const c = RARITY[item.rarity] || color.parchmentDim, canEquip = item.type in player.equipped;
            return (
              <div key={item.uid} data-bag-item={item.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
                <Icon src={item.img} name={item.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{itemLabel(item)}</div>
                  <div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div>
                </div>
                {canEquip && <button style={mini} onClick={() => onEquip(item)}>Équiper</button>}
                <button data-bag-deposit-item style={{ ...mini, ...(bankRoom < 1 ? off : null) }} disabled={bankRoom < 1} title={bankRoom < 1 ? "Le coffre est plein" : "Ranger au coffre d'Aldenmoor"} onClick={() => bank.depositItem(item.uid)}>Coffre</button>
              </div>
            );
          })}
        </Column>
        <Column title="Ressources" count={`${resIds.length} type${resIds.length > 1 ? "s" : ""}`} empty="Aucune ressource dans ton sac.">
          {resIds.map((id) => {
            const r = RESOURCES[id], q = player.resources[id], c = RESOURCE_RARITIES[r.rarity]?.color || color.mist, blocked = !(inBank[id] > 0) && bankRoom < 1;
            return (
              <div key={id} data-bag-res={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: color.panel, border: `1px solid ${c}44`, borderRadius: radius.md }}>
                <Icon src={r.img} name={r.name} />
                <div style={{ flex: 1, fontSize: 12, color: c, fontWeight: 600 }}>{r.name}</div>
                <span style={{ fontFamily: font.data, fontSize: 12, color: color.parchment, minWidth: 32, textAlign: "right" }}>{q}</span>
                <button style={{ ...mini, ...(blocked ? off : null) }} disabled={blocked} title={blocked ? "Le coffre est plein" : "Ranger 1 au coffre"} onClick={() => bank.depositResource(id, 1)}>1 →</button>
                {q > 1 && <button data-bag-deposit-res={id} style={{ ...mini, ...(blocked ? off : null) }} disabled={blocked} title={blocked ? "Le coffre est plein" : "Tout ranger au coffre"} onClick={() => bank.depositResource(id, Infinity)}>Tout →</button>}
              </div>
            );
          })}
        </Column>
      </div>
    </div>
  );
}
