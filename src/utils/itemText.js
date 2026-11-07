// Résumé textuel des stats d'un objet (utilisé par la Forge)
import { plusFactor } from "./upgrade.js";
export function itemStatLines(item) {
  const lines = [];
  const f = plusFactor(item), v = (x) => (f > 1 ? Math.round(x * f) : x);       // une pièce améliorée montre ses stats +10 % par niveau
  if (item.atk_phys) lines.push(`+${v(item.atk_phys)} ATK Phys`);
  if (item.atk_magie) lines.push(`+${v(item.atk_magie)} ATK Mag`);
  if (item.def_phys) lines.push(`+${v(item.def_phys)} DEF Phys`);
  if (item.def_magie) lines.push(`+${v(item.def_magie)} DEF Mag`);
  if (item.hp) lines.push(`+${v(item.hp)} HP`);
  if (item.esquive) lines.push(`+${v(item.esquive)}% Esquive`);
  if (item.critique) lines.push(`+${v(item.critique)}% Crit`);
  if (item.desc) lines.push(item.desc);
  if (item.passiveDesc) lines.push(item.passiveDesc);
  return lines;
}
