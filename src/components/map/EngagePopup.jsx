import React from "react";
import { ENEMIES } from "../../data/zones.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { color } from "../../styles/theme.js";
import { encounterOf } from "./mapConstants.js";

// ------------------------------------------------------------
// Fenêtre d'engagement : aperçu du groupe et du butin possible
// ------------------------------------------------------------
export default function EngagePopup({ group, hasWeapon, classKey, onFight, onBack }) {
  const enc = encounterOf(group.encounter);
  const drops = [];
  const seen = new Set();
  for (const k of enc.enemies) {
    for (const d of ENEMIES[k].drops || []) {
      if (d.forClass && d.forClass !== classKey) continue;
      const id = `${d.type}:${d.id}`;
      if (!seen.has(id)) { seen.add(id); drops.push(d); }
    }
  }
  const order = { commune: 0, peu_commune: 1, rare: 2 };
  drops.sort((a, b) => (a.type === "item") - (b.type === "item") || (order[RESOURCES[a.id]?.rarity] ?? 9) - (order[RESOURCES[b.id]?.rarity] ?? 9));
  const enemyCount = {};
  enc.enemies.forEach((k) => { enemyCount[k] = (enemyCount[k] || 0) + 1; });

  return (
    <div className="mp-popup">
      <div className="mp-pop-top">
        <div className="mp-pop-thumbs">
          {enc.enemies.map((k, i) => <img key={i} src={ENEMIES[k].img} alt="" />)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mp-pop-name">{enc.name}<span className={`mp-tag ${enc.boss ? "boss" : ""}`}>{enc.level}</span></div>
          <div className="mp-pop-desc">{enc.desc}</div>
          <div className="mp-pop-list">
            {Object.entries(enemyCount).map(([k, n]) => (
              <span key={k}>{n > 1 ? `${n}× ` : ""}{ENEMIES[k].name} · {ENEMIES[k].stats.hp} PV</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mp-pop-drops">
        <span className="lbl">Butin possible</span>
        {drops.map((d, i) => {
          const it = d.type === "item" ? ITEMS[d.id] : RESOURCES[d.id];
          const rar = d.type === "resource" ? RESOURCE_RARITIES[it.rarity] : null;
          return <img key={i} src={it.img} alt={it.name} title={it.name + (d.type === "item" ? " (équipement)" : "")} style={{ borderColor: d.type === "item" ? color.gold : rar?.color || color.line }} />;
        })}
      </div>
      {!hasWeapon && <div className="mp-pop-warn">Aucune arme équipée : tu te battras à mains nues.</div>}
      <div className="mp-pop-btns">
        <button className="cb-btn" onClick={onBack}>Reculer</button>
        <button className="cb-btn primary" onClick={onFight}>⚔ Combattre</button>
      </div>
    </div>
  );
}
