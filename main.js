import { BOARD_SIZE, PHASES, Game } from './gameEngine.js';
import { SHOP_PIECES } from './config.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import { PIECE_SVGS } from './chess-pieces.js';
import { Tutorial } from './tutorial.js';
import { ArrowRenderer } from './arrows.js';
import { debounce } from './utils.js';
import { logger } from './logger.js';

logger.info('main.js loaded');

// Piece values for shop (now in config.js)
const PIECES = SHOP_PIECES;

// Tastatursteuerung für das Schachbrett (wird später initialisiert)

// Initialize soundManager
let kbRow = 0;
let kbCol = 0;
const focusCell = (r, c) => {
  const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (cell) {
    document.querySelectorAll('.cell').forEach(el => el.classList.remove('kb-focus'));
    cell.classList.add('kb-focus');
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
};

// Erweitere die Game-Klasse
Game.prototype.getPieceText = function (piece) {
  return UI.getPieceText(piece);
};

Game.prototype.getPieceSymbol = function (piece) {
  return UI.getPieceSymbol(piece);
};

Game.prototype.renderBoard = function () {
  UI.renderBoard(this);
};

Game.prototype.handleCellClick = function (r, c) {
  // Prevent interaction in replay mode
  if (this.replayMode) {
    return;
  }
  // Disable clicks if it's AI's turn
  if (
    this.isAI &&
    (this.phase === PHASES.SETUP_BLACK_KING ||
      this.phase === PHASES.SETUP_BLACK_PIECES ||
      (this.phase === PHASES.PLAY && this.turn === 'black'))
  ) {
    return;
  }

  if (this.isAnimating) return; // Block input during animation

  if (this.phase === PHASES.SETUP_WHITE_KING) {
    this.placeKing(r, c, 'white');
  } else if (this.phase === PHASES.SETUP_BLACK_KING) {
    this.placeKing(r, c, 'black');
  } else if (this.phase === PHASES.SETUP_WHITE_PIECES || this.phase === PHASES.SETUP_BLACK_PIECES) {
    this.placeShopPiece(r, c);
  } else if (this.phase === PHASES.PLAY) {
    this.handlePlayClick(r, c);
  }

  console.time('Rendering');
  this.renderBoard();
  console.timeEnd('Rendering');
};

Game.prototype.placeKing = function (r, c, color) {
  // White at bottom (6), Black at top (0)
  const validRowStart = color === 'white' ? 6 : 0;

  if (r < validRowStart || r >= validRowStart + 3) {
    this.log('Ungültiger Bereich für König!');
    return;
  }

  const colBlock = Math.floor(c / 3);
  const colStart = colBlock * 3;

  const kingR = validRowStart + 1;
  const kingC = colStart + 1;

  this.board[kingR][kingC] = { type: 'k', color: color, hasMoved: false };

  if (color === 'white') {
    this.whiteCorridor = { rowStart: validRowStart, colStart: colStart };
    this.phase = PHASES.SETUP_BLACK_KING;
    this.log('Weißer König platziert. Schwarz ist dran.');
    this.updateStatus();

    if (this.isAI) {
      setTimeout(() => this.aiSetupKing(), 1000);
    }
  } else {
    this.blackCorridor = { rowStart: validRowStart, colStart: colStart };
    this.phase = PHASES.SETUP_WHITE_PIECES;
    this.points = this.initialPoints; // Use the selected points instead of hardcoded 15
    this.updateStatus(); // Update status text first
    this.showShop(true); // Then show shop
    this.log('Weiß kauft ein.');
  }
  this.updateStatus();
};

Game.prototype.selectShopPiece = function (pieceType) {
  if (!pieceType) return;
  const typeUpper = pieceType.toUpperCase();
  const cost = PIECES[typeUpper].points;
  if (cost > this.points) {
    this.log('Nicht genug Punkte!');
    return;
  }

  this.selectedShopPiece = typeUpper;

  // Update UI
  document.querySelectorAll('.shop-btn').forEach(btn => btn.classList.remove('selected'));
  const btn = document.querySelector(`.shop-btn[data-piece="${pieceType}"]`);
  if (btn) btn.classList.add('selected');

  const displayEl = document.getElementById('selected-piece-display');
  const svg = PIECE_SVGS['white'][PIECES[typeUpper].symbol];
  displayEl.innerHTML = `Ausgewählt: <div style="display:inline-block;width:30px;height:30px;vertical-align:middle;">${svg}</div> ${PIECES[typeUpper].name} (${cost})`;
};

Game.prototype.placeShopPiece = function (r, c) {
  if (!this.selectedShopPiece) {
    const piece = this.board[r][c];
    const isWhiteTurn = this.phase === PHASES.SETUP_WHITE_PIECES;
    const color = isWhiteTurn ? 'white' : 'black';

    if (piece && piece.color === color && piece.type !== 'k') {
      const cost =
        PIECES[Object.keys(PIECES).find(k => PIECES[k].symbol === piece.type.toUpperCase())].points;
      this.points += cost;
      this.board[r][c] = null;
      this.updateShopUI();
      this.log('Figur entfernt, Punkte erstattet.');
    } else {
      this.log('Bitte zuerst eine Figur im Shop auswählen!');
    }
    return;
  }

  const isWhiteTurn = this.phase === PHASES.SETUP_WHITE_PIECES;
  const color = isWhiteTurn ? 'white' : 'black';
  const corridor = isWhiteTurn ? this.whiteCorridor : this.blackCorridor;

  if (
    r < corridor.rowStart ||
    r >= corridor.rowStart + 3 ||
    c < corridor.colStart ||
    c >= corridor.colStart + 3
  ) {
    this.log('Muss im eigenen Korridor platziert werden!');
    return;
  }

  if (this.board[r][c]) {
    this.log('Feld besetzt!');
    return;
  }

  const cost = PIECES[this.selectedShopPiece.toUpperCase()].points;
  if (this.points >= cost) {
    this.board[r][c] = {
      type: PIECES[this.selectedShopPiece.toUpperCase()].symbol,
      color: color,
      hasMoved: false,
    };
    this.points -= cost;
    this.updateShopUI();
  }
};

Game.prototype.finishSetupPhase = function () {
  if (this.phase === PHASES.SETUP_WHITE_PIECES) {
    // Check if all points were spent
    if (this.points > 0) {
      alert(
        `Du hast noch ${this.points} Punkte übrig! Kaufe weitere Figuren oder klicke erneut auf "Fertig" um fortzufahren.`
      );
      this.log(`⚠️ Warnung: ${this.points} Punkte nicht ausgegeben!`);
      // Ask for confirmation
      if (!confirm(`Möchtest du wirklich mit ${this.points} ungenutzten Punkten fortfahren?`)) {
        return; // Cancel phase transition
      }
    }

    this.phase = PHASES.SETUP_BLACK_PIECES;
    this.points = this.initialPoints; // Use the selected points, same as white player
    this.selectedShopPiece = null;
    this.updateShopUI();
    this.log('Weiß fertig. Schwarz kauft ein.');

    if (this.isAI) {
      setTimeout(() => this.aiSetupPieces(), 1000);
    }
  } else if (this.phase === PHASES.SETUP_BLACK_PIECES) {
    // Check if all points were spent
    if (this.points > 0 && !this.isAI) {
      alert(
        `Du hast noch ${this.points} Punkte übrig! Kaufe weitere Figuren oder klicke erneut auf "Fertig" um fortzufahren.`
      );
      this.log(`⚠️ Warnung: ${this.points} Punkte nicht ausgegeben!`);
      // Ask for confirmation
      if (!confirm(`Möchtest du wirklich mit ${this.points} ungenutzten Punkten fortfahren?`)) {
        return; // Cancel phase transition
      }
    }

    this.phase = PHASES.PLAY;
    this.showShop(false);

    // EXPLICITLY remove all corridor highlighting
    document.querySelectorAll('.cell.selectable-corridor').forEach(cell => {
      cell.classList.remove('selectable-corridor');
    });
    logger.debug('Removed all corridor highlighting for PLAY phase');

    // Show move history panel
    const moveHistoryPanel = document.getElementById('move-history-panel');
    if (moveHistoryPanel) {
      moveHistoryPanel.classList.remove('hidden');
    }
    const capturedPanel = document.getElementById('captured-pieces-panel');
    if (capturedPanel) {
      capturedPanel.classList.remove('hidden');
    }
    const statsPanel = document.getElementById('stats-panel');
    if (statsPanel) {
      statsPanel.classList.remove('hidden');
    }

    this.log('Spiel beginnt! Weiß ist am Zug.');
    this.updateBestMoves();
    this.startClock();
    this.updateStatistics(); // Initialize statistics display
    soundManager.playGameStart();
  }
  this.updateStatus();
  this.renderBoard();
};

Game.prototype.setTimeControl = function (mode) {
  const controls = {
    blitz3: { base: 180, increment: 2 },
    blitz5: { base: 300, increment: 3 },
    rapid10: { base: 600, increment: 0 },
    rapid15: { base: 900, increment: 10 },
    classical30: { base: 1800, increment: 0 },
  };
  this.timeControl = controls[mode] || controls['blitz5'];
  this.whiteTime = this.timeControl.base;
  this.blackTime = this.timeControl.base;
  this.updateClockDisplay();
};

Game.prototype.updateClockVisibility = function () {
  const clockEl = document.getElementById('chess-clock');
  if (clockEl) {
    if (this.clockEnabled) {
      clockEl.classList.remove('hidden');
    } else {
      clockEl.classList.add('hidden');
    }
  }
};

logger.info('main.js loaded');

// Global game instance
let game = null;

// --- Initialization ---

async function initGame(initialPoints) {
  try {
    game = new Game(initialPoints);

    // Make game instance globally available for debugging
    window.game = game;

    // Initialize UI
    UI.initBoardUI(game);
    UI.updateStatus(game);
    UI.updateShopUI(game);
    UI.updateStatistics(game); // Initialize stats
    UI.updateClockUI(game);
    UI.updateClockDisplay(game);

    // Render board to show corridor highlighting
    UI.renderBoard(game);

    // Initialize Sound Manager
    soundManager.init();

    // Initialize Tutorial
    const tutorial = new Tutorial();

    // Initialize Arrow Renderer
    const arrowLayer = document.getElementById('arrow-layer');
    if (arrowLayer) {
      game.arrowRenderer = new ArrowRenderer(arrowLayer, BOARD_SIZE);
    }

    // Start clock update loop
    if (game.clockInterval) clearInterval(game.clockInterval);
    game.clockInterval = setInterval(() => {
      if (game.phase === PHASES.PLAY && !game.replayMode && game.clockEnabled) {
        const now = Date.now();
        const delta = (now - game.lastMoveTime) / 1000;
        game.lastMoveTime = now;

        if (game.turn === 'white') {
          game.whiteTime = Math.max(0, game.whiteTime - delta);
          if (game.whiteTime <= 0) {
            game.phase = PHASES.GAME_OVER;
            game.log('Zeit abgelaufen! Schwarz gewinnt.');
            UI.updateStatus(game);
            soundManager.playSound('game-end');
          }
        } else {
          game.blackTime = Math.max(0, game.blackTime - delta);
          if (game.blackTime <= 0) {
            game.phase = PHASES.GAME_OVER;
            game.log('Zeit abgelaufen! Weiß gewinnt.');
            UI.updateStatus(game);
            soundManager.playSound('game-end');
          }
        }
        UI.updateClockDisplay(game);
        UI.updateClockUI(game);
      }
    }, 100);

    logger.info('Game initialized with', initialPoints, 'points');
  } catch (error) {
    console.error('Error initializing game:', error);
    alert('Fehler beim Starten des Spiels. Bitte Konsole prüfen.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pointsOverlay = document.getElementById('points-selection-overlay');

  // Handle points selection
  document.querySelectorAll('.points-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const points = parseInt(btn.dataset.points);
      if (points) {
        pointsOverlay.classList.add('hidden'); // Hide overlay
        // Use style.display = 'none' to ensure it's gone if class hidden isn't enough or for safety
        pointsOverlay.style.display = 'none';
        initGame(points);
      }
    });
  });
});

Game.prototype.startClock = function () {
  if (!this.clockEnabled || this.phase !== PHASES.PLAY) return;

  this.stopClock();
  this.lastMoveTime = Date.now();
  this.clockInterval = setInterval(() => this.tickClock(), 100);
  this.updateClockUI();
};

Game.prototype.stopClock = function () {
  if (this.clockInterval) {
    clearInterval(this.clockInterval);
    this.clockInterval = null;
  }
};

Game.prototype.tickClock = function () {
  if (this.phase !== PHASES.PLAY) {
    this.stopClock();
    return;
  }

  const now = Date.now();
  const elapsed = (now - this.lastMoveTime) / 1000;
  this.lastMoveTime = now;

  if (this.turn === 'white') {
    this.whiteTime = Math.max(0, this.whiteTime - elapsed);
  } else {
    this.blackTime = Math.max(0, this.blackTime - elapsed);
  }

  this.updateClockDisplay();

  // Check for timeout
  if (this.whiteTime <= 0) {
    this.stopClock();
    this.phase = PHASES.GAME_OVER;
    this.log('Weiß hat keine Zeit mehr! Schwarz gewinnt durch Zeitüberschreitung.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Schwarz gewinnt durch Zeitüberschreitung!';
    overlay.classList.remove('hidden');
  } else if (this.blackTime <= 0) {
    this.stopClock();
    this.phase = PHASES.GAME_OVER;
    this.log('Schwarz hat keine Zeit mehr! Weiß gewinnt durch Zeitüberschreitung.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Weiß gewinnt durch Zeitüberschreitung!';
    overlay.classList.remove('hidden');
  }
};

Game.prototype.updateClockDisplay = function () {
  UI.updateClockDisplay(this);
};

Game.prototype.updateClockUI = function () {
  UI.updateClockUI(this);
};

Game.prototype.showShop = function (show) {
  UI.showShop(this, show);
};

Game.prototype.updateShopUI = function () {
  UI.updateShopUI(this);
};

Game.prototype.handlePlayClick = function (r, c) {
  const clickedPiece = this.board[r][c];
  const isCurrentPlayersPiece = clickedPiece && clickedPiece.color === this.turn;

  // 1. If clicking own piece, always select it (change selection)
  if (isCurrentPlayersPiece) {
    this.selectedSquare = { r, c };
    this.validMoves = this.getValidMoves(r, c, clickedPiece);
    this.renderBoard();
    return;
  }

  // 2. If we have a selected piece AND it belongs to us, check if we want to move/capture
  const selectedPiece = this.selectedSquare
    ? this.board[this.selectedSquare.r][this.selectedSquare.c]
    : null;
  const isSelectedMine = selectedPiece && selectedPiece.color === this.turn;

  if (isSelectedMine && this.validMoves) {
    const move = this.validMoves.find(m => m.r === r && m.c === c);
    if (move) {
      // Track accuracy for human player
      // If playing against AI: track white's moves (human)
      // If not against AI: track all moves (both players are human)
      const isHumanMove = this.isAI ? this.turn === 'white' : true;
      if (isHumanMove) {
        this.stats.playerMoves++;
        // Check if this move is one of the best moves
        if (this.isTutorMove(this.selectedSquare, move)) {
          this.stats.playerBestMoves++;
        }
      }
      this.executeMove(this.selectedSquare, move);
      return;
    }
  }

  // 3. If clicking an enemy piece (and not capturing it), select it to show threats
  if (clickedPiece) {
    this.selectedSquare = { r, c };
    this.validMoves = this.getValidMoves(r, c, clickedPiece);
    this.renderBoard();
    return;
  }

  // 4. Otherwise (clicking empty square that is not a move), deselect
  this.selectedSquare = null;
  this.validMoves = null;
  this.renderBoard();
};

Game.prototype.executeMove = async function (from, to) {
  // Clear tutor arrows when making a move
  if (this.arrowRenderer) {
    this.arrowRenderer.clearArrows();
  }

  const piece = this.board[from.r][from.c];
  if (!piece) return;

  const targetPiece = this.board[to.r][to.c];

  // Record move in history (snapshot current state)
  const moveRecord = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    piece: { type: piece.type, color: piece.color, hasMoved: piece.hasMoved },
    capturedPiece: targetPiece ? { type: targetPiece.type, color: targetPiece.color } : null,
    specialMove: null, // Will be set for castling, en passant, promotion
    halfMoveClock: this.halfMoveClock,
    positionHistoryLength: this.positionHistory.length,
  };

  // Handle Castling
  if (piece.type === 'k' && Math.abs(to.c - from.c) === 2) {
    const isKingside = to.c > from.c;
    const rookCol = isKingside ? BOARD_SIZE - 1 : 0;
    const rookTargetCol = isKingside ? to.c - 1 : to.c + 1;
    const rook = this.board[from.r][rookCol];

    moveRecord.specialMove = {
      type: 'castling',
      isKingside,
      rookFrom: { r: from.r, c: rookCol },
      rookTo: { r: from.r, c: rookTargetCol },
      rookHadMoved: rook.hasMoved,
    };

    // Move Rook
    this.board[from.r][rookTargetCol] = rook;
    this.board[from.r][rookCol] = null;
    rook.hasMoved = true;
    this.log(`${piece.color === 'white' ? 'Weiß' : 'Schwarz'} rochiert!`);
  }

  // Handle En Passant
  if (piece.type === 'p' && to.c !== from.c && !targetPiece) {
    // Captured pawn is "behind" the destination
    // Actually, simpler: captured pawn is at {from.r, to.c}
    const capturedPawnRow = from.r;
    const capturedPawn = this.board[capturedPawnRow][to.c];

    moveRecord.specialMove = {
      type: 'enPassant',
      capturedPawnPos: { r: capturedPawnRow, c: to.c },
      capturedPawn: { type: capturedPawn.type, color: capturedPawn.color },
    };

    this.board[capturedPawnRow][to.c] = null;
    this.log('En Passant geschlagen!');
  }
  // Update 50-move rule clock
  if (piece.type === 'p' || targetPiece) {
    this.halfMoveClock = 0;
  } else {
    this.halfMoveClock++;
  }

  // Animate move BEFORE updating board state (so piece is still on origin)
  if (this.phase === PHASES.PLAY) {
    await this.animateMove(from, to, piece);
  }

  // NOW execute move (update board state)
  this.board[to.r][to.c] = piece;
  this.board[from.r][from.c] = null;
  piece.hasMoved = true;

  // Render board to show final state
  this.renderBoard();

  // Play sound
  if (targetPiece || (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant')) {
    soundManager.playCapture();
  } else {
    soundManager.playMove();
  }

  // Update captured pieces
  if (targetPiece) {
    // If white captured black piece, add to white's collection
    const capturerColor = piece.color;
    this.capturedPieces[capturerColor].push(targetPiece);
    this.updateCapturedUI();
  } else if (moveRecord.specialMove && moveRecord.specialMove.type === 'enPassant') {
    const capturerColor = piece.color;
    this.capturedPieces[capturerColor].push(moveRecord.specialMove.capturedPawn);
    this.updateCapturedUI();
  }

  // Update last move highlight
  this.lastMoveHighlight = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
  };

  // Track last move for En Passant
  this.lastMove = {
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    piece: piece,
    isDoublePawnPush: piece.type === 'p' && Math.abs(to.r - from.r) === 2,
  };

  // Promotion check
  if (piece.type === 'p') {
    const promotionRow = piece.color === 'white' ? 0 : BOARD_SIZE - 1;
    if (to.r === promotionRow) {
      if (this.isAI && this.turn === 'black') {
        // AI auto-promotes to Queen
        piece.type = 'q';
        moveRecord.specialMove = { type: 'promotion', promotedTo: 'q' };
        this.log('Schwarzer Bauer zur Dame befördert!');
      } else {
        // Show promotion UI - record will be completed after selection
        this.moveHistory.push(moveRecord);
        this.showPromotionUI(to.r, to.c, piece.color, moveRecord);
        return; // Pause execution until selection
      }
    }
  }

  // Add move to history
  this.moveHistory.push(moveRecord);
  this.updateMoveHistoryUI();

  // Check for insufficient material immediately (before turn changes)
  if (this.isInsufficientMaterial()) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    this.log('Unentschieden (Ungenügendes Material)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
    overlay.classList.remove('hidden');
    return;
  }

  this.finishMove();
};

Game.prototype.showPromotionUI = function (r, c, color, moveRecord) {
  UI.showPromotionUI(this, r, c, color, moveRecord, () => this.finishMove());
};

Game.prototype.animateMove = async function (from, to, piece) {
  await UI.animateMove(this, from, to, piece);
};

Game.prototype.finishMove = function () {
  this.selectedSquare = null;
  this.validMoves = null;

  // Increment stats
  this.stats.totalMoves++;
  if (this.turn === 'white') this.stats.playerMoves++;

  // Check if a king was captured (this shouldn't happen in proper chess, but let's handle it)
  let whiteKingExists = false;
  let blackKingExists = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = this.board[r][c];
      if (piece && piece.type === 'k') {
        if (piece.color === 'white') whiteKingExists = true;
        if (piece.color === 'black') blackKingExists = true;
      }
    }
  }

  // If a king is missing, game is over
  if (!whiteKingExists || !blackKingExists) {
    this.phase = PHASES.GAME_OVER;
    const winner = !whiteKingExists ? 'Schwarz' : 'Weiß';
    this.log(`KÖNIG GESCHLAGEN! ${winner} gewinnt!`);

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = `${winner} gewinnt!\n(König geschlagen)`;
    overlay.classList.remove('hidden');

    // Play victory/defeat sound
    const isPlayerWin = (this.isAI && this.turn === 'black') || !this.isAI;
    soundManager.playGameOver(isPlayerWin);

    this.renderBoard();
    this.updateStatus();
    return;
  }

  // Switch turns
  this.turn = this.turn === 'white' ? 'black' : 'white';

  // Update statistics
  this.updateStatistics();

  // Add time increment if clock is enabled
  if (this.clockEnabled) {
    const previousPlayer = this.turn === 'white' ? 'black' : 'white';
    if (previousPlayer === 'white') {
      this.whiteTime += this.timeControl.increment;
    } else {
      this.blackTime += this.timeControl.increment;
    }
    this.updateClockDisplay();
    this.updateClockUI();
  }

  // Update position history for repetition check
  const currentHash = this.getBoardHash();
  this.positionHistory.push(currentHash);

  // Check for Check/Checkmate/Stalemate
  const opponentColor = this.turn;
  if (this.isCheckmate(opponentColor)) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    const winner = opponentColor === 'white' ? 'Schwarz' : 'Weiß';
    this.log(`SCHACHMATT! ${winner} gewinnt!`);

    // Animiere Checkmate
    this.animateCheckmate(opponentColor);

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = `${winner} gewinnt!`;
    overlay.classList.remove('hidden');

    // Play victory/defeat sound
    const isPlayerWin = (this.isAI && opponentColor === 'black') || !this.isAI;
    soundManager.playGameOver(isPlayerWin);
    return;
  } else if (this.isStalemate(opponentColor)) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    this.log('PATT! Unentschieden.');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Unentschieden (Patt)';
    overlay.classList.remove('hidden');
    return;
  } else if (this.checkDraw()) {
    return;
  } else if (this.isInCheck(opponentColor)) {
    this.log(`SCHACH! ${opponentColor === 'white' ? 'Weiß' : 'Schwarz'} steht im Schach.`);
    soundManager.playCheck();
    this.animateCheck(opponentColor);
  }

  this.updateStatus();
  this.log(`${this.turn === 'white' ? 'Weiß' : 'Schwarz'} ist am Zug.`);

  if (this.isAI && this.turn === 'black' && this.phase === PHASES.PLAY) {
    setTimeout(() => this.aiMove(), 1000);
  } else {
    // Calculate hints for human player
    setTimeout(() => this.updateBestMoves(), 10);
  }
};

// --- AI Methods ---

/**
 * Update AI progress display
 */
Game.prototype.updateAIProgress = function (data) {
  const depthEl = document.getElementById('ai-depth');
  const nodesEl = document.getElementById('ai-nodes');
  const bestMoveEl = document.getElementById('ai-best-move');
  const progressFill = document.getElementById('progress-fill');

  if (depthEl) {
    depthEl.textContent = `Tiefe ${data.depth}/${data.maxDepth}`;
  }

  if (nodesEl) {
    const nodesFormatted = data.nodes.toLocaleString('de-DE');
    nodesEl.textContent = `${nodesFormatted} Positionen`;
  }

  if (bestMoveEl && data.bestMove) {
    const from =
      String.fromCharCode(97 + data.bestMove.from.c) + (BOARD_SIZE - data.bestMove.from.r);
    const to = String.fromCharCode(97 + data.bestMove.to.c) + (BOARD_SIZE - data.bestMove.to.r);
    bestMoveEl.textContent = `Bester Zug: ${from}-${to}`;
  }

  if (progressFill && data.maxDepth > 0) {
    const progress = (data.depth / data.maxDepth) * 100;
    progressFill.style.width = `${progress}%`;
  }
};

Game.prototype.aiSetupKing = function () {
  // Choose random corridor (0, 3, 6)
  const cols = [0, 3, 6];
  const randomCol = cols[Math.floor(Math.random() * cols.length)];
  // Black King goes to row 0-2 (top), specifically row 1, col randomCol+1
  this.placeKing(1, randomCol + 1, 'black');
  this.renderBoard();
};

Game.prototype.aiSetupPieces = function () {
  const corridor = this.blackCorridor;
  const availablePieces = ['QUEEN', 'CHANCELLOR', 'ARCHBISHOP', 'ROOK', 'BISHOP', 'KNIGHT', 'PAWN'];

  // Simple greedy strategy: buy expensive stuff first
  while (this.points > 0) {
    // Filter affordable pieces
    const affordable = availablePieces.filter(p => PIECES[p].points <= this.points);
    if (affordable.length === 0) break;

    const choice = affordable[Math.floor(Math.random() * affordable.length)];
    this.selectedShopPiece = choice;

    // Find empty spot
    const emptySpots = [];
    for (let r = corridor.rowStart; r < corridor.rowStart + 3; r++) {
      for (let c = corridor.colStart; c < corridor.colStart + 3; c++) {
        if (!this.board[r][c]) emptySpots.push({ r, c });
      }
    }

    if (emptySpots.length === 0) break;

    const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
    this.placeShopPiece(spot.r, spot.c);
  }

  this.finishSetupPhase();
};

Game.prototype.aiMove = function () {
  // Check if AI should resign
  if (this.aiShouldResign()) {
    this.resign('black');
    return;
  }

  // Check if AI should offer draw
  if (this.aiShouldOfferDraw()) {
    this.offerDraw('black');
    // Continue with move if player hasn't responded yet
  }

  // Check if there's a pending draw offer from player
  if (this.drawOffered && this.drawOfferedBy === 'white') {
    this.aiEvaluateDrawOffer();
    // If draw was accepted, game is over, so return
    if (this.phase === PHASES.GAME_OVER) {
      return;
    }
  }

  const spinner = document.getElementById('spinner-overlay');
  if (spinner) spinner.style.display = 'flex';
  console.time('KI-Zug');

  // Use Web Worker for AI calculations to prevent UI freezing
  if (!this.aiWorker) {
    this.aiWorker = new Worker('ai-worker.js', { type: 'module' });
  }

  // Prepare board state for worker (convert to serializable format)
  const boardCopy = JSON.parse(JSON.stringify(this.board));

  // Difficulty to depth mapping
  const depthMap = {
    beginner: 1,
    easy: 2,
    medium: 3,
    hard: 4,
    expert: 5,
  };
  const depth = depthMap[this.difficulty] || 3; // Default to medium if unknown

  this.aiWorker.onmessage = e => {
    const { type, data } = e.data;

    if (type === 'progress') {
      // Update progress UI
      this.updateAIProgress(data);
    } else if (type === 'bestMove') {
      console.timeEnd('KI-Zug');
      if (spinner) spinner.style.display = 'none';

      if (data) {
        this.executeMove(data.from, data.to);
        this.renderBoard();
      } else {
        this.log('KI kann nicht ziehen (Patt oder Matt?)');
      }
    }
  };

  this.aiWorker.postMessage({
    type: 'getBestMove',
    data: {
      board: boardCopy,
      color: 'black',
      depth: depth,
      difficulty: this.difficulty,
      moveNumber: Math.floor(this.moveHistory.length / 2), // Black's move number
    },
  });
};

Game.prototype.evaluateMove = function (move) {
  // Simulate the move
  const fromPiece = this.board[move.from.r][move.from.c];
  const toPiece = this.board[move.to.r][move.to.c];

  this.board[move.to.r][move.to.c] = fromPiece;
  this.board[move.from.r][move.from.c] = null;

  const score = this.evaluatePosition('black');

  // Undo the move
  this.board[move.from.r][move.from.c] = fromPiece;
  this.board[move.to.r][move.to.c] = toPiece;

  return score;
};

Game.prototype.getBestMoveMinimax = function (moves, depth) {
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const score = this.minimax(move, depth - 1, false, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};

Game.prototype.minimax = function (move, depth, isMaximizing, alpha, beta) {
  // Simulate move
  const fromPiece = this.board[move.from.r][move.from.c];
  const toPiece = this.board[move.to.r][move.to.c];

  this.board[move.to.r][move.to.c] = fromPiece;
  this.board[move.from.r][move.from.c] = null;

  let score;

  if (depth === 0) {
    // Use Quiescence Search at leaf nodes
    score = this.quiescenceSearch(alpha, beta, isMaximizing);
  } else {
    const color = isMaximizing ? 'black' : 'white';
    const moves = this.getAllLegalMoves(color);

    if (moves.length === 0) {
      // Game over
      score = isMaximizing ? -10000 : 10000;
    } else if (isMaximizing) {
      score = -Infinity;
      for (const nextMove of moves) {
        score = Math.max(score, this.minimax(nextMove, depth - 1, false, alpha, beta));
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
    } else {
      score = Infinity;
      for (const nextMove of moves) {
        score = Math.min(score, this.minimax(nextMove, depth - 1, true, alpha, beta));
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
    }
  }

  // Undo move
  this.board[move.from.r][move.from.c] = fromPiece;
  this.board[move.to.r][move.to.c] = toPiece;

  return score;
};

Game.prototype.quiescenceSearch = function (alpha, beta, isMaximizing) {
  // Stand-pat score (evaluation of current position)
  const standPat = this.evaluatePosition('black');

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    // For minimizing player (White), we want low scores.
    // But evaluatePosition returns Black's perspective (positive = good for Black).
    // So minimizing player wants to MINIMIZE the score.
    // Stand-pat logic for minimizer:
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }

  // Find all CAPTURE moves
  const color = isMaximizing ? 'black' : 'white';
  const moves = this.getAllLegalMoves(color);
  const captureMoves = moves.filter(m => this.board[m.to.r][m.to.c] !== null);

  if (isMaximizing) {
    for (const move of captureMoves) {
      // Simulate
      const fromPiece = this.board[move.from.r][move.from.c];
      const toPiece = this.board[move.to.r][move.to.c];
      this.board[move.to.r][move.to.c] = fromPiece;
      this.board[move.from.r][move.from.c] = null;

      const score = this.quiescenceSearch(alpha, beta, false);

      // Undo
      this.board[move.from.r][move.from.c] = fromPiece;
      this.board[move.to.r][move.to.c] = toPiece;

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    for (const move of captureMoves) {
      // Simulate
      const fromPiece = this.board[move.from.r][move.from.c];
      const toPiece = this.board[move.to.r][move.to.c];
      this.board[move.to.r][move.to.c] = fromPiece;
      this.board[move.from.r][move.from.c] = null;

      const score = this.quiescenceSearch(alpha, beta, true);

      // Undo
      this.board[move.from.r][move.from.c] = fromPiece;
      this.board[move.to.r][move.to.c] = toPiece;

      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
};

Game.prototype.evaluatePosition = function (forColor) {
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, a: 700, q: 900, c: 900, k: 20000 };

  // Piece-Square Tables (bonus for good positions)
  // ... (tables omitted for brevity, reusing existing ones if possible, but for full replacement I need to include them or keep them)
  // To keep it clean, I will just reference the existing tables logic but add the new factors.

  // RE-DEFINING TABLES TO ENSURE THEY ARE AVAILABLE
  const pawnTable = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5, 5],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const knightTable = [
    [-50, -40, -30, -30, -30, -30, -40, -50, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50, -50],
    [-50, -40, -30, -30, -30, -30, -40, -50, -50],
  ];

  const bishopTable = [
    [-20, -10, -10, -10, -10, -10, -10, -20, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20, -20],
    [-20, -10, -10, -10, -10, -10, -10, -20, -20],
  ];

  const rookTable = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5, -5],
    [0, 0, 0, 5, 5, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const queenTable = [
    [-20, -10, -10, -5, -5, -10, -10, -20, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5, -5],
    [0, 0, 5, 5, 5, 5, 0, -5, 0],
    [-10, 5, 5, 5, 5, 5, 0, -10, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20, -20],
    [-20, -10, -10, -5, -5, -10, -10, -20, -20],
  ];

  const kingTable = [
    [-30, -40, -40, -50, -50, -40, -40, -30, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10, -10],
    [20, 20, 0, 0, 0, 0, 20, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20, 20],
    [30, 40, 40, 0, 0, 20, 40, 30, 30],
  ];

  const tables = {
    p: pawnTable,
    n: knightTable,
    b: bishopTable,
    r: rookTable,
    q: queenTable,
    k: kingTable,
    a: queenTable, // Reuse Queen table for Archbishop
    c: queenTable, // Reuse Queen table for Chancellor
  };

  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = this.board[r][c];
      if (piece) {
        let value = pieceValues[piece.type];

        // Add piece-square table bonus
        const table = tables[piece.type];
        if (table) {
          const row = piece.color === 'white' ? BOARD_SIZE - 1 - r : r;
          value += table[row][c];
        }

        // Center Control Bonus (Central 3x3)
        if (r >= 3 && r <= 5 && c >= 3 && c <= 5) {
          value += 15;
        }

        if (piece.color === forColor) {
          score += value;
        } else {
          score -= value;
        }
      }
    }
  }

  // Mobility Bonus (expensive, so maybe only approximate or skip for deep searches)
  // For now, let's keep it simple to avoid performance hits in JS

  return score;
};

Game.prototype.updateBestMoves = function () {
  if (this.phase === PHASES.PLAY && (!this.isAI || this.turn === 'white')) {
    // Silence logs for automatic updates
    // const originalLog = console.log;
    const originalWarn = console.warn;
    // console.log = () => { };
    console.warn = () => { };

    try {
      this.bestMoves = this.getTutorHints();
    } finally {
      // console.log = originalLog;
      console.warn = originalWarn;
    }
  } else {
    this.bestMoves = [];
  }
};

Game.prototype.isTutorMove = function (from, to) {
  if (!this.bestMoves || this.bestMoves.length === 0) return false;
  return this.bestMoves.some(
    hint =>
      hint.move.from.r === from.r &&
      hint.move.from.c === from.c &&
      hint.move.to.r === to.r &&
      hint.move.to.c === to.c
  );
};

Game.prototype.getTutorHints = function () {
  if (this.phase !== PHASES.PLAY) {
    logger.debug('Tutor: Not in PLAY phase');
    return [];
  }

  // Only show hints when it's the human player's turn
  if (this.isAI && this.turn === 'black') {
    logger.debug('Tutor: AI turn, no hints');
    return []; // Don't give hints for AI
  }

  logger.debug(`Tutor: Getting hints for ${this.turn}`);
  const moves = this.getAllLegalMoves(this.turn);
  logger.debug(`Tutor: Found ${moves.length} legal moves`);

  if (moves.length === 0) return [];

  // Evaluate all moves with simpler method to avoid board corruption
  const evaluatedMoves = [];
  for (const move of moves) {
    // Verify the move is still valid
    const fromPiece = this.board[move.from.r][move.from.c];
    if (!fromPiece) {
      console.warn(`Tutor: No piece at from position ${move.from.r},${move.from.c}`);
      continue;
    }
    if (fromPiece.color !== this.turn) {
      console.warn(`Tutor: Wrong color piece at ${move.from.r},${move.from.c}`);
      continue;
    }
    // Ensure target square is not occupied by own piece
    const targetPiece = this.board[move.to.r][move.to.c];
    if (targetPiece && targetPiece.color === this.turn) {
      console.warn(`Tutor: Target square ${move.to.r},${move.to.c} occupied by own piece`);
      continue;
    }
    // Double-check this move is in the original valid moves for this piece
    const validForPiece = this.getValidMoves(move.from.r, move.from.c, fromPiece);
    const isReallyValid = validForPiece.some(v => v.r === move.to.r && v.c === move.to.c);

    if (!isReallyValid) {
      console.warn(
        `Tutor: Move from ${move.from.r},${move.from.c} to ${move.to.r},${move.to.c} not in valid moves`
      );
      continue;
    }

    // Use shallow Minimax for Tutor
    // We want to evaluate this move for WHITE (minimizing player in our engine logic usually, but here we want best score for White)
    // Wait, our engine evaluates for BLACK. So White wants LOW scores.
    // But for the user display, we want positive numbers = good for user.

    // Let's run minimax depth 1 (which means looking at opponent's replies)
    // minimax returns score from Black's perspective.
    // We pass isMaximizing=true because after White moves, it's Black's turn (Maximizer).
    const score = this.minimax(move, 1, true, -Infinity, Infinity);

    // Invert score for display (so + is good for White)
    const displayScore = -score;
    const notation = this.getMoveNotation(move);

    logger.debug(`Tutor: Valid move: ${notation} (score: ${displayScore})`);

    evaluatedMoves.push({
      move,
      score: displayScore,
      notation,
    });
  }

  logger.debug(`Tutor: ${evaluatedMoves.length} valid evaluated moves`);

  // Sort by score (best first)
  evaluatedMoves.sort((a, b) => b.score - a.score);

  // Get best score for relative comparison
  const bestScore = evaluatedMoves.length > 0 ? evaluatedMoves[0].score : 0;

  // Return top 3 with analysis
  return evaluatedMoves.slice(0, 3).map(hint => {
    const analysis = this.analyzeMoveWithExplanation(hint.move, hint.score, bestScore);
    return {
      ...hint,
      analysis,
    };
  });
};

Game.prototype.getMoveNotation = function (move) {
  const piece = this.board[move.from.r][move.from.c];
  const targetPiece = this.board[move.to.r][move.to.c];
  const pieceSymbol = this.getPieceText(piece);
  const fromNotation = String.fromCharCode(97 + move.from.c) + (BOARD_SIZE - move.from.r);
  const toNotation = String.fromCharCode(97 + move.to.c) + (BOARD_SIZE - move.to.r);

  // Get piece names in German
  const pieceNames = {
    p: 'Bauer',
    n: 'Springer',
    b: 'Läufer',
    r: 'Turm',
    q: 'Dame',
    k: 'König',
    a: 'Erzbischof',
    c: 'Kanzler',
  };
  const pieceName = pieceNames[piece.type];

  if (targetPiece) {
    const targetName = pieceNames[targetPiece.type];
    return `${pieceSymbol} ${pieceName} schlägt ${targetName} (${fromNotation}→${toNotation})`;
  } else {
    return `${pieceSymbol} ${pieceName} nach ${toNotation}`;
  }
};

Game.prototype.showTutorSuggestions = function () {
  UI.showTutorSuggestions(this);
};

// ===== ENHANCED TUTOR SYSTEM =====

/**
 * Get German piece name
 * @param {string} type - Piece type
 * @returns {string} German name
 */
Game.prototype.getPieceName = function (type) {
  const names = {
    p: 'Bauer',
    n: 'Springer',
    b: 'Läufer',
    r: 'Turm',
    q: 'Dame',
    k: 'König',
    a: 'Erzbischof',
    c: 'Kanzler',
  };
  return names[type] || type;
};

/**
 * Get threatened pieces from a position
 * @param {object} pos - Position {r, c}
 * @param {string} attackerColor - Color of attacker
 * @returns {Array} List of threatened pieces with positions
 */
Game.prototype.getThreatenedPieces = function (pos, attackerColor) {
  const threatened = [];
  const piece = this.board[pos.r][pos.c];
  if (!piece) return threatened;

  const moves = this.getValidMoves(pos.r, pos.c, piece);

  moves.forEach(move => {
    const targetPiece = this.board[move.r][move.c];
    if (targetPiece && targetPiece.color !== attackerColor) {
      threatened.push({
        piece: targetPiece,
        pos: { r: move.r, c: move.c },
        type: targetPiece.type,
        name: this.getPieceName(targetPiece.type),
      });
    }
  });

  return threatened;
};

/**
 * Detect tactical patterns in a move
 * @param {object} move - The move to analyze
 * @returns {Array} List of detected patterns with explanations
 */
Game.prototype.detectTacticalPatterns = function (move) {
  const patterns = [];
  const from = move.from;
  const to = move.to;
  const piece = this.board[from.r][from.c];

  if (!piece) return patterns;

  // Simulate the move temporarily
  const capturedPiece = this.board[to.r][to.c];
  this.board[to.r][to.c] = piece;
  this.board[from.r][from.c] = null;

  try {
    // 1. FORK - Attacks 2+ valuable pieces
    const threatened = this.getThreatenedPieces(to, piece.color);
    const valuableThreatened = threatened.filter(t => t.type !== 'p');

    if (valuableThreatened.length >= 2) {
      const pieces = valuableThreatened.map(t => t.name).join(' und ');
      patterns.push({
        type: 'fork',
        severity: 'high',
        explanation: `🍴 Gabelangriff! Bedroht: ${pieces}`,
      });
    }

    // 2. CAPTURE - Taking material
    if (capturedPiece) {
      const pieceName = this.getPieceName(capturedPiece.type);
      patterns.push({
        type: 'capture',
        severity: 'medium',
        explanation: `⚔️ Schlägt ${pieceName}`,
      });
    }

    // 3. CHECK - Threatening opponent's king
    const opponentColor = piece.color === 'white' ? 'black' : 'white';
    if (this.isInCheck(opponentColor)) {
      patterns.push({
        type: 'check',
        severity: 'high',
        explanation: '♔ Schach! Bedroht gegnerischen König',
      });
    }

    // 4. DEFENSE - Defending a threatened piece
    const defendedPieces = this.getDefendedPieces(to, piece.color);
    if (defendedPieces.length > 0 && defendedPieces.some(d => d.wasThreatened)) {
      const defended = defendedPieces.find(d => d.wasThreatened);
      patterns.push({
        type: 'defense',
        severity: 'medium',
        explanation: `🛡️ Verteidigt bedrohten ${defended.name}`,
      });
    }
  } finally {
    // Restore board
    this.board[from.r][from.c] = piece;
    this.board[to.r][to.c] = capturedPiece;
  }

  return patterns;
};

/**
 * Get pieces defended by a piece at a position
 * @param {object} pos - Position {r, c}
 * @param {string} defenderColor - Color of defender
 * @returns {Array} List of defended pieces
 */
Game.prototype.getDefendedPieces = function (pos, defenderColor) {
  const defended = [];
  const piece = this.board[pos.r][pos.c];
  if (!piece) return defended;

  const moves = this.getValidMoves(pos.r, pos.c, piece);

  moves.forEach(move => {
    const targetPiece = this.board[move.r][move.c];
    if (targetPiece && targetPiece.color === defenderColor) {
      // Check if this piece is threatened by opponent
      const opponentColor = defenderColor === 'white' ? 'black' : 'white';
      const wasThreatened = this.isSquareUnderAttack(move.r, move.c, opponentColor);

      defended.push({
        piece: targetPiece,
        pos: { r: move.r, c: move.c },
        type: targetPiece.type,
        name: this.getPieceName(targetPiece.type),
        wasThreatened,
      });
    }
  });

  return defended;
};

/**
 * Analyze strategic value of a move
 * @param {object} move - The move to analyze
 * @returns {Array} List of strategic insights
 */
Game.prototype.analyzeStrategicValue = function (move) {
  const strategic = [];
  const to = move.to;
  const from = move.from;
  const piece = this.board[from.r][from.c];

  if (!piece) return strategic;

  // Center control (middle 3x3 area)
  const centerSquares = [
    [3, 3],
    [3, 4],
    [3, 5],
    [4, 3],
    [4, 4],
    [4, 5],
    [5, 3],
    [5, 4],
    [5, 5],
  ];
  const isCenter = centerSquares.some(c => c[0] === to.r && c[1] === to.c);

  if (isCenter) {
    strategic.push({
      type: 'center_control',
      explanation: '🎯 Kontrolliert das Zentrum',
    });
  }

  // Development - moving a piece for the first time (except pawns)
  if (!piece.hasMoved && piece.type !== 'p' && piece.type !== 'k') {
    strategic.push({
      type: 'development',
      explanation: '♟️ Entwickelt neue Figur',
    });
  }

  // Castling
  if (move.specialMove && move.specialMove.type === 'castling') {
    strategic.push({
      type: 'castling',
      explanation: '🏰 Rochade - Sichert König',
    });
  }

  return strategic;
};

/**
 * Convert numerical score to beginner-friendly description
 * @param {number} score - Evaluation score in centipawns
 * @returns {object} Description with label and color
 */
Game.prototype.getScoreDescription = function (score) {
  // Score is in centipawns (100 = 1 pawn advantage)
  const pawns = score / 100;

  if (score >= 900) {
    return { label: '🏆 Gewinnstellung', color: '#10b981', emoji: '🏆' };
  } else if (score >= 500) {
    return { label: '⭐ Großer Vorteil', color: '#22c55e', emoji: '⭐' };
  } else if (score >= 200) {
    return { label: '✨ Klarer Vorteil', color: '#4ade80', emoji: '✨' };
  } else if (score >= 50) {
    return { label: '➕ Leichter Vorteil', color: '#86efac', emoji: '➕' };
  } else if (score >= -50) {
    return { label: '⚖️ Ausgeglichen', color: '#94a3b8', emoji: '⚖️' };
  } else if (score >= -200) {
    return { label: '➖ Leichter Nachteil', color: '#fca5a5', emoji: '➖' };
  } else if (score >= -500) {
    return { label: '⚠️ Schwieriger', color: '#f87171', emoji: '⚠️' };
  } else if (score >= -900) {
    return { label: '🔴 Großer Nachteil', color: '#ef4444', emoji: '🔴' };
  } else {
    return { label: '💀 Verloren', color: '#dc2626', emoji: '💀' };
  }
};

/**
 * Analyze a move and generate comprehensive explanation
 * @param {object} move - The move to analyze
 * @param {number} score - Evaluation score
 * @param {number} bestScore - Score of the best available move
 * @returns {object} Complete analysis with explanations
 */
Game.prototype.analyzeMoveWithExplanation = function (move, score, bestScore) {
  const explanations = [];
  const warnings = [];
  let category = 'normal';

  // Calculate difference from best move (relative quality)
  // score and bestScore are from perspective of player (higher is better)
  const diff = score - bestScore;

  // Categorize based on relative score
  if (diff >= -0.5) {
    // Top tier move
    if (score >= 300) {
      category = 'excellent';
      explanations.push('⭐⭐⭐ Gewinnzug!');
    } else if (diff >= -0.1) {
      category = 'excellent';
      explanations.push('⭐⭐⭐ Bester Zug');
    } else {
      category = 'good';
      explanations.push('⭐⭐ Guter Zug');
    }
  } else if (diff >= -1.5) {
    category = 'normal';
    explanations.push('⭐ Solider Zug');
  } else if (diff >= -3.0) {
    category = 'questionable';
    warnings.push('Fragwürdiger Zug');
  } else {
    category = 'mistake';
    warnings.push('Fehler - Bessere Züge verfügbar');
  }

  // Detect tactical patterns
  const patterns = this.detectTacticalPatterns(move);
  patterns.forEach(pattern => {
    explanations.push(pattern.explanation);
  });

  // Analyze strategic value
  const strategic = this.analyzeStrategicValue(move);
  strategic.forEach(s => {
    explanations.push(s.explanation);
  });

  return {
    move,
    score,
    category,
    explanations,
    warnings,
    tacticalPatterns: patterns,
    strategicValue: strategic,
  };
};

Game.prototype.updateStatus = function () {
  UI.updateStatus(this);
};

Game.prototype.log = function (msg) {
  const logEl = document.getElementById('log');
  const entry = document.createElement('div');
  entry.textContent = `> ${msg}`;
  logEl.prepend(entry);
};

Game.prototype.getBoardHash = function () {
  // Create a simple hash of the board state for repetition detection
  let hash = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = this.board[r][c];
      if (piece) {
        hash += `${piece.color[0]}${piece.type}${r}${c};`;
      }
    }
  }
  return hash;
};

Game.prototype.checkDraw = function () {
  // Check 50-move rule
  if (this.halfMoveClock >= 100) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    this.log('Unentschieden (50-Züge-Regel)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Unentschieden (50-Züge-Regel)';
    overlay.classList.remove('hidden');
    return true;
  }

  // Check threefold repetition
  const currentHash = this.getBoardHash();
  const occurrences = this.positionHistory.filter(h => h === currentHash).length;
  if (occurrences >= 3) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    this.log('Unentschieden (Stellungswiederholung)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Unentschieden (Stellungswiederholung)';
    overlay.classList.remove('hidden');
    return true;
  }

  // Check insufficient material
  if (this.isInsufficientMaterial()) {
    this.phase = PHASES.GAME_OVER;
    this.renderBoard();
    this.updateStatus();
    this.log('Unentschieden (Ungenügendes Material)');
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Unentschieden (Ungenügendes Material)';
    overlay.classList.remove('hidden');
    return true;
  }

  return false;
};

Game.prototype.isInsufficientMaterial = function () {
  const pieces = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (this.board[r][c]) {
        pieces.push(this.board[r][c]);
      }
    }
  }

  // Separate pieces by color
  const whitePieces = pieces.filter(p => p.color === 'white');
  const blackPieces = pieces.filter(p => p.color === 'black');

  // Helper: get non-king pieces
  const whiteNonKings = whitePieces.filter(p => p.type !== 'k');
  const blackNonKings = blackPieces.filter(p => p.type !== 'k');

  // 1. King vs King
  if (pieces.length === 2) return true;

  // 2. King + Minor piece (N or B) vs King
  if (pieces.length === 3) {
    const nonKings = pieces.filter(p => p.type !== 'k');
    if (nonKings.length === 1 && (nonKings[0].type === 'n' || nonKings[0].type === 'b')) {
      return true;
    }
  }

  // 3. King + 2 Knights vs King (very rare, but insufficient)
  if (pieces.length === 4) {
    if (whiteNonKings.length === 2 && blackNonKings.length === 0) {
      if (whiteNonKings.every(p => p.type === 'n')) return true;
    }
    if (blackNonKings.length === 2 && whiteNonKings.length === 0) {
      if (blackNonKings.every(p => p.type === 'n')) return true;
    }
  }

  // 4. King + Bishop vs King + Bishop (same color squares)
  if (
    pieces.length === 4 &&
    whiteNonKings.length === 1 &&
    blackNonKings.length === 1 &&
    whiteNonKings[0].type === 'b' &&
    blackNonKings[0].type === 'b'
  ) {
    // Find bishop positions
    let whiteBishopSquare = null;
    let blackBishopSquare = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.type === 'b') {
          if (piece.color === 'white') whiteBishopSquare = { r, c };
          else blackBishopSquare = { r, c };
        }
      }
    }

    // Check if both bishops on same colored squares
    if (whiteBishopSquare && blackBishopSquare) {
      const whiteSquareColor = (whiteBishopSquare.r + whiteBishopSquare.c) % 2;
      const blackSquareColor = (blackBishopSquare.r + blackBishopSquare.c) % 2;
      if (whiteSquareColor === blackSquareColor) return true;
    }
  }

  // 5. Only bishops of the same color on board (multiple bishops)
  const allNonKings = pieces.filter(p => p.type !== 'k');
  if (allNonKings.length > 0 && allNonKings.every(p => p.type === 'b')) {
    // Check if all bishops are on same colored squares
    const bishopSquareColors = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this.board[r][c];
        if (piece && piece.type === 'b') {
          bishopSquareColors.add((r + c) % 2);
        }
      }
    }
    // If all bishops on same color, it's a draw
    if (bishopSquareColors.size === 1) return true;
  }

  return false;
};

Game.prototype.updateMoveHistoryUI = function () {
  UI.updateMoveHistoryUI(this);
};

Game.prototype.undoMove = function () {
  if (this.moveHistory.length === 0 || this.phase !== PHASES.PLAY) {
    return;
  }

  const move = this.moveHistory.pop();

  // Push to redo stack
  this.redoStack.push(move);

  // Restore the piece to its original position
  const piece = this.board[move.to.r][move.to.c];
  if (!piece) return; // Safety check

  this.board[move.from.r][move.from.c] = piece;
  this.board[move.to.r][move.to.c] = move.capturedPiece
    ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
    : null;

  // Restore piece state
  piece.hasMoved = move.piece.hasMoved;
  piece.type = move.piece.type; // Restore in case of promotion

  // Handle special moves
  if (move.specialMove) {
    if (move.specialMove.type === 'castling') {
      // Undo rook movement
      const rook = this.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c];
      this.board[move.specialMove.rookFrom.r][move.specialMove.rookFrom.c] = rook;
      this.board[move.specialMove.rookTo.r][move.specialMove.rookTo.c] = null;
      rook.hasMoved = move.specialMove.rookHadMoved;
    } else if (move.specialMove.type === 'enPassant') {
      // Restore captured pawn
      this.board[move.specialMove.capturedPawnPos.r][move.specialMove.capturedPawnPos.c] = {
        type: 'p',
        color: move.specialMove.capturedPawn.color,
        hasMoved: true,
      };
    }
    // Restore captured pieces
    if (move.capturedPiece) {
      const capturerColor = move.piece.color;
      this.capturedPieces[capturerColor].pop();
      this.updateCapturedUI();
    } else if (move.specialMove && move.specialMove.type === 'enPassant') {
      const capturerColor = move.piece.color;
      this.capturedPieces[capturerColor].pop();
      this.updateCapturedUI();
    }
  }
  // Restore game state
  this.halfMoveClock = move.halfMoveClock;
  while (this.positionHistory.length > move.positionHistoryLength) {
    this.positionHistory.pop();
  }

  // Switch turn back
  this.turn = this.turn === 'white' ? 'black' : 'white';
  this.stats.totalMoves--; // Decrement totalMoves on undo
  this.updateStatus();
  this.updateMoveHistoryUI();
  this.updateStatistics();

  // Update last move highlight
  if (this.moveHistory.length > 0) {
    const lastMove = this.moveHistory[this.moveHistory.length - 1];
    this.lastMoveHighlight = { from: lastMove.from, to: lastMove.to };
  } else {
    this.lastMoveHighlight = null;
  }

  // Clear selection
  this.selectedSquare = null;
  this.validMoves = null;

  this.renderBoard();
  this.updateMoveHistoryUI();
  this.updateStatus();
  this.log(`Zug ${move.piece.color === 'white' ? 'Weiß' : 'Schwarz'} zurückgenommen`);

  // Update tutor hints
  this.updateBestMoves();

  // Update undo/redo buttons
  this.updateUndoRedoButtons();
};

Game.prototype.redoMove = function () {
  if (this.redoStack.length === 0 || this.phase !== PHASES.PLAY) {
    return;
  }

  const move = this.redoStack.pop();

  // Re-execute the move
  this.selectedSquare = move.from;
  this.validMoves = this.getValidMoves(
    move.from.r,
    move.from.c,
    this.board[move.from.r][move.from.c]
  );

  // Execute move (this will push to moveHistory)
  this.executeMove(move.from, move.to);

  // Update undo/redo buttons
  this.updateUndoRedoButtons();
};

Game.prototype.updateUndoRedoButtons = function () {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');

  if (undoBtn) {
    undoBtn.disabled = this.moveHistory.length === 0 || this.phase !== PHASES.PLAY;
    undoBtn.textContent = `⏮ Rückgängig${this.moveHistory.length > 0 ? ` (${this.moveHistory.length})` : ''}`;
  }

  if (redoBtn) {
    redoBtn.disabled = this.redoStack.length === 0 || this.phase !== PHASES.PLAY;
    redoBtn.textContent = `⏭ Wiederholen${this.redoStack.length > 0 ? ` (${this.redoStack.length})` : ''}`;
  }
};

Game.prototype.updateCapturedUI = function () {
  UI.updateCapturedUI(this);
};

// Duplicate animateMove removed/replaced
Game.prototype.animateMove = async function (from, to, piece) {
  await UI.animateMove(this, from, to, piece);
};

Game.prototype.animateCheck = function (color) {
  UI.animateCheck(this, color);
};

Game.prototype.animateCheckmate = function (color) {
  UI.animateCheckmate(this, color);
};

Game.prototype.saveGame = function () {
  const gameState = {
    board: this.board,
    phase: this.phase,
    turn: this.turn,
    points: this.points,
    selectedShopPiece: this.selectedShopPiece,
    whiteCorridor: this.whiteCorridor,
    blackCorridor: this.blackCorridor,
    isAI: this.isAI,
    difficulty: this.difficulty,
    moveHistory: this.moveHistory,
    halfMoveClock: this.halfMoveClock,
    positionHistory: this.positionHistory,
    capturedPieces: this.capturedPieces,
    drawOffered: this.drawOffered,
    drawOfferedBy: this.drawOfferedBy,
  };
  localStorage.setItem('schach9x9_save', JSON.stringify(gameState));
  this.log('Spiel gespeichert! 💾');
  alert('Spiel wurde gespeichert!');
};

Game.prototype.autoSave = function (showNotification = false) {
  try {
    const gameState = {
      board: this.board,
      phase: this.phase,
      turn: this.turn,
      points: this.points,
      selectedShopPiece: this.selectedShopPiece,
      whiteCorridor: this.whiteCorridor,
      blackCorridor: this.blackCorridor,
      isAI: this.isAI,
      difficulty: this.difficulty,
      moveHistory: this.moveHistory,
      halfMoveClock: this.halfMoveClock,
      positionHistory: this.positionHistory,
      capturedPieces: this.capturedPieces,
      whiteTime: this.whiteTime,
      blackTime: this.blackTime,
      clockEnabled: this.clockEnabled,
      timestamp: Date.now(),
      drawOffered: this.drawOffered,
      drawOfferedBy: this.drawOfferedBy,
    };
    localStorage.setItem('schach9x9_save', JSON.stringify(gameState));

    if (showNotification) {
      this.showSaveNotification();
    }
  } catch (e) {
    console.error('Auto-save failed:', e);
  }
};

Game.prototype.showSaveNotification = function () {
  const notification = document.createElement('div');
  notification.className = 'save-notification';
  notification.textContent = '💾 Gespeichert';
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 2000);
};

Game.prototype.loadGame = function () {
  const savedData = localStorage.getItem('schach9x9_save');
  if (!savedData) {
    this.log('Kein gespeichertes Spiel gefunden.');
    alert('Kein gespeichertes Spiel gefunden.');
    return;
  }

  try {
    const state = JSON.parse(savedData);

    // Restore state
    this.board = state.board;
    this.phase = state.phase;
    this.turn = state.turn;
    this.points = state.points;
    this.selectedShopPiece = state.selectedShopPiece;
    this.whiteCorridor = state.whiteCorridor;
    this.blackCorridor = state.blackCorridor;
    this.isAI = state.isAI;
    this.difficulty = state.difficulty;
    this.moveHistory = state.moveHistory;
    this.halfMoveClock = state.halfMoveClock;
    this.positionHistory = state.positionHistory;
    this.capturedPieces = state.capturedPieces || { white: [], black: [] }; // Fallback for older saves

    // Update UI
    document.getElementById('ai-toggle').checked = this.isAI;
    document.getElementById('difficulty-select').value = this.difficulty;

    this.renderBoard();
    this.updateStatus();
    this.updateShopUI();
    this.updateMoveHistoryUI();
    this.updateCapturedUI();
    // Restore draw offer state
    this.drawOffered = state.drawOffered || false;
    this.drawOfferedBy = state.drawOfferedBy || null;
    const drawOverlay = document.getElementById('draw-offer-overlay');
    if (drawOverlay) {
      if (this.drawOffered) {
        const message = document.getElementById('draw-offer-message');
        const offeringColor = this.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
        if (message)
          message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;
        drawOverlay.classList.remove('hidden');
      } else {
        drawOverlay.classList.add('hidden');
      }
    }

    // Show/Hide panels based on phase
    if (this.phase === PHASES.SETUP_WHITE_PIECES || this.phase === PHASES.SETUP_BLACK_PIECES) {
      this.showShop(true);
    } else {
      this.showShop(false);
    }

    if (this.phase === PHASES.PLAY) {
      document.getElementById('move-history-panel').classList.remove('hidden');
      document.getElementById('captured-pieces-panel').classList.remove('hidden');
      this.updateBestMoves();
    }

    this.log('Spiel geladen! 📂');
  } catch (e) {
    console.error('Fehler beim Laden:', e);
    this.log('Fehler beim Laden des Spielstands.');
  }
};

Game.prototype.getMaterialValue = function (piece) {
  const values = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
    a: 7,
  };
  return values[piece.type] || 0;
};

Game.prototype.calculateMaterialAdvantage = function () {
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = this.board[r][c];
      if (piece) {
        const value = this.getMaterialValue(piece);
        if (piece.color === 'white') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }

  return whiteMaterial - blackMaterial;
};

Game.prototype.updateStatistics = function () {
  UI.updateStatistics(this);
};

Game.prototype.enterReplayMode = function () {
  if (this.replayMode || this.moveHistory.length === 0) return;

  // Save current game state
  this.savedGameState = {
    board: JSON.parse(JSON.stringify(this.board)),
    turn: this.turn,
    selectedSquare: this.selectedSquare,
    validMoves: this.validMoves,
    lastMoveHighlight: this.lastMoveHighlight,
  };

  this.replayMode = true;
  this.replayPosition = this.moveHistory.length - 1;
  this.stopClock();

  // Update UI
  document.getElementById('replay-status').classList.remove('hidden');
  document.getElementById('replay-exit').classList.remove('hidden');
  document.getElementById('undo-btn').disabled = true;

  this.updateReplayUI();
};

Game.prototype.exitReplayMode = function () {
  if (!this.replayMode) return;

  // Restore game state
  this.board = this.savedGameState.board;
  this.turn = this.savedGameState.turn;
  this.selectedSquare = this.savedGameState.selectedSquare;
  this.validMoves = this.savedGameState.validMoves;
  this.lastMoveHighlight = this.savedGameState.lastMoveHighlight;

  this.replayMode = false;
  this.replayPosition = -1;
  this.savedGameState = null;

  // Update UI
  document.getElementById('replay-status').classList.add('hidden');
  document.getElementById('replay-exit').classList.add('hidden');
  document.getElementById('undo-btn').disabled =
    this.moveHistory.length === 0 || this.phase !== PHASES.PLAY;

  this.renderBoard();

  // Restart clock if needed
  if (this.clockEnabled && this.phase === PHASES.PLAY) {
    this.startClock();
  }
};

Game.prototype.replayFirst = function () {
  if (!this.replayMode) this.enterReplayMode();
  this.replayPosition = -1;
  this.updateReplayUI();
};

Game.prototype.replayPrevious = function () {
  if (!this.replayMode) this.enterReplayMode();
  if (this.replayPosition > -1) {
    this.replayPosition--;
    this.updateReplayUI();
  }
};

Game.prototype.replayNext = function () {
  if (!this.replayMode) this.enterReplayMode();
  if (this.replayPosition < this.moveHistory.length - 1) {
    this.replayPosition++;
    this.updateReplayUI();
  }
};

Game.prototype.replayLast = function () {
  if (this.replayMode) {
    this.exitReplayMode();
  }
};

Game.prototype.updateReplayUI = function () {
  // Reconstruct board state at replay position
  this.reconstructBoardAtMove(this.replayPosition);

  // Update move number display
  document.getElementById('replay-move-num').textContent = this.replayPosition + 1;

  // Update button states
  document.getElementById('replay-first').disabled = this.replayPosition === -1;
  document.getElementById('replay-prev').disabled = this.replayPosition === -1;
  document.getElementById('replay-next').disabled =
    this.replayPosition === this.moveHistory.length - 1;
  document.getElementById('replay-last').disabled =
    this.replayPosition === this.moveHistory.length - 1;

  this.renderBoard();
};

Game.prototype.reconstructBoardAtMove = function (moveIndex) {
  // Start with empty board
  this.board = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));

  // Place initial pieces (kings and setup pieces)
  // We need to replay all moves up to moveIndex
  // For simplicity, we'll track this through the move history

  // Get initial setup from first few moves (kings + pieces)
  const setupMoves = [];
  for (let i = 0; i < this.moveHistory.length; i++) {
    const move = this.moveHistory[i];
    if (i <= moveIndex) {
      setupMoves.push(move);
    }
  }

  // Actually, we need to store the full board state at each move
  // For now, let's use a simpler approach: replay all moves from the saved state
  if (this.savedGameState) {
    // Start from saved state and replay backwards
    this.board = JSON.parse(JSON.stringify(this.savedGameState.board));

    // Undo moves from current position back to replay position
    for (let i = this.moveHistory.length - 1; i > moveIndex; i--) {
      const move = this.moveHistory[i];
      this.undoMoveForReplay(move);
    }
  }

  // Update last move highlight
  if (moveIndex >= 0) {
    const move = this.moveHistory[moveIndex];
    this.lastMoveHighlight = {
      from: move.from,
      to: move.to,
    };
  } else {
    this.lastMoveHighlight = null;
  }
};

Game.prototype.undoMoveForReplay = function (move) {
  // Simpler undo just for visual replay
  const piece = this.board[move.to.r][move.to.c];
  if (!piece) return;

  this.board[move.from.r][move.from.c] = piece;
  this.board[move.to.r][move.to.c] = move.capturedPiece
    ? { type: move.capturedPiece.type, color: move.capturedPiece.color, hasMoved: true }
    : null;

  piece.hasMoved = move.piece.hasMoved;

  // Handle special moves
  if (move.specialMove) {
    if (move.specialMove.type === 'castling') {
      const rookFrom = move.specialMove.rookFrom;
      const rookTo = move.specialMove.rookTo;
      const rook = this.board[rookTo.r][rookTo.c];
      if (rook) {
        this.board[rookFrom.r][rookFrom.c] = rook;
        this.board[rookTo.r][rookTo.c] = null;
        rook.hasMoved = false;
      }
    } else if (move.specialMove.type === 'enPassant') {
      const capturedPos = move.specialMove.capturedPawnPos;
      this.board[capturedPos.r][capturedPos.c] = {
        type: 'p',
        color: move.specialMove.capturedPawn.color,
        hasMoved: true,
      };
    } else if (move.specialMove.type === 'promotion') {
      // Demote back to pawn
      piece.type = 'p';
    }
  }
};

Game.prototype.setTheme = function (themeName) {
  this.currentTheme = themeName;
  this.applyTheme(themeName);
  localStorage.setItem('chess_theme', themeName);
};

Game.prototype.applyTheme = function (themeName) {
  document.body.setAttribute('data-theme', themeName);
};

// === Resignation and Draw Offer Methods ===

/**
 * Player or AI resigns the game
 */
Game.prototype.resign = function (color) {
  if (this.phase !== PHASES.PLAY) {
    return;
  }

  const resigningColor = color || this.turn;
  const winningColor = resigningColor === 'white' ? 'black' : 'white';

  this.phase = PHASES.GAME_OVER;
  this.renderBoard();
  this.updateStatus();

  const message =
    resigningColor === 'white'
      ? 'Weiß gibt auf! Schwarz gewinnt.'
      : 'Schwarz gibt auf! Weiß gewinnt.';
  this.log(message);

  const overlay = document.getElementById('game-over-overlay');
  const winnerText = document.getElementById('winner-text');
  winnerText.textContent = message;
  overlay.classList.remove('hidden');

  soundManager.playGameOver();
  this.stopClock();
};

/**
 * Offer a draw to the opponent
 */
Game.prototype.offerDraw = function (color) {
  if (this.phase !== PHASES.PLAY) {
    return;
  }

  // Don't allow multiple pending offers
  if (this.drawOffered) {
    this.log('Es gibt bereits ein offenes Remis-Angebot.');
    return;
  }

  this.drawOffered = true;
  this.drawOfferedBy = color || this.turn;

  const offeringColor = this.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
  this.log(`${offeringColor} bietet Remis an.`);

  // If AI is the opponent, let AI evaluate and respond
  if (this.isAI) {
    const aiColor = this.turn === 'white' ? 'black' : 'white';
    if (this.turn !== aiColor) {
      // Player offered draw to AI
      setTimeout(() => {
        this.aiEvaluateDrawOffer();
      }, 1000);
    }
  } else {
    // Show draw offer dialog to human opponent
    this.showDrawOfferDialog();
  }
};

/**
 * Show draw offer dialog to human player
 */
Game.prototype.showDrawOfferDialog = function () {
  const overlay = document.getElementById('draw-offer-overlay');
  const message = document.getElementById('draw-offer-message');

  const offeringColor = this.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
  message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;

  overlay.classList.remove('hidden');
};

/**
 * Accept draw offer
 */
Game.prototype.acceptDraw = function () {
  if (!this.drawOffered) {
    return;
  }

  this.phase = PHASES.GAME_OVER;
  this.drawOffered = false;
  this.drawOfferedBy = null;

  // Hide draw offer dialog
  const overlay = document.getElementById('draw-offer-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  this.renderBoard();
  this.updateStatus();
  this.log('Remis vereinbart!');

  const gameOverOverlay = document.getElementById('game-over-overlay');
  const winnerText = document.getElementById('winner-text');
  winnerText.textContent = 'Remis vereinbart';
  gameOverOverlay.classList.remove('hidden');

  soundManager.playGameOver();
  this.stopClock();
};

/**
 * Decline draw offer
 */
Game.prototype.declineDraw = function () {
  if (!this.drawOffered) {
    return;
  }

  const decliningColor =
    this.turn === this.drawOfferedBy ? (this.turn === 'white' ? 'black' : 'white') : this.turn;
  this.log(`${decliningColor === 'white' ? 'Weiß' : 'Schwarz'} lehnt das Remis-Angebot ab.`);

  this.drawOffered = false;
  this.drawOfferedBy = null;

  // Hide draw offer dialog
  const overlay = document.getElementById('draw-offer-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
};

/**
 * AI evaluates whether to accept a draw offer
 */
Game.prototype.aiEvaluateDrawOffer = function () {
  if (!this.drawOffered) {
    return;
  }

  const aiColor = 'black'; // Assuming AI is always black
  let shouldAccept = false;

  // Evaluate position
  const score = this.evaluatePosition(aiColor);

  // Accept if position is bad for AI (score <= -200 means AI is losing)
  if (score <= -200) {
    shouldAccept = true;
    this.log('KI akzeptiert: Position ist schlecht.');
  }

  // Accept if insufficient material
  if (this.isInsufficientMaterial()) {
    shouldAccept = true;
    this.log('KI akzeptiert: Ungenügendes Material.');
  }

  // Accept if 50-move rule is close
  if (this.halfMoveClock >= 80) {
    shouldAccept = true;
    this.log('KI akzeptiert: 50-Züge-Regel nahe.');
  }

  // Accept if position is roughly equal and many moves have been played
  if (Math.abs(score) < 50 && this.moveHistory.length > 40) {
    shouldAccept = true;
    this.log('KI akzeptiert: Ausgeglichene Position nach vielen Zügen.');
  }

  if (shouldAccept) {
    this.acceptDraw();
  } else {
    this.log('KI lehnt das Remis-Angebot ab.');
    this.declineDraw();
  }
};

/**
 * Check if AI should offer a draw
 */
Game.prototype.aiShouldOfferDraw = function () {
  if (this.drawOffered) {
    return false; // Already an offer pending
  }

  const aiColor = 'black';
  const score = this.evaluatePosition(aiColor);

  // Offer draw if position is bad but not hopeless (-300 to -100)
  if (score >= -300 && score <= -100 && this.moveHistory.length > 20) {
    this.log('KI bietet Remis an (schlechte Position).');
    return true;
  }

  // Offer draw if threefold repetition is imminent
  const currentHash = this.getBoardHash();
  const occurrences = this.positionHistory.filter(h => h === currentHash).length;
  if (occurrences >= 2) {
    this.log('KI bietet Remis an (drohende Stellungswiederholung).');
    return true;
  }

  // Offer draw if position is roughly equal and game is long
  if (Math.abs(score) < 30 && this.moveHistory.length > 50) {
    this.log('KI bietet Remis an (ausgeglichene Position, langes Spiel).');
    return true;
  }

  return false;
};

/**
 * Check if AI should resign
 */
Game.prototype.aiShouldResign = function () {
  const aiColor = 'black';
  const score = this.evaluatePosition(aiColor);

  // Resign if position is hopeless (score <= -1500 means AI is losing badly)
  if (score <= -1500) {
    this.log('KI gibt auf (aussichtslose Position).');
    return true;
  }

  // Resign if we're down massive material (more than 15 points)
  const materialAdvantage = this.calculateMaterialAdvantage();
  // materialAdvantage is white - black, so if it's > 15, white is way ahead
  if (materialAdvantage > 15) {
    this.log('KI gibt auf (massiver Materialverlust).');
    return true;
  }

  return false;
};

// === End Resignation and Draw Offer Methods ===

// Start game - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  logger.info('Starting game initialization...');
  // Initialize game
  window.game = new Game();

  // Load opening book
  fetch('opening-book.json')
    .then(r => r.json())
    .then(book => {
      logger.info('[Main] Opening book loaded:', book.metadata);
      if (window.game.aiWorker) {
        window.game.aiWorker.postMessage({ type: 'loadBook', book });
      }
    })
    .catch(e => {
      console.warn('[Main] Opening book not found, AI will use pure search:', e.message);
    });
  logger.info('Game initialized:', window.game);

  // Initialisiere das Board-UI
  UI.initBoardUI(window.game);

  // Initialize Arrow Renderer for tutor visualization
  const boardContainer = document.querySelector('#board').parentElement;
  window.game.arrowRenderer = new ArrowRenderer(boardContainer);

  // Load and apply saved theme
  const savedTheme = localStorage.getItem('chess_theme') || 'classic';
  window.game.setTheme(savedTheme);

  // Initiales Rendering
  window.game.renderBoard();
  window.game.updateStatus();

  // Check for autosaved game and show restore dialog
  const savedGame = localStorage.getItem('schach9x9_save');
  if (savedGame) {
    try {
      const saveData = JSON.parse(savedGame);
      if (saveData.timestamp) {
        const savedDate = new Date(saveData.timestamp);
        const hoursAgo = Math.floor((Date.now() - saveData.timestamp) / (1000 * 60 * 60));
        const timeAgo =
          hoursAgo < 1
            ? 'vor weniger als 1 Stunde'
            : hoursAgo === 1
              ? 'vor 1 Stunde'
              : `vor ${hoursAgo} Stunden`;

        // Create restore dialog
        const restoreDialog = document.createElement('div');
        restoreDialog.id = 'restore-dialog';
        restoreDialog.className = 'modal-overlay';
        restoreDialog.innerHTML = `
          <div class="modal-content">
            <h2>📂 Gespeichertes Spiel gefunden</h2>
            <p>Möchtest du das Spiel fortsetzen?</p>
            <div class="save-info">
              <p>⏰ Gespeichert: ${timeAgo}</p>
              <p>♟️ Züge gespielt: <strong>${saveData.moveHistory?.length || 0}</strong></p>
              <p>🎯 Spieler: ${saveData.turn === 'white' ? 'Weiß' : 'Schwarz'} am Zug</p>
            </div>
            <div class="modal-buttons">
              <button id="restore-yes" class="btn-primary">✅ Fortsetzen</button>
              <button id="restore-no" class="btn-secondary">🆕 Neues Spiel</button>
            </div>
          </div>
        `;
        document.body.appendChild(restoreDialog);

        document.getElementById('restore-yes').onclick = () => {
          window.game.loadGame();
          restoreDialog.remove();
        };

        document.getElementById('restore-no').onclick = () => {
          localStorage.removeItem('schach9x9_save');
          restoreDialog.remove();
        };
      }
    } catch (e) {
      console.error('Failed to parse saved game:', e);
    }
  }

  // Initialisiere Tastatursteuerung
  document.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') kbRow = (kbRow + BOARD_SIZE - 1) % BOARD_SIZE;
    if (e.key === 'ArrowDown') kbRow = (kbRow + 1) % BOARD_SIZE;
    if (e.key === 'ArrowLeft') kbCol = (kbCol + BOARD_SIZE - 1) % BOARD_SIZE;
    if (e.key === 'ArrowRight') kbCol = (kbCol + 1) % BOARD_SIZE;
    focusCell(kbRow, kbCol);
    if (e.key === 'Enter' || e.key === ' ') {
      const cell = document.querySelector(`.cell[data-r="${kbRow}"][data-c="${kbCol}"]`);
      if (cell) cell.click();
    }
  });
  // Initiales Fokussieren
  focusCell(kbRow, kbCol);

  // Handle window resize for ArrowRenderer
  window.addEventListener(
    'resize',
    debounce(() => {
      if (window.game && window.game.arrowRenderer) {
        window.game.arrowRenderer.redraw();
      }
    }, 150)
  );

  document.getElementById('restart-btn').addEventListener('click', () => {
    location.reload();
  });

  // Help System
  const helpOverlay = document.getElementById('help-overlay');
  document.getElementById('help-btn').addEventListener('click', () => {
    helpOverlay.classList.remove('hidden');
  });
  // Close help overlay
  document.getElementById('close-help-btn').addEventListener('click', () => {
    helpOverlay.classList.add('hidden');
  });

  // Undo button
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY) {
        window.game.undoMove();
      }
    });
  }

  // Redo button
  const redoBtn = document.getElementById('redo-btn');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      if (window.game.redoStack.length > 0 && window.game.phase === PHASES.PLAY) {
        window.game.redoMove();
      }
    });
  }

  // Initialize undo/redo button states
  window.game.updateUndoRedoButtons();

  // Sound Controls
  const soundToggle = document.getElementById('sound-toggle');
  const volumeSlider = document.getElementById('volume-slider');

  // Initialize UI from saved settings
  if (soundToggle) {
    soundToggle.checked = soundManager.enabled;
    soundToggle.addEventListener('change', e => {
      soundManager.setEnabled(e.target.checked);
    });
  }

  if (volumeSlider) {
    volumeSlider.value = Math.round(soundManager.volume * 100);
    volumeSlider.addEventListener(
      'input',
      debounce(e => {
        soundManager.setVolume(parseInt(e.target.value));
      }, 50)
    );
  }

  // Difficulty Select
  const difficultySelect = document.getElementById('difficulty-select');
  if (difficultySelect) {
    // Load saved difficulty
    const savedDifficulty = localStorage.getItem('chess_difficulty') || 'beginner';
    difficultySelect.value = savedDifficulty;
    if (window.game) window.game.difficulty = savedDifficulty;

    difficultySelect.addEventListener('change', e => {
      const newDifficulty = e.target.value;
      if (window.game) window.game.difficulty = newDifficulty;
      localStorage.setItem('chess_difficulty', newDifficulty);
    });
  }

  // Time Control Select
  const timeControlSelect = document.getElementById('time-control-select');
  if (timeControlSelect) {
    // Load saved time control
    const savedTimeControl = localStorage.getItem('chess_time_control') || 'blitz5';
    timeControlSelect.value = savedTimeControl;
    // Apply initial time control if game exists
    if (window.game) window.game.setTimeControl(savedTimeControl);

    timeControlSelect.addEventListener('change', e => {
      const newTimeControl = e.target.value;
      if (window.game) {
        window.game.setTimeControl(newTimeControl);
        // If in setup phase or before start, update clock display immediately
        if (window.game.phase !== PHASES.PLAY) {
          window.game.updateClockDisplay();
        }
      }
      localStorage.setItem('chess_time_control', newTimeControl);
    });
  }

  // Theme Select
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    // Load saved theme
    const savedTheme = localStorage.getItem('chess_theme') || 'classic';
    themeSelect.value = savedTheme;
    window.game.setTheme(savedTheme);

    // Listen for theme changes
    themeSelect.addEventListener('change', e => {
      window.game.setTheme(e.target.value);
    });
  }

  // Undo button
  document.getElementById('undo-btn').addEventListener('click', () => {
    window.game.undoMove();
  });

  // Redo button
  document.getElementById('redo-btn').addEventListener('click', () => {
    window.game.redoMove();
  });

  // Resign button
  document.getElementById('resign-btn').addEventListener('click', () => {
    if (window.game.phase === PHASES.PLAY) {
      const overlay = document.getElementById('confirmation-overlay');
      const message = document.getElementById('confirmation-message');
      message.textContent = 'Möchtest du wirklich aufgeben?';
      overlay.classList.remove('hidden');

      // Set pending action
      window.game.pendingConfirmation = () => {
        const color = window.game.isAI ? 'white' : window.game.turn;
        window.game.resign(color);
      };
    } else {
      alert('Du kannst nur während des Spiels aufgeben.');
    }
  });

  // Confirmation Modal Buttons
  document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    if (window.game.pendingConfirmation) {
      window.game.pendingConfirmation();
      window.game.pendingConfirmation = null;
    }
    document.getElementById('confirmation-overlay').classList.add('hidden');
  });

  document.getElementById('confirm-no-btn').addEventListener('click', () => {
    window.game.pendingConfirmation = null;
    document.getElementById('confirmation-overlay').classList.add('hidden');
  });

  // Draw offer button
  document.getElementById('draw-offer-btn').addEventListener('click', () => {
    if (window.game.phase === PHASES.PLAY) {
      const overlay = document.getElementById('confirmation-overlay');
      const message = document.getElementById('confirmation-message');
      message.textContent = 'Möchtest du Remis anbieten?';
      overlay.classList.remove('hidden');

      // Set pending action
      window.game.pendingConfirmation = () => {
        const color = window.game.isAI ? 'white' : window.game.turn;
        window.game.offerDraw(color);
      };
    } else {
      alert('Du kannst nur während des Spiels Remis anbieten.');
    }
  });

  // Accept draw button
  document.getElementById('accept-draw-btn').addEventListener('click', () => {
    window.game.acceptDraw();
  });

  // Decline draw button
  document.getElementById('decline-draw-btn').addEventListener('click', () => {
    window.game.declineDraw();
  });

  // Hint button
  document.getElementById('hint-btn').addEventListener('click', () => {
    window.game.showTutorSuggestions();
  });

  // Save & Load buttons
  document.getElementById('save-btn').addEventListener('click', () => {
    window.game.saveGame();
  });

  // Shop button event listeners
  const shopButtons = document.querySelectorAll('.shop-btn');
  logger.debug('Found', shopButtons.length, 'shop buttons');

  shopButtons.forEach(btn => {
    const pieceType = btn.dataset.piece;
    logger.debug('Adding listener to shop button:', pieceType);

    btn.addEventListener('click', () => {
      logger.debug('===== SHOP BUTTON CLICKED =====');
      logger.debug('Piece type:', pieceType);
      logger.debug('Current phase:', window.game.phase);
      logger.debug('Points:', window.game.points);
      logger.debug('Button disabled:', btn.disabled);

      window.game.selectShopPiece(pieceType);

      logger.debug('Selected piece:', window.game.selectedShopPiece);
    });
  });

  const finishBtn = document.getElementById('finish-setup-btn');
  if (finishBtn) {
    logger.debug('Finish button found, adding event listener');
    finishBtn.addEventListener('click', () => {
      logger.debug('===== FERTIG BUTTON CLICKED =====');
      logger.debug('Current phase:', window.game.phase);
      logger.debug('Points remaining:', window.game.points);
      logger.debug('Button disabled:', finishBtn.disabled);
      window.game.finishSetupPhase();
    });
  } else {
    console.error('[ERROR] Finish button NOT FOUND in DOM!');
  }

  document.getElementById('load-btn').addEventListener('click', () => {
    window.game.loadGame();
  });

  // Replay controls
  document.getElementById('replay-first').addEventListener('click', () => {
    window.game.replayFirst();
  });

  document.getElementById('replay-prev').addEventListener('click', () => {
    window.game.replayPrevious();
  });

  document.getElementById('replay-next').addEventListener('click', () => {
    window.game.replayNext();
  });

  document.getElementById('replay-last').addEventListener('click', () => {
    window.game.replayLast();
  });

  document.getElementById('replay-exit').addEventListener('click', () => {
    window.game.exitReplayMode();
  });

  // Tastenkürzel (Keyboard Shortcuts)
  document.addEventListener('keydown', e => {
    // Ignoriere Tastenkürzel wenn der Benutzer in einem Input-Feld tippt
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Strg/Cmd + Taste Kombinationen
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        window.game.saveGame();
        break;
      case 'l':
        e.preventDefault();
        window.game.loadGame();
        break;
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          if (window.game.redoStack.length > 0 && window.game.phase === PHASES.PLAY) {
            window.game.redoMove();
          }
        } else {
          // Ctrl+Z = Undo
          if (window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY) {
            window.game.undoMove();
          }
        }
        break;
      case 'y':
        // Ctrl+Y = Redo
        e.preventDefault();
        if (window.game.redoStack.length > 0 && window.game.phase === PHASES.PLAY) {
          window.game.redoMove();
        }
        break;
      }
    }

    // Einzelne Tasten (nur wenn nicht in Replay-Modus)
    if (!window.game.replayMode) {
      switch (e.key.toLowerCase()) {
      case 'h':
        if (window.game.phase === PHASES.PLAY) {
          window.game.showTutorSuggestions();
        }
        break;
      case 'u':
        if (window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY) {
          window.game.undoMove();
        }
        break;
      case 'escape':
      case 'esc':
        // Abwählen der aktuellen Auswahl
        if (window.game.selectedSquare) {
          window.game.selectedSquare = null;
          window.game.validMoves = null;
          window.game.renderBoard();
        }
        // Hilfe schließen
        if (helpOverlay && !helpOverlay.classList.contains('hidden')) {
          helpOverlay.classList.add('hidden');
        }
        break;
      case '?':
        // Hilfe öffnen
        if (helpOverlay) {
          helpOverlay.classList.remove('hidden');
        }
        break;
      }
    }
  });

  // Auto-Save after every move (improved from every 5 moves)
  const originalFinishMove = window.game.finishMove.bind(window.game);
  window.game.finishMove = function () {
    originalFinishMove();
    // Auto-save after every move in PLAY phase
    if (this.phase === PHASES.PLAY && this.moveHistory.length > 0) {
      this.autoSave(true); // true = show notification
    }
  };

  // Initialize Tutorial
  const tutorial = new Tutorial();

  // Help button shows tutorial
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      tutorial.show();
    });
  }

  // Show tutorial automatically on first visit
  if (!localStorage.getItem('schach9x9-tutorial-seen')) {
    setTimeout(() => {
      tutorial.show();
      localStorage.setItem('schach9x9-tutorial-seen', 'true');
    }, 1500);
  }
});
