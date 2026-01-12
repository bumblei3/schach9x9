/**
 * App.ts
 * Main application class handling lifecycle and initialization.
 */
import { logger } from './logger.js';
import { DOMHandler } from './ui/DOMHandler.js';
import { errorManager } from './utils/ErrorManager.js';
import type { EvaluationBar } from './ui/EvaluationBar.js';
import type { Player, Square, Piece } from './types/game.js';

// Global variable for UI since it's used in many places but we want to avoid static import
let UI_MODULE: any = null;

export class App {
  public game: any = null;
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
  public battleChess3D_Class: any = null;
  public Game_Class: any = null;

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

    // Toggle setup-mode class for CSS styling immediately to unblock E2E tests
    if (mode === 'setup') {
      document.body.classList.add('setup-mode');
    } else {
      document.body.classList.remove('setup-mode');
    }

    // Dynamic Imports to avoid circular dependencies during module evaluation
    const { Game } = await import('./gameEngine.js');
    const { GameController } = await import('./gameController.js');
    const { MoveController } = await import('./moveController.js');
    const { AIController } = await import('./aiController.js');
    const { TutorController } = await import('./tutorController.js');
    const { AnalysisManager } = await import('./AnalysisManager.js');
    const { EvaluationBar } = await import('./ui/EvaluationBar.js');
    const { UIEffects } = await import('./ui/ui_effects.js');
    const { KeyboardManager } = await import('./input/KeyboardManager.js');
    const BC3D_MODULE = await import('./battleChess3D.js');
    UI_MODULE = await import('./ui.js');

    this.Game_Class = Game;
    this.game = new Game(initialPoints, mode as any);
    (window as any).game = this.game;

    // Initialize controllers
    this.game.gameController = new GameController(this.game);
    this.game.moveController = new MoveController(this.game);
    this.game.aiController = new AIController(this.game);

    this.battleChess3D_Class = BC3D_MODULE.BattleChess3D;

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

    if (!this.evaluationBar) {
      this.evaluationBar = new EvaluationBar('board-container');
    }
    this.game.evaluationBar = this.evaluationBar;

    if (!this.uiEffects) {
      this.uiEffects = new UIEffects();
    }
    this.uiEffects.startFloatingPieces();

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
    try {
      this.init3D();
    } catch (e) {
      console.warn('[App] 3D initialization failed (continuing):', e);
    }

    // Initialize Service Worker
    this.registerServiceWorker();

    // UI Adjustments for Game Modes
    const toggle3DBtn = document.getElementById('toggle-3d-btn');
    const shopPanel = document.getElementById('shop-panel');

    // UI Adjustments for Game Modes - DEPRECATED/MOVED TO STRATEGIES
    // Strategies should handle initial UI state (shop, 3d button, etc)
    // We leave toggle3DBtn logic here or better, move it too?
    // For now, removing the shopPanel hiding which broke Standard upgrades.

    if (mode !== 'standard8x8') {
      if (toggle3DBtn) toggle3DBtn.style.display = 'flex';
    }

    logger.info('App initialization complete');
    document.body.classList.add('game-initialized');
  }

  public initDOM(): void {
    this.domHandler.initDOM();
  }

  public init3D(): void {
    const container3D = document.getElementById('battle-chess-3d-container');
    if (container3D && !this.battleChess3D) {
      this.battleChess3D = new (this as any).battleChess3D_Class(container3D);
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
    const GP = this.Game_Class.prototype as any;

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
      UI_MODULE.updateMoveHistoryUI(this);
    };
    GP.updateUndoRedoButtons = function () {
      return self.moveController.updateUndoRedoButtons();
    };
    GP.updateCapturedUI = function () {
      UI_MODULE.updateCapturedUI(this);
    };
    GP.animateCheck = function (color: Player) {
      UI_MODULE.animateCheck(this, color);
    };
    GP.animateCheckmate = function (color: Player) {
      UI_MODULE.animateCheckmate(this, color);
    };
    GP.calculateMaterialAdvantage = function () {
      return self.moveController.calculateMaterialAdvantage();
    };
    GP.getMaterialValue = function (piece: Piece) {
      return self.moveController.getMaterialValue(piece);
    };
    GP.updateStatistics = function () {
      UI_MODULE.updateStatistics(this);
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
