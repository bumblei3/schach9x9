/**
 * App.js
 * Main application class handling lifecycle and initialization.
 */
import { Game } from './gameEngine.js';
import { GameController } from './gameController.js';
import { MoveController } from './moveController.js';
import { AIController } from './aiController.js';
import { TutorController } from './tutorController.js';
import { logger } from './logger.js';
import * as UI from './ui.js';
import { BattleChess3D } from './battleChess3D.js';
import { KeyboardManager } from './input/KeyboardManager.js';
import { generatePGN, copyPGNToClipboard, downloadPGN } from './utils/PGNGenerator.js';

export class App {
  constructor() {
    this.game = null;
    this.battleChess3D = null;
  }

  async init(initialPoints, mode = 'setup') {
    logger.info('App initializing with', initialPoints, 'points in mode:', mode);

    this.game = new Game(initialPoints, mode);
    window.game = this.game; // Expose for debugging and legacy UI calls

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

    // Input handlers
    this.keyboardManager = new KeyboardManager(this);

    // Apply delegates (monkey-patching Game prototype for legacy support)
    this.applyDelegates();

    // Initialize GameController logic
    this.game.gameController.initGame(initialPoints, mode);

    // Initialize 3D Battle Chess mode
    this.init3D();

    // Initialize Service Worker
    this.registerServiceWorker();

    logger.info('App initialization complete');
  }

  init3D() {
    const container3D = document.getElementById('battle-chess-3d-container');
    if (container3D && !this.battleChess3D) {
      this.battleChess3D = new BattleChess3D(container3D);
      window.battleChess3D = this.battleChess3D;

      // Hook into Game methods for 3D updates if not handled by event listeners
      // Note: 3D updates are currently handled in GameController/MoveController directly
      // via window.battleChess3D checks.

      // Listen for 3D board clicks
      window.addEventListener('board3dclick', e => {
        if (this.game && this.gameController) {
          this.gameController.handleCellClick(e.detail.row, e.detail.col);
        }
      });
    }
  }

  registerServiceWorker() {
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

  applyDelegates() {
    // GameController delegations
    Game.prototype.placeKing = function (r, c, color) {
      return this.gameController.placeKing(r, c, color);
    };
    Game.prototype.selectShopPiece = function (type) {
      return this.gameController.selectShopPiece(type);
    };
    Game.prototype.placeShopPiece = function (r, c) {
      return this.gameController.placeShopPiece(r, c);
    };
    Game.prototype.finishSetupPhase = function () {
      return this.gameController.finishSetupPhase();
    };
    Game.prototype.setTimeControl = function (mode) {
      return this.gameController.setTimeControl(mode);
    };
    Game.prototype.updateClockVisibility = function () {
      return this.gameController.updateClockVisibility();
    };
    Game.prototype.startClock = function () {
      return this.gameController.startClock();
    };
    Game.prototype.stopClock = function () {
      return this.gameController.stopClock();
    };
    Game.prototype.tickClock = function () {
      return this.gameController.tickClock();
    };
    Game.prototype.updateClockDisplay = function () {
      return this.gameController.updateClockDisplay();
    };
    Game.prototype.updateClockUI = function () {
      return this.gameController.updateClockUI();
    };
    Game.prototype.showShop = function (show) {
      return this.gameController.showShop(show);
    };
    Game.prototype.updateShopUI = function () {
      return this.gameController.updateShopUI();
    };
    Game.prototype.handleCellClick = function (r, c) {
      return this.gameController.handleCellClick(r, c);
    };
    Game.prototype.resign = function (color) {
      return this.gameController.resign(color);
    };
    Game.prototype.offerDraw = function (color) {
      return this.gameController.offerDraw(color);
    };
    Game.prototype.acceptDraw = function () {
      return this.gameController.acceptDraw();
    };
    Game.prototype.declineDraw = function () {
      return this.gameController.declineDraw();
    };
    Game.prototype.showDrawOfferDialog = function () {
      return this.gameController.showDrawOfferDialog();
    };

    // MoveController delegations
    Game.prototype.handlePlayClick = function (r, c) {
      return this.moveController.handlePlayClick(r, c);
    };
    Game.prototype.executeMove = function (from, to) {
      return this.moveController.executeMove(from, to);
    };
    Game.prototype.showPromotionUI = function (r, c, color, record) {
      return this.moveController.showPromotionUI(r, c, color, record);
    };
    Game.prototype.animateMove = function (from, to, piece) {
      return this.moveController.animateMove(from, to, piece);
    };
    Game.prototype.finishMove = function () {
      return this.moveController.finishMove();
    };
    Game.prototype.undoMove = function () {
      return this.moveController.undoMove();
    };
    Game.prototype.redoMove = function () {
      return this.moveController.redoMove();
    };
    Game.prototype.checkDraw = function () {
      return this.moveController.checkDraw();
    };
    Game.prototype.isInsufficientMaterial = function () {
      return this.moveController.isInsufficientMaterial();
    };
    Game.prototype.getBoardHash = function () {
      return this.moveController.getBoardHash();
    };
    Game.prototype.saveGame = function () {
      return this.gameController.saveGame();
    };
    Game.prototype.loadGame = function () {
      return this.gameController.loadGame();
    };
    Game.prototype.autoSave = function (show) {
      if (this.moveController.autoSave) return this.moveController.autoSave(show);
    };

    Game.prototype.updateMoveHistoryUI = function () {
      UI.updateMoveHistoryUI(this);
    };
    Game.prototype.updateUndoRedoButtons = function () {
      return this.moveController.updateUndoRedoButtons();
    };
    Game.prototype.updateCapturedUI = function () {
      UI.updateCapturedUI(this);
    };
    Game.prototype.animateCheck = function (color) {
      UI.animateCheck(this, color);
    };
    Game.prototype.animateCheckmate = function (color) {
      UI.animateCheckmate(this, color);
    };
    Game.prototype.calculateMaterialAdvantage = function () {
      return this.moveController.calculateMaterialAdvantage();
    };
    Game.prototype.getMaterialValue = function (piece) {
      return this.moveController.getMaterialValue(piece);
    };
    Game.prototype.updateStatistics = function () {
      UI.updateStatistics(this);
    };

    // Replay methods
    Game.prototype.enterReplayMode = function () {
      return this.moveController.enterReplayMode();
    };
    Game.prototype.exitReplayMode = function () {
      return this.moveController.exitReplayMode();
    };
    Game.prototype.replayFirst = function () {
      return this.moveController.replayFirst();
    };
    Game.prototype.replayPrevious = function () {
      return this.moveController.replayPrevious();
    };
    Game.prototype.replayNext = function () {
      return this.moveController.replayNext();
    };
    Game.prototype.replayLast = function () {
      return this.moveController.replayLast();
    };
    Game.prototype.updateReplayUI = function () {
      return this.moveController.updateReplayUI();
    };
    Game.prototype.reconstructBoardAtMove = function (idx) {
      return this.moveController.reconstructBoardAtMove(idx);
    };
    Game.prototype.undoMoveForReplay = function (move) {
      return this.moveController.undoMoveForReplay(move);
    };
    Game.prototype.setTheme = function (theme) {
      return this.moveController.setTheme(theme);
    };
    Game.prototype.applyTheme = function (theme) {
      return this.moveController.applyTheme(theme);
    };

    // AI delegations
    Game.prototype.aiSetupKing = function () {
      return this.aiController.aiSetupKing();
    };
    Game.prototype.aiSetupPieces = function () {
      return this.aiController.aiSetupPieces();
    };
    Game.prototype.aiMove = function () {
      return this.aiController.aiMove();
    };
    Game.prototype.evaluateMove = function (move) {
      return this.aiController.evaluateMove(move);
    };
    Game.prototype.getBestMoveMinimax = function (moves, depth) {
      return this.aiController.getBestMoveMinimax(moves, depth);
    };
    Game.prototype.minimax = function (move, depth, isMax, alpha, beta) {
      return this.aiController.minimax(move, depth, isMax, alpha, beta);
    };
    Game.prototype.quiescenceSearch = function (alpha, beta, isMax) {
      return this.aiController.quiescenceSearch(alpha, beta, isMax);
    };
    Game.prototype.evaluatePosition = function (color) {
      return this.aiController.evaluatePosition(color);
    };
    Game.prototype.updateAIProgress = function (data) {
      return this.aiController.updateAIProgress(data);
    };
    Game.prototype.aiEvaluateDrawOffer = function () {
      return this.aiController.aiEvaluateDrawOffer();
    };
    Game.prototype.aiShouldOfferDraw = function () {
      return this.aiController.aiShouldOfferDraw();
    };
    Game.prototype.aiShouldResign = function () {
      return this.aiController.aiShouldResign();
    };

    // Tutor delegations
    Game.prototype.updateBestMoves = function () {
      return this.tutorController.updateBestMoves();
    };
    Game.prototype.isTutorMove = function (from, to) {
      return this.tutorController.isTutorMove(from, to);
    };
    Game.prototype.getTutorHints = function () {
      return this.tutorController.getTutorHints();
    };
    Game.prototype.getMoveNotation = function (move) {
      return this.tutorController.getMoveNotation(move);
    };
    Game.prototype.showTutorSuggestions = function () {
      return this.tutorController.showTutorSuggestions();
    };
    Game.prototype.getPieceName = function (type) {
      return this.tutorController.getPieceName(type);
    };
    Game.prototype.getThreatenedPieces = function (pos, color) {
      return this.tutorController.getThreatenedPieces(pos, color);
    };
    Game.prototype.detectTacticalPatterns = function (move) {
      return this.tutorController.detectTacticalPatterns(move);
    };
    Game.prototype.getDefendedPieces = function (pos, color) {
      return this.tutorController.getDefendedPieces(pos, color);
    };
    Game.prototype.analyzeStrategicValue = function (move) {
      return this.tutorController.analyzeStrategicValue(move);
    };
    Game.prototype.getScoreDescription = function (score) {
      return this.tutorController.getScoreDescription(score);
    };
    Game.prototype.analyzeMoveWithExplanation = function (move, score, best) {
      return this.tutorController.analyzeMoveWithExplanation(move, score, best);
    };
  }

  initDOM() {
    // Points selection
    document.querySelectorAll('.points-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const points = parseInt(e.target.dataset.points);
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.init(points, 'setup');
      });
    });

    // Classic Mode
    const classicBtn = document.getElementById('classic-mode-btn');
    if (classicBtn) {
      classicBtn.addEventListener('click', () => {
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.init(0, 'classic');
      });
    }

    // Toggle 3D
    const toggle3D = document.getElementById('toggle-3d-btn');
    if (toggle3D) {
      toggle3D.addEventListener('click', () => {
        const container3D = document.getElementById('battle-chess-3d-container');
        const boardWrapper = document.getElementById('board-wrapper');

        if (this.battleChess3D) {
          this.battleChess3D.enabled = !this.battleChess3D.enabled;

          if (this.battleChess3D.enabled) {
            container3D.style.display = 'block';
            // Force reflow
            void container3D.offsetWidth;
            container3D.classList.add('active');

            toggle3D.classList.add('active-3d');
            boardWrapper.style.opacity = '0'; // Hide 2D board

            if (!this.battleChess3D.scene) {
              this.battleChess3D.init().then(() => {
                this.battleChess3D.updateFromGameState(this.game);
              });
            } else {
              this.battleChess3D.updateFromGameState(this.game);
              this.battleChess3D.onWindowResize(); // Force resize since container was hidden
            }
          } else {
            container3D.classList.remove('active');
            toggle3D.classList.remove('active-3d');

            // Wait for transition before hiding
            setTimeout(() => {
              if (!this.battleChess3D.enabled) {
                container3D.style.display = 'none';
              }
            }, 500);

            boardWrapper.style.opacity = '1';
          }
        }
      });
    }

    // Handle initial overlay visibility
    // If not triggered by buttons, we might show the overlay
    const overlay = document.getElementById('points-selection-overlay');
    if (overlay) overlay.style.display = 'flex';

    this.initMenuHandlers();
  }

  initMenuHandlers() {
    const menuBtn = document.getElementById('menu-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuCloseBtn = document.getElementById('menu-close-btn');

    if (menuBtn && menuOverlay) {
      menuBtn.addEventListener('click', () => {
        menuOverlay.classList.remove('hidden');
        menuOverlay.style.display = 'flex';
      });
    }

    if (menuCloseBtn && menuOverlay) {
      menuCloseBtn.addEventListener('click', () => {
        menuOverlay.classList.add('hidden');
        menuOverlay.style.display = 'none';
      });
    }

    // Wiring up menu items
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        if (confirm('Spiel wirklich neu starten?')) {
          location.reload();
        }
      });
    }

    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.saveGame();
          // Optional: Show toast or close menu
          if (menuOverlay) {
            menuOverlay.classList.add('hidden');
            menuOverlay.style.display = 'none';
          }
        }
      });
    }

    // Add other menu handlers here (Load, Resign, etc.)
    const resignBtn = document.getElementById('resign-btn');
    if (resignBtn) {
      resignBtn.addEventListener('click', () => {
        if (this.gameController && confirm('Wirklich aufgeben?')) {
          this.gameController.resign(this.game.turn);
          if (menuOverlay) {
            menuOverlay.classList.add('hidden');
            menuOverlay.style.display = 'none';
          }
        }
      });
    }

    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.loadGame();
          if (menuOverlay) menuOverlay.classList.add('hidden');
        }
      });
    }

    const drawBtn = document.getElementById('draw-offer-btn');
    if (drawBtn) {
      drawBtn.addEventListener('click', () => {
        if (this.gameController && confirm('Remis anbieten?')) {
          this.gameController.offerDraw(this.game.turn);
          if (menuOverlay) menuOverlay.classList.add('hidden');
        }
      });
    }

    const puzzleBtn = document.getElementById('puzzle-mode-btn');
    if (puzzleBtn) {
      puzzleBtn.addEventListener('click', () => {
        alert('Puzzle Modus noch nicht implementiert!');
      });
    }

    const helpBtn = document.getElementById('help-btn');
    const helpOverlay = document.getElementById('help-overlay');
    const closeHelpBtn = document.getElementById('close-help-btn');
    if (helpBtn && helpOverlay) {
      helpBtn.addEventListener('click', () => {
        helpOverlay.classList.remove('hidden');
        helpOverlay.style.display = 'flex';
        if (menuOverlay) menuOverlay.classList.add('hidden');
      });
      if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
          helpOverlay.classList.add('hidden');
          helpOverlay.style.display = 'none';
        });
      }
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', e => {
        if (this.game) {
          this.game.setTheme(e.target.value);
        }
      });
      // Set initial value
      if (localStorage.getItem('chess_theme')) {
        themeSelect.value = localStorage.getItem('chess_theme');
      }
    }

    // PGN Export
    const exportPgnBtn = document.getElementById('export-pgn-btn');
    if (exportPgnBtn) {
      exportPgnBtn.addEventListener('click', async () => {
        if (!this.game || !this.game.moveHistory || this.game.moveHistory.length === 0) {
          alert('Keine Züge zum Exportieren!');
          return;
        }
        const pgn = generatePGN(this.game);
        const copied = await copyPGNToClipboard(pgn);
        if (copied) {
          alert('PGN in die Zwischenablage kopiert!');
        } else {
          // Fallback: download
          downloadPGN(pgn);
        }
        if (menuOverlay) {
          menuOverlay.classList.add('hidden');
          menuOverlay.style.display = 'none';
        }
      });
    }
  }
}
