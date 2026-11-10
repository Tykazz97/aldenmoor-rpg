// Les joueurs simulés ont des horaires : la nuit (vers 6 h UTC) personne n'est en ligne, donc aucun candidat pour le groupe.
// Les tests d'interface avancent donc l'horloge du jeu jusqu'au prochain soir (20 h 15 UTC) ; le temps continue de couler normalement.
export const eveningDelta = (now = Date.now()) => {
  const h = new Date(now).getUTCHours();
  if (h >= 17 && h <= 22) return 0;                   // déjà le soir : pas de décalage
  const d = new Date(now); d.setUTCHours(20, 15, 0, 0);
  let t = d.getTime(); if (t < now) t += 86400e3;
  return t - now;
};
export const skewClock = (page, delta) => page.addInitScript((dl) => {
  if (!dl) return;
  const R = Date;
  class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + dl); } static now() { return R.now() + dl; } }
  window.Date = D;
}, delta);
