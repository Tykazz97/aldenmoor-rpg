import { useState, useMemo } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { boardFor, questsOf, acceptQuest, abandonQuest, completeQuest, progressOf, standingOf, perksOf, questLabel } from "../../utils/quests.js";
import { MAX_ACTIVE_QUESTS, TOWN } from "../../data/quests.js";

const UP = "#8fd08a", DOWN = "#e0796a", GOLD = color.goldBright;
const mini = (on = true) => ({ background: color.panelRaised, color: on ? color.parchment : color.mist, border, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: on ? "pointer" : "not-allowed", fontFamily: font.body, opacity: on ? 1 : 0.5, whiteSpace: "nowrap" });
const head = { fontFamily: font.display, color: GOLD, fontSize: 14 };
const TYPE_ICON = { kill: "⚔️", gather: "🌿", deliver: "📦", craft: "🔨" };

function Rewards({ r, bonus = 0 }) {
  const gold = Math.round(r.gold * (1 + bonus));
  return (
    <span style={{ fontSize: 11, color: color.parchmentDim, fontFamily: font.data }}>
      <span style={{ color: GOLD }}>🪙 {gold}</span> · {r.xp} xp · <span style={{ color: "#9ec5e8" }}>+{r.rep} réputation</span>
    </span>
  );
}

function Bar({ value, max, color: c = UP }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: color.panelRaised, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: "100%", background: c, transition: "width .3s" }} />
    </div>
  );
}

function Standing({ player }) {
  const s = standingOf(player), perks = perksOf(player);
  return (
    <div data-standing style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: color.panel, border, borderRadius: radius.md }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={head}>Réputation à {TOWN.name}</span>
        <span data-title style={{ fontSize: 13, color: "#9ec5e8" }}>{s.title} · niveau {s.level}{s.max ? " (maximum)" : ""}</span>
      </div>
      {!s.max && <><Bar value={s.xp} max={s.next} color="#7fb0d0" /><div style={{ fontSize: 10, color: color.mist }}>{s.xp} / {s.next} pour le niveau suivant</div></>}
      <div style={{ fontSize: 11, color: color.parchmentDim }}>
        Avantages actuels : or des quêtes +{Math.round(perks.goldBonus * 100)} %, coffre +{perks.bankSlots} emplacements.
        <span style={{ color: color.mist }}> Chaque niveau ajoute +3 % d'or, et tous les 2 niveaux +5 emplacements au coffre.</span>
      </div>
    </div>
  );
}

function ActiveRow({ q, player, atBoard, onComplete, onAbandon }) {
  const p = progressOf(player, q), bonus = perksOf(player).goldBonus;
  return (
    <div data-active={q.id} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "8px 12px", background: color.panel, border: `1px solid ${p.done ? UP + "66" : color.line}`, borderRadius: radius.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{TYPE_ICON[q.type]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.parchment }}>{q.title}</div>
          <div style={{ fontSize: 12, color: color.parchmentDim }}>{questLabel(q)}</div>
        </div>
        <div data-progress style={{ fontFamily: font.data, fontSize: 12, color: p.done ? UP : color.parchment }}>{q.type === "craft" ? (p.done ? "Fait" : "À faire") : `${p.have} / ${p.need}`}</div>
      </div>
      <Bar value={p.have} max={p.need} color={p.done ? UP : "#c9a15a"} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Rewards r={q.rewards} bonus={bonus} />
        <span style={{ flex: 1 }} />
        <button data-act="abandon" style={mini(true)} onClick={() => onAbandon(q.id)} title="Abandonner (aucune pénalité)">Abandonner</button>
        {atBoard
          ? <button data-act="complete" style={mini(p.done)} onClick={() => p.done && onComplete(q.id)} title={p.done ? "Rendre la quête" : "Pas encore terminée"}>Rendre</button>
          : p.done && <span style={{ fontSize: 11, color: UP }}>Terminée : rends-la au tableau en ville</span>}
      </div>
    </div>
  );
}

function BoardRow({ q, player, full, onAccept }) {
  const bonus = perksOf(player).goldBonus;
  return (
    <div data-quest={q.id} data-tpl={q.tpl} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: color.panel, border, borderRadius: radius.md }}>
      <span style={{ fontSize: 18 }}>{TYPE_ICON[q.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color.parchment }}>{q.title}{q.chain && <span style={{ marginLeft: 8, fontSize: 10, color: GOLD, border: `1px solid ${GOLD}66`, borderRadius: 4, padding: "1px 5px" }}>Chaîne de la Lisière</span>}</div>
        <div style={{ fontSize: 12, color: color.parchmentDim }}>{questLabel(q)}</div>
        <div style={{ fontSize: 11, color: color.mist, fontStyle: "italic" }}>{q.text}</div>
        <Rewards r={q.rewards} bonus={bonus} />
      </div>
      <button data-act="accept" style={mini(!full)} onClick={() => !full && onAccept(q.id)} title={full ? `Tu as déjà ${MAX_ACTIVE_QUESTS} quêtes en cours` : "Accepter la quête"}>Accepter</button>
    </div>
  );
}

// Quêtes d'Aldenmoor. `atBoard` : au tableau de la ville on accepte et on rend ; dans le Journal on suit et on abandonne.
export default function QuestPanel({ player, onPlayerChange, atBoard = false }) {
  const [msg, setMsg] = useState(null);
  const say = (text, ok = true) => setMsg({ text, ok, id: Date.now() });
  const active = questsOf(player).active;
  const board = useMemo(() => boardFor(player), [player.quests, player.professions]);   // eslint-disable-line react-hooks/exhaustive-deps

  const accept = (id) => {
    const r = acceptQuest(player, id);
    if (!r.ok) return say(r.reason === "limite" ? `Tu as déjà ${MAX_ACTIVE_QUESTS} quêtes en cours.` : "Cette quête n'est plus disponible.", false);
    onPlayerChange(r.player); say(`Quête acceptée : ${r.quest.title}.`);
  };
  const complete = (id) => {
    const r = completeQuest(player, id);
    if (!r.ok) return say("La quête n'est pas terminée.", false);
    onPlayerChange(r.player);
    say(`Quête rendue : ${r.quest.title}. +${r.gold} or, +${r.xp} xp, +${r.rep} réputation.${r.levelUp ? " Tu passes un niveau !" : ""}${r.standingUp ? ` Réputation niveau ${r.standingUp} !` : ""}`);
  };
  const abandon = (id) => { const r = abandonQuest(player, id); if (r.ok) { onPlayerChange(r.player); say("Quête abandonnée."); } };

  const full = active.length >= MAX_ACTIVE_QUESTS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.data, fontSize: 15, color: GOLD }} data-gold>🪙 {player.gold} or</div>
        <div key={msg?.id} style={{ flex: 1, minWidth: 200, fontSize: 12, color: msg?.ok === false ? DOWN : UP, minHeight: 16 }} data-msg>{msg?.text || ""}</div>
      </div>
      <Standing player={player} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={head}>Quêtes en cours ({active.length}/{MAX_ACTIVE_QUESTS})</div>
        {active.map((q) => <ActiveRow key={q.id} q={q} player={player} atBoard={atBoard} onComplete={complete} onAbandon={abandon} />)}
        {active.length === 0 && <div style={{ padding: 12, fontSize: 12, color: color.mist }}>{atBoard ? "Aucune quête en cours : choisis-en dans le tableau ci-dessous." : "Aucune quête en cours. Va au tableau de quêtes, en ville."}</div>}
      </div>

      {atBoard && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={head}>Tableau du jour <span style={{ fontFamily: font.body, fontSize: 11, color: color.mist }}>· il change chaque jour à minuit</span></div>
          {board.map((q) => <BoardRow key={q.id} q={q} player={player} full={full} onAccept={accept} />)}
          {board.length === 0 && <div style={{ padding: 12, fontSize: 12, color: color.mist }}>Plus rien au tableau aujourd'hui. Reviens demain.</div>}
        </div>
      )}
    </div>
  );
}
