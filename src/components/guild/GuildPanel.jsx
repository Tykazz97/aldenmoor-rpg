import React, { useState, useMemo } from "react";
import "./guild.css";
import { RESOURCES, RESOURCE_ORDER } from "../../data/resources.js";
import {
  GUILD_MAX_MEMBERS, GUILD_CREATE_COST, GUILD_MAX_LEVEL, GUILD_NAME_MAX, PALIERS, TABS, TAB_SLOTS, QUEST_TYPES, BONUS_KEYS, BONUS_LABELS,
  BONUS_ICONS, guildXpToNext, RANK_LABELS, RANK_ICONS,
} from "../../data/guild.js";
import { bonusFromPaliers } from "../../utils/guildBonus.js";
import { memberCount, nextPalier, nextTab, palierProblem, tabProblem, tabUsed, nameProblem, newGuilds, cleanName } from "../../utils/guildCore.js";
import {
  REASONS, guildList, myGuild, memberRows, createGuildAction, joinGuildAction, leaveGuildAction, donateAction, depositAction, withdrawAction,
  buyPalierAction, buyTabAction, kickAction, transferAction, setRankAction, rankOf, canSpend, canWithdraw, canKick, ranksAssignable,
} from "../../utils/guildActions.js";
import { classLabel, classIcon } from "../../utils/ranking.js";
import { getPopulation } from "../../sim/population.js";
import Emblem from "./Emblem.jsx";
import Sentinels from "./Sentinels.jsx";
import EmblemEditor from "./EmblemEditor.jsx";
import { EMBLEM_DEFAULT } from "../../data/emblems.js";

const num = (n) => Math.round(n).toLocaleString("fr-FR");
const ago = (m, t) => { const min = Math.max(0, (m.bucket - t) * 10); return min < 60 ? `il y a ${Math.max(1, Math.round(min))} min` : min < 1440 ? `il y a ${Math.round(min / 60)} h` : `il y a ${Math.round(min / 1440)} j`; };
const pct = (v) => `+${v} %`;

function Ico({ src, name }) {
  return <div className="gd-ico">{src ? <img src={src} alt={name} width={22} height={22} draggable={false} /> : <span style={{ color: "#74748a" }}>?</span>}</div>;
}

function BonusChips({ bonus, only }) {
  const keys = only || BONUS_KEYS;
  return (
    <div className="gd-bonus">
      {keys.map((k) => <span key={k} className={`gd-chip${bonus[k] > 0 ? "" : " off"}`} data-bonus={k}>{BONUS_ICONS[k]} {BONUS_LABELS[k]} <b>{pct(bonus[k] || 0)}</b></span>)}
    </div>
  );
}

// ---------------------------------------------------------------- sans guilde
function Browse({ player, run }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [emblem, setEmblem] = useState({ ...EMBLEM_DEFAULT });
  const list = guildList(player);
  const G = player.market?.sims?.guilds || newGuilds();
  const problem = name.trim() ? nameProblem(G, name) : null;
  const rich = player.gold >= GUILD_CREATE_COST;
  const names = useMemo(() => new Map(getPopulation().map((b) => [b.id, b.name])), []);
  const shown = list.filter((g) => !query.trim() || g.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="gd-row2">
      <div className="gd-card" data-gd-create-card>
        <div className="gd-h">Fonder une guilde</div>
        <div className="gd-note">Jusqu'à {GUILD_MAX_MEMBERS} membres, une caisse, un coffre partagé et des bonus qui montent avec le niveau de la guilde. Fonder coûte <b className="gd-gold">{num(GUILD_CREATE_COST)} or</b>.</div>
        <input className="gd-input" data-gd-create-name value={name} maxLength={GUILD_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Nom de la guilde" aria-label="Nom de la guilde" />
        <div className="gd-sub" style={{ minHeight: 16, color: problem ? "#e0796a" : undefined }}>{problem ? REASONS[problem] : name.trim() ? "Ce nom est libre." : "3 à 24 caractères."}</div>
        <div className="gd-label">Blason</div>
        <EmblemEditor emblem={emblem} onChange={setEmblem} />
        <div className="gd-line">
          <button className="gd-btn" data-gd-create disabled={!name.trim() || !!problem || !rich} onClick={() => run(() => createGuildAction(player, name, Date.now(), emblem), "Ta guilde est fondée !", () => setName(""))}>Fonder · {num(GUILD_CREATE_COST)} or</button>
          <span className="gd-sub">Tu as <b className="gd-gold">{num(player.gold)}</b> or{rich ? "" : " (il t'en manque)"}</span>
        </div>
      </div>
      <div className="gd-card">
        <div className="gd-line" style={{ justifyContent: "space-between" }}>
          <div className="gd-h">Guildes d'Aldenmoor <span className="gd-sub">({list.length})</span></div>
          <input className="gd-input" data-gd-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher une guilde…" aria-label="Chercher une guilde" style={{ width: 220 }} />
        </div>
        {list.length === 0 ? (
          <div className="gd-empty" data-gd-none>Aucune guilde pour l'instant. Les aventuriers qui en ont les moyens en fondent peu à peu : reviens plus tard, ou fonde la tienne.</div>
        ) : (
          <div>
            <div className="gd-cols"><span>Guilde</span><span className="gd-r">Niveau</span><span className="gd-r">Membres</span><span className="hide-s">Chef</span><span className="gd-r hide-s">Paliers</span><span /></div>
            <div className="gd-list">
              {shown.map((g) => {
                const full = memberCount(g) >= GUILD_MAX_MEMBERS;
                return (
                  <div key={g.id} className="gd-list-row" data-gd-row={g.id}>
                    <span className="nm"><Emblem emblem={g.emblem} seed={g.id} size={22} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}><span className="gd-tag">[{g.tag}]</span>{g.name}</span></span>
                    <span className="gd-num gd-r">{g.level}</span>
                    <span className="gd-num gd-r">{memberCount(g)}/{GUILD_MAX_MEMBERS}</span>
                    <span className="hide-s" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#a89f8c" }}>{g.leader === "player" ? "Toi" : names.get(g.leader) || g.leader}</span>
                    <span className="gd-num gd-r hide-s">{g.pal}/{PALIERS.length}</span>
                    <span className="gd-r"><button className="gd-mini" data-gd-join={g.id} disabled={full} onClick={() => run(() => joinGuildAction(player, g.id), `Bienvenue chez ${g.name} !`)}>{full ? "Pleine" : "Rejoindre"}</button></span>
                  </div>
                );
              })}
              {shown.length === 0 && <div className="gd-empty">Aucune guilde ne porte ce nom.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- aperçu : quêtes, dons, bonus, journal
function Overview({ player, g, run }) {
  const [amount, setAmount] = useState("");
  const bonus = bonusFromPaliers(g.pal);
  const m = player.market;
  const give = (n) => run(() => donateAction(player, n), `${num(n)} or versés à la caisse.`, () => setAmount(""));
  return (
    <>
      <div className="gd-card">
        <div className="gd-h">Quêtes de guilde</div>
        <div className="gd-note">Tout ce que font les membres (monstres vaincus, ressources récoltées, objets fabriqués, or donné) fait avancer les quêtes. Une quête terminée donne de l'xp à la guilde et de l'or à la caisse.</div>
        <div className="gd-quests">
          {g.quests.map((q) => {
            const T = QUEST_TYPES[q.type];
            return (
              <div key={q.id} className="gd-quest" data-gd-quest={q.type}>
                <div className="t">{T.verb} {num(q.goal)} {T.unit}</div>
                <div className="gd-bar thin"><i style={{ width: `${Math.min(100, (q.got / q.goal) * 100)}%` }} /></div>
                <div className="r"><span className="gd-num">{num(q.got)}</span> / {num(q.goal)} · récompense : <b className="gd-num">{num(q.xp)}</b> xp{q.gold ? <>, <b className="gd-gold">{num(q.gold)}</b> or</> : null}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="gd-card">
        <div className="gd-h">Caisse de la guilde</div>
        <div className="gd-note">La caisse paie les paliers de bonus et les onglets du coffre (le chef et le bras droit décident). Chacun peut y verser de l'or ; ça compte aussi pour la quête de dons.</div>
        <div className="gd-line">
          <span>Caisse : <b className="gd-gold" data-gd-treasury>{num(g.gold)}</b> or</span>
          <input className="gd-input num" data-gd-donate-amount value={amount} inputMode="numeric" onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="Montant" aria-label="Montant du don" />
          <button className="gd-btn" data-gd-donate disabled={!(Number(amount) >= 1) || Number(amount) > player.gold} onClick={() => give(Number(amount))}>Donner</button>
          <button className="gd-mini" disabled={player.gold < 100} onClick={() => give(100)}>100</button>
          <button className="gd-mini" disabled={player.gold < 1000} onClick={() => give(1000)}>1 000</button>
          <span className="gd-sub">Tu as {num(player.gold)} or</span>
        </div>
      </div>
      <div className="gd-card">
        <div className="gd-h">Tes bonus de guilde</div>
        <BonusChips bonus={bonus} />
        <div className="gd-sub">Ils s'appliquent à toi, et à tout membre de la guilde. Débloque des paliers pour les augmenter.</div>
      </div>
      <div className="gd-card">
        <div className="gd-h">Journal</div>
        <div className="gd-log">{g.log.length ? g.log.map((l, i) => <div key={i}><small>{ago(m, l.t)}</small>{l.txt}</div>) : <div>Rien pour l'instant.</div>}</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- paliers
function Paliers({ player, g, run, spend }) {
  const np = nextPalier(g), problem = palierProblem(g);
  return (
    <div className="gd-card">
      <div className="gd-h">Paliers de bonus</div>
      <div className="gd-note">Un palier se débloque dans l'ordre : il faut le niveau de guilde requis et payer son prix avec la caisse. {spend ? "Ton rang te permet de les acheter." : "Seuls le chef et le bras droit peuvent les acheter."}</div>
      <div className="gd-paliers">
        {PALIERS.map((p) => {
          const done = g.pal >= p.n, isNext = np?.n === p.n;
          return (
            <div key={p.n} className={`gd-pal${done ? " done" : isNext ? " next" : ""}`} data-gd-pal={p.n} data-state={done ? "done" : isNext ? "next" : "locked"}>
              <div className="n">{p.n}</div>
              <div style={{ minWidth: 0 }}>
                <div className="gd-bonus">{BONUS_KEYS.filter((k) => p.bonus[k]).map((k) => <span key={k} className="gd-chip">{BONUS_ICONS[k]} {BONUS_LABELS[k]} <b>{pct(p.bonus[k])}</b></span>)}</div>
                <div className="gd-sub" style={{ marginTop: 4 }}>Niveau de guilde {p.level} · <span className="gd-gold">{num(p.cost)} or</span></div>
              </div>
              <div className="st">
                {done ? <b style={{ color: "#8fd08a" }}>Débloqué ✓</b> : isNext && spend ? (
                  <button className="gd-btn" data-gd-buy-palier disabled={!!problem} onClick={() => run(() => buyPalierAction(player), `Palier ${p.n} débloqué !`)}>Débloquer</button>
                ) : isNext ? (problem === "niveau" ? `Niveau ${p.level} requis` : problem === "caisse" ? "Caisse insuffisante" : "Prêt") : "Verrouillé"}
                {isNext && spend && problem ? <div style={{ marginTop: 4 }}>{problem === "niveau" ? `Niveau ${p.level} requis` : "Caisse insuffisante"}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- membres
function Members({ player, g, run }) {
  const [confirm, setConfirm] = useState(null);
  const rows = memberRows(player, g);
  const me = rankOf(g, "player");
  return (
    <div className="gd-card">
      <div className="gd-h">Membres <span className="gd-sub">({rows.length}/{GUILD_MAX_MEMBERS})</span></div>
      <div className="gd-note">Rangs : chef, bras droit (un seul), officiers et recrues. Chef et bras droit dépensent la caisse et retirent du coffre ; chacun peut exclure les rangs en dessous du sien (au moins officier) ; le chef nomme tous les rangs, le bras droit nomme les officiers. Les points montrent la part de chacun dans les quêtes.</div>
      <div>
        <div className="gd-mrow" style={{ fontSize: 10, color: "#74748a", textTransform: "uppercase", letterSpacing: ".06em" }}><span>Membre</span><span style={{ textAlign: "right" }}>Niv.</span><span className="hide-s">Rang</span><span style={{ textAlign: "right" }}>Points</span><span /></div>
        {rows.map((r) => {
          const assign = ranksAssignable(g, "player", r.id), kick = canKick(g, "player", r.id);
          return (
            <div key={r.id} className={`gd-mrow${r.you ? " me" : ""}`} data-gd-member={r.id} data-rank={r.rank}>
              <span className="nm">{RANK_ICONS[r.rank] && <span className="gd-crown" title={RANK_LABELS[r.rank]}>{RANK_ICONS[r.rank]}</span>}{r.name}{r.you && <span className="gd-sub"> (toi)</span>}</span>
              <span className="gd-num" style={{ textAlign: "right" }}>{r.level}</span>
              <span className="hide-s" style={{ color: r.rank === "recrue" ? "#74748a" : "#d9b568" }}>{RANK_LABELS[r.rank]}</span>
              <span className="gd-num" style={{ textAlign: "right" }}>{num(r.points)}</span>
              <span style={{ display: "flex", gap: 4, justifyContent: "flex-end", minWidth: 150 }}>
                {confirm?.id === r.id ? (
                  <>
                    <button className="gd-mini danger" onClick={() => { run(() => (confirm.kind === "kick" ? kickAction(player, r.id) : transferAction(player, r.id)), confirm.kind === "kick" ? `${r.name} est exclu.` : `${r.name} est le nouveau chef.`); setConfirm(null); }}>{confirm.kind === "kick" ? "Exclure ?" : "Passer la main ?"}</button>
                    <button className="gd-mini" onClick={() => setConfirm(null)}>Non</button>
                  </>
                ) : (
                  <>
                    {assign.length > 0 && (
                      <select className="gd-input" data-gd-rank={r.id} value="" aria-label={`Rang de ${r.name}`} style={{ padding: "2px 4px", fontSize: 11 }} onChange={(e) => { const v = e.target.value; if (v) run(() => setRankAction(player, r.id, v), `${r.name} : ${RANK_LABELS[v].toLowerCase()}.`); }}>
                        <option value="">Rang…</option>
                        {assign.map((k) => <option key={k} value={k}>{RANK_LABELS[k]}</option>)}
                      </select>
                    )}
                    {me === "chef" && !r.you && <button className="gd-mini" data-gd-promote={r.id} onClick={() => setConfirm({ id: r.id, kind: "lead" })}>Chef</button>}
                    {kick && <button className="gd-mini danger" data-gd-kick={r.id} onClick={() => setConfirm({ id: r.id, kind: "kick" })}>Exclure</button>}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- coffre
function Vault({ player, g, run, spend, wd }) {
  const [tabIx, setTabIx] = useState(0);
  const tab = g.bank[Math.min(tabIx, g.bank.length - 1)], ix = Math.min(tabIx, g.bank.length - 1);
  const nt = nextTab(g), tp = tabProblem(g);
  const used = tabUsed(tab);
  const mine = RESOURCE_ORDER.filter((id) => (player.resources?.[id] || 0) > 0);
  const resIds = Object.keys(tab.res).sort((a, b) => (RESOURCES[a]?.name || a).localeCompare(RESOURCES[b]?.name || b, "fr"));
  return (
    <div className="gd-card" data-gd-vault>
      <div className="gd-h">Coffre de guilde</div>
      <div className="gd-note">Chaque onglet a {TAB_SLOTS} emplacements (un objet ou un type de ressource par emplacement). Tout membre y dépose ; seuls le chef et le bras droit retirent. Les onglets se paient avec la caisse, selon le niveau de la guilde.</div>
      <div className="gd-vtabs">
        {TABS.map((t, i) => {
          const owned = i < g.tabs;
          return (
            <button key={t.n} className={`gd-tab${owned && ix === i ? " on" : ""}`} data-gd-vtab={t.n} disabled={!owned} style={owned ? undefined : { opacity: 0.55, cursor: "default" }} onClick={() => owned && setTabIx(i)} title={owned ? "" : `Niveau de guilde ${t.level}, ${num(t.cost)} or`}>
              {owned ? `Onglet ${t.n}` : `🔒 ${t.n}`}
            </button>
          );
        })}
        {nt && (
          <span className="gd-line" style={{ marginLeft: 8 }}>
            <span className="gd-sub">Prochain onglet : niveau {nt.level} · {num(nt.cost)} or</span>
            {spend && <button className="gd-mini" data-gd-buy-tab disabled={!!tp} onClick={() => run(() => buyTabAction(player), `Onglet ${nt.n} acheté !`)}>Acheter{tp === "niveau" ? " (niveau)" : tp === "caisse" ? " (caisse)" : ""}</button>}
          </span>
        )}
      </div>
      <div className="gd-vault">
        <div>
          <div className="gd-label" style={{ marginBottom: 6 }}>Dans le coffre · <span data-gd-used>{used}</span>/{TAB_SLOTS} emplacements{wd ? "" : " · retrait réservé au chef et au bras droit"}</div>
          <div className="gd-slots" data-gd-slots>
            {resIds.map((id) => (
              <div key={id} className="gd-slot" data-gd-vres={id}>
                <Ico src={RESOURCES[id]?.img} name={RESOURCES[id]?.name} />
                <span className="nm">{RESOURCES[id]?.name || id} <b className="gd-num">×{num(tab.res[id])}</b></span>
                <span className="acts">{wd && (<>
                  <button className="gd-mini" data-gd-withdraw={id} onClick={() => run(() => withdrawAction(player, ix, { kind: "res", id, qty: 1 }))}>1</button>
                  <button className="gd-mini" disabled={tab.res[id] < 10} onClick={() => run(() => withdrawAction(player, ix, { kind: "res", id, qty: 10 }))}>10</button>
                  <button className="gd-mini" onClick={() => run(() => withdrawAction(player, ix, { kind: "res", id, qty: tab.res[id] }))}>Tout</button>
                </>)}</span>
              </div>
            ))}
            {tab.items.map((it) => (
              <div key={it.uid} className="gd-slot" data-gd-vitem={it.uid}>
                <Ico src={it.img} name={it.name} />
                <span className="nm">{it.name}</span>
                <span className="acts">{wd && <button className="gd-mini" onClick={() => run(() => withdrawAction(player, ix, { kind: "item", uid: it.uid }))}>Retirer</button>}</span>
              </div>
            ))}
            {used === 0 && <div className="gd-empty">Cet onglet est vide.</div>}
          </div>
        </div>
        <div>
          <div className="gd-label" style={{ marginBottom: 6 }}>Dans ton sac</div>
          <div className="gd-slots">
            {mine.map((id) => (
              <div key={id} className="gd-slot" data-gd-sres={id}>
                <Ico src={RESOURCES[id]?.img} name={RESOURCES[id]?.name} />
                <span className="nm">{RESOURCES[id]?.name} <b className="gd-num">×{num(player.resources[id])}</b></span>
                <span className="acts">
                  <button className="gd-mini" onClick={() => run(() => depositAction(player, ix, { kind: "res", id, qty: 1 }))}>1</button>
                  <button className="gd-mini" disabled={player.resources[id] < 10} onClick={() => run(() => depositAction(player, ix, { kind: "res", id, qty: 10 }))}>10</button>
                  <button className="gd-mini" data-gd-deposit-all={id} onClick={() => run(() => depositAction(player, ix, { kind: "res", id, qty: player.resources[id] }))}>Tout</button>
                </span>
              </div>
            ))}
            {(player.inventory || []).map((it) => (
              <div key={it.uid} className="gd-slot" data-gd-sitem={it.uid}>
                <Ico src={it.img} name={it.name} />
                <span className="nm">{it.name}</span>
                <span className="acts"><button className="gd-mini" onClick={() => run(() => depositAction(player, ix, { kind: "item", uid: it.uid }))}>Déposer</button></span>
              </div>
            ))}
            {mine.length === 0 && !(player.inventory || []).length && <div className="gd-empty">Ton sac est vide.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ma guilde
function Mine({ player, g, run }) {
  const [tab, setTab] = useState("apercu");
  const [leaving, setLeaving] = useState(false);
  const leader = g.leader === "player", rank = rankOf(g, "player"), spend = canSpend(g, "player"), wd = canWithdraw(g, "player");
  const need = g.level >= GUILD_MAX_LEVEL ? 1 : guildXpToNext(g.level);
  const bonus = bonusFromPaliers(g.pal);
  return (
    <>
      <div className="gd-card">
        <div className="gd-top">
          <div style={{ minWidth: 0, display: "flex", gap: 14, alignItems: "center" }}>
            <Emblem emblem={g.emblem} seed={g.id} size={52} />
            <div style={{ minWidth: 0 }}>
            <div className="gd-title" data-gd-name><span className="gd-tag" style={{ fontSize: 13 }}>[{g.tag}]</span>{g.name}</div>
            <div className="gd-stats" style={{ marginTop: 4 }}>
              <span>Niveau <b data-gd-level>{g.level}</b>/{GUILD_MAX_LEVEL}</span>
              <span>Membres <b>{memberCount(g)}</b>/{GUILD_MAX_MEMBERS}</span>
              <span>Caisse <b>{num(g.gold)}</b> or</span>
              <span>Paliers <b>{g.pal}</b>/{PALIERS.length}</span>
              <span data-gd-myrank={rank}>Ton rang : <b>{RANK_LABELS[rank]}</b></span>
            </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {leaving ? (
              <>
                <span className="gd-sub" style={{ maxWidth: 220 }}>{memberCount(g) === 1 ? "Tu es seul : la guilde disparaît (le coffre te revient)." : leader ? "Le bras droit (sinon le membre le plus actif) devient chef." : "Tu perds les bonus de la guilde."}</span>
                <button className="gd-btn danger" data-gd-leave-confirm onClick={() => { run(() => leaveGuildAction(player), "Tu as quitté la guilde."); setLeaving(false); }}>Quitter</button>
                <button className="gd-btn ghost" onClick={() => setLeaving(false)}>Rester</button>
              </>
            ) : <button className="gd-btn ghost" data-gd-leave onClick={() => setLeaving(true)}>Quitter la guilde</button>}
          </div>
        </div>
        <div>
          <div className="gd-bar"><i style={{ width: g.level >= GUILD_MAX_LEVEL ? "100%" : `${Math.min(100, (g.xp / need) * 100)}%` }} /></div>
          <div className="gd-sub" style={{ marginTop: 3 }}>{g.level >= GUILD_MAX_LEVEL ? "Niveau maximum" : `${num(g.xp)} / ${num(need)} xp de guilde`}</div>
        </div>
        <BonusChips bonus={bonus} />
      </div>
      <div className="gd-tabs">
        {[["apercu", "Aperçu"], ["membres", "Membres"], ["coffre", "Coffre"], ["paliers", "Paliers"], ["sentinelles", "Sentinelles"]].map(([k, label]) => (
          <button key={k} className={`gd-tab${tab === k ? " on" : ""}`} data-gd-tab={k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === "apercu" && <Overview player={player} g={g} run={run} />}
      {tab === "membres" && <Members player={player} g={g} run={run} />}
      {tab === "coffre" && <Vault player={player} g={g} run={run} spend={spend} wd={wd} />}
      {tab === "paliers" && <Paliers player={player} g={g} run={run} spend={spend} />}
      {tab === "sentinelles" && <Sentinels player={player} g={g} run={run} spend={spend} wd={wd} />}
    </>
  );
}

// Guilde : fonder ou rejoindre une guilde, puis ses quêtes, sa caisse, ses membres, son coffre et ses paliers de bonus.
export default function GuildPanel({ player, onPlayerChange }) {
  const [msg, setMsg] = useState(null);
  const g = myGuild(player);
  const run = (act, okText, after) => {
    const r = act();
    if (r.ok) { onPlayerChange(r.player); if (okText) setMsg({ ok: true, text: okText }); else setMsg(null); after?.(); }
    else setMsg({ ok: false, text: REASONS[r.reason] || "Impossible." });
  };
  const ready = !!player.market?.sims;
  return (
    <div className="gd" data-guild>
      <div className="gd-note">Une guilde réunit jusqu'à {GUILD_MAX_MEMBERS} aventuriers (simulés compris) : quêtes communes, caisse, coffre partagé et bonus d'xp, de butin, de récolte, de raffinage et de fabrication.</div>
      <div className="gd-msg" data-gd-msg role="status" aria-live="polite"><span className={msg ? (msg.ok ? "ok" : "ko") : ""} style={{ color: msg ? (msg.ok ? "#8fd08a" : "#e0796a") : undefined }}>{msg?.text || ""}</span></div>
      {!ready ? <div className="gd-empty">Le monde des aventuriers se charge…</div> : g ? <Mine player={player} g={g} run={run} /> : <Browse player={player} run={run} />}
    </div>
  );
}
