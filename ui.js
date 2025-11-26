// ui.js
/**
 * UI-Modul für Schach9x9.
 * Beinhaltet DOM-Manipulation, Event-Listener und Rendering.
 * @module ui
 */
import { BOARD_SIZE, PHASES, PIECE_VALUES } from './config.js';
import { debounce } from './utils.js';

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
      const pieceSymbols = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K', a: 'A', c: 'C' };
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
  // Column labels (a-i) at top
  const colLabels = document.createElement('div');
  colLabels.className = 'col-labels';
  for (let c = 0; c < BOARD_SIZE; c++) {
    const label = document.createElement('span');
    label.textContent = String.fromCharCode(97 + c); // a-i
    label.className = 'coord-label';
    colLabels.appendChild(label);
  }

  // Row labels (1-9) on left side
  const rowLabels = document.createElement('div');
  rowLabels.className = 'row-labels';
  for (let r = 0; r < BOARD_SIZE; r++) {
    const label = document.createElement('span');
    label.textContent = (BOARD_SIZE - r).toString(); // 9, 8, 7, ..., 1 from top to bottom
    label.className = 'coord-label';
    rowLabels.appendChild(label);
  }

  // Find board-wrapper and insert labels
  const boardWrapper = document.getElementById('board-wrapper');
  if (boardWrapper) {
    // Remove existing labels if any
    const existingColLabels = boardWrapper.querySelector('.col-labels');
    const existingRowLabels = boardWrapper.querySelector('.row-labels');
    if (existingColLabels) existingColLabels.remove();
    if (existingRowLabels) existingRowLabels.remove();

    // Insert col labels before board
    boardWrapper.insertBefore(colLabels, boardEl);
    // Insert row labels before board
    boardWrapper.insertBefore(rowLabels, boardEl);
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
  const cellsToRender = game._forceFullRender
    ? Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
      r: Math.floor(i / BOARD_SIZE),
      c: i % BOARD_SIZE,
    }))
    : changedCells;

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
      if (game.phase === PHASES.SETUP_WHITE_KING || game.phase === PHASES.SETUP_BLACK_KING) {
        const isWhite = game.phase === PHASES.SETUP_WHITE_KING;
        const rowStart = isWhite ? 6 : 0;
        if (r >= rowStart && r < rowStart + 3) {
          if (c < 3 || (c >= 3 && c < 6) || c >= 6) {
            cell.classList.add('selectable-corridor');
          }
        }
      } else if (game.phase === PHASES.SETUP_WHITE_PIECES && game.whiteCorridor) {
        if (
          r >= game.whiteCorridor.rowStart &&
          r < game.whiteCorridor.rowStart + 3 &&
          c >= game.whiteCorridor.colStart &&
          c < game.whiteCorridor.colStart + 3
        ) {
          cell.classList.add('selectable-corridor');
        }
      } else if (game.phase === PHASES.SETUP_BLACK_PIECES && game.blackCorridor) {
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
        if (game.phase === PHASES.SETUP_WHITE_KING || game.phase === PHASES.SETUP_BLACK_KING) {
          const isWhite = game.phase === PHASES.SETUP_WHITE_KING;
          const rowStart = isWhite ? 6 : 0;
          if (r >= rowStart && r < rowStart + 3) {
            if (c < 3 || (c >= 3 && c < 6) || c >= 6) {
              cell.classList.add('selectable-corridor');
            }
          }
        } else if (game.phase === PHASES.SETUP_WHITE_PIECES && game.whiteCorridor) {
          if (
            r >= game.whiteCorridor.rowStart &&
            r < game.whiteCorridor.rowStart + 3 &&
            c >= game.whiteCorridor.colStart &&
            c < game.whiteCorridor.colStart + 3
          ) {
            cell.classList.add('selectable-corridor');
          }
        } else if (game.phase === PHASES.SETUP_BLACK_PIECES && game.blackCorridor) {
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
    text = 'Schwarz: Wähle einen Korridor für den König';
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

  const whiteEl = document.querySelector('#clock-white .clock-time');
  const blackEl = document.querySelector('#clock-black .clock-time');

  if (whiteEl) whiteEl.textContent = formatTime(game.whiteTime);
  if (blackEl) blackEl.textContent = formatTime(game.blackTime);
}

export function showShop(game, show) {
  const panel = document.getElementById('shop-panel');
  if (show) panel.classList.remove('hidden');
  else panel.classList.add('hidden');
  updateShopUI(game);
}

export function updateShopUI(game) {
  document.getElementById('points-display').textContent = game.points;

  // Disable buttons if too expensive
  document.querySelectorAll('.shop-btn').forEach(btn => {
    const cost = parseInt(btn.dataset.cost);
    btn.disabled = cost > game.points;
  });

  const finishBtn = document.getElementById('finish-setup-btn');
  if (finishBtn) {
    finishBtn.disabled = false;
    console.log('[DEBUG] updateShopUI: Finish button enabled, points:', game.points);
  } else {
    console.warn('[WARN] updateShopUI: Finish button not found!');
  }
}

export function showPromotionUI(game, r, c, color, moveRecord, callback) {
  const overlay = document.getElementById('promotion-overlay');
  const optionsContainer = document.getElementById('promotion-options');
  optionsContainer.innerHTML = '';

  const options = [
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
    clone.style.transition = 'all 0.3s ease-in-out';
    const toRect = toCell.getBoundingClientRect();
    clone.style.left = toRect.left + 'px';
    clone.style.top = toRect.top + 'px';

    setTimeout(() => {
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
      // Restore opacity (though board might be re-rendered anyway)
      if (pieceElement) pieceElement.style.opacity = originalOpacity;

      game.isAnimating = false;
      resolve();
    }, 300);
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
  game.stats.captures = game.capturedPieces.white.length + game.capturedPieces.black.length;
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
  // We need calculateMaterialAdvantage from game or implement it here.
  // It's pure logic, but let's assume game has it or we can compute it.
  // For now, let's assume game has it or we skip it if not available.
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

export function showTutorSuggestions(game) {
  const tutorPanel = document.getElementById('tutor-panel');
  const suggestionsEl = document.getElementById('tutor-suggestions');

  if (!tutorPanel || !suggestionsEl) return;

  // Clear previous highlights and arrows
  document.querySelectorAll('.suggestion-highlight').forEach(el => {
    el.classList.remove('suggestion-highlight');
  });
  if (game.arrowRenderer) {
    game.arrowRenderer.clearArrows();
  }

  // Get tutor hints
  if (!game.getTutorHints) return;
  const hints = game.getTutorHints();

  if (hints.length === 0) {
    suggestionsEl.innerHTML = '<p style="color: #888;">Keine Züge verfügbar</p>';
    tutorPanel.classList.remove('hidden');
    return;
  }

  // Clear and rebuild UI
  suggestionsEl.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'tutor-header';
  header.style.cssText = `
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  `;
  header.innerHTML = `
    <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">💡 Empfohlene Züge</h4>
    <p style="margin: 0; font-size: 0.8rem; color: #888;">
      Klicke auf einen Zug für Details
    </p>
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
    if (analysis.explanations.length > 0 || analysis.warnings.length > 0) {
      const detailsEl = document.createElement('div');
      detailsEl.className = 'suggestion-details';
      detailsEl.style.cssText = `
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        font-size: 0.85rem;
      `;

      // Explanations
      if (analysis.explanations.length > 0) {
        const explDiv = document.createElement('div');
        explDiv.className = 'suggestion-explanations';
        analysis.explanations.forEach(expl => {
          const explItem = document.createElement('div');
          explItem.style.cssText = `
            color: #cbd5e1;
            margin: 0.25rem 0;
            padding-left: 0.5rem;
          `;
          explItem.textContent = expl;
          explDiv.appendChild(explItem);
        });
        detailsEl.appendChild(explDiv);
      }

      // Warnings
      if (analysis.warnings.length > 0) {
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
          warnItem.textContent = `⚠️ ${warn}`;
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
