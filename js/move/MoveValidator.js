import { PHASES, BOARD_SIZE, PIECE_VALUES } from '../gameEngine.js';
import * as UI from '../ui.js';

/**
 * Checks if the game is a draw based on various rules
 * @param {Object} game - The game instance
 * @param {Object} moveController - The move controller instance (for hash access if needed)
 * @returns {boolean} True if the game is a draw
 */
export function checkDraw(game) {
  if (game.halfMoveClock >= 100) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('Unentschieden (50-Züge-Regel)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (50-Züge-Regel)';
    if (overlay) overlay.classList.remove('hidden');

    // Save to statistics
    if (game.gameController) {
      game.gameController.saveGameToStatistics('draw', null);
    }
    return true;
  }

  const currentHash = getBoardHash(game);
  const occurrences = game.positionHistory.filter(h => h === currentHash).length;
  if (occurrences >= 3) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('Unentschieden (Stellungswiederholung)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Stellungswiederholung)';
    if (overlay) overlay.classList.remove('hidden');

    // Save to statistics
    if (game.gameController) {
      game.gameController.saveGameToStatistics('draw', null);
    }
    return true;
  }

  if (isInsufficientMaterial(game)) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('Unentschieden (Ungenügendes Material)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
    if (overlay) overlay.classList.remove('hidden');

    // Save to statistics
    if (game.gameController) {
      game.gameController.saveGameToStatistics('draw', null);
    }
    return true;
  }

  return false;
}

/**
 * Checks if there is insufficient material to continue the game
 * @param {Object} game - The game instance
 * @returns {boolean} True if material is insufficient
 */
export function isInsufficientMaterial(game) {
  const pieces = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c]) {
        pieces.push(game.board[r][c]);
      }
    }
  }

  const whitePieces = pieces.filter(p => p.color === 'white');
  const blackPieces = pieces.filter(p => p.color === 'black');
  const whiteNonKings = whitePieces.filter(p => p.type !== 'k');
  const blackNonKings = blackPieces.filter(p => p.type !== 'k');

  if (pieces.length === 2) return true;

  if (pieces.length === 3) {
    const nonKings = pieces.filter(p => p.type !== 'k');
    if (nonKings.length === 1 && (nonKings[0].type === 'n' || nonKings[0].type === 'b')) {
      return true;
    }
  }

  if (pieces.length === 4) {
    if (whiteNonKings.length === 2 && blackNonKings.length === 0) {
      if (whiteNonKings.every(p => p.type === 'n')) return true;
    }
    if (blackNonKings.length === 2 && whiteNonKings.length === 0) {
      if (blackNonKings.every(p => p.type === 'n')) return true;
    }
  }

  if (
    pieces.length === 4 &&
    whiteNonKings.length === 1 &&
    blackNonKings.length === 1 &&
    whiteNonKings[0].type === 'b' &&
    blackNonKings[0].type === 'b'
  ) {
    let whiteBishopSquare = null;
    let blackBishopSquare = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = game.board[r][c];
        if (piece && piece.type === 'b') {
          if (piece.color === 'white') whiteBishopSquare = { r, c };
          else blackBishopSquare = { r, c };
        }
      }
    }

    if (whiteBishopSquare && blackBishopSquare) {
      const whiteSquareColor = (whiteBishopSquare.r + whiteBishopSquare.c) % 2;
      const blackSquareColor = (blackBishopSquare.r + blackBishopSquare.c) % 2;
      if (whiteSquareColor === blackSquareColor) return true;
    }
  }

  const allNonKings = pieces.filter(p => p.type !== 'k');
  if (allNonKings.length > 0 && allNonKings.every(p => p.type === 'b')) {
    const bishopSquareColors = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = game.board[r][c];
        if (piece && piece.type === 'b') {
          bishopSquareColors.add((r + c) % 2);
        }
      }
    }
    if (bishopSquareColors.size === 1) return true;
  }

  return false;
}

/**
 * Generates a hash representing the current board state
 * @param {Object} game - The game instance
 * @returns {string} The board hash
 */
export function getBoardHash(game) {
  let hash = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (piece) {
        hash += `${piece.color[0]}${piece.type}${r}${c};`;
      }
    }
  }
  return hash;
}

/**
 * Calculates the material advantage (White - Black)
 * @param {Object} game - The game instance
 * @returns {number} The material advantage in centipawns or piece points
 */
export function calculateMaterialAdvantage(game) {
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (piece) {
        const value = PIECE_VALUES[piece.type] || 0;
        if (piece.color === 'white') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }

  return whiteMaterial - blackMaterial;
}
