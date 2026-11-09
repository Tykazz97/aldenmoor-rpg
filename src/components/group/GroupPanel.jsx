import React, { useState, useMemo, useEffect } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { CLASSES } from "../../data/classes.js";
import { heroLook, heroSpriteUrl } from "../../data/heroSprites.js";
import { groupOf, groupCandidates, inviteAction, kickAction, GROUP_MAX, GROUP_REASONS, GROUP_LEVEL_WINDOW } from "../../utils/group.js";

// Le groupe permanent : toi + jusqu'à 2 joueurs connectés (ceux de ta guilde en premier). Ils combattent avec toi, gagnent leur xp et leur butin.
export default function GroupPanel({ player, stats, onPlayerChange }) {
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 20000); return () => clearInterval(id); }, []);
  const now = Date.now();
  const { members } = useMemo(() => groupOf(player, now), [player.companions, player.market?.sims, tick]); // eslint-disable-line
  const cands = useMemo(() => groupCandidates(player, now), [player.companions, player.level, player.market?.sims, tick]); // eslint-disable-line
  const full = members.length >= GROUP_MAX;
  const guilds = player.market?.sims?.guilds;
  const tagOf = (b) => { const g = guilds?.byId?.[guilds?.of?.[b.id]]; return g ? g.tag : null; };

  const act = (fn) => onPlayerChange((p) => { const r = fn(p); if (!r.ok) setTimeout(() => setMsg(GROUP_REASONS[r.reason] || ""), 0); else setTimeout(() => setMsg(""), 0); return r.ok ? r.player : p; });
  const invite = (id) => act((p) => inviteAction(p, id));
  const kick = (id) => act((p) => kickAction(p, id));

  const card = { background: color.panel, border, borderRadius: radius.md, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 };
  const Slot = ({ b }) => b ? (
    <div data-group-member={b.id} style={card}>
      <img src={heroSpriteUrl(b.look)} alt="" style={{ width: 40, height: 40, objectFit: "contain", imageRendering: "pixelated" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: color.parchment }}>{tagOf(b) && <span style={{ fontFamily: font.data, fontSize: 11, color: color.gold, marginRight: 6 }}>[{tagOf(b)}]</span>}{b.name}</div>
        <div style={{ fontSize: 11, color: color.mist }}>{CLASSES[b.classKey]?.label} · niv. {b.level} · <span style={{ color: "#6fcf97" }}>connecté</span></div>
      </div>
      <button data-group-kick={b.id} className="cb-btn" onClick={() => kick(b.id)}>Exclure</button>
    </div>
  ) : (
    <div data-group-empty style={{ ...card, borderStyle: "dashed", color: color.mist, fontSize: 12 }}>Place libre — invite un joueur connecté ci-dessous.</div>
  );

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto", boxSizing: "border-box" }}>
      <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 6 }}>Groupe</div>
      <div style={{ fontSize: 12, color: color.mist, marginBottom: 14, maxWidth: 640 }}>
        Tu peux jouer avec jusqu'à {GROUP_MAX} autres joueurs connectés. Le groupe reste formé entre les combats ; un joueur qui se déconnecte le quitte.
        Chacun gagne <b>son propre xp, son or et son butin</b> à chaque victoire — rien n'est retiré de tes gains — et le butin est meilleur en groupe (jusqu'à ×1,5).
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
        <div style={card}>
          <img src={heroSpriteUrl(heroLook(player, stats))} alt="" style={{ width: 40, height: 40, objectFit: "contain", imageRendering: "pixelated" }} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: color.goldBright }}>{player.name || "Toi"} <span style={{ fontSize: 10, color: color.mist }}>(toi)</span></div>
            <div style={{ fontSize: 11, color: color.mist }}>{CLASSES[player.classKey]?.label} · niv. {player.level}</div></div>
        </div>
        {Array.from({ length: GROUP_MAX }, (_, i) => <Slot key={i} b={members[i]} />)}
      </div>
      {msg && <div data-group-msg style={{ marginTop: 10, fontSize: 12, color: "#e8a07a" }}>{msg}</div>}

      <div style={{ fontFamily: font.display, fontSize: 16, color: color.goldBright, margin: "20px 0 4px" }}>Joueurs connectés</div>
      <div style={{ fontSize: 11, color: color.mist, marginBottom: 8 }}>Ta guilde d'abord, puis les plus proches de ton niveau (écart de {GROUP_LEVEL_WINDOW} niveaux au maximum).</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 640 }}>
        {cands.length === 0 && <div style={{ fontSize: 12, color: color.mist }}>Personne n'est connecté pour le moment.</div>}
        {cands.map(({ bot, guild, ok }) => (
          <div key={bot.id} data-group-cand={bot.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 10px", background: color.panelRaised, border, borderRadius: radius.sm || 6, opacity: ok ? 1 : 0.55 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: color.parchment }}>
              {tagOf(bot) && <span style={{ fontFamily: font.data, fontSize: 10.5, color: guild ? color.goldBright : color.gold, marginRight: 6 }}>[{tagOf(bot)}]</span>}
              {bot.name} <span style={{ fontSize: 11, color: color.mist }}>{CLASSES[bot.classKey]?.label} · niv. {bot.level}{guild ? " · ta guilde" : ""}</span>
            </div>
            <button data-group-invite={bot.id} className="cb-btn" disabled={!ok || full} title={!ok ? GROUP_REASONS.ecart_niveau : full ? GROUP_REASONS.groupe_plein : ""} onClick={() => invite(bot.id)}>Inviter</button>
          </div>
        ))}
      </div>
    </div>
  );
}
