import React, { useState } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import CharacterSheet from "./components/character/CharacterSheet.jsx";
import ForgePanel from "./components/forge/ForgePanel.jsx";
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
  const { player, stats, equipItem, unequipSlot, addCaracPoint, craft, testAddResources, testAddGold } = usePlayer();

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
      {activeTab !== "personnage" && activeTab !== "forge" && <ComingSoon title={TAB_TITLES[activeTab] || activeTab} />}
    </AppShell>
  );
}
