import React, { useState, useEffect, useMemo, useRef } from "react";
import "./market.css";
import { color } from "../../styles/theme.js";
import { itemLabel } from "../../utils/upgrade.js";
import { itemStatLines } from "../../utils/itemText.js";
import { isMasterwork } from "../../utils/perks.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import {
  marketOf, CATCHUP_SLICE, settleMarket, buyFromListing, buyCheapest, postListing, cancelListing, listingsFor, equipmentListings,
  marketPrice, suggestedPrice, suggestedItemPrice, trend, stockLabel, quoteBuy, quotePost, maxAffordable, minutesLeft,
  sellerName, isMine, TAX_RATE, STEP_MS,
} from "../../utils/market.js";
import { LOTS, GROUPS, categoriesOf, categoryLabel, buyCatalog, sellCatalog, offerCounts, slotBoard, refOf } from "../../utils/marketBook.js";

const RARITY = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
const UP = "#8fd08a", DOWN = "#e0796a";
const rarityColor = (kind, rarity) => (kind === "res" ? RESOURCE_RARITIES[rarity]?.color : RARITY[rarity]) || color.parchmentDim;
const num = (n) => Math.round(n).toLocaleString("fr-FR");
const unitText = (x) => (x >= 100 ? num(x) : (Math.round(x * 10) / 10).toString().replace(".", ","));
const duration = (min) => (min >= 120 ? `${Math.round(min / 60)} h` : `${Math.max(1, Math.round(min))} min`);
const stockColor = (l) => (l === "Pénurie" || l === "Rare" ? "#e0b46a" : l === "Abondant" ? "#7fb0d0" : color.mist);

function Icon({ src, name, big }) {
  return (
    <div className={`hv-icon${big ? " big" : ""}`}>
      {src ? <img src={src} alt={name} width={big ? 46 : 28} height={big ? 46 : 28} draggable={false} /> : <span style={{ color: color.mist }}>?</span>}
    </div>
  );
}

// Courbe des dernières 24 h
function Spark({ hist, up, w = 64, h = 20 }) {
  if (hist.length < 2) return <span style={{ width: w }} />;
  const lo = Math.min(...hist), hi = Math.max(...hist), span = Math.max(hi - lo, 0.15);
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * (w - 2) + 1},${h - 1 - ((v - lo) / span) * (h - 3)}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden><polyline points={pts} fill="none" stroke={up ? UP : DOWN} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

// En affichage étroit la fiche passe sous la liste : on la ramène à l'écran quand on choisit un objet
const showDetail = (key) => { if (key) setTimeout(() => document.querySelector("[data-hv-detail], [data-hv-sellform]")?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60); };

// ---------------- Colonne de gauche : catégories ----------------
function Sidebar({ cat, onCat, counts }) {
  return (
    <nav className="hv-side" data-hv-cats aria-label="Catégories">
      <button className={`hv-cat${cat === "tout" ? " on" : ""}`} data-cat="tout" onClick={() => onCat("tout")}>Tout <span className="n">{counts ? counts.tout : ""}</span></button>
      {GROUPS.map((g) => (
        <React.Fragment key={g}>
          <div className="hv-side-head">{g}</div>
          <button className={`hv-cat${cat === `g_${g}` ? " on" : ""}`} data-cat={`g_${g}`} onClick={() => onCat(`g_${g}`)}>Tout {g === "Ressources" ? "les matériaux" : "l'équipement"} <span className="n">{counts ? counts[`g_${g}`] : ""}</span></button>
          {categoriesOf(g).map((c) => (
            <button key={c.key} className={`hv-cat sub${cat === c.key ? " on" : ""}`} data-cat={c.key} onClick={() => onCat(c.key)}>{c.label} <span className="n">{counts ? counts[c.key] || 0 : ""}</span></button>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ---------------- Acheter ----------------
function BuyRow({ r, m, on, onSelect }) {
  const c = rarityColor(r.kind, r.rarity);
  const t = r.kind === "res" ? trend(m, r.id) : null, pct = t ? Math.round(t.change * 100) : 0, up = pct >= 0;
  const cell = (lot, extra) => (lot
    ? <div className={`hv-num ${extra || ""}`}>{num(lot.total)}{lot.qty > 1 && <small>{unitText(lot.unit)} / u.</small>}</div>
    : <div className="hv-num no">—</div>);
  const isItem = r.kind === "item";
  return (
    <button className={`hv-row${on ? " on" : ""}`} data-hv-row={`${r.kind}:${r.id}`} onClick={() => onSelect(r)}>
      <div className="hv-name"><Icon src={r.img} name={r.name} /><span style={{ color: c }} title={r.name}>{r.name}</span></div>
      <div className="hv-num" title="Quantité en vente">{r.supply}</div>
      {cell(r.lots[0])}
      {isItem
        ? <div className="hv-stats" title={itemStatLines(ITEMS[r.id]).join(" · ")}>{itemStatLines(ITEMS[r.id]).join(" · ")}</div>
        : <>
          {cell(r.lots[1])}
          <div className="hide-s">{cell(r.lots[2])}</div>
          <div className="hv-trend hide-s" title="Évolution du prix sur 24 h">{t && <><Spark hist={t.hist} up={up} w={34} h={16} /><span style={{ color: up ? UP : DOWN }}>{up ? "▲" : "▼"}{Math.abs(pct)}%</span></>}</div>
        </>}
    </button>
  );
}

function ResourceDetail({ id, m, player, onBuy, onBuyListing }) {
  const r = RESOURCES[id], c = rarityColor("res", r.rarity), t = trend(m, id), pct = Math.round(t.change * 100), up = pct >= 0;
  const [lot, setLot] = useState(10);
  const offers = listingsFor(m, id), others = offers.filter((l) => !isMine(l));
  const canMax = maxAffordable(m, id, player.gold), totalSupply = others.reduce((n, l) => n + l.qty, 0);
  const want = Math.max(1, Math.floor(Number(lot) || 1));
  const q = quoteBuy(m, id, want, player.gold), full = quoteBuy(m, id, want);
  const label = stockLabel(m, id);
  return (
    <div className="hv-detail" data-hv-detail={`res:${id}`}>
      <div className="hv-h">
        <Icon src={r.img} name={r.name} big />
        <div style={{ minWidth: 0 }}>
          <div className="hv-title" style={{ color: c }}>{r.name}</div>
          <div className="hv-sub">{RESOURCE_RARITIES[r.rarity]?.label} · {player.resources[id] || 0} dans ton sac</div>
        </div>
      </div>
      <div className="hv-block">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div><div className="hv-label">Meilleur prix</div><div className="hv-num" style={{ textAlign: "left", fontSize: 20, color: color.goldBright }} data-hv-best>{others[0] ? `${num(others[0].unit)} or` : "—"}</div></div>
          <div style={{ textAlign: "right" }}>
            <div className="hv-trend" title="Évolution du prix sur 24 h"><Spark hist={t.hist} up={up} w={92} h={30} /><span style={{ color: up ? UP : DOWN }}>{up ? "▲" : "▼"}{Math.abs(pct)}%</span></div>
            <span className="hv-pill" style={{ color: stockColor(label), borderColor: `${stockColor(label)}66`, marginTop: 4, display: "inline-block" }}>{label} · {totalSupply} en vente</span>
          </div>
        </div>
      </div>
      <div className="hv-block">
        <div className="hv-label">Acheter</div>
        <div className="hv-lots">
          {LOTS.map((n) => <button key={n} className={`hv-lot${want === n ? " on" : ""}`} data-lot={n} onClick={() => setLot(n)}>× {n}</button>)}
          <button className={`hv-lot${want === canMax && canMax > 0 && !LOTS.includes(want) ? " on" : ""}`} data-lot="max" onClick={() => setLot(Math.max(1, canMax))} title="Le maximum que ton or permet">Max {canMax}</button>
          <input className="hv-input" data-field="lot" type="number" min="1" value={lot} onChange={(e) => setLot(e.target.value)} aria-label="Quantité à acheter" />
        </div>
        <div className="hv-sum" data-hv-quote>
          {q.qty >= want
            ? <>Acheter <b>{want}</b> pour <b>{num(q.total)} or</b> <span style={{ color: color.mist }}>({unitText(q.total / want)} / unité, sans taxe)</span></>
            : full.qty >= want
              ? <span className="bad">Il te manque {num(full.total - player.gold)} or pour {want} ({num(full.total)} or).</span>
              : <span className="bad">Seulement {full.qty} en vente{q.qty < full.qty ? ` (${q.qty} avec ton or)` : ""}.</span>}
        </div>
        <button className={`hv-btn${q.qty >= want ? "" : " off"}`} data-act="buy" disabled={q.qty < 1} onClick={() => q.qty >= 1 && onBuy(id, q.qty)}>
          {q.qty >= want ? `Acheter ${want}` : q.qty >= 1 ? `Acheter ${q.qty} (le maximum possible)` : "Acheter"}
        </button>
      </div>
      <div>
        <div className="hv-label" style={{ marginBottom: 4 }}>Offres ({offers.length}) — de la moins chère à la plus chère</div>
        <div className="hv-offers">
          {offers.map((l) => (
            <div key={l.id} className={`hv-offer${isMine(l) ? " mine" : ""}`} data-listing={l.id}>
              <div className="who">{sellerName(l.seller)}<small>{l.qty} × {num(l.unit)} or · {duration(minutesLeft(m, l))}</small></div>
              {isMine(l)
                ? <span className="hv-sub">ton annonce</span>
                : <><button className="hv-mini" data-act="buylisting1" disabled={player.gold < l.unit} onClick={() => onBuyListing(l, 1)}>+1</button>
                  <button className="hv-mini" data-act="buylistingall" disabled={player.gold < l.unit} onClick={() => onBuyListing(l, l.qty)} title={`${l.qty} × ${l.unit} = ${num(l.qty * l.unit)} or`}>Tout · {num(l.qty * l.unit)}</button></>}
            </div>
          ))}
          {offers.length === 0 && <div className="hv-empty" style={{ padding: 12 }}>Personne ne vend cette ressource pour l'instant. Tu peux la mettre en vente toi-même !</div>}
        </div>
      </div>
    </div>
  );
}

function ItemOffer({ l, m, player, onBuy }) {
  const item = l.item || ITEMS[l.rid], can = player.gold >= l.unit && !isMine(l);
  return (
    <div className={`hv-offer${isMine(l) ? " mine" : ""}`} data-listing={l.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
      <div className="who" style={{ whiteSpace: "normal" }}>
        <b style={{ fontWeight: 600 }}>{itemLabel(item)}</b>{isMasterwork(item) && <span title="Chef-d'œuvre : +10 % de stats" style={{ color: color.goldBright }}> ✦</span>}
        <small>{itemStatLines(item).join(" · ")}</small>
        <small>{sellerName(l.seller)} · {duration(minutesLeft(m, l))}</small>
      </div>
      {isMine(l)
        ? <span className="hv-sub">ton annonce</span>
        : <button className="hv-btn" style={{ padding: "6px 12px", fontSize: 12 }} data-act="buyitem" disabled={!can} onClick={() => can && onBuy(l)} title={can ? "Acheter (sans taxe)" : "Pas assez d'or"}>{num(l.unit)} or</button>}
    </div>
  );
}

function ItemDetail({ id, m, player, onBuy }) {
  const it = ITEMS[id], c = rarityColor("item", it.rarity);
  const offers = equipmentListings(m).filter((l) => l.rid === id);
  return (
    <div className="hv-detail" data-hv-detail={`item:${id}`}>
      <div className="hv-h">
        <Icon src={it.img} name={it.name} big />
        <div style={{ minWidth: 0 }}>
          <div className="hv-title" style={{ color: c }}>{it.name}</div>
          <div className="hv-sub">{categoryLabel(`e_${it.type.startsWith("relique") ? "relique" : it.type}`)} · {it.rarity}</div>
        </div>
      </div>
      <div className="hv-block"><div className="hv-label">Caractéristiques de base</div><div className="hv-lines">{itemStatLines(it).map((s) => <span key={s}>{s}</span>)}</div></div>
      <div>
        <div className="hv-label" style={{ marginBottom: 4 }}>Exemplaires en vente ({offers.length}) — du moins cher au plus cher</div>
        <div className="hv-offers" style={{ maxHeight: 340 }}>
          {offers.map((l) => <ItemOffer key={l.id} l={l} m={m} player={player} onBuy={onBuy} />)}
          {offers.length === 0 && <div className="hv-empty" style={{ padding: 12 }}>Plus aucun exemplaire en vente.</div>}
        </div>
      </div>
    </div>
  );
}

function BuyTab({ m, player, onBuy, onBuyListing, onBuyItem }) {
  const [cat, setCat] = useState("tout");
  const [query, setQuery] = useState("");
  const [onlyOffers, setOnlyOffers] = useState(true);
  const [sel, setSel] = useState(null);
  const counts = useMemo(() => offerCounts(m), [m]);
  useEffect(() => showDetail(sel && `${sel.kind}:${sel.id}`), [sel?.kind, sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => buyCatalog(m, { category: cat, query, onlyOffers }), [m, cat, query, onlyOffers]);
  const selected = sel && (sel.kind === "res" ? RESOURCES[sel.id] : ITEMS[sel.id]) ? sel : null;
  return (
    <div className="hv-buy">
      <Sidebar cat={cat} onCat={setCat} counts={counts} />
      <div className="hv-main">
        <div className="hv-bar">
          <input className="hv-search" data-hv-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un objet…" aria-label="Chercher un objet" />
          <span style={{ fontSize: 12, color: color.mist }}>{rows.length} objet{rows.length > 1 ? "s" : ""}</span>
          <label className="hv-check"><input type="checkbox" checked={onlyOffers} onChange={(e) => setOnlyOffers(e.target.checked)} /> Seulement ce qui est en vente</label>
        </div>
        <div className="hv-scroll">
          {rows.length > 0 && rows.every((r) => r.kind === "item")
            ? <div className="hv-cols"><span>Objet</span><span className="r">En vente</span><span className="r">Dès</span><span style={{ gridColumn: "4 / span 3" }}>Caractéristiques de base</span></div>
            : <div className="hv-cols"><span>Objet</span><span className="r">En vente</span><span className="r">Prix × 1</span><span className="r">Prix × 10</span><span className="r hide-s">Prix × 100</span><span className="r hide-s">24 h</span></div>}
          {rows.map((r) => <BuyRow key={`${r.kind}:${r.id}`} r={r} m={m} on={selected?.kind === r.kind && selected?.id === r.id} onSelect={(x) => setSel({ kind: x.kind, id: x.id })} />)}
          {rows.length === 0 && <div className="hv-empty">{query ? "Aucun objet ne correspond à ta recherche." : "Rien n'est en vente dans cette catégorie pour l'instant."}{onlyOffers && <><br />Décoche « Seulement ce qui est en vente » pour voir aussi les objets sans offre.</>}</div>}
        </div>
      </div>
      {selected
        ? (selected.kind === "res"
          ? <ResourceDetail key={`r${selected.id}`} id={selected.id} m={m} player={player} onBuy={onBuy} onBuyListing={onBuyListing} />
          : <ItemDetail key={`i${selected.id}`} id={selected.id} m={m} player={player} onBuy={onBuyItem} />)
        : <div className="hv-detail"><div className="hv-empty" style={{ padding: "40px 8px" }}>Clique sur un objet de la liste pour voir ses offres et l'acheter.<br /><br /><span style={{ color: color.mist }}>Le prix × 10 et × 100 est le coût total du lot, pris sur les offres les moins chères.</span></div></div>}
    </div>
  );
}

// ---------------- Vendre ----------------
function SellForm({ row, m, player, board, onPost, onGoMine }) {
  const isItem = row.kind === "item";
  const ref = refOf(row.kind, row.id), c = rarityColor(row.kind, row.rarity);
  const sug = isItem ? suggestedItemPrice(row.item) : suggestedPrice(m, row.id);
  const [qty, setQty] = useState(String(isItem ? 1 : Math.min(row.have, 10)));
  const [unit, setUnit] = useState(String(sug));
  const q = isItem ? 1 : Math.max(0, Math.min(row.have, Math.floor(Number(qty) || 0))), u = Math.floor(Number(unit) || 0);
  const quote = quotePost(q, u), market = isItem ? null : marketPrice(m, row.id);
  const rivals = (isItem ? equipmentListings(m).filter((l) => l.rid === row.id) : listingsFor(m, row.id)).filter((l) => !isMine(l)).slice(0, 4);
  const ready = q >= 1 && u >= 1 && board.free >= 1 && quote.tax <= player.gold;
  const why = board.free < 1 ? null : quote.tax > player.gold ? "Tu n'as pas assez d'or pour payer la taxe." : u < 1 ? "Indique un prix." : null;
  return (
    <div className="hv-detail" data-hv-sellform={row.key}>
      <div className="hv-h">
        <Icon src={ref.img} name={ref.name} big />
        <div style={{ minWidth: 0 }}>
          <div className="hv-title" style={{ color: c }}>{isItem ? itemLabel(row.item) : ref.name}</div>
          <div className="hv-sub">{isItem ? itemStatLines(row.item).join(" · ") : `${row.have} dans ton sac`}</div>
        </div>
      </div>
      {!isItem && (
        <div className="hv-block">
          <div className="hv-label">Quantité à vendre</div>
          <div className="hv-lots">
            {LOTS.filter((n) => n < row.have).map((n) => <button key={n} className={`hv-lot${q === n ? " on" : ""}`} data-lot={n} onClick={() => setQty(String(n))}>× {n}</button>)}
            <button className={`hv-lot${q === row.have ? " on" : ""}`} data-lot="all" onClick={() => setQty(String(row.have))}>Tout ({row.have})</button>
            <input className="hv-input" data-field="qty" type="number" min="1" max={row.have} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantité" />
          </div>
        </div>
      )}
      <div className="hv-block">
        <div className="hv-label">Prix {isItem ? "" : "à l'unité"}</div>
        <div className="hv-lots">
          <input className="hv-input" style={{ width: 100 }} data-field="unit" type="number" min="1" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Prix" />
          <span style={{ fontSize: 12, color: color.mist }}>or</span>
          <button className="hv-mini" onClick={() => setUnit(String(sug))} title={isItem ? "Valeur estimée de l'objet" : "Prix du marché"}>{isItem ? "estimé" : "marché"} {num(sug)}</button>
          {market != null && market > 1 && <button className="hv-mini" data-act="undercut" onClick={() => setUnit(String(market - 1))} title="1 or de moins que l'offre la moins chère">−1 or</button>}
          {u > 20 && <button className="hv-mini" onClick={() => setUnit(String(Math.max(1, Math.round(u * 0.95))))} title="5 % de moins que ton prix">−5 %</button>}
        </div>
        <div className="hv-sum" data-hv-preview>
          {quote.gross > 0
            ? <>Total <b>{num(quote.gross)} or</b><br />Taxe de mise en vente ({Math.round(TAX_RATE * 100)} %) : <b className={quote.tax > player.gold ? "bad" : ""}>{num(quote.tax)} or</b>, payés tout de suite<br />Si tout part, tu gagnes <b style={{ color: UP }}>{num(quote.net)} or</b></>
            : "Indique un prix."}
        </div>
      </div>
      {rivals.length > 0 && (
        <div>
          <div className="hv-label" style={{ marginBottom: 4 }}>Offres déjà en vente</div>
          <div className="hv-offers" style={{ maxHeight: 130 }}>
            {rivals.map((l) => <div key={l.id} className="hv-offer" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><div className="who">{sellerName(l.seller)}<small>{isItem ? itemLabel(l.item || ITEMS[l.rid]) : `${l.qty} en vente`}</small></div><b className="hv-num">{num(l.unit)} or</b></div>)}
          </div>
        </div>
      )}
      <div className="hv-sum" data-hv-slots>
        Emplacements de vente : <b>{board.used} / {board.total}</b>
        {board.free < 1 && <> — <span className="bad">tous pris.</span> <button className="hv-mini" onClick={onGoMine}>Voir mes ventes</button>{board.next && <> Un emplacement de plus au niveau {board.next}.</>}</>}
      </div>
      {why && <div className="hv-sum bad">{why}</div>}
      <button className={`hv-btn${ready ? "" : " off"}`} data-act="post" disabled={!ready} onClick={() => ready && onPost(isItem ? { kind: "item", uid: row.key, unit: u } : { kind: "res", rid: row.id, qty: q, unit: u })}>Mettre en vente</button>
    </div>
  );
}

function SellTab({ m, player, board, onPost, onGoMine }) {
  const [cat, setCat] = useState("tout");
  const [query, setQuery] = useState("");
  const [selKey, setSelKey] = useState(null);
  const rows = useMemo(() => sellCatalog(player, { category: cat, query }), [player, cat, query]);
  const row = selKey ? sellCatalog(player).find((r) => r.key === selKey) : null;
  useEffect(() => showDetail(selKey), [selKey]);
  return (
    <div className="hv-sell">
      <div className="hv-main">
        <div className="hv-bar">
          <input className="hv-search" data-hv-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher dans ton sac…" aria-label="Chercher dans ton sac" />
          <div className="hv-lots">
            {[["tout", "Tout"], ["g_Ressources", "Ressources"], ["g_Équipement", "Équipement"]].map(([k, l]) => <button key={k} className={`hv-lot${cat === k ? " on" : ""}`} style={{ fontFamily: "inherit" }} data-cat={k} onClick={() => setCat(k)}>{l}</button>)}
          </div>
        </div>
        <div className="hv-scroll">
          {rows.map((r) => {
            const c = rarityColor(r.kind, r.rarity);
            return (
              <button key={r.key} className={`hv-sellrow${selKey === r.key ? " on" : ""}`} data-hv-sellrow={r.key} onClick={() => setSelKey(r.key)}>
                <div className="hv-name"><Icon src={r.img} name={r.name} /><span style={{ color: c }}>{r.kind === "item" ? itemLabel(r.item) : r.name}</span></div>
                <div className="hv-num">{r.kind === "item" ? <small style={{ display: "inline" }}>{categoryLabel(r.category)}</small> : `× ${num(r.have)}`}</div>
              </button>
            );
          })}
          {rows.length === 0 && <div className="hv-empty">{query || cat !== "tout" ? "Rien dans ton sac ne correspond." : "Ton sac est vide : récolte, chasse ou fabrique de quoi vendre."}<br /><span style={{ color: color.mist }}>Ce que tu portes sur toi n'est pas en vente.</span></div>}
        </div>
      </div>
      {row
        ? <SellForm key={row.key} row={row} m={m} player={player} board={board} onPost={onPost} onGoMine={onGoMine} />
        : <div className="hv-detail"><div className="hv-empty" style={{ padding: "40px 8px" }}>Choisis un objet de ton sac pour fixer ton prix.<br /><br /><span style={{ color: color.mist }}>Mettre en vente coûte {Math.round(TAX_RATE * 100)} % du montant demandé, payés tout de suite. Acheter est gratuit.</span></div></div>}
    </div>
  );
}

// ---------------- Mes ventes ----------------
function MineTab({ m, board, onCancel, onGoSell }) {
  const sales = (m.sales || []).slice(-10).reverse();
  return (
    <>
      <div className="hv-section">Tes emplacements de vente <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: color.mist }}>· {board.used} / {board.total} utilisés{board.next ? ` · prochain emplacement au niveau ${board.next}` : " · maximum atteint"}</span></div>
      <div className="hv-slots" data-hv-slots-board>
        {board.slots.map((s) => {
          if (s.state === "locked") return <div key={s.n} className="hv-slot locked" data-slot="locked"><div className="hv-slotn">Emplacement {s.n}</div>🔒 Débloqué au niveau {s.level}</div>;
          if (s.state === "free") return <div key={s.n} className="hv-slot free" data-slot="free"><div className="hv-slotn">Emplacement {s.n}</div>Libre<button className="hv-mini" onClick={onGoSell}>Mettre un objet en vente</button></div>;
          const l = s.listing, isItem = l.kind === "item", item = l.item, res = RESOURCES[l.rid];
          const name = isItem ? itemLabel(item) : res.name, img = isItem ? item.img : res.img, c = rarityColor(isItem ? "item" : "res", (isItem ? item : res).rarity);
          return (
            <div key={s.n} className="hv-slot" data-mine={l.id} data-slot="used">
              <div className="hv-slotn">Emplacement {s.n} · expire dans {duration(minutesLeft(m, l))}</div>
              <div className="hv-name"><Icon src={img} name={name} /><span style={{ color: c, whiteSpace: "normal" }}>{isItem ? name : `${num(l.qty)} × ${name}`}</span></div>
              <div className="hv-sum">{num(l.unit)} or{isItem ? "" : " l'unité"}{!isItem && <> · <b>{num(l.qty * l.unit)} or</b> au total</>}</div>
              <button className="hv-mini" style={{ alignSelf: "flex-start" }} data-act="cancel" onClick={() => onCancel(l.id)} title="Reprendre la marchandise (la taxe payée n'est pas rendue)">Retirer</button>
            </div>
          );
        })}
      </div>
      <div className="hv-sum" style={{ fontSize: 11.5 }}>Une annonce dure 48 h, puis la marchandise te revient. Retirer une annonce ne rembourse pas la taxe. Plus ton personnage monte en niveau, plus tu as d'emplacements.</div>
      <div className="hv-section" style={{ marginTop: 6 }}>Dernières ventes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sales.map((s, i) => (
          <div key={i} className="hv-sum">
            {s.qty} × {s.kind === "item" ? s.name || ITEMS[s.rid]?.name : RESOURCES[s.rid].name} à {num(s.unit)} or = <span style={{ color: UP }}>+{num(s.qty * s.unit)} or</span> <span style={{ color: color.mist }}>· il y a {duration(Math.max(1, (m.bucket - s.b) * (STEP_MS / 60000)))}</span>
          </div>
        ))}
        {sales.length === 0 && <div className="hv-sum" style={{ color: color.mist }}>Aucune vente pour l'instant.</div>}
      </div>
    </>
  );
}

// Hôtel des ventes : les joueurs (simulés) fixent les prix. Acheter est sans taxe, mettre en vente est taxé.
export default function MarketPanel({ player, onPlayerChange }) {
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("buy");
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

  const m = useMemo(() => marketOf(player, now, { maxSteps: CATCHUP_SLICE }), [player.market, now]);   // eslint-disable-line react-hooks/exhaustive-deps
  const board = useMemo(() => slotBoard(player, m), [player.level, m]);   // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (r, okText, koText) => { if (!r.ok) return say(koText(r.reason), false); onPlayerChange(r.player); say(okText(r)); };

  const buy = (id, qty) => apply(buyCheapest(player, id, qty, Date.now()), (r) => `Acheté ${r.qty} × ${RESOURCES[id].name} pour ${num(r.total)} or.`, (why) => (why === "or" ? "Pas assez d'or." : "Plus rien en vente."));
  const buyListingFn = (l, qty) => apply(buyFromListing(player, l.id, qty, Date.now()), (r) => `Acheté ${r.qty} × ${RESOURCES[l.rid].name} à ${sellerName(l.seller)} pour ${num(r.total)} or.`, (why) => (why === "or" ? "Pas assez d'or." : "Cette annonce n'existe plus."));
  const buyItem = (l) => apply(buyFromListing(player, l.id, 1, Date.now()), (r) => `Acheté ${(l.item || ITEMS[l.rid]).name} à ${sellerName(l.seller)} pour ${num(r.total)} or. Il est dans ton sac.`, (why) => (why === "or" ? "Pas assez d'or." : "Cette annonce n'existe plus."));
  const post = (spec) => apply(postListing(player, spec, Date.now()), (r) => `Annonce publiée : ${r.listing.kind === "item" ? ITEMS[r.listing.rid].name : `${r.qty} × ${RESOURCES[r.listing.rid].name}`} à ${num(r.listing.unit)} or. Taxe payée : ${num(r.tax)} or.`, (why) => ({ prix: "Prix invalide.", limite: `Tous tes emplacements de vente sont pris (${board.total}).`, taxe: "Tu n'as pas assez d'or pour payer la taxe.", aucun: "Tu n'as plus cela dans ton sac." }[why] || "Impossible de publier."));
  const cancel = (id) => apply(cancelListing(player, id, Date.now()), () => "Annonce retirée, marchandise rendue (la taxe n'est pas remboursée).", () => "Annonce introuvable.");

  const tabBtn = (key, label) => <button className={`hv-tab${tab === key ? " on" : ""}`} data-tab={key} onClick={() => setTab(key)}>{label}</button>;

  return (
    <div className="hv" data-market>
      <div className="hv-top">
        <div className="hv-gold" data-gold>🪙 {num(player.gold)} or</div>
        <div className={`hv-chip${board.free < 1 ? " full" : ""}`} data-hv-slotchip title="Plus ton personnage monte en niveau, plus tu as d'emplacements de vente.">Emplacements de vente <b>{board.used} / {board.total}</b>{board.next && <span style={{ color: color.mist }}> · +1 au niveau {board.next}</span>}</div>
        <div key={msg?.id} className={`hv-msg ${msg?.ok === false ? "ko" : "ok"}`} data-msg>{msg?.text || ""}</div>
      </div>
      <div className="hv-tabs">
        {tabBtn("buy", "Acheter")}{tabBtn("sell", "Vendre")}{tabBtn("mine", `Mes ventes (${board.used}/${board.total})`)}
      </div>
      {tab === "buy" && <BuyTab m={m} player={player} onBuy={buy} onBuyListing={buyListingFn} onBuyItem={buyItem} />}
      {tab === "sell" && <SellTab m={m} player={player} board={board} onPost={post} onGoMine={() => setTab("mine")} />}
      {tab === "mine" && <MineTab m={m} board={board} onCancel={cancel} onGoSell={() => setTab("sell")} />}
    </div>
  );
}
