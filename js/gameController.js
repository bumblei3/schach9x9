import { PHASES /*, BOARD_SIZE*/ } from './gameEngine.js';
import { storageManager } from './storage.js';
// import { SHOP_PIECES, PIECE_VALUES } from './config.js'; // Unused
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
// import { PIECE_SVGS } from './chess-pieces.js'; // Unused
import { logger } from './logger.js';
import { Tutorial } from './tutorial.js';
import { ArrowRenderer } from './arrows.js';
import { StatisticsManager } from './statisticsManager.js';
import { puzzleManager } from './puzzleManager.js';
import { TimeManager } from './TimeManager.js';
import { ShopManager } from './shop/ShopManager.js';

// Piece values for shop
// const PIECES = SHOP_PIECES; // Unused

export class GameController {
  constructor(game) {
    this.game = game;
    this.statisticsManager = new StatisticsManager();
    this.timeManager = new TimeManager(game, this);
    this.shopManager = new ShopManager(game);
    this.gameStartTime = null;
  }

  initGame(initialPoints, mode = 'setup') {
    this.game.points = initialPoints;
    this.game.initialPoints = initialPoints;
    this.game.phase = mode === 'setup' ? PHASES.SETUP_WHITE_KING : PHASES.PLAY;

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
    const _tutorial = new Tutorial();

    // Initialize Arrow Renderer
    const boardContainer = document.querySelector('#board').parentElement;
    if (boardContainer) {
      this.game.arrowRenderer = new ArrowRenderer(boardContainer);
    }

    // Start clock update loop delegated to TimeManager is handled via startClock call below if needed.
    // Actually the logic was inline in initGame previously, but now we use TimeManager.startClock()
    // strictly when game starts or via updates.

    // The previous code had a setInterval for clock UI updates and checking timeout.
    // TimeManager.startClock() does setInterval.
    // But we need to make sure we don't start it if not playing.

    // In 'Classic' mode branch above (lines 36+), we called this.startClock().
    // We should ensure TimeManager handles the interval.

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
    } else if (this.game.phase === PHASES.PLAY || this.game.phase === PHASES.ANALYSIS) {
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
    this.shopManager.selectShopPiece(pieceType);
  }

  placeShopPiece(r, c) {
    this.shopManager.placeShopPiece(r, c);
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

      UI.showModal(
        'Ungewutzte Punkte',
        `Du hast noch ${this.game.points} Punkte übrig! Möchtest du wirklich fortfahren?`,
        [
          { text: 'Abbrechen', class: 'btn-secondary' },
          { text: 'Fortfahren', class: 'btn-primary', callback: handleTransition },
        ]
      );
      return;
    }

    handleTransition();
  }
  setTimeControl(mode) {
    this.timeManager.setTimeControl(mode);
  }

  updateClockVisibility() {
    this.timeManager.updateClockVisibility();
  }

  startClock() {
    this.timeManager.startClock();
  }

  stopClock() {
    this.timeManager.stopClock();
  }

  tickClock() {
    this.timeManager.tickClock();
  }

  updateClockDisplay() {
    this.timeManager.updateClockDisplay();
  }

  updateClockUI() {
    this.timeManager.updateClockUI();
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
    const _winningColor = resigningColor === 'white' ? 'black' : 'white';

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
      this.game.turn === this.game.drawOfferedBy
        ? this.game.turn === 'white'
          ? 'black'
          : 'white'
        : this.game.turn;
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
    UI.updateCapturedUI(this.game);

    // Restore move history panel
    const moveHistoryPanel = document.getElementById('move-history-panel');
    if (moveHistoryPanel) {
      UI.updateMoveHistoryUI(this.game);

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
      this.game.currentPuzzle = puzzle;
      UI.showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);

      // Update 3D board if active
      if (window.battleChess3D && window.battleChess3D.enabled) {
        window.battleChess3D.updateFromGameState(this.game);
      }

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

      if (window.battleChess3D && window.battleChess3D.enabled) {
        window.battleChess3D.updateFromGameState(this.game);
      }
    } else {
      UI.updatePuzzleStatus('success', 'Alle Puzzles gelöst!');
    }
  }

  exitPuzzleMode() {
    this.game.puzzleMode = false;
    UI.hidePuzzleOverlay();
    // Return to main menu or restart
    this.reloadPage();
  }

  reloadPage() {
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
      positionHistory: [...this.game.positionHistory],
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
      this.game.lastMove = this.game.analysisBasePosition.lastMove
        ? { ...this.game.analysisBasePosition.lastMove }
        : null;
      this.game.lastMoveHighlight = this.game.analysisBasePosition.lastMoveHighlight
        ? { ...this.game.analysisBasePosition.lastMoveHighlight }
        : null;
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

    const message = restore
      ? '🔍 Analyse-Modus beendet. Position wiederhergestellt.'
      : '🔍 Analyse-Modus beendet. Aktuelle Position behalten.';
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
        beginner: 'AI-Anfänger',
        easy: 'AI-Einfach',
        medium: 'AI-Mittel',
        hard: 'AI-Schwer',
        expert: 'AI-Experte',
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
      finalPosition: JSON.stringify(this.game.board),
    };

    this.statisticsManager.saveGame(gameData);
    this.gameStartTime = null;
    logger.info('Game saved to statistics:', playerResult, 'vs', opponent);
  }
}
