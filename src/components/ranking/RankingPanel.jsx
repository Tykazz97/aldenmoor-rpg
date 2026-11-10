import { useState, useMemo } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { PROFESSIONS } from "../../data/professions.js";
import { CLASSES, CLASS_ORDER } from "../../data/classes.js";
import { getLivePopulation } from "../../sim/simWorld.js";
import { buildRanking, sortRows, ranksFor, professionOf, formatHours, classLabel, classIcon, SORTS } from "../../utils/ranking.js";

const TOP = 100;
const num = (n) => Math.round(n).toLocaleString("fr-FR");
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
const GRID = "52px minmax(150px, 2fr) 74px 110px minmax(130px, 1.4fr) 100px";
const HEAD = { niveau: "Niveau", or: "Fortune", metier: "Métier", heures: "Temps de jeu" };

function Summary({ sort, label, rank, total, value, on, onClick }) {
  return (
    <button data-rank-card={sort} onClick={onClick} style={{ flex: "1 1 170px", textAlign: "left", background: on ? color.panelRaised : color.panel, border: `1px solid ${on ? color.goldBright : color.line}`, borderRadius: radius.md, padding: "10px 14px", cursor: "pointer", color: color.parchment, fontFamily: font.body }}>
      <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, lineHeight: 1.3 }}>{MEDAL[rank] || ""} {rank === 1 ? "1er" : `${rank}e`} <span style={{ fontFamily: font.body, fontSize: 11, color: color.mist }}>sur {total}</span></div>
      <div style={{ fontFamily: font.data, fontSize: 12, color: color.parchmentDim }}>{value}</div>
    </button>
  );
}

// Classement : tous les aventuriers (les simulés et toi), en direct. Un clic sur une colonne change le tri.
export default function RankingPanel({ player }) {
  const [sort, setSort] = useState("niveau");
  const [cls, setCls] = useState("");
  const [metier, setMetier] = useState("");
  const [query, setQuery] = useState("");
  const sims = player?.market?.sims;
  const rows = useMemo(() => buildRanking(player, getLivePopulation(player)), [sims, player.level, player.xp, player.gold, player.professions, player.playSec, player.name]);   // eslint-disable-line react-hooks/exhaustive-deps -- on ne suit que les champs du joueur qui comptent pour le classement
  const total = rows.length;
  const guilds = sims?.guilds;
  const guildTag = (r) => { const g = guilds?.byId?.[guilds?.of?.[r.isMe ? "player" : r.id]]; return g ? g.tag : null; };
  const m = metier || null;
  const globalRank = useMemo(() => ranksFor(rows, sort, m), [rows, sort, m]);
  const mine = rows.find((r) => r.isMe);
  const myRanks = useMemo(() => Object.fromEntries(Object.keys(SORTS).map((s) => [s, ranksFor(rows, s, s === "metier" ? m : null)[mine?.id]])), [rows, mine?.id, m]);
  const filtered = useMemo(() => sortRows(rows, sort, m).filter((r) => (!cls || r.classKey === cls) && (!query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()))), [rows, sort, m, cls, query]);
  const shown = filtered.slice(0, TOP);
  const meShown = shown.some((r) => r.isMe), meFiltered = filtered.some((r) => r.isMe);

  const th = (key, label, align) => (
    <button data-rank-sort={key} onClick={() => setSort(key)} title={`Trier par ${label.toLowerCase()}`} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: sort === key ? color.goldBright : color.mist, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: align || "left", fontFamily: font.body, fontWeight: sort === key ? 700 : 500 }}>
      {label}{sort === key ? " ▾" : ""}
    </button>
  );

  const Row = ({ r }) => {
    const p = professionOf(r, m), rank = globalRank[r.id];
    return (
      <div data-rank-row={r.id} data-me={r.isMe ? "1" : undefined} style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "7px 14px", background: r.isMe ? "#2a2412" : "transparent", borderBottom: `1px solid ${color.panelRaised}`, boxShadow: r.isMe ? `inset 3px 0 0 ${color.goldBright}` : "none" }}>
        <div style={{ fontFamily: font.data, fontSize: 13, color: rank <= 3 ? color.goldBright : color.parchmentDim }}>{MEDAL[rank] || rank}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: r.isMe ? color.goldBright : color.parchment, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{guildTag(r) && <span data-rank-guild style={{ fontFamily: font.data, fontSize: 10.5, color: color.gold, marginRight: 6 }}>[{guildTag(r)}]</span>}{r.name}{r.isMe && <span style={{ fontSize: 10, color: color.goldBright, marginLeft: 6 }}>(toi)</span>}</div>
          <div style={{ fontSize: 10.5, color: color.mist }}>{classIcon(r.classKey)} {classLabel(r.classKey)}</div>
        </div>
        <div style={{ fontFamily: font.data, fontSize: 13, textAlign: "right", color: sort === "niveau" ? color.goldBright : color.parchment }}>{r.level}</div>
        <div style={{ fontFamily: font.data, fontSize: 13, textAlign: "right", color: sort === "or" ? color.goldBright : color.parchment }}>{num(r.gold)} <span style={{ color: color.mist, fontSize: 10 }}>or</span></div>
        <div style={{ fontSize: 12, color: sort === "metier" ? color.goldBright : color.parchmentDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p ? <>{PROFESSIONS[p.key].icon} {PROFESSIONS[p.key].name} <b style={{ fontFamily: font.data, color: sort === "metier" ? color.goldBright : color.parchment }}>{p.level}</b></> : "—"}</div>
        <div style={{ fontFamily: font.data, fontSize: 12.5, textAlign: "right", color: sort === "heures" ? color.goldBright : color.parchment }}>{formatHours(r.hours)}</div>
      </div>
    );
  };

  return (
    <div data-ranking style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1000, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
      <div style={{ fontSize: 12, color: color.mist, lineHeight: 1.5, flexShrink: 0 }}>
        Tous les aventuriers d'Aldenmoor, toi compris, mis à jour en direct : les simulés avancent par pas de 10 minutes. Le temps de jeu compte quand l'onglet est ouvert et que tu joues.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <Summary sort="niveau" label="Niveau" rank={myRanks.niveau} total={total} value={`niveau ${mine.level}`} on={sort === "niveau"} onClick={() => setSort("niveau")} />
        <Summary sort="or" label="Fortune" rank={myRanks.or} total={total} value={`${num(mine.gold)} or`} on={sort === "or"} onClick={() => setSort("or")} />
        <Summary sort="metier" label={m ? PROFESSIONS[m].name : "Meilleur métier"} rank={myRanks.metier} total={total} value={(() => { const p = professionOf(mine, m); return p ? `${PROFESSIONS[p.key].name} ${p.level}` : "—"; })()} on={sort === "metier"} onClick={() => setSort("metier")} />
        <Summary sort="heures" label="Temps de jeu" rank={myRanks.heures} total={total} value={formatHours(mine.hours)} on={sort === "heures"} onClick={() => setSort("heures")} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        <input data-rank-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un joueur…" aria-label="Chercher un joueur" style={{ flex: "1 1 180px", maxWidth: 260, background: color.panel, border, borderRadius: radius.md, color: color.parchment, padding: "7px 11px", fontSize: 13, fontFamily: font.body }} />
        <select aria-label="Classe" value={cls} onChange={(e) => setCls(e.target.value)} style={{ background: color.panel, border, borderRadius: radius.md, color: color.parchment, padding: "7px 8px", fontSize: 12.5, fontFamily: font.body }}>
          <option value="">Toutes les classes</option>
          {CLASS_ORDER.map((k) => <option key={k} value={k}>{CLASSES[k].icon} {CLASSES[k].label}</option>)}
        </select>
        <select aria-label="Métier" value={metier} onChange={(e) => { setMetier(e.target.value); setSort("metier"); }} style={{ background: color.panel, border, borderRadius: radius.md, color: color.parchment, padding: "7px 8px", fontSize: 12.5, fontFamily: font.body }}>
          <option value="">Meilleur métier de chacun</option>
          {Object.values(PROFESSIONS).map((p) => <option key={p.key} value={p.key}>{p.icon} {p.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: color.mist }}>{filtered.length} aventurier{filtered.length > 1 ? "s" : ""}</span>
      </div>

      <div style={{ background: color.panel, border, borderRadius: radius.md, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "9px 14px", borderBottom: border }}>
          <span style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.07em" }}>Rang</span>
          <span style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.07em" }}>Aventurier</span>
          {th("niveau", HEAD.niveau, "right")}{th("or", HEAD.or, "right")}{th("metier", HEAD.metier)}{th("heures", HEAD.heures, "right")}
        </div>
        {shown.map((r) => <Row key={r.id} r={r} />)}
        {meFiltered && !meShown && (
          <>
            <div style={{ padding: "4px 14px", fontSize: 11, color: color.mist, textAlign: "center", borderBottom: `1px solid ${color.panelRaised}` }}>⋯</div>
            <Row r={filtered.find((r) => r.isMe)} />
          </>
        )}
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: color.mist }}>Aucun aventurier ne correspond.</div>}
      </div>
      {filtered.length > TOP && <div style={{ fontSize: 11.5, color: color.mist, flexShrink: 0 }}>Les {TOP} premiers sont affichés ; ta ligne reste visible en bas.</div>}
    </div>
  );
}
