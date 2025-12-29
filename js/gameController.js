import { PHASES, BOARD_SIZE } from './gameEngine.js';
import { storageManager } from './storage.js';
import { SHOP_PIECES, PIECE_VALUES } from './config.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import { PIECE_SVGS } from './chess-pieces.js';
import { logger } from './logger.js';
import { Tutorial } from './tutorial.js';
import { ArrowRenderer } from './arrows.js';
import { StatisticsManager } from './statisticsManager.js';
import { puzzleManager } from './puzzleManager.js';

// Piece values for shop
const PIECES = SHOP_PIECES;

export class GameController {
  constructor(game) {
    this.game = game;
    this.clockInterval = null;
    this.statisticsManager = new StatisticsManager();
    this.gameStartTime = null;
  }

  initGame(initialPoints, mode = 'setup') {
    // Initialize UI
    UI.initBoardUI(this.game);
    UI.updateStatus(this.game);

    if (mode === 'setup') {
      UI.updateShopUI(this.game);
    } else {
      // In classic mode, we start directly in PLAY phase
      this.game.gameStartTime = Date.now();
      this.startClock();

      // Show game controls immediately
      const infoTabsContainer = document.getElementById('info-tabs-container');
      if (infoTabsContainer) infoTabsContainer.classList.remove('hidden');

      const quickActions = document.getElementById('quick-actions');
      if (quickActions) quickActions.classList.remove('hidden');
    }

    UI.updateStatistics(this.game);
    UI.updateClockUI(this.game);
    UI.updateClockDisplay(this.game);

    // Render board to show corridor highlighting
    UI.renderBoard(this.game);

    // Initialize Sound Manager
    soundManager.init();

    // Initialize Tutorial
    const tutorial = new Tutorial();

    // Initialize Arrow Renderer
    const boardContainer = document.querySelector('#board').parentElement;
    if (boardContainer) {
      this.game.arrowRenderer = new ArrowRenderer(boardContainer);
    }

    // Start clock update loop
    if (this.game.clockInterval) clearInterval(this.game.clockInterval);
    this.game.clockInterval = setInterval(() => {
      if (this.game.phase === PHASES.PLAY && !this.game.replayMode && this.game.clockEnabled) {
        const now = Date.now();
        const delta = (now - this.game.lastMoveTime) / 1000;
        this.game.lastMoveTime = now;

        if (this.game.turn === 'white') {
          this.game.whiteTime = Math.max(0, this.game.whiteTime - delta);
          if (this.game.whiteTime <= 0) {
            this.game.phase = PHASES.GAME_OVER;
            this.game.log('Zeit abgelaufen! Schwarz gewinnt.');
            UI.updateStatus(this.game);
            soundManager.playGameOver(false);
          }
        } else {
          this.game.blackTime = Math.max(0, this.game.blackTime - delta);
          if (this.game.blackTime <= 0) {
            this.game.phase = PHASES.GAME_OVER;
            this.game.log('Zeit abgelaufen! Weiß gewinnt.');
            UI.updateStatus(this.game);
            soundManager.playGameOver(false);
          }
        }
        UI.updateClockDisplay(this.game);
        UI.updateClockUI(this.game);
      }
    }, 100);

    logger.info('Game initialized with', initialPoints, 'points in mode:', mode);
  }

  handleCellClick(r, c) {
    // Prevent interaction in replay mode
    if (this.game.replayMode) {
      return;
    }
    // Disable clicks if it's AI's turn
    if (
      this.game.isAI &&
            (this.game.phase === PHASES.SETUP_BLACK_KING ||
                this.game.phase === PHASES.SETUP_BLACK_PIECES ||
                (this.game.phase === PHASES.PLAY && this.game.turn === 'black'))
    ) {
      return;
    }

    if (this.game.isAnimating) return; // Block input during animation

    if (this.game.phase === PHASES.SETUP_WHITE_KING) {
      this.placeKing(r, c, 'white');
    } else if (this.game.phase === PHASES.SETUP_BLACK_KING) {
      this.placeKing(r, c, 'black');
    } else if (
      this.game.phase === PHASES.SETUP_WHITE_PIECES ||
            this.game.phase === PHASES.SETUP_BLACK_PIECES
    ) {
      this.placeShopPiece(r, c);
    } else if (this.game.phase === PHASES.PLAY) {
      if (this.game.handlePlayClick) {
        this.game.handlePlayClick(r, c);
      }
    }

    console.time('Rendering');
    UI.renderBoard(this.game);
    console.timeEnd('Rendering');
  }

  placeKing(r, c, color) {
    // White at bottom (6), Black at top (0)
    const validRowStart = color === 'white' ? 6 : 0;

    if (r < validRowStart || r >= validRowStart + 3) {
      this.game.log('Ungültiger Bereich für König!');
      return;
    }

    const colBlock = Math.floor(c / 3);
    const colStart = colBlock * 3;

    const kingR = validRowStart + 1;
    const kingC = colStart + 1;

    this.game.board[kingR][kingC] = { type: 'k', color: color, hasMoved: false };

    if (color === 'white') {
      this.game.whiteCorridor = { rowStart: validRowStart, colStart: colStart };
      this.game.phase = PHASES.SETUP_BLACK_KING;
      this.game.log('Weißer König platziert. Schwarz ist dran.');
      UI.updateStatus(this.game);

      if (this.game.isAI) {
        setTimeout(() => {
          if (this.game.aiSetupKing) this.game.aiSetupKing();
        }, 1000);
      }
    } else {
      this.game.blackCorridor = { rowStart: validRowStart, colStart: colStart };
      this.game.phase = PHASES.SETUP_WHITE_PIECES;
      this.game.points = this.game.initialPoints;
      UI.updateStatus(this.game);
      this.showShop(true);
      this.game.log('Weiß kauft ein.');
    }
    UI.updateStatus(this.game);
  }

  selectShopPiece(pieceType) {
    if (!pieceType) return;
    const cost = PIECE_VALUES[pieceType];
    if (cost > this.game.points) {
      this.game.log('Nicht genug Punkte!');
      return;
    }

    this.game.selectedShopPiece = pieceType;

    // Update UI
    document.querySelectorAll('.shop-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.shop-btn[data-piece="${pieceType}"]`);
    if (btn) btn.classList.add('selected');

    const displayEl = document.getElementById('selected-piece-display');
    // Find the piece info from SHOP_PIECES by matching the symbol
    const pieceInfo = Object.values(PIECES).find(p => p.symbol === pieceType);
    const svg = PIECE_SVGS['white'][pieceType];
    displayEl.innerHTML = `Ausgewählt: <div style="display:inline-block;width:30px;height:30px;vertical-align:middle;">${svg}</div> ${pieceInfo ? pieceInfo.name : pieceType} (${cost})`;
  }

  placeShopPiece(r, c) {
    if (!this.game.selectedShopPiece) {
      const piece = this.game.board[r][c];
      const isWhiteTurn = this.game.phase === PHASES.SETUP_WHITE_PIECES;
      const color = isWhiteTurn ? 'white' : 'black';

      if (piece && piece.color === color && piece.type !== 'k') {
        const cost =
                    PIECES[Object.keys(PIECES).find(k => PIECES[k].symbol === piece.type)].points;
        this.game.points += cost;
        this.game.board[r][c] = null;
        this.updateShopUI();
        this.game.log('Figur entfernt, Punkte erstattet.');

        // Update 3D board if active
        if (window.battleChess3D && window.battleChess3D.enabled) {
          window.battleChess3D.removePiece(r, c);
        }
      } else {
        this.game.log('Bitte zuerst eine Figur im Shop auswählen!');
      }
      return;
    }

    const isWhiteTurn = this.game.phase === PHASES.SETUP_WHITE_PIECES;
    const color = isWhiteTurn ? 'white' : 'black';
    const corridor = isWhiteTurn ? this.game.whiteCorridor : this.game.blackCorridor;

    if (
      r < corridor.rowStart ||
            r >= corridor.rowStart + 3 ||
            c < corridor.colStart ||
            c >= corridor.colStart + 3
    ) {
      this.game.log('Muss im eigenen Korridor platziert werden!');
      return;
    }

    if (this.game.board[r][c]) {
      this.game.log('Feld besetzt!');
      return;
    }

    const cost = PIECE_VALUES[this.game.selectedShopPiece];
    if (this.game.points >= cost) {
      const pieceType = this.game.selectedShopPiece; // Store before clearing

      this.game.board[r][c] = {
        type: pieceType,
        color: color,
        hasMoved: false,
      };
      this.game.points -= cost;

      // Clear selection after placing the piece
      this.game.selectedShopPiece = null;

      // Deselect all shop buttons
      document.querySelectorAll('.shop-item').forEach(btn => btn.classList.remove('selected'));

      this.updateShopUI();

      // Update 3D board if active
      if (window.battleChess3D && window.battleChess3D.enabled) {
        window.battleChess3D.addPiece(pieceType, color, r, c);
      }
    }
  }

  finishSetupPhase() {
    const handleTransition = () => {
      if (this.game.phase === PHASES.SETUP_WHITE_PIECES) {
        this.game.phase = PHASES.SETUP_BLACK_PIECES;
        this.game.points = this.game.initialPoints;
        this.game.selectedShopPiece = null;
        this.updateShopUI();
        this.game.log('Weiß fertig. Schwarz kauft ein.');
        this.autoSave();

        if (this.game.isAI) {
          setTimeout(() => {
            if (this.game.aiSetupPieces) this.game.aiSetupPieces();
          }, 1000);
        }
      } else if (this.game.phase === PHASES.SETUP_BLACK_PIECES) {
        this.game.phase = PHASES.PLAY;
        this.showShop(false);

        // Track game start time for statistics
        this.gameStartTime = Date.now();

        document.querySelectorAll('.cell.selectable-corridor').forEach(cell => {
          cell.classList.remove('selectable-corridor');
        });
        logger.debug('Removed all corridor highlighting for PLAY phase');

        // Ensure Action Bar is visible
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) actionBar.classList.remove('hidden');

        this.game.log('Spiel beginnt! Weiß ist am Zug.');
        if (this.game.updateBestMoves) this.game.updateBestMoves();
        this.startClock();
        UI.updateStatistics(this.game);
        soundManager.playGameStart();
        this.autoSave();
      }
      UI.updateStatus(this.game);
      UI.renderBoard(this.game);
    };

    // Check for unspent points
    if (this.game.points > 0) {
      // Don't warn AI
      if (this.game.phase === PHASES.SETUP_BLACK_PIECES && this.game.isAI) {
        handleTransition();
        return;
      }

      UI.showModal('Ungewutzte Punkte', `Du hast noch ${this.game.points} Punkte übrig! Möchtest du wirklich fortfahren?`, [
        { text: 'Abbrechen', class: 'btn-secondary' },
        { text: 'Fortfahren', class: 'btn-primary', callback: handleTransition }
      ]);
      return;
    }

    handleTransition();
  }
  setTimeControl(mode) {
    const controls = {
      blitz3: { base: 180, increment: 2 },
      blitz5: { base: 300, increment: 3 },
      rapid10: { base: 600, increment: 0 },
      rapid15: { base: 900, increment: 10 },
      classical30: { base: 1800, increment: 0 },
    };
    this.game.timeControl = controls[mode] || controls['blitz5'];
    this.game.whiteTime = this.game.timeControl.base;
    this.game.blackTime = this.game.timeControl.base;
    this.updateClockDisplay();
  }

  updateClockVisibility() {
    const clockEl = document.getElementById('chess-clock');
    if (clockEl) {
      if (this.game.clockEnabled) {
        clockEl.classList.remove('hidden');
      } else {
        clockEl.classList.add('hidden');
      }
    }
  }

  startClock() {
    if (!this.game.clockEnabled || this.game.phase !== PHASES.PLAY) return;

    this.stopClock();
    this.game.lastMoveTime = Date.now();
    this.clockInterval = setInterval(() => this.tickClock(), 100);
    this.updateClockUI();
  }

  stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  tickClock() {
    if (this.game.phase !== PHASES.PLAY) {
      this.stopClock();
      return;
    }

    const now = Date.now();
    const elapsed = (now - this.game.lastMoveTime) / 1000;
    this.game.lastMoveTime = now;

    if (this.game.turn === 'white') {
      this.game.whiteTime = Math.max(0, this.game.whiteTime - elapsed);
    } else {
      this.game.blackTime = Math.max(0, this.game.blackTime - elapsed);
    }

    this.updateClockDisplay();

    if (this.game.whiteTime <= 0) {
      this.stopClock();
      this.game.phase = PHASES.GAME_OVER;
      this.game.log('Weiß hat keine Zeit mehr! Schwarz gewinnt durch Zeitüberschreitung.');
      const overlay = document.getElementById('game-over-overlay');
      const winnerText = document.getElementById('winner-text');
      winnerText.textContent = 'Schwarz gewinnt durch Zeitüberschreitung!';
      overlay.classList.remove('hidden');

      // Save to statistics
      this.saveGameToStatistics('loss', 'white');
    } else if (this.game.blackTime <= 0) {
      this.stopClock();
      this.game.phase = PHASES.GAME_OVER;
      this.game.log('Schwarz hat keine Zeit mehr! Weiß gewinnt durch Zeitüberschreitung.');
      const overlay = document.getElementById('game-over-overlay');
      const winnerText = document.getElementById('winner-text');
      winnerText.textContent = 'Weiß gewinnt durch Zeitüberschreitung!';
      overlay.classList.remove('hidden');

      // Save to statistics
      this.saveGameToStatistics('win', 'black');
    }
  }

  updateClockDisplay() {
    UI.updateClockDisplay(this.game);
  }

  updateClockUI() {
    UI.updateClockUI(this.game);
  }

  showShop(show) {
    UI.showShop(this.game, show);
  }

  updateShopUI() {
    UI.updateShopUI(this.game);
  }

  resign(color) {
    if (this.game.phase !== PHASES.PLAY) {
      return;
    }

    const resigningColor = color || this.game.turn;
    const winningColor = resigningColor === 'white' ? 'black' : 'white';

    this.game.phase = PHASES.GAME_OVER;
    UI.renderBoard(this.game);
    UI.updateStatus(this.game);

    const message =
            resigningColor === 'white'
              ? 'Weiß gibt auf! Schwarz gewinnt.'
              : 'Schwarz gibt auf! Weiß gewinnt.';
    this.game.log(message);

    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = message;
    overlay.classList.remove('hidden');

    soundManager.playGameOver();
    this.stopClock();

    // Save game to statistics
    this.saveGameToStatistics('loss', resigningColor);
  }

  offerDraw(color) {
    if (this.game.phase !== PHASES.PLAY) {
      return;
    }

    // Don't allow multiple pending offers
    if (this.game.drawOffered) {
      this.game.log('Es gibt bereits ein offenes Remis-Angebot.');
      return;
    }

    this.game.drawOffered = true;
    this.game.drawOfferedBy = color || this.game.turn;

    const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
    this.game.log(`${offeringColor} bietet Remis an.`);

    // If AI is the opponent, let AI evaluate and respond
    if (this.game.isAI) {
      const aiColor = this.game.turn === 'white' ? 'black' : 'white';
      if (this.game.turn !== aiColor) {
        // Player offered draw to AI
        setTimeout(() => {
          if (this.game.aiEvaluateDrawOffer) this.game.aiEvaluateDrawOffer();
        }, 1000);
      }
    } else {
      // Show draw offer dialog to human opponent
      this.showDrawOfferDialog();
    }
  }

  showDrawOfferDialog() {
    const overlay = document.getElementById('draw-offer-overlay');
    const message = document.getElementById('draw-offer-message');

    const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
    message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;

    overlay.classList.remove('hidden');
  }

  acceptDraw() {
    if (!this.game.drawOffered) {
      return;
    }

    this.game.phase = PHASES.GAME_OVER;
    this.game.drawOffered = false;
    this.game.drawOfferedBy = null;

    // Hide draw offer dialog
    const overlay = document.getElementById('draw-offer-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }

    UI.renderBoard(this.game);
    UI.updateStatus(this.game);
    this.game.log('Remis vereinbart!');

    const gameOverOverlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    winnerText.textContent = 'Remis vereinbart';
    gameOverOverlay.classList.remove('hidden');

    // Save game to statistics
    this.saveGameToStatistics('draw', null);
  }

  declineDraw() {
    if (!this.game.drawOffered) {
      return;
    }

    const decliningColor =
            this.game.turn === this.game.drawOfferedBy ? (this.game.turn === 'white' ? 'black' : 'white') : this.game.turn;
    this.game.log(`${decliningColor === 'white' ? 'Weiß' : 'Schwarz'} lehnt das Remis-Angebot ab.`);

    this.game.drawOffered = false;
    this.game.drawOfferedBy = null;

    // Hide draw offer dialog
    const overlay = document.getElementById('draw-offer-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  saveGame() {
    if (storageManager.saveGame(this.game)) {
      this.game.log('💾 Spiel erfolgreich gespeichert!');
      soundManager.playMove(); // Feedback sound
    } else {
      this.game.log('❌ Fehler beim Speichern.');
    }
  }

  loadGame() {
    let state;
    try {
      state = storageManager.loadGame();
      if (!state) {
        this.game.log('⚠️ Kein gespeichertes Spiel gefunden.');
        return;
      }
    } catch (e) {
      this.game.log('❌ Fehler beim Laden: ' + e.message);
      return;
    }

    // Stop any running clock before loading
    this.stopClock();

    // Restore state
    if (storageManager.loadStateIntoGame(this.game, state)) {
      this.game.log('📂 Spielstand geladen.');
    } else {
      this.game.log('❌ Fehler beim Laden des Spielstands.');
      return;
    }

    // Re-initialize UI components
    UI.renderBoard(this.game);
    UI.updateStatus(this.game);
    UI.updateShopUI(this.game);
    UI.updateStatistics(this.game);
    UI.updateClockUI(this.game);
    UI.updateClockDisplay(this.game);

    // Restore captured pieces display
    // We need to clear and re-add them
    const whiteCaptured = document.getElementById('captured-white');
    const blackCaptured = document.getElementById('captured-black');
    if (whiteCaptured) whiteCaptured.innerHTML = '';
    if (blackCaptured) blackCaptured.innerHTML = '';

    // Re-populate captured pieces
    if (this.game.capturedPieces) {
      if (this.game.capturedPieces.white) {
        this.game.capturedPieces.white.forEach(piece => {
          UI.addCapturedPiece(piece);
        });
      }
      if (this.game.capturedPieces.black) {
        this.game.capturedPieces.black.forEach(piece => {
          UI.addCapturedPiece(piece);
        });
      }
    }

    // Restore move history panel
    const moveHistoryPanel = document.getElementById('move-history-panel');
    if (moveHistoryPanel) {
      // Clear existing history
      const historyList = document.getElementById('move-history');
      if (historyList) historyList.innerHTML = '';

      // Re-populate history
      if (this.game.history) {
        this.game.history.forEach((move, index) => {
          UI.addMoveToHistory(move, index + 1);
        });
        // Scroll to bottom
        if (historyList) historyList.scrollTop = historyList.scrollHeight;
      }

      if (this.game.phase === PHASES.PLAY) {
        moveHistoryPanel.classList.remove('hidden');
      }
    }

    // Restart clock if needed
    if (this.game.phase === PHASES.PLAY && this.game.clockEnabled) {
      this.startClock();
    }

    // Trigger AI actions if in setup phase
    if (this.game.isAI) {
      if (this.game.phase === PHASES.SETUP_BLACK_KING) {
        // AI needs to place black king
        setTimeout(() => {
          if (this.game.aiSetupKing) this.game.aiSetupKing();
        }, 1000);
      } else if (this.game.phase === PHASES.SETUP_BLACK_PIECES) {
        // AI needs to place black pieces
        setTimeout(() => {
          if (this.game.aiSetupPieces) this.game.aiSetupPieces();
        }, 1000);
      }
    }

    this.game.log('📂 Spiel erfolgreich geladen!');
    soundManager.playGameStart(); // Feedback sound

  }

  autoSave() {
    if (this.game.mode !== 'puzzle' && storageManager.saveGame(this.game)) {
      // Silently success or debug log
      logger.debug('Auto-saved game');
    }
  }

  startPuzzleMode() {
    const puzzle = puzzleManager.loadPuzzle(this.game);
    if (puzzle) {
      UI.showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);
      // Ensure UI controls are appropriate
      this.showShop(false);
    }
  }

  nextPuzzle() {
    const puzzle = puzzleManager.nextPuzzle(this.game);
    if (puzzle) {
      UI.showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);
    } else {
      UI.updatePuzzleStatus('success', 'Alle Puzzles gelöst!');
    }
  }

  exitPuzzleMode() {
    UI.hidePuzzleOverlay();
    // Return to main menu or restart
    location.reload();
  }


  // ===== ANALYSIS MODE METHODS =====

  enterAnalysisMode() {
    // Can only analyze during play phase
    if (this.game.phase !== PHASES.PLAY) {
      this.game.log('⚠️ Analyse-Modus nur während des Spiels verfügbar.');
      return false;
    }

    // Save current game state
    this.game.analysisBasePosition = {
      board: JSON.parse(JSON.stringify(this.game.board)),
      turn: this.game.turn,
      moveHistory: [...this.game.moveHistory],
      redoStack: [...this.game.redoStack],
      lastMove: this.game.lastMove ? { ...this.game.lastMove } : null,
      lastMoveHighlight: this.game.lastMoveHighlight ? { ...this.game.lastMoveHighlight } : null,
      selectedSquare: this.game.selectedSquare,
      validMoves: this.game.validMoves,
      halfMoveClock: this.game.halfMoveClock,
      positionHistory: [...this.game.positionHistory]
    };

    // Enter analysis mode
    this.game.analysisMode = true;
    this.game.phase = PHASES.ANALYSIS;

    // Stop clock
    this.stopClock();

    // Clear selection
    this.game.selectedSquare = null;
    this.game.validMoves = null;

    // Show analysis panel
    const analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) {
      analysisPanel.classList.remove('hidden');
    }

    UI.updateStatus(this.game);
    UI.renderBoard(this.game);
    UI.renderEvalGraph(this.game);

    this.game.log('🔍 Analyse-Modus aktiviert. Züge lösen keine KI-Reaktion aus.');

    // Start continuous analysis if enabled
    if (this.game.continuousAnalysis && this.game.aiController) {
      this.requestPositionAnalysis();
    }

    return true;
  }

  exitAnalysisMode(restore = true) {
    if (!this.game.analysisMode) {
      return false;
    }

    if (restore && this.game.analysisBasePosition) {
      // Restore saved position
      this.game.board = JSON.parse(JSON.stringify(this.game.analysisBasePosition.board));
      this.game.turn = this.game.analysisBasePosition.turn;
      this.game.moveHistory = [...this.game.analysisBasePosition.moveHistory];
      this.game.redoStack = [...this.game.analysisBasePosition.redoStack];
      this.game.lastMove = this.game.analysisBasePosition.lastMove ? { ...this.game.analysisBasePosition.lastMove } : null;
      this.game.lastMoveHighlight = this.game.analysisBasePosition.lastMoveHighlight ? { ...this.game.analysisBasePosition.lastMoveHighlight } : null;
      this.game.selectedSquare = this.game.analysisBasePosition.selectedSquare;
      this.game.validMoves = this.game.analysisBasePosition.validMoves;
      this.game.halfMoveClock = this.game.analysisBasePosition.halfMoveClock;
      this.game.positionHistory = [...this.game.analysisBasePosition.positionHistory];
    }

    // Exit analysis mode
    this.game.analysisMode = false;
    this.game.phase = PHASES.PLAY;
    this.game.analysisBasePosition = null;
    this.game.analysisVariations = [];

    // Hide analysis panel
    const analysisPanel = document.getElementById('analysis-panel');
    if (analysisPanel) {
      analysisPanel.classList.add('hidden');
    }

    // Restart clock if enabled
    if (this.game.clockEnabled) {
      this.startClock();
    }

    UI.updateStatus(this.game);
    UI.renderBoard(this.game);
    UI.renderEvalGraph(this.game);

    const message = restore ? '🔍 Analyse-Modus beendet. Position wiederhergestellt.' : '🔍 Analyse-Modus beendet. Aktuelle Position behalten.';
    this.game.log(message);

    return true;
  }

  requestPositionAnalysis() {
    // Request analysis from AI controller
    if (!this.game.aiController || !this.game.aiController.analyzePosition) {
      return;
    }

    this.game.aiController.analyzePosition();
  }

  toggleContinuousAnalysis() {
    this.game.continuousAnalysis = !this.game.continuousAnalysis;

    if (this.game.continuousAnalysis && this.game.analysisMode) {
      this.requestPositionAnalysis();
      this.game.log('🔄 Kontinuierliche Analyse aktiviert.');
    } else {
      this.game.log('⏸️ Kontinuierliche Analyse deaktiviert.');
    }
  }

  /**
     * Jumps to a specific move in the game history (for analysis).
     * @param {number} moveIndex - Index of the move in moveHistory
     */
  jumpToMove(moveIndex) {
    if (!this.game.moveController || !this.game.moveController.reconstructBoardAtMove) {
      return;
    }

    this.game.moveController.reconstructBoardAtMove(moveIndex);
    this.game.replayPosition = moveIndex;

    UI.renderBoard(this.game);
    UI.updateStatus(this.game);

    if (this.game.continuousAnalysis) {
      this.requestPositionAnalysis();
    }
  }

  /**
     * Jumps to the initial game position (for analysis).
     */
  jumpToStart() {
    if (!this.game.moveController || !this.game.moveController.reconstructBoardAtMove) {
      return;
    }

    this.game.moveController.reconstructBoardAtMove(0);
    this.game.replayPosition = -1;

    UI.renderBoard(this.game);
    UI.updateStatus(this.game);
  }

  /**
     * Saves completed game to statistics
     * @param {string} result - 'win', 'loss', or 'draw'
     * @param {string} losingColor - Color that lost (only for win/loss)
     */
  saveGameToStatistics(result, losingColor = null) {
    if (!this.gameStartTime) {
      logger.warn('Game start time not set, skipping statistics save');
      return;
    }

    // Determine player color (assuming player is always white when playing against AI)
    const playerColor = 'white';

    // Determine opponent
    let opponent = 'Human';
    if (this.game.isAI) {
      const difficultyMap = {
        'beginner': 'AI-Anfänger',
        'easy': 'AI-Einfach',
        'medium': 'AI-Mittel',
        'hard': 'AI-Schwer',
        'expert': 'AI-Experte'
      };
      opponent = difficultyMap[this.game.difficulty] || 'AI';
    }

    // Determine actual result from player's perspective
    let playerResult = result;
    if (result === 'loss') {
      // If player lost (white resigned or got mated)
      playerResult = losingColor === 'white' ? 'loss' : 'win';
    } else if (result === 'win') {
      // If someone won
      playerResult = losingColor === 'black' ? 'win' : 'loss';
    }

    const gameData = {
      result: playerResult,
      playerColor: playerColor,
      opponent: opponent,
      moveHistory: this.game.moveHistory || [],
      duration: Date.now() - this.gameStartTime,
      finalPosition: JSON.stringify(this.game.board)
    };

    this.statisticsManager.saveGame(gameData);
    this.gameStartTime = null;
    logger.info('Game saved to statistics:', playerResult, 'vs', opponent);
  }
}

