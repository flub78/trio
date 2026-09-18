// Logique pure du jeu Trio : distribution, positions accessibles,
// résolution d'un tour, détection de fin de partie. Aucune dépendance au
// DOM — ce module doit pouvoir être importé et testé depuis Node.

export const VALUES = Array.from({ length: 12 }, (_, i) => i + 1);
export const WILD_TRIO_VALUE = 7; // "trio de 7" gagne immédiatement en mode Simple
export const TRIOS_TO_WIN = 3;

const TOTAL_CARDS = VALUES.length * 3; // 36

// Valeur par défaut suggérée pour le nombre de cartes par main à l'écran de
// configuration (table officielle non publiée). Des piles d'une seule
// carte et des mains courtes limitent le risque qu'un trio reste bloqué,
// enterré derrière ses propres doublons.
export const DEFAULT_HAND_SIZE = { 3: 6, 4: 5, 5: 4, 6: 4 };

export function defaultHandSize(playerCount) {
  return DEFAULT_HAND_SIZE[playerCount];
}

// Le plafond garantit qu'il reste au moins 1 carte pour la table.
export function handSizeBounds(playerCount) {
  return { min: 1, max: Math.floor((TOTAL_CARDS - 1) / playerCount) };
}

function buildDeck() {
  const deck = [];
  for (const value of VALUES) {
    for (let k = 0; k < 3; k++) {
      deck.push({ id: `${value}-${k}`, value });
    }
  }
  return deck;
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// players: [{ name, type }] avec type: 'human' | 'ai'
// handSize : nombre de cartes par main, choisi à la configuration (UC-1),
// dans les bornes de handSizeBounds(players.length).
export function createGame(players, handSize) {
  const cards = {}; // id -> value
  const deck = shuffle(buildDeck());
  deck.forEach((c) => (cards[c.id] = c.value));

  let pointer = 0;
  const dealtPlayers = players.map(({ name, type }) => {
    const hand = deck
      .slice(pointer, pointer + handSize)
      .map((c) => c.id)
      .sort((a, b) => cards[a] - cards[b]);
    pointer += handSize;
    return { name, type, hand, trios: [] };
  });

  // Les cartes restantes forment la table, une carte par pile.
  const piles = deck.slice(pointer).map((c) => [c.id]);

  return {
    cards,
    players: dealtPlayers,
    piles,
    currentPlayerIndex: 0,
    revealed: [], // {loc, cardId} choisi ce tour-ci, pas encore résolu
    // Journal des valeurs déjà révélées publiquement, par position
    // (locKey -> valeur). C'est la seule source d'information sur les
    // mains/piles adverses autorisée pour un joueur IA (règle d'équité du
    // PRD) ; elle reste valable tant que la position n'est pas modifiée,
    // et est invalidée quand sa carte est retirée du jeu (trio complété).
    publicMemory: {},
    endReason: null, // 'trios' | 'exhausted' | 'stalemate'
    winners: null,
  };
}

export function cardValue(state, cardId) {
  return state.cards[cardId];
}

export function locKey(loc) {
  if (loc.type === "hand") return `hand-${loc.playerIndex}-${loc.end}`;
  return `pile-${loc.pileIndex}`;
}

function isRevealedLoc(state, loc) {
  return state.revealed.some((r) => locKey(r.loc) === locKey(loc));
}

export function getAccessiblePositions(state) {
  const positions = [];
  state.players.forEach((p, playerIndex) => {
    if (p.hand.length === 0) return;
    const leftId = p.hand[0];
    const rightId = p.hand[p.hand.length - 1];
    if (p.hand.length === 1) {
      positions.push({ type: "hand", playerIndex, end: "left", cardId: leftId });
    } else {
      positions.push({ type: "hand", playerIndex, end: "left", cardId: leftId });
      positions.push({ type: "hand", playerIndex, end: "right", cardId: rightId });
    }
  });
  state.piles.forEach((pile, pileIndex) => {
    if (pile.length === 0) return;
    positions.push({ type: "pile", pileIndex, cardId: pile[pile.length - 1] });
  });
  return positions.filter((loc) => !isRevealedLoc(state, loc));
}

function removeCardAt(state, loc) {
  if (loc.type === "hand") {
    const hand = state.players[loc.playerIndex].hand;
    const idx = loc.end === "left" ? 0 : hand.length - 1;
    hand.splice(idx, 1);
  } else {
    state.piles[loc.pileIndex].pop();
  }
}

// Détermine si une future séquence de jeu pourrait encore compléter un
// trio, en complétant virtuellement, de façon gloutonne, tout trio qui
// devient simultanément accessible sur une copie de travail des
// mains/piles. Une carte accessible non utilisée reste accessible
// indéfiniment (elle n'est retirée que si son trio se complète), donc
// cette approche gloutonne est exacte : si elle ne peut libérer aucun
// trio, aucun n'est jamais atteignable.
export function isDeadlocked(state) {
  const hands = state.players.map((p) => p.hand.slice());
  const piles = state.piles.map((p) => p.slice());
  let anyRemoved = false;
  let progressed = true;
  while (progressed) {
    progressed = false;
    const byValue = {};
    hands.forEach((hand) => {
      if (hand.length === 0) return;
      const v0 = cardValue(state, hand[0]);
      (byValue[v0] = byValue[v0] || []).push(() => hand.splice(0, 1));
      if (hand.length > 1) {
        const v1 = cardValue(state, hand[hand.length - 1]);
        (byValue[v1] = byValue[v1] || []).push(() => hand.splice(hand.length - 1, 1));
      }
    });
    piles.forEach((pile) => {
      if (pile.length === 0) return;
      const v = cardValue(state, pile[pile.length - 1]);
      (byValue[v] = byValue[v] || []).push(() => pile.pop());
    });
    for (const v in byValue) {
      if (byValue[v].length >= 3) {
        byValue[v].slice(0, 3).forEach((remove) => remove());
        progressed = true;
        anyRemoved = true;
        break; // redémarre le scan : les indices des tableaux ont changé
      }
    }
  }
  return !anyRemoved;
}

// Révèle une carte pour le tour en cours et renvoie ce qu'il s'est passé,
// SANS retirer de cartes ni faire avancer le tour : ces effets de bord
// sont appliqués par resolveOutcome(), pour laisser l'appelant (ui.js)
// marquer une pause d'affichage entre les deux.
//
// outcome.kind : 'awaiting' | 'mismatch' | 'no-third-accessible' |
//                'trio' | 'trio-mismatch'
export function pick(state, loc) {
  state.revealed.push({ loc, cardId: loc.cardId });
  state.publicMemory[locKey(loc)] = cardValue(state, loc.cardId);

  if (state.revealed.length < 2) {
    return { kind: "awaiting" };
  }

  const first = state.revealed[0];
  const latest = state.revealed[state.revealed.length - 1];

  if (state.revealed.length === 2) {
    const v1 = cardValue(state, first.cardId);
    const v2 = cardValue(state, latest.cardId);
    if (v1 !== v2) {
      return { kind: "mismatch", values: [v1, v2] };
    }
    if (getAccessiblePositions(state).length === 0) {
      return { kind: "no-third-accessible" };
    }
    return { kind: "awaiting" };
  }

  // 3e révélation
  const v1 = cardValue(state, first.cardId);
  const v3 = cardValue(state, latest.cardId);
  if (v1 === v3) {
    return { kind: "trio", value: v1 };
  }
  return { kind: "trio-mismatch" };
}

function finishByScore(state, reason) {
  const topScore = Math.max(...state.players.map((p) => p.trios.length));
  state.winners = state.players.filter((p) => p.trios.length === topScore);
  state.endReason = reason;
  return { status: reason, winners: state.winners };
}

// Applique les conséquences d'un outcome renvoyé par pick() (retrait des
// cartes, passage au joueur suivant, détection de fin de partie).
//
// résultat.status : 'continue-same-player' | 'continue-next-player' |
//                    'won' | 'exhausted' | 'stalemate'
export function resolveOutcome(state, outcome) {
  if (outcome.kind === "trio") {
    const player = state.players[state.currentPlayerIndex];
    state.revealed.forEach((r) => {
      removeCardAt(state, r.loc);
      delete state.publicMemory[locKey(r.loc)];
    });
    player.trios.push(outcome.value);
    state.revealed = [];

    if (player.trios.length >= TRIOS_TO_WIN || player.trios.includes(WILD_TRIO_VALUE)) {
      state.winners = [player];
      state.endReason = "trios";
      return { status: "won", winners: state.winners };
    }

    const cardsLeft =
      state.players.some((p) => p.hand.length > 0) || state.piles.some((p) => p.length > 0);
    if (!cardsLeft) {
      return finishByScore(state, "exhausted");
    }
    if (isDeadlocked(state)) {
      return finishByScore(state, "stalemate");
    }
    return { status: "continue-same-player" };
  }

  // 'mismatch' | 'no-third-accessible' | 'trio-mismatch' : le tour s'arrête,
  // rien n'est retiré.
  state.revealed = [];
  if (isDeadlocked(state)) {
    return finishByScore(state, "stalemate");
  }
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return { status: "continue-next-player" };
}
