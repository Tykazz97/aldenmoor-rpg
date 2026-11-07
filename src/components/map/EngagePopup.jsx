import React, { useMemo, useState } from "react";
import { ENEMIES } from "../../data/zones.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { color } from "../../styles/theme.js";
import { encounterOf } from "./mapConstants.js";
import { CLASSES } from "../../data/classes.js";
import { PARTY_SIZE, buildAllies, companionCandidates } from "../../sim/partyBots.js";
import { getLivePopulation } from "../../sim/simWorld.js";

// ------------------------------------------------------------
// Fenêtre d'engagement : aperçu du groupe et du butin possible
// ------------------------------------------------------------
export default function EngagePopup({ group, hasWeapon, classKey, player, onCompanions, onFight, onBack }) {
  const [picking, setPicking] = useState(false);
  const population = getLivePopulation();
  const companions = player?.companions || [];
  const allies = useMemo(() => (player ? buildAllies(player, companions, population) : []), [player?.level, player?.classKey, companions.join()]); // eslint-disable-line
  const candidates = useMemo(() => (player && picking ? companionCandidates(player, population) : []), [picking, player?.level]); // eslint-disable-line
  const toggle = (id) => {
    const next = companions.includes(id) ? companions.filter((c) => c !== id) : [...companions, id].slice(-(PARTY_SIZE - 1));
    onCompanions?.(next);
  };
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
      {player && (
        <div className="mp-pop-party">
          <span className="lbl">Ton groupe</span>
          {allies.map((a, i) => (
            <span key={i} className="mp-comp-chip" title={`${CLASSES[a.classKey].label} niveau ${a.level}`}>{a.name} <i>{CLASSES[a.classKey].label} · niv. {a.level}</i></span>
          ))}
          <button className="cb-btn" onClick={() => setPicking(!picking)}>{picking ? "Fermer" : "Choisir mes compagnons"}</button>
        </div>
      )}
      {picking && (
        <div className="mp-comp-list">
          <div className="hint">Aventuriers de niveau proche du tien. Choisis-en {PARTY_SIZE - 1} au maximum ; le reste du groupe est complété automatiquement.</div>
          {candidates.map((b) => (
            <button key={b.id} className={`mp-comp-row ${companions.includes(b.id) ? "sel" : ""}`} onClick={() => toggle(b.id)}>
              <b>{b.name}</b><span>{CLASSES[b.classKey].label}</span><i>niv. {b.level}</i>
            </button>
          ))}
        </div>
      )}
      {!hasWeapon && <div className="mp-pop-warn">Aucune arme équipée : tu te battras à mains nues.</div>}
      <div className="mp-pop-btns">
        <button className="cb-btn" onClick={onBack}>Reculer</button>
        <button className="cb-btn" onClick={() => onFight(true)} title="Deux compagnons combattent à tes côtés : butin meilleur (jusqu'à ×1,5), mais moins d'xp qu'en solo">👥 En groupe</button>
        <button className="cb-btn primary" onClick={() => onFight(false)}>⚔ Combattre seul</button>
      </div>
    </div>
  );
}
