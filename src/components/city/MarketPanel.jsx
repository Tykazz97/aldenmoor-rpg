import React, { useState, useEffect } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { itemStatLines } from "../../utils/itemText.js";
import { marketOf, buyPrice, sellPrice, trend, stockLabel, quoteBuy, quoteSell, maxAffordable, buyResource, sellResource, sellItem, itemSellPrice } from "../../utils/market.js";

const RARITY = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
const GRID = "minmax(150px, 1.4fr) 100px 62px 62px 44px minmax(190px, 1.2fr)";
const UP = "#8fd08a", DOWN = "#e0796a";
const mini = (on = true) => ({ background: color.panelRaised, color: on ? color.parchment : color.mist, border, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: on ? "pointer" : "not-allowed", fontFamily: font.body, opacity: on ? 1 : 0.5, whiteSpace: "nowrap" });

function Icon({ src, name }) {
  return (
    <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 6, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt={name} width="28" height="28" style={{ objectFit: "contain" }} /> : <span style={{ color: color.mist }}>?</span>}
    </div>
  );
}

// Courbe des dernières 24 h
function Spark({ hist, up }) {
  if (hist.length < 2) return <span style={{ width: 64 }} />;
  const lo = Math.min(...hist), hi = Math.max(...hist), span = Math.max(hi - lo, 0.15);
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * 62 + 1},${19 - ((v - lo) / span) * 17}`).join(" ");
  return <svg width="64" height="20" viewBox="0 0 64 20" aria-hidden><polyline points={pts} fill="none" stroke={up ? UP : DOWN} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function ResourceRow({ id, m, player, onBuy, onSell }) {
  const r = RESOURCES[id], c = RESOURCE_RARITIES[r.rarity]?.color || color.mist;
  const t = trend(m, id), have = player.resources[id] || 0, label = stockLabel(m, id);
  const pct = Math.round(t.change * 100), up = pct >= 0;
  const can10 = quoteBuy(m, id, 10), canBuy = maxAffordable(m, id, player.gold);
  return (
    <div data-resource={id} style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 10, padding: "6px 10px", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Icon src={r.img} name={r.name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
          <div style={{ fontSize: 10, color: label === "Pénurie" || label === "Stock bas" ? "#e0b46a" : label === "Abondant" ? "#7fb0d0" : color.mist }}>{label}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Évolution du prix sur 24 h">
        <Spark hist={t.hist} up={up} />
        <span style={{ fontFamily: font.data, fontSize: 11, color: up ? UP : DOWN, minWidth: 34, textAlign: "right" }}>{up ? "▲" : "▼"}{Math.abs(pct)}%</span>
      </div>
      <div style={{ textAlign: "right", fontFamily: font.data, fontSize: 12, color: color.parchment }} title="Prix d'achat à l'unité">{buyPrice(m, id)}</div>
      <div style={{ textAlign: "right", fontFamily: font.data, fontSize: 12, color: color.parchment }} title="Prix de vente à l'unité">{sellPrice(m, id)}</div>
      <div style={{ textAlign: "right", fontFamily: font.data, fontSize: 12, color: have ? color.goldBright : color.mist }} title="Dans ton sac">{have}</div>
      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
        <button data-act="buy1" style={mini(canBuy >= 1)} onClick={() => canBuy >= 1 && onBuy(id, 1)} title="Acheter 1">+1</button>
        <button data-act="buy10" style={mini(canBuy >= 1)} onClick={() => canBuy >= 1 && onBuy(id, 10)} title={`Acheter ${Math.min(10, canBuy)} pour ${quoteBuy(m, id, Math.min(10, canBuy)).total} or`}>+10</button>
        <button data-act="sell1" style={mini(have >= 1)} onClick={() => have >= 1 && onSell(id, 1)} title={have ? `Vendre 1 pour ${sellPrice(m, id)} or` : "Tu n'en as pas"}>−1</button>
        <button data-act="sellall" style={mini(have >= 1)} onClick={() => have >= 1 && onSell(id, Infinity)} title={have ? `Tout vendre : ${quoteSell(m, id, have).total} or` : "Tu n'en as pas"}>tout</button>
      </div>
    </div>
  );
}

function ItemRow({ item, onSell }) {
  const c = RARITY[item.rarity] || color.parchmentDim;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md }}>
      <Icon src={item.img} name={item.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div>
      </div>
      <button data-act="sellitem" style={mini(true)} onClick={() => onSell(item.uid)}>Vendre · {itemSellPrice(item.id)} or</button>
    </div>
  );
}

// Marché : prix des ressources selon l'offre et la demande, achat, vente, et revente d'équipement.
export default function MarketPanel({ player, onPlayerChange }) {
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState(null);
  const [mineOnly, setMineOnly] = useState(false);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const m = marketOf(player, now);
  const say = (text, ok = true) => setMsg({ text, ok, id: Date.now() });
  const buy = (id, qty) => {
    const r = buyResource(player, id, qty, Date.now());
    if (!r.ok) return say(r.reason === "or" ? "Pas assez d'or." : "Le marché n'a plus de stock de cette ressource.", false);
    onPlayerChange(r.player);
    say(`Acheté ${r.qty} × ${RESOURCES[id].name} pour ${r.total} or.`);
  };
  const sell = (id, qty) => {
    const r = sellResource(player, id, qty, Date.now());
    if (!r.ok) return say("Tu n'en as pas.", false);
    onPlayerChange(r.player);
    say(`Vendu ${r.qty} × ${RESOURCES[id].name} pour ${r.total} or.`);
  };
  const sellOne = (uid) => {
    const it = player.inventory.find((i) => i.uid === uid);
    const r = sellItem(player, uid);
    if (!r.ok) return;
    onPlayerChange(r.player);
    say(`Vendu ${it.name} pour ${r.total} or.`);
  };

  const ids = RESOURCE_ORDER.filter((id) => !mineOnly || (player.resources[id] || 0) > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.data, fontSize: 15, color: color.goldBright }} data-gold>🪙 {player.gold} or</div>
        <div key={msg?.id} style={{ flex: 1, minWidth: 200, fontSize: 12, color: msg?.ok === false ? DOWN : UP, minHeight: 16 }} data-msg>{msg?.text || ""}</div>
        <label style={{ fontSize: 12, color: color.parchmentDim, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Seulement mes ressources
        </label>
      </div>
      <div style={{ fontSize: 11, color: color.mist, lineHeight: 1.5 }}>
        Les prix suivent l'offre et la demande : ce que tu vends fait baisser le cours, ce que tu achètes le fait monter, et il se rééquilibre avec les heures. Pense à acheter bas et vendre haut.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: font.display, color: color.goldBright, fontSize: 14 }}>Ressources</div>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "0 10px", fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Ressource</span><span>Cours 24 h</span><span style={{ textAlign: "right" }}>Achat</span><span style={{ textAlign: "right" }}>Vente</span><span style={{ textAlign: "right" }}>Sac</span><span />
        </div>
        {ids.map((id) => <ResourceRow key={id} id={id} m={m} player={player} onBuy={buy} onSell={sell} />)}
        {ids.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Tu n'as aucune ressource à vendre pour l'instant.</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: font.display, color: color.goldBright, fontSize: 14 }}>Équipement de ton sac <span style={{ fontFamily: font.body, fontSize: 11, color: color.mist }}>· rachat à 60 % de la valeur</span></div>
        {player.inventory.map((it) => <ItemRow key={it.uid} item={it} onSell={sellOne} />)}
        {player.inventory.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Ton sac ne contient aucun équipement à vendre. (Ce que tu portes n'est pas en vente.)</div>}
      </div>
    </div>
  );
}
