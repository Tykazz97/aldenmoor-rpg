import { useState, useMemo } from "react";
import { color } from "../../styles/theme.js";
import { RESOURCES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { RECIPES } from "../../data/recipes.js";
import { PROFESSIONS, getCraftInfo } from "../../data/professions.js";
import { professionOf } from "../../utils/crafting.js";
import { sellerName } from "../../utils/market.js";
import { orderInfo, workshopTax, MAX_PLAYER_ORDERS } from "../../utils/orders.js";
import { myOrders, openOrders, orderMinutesLeft, postOrderIssue, acceptIssue } from "../../utils/orderActions.js";
import { CRAFT_PROFESSIONS, directory, tiersOf, tarifFor, workshopOf, defaultPrices, piecesOf } from "../../utils/workshop.js";

const num = (n) => Math.round(n).toLocaleString("fr-FR");
const duration = (min) => (min >= 120 ? `${Math.round(min / 60)} h` : `${Math.max(1, Math.round(min))} min`);
const UP = "#8fd08a", DOWN = "#e0796a";
const profName = (k) => `${PROFESSIONS[k]?.icon || ""} ${PROFESSIONS[k]?.name || k}`;

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
const profPills = (value, onPick, withAll = true) => (
  <div className="hv-lots">
    {withAll && <button className={`hv-lot${value === "" ? " on" : ""}`} onClick={() => onPick("")}>Tous les métiers</button>}
    {CRAFT_PROFESSIONS.map((k) => <button key={k} className={`hv-lot${value === k ? " on" : ""}`} data-prof={k} onClick={() => onPick(k)}>{profName(k)}</button>)}
  </div>
);

// ---------------- Annuaire : qui fabrique, à quel niveau, à quel prix par palier ----------------
function Directory({ m, player, target, onChoose }) {
  const [prof, setProf] = useState("forgeron");
  const tiers = tiersOf(prof);
  const rows = useMemo(() => directory(m, prof, m.bucket, sellerName), [m, prof]);
  const mineLevel = professionOf(player, prof).level;
  const READY = { all: "tout", some: "une partie", none: "rien encore" };
  return (
    <>
      <div className="hv-section">Annuaire des artisans</div>
      <div className="hv-sum">Choisis un métier : tu vois qui propose ses services, son niveau, s'il est connecté (il prend alors ta commande en quelques heures) et ce qu'il demande pour <b>une pièce</b> de chaque palier (un set complet, c'est une pièce par emplacement). Ton niveau en {PROFESSIONS[prof]?.name} : <b>{mineLevel}</b>.</div>
      {profPills(prof, setProf, false)}
      <div className="hv-offers" data-directory style={{ maxHeight: 320 }}>
        <div className="hv-offer" style={{ color: color.mist, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", gridTemplateColumns: `minmax(0,1.4fr) 48px 74px ${tiers.map(() => "minmax(70px,1fr)").join(" ")} 96px` }}>
          <span>Artisan</span><span>Niv.</span><span>Statut</span>{tiers.map((t) => <span key={t}>Palier {t}</span>)}<span />
        </div>
        {rows.map((r) => (
          <div key={r.id} className={`hv-offer${r.isMe ? " mine" : ""}`} data-dir-row={r.id} style={{ gridTemplateColumns: `minmax(0,1.4fr) 48px 74px ${tiers.map(() => "minmax(70px,1fr)").join(" ")} 96px` }}>
            <span className="who">{r.name}{r.isMe && !r.open ? " (indisponible)" : ""}</span>
            <span className="hv-num">{r.level}</span>
            <span style={{ color: r.online ? UP : color.mist, fontSize: 11.5 }}>{r.online ? "● connecté" : "○ absent"}</span>
            {tiers.map((t) => (
              <span key={t} className="hv-num" style={{ textAlign: "left" }} title={`Pièces du palier ${t} : il sait faire ${READY[r.ready[t]]}`}>
                {r.prices[t] ? <>{num(r.prices[t])}<small style={{ display: "inline", marginLeft: 3 }}>or{r.ready[t] === "all" ? "" : r.ready[t] === "some" ? " · partiel" : " · niveau"}</small></> : <span style={{ color: color.mist }}>—</span>}
              </span>
            ))}
            {r.isMe ? <span /> : <button className={`hv-mini${target?.id === r.id ? "" : ""}`} data-act="pick-crafter" onClick={() => onChoose({ id: r.id, name: r.name, prof })}>{target?.id === r.id ? "Choisi ✓" : "Commander ici"}</button>}
          </div>
        ))}
        {rows.length === 0 && <div className="hv-empty">Personne ne propose ce métier pour l'instant. Tu peux passer une annonce ouverte à tous les artisans, plus bas.</div>}
      </div>
    </>
  );
}

// ---------------- Ton atelier : métier par métier ----------------
function Workshop({ m, player, onWorkshop }) {
  return (
    <>
      <div className="hv-section">Ton atelier</div>
      <div className="hv-sum">Pour chaque métier de fabrication, dis si tu es disponible, si tu veux apparaître dans l'annuaire et ce que tu demandes pour <b>une pièce</b> de chaque palier. Les joueurs te passent alors des commandes, que tu fabriques avec leurs ingrédients : tu gardes le salaire et tu gagnes l'xp. Elles attendent ton « Fabriquer » (24 h).</div>
      <div className="hv-slots" data-workshop>
        {CRAFT_PROFESSIONS.map((k) => {
          const w = workshopOf(m, k), level = professionOf(player, k).level, defs = defaultPrices(k);
          return (
            <div key={k} className="hv-slot" data-workshop-prof={k} style={{ minHeight: 0 }}>
              <div className="hv-name"><span style={{ whiteSpace: "normal" }}>{profName(k)}</span></div>
              <div className="hv-sum">Ton niveau : <b>{level}</b></div>
              <label className="hv-check"><input type="checkbox" data-ws-open checked={!!w.open} onChange={(e) => onWorkshop(k, { open: e.target.checked })} /> Disponible pour les commandes</label>
              <label className="hv-check"><input type="checkbox" data-ws-listed checked={!!w.listed} onChange={(e) => onWorkshop(k, { listed: e.target.checked })} /> Visible dans l'annuaire</label>
              <div className="hv-lines">
                {tiersOf(k).map((t) => {
                  const lv = piecesOf(k, t).map((id) => getCraftInfo(id).minLevel), can = level >= Math.min(...lv);
                  return (
                    <label key={t} className="hv-sum" style={{ display: "flex", alignItems: "center", gap: 6, opacity: can ? 1 : 0.55 }} title={can ? "" : `Niveau ${Math.min(...lv)} minimum pour ce palier`}>
                      Palier {t}
                      <input className="hv-input" style={{ width: 70 }} type="number" min="1" data-ws-price={t} key={`${k}${t}${w.prices?.[t] ?? ""}`} defaultValue={w.prices?.[t] ?? ""} placeholder={String(defs[t])}
                        onBlur={(e) => { if (String(e.target.value) !== String(w.prices?.[t] ?? "")) onWorkshop(k, { prices: { [t]: e.target.value } }); }} />
                      or
                    </label>
                  );
                })}
              </div>
              <div className="hv-sum" style={{ fontSize: 11 }}>Prix conseillés en grisé. {w.listed && w.open && !Object.keys(w.prices || {}).length ? <span className="bad">Fixe au moins un prix pour recevoir des commandes.</span> : null}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Commander une pièce ----------------
function OrderForm({ m, player, city, onPost, mine, target, onClearTarget }) {
  const [prof, setProf] = useState("");
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [pick, setPick] = useState(null);
  const [fee, setFee] = useState("");
  const activeProf = target ? target.prof : prof;
  const rows = useMemo(() => Object.keys(RECIPES).map((id) => ({ id, info: orderInfo(id) })).filter((r) => r.info && ITEMS[r.id])
    .filter((r) => (target ? tarifFor(m, target.id, r.id) != null : professionOf(player, r.info.profession).level < r.info.minLevel))
    .filter((r) => !activeProf || r.info.profession === activeProf)
    .filter((r) => !onlyOwned || Object.entries(r.info.mats).every(([mm, q]) => (player.resources[mm] || 0) >= q))
    .sort((a, b) => a.info.minLevel - b.info.minLevel || a.id.localeCompare(b.id)), [m, player.professions, player.resources, activeProf, onlyOwned, target]);   // eslint-disable-line react-hooks/exhaustive-deps
  const sel = pick && orderInfo(pick);
  const tarif = target && pick ? tarifFor(m, target.id, pick) : null;
  const feeNum = tarif ?? Math.floor(Number(fee) || (sel ? sel.fee : 0));
  const issue = sel ? postOrderIssue(player, pick, feeNum, target?.id || null, city) : null;
  const why = { ressources: "Il te manque des ingrédients.", or: "Pas assez d'or pour le salaire.", limite: `Tu as déjà ${MAX_PLAYER_ORDERS} commandes ouvertes.`, prix: "Salaire invalide.", indisponible: "Les artisans ne sont pas là pour l'instant.", artisan: "Cet artisan ne propose plus cette pièce." };
  return (
    <>
      <div className="hv-section">{target ? `Commander chez ${target.name}` : "Annonce ouverte à tous les artisans"}</div>
      {target
        ? <div className="hv-sum" data-order-target>Tu commandes à <b>{target.name}</b> ({profName(target.prof)}), au tarif qu'il affiche dans l'annuaire. Seules les pièces qu'il sait faire sont listées. <button className="hv-mini" onClick={() => { onClearTarget(); setPick(null); }}>Plutôt une annonce ouverte</button></div>
        : <div className="hv-sum">Tu n'as pas encore le niveau de métier pour fabriquer ces pièces ? Confie les ingrédients et un salaire : le premier artisan de niveau suffisant qui trouve le salaire correct la prend. Une commande reste ouverte 24 h ; sans preneur, tout te revient.</div>}
      {!target && profPills(prof, (k) => { setProf(k); setPick(null); })}
      <label className="hv-check"><input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> j'ai déjà les ingrédients</label>
      <div className="hv-slots" data-orders-pieces>
        {rows.slice(0, 40).map(({ id, info }) => {
          const it = ITEMS[id], on = pick === id, t = target ? tarifFor(m, target.id, id) : null;
          return (
            <button key={id} className="hv-slot" data-order-piece={id} onClick={() => { setPick(id); setFee(""); }} style={{ textAlign: "left", cursor: "pointer", borderColor: on ? "#d9b568" : undefined, color: color.parchment, font: "inherit" }}>
              <div className="hv-name"><Icon src={it.img} name={it.name} /><span style={{ whiteSpace: "normal" }}>{it.name}</span></div>
              <div className="hv-sum">{profName(info.profession)} niveau <b>{info.minLevel}</b> <span style={{ color: professionOf(player, info.profession).level < info.minLevel ? DOWN : UP }}>(toi : {professionOf(player, info.profession).level})</span> · {t != null ? <>son tarif <b>{num(t)} or</b></> : <>salaire conseillé <b>{num(info.fee)} or</b></>}</div>
            </button>
          );
        })}
        {rows.length === 0 && <div className="hv-empty">{target ? "Cet artisan ne propose aucune pièce pour le moment." : "Aucune pièce ne correspond (tu peux déjà tout fabriquer, ou le filtre est trop strict)."}</div>}
      </div>
      {rows.length > 40 && <div className="hv-sum">… et {rows.length - 40} autres : choisis un métier pour affiner.</div>}
      {sel && (
        <div className="hv-block" data-order-form>
          <div className="hv-label">Ta commande : {ITEMS[pick].name}</div>
          <Mats mats={sel.mats} have={player.resources} />
          {target
            ? <div className="hv-sum">Salaire de {target.name} : <b data-order-tarif>{num(feeNum)} or</b></div>
            : (
              <div className="hv-lots">
                <span className="hv-sum">Salaire de l'artisan</span>
                <input className="hv-input" data-order-fee type="number" min="1" placeholder={String(sel.fee)} value={fee} onChange={(e) => setFee(e.target.value)} />
                <span className="hv-sum">or (conseillé : {num(sel.fee)} ; trop bas, il faudra peut-être attendre)</span>
              </div>
            )}
          <button className="hv-btn" data-act="order" disabled={!!issue} onClick={() => { onPost(pick, feeNum, target?.id || null); setPick(null); }}>Commander pour {num(feeNum)} or</button>
          {issue && <div className="hv-sum bad">{why[issue] || "Impossible."}</div>}
        </div>
      )}
      {mine.length >= MAX_PLAYER_ORDERS && <div className="hv-sum bad">Tu as déjà {MAX_PLAYER_ORDERS} commandes ouvertes : retire-en une ou attends qu'elles soient prises.</div>}
    </>
  );
}

export default function OrdersTab({ m, player, city = null, onPost, onCancel, onAccept, onWorkshop }) {
  const [target, setTarget] = useState(null);
  if (!m.sims) return <div className="hv-empty">Les artisans ne sont pas disponibles pour l'instant.</div>;
  const mine = myOrders(m), open = openOrders(m).sort((a, b) => (b.crafter === "player") - (a.crafter === "player") || b.fee - a.fee);
  const who = (o) => (o.crafter ? `Adressée à ${o.crafter === "player" ? "toi" : sellerName(o.crafter)}` : "En attente d'un artisan");
  return (
    <>
      <div className="hv-section">Tes commandes <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: color.mist }}>· {mine.length} / {MAX_PLAYER_ORDERS}</span></div>
      <div className="hv-slots" data-orders-mine>
        {mine.map((o) => (
          <div key={o.id} className="hv-slot" data-order-mine={o.id}>
            <div className="hv-slotn">{who(o)} · expire dans {duration(orderMinutesLeft(m, o))}</div>
            <div className="hv-name"><Icon src={ITEMS[o.item].img} name={ITEMS[o.item].name} /><span style={{ whiteSpace: "normal" }}>{ITEMS[o.item].name}</span></div>
            <div className="hv-sum">Salaire : <b>{num(o.fee)} or</b> · niveau {orderInfo(o.item).minLevel} requis</div>
            <button className="hv-mini" style={{ alignSelf: "flex-start" }} data-act="cancel-order" onClick={() => onCancel(o.id)}>Retirer (tout te revient)</button>
          </div>
        ))}
        {mine.length === 0 && <div className="hv-sum" style={{ color: color.mist }}>Aucune commande en cours. La pièce fabriquée pour toi arrive dans ta marchandise à récupérer, comme une vente.</div>}
      </div>
      <Directory m={m} player={player} target={target} onChoose={setTarget} />
      <OrderForm m={m} player={player} city={city} onPost={onPost} mine={mine} target={target} onClearTarget={() => setTarget(null)} />
      <div className="hv-section" style={{ marginTop: 10 }}>Commandes à fabriquer <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: color.mist }}>· avec leurs ingrédients : tu gardes le salaire (moins la taxe d'atelier{city ? ` de ${city.name} : ${Math.round(city.rate * 1000) / 10} %` : ""}) et tu gagnes l'xp</span></div>
      <div className="hv-slots" data-orders-open>
        {open.slice(0, 30).map((o) => {
          const it = ITEMS[o.item], info = orderInfo(o.item), lvl = professionOf(player, info.profession).level, issue = acceptIssue(player, o, city);
          return (
            <div key={o.id} className="hv-slot" data-order-open={o.id} style={o.crafter === "player" ? { borderColor: "#d9b568" } : undefined}>
              <div className="hv-slotn">{sellerName(o.client)} · {o.crafter === "player" ? "adressée à toi · " : ""}expire dans {duration(orderMinutesLeft(m, o))}</div>
              <div className="hv-name"><Icon src={it.img} name={it.name} /><span style={{ whiteSpace: "normal" }}>{it.name}</span></div>
              <div className="hv-sum">{profName(info.profession)} niveau <b>{info.minLevel}</b> <span style={{ color: issue ? DOWN : UP }}>(toi : {lvl})</span></div>
              <div className="hv-sum">Salaire : <b style={{ color: UP }}>+{num(o.fee)} or</b> · taxe d'atelier −{num(workshopTax(o.fee, city ? city.rate : undefined))} · ingrédients fournis</div>
              <button className="hv-btn" style={{ alignSelf: "flex-start" }} data-act="accept-order" disabled={!!issue} onClick={() => onAccept(o.id)} title={issue === "ville" ? "Tu dois être dans la ville du client" : issue ? `Il te faut le niveau ${info.minLevel} en ${PROFESSIONS[info.profession]?.name}` : "Fabriquer cette pièce"}>Fabriquer</button>
            </div>
          );
        })}
        {open.length === 0 && <div className="hv-sum" style={{ color: color.mist }}>Aucune commande pour l'instant. Les joueurs en passent quand une pièce de leur set dépasse leur niveau de métier ; règle ton atelier plus bas pour recevoir celles qui te sont adressées.</div>}
      </div>
      <Workshop m={m} player={player} onWorkshop={onWorkshop} />
    </>
  );
}
