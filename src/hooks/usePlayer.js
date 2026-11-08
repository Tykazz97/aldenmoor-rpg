import { creditPlayerFight } from "../utils/sentinel.js";
import { applyUpgrade } from "../utils/upgrade.js";
import { useState, useMemo, useCallback } from "react";
import { calcStats } from "../utils/calcStats.js";
import { RESOURCE_ORDER, RESOURCES } from "../data/resources.js";
import { applyCraft, applyRefine, applyBrew, addResourcesTo } from "../utils/crafting.js";
import { applyRewards } from "../utils/progression.js";
import { applyGather } from "../utils/gathering.js";
import { rankUp, equipSpell, resetRanks } from "../utils/spellbook.js";
import { bagGuard, upgradeBag } from "../utils/bag.js";
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
      if (!(slot in prev.equipped)) return prev;   // clés et autres objets sans emplacement : ne s'équipent pas
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

      return bagGuard(prev, { ...prev, equipped: newEquipped, inventory: newInventory });   // l'ancienne pièce (et le bouclier) reviennent au sac : il faut de la place
    });
  }, []);

  // Apparence cosmétique : null = suit l'équipement
  const setAppearance = useCallback((outfit) => setPlayer((prev) => ({ ...prev, appearance: outfit || null })), []);

  // Coffre
  const bank = useMemo(() => ({
    depositItem: (uid) => setPlayer((p) => depositItem(p, uid)),
    withdrawItem: (uid) => setPlayer((p) => bagGuard(p, withdrawItem(p, uid))),
    depositResource: (id, qty) => setPlayer((p) => depositResource(p, id, qty)),
    withdrawResource: (id, qty) => setPlayer((p) => bagGuard(p, withdrawResource(p, id, qty))),
    upgrade: () => setPlayer((p) => upgradeBank(p)),
  }), []);

  // Sac : agrandissement contre de l'or
  const bag = useMemo(() => ({ upgrade: () => setPlayer((p) => upgradeBag(p)) }), []);

  // Grimoire : rang d'un sort, emplacement de la barre, remise à zéro des rangs (contre de l'or)
  const spellbook = useMemo(() => ({
    rankUp: (id) => setPlayer((p) => rankUp(p, id)),
    equip: (slot, id) => setPlayer((p) => equipSpell(p, slot, id)),
    reset: () => setPlayer((p) => resetRanks(p)),
  }), []);

  const unequipSlot = useCallback((slotKey) => {
    setPlayer((prev) => {
      const item = prev.equipped[slotKey];
      if (!item) return prev;
      return bagGuard(prev, {
        ...prev,
        equipped: { ...prev.equipped, [slotKey]: null },
        inventory: [...prev.inventory, item],
      });
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
  // `opts` : { rate, city } = la taxe de la ville où l'on fabrique (voir utils/cityTax.js)
  const craft = useCallback((itemId, opts = {}) => {
    setPlayer((prev) => bagGuard(prev, applyCraft(prev, itemId, `craft-${Date.now()}-${craftCounter++}`, Math.random, opts)));
  }, []);

  // Raffinage : `times` unités d'une ressource raffinée (la validation est refaite sur l'état le plus récent)
  const refine = useCallback((id, times = 1, opts = {}) => {
    setPlayer((prev) => bagGuard(prev, applyRefine(prev, id, times, Math.random, opts).player));
  }, []);

  const brew = useCallback((id, times = 1, opts = {}) => {
    setPlayer((prev) => bagGuard(prev, applyBrew(prev, id, times, Math.random, opts).player));
  }, []);

  // Récompenses d'un combat gagné (xp, or, ressources, objets)
  // Amélioration d'une pièce (utils/upgrade.js) : `ref` = emplacement porté ou uid d'une pièce du sac
  const upgrade = useCallback((ref, opts) => { setPlayer((prev) => applyUpgrade(prev, ref, opts).player); }, []);

  const applyCombatRewards = useCallback((rewards) => {
    setPlayer((prev) => creditPlayerFight(applyRewards(prev, rewards, `loot-${Date.now()}-${craftCounter++}`).player, rewards.kills, `${prev.name || "p"}:${Date.now()}:${craftCounter}`));   // la sentinelle de la région tire son butin à part
  }, []);

  // Récolte d'un nœud sur la carte (ressource + xp de métier)
  const gather = useCallback((nodeId, qty, find = null) => {
    setPlayer((prev) => {
      let next = applyGather(prev, nodeId, qty, find).player;
      if (bagGuard(prev, next) !== next) next = applyGather(prev, nodeId, qty, null).player;      // pas de place pour la trouvaille
      return bagGuard(prev, next);
    });
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
    craft, refine, brew, upgrade, applyCombatRewards, gather, testAddResources, testAddGold, setAppearance, bank, bag, spellbook,
  };
}

