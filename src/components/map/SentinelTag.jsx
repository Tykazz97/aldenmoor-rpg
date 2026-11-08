import React, { useMemo } from "react";
import { sentinelOwner, sentinelsOf } from "../../utils/sentinel.js";
import { attackCheck, guildsOf } from "../../utils/guildActions.js";
import { SENT_ROUNDS } from "../../utils/sentinelFight.js";
import Emblem from "../guild/Emblem.jsx";
import { defenderBots } from "../../utils/sentinelDefense.js";
import { getLivePopulation } from "../../sim/simWorld.js";

// Plaque de la sentinelle de la région (s'il y en a une) : à qui elle est, et de quoi l'attaquer
export default function SentinelTag({ player, region, now, onAttack }) {
  const G = guildsOf(player);
  const owner = G && region ? sentinelOwner(G, region) : null;
  const minute = Math.floor(now / 60000);
  const defenders = useMemo(() => (owner ? defenderBots(owner, getLivePopulation(player), now) : []), [owner?.id, owner?.level, minute]); // eslint-disable-line
  const s = owner && sentinelsOf(owner)[region];
  if (!s) return null;
  const why = attackCheck(player, region, now);
  const minutes = s.shield > now ? Math.ceil((s.shield - now) / 60000) : 0;
  const mine = why === "sienne";
  const lv = defenders.map((b) => b.level), range = lv.length ? (Math.min(...lv) === Math.max(...lv) ? `niv. ${lv[0]}` : `niv. ${Math.min(...lv)} à ${Math.max(...lv)}`) : "";
  const defs = defenders.length ? ` ${defenders.length} défenseur${defenders.length > 1 ? "s" : ""} en ligne (${range}).` : " Personne ne la défend.";
  return (
    <div data-map-sentinel={region} style={{ position: "absolute", top: 10, left: 10, zIndex: 1100, display: "flex", gap: 10, alignItems: "center", padding: "7px 12px", borderRadius: 10, background: "rgba(10,8,18,.88)", border: "1px solid #b8923f", color: "#f3dca0", font: "600 12px 'Inter', sans-serif", maxWidth: "calc(100% - 20px)" }}>
      <Emblem emblem={owner.emblem} seed={owner.id} size={26} />
      <div style={{ minWidth: 0 }}>
        <div>Sentinelle de {owner.name}{mine ? " (ta guilde)" : ""}</div>
        <div style={{ fontWeight: 400, color: "#a89f8c", fontSize: 11 }}>
          {mine ? "Elle prend sa part du butin des combats de la région." : minutes ? `Elle a tenu bon : protégée encore ${minutes} min.` : `Tue-la avant la fin du ${SENT_ROUNDS}e tour pour prendre son stock.${defs}`}
        </div>
      </div>
      {!mine && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button data-sentinel-attack="solo" disabled={!!why} onClick={() => onAttack(false)} style={btn(!!why)}>⚔ Seul</button>
          <button data-sentinel-attack="group" disabled={!!why} onClick={() => onAttack(true)} style={btn(!!why)}>⚔ En groupe</button>
        </div>
      )}
    </div>
  );
}
const btn = (off) => ({ background: off ? "#2a2a3d" : "#b8923f", color: off ? "#74748a" : "#0a0a0f", border: 0, borderRadius: 7, padding: "6px 10px", fontWeight: 700, fontSize: 12, cursor: off ? "not-allowed" : "pointer", whiteSpace: "nowrap" });
