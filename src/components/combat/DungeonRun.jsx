import React, { useState, useMemo } from "react";
import { Fight } from "./CombatScreen.jsx";
import RoomScene from "./RoomScene.jsx";
import { heroLook, heroSpriteUrl } from "../../data/heroSprites.js";
import { roomEncounter } from "../../utils/dungeon.js";
import { drinkPotion, consumePotion } from "../../utils/potions.js";
import { buildAllies } from "../../sim/partyBots.js";
import { groupOf } from "../../utils/group.js";
import { getLivePopulation } from "../../sim/simWorld.js";

// ------------------------------------------------------------
// Une expédition : à chaque salle, le groupe arrive d'abord dans la salle (décor, monstres, PV, potions à volonté), puis on lance le combat.
// Les PV se reportent d'une salle à l'autre ; seules les potions soignent. Le groupe est formé une fois pour toute l'expédition.
// La clé a déjà été consommée à l'entrée. `onDone(cleared)` quand on sort (victoire sur la dernière salle, défaite ou abandon).
// ------------------------------------------------------------
export default function DungeonRun({ dungeon, player, stats, onRewards, onPlayerChange, onDone }) {
  const [room, setRoom] = useState(0);
  const [fighting, setFighting] = useState(false);
  const allySpecs = useMemo(() => buildAllies(player, groupOf(player).members.map((b) => b.id), getLivePopulation(player), { fill: false }), []); // eslint-disable-line
  const looks = useMemo(() => [heroSpriteUrl(heroLook(player, stats)), ...allySpecs.map((a) => heroSpriteUrl(a.look))], []); // eslint-disable-line
  const [party, setParty] = useState(() => [
    { name: player.name || "Toi", hp: stats.maxHp, maxHp: stats.maxHp },
    ...allySpecs.map((a, i) => ({ name: a.name || `Allié ${i + 1}`, hp: a.stats.maxHp, maxHp: a.stats.maxHp })),
  ]);
  const weaponType = player.equipped.arme?.weaponType || null;

  const drink = (index, potionId) => {
    const r = drinkPotion(player, party, index, potionId);
    if (!r.drunk) return;
    setParty(r.party);
    onPlayerChange?.((p) => consumePotion(p, potionId));
  };

  if (!fighting) {
    return (
      <RoomScene
        key={room}
        dungeon={dungeon}
        index={room}
        player={player}
        party={party.map((h, i) => ({ ...h, src: looks[i] }))}
        onDrink={drink}
        onFight={() => setFighting(true)}
        onLeave={() => onDone(false)}
      />
    );
  }
  return (
    <Fight
      key={room}
      encounter={roomEncounter(dungeon, room)}
      player={player}
      stats={stats}
      weaponType={weaponType}
      heroSrc={looks[0]}
      party
      allySpecs={allySpecs}
      carry={{ player: party[0].hp, allies: party.slice(1).map((h) => h.hp) }}
      dungeon={{ index: room, total: dungeon.rooms.length }}
      onRewards={onRewards}
      onRestart={() => {}}
      onExit={(victory, end) => {
        if (!victory) { onDone(false); return; }
        if (room + 1 >= dungeon.rooms.length) { onDone(true); return; }
        setParty((ps) => ps.map((h, i) => ({ ...h, hp: i === 0 ? end.player : end.allies[i - 1] })));
        setRoom(room + 1);
        setFighting(false);
      }}
      backLabel="Sortir du manoir"
    />
  );
}
