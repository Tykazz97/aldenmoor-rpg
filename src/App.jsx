import React, { useState } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import CharacterSheet from "./components/character/CharacterSheet.jsx";
import ForgePanel from "./components/forge/ForgePanel.jsx";
import CombatScreen from "./components/combat/CombatScreen.jsx";
import MapScreen from "./components/map/MapScreen.jsx";
import { initialWorld } from "./data/maps.js";
import ComingSoon from "./components/shared/ComingSoon.jsx";
import { usePlayer } from "./hooks/usePlayer.js";

const TAB_TITLES = {
  combat: "Combat",
  carte: "Carte du monde",
  forge: "Forge",
  sac: "Sac & Inventaire",
  journal: "Journal de quêtes",
};

export default function App() {
  const [activeTab, setActiveTab] = useState("personnage");
  const [world, setWorld] = useState(initialWorld);   // position sur la carte, groupes vaincus (conservé en changeant d'onglet)
  const { player, stats, equipItem, unequipSlot, addCaracPoint, craft, applyCombatRewards, testAddResources, testAddGold } = usePlayer();

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
      {activeTab === "combat" && (
        <CombatScreen player={player} stats={stats} onRewards={applyCombatRewards} />
      )}
      {activeTab === "carte" && (
        <MapScreen player={player} stats={stats} world={world} setWorld={setWorld} onRewards={applyCombatRewards} />
      )}
      {activeTab !== "personnage" && activeTab !== "forge" && activeTab !== "combat" && activeTab !== "carte" && <ComingSoon title={TAB_TITLES[activeTab] || activeTab} />}
    </AppShell>
  );
}
