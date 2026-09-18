// Rendu à l'écran et orchestration des tours (humains et IA).
import * as Game from "./game.js";
import * as AI from "./ai.js";

const app = document.getElementById("app");
const AI_STEP_DELAY_MS = 700;

let state = null;
let aiTimer = null;

function freshSetupState() {
  return {
    screen: "setup",
    playerCount: 3,
    names: ["", "", "", "", "", ""],
    types: ["human", "human", "human", "human", "human", "human"],
    handSize: Game.defaultHandSize(3),
  };
}

// ---------- Mise en place d'une partie ----------

function startGame(playerCount, names, types, handSize) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    name: names[i] || `Joueur ${i + 1}`,
    type: types[i] === "ai" ? "ai" : "human",
  }));
  const core = Game.createGame(players, handSize);

  // UC-2 : seuls les joueurs humains consultent leur main en privé. Avec un
  // seul humain, personne d'autre ne partage l'écran : on saute l'étape et
  // sa main reste affichée en clair en continu. Sans humain (spectateur),
  // l'étape est entièrement ignorée.
  const humanIndices = players.map((p, i) => i).filter((i) => players[i].type === "human");

  state = {
    screen: humanIndices.length >= 2 ? "peek" : "game",
    ...core,
    peekOrder: humanIndices,
    peekPos: 0,
    peekRevealed: false,
    soloHumanIndex: humanIndices.length === 1 ? humanIndices[0] : null,
    phase: "awaiting-pick", // 'awaiting-pick' | 'paused'
    message: "",
    pendingOutcome: null,
  };
}

// ---------- Tour de jeu ----------

function messageFor(outcome) {
  if (outcome.kind === "awaiting") {
    const last = state.revealed[state.revealed.length - 1];
    const player = state.players[state.currentPlayerIndex];
    return `${player.name} retourne un ${Game.cardValue(state, last.cardId)}.`;
  }
  if (outcome.kind === "mismatch") {
    const [v1, v2] = outcome.values;
    return `${v1} et ${v2} ne correspondent pas. Fin du tour.`;
  }
  if (outcome.kind === "no-third-accessible") {
    return "Les deux cartes correspondent, mais aucune 3e carte n'est accessible. Fin du tour.";
  }
  if (outcome.kind === "trio") {
    const player = state.players[state.currentPlayerIndex];
    return `Trio de ${outcome.value} remporté par ${player.name} ! Il/Elle rejoue.`;
  }
  return "Les 3 cartes ne correspondent pas. Fin du tour.";
}

function handlePick(loc) {
  if (state.phase !== "awaiting-pick") return;
  const outcome = Game.pick(state, loc);
  if (outcome.kind === "awaiting") {
    render();
    return;
  }
  state.phase = "paused";
  state.message = messageFor(outcome);
  state.pendingOutcome = outcome;
  render();
}

function continueAfterPause() {
  const outcome = state.pendingOutcome;
  state.phase = "awaiting-pick";
  state.message = "";
  state.pendingOutcome = null;

  // Une révélation IA intermédiaire ('awaiting') n'a rien à résoudre : elle
  // ne fait qu'attendre d'être vue avant que l'IA ne continue son tour.
  if (outcome.kind === "awaiting") {
    render();
    return;
  }

  const result = Game.resolveOutcome(state, outcome);
  if (result.status === "won" || result.status === "exhausted" || result.status === "stalemate") {
    state.screen = "end";
  }
  render();
}

// ---------- Orchestration des tours IA ----------

// Vue restreinte transmise à ai.js : uniquement la main du joueur IA (qu'il
// connaît légitimement) et le journal d'information publique, jamais
// l'état complet de la partie (règle d'équité du PRD). `handLength` est
// ajouté aux positions de type main : c'est une information publique (le
// nombre de cartes d'un joueur se voit), utilisée pour le filtre de
// plausibilité (DESIGN.md §4.5.1).
function buildAiView(aiIndex) {
  const player = state.players[aiIndex];
  return {
    ownHand: player.hand.map((cardId) => ({ cardId, value: Game.cardValue(state, cardId) })),
    publicMemory: state.publicMemory,
    accessiblePositions: Game.getAccessiblePositions(state).map((loc) =>
      loc.type === "hand" ? { ...loc, handLength: state.players[loc.playerIndex].hand.length } : loc
    ),
    revealed: state.revealed.map((r) => ({ loc: r.loc, value: Game.cardValue(state, r.cardId) })),
  };
}

function clearAiTimer() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function hasHumanPlayer() {
  return state.players.some((p) => p.type === "human");
}

// Révèle automatiquement la prochaine carte d'un joueur IA, puis marque
// systématiquement une pause (comme pour un humain) : la carte retournée
// reste affichée jusqu'à validation, elle n'est jamais enchaînée seule.
function performAiTurnStep() {
  const loc = AI.chooseNextPick(buildAiView(state.currentPlayerIndex));
  const outcome = Game.pick(state, loc);
  state.phase = "paused";
  state.message = messageFor(outcome);
  state.pendingOutcome = outcome;
  render();
}

// Si c'est au tour d'une IA : déclenche sa prochaine révélation après un
// court délai. La pause qui en résulte attend ensuite un clic humain sur
// "Continuer" — sauf si aucun joueur humain n'est présent (mode
// spectateur), auquel cas personne ne peut valider et on enchaîne seul.
// Appelé à chaque rendu ; s'auto-annule si l'état ne correspond plus à un
// tour IA en attente.
function scheduleAiStepIfNeeded() {
  clearAiTimer();
  if (state.screen !== "game") return;
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || activePlayer.type !== "ai") return;

  if (state.phase === "awaiting-pick") {
    aiTimer = setTimeout(() => performAiTurnStep(), AI_STEP_DELAY_MS);
  } else if (state.phase === "paused" && !hasHumanPlayer()) {
    aiTimer = setTimeout(() => continueAfterPause(), AI_STEP_DELAY_MS);
  }
}

// ---------- Rendering ----------

function render() {
  app.innerHTML = "";
  if (state.screen === "setup") app.appendChild(renderSetup());
  else if (state.screen === "peek") app.appendChild(renderPeek());
  else if (state.screen === "game") app.appendChild(renderGame());
  else if (state.screen === "end") app.appendChild(renderEnd());
  scheduleAiStepIfNeeded();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function renderSetup() {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("h2", { text: "Nouvelle partie" }));
  wrap.appendChild(el("p", { text: "Choisis le nombre de joueurs (3 à 6) et leurs noms." }));

  const countRow = el("div", { class: "setup-row" });
  [3, 4, 5, 6].forEach((n) => {
    const btn = el("button", {
      class: "count-btn" + (state.playerCount === n ? " selected" : ""),
      text: String(n),
      onclick: () => {
        state.playerCount = n;
        // Changer le nombre de joueurs réinitialise le nombre de cartes par
        // main à sa valeur par défaut pour ce nouveau nombre (UC-1).
        state.handSize = Game.defaultHandSize(n);
        render();
      },
    });
    countRow.appendChild(btn);
  });
  wrap.appendChild(countRow);

  const handSizeBounds = Game.handSizeBounds(state.playerCount);
  const handSizeField = el("div", { class: "hand-size-field" });
  handSizeField.appendChild(el("label", { text: "Cartes par main" }));
  const handSizeInput = el("input", {
    type: "number",
    min: String(handSizeBounds.min),
    max: String(handSizeBounds.max),
    value: String(state.handSize),
  });
  handSizeInput.addEventListener("change", (e) => {
    const clamped = Math.min(handSizeBounds.max, Math.max(handSizeBounds.min, Number(e.target.value) || handSizeBounds.min));
    state.handSize = clamped;
    render();
  });
  handSizeField.appendChild(handSizeInput);
  handSizeField.appendChild(
    el("span", {
      class: "hand-size-hint",
      text: `entre ${handSizeBounds.min} et ${handSizeBounds.max}`,
    })
  );
  wrap.appendChild(handSizeField);

  const namesWrap = el("div", {});
  for (let i = 0; i < state.playerCount; i++) {
    const field = el("div", { class: "name-field" });
    field.appendChild(el("label", { text: `Joueur ${i + 1}` }));
    const input = el("input", {
      type: "text",
      placeholder: `Joueur ${i + 1}`,
      value: state.names[i] || "",
    });
    input.addEventListener("input", (e) => {
      state.names[i] = e.target.value;
    });
    field.appendChild(input);

    const typeToggle = el("div", { class: "type-toggle" });
    [
      { value: "human", label: "Humain" },
      { value: "ai", label: "IA" },
    ].forEach(({ value, label }) => {
      typeToggle.appendChild(
        el("button", {
          class: "type-btn" + (state.types[i] === value ? " selected" : ""),
          text: label,
          onclick: () => {
            state.types[i] = value;
            render();
          },
        })
      );
    });
    field.appendChild(typeToggle);

    namesWrap.appendChild(field);
  }
  wrap.appendChild(namesWrap);

  wrap.appendChild(
    el("button", {
      class: "btn",
      text: "Commencer la partie",
      onclick: () => {
        startGame(
          state.playerCount,
          state.names.slice(0, state.playerCount),
          state.types.slice(0, state.playerCount),
          state.handSize
        );
        render();
      },
    })
  );
  return wrap;
}

function renderPeek() {
  const wrap = el("div", { class: "panel peek-screen" });
  const player = state.players[state.peekOrder[state.peekPos]];

  if (!state.peekRevealed) {
    wrap.appendChild(el("div", { class: "pass-illustration", text: "🙈" }));
    wrap.appendChild(el("h2", { text: `Passe l'appareil à ${player.name}` }));
    wrap.appendChild(el("p", { text: "Les autres joueurs ne doivent pas regarder l'écran." }));
    wrap.appendChild(
      el("button", {
        class: "btn",
        text: `Je suis ${player.name}, montre-moi ma main`,
        onclick: () => {
          state.peekRevealed = true;
          render();
        },
      })
    );
  } else {
    wrap.appendChild(el("h2", { text: `${player.name}, voici ta main` }));
    wrap.appendChild(el("p", { text: "Mémorise l'ordre (de gauche à droite, du plus petit au plus grand)." }));
    const row = el("div", { class: "hand-row", style: "justify-content:center; margin: 16px 0;" });
    player.hand.forEach((cardId) => {
      row.appendChild(el("div", { class: "card front", text: String(Game.cardValue(state, cardId)) }));
    });
    wrap.appendChild(row);
    wrap.appendChild(
      el("button", {
        class: "btn",
        text: "J'ai mémorisé, cacher",
        onclick: () => {
          if (state.peekPos < state.peekOrder.length - 1) {
            state.peekPos += 1;
            state.peekRevealed = false;
          } else {
            state.screen = "game";
          }
          render();
        },
      })
    );
  }
  return wrap;
}

function renderCard(cardId, { front = false, extraClass = "", onClick = null } = {}) {
  const classes = ["card", front ? "front" : "back"];
  if (extraClass) classes.push(extraClass);
  if (onClick) classes.push("clickable");
  const c = el("div", {
    class: classes.join(" "),
    text: front ? String(Game.cardValue(state, cardId)) : "",
  });
  if (onClick) c.addEventListener("click", onClick);
  return c;
}

function renderGame() {
  const wrap = el("div", {});
  const accessible = state.phase === "awaiting-pick" ? Game.getAccessiblePositions(state) : [];
  const accessibleKey = new Set(accessible.map(Game.locKey));

  // status bar
  const status = el("div", { class: "status-bar" });
  if (state.phase === "awaiting-pick") {
    const player = state.players[state.currentPlayerIndex];
    const step = state.revealed.length;
    const stepText = step === 0 ? "choisis une carte" : step === 1 ? "choisis une 2e carte" : "choisis une 3e carte";
    status.appendChild(el("div", { class: "turn-of", text: `Tour de ${player.name}` }));
    status.appendChild(el("div", { text: stepText }));
  }
  wrap.appendChild(status);

  if (state.phase === "paused") {
    const box = el("div", { class: "message-box" });
    box.appendChild(el("p", { text: state.message }));
    box.appendChild(
      el("button", {
        class: "btn gold",
        text: "Continuer",
        onclick: () => continueAfterPause(),
      })
    );
    wrap.appendChild(box);
  }

  // table piles
  const tableArea = el("div", { class: "table-area" });
  tableArea.appendChild(el("h3", { text: "Table" }));
  const pileRow = el("div", { class: "pile-row" });
  state.piles.forEach((pile, pileIndex) => {
    const pileWrap = el("div", { class: "pile" });
    if (pile.length === 0) {
      pileWrap.appendChild(el("div", { class: "card back", style: "visibility:hidden;" }));
    } else {
      const topId = pile[pile.length - 1];
      const loc = { type: "pile", pileIndex, cardId: topId };
      const revealedEntry = state.revealed.find((r) => Game.locKey(r.loc) === Game.locKey(loc));
      const canClick = accessibleKey.has(Game.locKey(loc));
      pileWrap.appendChild(
        renderCard(topId, {
          front: !!revealedEntry,
          extraClass: revealedEntry ? "revealed" : canClick ? "" : "disabled",
          onClick: canClick ? () => handlePick(loc) : null,
        })
      );
    }
    pileRow.appendChild(pileWrap);
  });
  tableArea.appendChild(pileRow);
  wrap.appendChild(tableArea);

  // players
  const grid = el("div", { class: "players-grid" });
  state.players.forEach((player, playerIndex) => {
    const isActive = playerIndex === state.currentPlayerIndex;
    const panel = el("div", { class: "player-panel" + (isActive ? " active" : "") });
    const head = el("div", { class: "player-head" });
    const nameEl = el("div", { class: "player-name", text: player.name });
    if (isActive) nameEl.appendChild(el("span", { class: "you-turn", text: "● en jeu" }));
    head.appendChild(nameEl);
    const badges = el("div", { class: "trio-badges" });
    player.trios.forEach((v) => badges.appendChild(el("span", { class: "trio-chip", text: `Trio ${v}` })));
    head.appendChild(badges);
    panel.appendChild(head);

    const handRow = el("div", { class: "hand-row" });
    player.hand.forEach((cardId, idx) => {
      const end = idx === 0 ? "left" : idx === player.hand.length - 1 ? "right" : null;
      let loc = null;
      if (end === "left") loc = { type: "hand", playerIndex, end: "left", cardId };
      if (end === "right") loc = { type: "hand", playerIndex, end: "right", cardId };
      if (player.hand.length === 1) loc = { type: "hand", playerIndex, end: "left", cardId };

      const revealedEntry = loc && state.revealed.find((r) => Game.locKey(r.loc) === Game.locKey(loc));
      const canClick = loc && accessibleKey.has(Game.locKey(loc));
      // UC-2 : avec un seul joueur humain, sa main reste affichée en clair
      // en continu (personne d'autre ne partage l'écran pour la voir).
      const alwaysVisible = playerIndex === state.soloHumanIndex;
      handRow.appendChild(
        renderCard(cardId, {
          front: !!revealedEntry || alwaysVisible,
          extraClass: revealedEntry ? "revealed" : canClick ? "" : "disabled",
          onClick: canClick ? () => handlePick(loc) : null,
        })
      );
    });
    panel.appendChild(handRow);
    grid.appendChild(panel);
  });
  wrap.appendChild(grid);

  return wrap;
}

function renderEnd() {
  const wrap = el("div", { class: "panel end-screen" });
  const winners = state.winners;
  const title =
    winners.length > 1
      ? `🏆 Égalité entre ${winners.map((p) => p.name).join(", ")} !`
      : `🏆 ${winners[0].name} remporte la partie !`;
  wrap.appendChild(el("h2", { text: title }));
  if (state.endReason === "stalemate") {
    wrap.appendChild(
      el("p", { text: "Plus aucun joueur ne peut compléter de trio : fin de partie sur blocage." })
    );
  } else if (state.endReason === "exhausted") {
    wrap.appendChild(el("p", { text: "Toutes les cartes ont été distribuées en trios : fin de partie." }));
  }
  const list = el("ul", { class: "final-scores" });
  state.players
    .slice()
    .sort((a, b) => b.trios.length - a.trios.length)
    .forEach((p) => {
      const li = el("li", { class: winners.includes(p) ? "winner" : "" });
      li.appendChild(el("span", { text: p.name }));
      li.appendChild(el("span", { text: `${p.trios.length} trio(s)` }));
      list.appendChild(li);
    });
  wrap.appendChild(list);
  wrap.appendChild(
    el("button", {
      class: "btn",
      text: "Nouvelle partie",
      onclick: () => {
        state = freshSetupState();
        render();
      },
    })
  );
  return wrap;
}

// ---------- Rules modal ----------

function wireRulesModal() {
  const rulesModal = document.getElementById("rules-modal");
  document.getElementById("rules-btn").addEventListener("click", () => rulesModal.classList.remove("hidden"));
  document.getElementById("rules-close").addEventListener("click", () => rulesModal.classList.add("hidden"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.add("hidden");
  });
}

// ---------- Point d'entrée ----------

export function startApp() {
  state = freshSetupState();
  wireRulesModal();
  render();
}
