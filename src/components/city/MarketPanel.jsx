import React, { useState, useEffect, useMemo, useRef } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { itemStatLines } from "../../utils/itemText.js";
import {
  marketOf, settleMarket, buyFromListing, buyCheapest, postListing, cancelListing, listingsFor, equipmentListings, myListings,
  marketPrice, suggestedPrice, suggestedItemPrice, supplyOf, trend, stockLabel, quoteBuy, quotePost, maxAffordable, minutesLeft,
  sellerName, isMine, TAX_RATE, MAX_PLAYER_LISTINGS, STEP_MS,
} from "../../utils/market.js";
import { ITEMS } from "../../data/items.js";

const RARITY = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
const GRID = "minmax(150px, 1.4fr) 100px 64px minmax(90px, 0.8fr) 44px minmax(150px, 1fr)";
const UP = "#8fd08a", DOWN = "#e0796a";
const mini = (on = true) => ({ background: color.panelRaised, color: on ? color.parchment : color.mist, border, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: on ? "pointer" : "not-allowed", fontFamily: font.body, opacity: on ? 1 : 0.5, whiteSpace: "nowrap" });
const input = { width: 70, background: color.panelRaised, color: color.parchment, border, borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: font.data };
const head = { fontFamily: font.display, color: color.goldBright, fontSize: 14 };

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

const duration = (min) => (min >= 120 ? `${Math.round(min / 60)} h` : `${Math.max(1, Math.round(min))} min`);
const labelColor = (l) => (l === "Pénurie" || l === "Rare" ? "#e0b46a" : l === "Abondant" ? "#7fb0d0" : color.mist);

// ---------------- Acheter ----------------
function ResourceRow({ id, m, player, open, onToggle, onBuy, onBuyListing }) {
  const r = RESOURCES[id], c = RESOURCE_RARITIES[r.rarity]?.color || color.mist;
  const t = trend(m, id), have = player.resources[id] || 0, label = stockLabel(m, id);
  const pct = Math.round(t.change * 100), up = pct >= 0;
  const list = listingsFor(m, id), first = list.find((l) => !isMine(l)), price = first?.unit;
  const canBuy = maxAffordable(m, id, player.gold);
  return (
    <div data-resource={id} style={{ display: "flex", flexDirection: "column", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md }}>
      <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 10, padding: "6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Icon src={r.img} name={r.name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
            <div style={{ fontSize: 10, color: labelColor(label) }}>{label} · {supplyOf(m, id)} en vente</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Évolution du prix sur 24 h">
          <Spark hist={t.hist} up={up} />
          <span style={{ fontFamily: font.data, fontSize: 11, color: up ? UP : DOWN, minWidth: 34, textAlign: "right" }}>{up ? "▲" : "▼"}{Math.abs(pct)}%</span>
        </div>
        <div data-price style={{ textAlign: "right", fontFamily: font.data, fontSize: 13, color: color.parchment }} title="Annonce la moins chère (achat sans taxe)">{price ?? "—"}</div>
        <div style={{ fontSize: 11, color: color.mist, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title="Vendeur de l'annonce la moins chère">{first ? sellerName(first.seller) : ""}</div>
        <div style={{ textAlign: "right", fontFamily: font.data, fontSize: 12, color: have ? color.goldBright : color.mist }} title="Dans ton sac">{have}</div>
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
          <button data-act="buy1" style={mini(canBuy >= 1)} onClick={() => canBuy >= 1 && onBuy(id, 1)} title="Acheter 1 au prix le plus bas">+1</button>
          <button data-act="buy10" style={mini(canBuy >= 1)} onClick={() => canBuy >= 1 && onBuy(id, 10)} title={canBuy >= 1 ? `Acheter ${Math.min(10, canBuy)} pour ${quoteBuy(m, id, Math.min(10, canBuy)).total} or` : "Pas assez d'or ou rien en vente"}>+10</button>
          <button data-act="toggle" style={mini(true)} onClick={() => onToggle(id)} title="Voir toutes les annonces">{open ? "▴" : "▾"} {list.length}</button>
        </div>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 10px 8px 54px" }}>
          {list.map((l) => (
            <div key={l.id} data-listing={l.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: color.parchmentDim }}>
              <span style={{ width: 130, color: isMine(l) ? color.goldBright : color.parchment }}>{sellerName(l.seller)}</span>
              <span style={{ width: 60, fontFamily: font.data }}>{l.qty} ×</span>
              <span style={{ width: 70, fontFamily: font.data, color: color.parchment }}>{l.unit} or</span>
              <span style={{ width: 54, fontSize: 10, color: color.mist }}>{duration(minutesLeft(m, l))}</span>
              {isMine(l)
                ? <span style={{ fontSize: 10, color: color.mist }}>ton annonce</span>
                : <>
                    <button data-act="buylisting1" style={mini(player.gold >= l.unit)} onClick={() => player.gold >= l.unit && onBuyListing(l, 1)}>Acheter 1</button>
                    <button data-act="buylistingall" style={mini(player.gold >= l.unit)} onClick={() => player.gold >= l.unit && onBuyListing(l, l.qty)} title={`${l.qty} × ${l.unit} = ${l.qty * l.unit} or`}>Tout</button>
                  </>}
            </div>
          ))}
          {list.length === 0 && <div style={{ fontSize: 11, color: color.mist }}>Personne ne vend cette ressource pour l'instant.</div>}
        </div>
      )}
    </div>
  );
}

function ItemListingRow({ l, m, player, onBuy }) {
  const item = l.item || ITEMS[l.rid], c = RARITY[item.rarity] || color.parchmentDim, can = player.gold >= l.unit && !isMine(l);
  return (
    <div data-listing={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md }}>
      <Icon src={item.img} name={item.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
        <div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div>
      </div>
      <div style={{ fontSize: 11, color: isMine(l) ? color.goldBright : color.mist, width: 110, textAlign: "right" }}>{sellerName(l.seller)}</div>
      <div style={{ fontSize: 10, color: color.mist, width: 50, textAlign: "right" }}>{duration(minutesLeft(m, l))}</div>
      {isMine(l)
        ? <span style={{ ...mini(false), cursor: "default" }}>ton annonce</span>
        : <button data-act="buyitem" style={mini(can)} onClick={() => can && onBuy(l)} title={can ? "Acheter (sans taxe)" : "Pas assez d'or"}>Acheter · {l.unit} or</button>}
    </div>
  );
}

// ---------------- Vendre ----------------
function PriceBox({ qty, unit, setUnit, market, hint, gold }) {
  const q = quotePost(qty, unit);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: color.mist }}>Prix unitaire</span>
        <input data-field="unit" type="number" min="1" value={unit} onChange={(e) => setUnit(e.target.value)} style={input} />
        <button style={mini(true)} onClick={() => setUnit(String(hint))} title="Prix du marché">marché {hint}</button>
        {market != null && market > 1 && <button data-act="undercut" style={mini(true)} onClick={() => setUnit(String(market - 1))} title="1 or de moins que l'annonce la moins chère">−1</button>}
      </div>
      <div data-preview style={{ fontSize: 10, color: q.tax > gold ? DOWN : color.mist }}>
        {q.gross > 0 ? `Total ${q.gross} or · taxe ${Math.round(TAX_RATE * 100)} % = ${q.tax} or payés maintenant · si tout part : ${q.net} or net` : "Indique un prix"}
      </div>
    </div>
  );
}

function SellResourceRow({ id, have, m, player, onPost }) {
  const r = RESOURCES[id], c = RESOURCE_RARITIES[r.rarity]?.color || color.mist;
  const sug = suggestedPrice(m, id), [qty, setQty] = useState(String(have)), [unit, setUnit] = useState(String(sug));
  const q = Math.max(0, Math.min(have, Math.floor(Number(qty) || 0))), u = Math.floor(Number(unit) || 0);
  return (
    <div data-sell-resource={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: 170 }}>
        <Icon src={r.img} name={r.name} />
        <div><div style={{ fontSize: 12, fontWeight: 600, color: c }}>{r.name}</div><div style={{ fontSize: 10, color: color.mist }}>{have} dans ton sac</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: color.mist }}>Quantité</span>
        <input data-field="qty" type="number" min="1" max={have} value={qty} onChange={(e) => setQty(e.target.value)} style={input} />
        <button style={mini(true)} onClick={() => setQty(String(have))}>tout</button>
      </div>
      <PriceBox qty={q} unit={u} setUnit={setUnit} market={marketPrice(m, id)} hint={sug} gold={player.gold} />
      <button data-act="post" style={{ ...mini(q >= 1 && u >= 1), marginLeft: "auto" }} onClick={() => q >= 1 && u >= 1 && onPost({ kind: "res", rid: id, qty: q, unit: u })}>Mettre en vente</button>
    </div>
  );
}

function SellItemRow({ item, player, onPost }) {
  const c = RARITY[item.rarity] || color.parchmentDim, sug = suggestedItemPrice(item.id), [unit, setUnit] = useState(String(sug));
  const u = Math.floor(Number(unit) || 0);
  return (
    <div data-sell-item={item.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: color.panel, border: `1px solid ${c}33`, borderRadius: radius.md, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: 230 }}>
        <Icon src={item.img} name={item.name} />
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: c }}>{item.name}</div><div style={{ fontSize: 10, color: color.mist }}>{itemStatLines(item).join(" · ")}</div></div>
      </div>
      <PriceBox qty={1} unit={u} setUnit={setUnit} market={null} hint={sug} gold={player.gold} />
      <button data-act="postitem" style={{ ...mini(u >= 1), marginLeft: "auto" }} onClick={() => u >= 1 && onPost({ kind: "item", uid: item.uid, unit: u })}>Mettre en vente</button>
    </div>
  );
}

// ---------------- Mes annonces ----------------
function MyListingRow({ l, m, onCancel }) {
  const isItem = l.kind === "item", res = RESOURCES[l.rid], item = l.item;
  const name = isItem ? item?.name : res.name, img = isItem ? item?.img : res.img;
  return (
    <div data-mine={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: color.panel, border, borderRadius: radius.md }}>
      <Icon src={img} name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: color.parchment }}>{isItem ? name : `${l.qty} × ${name}`}</div>
        <div style={{ fontSize: 10, color: color.mist }}>{l.unit} or {isItem ? "" : "l'unité · "}{isItem ? "" : `${l.qty * l.unit} or au total · `}expire dans {duration(minutesLeft(m, l))}</div>
      </div>
      <button data-act="cancel" style={mini(true)} onClick={() => onCancel(l.id)} title="Reprendre la marchandise (la taxe payée n'est pas rendue)">Retirer</button>
    </div>
  );
}

// Hôtel des ventes : les joueurs (simulés) fixent les prix. Acheter est sans taxe, mettre en vente est taxé.
export default function MarketPanel({ player, onPlayerChange }) {
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("buy");
  const [open, setOpen] = useState(null);
  const [mineOnly, setMineOnly] = useState(false);
  const ref = useRef(player);
  ref.current = player;
  const say = (text, ok = true) => setMsg({ text, ok, id: Date.now() });

  // Encaisse les ventes et récupère les annonces expirées : à l'ouverture, puis toutes les 30 s
  const settle = (announce = true) => {
    const s = settleMarket(ref.current, Date.now());
    setNow(Date.now());
    if (s.earned > 0 || s.returned.length) {
      onPlayerChange(s.player);
      const bits = [];
      if (s.earned > 0) bits.push(`Tes ventes ont rapporté ${s.earned} or.`);
      if (s.returned.length) bits.push(`${s.returned.length} annonce(s) expirée(s) : marchandise rendue.`);
      if (announce) say(bits.join(" "));
    }
  };
  useEffect(() => { settle(); const t = setInterval(() => settle(), 30000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMemo(() => marketOf(player, now), [player.market, now]);   // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (r, okText, koText) => { if (!r.ok) return say(koText(r.reason), false); onPlayerChange(r.player); say(okText(r)); };

  const buy = (id, qty) => apply(buyCheapest(player, id, qty, Date.now()), (r) => `Acheté ${r.qty} × ${RESOURCES[id].name} pour ${r.total} or.`, (why) => (why === "or" ? "Pas assez d'or." : "Plus rien en vente."));
  const buyListingFn = (l, qty) => apply(buyFromListing(player, l.id, qty, Date.now()), (r) => `Acheté ${r.qty} × ${RESOURCES[l.rid].name} à ${sellerName(l.seller)} pour ${r.total} or.`, (why) => (why === "or" ? "Pas assez d'or." : "Cette annonce n'existe plus."));
  const buyItem = (l) => apply(buyFromListing(player, l.id, 1, Date.now()), (r) => `Acheté ${(l.item || ITEMS[l.rid]).name} à ${sellerName(l.seller)} pour ${r.total} or.`, (why) => (why === "or" ? "Pas assez d'or." : "Cette annonce n'existe plus."));
  const post = (spec) => apply(postListing(player, spec, Date.now()), (r) => `Annonce publiée : ${r.listing.kind === "item" ? ITEMS[r.listing.rid].name : `${r.qty} × ${RESOURCES[r.listing.rid].name}`} à ${r.listing.unit} or. Taxe payée : ${r.tax} or.`, (why) => ({ prix: "Prix invalide.", limite: `Tu as déjà ${MAX_PLAYER_LISTINGS} annonces.`, taxe: "Tu n'as pas assez d'or pour payer la taxe.", aucun: "Tu n'as plus cela dans ton sac." }[why] || "Impossible de publier."));
  const cancel = (id) => apply(cancelListing(player, id, Date.now()), () => "Annonce retirée, marchandise rendue (la taxe n'est pas remboursée).", () => "Annonce introuvable.");

  const mine = myListings(m), sales = (m.sales || []).slice(-8).reverse();
  const bag = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);
  const ids = RESOURCE_ORDER.filter((id) => !mineOnly || (player.resources[id] || 0) > 0);
  const tabBtn = (key, label) => <button data-tab={key} onClick={() => setTab(key)} style={{ ...mini(true), padding: "6px 14px", fontSize: 12, background: tab === key ? color.panel : color.panelRaised, color: tab === key ? color.goldBright : color.parchmentDim, borderColor: tab === key ? color.goldBright : undefined }}>{label}</button>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.data, fontSize: 15, color: color.goldBright }} data-gold>🪙 {player.gold} or</div>
        <div key={msg?.id} style={{ flex: 1, minWidth: 200, fontSize: 12, color: msg?.ok === false ? DOWN : UP, minHeight: 16 }} data-msg>{msg?.text || ""}</div>
      </div>
      <div style={{ fontSize: 11, color: color.mist, lineHeight: 1.5 }}>
        Ici, ce sont les joueurs qui fixent les prix : chacun met en vente au tarif qu'il veut, et les autres achètent l'annonce qui leur convient. <b style={{ color: color.parchmentDim }}>Acheter est sans taxe. Mettre en vente (ressource ou équipement) coûte {Math.round(TAX_RATE * 100)} % du montant demandé, payés tout de suite par le vendeur et non remboursés.</b>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {tabBtn("buy", "Acheter")}{tabBtn("sell", "Vendre")}{tabBtn("mine", `Mes annonces (${mine.length}/${MAX_PLAYER_LISTINGS})`)}
        {tab === "buy" && (
          <label style={{ marginLeft: "auto", fontSize: 12, color: color.parchmentDim, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Seulement mes ressources
          </label>
        )}
      </div>

      {tab === "buy" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={head}>Ressources</div>
            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "0 10px", fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>Ressource</span><span>Cours 24 h</span><span style={{ textAlign: "right" }}>Prix</span><span>Vendeur</span><span style={{ textAlign: "right" }}>Sac</span><span />
            </div>
            {ids.map((id) => <ResourceRow key={id} id={id} m={m} player={player} open={open === id} onToggle={(x) => setOpen(open === x ? null : x)} onBuy={buy} onBuyListing={buyListingFn} />)}
            {ids.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Tu n'as aucune ressource dans ton sac.</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={head}>Équipement en vente</div>
            {equipmentListings(m).map((l) => <ItemListingRow key={l.id} l={l} m={m} player={player} onBuy={buyItem} />)}
            {equipmentListings(m).length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Aucun équipement en vente pour l'instant.</div>}
          </div>
        </>
      )}

      {tab === "sell" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={head}>Tes ressources</div>
            {bag.map((id) => <SellResourceRow key={id} id={id} have={player.resources[id]} m={m} player={player} onPost={post} />)}
            {bag.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Tu n'as aucune ressource à vendre.</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={head}>Équipement de ton sac <span style={{ fontFamily: font.body, fontSize: 11, color: color.mist }}>· ce que tu portes n'est pas en vente</span></div>
            {player.inventory.map((it) => <SellItemRow key={it.uid} item={it} player={player} onPost={post} />)}
            {player.inventory.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Ton sac ne contient aucun équipement.</div>}
          </div>
        </>
      )}

      {tab === "mine" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={head}>Tes annonces en cours <span style={{ fontFamily: font.body, fontSize: 11, color: color.mist }}>· elles durent 48 h, puis la marchandise te revient</span></div>
            {mine.map((l) => <MyListingRow key={l.id} l={l} m={m} onCancel={cancel} />)}
            {mine.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: color.mist }}>Tu n'as aucune annonce. Mets quelque chose en vente depuis l'onglet « Vendre ».</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={head}>Dernières ventes</div>
            {sales.map((s, i) => (
              <div key={i} style={{ fontSize: 12, color: color.parchmentDim }}>
                {s.qty} × {s.kind === "item" ? s.name || ITEMS[s.rid]?.name : RESOURCES[s.rid].name} à {s.unit} or = <span style={{ color: UP }}>+{s.qty * s.unit} or</span> <span style={{ color: color.mist }}>· il y a {duration(Math.max(1, (m.bucket - s.b) * (STEP_MS / 60000)))}</span>
              </div>
            ))}
            {sales.length === 0 && <div style={{ fontSize: 12, color: color.mist }}>Aucune vente pour l'instant.</div>}
          </div>
        </>
      )}
    </div>
  );
}
