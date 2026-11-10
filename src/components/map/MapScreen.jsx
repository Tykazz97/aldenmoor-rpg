import { roomFor } from "../../utils/bag.js";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./map.css";
import Terrain from "./Terrain.jsx";
import CityTerrain from "./CityTerrain.jsx";
import Minimap from "./Minimap.jsx";
import WorldMap from "./WorldMap.jsx";
import CityCrowd from "./CityCrowd.jsx";
import CityChat from "./CityChat.jsx";
import EngagePopup from "./EngagePopup.jsx";
import SentinelTag from "./SentinelTag.jsx";
import GroupBadge from "./GroupBadge.jsx";
import PartyFollowers from "./PartyFollowers.jsx";
import { groupOf } from "../../utils/group.js";
import { sentinelOwner } from "../../utils/sentinel.js";
import { sentinelEncounter } from "../../utils/sentinelFight.js";
import { defenderBots } from "../../utils/sentinelDefense.js";
import { guildsOf, winAttackAction, loseAttackAction } from "../../utils/guildActions.js";
import BuildingModal from "./BuildingModal.jsx";
import { useHeroLoop } from "./useHeroLoop.js";
import { useCityChat } from "./useCityChat.js";
import { HARVEST_MS, cq, key, encounterOf } from "./mapConstants.js";
import { SIM_PLAYERS, SIM_ON_MAPS } from "../../sim/config.js";
import { createMapLife, stepMapLife, whoFights } from "../../sim/mapLife.js";
import { getLivePopulation } from "../../sim/simWorld.js";
import { EncounterFight } from "../combat/CombatScreen.jsx";
import DungeonRun from "../combat/DungeonRun.jsx";
import { DUNGEONS } from "../../data/dungeons.js";
import { consumeKey } from "../../utils/dungeon.js";
import { MAPS, CITY, buildingObjects } from "../../data/maps.js";
import { ZONES, ENEMIES } from "../../data/zones.js";
import { RESOURCES } from "../../data/resources.js";
import { NODES } from "../../data/gathering.js";
import { PROFESSIONS, MAX_PROFESSION_LEVEL, xpForLevel } from "../../data/professions.js";
import { heroLook } from "../../data/heroSprites.js";
import { heroSheetUrl, heroFrameLayout, HERO_ACTION_FOR_PROFESSION } from "../../data/heroAnims.js";
import { canGather, rollHarvest } from "../../utils/gathering.js";
import { harvestDuration } from "../../utils/perks.js";
import { findPath, pathToObject, activeGroups, activeNodes, mapWidth, mapHeight, isWalkable } from "../../utils/mapPath.js";

export default function MapScreen({ player, onPlayerChange, stats, world, setWorld, onRewards, onManageGroup, onGather, renderBuilding }) {
  const map = MAPS[world.mapKey];
  const W = mapWidth(map), H = mapHeight(map);
  const [fight, setFight] = useState(null);       // { group, enc }
  const [run, setRun] = useState(null);           // expédition en cours : { dungeon }
  const [popup, setPopup] = useState(null);       // groupe sur lequel on s'apprête à engager
  const [harvest, setHarvest] = useState(null);   // { node } pendant une récolte
  const [facing, setFacing] = useState(1);
  const [walking, setWalking] = useState(false);
  const [toast, setToast] = useState(null);
  const [gains, setGains] = useState([]);         // textes flottants "+2 Frêne"
  const [marker, setMarker] = useState(null);     // anneau là où l'on a cliqué
  const [view, setView] = useState("region");   // "region" | "world" (carte du monde)
  const [building, setBuilding] = useState(null); // lieu ouvert dans la ville (atelier, coffre...)
  const [now, setNow] = useState(() => Date.now());

  // le groupe permanent : ses membres présents suivent le héros sur la carte (et ne figurent plus parmi la foule)
  const mates = useMemo(() => groupOf(player).members, [player.companions, player.market?.sims]); // eslint-disable-line react-hooks/exhaustive-deps
  const mateIds = useMemo(() => new Set(mates.map((b) => b.id)), [mates]);

  const viewRef = useRef(null), worldElRef = useRef(null), heroRef = useRef(null), heroAnimRef = useRef(null), dotRef = useRef(null);
  const harvestAct = useRef(null);                // { action, t0 } pendant une récolte
  const animKey = useRef("");
  // une ancienne sauvegarde peut garder une position de l'ancienne carte (plus petite) : si elle tombe dans un obstacle, retour à l'arrivée
  const posRef = useRef(isWalkable(map, Math.floor(world.pos.x), Math.floor(world.pos.y)) ? { ...world.pos } : { x: map.start.x + 0.5, y: map.start.y + 0.5 });
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
  const buildings = useMemo(() => buildingObjects(map), [map]);
  const blocked = useMemo(() => new Set([...groups, ...nodes, ...buildings].map((o) => key(o.x, o.y))), [groups, nodes, buildings]);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const objsRef = useRef({ groups, nodes, buildings });
  objsRef.current = { groups, nodes, buildings };
  pausedRef.current = !!(fight || run || harvest || building);

  const outfit = heroLook(player, stats);
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const heroLayout = heroFrameLayout(outfit);
  const isCity = map.kind === "city";
  const { life, feed, heroBubble, sendChat, onCityEvents } = useCityChat({ map, isCity, playerRef, posRef });
  // Aventuriers simulés des régions : leurs victoires éliminent vraiment le groupe (réapparition habituelle)
  const mapLife = useMemo(() => (!isCity && SIM_ON_MAPS ? createMapLife({ map, population: getLivePopulation(playerRef.current).filter((b) => !(playerRef.current.companions || []).includes(b.id)), seed: (Date.now() & 0xfffff) + 7 }) : null), [isCity, map]);
  if (mapLife) {
    mapLife.blocked = blocked;
    mapLife.activeGroups = groups;
    mapLife.avoid = new Set([popup?.id, fight?.group?.id].filter(Boolean));
  }
  const onMapLifeEvents = useCallback((evs) => {
    for (const e of evs) if (e.type === "cleared") setWorld((w) => ({ ...w, cleared: { ...w.cleared, [e.id]: Date.now() } }));
  }, [setWorld]);
  const region = isCity ? CITY : ZONES.aldenmoor.regions.find((r) => r.key === map.regionKey);
  const places = useMemo(() => [CITY, ...ZONES.aldenmoor.regions], []);

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
    if (!roomFor(playerRef.current, { produces: [def.resource] })) { showToast("Sac plein : range ou vends des ressources avant de récolter."); return; }
    facingRef.current = n.x + 0.5 >= posRef.current.x ? 1 : -1; setFacing(facingRef.current);
    harvestRef.current = true;
    const ms = harvestDuration(chk.level, def.profession, HARVEST_MS);      // les métiers de haut niveau récoltent plus vite
    harvestAct.current = { action: HERO_ACTION_FOR_PROFESSION[def.profession], t0: performance.now(), ms };
    setHarvest({ node: n, ms });
    harvestTimer.current = setTimeout(() => {
      harvestRef.current = false;
      harvestAct.current = null;
      setHarvest(null);
      const rolled = rollHarvest(playerRef.current, n.node);
      const roll = rolled.find && !roomFor(playerRef.current, { produces: [def.resource, ...Object.keys(rolled.find)] }) ? { ...rolled, find: null } : rolled;   // sac plein : la trouvaille est perdue
      const qty = roll.qty;
      const before = playerRef.current.professions[def.profession];
      onGather?.(n.node, qty, roll.find);
      setWorld((w) => ({ ...w, pos: { ...posRef.current }, cleared: { ...w.cleared, [n.id]: Date.now() } }));
      const gid = Date.now() + Math.random();
      const found = roll.find ? Object.keys(roll.find)[0] : null;
      setGains((g) => [...g, { id: gid, x: n.x, y: n.y, text: `+${qty} ${RESOURCES[def.resource].name}${roll.doubled ? " (récolte double !)" : ""}`, sub: found ? `+1 ${RESOURCES[found].name} (trouvaille !) · +${def.xp} xp` : `+${def.xp} xp ${PROFESSIONS[def.profession].name}` }]);
      setTimeout(() => setGains((g) => g.filter((e) => e.id !== gid)), 2200);
      if (before.level < MAX_PROFESSION_LEVEL && before.xp + def.xp >= xpForLevel(before.level)) showToast(`${PROFESSIONS[def.profession].name} : niveau ${before.level + 1} !`);
    }, ms);
  }, [onGather, setWorld, showToast]);

  const openPopup = useCallback((g) => {
    const busy = mapLife && whoFights(mapLife, g.id);
    if (busy) { showToast(busy.includes(",") ? `${busy} affrontent déjà ce groupe.` : `${busy} affronte déjà ce groupe.`); return; }
    facingRef.current = g.x + 0.5 >= posRef.current.x ? 1 : -1; setFacing(facingRef.current);
    setPopup(g);
  }, [mapLife, showToast]);

  const openBuilding = useCallback((b) => {
    facingRef.current = b.cx >= posRef.current.x ? 1 : -1; setFacing(facingRef.current);
    if (b.kind === "portail") setView("world");
    else if (b.kind === "donjon") setPopup({ id: b.id, x: b.x, y: b.y, dungeon: DUNGEONS[b.dungeon] });
    else setBuilding(b);
  }, []);

  // voyage vers une autre carte (région ou ville) depuis la carte du monde
  const travelTo = useCallback((k) => {
    const dest = MAPS[k];
    if (!dest) { showToast("Cette région n'est pas encore accessible."); return; }
    setView("region");
    if (k === world.mapKey) return;
    pathRef.current = null; keysRef.current.clear(); touchRef.current = null; camRef.current = null;
    posRef.current = { x: dest.start.x + 0.5, y: dest.start.y + 0.5 };
    setPopup(null); setMarker(null);
    setWorld((w) => ({ ...w, mapKey: k, pos: { ...posRef.current } }));
  }, [world.mapKey, setWorld, showToast]);

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

  useHeroLoop({
    map, W, H, fight, syncPos, openPopup, openBuilding, startHarvest, setPopup, setFacing, setWalking,
    refs: { viewRef, worldElRef, heroRef, heroAnimRef, dotRef, harvestAct, animKey, posRef, camRef, pathRef, keysRef, touchRef, harvestRef, pausedRef, facingRef, walkingRef, outfitRef, blockedRef, objsRef },
  });

  // ---------- donjon ----------
  if (run) {
    return (
      <DungeonRun
        dungeon={run.dungeon}
        player={player}
        stats={stats}
        onRewards={onRewards}
        onPlayerChange={onPlayerChange}
        onDone={(cleared) => {
          setWorld((w) => ({ ...w, pos: { ...posRef.current } }));
          showToast(cleared ? `${run.dungeon.name} : expédition réussie !` : `${run.dungeon.name} : expédition perdue.`);
          setRun(null);
        }}
      />
    );
  }

  // ---------- combat ----------
  if (fight) {
    return (
      <EncounterFight
        encounter={fight.enc}
        party={!!fight.party}
        player={player}
        stats={stats}
        onRewards={onRewards}
        onExit={(victory, info) => {
          if (fight.enc.sentinel) {
            const region = fight.enc.sentinel.region;
            if (victory) {
              const mates = info?.group || [];                 // les simulés du groupe se partagent le butin à parts égales avec moi
              const r = winAttackAction(playerRef.current, region, Date.now(), mates);
              onPlayerChange?.((p) => { const x = winAttackAction(p, region, Date.now(), mates); return x.ok ? x.player : p; });
              const got = r.ok ? [r.gold ? `${r.gold} or` : null, ...Object.entries({ ...r.res, ...r.bank }).map(([id, q]) => `${RESOURCES[id]?.name || id} ×${q}`)].filter(Boolean).join(", ") : "";
              showToast(r.ok ? `Sentinelle détruite !${got ? ` Ta part : ${got}.` : ""}${r.group ? ` Butin partagé à ${r.group + 1}.` : ""}${Object.keys(r.bank).length ? " (une partie est au coffre)" : ""}${Object.keys(r.lost).length ? " (sac et coffre pleins : une partie est perdue)" : ""}` : "Sentinelle détruite.");
            } else {
              onPlayerChange?.((p) => { const x = loseAttackAction(p, region); return x.ok ? x.player : p; });
              showToast("La sentinelle a tenu bon : protégée 1 h.");
            }
            setFight(null);
            return;
          }
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
  for (const o of map.groups) if (world.cleared[o.id] !== undefined && !groups.includes(o)) waits.push((o.respawnMs ?? map.respawnMs) - (now - world.cleared[o.id]));
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
          <WorldMap regions={places} current={map.regionKey} onTravel={travelTo} />
          {toast && <div key={toast.id} className="mp-toast">{toast.text}</div>}
        </div>
      ) : (
      <div className="mp-stage">
        <div className="mp-map" ref={viewRef}>
          <div className="mp-world" ref={worldElRef} style={{ width: `calc(var(--tile) * ${W})`, height: `calc(var(--tile) * ${H})` }} onClick={onWorldClick}>
            {map.kind === "city" ? <CityTerrain map={map} /> : <Terrain map={map} />}

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
                  {busy && <span className="mp-prog"><i style={{ animationDuration: `${harvest.ms || HARVEST_MS}ms` }} /></span>}
                </button>
              );
            })}

            {/* bâtiments de la ville */}
            {buildings.map((b) => (
              <button
                key={b.id}
                className="mp-node mp-building"
                style={{ left: `calc(var(--tile) * ${b.cx})`, top: `calc(var(--tile) * ${b.y + 0.95})`, zIndex: b.y * 10 + 3 }}
                onClick={(e) => { e.stopPropagation(); goToObject(b, openBuilding); }}
              >
                <span className="mp-plate">{b.name}<i>{b.hint}</i></span>
                <img src={b.img} alt={b.name} draggable={false} style={{ width: `calc(var(--tile) * ${b.w})`, height: "auto" }} />
              </button>
            ))}

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
                  className={`mp-group ${enc.boss ? "boss" : ""} ${mapLife && whoFights(mapLife, g.id) ? "busy" : ""}`}
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

            {/* joueurs simulés de la ville */}
            {life && <CityCrowd life={life} hide={mateIds} onEvents={onCityEvents} />}
            {mapLife && <CityCrowd life={mapLife} hide={mateIds} step={stepMapLife} onEvents={onMapLifeEvents} />}

            {/* membres du groupe : ils suivent le héros */}
            {mates.length > 0 && <PartyFollowers members={mates} posRef={posRef} map={map} />}

            {/* héros (position mise à jour à chaque image par la boucle d'animation) */}
            <div className="mp-ent" ref={heroRef}>
              <span className="mp-shadow" />
              {SIM_PLAYERS && <span className="mp-nick me">{player.name}<i>{player.level}</i></span>}
              {heroBubble && <span className="mp-bubble">{heroBubble}</span>}
              <div className="mp-flip" style={{ transform: `scaleX(${facing})` }}>
                <div ref={heroAnimRef} className={`mp-hero-anim ${harvest || walking ? "" : "idle"}`} role="img" aria-label="Héros"
                  style={{ width: cq(heroLayout.w), height: cq(heroLayout.h), left: cq(-heroLayout.ax), top: cq(-heroLayout.ay) }} />
              </div>
            </div>
          </div>

          <div className="mp-vignette" />
          <Minimap map={map} groups={groups} nodes={nodes} dotRef={dotRef} />
          {!popup && <GroupBadge player={player} onManage={onManageGroup} />}
          {!isCity && !popup && <SentinelTag player={player} region={map.regionKey} now={now} onAttack={(party) => {
            const G = guildsOf(player), g = G && sentinelOwner(G, map.regionKey);
            if (!g) return;
            syncPos();
            const enc = sentinelEncounter(g, map.regionKey, defenderBots(g, getLivePopulation(player), Date.now())); setFight({ group: null, enc, party });
          }} />}

          {toast && <div key={toast.id} className="mp-toast">{toast.text}</div>}

          {life && <CityChat feed={feed} online={life.agents.length + 1} onSend={sendChat} playerName={player.name} />}

          {popup && <EngagePopup group={popup} dungeon={popup.dungeon} hasWeapon={!!player.equipped.arme} classKey={player.classKey} player={player} onManageGroup={onManageGroup} onFight={(party, chosen) => {
            syncPos();
            if (popup.dungeon) { const d = chosen || popup.dungeon; onPlayerChange?.((p) => consumeKey(p, d)); setRun({ dungeon: d }); }
            else setFight({ group: popup, enc: encounterOf(popup.encounter), party });
            setPopup(null);
          }} onBack={() => setPopup(null)} />}
        </div>
      </div>
      )}

      <div className="mp-foot">
        {isCity ? (
          <>
            <span>Ville d'Aldenmoor · lieu sûr, aucun combat</span>
            <span>Clique sur un bâtiment pour y entrer · le portail mène aux régions · flèches ou ZQSD</span>
          </>
        ) : (
          <>
            <span><b>{groups.length}</b> groupe{groups.length > 1 ? "s" : ""} · <b>{nodes.length}</b> ressource{nodes.length > 1 ? "s" : ""} sur la carte{soonest !== null ? ` · prochain retour dans ${soonest} s` : ""}</span>
            <span>Clique pour te déplacer, sur un groupe pour l'affronter, sur un arbre / filon / plante pour récolter · flèches ou ZQSD</span>
          </>
        )}
      </div>

      <BuildingModal building={building} onClose={() => setBuilding(null)} renderBuilding={renderBuilding} />
    </div>
  );
}
