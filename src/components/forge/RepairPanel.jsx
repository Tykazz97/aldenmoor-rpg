import React, { useState } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { wornPieces, repairCost, repairAllCost, wearOf, wearLabel, WEAR_MAX_MALUS } from "../../utils/durability.js";

const btn = (on) => ({ padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: radius.sm, background: on ? color.gold : color.panelRaised, color: on ? color.void : color.mist, border: `1px solid ${on ? color.goldBright : color.line}`, cursor: on ? "pointer" : "not-allowed" });

// Réparations de l'équipement (utils/durability.js) : dans l'atelier de la ville, taxe de la ville comprise
export default function RepairPanel({ player, city, onRepair }) {
  const fx = { rate: city.rate, city: city.key };
  const [msg, setMsg] = useState(null);
  const pieces = wornPieces(player);
  const total = repairAllCost(player, fx);

  const run = (ref) => {
    const r = onRepair(ref, fx);
    setMsg(r.ok ? `Réparé pour ${r.cost} or` : r.reason || null);
  };

  return (
    <div data-repair style={{ margin: "8px 12px 0", padding: "8px 10px", background: color.void, border, borderRadius: radius.sm, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Réparations</span>
        {pieces.length > 0 && (
          <button data-repair-all disabled={player.gold < 1} onClick={() => run("all")} style={btn(player.gold >= 1)}>
            Tout réparer · <span style={{ fontFamily: font.data }}>{total}</span> or
          </button>
        )}
      </div>
      {pieces.length === 0 ? (
        <div style={{ fontSize: 12, color: color.mist }}>Tout ton équipement est en bon état. Il s'use quand un combat est perdu ou gagné de justesse (jusqu'à −{Math.round(WEAR_MAX_MALUS * 100)} % de bonus).</div>
      ) : pieces.map(({ slot, item }) => {
        const c = repairCost(item, player, fx);
        return (
          <div key={slot || item.uid} data-repair-row style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: color.parchmentDim, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 150 }}>{item.name}{!slot && <span style={{ color: color.mist }}> (dans le sac)</span>}</span>
            <span style={{ color: wearOf(item) >= 60 ? color.blood : color.gold }}>{wearLabel(wearOf(item))} · {Math.round(wearOf(item))} %</span>
            <button data-repair-one disabled={player.gold < c.total} onClick={() => run(slot || item.uid)} style={btn(player.gold >= c.total)}
              title={`${c.base} or de main-d'œuvre + ${c.tax} or de taxe de ${city.name}`}>
              Réparer · <span style={{ fontFamily: font.data }}>{c.total}</span> or
            </button>
          </div>
        );
      })}
      {msg && <div style={{ fontSize: 11, color: color.mist }}>{msg}</div>}
    </div>
  );
}
