/**
 * gameController.ts
 *
 * Central controller for managing game flow, state transitions,
 * and coordinating between game engine, shop, UI, and AI.
 */

import {
  PHASES,
  AI_DELAY_MS,
  type Game,
  type PuzzleState,
  type PieceWithMoved,
} from './gameEngine.js';
import { storageManager } from './storage.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
import { logger } from './logger.js';
import { Tutorial } from './tutorial.js';
import { ArrowRenderer } from './arrows.js';
import { StatisticsManager } from './statisticsManager.js';
import { puzzleManager } from './puzzleManager.js';
import { TimeManager } from './TimeManager.js';
import { ShopManager } from './shop/ShopManager.js';
import { AnalysisController } from './AnalysisController.js';
import type { AIController } from './aiController.js';
import { campaignManager } from './campaign/CampaignManager.js';
import { AnalysisManager } from './ai/AnalysisManager.js';
import { AnalysisUI } from './ui/AnalysisUI.js';
import { showPostGameStats } from './ui/PostGameAnalysisUI.js';
import { PuzzleMenu } from './ui/PuzzleMenu.js';
import { notificationUI } from './ui/NotificationUI.js';
import { confettiSystem } from './effects.js';
import type { Player } from './types/game.js';
import type { GameMode } from './config.js';
import type { Level } from './campaign/types.js';

import type { GameModeStrategy } from './modes/GameModeStrategy.js';
import { SetupModeStrategy } from './modes/strategies/SetupMode.js';
import { ClassicModeStrategy } from './modes/strategies/ClassicMode.js';
import { StandardModeStrategy } from './modes/strategies/StandardMode.js';
import { CampaignModeStrategy } from './modes/strategies/CampaignMode.js';

/** Type for the arrowRenderer field on Game, matching gameEngine.ts line 173 */
type ArrowRendererType = {
  clearArrows: () => void;
  addArrow?: (...args: unknown[]) => void;
  highlightMoves?: (arrows: { fromR: number; fromC: number; toR: number; toC: number; colorKey: string }[]) => void;
};

export interface GameExtended extends Game {
  campaignMode?: boolean;
  currentLevelId?: string;
  handlePlayClick?: (r: number, c: number) => Promise<void>;
  aiSetupKing?: () => void;
  aiSetupPieces?: () => void;
  aiSetupUpgrades?: () => void;
  aiEvaluateDrawOffer?: () => void;
  updateBestMoves?: () => void;
  gameStartTime?: number;
  arrowRenderer?: ArrowRendererType;
  puzzleMode?: boolean;
  currentPuzzle?: PuzzleState | null;
  calculateMaterialAdvantage?: (color?: Player) => number;
  gameController?: GameController;
  aiController?: AIController;
  moveController?: {
    undoMove: () => void;
    redoMove: () => void;
    reconstructBoardAtMove?: (moveIndex: number) => void;
  };
  startClock?: () => void;
  stopClock?: () => void;
}

export class GameController {
  game: GameExtended;
  statisticsManager: StatisticsManager;
  timeManager: TimeManager;
  shopManager: ShopManager;
  analysisController: AnalysisController;
  analysisUI: AnalysisUI;
  puzzleMenu: PuzzleMenu;
  moveExecutor: unknown;
  gameStartTime: number | null;
  currentModeStrategy: GameModeStrategy | null = null;

  constructor(game: GameExtended) {
    this.game = game;
    this.statisticsManager = new StatisticsManager();
    this.timeManager = new TimeManager(game, this);
    this.shopManager = new ShopManager(game);
    this.analysisController = new AnalysisController(this);
    this.analysisUI = new AnalysisUI({ game });
    this.puzzleMenu = new PuzzleMenu(this);
    this.moveExecutor = null; // Circular dependency resolved later
    this.game.gameController = this;
    this.gameStartTime = null;
  }

  startCampaignLevel(levelId: string): void {
    this.currentModeStrategy = new CampaignModeStrategy();
    (this.currentModeStrategy as CampaignModeStrategy).startLevel(this.game, this, levelId);
  }

  initGame(initialPoints: number, mode: GameMode | 'puzzle' = 'setup'): void {
    // Ensure Main Menu is hidden when starting any game
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.remove('active');

    // Select Strategy
    if (mode === 'setup' || mode === 'upgrade') {
      this.currentModeStrategy = new SetupModeStrategy();
    } else if (mode === 'classic') {
      this.currentModeStrategy = new ClassicModeStrategy();
    } else if (mode === 'standard8x8' || mode === 'upgrade8x8') {
      this.currentModeStrategy = new StandardModeStrategy();
    } else if (mode === 'campaign') {
      this.currentModeStrategy = new CampaignModeStrategy();
    } else if (mode === 'puzzle') {
      // Puzzle mode currently handled slightly differently,
      // but could be a strategy. For now, let's defer if it's not a Strategy yet
      // OR add a basic one.
      // Based on plan, we didn't explicitly make PuzzleStrategy yet but we can stub it or keep legacy logic for puzzle.
      // Actually, let's handle puzzle legacy logic or simple strategy.
      // Re-using legacy logic inside here for simplicity until PuzzleStrategy is prioritized?
      // Wait, the plan said "Missing Coverage: Puzzle Mode", and "New E2E Tests: puzzle.spec.ts".
      // Plan didn't explicitly say Implement PuzzleStrategy, just Classic, Setup, Standard, Campaign.
      this.currentModeStrategy = null; // Puzzle handled ad-hoc or we adhere to legacy for now.
    } else {
      // Fallback
      this.currentModeStrategy = new SetupModeStrategy();
    }

    if (mode === 'upgrade') {
      initialPoints = 25;
    } else if (mode === 'upgrade8x8') {
      initialPoints = 15;
    }

    this.game.points = initialPoints;
    this.game.initialPoints = initialPoints;

    // Initialize basic stuff common to all
    UI.initBoardUI(this.game);
    UI.updateStatus(this.game);

    // Delegate to Strategy
    if (this.currentModeStrategy) {
      this.currentModeStrategy.init(this.game, this, initialPoints);
    } else if (mode === 'puzzle') {
      // Legacy Puzzle initialization
      this.puzzleMenu.show();
      this.game.mode = 'puzzle';
      UI.renderBoard(this.game);
    }

    // Initialize helpers common to all
    soundManager.init();
    new Tutorial();

    const boardEl = document.querySelector('#board');
    const boardContainer = boardEl ? boardEl.parentElement : null;
    if (boardContainer) {
      this.game.arrowRenderer = new ArrowRenderer(boardContainer);
    }

    logger.info('Game initialized with', initialPoints, 'points in mode:', mode);
  }

  async handleCellClick(r: number, c: number): Promise<void> {
    logger
      .context('GameController')
      .debug(
        '[GameController] handleCellClick called: row=%d, col=%d, phase=%s',
        r,
        c,
        this.game.phase
      );

    // Prevent interaction in replay mode
    if (this.game.replayMode) {
      logger.context('GameController').debug('[GameController] Blocked: replay mode');
      return;
    }
    // Disable clicks if it's AI's turn
    if (
      this.game.isAI &&
      (this.game.phase === PHASES.SETUP_BLACK_KING ||
        this.game.phase === PHASES.SETUP_BLACK_PIECES ||
        (this.game.phase === PHASES.PLAY && this.game.turn === 'black'))
    ) {
      logger.context('GameController').debug('[GameController] Blocked: AI turn');
      return;
    }

    if (this.game.isAnimating) {
      logger.context('GameController').debug('[GameController] Blocked: animating');
      return; // Block input during animation
    }

    // Delegate to Strategy
    if (this.currentModeStrategy) {
      const handled = await this.currentModeStrategy.handleInteraction(this.game, this, r, c);
      if (handled) {
        UI.renderBoard(this.game);
        return;
      }
    }

    // Fallback or Global Interactions (like Play Phase default if strategy didn't handle it detailedly)
    if (this.game.phase === PHASES.PLAY || this.game.phase === PHASES.ANALYSIS) {
      if (this.game.handlePlayClick) {
        await this.game.handlePlayClick(r, c);
      }
    }

    UI.renderBoard(this.game);
  }

  // Helper methods made public for Strategies
  placeKing(r: number, c: number, color: Player): void {
    // White at bottom (6), Black at top (0)
    const validRowStart = color === 'white' ? 6 : 0;

    if (r < validRowStart || r >= validRowStart + 3) {
      this.game.log('Ungültiger Bereich für König!');
      return;
    }

    // Remove existing king of this color
    for (let row = 0; row < this.game.boardSize; row++) {
      for (let col = 0; col < this.game.boardSize; col++) {
        const p = this.game.board[row][col];
        if (p && p.type === 'k' && p.color === color) {
          this.game.board[row][col] = null;
        }
      }
    }

    const colBlock = Math.floor(c / 3);
    const colStart = colBlock * 3;

    const kingR = validRowStart + 1;
    const kingC = colStart + 1;

    this.game.board[kingR][kingC] = { type: 'k', color: color, hasMoved: false } as PieceWithMoved;

    if (color === 'white') {
      this.game.whiteCorridor = colStart;

      if (this.game.campaignMode) {
        // In Campaign, Black (AI) setup is usually predefined in FEN.
        // Skip AI King placement and go straight to player piece buying.
        this.game.phase = PHASES.SETUP_WHITE_PIECES;
        this.game.points = this.game.initialPoints;
        this.game.log('König platziert. Bitte stell deine Truppen auf.');
        this.showShop(true);
      } else {
        this.game.phase = PHASES.SETUP_BLACK_KING;
        this.game.log('Weißer König platziert. Schwarz ist dran.');
        UI.updateStatus(this.game);

        if (this.game.isAI) {
          setTimeout(() => {
            if (this.game.aiSetupKing) {
              this.game.aiSetupKing();
            }
          }, AI_DELAY_MS);
        }
      }
    } else {
      this.game.blackCorridor = colStart;
      this.game.phase = PHASES.SETUP_WHITE_PIECES;
      this.game.points = this.game.initialPoints;
      UI.updateStatus(this.game);
      this.showShop(true);
      this.game.log('Weiß kauft ein.');
    }
    UI.updateStatus(this.game);
  }

  selectShopPiece(pieceType: string): void {
    this.shopManager.selectShopPiece(pieceType);
  }

  placeShopPiece(r: number, c: number): void {
    this.shopManager.placeShopPiece(r, c);
  }

  upgradePiece(r: number, c: number): void {
    const piece = this.game.board[r][c];
    if (!piece) return;

    const isWhiteTurn = this.game.phase === PHASES.SETUP_WHITE_UPGRADES;
    const color = isWhiteTurn ? 'white' : 'black';

    if (piece.color !== color) {
      this.game.log('Nur eigene Figuren können verbessert werden!');
      return;
    }

    // Call ShopManager to handle the upgrade logic/UI
    this.shopManager.showUpgradeOptions(r, c);
  }

  finishSetupPhase(): void {
    if (this.currentModeStrategy) {
      this.currentModeStrategy.onPhaseEnd(this.game, this);
    } else {
      logger.warn('finishSetupPhase called with no active strategy');
    }
  }

  setTimeControl(mode: string): void {
    this.timeManager.setTimeControl(mode);
  }

  updateClockVisibility(): void {
    this.timeManager.updateClockVisibility();
  }

  startClock(): void {
    this.timeManager.startClock();
  }

  stopClock(): void {
    this.timeManager.stopClock();
  }

  tickClock(): void {
    this.timeManager.tickClock();
  }

  updateClockDisplay(): void {
    this.timeManager.updateClockDisplay();
  }

  updateClockUI(): void {
    this.timeManager.updateClockUI();
  }

  showShop(show: boolean): void {
    UI.showShop(this.game, show);
  }

  updateShopUI(): void {
    UI.updateShopUI(this.game);
  }

  undoMove(): void {
    if (this.game.moveController?.undoMove) {
      this.game.moveController.undoMove();
    }
  }

  redoMove(): void {
    if (this.game.moveController?.redoMove) {
      this.game.moveController.redoMove();
    }
  }

  resign(color?: Player): void {
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
    if (winnerText) winnerText.textContent = message;
    if (overlay) overlay.classList.remove('hidden');

    soundManager.playGameOver(false); // Play defeat sound for resigner
    this.stopClock();

    // Trigger confetti if the winner is the human player
    if (winningColor === this.game.playerColor) {
      confettiSystem.spawn();
    }

    // Call central game end handler
    this.handleGameEnd('win', winningColor);
  }

  offerDraw(color?: Player): void {
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
        }, AI_DELAY_MS);
      }
    } else {
      // Show draw offer dialog to human opponent
      this.showDrawOfferDialog();
    }
  }

  showDrawOfferDialog(): void {
    const overlay = document.getElementById('draw-offer-overlay');
    const message = document.getElementById('draw-offer-message');

    const offeringColor = this.game.drawOfferedBy === 'white' ? 'Weiß' : 'Schwarz';
    if (message) message.textContent = `${offeringColor} bietet Remis an. Möchtest du annehmen?`;

    if (overlay) overlay.classList.remove('hidden');
  }

  acceptDraw(): void {
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
    if (winnerText) winnerText.textContent = 'Remis vereinbart';
    if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');

    // Save game to statistics
    this.saveGameToStatistics('draw', null);
  }

  declineDraw(): void {
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

  saveGame(_fromAutoSave?: boolean): void {
    if (storageManager.saveGame(this.game as unknown as import('./storage.js').GameLike)) {
      this.game.log('💾 Spiel erfolgreich gespeichert!');
      soundManager.playMove(); // Feedback sound
    } else {
      this.game.log('❌ Fehler beim Speichern.');
    }
  }

  loadGame(): void {
    let state: import('./storage.js').SavedGameState | null;
    try {
      state = storageManager.loadGame();
      if (!state) {
        this.game.log('⚠️ Kein gespeichertes Spiel gefunden.');
        return;
      }
    } catch (e: unknown) {
      this.game.log('❌ Fehler beim Laden: ' + (e instanceof Error ? e.message : String(e)));
      return;
    }

    // Stop any running clock before loading
    this.stopClock();

    // Restore state
    if (
      storageManager.loadStateIntoGame(
        this.game as unknown as import('./storage.js').GameLike,
        state
      )
    ) {
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

    // Restore move history display
    UI.updateMoveHistoryUI(this.game);

    // Sync UI elements (Difficulty, AI Toggle, Panels)
    const aiToggle = document.getElementById('ai-toggle') as HTMLInputElement;
    if (aiToggle) aiToggle.checked = this.game.isAI;

    const diffSelects = document.querySelectorAll<HTMLSelectElement>('#difficulty-select');
    diffSelects.forEach(select => {
      select.value = this.game.difficulty;
    });

    // Ensure panels are visible in PLAY phase
    if (this.game.phase === PHASES.PLAY) {
      const historyPanel = document.getElementById('move-history-panel');
      const capturedPanel = document.getElementById('captured-pieces-panel');
      if (historyPanel) historyPanel.classList.remove('hidden');
      if (capturedPanel) capturedPanel.classList.remove('hidden');
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
        }, AI_DELAY_MS);
      } else if (this.game.phase === PHASES.SETUP_BLACK_PIECES) {
        // AI needs to place black pieces
        setTimeout(() => {
          if (this.game.aiSetupPieces) this.game.aiSetupPieces();
        }, AI_DELAY_MS);
      }
    }

    this.game.log('📂 Spiel erfolgreich geladen!');
    soundManager.playGameStart(); // Feedback sound
  }

  autoSave(): void {
    if (
      this.game.mode !== 'puzzle' &&
      storageManager.saveGame(this.game as unknown as import('./storage.js').GameLike)
    ) {
      logger.debug('Auto-saved game');
    }
  }

  startPuzzleMode(index?: number): void {
    if (index === undefined) {
      this.puzzleMenu.show();
      return;
    }
    this.loadPuzzle(index);
  }

  loadPuzzle(index: number): void {
    const puzzle = puzzleManager.loadPuzzle(this.game, index);
    if (puzzle) {
      this.game.currentPuzzle = puzzle as unknown as PuzzleState;
      UI.showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);

      // Update 3D board if active
      if (window.battleChess3D && window.battleChess3D.enabled) {
        window.battleChess3D.updateFromGameState(this.game);
      }

      // Ensure UI controls are appropriate
      this.showShop(false);
      this.puzzleMenu.hide();
    }
  }

  nextPuzzle(): void {
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

  exitPuzzleMode(): void {
    this.game.puzzleMode = false;
    UI.hidePuzzleOverlay();
    // Return to main menu or restart
    this.reloadPage();
  }

  reloadPage(): void {
    location.reload();
  }

  startTutorial(): void {
    new Tutorial();
  }

  // ===== ANALYSIS MODE METHODS =====

  enterAnalysisMode(): boolean {
    return this.analysisController.enterAnalysisMode();
  }

  exitAnalysisMode(restore: boolean = true): boolean {
    return this.analysisController.exitAnalysisMode(restore);
  }

  requestPositionAnalysis(): void {
    this.analysisController.requestPositionAnalysis();
  }

  toggleContinuousAnalysis(): void {
    this.analysisController.toggleContinuousAnalysis();
  }

  async requestHint(): Promise<void> {
    const isPlayerTurn = this.game.turn === this.game.playerColor;
    // Allow hints if:
    // 1. It is the player's turn (vs AI)
    // 2. It is Hotseat mode (!game.isAI) - anyone can ask
    // 3. Debug/Analysis mode (implied if logic reaches here for AI turn)

    if (this.game.phase !== PHASES.PLAY) {
      notificationUI.show('Tipps sind nur während des Spiels verfügbar.', 'warning');
      return;
    }

    if (this.game.isAI && !isPlayerTurn) {
      notificationUI.show('Tipps sind nur verfügbar, wenn du am Zug bist.', 'info');
      return;
    }

    // 1. Prioritize TutorController (New System with Overlay)
    if (this.game.tutorController) {
      notificationUI.show('Der Tutor analysiert die Stellung...', 'info');
      // Use the showHint method which forces calculation if needed
      await this.game.tutorController?.showHint?.();
      return;
    }

    // 2. Fallback to active AI Controller (Legacy/Hotseat)
    if (!this.game.isAI && !this.game.aiController) {
      notificationUI.show('Tipps sind in diesem Modus nicht verfügbar.', 'warning');
      return;
    }

    notificationUI.show('Der Tutor analysiert die Stellung...', 'info');

    // We assume game.aiController is available as fallback
    if (this.game.aiController) {
      if (typeof this.game.aiController.getHint === 'function') {
        // Use lower depth for hints to be fast
        const result = await this.game.aiController.getHint(4);

        if (result) {
          const { move, explanation } = result;
          const from = move.from;
          const to = move.to;

          // Visualize hint
          if (this.game.arrowRenderer) {
            this.game.arrowRenderer.clearArrows();
            this.game.arrowRenderer.addArrow?.(
              { r: from.r, c: from.c },
              { r: to.r, c: to.c },
              '#facc15' // Yellow/Gold for hint
            );
          }

          notificationUI.show(`Tipp: ${explanation}`, 'success', 'Tutor', 5000);
        } else {
          notificationUI.show('Der Tutor konnte keinen klaren Rat finden.', 'info');
        }
      }
    }
  }

  /**
   * Jumps to a specific move in the game history (for analysis).
   */
  jumpToMove(moveIndex: number): void {
    this.analysisController.jumpToMove(moveIndex);
  }

  jumpToStart(): void {
    this.analysisController.jumpToStart();
  }

  /**
   * Saves completed game to statistics
   */
  saveGameToStatistics(result: string, losingColor: Player | null = null): void {
    if (!this.gameStartTime) {
      logger.warn('Game start time not set, skipping statistics save');
      return;
    }

    // Determine player color (assuming player is always white when playing against AI)
    const playerColor: Player = 'white';

    // Determine opponent
    let opponent = 'Human';
    if (this.game.isAI) {
      const difficultyMap: Record<string, string> = {
        beginner: 'AI-Anfänger',
        easy: 'AI-Einfach',
        medium: 'AI-Mittel',
        hard: 'AI-Schwer',
        expert: 'AI-Experte',
      };
      opponent = difficultyMap[this.game.difficulty] || 'AI';
    }

    // Determine actual result from player's perspective
    let playerResult: 'win' | 'draw' | 'loss' = result as 'win' | 'draw' | 'loss';
    if (result === 'loss') {
      playerResult = losingColor === 'white' ? 'loss' : 'win';
    } else if (result === 'win') {
      playerResult = losingColor === 'black' ? 'win' : 'loss';
    }

    const gameData = {
      result: playerResult,
      playerColor: playerColor,
      opponent: opponent,
      moveHistory: (this.game.moveHistory || []) as unknown as import('./types/game.js').Move[],
      duration: Date.now() - this.gameStartTime,
      finalPosition: JSON.stringify(this.game.board),
    };

    this.statisticsManager.saveGame(gameData);
    this.gameStartTime = null;
    logger.info('Game saved to statistics:', playerResult, 'vs', opponent);
  }

  handleGameEnd(result: 'win' | 'draw', winnerColor: Player | null): void {
    // Save stats
    let saveColorArg: Player | null = null;

    if (result === 'win' && winnerColor) {
      saveColorArg = winnerColor === 'white' ? 'black' : 'white'; // Loser
    } else if (result === 'draw') {
      saveColorArg = null;
    }

    this.saveGameToStatistics(result, saveColorArg);

    // Show post-game stats and analysis button (unless in campaign mode)
    if (!this.game.campaignMode) {
      showPostGameStats(this.game, result, winnerColor);
    }

    // Show analysis prompt after a short delay (only if not campaign win)
    /* 
    setTimeout(() => {
      // Only show analysis if NOT in campaign mode (or at least not winning campaign step)
      // Actually, disable for campaign entirely for now to avoid modal conflict
      if (this.analysisUI && !this.game.campaignMode) {
        this.analysisUI.showAnalysisPrompt();
      }
    }, 2000);
    */

    logger.context('GameController').debug('[GameController] handleGameEnd check:', {
      campaignMode: this.game.campaignMode,
      result,
      winnerColor,
      playerColor: this.game.playerColor,
      levelId: this.game.currentLevelId,
    });

    const level = this.game.currentLevelId
      ? campaignManager.getLevel(this.game.currentLevelId)
      : null;
    const isCheckmateWin = result === 'win' && winnerColor === this.game.playerColor;
    const isDrawVictory =
      result === 'draw' && level && level.winCondition && level.winCondition.drawCountsAsWin;

    if (this.game.campaignMode && (isCheckmateWin || isDrawVictory)) {
      logger.context('GameController').info('[GameController] Triggering Campaign Victory');
      if (this.game.currentLevelId) {
        // Gather stats for star calculation
        const stats = {
          moves: Math.ceil(this.game.stats.totalMoves / 2), // Full moves
          materialDiff: this.game.calculateMaterialAdvantage
            ? this.game.calculateMaterialAdvantage(this.game.playerColor!)
            : 0,
          promotedCount: this.game.stats.promotions || 0,
        };

        const levelBefore = level as Level;
        const rewardsBefore = campaignManager.getUnlockedRewards();

        const starsEarned = campaignManager.completeLevel(this.game.currentLevelId, stats);

        const rewardsAfter = campaignManager.getUnlockedRewards();
        const newRewards = rewardsAfter.filter((r: string) => !rewardsBefore.includes(r));

        // Feedback: Level Complete Toast
        notificationUI.show(`Level "${levelBefore.title}" abgeschlossen!`, 'success');

        // Feedback: Reward Unlocked Toasts
        newRewards.forEach((rewardId: string) => {
          notificationUI.show(
            `Belohnung freigeschaltet: ${rewardId.toUpperCase()}!`,
            'success',
            'Neue Belohnung'
          );
        });

        setTimeout(async () => {
          // Perform Analysis
          const analysisManager = new AnalysisManager(this.game);
          const summary = await analysisManager.runPostGameAnalysis();
          const advice = analysisManager.getMentorAdvice(summary);

          UI.showCampaignVictoryModal(
            levelBefore.title,
            starsEarned,
            [
              {
                text: 'Nächste Mission',
                class: 'btn-primary',
                callback: () => {
                  window.location.reload();
                },
              },
              {
                text: 'Hauptmenü',
                class: 'btn-secondary',
                callback: () => {
                  window.location.reload();
                },
              },
            ],
            { accuracy: summary.whiteAccuracy, advice: advice }
          );
        }, 1500);
      }
    }
  }
  checkCampaignObjectives(): void {
    if (!this.game.campaignMode || !this.game.currentLevelId) return;

    const level = campaignManager.getLevel(this.game.currentLevelId) as Level;
    if (!level) return;

    // Check custom win conditions
    if (level.winCondition.type === 'capture_target') {
      // Check if the target piece at the specified position has been captured
      const target = level.targetPiece;
      if (target) {
        const pieceAtTarget = this.game.board[target.r]?.[target.c];
        if (!pieceAtTarget) {
          // Target piece was captured - player wins
          this.handleGameEnd('win', this.game.playerColor!);
        }
      }
    } else if (level.winCondition.type === 'survival') {
      // Check if player has survived for the required number of moves
      const requiredMoves = level.winCondition.requiredMoves || 0;
      const playerMoves = Math.ceil(this.game.stats.totalMoves / 2);
      if (playerMoves >= requiredMoves && this.game.turn === this.game.playerColor) {
        // Player survived long enough - check if they still have their king
        const playerKing = this.game.board
          .flat()
          .find(
            (p): p is PieceWithMoved =>
              p !== null &&
              p.type === 'k' &&
              p.hasMoved === true &&
              p.color === this.game.playerColor
          );
        if (playerKing) {
          this.handleGameEnd('win', this.game.playerColor!);
        }
      }
    }
  }
}
