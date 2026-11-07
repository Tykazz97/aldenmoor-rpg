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
`node scripts/simulate-economy.js` donne le bilan de l'économie : or et drops par combat, revenu des récoltes, coût des sets, prix des agrandissements du coffre. Règle imposée par `test-economy.js` : dans un combat, l'or pur doit faire 25 à 55 % du revenu (à respecter pour chaque nouvelle région).

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/data/` | Toutes les données du jeu : classes, armes, objets, ressources, recettes, monstres, cartes. On équilibre ici, sans toucher à la logique. |
| `src/combat/` | Moteur de combat (sans React, déterministe avec une graine). |
| `src/utils/` | Logique pure : stats, progression, récolte, fabrication, coffre, hôtel des ventes (annonces des joueurs simulés et les tiennes, prix fixés par les joueurs, taxe de mise en vente de 10 %, achat sans taxe), quêtes du jour et réputation de la ville, déplacements et chemins, sauvegarde. |
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

## Quêtes et réputation

Le tableau de quêtes d'Aldenmoor (bâtiment de la ville) propose chaque jour une sélection de quêtes : vaincre des monstres, récolter, rapporter des ressources (retirées du sac à la remise, on peut donc les acheter à l'hôtel des ventes) ou fabriquer un objet. On en garde 3 en cours, le Journal les suit. Seuls les combats, récoltes et fabrications faits après l'acceptation comptent (compteurs dans `src/utils/counters.js`). Chaque quête donne or, xp et réputation à la ville : chaque niveau de réputation ajoute +3 % d'or aux quêtes, et tous les 2 niveaux +5 emplacements au coffre. Les modèles sont dans `src/data/quests.js`, la logique dans `src/utils/quests.js`. Règle testée : une quête ne paie jamais plus de 1,25 × la valeur du travail demandé (marché ou monstres).

## Vision du monde (à construire plus tard)

- **Villes revendiquables.** Chaque grande région aura sa grande ville et son hôtel des ventes, comme dans New World. Une guilde peut revendiquer la ville et contrôler le territoire. Elle fixe la taxe de mise en vente de la ville, de 1 % à 30 %, et cette taxe va dans le coffre de guilde géré par le chef. Une ville sans guilde garde la taxe par défaut de 10 % (`TAX_RATE` dans `src/utils/market.js`). Acheter reste toujours sans taxe. Cela demandera un marché et un taux par ville.
- **Ressources uniques par région.** Chaque grande région a des ressources introuvables ailleurs (par exemple le minerai d'or, nom à éviter pour ne pas confondre avec la monnaie, uniquement en région 3). On les réserve aux recettes de haut niveau de la région, pour ne jamais bloquer un joueur, et il faudra décider comment elles circulent entre villes (transport, bots marchands). Les bots posteront alors leurs annonces selon la région où la ressource existe.

## Idées à venir

Enchères à l'hôtel des ventes, vrais joueurs sur le même marché, joueurs simulés dans les régions, groupes et guildes, régions 2 et 3, emplacements d'équipement restants.
