import { useState, useMemo } from "react";
import { color } from "../../styles/theme.js";
import { RESOURCES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { RECIPES } from "../../data/recipes.js";
import { PROFESSIONS, getCraftInfo } from "../../data/professions.js";
import { professionOf } from "../../utils/crafting.js";
import { sellerName } from "../../utils/market.js";
import { orderInfo, MAX_PLAYER_ORDERS } from "../../utils/orders.js";
import { myOrders, openOrders, orderMinutesLeft, postOrderIssue, acceptIssue } from "../../utils/orderActions.js";

const num = (n) => Math.round(n).toLocaleString("fr-FR");
const duration = (min) => (min >= 120 ? `${Math.round(min / 60)} h` : `${Math.max(1, Math.round(min))} min`);
const UP = "#8fd08a", DOWN = "#e0796a";

function Icon({ src, name }) {
  return <div className="hv-icon">{src ? <img src={src} alt={name} width={28} height={28} draggable={false} /> : <span style={{ color: color.mist }}>?</span>}</div>;
}
const Mats = ({ mats, have }) => (
  <div className="hv-lines">
    {Object.entries(mats).map(([r, q]) => {
      const h = have ? have[r] || 0 : q, ok = h >= q;
      return <span key={r} style={{ color: ok ? color.mist : DOWN }}>{have ? `${num(Math.min(h, 9999))}/` : ""}{q} × {RESOURCES[r].name}</span>;
    })}
  </div>
);

// Commander une pièce : la liste des pièces dont tu n'as pas encore le niveau de métier
function OrderForm({ player, onPost, mine }) {
  const [prof, setProf] = useState("");
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [pick, setPick] = useState(null);
  const [fee, setFee] = useState("");
  const rows = useMemo(() => Object.keys(RECIPES).map((id) => ({ id, info: orderInfo(id) })).filter((r) => r.info && ITEMS[r.id] && professionOf(player, r.info.profession).level < r.info.minLevel)
    .filter((r) => !prof || r.info.profession === prof)
    .filter((r) => !onlyOwned || Object.entries(r.info.mats).every(([m, q]) => (player.resources[m] || 0) >= q))
    .sort((a, b) => a.info.minLevel - b.info.minLevel || a.id.localeCompare(b.id)), [player.professions, player.resources, prof, onlyOwned]);   // eslint-disable-line react-hooks/exhaustive-deps
  const profs = useMemo(() => [...new Set(Object.keys(RECIPES).map((id) => getCraftInfo(id)?.profession).filter(Boolean))], []);
  const sel = pick && orderInfo(pick);
  const feeNum = Math.floor(Number(fee) || (sel ? sel.fee : 0));
  const issue = sel ? postOrderIssue(player, pick, feeNum) : null;
  const why = { ressources: "Il te manque des ingrédients.", or: "Pas assez d'or pour le salaire.", limite: `Tu as déjà ${MAX_PLAYER_ORDERS} commandes ouvertes.`, prix: "Salaire invalide.", indisponible: "Les artisans ne sont pas là pour l'instant." };
  return (
    <>
      <div className="hv-section">Commander une pièce à un artisan</div>
      <div className="hv-sum">Tu n'as pas encore le niveau de métier pour fabriquer ces pièces ? Confie les ingrédients et un salaire à un artisan qui l'a : il fabrique, tu récupères la pièce, il garde le salaire et gagne l'xp. Une commande reste ouverte 24 h ; sans preneur, tout te revient.</div>
      <div className="hv-lots">
        <button className={`hv-lot${prof === "" ? " on" : ""}`} onClick={() => { setProf(""); setPick(null); }}>Tous les métiers</button>
        {profs.map((k) => <button key={k} className={`hv-lot${prof === k ? " on" : ""}`} data-prof={k} onClick={() => { setProf(k); setPick(null); }}>{PROFESSIONS[k]?.icon} {PROFESSIONS[k]?.name}</button>)}
        <label className="hv-check"><input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> j'ai déjà les ingrédients</label>
      </div>
      <div className="hv-slots" data-orders-pieces>
        {rows.slice(0, 40).map(({ id, info }) => {
          const it = ITEMS[id], on = pick === id;
          return (
            <button key={id} className="hv-slot" data-order-piece={id} onClick={() => { setPick(id); setFee(""); }} style={{ textAlign: "left", cursor: "pointer", borderColor: on ? "#d9b568" : undefined, color: color.parchment, font: "inherit" }}>
              <div className="hv-name"><Icon src={it.img} name={it.name} /><span style={{ whiteSpace: "normal" }}>{it.name}</span></div>
              <div className="hv-sum">{PROFESSIONS[info.profession]?.icon} {PROFESSIONS[info.profession]?.name} niveau <b>{info.minLevel}</b> <span style={{ color: DOWN }}>(toi : {professionOf(player, info.profession).level})</span> · salaire conseillé <b>{num(info.fee)} or</b></div>
            </button>
          );
        })}
        {rows.length === 0 && <div className="hv-empty">Aucune pièce ne correspond (tu peux déjà tout fabriquer, ou le filtre est trop strict).</div>}
      </div>
      {rows.length > 40 && <div className="hv-sum">… et {rows.length - 40} autres : choisis un métier pour affiner.</div>}
      {sel && (
        <div className="hv-block" data-order-form>
          <div className="hv-label">Ta commande : {ITEMS[pick].name}</div>
          <Mats mats={sel.mats} have={player.resources} />
          <div className="hv-lots">
            <span className="hv-sum">Salaire de l'artisan</span>
            <input className="hv-input" data-order-fee type="number" min="1" placeholder={String(sel.fee)} value={fee} onChange={(e) => setFee(e.target.value)} />
            <span className="hv-sum">or (conseillé : {num(sel.fee)} ; trop bas, il faudra peut-être attendre)</span>
          </div>
          <button className="hv-btn" data-act="order" disabled={!!issue} onClick={() => { onPost(pick, feeNum); setPick(null); }}>Commander pour {num(feeNum)} or</button>
          {issue && <div className="hv-sum bad">{why[issue] || "Impossible."}</div>}
        </div>
      )}
      {mine.length >= MAX_PLAYER_ORDERS && <div className="hv-sum bad">Tu as déjà {MAX_PLAYER_ORDERS} commandes ouvertes : retire-en une ou attends qu'elles soient prises.</div>}
    </>
  );
}

export default function OrdersTab({ m, player, onPost, onCancel, onAccept }) {
  if (!m.sims) return <div className="hv-empty">Les artisans ne sont pas disponibles pour l'instant.</div>;
  const mine = myOrders(m), open = openOrders(m).sort((a, b) => b.fee - a.fee);
  return (
    <>
      <div className="hv-section">Tes commandes <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: color.mist }}>· {mine.length} / {MAX_PLAYER_ORDERS}</span></div>
      <div className="hv-slots" data-orders-mine>
        {mine.map((o) => (
          <div key={o.id} className="hv-slot" data-order-mine={o.id}>
            <div className="hv-slotn">En attente d'un artisan · expire dans {duration(orderMinutesLeft(m, o))}</div>
            <div className="hv-name"><Icon src={ITEMS[o.item].img} name={ITEMS[o.item].name} /><span style={{ whiteSpace: "normal" }}>{ITEMS[o.item].name}</span></div>
            <div className="hv-sum">Salaire : <b>{num(o.fee)} or</b> · niveau {orderInfo(o.item).minLevel} requis</div>
            <button className="hv-mini" style={{ alignSelf: "flex-start" }} data-act="cancel-order" onClick={() => onCancel(o.id)}>Retirer (tout te revient)</button>
          </div>
        ))}
        {mine.length === 0 && <div className="hv-sum" style={{ color: color.mist }}>Aucune commande en cours. La pièce fabriquée pour toi arrive dans ta marchandise à récupérer, comme une vente.</div>}
      </div>
      <OrderForm player={player} onPost={onPost} mine={mine} />
      <div className="hv-section" style={{ marginTop: 10 }}>Commandes des autres joueurs <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: color.mist }}>· tu fabriques avec leurs ingrédients, tu gardes le salaire et tu gagnes l'xp</span></div>
      <div className="hv-slots" data-orders-open>
        {open.slice(0, 30).map((o) => {
          const it = ITEMS[o.item], info = orderInfo(o.item), lvl = professionOf(player, info.profession).level, issue = acceptIssue(player, o);
          return (
            <div key={o.id} className="hv-slot" data-order-open={o.id}>
              <div className="hv-slotn">{sellerName(o.client)} · expire dans {duration(orderMinutesLeft(m, o))}</div>
              <div className="hv-name"><Icon src={it.img} name={it.name} /><span style={{ whiteSpace: "normal" }}>{it.name}</span></div>
              <div className="hv-sum">{PROFESSIONS[info.profession]?.icon} {PROFESSIONS[info.profession]?.name} niveau <b>{info.minLevel}</b> <span style={{ color: issue ? DOWN : UP }}>(toi : {lvl})</span></div>
              <div className="hv-sum">Salaire : <b style={{ color: UP }}>+{num(o.fee)} or</b> · ingrédients fournis</div>
              <button className="hv-btn" style={{ alignSelf: "flex-start" }} data-act="accept-order" disabled={!!issue} onClick={() => onAccept(o.id)} title={issue ? `Il te faut le niveau ${info.minLevel} en ${PROFESSIONS[info.profession]?.name}` : "Fabriquer cette pièce"}>Fabriquer</button>
            </div>
          );
        })}
        {open.length === 0 && <div className="hv-sum" style={{ color: color.mist }}>Aucune commande ouverte pour l'instant. Les joueurs en passent quand une pièce de leur set dépasse leur niveau de métier.</div>}
      </div>
    </>
  );
}
