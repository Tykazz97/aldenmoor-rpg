import { useState, useMemo, useCallback } from "react";
import { calcStats } from "../utils/calcStats.js";
import { RESOURCE_ORDER, RESOURCES } from "../data/resources.js";
import { applyCraft, applyRefine, addResourcesTo } from "../utils/crafting.js";
import { applyRewards } from "../utils/progression.js";
import { applyGather } from "../utils/gathering.js";
import { depositItem, withdrawItem, depositResource, withdrawResource, upgradeBank } from "../utils/bank.js";

let craftCounter = 0;

export function usePlayer(initial) {
  const [player, setPlayer] = useState(initial);

  // Stats dérivées, recalculées seulement quand player change (évite le
  // recalcul à chaque render qui ralentissait l'ancienne version)
  const stats = useMemo(() => calcStats(player), [player]);

  const equipItem = useCallback((item) => {
    setPlayer((prev) => {
      const slot = item.type; // ex: "chapeau", "arme", "bouclier"
      const previousItem = prev.equipped[slot];
      const newEquipped = { ...prev.equipped, [slot]: item };
      let newInventory = prev.inventory.filter((i) => i.uid !== item.uid);

      // L'item déjà présent dans ce slot (s'il y en avait un) retourne
      // dans l'inventaire au lieu de disparaître.
      if (previousItem) {
        newInventory = [...newInventory, previousItem];
      }

      // Règle armes à deux mains : équiper une arme twoHanded déséquipe
      // automatiquement le bouclier (retourné dans l'inventaire).
      if (slot === "arme" && item.twoHanded && prev.equipped.bouclier) {
        newInventory = [...newInventory, prev.equipped.bouclier];
        newEquipped.bouclier = null;
      }
      // Inversement : équiper un bouclier alors qu'une arme à deux mains
      // est en place n'est pas autorisé — on ignore l'action.
      if (slot === "bouclier" && prev.equipped.arme?.twoHanded) {
        return prev;
      }

      return { ...prev, equipped: newEquipped, inventory: newInventory };
    });
  }, []);

  // Apparence cosmétique : null = suit l'équipement
  const setAppearance = useCallback((outfit) => setPlayer((prev) => ({ ...prev, appearance: outfit || null })), []);

  // Coffre
  const bank = useMemo(() => ({
    depositItem: (uid) => setPlayer((p) => depositItem(p, uid)),
    withdrawItem: (uid) => setPlayer((p) => withdrawItem(p, uid)),
    depositResource: (id, qty) => setPlayer((p) => depositResource(p, id, qty)),
    withdrawResource: (id, qty) => setPlayer((p) => withdrawResource(p, id, qty)),
    upgrade: () => setPlayer((p) => upgradeBank(p)),
  }), []);

  const unequipSlot = useCallback((slotKey) => {
    setPlayer((prev) => {
      const item = prev.equipped[slotKey];
      if (!item) return prev;
      return {
        ...prev,
        equipped: { ...prev.equipped, [slotKey]: null },
        inventory: [...prev.inventory, item],
      };
    });
  }, []);

  const addCaracPoint = useCallback((caracKey) => {
    setPlayer((prev) => {
      if (prev.caracPoints <= 0) return prev;
      return {
        ...prev,
        caracPoints: prev.caracPoints - 1,
        caracs: { ...prev.caracs, [caracKey]: (prev.caracs[caracKey] || 0) + 1 },
      };
    });
  }, []);

  // Craft : la validation est refaite sur l'état le plus récent, donc un
  // double-clic rapide ne peut pas consommer deux fois les mêmes ressources.
  const craft = useCallback((itemId) => {
    setPlayer((prev) => applyCraft(prev, itemId, `craft-${Date.now()}-${craftCounter++}`));
  }, []);

  // Raffinage : `times` unités d'une ressource raffinée (la validation est refaite sur l'état le plus récent)
  const refine = useCallback((id, times = 1) => {
    setPlayer((prev) => applyRefine(prev, id, times).player);
  }, []);

  // Récompenses d'un combat gagné (xp, or, ressources, objets)
  const applyCombatRewards = useCallback((rewards) => {
    setPlayer((prev) => applyRewards(prev, rewards, `loot-${Date.now()}-${craftCounter++}`).player);
  }, []);

  // Récolte d'un nœud sur la carte (ressource + xp de métier)
  const gather = useCallback((nodeId, qty, find = null) => {
    setPlayer((prev) => applyGather(prev, nodeId, qty, find).player);
  }, []);

  // --- Outils de test (à retirer quand le combat donnera les vrais drops) ---
  const testAddResources = useCallback((amounts = { commune: 10, peu_commune: 5, rare: 2 }) => {
    const gains = {};
    for (const id of RESOURCE_ORDER) {
      gains[id] = amounts[RESOURCES[id].rarity] || 0;
    }
    setPlayer((prev) => addResourcesTo(prev, gains));
  }, []);

  const testAddGold = useCallback((n = 500) => {
    setPlayer((prev) => ({ ...prev, gold: prev.gold + n }));
  }, []);

  return {
    player, setPlayer, stats,
    equipItem, unequipSlot, addCaracPoint,
    craft, refine, applyCombatRewards, gather, testAddResources, testAddGold, setAppearance, bank,
  };
}

