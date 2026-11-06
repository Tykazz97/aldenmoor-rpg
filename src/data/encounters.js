// ============================================================
// RENCONTRES — groupes d'ennemis que l'on peut lancer depuis
// l'onglet Combat. Pour l'instant : Région 1 (Prairies Sauvages).
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
];
