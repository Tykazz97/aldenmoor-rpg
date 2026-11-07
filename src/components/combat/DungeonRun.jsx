import React, { useState } from "react";
import { Fight } from "./CombatScreen.jsx";
import { heroLook, heroSpriteUrl } from "../../data/heroSprites.js";
import { roomEncounter } from "../../utils/dungeon.js";

// ------------------------------------------------------------
// Une expédition : les salles à la suite, PV reportés de l'une à l'autre (pas de soin), butin récupéré à chaque salle gagnée.
// La clé a déjà été consommée à l'entrée. `onDone(cleared)` quand on sort (victoire sur la dernière salle, défaite ou abandon).
// ------------------------------------------------------------
export default function DungeonRun({ dungeon, player, stats, onRewards, onDone }) {
  const [room, setRoom] = useState(0);
  const [carry, setCarry] = useState(null);
  const weaponType = player.equipped.arme?.weaponType || null;
  const heroSrc = heroSpriteUrl(heroLook(player, stats));
  return (
    <Fight
      key={room}
      encounter={roomEncounter(dungeon, room)}
      player={player}
      stats={stats}
      weaponType={weaponType}
      heroSrc={heroSrc}
      party
      carry={carry}
      dungeon={{ index: room, total: dungeon.rooms.length }}
      onRewards={onRewards}
      onRestart={() => {}}
      onExit={(victory, end) => {
        if (!victory) { onDone(false); return; }
        if (room + 1 >= dungeon.rooms.length) { onDone(true); return; }
        setCarry({ player: end.player, allies: end.allies });
        setRoom(room + 1);
      }}
      backLabel="Sortir du manoir"
    />
  );
}
