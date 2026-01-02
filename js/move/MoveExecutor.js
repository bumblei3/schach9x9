import { PHASES, BOARD_SIZE } from '../gameEngine.js';
import * as UI from '../ui.js';
import { soundManager } from '../sounds.js';
import { puzzleManager } from '../puzzleManager.js';
import { evaluatePosition } from '../aiEngine.js';
import * as MoveValidator from './MoveValidator.js';

/**
 * Executes a move on the board
 * @param {Object} game - The game instance
 * @param {Object} moveController - The move controller instance
 * @param {Object} from - Source square {r, c}
 * @param {Object} to - Destination square {r, c}
 * @param {boolean} isUndoRedo - Whether this move is from an undo/redo operation
 */
export async function executeMove(game, moveController, from, to, isUndoRedo = false) {
  // Clear redo stack if this is a new move
  if (!isUndoRedo) {
    moveController.redoStack = [];
    moveController.updateUndoRedoButtons();
  }

  // Clear tutor arrows when making a move
  if (game.arrowRenderer) {
    game.arrowRenderer.clearArrows();
  }

  const piece = game.board[from.r][from.c];
  if (!piece) return;

  const targetPiece = game.board[to.r][to.c];

  // Record move in history (snapshot current state)
  const moveRecord = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    piece: { type: piece.type, color: piece.color, hasMoved: piece.hasMoved },
    capturedPiece: targetPiece ? { type: targetPiece.type, color: targetPiece.color } : null,
    specialMove: null,
    halfMoveClock: game.halfMoveClock,
    positionHistoryLength: game.positionHistory.length,
  };

  // Handle Castling
  if (piece.type === 'k' && Math.abs(to.c - from.c) === 2) {
    const isKingside = to.c > from.c;
    const rookCol = isKingside ? BOARD_SIZE - 1 : 0;
    const rookTargetCol = isKingside ? to.c - 1 : to.c + 1;
    const rook = game.board[from.r][rookCol];

    moveRecord.specialMove = {
      type: 'castling',
      isKingside,
      rookFrom: { r: from.r, c: rookCol },
      rookTo: { r: from.r, c: rookTargetCol },
      rookHadMoved: rook.hasMoved,
      rookType: rook.type,
    };

    // Move Rook
    game.board[from.r][rookTargetCol] = rook;
    game.board[from.r][rookCol] = null;
    rook.hasMoved = true;
    game.log(`${piece.color === 'white' ? 'Weiß' : 'Schwarz'} rochiert!`);
  }

  // Handle En Passant
  if (piece.type === 'p' && to.c !== from.c && !targetPiece) {
    const capturedPawnRow = from.r;
    const capturedPawn = game.board[capturedPawnRow][to.c];

    moveRecord.specialMove = {
      type: 'enPassant',
      capturedPawnPos: { r: capturedPawnRow, c: to.c },
      capturedPawn: { type: capturedPawn.type, color: capturedPawn.color },
    };

    game.board[capturedPawnRow][to.c] = null;
    game.log('En Passant geschlagen!');
  }

  // Update 50-move rule clock
  if (piece.type === 'p' || targetPiece) {
    game.halfMoveClock = 0;
  } else {
    game.halfMoveClock++;
  }

  // Animate move BEFORE updating board state
  if (game.phase === PHASES.PLAY) {
    await UI.animateMove(game, from, to, piece);
  }

  // Move the piece
  game.board[to.r][to.c] = piece;
  game.board[from.r][from.c] = null;
  piece.hasMoved = true;

  UI.renderBoard(game);

  // Sound effects
  if (targetPiece || (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant')) {
    soundManager.playCapture();
    game.stats.captures++;
  } else {
    soundManager.playMove();
  }

  // Update captured pieces
  if (targetPiece) {
    const capturerColor = piece.color;
    game.capturedPieces[capturerColor].push(targetPiece);
    UI.updateCapturedUI(game);
  } else if (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant') {
    const capturerColor = piece.color;
    game.capturedPieces[capturerColor].push(moveRecord.specialMove.capturedPawn);
    UI.updateCapturedUI(game);
  }

  // Update last move highlight
  game.lastMoveHighlight = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
  };

  // Track last move for En Passant
  game.lastMove = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    piece: piece,
    isDoublePawnPush: piece.type === 'p' && Math.abs(to.r - from.r) === 2,
  };

  // Promotion check
  if (piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 0 : BOARD_SIZE - 1;
    if (to.r === promotionRow) {
      piece.type = 'e';
      moveRecord.specialMove = { type: 'promotion', promotedTo: 'e' };
      game.log(`${piece.color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zum Engel befördert!`);
      soundManager.playMove();
    }
  }

  // Calculate evaluation score
  const evalScore = evaluatePosition(game.board, 'white');
  moveRecord.evalScore = evalScore;

  // Add move to history
  game.moveHistory.push(moveRecord);
  UI.updateMoveHistoryUI(game);

  // Blunder Detection
  if (game.tutorController && game.tutorController.checkBlunder) {
    game.tutorController.checkBlunder(moveRecord);
  }

  // Puzzle Logic Check
  if (game.mode === 'puzzle') {
    const result = puzzleManager.checkMove(game, moveRecord);
    if (result === 'wrong') {
      setTimeout(() => {
        moveController.undoMove();
        UI.updatePuzzleStatus('error', 'Falscher Zug!');
        soundManager.playError();
      }, 500);
    } else if (result === 'solved') {
      UI.updatePuzzleStatus('success', 'Richtig! Puzzle gelöst!');
      soundManager.playSuccess();
    } else {
      UI.updatePuzzleStatus('neutral', 'Richtig... weiter!');
    }
  }

  // Check for insufficient material
  if (MoveValidator.isInsufficientMaterial(game)) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('Unentschieden (Ungenügendes Material)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
    if (overlay) overlay.classList.remove('hidden');

    if (game.gameController) {
      game.gameController.saveGameToStatistics('draw', null);
    }
    return;
  }

  finishMove(game, moveController);
}

/**
 * Finalizes the move, switches turns, and checks for game over
 * @param {Object} game - The game instance
 * @param {Object} moveController - The move controller instance
 */
export function finishMove(game, moveController) {
  game.selectedSquare = null;
  game.validMoves = null;

  game.stats.totalMoves++;
  if (game.turn === 'white') game.stats.playerMoves++;

  // Check if a king was captured
  let whiteKingExists = false;
  let blackKingExists = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = game.board[r][c];
      if (piece && piece.type === 'k') {
        if (piece.color === 'white') whiteKingExists = true;
        if (piece.color === 'black') blackKingExists = true;
      }
    }
  }

  if (!whiteKingExists || !blackKingExists) {
    game.phase = PHASES.GAME_OVER;
    const winner = !whiteKingExists ? 'Schwarz' : 'Weiß';
    game.log(`KÖNIG GESCHLAGEN! ${winner} gewinnt!`);

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = `${winner} gewinnt!\n(König geschlagen)`;
    if (overlay) overlay.classList.remove('hidden');

    const isPlayerWin = (game.isAI && game.turn === 'black') || !game.isAI;
    soundManager.playGameOver(isPlayerWin);

    UI.renderBoard(game);
    UI.updateStatus(game);

    if (game.gameController) {
      const losingColor = !whiteKingExists ? 'white' : 'black';
      game.gameController.saveGameToStatistics('win', losingColor);
    }
    return;
  }

  // Switch turns
  game.turn = game.turn === 'white' ? 'black' : 'white';

  UI.updateStatistics(game);

  if (game.clockEnabled) {
    const previousPlayer = game.turn === 'white' ? 'black' : 'white';
    if (previousPlayer === 'white') {
      game.whiteTime += game.timeControl.increment;
    } else {
      game.blackTime += game.timeControl.increment;
    }
    UI.updateClockDisplay(game);
    UI.updateClockUI(game);
  }

  // Add position to repetition history
  const currentHash = MoveValidator.getBoardHash(game);
  game.positionHistory.push(currentHash);

  // Update 3D board if active
  if (window.battleChess3D && window.battleChess3D.enabled && game.moveHistory.length > 0) {
    const lastMove = game.moveHistory[game.moveHistory.length - 1];
    const piece = lastMove.piece;
    const from = lastMove.from;
    const to = lastMove.to;
    const targetPiece = lastMove.capturedPiece;

    const captured =
      targetPiece || (lastMove.specialMove && lastMove.specialMove.type === 'enPassant');
    if (captured) {
      const attackerData = { type: piece.type, color: piece.color };
      const defenderData = targetPiece || lastMove.specialMove.capturedPawn;
      window.battleChess3D.playBattleSequence(attackerData, defenderData, from, to).then(() => {
        window.battleChess3D.removePiece(to.r, to.c);
        window.battleChess3D.animateMove(from.r, from.c, to.r, to.c);
      });
    } else {
      window.battleChess3D.animateMove(from.r, from.c, to.r, to.c);
    }
  }

  const opponentColor = game.turn;
  if (game.isCheckmate(opponentColor)) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    const winner = opponentColor === 'white' ? 'Schwarz' : 'Weiß';
    game.log(`SCHACHMATT! ${winner} gewinnt!`);

    UI.animateCheckmate(game, opponentColor);

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = `${winner} gewinnt!`;
    if (overlay) overlay.classList.remove('hidden');

    const isPlayerWin = (game.isAI && opponentColor === 'black') || !game.isAI;
    soundManager.playGameOver(isPlayerWin);

    if (game.gameController) {
      game.gameController.saveGameToStatistics('win', opponentColor);
    }
    return;
  } else if (game.isStalemate(opponentColor)) {
    game.phase = PHASES.GAME_OVER;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('PATT! Unentschieden.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Patt)';
    if (overlay) overlay.classList.remove('hidden');

    if (game.gameController) {
      game.gameController.saveGameToStatistics('draw', null);
    }
    return;
  } else if (MoveValidator.checkDraw(game, moveController)) {
    return;
  } else if (game.isInCheck(opponentColor)) {
    game.log(`SCHACH! ${opponentColor === 'white' ? 'Weiß' : 'Schwarz'} steht im Schach.`);
    soundManager.playCheck();
    UI.animateCheck(game, opponentColor);
  }

  UI.updateStatus(game);
  UI.renderEvalGraph(game);
  game.log(`${game.turn === 'white' ? 'Weiß' : 'Schwarz'} ist am Zug.`);

  if (game.isAI && game.turn === 'black' && game.phase === PHASES.PLAY) {
    setTimeout(() => {
      if (game.aiMove) game.aiMove();
    }, 1000);
  } else {
    setTimeout(() => {
      if (game.updateBestMoves) game.updateBestMoves();
    }, 10);
  }
}
