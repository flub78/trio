# Trio

Trio est un jeu de cartes de mémoire et de déduction édité par Cocktail Games,
adaptation française du petit jeu japonais *Nana*. Le but est de deviner où se
cachent les 3 cartes portant le même numéro, qu'elles soient dans la main des
adversaires ou parmi les cartes posées sur la table.

Ce dépôt contient une implémentation web (HTML/CSS/JavaScript, sans
dépendance) du **mode Simple**, jouable localement avec un mélange libre de
joueurs humains (en pass-and-play sur un même écran) et de joueurs IA, de 3 à
6 joueurs. Voir `docs/PRD.md` pour la description fonctionnelle complète et
`docs/DESIGN.md` pour l'architecture.

## Lancer l'application

Le JavaScript est chargé en modules ES natifs : ouvrir directement
`index.html` en `file://` ne fonctionne pas (restriction des navigateurs sur
les modules). Servir le dossier via un petit serveur HTTP local, par exemple :

```sh
python3 -m http.server 8765
```

puis ouvrir `http://localhost:8765/` dans un navigateur.

## Structure du projet

- `index.html`, `style.css` — page et mise en forme.
- `game.js` — logique pure du jeu (distribution, tours, fin de partie),
  sans dépendance au DOM.
- `ai.js` — décision des joueurs IA (ne reçoit jamais l'état complet de la
  partie, uniquement la main du joueur IA et l'information déjà révélée
  publiquement).
- `ui.js` — rendu à l'écran et orchestration des tours.
- `main.js` — point d'entrée.

## Informations pratiques

- **Joueurs** : 3 à 6
- **Âge** : dès 7 ans
- **Durée** : environ 15 minutes

## Mise en place

1. Les cartes sont mélangées et distribuées face cachée à chaque joueur, selon
   un tableau de répartition en fonction du nombre de joueurs.
2. Les cartes restantes forment des piles face cachée, posées les unes à côté
   des autres au centre de la table.
3. Chaque joueur prend sa main sans la montrer aux autres et trie ses cartes
   de la plus petite à la plus grande valeur.

## Déroulement d'un tour

Le joueur actif révèle des cartes une à une, en ne pouvant révéler que celles
accessibles : aux deux extrémités des mains des joueurs, ou sur les piles de
la table.

- Il doit s'arrêter dès que deux numéros révélés sont différents.
- Sinon, il continue de révéler des cartes jusqu'à obtenir trois cartes
  identiques (un trio complet), qu'il remporte alors.

## Conditions de victoire

Le jeu propose deux modes :

- **Mode simple** : le premier joueur à remporter 3 trios (n'importe
  lesquels) ou le trio de 7 gagne la partie.
- **Mode Picante** : le premier joueur à remporter 2 trios *liés* entre eux
  gagne la partie. Les numéros liés sont indiqués dans les coins inférieurs
  des cartes (par exemple : trio 2 + trio 5, ou trio 2 + trio 9).
