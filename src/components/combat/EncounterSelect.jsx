import React from "react";
import { PA_MAX } from "../../combat/engine.js";
import { buildSpellBar } from "../../utils/spellbook.js";
import { ENEMIES } from "../../data/zones.js";
import { ENCOUNTERS } from "../../data/encounters.js";
import { WEAPON_TYPES } from "../../data/weapons.js";
import { color, font } from "../../styles/theme.js";

// Sélection de la rencontre (liste des adversaires + fiche du héros)
export default function EncounterSelect({ player, stats, weaponType, heroSrc, onPick }) {
  const spells = buildSpellBar(player);
  const weapon = player.equipped.arme;
  return (
    <div className="cb-select">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 4 }}>
        <div>
          <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright, letterSpacing: "0.04em" }}>Prairies Sauvages</div>
          <div style={{ fontSize: 12, color: color.mist, marginTop: 2 }}>Choisis ton adversaire. Perdre ne coûte rien : tu peux toujours recommencer.</div>
        </div>
        {ENCOUNTERS.map((enc) => (
          <button key={enc.id} className={`cb-enc ${enc.boss ? "boss" : ""}`} onClick={() => onPick(enc)}>
            <div className="thumbs">
              {enc.enemies.map((k, i) => <img key={i} src={ENEMIES[k].img} alt="" style={{ height: `${Math.min(100, (ENEMIES[k].spriteHeight / 290) * 100 + 18)}%` }} />)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {enc.name}<span className={`cb-tag ${enc.boss ? "boss" : ""}`}>{enc.level}</span>
              </div>
              <div style={{ fontSize: 12, color: color.parchmentDim, marginTop: 3 }}>{enc.desc}</div>
            </div>
            <div style={{ color: color.gold, fontSize: 20 }}>⚔</div>
          </button>
        ))}
      </div>

      <div style={{ background: color.panel, border: "1px solid #2a2a3d", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", height: 190, background: "radial-gradient(ellipse at 50% 90%, rgba(255,160,80,.18), transparent 70%)", borderRadius: 10 }}>
          <img src={heroSrc} alt="Héros" style={{ height: 180, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.6))" }} />
        </div>
        <div style={{ textAlign: "center", fontFamily: font.display, color: color.goldBright }}>{player.name} · Niveau {player.level}</div>
        <div style={{ fontSize: 12, color: color.mist, textAlign: "center" }}>
          {weapon ? <>Arme : <span style={{ color: color.parchment }}>{weapon.name}</span> ({WEAPON_TYPES[weaponType]?.style})</> : "À mains nues — équipe une arme dans l'onglet Personnage !"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11, textAlign: "center" }}>
          <Mini label="PV" value={stats.maxHp} c="#c0392b" />
          <Mini label="Initiative" value={stats.vitesse} c={color.frost} />
          <Mini label="PA" value={PA_MAX} c={color.goldBright} />
          <Mini label="ATK Phys" value={stats.atkPhys} c={color.phys} />
          <Mini label="ATK Mag" value={stats.atkMagie} c={color.mag} />
          <Mini label="Esquive" value={`${Math.round(stats.esquive)}%`} c={color.success} />
        </div>
        <div style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".08em" }}>Sorts disponibles</div>
        {spells.map((sp) => (
          <div key={sp.id} style={{ fontSize: 12, color: color.parchmentDim, borderLeft: `3px solid ${sp.type === "mag" ? color.mag : sp.type === "buff" ? color.frost : color.phys}`, paddingLeft: 8 }}>
            <span style={{ color: color.parchment, fontWeight: 600 }}>{sp.name}</span> <span style={{ color: color.gold }}>· {sp.pa} PA</span>{sp.rank > 1 && <span style={{ color: color.goldBright }}> · rang {sp.rank}</span>}
            <div style={{ fontSize: 11 }}>{sp.desc}</div>
          </div>
        ))}
        {stats.setBonuses.length > 0 && (
          <div style={{ fontSize: 11, color: color.mist }}>
            {stats.setBonuses.map((b) => <div key={b.set.key} style={{ color: b.set.color }}>{b.set.name} ({b.count}/5) — {b.bonus.desc}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

const Mini = ({ label, value, c }) => (
  <div style={{ background: "#0a0a0f", border: "1px solid #2a2a3d", borderRadius: 8, padding: "5px 2px" }}>
    <div style={{ color: "#74748a", fontSize: 10 }}>{label}</div>
    <div style={{ color: c, fontFamily: font.data, fontSize: 14 }}>{value}</div>
  </div>
);
