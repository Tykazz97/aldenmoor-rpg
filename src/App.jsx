import BagPanel from "./components/bag/BagPanel.jsx";
import React, { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import CharacterSheet from "./components/character/CharacterSheet.jsx";
import ForgePanel from "./components/forge/ForgePanel.jsx";
import CombatScreen from "./components/combat/CombatScreen.jsx";
import MapScreen from "./components/map/MapScreen.jsx";
import { initialWorld } from "./data/maps.js";
import { workshopOf } from "./data/cities.js";
import BankPanel from "./components/city/BankPanel.jsx";
import MarketPanel from "./components/city/MarketPanel.jsx";
import QuestPanel from "./components/city/QuestPanel.jsx";
import BestiaryPanel from "./components/bestiary/BestiaryPanel.jsx";
import RankingPanel from "./components/ranking/RankingPanel.jsx";
import GuildPanel from "./components/guild/GuildPanel.jsx";
import GroupPanel from "./components/group/GroupPanel.jsx";
import { cleanGroupAction, isOnline } from "./utils/group.js";
import { getLivePopulation } from "./sim/simWorld.js";
import { syncPlayerGuild, myGuild, resolveDueAttacksNow } from "./utils/guildActions.js";
import { SENT_BY_KEY } from "./data/sentinel.js";
import ComingSoon from "./components/shared/ComingSoon.jsx";
import CharacterCreator from "./components/character/CharacterCreator.jsx";
import { usePlayer } from "./hooks/usePlayer.js";
import { createPlayer, repairPlayer } from "./utils/newPlayer.js";
import { SIM_MARKET } from "./sim/config.js";
import { enableSimMarket, marketOf, marketBehind, CATCHUP_SLICE } from "./utils/market.js";
import { loadSave, writeSave, flushSave, clearSave, exportSave, parseSave } from "./utils/save.js";
import { color, font } from "./styles/theme.js";

const TAB_TITLES = {
  combat: "Combat",
  carte: "Carte du monde",
  forge: "Atelier",
  coffre: "Coffre d'Aldenmoor",
  marche: "Marché d'Aldenmoor",
  sac: "Sac & Inventaire",
  journal: "Journal de quêtes",
  bestiaire: "Bestiaire",
  classement: "Classement",
  guilde: "Guilde",
  groupe: "Groupe",
};

// Sans sauvegarde : création du personnage. Avec : le jeu, sauvegardé automatiquement.
enableSimMarket(SIM_MARKET);   // les simulés vivent dans le marché du joueur

export default function App() {
  const [save, setSave] = useState(undefined);        // undefined = lecture de la sauvegarde en cours (IndexedDB, asynchrone)
  const [gameKey, setGameKey] = useState(0);
  useEffect(() => {
    let on = true;
    loadSave().then((d) => { if (on) setSave(d && { ...d, player: repairPlayer(d.player) }); }, () => { if (on) setSave(null); });
    return () => { on = false; };
  }, []);

  const start = (data) => { writeSave(data.player, data.world); setSave(data); setGameKey((k) => k + 1); };

  if (save === undefined) return <div style={{ padding: 24, color: "#c9b79c", fontFamily: "serif" }}>Chargement de la sauvegarde…</div>;
  if (!save) {
    return (
      <CharacterCreator
        onCreate={(opts) => start({ player: createPlayer(opts), world: initialWorld() })}
        onImport={(text) => { const d = parseSave(text); if (d) start({ ...d, player: repairPlayer(d.player) }); else window.alert("Fichier de sauvegarde invalide."); }}
      />
    );
  }
  return <Game key={gameKey} initial={save} onNewCharacter={() => { clearSave(); setSave(null); }} />;
}

function Game({ initial, onNewCharacter }) {
  const [activeTab, setActiveTab] = useState("personnage");
  const [guildTab, setGuildTab] = useState("apercu");     // l'onglet de guilde à l'ouverture (« defense » depuis l'alerte d'attaque)
  useEffect(() => { if (activeTab !== "guilde" && guildTab !== "apercu") setGuildTab("apercu"); }, [activeTab, guildTab]);
  const [world, setWorld] = useState(initial.world || initialWorld);   // position sur la carte, groupes vaincus (conservé en changeant d'onglet)
  const { player, setPlayer, stats, equipItem, unequipSlot, addCaracPoint, craft, refine, brew, upgrade, applyCombatRewards, gather, testAddResources, testAddGold, setAppearance, bank, bag, spellbook } = usePlayer(initial.player);
  const attack = myGuild(player)?.attacks?.[0] || null;        // une attaque en cours contre une sentinelle de ma guilde
  // Le résultat d'une attaque réglée sans moi : un message à l'écran (la dernière ligne du journal de la guilde qui parle de ma sentinelle)
  const [warMsg, setWarMsg] = useState(null);
  const seenLog = useRef(undefined);
  const topLog = myGuild(player)?.log?.[0] || null;
  useEffect(() => {
    const key = topLog ? `${topLog.t}|${topLog.txt}` : "";
    if (seenLog.current === undefined) { seenLog.current = key; return undefined; }     // au chargement : on ne rejoue pas l'ancien journal
    if (key === seenLog.current) return undefined;
    seenLog.current = key;
    const m = topLog && /^Ta sentinelle de .* (a été détruite par|a repoussé)/.exec(topLog.txt);
    if (!m) return undefined;
    setWarMsg({ ok: /repoussé/.test(m[0]), text: topLog.txt });
    const t = setTimeout(() => setWarMsg(null), 12000);
    return () => clearTimeout(t);
  }, [topLog?.t, topLog?.txt]); // eslint-disable-line

  // Un membre du groupe qui se déconnecte le quitte : un message le dit (un joueur exclu à la main est encore connecté, donc sans message)
  const [groupMsg, setGroupMsg] = useState(null);
  const prevGroup = useRef(player.companions || []);
  useEffect(() => {
    const now = player.companions || [], gone = prevGroup.current.filter((id) => !now.includes(id));
    prevGroup.current = now;
    if (!gone.length) return undefined;
    const pop = getLivePopulation(player);
    const names = gone.map((id) => pop.find((b) => b.id === id)).filter((b) => b && !isOnline(b)).map((b) => b.name);
    if (!names.length) return undefined;
    setGroupMsg(`${names.join(" et ")} ${names.length > 1 ? "se sont déconnectés et quittent" : "s'est déconnecté et quitte"} ton groupe.`);
    const t = setTimeout(() => setGroupMsg(null), 10000);
    return () => clearTimeout(t);
  }, [player.companions]); // eslint-disable-line

  // Le monde des simulés (qui vit dans le marché) rattrape le temps écoulé à l'ouverture, puis avance toutes les minutes
  // (par tranches : une semaine d'absence se rattrape en quelques secondes sans figer la page, voir CATCHUP_SLICE)
  const advanceMarket = useCallback(() => setPlayer((p) => { const m = marketOf(p, Date.now(), { maxSteps: CATCHUP_SLICE }); return cleanGroupAction(resolveDueAttacksNow(syncPlayerGuild(m === p.market ? p : { ...p, market: m }))); }), [setPlayer]);   // + ton activité compte pour les quêtes de ta guilde
  useEffect(() => {
    advanceMarket();
    const id = setInterval(advanceMarket, 60000);
    const idWar = setInterval(() => setPlayer((p) => cleanGroupAction(resolveDueAttacksNow(p))), 10000);     // les attaques de sentinelle se règlent à 10 secondes près
    return () => { clearInterval(id); clearInterval(idWar); };
  }, [advanceMarket, setPlayer]);
  const behind = marketBehind(player.market, Date.now());
  useEffect(() => {
    if (!behind) return undefined;
    const t = setTimeout(advanceMarket, 20);                      // tranche suivante : le rendu a eu le temps de passer
    return () => clearTimeout(t);
  }, [behind, player.market?.bucket, advanceMarket]);

  // Temps de jeu (classement) : on compte 30 s toutes les 30 s tant que l'onglet est visible et que tu as bougé, cliqué ou tapé dans les 5 dernières minutes
  const lastInput = useRef(Date.now());
  useEffect(() => {
    const touch = () => { lastInput.current = Date.now(); };
    const evs = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput.current < 5 * 60 * 1000) setPlayer((p) => ({ ...p, playSec: (p.playSec || 0) + 30 }));
    }, 30000);
    return () => { evs.forEach((e) => window.removeEventListener(e, touch)); clearInterval(id); };
  }, [setPlayer]);

  // Sauvegarde automatique (un peu différée pour ne pas écrire à chaque changement)
  const latest = useRef({ player, world });
  latest.current = { player, world };
  useEffect(() => {
    const t = setTimeout(() => writeSave(player, world), 400);
    return () => clearTimeout(t);
  }, [player, world]);
  useEffect(() => {
    const flush = () => flushSave(latest.current.player, latest.current.world);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  const downloadSave = () => {
    const blob = new Blob([exportSave(player, world)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aldenmoor-${player.name}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  // Contenu des lieux de la ville
  const renderBuilding = (kind) => {
    if (kind === "atelier") return <ForgePanel city={workshopOf(world)} player={player} onCraft={craft} onRefine={refine} onBrew={brew} onUpgrade={upgrade} onTestResources={testAddResources} onTestGold={testAddGold} />;
    if (kind === "coffre") return <BankPanel player={player} bank={bank} />;
    if (kind === "marche") return <MarketPanel player={player} onPlayerChange={setPlayer} />;
    if (kind === "panneau") return <QuestPanel player={player} onPlayerChange={setPlayer} atBoard />;
    return null;
  };

  const newCharacter = () => {
    if (window.confirm("Recommencer avec un nouveau personnage ? Le personnage actuel sera effacé (pense à exporter ta sauvegarde si tu veux le garder).")) onNewCharacter();
  };

  // Pour l'instant, cliquer sur un slot vide ne fait rien — l'équipement
  // se fait depuis le sac (InventoryPanel). Sera étendu plus tard pour
  // ouvrir un sélecteur direct depuis le slot si besoin.
  const handleEquipSlotClick = (slotKey) => {
    console.log("Slot vide cliqué :", slotKey);
  };

  return (
    <AppShell active={activeTab} onChangeTab={setActiveTab}>
      {warMsg && (
        <div data-war-msg onClick={() => setWarMsg(null)} style={{ position: "fixed", top: 14, right: 18, zIndex: 85, maxWidth: 380, cursor: "pointer", padding: "10px 14px", background: warMsg.ok ? "#14301a" : "#3a1612", border: `1px solid ${warMsg.ok ? "#3f8a4d" : "#a8443a"}`, borderRadius: 8, color: warMsg.ok ? "#c9ecce" : "#f1c9c2", boxShadow: "0 6px 20px rgba(0,0,0,.5)", fontSize: 14 }}>
          {warMsg.ok ? "🛡 " : "💥 "}{warMsg.text}
        </div>
      )}
      {groupMsg && (
        <div data-group-leave onClick={() => setGroupMsg(null)} style={{ position: "fixed", top: 62, right: 18, zIndex: 84, maxWidth: 380, cursor: "pointer", padding: "10px 14px", background: "#1d2230", border: "1px solid #4a6a9a", borderRadius: 8, color: "#cfe0f7", boxShadow: "0 6px 20px rgba(0,0,0,.5)", fontSize: 14 }}>
          👥 {groupMsg}
        </div>
      )}
      {attack && activeTab !== "guilde" && (
        <div data-defense-alert style={{ position: "fixed", top: 14, right: 18, zIndex: 80, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#3a1612", border: "1px solid #a8443a", borderRadius: 8, color: "#f1c9c2", boxShadow: "0 6px 20px rgba(0,0,0,.5)", fontSize: 14 }}>
          <span>⚔ Ta sentinelle de {SENT_BY_KEY[attack.region]?.name || "la région"} est attaquée !</span>
          <button style={{ cursor: "pointer", padding: "4px 12px", borderRadius: 6, border: "1px solid #a8443a", background: "#5a2119", color: "#fff" }} onClick={() => { setGuildTab("defense"); setActiveTab("guilde"); }}>Défendre</button>
        </div>
      )}
      {activeTab === "personnage" && (
        <CharacterSheet
          player={player}
          stats={stats}
          onEquipSlotClick={handleEquipSlotClick}
          onUnequip={unequipSlot}
          onAddCaracPoint={addCaracPoint}
          onEquipItem={equipItem}
          onSetAppearance={setAppearance}
          onExport={downloadSave}
          onNewCharacter={newCharacter}
          spellbook={spellbook}
        />
      )}
      {activeTab === "forge" && (
        <ForgePanel
          city={workshopOf(world)}
          player={player}
          onCraft={craft}
          onRefine={refine}
          onBrew={brew}
          onUpgrade={upgrade}
          onTestResources={testAddResources}
          onTestGold={testAddGold}
        />
      )}
      {activeTab === "coffre" && (
        <div style={{ padding: 24, height: "100%", overflow: "auto", boxSizing: "border-box" }}>
          <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 16 }}>Coffre d'Aldenmoor</div>
          <BankPanel player={player} bank={bank} />
        </div>
      )}
      {activeTab === "sac" && (
        <div style={{ padding: 24, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 16 }}>Sac & Inventaire</div>
          <div style={{ flex: 1, minHeight: 0 }}><BagPanel player={player} onEquip={equipItem} bank={bank} bag={bag} /></div>
        </div>
      )}
      {activeTab === "marche" && (
        <div style={{ padding: 24, height: "100%", overflow: "auto", boxSizing: "border-box" }}>
          <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 16 }}>Marché d'Aldenmoor</div>
          <MarketPanel player={player} onPlayerChange={setPlayer} />
        </div>
      )}
      {activeTab === "combat" && (
        <CombatScreen player={player} stats={stats} onRewards={applyCombatRewards} />
      )}
      {activeTab === "carte" && (
        <MapScreen player={player} onPlayerChange={setPlayer} stats={stats} world={world} setWorld={setWorld} onRewards={applyCombatRewards} onManageGroup={() => setActiveTab("groupe")} onGather={gather} renderBuilding={renderBuilding} />
      )}
      {activeTab === "journal" && (
        <div style={{ padding: 24, height: "100%", overflow: "auto", boxSizing: "border-box" }}>
          <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 16 }}>Journal de quêtes</div>
          <QuestPanel player={player} onPlayerChange={setPlayer} />
        </div>
      )}
      {activeTab === "bestiaire" && <BestiaryPanel player={player} stats={stats} />}
      {activeTab === "classement" && <RankingPanel player={player} />}
      {activeTab === "guilde" && <GuildPanel player={player} stats={stats} onPlayerChange={setPlayer} firstTab={guildTab} />}
      {activeTab === "groupe" && <GroupPanel player={player} stats={stats} onPlayerChange={setPlayer} />}
      {activeTab !== "personnage" && activeTab !== "forge" && activeTab !== "coffre" && activeTab !== "marche" && activeTab !== "journal" && activeTab !== "combat" && activeTab !== "carte" && activeTab !== "bestiaire" && activeTab !== "classement" && activeTab !== "guilde" && activeTab !== "groupe" && activeTab !== "sac" && <ComingSoon title={TAB_TITLES[activeTab] || activeTab} />}
    </AppShell>
  );
}
