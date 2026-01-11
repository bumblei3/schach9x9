/**
 * App.ts
 * Main application class handling lifecycle and initialization.
 */
import { Game } from './gameEngine.js';
import { GameController } from './gameController.js';
import { logger } from './logger.js';
import * as UI from './ui.js';
import { EvaluationBar } from './ui/EvaluationBar.js';
import { DOMHandler } from './ui/DOMHandler.js';
import { errorManager } from './utils/ErrorManager.js';
import type { Player, Square, Piece } from './types/game.js';

// Types for non-converted modules
// @ts-ignore
import { MoveController } from './moveController.js';
// @ts-ignore
import { AIController } from './aiController.js';
// @ts-ignore
import { TutorController } from './tutorController.js';
// @ts-ignore
import { BattleChess3D } from './battleChess3D.js';
// @ts-ignore
import { KeyboardManager } from './input/KeyboardManager.js';
// @ts-ignore
import { AnalysisManager } from './AnalysisManager.js';
// @ts-ignore
import { UIEffects } from './ui/ui_effects.js';

export class App {
  public game: any = null; // Use any for now to facilitate delegation logic
  public gameController: any = null;
  public moveController: any = null;
  public aiController: any = null;
  public tutorController: any = null;
  public analysisManager: any = null;
  public evaluationBar: EvaluationBar | null = null;
  public uiEffects: any = null;
  public keyboardManager: any = null;
  public battleChess3D: any = null;
  public domHandler: DOMHandler;

  constructor() {
    errorManager.init();
    this.domHandler = new DOMHandler(this);
  }

  public async startCampaignLevel(levelId: string): Promise<void> {
    if (!this.game) {
      await this.init(0, 'campaign');
    }
    this.gameController.startCampaignLevel(levelId);
  }

  public async init(initialPoints: number, mode: string = 'setup'): Promise<void> {
    logger.info('App initializing with', initialPoints, 'points in mode:', mode);

    this.game = new Game(initialPoints, mode as any);
    (window as any).game = this.game; // Expose for debugging and legacy UI calls

    // Initialize controllers
    this.game.gameController = new GameController(this.game);
    this.game.moveController = new MoveController(this.game);
    this.game.aiController = new AIController(this.game);

    // Make controllers accessible to each other (circular dependencies)
    this.aiController = this.game.aiController;
    this.gameController = this.game.gameController;
    this.moveController = this.game.moveController;

    this.aiController.game = this.game;
    this.gameController.game = this.game;
    this.moveController.game = this.game;

    this.tutorController = new TutorController(this.game);
    this.game.tutorController = this.tutorController;

    this.analysisManager = new AnalysisManager(this.game);
    this.game.analysisManager = this.analysisManager;

    this.evaluationBar = new EvaluationBar('board-container');
    this.uiEffects = new UIEffects();
    this.uiEffects.startFloatingPieces();
    this.game.evaluationBar = this.evaluationBar;

    // Input handlers
    this.keyboardManager = new KeyboardManager(this);

    // Expose global recovery function for console access
    (window as any).recoverGame = () => {
      if (this.keyboardManager && this.keyboardManager.performEmergencyRecovery) {
        this.keyboardManager.performEmergencyRecovery();
        console.log(
          '✅ Game recovery performed. If game is still frozen, try refreshing the page.'
        );
      } else {
        console.error('❌ Recovery function not available');
      }
    };
    console.log('💡 TIP: If game freezes, type recoverGame() in console or press Ctrl+Shift+F12');

    // Initialize DOM Handler (Menu handlers, etc.)
    this.domHandler.init();

    // Apply delegates (monkey-patching Game prototype for legacy support)
    this.applyDelegates();

    // Initialize GameController logic
    this.game.gameController.initGame(initialPoints, mode);

    // Initialize 3D Battle Chess mode
    this.init3D();

    // Initialize Service Worker
    this.registerServiceWorker();

    // UI Adjustments for Game Modes
    const toggle3DBtn = document.getElementById('toggle-3d-btn');
    const shopPanel = document.getElementById('shop-panel');

    // Toggle setup-mode class for CSS styling
    if (mode === 'setup') {
      document.body.classList.add('setup-mode');
    } else {
      document.body.classList.remove('setup-mode');
    }

    if (mode === 'standard8x8') {
      // 3D mode now supported for 8x8 too by dynamic sizing
      // Ensure Shop is hidden
      if (shopPanel) shopPanel.classList.add('hidden');
    } else {
      if (toggle3DBtn) toggle3DBtn.style.display = 'flex';
    }

    logger.info('App initialization complete');
  }

  public initDOM(): void {
    this.domHandler.initDOM();
  }

  public init3D(): void {
    const container3D = document.getElementById('battle-chess-3d-container');
    if (container3D && !this.battleChess3D) {
      this.battleChess3D = new BattleChess3D(container3D);
      (window as any).battleChess3D = this.battleChess3D;

      // Hook into Game methods for 3D updates if not handled by event listeners
      // Note: 3D updates are currently handled in GameController/MoveController directly
      // via window.battleChess3D checks.

      // Listen for 3D board clicks
      window.addEventListener('board3dclick', (e: any) => {
        if (this.game && this.gameController) {
          this.gameController.handleCellClick(e.detail.row, e.detail.col);
        }
      });
    }
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./service-worker.js')
          .then(registration => {
            logger.info('ServiceWorker registration successful:', registration.scope);
          })
          .catch(err => {
            logger.error('ServiceWorker registration failed:', err);
          });
      });
    }
  }

  private applyDelegates(): void {
    const self = this;
    const GP = Game.prototype as any;

    // GameController delegations
    GP.placeKing = function (r: number, c: number, color: Player) {
      return self.gameController.placeKing(r, c, color);
    };
    GP.selectShopPiece = function (type: string) {
      return self.gameController.selectShopPiece(type);
    };
    GP.placeShopPiece = function (r: number, c: number) {
      return self.gameController.placeShopPiece(r, c);
    };
    GP.finishSetupPhase = function () {
      return self.gameController.finishSetupPhase();
    };
    GP.setTimeControl = function (mode: string) {
      return self.gameController.setTimeControl(mode);
    };
    GP.updateClockVisibility = function () {
      return self.gameController.updateClockVisibility();
    };
    GP.startClock = function () {
      return self.gameController.startClock();
    };
    GP.stopClock = function () {
      return self.gameController.stopClock();
    };
    GP.tickClock = function () {
      return self.gameController.tickClock();
    };
    GP.updateClockDisplay = function () {
      return self.gameController.updateClockDisplay();
    };
    GP.updateClockUI = function () {
      return self.gameController.updateClockUI();
    };
    GP.showShop = function (show: boolean) {
      return self.gameController.showShop(show);
    };
    GP.updateShopUI = function () {
      return self.gameController.updateShopUI();
    };
    GP.handleCellClick = function (r: number, c: number) {
      return self.gameController.handleCellClick(r, c);
    };
    GP.resign = function (color: Player) {
      return self.gameController.resign(color);
    };
    GP.offerDraw = function (color: Player) {
      return self.gameController.offerDraw(color);
    };
    GP.acceptDraw = function () {
      return self.gameController.acceptDraw();
    };
    GP.declineDraw = function () {
      return self.gameController.declineDraw();
    };
    GP.showDrawOfferDialog = function () {
      return self.gameController.showDrawOfferDialog();
    };

    // MoveController delegations
    GP.handlePlayClick = function (r: number, c: number) {
      return self.moveController.handlePlayClick(r, c);
    };
    GP.executeMove = function (from: Square, to: Square) {
      return self.moveController.executeMove(from, to);
    };
    GP.showPromotionUI = function (r: number, c: number, color: Player, record: any) {
      return self.moveController.showPromotionUI(r, c, color, record);
    };
    GP.animateMove = function (from: Square, to: Square, piece: Piece) {
      return self.moveController.animateMove(from, to, piece);
    };
    GP.finishMove = function () {
      return self.moveController.finishMove();
    };
    GP.undoMove = function () {
      return self.moveController.undoMove();
    };
    GP.redoMove = function () {
      return self.moveController.redoMove();
    };
    GP.checkDraw = function () {
      return self.moveController.checkDraw();
    };
    GP.isInsufficientMaterial = function () {
      return self.moveController.isInsufficientMaterial();
    };
    GP.getBoardHash = function () {
      return self.moveController.getBoardHash();
    };
    GP.saveGame = function () {
      return self.gameController.saveGame();
    };
    GP.loadGame = function () {
      return self.gameController.loadGame();
    };
    GP.autoSave = function (show: boolean) {
      if (self.moveController.autoSave) return self.moveController.autoSave(show);
    };

    GP.updateMoveHistoryUI = function () {
      UI.updateMoveHistoryUI(this);
    };
    GP.updateUndoRedoButtons = function () {
      return self.moveController.updateUndoRedoButtons();
    };
    GP.updateCapturedUI = function () {
      UI.updateCapturedUI(this);
    };
    GP.animateCheck = function (color: Player) {
      UI.animateCheck(this, color);
    };
    GP.animateCheckmate = function (color: Player) {
      UI.animateCheckmate(this, color);
    };
    GP.calculateMaterialAdvantage = function () {
      return self.moveController.calculateMaterialAdvantage();
    };
    GP.getMaterialValue = function (piece: Piece) {
      return self.moveController.getMaterialValue(piece);
    };
    GP.updateStatistics = function () {
      UI.updateStatistics(this);
    };

    // Replay methods
    GP.enterReplayMode = function () {
      return self.moveController.enterReplayMode();
    };
    GP.exitReplayMode = function () {
      return self.moveController.exitReplayMode();
    };
    GP.replayFirst = function () {
      return self.moveController.replayFirst();
    };
    GP.replayPrevious = function () {
      return self.moveController.replayPrevious();
    };
    GP.replayNext = function () {
      return self.moveController.replayNext();
    };
    GP.replayLast = function () {
      return self.moveController.replayLast();
    };
    GP.updateReplayUI = function () {
      return self.moveController.updateReplayUI();
    };
    GP.reconstructBoardAtMove = function (idx: number) {
      return self.moveController.reconstructBoardAtMove(idx);
    };
    GP.undoMoveForReplay = function (move: any) {
      return self.moveController.undoMoveForReplay(move);
    };
    GP.setTheme = function (theme: string) {
      return self.moveController.setTheme(theme);
    };
    GP.applyTheme = function (theme: string) {
      return self.moveController.applyTheme(theme);
    };

    // AI delegations
    GP.aiSetupKing = function () {
      return self.aiController.aiSetupKing();
    };
    GP.aiSetupPieces = function () {
      return self.aiController.aiSetupPieces();
    };
    GP.aiMove = function () {
      return self.aiController.aiMove();
    };
    GP.evaluatePosition = function (color: Player) {
      return self.aiController.evaluatePosition(color);
    };
    GP.updateAIProgress = function (data: any) {
      return self.aiController.updateAIProgress(data);
    };
    GP.aiEvaluateDrawOffer = function () {
      return self.aiController.aiEvaluateDrawOffer();
    };
    GP.aiShouldOfferDraw = function () {
      return self.aiController.aiShouldOfferDraw();
    };
    GP.aiShouldResign = function () {
      return self.aiController.aiShouldResign();
    };

    // Tutor delegations
    GP.updateBestMoves = function () {
      return self.tutorController.updateBestMoves();
    };
    GP.isTutorMove = function (from: Square, to: Square) {
      return self.tutorController.isTutorMove(from, to);
    };
    GP.getTutorHints = function () {
      return self.tutorController.getTutorHints();
    };
    GP.getMoveNotation = function (move: any) {
      return self.tutorController.getMoveNotation(move);
    };
    GP.showTutorSuggestions = function () {
      return self.tutorController.showTutorSuggestions();
    };
    GP.getPieceName = function (type: string) {
      return self.tutorController.getPieceName(type);
    };
    GP.getThreatenedPieces = function (pos: Square, color: Player) {
      return self.tutorController.getThreatenedPieces(pos, color);
    };
    GP.detectTacticalPatterns = function (move: any) {
      return self.tutorController.detectTacticalPatterns(move);
    };
    GP.getDefendedPieces = function (pos: Square, color: Player) {
      return self.tutorController.getDefendedPieces(pos, color);
    };
    GP.analyzeStrategicValue = function (move: any) {
      return self.tutorController.analyzeStrategicValue(move);
    };
    GP.getScoreDescription = function (score: number) {
      return self.tutorController.getScoreDescription(score);
    };
    GP.analyzeMoveWithExplanation = function (move: any, score: number, best: any) {
      return self.tutorController.analyzeMoveWithExplanation(move, score, best);
    };

    // AnalysisManager delegations
    GP.toggleThreats = function () {
      return self.analysisManager.toggleThreats();
    };
    GP.toggleOpportunities = function () {
      return self.analysisManager.toggleOpportunities();
    };
    GP.toggleBestMove = function () {
      return self.analysisManager.toggleBestMove();
    };
  }
}
