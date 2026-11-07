import React, { useState } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { CLASSES, CLASS_ORDER } from "../../data/classes.js";
import { ITEMS } from "../../data/items.js";
import { WEAPON_TYPES } from "../../data/weapons.js";
import { CARACS } from "../../data/caracs.js";
import { BODIES, heroSpriteUrl } from "../../data/heroSprites.js";

const sectionTitle = { fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 };

export default function CharacterCreator({ onCreate, onImport }) {
  const [name, setName] = useState("");
  const [classKey, setClassKey] = useState("guerrier");
  const [gender, setGender] = useState("m");
  const [testMode, setTestMode] = useState(false);
  const cls = CLASSES[classKey];
  const weapon = ITEMS[cls.startWeapon];
  const weaponSpell = WEAPON_TYPES[weapon.weaponType].spell;
  const first = cls.spells.filter((s) => s.level === 1);
  const later = cls.spells.filter((s) => s.level > 1);
  const look = `${gender}/${cls.outfit}`;

  return (
    <div style={{ minHeight: "100%", height: "100vh", background: `radial-gradient(ellipse at 50% 0%, #1d1b2e, ${color.void} 70%)`, color: color.parchment, fontFamily: font.body, overflowY: "auto", display: "flex", justifyContent: "center", padding: "28px 20px" }}>
      <div style={{ width: "min(1080px, 100%)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: font.display, fontSize: 34, color: color.goldBright, letterSpacing: ".12em" }}>ALDENMOOR</div>
          <div style={{ fontSize: 13, color: color.mist }}>Crée ton personnage</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(300px, 1.3fr) minmax(260px, 1fr)", gap: 18, alignItems: "start" }}>
          {/* Colonne 1 : identité + classe */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionTitle}>Nom</div>
              <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Héros"
                style={{ width: "100%", boxSizing: "border-box", background: color.void, border, borderRadius: radius.md || 8, color: color.parchment, padding: "10px 12px", fontSize: 15, fontFamily: font.body }} />
            </div>
            <div>
              <div style={sectionTitle}>Corps</div>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(BODIES).map(([k, label]) => (
                  <button key={k} onClick={() => setGender(k)} style={pill(gender === k)}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={sectionTitle}>Classe</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CLASS_ORDER.map((k) => {
                  const c = CLASSES[k];
                  const on = k === classKey;
                  return (
                    <button key={k} onClick={() => setClassKey(k)} style={{
                      textAlign: "left", cursor: "pointer", background: on ? color.panelRaised : color.panel, color: color.parchment,
                      border: `1px solid ${on ? color.gold : color.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", fontFamily: font.body,
                    }}>
                      <span style={{ fontSize: 24 }}>{c.icon}</span>
                      <span>
                        <span style={{ display: "block", fontFamily: font.display, color: on ? color.goldBright : color.parchment, fontSize: 16 }}>{c.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: color.parchmentDim }}>{c.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Colonne 2 : aperçu */}
          <div style={{ background: color.panel, border, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: "100%", height: 330, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "radial-gradient(ellipse at 50% 92%, rgba(255,160,80,.22), transparent 70%)", borderRadius: 10 }}>
              <img src={heroSpriteUrl(look)} alt="Aperçu du personnage" style={{ height: 310, filter: "drop-shadow(0 8px 8px rgba(0,0,0,.65))" }} draggable={false} />
            </div>
            <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright }}>{name.trim() || "Héros"}</div>
            <div style={{ fontSize: 12, color: color.mist }}>{cls.label} · {BODIES[gender]}</div>
          </div>

          {/* Colonne 3 : kit de départ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={sectionTitle}>Départ</div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: color.parchment }}>{weapon.name}</span>
                <span style={{ color: color.parchmentDim }}> · {WEAPON_TYPES[weapon.weaponType].label}</span>
              </div>
              <div style={{ fontSize: 12, color: color.parchmentDim, marginTop: 4 }}>
                {Object.entries(cls.startCaracs).map(([k, v]) => `${CARACS[k].label} +${v}`).join(" · ")}
              </div>
            </div>
            <div>
              <div style={sectionTitle}>Sorts au niveau 1</div>
              <SpellLine sp={weaponSpell} tag="arme" />
              {first.map((sp) => <SpellLine key={sp.id} sp={sp} />)}
            </div>
            <div>
              <div style={sectionTitle}>À débloquer</div>
              {later.map((sp) => <SpellLine key={sp.id} sp={sp} level={sp.level} />)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 10 }}>
          <button onClick={() => onCreate({ name, classKey, gender, testMode })}
            style={{ background: `linear-gradient(180deg, ${color.gold}, #7d6128)`, color: "#16120a", border: "none", borderRadius: 10, padding: "12px 38px", fontFamily: font.display, fontSize: 17, letterSpacing: ".08em", cursor: "pointer" }}>
            Entrer à Aldenmoor
          </button>
          <label style={{ fontSize: 12, color: color.mist, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            Mode test : tous les objets du jeu dans le sac
          </label>
          {onImport && (
            <label style={{ fontSize: 12, color: color.goldBright, cursor: "pointer", textDecoration: "underline" }}>
              Importer une sauvegarde
              <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(onImport); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

const pill = (on) => ({
  flex: 1, cursor: "pointer", padding: "9px 10px", borderRadius: 8, fontFamily: font.body, fontSize: 14,
  background: on ? color.panelRaised : color.panel, color: on ? color.goldBright : color.parchmentDim,
  border: `1px solid ${on ? color.gold : color.line}`,
});

export function SpellLine({ sp, level, tag, locked }) {
  const c = sp.type === "mag" ? color.mag : sp.type === "buff" ? color.frost : color.phys;
  return (
    <div style={{ fontSize: 12, color: locked ? color.mist : color.parchmentDim, borderLeft: `3px solid ${locked ? color.line : c}`, paddingLeft: 8, marginBottom: 7, opacity: locked ? 0.75 : 1 }}>
      <span style={{ color: locked ? color.mist : color.parchment, fontWeight: 600 }}>{sp.name}</span>
      <span style={{ color: color.gold }}> · {sp.pa} PA</span>
      {level && <span style={{ color: color.goldBright }}> · niveau {level}</span>}
      {tag && <span style={{ color: color.mist }}> · {tag}</span>}
      {sp.exclusive && <span style={{ color: color.blood }}> · exclusif</span>}
      <div style={{ fontSize: 11 }}>{sp.desc}</div>
    </div>
  );
}
