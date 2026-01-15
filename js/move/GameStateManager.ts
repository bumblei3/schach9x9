import { PHASES } from '../gameEngine.js';
import * as UI from '../ui.js';
import type { Game, PieceWithMoved, MoveHistoryEntry } from '../gameEngine.js';
import type { MoveController } from '../moveController.js';

/**
 * Undoes the last move
 * @param {Game} game - The game instance
 * @param {MoveController} moveController - The move controller instance
 */
export function undoMove(game: Game, moveController: MoveController): void {
  if (
    game.moveHistory.length === 0 ||
    ((game as any).phase !== (PHASES as any).PLAY &&
      (game as any).phase !== (PHASES as any).ANALYSIS &&
      (game as any).phase !== (PHASES as any).GAME_OVER)
  ) {
    return;
  }

  const move = game.moveHistory.pop()!;
  (moveController as any).redoStack.push(move);

  const piece = game.board[move.to.r][move.to.c] as PieceWithMoved;
  if (!piece) return;

  // Restore the piece to its original position
  game.board[move.from.r][move.from.c] = piece;
  game.board[move.to.r][move.to.c] = move.captured
    ? ({
        type: (move.captured as any).type,
        color: (move.captured as any).color,
        hasMoved: true,
      } as any)
    : null;

  // Restore piece properties (hasMoved and type)
  if ((move.piece as any).hasMoved !== undefined) {
    piece.hasMoved = (move.piece as any).hasMoved;
  }
  piece.type = (move.piece as any).type;

  if ((move as any).specialMove) {
    const sm = (move as any).specialMove;
    if (sm.type === 'castling') {
      // Undo rook movement
      const rook = game.board[sm.rookTo.r][sm.rookTo.c] as PieceWithMoved;
      if (rook) {
        game.board[sm.rookFrom.r][sm.rookFrom.c] = rook;
        game.board[sm.rookTo.r][sm.rookTo.c] = null;
        rook.hasMoved = sm.rookHadMoved;
        if (sm.rookType) {
          rook.type = sm.rookType;
        }
      }
    } else if (sm.type === 'enPassant') {
      game.board[sm.capturedPawnPos.r][sm.capturedPawnPos.c] = {
        type: 'p',
        color: sm.capturedPawn.color,
        hasMoved: true,
      } as any;
    }
  }

  // Handle captured pieces restoration
  if (move.captured) {
    const capturerColor = (move.piece as any).color;
    game.capturedPieces[capturerColor as 'white' | 'black'].pop();
    UI.updateCapturedUI(game);
  } else if ((move as any).specialMove && (move as any).specialMove.type === 'enPassant') {
    const capturerColor = (move.piece as any).color;
    game.capturedPieces[capturerColor as 'white' | 'black'].pop();
    UI.updateCapturedUI(game);
  }

  game.halfMoveClock = move.halfMoveClock || 0;
  while (game.positionHistory.length > (move as any).positionHistoryLength) {
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
  game.log(
    `Zug ${move.piece && (move.piece as any).color === 'white' ? 'Weiß' : 'Schwarz'} zurückgenommen`
  );

  // If we undid a move that caused game over, reset phase to PLAY
  if ((game.phase as any) === PHASES.GAME_OVER) {
    game.phase = PHASES.PLAY as any;
    // Hide game over overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // Update 3D board if active
  if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
    (window as any).battleChess3D.updateFromGameState(game);
  }

  if ((game as any).updateBestMoves) (game as any).updateBestMoves();

  // Trigger analysis update if in analysis mode
  if (game.analysisMode && game.continuousAnalysis && (game as any).gameController) {
    (game as any).gameController.requestPositionAnalysis();
  }

  moveController.updateUndoRedoButtons();

  // If playing against AI and we undid to AI's turn (Black), undo again to get back to Player's turn
  if (game.isAI && game.turn === 'black' && game.moveHistory.length > 0) {
    undoMove(game, moveController);
  }
}

/**
 * Enters replay mode
 * @param {Game} game - The game instance
 * @param {MoveController} moveController - The move controller instance
 */
export function enterReplayMode(game: Game, moveController: MoveController): void {
  if (game.replayMode || game.moveHistory.length === 0) return;

  (game as any).savedGameState = {
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    selectedSquare: game.selectedSquare,
    validMoves: game.validMoves,
    lastMoveHighlight: game.lastMoveHighlight,
  };

  game.replayMode = true;
  game.replayPosition = game.moveHistory.length - 1;
  if ((game as any).stopClock) (game as any).stopClock();

  const replayStatus = document.getElementById('replay-status');
  const replayExit = document.getElementById('replay-exit');
  if (replayStatus) replayStatus.classList.remove('hidden');
  if (replayExit) replayExit.classList.remove('hidden');

  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = true;

  moveController.updateReplayUI();
}

/**
 * Exits replay mode
 * @param {Game} game - The game instance
 */
export function exitReplayMode(game: Game): void {
  if (!game.replayMode) return;

  const saved = (game as any).savedGameState;
  game.board = saved.board;
  game.turn = saved.turn;
  game.selectedSquare = saved.selectedSquare;
  game.validMoves = saved.validMoves;
  game.lastMoveHighlight = saved.lastMoveHighlight;

  game.replayMode = false;
  game.replayPosition = -1;
  (game as any).savedGameState = null;

  const replayStatus = document.getElementById('replay-status');
  const replayExit = document.getElementById('replay-exit');
  if (replayStatus) replayStatus.classList.add('hidden');
  if (replayExit) replayExit.classList.add('hidden');

  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
  if (undoBtn)
    undoBtn.disabled = game.moveHistory.length === 0 || game.phase !== (PHASES as any).PLAY;

  UI.renderBoard(game);

  if (game.clockEnabled && game.phase === (PHASES as any).PLAY) {
    if ((game as any).startClock) (game as any).startClock();
  }
}

/**
 * Reconstructs the board state at a specific move index for replay
 * @param {Game} game - The game instance
 * @param {number} moveIndex - The index in moveHistory
 */
export function reconstructBoardAtMove(game: Game, moveIndex: number): void {
  if ((game as any).savedGameState) {
    game.board = JSON.parse(JSON.stringify((game as any).savedGameState.board));
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
 * @param {Game} game - The game instance
 * @param {MoveHistoryEntry} move - The move to undo
 */
export function undoMoveForReplay(game: Game, move: MoveHistoryEntry): void {
  const piece = game.board[move.to.r][move.to.c] as PieceWithMoved;
  if (!piece) return;

  game.board[move.from.r][move.from.c] = piece;
  game.board[move.to.r][move.to.c] = move.captured
    ? ({
        type: (move.captured as any).type,
        color: (move.captured as any).color,
        hasMoved: true,
      } as any)
    : null;

  if (move.piece && (move.piece as any).hasMoved !== undefined) {
    piece.hasMoved = (move.piece as any).hasMoved;
  }

  if ((move as any).specialMove) {
    const sm = (move as any).specialMove;
    if (sm.type === 'castling') {
      const rookFrom = sm.rookFrom;
      const rookTo = sm.rookTo;
      const rook = game.board[rookTo.r][rookTo.c] as PieceWithMoved;
      if (rook) {
        game.board[rookFrom.r][rookFrom.c] = rook;
        game.board[rookTo.r][rookTo.c] = null;
        rook.hasMoved = false;
      }
    } else if (sm.type === 'enPassant') {
      const capturedPos = sm.capturedPawnPos;
      game.board[capturedPos.r][capturedPos.c] = {
        type: 'p',
        color: sm.capturedPawn.color,
        hasMoved: true,
      } as any;
    } else if (sm.type === 'promotion') {
      piece.type = 'p';
    }
  }
}

/**
 * Saves the current game state to local storage
 * @param {Game} game - The game instance
 */
export function saveGame(game: Game): void {
  const gameState = {
    board: game.board,
    phase: game.phase,
    turn: game.turn,
    points: game.points,
    selectedShopPiece: game.selectedShopPiece,
    whiteCorridor: (game as any).whiteCorridor,
    blackCorridor: (game as any).blackCorridor,
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
 * @param {Game} game - The game instance
 * @returns {boolean} True if loaded successfully
 */
export function loadGame(game: Game): boolean {
  const savedData = localStorage.getItem('schach9x9_save_autosave');
  if (!savedData) {
    game.log('Kein gespeichertes Spiel gefunden.');
    return false;
  }

  try {
    const state = JSON.parse(savedData);

    game.board = state.board;
    (game as any).phase = state.phase;
    game.turn = state.turn;
    game.points = state.points;
    game.selectedShopPiece = state.selectedShopPiece;
    (game as any).whiteCorridor = state.whiteCorridor;
    (game as any).blackCorridor = state.blackCorridor;
    game.isAI = state.isAI;
    game.difficulty = state.difficulty;
    game.moveHistory = state.moveHistory;
    game.halfMoveClock = state.halfMoveClock;
    game.positionHistory = state.positionHistory;
    game.capturedPieces = state.capturedPieces || { white: [], black: [] };

    const aiToggle = document.getElementById('ai-toggle') as HTMLInputElement;
    if (aiToggle) aiToggle.checked = game.isAI;
    const diffSelects = document.querySelectorAll<HTMLSelectElement>('#difficulty-select');
    diffSelects.forEach(select => {
      select.value = game.difficulty;
    });

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

    if (
      game.phase === (PHASES.SETUP_WHITE_PIECES as any) ||
      game.phase === (PHASES.SETUP_BLACK_PIECES as any)
    ) {
      UI.showShop(game, true);
    } else {
      UI.showShop(game, false);
    }

    if (game.phase === (PHASES.PLAY as any)) {
      const historyPanel = document.getElementById('move-history-panel');
      const capturedPanel = document.getElementById('captured-pieces-panel');
      if (historyPanel) historyPanel.classList.remove('hidden');
      if (capturedPanel) capturedPanel.classList.remove('hidden');
      if ((game as any).updateBestMoves) (game as any).updateBestMoves();
    }

    game.log('Spiel geladen! \u{1F4C2}');
    return true;
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    game.log('Fehler beim Laden des Spielstands.');
    return false;
  }
}
