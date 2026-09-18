# Plan d'implémentation — Trio

Ce plan part de l'implémentation existante (`index.html`, `style.css`,
`script.js` — un seul module non séparé, sans joueurs IA, mise en main en
pass-and-play uniquement) et décrit les étapes pour rejoindre l'architecture
du `docs/DESIGN.md` et couvrir tous les cas d'utilisation du `docs/PRD.md`.

Chaque étape produit un livrable testable. Les cases sont cochées au fur et
à mesure de l'avancement réel (pas par anticipation).

---

## Phase A — Mise en conformité technique (sans changement fonctionnel)

Objectif : faire correspondre le code existant à l'architecture modulaire du
design, à comportement strictement identique. Sert de filet de sécurité
avant d'ajouter les IA.

### Étape A1 — Extraire la logique pure dans `game.js`

**Livrable** : `game.js` contient la distribution des cartes, le calcul des
positions accessibles, la résolution d'un tour (comparaison 1/2/3 cartes) et
la détection de blocage (point fixe déjà validé), sans aucune dépendance au
DOM. `script.js` (ou son successeur) appelle ces fonctions au lieu de les
implémenter en place.

**Validation** : partie jouable manuellement dans le navigateur, comportement
identique à avant (mêmes règles, mêmes messages) ; le script de simulation
déjà utilisé pendant le développement (mains courtes, détection de blocage)
continue de passer en l'important depuis `game.js`.

- [x] `game.js` créé, logique pure déplacée
- [x] Plus aucune référence à `document`/DOM dans `game.js`
- [x] Script de simulation Node relancé en important `game.js` directement (100 parties, aucun crash ni boucle infinie)
- [ ] Partie humaine testée manuellement de bout en bout, sans régression *(à confirmer par l'utilisateur dans le navigateur)*

### Étape A2 — Séparer l'affichage (`ui.js`) et le point d'entrée (`main.js`)

**Livrable** : `ui.js` regroupe le rendu et les écouteurs d'événements,
`main.js` initialise l'état et démarre `ui.js`. `index.html` charge
`main.js` en `<script type="module">`. `script.js` est supprimé une fois
son contenu intégralement repris.

**Validation** : partie humaine complète (configuration → mise en main →
plateau → fin → nouvelle partie) rejouée manuellement sans régression,
servie via un serveur HTTP local (les modules ES l'exigent).

- [x] `ui.js` et `main.js` créés, `script.js` supprimé
- [x] `index.html` mis à jour (`type="module"`)
- [x] `README.md` mis à jour (lancement via serveur local, structure des fichiers)
- [ ] Partie humaine rejouée manuellement sans régression *(à confirmer par l'utilisateur dans le navigateur)*

---

## Phase B — Joueurs IA

Objectif : couvrir les parties du PRD encore absentes (UC-1 choix
humain/IA, UC-2 cas particuliers, UC-3 tour IA).

### Étape B1 — Modèle de données joueur + configuration humain/IA (UC-1)

**Livrable** : l'écran de configuration permet de choisir, pour chaque
joueur, humain ou IA (en plus du nom). Le type est stocké dans
`state.players[i].type`.

**Validation** : créer une partie avec un mélange humain/IA et vérifier que
la configuration est bien reflétée dans l'état (avant même que les IA ne
jouent réellement, cf. étapes suivantes).

- [x] Sélecteur Humain/IA par joueur sur l'écran de configuration
- [x] `type` propagé dans l'état de la partie

### Étape B2 — Journal d'information publique (`publicMemory`)

**Livrable** : à chaque carte révélée (tour humain ou IA), sa valeur est
enregistrée dans `publicMemory` selon sa position ; l'entrée est supprimée
quand la carte à cette position est retirée du jeu (trio complété).

**Validation** : test Node autonome (comme celui déjà utilisé pour la
détection de blocage) qui simule une partie et vérifie que `publicMemory`
reflète exactement l'historique attendu, y compris son invalidation après un
trio.

- [x] Mise à jour de `publicMemory` à chaque révélation
- [x] Invalidation de l'entrée quand la position change (carte retirée)
- [x] Test Node dédié qui passe (60 parties simulées, toutes assertions vérifiées)

### Étape B3 — Moteur de décision IA (`ai.js`)

**Livrable** : `ai.js` expose une fonction qui choisit une position à
révéler, en recevant uniquement la main du joueur IA et `publicMemory` (pas
l'état complet), selon la stratégie priorisée du design (coup gagnant connu
→ ouverture d'un coup gagnant → exploration → repli).

**Validation** : test Node qui simule des parties 100 % IA jusqu'à leur fin
(victoire, épuisement ou blocage) sans erreur, et qui vérifie par inspection
du code/paramètres que `ai.js` ne reçoit jamais les mains d'autrui ni le
contenu non révélé des piles.

- [x] `ai.js` créé, signature limitée à (main propre, `publicMemory`,
      positions accessibles) — jamais `state` complet
- [x] Stratégie de décision implémentée (les 4 priorités du design ; le
      choix de la paire d'ouverture est tiré au sort parmi toutes les
      paires connues, pas seulement la première trouvée, pour ne pas rester
      bloqué sur une paire dont la 3e copie s'avère inaccessible)
- [x] Test Node de parties 100 % IA : 2000 parties simulées, aucune erreur,
      terminaison correcte (26-28 tours en moyenne)
- [x] Affinage : filtre de plausibilité par position (DESIGN.md §4.5.1) —
      pendant la recherche d'une carte cible, exclut les positions
      structurellement impossibles compte tenu du tri des mains (ex :
      chercher un 3e 12 n'essaie jamais l'extrémité gauche d'une main de 4+
      cartes). Validé par un test Node dédié (2000 tirages, jamais de
      position impossible explorée) et revalidé sur 2000 parties 100 % IA
      sans régression.
- [x] Affinage : ouverture de tour par exploration (DESIGN.md §4.5) —
      révéler une carte déjà connue en 1re position n'apporte aucune
      information nouvelle ; l'IA explore désormais une carte inconnue en
      premier quand c'est possible, et ne se rabat sur une paire déjà
      connue que s'il n'en reste aucune. Validé par un test Node dédié et
      revalidé sur 2000 parties 100 % IA (aucune régression, et la partie
      se termine en moyenne deux fois plus vite : 26-28 → 16-17 tours).
- [x] Affinage : pondération par proximité au centre de la plage plausible
      (DESIGN.md §4.5.2) — le filtre de plausibilité élimine l'impossible
      mais pas l'improbable (ex : viser 4 sur l'extrémité droite d'une main
      de 6, plage `[3,12]`, reste rare mais possible) ; le tirage parmi les
      positions plausibles est désormais pondéré par la proximité au centre
      de leur plage, sans jamais exclure totalement une position en bord de
      plage. Validé par un test Node dédié (20 000 tirages : position en
      bord de plage nettement sous-représentée mais toujours présente) et
      revalidé sur 2000 parties 100 % IA sans régression.

### Étape B4 — Orchestration des tours IA dans `ui.js` (UC-3)

**Livrable** : quand c'est au tour d'un joueur IA, `ui.js` appelle `ai.js`
pour chaque révélation, applique le résultat via `game.js`, et affiche
chaque étape avec un court délai pour rester suivable par les humains
présents.

**Validation** : partie mixte (au moins un humain, au moins une IA) jouée
manuellement dans le navigateur ; les tours IA se déroulent automatiquement
et lisiblement, sans bloquer les tours humains.

- [x] Déclenchement automatique du tour IA (implémenté, `scheduleAiStepIfNeeded`)
- [x] Délai d'affichage entre chaque révélation IA (700 ms)
- [ ] Partie mixte testée manuellement de bout en bout *(à confirmer par l'utilisateur dans le navigateur)*

### Étape B5 — Mise en main adaptée (UC-2)

**Livrable** :
- plusieurs humains présents → pass-and-play inchangé, IA ignorées ;
- un seul humain → écran de mise en main sauté, sa main affichée en clair en
  continu sur le plateau ;
- aucun humain → mise en main entièrement sautée, démarrage direct en mode
  spectateur.

**Validation** : les trois scénarios testés manuellement dans le navigateur
(nombre et type de joueurs variés à la configuration).

- [ ] Cas plusieurs humains (inchangé) revérifié *(implémenté, à confirmer par l'utilisateur)*
- [ ] Cas un seul humain : main affichée en continu, pas d'étape de passage *(implémenté, à confirmer par l'utilisateur)*
- [ ] Cas aucun humain : démarrage direct *(implémenté, à confirmer par l'utilisateur)*

### Étape B6 — Mode spectateur (partie 100 % IA)

**Livrable** : une partie sans joueur humain se déroule automatiquement du
début à la fin, à un rythme regardable, jusqu'à l'écran de fin.

**Validation** : lancer une partie 100 % IA dans le navigateur et vérifier
qu'elle se termine correctement (victoire, épuisement ou blocage) sans
intervention.

- [ ] Partie 100 % IA jouée dans le navigateur jusqu'à la fin *(logique validée par simulation Node à l'étape B3 ; rendu/rythme réel à confirmer par l'utilisateur)*
- [ ] Écran de fin correct (vainqueur(s), classement) *(implémenté, à confirmer par l'utilisateur)*

---

## Phase C — Finition

### Étape C1 — Revue complète des cas d'utilisation du PRD

**Livrable** : chaque UC du `docs/PRD.md` (UC-1 à UC-6) rejoué manuellement
dans le navigateur, y compris les scénarios alternatifs.

**Validation** : passage manuel de chaque UC, un par un, sans anomalie.

- [ ] UC-1 (configuration, y compris 0 humain)
- [ ] UC-2 (mise en main, 3 scénarios)
- [ ] UC-3 (tour humain et tour IA, y compris désaccords et blocage local)
- [ ] UC-4 (les 3 fins de partie)
- [ ] UC-5 (règles du jeu)
- [ ] UC-6 (nouvelle partie)

### Étape C2 — Nettoyage et documentation

**Livrable** : code mort supprimé, `README.md` à jour (structure des
fichiers, mode IA, façon de lancer l'app), pas de régression.

- [x] Aucun fichier ni code obsolète restant (`script.js` notamment)
- [x] `README.md` à jour
- [x] Relecture finale de `index.html`/`style.css`/`game.js`/`ai.js`/`ui.js`/`main.js`

---

## Phase D — Nombre de cartes par main configurable

Objectif : couvrir l'évolution du PRD (UC-1) et du design (§4.1) qui rend
`handSize` réglable à la configuration, avec une valeur par défaut selon le
nombre de joueurs.

### Étape D1 — `game.js` : `handSize` en paramètre

**Livrable** : `createGame` reçoit `handSize` en paramètre au lieu de le
déduire d'une table fixe. Deux fonctions exportées pour que `ui.js` n'ait
pas à dupliquer la règle : `defaultHandSize(playerCount)` (6/5/4/4) et
`handSizeBounds(playerCount)` (`{min: 1, max: ⌊35/playerCount⌋}`).

**Validation** : test Node dédié — pour plusieurs couples (nombre de
joueurs, `handSize` valide), vérifie que chaque main reçoit exactement
`handSize` cartes et que le nombre de piles correspond aux cartes
restantes ; vérifie aussi les valeurs par défaut et les bornes.

- [x] `createGame(players, handSize)`
- [x] `defaultHandSize`/`handSizeBounds` exportées (utilisation par `ui.js` : étape D2)
- [x] Test Node dédié qui passe (défauts, bornes, répartition exacte pour
      min/défaut/max sur 3 à 6 joueurs) ; suite de régression complète
      revalidée (publicMemory + 2000 parties IA) sans changement

### Étape D2 — Écran de configuration (UC-1)

**Livrable** : un contrôle numérique pour `handSize` sur l'écran de
configuration, initialisé à la valeur par défaut du nombre de joueurs
courant, modifiable dans les bornes ; changer le nombre de joueurs
réinitialise `handSize` à son défaut.

**Validation** : test manuel dans le navigateur — vérifier le défaut par
nombre de joueurs, la réinitialisation au changement de nombre de joueurs,
le blocage en dehors des bornes, et que la partie démarrée respecte bien le
nombre de cartes choisi (mains + piles).

- [x] Contrôle `handSize` ajouté à l'écran de configuration
- [x] Bornes appliquées (clamping au blur/change du champ)
- [x] Réinitialisation au changement de nombre de joueurs
- [x] Testé dans le navigateur (Chrome, via Claude in Chrome) : défaut par
      nombre de joueurs (6/5/4/4), réinitialisation au changement de
      nombre de joueurs, blocage d'une valeur hors bornes (99 → clampé à
      5 pour 6 joueurs), et partie démarrée (6 joueurs, 5 cartes/main)
      confirmée conforme : 6×5=30 cartes en main, 6 piles sur la table
