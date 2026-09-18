# PRD — Trio

## Objectif du produit

Une application web permettant de jouer au jeu de cartes **Trio** (mode
Simple), en local, avec un mélange libre de joueurs humains et de joueurs
IA, de 3 à 6 joueurs.

## Acteurs

- **Joueur humain** : une personne qui interagit avec l'écran (une seule
  application partagée, à tour de rôle si plusieurs humains).
- **Joueur IA** : un joueur simulé par l'application, qui joue seul sans
  intervention humaine.
- **Système** : l'application elle-même (distribution des cartes, arbitrage
  des tours, détection de fin de partie).

## Règle d'équité pour les joueurs IA

Un joueur IA ne doit jamais accéder à une information cachée. Pour décider
de son coup, il ne peut utiliser que :
- le contenu de **sa propre main** (un joueur, humain ou IA, connaît
  toujours ses propres cartes) ;
- l'ensemble des **informations révélées publiquement** depuis le début de
  la partie (toute carte retournée au cours d'un tour, y compris les cartes
  qui ne formaient pas un trio et qui sont ensuite remises face cachée).

Un joueur IA ne connaît jamais le contenu d'une main adverse ou d'une pile
au-delà de ce qui a été révélé par le jeu normal.

---

## UC-1 — Configurer une nouvelle partie

**Acteur** : Joueur humain (celui qui met en place la partie)

**Objectif** : Démarrer une nouvelle partie de Trio avec la composition de
joueurs souhaitée.

**Pré-conditions** : L'application est ouverte sur l'écran d'accueil.

**Scénario principal** :
1. Le joueur choisit le nombre total de joueurs (de 3 à 6).
2. Le système propose un nombre de cartes par main par défaut, dépendant du
   nombre de joueurs. Le joueur peut le conserver ou le modifier ; cette
   même valeur s'applique à toutes les mains de la partie.
3. Pour chaque joueur, le joueur indique s'il s'agit d'un **humain** ou
   d'une **IA**, et lui donne un nom (un nom par défaut est proposé si le
   champ est laissé vide).
4. Le joueur valide la configuration et démarre la partie.
5. Le système distribue les cartes entre toutes les mains (selon le nombre
   de cartes choisi) et les piles de la table (les cartes restantes).

**Scénarios alternatifs** :
- **Aucun joueur humain** : tous les joueurs sont des IA. La partie démarre
  directement en mode spectateur (voir UC-2, scénario "aucun joueur
  humain").
- **Modification avant validation** : le joueur peut changer le nombre de
  joueurs, le nombre de cartes par main, ou les noms/types, tant que la
  partie n'a pas été démarrée. Changer le nombre de joueurs réinitialise le
  nombre de cartes par main à sa valeur par défaut pour ce nombre de
  joueurs.
- **Valeur hors limites** : le système empêche de choisir un nombre de
  cartes par main qui ne laisserait plus aucune carte pour la table, ou qui
  dépasserait les cartes disponibles.

---

## UC-2 — Découvrir sa main en début de partie

**Acteur** : Joueur humain

**Objectif** : Prendre connaissance du contenu de sa propre main, trié du
plus petit au plus grand, sans que les autres joueurs humains ne la voient.

**Pré-conditions** : La partie vient d'être configurée et les cartes
distribuées (suite de l'UC-1).

**Scénario principal (plusieurs joueurs humains)** :
1. Le système invite les autres joueurs à ne pas regarder l'écran et
   indique quel joueur humain doit consulter sa main.
2. Le joueur concerné confirme qu'il est prêt et affiche sa main.
3. Le joueur mémorise sa main puis la cache.
4. Le système passe au joueur humain suivant, jusqu'à ce que tous les
   joueurs humains aient consulté leur main.
5. Une fois tous les joueurs humains passés, la partie commence (UC-3).

**Scénarios alternatifs** :
- **Un seul joueur humain** : aucune étape de passage n'est nécessaire. La
  main de ce joueur reste affichée à l'écran en permanence, y compris
  pendant le déroulement de la partie, puisqu'aucun autre humain n'est
  présent pour la voir.
- **Aucun joueur humain** : l'étape est entièrement ignorée, la partie
  démarre directement en mode spectateur ; aucune main n'est affichée en
  clair (les IA n'ont pas besoin d'un affichage pour "voir" leur main).
- **Joueurs IA mêlés à des joueurs humains** : seuls les joueurs humains
  passent par cette étape ; les joueurs IA sont ignorés lors de ce tour de
  consultation.

---

## UC-3 — Jouer un tour

**Acteur** : Joueur actif (humain ou IA), à qui c'est le tour de jouer

**Objectif** : Tenter de révéler trois cartes de même valeur (un trio) parmi
les positions accessibles : les deux extrémités de chaque main encore en
jeu, et le dessus de chaque pile de la table.

**Pré-conditions** : La partie est en cours, ce n'est le tour de personne
d'autre.

**Scénario principal (trio réussi)** :
1. Le joueur actif révèle une première carte parmi les positions
   accessibles.
2. Il révèle une deuxième carte parmi les positions accessibles restantes.
3. Les deux valeurs révélées sont identiques : le joueur continue.
4. Il révèle une troisième carte parmi les positions accessibles restantes.
5. La troisième valeur est identique aux deux premières : le trio est
   remporté par le joueur actif, les trois cartes sont retirées du jeu.
6. Le joueur actif rejoue immédiatement un nouveau tour (retour à l'étape
   1), sauf si la partie se termine (voir UC-4).

**Scénarios alternatifs** :
- **Désaccord après la deuxième carte** : si la deuxième valeur révélée est
  différente de la première, le tour s'arrête immédiatement, les deux
  cartes sont remises face cachée à leur place, et la main passe au joueur
  suivant.
- **Désaccord après la troisième carte** : si la troisième valeur révélée
  est différente des deux premières, le tour s'arrête, les trois cartes
  sont remises face cachée à leur place, et la main passe au joueur
  suivant.
- **Aucune troisième carte accessible** : si les deux premières cartes
  révélées sont identiques mais qu'aucune position accessible restante ne
  peut compléter le trio à cet instant, le tour s'arrête comme un
  désaccord et la main passe au joueur suivant.
- **Tour joué par une IA** : les étapes sont identiques, mais c'est le
  système qui choisit les positions à révéler pour le compte de l'IA, en
  respectant la règle d'équité (sa propre main + informations déjà
  révélées publiquement). Le déroulement reste visible à l'écran, à un
  rythme permettant aux joueurs humains de suivre la partie.

---

## UC-4 — La partie se termine

**Acteur** : Système

**Objectif** : Déterminer la fin de la partie et annoncer le ou les
vainqueurs.

**Pré-conditions** : Une partie est en cours.

**Scénario principal (victoire directe)** :
1. Un joueur vient de remporter un trio (UC-3).
2. Le système constate que ce joueur possède désormais 3 trios (n'importe
   lesquels) ou le trio de valeur 7.
3. La partie s'arrête immédiatement, ce joueur est déclaré vainqueur.
4. Le système affiche le classement final de tous les joueurs (nombre de
   trios remportés).

**Scénarios alternatifs** :
- **Toutes les cartes ont été distribuées en trios** : plus aucune carte
  n'est en jeu alors qu'aucun joueur n'a atteint la condition de victoire
  directe. La partie s'arrête, le ou les joueurs ayant remporté le plus de
  trios sont déclarés vainqueurs (égalité possible).
- **Blocage** : il reste des cartes en jeu, mais plus aucun trio ne peut
  jamais être complété (par exemple, la dernière carte d'une valeur est
  définitivement inaccessible). La partie s'arrête, le ou les joueurs ayant
  remporté le plus de trios sont déclarés vainqueurs (égalité possible).

---

## UC-5 — Consulter les règles du jeu

**Acteur** : Joueur humain

**Objectif** : Relire les règles du Trio à tout moment.

**Pré-conditions** : Aucune (disponible depuis n'importe quel écran de
l'application).

**Scénario principal** :
1. Le joueur ouvre le panneau des règles.
2. Le système affiche la mise en place, le déroulement d'un tour et les
   conditions de victoire.
3. Le joueur ferme le panneau et reprend là où il en était.

---

## UC-6 — Démarrer une nouvelle partie

**Acteur** : Joueur humain

**Objectif** : Rejouer une nouvelle partie une fois la précédente terminée.

**Pré-conditions** : La partie précédente vient de se terminer (UC-4).

**Scénario principal** :
1. Le joueur consulte le classement final de la partie qui vient de se
   terminer.
2. Le joueur lance une nouvelle partie.
3. Le système revient à l'écran de configuration (UC-1).
