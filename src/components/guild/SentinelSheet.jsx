import React from "react";
import { SENT_STATS, SENT_SPELLS, SENT_MAX_SPELLS, SENT_STAT_CAP } from "../../data/sentinel.js";
import { totalPoints, freePoints, ptsOf, equippedIds, resetCost, lootMult } from "../../utils/sentinelBuild.js";
import { sentinelStats } from "../../utils/sentinelFight.js";
import { setSentinelPointsAction, resetSentinelPointsAction, setSentinelSpellsAction } from "../../utils/guildActions.js";

const num = (n) => Math.round(n).toLocaleString("fr-FR");

// La fiche de la sentinelle de la guilde : points de caractéristiques (3 par niveau de guilde) et sorts équipés (3 au plus)
export default function SentinelSheet({ player, g, run, spend }) {
  const pts = ptsOf(g), free = freePoints(g), total = totalPoints(g.level), cap = Math.ceil(total * SENT_STAT_CAP);
  const stats = sentinelStats(g), eq = equippedIds(g), cost = resetCost(g);
  const hint = {
    vitalite: `${num(stats.hp)} PV`, force: `Attaque ${num(stats.atkPhys)}`, defense: `Défense ${num(stats.defPhys)}`,
    vitesse: `Initiative ${num(stats.vitesse)}`, chance: `Butin ×${lootMult(g).toFixed(2)}`,
  };
  const change = (k, d) => run(() => setSentinelPointsAction(player, { ...pts, [k]: Math.max(0, pts[k] + d) }));
  const toggle = (id) => run(() => setSentinelSpellsAction(player, eq.includes(id) ? eq.filter((x) => x !== id) : [...eq, id]));
  return (
    <div className="gd-card" data-gd-sentsheet>
      <div className="gd-h">Fiche de la sentinelle</div>
      <div className="gd-sub">Comme un joueur : chaque niveau de guilde donne {3} points de caractéristiques à répartir (une caractéristique ne peut recevoir plus de {Math.round(SENT_STAT_CAP * 100)} % du total). Ce qui n'est pas placé la laisse plus faible. Valable pour toutes les sentinelles de la guilde.</div>
      <div className="gd-stats"><span>Points libres <b data-gd-sent-free>{free}</b> / {total}</span>
        {spend && <button className="gd-mini danger" data-gd-sent-reset disabled={free === total || g.gold < cost} title={g.gold < cost ? "La caisse ne suffit pas" : ""} onClick={() => run(() => resetSentinelPointsAction(player), "Points remis à zéro.")}>Tout remettre à zéro ({num(cost)} or)</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {SENT_STATS.map((s) => (
          <div key={s.key} className="gd-list-row" data-gd-sent-stat={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px" }}>
            <div style={{ flex: 1, minWidth: 0 }}><b>{s.label}</b> <span className="gd-sub">· {s.desc}</span><div className="gd-sub" style={{ color: "#a89f8c" }}>{hint[s.key]}</div></div>
            {spend && <button className="gd-mini" disabled={pts[s.key] < 1} onClick={() => change(s.key, -1)}>−</button>}
            <b className="gd-num" style={{ minWidth: 26, textAlign: "center" }} data-gd-sent-pts={s.key}>{pts[s.key]}</b>
            {spend && <><button className="gd-mini" data-gd-sent-plus={s.key} disabled={free < 1 || pts[s.key] >= cap} onClick={() => change(s.key, 1)}>+</button>
              <button className="gd-mini" disabled={free < 1 || pts[s.key] >= cap} onClick={() => run(() => setSentinelPointsAction(player, { ...pts, [s.key]: Math.min(cap, pts[s.key] + free) }))}>max</button></>}
          </div>
        ))}
      </div>
      <div className="gd-h" style={{ marginTop: 6 }}>Sorts <span className="gd-sub">({eq.length}/{SENT_MAX_SPELLS} équipés · un nouveau sort tous les 5 niveaux de guilde)</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {SENT_SPELLS.map((sp) => {
          const open = sp.level <= g.level, on = eq.includes(sp.id);
          return (
            <div key={sp.id} className="gd-list-row" data-gd-sent-spell={sp.id} data-state={!open ? "locked" : on ? "on" : "off"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px", opacity: open ? 1 : 0.45 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{sp.name}</b> <span className="gd-sub">· {sp.pa} PA · {sp.self ? "soutien" : sp.aoe ? "zone" : sp.type === "mag" ? "magique" : "physique"}</span>
                <div className="gd-sub">{sp.desc}</div>
              </div>
              {open ? (spend ? <button className="gd-mini" data-gd-sent-equip={sp.id} disabled={!on && eq.length >= SENT_MAX_SPELLS} onClick={() => toggle(sp.id)}>{on ? "Équipé ✓" : "Équiper"}</button> : <span className="gd-sub">{on ? "Équipé" : ""}</span>) : <span className="gd-sub">Niveau {sp.level}</span>}
            </div>
          );
        })}
      </div>
      {spend && <div className="gd-sub">Si tu n'en équipes aucun, la sentinelle prend d'elle-même ses {SENT_MAX_SPELLS} sorts les plus récents.</div>}
    </div>
  );
}
