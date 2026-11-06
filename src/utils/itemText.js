// Résumé textuel des stats d'un objet (utilisé par la Forge)
export function itemStatLines(item) {
  const lines = [];
  if (item.atk_phys) lines.push(`+${item.atk_phys} ATK Phys`);
  if (item.atk_magie) lines.push(`+${item.atk_magie} ATK Mag`);
  if (item.def_phys) lines.push(`+${item.def_phys} DEF Phys`);
  if (item.def_magie) lines.push(`+${item.def_magie} DEF Mag`);
  if (item.hp) lines.push(`+${item.hp} HP`);
  if (item.esquive) lines.push(`+${item.esquive}% Esquive`);
  if (item.critique) lines.push(`+${item.critique}% Crit`);
  return lines;
}
