// ============================================================
// RENCONTRES — groupes d'ennemis que l'on peut lancer depuis
// la carte. Région 1 : Prairies Sauvages (niv. 1-8), Champs Calcinés (niv. 8-14), Lisière des Ombres (niv. 14-20).
// Plus tard, la carte de la région déclenchera ces rencontres.
// ============================================================

export const ENCOUNTERS = [
  { id: "loups", name: "Meute de loups", level: "Facile", enemies: ["loup_des_plaines", "loup_des_plaines", "loup_des_plaines"],
    desc: "Trois loups affamés. Rapides, mais fragiles." },
  { id: "sangliers", name: "Hardes de sangliers", level: "Facile", enemies: ["sanglier_sauvage", "sanglier_sauvage"],
    desc: "Deux bêtes solides. Leur charge fait mal." },
  { id: "bandits", name: "Embuscade de bandits", level: "Moyen", enemies: ["bandit_des_routes", "bandit_des_routes", "loup_des_plaines"],
    desc: "Des coupe-jarrets et leur chien de chasse. Ils brisent l'armure." },
  { id: "prairie", name: "La prairie dangereuse", level: "Moyen", enemies: ["bandit_des_routes", "sanglier_sauvage", "loup_des_plaines"],
    desc: "Un peu de tout ce que la plaine a de pire." },
  { id: "cavalier", name: "Le Cavalier Déchu", level: "Mini-boss", enemies: ["cavalier_dechu"],
    desc: "Ancien protecteur des prairies. Il entre en rage à mi-vie.", boss: true },

  // --- Champs Calcinés (niveaux 8 à 14) ---
  { id: "squelettes", name: "Squelettes de la ferme", level: "Moyen", enemies: ["squelette_fermier", "squelette_fermier"],
    desc: "Deux fermiers morts, lents mais solides. Leurs faux frappent fort." },
  { id: "corbeaux", name: "Nuée de corbeaux", level: "Moyen", enemies: ["corbeau_charognard", "corbeau_charognard", "corbeau_charognard"],
    desc: "Rapides, difficiles à toucher, et leur bec empoisonne." },
  { id: "epouvantails", name: "Épouvantails hantés", level: "Difficile", enemies: ["epouvantail_hante", "epouvantail_hante"],
    desc: "Ils s'animent quand on approche et crachent du feu." },
  { id: "champs", name: "Les champs maudits", level: "Difficile", enemies: ["squelette_fermier", "corbeau_charognard", "epouvantail_hante"],
    desc: "Tout ce que la corruption a réveillé dans les cultures brûlées." },
  { id: "epouvantail_boss", name: "L'Épouvantail Ancestral", level: "Mini-boss", enemies: ["epouvantail_ancestral"],
    desc: "Le maître des champs : poison, feu, et une fureur à mi-vie.", boss: true },

  // --- Lisière des Ombres (niveaux 14 à 20) ---
  { id: "garous", name: "Meute de loups-garous", level: "Difficile", enemies: ["loup_garou", "loup_garou"],
    desc: "Deux bêtes corrompues. Plus elles saignent, plus elles enragent." },
  { id: "esprits", name: "Esprits errants", level: "Difficile", enemies: ["esprit_errant", "esprit_errant"],
    desc: "Des spectres que l'armure ne protège pas : le froid ronge ta force." },
  { id: "chevaliers", name: "Chevaliers déchus", level: "Difficile", enemies: ["chevalier_dechu", "chevalier_dechu"],
    desc: "D'anciens soldats corrompus. Leur feu noir brûle longtemps." },
  { id: "lisiere", name: "La lisière hantée", level: "Difficile", enemies: ["loup_garou", "esprit_errant", "chevalier_dechu"],
    desc: "Un peu de tout ce que la forêt sombre cache." },
  { id: "veilleur_boss", name: "Le Veilleur Corrompu", level: "Mini-boss", enemies: ["veilleur_corrompu"],
    desc: "Le gardien de la lisière : garde écrasante, regard qui vole des PA, deux esprits à mi-vie, puis une rage de feu noir et de poison.", boss: true },
];
