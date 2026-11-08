import React, { useMemo, useState } from "react";
import { ENEMIES } from "../../data/zones.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { color } from "../../styles/theme.js";
import { encounterOf } from "./mapConstants.js";
import { CLASSES } from "../../data/classes.js";
import { PARTY_SIZE, buildAllies, companionCandidates } from "../../sim/partyBots.js";
import { getLivePopulation } from "../../sim/simWorld.js";
import { keyCount, dungeonDrops } from "../../utils/dungeon.js";
import { DUNGEONS } from "../../data/dungeons.js";

// ------------------------------------------------------------
// Fenêtre d'engagement : aperçu du groupe et du butin possible
// ------------------------------------------------------------
// `dungeon` : fiche d'entrée d'un donjon (data/dungeons.js) au lieu d'un groupe d'ennemis ; on y entre toujours en groupe, avec une clé
export default function EngagePopup({ group, dungeon: entrance = null, hasWeapon, classKey, player, onCompanions, onFight, onBack }) {
  const [picking, setPicking] = useState(false);
  const [hard, setHard] = useState(false);                 // l'entrée d'un donjon propose sa version difficile (`hardKey`)
  const dungeon = entrance && hard && entrance.hardKey ? DUNGEONS[entrance.hardKey] : entrance;
  const population = getLivePopulation(player);
  const companions = player?.companions || [];
  const allies = useMemo(() => (player ? buildAllies(player, companions, population) : []), [player?.level, player?.classKey, companions.join()]); // eslint-disable-line
  const candidates = useMemo(() => (player && picking ? companionCandidates(player, population) : []), [picking, player?.level]); // eslint-disable-line
  const toggle = (id) => {
    const next = companions.includes(id) ? companions.filter((c) => c !== id) : [...companions, id].slice(-(PARTY_SIZE - 1));
    onCompanions?.(next);
  };
  const enc = dungeon
    ? { name: dungeon.name, level: dungeon.levels, desc: dungeon.desc, boss: true, enemies: [...new Set(dungeon.rooms.flatMap((r) => r.enemies))] }
    : encounterOf(group.encounter);
  const drops = [];
  const seen = new Set();
  if (dungeon) drops.push(...dungeonDrops(dungeon, classKey));
  else for (const k of enc.enemies) {
    for (const d of ENEMIES[k].drops || []) {
      if (d.forClass && d.forClass !== classKey) continue;
      const id = `${d.type}:${d.id}`;
      if (!seen.has(id)) { seen.add(id); drops.push(d); }
    }
  }
  const keys = dungeon && player ? keyCount(player, dungeon) : 0;
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
          {entrance?.hardKey && (
            <div className="mp-pop-mode" style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <button data-mode="normal" className={`cb-btn ${!hard ? "primary" : ""}`} onClick={() => setHard(false)}>Normal</button>
              <button data-mode="hard" className={`cb-btn ${hard ? "primary" : ""}`} onClick={() => setHard(true)}>Difficile</button>
            </div>
          )}
          <div className="mp-pop-name">{enc.name}<span className={`mp-tag ${enc.boss ? "boss" : ""}`}>{enc.level}</span></div>
          <div className="mp-pop-desc">{enc.desc}</div>
          <div className="mp-pop-list">
            {dungeon
              ? dungeon.rooms.map((r, i) => <span key={r.id}>{i + 1}. {r.name}{r.boss ? " · boss" : ""}</span>)
              : Object.entries(enemyCount).map(([k, n]) => (
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
      {dungeon && keys === 0 && <div className="mp-pop-warn">Il te faut une {ITEMS[dungeon.keyItem].name} : le Bricoleur la fabrique à l'atelier.</div>}
      {dungeon && keys > 0 && <div className="mp-pop-warn">Les PV ne sont pas rendus entre les salles. La clé est consommée à l'entrée, même si l'expédition échoue. Niveau conseillé : {dungeon.minLevel} et plus.</div>}
      <div className="mp-pop-btns">
        <button className="cb-btn" onClick={onBack}>Reculer</button>
        {dungeon ? (
          <button className="cb-btn primary" disabled={keys === 0} onClick={() => onFight(true, dungeon)} title="Trois héros : toi et deux compagnons">🗝 Entrer avec mon groupe{keys > 0 ? ` (${keys} clé${keys > 1 ? "s" : ""})` : ""}</button>
        ) : (
          <>
            <button className="cb-btn" onClick={() => onFight(true)} title="Deux compagnons combattent à tes côtés : butin meilleur (jusqu'à ×1,5), mais moins d'xp qu'en solo">👥 En groupe</button>
            <button className="cb-btn primary" onClick={() => onFight(false)}>⚔ Combattre seul</button>
          </>
        )}
      </div>
    </div>
  );
}
