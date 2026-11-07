import React, { useState, useEffect, useRef } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import CharacterSheet from "./components/character/CharacterSheet.jsx";
import ForgePanel from "./components/forge/ForgePanel.jsx";
import CombatScreen from "./components/combat/CombatScreen.jsx";
import MapScreen from "./components/map/MapScreen.jsx";
import { initialWorld } from "./data/maps.js";
import BankPanel from "./components/city/BankPanel.jsx";
import MarketPanel from "./components/city/MarketPanel.jsx";
import QuestPanel from "./components/city/QuestPanel.jsx";
import ComingSoon from "./components/shared/ComingSoon.jsx";
import CharacterCreator from "./components/character/CharacterCreator.jsx";
import { usePlayer } from "./hooks/usePlayer.js";
import { createPlayer } from "./utils/newPlayer.js";
import { loadSave, writeSave, clearSave, exportSave, parseSave } from "./utils/save.js";
import { color, font } from "./styles/theme.js";

const TAB_TITLES = {
  combat: "Combat",
  carte: "Carte du monde",
  forge: "Atelier",
  coffre: "Coffre d'Aldenmoor",
  marche: "Marché d'Aldenmoor",
  sac: "Sac & Inventaire",
  journal: "Journal de quêtes",
};

// Sans sauvegarde : création du personnage. Avec : le jeu, sauvegardé automatiquement.
export default function App() {
  const [save, setSave] = useState(loadSave);
  const [gameKey, setGameKey] = useState(0);

  const start = (data) => { writeSave(data.player, data.world); setSave(data); setGameKey((k) => k + 1); };

  if (!save) {
    return (
      <CharacterCreator
        onCreate={(opts) => start({ player: createPlayer(opts), world: initialWorld() })}
        onImport={(text) => { const d = parseSave(text); if (d) start(d); else window.alert("Fichier de sauvegarde invalide."); }}
      />
    );
  }
  return <Game key={gameKey} initial={save} onNewCharacter={() => { clearSave(); setSave(null); }} />;
}

function Game({ initial, onNewCharacter }) {
  const [activeTab, setActiveTab] = useState("personnage");
  const [world, setWorld] = useState(initial.world || initialWorld);   // position sur la carte, groupes vaincus (conservé en changeant d'onglet)
  const { player, setPlayer, stats, equipItem, unequipSlot, addCaracPoint, craft, applyCombatRewards, gather, testAddResources, testAddGold, setAppearance, bank } = usePlayer(initial.player);

  // Sauvegarde automatique (un peu différée pour ne pas écrire à chaque changement)
  const latest = useRef({ player, world });
  latest.current = { player, world };
  useEffect(() => {
    const t = setTimeout(() => writeSave(player, world), 400);
    return () => clearTimeout(t);
  }, [player, world]);
  useEffect(() => {
    const flush = () => writeSave(latest.current.player, latest.current.world);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
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
    if (kind === "atelier") return <ForgePanel player={player} onCraft={craft} onTestResources={testAddResources} onTestGold={testAddGold} />;
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
        />
      )}
      {activeTab === "forge" && (
        <ForgePanel
          player={player}
          onCraft={craft}
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
        <MapScreen player={player} stats={stats} world={world} setWorld={setWorld} onRewards={applyCombatRewards} onGather={gather} renderBuilding={renderBuilding} />
      )}
      {activeTab === "journal" && (
        <div style={{ padding: 24, height: "100%", overflow: "auto", boxSizing: "border-box" }}>
          <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 16 }}>Journal de quêtes</div>
          <QuestPanel player={player} onPlayerChange={setPlayer} />
        </div>
      )}
      {activeTab !== "personnage" && activeTab !== "forge" && activeTab !== "coffre" && activeTab !== "marche" && activeTab !== "journal" && activeTab !== "combat" && activeTab !== "carte" && <ComingSoon title={TAB_TITLES[activeTab] || activeTab} />}
    </AppShell>
  );
}
