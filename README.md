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
npm run test:ui     # test d'interface : joue un parcours complet dans un vrai navigateur (demande Playwright, voir scripts/test-ui.mjs)
```

Les tests sont de simples scripts Node, sans bibliothèque. GitHub les relance à chaque envoi (`.github/workflows/ci.yml`).
`node scripts/simulate-combat.js 200 5` simule des combats pour équilibrer (200 combats, niveau 5).
`node scripts/simulate-economy.js` donne le bilan de l'économie : or et drops par combat, revenu des récoltes, coût des sets, prix des agrandissements du coffre. Règle imposée par `test-economy.js` : dans un combat, l'or pur doit faire 25 à 55 % du revenu (à respecter pour chaque nouvelle région).

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/data/` | Toutes les données du jeu : classes, armes, objets, ressources, recettes, monstres, cartes. On équilibre ici, sans toucher à la logique. |
| `src/combat/` | Moteur de combat (sans React, déterministe avec une graine). |
| `src/utils/` | Logique pure : stats, progression, récolte, fabrication, coffre, raffinage, hôtel des ventes (annonces des joueurs simulés et les tiennes, prix fixés par les joueurs, taxe de mise en vente de 10 %, achat sans taxe), quêtes du jour et réputation de la ville, déplacements et chemins, sauvegarde. |
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

## Avantages des métiers

Tous les métiers montent jusqu'au **niveau 100** (30 xp × niveau pour passer au suivant, environ 148 500 xp au total). Chaque niveau apporte un peu plus, affiché dans l'Atelier avec la valeur du niveau suivant ; les premiers niveaux comptent plus que les derniers. Maximums au niveau 100 : **Récolte** (bûcheron, mineur, herboriste) récolte de 5 s au niveau 1 à 1 s au niveau 100 (`HARVEST_MS` dans `src/components/map/mapConstants.js`), 50 % de chance de récolte double, 20 % de chance de trouvaille d'une ressource peu commune (chêne, cuivre, sauge) ; **Raffinage** 40 % de chance de produire 1 unité de plus sans consommer plus ; **Fabrication** 30 % de chance de chef-d'œuvre (objet aux stats +10 %, vendu 25 % plus cher). Valeurs et courbe dans `src/utils/perks.js`, vérifiées par `test-perks.js`. Le contenu actuel (recettes et ressources jusqu'au niveau 3) ne remplit pas 100 niveaux : les prochaines régions apporteront des ressources et recettes de niveaux plus élevés, qui donneront plus d'xp.

## Sorts : rangs et barre de combat

Chaque classe a **10 sorts** (niveaux 1, 3, 5, 7, 9, 12, 18, 26, 34, 42, dans `src/data/classes.js`), mais la barre de combat est limitée : le **sort de l'arme** (toujours là) + **3 sorts de classe** au départ, 4 au niveau 10, 5 au niveau 25. On choisit donc ses sorts, dans le panneau « Sorts » de l'onglet Personnage (clic sur un emplacement, puis « Placer »).

Chaque niveau donne **1 point de sort**. Un sort monte du rang 1 au rang 5 : passer du rang r au rang r+1 coûte r points (10 points pour un sort au maximum), donc on ne peut pas tout monter (49 points au niveau 50). Chaque rang renforce le sort (+8 % de dégâts, poison, affaiblissements, parade…) et le rang 5 réduit son coût de 1 PA. « Réinitialiser » rend les points contre de l'or (50 × niveau). Tout est dans `src/utils/spellbook.js`, vérifié par `test-spellbook.js`. Sauvegarde : `player.spellbook = { ranks, loadout }` (absent des anciennes sauvegardes : valeurs par défaut, rien à migrer). Les sorts au-delà du niveau 12 sont des premières valeurs, à équilibrer avec les monstres des prochaines régions.

## Les trois régions (niveaux 1 à 20)

Zone 1 est découpée en trois cartes de difficulté croissante, chacune avec ses monstres, son butin et sa propre ambiance visuelle (`theme` dans `src/data/maps.js`) : **Prairies Sauvages** (niveaux 1 à 8), **Champs Calcinés** (8 à 14, squelettes de fermiers, corbeaux, épouvantails et leur mini-boss l'Épouvantail Ancestral) et **Lisière des Ombres** (14 à 20, loups-garous, esprits errants, chevaliers déchus ; son mini-boss est le Veilleur Corrompu, voir plus bas). Les ennemis sont dans `src/data/zones.js`, les groupes dans `src/data/encounters.js`.

`node scripts/simulate-zones.js 100 squelettes,garous` fait jouer un joueur automatique de chaque classe contre les rencontres, à plusieurs niveaux (le niveau conseillé et trois niveaux plus bas), et affiche le taux de victoire et les PV restants. Objectifs : un groupe ordinaire gagné ≥ 85 % avec 35 à 70 % des PV restants au niveau conseillé, un mini-boss gagné 50 à 80 %, et trop dur trois niveaux plus bas. La simulation équipe le joueur de son palier d'équipement (palier 1 jusqu'au niveau 9, palier 2 de 10 à 15, palier 3 à partir de 16), sans la cape, les amulettes ni l'anneau : ces objets sont donc une marge de sécurité en plus.

## Équipement par paliers

Chaque région a son équipement, fabriqué avec ses drops (`src/data/gearTiers.js`). **Palier 1** (Prairies) : Vétéran, Apprenti, Traqueur. **Palier 2** (Champs Calcinés) : Plates du Fossoyeur (guerrier), Plumage du Charognard (assassin), Atours du Brasier (magicien). **Palier 3** (Lisière) : Harnois du Chevalier Déchu, Pelage du Loup-Garou, Mante de l'Esprit Errant. Chaque set a 5 pièces, une arme de la classe (et un bouclier pour le guerrier) ; les stats valent environ ×1,35 (palier 2) et ×1,9 (palier 3) celles du palier 1. Les nouveaux bonus de 5 pièces : riposte plus forte et épines (renvoi de 20 % des dégâts en feu noir), vol de vie, sorts qui ignorent une part de la défense (voir `src/combat/engine.js`).

Les trophées des boss donnent des objets communs à toutes les classes, fabriqués par le **Bijoutier** (nouveau métier : anneau du Cavalier Déchu, amulette de l'Armure Maudite, amulette du Cœur de Braise) et le Tailleur (cape de l'Épouvantail Ancestral). Un set de palier supérieur demande un niveau de métier plus élevé (+3 au palier 2, +6 au palier 3, voir `professions.js`). Les emplacements de reliques restent vides pour l'instant, réservés aux futurs boss. `test-gear.js` vérifie les paliers (stats croissantes, métiers, effets de combat).

## Le Veilleur Corrompu (boss de la Lisière)

Tout au bout de la carte de la Lisière des Ombres, dans le coin est. Il réapparaît au même rythme que les autres groupes (un groupe peut avoir son propre `respawnMs` dans `maps.js`, mais le Veilleur n'en a pas). Trois temps de combat :
- **Garde** : frappes lourdes qui brisent l'armure (Frappe écrase-garde) et **Regard du néant**, qui retire 2 PA au prochain tour du héros.
- **Appel**, sous 66 % de vie : il fait venir **2 esprits errants** (nouvelle mécanique `summon` des phases, dans `engine.js`). Ils entrent dans l'ordre de jeu juste après lui, ne rapportent ni xp, ni or, ni butin, et on ne dépasse jamais 3 ennemis.
- **Rage**, sous 33 % : +40 % d'attaque, et il débloque Feu noir et Souffle putride (actions avec `needsPhase`).

Butin : l'**Essence du Veilleur** (60 %, 1 à 2) et, à **5 %** seulement, une **arme unique propre à ta classe**. Il n'y a qu'un seul tirage : l'objet qui tombe est celui de la classe du joueur (`forClass` dans les drops de `zones.js`), donc chaque classe a exactement la même chance. Le boss ne lâche pas la clé du donjon : elle se fabrique (voir « Le Bricoleur »).
- **Lame du Veilleur** (guerrier, épée à une main) : ATK 46, DEF, PV, et « Dernier souffle » : une fois par combat, un coup mortel laisse 35 % des PV.
- **Croc du Veilleur** (assassin, dague) : ATK 40, 10 % critique, 6 % esquive, et 7 % des dégâts infligés rendus en PV.
- **Sceptre du Veilleur** (magicien, bâton à deux mains) : ATK magique 38, DEF magique, PV, et les sorts ignorent 25 % de la défense.

Ces armes sont légendaires, non fabricables, et gardent le type d'arme de leur classe (donc ses sorts). Leur `passive` est lu par `calcStats().passives` puis par le moteur de combat, avec les mêmes drapeaux que les bonus de set. L'emplacement de relique reste vide, pour un futur boss.

**Chaîne de quêtes** au tableau d'Aldenmoor (`CHAIN_QUESTS` dans `quests.js`, à partir du niveau 14, dans l'ordre, une seule fois) : faire taire 8 esprits errants, mettre 6 chevaliers déchus au repos, puis vaincre le Veilleur. Elles paient or, xp et réputation, jamais l'arme unique. `test-boss.js` vérifie le boss, l'appel, la rage, les armes uniques et la chaîne.

## Le Bricoleur (clés des donjons)

Nouveau métier de fabrication : il ne fait que les **clés de donjon**. Pour l'instant une seule, la **Clé du Manoir Englouti** (accessible dès le niveau 1 du métier, pour qu'on puisse y gagner de l'xp) : 3 Essences du Veilleur, 6 lingots de fer, 3 lingots de cuivre, 5 ectoplasmes et 500 or. La clé est un objet de type `cle` : elle reste dans le sac et ne s'équipe pas (`equipItem` ignore tout objet sans emplacement). Avantage du métier : jusqu'à 50 % de chance (au niveau 100) de ne consommer aucune ressource en fabriquant (l'or est dépensé quand même ; pas de chef-d'œuvre pour les clés). Les clés des prochains donjons s'ajouteront à `recipes.js`, avec un objet `type: "cle"`.

## Raffinage

Entre la récolte et la fabrication, il y a le raffinage, à l'atelier : quatre métiers (fondeur, scieur, tanneur, tisserand), chacun avec son niveau. Deux matières brutes donnent une matière raffinée (lingot, planche, cuir, étoffe, fil), qui vaut un peu plus que les deux brutes, en échange d'un peu d'or et de temps. Les recettes d'équipement demandent maintenant ces matières raffinées. Les ressources raffinées se vendent à l'hôtel des ventes (les joueurs simulés en proposent) et certaines quêtes de livraison les demandent. Données dans `src/data/refining.js` ; `node scripts/simulate-economy.js` affiche le bénéfice de chaque transformation.

## Quêtes et réputation

Le tableau de quêtes d'Aldenmoor (bâtiment de la ville) propose chaque jour une sélection de quêtes : vaincre des monstres, récolter, rapporter des ressources (retirées du sac à la remise, on peut donc les acheter à l'hôtel des ventes) ou fabriquer un objet. On en garde 3 en cours, le Journal les suit. Seuls les combats, récoltes et fabrications faits après l'acceptation comptent (compteurs dans `src/utils/counters.js`). Chaque quête donne or, xp et réputation à la ville : chaque niveau de réputation ajoute +3 % d'or aux quêtes, et tous les 2 niveaux +5 emplacements au coffre. Les modèles sont dans `src/data/quests.js`, la logique dans `src/utils/quests.js`. Règle testée : une quête ne paie jamais plus de 1,25 × la valeur du travail demandé (marché ou monstres).

## Vision du monde (à construire plus tard)

- **Villes revendiquables.** Chaque grande région aura sa grande ville et son hôtel des ventes, comme dans New World. Une guilde peut revendiquer la ville et contrôler le territoire. Elle fixe la taxe de mise en vente de la ville, de 1 % à 30 %, et cette taxe va dans le coffre de guilde géré par le chef. Une ville sans guilde garde la taxe par défaut de 10 % (`TAX_RATE` dans `src/utils/market.js`). Acheter reste toujours sans taxe. Cela demandera un marché et un taux par ville.
- **Ressources uniques par région.** Chaque grande région a des ressources introuvables ailleurs (par exemple le minerai d'or, nom à éviter pour ne pas confondre avec la monnaie, uniquement en région 3). On les réserve aux recettes de haut niveau de la région, pour ne jamais bloquer un joueur, et il faudra décider comment elles circulent entre villes (transport, bots marchands). Les bots posteront alors leurs annonces selon la région où la ressource existe.

## Idées à venir

**Groupes de 3 (en cours)** : depuis la fenêtre d'engagement sur la carte, **« En groupe »** emmène deux alliés bots (les deux autres classes, au niveau du joueur, avec l'équipement de leur palier : `src/sim/partyBots.js`). Le moteur gère plusieurs héros (`allies` dans `createCombat`, ids `ally0` / `ally1`) : ils entrent dans l'ordre d'initiative, jouent seuls (le sort le plus rentable sur l'ennemi le plus faible, sans parade ni soutien), et les ennemis visent un héros vivant au hasard. Seul le joueur compte pour la défaite (sa mort perd le combat) et pour le butin : xp, or et drops sont ceux d'un combat solo, et les renforts du Veilleur ne rapportent rien. Les ennemis ont **4,5 fois plus de PV** à 3 héros (`PARTY_HP_SCALE` dans `engine.js`, réglé avec `node scripts/simulate-zones.js 100 chevaliers,veilleur_boss --groupe`) : le groupe gagne plus sûrement qu'en solo, mais le combat est plus long. `test-party.js` vérifie tout ça.

Étapes suivantes possibles : des vrais joueurs dans le groupe (serveur), des bots qui se mettent en groupe entre eux et vivent sur la carte, un choix de compagnons, des récompenses adaptées au groupe, l'IA des bots (parade, sorts de soutien).

Enchères à l'hôtel des ventes, vrais joueurs sur le même marché, joueurs simulés dans les régions, groupes et guildes, régions 2 et 3, emplacements d'équipement restants.
