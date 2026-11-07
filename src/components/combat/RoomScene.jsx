import React from "react";
import { ENEMIES } from "../../data/zones.js";
import { ALCHEMY } from "../../data/alchemy.js";
import { RESOURCES } from "../../data/resources.js";
import { POTION_IDS, potionCount, canDrink } from "../../utils/potions.js";

// ------------------------------------------------------------
// L'arrivée dans une salle du donjon : le décor, ton groupe à gauche, le groupe de monstres de la salle à droite.
// Avant de lancer le combat, on peut boire des potions à volonté (elles sortent du sac, rien d'autre à payer).
// `party` : [{ name, src, hp, maxHp }] (toi en premier) ; `onDrink(index, potionId)` ; `onFight()` ; `onLeave()`.
// ------------------------------------------------------------
const pct = (h) => Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100));
const hpColor = (h) => (h.hp <= 0 ? "#6b6b7a" : pct(h) > 50 ? "#5c9c5c" : pct(h) > 25 ? "#c9a13f" : "#b5483f");
const potionHint = (id) => { const r = ALCHEMY[id]; return r.heal ? `rend ${Math.round(r.heal * 100)} % des PV` : `relève un héros tombé à ${Math.round(r.revive * 100)} %`; };

export default function RoomScene({ dungeon, index, player, party, onDrink, onFight, onLeave }) {
  const room = dungeon.rooms[index];
  const owned = POTION_IDS.filter((id) => potionCount(player, id) > 0);
  return (
    <div data-room-scene={room.id} style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div style={{ position: "relative", flex: 1, minHeight: 260, borderRadius: 12, overflow: "hidden", border: "1px solid #3a3a52", backgroundColor: "#0b0b12" }}>
        <div className="cb-room-bg" style={{ backgroundImage: `url(${room.bg})` }} />
        <div className="cb-room-shade" />
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", textShadow: "0 2px 8px #000" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9b98a" }}>{dungeon.name} · salle {index + 1}/{dungeon.rooms.length}{room.boss ? " · Boss" : ""}</div>
          <div style={{ fontSize: 24, color: "#f3dca0", fontFamily: "'Cinzel', serif" }}>{room.name}</div>
          <div style={{ fontSize: 13, color: "#d9d0bd", fontStyle: "italic", maxWidth: 560, margin: "2px auto 0" }}>{room.desc}</div>
        </div>
        {/* ton groupe */}
        <div style={{ position: "absolute", left: "4%", bottom: "6%", display: "flex", alignItems: "flex-end", gap: 6 }}>
          {party.map((h, i) => (
            <img key={i} src={h.src} alt={h.name} draggable={false} style={{ height: i === 0 ? 190 : 165, objectFit: "contain", opacity: h.hp <= 0 ? 0.45 : 1, filter: "drop-shadow(0 6px 6px #000a)", transform: h.hp <= 0 ? "rotate(-8deg)" : "none" }} />
          ))}
        </div>
        {/* les monstres de la salle */}
        <div data-room-enemies style={{ position: "absolute", right: "4%", bottom: "6%", display: "flex", alignItems: "flex-end", gap: 4 }}>
          {room.enemies.map((k, i) => (
            <div key={i} title={ENEMIES[k].name} style={{ textAlign: "center" }}>
              <img src={`/assets/combat/enemies/${k}.png`} alt={ENEMIES[k].name} draggable={false} style={{ height: ENEMIES[k].miniBoss || room.boss && i === 0 ? 230 : 175, objectFit: "contain", filter: "drop-shadow(0 6px 6px #000a)" }} />
              <div style={{ fontSize: 11, color: "#e6dcc3", textShadow: "0 1px 4px #000" }}>{ENEMIES[k].name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PV du groupe + potions */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${party.length}, minmax(0, 1fr))`, gap: 10 }}>
        {party.map((h, i) => (
          <div key={i} data-room-hero={i} style={{ background: "#14141f", border: "1px solid #3a3a52", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e6dcc3" }}>
              <span>{h.name}</span>
              <span data-room-hp style={{ fontFamily: "monospace", color: h.hp <= 0 ? "#d98a8a" : "#d9d0bd" }}>{h.hp <= 0 ? "Tombé" : `${h.hp} / ${h.maxHp}`}</span>
            </div>
            <div style={{ height: 7, background: "#0b0b12", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct(h)}%`, height: "100%", background: hpColor(h), transition: "width .25s" }} /></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minHeight: 30 }}>
              {owned.map((id) => {
                const ok = canDrink(player, h, id);
                return (
                  <button key={id} data-drink={`${i}:${id}`} disabled={!ok} onClick={() => onDrink(i, id)} title={`${RESOURCES[id].name} : ${potionHint(id)}`}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px 2px 3px", borderRadius: 999, background: "#1c1c2b", border: `1px solid ${ok ? "#b8923f" : "#2e2e44"}`, color: ok ? "#f3dca0" : "#6b6b7a", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.55 }}>
                    <img src={RESOURCES[id].img} alt="" width="22" height="22" style={{ objectFit: "contain" }} />
                    <span style={{ fontSize: 11, fontFamily: "monospace" }}>×{potionCount(player, id)}</span>
                  </button>
                );
              })}
              {!owned.length && i === 0 && <span style={{ fontSize: 11, color: "#8a8aa0" }}>Aucune potion dans ton sac : l'Alchimiste peut en distiller à l'atelier.</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="cb-btn" onClick={onLeave}>Sortir du manoir</button>
        <button data-room-fight className="cb-btn primary" onClick={onFight}>{room.boss ? `Affronter ${ENEMIES[room.enemies[0]].name}` : "Lancer le combat"}</button>
      </div>
    </div>
  );
}
