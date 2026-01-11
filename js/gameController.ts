/**
 * gameController.ts
 *
 * Central controller for managing game flow, state transitions,
 * and coordinating between game engine, shop, UI, and AI.
 */

import { PHASES, AI_DELAY_MS, type Game } from './gameEngine.js';
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
import { campaignManager } from './campaign/CampaignManager.js';
import { parseFEN } from './utils.js';
import { AnalysisUI } from './ui/AnalysisUI.js';
import { PuzzleMenu } from './ui/PuzzleMenu.js';
import { confettiSystem } from './effects.js';
import type { Player } from './types/game.js';
import type { GameMode } from './config.js';

export interface CampaignGoal {
  description: string;
}

export interface CampaignLevel {
  id: string;
  title: string;
  description: string;
  fen: string;
  playerColor: Player;
  goals: Record<number, CampaignGoal>;
}

export interface GameExtended extends Game {
  campaignMode?: boolean;
  currentLevelId?: string;
  playerColor?: Player;
  handlePlayClick?: (r: number, c: number) => Promise<void>;
  aiSetupKing?: () => void;
  aiSetupPieces?: () => void;
  aiEvaluateDrawOffer?: () => void;
  updateBestMoves?: () => void;
  gameStartTime?: number;
  arrowRenderer?: any;
  puzzleMode?: boolean;
  currentPuzzle?: any;
  calculateMaterialAdvantage: (color: Player) => number;
  gameController?: any;
}

export class GameController {
  game: GameExtended;
  statisticsManager: any;
  timeManager: TimeManager;
  shopManager: any;
  analysisController: any;
  analysisUI: any;
  puzzleMenu: any;
  moveExecutor: any;
  gameStartTime: number | null;

  constructor(game: GameExtended) {
    this.game = game;
    this.statisticsManager = new (StatisticsManager as any)();
    this.timeManager = new TimeManager(game, this);
    this.shopManager = new (ShopManager as any)(game, this);
    this.analysisController = new (AnalysisController as any)(this);
    this.analysisUI = new (AnalysisUI as any)(game);
    this.puzzleMenu = new (PuzzleMenu as any)(this);
    this.moveExecutor = null; // Circular dependency resolved later
    this.game.gameController = this as any;
    this.gameStartTime = null;
  }

  startCampaignLevel(levelId: string): void {
    const level = (campaignManager as any).getLevel(levelId) as CampaignLevel;
    if (!level) {
      console.error('Level not found:', levelId);
      return;
    }

    // Reset Game
    this.initGame(0, 'campaign' as any);

    // Load FEN
    const { board, turn } = parseFEN(level.fen);
    this.game.board = board as any;
    this.game.turn = turn; // Usually white
    this.game.campaignMode = true;
    this.game.currentLevelId = levelId;
    this.game.points = 0;

    // Specific Level Settings
    this.game.playerColor = level.playerColor;

    // UI Updates
    UI.updateStatus(this.game);
    UI.renderBoard(this.game);

    logger.info(`Started Campaign Level: ${level.title}`);

    // Build description with goals
    const desc = `
      <div class="campaign-intro">
        <p style="font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.6;">${level.description}</p>
        <div class="campaign-goals-box" style="background: rgba(49, 196, 141, 0.1); border: 1px solid rgba(49, 196, 141, 0.3); border-radius: 8px; padding: 1rem;">
          <h4 style="margin-top: 0; color: var(--accent-success); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🎯</span> Missionsziele
          </h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
            <li style="display: flex; align-items: center; gap: 10px;">
              <span style="color: gold; font-size: 1.2rem;">⭐</span> <span>Level abschließen</span>
            </li>
            ${level.goals[2]
        ? `
            <li style="display: flex; align-items: center; gap: 10px;">
              <span style="color: gold; font-size: 1.2rem;">⭐⭐</span> <span>${level.goals[2].description}</span>
            </li>`
        : ''
      }
            ${level.goals[3]
        ? `
            <li style="display: flex; align-items: center; gap: 10px;">
              <span style="color: gold; font-size: 1.2rem;">⭐⭐⭐</span> <span>${level.goals[3].description}</span>
            </li>`
        : ''
      }
          </ul>
        </div>
      </div>
    `;

    // Show intro modal
    UI.showModal(level.title, desc, [
      { text: 'Mission starten', class: 'btn-primary', callback: () => { } },
    ]);
  }

  initGame(initialPoints: number, mode: GameMode = 'setup'): void {
    this.game.points = initialPoints;
    this.game.initialPoints = initialPoints;
    this.game.phase = (mode === 'setup' ? PHASES.SETUP_WHITE_KING : PHASES.PLAY) as any;

    // Initialize UI
    UI.initBoardUI(this.game);
    UI.updateStatus(this.game);

    if (mode === 'setup') {
      UI.updateShopUI(this.game);
    } else if ((mode as string) === 'puzzle') {
      this.puzzleMenu.show();
      this.game.mode = 'puzzle' as any;
    } else {
      // In classic mode, we start directly in PLAY phase
      this.gameStartTime = Date.now();
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
    new Tutorial();

    // Initialize Arrow Renderer
    const boardEl = document.querySelector('#board');
    const boardContainer = boardEl ? boardEl.parentElement : null;
    if (boardContainer) {
      this.game.arrowRenderer = new ArrowRenderer(boardContainer);
    }

    logger.info('Game initialized with', initialPoints, 'points in mode:', mode);
  }

  async handleCellClick(r: number, c: number): Promise<void> {
    console.log('[GameController] handleCellClick called: row=%d, col=%d, phase=%s', r, c, this.game.phase);

    // Prevent interaction in replay mode
    if (this.game.replayMode) {
      console.log('[GameController] Blocked: replay mode');
      return;
    }
    // Disable clicks if it's AI's turn
    if (
      this.game.isAI &&
      (this.game.phase === (PHASES.SETUP_BLACK_KING as any) ||
        this.game.phase === (PHASES.SETUP_BLACK_PIECES as any) ||
        (this.game.phase === (PHASES.PLAY as any) && this.game.turn === 'black'))
    ) {
      console.log('[GameController] Blocked: AI turn');
      return;
    }

    if (this.game.isAnimating) {
      console.log('[GameController] Blocked: animating');
      return; // Block input during animation
    }

    if (this.game.phase === (PHASES.SETUP_WHITE_KING as any)) {
      console.log('[GameController] Calling placeKing for white');
      this.placeKing(r, c, 'white');
    } else if (this.game.phase === (PHASES.SETUP_BLACK_KING as any)) {
      this.placeKing(r, c, 'black');
    } else if (
      this.game.phase === (PHASES.SETUP_WHITE_PIECES as any) ||
      this.game.phase === (PHASES.SETUP_BLACK_PIECES as any)
    ) {
      this.placeShopPiece(r, c);
    } else if (
      this.game.phase === (PHASES.PLAY as any) ||
      (this.game.phase as any) === 'ANALYSIS'
    ) {
      if (this.game.handlePlayClick) {
        await this.game.handlePlayClick(r, c);
      }
    }

    UI.renderBoard(this.game);
  }

  placeKing(r: number, c: number, color: Player): void {
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

    this.game.board[kingR][kingC] = { type: 'k', color: color, hasMoved: false } as any;

    if (color === 'white') {
      this.game.whiteCorridor = colStart; // In Game class it was number | null
      this.game.phase = PHASES.SETUP_BLACK_KING as any;
      this.game.log('Weißer König platziert. Schwarz ist dran.');
      UI.updateStatus(this.game);

      if (this.game.isAI) {
        setTimeout(() => {
          if (this.game.aiSetupKing) this.game.aiSetupKing();
        }, AI_DELAY_MS);
      }
    } else {
      this.game.blackCorridor = colStart;
      this.game.phase = PHASES.SETUP_WHITE_PIECES as any;
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

  finishSetupPhase(): void {
    const handleTransition = () => {
      if (this.game.phase === (PHASES.SETUP_WHITE_PIECES as any)) {
        this.game.phase = PHASES.SETUP_BLACK_PIECES as any;
        this.game.points = this.game.initialPoints;
        this.game.selectedShopPiece = null;
        this.updateShopUI();
        this.game.log('Weiß fertig. Schwarz kauft ein.');
        this.autoSave();

        if (this.game.isAI) {
          setTimeout(() => {
            if (this.game.aiSetupPieces) this.game.aiSetupPieces();
          }, AI_DELAY_MS);
        }
      } else if (this.game.phase === (PHASES.SETUP_BLACK_PIECES as any)) {
        this.game.phase = PHASES.PLAY as any;
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
      if (this.game.phase === (PHASES.SETUP_BLACK_PIECES as any) && this.game.isAI) {
        handleTransition();
        return;
      }

      UI.showModal(
        'Ungenutzte Punkte',
        `Du hast noch ${this.game.points} Punkte übrig! Möchtest du wirklich fortfahren?`,
        [
          { text: 'Abbrechen', class: 'btn-secondary', callback: () => { } },
          { text: 'Fortfahren', class: 'btn-primary', callback: handleTransition },
        ]
      );
      return;
    }

    handleTransition();
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
    (this.timeManager as any).tickClock();
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

  resign(color?: Player): void {
    if (this.game.phase !== (PHASES.PLAY as any)) {
      return;
    }

    const resigningColor = color || this.game.turn;
    const winningColor = resigningColor === 'white' ? 'black' : 'white';

    this.game.phase = PHASES.GAME_OVER as any;
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
    if (this.game.phase !== (PHASES.PLAY as any)) {
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

    this.game.phase = PHASES.GAME_OVER as any;
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

  saveGame(): void {
    if (storageManager.saveGame(this.game as any)) {
      this.game.log('💾 Spiel erfolgreich gespeichert!');
      soundManager.playMove(); // Feedback sound
    } else {
      this.game.log('❌ Fehler beim Speichern.');
    }
  }

  loadGame(): void {
    let state: any;
    try {
      state = storageManager.loadGame();
      if (!state) {
        this.game.log('⚠️ Kein gespeichertes Spiel gefunden.');
        return;
      }
    } catch (e: any) {
      this.game.log('❌ Fehler beim Laden: ' + e.message);
      return;
    }

    // Stop any running clock before loading
    this.stopClock();

    // Restore state
    if (storageManager.loadStateIntoGame(this.game as any, state)) {
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

      if (this.game.phase === (PHASES.PLAY as any)) {
        moveHistoryPanel.classList.remove('hidden');
      }
    }

    // Restart clock if needed
    if (this.game.phase === (PHASES.PLAY as any) && this.game.clockEnabled) {
      this.startClock();
    }

    // Trigger AI actions if in setup phase
    if (this.game.isAI) {
      if (this.game.phase === (PHASES.SETUP_BLACK_KING as any)) {
        // AI needs to place black king
        setTimeout(() => {
          if (this.game.aiSetupKing) this.game.aiSetupKing();
        }, AI_DELAY_MS);
      } else if (this.game.phase === (PHASES.SETUP_BLACK_PIECES as any)) {
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
    if (this.game.mode !== ('puzzle' as any) && storageManager.saveGame(this.game as any)) {
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
    const puzzle = (puzzleManager as any).loadPuzzle(this.game, index);
    if (puzzle) {
      this.game.currentPuzzle = puzzle;
      (UI as any).showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);

      // Update 3D board if active
      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.updateFromGameState(this.game);
      }

      // Ensure UI controls are appropriate
      this.showShop(false);
      this.puzzleMenu.hide();
    }
  }

  nextPuzzle(): void {
    const puzzle = (puzzleManager as any).nextPuzzle(this.game);
    if (puzzle) {
      (UI as any).showPuzzleOverlay(puzzle);
      UI.renderBoard(this.game);
      UI.updateStatus(this.game);

      if ((window as any).battleChess3D && (window as any).battleChess3D.enabled) {
        (window as any).battleChess3D.updateFromGameState(this.game);
      }
    } else {
      (UI as any).updatePuzzleStatus('success', 'Alle Puzzles gelöst!');
    }
  }

  exitPuzzleMode(): void {
    this.game.puzzleMode = false;
    (UI as any).hidePuzzleOverlay();
    // Return to main menu or restart
    this.reloadPage();
  }

  reloadPage(): void {
    location.reload();
  }

  // ===== ANALYSIS MODE METHODS =====

  enterAnalysisMode(): any {
    return this.analysisController.enterAnalysisMode();
  }

  exitAnalysisMode(restore: boolean = true): any {
    return this.analysisController.exitAnalysisMode(restore);
  }

  requestPositionAnalysis(): void {
    this.analysisController.requestPositionAnalysis();
  }

  toggleContinuousAnalysis(): void {
    this.analysisController.toggleContinuousAnalysis();
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
    const playerColor = 'white';

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
    let playerResult = result;
    if (result === 'loss') {
      playerResult = losingColor === 'white' ? 'loss' : 'win';
    } else if (result === 'win') {
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

  handleGameEnd(result: string, winnerColor: Player): void {
    // Save stats
    let saveColorArg: Player | null = null;

    if (result === 'win') {
      saveColorArg = winnerColor === 'white' ? 'black' : 'white'; // Loser
    } else if (result === 'draw') {
      saveColorArg = null;
    }

    this.saveGameToStatistics(result, saveColorArg);

    // Show analysis prompt after a short delay
    setTimeout(() => {
      if (this.analysisUI) {
        this.analysisUI.showAnalysisPrompt();
      }
    }, 2000);

    if (this.game.campaignMode && result === 'win' && winnerColor === this.game.playerColor) {
      if (this.game.currentLevelId) {
        // Gather stats for star calculation
        const stats = {
          moves: Math.ceil(this.game.stats.totalMoves / 2), // Full moves
          materialDiff: this.game.calculateMaterialAdvantage(this.game.playerColor!),
          promotedCount: this.game.stats.promotions || 0,
        };

        (campaignManager as any).completeLevel(this.game.currentLevelId, stats);
        const level = (campaignManager as any).getLevel(this.game.currentLevelId) as CampaignLevel;

        setTimeout(() => {
          (UI as any).showCampaignVictoryModal(
            level.title,
            3 /* Needs actual star calculation return */,
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
            ]
          );
        }, 1500);
      }
    }
  }
}
