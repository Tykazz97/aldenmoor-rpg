import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./map.css";
import Terrain from "./Terrain.jsx";
import Minimap from "./Minimap.jsx";
import WorldMap from "./WorldMap.jsx";
import { EncounterFight } from "../combat/CombatScreen.jsx";
import { MAPS } from "../../data/maps.js";
import { ZONES, ENEMIES } from "../../data/zones.js";
import { ENCOUNTERS } from "../../data/encounters.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { NODES } from "../../data/gathering.js";
import { PROFESSIONS } from "../../data/professions.js";
import { heroOutfitFor } from "../../data/heroSprites.js";
import { heroAnimMeta, heroSheetUrl, heroFrameLayout, frameBackground, HERO_ACTION_FOR_PROFESSION } from "../../data/heroAnims.js";
import { canGather, rollYield } from "../../utils/gathering.js";
import { findPath, pathToObject, stepMove, canStand, activeGroups, activeNodes, mapWidth, mapHeight } from "../../utils/mapPath.js";
import { color } from "../../styles/theme.js";

const VIEW_W = 14;        // largeur visible : 14 tuiles
const SPEED = 4.4;        // vitesse du héros, en tuiles par seconde
const TOUCH = 0.95;       // distance à laquelle on "touche" un objet en marchant au clavier
const HARVEST_MS = 2000;  // durée d'une récolte (un cycle complet de l'animation de métier)
const WALK_CYCLE = 0.72;  // durée d'un cycle de marche, en secondes
const cq = (n) => `calc(var(--cq) * ${n})`;
const key = (x, y) => `${x},${y}`;
const encounterOf = (id) => ENCOUNTERS.find((e) => e.id === id);
const MOVE_KEYS = {
  ArrowLeft: [-1, 0], q: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
  ArrowUp: [0, -1], z: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
};

export default function MapScreen({ player, stats, world, setWorld, onRewards, onGather }) {
  const map = MAPS[world.mapKey];
  const W = mapWidth(map), H = mapHeight(map);
  const [fight, setFight] = useState(null);       // { group, enc }
  const [popup, setPopup] = useState(null);       // groupe sur lequel on s'apprête à engager
  const [harvest, setHarvest] = useState(null);   // { node } pendant une récolte
  const [facing, setFacing] = useState(1);
  const [walking, setWalking] = useState(false);
  const [toast, setToast] = useState(null);
  const [gains, setGains] = useState([]);         // textes flottants "+2 Frêne"
  const [marker, setMarker] = useState(null);     // anneau là où l'on a cliqué
  const [view, setView] = useState("region");   // "region" | "world" (carte du monde)
  const [now, setNow] = useState(() => Date.now());

  const viewRef = useRef(null), worldElRef = useRef(null), heroRef = useRef(null), heroAnimRef = useRef(null), dotRef = useRef(null);
  const harvestAct = useRef(null);                // { action, t0 } pendant une récolte
  const animKey = useRef("");
  const posRef = useRef({ ...world.pos });
  const camRef = useRef(null);
  const pathRef = useRef(null);                   // { pts, then }
  const keysRef = useRef(new Set());
  const touchRef = useRef(null);                  // dernier objet touché au clavier
  const harvestRef = useRef(false);
  const pausedRef = useRef(false);
  const facingRef = useRef(1), walkingRef = useRef(false);
  const harvestTimer = useRef(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  // objets présents (le respawn se fait en temps réel : `now` avance chaque seconde)
  const gAll = activeGroups(map, world, now), nAll = activeNodes(map, world, now);
  const gSig = gAll.map((g) => g.id).join(), nSig = nAll.map((n) => n.id).join();
  const groups = useMemo(() => gAll, [gSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const nodes = useMemo(() => nAll, [nSig]);  // eslint-disable-line react-hooks/exhaustive-deps
  const blocked = useMemo(() => new Set([...groups, ...nodes].map((o) => key(o.x, o.y))), [groups, nodes]);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const objsRef = useRef({ groups, nodes });
  objsRef.current = { groups, nodes };
  pausedRef.current = !!(fight || harvest);

  const outfit = heroOutfitFor(stats.setBonuses);
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const heroLayout = heroFrameLayout(outfit);
  const region = ZONES.aldenmoor.regions.find((r) => r.key === map.regionKey);

  // précharge les feuilles d'animation de la tenue
  useEffect(() => { for (const a of ["walk", "mine", "chop", "herb"]) { const im = new Image(); im.src = heroSheetUrl(outfit, a); } }, [outfit]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(id); clearTimeout(harvestTimer.current); };
  }, []);

  const showToast = useCallback((text) => {
    setToast({ text, id: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.id >= 2400 ? null : t)), 2500);
  }, []);

  const syncPos = useCallback(() => setWorld((w) => ({ ...w, pos: { ...posRef.current } })), [setWorld]);

  // ---------- actions ----------
  const startHarvest = useCallback((n) => {
    const def = NODES[n.node];
    const chk = canGather(playerRef.current, n.node);
    if (!chk.ok) { showToast(`${PROFESSIONS[def.profession].name} niveau ${def.minLevel} requis (tu es niveau ${chk.level}).`); return; }
    facingRef.current = n.x + 0.5 >= posRef.current.x ? 1 : -1; setFacing(facingRef.current);
    harvestRef.current = true;
    harvestAct.current = { action: HERO_ACTION_FOR_PROFESSION[def.profession], t0: performance.now() };
    setHarvest({ node: n });
    harvestTimer.current = setTimeout(() => {
      harvestRef.current = false;
      harvestAct.current = null;
      setHarvest(null);
      const qty = rollYield(def);
      const before = playerRef.current.professions[def.profession];
      onGather?.(n.node, qty);
      setWorld((w) => ({ ...w, pos: { ...posRef.current }, cleared: { ...w.cleared, [n.id]: Date.now() } }));
      const gid = Date.now() + Math.random();
      setGains((g) => [...g, { id: gid, x: n.x, y: n.y, text: `+${qty} ${RESOURCES[def.resource].name}`, sub: `+${def.xp} xp ${PROFESSIONS[def.profession].name}` }]);
      setTimeout(() => setGains((g) => g.filter((e) => e.id !== gid)), 1800);
      if (before.level < 10 && before.xp + def.xp >= before.level * 30) showToast(`${PROFESSIONS[def.profession].name} : niveau ${before.level + 1} !`);
    }, HARVEST_MS);
  }, [onGather, setWorld, showToast]);

  const openPopup = useCallback((g) => {
    facingRef.current = g.x + 0.5 >= posRef.current.x ? 1 : -1; setFacing(facingRef.current);
    setPopup(g);
  }, []);

  // marcher jusqu'à un objet (groupe ou nœud), puis agir
  const goToObject = useCallback((o, act) => {
    if (harvestRef.current) return;
    setPopup(null);
    const p = pathToObject(map, posRef.current, o, blockedRef.current);
    if (p === null) { showToast("Impossible d'atteindre cette cible."); return; }
    if (!p.length) { pathRef.current = null; act(o); return; }
    pathRef.current = { pts: p, then: () => act(o) };
  }, [map, showToast]);

  const goToPoint = useCallback((x, y) => {
    if (harvestRef.current) return;
    setPopup(null);
    const p = findPath(map, posRef.current, { x, y }, blockedRef.current);
    if (!p) return;
    pathRef.current = { pts: p, then: null };
    setMarker({ x: p[p.length - 1].x, y: p[p.length - 1].y, id: Date.now() });
  }, [map]);

  const onWorldClick = (ev) => {
    const r = worldElRef.current.getBoundingClientRect();
    const tile = r.width / W;
    goToPoint((ev.clientX - r.left) / tile, (ev.clientY - r.top) / tile);
  };

  // ---------- clavier ----------
  useEffect(() => {
    const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (ev) => {
      const k = norm(ev.key);
      if (!MOVE_KEYS[k]) return;
      ev.preventDefault();
      keysRef.current.add(k);
      setPopup(null);
    };
    const up = (ev) => keysRef.current.delete(norm(ev.key));
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, []);
  useEffect(() => { if (fight) { keysRef.current.clear(); pathRef.current = null; } }, [fight]);

  // ---------- boucle d'animation : déplacement, caméra ----------
  useEffect(() => {
    let raf, last = performance.now(), lastSync = 0, wasMoving = false;
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const view = viewRef.current, wel = worldElRef.current, hel = heroRef.current;
      if (!view || !wel || !hel) return;
      const tile = view.clientWidth / VIEW_W;
      const pos = posRef.current, bl = blockedRef.current;
      let vx = 0, vy = 0, moving = false;

      // si un objet réapparaît sur le héros, on le dégage vers la tuile libre la plus proche
      if (!canStand(map, pos.x, pos.y, bl)) {
        let best = null;
        for (let r = 1; r <= 4 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const c = { x: Math.floor(pos.x) + dx + 0.5, y: Math.floor(pos.y) + dy + 0.5 };
          if (canStand(map, c.x, c.y, bl) && (!best || Math.hypot(c.x - pos.x, c.y - pos.y) < Math.hypot(best.x - pos.x, best.y - pos.y))) best = c;
        }
        if (best) { pos.x = best.x; pos.y = best.y; }
      }

      if (!pausedRef.current) {
        const keys = keysRef.current;
        if (keys.size) {
          let dx = 0, dy = 0;
          for (const k of keys) { dx += MOVE_KEYS[k][0]; dy += MOVE_KEYS[k][1]; }
          const len = Math.hypot(dx, dy);
          if (len) {
            pathRef.current = null;
            vx = dx / len; vy = dy / len;
            const n = stepMove(map, pos, vx * SPEED * dt, vy * SPEED * dt, bl);
            moving = n.x !== pos.x || n.y !== pos.y;
            pos.x = n.x; pos.y = n.y;
          }
        } else if (pathRef.current) {
          const p = pathRef.current;
          let step = SPEED * dt;
          while (step > 0 && p.pts.length) {
            const tg = p.pts[0], d = Math.hypot(tg.x - pos.x, tg.y - pos.y);
            if (d <= step) { pos.x = tg.x; pos.y = tg.y; step -= d; p.pts.shift(); moving = true; }
            else {
              vx = (tg.x - pos.x) / d; vy = (tg.y - pos.y) / d;
              const nx = pos.x + vx * step, ny = pos.y + vy * step;
              if (canStand(map, nx, ny, bl)) { pos.x = nx; pos.y = ny; moving = true; } else { p.pts.length = 0; p.then = null; }
              step = 0;
            }
          }
          if (!p.pts.length) { pathRef.current = null; p.then?.(); }
        }

        // toucher un objet en marchant au clavier
        if (moving && keys.size) {
          const { groups: gs, nodes: ns } = objsRef.current;
          for (const o of [...gs, ...ns]) {
            if (touchRef.current === o.id) continue;
            if (Math.hypot(o.x + 0.5 - pos.x, o.y + 0.5 - pos.y) < TOUCH) {
              touchRef.current = o.id;
              keys.clear();
              if (o.encounter) openPopup(o); else startHarvest(o);
              break;
            }
          }
        }
        if (touchRef.current) {
          const { groups: gs, nodes: ns } = objsRef.current;
          const o = [...gs, ...ns].find((e) => e.id === touchRef.current);
          if (!o || Math.hypot(o.x + 0.5 - pos.x, o.y + 0.5 - pos.y) > 1.7) touchRef.current = null;
        }
      }

      // orientation / animation de marche
      if (Math.abs(vx) > 0.2 && Math.sign(vx) !== facingRef.current) { facingRef.current = Math.sign(vx); setFacing(facingRef.current); }
      if (moving !== walkingRef.current) { walkingRef.current = moving; setWalking(moving); }

      // position du héros (point d'appui = les pieds) et image d'animation
      hel.style.transform = `translate3d(${pos.x * tile}px, ${(pos.y + 0.4) * tile}px, 0)`;
      const z = String(Math.floor((pos.y + 0.4) * 10) + 5);
      if (hel.style.zIndex !== z) hel.style.zIndex = z;
      const anim = heroAnimRef.current;
      if (anim) {
        const of = outfitRef.current, meta = heroAnimMeta(of);
        let act = "walk", fi = 0;                         // à l'arrêt : première image de la marche
        const h = harvestAct.current;
        if (h) { act = h.action; fi = Math.min(meta.actions[act].frames - 1, Math.floor(((t - h.t0) / HARVEST_MS) * meta.actions[act].frames)); }
        else if (moving) { const n = meta.actions.walk.frames; fi = Math.floor((((t / 1000) / WALK_CYCLE) % 1) * n); }
        const key = `${of}/${act}/${fi}`;
        if (key !== animKey.current) {
          const [kOf, kAct] = animKey.current.split("/");
          if (kOf !== of || kAct !== act) {
            const a = meta.actions[act];
            anim.style.backgroundImage = `url(${heroSheetUrl(of, act)})`;
            anim.style.backgroundSize = `${a.cols * 100}% ${a.rows * 100}%`;
          }
          anim.style.backgroundPosition = frameBackground(meta.actions[act], fi);
          animKey.current = key;
        }
      }

      // caméra : suit le héros avec un peu d'inertie, bornée aux bords de la carte
      const hw = VIEW_W / 2, hh = view.clientHeight / tile / 2;
      const clampC = (v, half, size) => (size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, v)));
      const tx = clampC(pos.x, hw, W), ty = clampC(pos.y, hh, H);
      if (!camRef.current) camRef.current = { x: tx, y: ty };
      const c = camRef.current, k = Math.min(1, dt * 7);
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      wel.style.transform = `translate3d(${-(c.x - hw) * tile}px, ${-(c.y - hh) * tile}px, 0)`;
      if (dotRef.current) { dotRef.current.style.left = `${(pos.x / W) * 100}%`; dotRef.current.style.top = `${(pos.y / H) * 100}%`; }

      // on enregistre la position dans l'état du monde (pour le retour d'un combat ou d'un autre onglet)
      if (moving && t - lastSync > 500) { lastSync = t; syncPos(); }
      if (wasMoving && !moving) syncPos();
      wasMoving = moving;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, W, H, syncPos, openPopup, startHarvest, fight]);

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
            setWorld((w) => ({ ...w, pos: { ...posRef.current }, cleared: { ...w.cleared, [fight.group.id]: Date.now() } }));
            showToast(`Victoire : ${fight.enc.name} dispersé.`);
          }
          setFight(null);
        }}
      />
    );
  }

  // prochain retour d'un groupe / d'une ressource
  const waits = [];
  for (const o of map.groups) if (world.cleared[o.id] !== undefined && !groups.includes(o)) waits.push(map.respawnMs - (now - world.cleared[o.id]));
  for (const o of map.nodes) if (world.cleared[o.id] !== undefined && !nodes.includes(o)) waits.push(map.nodeRespawnMs - (now - world.cleared[o.id]));
  const soonest = waits.length ? Math.max(1, Math.ceil(Math.min(...waits) / 1000)) : null;

  return (
    <div className="mp-root">
      <div className="mp-head">
        <div>
          <div className="mp-title">{region.name}</div>
          <div className="mp-desc">{region.desc}</div>
        </div>
        <button className="cb-btn" onClick={() => setView(view === "world" ? "region" : "world")}>🗺 {view === "world" ? "Retour à la région" : "Carte du monde"}</button>
      </div>

      {view === "world" ? (
        <div className="mp-stage">
          <WorldMap regions={ZONES.aldenmoor.regions} current={map.regionKey}
            onTravel={(k) => { if (k === map.regionKey) setView("region"); else showToast("Cette région n'est pas encore accessible."); }} />
          {toast && <div key={toast.id} className="mp-toast">{toast.text}</div>}
        </div>
      ) : (
      <div className="mp-stage">
        <div className="mp-map" ref={viewRef}>
          <div className="mp-world" ref={worldElRef} style={{ width: `calc(var(--tile) * ${W})`, height: `calc(var(--tile) * ${H})` }} onClick={onWorldClick}>
            <Terrain map={map} />

            {marker && <span key={marker.id} className="mp-marker" style={{ left: `calc(var(--tile) * ${marker.x})`, top: `calc(var(--tile) * ${marker.y})` }} />}

            {/* nœuds de récolte */}
            {nodes.map((n) => {
              const def = NODES[n.node];
              const chk = canGather(player, n.node);
              const busy = harvest && harvest.node.id === n.id;
              return (
                <button
                  key={n.id}
                  className={`mp-node ${chk.ok ? "" : "locked"} ${busy ? "busy" : ""}`}
                  style={{ left: `calc(var(--tile) * ${n.x + 0.5})`, top: `calc(var(--tile) * ${n.y + 0.95})`, zIndex: n.y * 10 + 3 }}
                  onClick={(e) => { e.stopPropagation(); goToObject(n, startHarvest); }}
                >
                  <span className="mp-plate">{def.name}<i>{PROFESSIONS[def.profession].icon} niv. {def.minLevel}</i></span>
                  <span className="mp-shadow" style={{ width: cq(Math.min(def.size, 2) * 3) }} />
                  <img src={def.img} alt={def.name} draggable={false} style={{ height: cq(def.size * 6.25) }} />
                  {busy && <span className="mp-prog"><i style={{ animationDuration: `${HARVEST_MS}ms` }} /></span>}
                </button>
              );
            })}

            {/* gains flottants */}
            {gains.map((g) => (
              <div key={g.id} className="mp-gain" style={{ left: `calc(var(--tile) * ${g.x + 0.5})`, top: `calc(var(--tile) * ${g.y})` }}>
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
                  style={{ left: `calc(var(--tile) * ${g.x + 0.5})`, top: `calc(var(--tile) * ${g.y + 0.95})`, zIndex: g.y * 10 + 4 }}
                  onClick={(e) => { e.stopPropagation(); goToObject(g, openPopup); }}
                >
                  <span className="mp-mark">{enc.boss ? "☠" : "⚔"}</span>
                  <span className="mp-plate">{enc.name}<i>{enc.level}</i></span>
                  <span className="mp-sprites">
                    {enc.enemies.map((k, i) => (
                      <img key={i} src={ENEMIES[k].img} alt="" draggable={false}
                        style={{ height: cq((ENEMIES[k].spriteHeight / 150) * 5.1), animationDelay: `${i * 0.35}s` }} />
                    ))}
                  </span>
                  <span className="mp-shadow" />
                </button>
              );
            })}

            {/* héros (position mise à jour à chaque image par la boucle d'animation) */}
            <div className="mp-ent" ref={heroRef}>
              <span className="mp-shadow" />
              <div className="mp-flip" style={{ transform: `scaleX(${facing})` }}>
                <div ref={heroAnimRef} className={`mp-hero-anim ${harvest || walking ? "" : "idle"}`} role="img" aria-label="Héros"
                  style={{ width: cq(heroLayout.w), height: cq(heroLayout.h), left: cq(-heroLayout.ax), top: cq(-heroLayout.ay) }} />
              </div>
            </div>
          </div>

          <div className="mp-vignette" />
          <Minimap map={map} groups={groups} nodes={nodes} dotRef={dotRef} />

          {toast && <div key={toast.id} className="mp-toast">{toast.text}</div>}

          {popup && <EngagePopup group={popup} hasWeapon={!!player.equipped.arme} onFight={() => { syncPos(); setFight({ group: popup, enc: encounterOf(popup.encounter) }); setPopup(null); }} onBack={() => setPopup(null)} />}
        </div>
      </div>
      )}

      <div className="mp-foot">
        <span><b>{groups.length}</b> groupe{groups.length > 1 ? "s" : ""} · <b>{nodes.length}</b> ressource{nodes.length > 1 ? "s" : ""} sur la carte{soonest !== null ? ` · prochain retour dans ${soonest} s` : ""}</span>
        <span>Clique pour te déplacer, sur un groupe pour l'affronter, sur un arbre / filon / plante pour récolter · flèches ou ZQSD</span>
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
