import React from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { CLASSES } from "../../data/classes.js";
import { WEAPON_TYPES } from "../../data/weapons.js";
import { SpellLine } from "./CharacterCreator.jsx";

// Sorts du personnage : celui de l'arme équipée + ceux de la classe (verrouillés jusqu'au bon niveau)
export default function SpellsPanel({ player }) {
  const cls = CLASSES[player.classKey];
  const weapon = player.equipped.arme;
  const wt = weapon ? WEAPON_TYPES[weapon.weaponType] : null;
  if (!cls) return null;
  return (
    <div style={{ background: color.panel, border, borderRadius: radius.lg, padding: 16, marginTop: 16 }}>
      <div style={{ fontFamily: font.display, color: color.goldBright, fontSize: 15, marginBottom: 10 }}>Sorts — {cls.label}</div>
      <div style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Arme</div>
      {wt ? <SpellLine sp={wt.spell} tag={weapon.name} /> : <div style={{ fontSize: 12, color: color.mist, marginBottom: 7 }}>Aucune arme équipée : seul le coup de poing est disponible.</div>}
      <div style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".08em", margin: "10px 0 6px" }}>Classe</div>
      {cls.spells.map((sp) => <SpellLine key={sp.id} sp={sp} level={sp.level} locked={sp.level > player.level} />)}
    </div>
  );
}
