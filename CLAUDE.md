# CLAUDE.md

Ce fichier donne les instructions de travail pour générer ce type de projet :
une application web simple (quelques pages HTML, ou une single-page
application) en **HTML / CSS / JavaScript vanilla**, sans framework ni étape
de build, destinée à tourner en local ou en hébergement statique.

Ces règles sont volontairement légères : elles s'appliquent à de petits
projets (quelques centaines de lignes, une poignée d'écrans/états), pas à des
applications lourdes qui justifieraient un build, un framework ou une suite
de tests automatisés complète.

## Méthode de travail : documentation avant code

Le développement suit toujours 4 documents, produits **dans cet ordre**.
**Chaque document (PRD, conception, plan) doit être explicitement validé par
l'utilisateur avant de passer à l'étape suivante.** Ne jamais enchaîner
directement sur l'étape suivante ou sur le code sans cette validation.

### 0. `README.md` (racine du projet)

- Toujours présent, tenu à jour.
- Décrit **globalement** le projet : ce que c'est, comment le lancer/tester,
  la structure des fichiers.
- Reste synthétique (pas un doublon du PRD ou du design).

### 1. `docs/PRD.md` — Product Requirements Document

- Contient **uniquement une description fonctionnelle** : aucun détail
  technique, aucune mention de stack ou d'architecture.
- Structuré par **cas d'utilisation**, chacun avec :
  - Acteur / objectif
  - Pré-conditions
  - Scénario principal (nominal)
  - Scénarios alternatifs / cas d'erreur
- Doit rester lisible par quelqu'un de non technique.
- ⏸️ **Validation obligatoire de l'utilisateur avant de passer au document de
  conception.**

### 2. `docs/DESIGN.md` — Document de conception

- **Stack de développement** retenue, avec justification si elle sort du
  défaut vanilla HTML/CSS/JS (ex : ajout d'une petite lib via CDN).
- **Architecture** : fichiers/modules du projet, principales classes ou
  objets, leurs responsabilités, leurs interactions (souvent simple pour ce
  type de projet : un état central + des fonctions de rendu).
- Des **diagrammes PlantUML** peuvent être intégrés (diagramme de classes, de
  séquence, d'états) quand ils clarifient réellement quelque chose — ne pas
  en ajouter par principe sur une architecture triviale.
- **Méthodes et algorithmes principaux** : structures de données clés,
  machine à états du parcours utilisateur, algorithmes non évidents.
- ⏸️ **Validation obligatoire de l'utilisateur avant de passer au plan
  d'implémentation.**

### 3. `docs/PLAN.md` — Plan d'implémentation

- Découpe le développement en **étapes**, chacune avec :
  - Son **livrable** concret
  - Son **mode de validation** (test manuel dans le navigateur, vérification
    d'un scénario du PRD, etc.)
- Utilise des **cases à cocher Markdown** (`- [ ]` / `- [x]`) pour tracer
  l'avancement, mises à jour au fur et à mesure de l'implémentation.
- ⏸️ **Validation obligatoire de l'utilisateur avant de démarrer
  l'implémentation.**

## Bonnes pratiques pour ce type de projet

**Stack et outillage**
- HTML / CSS / JS vanilla par défaut, sans build ni framework, sauf besoin
  explicite justifié dans le design.
- Pas de dépendance externe sans raison claire ; si une lib est utilisée
  (CDN), documenter pourquoi dans `DESIGN.md`.
- Structure de fichiers simple : `index.html`, `style.css`, `script.js` — ne
  découper davantage que si la taille du projet le justifie vraiment.

**Qualité du code**
- Pas de sur-ingénierie : pas d'abstraction, de configuration ou de couche
  générique pour un besoin qui ne le demande pas.
- Commentaires réservés au "pourquoi" non évident (contrainte cachée,
  contournement, invariant) — jamais au "quoi", déjà lisible dans le code.
- Gérer les erreurs et cas limites qui peuvent réellement se produire, pas
  ceux qui ne peuvent pas arriver.

**Accessibilité et compatibilité**
- HTML sémantique, attributs `alt`, contrastes suffisants, navigation au
  clavier fonctionnelle.
- Mise en page responsive par défaut (mobile inclus).
- Éviter les API JavaScript très récentes/expérimentales sans vérifier leur
  support navigateur, sauf besoin justifié.

**Sécurité**
- Échapper toute donnée utilisateur injectée dans le DOM (risque XSS).
- Aucun secret, clé ou identifiant dans le code client.

**Tests et validation**
- Pour ce type de projet, privilégier les vérifications manuelles dans le
  navigateur (parcourir les cas d'usage du PRD) plutôt qu'une suite de tests
  automatisés lourde.
- Quand la logique métier est non triviale (ex : une machine à états, un
  algorithme), un script Node autonome de simulation/vérification est
  suffisant et bienvenu — inutile d'installer un framework de test pour ça.

**Git**
- Commits petits et atomiques, messages clairs sur le *pourquoi*.
- Ne committer que sur demande explicite de l'utilisateur.

**Documentation**
- `README.md` et les documents de `docs/` restent synchronisés avec le code
  au fil de son évolution ; les mettre à jour si une décision change en
  cours de route plutôt que de laisser les documents devenir obsolètes.
