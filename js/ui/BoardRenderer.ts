/**
 * Modul für das Rendern des Schachbretts.
 * @module BoardRenderer
 */
import { BOARD_SIZE, PHASES } from '../config.js';
import { debounce } from '../utils.js';
import { particleSystem, floatingTextManager, shakeScreen } from '../effects.js';
import type { Piece, Player, PieceType, Square } from '../types/game.js';

// Define window extensions for piece SVGs and cache
declare global {
  interface Window {
    PIECE_SVGS: Record<Player, Record<Exclude<PieceType, null>, string>>;
    _svgCache: Record<string, string>;
  }
}

/**
 * Get effective board size (from game instance or fallback to BOARD_SIZE)
 */
function getBoardSize(game: any): number {
  return game && game.boardSize ? game.boardSize : BOARD_SIZE;
}

/**
 * Gibt das SVG-Symbol für eine Figur zurück.
 * @param piece - Die Figur
 * @returns HTML-String des SVGs
 */
export function getPieceSymbol(piece: Piece | null): string {
  if (!piece) return '';
  if (!window._svgCache) window._svgCache = {};
  const key = piece.color + piece.type;
  if (!window._svgCache[key]) {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-svg';
    wrapper.innerHTML = window.PIECE_SVGS[piece.color][piece.type];
    window._svgCache[key] = wrapper.outerHTML;
  }
  return window._svgCache[key];
}

/**
 * Clears the piece SVG cache.
 */
export function clearPieceCache(): void {
  window._svgCache = {};
}

/**
 * Gibt das Text-Symbol (Unicode) für eine Figur zurück.
 * @param piece - Die Figur
 * @returns Text-Symbol
 */
export function getPieceText(piece: Piece | null): string {
  if (!piece) return '';
  const symbols: Record<Player, Record<Exclude<PieceType, null>, string>> = {
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
      j: 'J',
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
      j: 'J',
    },
  };
  return symbols[piece.color][piece.type];
}

/**
 * Initialisiert das Schachbrett im DOM und fügt Event-Listener hinzu.
 * @param game - Die Game-Instanz
 */
export function initBoardUI(game: any): void {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const size = getBoardSize(game);

  // Add CSS class for board size
  boardEl.classList.remove('board-8x8', 'board-9x9');
  boardEl.classList.add(size === 8 ? 'board-8x8' : 'board-9x9');

  // Set CSS grid template
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${size}, 1fr)`;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      // Only show corridor borders for 9x9 mode
      if (size === 9) {
        if (c === 2 || c === 5) cell.classList.add('border-right');
        if (r === 2 || r === 5) cell.classList.add('border-bottom');
      }
      cell.dataset.r = r.toString();
      cell.dataset.c = c.toString();
      cell.addEventListener('click', () => {
        console.log('[BoardRenderer] Cell click: row=%d, col=%d, phase=%s', r, c, game.phase);
        game.handleCellClick(r, c);
      });

      // Drag & Drop
      cell.draggable = true;
      cell.addEventListener('dragstart', e => {
        if (game.phase !== PHASES.PLAY || game.replayMode || game.isAnimating) {
          e.preventDefault();
          return;
        }
        const piece = game.board[r][c];
        if (!piece || (game.isAI && game.turn === 'black') || piece.color !== game.turn) {
          e.preventDefault();
          return;
        }
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', `${r},${c}`);
          e.dataTransfer.effectAllowed = 'move';

          cell.classList.add('dragging');
          const dragImage = cell.cloneNode(true) as HTMLElement;
          dragImage.style.opacity = '0.8';
          dragImage.style.transform = 'rotate(5deg)';
          document.body.appendChild(dragImage);
          dragImage.style.position = 'absolute';
          dragImage.style.top = '-1000px';
          e.dataTransfer.setDragImage(dragImage, cell.offsetWidth / 2, cell.offsetHeight / 2);
          setTimeout(() => {
            if (document.body.contains(dragImage)) {
              document.body.removeChild(dragImage);
            }
          }, 0);
        }

        const validMoves = game.getValidMoves(r, c, piece);
        validMoves.forEach((move: Square) => {
          const targetCell = document.querySelector(
            `.cell[data-r="${move.r}"][data-c="${move.c}"]`
          );
          if (targetCell) targetCell.classList.add('drag-target');
        });
      });

      cell.addEventListener('dragend', () => {
        cell.classList.remove('dragging');
        document
          .querySelectorAll('.cell.drag-target')
          .forEach(c => c.classList.remove('drag-target'));
        document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));
      });

      cell.addEventListener('dragover', e => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
          const data = e.dataTransfer.getData('text/plain');
          if (!data) return;
          const [fromR, fromC] = data.split(',').map(Number);
          const piece = game.board[fromR][fromC];
          if (!piece) return;
          const validMoves = game.getValidMoves(fromR, fromC, piece);
          if (validMoves.some((move: Square) => move.r === r && move.c === c)) {
            cell.classList.add('drag-over');
          }
        }
      });

      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));

      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (e.dataTransfer) {
          const data = e.dataTransfer.getData('text/plain');
          if (!data) return;
          const [fromR, fromC] = data.split(',').map(Number);
          const piece = game.board[fromR][fromC];
          if (!piece || piece.color !== game.turn) return;
          const validMoves = game.getValidMoves(fromR, fromC, piece);
          if (validMoves.some((move: Square) => move.r === r && move.c === c)) {
            game.selectedSquare = { r: fromR, c: fromC };
            game.validMoves = validMoves;
            game.handleCellClick(r, c);
          }
        }
      });

      // --- TOUCH SUPPORT (Mobile) ---
      let draggedElement: HTMLElement | null = null;

      cell.addEventListener(
        'touchstart',
        e => {
          if (game.phase !== PHASES.PLAY || game.replayMode || game.isAnimating) return;
          const touch = e.touches[0];
          const piece = game.board[r][c];

          if (!piece || (game.isAI && game.turn === 'black') || piece.color !== game.turn) {
            return;
          }

          e.preventDefault(); // Prevent scrolling
          cell.classList.add('dragging');

          // Create visual drag element
          const pieceSvg = cell.querySelector('.piece-svg');
          if (pieceSvg) {
            draggedElement = pieceSvg.cloneNode(true) as HTMLElement;
            draggedElement.style.position = 'fixed';
            draggedElement.style.zIndex = '1000';
            draggedElement.style.width = cell.offsetWidth + 'px';
            draggedElement.style.height = cell.offsetHeight + 'px';
            draggedElement.style.pointerEvents = 'none';
            draggedElement.style.opacity = '0.8';
            draggedElement.style.left = touch.clientX - cell.offsetWidth / 2 + 'px';
            draggedElement.style.top = touch.clientY - cell.offsetHeight / 2 + 'px';
            document.body.appendChild(draggedElement);
          }

          // Highlight valid moves
          const validMoves = game.getValidMoves(r, c, piece);
          validMoves.forEach((move: Square) => {
            const target = document.querySelector(`.cell[data-r="${move.r}"][data-c="${move.c}"]`);
            if (target) target.classList.add('drag-target');
          });
        },
        { passive: false }
      );

      cell.addEventListener(
        'touchmove',
        e => {
          if (!draggedElement) return;
          e.preventDefault();
          const touch = e.touches[0];

          draggedElement.style.left = touch.clientX - cell.offsetWidth / 2 + 'px';
          draggedElement.style.top = touch.clientY - cell.offsetHeight / 2 + 'px';

          // Visual feedback for drop target
          const target = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetCell = target ? target.closest('.cell') : null;

          document
            .querySelectorAll('.cell.drag-over')
            .forEach(c => c.classList.remove('drag-over'));
          if (targetCell && targetCell.classList.contains('drag-target')) {
            targetCell.classList.add('drag-over');
          }
        },
        { passive: false }
      );

      cell.addEventListener('touchend', e => {
        if (!draggedElement) return;

        // Clean up visual elements
        if (draggedElement && document.body.contains(draggedElement)) {
          document.body.removeChild(draggedElement);
        }
        draggedElement = null;
        cell.classList.remove('dragging');
        document
          .querySelectorAll('.cell.drag-target')
          .forEach(c => c.classList.remove('drag-target'));
        document.querySelectorAll('.cell.drag-over').forEach(c => c.classList.remove('drag-over'));

        // Handle drop
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetCell = target ? (target.closest('.cell') as HTMLElement) : null;

        if (targetCell) {
          const targetR = parseInt(targetCell.dataset.r || '0');
          const targetC = parseInt(targetCell.dataset.c || '0');

          const validMoves = game.getValidMoves(r, c, game.board[r][c]);
          if (validMoves.some((m: Square) => m.r === targetR && m.c === targetC)) {
            game.selectedSquare = { r, c };
            game.validMoves = validMoves;
            game.handleCellClick(targetR, targetC);
          }
        }
      });

      cell.addEventListener(
        'mouseenter',
        debounce(() => {
          if (game.phase === PHASES.PLAY && !game.replayMode) {
            const piece = game.board[r][c];
            if (piece) {
              game.getValidMoves(r, c, piece).forEach((move: Square) => {
                const targetCell = document.querySelector(
                  `.cell[data-r="${move.r}"][data-c="${move.c}"]`
                ) as HTMLElement | null;
                if (targetCell) targetCell.classList.add('hover-move');
              });
              cell.classList.add('hover-piece');
            }
          }
        }, 50)
      );

      cell.addEventListener('mouseleave', () => {
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

  // Koordinaten-Labels
  const boardWrapper = document.getElementById('board-wrapper');
  if (boardWrapper) {
    boardWrapper.querySelectorAll('.col-labels, .row-labels').forEach(el => el.remove());
    const colLabels = document.createElement('div');
    colLabels.className = 'col-labels';
    colLabels.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let c = 0; c < size; c++) {
      const label = document.createElement('span');
      label.textContent = String.fromCharCode(97 + c);
      label.className = 'coord-label';
      colLabels.appendChild(label);
    }
    const rowLabels = document.createElement('div');
    rowLabels.className = 'row-labels';
    rowLabels.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    for (let r = 0; r < size; r++) {
      const label = document.createElement('span');
      label.textContent = (size - r).toString();
      label.className = 'coord-label';
      rowLabels.appendChild(label);
    }
    boardWrapper.appendChild(colLabels);
    boardWrapper.appendChild(rowLabels);
  }
}

/**
 * Rendert das Schachbrett und die Figuren im DOM.
 * @param game - Die Game-Instanz
 */
export function renderBoard(game: any): void {
  const size = getBoardSize(game);

  if (!game._previousBoardState) {
    game._previousBoardState = Array(size)
      .fill(null)
      .map(() => Array(size).fill(null));
    game._forceFullRender = true;
  }

  document
    .querySelectorAll('.cell.selectable-corridor')
    .forEach(cell => cell.classList.remove('selectable-corridor'));

  const cellsToRender: Square[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const currentPiece = game.board[r][c];
      const prev = game._previousBoardState[r] ? game._previousBoardState[r][c] : null;
      const changed =
        (!currentPiece && prev) ||
        (currentPiece && !prev) ||
        (currentPiece &&
          prev &&
          (currentPiece.type !== prev.type || currentPiece.color !== prev.color));
      if (game._forceFullRender || changed) {
        cellsToRender.push({ r, c });
        if (!game._previousBoardState[r]) game._previousBoardState[r] = [];
        game._previousBoardState[r][c] = currentPiece
          ? { type: currentPiece.type, color: currentPiece.color }
          : null;
      }
    }
  }

  game._forceFullRender = false;

  for (const { r, c } of cellsToRender) {
    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
    if (!cell) continue;
    const piece = game.board[r][c];
    const symbol = getPieceSymbol(piece);
    if (cell.innerHTML !== symbol) cell.innerHTML = symbol;

    if (piece) {
      cell.dataset.piece = piece.type;
      cell.dataset.color = piece.color;
    } else {
      delete cell.dataset.piece;
      delete cell.dataset.color;
    }
    cell.classList.remove(
      'highlight',
      'corridor',
      'valid-move',
      'last-move',
      'tutor-move',
      'threatened',
      'selectable-corridor',
      'upgradable-piece'
    );
  }

  // Rendere Highlights (immer für alle Zellen relevanten Zustände prüfen)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
      if (!cell) continue;

      // Korridore
      const isHumanSetup =
        game.phase === PHASES.SETUP_WHITE_KING ||
        (game.phase === PHASES.SETUP_BLACK_KING && !game.isAI);
      if (isHumanSetup) {
        const rowStart = game.phase === PHASES.SETUP_WHITE_KING ? 6 : 0;
        if (
          r >= rowStart &&
          r < rowStart + 3 &&
          ((c >= 0 && c <= 2) || (c >= 3 && c <= 5) || (c >= 6 && c <= 8))
        ) {
          cell.classList.add('selectable-corridor');
        }
      }
      if (
        typeof game.whiteCorridor === 'number' &&
        (game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_KING)
      ) {
        if (r >= 6 && r < 9 && c >= game.whiteCorridor && c < game.whiteCorridor + 3) {
          cell.classList.add('selectable-corridor');
        }
      }
      if (typeof game.blackCorridor === 'number' && game.phase === PHASES.SETUP_BLACK_PIECES) {
        if (r >= 0 && r < 3 && c >= game.blackCorridor && c < game.blackCorridor + 3) {
          cell.classList.add('selectable-corridor');
        }
      }

      // Andere Highlights
      cell.classList.remove(
        'highlight',
        'valid-move',
        'tutor-move',
        'last-move',
        'threatened',
        'upgradable-piece'
      );

      const p = game.board[r][c];

      // Upgrade mode highlighting
      const isUpgradePhase =
        game.phase === PHASES.SETUP_WHITE_UPGRADES || game.phase === PHASES.SETUP_BLACK_UPGRADES;
      if (isUpgradePhase && p && p.type !== 'k') {
        const turnColor = game.phase === PHASES.SETUP_WHITE_UPGRADES ? 'white' : 'black';
        if (p.color === turnColor) {
          cell.classList.add('upgradable-piece');
        }
      }

      if (game.selectedSquare && game.selectedSquare.r === r && game.selectedSquare.c === c)
        cell.classList.add('highlight');
      if (game.validMoves) {
        const move = game.validMoves.find((m: Square) => m.r === r && m.c === c);
        if (move) {
          cell.classList.add('valid-move');
          if (game.isTutorMove && game.isTutorMove(game.selectedSquare, { r, c }))
            cell.classList.add('tutor-move');
        }
      }
      if (
        game.lastMoveHighlight &&
        ((game.lastMoveHighlight.from.r === r && game.lastMoveHighlight.from.c === c) ||
          (game.lastMoveHighlight.to.r === r && game.lastMoveHighlight.to.c === c))
      ) {
        cell.classList.add('last-move');
      }
      if (game.phase === PHASES.PLAY && p) {
        const opponent = p.color === 'white' ? 'black' : 'white';
        if (game.isSquareUnderAttack && game.isSquareUnderAttack(r, c, opponent))
          cell.classList.add('threatened');
      }
    }
  }
}

/**
 * Animiert einen Zug.
 * @param game - Die Game-Instanz
 * @param from - Startposition {r, c}
 * @param to - Zielposition {r, c}
 * @param piece - Die bewegte Figur
 */
export async function animateMove(
  game: any,
  from: Square,
  to: Square,
  piece: Piece
): Promise<void> {
  game.isAnimating = true;
  return new Promise(resolve => {
    const fromCell = document.querySelector(`.cell[data-r="${from.r}"][data-c="${from.c}"]`);
    const toCell = document.querySelector(`.cell[data-r="${to.r}"][data-c="${to.c}"]`);
    if (!fromCell || !toCell) {
      game.isAnimating = false;
      resolve();
      return;
    }
    let pieceElement = fromCell.querySelector('.piece-svg') as HTMLElement | null;
    if (!pieceElement) {
      const wrapper = document.createElement('div');
      wrapper.className = 'piece-svg';
      wrapper.innerHTML = getPieceSymbol(piece);
      pieceElement = wrapper;
      fromCell.appendChild(wrapper);
    }
    const clone = pieceElement.cloneNode(true) as HTMLElement;
    clone.className = 'animating-piece';
    clone.style.position = 'fixed';
    clone.style.zIndex = '10000';
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'none';
    const fromRect = fromCell.getBoundingClientRect();
    clone.style.left = fromRect.left + 'px';
    clone.style.top = fromRect.top + 'px';
    clone.style.width = fromRect.width + 'px';
    clone.style.height = fromRect.height + 'px';
    clone.style.display = 'flex';
    clone.style.justifyContent = 'center';
    clone.style.alignItems = 'center';
    document.body.appendChild(clone);

    const originalOpacity = pieceElement.style.opacity;
    pieceElement.style.opacity = '0';
    void clone.offsetHeight; // Force reflow
    clone.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
    const toRect = toCell.getBoundingClientRect();
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;
    clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    const targetPiece = game.board[to.r][to.c];
    const isCapture = targetPiece && targetPiece.color !== piece.color;

    // Animation Loop for Move Trail
    const trailInterval = setInterval(() => {
      const rect = clone.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Special trail for elite pieces
      const isElite = ['j', 'a', 'c', 'e', 'q'].includes(piece.type);
      const color = isElite
        ? piece.color === 'white'
          ? '#60a5fa'
          : '#2563eb' // Blue for elite
        : piece.color === 'white'
          ? '#e2e8f0'
          : '#475569'; // Default gray

      if (isElite) {
        particleSystem.spawnTrail(centerX, centerY, color);
      } else {
        particleSystem.spawn(centerX, centerY, 'TRAIL', color);
      }
    }, 20); // Faster interval for smoother trails

    setTimeout(() => {
      clearInterval(trailInterval);
      if (document.body.contains(clone)) document.body.removeChild(clone);
      if (pieceElement) pieceElement.style.opacity = originalOpacity;

      const centerX = toRect.left + toRect.width / 2;
      const centerY = toRect.top + toRect.height / 2;

      if (isCapture) {
        const color = targetPiece.color === 'white' ? '#e2e8f0' : '#1e293b';
        particleSystem.spawn(centerX, centerY, 'CAPTURE', color);

        // Shake screen on heavy captures
        const heavyPieces: PieceType[] = ['q', 'a', 'c', 'k', 'r'];
        if (heavyPieces.includes(targetPiece.type)) {
          shakeScreen(8, 250); // Stronger shake
        } else {
          shakeScreen(4, 150); // Light shake
        }

        // Show floating score
        const values: Record<Exclude<PieceType, null>, number> = {
          p: 1,
          n: 3,
          b: 3,
          r: 5,
          q: 9,
          e: 12,
          a: 7,
          c: 8,
          j: 6,
          k: 0,
        };
        const scoreVal = values[targetPiece.type as Exclude<PieceType, null>] || 0;
        if (scoreVal > 0) {
          floatingTextManager.show(centerX, centerY, `+${scoreVal}`, 'score');
        }
      } else {
        // Subtle particles for normal moves (impact at destination)
        const color = piece.color === 'white' ? '#f8fafc' : '#334155';
        particleSystem.spawn(centerX, centerY, 'MOVE', color);
      }
      game.isAnimating = false;
      resolve();
    }, 250);
  });
}

/**
 * Visualizes move quality on the board
 * @param game - The game instance
 * @param move - {from, to}
 * @param category - 'brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'
 */
export function showMoveQuality(_game: any, move: any, category: string): void {
  // Clear existing quality highlights
  document
    .querySelectorAll(
      '.cell.quality-best, .cell.quality-brilliant, .cell.quality-excellent, .cell.quality-good, .cell.quality-inaccuracy, .cell.quality-mistake, .cell.quality-blunder'
    )
    .forEach(cell =>
      cell.classList.remove(
        'quality-best',
        'quality-brilliant',
        'quality-excellent',
        'quality-good',
        'quality-inaccuracy',
        'quality-mistake',
        'quality-blunder'
      )
    );

  if (!category || category === 'normal') return;

  const toCell = document.querySelector(`.cell[data-r="${move.to.r}"][data-c="${move.to.c}"]`);
  if (toCell) {
    toCell.classList.add(`quality-${category}`);

    // Show floating text
    const rect = toCell.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    const labels: Record<string, string> = {
      brilliant: 'Brilliant!!',
      best: 'Bester Zug ⭐',
      excellent: 'Exzellent ✨',
      good: 'Gut ✅',
      inaccuracy: 'Ungenau ?!',
      mistake: 'Fehler ?',
      blunder: 'Patzer ??',
    };

    if (labels[category]) {
      floatingTextManager.show(x, y, labels[category], category);
    }

    // Special effects for blunders
    if (category === 'blunder') {
      shakeScreen(8, 400);
    }
  }
}
