/**
 * App.ts
 * Main application class handling lifecycle and initialization.
 */
import { logger } from './logger.js';
import { DOMHandler } from './ui/DOMHandler.js';
import { errorManager } from './utils/ErrorManager.js';
import type { EvaluationBar } from './ui/EvaluationBar.js';
import type { Player, Square, Piece, GameMode } from './types/game.js';
import type { Game, MoveHistoryEntry, PieceWithMoved } from './gameEngine.js';
import type { GameController } from './gameController.js';
import type { MoveController } from './moveController.js';
import type { AIController } from './aiController.js';
import type { TutorController } from './tutorController.js';
import type { AnalysisManager } from './AnalysisManager.js';
import type { UIEffects } from './ui/ui_effects.js';
import type { KeyboardManager } from './input/KeyboardManager.js';
import type { BattleChess3D } from './battleChess3D.js';
import type * as UIImport from './ui.js';

// Global variable for UI since it's used in many places but we want to avoid static import
let UI_MODULE: typeof UIImport | null = null;

export class App {
  public game: Game | null = null;
  public gameController: GameController | null = null;
  public moveController: MoveController | null = null;
  public aiController: AIController | null = null;
  public tutorController: TutorController | null = null;
  public analysisManager: AnalysisManager | null = null;
  public evaluationBar: EvaluationBar | null = null;
  public uiEffects: UIEffects | null = null;
  public keyboardManager: KeyboardManager | null = null;
  public battleChess3D: BattleChess3D | null = null; // BattleChess3D instance (loaded lazily)
  public domHandler: DOMHandler;
  public battleChess3D_Class: typeof BattleChess3D | null = null; // BattleChess3D constructor (loaded lazily)
  public Game_Class: typeof Game | null = null;

  constructor() {
    errorManager.init();
    this.domHandler = new DOMHandler(this);
  }

  public async startCampaignLevel(levelId: string): Promise<void> {
    if (!this.gameController) {
      await this.init(0, 'campaign');
    }
    this.gameController!.startCampaignLevel(levelId);
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
    await import('./assets/pieces/index.js'); // Ensure pieces are loaded before UI
    UI_MODULE = await import('./ui.js');
    await import('./ui/AchievementUI.js'); // Initialize achievements UI
    // Expose to window for legacy/debug access
    window.UI = UI_MODULE;

    this.Game_Class = Game;
    this.game = new Game(initialPoints, mode as GameMode);
    window.game = this.game;
    window.app = this;

    // Initialize controllers
    this.gameController = new GameController(this.game);
    window.gameController = this.gameController;

    this.game.moveController = new MoveController(this.game);
    this.game.aiController = new AIController(this.game);

    // Make controllers accessible to each other (circular dependencies)
    this.aiController = this.game.aiController as AIController | null;
    this.gameController = this.game.gameController as GameController | null;
    this.moveController = this.game.moveController as MoveController | null;

    this.aiController!.game = this.game;
    this.gameController!.game = this.game;
    this.moveController!.game = this.game;

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
    window.recoverGame = () => {
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
    this.game.gameController!.initGame(initialPoints, mode as GameMode);

    // Broadcast boardShape to AI workers for cross-shaped board filtering
    if (this.game.boardShape && this.aiController) {
      this.aiController.setBoardShapeForWorkers(this.game.boardShape);
    }

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
    // UI Adjustments for Game Modes
    // Strategies should handle initial UI state (shop, 3d button, etc)
    // We leave toggle3DBtn logic here or better, move it too?
    // For now, removing the shopPanel hiding which broke Standard upgrades.

    if (mode !== 'standard8x8') {
      if (toggle3DBtn) toggle3DBtn.classList.remove('hidden');
    }

    logger.info('App initialization complete');
    document.body.classList.add('game-initialized');
  }

  public initDOM(): void {
    this.domHandler.initDOM();
  }

  public async init3D(): Promise<void> {
    const container3D = document.getElementById('battle-chess-3d-container');
    if (container3D && !this.battleChess3D) {
      // Lazy-load battleChess3D only when 3D mode is first enabled
      if (!this.battleChess3D_Class) {
        const BC3D_MODULE = await import('./battleChess3D.js');
        this.battleChess3D_Class = BC3D_MODULE.BattleChess3D;
      }
      if (this.battleChess3D_Class) {
        this.battleChess3D = new this.battleChess3D_Class(container3D);
      }
      if (this.battleChess3D) {
        window.battleChess3D = this.battleChess3D;
        // Initialize the 3D scene (creates canvas, renderer, etc.)
        await this.battleChess3D.init();
      }

      // Hook into Game methods for 3D updates if not handled by event listeners
      // Note: 3D updates are currently handled in GameController/MoveController directly
      // via window.battleChess3D checks.

      // Listen for 3D board clicks
      window.addEventListener('board3dclick', ((e: CustomEvent<{ row: number; col: number }>) => {
        if (this.game && this.gameController) {
          this.gameController.handleCellClick(e.detail.row, e.detail.col);
        }
      }) as EventListener);
    }
  }

  private registerServiceWorker(): void {
    // if ('serviceWorker' in navigator) {
    //   window.addEventListener('load', () => {
    //     navigator.serviceWorker
    //       .register('./service-worker.js')
    //       .then(registration => {
    //         logger.info('ServiceWorker registration successful:', registration.scope);
    //       })
    //       .catch(err => {
    //         logger.error('ServiceWorker registration failed:', err);
    //       });
    //   });
    // }
  }

  private applyDelegates(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const app = this;
    // Game prototype for delegate methods (dynamically patched)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GP = (this.Game_Class as typeof Game).prototype as any;

    // GameController delegations
    GP.placeKing = function (r: number, c: number, color: Player) {
      return app.gameController!.placeKing(r, c, color);
    };
    GP.selectShopPiece = function (type: string) {
      return app.gameController!.selectShopPiece(type);
    };
    GP.placeShopPiece = function (r: number, c: number) {
      return app.gameController!.placeShopPiece(r, c);
    };
    GP.finishSetupPhase = function () {
      return app.gameController!.finishSetupPhase();
    };
    GP.setTimeControl = function (mode: string) {
      return app.gameController!.setTimeControl(mode);
    };
    GP.updateClockVisibility = function () {
      return app.gameController!.updateClockVisibility();
    };
    GP.startClock = function () {
      return app.gameController!.startClock();
    };
    GP.stopClock = function () {
      return app.gameController!.stopClock();
    };
    GP.tickClock = function () {
      return app.gameController!.tickClock();
    };
    GP.updateClockDisplay = function () {
      return app.gameController!.updateClockDisplay();
    };
    GP.updateClockUI = function () {
      return app.gameController!.updateClockUI();
    };
    GP.showShop = function (show: boolean) {
      return app.gameController!.showShop(show);
    };
    GP.updateShopUI = function () {
      return app.gameController!.updateShopUI();
    };
    GP.handleCellClick = function (r: number, c: number) {
      return app.gameController!.handleCellClick(r, c);
    };
    GP.resign = function (color: Player) {
      return app.gameController!.resign(color);
    };
    GP.offerDraw = function (color: Player) {
      return app.gameController!.offerDraw(color);
    };
    GP.acceptDraw = function () {
      return app.gameController!.acceptDraw();
    };
    GP.declineDraw = function () {
      return app.gameController!.declineDraw();
    };
    GP.showDrawOfferDialog = function () {
      return app.gameController!.showDrawOfferDialog();
    };

    // MoveController delegations
    GP.handlePlayClick = function (r: number, c: number) {
      return app.moveController!.handlePlayClick(r, c);
    };
    GP.executeMove = function (from: Square, to: Square) {
      return app.moveController!.executeMove(from, to);
    };
    GP.showPromotionUI = function (r: number, c: number, color: Player, record: MoveHistoryEntry) {
      return app.moveController!.showPromotionUI(r, c, color, record);
    };
    GP.animateMove = function (from: Square, to: Square, piece: Piece) {
      return app.moveController!.animateMove(from, to, piece as PieceWithMoved);
    };
    GP.finishMove = function () {
      return app.moveController!.finishMove();
    };
    GP.undoMove = function () {
      return app.moveController!.undoMove();
    };
    GP.redoMove = function () {
      return app.moveController!.redoMove();
    };
    GP.checkDraw = function () {
      return app.moveController!.checkDraw();
    };
    GP.isInsufficientMaterial = function () {
      return app.moveController!.isInsufficientMaterial();
    };
    GP.getBoardHash = function () {
      return app.moveController!.getBoardHash();
    };
    GP.saveGame = function () {
      return app.gameController!.saveGame();
    };
    GP.loadGame = function () {
      return app.gameController!.loadGame();
    };
    GP.autoSave = function (show: boolean) {
      // autoSave is a dynamic method on MoveController
      if (app.moveController!.autoSave) return app.moveController!.autoSave(show);
    };

    GP.updateMoveHistoryUI = function () {
      UI_MODULE!.updateMoveHistoryUI(this);
    };
    GP.updateUndoRedoButtons = function () {
      return app.moveController!.updateUndoRedoButtons();
    };
    GP.updateCapturedUI = function () {
      UI_MODULE!.updateCapturedUI(this);
    };
    GP.animateCheck = function (color: Player) {
      UI_MODULE!.animateCheck(this, color);
    };
    GP.animateCheckmate = function (color: Player) {
      UI_MODULE!.animateCheckmate(this, color);
    };
    GP.calculateMaterialAdvantage = function () {
      return app.moveController!.calculateMaterialAdvantage();
    };
    GP.getMaterialValue = function (piece: Piece) {
      return app.moveController!.getMaterialValue(piece as PieceWithMoved);
    };
    GP.updateStatistics = function () {
      UI_MODULE!.updateStatistics(this);
    };

    // Replay methods
    GP.enterReplayMode = function () {
      return app.moveController!.enterReplayMode();
    };
    GP.exitReplayMode = function () {
      return app.moveController!.exitReplayMode();
    };
    GP.replayFirst = function () {
      return app.moveController!.replayFirst();
    };
    GP.replayPrevious = function () {
      return app.moveController!.replayPrevious();
    };
    GP.replayNext = function () {
      return app.moveController!.replayNext();
    };
    GP.replayLast = function () {
      return app.moveController!.replayLast();
    };
    GP.updateReplayUI = function () {
      return app.moveController!.updateReplayUI();
    };
    GP.reconstructBoardAtMove = function (idx: number) {
      return app.moveController!.reconstructBoardAtMove(idx);
    };
    GP.undoMoveForReplay = function (move: MoveHistoryEntry) {
      return app.moveController!.undoMoveForReplay(move);
    };
    GP.setTheme = function (theme: string) {
      return app.moveController!.setTheme(theme);
    };
    GP.applyTheme = function (theme: string) {
      return app.moveController!.applyTheme(theme);
    };

    // AI delegations
    GP.aiSetupKing = function () {
      return app.aiController!.aiSetupKing();
    };
    GP.aiSetupPieces = function () {
      return app.aiController!.aiSetupPieces();
    };
    GP.aiSetupUpgrades = function () {
      return app.aiController!.aiSetupUpgrades();
    };
    GP.aiMove = function () {
      return app.aiController!.aiMove();
    };
    // evaluatePosition is a dynamic method on AIController
    GP.evaluatePosition = function (color: Player) {
      return app.aiController!.evaluatePosition?.(color);
    };
    GP.updateAIProgress = function (data: { depth?: number; maxDepth?: number; nodes?: number; bestMove?: { from: { r: number; c: number }; to: { r: number; c: number } } } | null) {
      return app.aiController!.updateAIProgress(data);
    };
    GP.aiEvaluateDrawOffer = function () {
      return app.aiController!.aiEvaluateDrawOffer();
    };
    GP.aiShouldOfferDraw = function () {
      return app.aiController!.aiShouldOfferDraw();
    };
    GP.aiShouldResign = function () {
      return app.aiController!.aiShouldResign();
    };

    // Tutor delegations
    GP.updateBestMoves = function () {
      return app.tutorController!.updateBestMoves();
    };
    GP.isTutorMove = function (from: Square, to: Square) {
      return app.tutorController!.isTutorMove(from, to);
    };
    GP.getTutorHints = function () {
      return app.tutorController!.getTutorHints();
    };
    GP.getMoveNotation = function (move: { from: Square; to: Square }) {
      return app.tutorController!.getMoveNotation(move);
    };
    GP.showTutorSuggestions = function () {
      return app.tutorController!.showTutorSuggestions();
    };
    GP.getPieceName = function (type: string) {
      return app.tutorController!.getPieceName(type);
    };
    GP.getThreatenedPieces = function (pos: Square, color: Player) {
      return app.tutorController!.getThreatenedPieces(pos, color);
    };
    GP.detectTacticalPatterns = function (move: { from: Square; to: Square }) {
      return app.tutorController!.detectTacticalPatterns(move);
    };
    GP.getDefendedPieces = function (pos: Square, color: Player) {
      return app.tutorController!.getDefendedPieces(pos, color);
    };
    GP.analyzeStrategicValue = function (move: { from: Square; to: Square }) {
      return app.tutorController!.analyzeStrategicValue(move);
    };
    GP.getScoreDescription = function (score: number) {
      return app.tutorController!.getScoreDescription(score);
    };
    GP.analyzeMoveWithExplanation = function (move: { from: Square; to: Square }, score: number, best: number) {
      return app.tutorController!.analyzeMoveWithExplanation(move, score, best);
    };

    // AnalysisManager delegations
    GP.toggleThreats = function () {
      return app.analysisManager!.toggleThreats();
    };
    GP.toggleOpportunities = function () {
      return app.analysisManager!.toggleOpportunities();
    };
    GP.toggleBestMove = function () {
      return app.analysisManager!.toggleBestMove();
    };
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
