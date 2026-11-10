// ============================================================
// ÉQUIPER UNE PIÈCE (logique pure, testée dans scripts/test-equipreq.js ; le hook usePlayer l'appelle)
//   - il faut un emplacement, et le niveau minimum de la pièce (utils/equipReq.js) ;
//   - l'ancienne pièce de l'emplacement retourne au sac ;
//   - une arme à deux mains renvoie le bouclier au sac ; un bouclier ne s'équipe pas avec une arme à deux mains ;
//   - le sac doit avoir la place pour ce qui y revient (bagGuard).
// Renvoie le même objet `prev` quand rien ne change.
// ============================================================
import { canEquipAtLevel } from "./equipReq.js";
import { bagGuard } from "./bag.js";

export function equipOn(prev, item) {
  const slot = item.type; // ex: "chapeau", "arme", "bouclier"
  if (!(slot in prev.equipped)) return prev;   // clés et autres objets sans emplacement : ne s'équipent pas
  if (!canEquipAtLevel(item, prev.level)) return prev;   // niveau minimum
  const previousItem = prev.equipped[slot];
  const newEquipped = { ...prev.equipped, [slot]: item };
  let newInventory = prev.inventory.filter((i) => i.uid !== item.uid);

  // L'item déjà présent dans ce slot (s'il y en avait un) retourne dans l'inventaire au lieu de disparaître.
  if (previousItem) newInventory = [...newInventory, previousItem];

  // Armes à deux mains : équiper une arme twoHanded déséquipe automatiquement le bouclier (retourné dans l'inventaire).
  if (slot === "arme" && item.twoHanded && prev.equipped.bouclier) {
    newInventory = [...newInventory, prev.equipped.bouclier];
    newEquipped.bouclier = null;
  }
  // Inversement : équiper un bouclier alors qu'une arme à deux mains est en place n'est pas autorisé.
  if (slot === "bouclier" && prev.equipped.arme?.twoHanded) return prev;

  return bagGuard(prev, { ...prev, equipped: newEquipped, inventory: newInventory });
}
