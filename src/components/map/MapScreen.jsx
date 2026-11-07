import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./map.css";
import Terrain from "./Terrain.jsx";
import { EncounterFight } from "../combat/CombatScreen.jsx";
import { MAPS } from "../../data/maps.js";
import { ZONES, ENEMIES } from "../../data/zones.js";
import { ENCOUNTERS } from "../../data/encounters.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { heroOutfitFor, heroSpriteUrl } from "../../data/heroSprites.js";
import { findPath, pathToAdjacent, activeGroups, activeNodes, isWalkable, mapWidth, mapHeight } from "../../utils/mapPath.js";
import { NODES } from "../../data/gathering.js";
import { PROFESSIONS } from "../../data/professions.js";
import { canGather, rollYield } from "../../utils/gathering.js";
import { color, font } from "../../styles/theme.js";

const STEP_MS = 190;     // durée d'un pas du héros (doit correspondre au CSS)
const HARVEST_MS = 1100; // durée d'une récolte
const HERO_H = 10.5;     // hauteur du héros en cqw (1 tuile = 6.25 cqw)
const key = (x, y) => `${x},${y}`;
const encounterOf = (id) => ENCOUNTERS.find((e) => e.id === id);

export default function MapScreen({ player, stats, world, setWorld, onRewards, onGather }) {
  const map = MAPS[world.mapKey];
  const W = mapWidth(map), H = mapHeight(map);
  const [fight, setFight] = useState(null);     // { group, enc }
  const [popup, setPopup] = useState(null);     // groupe sur lequel on s'apprête à engager
  const [hover, setHover] = useState(null);
  const [facing, setFacing] = useState(1);
  const [walking, setWalking] = useState(false);
  const [toast, setToast] = useState(null);
  const [harvest, setHarvest] = useState(null);  // { node } pendant une récolte
  const [gains, setGains] = useState([]);        // textes flottants "+2 Frêne"
  const timer = useRef(null);
  const harvestTimer = useRef(null);
  const playerRef = useRef(player);
  playerRef.current = player;
  const harvestRef = useRef(false);
  const worldRef = useRef(world);
  worldRef.current = world;

  const groups = useMemo(() => activeGroups(map, world), [map, world]);
  const nodes = useMemo(() => activeNodes(map, world), [map, world]);
  const blocked = useMemo(() => new Set([...groups, ...nodes].map((g) => key(g.x, g.y))), [groups, nodes]);
  const heroSrc = heroSpriteUrl(heroOutfitFor(stats.setBonuses));
  const region = ZONES.aldenmoor.regions.find((r) => r.key === map.regionKey);

  useEffect(() => () => { clearInterval(timer.current); clearTimeout(harvestTimer.current); }, []);

  const showToast = useCallback((text) => {
    setToast({ text, id: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.id >= 2400 ? null : t)), 2500);
  }, []);

  const walk = useCallback((path, then) => {
    if (harvestRef.current) return;
    clearInterval(timer.current);
    setPopup(null);
    if (!path.length) { setWalking(false); then?.(); return; }
    setWalking(true);
    let i = 0;
    timer.current = setInterval(() => {
      const t = path[i++];
      const from = worldRef.current.pos;
      if (t.x !== from.x) setFacing(t.x > from.x ? 1 : -1);
      setWorld((w) => ({ ...w, pos: { x: t.x, y: t.y }, steps: w.steps + 1 }));
      if (i >= path.length) { clearInterval(timer.current); setWalking(false); then?.(); }
    }, STEP_MS);
  }, [setWorld]);

  const groupAt = (x, y) => groups.find((g) => g.x === x && g.y === y);

  const engage = useCallback((g) => {
    const w = worldRef.current;
    const p = pathToAdjacent(map, w.pos, g, blocked);
    if (p === null) { showToast("Impossible d'atteindre ce groupe."); return; }
    walk(p, () => { setFacing(g.x >= worldRef.current.pos.x ? 1 : -1); setPopup(g); });
  }, [map, blocked, walk, showToast]);

  const nodeAt = (x, y) => nodes.find((n) => n.x === x && n.y === y);

  // Récolte : on marche jusqu'à une case voisine, puis une courte animation
  const startHarvest = useCallback((n) => {
    const def = NODES[n.node];
    const chk = canGather(playerRef.current, n.node);
    if (!chk.ok) { showToast(`${PROFESSIONS[def.profession].name} niveau ${def.minLevel} requis (tu es niveau ${chk.level}).`); return; }
    setFacing(n.x >= worldRef.current.pos.x ? 1 : -1);
    harvestRef.current = true;
    setHarvest({ node: n });
    harvestTimer.current = setTimeout(() => {
      harvestRef.current = false;
      setHarvest(null);
      const qty = rollYield(def);
      const before = playerRef.current.professions[def.profession];
      onGather?.(n.node, qty);
      setWorld((w) => ({ ...w, cleared: { ...w.cleared, [n.id]: w.steps } }));
      const gid = Date.now() + Math.random();
      setGains((g) => [...g, { id: gid, x: n.x, y: n.y, text: `+${qty} ${RESOURCES[def.resource].name}`, sub: `+${def.xp} xp ${PROFESSIONS[def.profession].name}` }]);
      setTimeout(() => setGains((g) => g.filter((e) => e.id !== gid)), 1800);
      if (before.level < 10 && before.xp + def.xp >= before.level * 30) showToast(`${PROFESSIONS[def.profession].name} : niveau ${before.level + 1} !`);
    }, HARVEST_MS);
  }, [onGather, setWorld, showToast]);

  const goHarvest = useCallback((n) => {
    if (harvestRef.current) return;
    const p = pathToAdjacent(map, worldRef.current.pos, n, blocked);
    if (p === null) { showToast("Impossible d'atteindre cette ressource."); return; }
    walk(p, () => startHarvest(n));
  }, [map, blocked, walk, startHarvest, showToast]);

  const clickTile = (x, y) => {
    if (harvestRef.current) return;
    const nd = nodeAt(x, y);
    if (nd) return goHarvest(nd);
    const g = groupAt(x, y);
    if (g) return engage(g);
    const p = findPath(map, worldRef.current.pos, { x, y }, blocked);
    if (p) walk(p);
  };

  // Déplacement au clavier (flèches / ZQSD / WASD)
  useEffect(() => {
    if (fight) return undefined;
    const onKey = (ev) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], z: [0, -1], s: [0, 1], a: [-1, 0], q: [-1, 0], d: [1, 0] }[ev.key];
      if (!d) return;
      ev.preventDefault();
      if (harvestRef.current) return;
      const { pos } = worldRef.current;
      const nx = pos.x + d[0], ny = pos.y + d[1];
      const g = groups.find((o) => o.x === nx && o.y === ny);
      if (g) { clearInterval(timer.current); setWalking(false); setFacing(d[0] || facing); setPopup(g); return; }
      const nd = nodes.find((o) => o.x === nx && o.y === ny);
      if (nd) { clearInterval(timer.current); setWalking(false); setFacing(d[0] || facing); startHarvest(nd); return; }
      if (isWalkable(map, nx, ny)) walk([{ x: nx, y: ny }]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fight, groups, nodes, map, walk, facing, startHarvest]);

  // Aperçu du chemin sous la souris
  const preview = useMemo(() => {
    if (!hover || walking || popup || harvest) return [];
    const g = groupAt(hover.x, hover.y) || nodeAt(hover.x, hover.y);
    const p = g ? pathToAdjacent(map, world.pos, g, blocked) : findPath(map, world.pos, hover, blocked);
    return p || [];
  }, [hover, walking, popup, harvest, world.pos, groups, nodes]); // eslint-disable-line

  // ---------- combat ----------
  if (fight) {
    return (
      <EncounterFight
        encounter={fight.enc}
        player={player}
        stats={stats}
        onRewards={onRewards}
        onExit={(victory) => {
          if (victory) {
            setWorld((w) => ({ ...w, cleared: { ...w.cleared, [fight.group.id]: w.steps } }));
            showToast(`Victoire : ${fight.enc.name} dispersé.`);
          }
          setFight(null);
        }}
      />
    );
  }

  const remaining = groups.length;
  const nextRespawn = map.groups
    .filter((g) => world.cleared[g.id] !== undefined && !groups.includes(g))
    .map((g) => map.respawnSteps - (world.steps - world.cleared[g.id]));
  const soonest = nextRespawn.length ? Math.min(...nextRespawn) : null;

  return (
    <div className="mp-root">
      <div className="mp-head">
        <div>
          <div className="mp-title">{region.name}</div>
          <div className="mp-desc">{region.desc}</div>
        </div>
        <div className="mp-tabs">
          {ZONES.aldenmoor.regions.map((r, i) => (
            <span key={r.key} className={`mp-tab ${i === 0 ? "on" : ""}`} title={i === 0 ? "" : "Bientôt disponible"}>
              {i === 0 ? "" : "🔒 "}{r.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mp-stage">
        <div className="mp-map">
          <Terrain map={map} />

          {/* cases cliquables */}
          <div className="mp-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, gridTemplateRows: `repeat(${H}, 1fr)` }}>
            {Array.from({ length: W * H }, (_, i) => {
              const x = i % W, y = Math.floor(i / W);
              const ok = isWalkable(map, x, y);
              const isHover = hover && hover.x === x && hover.y === y;
              return (
                <div
                  key={i}
                  className={`mp-cell ${ok ? "ok" : ""} ${isHover && ok ? "hover" : ""}`}
                  onMouseEnter={() => setHover({ x, y })}
                  onMouseLeave={() => setHover((h) => (h && h.x === x && h.y === y ? null : h))}
                  onClick={() => ok && clickTile(x, y)}
                />
              );
            })}
          </div>

          {/* chemin prévu */}
          {preview.map((t, i) => (
            <span key={i} className="mp-dot" style={{ left: `${((t.x + 0.5) / W) * 100}%`, top: `${((t.y + 0.5) / H) * 100}%` }} />
          ))}

          {/* nœuds de récolte */}
          {nodes.map((n) => {
            const def = NODES[n.node];
            const chk = canGather(player, n.node);
            const busy = harvest && harvest.node.id === n.id;
            return (
              <button
                key={n.id}
                className={`mp-node ${chk.ok ? "" : "locked"} ${busy ? "busy" : ""} ${def.profession}`}
                style={{ left: `${((n.x + 0.5) / W) * 100}%`, top: `${((n.y + 0.95) / H) * 100}%`, zIndex: n.y * 10 + 3 }}
                onClick={() => clickTile(n.x, n.y)}
                onMouseEnter={() => setHover(null)}
              >
                <span className="mp-plate">
                  {def.name}<i>{PROFESSIONS[def.profession].icon} niv. {def.minLevel}</i>
                </span>
                <span className="mp-shadow" style={{ width: `${Math.min(def.size, 2) * 3}cqw` }} />
                <img src={def.img} alt={def.name} draggable={false} style={{ height: `${def.size * 6.25}cqw` }} />
                {busy && <span className="mp-prog"><i style={{ animationDuration: `${HARVEST_MS}ms` }} /></span>}
              </button>
            );
          })}

          {/* gains flottants */}
          {gains.map((g) => (
            <div key={g.id} className="mp-gain" style={{ left: `${((g.x + 0.5) / W) * 100}%`, top: `${(g.y / H) * 100}%` }}>
              {g.text}<small>{g.sub}</small>
            </div>
          ))}

          {/* groupes d'ennemis */}
          {groups.map((g) => {
            const enc = encounterOf(g.encounter);
            return (
              <button
                key={g.id}
                className={`mp-group ${enc.boss ? "boss" : ""}`}
                style={{ left: `${((g.x + 0.5) / W) * 100}%`, top: `${((g.y + 0.95) / H) * 100}%`, zIndex: g.y * 10 + 4 }}
                onClick={() => engage(g)}
                onMouseEnter={() => setHover(null)}
              >
                <span className="mp-mark">{enc.boss ? "☠" : "⚔"}</span>
                <span className="mp-plate">{enc.name}<i>{enc.level}</i></span>
                <span className="mp-sprites">
                  {enc.enemies.map((k, i) => (
                    <img key={i} src={ENEMIES[k].img} alt="" draggable={false}
                      style={{ height: `${(ENEMIES[k].spriteHeight / 150) * 5.1}cqw`, animationDelay: `${i * 0.35}s` }} />
                  ))}
                </span>
                <span className="mp-shadow" />
              </button>
            );
          })}

          {/* héros */}
          <div className="mp-ent" style={{ left: `${((world.pos.x + 0.5) / W) * 100}%`, top: `${((world.pos.y + 0.95) / H) * 100}%`, zIndex: world.pos.y * 10 + 5 }}>
            <span className="mp-shadow" />
            <div className={`mp-flip ${harvest ? "harvesting" : walking ? "walking" : "idle"}`} style={{ transform: `scaleX(${facing})` }}>
              <img src={heroSrc} alt="Héros" draggable={false} style={{ height: `${HERO_H}cqw` }} />
            </div>
          </div>

          <div className="mp-vignette" />

          {toast && <div key={toast.id} className="mp-toast">{toast.text}</div>}

          {popup && <EngagePopup group={popup} hasWeapon={!!player.equipped.arme} onFight={() => { setFight({ group: popup, enc: encounterOf(popup.encounter) }); setPopup(null); }} onBack={() => setPopup(null)} />}
        </div>
      </div>

      <div className="mp-foot">
        <span><b>{remaining}</b> groupe{remaining > 1 ? "s" : ""} · <b>{nodes.length}</b> ressource{nodes.length > 1 ? "s" : ""} en vue{soonest !== null && soonest > 0 ? ` · retour d'un groupe dans ${soonest} pas` : ""}</span>
        <span>Clique une case pour te déplacer, un groupe pour l'affronter, un arbre / filon / plante pour récolter · flèches / ZQSD</span>
        <span style={{ fontFamily: font.data }}>{world.steps} pas</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Fenêtre d'engagement : aperçu du groupe et du butin possible
// ------------------------------------------------------------
function EngagePopup({ group, hasWeapon, onFight, onBack }) {
  const enc = encounterOf(group.encounter);
  const drops = [];
  const seen = new Set();
  for (const k of enc.enemies) {
    for (const d of ENEMIES[k].drops || []) {
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
