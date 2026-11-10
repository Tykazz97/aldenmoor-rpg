// Interrupteur des joueurs simulés dans la ville (foule, pseudos, bulles, fil de discussion).
// Désactivés pour l'instant, en attendant que le jeu soit plus abouti : passer à true pour les remettre.
// Tout le code (src/sim, api/chat.js) est conservé et testé (scripts/test-sim.js, test-api.js).
export const SIM_PLAYERS = false;

// Aventuriers simulés sur les cartes de région : ils se promènent en groupe, vont affronter des groupes de monstres
// (qui disparaissent vraiment, puis réapparaissent comme d'habitude). Sans chat, donc sans appel au modèle de langage.
export const SIM_ON_MAPS = true;

// Départ de la vie des joueurs simulés (src/sim/lives.js). Chaque simulé a son personnage, qui progresse avec le temps réel.
//   mode "generated" : ils démarrent au niveau tiré par la génération de la population (pratique pour les tests)
//   mode "fresh"     : tout le monde repart du niveau 1 à `epoch` (le « fresh start » du lancement officiel)
// Changer `epoch` (ou le mode) remet TOUT à zéro : les simulés repartent du niveau 1 et la sauvegarde du joueur est ignorée (utils/save.js :
// chaque sauvegarde porte son epoch), donc il faut refaire un personnage ; les sauvegardes d'avant ce champ valent l'epoch 1.
// Pour le lancement : mode "fresh" et epoch = Date.now() du jour J (un nombre fixe, en millisecondes).
export const SIM_START = { mode: "generated", epoch: 1 };

// Marché relié aux simulés : leurs annonces viennent de leurs vrais sacs, ils achètent leurs ingrédients à l'hôtel des ventes
// et touchent l'or de leurs ventes (le monde des simulés est alors rangé dans la sauvegarde du joueur, avec son marché).
// À false : l'ancien marché abstrait.
export const SIM_MARKET = true;
