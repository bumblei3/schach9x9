// ui.js
/**
 * UI-Modul für Schach9x9.
 * Beinhaltet DOM-Manipulation, Event-Listener und Rendering.
 * @module ui
 */
import { BOARD_SIZE, PHASES, PIECE_VALUES } from './config.js';
import { debounce } from './utils.js';
import { particleSystem } from './effects.js';

// ... (keep existing code until updateMoveHistoryUI)

export function updateMoveHistoryUI(game) {
  const historyEl = document.getElementById('move-history');
  if (!historyEl) return;

  try {
    historyEl.innerHTML = '';
    game.moveHistory.forEach((move, index) => {
      const moveEl = document.createElement('div');
      moveEl.className = 'move-entry';

      // Standard Algebraic Notation (SAN)
      const pieceSymbols = {
        p: '',
        n: 'N',
        b: 'B',
        r: 'R',
        q: 'Q',
        k: 'K',
        a: 'A',
        c: 'C',
        e: 'E',
      };
      const pieceChar = pieceSymbols[move.piece.type];

      const fromFile = String.fromCharCode(97 + move.from.c);
      const fromRank = BOARD_SIZE - move.from.r;
      const toFile = String.fromCharCode(97 + move.to.c);
      const toRank = BOARD_SIZE - move.to.r;

      let moveText = '';

      if (move.specialMove && move.specialMove.type === 'castling') {
        moveText = move.specialMove.isKingside ? 'O-O' : 'O-O-O';
      } else {
        moveText += pieceChar;

        // Disambiguation (simplified: always show file if pawn capture, else just piece)
        // Real SAN is complex, but let's do a decent approximation
        if (move.piece.type === 'p' && move.capturedPiece) {
          moveText += fromFile;
        }

        if (move.capturedPiece || (move.specialMove && move.specialMove.type === 'enPassant')) {
          moveText += 'x';
        }

        moveText += toFile + toRank;

        if (move.specialMove && move.specialMove.type === 'promotion') {
          const promoSymbol = pieceSymbols[move.specialMove.promotedTo] || '';
          moveText += `=${promoSymbol}`;
        }
      }

      // Check/Checkmate indication would need game state history or re-evaluation
      // For now, we omit +/# unless we store it in moveRecord

      moveEl.textContent = `${index + 1}. ${moveText}`;
      historyEl.appendChild(moveEl);
    });

    // Scroll to bottom
    historyEl.scrollTop = historyEl.scrollHeight;

    // Update undo button state
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;
    }
  } catch (error) {
    console.error('Error updating move history:', error);
  }
}

export function updateCapturedUI(game) {
  const whiteContainer = document.getElementById('captured-white');
  const blackContainer = document.getElementById('captured-black');

  if (!whiteContainer || !blackContainer) return;

  whiteContainer.innerHTML = '';
  blackContainer.innerHTML = '';

  // Calculate material value
  let whiteMaterial = 0; // Material ON BOARD
  let blackMaterial = 0;

  // We can calculate from board or from captured pieces.
  // Calculating from board is safer.
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = game.board[r][c];
      if (p) {
        const val = PIECE_VALUES[p.type] || 0;
        if (p.color === 'white') whiteMaterial += val;
        else blackMaterial += val;
      }
    }
  }

  const materialDiff = whiteMaterial - blackMaterial;

  // White's captured pieces (Black pieces captured by White)
  game.capturedPieces.white.forEach(p => {
    const el = document.createElement('div');
    el.className = 'captured-piece';
    el.innerHTML = getPieceSymbol(p);
    whiteContainer.appendChild(el);
  });

  // Add material advantage indicator
  if (materialDiff > 0) {
    const adv = document.createElement('div');
    adv.className = 'material-advantage white-adv';
    adv.textContent = `+${materialDiff}`;
    whiteContainer.appendChild(adv);
  }

  // Black's captured pieces (White pieces captured by Black)
  game.capturedPieces.black.forEach(p => {
    const el = document.createElement('div');
    el.className = 'captured-piece';
    el.innerHTML = getPieceSymbol(p);
    blackContainer.appendChild(el);
  });

  if (materialDiff < 0) {
    const adv = document.createElement('div');
    adv.className = 'material-advantage black-adv';
    adv.textContent = `+${Math.abs(materialDiff)}`;
    blackContainer.appendChild(adv);
  }
}

/**
 * Initialisiert das Schachbrett im DOM und fügt Event-Listener hinzu.
 * @param {object} game - Die Game-Instanz
 */
export function initBoardUI(game) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      if (c === 2 || c === 5) cell.classList.add('border-right');
      if (r === 2 || r === 5) cell.classList.add('border-bottom');
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('click', () => game.handleCellClick(r, c));

      // Drag & Drop für Figuren
      cell.draggable = true;

      cell.addEventListener('dragstart', e => {
        // Nur im PLAY-Phase und nicht während Replay oder AI-Zug
        if (game.phase !== PHASES.PLAY || game.replayMode || game.isAnimating) {
          e.preventDefault();
          return false;
        }

        // Prüfe ob es eine Figur gibt und ob es der Spieler am Zug ist
        const piece = game.board[r][c];
        if (!piece) {
          e.preventDefault();
          return false;
        }

        // Prüfe ob es die Figur des aktuellen Spielers ist
        if (game.isAI && game.turn === 'black') {
          e.preventDefault();
          return false;
        }

        if (piece.color !== game.turn) {
          e.preventDefault();
          return false;
        }

        // Speichere die Startposition
        e.dataTransfer.setData('text/plain', `${r},${c}`);
        e.dataTransfer.effectAllowed = 'move';

        // Visuelles Feedback: Zelle wird halbtransparent
        cell.classList.add('dragging');

        // Erstelle ein Drag-Bild
        const dragImage = cell.cloneNode(true);
        dragImage.style.opacity = '0.8';
        dragImage.style.transform = 'rotate(5deg)';
        document.body.appendChild(dragImage);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        e.dataTransfer.setDragImage(dragImage, cell.offsetWidth / 2, cell.offsetHeight / 2);
        setTimeout(() => document.body.removeChild(dragImage), 0);

        // Zeige mögliche Züge
        const validMoves = game.getValidMoves(r, c, piece);
        validMoves.forEach(move => {
          const targetCell = document.querySelector(
            `.cell[data-r="${move.r}"][data-c="${move.c}"]`
          );
          if (targetCell) {
            targetCell.classList.add('drag-target');
          }
        });
      });

      cell.addEventListener('dragend', () => {
        // Entferne alle Drag-Markierungen
        cell.classList.remove('dragging');
        document
          .querySelectorAll('.cell.drag-target')
          .forEach(c => c.classList.remove('drag-target'));
        document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
      });

      cell.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Prüfe ob es ein gültiges Ziel ist
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;

        const [fromR, fromC] = data.split(',').map(Number);
        const piece = game.board[fromR][fromC];
        if (!piece) return;

        const validMoves = game.getValidMoves(fromR, fromC, piece);
        const isValidTarget = validMoves.some(move => move.r === r && move.c === c);

        if (isValidTarget) {
          cell.classList.add('drag-over');
        }
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
      });

      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');

        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;

        const [fromR, fromC] = data.split(',').map(Number);

        // Prüfe ob es ein gültiger Zug ist
        const piece = game.board[fromR][fromC];
        if (!piece || piece.color !== game.turn) return;

        const validMoves = game.getValidMoves(fromR, fromC, piece);
        const isValidMove = validMoves.some(move => move.r === r && move.c === c);

        if (isValidMove) {
          // Führe den Zug aus
          game.selectedSquare = { r: fromR, c: fromC };
          game.validMoves = validMoves;
          game.handleCellClick(r, c);
        }
      });

      // Hover-Effekte für mögliche Züge
      cell.addEventListener(
        'mouseenter',
        debounce(() => {
          if (game.phase === PHASES.PLAY && !game.replayMode) {
            const piece = game.board[r][c];
            if (piece) {
              // Zeige mögliche Züge dieser Figur beim Hover
              const hoverMoves = game.getValidMoves(r, c, piece);
              hoverMoves.forEach(move => {
                const targetCell = document.querySelector(
                  `.cell[data-r="${move.r}"][data-c="${move.c}"]`
                );
                if (targetCell) {
                  targetCell.classList.add('hover-move');
                }
              });
              // Markiere die Figur selbst
              cell.classList.add('hover-piece');
            }
          }
        }, 50)
      );

      cell.addEventListener('mouseleave', () => {
        // Entferne alle Hover-Markierungen
        document
          .querySelectorAll('.cell.hover-move')
          .forEach(c => c.classList.remove('hover-move'));
        document
          .querySelectorAll('.cell.hover-piece')
          .forEach(c => c.classList.remove('hover-piece'));
      });

      boardEl.appendChild(cell);
    }
  }

  // Add coordinate labels
  // Column labels (a-i)
  const colLabels = document.createElement('div');
  colLabels.className = 'col-labels';
  for (let c = 0; c < BOARD_SIZE; c++) {
    const label = document.createElement('span');
    label.textContent = String.fromCharCode(97 + c);
    label.className = 'coord-label';
    colLabels.appendChild(label);
  }

  // Row labels (9-1)
  const rowLabels = document.createElement('div');
  rowLabels.className = 'row-labels';
  for (let r = 0; r < BOARD_SIZE; r++) {
    const label = document.createElement('span');
    label.textContent = (BOARD_SIZE - r).toString();
    label.className = 'coord-label';
    rowLabels.appendChild(label);
  }

  const boardWrapper = document.getElementById('board-wrapper');
  if (boardWrapper) {
    // Clean up existing labels
    boardWrapper.querySelectorAll('.col-labels, .row-labels').forEach(el => el.remove());

    // Insert new labels
    boardWrapper.appendChild(colLabels);
    boardWrapper.appendChild(rowLabels);
  }
  // shop listeners etc. can be added by the main script.
}

/**
 * Rendert das Schachbrett und die Figuren im DOM.
 * @param {object} game - Die Game-Instanz
 */

/**
 * Gibt das SVG-Symbol für eine Figur zurück.
 * @param {object} piece - Die Figur
 * @returns {string} HTML-String des SVGs
 */
export function getPieceSymbol(piece) {
  if (!piece) return '';
  // Lazy-Loading: SVG nur beim ersten Mal in den DOM einfügen, dann cachen
  // Wir nutzen hier ein globales Cache-Objekt oder hängen es an window,
  // aber sauberer ist es, es im Modul-Scope zu halten.
  if (!window._svgCache) window._svgCache = {};
  const key = piece.color + piece.type;
  if (!window._svgCache[key]) {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-svg';
    wrapper.innerHTML = window.PIECE_SVGS[piece.color][piece.type];
    window._svgCache[key] = wrapper.innerHTML;
  }
  return window._svgCache[key];
}

export function getPieceText(piece) {
  if (!piece) return '';
  const symbols = {
    white: {
      p: '♙',
      n: '♘',
      b: '♗',
      r: '♖',
      q: '♕',
      k: '♔',
      a: 'A',
      c: 'C',
      e: 'E',
    },
    black: {
      p: '♟',
      n: '♞',
      b: '♝',
      r: '♜',
      q: '♛',
      k: '♚',
      a: 'A',
      c: 'C',
      e: 'E',
    },
  };
  return symbols[piece.color][piece.type];
}

/**
 * Rendert das Schachbrett und die Figuren im DOM.
 * @param {object} game - Die Game-Instanz
 */
export function renderBoard(game) {
  // Performance-Optimierung: Initialisiere previousBoardState beim ersten Aufruf
  if (!game._previousBoardState) {
    game._previousBoardState = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game._forceFullRender = true;
  }

  // CRITICAL: Clear all corridor highlighting first to handle phase transitions
  // This ensures old corridor highlights are removed when phase changes
  document.querySelectorAll('.cell.selectable-corridor').forEach(cell => {
    cell.classList.remove('selectable-corridor');
  });

  // Bestimme welche Zellen sich geändert haben
  const changedCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const currentPiece = game.board[r][c];
      const previousPiece = game._previousBoardState[r][c];

      // Prüfe ob sich die Figur geändert hat
      const pieceChanged =
        (!currentPiece && previousPiece) ||
        (currentPiece && !previousPiece) ||
        (currentPiece &&
          previousPiece &&
          (currentPiece.type !== previousPiece.type || currentPiece.color !== previousPiece.color));

      if (game._forceFullRender || pieceChanged) {
        changedCells.push({ r, c });
        game._previousBoardState[r][c] = currentPiece
          ? { type: currentPiece.type, color: currentPiece.color }
          : null;
      }
    }
  }

  // Rendere nur geänderte Zellen (oder alle beim ersten Mal)
  /* eslint-disable indent */
  const cellsToRender = game._forceFullRender
    ? Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
        r: Math.floor(i / BOARD_SIZE),
        c: i % BOARD_SIZE,
      }))
    : changedCells;
  /* eslint-enable indent */

  game._forceFullRender = false;

  for (const { r, c } of cellsToRender) {
    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (!cell) continue;

    const piece = game.board[r][c];
    const pieceSymbol = getPieceSymbol(piece);

    // Nur innerHTML aktualisieren wenn sich die Figur geändert hat
    if (cell.innerHTML !== pieceSymbol) {
      cell.innerHTML = pieceSymbol;
    }

    // Clear highlights
    cell.classList.remove(
      'highlight',
      'corridor',
      'valid-move',
      'last-move',
      'tutor-move',
      'threatened'
    );

    // Always clear corridor highlighting, will be re-added below based on phase
    cell.classList.remove('selectable-corridor');

    if (game.selectedSquare && game.selectedSquare.r === r && game.selectedSquare.c === c) {
      cell.classList.add('highlight');
    }

    // Highlight valid moves
    if (game.validMoves) {
      const move = game.validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        cell.classList.add('valid-move');
        if (game.isTutorMove && game.isTutorMove(game.selectedSquare, { r, c })) {
          cell.classList.add('tutor-move');
        }
      }
    }

    // Highlight last move
    if (game.lastMoveHighlight) {
      if (
        (game.lastMoveHighlight.from.r === r && game.lastMoveHighlight.from.c === c) ||
        (game.lastMoveHighlight.to.r === r && game.lastMoveHighlight.to.c === c)
      ) {
        cell.classList.add('last-move');
      }
    }

    // Markiere bedrohte Figuren (nur im PLAY-Phase)
    if (game.phase === PHASES.PLAY && piece) {
      const opponentColor = piece.color === 'white' ? 'black' : 'white';
      if (game.isSquareUnderAttack && game.isSquareUnderAttack(r, c, opponentColor)) {
        cell.classList.add('threatened');
      }
    }
  }

  // Apply corridor highlighting to ALL cells (not just changed cells)
  // This must be done outside the cellsToRender loop to handle phase transitions
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      if (!cell) continue;

      // Apply corridor highlighting based on current phase

      // 1. King Setup Phase (Choosing a corridor)
      // Only show options if it's a human player's turn
      const isSetupWhite = game.phase === PHASES.SETUP_WHITE_KING;
      const isSetupBlack = game.phase === PHASES.SETUP_BLACK_KING;
      const isHumanTurn = isSetupWhite || (isSetupBlack && !game.isAI);

      if (isHumanTurn) {
        const isWhite = isSetupWhite;
        const rowStart = isWhite ? 6 : 0;
        // Highlight all three 3x3 corridors for king placement
        if (r >= rowStart && r < rowStart + 3) {
          // Corridor 1: columns 0-2, Corridor 2: columns 3-5, Corridor 3: columns 6-8
          const inCorridor = (c >= 0 && c <= 2) || (c >= 3 && c <= 5) || (c >= 6 && c <= 8);
          if (inCorridor) {
            cell.classList.add('selectable-corridor');
          }
        }
      }

      // 2. Piece Setup Phase (Selected corridor highlighting)
      // Only highlight the corridor for the player currently setting up pieces
      // AND allow seeing own corridor while waiting for opponent king setup

      if (
        game.whiteCorridor &&
        (game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_KING)
      ) {
        if (
          r >= game.whiteCorridor.rowStart &&
          r < game.whiteCorridor.rowStart + 3 &&
          c >= game.whiteCorridor.colStart &&
          c < game.whiteCorridor.colStart + 3
        ) {
          cell.classList.add('selectable-corridor');
        }
      }

      if (game.blackCorridor && game.phase === PHASES.SETUP_BLACK_PIECES) {
        if (
          r >= game.blackCorridor.rowStart &&
          r < game.blackCorridor.rowStart + 3 &&
          c >= game.blackCorridor.colStart &&
          c < game.blackCorridor.colStart + 3
        ) {
          cell.classList.add('selectable-corridor');
        }
      }
    }
  }

  // Auch alle Zellen aktualisieren wenn sich Highlights geändert haben könnten
  if (
    game._lastSelectedSquare !== game.selectedSquare ||
    game._lastValidMoves !== game.validMoves ||
    game._lastMoveHighlight !== game.lastMoveHighlight
  ) {
    // Update highlights für alle Zellen
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell) continue;

        cell.classList.remove('highlight', 'valid-move', 'tutor-move', 'last-move', 'threatened');

        // Always clear corridor highlighting, will be re-added below based on phase
        cell.classList.remove('selectable-corridor');

        // Re-apply corridor highlighting for setup phases

        // 1. King Setup Phase
        const isSetupWhite = game.phase === PHASES.SETUP_WHITE_KING;
        const isSetupBlack = game.phase === PHASES.SETUP_BLACK_KING;
        const isHumanTurn = isSetupWhite || (isSetupBlack && !game.isAI);

        if (isHumanTurn) {
          const isWhite = isSetupWhite;
          const rowStart = isWhite ? 6 : 0;
          // Highlight all three 3x3 corridors for king placement
          if (r >= rowStart && r < rowStart + 3) {
            // Corridor 1: columns 0-2, Corridor 2: columns 3-5, Corridor 3: columns 6-8
            const inCorridor = (c >= 0 && c <= 2) || (c >= 3 && c <= 5) || (c >= 6 && c <= 8);
            if (inCorridor) {
              cell.classList.add('selectable-corridor');
            }
          }
        }

        // 2. Selected Corridor Highlighting
        if (
          game.whiteCorridor &&
          (game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_KING)
        ) {
          if (
            r >= game.whiteCorridor.rowStart &&
            r < game.whiteCorridor.rowStart + 3 &&
            c >= game.whiteCorridor.colStart &&
            c < game.whiteCorridor.colStart + 3
          ) {
            cell.classList.add('selectable-corridor');
          }
        }

        if (game.blackCorridor && game.phase === PHASES.SETUP_BLACK_PIECES) {
          if (
            r >= game.blackCorridor.rowStart &&
            r < game.blackCorridor.rowStart + 3 &&
            c >= game.blackCorridor.colStart &&
            c < game.blackCorridor.colStart + 3
          ) {
            cell.classList.add('selectable-corridor');
          }
        }

        if (game.selectedSquare && game.selectedSquare.r === r && game.selectedSquare.c === c) {
          cell.classList.add('highlight');
        }

        if (game.validMoves) {
          const move = game.validMoves.find(m => m.r === r && m.c === c);
          if (move) {
            cell.classList.add('valid-move');
            if (game.isTutorMove && game.isTutorMove(game.selectedSquare, { r, c })) {
              cell.classList.add('tutor-move');
            }
          }
        }

        if (game.lastMoveHighlight) {
          if (
            (game.lastMoveHighlight.from.r === r && game.lastMoveHighlight.from.c === c) ||
            (game.lastMoveHighlight.to.r === r && game.lastMoveHighlight.to.c === c)
          ) {
            cell.classList.add('last-move');
          }
        }

        // Markiere bedrohte Figuren
        const piece = game.board[r][c];
        if (game.phase === PHASES.PLAY && piece) {
          const opponentColor = piece.color === 'white' ? 'black' : 'white';
          if (game.isSquareUnderAttack && game.isSquareUnderAttack(r, c, opponentColor)) {
            cell.classList.add('threatened');
          }
        }
      }
    }

    game._lastSelectedSquare = game.selectedSquare ? { ...game.selectedSquare } : null;
    game._lastValidMoves = game.validMoves ? [...game.validMoves] : null;
    game._lastMoveHighlight = game.lastMoveHighlight ? { ...game.lastMoveHighlight } : null;
  }
}

/**
 * Aktualisiert die Statusanzeige im UI.
 * @param {object} game - Die Game-Instanz
 */
export function updateStatus(game) {
  const statusEl = document.getElementById('status-display');
  if (!statusEl) return;

  let text = '';
  switch (game.phase) {
    case PHASES.SETUP_WHITE_KING:
      text = 'Weiß: Wähle einen Korridor für den König';
      break;
    case PHASES.SETUP_BLACK_KING:
      text = 'Schwarz: Wähle einen Korridor för den König';
      break;
    case PHASES.SETUP_WHITE_PIECES:
      text = 'Weiß: Kaufe Truppen';
      break;
    case PHASES.SETUP_BLACK_PIECES:
      text = 'Schwarz: Kaufe Truppen';
      break;
    case PHASES.PLAY:
      text = `Spiel läuft - ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} am Zug`;
      break;
    case PHASES.ANALYSIS:
      text = `🔍 Analyse-Modus - ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} am Zug`;
      break;
    case PHASES.GAME_OVER:
      text = `Spiel vorbei! ${game.turn === 'white' ? 'Weiß' : 'Schwarz'} hat gewonnen!`;
      break;
  }
  statusEl.textContent = text;
}

export function updateClockUI(game) {
  const whiteClockEl = document.getElementById('clock-white');
  const blackClockEl = document.getElementById('clock-black');

  if (whiteClockEl && blackClockEl) {
    whiteClockEl.classList.remove('active', 'low-time');
    blackClockEl.classList.remove('active', 'low-time');

    if (game.turn === 'white') {
      whiteClockEl.classList.add('active');
      if (game.whiteTime < 30) whiteClockEl.classList.add('low-time');
    } else {
      blackClockEl.classList.add('active');
      if (game.blackTime < 30) blackClockEl.classList.add('low-time');
    }
  }
}

export function updateClockDisplay(game) {
  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const whiteEl = document.getElementById('clock-white');
  const blackEl = document.getElementById('clock-black');

  if (whiteEl) whiteEl.textContent = formatTime(game.whiteTime);
  if (blackEl) blackEl.textContent = formatTime(game.blackTime);
}

export function showShop(game, show) {
  const panel = document.getElementById('shop-panel');
  if (show) {
    panel.classList.remove('hidden');
    // Ensure we are in setup mode UI-wise
    document.body.classList.add('setup-mode');
  } else {
    panel.classList.add('hidden');
    document.body.classList.remove('setup-mode');
  }
  updateShopUI(game);
}

export function updateShopUI(game) {
  const pointsDisplay = document.getElementById('points-display');
  if (pointsDisplay) pointsDisplay.textContent = game.points;

  // Update tutor points
  const tutorPointsDisplay = document.getElementById('tutor-points-display');
  if (tutorPointsDisplay) tutorPointsDisplay.textContent = game.tutorPoints || 0;

  // Disable buttons if too expensive
  document.querySelectorAll('.shop-item').forEach(btn => {
    const cost = parseInt(btn.dataset.cost);
    if (cost > game.points) {
      btn.classList.add('disabled');
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    } else {
      btn.classList.remove('disabled');
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  });

  const finishBtn = document.getElementById('finish-setup-btn');
  if (finishBtn) {
    finishBtn.disabled = false;
  }

  const statusDisplay = document.getElementById('selected-piece-display');
  if (statusDisplay) {
    if (game.selectedShopPiece) {
      statusDisplay.textContent = `Platziere: ${getPieceText({ type: game.selectedShopPiece, color: game.turn })} (${PIECE_VALUES[game.selectedShopPiece]} Pkt)`;
    } else {
      statusDisplay.textContent = 'Wähle eine Figur zum Kaufen';
    }
  }

  // Update tutor recommendations section
  updateTutorRecommendations(game);
}

function updateTutorRecommendations(game) {
  const toggleBtn = document.getElementById('toggle-tutor-recommendations');
  const container = document.getElementById('tutor-recommendations-container');

  if (!toggleBtn || !container) return;

  // Check if we're in setup phase and tutor is available
  const inSetupPhase =
    game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_PIECES;
  const tutorSection = document.getElementById('tutor-recommendations-section');

  if (!inSetupPhase || !game.tutorController || !game.tutorController.getSetupTemplates) {
    if (tutorSection) tutorSection.classList.add('hidden');
    return;
  }

  if (tutorSection) tutorSection.classList.remove('hidden');

  // Setup toggle button handler (only once)
  if (!toggleBtn.dataset.initialized) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = container.classList.contains('hidden');
      container.classList.toggle('hidden');
      toggleBtn.textContent = isHidden
        ? '💡 KI-Empfehlungen ausblenden'
        : '💡 KI-Empfehlungen anzeigen';
    });
    toggleBtn.dataset.initialized = 'true';
  }

  // Populate templates if empty or needs refresh
  if (container.children.length === 0) {
    const templates = game.tutorController.getSetupTemplates();
    container.innerHTML = '';

    templates.forEach(template => {
      const card = document.createElement('div');
      card.className = 'setup-template-card';

      // Build pieces preview using SVGs if available
      const piecesPreview = template.pieces
        .map(pieceType => {
          const color = game.phase === PHASES.SETUP_WHITE_PIECES ? 'white' : 'black';
          if (
            window.PIECE_SVGS &&
            window.PIECE_SVGS[color] &&
            window.PIECE_SVGS[color][pieceType]
          ) {
            return `<span class="template-piece-icon">${window.PIECE_SVGS[color][pieceType]}</span>`;
          } else {
            // Fallback to text symbols
            const symbols = {
              p: '♟',
              n: '♞',
              b: '♝',
              r: '♜',
              q: '♛',
              k: '♚',
              a: '🏰',
              c: '⚖️',
              e: '👼',
            };
            return `<span class="template-piece-icon">${symbols[pieceType] || pieceType}</span>`;
          }
        })
        .join('');

      card.innerHTML = `
        <div class="template-name">${template.name}</div>
        <div class="template-description">${template.description}</div>
        <div class="template-pieces">
          <span>Enthält:</span>
          ${piecesPreview}
        </div>
      `;

      card.addEventListener('click', () => {
        if (
          confirm(
            `Möchtest du die Aufstellung "${template.name}" anwenden?\n\nDeine aktuelle Aufstellung wird überschrieben und deine Punkte werden zurückgesetzt.`
          )
        ) {
          game.tutorController.applySetupTemplate(template.id);
          // Refresh the shop UI to reflect the changes
          updateShopUI(game);
        }
      });

      container.appendChild(card);
    });
  }
}

export function showPromotionUI(game, r, c, color, moveRecord, callback) {
  const overlay = document.getElementById('promotion-overlay');
  const optionsContainer = document.getElementById('promotion-options');
  optionsContainer.innerHTML = '';

  const options = [
    { type: 'e', symbol: 'E' }, // Angel
    { type: 'q', symbol: color === 'white' ? '♕' : '♛' },
    { type: 'c', symbol: 'C' }, // Chancellor
    { type: 'a', symbol: 'A' }, // Archbishop
    { type: 'r', symbol: color === 'white' ? '♖' : '♜' },
    { type: 'b', symbol: color === 'white' ? '♗' : '♝' },
    { type: 'n', symbol: color === 'white' ? '♘' : '♞' },
  ];

  options.forEach(opt => {
    const btn = document.createElement('div');
    btn.className = 'promotion-option';
    btn.innerHTML = `<div class="piece-svg">${window.PIECE_SVGS[color][opt.type]}</div>`;
    btn.onclick = () => {
      // Update board directly
      if (game.board[r][c]) {
        game.board[r][c].type = opt.type;

        // Update move record with promotion info
        if (moveRecord) {
          moveRecord.specialMove = { type: 'promotion', promotedTo: opt.type };
        }

        if (game.log) game.log(`${color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer befördert!`);
        overlay.classList.add('hidden');
        renderBoard(game); // Re-render to show new piece
        // We need to trigger the callback to finish the move
        if (callback) callback();
      }
    };
    optionsContainer.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

export async function animateMove(game, from, to, piece) {
  game.isAnimating = true;
  return new Promise(resolve => {
    // Get the cells
    const fromCell = document.querySelector(`.cell[data-r="${from.r}"][data-c="${from.c}"]`);
    const toCell = document.querySelector(`.cell[data-r="${to.r}"][data-c="${to.c}"]`);

    if (!fromCell || !toCell) {
      game.isAnimating = false;
      resolve();
      return;
    }

    // Get the piece element or create one if missing (e.g. if board re-rendered)
    let pieceElement = fromCell.querySelector('.piece-svg');
    if (!pieceElement) {
      // Create a temporary one
      const wrapper = document.createElement('div');
      wrapper.className = 'piece-svg';
      wrapper.innerHTML = getPieceSymbol(piece);
      pieceElement = wrapper;
      fromCell.appendChild(wrapper);
    }

    // Clone the piece for animation
    const clone = pieceElement.cloneNode(true);
    clone.className = 'animating-piece'; // Use specific class for styling if needed
    clone.style.position = 'fixed';
    clone.style.zIndex = '10000';
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'none'; // Disable transitions initially

    // Get positions
    const fromRect = fromCell.getBoundingClientRect();
    clone.style.left = fromRect.left + 'px';
    clone.style.top = fromRect.top + 'px';
    clone.style.width = fromRect.width + 'px';
    clone.style.height = fromRect.height + 'px';
    clone.style.display = 'flex';
    clone.style.justifyContent = 'center';
    clone.style.alignItems = 'center';

    document.body.appendChild(clone);

    // Hide original piece temporarily
    const originalOpacity = pieceElement.style.opacity;
    pieceElement.style.opacity = '0';

    // Force reflow
    clone.offsetHeight;

    // Animate
    // Calculate distance for dynamic duration? Or fixed?
    // Fixed is usually more consistent for chess.
    clone.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';

    const toRect = toCell.getBoundingClientRect();
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

    clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    // Spawn particles if capture (we need to know if it's a capture)
    // We can check if toCell has a piece of opposite color
    const targetPiece = game.board[to.r][to.c];
    const isCapture = targetPiece && targetPiece.color !== piece.color;

    setTimeout(() => {
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }

      // Restore opacity (though board might be re-rendered anyway)
      if (pieceElement) pieceElement.style.opacity = originalOpacity;

      if (isCapture) {
        const centerX = toRect.left + toRect.width / 2;
        const centerY = toRect.top + toRect.height / 2;
        const color = targetPiece.color === 'white' ? '#e2e8f0' : '#1e293b';
        particleSystem.spawn(centerX, centerY, 'CAPTURE', color);
      }

      // Move particles (dust)
      // const fromCenterX = fromRect.left + fromRect.width / 2;
      // const fromCenterY = fromRect.top + fromRect.height / 2;
      // particleSystem.spawn(fromCenterX, fromCenterY, 'MOVE', '#888');

      game.isAnimating = false;
      resolve();
    }, 250); // Match transition duration
  });
}

export function animateCheck(game, color) {
  // Find King
  let kingPos = null;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        kingPos = { r, c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return;

  const kingCell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
  if (kingCell) {
    kingCell.classList.add('in-check');
    setTimeout(() => {
      kingCell.classList.remove('in-check');
    }, 2000);
  }
}

export function animateCheckmate(game, color) {
  // Find King
  let kingPos = null;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        kingPos = { r, c };
        break;
      }
    }
    if (kingPos) break;
  }

  if (!kingPos) return;

  const kingCell = document.querySelector(`.cell[data-r="${kingPos.r}"][data-c="${kingPos.c}"]`);
  if (kingCell) {
    kingCell.classList.add('checkmate');
    setTimeout(() => {
      kingCell.classList.remove('checkmate');
    }, 3000);
  }
}

export function updateStatistics(game) {
  // Update move count
  const movesEl = document.getElementById('stat-moves');
  if (movesEl) movesEl.textContent = game.stats.totalMoves;

  // Update captures
  game.stats.captures =
    (game.capturedPieces?.white?.length || 0) + (game.capturedPieces?.black?.length || 0);
  const capturesEl = document.getElementById('stat-captures');
  if (capturesEl) capturesEl.textContent = game.stats.captures;

  // Update accuracy (only for human player)
  const accuracyEl = document.getElementById('stat-accuracy');
  if (accuracyEl) {
    if (game.stats.playerMoves > 0) {
      const accuracy = Math.round((game.stats.playerBestMoves / game.stats.playerMoves) * 100);
      accuracyEl.textContent = accuracy + '%';
    } else {
      accuracyEl.textContent = '--%';
    }
  }

  // Update best moves count
  const bestMovesEl = document.getElementById('stat-best-moves');
  if (bestMovesEl) bestMovesEl.textContent = game.stats.playerBestMoves;

  // Update material advantage
  if (game.calculateMaterialAdvantage) {
    const materialAdvantage = game.calculateMaterialAdvantage();
    const materialEl = document.getElementById('stat-material');
    if (materialEl) {
      materialEl.textContent = materialAdvantage > 0 ? '+' + materialAdvantage : materialAdvantage;
      materialEl.classList.remove('positive', 'negative');
      if (materialAdvantage > 0) {
        materialEl.classList.add('positive');
      } else if (materialAdvantage < 0) {
        materialEl.classList.add('negative');
      }
    }
  }
}

/**
 * Zeigt das Statistik-Overlay an.
 * @param {object} game - Die Game-Instanz
 */
export function showStatisticsOverlay(game) {
  const overlay = document.getElementById('stats-overlay');
  if (overlay) {
    updateStatistics(game);
    overlay.classList.remove('hidden');
  }
}

/**
 * Rendert den Evaluationsgraphen basierend auf der Zughistorie.
 * @param {object} game - Die Game-Instanz
 */
export function renderEvalGraph(game) {
  // Optimization: Don't render if animating to save CPU performance
  if (game.isAnimating) return;

  const container = document.getElementById('eval-graph-container');
  const svg = document.getElementById('eval-graph');
  if (!container || !svg) return;

  // Show container if in analysis or game over phase
  if (game.phase === PHASES.ANALYSIS || game.phase === PHASES.GAME_OVER) {
    container.classList.remove('hidden');
  } else {
    // container.classList.add('hidden'); // Optional: show always
  }

  const history = game.moveHistory;
  if (history.length === 0) {
    svg.innerHTML = '';
    return;
  }

  // Extract scores, handle missing scores (fallback to 0)
  // Include move 0 (initial position) if possible, but moveHistory starts from first move.
  // We'll treat the start as 0.
  const scores = [0, ...history.map(m => m.evalScore || 0)];

  const width = 1000;
  const height = 100;
  const centerY = height / 2;
  const maxEval = 1000; // Cap evaluation at 10.00 pawns for the graph

  // Calculate points
  const points = scores.map((score, i) => {
    const x = (i / (scores.length - 1)) * width;
    // Map score to Y: +1000 -> 0, 0 -> 50, -1000 -> 100
    const normalizedScore = Math.max(-maxEval, Math.min(maxEval, score));
    const y = centerY - (normalizedScore / maxEval) * (height / 2);
    return { x, y, score, index: i - 1 };
  });

  // Generate SVG content
  let svgContent = `
    <defs>
      <linearGradient id="eval-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#4ade80;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#4f9cf9;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#f87171;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#4ade80;stop-opacity:0.3" />
        <stop offset="50%" style="stop-color:#4f9cf9;stop-opacity:0.1" />
        <stop offset="100%" style="stop-color:#f87171;stop-opacity:0.3" />
      </linearGradient>
    </defs>
    
    <line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" class="eval-zero-line" />
  `;

  // Draw area
  if (points.length > 1) {
    let areaPath = `M ${points[0].x} ${centerY} `;
    points.forEach(p => {
      areaPath += `L ${p.x} ${p.y} `;
    });
    areaPath += `L ${points[points.length - 1].x} ${centerY} Z`;
    svgContent += `<path d="${areaPath}" class="eval-area" />`;

    // Draw line
    let linePath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) {
      // Cubic Bezier for smooth curves (optional)
      // For now, simple lines are clearer for chess evaluation
      linePath += `L ${points[i].x} ${points[i].y} `;
    }
    svgContent += `<path d="${linePath}" class="eval-line" />`;
  }

  // Draw interactive points
  points.forEach((p, i) => {
    // Only draw every N points if history is very long to avoid DOM bloat
    const skipFrequency = Math.ceil(points.length / 50);
    if (i % skipFrequency === 0 || i === points.length - 1) {
      svgContent += `
        <circle cx="${p.x}" cy="${p.y}" r="3" class="eval-point" data-index="${p.index}">
          <title>Zug ${i}: ${(p.score / 100).toFixed(2)}</title>
        </circle>
      `;
    }
  });

  svg.innerHTML = svgContent;

  // Use event delegation for better performance with many points
  if (!svg.dataset.hasListener) {
    svg.addEventListener('click', e => {
      const point = e.target.closest('.eval-point');
      if (!point) return;

      const index = parseInt(point.dataset.index);
      if (index >= 0 && game.gameController && game.gameController.jumpToMove) {
        game.gameController.jumpToMove(index);
      } else if (index === -1 && game.gameController && game.gameController.jumpToStart) {
        game.gameController.jumpToStart();
      }
    });
    svg.dataset.hasListener = 'true';
  }
}

export function showTutorSuggestions(game) {
  const tutorPanel = document.getElementById('tutor-panel');
  const suggestionsEl = document.getElementById('tutor-suggestions');

  // If old UI elements don't exist, use modal overlay instead
  if (!tutorPanel || !suggestionsEl) {
    // Get tutor hints
    if (!game.tutorController || !game.tutorController.getTutorHints) {
      alert('Tutor nicht verfügbar!');
      return;
    }

    const hints = game.tutorController.getTutorHints();
    if (hints.length === 0) {
      alert('Keine Tipps verfügbar! Spiele erst ein paar Züge.');
      return;
    }

    // Create modal overlay
    let overlay = document.getElementById('tutor-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tutor-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: left;">
          <div class="menu-header">
            <h2>💡 KI-Tipps</h2>
            <button id="close-tutor-btn" class="close-icon-btn">×</button>
          </div>
          <div id="tutor-hints-body" style="max-height: 60vh; overflow-y: auto;"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('close-tutor-btn').addEventListener('click', () => {
        overlay.classList.add('hidden');
      });
    }

    const body = document.getElementById('tutor-hints-body');
    body.innerHTML = '';

    hints.forEach((hint, index) => {
      const div = document.createElement('div');
      div.style.cssText =
        'background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px; border-left: 4px solid ' +
        (hint.analysis.scoreDiff > -0.5 ? '#10b981' : '#f59e0b') +
        '; cursor: pointer; transition: background 0.2s;';
      div.onmouseover = () => {
        div.style.background = 'rgba(255,255,255,0.1)';
      };
      div.onmouseout = () => {
        div.style.background = 'rgba(255,255,255,0.05)';
      };

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 1.1em;">${index + 1}. ${hint.notation}</strong>
          <span style="font-size: 0.9em; color: ${hint.analysis.scoreDiff > -0.5 ? '#10b981' : '#f59e0b'}">${hint.analysis.qualityLabel}</span>
        </div>
        <div style="font-size: 0.9em; color: #ccc;">
          ${hint.analysis.tacticalExplanations.map(e => `<div>${e}</div>`).join('')}
          ${hint.analysis.strategicExplanations.map(e => `<div>${e}</div>`).join('')}
        </div>
      `;

      div.addEventListener('click', () => {
        overlay.classList.add('hidden');
        game.executeMove(hint.move.from, hint.move.to);
      });

      body.appendChild(div);
    });

    overlay.classList.remove('hidden');
    return;
  }

  // Original code for old UI
  // Clear previous highlights and arrows
  document.querySelectorAll('.suggestion-highlight').forEach(el => {
    el.classList.remove('suggestion-highlight');
  });
  if (game.arrowRenderer) {
    game.arrowRenderer.clearArrows();
  }

  suggestionsEl.innerHTML = '';

  // Check for Setup Phase
  if (game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_PIECES) {
    if (game.tutorController && game.tutorController.getSetupTemplates) {
      const templates = game.tutorController.getSetupTemplates();

      const header = document.createElement('h3');
      header.textContent = '🏗️ Empfohlene Aufstellungen';
      header.style.marginBottom = '1rem';
      suggestionsEl.appendChild(header);

      templates.forEach(template => {
        const el = document.createElement('div');
        el.className = 'setup-template';
        el.style.cssText = `
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            cursor: pointer;
            transition: all 0.2s;
        `;
        el.onmouseover = () => {
          el.style.background = 'rgba(34, 197, 94, 0.2)';
        };
        el.onmouseout = () => {
          el.style.background = 'rgba(34, 197, 94, 0.1)';
        };

        el.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">${template.name}</div>
            <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">${template.description}</div>
            <div style="font-size: 0.8rem; color: #94a3b8;">Kosten: ${template.cost} Punkte</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem;">
                <span>Enthält:</span>
                ${template.pieces.map(p => `<span style="display: inline-block; width: 28px; height: 28px;">${window.PIECE_SVGS ? window.PIECE_SVGS[game.phase === PHASES.SETUP_WHITE_PIECES ? 'white' : 'black'][p] : p}</span>`).join('')}
            </div>
        `;

        el.onclick = () => {
          if (
            confirm(
              `Möchtest du die Aufstellung "${template.name}" anwenden? Deine aktuelle Aufstellung wird überschrieben.`
            )
          ) {
            game.tutorController.applySetupTemplate(template.id);
            // Close panel? Or keep open? Keep open to see result.
            // Maybe flash success?
          }
        };

        suggestionsEl.appendChild(el);
      });

      tutorPanel.classList.remove('hidden');
      return;
    }
  }

  // Get tutor hints
  if (!game.getTutorHints) return;
  const hints = game.getTutorHints();

  if (hints.length === 0) {
    suggestionsEl.innerHTML =
      '<p style="padding: 1rem; color: #94a3b8;">Keine Vorschläge verfügbar.</p>';
    tutorPanel.classList.remove('hidden');
    return;
  }

  const header = document.createElement('h3');
  header.innerHTML = `
    🤖 Tutor Vorschläge
    <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8; display: block; margin-top: 0.25rem;">
      Beste Züge für ${game.turn === 'white' ? 'Weiß' : 'Schwarz'}
    </span>
  `;
  suggestionsEl.appendChild(header);

  // Display each hint with analysis
  hints.forEach((hint, index) => {
    // Use pre-calculated analysis if available, otherwise calculate (fallback)
    const analysis = hint.analysis || game.analyzeMoveWithExplanation(hint.move, hint.score);

    const suggEl = document.createElement('div');
    suggEl.className = `tutor-suggestion ${analysis.category}`;
    suggEl.style.cssText = `
      margin-bottom: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Move overview (always visible)
    const overview = document.createElement('div');
    overview.className = 'suggestion-overview';
    overview.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      padding: 0.75rem;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 8px;
    `;

    const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';

    // Get descriptive score label
    const scoreDesc = game.getScoreDescription ? game.getScoreDescription(hint.score) : null;
    const scoreDisplay = scoreDesc
      ? `<span style="color: ${scoreDesc.color};">${scoreDesc.emoji} ${scoreDesc.label}</span>`
      : `<span style="color: ${hint.score > 0 ? '#22c55e' : '#888'};">${(hint.score / 100).toFixed(1)}</span>`;

    overview.innerHTML = `
      <span style="font-size: 1.2rem;">${rankBadge}</span>
      <span style="flex: 1;">${hint.notation}</span>
      ${scoreDisplay}
    `;
    suggEl.appendChild(overview);

    // Quality Label (New)
    if (analysis.qualityLabel) {
      const qualityEl = document.createElement('div');
      qualityEl.style.cssText = `
        font-size: 0.9rem;
        margin-top: 0.5rem;
        padding: 0 0.75rem;
        font-weight: 500;
        color: ${analysis.category === 'excellent' ? '#fbbf24' : analysis.category === 'good' ? '#4ade80' : '#94a3b8'};
      `;
      qualityEl.textContent = analysis.qualityLabel;
      suggEl.appendChild(qualityEl);
    }

    // Action buttons
    const actionsEl = document.createElement('div');
    actionsEl.className = 'suggestion-actions';
    actionsEl.style.cssText = `
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding: 0 0.75rem;
    `;

    // Try This Move button
    const tryBtn = document.createElement('button');
    tryBtn.className = 'try-move-btn';
    tryBtn.style.cssText = `
      flex: 1;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.85rem;
    `;
    tryBtn.innerHTML = '▶️ Diesen Zug probieren';
    tryBtn.onmouseover = () => {
      tryBtn.style.transform = 'translateY(-2px)';
      tryBtn.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
    };
    tryBtn.onmouseout = () => {
      tryBtn.style.transform = '';
      tryBtn.style.boxShadow = '';
    };
    tryBtn.onclick = e => {
      e.stopPropagation(); // Prevent suggestion click handler
      const fromPos = hint.move.from;
      const toPos = hint.move.to;

      // Execute the move
      if (game.executeMove) {
        game.executeMove(fromPos, toPos);

        // Close tutor panel after move
        const tutorPanel = document.getElementById('tutor-panel');
        if (tutorPanel) {
          tutorPanel.classList.add('hidden');
        }
      }
    };

    actionsEl.appendChild(tryBtn);
    suggEl.appendChild(actionsEl);

    // Explanations section (expandable)
    const hasTactical = analysis.tacticalExplanations && analysis.tacticalExplanations.length > 0;
    const hasStrategic =
      analysis.strategicExplanations && analysis.strategicExplanations.length > 0;
    const hasWarnings = analysis.warnings && analysis.warnings.length > 0;

    if (hasTactical || hasStrategic || hasWarnings) {
      const detailsEl = document.createElement('div');
      detailsEl.className = 'suggestion-details';
      detailsEl.style.cssText = `
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        font-size: 0.85rem;
      `;

      // Tactical Explanations
      if (hasTactical) {
        const tactDiv = document.createElement('div');
        tactDiv.className = 'suggestion-tactical';
        tactDiv.style.marginBottom = '0.5rem';
        analysis.tacticalExplanations.forEach(expl => {
          const explItem = document.createElement('div');
          explItem.style.cssText = `
            color: #fca5a5;
            font-weight: 500;
            margin: 0.25rem 0;
            padding-left: 0.5rem;
            border-left: 2px solid #ef4444;
          `;
          explItem.textContent = expl;
          tactDiv.appendChild(explItem);
        });
        detailsEl.appendChild(tactDiv);
      }

      // Strategic Explanations
      if (hasStrategic) {
        const stratDiv = document.createElement('div');
        stratDiv.className = 'suggestion-strategic';
        analysis.strategicExplanations.forEach(expl => {
          const explItem = document.createElement('div');
          explItem.style.cssText = `
            color: #cbd5e1;
            margin: 0.25rem 0;
            padding-left: 0.5rem;
          `;
          explItem.textContent = expl;
          stratDiv.appendChild(explItem);
        });
        detailsEl.appendChild(stratDiv);
      }

      // Warnings
      if (hasWarnings) {
        const warnDiv = document.createElement('div');
        warnDiv.className = 'suggestion-warnings';
        warnDiv.style.marginTop = '0.5rem';
        analysis.warnings.forEach(warn => {
          const warnItem = document.createElement('div');
          warnItem.style.cssText = `
            color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            margin: 0.25rem 0;
          `;
          warnItem.textContent = warn; // Warning already has emoji
          warnDiv.appendChild(warnItem);
        });
        detailsEl.appendChild(warnDiv);
      }

      suggEl.appendChild(detailsEl);
    }

    // Click handler to highlight move on board
    suggEl.addEventListener('click', () => {
      // Remove previous selection
      document.querySelectorAll('.tutor-suggestion').forEach(el => {
        el.style.borderLeft = '';
      });

      // Highlight this suggestion
      const color =
        analysis.category === 'excellent'
          ? '#fbbf24'
          : analysis.category === 'good'
            ? '#22c55e'
            : '#4f9cf9';
      suggEl.style.borderLeft = `4px solid ${color}`;

      // Clear previous highlights
      document.querySelectorAll('.suggestion-highlight').forEach(el => {
        el.classList.remove('suggestion-highlight');
      });

      // Draw arrow if available
      const quality = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';
      if (game.arrowRenderer) {
        game.arrowRenderer.highlightMove(
          hint.move.from.r,
          hint.move.from.c,
          hint.move.to.r,
          hint.move.to.c,
          quality
        );
      }

      // Highlight cells
      const fromCell = document.querySelector(
        `.cell[data-r="${hint.move.from.r}"][data-c="${hint.move.from.c}"]`
      );
      const toCell = document.querySelector(
        `.cell[data-r="${hint.move.to.r}"][data-c="${hint.move.to.c}"]`
      );
      if (fromCell) fromCell.classList.add('suggestion-highlight');
      if (toCell) toCell.classList.add('suggestion-highlight');
    });

    suggestionsEl.appendChild(suggEl);
  });

  tutorPanel.classList.remove('hidden');
}

export function updateReplayUI(game) {
  // Update move number display
  const moveNumEl = document.getElementById('replay-move-num');
  if (moveNumEl) moveNumEl.textContent = game.replayPosition + 1;

  // Update button states
  const firstBtn = document.getElementById('replay-first');
  const prevBtn = document.getElementById('replay-prev');
  const nextBtn = document.getElementById('replay-next');
  const lastBtn = document.getElementById('replay-last');

  if (firstBtn) firstBtn.disabled = game.replayPosition === -1;
  if (prevBtn) prevBtn.disabled = game.replayPosition === -1;
  if (nextBtn) nextBtn.disabled = game.replayPosition === game.moveHistory.length - 1;
  if (lastBtn) lastBtn.disabled = game.replayPosition === game.moveHistory.length - 1;

  renderBoard(game);
}

export function enterReplayMode(game) {
  if (game.replayMode || game.moveHistory.length === 0) return;

  // Save current game state
  game.savedGameState = {
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    selectedSquare: game.selectedSquare,
    validMoves: game.validMoves,
    lastMoveHighlight: game.lastMoveHighlight,
  };

  game.replayMode = true;
  game.replayPosition = game.moveHistory.length - 1;
  if (game.stopClock) game.stopClock();

  // Update UI
  document.getElementById('replay-status').classList.remove('hidden');
  document.getElementById('replay-exit').classList.remove('hidden');
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = true;

  updateReplayUI(game);
}

export function exitReplayMode(game) {
  if (!game.replayMode) return;

  // Restore game state
  if (game.savedGameState) {
    game.board = game.savedGameState.board;
    game.turn = game.savedGameState.turn;
    game.selectedSquare = game.savedGameState.selectedSquare;
    game.validMoves = game.savedGameState.validMoves;
    game.lastMoveHighlight = game.savedGameState.lastMoveHighlight;
  }

  game.replayMode = false;
  game.replayPosition = -1;
  game.savedGameState = null;

  // Update UI
  document.getElementById('replay-status').classList.add('hidden');
  document.getElementById('replay-exit').classList.add('hidden');
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;

  renderBoard(game);

  // Restart clock if needed
  if (game.clockEnabled && game.phase === PHASES.PLAY && game.startClock) {
    game.startClock();
  }
}

/**
 * Zeigt ein modales Dialogfenster an.
 * @param {string} title - Der Titel des Modals
 * @param {string} message - Die Nachricht
 * @param {Array<{text: string, class: string, callback: Function}>} actions - Buttons
 */
export function showModal(title, message, actions = []) {
  const modal = document.getElementById('generic-modal');
  const titleEl = document.getElementById('modal-title');
  const messageEl = document.getElementById('modal-message');
  const actionsEl = document.getElementById('modal-actions');

  if (!modal || !titleEl || !messageEl || !actionsEl) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  actionsEl.innerHTML = '';

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action.text;
    btn.className = action.class || 'btn-secondary';
    btn.onclick = () => {
      if (action.callback) action.callback();
      closeModal();
    };
    actionsEl.appendChild(btn);
  });

  modal.style.display = 'flex';
}

export function closeModal() {
  const modal = document.getElementById('generic-modal');
  if (modal) modal.style.display = 'none';
}

// --- Puzzle UI Helpers ---

export function showPuzzleOverlay(puzzle) {
  const overlay = document.getElementById('puzzle-overlay');
  if (!overlay) return;

  document.getElementById('puzzle-title').textContent = puzzle.title;
  document.getElementById('puzzle-description').textContent = puzzle.description;

  const statusEl = document.getElementById('puzzle-status');
  statusEl.textContent = 'Weiß am Zug';
  statusEl.className = 'puzzle-status';

  // Hide next button, show exit
  document.getElementById('puzzle-next-btn').classList.add('hidden');
  document.getElementById('puzzle-exit-btn').classList.remove('hidden');

  overlay.classList.remove('hidden');
}

export function hidePuzzleOverlay() {
  const overlay = document.getElementById('puzzle-overlay');
  if (overlay) overlay.classList.add('hidden');
}

export function updatePuzzleStatus(status, message) {
  const statusEl = document.getElementById('puzzle-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `puzzle-status ${status}`; // status: 'success', 'error', 'neutral'

  if (status === 'success') {
    document.getElementById('puzzle-next-btn').classList.remove('hidden');
  }
}
/**
 * Zeigt eine kurze Toast-Nachricht an.
 * @param {string} message - Nachricht
 * @param {string} type - 'success', 'error', 'neutral'
 */
export function showToast(message, type = 'neutral') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '💡';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  // Fade out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
