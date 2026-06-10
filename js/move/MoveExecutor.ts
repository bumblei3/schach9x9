import { PHASES, type Game } from '../gameEngine.js';
import type { Phase } from '../config.js';
import * as UI from '../ui.js';
import { soundManager } from '../sounds.js';
import { puzzleManager } from '../puzzleManager.js';
import { evaluatePosition } from '../aiEngine.js';
import * as MoveValidator from './MoveValidator.js';
import { confettiSystem } from '../effects.js';
import type { Square, PieceWithMoved, MoveHistoryEntry, Player, Piece } from '../gameEngine.js';
import type { MoveController } from '../moveController.js';
import { notificationUI } from '../ui/NotificationUI.js';
import { campaignManager } from '../campaign/CampaignManager.js';

/**
 * Executes a move on the board
 * @param {Game} game - The game instance
 * @param {MoveController} moveController - The move controller instance
 * @param {Square} from - Source square {r, c}
 * @param {Square} to - Destination square {r, c}
 * @param {boolean} isUndoRedo - Whether this move is from an undo/redo operation
 */
export async function executeMove(
  game: Game,
  moveController: MoveController,
  from: Square,
  to: Square,
  isUndoRedo: boolean = false,
  promotionType?: string
): Promise<void> {
  // Clear redo stack if this is a new move
  if (!isUndoRedo) {
    moveController.redoStack = [];
    moveController.updateUndoRedoButtons();
  }

  // Clear tutor arrows and stale hints when making a move
  if (game.arrowRenderer) {
    game.arrowRenderer.clearArrows();
  }
  game.bestMoves = [];

  const piece = game.board[from.r][from.c] as PieceWithMoved;
  if (!piece) return;

  const targetPiece = game.board[to.r][to.c];

  // Record move in history (snapshot current state)
  const moveRecord: MoveHistoryEntry = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    piece: { type: piece.type, color: piece.color, hasMoved: piece.hasMoved },
    captured: targetPiece ? { type: targetPiece.type, color: targetPiece.color } : null,
    halfMoveClock: game.halfMoveClock,
  };

  // Handle Castling
  if (piece.type === 'k' && Math.abs(to.c - from.c) === 2) {
    const isKingside = to.c > from.c;
    const rookCol = isKingside ? game.boardSize - 1 : 0;
    const rookTargetCol = isKingside ? to.c - 1 : to.c + 1;
    const rook = game.board[from.r][rookCol] as PieceWithMoved;

    moveRecord.specialMove = {
      type: 'castling',
      isKingside,
      rookFrom: { r: from.r, c: rookCol },
      rookTo: { r: from.r, c: rookTargetCol },
      rookHadMoved: rook.hasMoved,
      rookType: rook.type,
    };

    moveRecord.isCastling = true;

    // Move Rook
    game.board[from.r][rookTargetCol] = rook;
    game.board[from.r][rookCol] = null;
    rook.hasMoved = true;
    game.log(`${piece.color === 'white' ? 'Weiß' : 'Schwarz'} rochiert!`);
  }

  // Handle En Passant
  if (piece.type === 'p' && to.c !== from.c && !targetPiece) {
    const capturedPawnRow = from.r;
    const capturedPawn = game.board[capturedPawnRow][to.c] as PieceWithMoved;

    moveRecord.specialMove = {
      type: 'enPassant',
      capturedPawnPos: { r: capturedPawnRow, c: to.c },
      capturedPawn: { type: capturedPawn.type, color: capturedPawn.color },
    } as typeof moveRecord.specialMove;

    moveRecord.isEnPassant = true;

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
  if (targetPiece || moveRecord.isEnPassant) {
    soundManager.playCapture(to.c);
    game.stats.captures++;
  } else {
    soundManager.playMove(from.c, to.c);
  }

  // Update captured pieces
  if (targetPiece) {
    const capturerColor = piece.color;
    game.capturedPieces[capturerColor].push(targetPiece);
    UI.updateCapturedUI(game);

    // Talent: Scavenger (Pawn)
    // Erhalte 1-2 Gold beim Schlagen von Figuren.
    if (game.campaignMode && piece.color === game.playerColor && piece.type === 'p') {
      if (campaignManager.isTalentUnlocked('p_scavenger')) {
        const bonus = Math.floor(Math.random() * 2) + 1; // 1-2 Gold
        campaignManager.addGold(bonus);
        notificationUI.show(`Plünderer: +${bonus} Gold gefunden!`, 'success', 'Talent');
      }
    }
  } else if (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant') {
    const capturerColor = piece.color;
    game.capturedPieces[capturerColor].push(moveRecord.specialMove!.capturedPawn as Piece);
    UI.updateCapturedUI(game);
  }

  // Award XP in Campaign Mode
  if (
    game.campaignMode &&
    piece.color === game.playerColor &&
    (targetPiece || moveRecord.isEnPassant)
  ) {
    let xpAmount = 10;

    // Talent: Veteran (Pawn) - +20% XP
    if (piece.type === 'p' && campaignManager.isTalentUnlocked('p_veteran')) {
      xpAmount += 2;
    }

    const oldLevel = campaignManager.getUnitXp(piece.type).level;
    campaignManager.addUnitXp(piece.type, xpAmount);
    const newLevel = campaignManager.getUnitXp(piece.type).level;

    notificationUI.show(
      `+${xpAmount} XP für deinen ${piece.type === 'p' ? 'Bauern' : piece.type === 'n' ? 'Springer' : 'Krieger'}`,
      'success',
      'Erfahrung'
    );
    if (newLevel > oldLevel) {
      notificationUI.show(
        `LEVEL UP! Dein ${piece.type} ist jetzt Stufe ${newLevel}!`,
        'success',
        'Aufstieg',
        5000
      );
    }
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
    const promotionRow = piece.color === 'white' ? 0 : game.boardSize - 1;
    if (to.r === promotionRow) {
      if (promotionType) {
        // Use provided promotion type (AI, Undo/Redo, or after selection)
        piece.type = promotionType as Piece['type'];
        game.stats.promotions++;
        moveRecord.specialMove = { type: 'promotion', promotedTo: promotionType };
        moveRecord.promotion = promotionType;
        game.log(
          `${piece.color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zum ${promotionType} befördert!`
        );
        soundManager.playMove(from.c, to.c);
      } else {
        const isHuman = (game.isAI && piece.color === 'white') || !game.isAI;

        if (isHuman) {
          console.log('[MoveExecutor] Triggering Promotion UI');
          // Pause and show promotion UI
          UI.showPromotionUI(game, to.r, to.c, piece.color, moveRecord, () => {
            // Update moveRecord validation
            const actualType = game.board[to.r][to.c]?.type || 'q'; // Fallback
            if (actualType !== 'p') {
              moveRecord.specialMove = { type: 'promotion', promotedTo: actualType };
              moveRecord.promotion = actualType;
              game.stats.promotions++;
              game.log(
                `${piece.color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zum ${actualType} befördert!`
              );
              // Award XP for promotion in Campaign
              if (game.campaignMode && piece.color === game.playerColor) {
                campaignManager.addUnitXp('p', 50);
                notificationUI.show(
                  'Beförderungs-Bonus: +50 XP für die Infanterie!',
                  'success',
                  'Held'
                );
              }
            }
            completeMoveExecution(game, moveController, moveRecord);
          });
          return;
        } else {
          // Default for AI if no type was passed (should not happen with updated AI)
          piece.type = 'e';
          game.stats.promotions++;
          moveRecord.specialMove = { type: 'promotion', promotedTo: 'e' };
          moveRecord.promotion = 'e';
          game.log(
            `${piece.color === 'white' ? 'Weißer' : 'Schwarzer'} Bauer zum Engel befördert!`
          );
          soundManager.playMove(from.c, to.c);
        }
      }
    }
  }

  await completeMoveExecution(game, moveController, moveRecord);
}

/**
 * Completes the move execution (evaluation, history, status, turn switch)
 */
export async function completeMoveExecution(
  game: Game,
  moveController: MoveController,
  moveRecord: MoveHistoryEntry
): Promise<void> {
  // Calculate evaluation score
  const evalScore = await evaluatePosition(game.board, 'white');
  moveRecord.evalScore = evalScore;

  // Update evaluation bar if available
  if (game.evaluationBar) {
    game.evaluationBar.update(evalScore);
  }

  // Add move to history
  game.moveHistory.push(moveRecord);
  UI.updateMoveHistoryUI(game);
  UI.updateStatus(game);

  // Blunder Detection
  if (game.tutorController?.checkBlunder) {
    // Fire and forget or await? Safer to await to ensure sequence
    await game.tutorController.checkBlunder(moveRecord);
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

      // Auto-play opponent move if available
      const nextIndex = game.puzzleState ? game.puzzleState.currentMoveIndex : 0;
      const puzzle = puzzleManager.getPuzzle(game.puzzleState ? game.puzzleState.id : '');

      if (puzzle && nextIndex < puzzle.solution.length) {
        const nextMove = puzzle.solution[nextIndex];
        setTimeout(() => {
          // Ensure we are in a state to move
          if (game.phase === PHASES.PLAY) {
            moveController.executeMove(nextMove.from, nextMove.to);
          }
        }, 600);
      }
    }
  }

  // Check for insufficient material
  if (MoveValidator.isInsufficientMaterial(game)) {
    game.phase = PHASES.GAME_OVER as Phase;
    UI.renderBoard(game);
    UI.updateStatus(game);

    game.log('Unentschieden durch unzureichendes Material.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Material)';
    if (overlay) overlay.classList.remove('hidden');

    if (game.gameController) {
      game.gameController.handleGameEnd('draw', null);
    }
    return;
  }

  finishMove(game, moveRecord.to);
}

/**
 * Finalizes the move, switches turns, and checks for game over
 * @param {Square} to - Optional destination square of the last move
 */
export function finishMove(game: Game, lastTo?: Square): void {
  game.selectedSquare = null;
  game.validMoves = null;

  game.stats.totalMoves++;
  if (game.turn === 'white') game.stats.playerMoves++;

  // Check if a king was captured – optimized: in chess, a king can only be
  // captured by moving to its square, so we only need to check the destination.
  // However, since executeMove already placed the moving piece at lastTo, we
  // scan the board. For 9x9 this is only 81 cells – trivial cost.
  let whiteKingExists = false;
  let blackKingExists = false;
  for (let r = 0; r < game.boardSize; r++) {
    for (let c = 0; c < game.boardSize; c++) {
      const piece = game.board[r][c];
      if (piece && piece.type === 'k') {
        if (piece.color === 'white') whiteKingExists = true;
        if (piece.color === 'black') blackKingExists = true;
      }
    }
  }

  if (!whiteKingExists || !blackKingExists) {
    game.phase = PHASES.GAME_OVER as Phase;
    const winner = !whiteKingExists ? 'Schwarz' : 'Weiß';
    game.log(`KÖNIG GESCHLAGEN! ${winner} gewinnt!`);

    // Triple Flash Effect on capture (+ screen shake already in animateMove)
    if (UI.flashSquare && lastTo) {
      UI.flashSquare(lastTo.r, lastTo.c, 'mate');
    }

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = `${winner} gewinnt!\n(König geschlagen)`;
    if (overlay) overlay.classList.remove('hidden');

    const isPlayerWin = (game.isAI && game.turn === 'black') || !game.isAI;
    soundManager.playGameOver(isPlayerWin);
    if (isPlayerWin) confettiSystem.spawn();

    UI.renderBoard(game);
    UI.updateStatus(game);

    if (game.gameController) {
      const winnerColor: Player = !whiteKingExists ? 'black' : 'white';
      game.gameController.handleGameEnd('win', winnerColor);
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
    const piece = lastMove.piece!;
    const from = lastMove.from;
    const to = lastMove.to;
    const targetPiece = lastMove.captured;

    const captured =
      targetPiece || (lastMove.specialMove && lastMove.specialMove.type === 'enPassant');
    if (captured) {
      const attackerData = {
        type: piece.type,
        color: piece.color,
        hasMoved: piece.hasMoved,
      } as Piece;
      // defenderData may be a partial Piece (e.g. capturedPawn only has color)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defenderData = (targetPiece || lastMove.specialMove?.capturedPawn || null) as any;
      window.battleChess3D.playBattleSequence(attackerData, defenderData, from, to).then(() => {
        window.battleChess3D!.removePiece(to.r, to.c);
        window.battleChess3D!.animateMove(from.r, from.c, to.r, to.c);
      });
    } else {
      window.battleChess3D.animateMove(from.r, from.c, to.r, to.c);
    }
  }

  const opponentColor = game.turn;
  if (game.isCheckmate(opponentColor)) {
    game.phase = PHASES.GAME_OVER as Phase;
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
    if (isPlayerWin) confettiSystem.spawn();

    if (game.gameController) {
      const winningColor: Player = opponentColor === 'white' ? 'black' : 'white';
      game.gameController.handleGameEnd('win', winningColor);

      // Award Checkmate XP in Campaign
      if (game.campaignMode && winningColor === game.playerColor) {
        campaignManager.addUnitXp('k', 100); // King gets XP for victory leadership
        notificationUI.show('Mission erfüllt! Bonus: +100 XP für den König!', 'success', 'Triumph');
      }
    }
    return;
  } else if (game.isStalemate(opponentColor)) {
    game.phase = PHASES.GAME_OVER as Phase;
    UI.renderBoard(game);
    UI.updateStatus(game);
    game.log('PATT! Unentschieden.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    if (winnerText) winnerText.textContent = 'Unentschieden (Patt)';
    if (overlay) overlay.classList.remove('hidden');

    if (game.gameController) {
      game.gameController.handleGameEnd('draw', null);
    }
    return;
  } else if (MoveValidator.checkDraw(game)) {
    return;
  } else if (game.isInCheck(opponentColor)) {
    game.log(`SCHACH! ${opponentColor === 'white' ? 'Weiß' : 'Schwarz'} steht im Schach.`);
    soundManager.playCheck();
    UI.animateCheck(game, opponentColor);
  }

  UI.updateStatus(game);
  UI.renderEvalGraph(game);

  // Auto-save every 5 moves
  if (game.moveHistory.length > 0 && game.moveHistory.length % 5 === 0) {
    try {
      if (game.gameController && game.gameController.saveGame) {
        game.gameController.saveGame();
        UI.showToast('Spiel automatisch gespeichert', 'success');
      }
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }

  game.log(`${game.turn === 'white' ? 'Weiß' : 'Schwarz'} ist am Zug.`);

  if (game.isAI && game.turn === 'black' && game.phase === PHASES.PLAY) {
    setTimeout(() => {
      // Use prototype method directly to bypass any own property override
      const proto = Object.getPrototypeOf(game);
      if (typeof proto.aiMove === 'function') {
        proto.aiMove.call(game);
      }
    }, 1000);
  } else {
    setTimeout(() => {
      // Use prototype method directly to bypass any own property override
      const proto2 = Object.getPrototypeOf(game);
      if (typeof proto2.updateBestMoves === 'function') {
        proto2.updateBestMoves.call(game);
      }

      // Trigger analysis update if in analysis mode OR live engine analysis is active
      if (
        game.gameController &&
        (game.analysisMode ||
          (game.aiController && (game.aiController as { analysisActive?: boolean }).analysisActive))
      ) {
        game.gameController.requestPositionAnalysis();
      }

      if (game.analysisManager) {
        game.analysisManager.updateArrows();
      }
    }, 10);
  }
}
