# Aldenmoor

RPG médiéval sombre dans le navigateur, au tour par tour, inspiré de Dofus : trois classes (guerrier, assassin, magicien), combat en grille avec initiative, métiers de récolte et de fabrication, carte en monde ouvert, ville centrale (atelier, coffre, marché, portail vers les régions).

Réalisé avec React 18 et Vite. Déployé sur Vercel à chaque envoi sur `main`. La partie est sauvegardée dans le navigateur (localStorage), avec export / import en fichier.

## Lancer le jeu

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` construit la version de production, `npm run preview` la sert en local.

## Tests

```bash
npm test           # validation des données + tous les tests (scripts/test-*.js)
npm run check      # tests puis build : à lancer avant d'envoyer
```

Les tests sont de simples scripts Node, sans bibliothèque. GitHub les relance à chaque envoi (`.github/workflows/ci.yml`).
`node scripts/simulate-combat.js 200 5` simule des combats pour équilibrer (200 combats, niveau 5).

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/data/` | Toutes les données du jeu : classes, armes, objets, ressources, recettes, monstres, cartes. On équilibre ici, sans toucher à la logique. |
| `src/combat/` | Moteur de combat (sans React, déterministe avec une graine). |
| `src/utils/` | Logique pure : stats, progression, récolte, fabrication, coffre, marché (prix selon l'offre et la demande), déplacements et chemins, sauvegarde. |
| `src/hooks/` | `usePlayer` : l'état du joueur et ses actions. |
| `src/components/` | L'affichage : `character`, `combat`, `map`, `forge`, `city`, `layout`, `shared`. |
| `src/sim/` | Joueurs simulés (200 aventuriers, vie en ville, discussion). **Désactivés** : interrupteur `SIM_PLAYERS` dans `src/sim/config.js`. |
| `api/` | Route `/api/chat` (fonction Vercel) qui fait parler les simulés avec un modèle de langage. Inutile tant que les simulés sont désactivés. |
| `scripts/` | Tests, validation des données, simulation de combat, génération des feuilles d'animation. |
| `public/assets/` | Images : héros animés, monstres, icônes, décors, bâtiments. |

Règle de base : la logique vit dans `src/utils`, `src/combat` et `src/data` (testable sans navigateur) ; les composants ne font que l'afficher.

## Données sauvegardées

Clé `aldenmoor:save` (localStorage) : `{ version, savedAt, player, world }`. En changeant la forme d'une sauvegarde, augmenter `version` dans `src/utils/save.js` et ajouter la migration.

## Joueurs simulés (désactivés)

Pour les remettre : `SIM_PLAYERS = true` dans `src/sim/config.js`. Pour qu'ils répondent avec un modèle de langage : ajouter `ANTHROPIC_API_KEY` dans les variables d'environnement de Vercel (voir `.env.example` et `api/chat.js`), puis fixer une limite de dépense dans la console Anthropic. Sans clé, ils utilisent des phrases préécrites.

## Idées à venir

Marché alimenté par les autres joueurs (annonces, enchères), simulés dans les régions, groupes et guildes, régions 2 et 3, emplacements d'équipement restants.
