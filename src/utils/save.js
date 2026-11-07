// ============================================================
// Sauvegarde locale (localStorage) : personnage + position sur la carte.
// Versionnée : si le format change, on migre (ou on ignore l'ancienne
// sauvegarde) au lieu de planter.
// ============================================================
export const SAVE_KEY = "aldenmoor:save";
export const SAVE_VERSION = 1;

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION || !data.player || !data.player.classKey) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(player, world) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), player, world }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignoré */ }
}

// Export / import d'un fichier de sauvegarde (texte JSON)
export const exportSave = (player, world) => JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), player, world }, null, 1);

export function parseSave(text) {
  try {
    const data = JSON.parse(text);
    if (data && data.version === SAVE_VERSION && data.player && data.player.classKey) return data;
  } catch { /* ignoré */ }
  return null;
}
