// Décision d'un joueur IA. Ce module ne reçoit jamais l'état complet de la
// partie : uniquement la main du joueur IA (qu'il connaît légitimement) et
// le journal d'information publique (`publicMemory`), pour qu'une erreur
// d'implémentation future ne puisse pas silencieusement faire "tricher"
// l'IA en lui donnant accès aux mains adverses ou au contenu caché des
// piles.
import { locKey } from "./game.js";

// Une main triée de longueur L a sa carte de rang i (1 = extrémité gauche)
// bornée par le nombre d'exemplaires (3 par valeur) qui doivent tenir dans
// le reste de cette main. La longueur d'une main est publique (on voit le
// nombre de cartes d'un joueur) : ce n'est pas une information cachée.
// Seules les deux extrémités (i=1 et i=L) sont jamais accessibles.
function plausibleRange(loc) {
  if (loc.type !== "hand" || loc.handLength <= 1) return { min: 1, max: 12 };
  const L = loc.handLength;
  const bound = Math.ceil((L - 1) / 3);
  return loc.end === "left" ? { min: 1, max: 12 - bound } : { min: 1 + bound, max: 12 };
}

function isPlausible(loc, value) {
  const { min, max } = plausibleRange(loc);
  return value >= min && value <= max;
}

// Poids d'une position plausible pour une valeur cible donnée : 1 au centre
// de sa plage plausible, décroissant linéairement vers un plancher (jamais
// 0 — rester possible, juste moins probable) au bord de cette plage. Une
// plage large et bordée de peu de contraintes (piles, mains courtes) reste
// à poids neutre (1) : on n'a aucune raison de la sous-pondérer.
function positionWeight(loc, value) {
  const { min, max } = plausibleRange(loc);
  const center = (min + max) / 2;
  const halfRange = (max - min) / 2;
  if (halfRange === 0) return 1;
  const distance = Math.abs(value - center);
  return Math.max(0.15, 1 - distance / halfRange);
}

function weightedChoice(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// view = {
//   ownHand: [{ cardId, value }]           — la main du joueur IA, connue
//   publicMemory: { [locKey]: value }      — historique public des révélations
//   accessiblePositions: [loc...]          — positions accessibles à cet instant
//                                             (loc.handLength pour les positions de main)
//   revealed: [{ loc, value }]             — cartes déjà révélées ce tour-ci
// }
//
// Stratégie, par ordre de priorité :
//   1. Ouverture par exploration : en tout début de tour, une position
//      accessible de valeur inconnue. Révéler une carte déjà connue
//      n'apprend rien et fige la cible du tour sur cette seule valeur ;
//      explorer d'abord n'est jamais pire (si la carte tombe juste, la
//      règle 3 prendra le relais) et souvent meilleur (information
//      nouvelle sinon).
//   2. Ouverture par paire connue : seulement s'il ne reste plus aucune
//      position accessible de valeur inconnue, deux positions accessibles
//      de valeur connue identique entre elles.
//   3. Coup gagnant connu : pour une 2e/3e révélation, une position
//      accessible dont la valeur connue correspond à la cible du tour.
//   4. Exploration plausible : sinon, une position accessible de valeur
//      inconnue et plausible pour la cible (voir isPlausible), tirée au
//      sort pondérée par positionWeight (plus proche du centre de sa plage
//      plausible = plus probable, jamais totalement exclue en bord de
//      plage).
//   5. Repli : une position accessible quelconque.
export function chooseNextPick(view) {
  const { ownHand, publicMemory, accessiblePositions, revealed } = view;
  const ownHandValues = new Map(ownHand.map((c) => [c.cardId, c.value]));

  function knownValueOf(loc) {
    if (ownHandValues.has(loc.cardId)) return ownHandValues.get(loc.cardId);
    const key = locKey(loc);
    if (key in publicMemory) return publicMemory[key];
    return undefined;
  }

  const unknowns = accessiblePositions.filter((loc) => knownValueOf(loc) === undefined);

  if (revealed.length === 0) {
    if (unknowns.length > 0) {
      return unknowns[Math.floor(Math.random() * unknowns.length)];
    }
    const byValue = new Map();
    for (const loc of accessiblePositions) {
      const v = knownValueOf(loc);
      if (v === undefined) continue;
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(loc);
    }
    // Un choix déterministe (toujours la même paire) enfermerait l'IA dans
    // une tentative sans issue si cette paire précise n'a jamais de 3e
    // copie accessible, en ignorant une autre paire réellement gagnable :
    // on tire donc au sort parmi toutes les paires connues disponibles.
    const candidatePairs = [...byValue.values()].filter((locs) => locs.length >= 2);
    if (candidatePairs.length > 0) {
      const chosenPair = candidatePairs[Math.floor(Math.random() * candidatePairs.length)];
      return chosenPair[Math.floor(Math.random() * chosenPair.length)];
    }
    return accessiblePositions[Math.floor(Math.random() * accessiblePositions.length)];
  }

  const target = revealed[0].value;
  const match = accessiblePositions.find((loc) => knownValueOf(loc) === target);
  if (match) return match;

  const plausibleUnknowns = unknowns.filter((loc) => isPlausible(loc, target));
  if (plausibleUnknowns.length > 0) {
    return weightedChoice(plausibleUnknowns, (loc) => positionWeight(loc, target));
  }

  return accessiblePositions[Math.floor(Math.random() * accessiblePositions.length)];
}
