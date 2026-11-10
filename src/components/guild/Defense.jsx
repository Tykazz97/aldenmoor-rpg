import { useEffect, useState } from "react";
import { SENT_BY_KEY } from "../../data/sentinel.js";
import { CLASSES } from "../../data/classes.js";
import { STEP_MS } from "../../sim/lives.js";
import { getLivePopulation } from "../../sim/simWorld.js";
import { sentinelsOf } from "../../utils/sentinel.js";
import { defenderBots, DEFENDERS_MAX } from "../../utils/sentinelDefense.js";
import { defenseAllies, defenseEncounter, SENT_ROUNDS } from "../../utils/sentinelFight.js";
import { guildsOf, startDefenseAction } from "../../utils/guildActions.js";

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`; };

// Onglet « Défense » : les attaques en cours contre les sentinelles de ma guilde, avec le temps qui reste, et les défenseurs connectés.
// Je peux prendre la défense en main (un vrai combat : ma sentinelle et deux membres connectés à mes côtés) ; sinon la sentinelle se défend seule
// avec les membres connectés quand le compte à rebours tombe à zéro.
export default function Defense({ player, g, run, onDefend }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const G = guildsOf(player), pop = getLivePopulation(player), byId = new Map(pop.map((b) => [b.id, b]));
  const attacks = g.attacks || [], hasSent = Object.keys(sentinelsOf(g)).length > 0;
  const online = hasSent ? defenderBots(g, pop, now) : [];
  const history = g.log.filter((l) => /entinelle/.test(l.txt)).slice(0, 6);
  const defend = (a) => {
    run(() => startDefenseAction(player, a.id, now), null, () => {
      const attackers = a.by.map((id) => byId.get(id)).filter(Boolean);
      const from = G?.byId[a.from]?.name || "une guilde";
      onDefend({ attack: a, encounter: defenseEncounter(g, a, attackers, from), allies: defenseAllies(g, pop, a.by, now) });
    });
  };
  return (
    <div className="gd-card" data-gd-defense>
      <div className="gd-sub">Des guildes de simulés attaquent de temps en temps les sentinelles des autres. Tu es prévenu par une alerte avec un compte à rebours de 3 minutes : pour la défendre toi-même, tu combats avec ta sentinelle et jusqu'à {DEFENDERS_MAX - 1} membres connectés contre 1 à 3 attaquants. Tu gagnes si la sentinelle tient {SENT_ROUNDS} tours ou si tous les attaquants tombent ; si elle tombe, son stock est perdu. Sans toi, les membres connectés la défendent à ta place.</div>
      {!hasSent && <div className="gd-sub" data-gd-def-none>Ta guilde n'a aucune sentinelle à défendre. Pose-en une dans l'onglet « Sentinelles ».</div>}
      {hasSent && !attacks.length && <div className="gd-sub" data-gd-def-none>Aucune attaque en cours. Si des guildes se montrent, l'alerte apparaîtra ici (et en haut de l'écran).</div>}
      {attacks.map((a) => {
        const r = SENT_BY_KEY[a.region], left = (a.dueMs ?? a.due * STEP_MS) - now, held = a.hold > Math.floor(now / STEP_MS);
        const rows = a.by.map((id) => byId.get(id)).filter(Boolean);
        return (
          <div key={a.id} className="gd-list-row" data-gd-attack={a.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 4px" }}>
            <div style={{ fontWeight: 700, color: "#e0796a" }}>Ta sentinelle de {r?.name} est attaquée par {G?.byId[a.from]?.name || "une guilde"} !</div>
            <div className="gd-sub">{rows.map((b) => `${b.name} (${CLASSES[b.classKey]?.name || b.classKey}, niv. ${b.level})`).join(" · ") || "Attaquants inconnus"}</div>
            <div className="gd-stats"><span>{held ? <b>Défense en cours</b> : left > 0 ? <>Dans <b data-gd-def-timer>{mmss(left)}</b></> : <b>Le combat se règle…</b>}</span></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="gd-btn" data-gd-defend={a.id} disabled={held} onClick={() => defend(a)}>Défendre</button>
            </div>
          </div>
        );
      })}
      {hasSent && (
        <div className="gd-sub" data-gd-def-online style={{ marginTop: 8 }}>
          Défenseurs connectés en ce moment : {online.length ? online.map((b) => `${b.name} (niv. ${b.level})`).join(" · ") : "personne"}.
        </div>
      )}
      {!!history.length && <div className="gd-log" style={{ marginTop: 8 }}>{history.map((l, i) => <div key={i}>{l.txt}</div>)}</div>}
    </div>
  );
}
