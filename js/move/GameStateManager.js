import { PHASES } from '../gameEngine.js';
import * as UI from '../ui.js';

/**
 * Undoes the last move
 * @param {Object} game - The game instance
 * @param {Object} moveController - The move controller instance
 */
export function undoMove(game, moveController) {
  if (
    game.moveHistory.length === 0 ||
    (game.phase !== PHASES.PLAY && game.phase !== PHASES.ANALYSIS && game.phase !== PHASES.GAME_OVER)
  ) {
    return;
  }

  const move = game.moveHistory.pop();
  moveController.redoStack.push(move);

  const piece = game.board[move.to.r][move.to.c];
  if (!piece) return;

  // Restore the piece to its original position
  game.board[move.from.r][move.from.c] = piece;
  game.board[move.to.r][move.to.c] = move.capturedPiece
    ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
    : null;

  // Restore piece properties (hasMoved and type)
  piece.hasMoved = move.piece.hasMoved;
  piece.type = move.piece.type;

  if (move.specialMove) {
    if (move.specialMove.type === 'castling') {
      // Undo rook movement
      const rook = game.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c];
      if (rook) {
        game.board[move.specialMove.rookFrom.r][move.specialMove.rookFrom.c] = rook;
        game.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c] = null;
        rook.hasMoved = move.specialMove.rookHadMoved;
        if (move.specialMove.rookType) {
          rook.type = move.specialMove.rookType;
        }
      }
    } else if (move.specialMove.type === 'enPassant') {
      game.board[move.specialMove.capturedPawnPos.r][move.specialMove.capturedPawnPos.c] = {
        type: 'p',
        color: move.specialMove.capturedPawn.color,
        hasMoved: true,
      };
    }
  }

  // Handle captured pieces restoration
  if (move.capturedPiece) {
    const capturerColor = move.piece.color;
    game.capturedPieces[capturerColor].pop();
    UI.updateCapturedUI(game);
  } else if (move.specialMove && move.specialMove.type === 'enPassant') {
    const capturerColor = move.piece.color;
    game.capturedPieces[capturerColor].pop();
    UI.updateCapturedUI(game);
  }

  game.halfMoveClock = move.halfMoveClock;
  while (game.positionHistory.length > move.positionHistoryLength) {
    game.positionHistory.pop();
  }

  game.turn = game.turn === 'white' ? 'black' : 'white';
  game.stats.totalMoves--;
  UI.updateStatus(game);
  UI.updateMoveHistoryUI(game);
  UI.updateStatistics(game);

  if (game.moveHistory.length > 0) {
    const lastMove = game.moveHistory[game.moveHistory.length - 1];
    game.lastMoveHighlight = { from: lastMove.from, to: lastMove.to };
  } else {
    game.lastMoveHighlight = null;
  }

  game.selectedSquare = null;
  game.validMoves = null;

  UI.renderBoard(game);
  UI.updateMoveHistoryUI(game);
  UI.updateStatus(game);
  game.log(`Zug ${move.piece.color === 'white' ? 'Weiß' : 'Schwarz'} zurückgenommen`);

  // If we undid a move that caused game over, reset phase to PLAY
  if (game.phase === PHASES.GAME_OVER) {
    game.phase = PHASES.PLAY;
    // Hide game over overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // Update 3D board if active
  if (window.battleChess3D && window.battleChess3D.enabled) {
    window.battleChess3D.updateFromGameState(game);
  }

  if (game.updateBestMoves) game.updateBestMoves();

  // Trigger analysis update if in analysis mode
  if (game.analysisMode && game.continuousAnalysis && game.gameController) {
    game.gameController.requestPositionAnalysis();
  }

  moveController.updateUndoRedoButtons();

  // If playing against AI and we undid to AI's turn (Black), undo again to get back to Player's turn
  // Prevent infinite recursion if history is empty
  if (game.isAI && game.turn === 'black' && game.moveHistory.length > 0) {
    // Use setTimeout to allow UI to update (optional, but good for visual feedback)
    // Or just call it directly for immediate feel.
    // Direct call is safer for consistency.
    undoMove(game, moveController);
  }
}

/**
 * Enters replay mode
 * @param {Object} game - The game instance
 * @param {Object} moveController - The move controller instance
 */
export function enterReplayMode(game, moveController) {
  if (game.replayMode || game.moveHistory.length === 0) return;

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

  const replayStatus = document.getElementById('replay-status');
  const replayExit = document.getElementById('replay-exit');
  if (replayStatus) replayStatus.classList.remove('hidden');
  if (replayExit) replayExit.classList.remove('hidden');

  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = true;

  moveController.updateReplayUI();
}

/**
 * Exits replay mode
 * @param {Object} game - The game instance
 */
export function exitReplayMode(game) {
  if (!game.replayMode) return;

  game.board = game.savedGameState.board;
  game.turn = game.savedGameState.turn;
  game.selectedSquare = game.savedGameState.selectedSquare;
  game.validMoves = game.savedGameState.validMoves;
  game.lastMoveHighlight = game.savedGameState.lastMoveHighlight;

  game.replayMode = false;
  game.replayPosition = -1;
  game.savedGameState = null;

  const replayStatus = document.getElementById('replay-status');
  const replayExit = document.getElementById('replay-exit');
  if (replayStatus) replayStatus.classList.add('hidden');
  if (replayExit) replayExit.classList.add('hidden');

  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== PHASES.PLAY;

  UI.renderBoard(game);

  if (game.clockEnabled && game.phase === PHASES.PLAY) {
    if (game.startClock) game.startClock();
  }
}

/**
 * Reconstructs the board state at a specific move index for replay
 * @param {Object} game - The game instance
 * @param {number} moveIndex - The index in moveHistory
 */
export function reconstructBoardAtMove(game, moveIndex) {
  if (game.savedGameState) {
    game.board = JSON.parse(JSON.stringify(game.savedGameState.board));
    for (let i = game.moveHistory.length - 1; i > moveIndex; i--) {
      const move = game.moveHistory[i];
      undoMoveForReplay(game, move);
    }
  }

  if (moveIndex >= 0) {
    const move = game.moveHistory[moveIndex];
    game.lastMoveHighlight = {
      from: move.from,
      to: move.to,
    };
  } else {
    game.lastMoveHighlight = null;
  }
}

/**
 * Specific undo for replay mode (doesn't affect history or UI as much)
 * @param {Object} game - The game instance
 * @param {Object} move - The move to undo
 */
export function undoMoveForReplay(game, move) {
  const piece = game.board[move.to.r][move.to.c];
  if (!piece) return;

  game.board[move.from.r][move.from.c] = piece;
  game.board[move.to.r][move.to.c] = move.capturedPiece
    ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
    : null;

  piece.hasMoved = move.piece.hasMoved;

  if (move.specialMove) {
    if (move.specialMove.type === 'castling') {
      const rookFrom = move.specialMove.rookFrom;
      const rookTo = move.specialMove.rookTo;
      const rook = game.board[rookTo.r][rookTo.c];
      if (rook) {
        game.board[rookFrom.r][rookFrom.c] = rook;
        game.board[rookTo.r][rookTo.c] = null;
        rook.hasMoved = false;
      }
    } else if (move.specialMove.type === 'enPassant') {
      const capturedPos = move.specialMove.capturedPawnPos;
      game.board[capturedPos.r][capturedPos.c] = {
        type: 'p',
        color: move.specialMove.capturedPawn.color,
        hasMoved: true,
      };
    } else if (move.specialMove.type === 'promotion') {
      piece.type = 'p';
    }
  }
}

/**
 * Saves the current game state to local storage
 * @param {Object} game - The game instance
 */
export function saveGame(game) {
  const gameState = {
    board: game.board,
    phase: game.phase,
    turn: game.turn,
    points: game.points,
    selectedShopPiece: game.selectedShopPiece,
    whiteCorridor: game.whiteCorridor,
    blackCorridor: game.blackCorridor,
    isAI: game.isAI,
    difficulty: game.difficulty,
    moveHistory: game.moveHistory,
    halfMoveClock: game.halfMoveClock,
    positionHistory: game.positionHistory,
    capturedPieces: game.capturedPieces,
    drawOffered: game.drawOffered,
    drawOfferedBy: game.drawOfferedBy,
  };
  localStorage.setItem('schach9x9_save_autosave', JSON.stringify(gameState));
  game.log('Spiel gespeichert! \u{1F4BE}');
}

/**
 * Loads a saved game state from local storage
 * @param {Object} game - The game instance
 * @returns {boolean} True if loaded successfully
 */
export function loadGame(game) {
  const savedData = localStorage.getItem('schach9x9_save_autosave');
  if (!savedData) {
    game.log('Kein gespeichertes Spiel gefunden.');
    return false;
  }

  try {
    const state = JSON.parse(savedData);

    game.board = state.board;
    game.phase = state.phase;
    game.turn = state.turn;
    game.points = state.points;
    game.selectedShopPiece = state.selectedShopPiece;
    game.whiteCorridor = state.whiteCorridor;
    game.blackCorridor = state.blackCorridor;
    game.isAI = state.isAI;
    game.difficulty = state.difficulty;
    game.moveHistory = state.moveHistory;
    game.halfMoveClock = state.halfMoveClock;
    game.positionHistory = state.positionHistory;
    game.capturedPieces = state.capturedPieces || { white: [], black: [] };

    const aiToggle = document.getElementById('ai-toggle');
    if (aiToggle) aiToggle.checked = game.isAI;
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) diffSelect.value = game.difficulty;

    UI.renderBoard(game);
    UI.updateStatus(game);
    UI.updateShopUI(game);
    UI.updateMoveHistoryUI(game);
    UI.updateCapturedUI(game);

    game.drawOffered = state.drawOffered || false;
    game.drawOfferedBy = state.drawOfferedBy || null;
    const drawOverlay = document.getElementById('draw-offer-overlay');
    if (drawOverlay) {
      if (game.drawOffered) {
        const message = document.getElementById('draw-offer-message');
        const offeringColor = game.drawOfferedBy === 'white' ? 'Wei\u00DF' : 'Schwarz';
        if (message)
          message.textContent = `${offeringColor} bietet Remis an. M\u00F6chtest du annehmen?`;
        drawOverlay.classList.remove('hidden');
      } else {
        drawOverlay.classList.add('hidden');
      }
    }

    if (game.phase === PHASES.SETUP_WHITE_PIECES || game.phase === PHASES.SETUP_BLACK_PIECES) {
      UI.showShop(game, true);
    } else {
      UI.showShop(game, false);
    }

    if (game.phase === PHASES.PLAY) {
      const historyPanel = document.getElementById('move-history-panel');
      const capturedPanel = document.getElementById('captured-pieces-panel');
      if (historyPanel) historyPanel.classList.remove('hidden');
      if (capturedPanel) capturedPanel.classList.remove('hidden');
      if (game.updateBestMoves) game.updateBestMoves();
    }

    game.log('Spiel geladen! \u{1F4C2}');
    return true;
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    game.log('Fehler beim Laden des Spielstands.');
    return false;
  }
}
