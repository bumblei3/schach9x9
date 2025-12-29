import { Game } from './gameEngine.js';
import { GameController } from './gameController.js';
import { MoveController } from './moveController.js';
import { AIController } from './aiController.js';
import { TutorController } from './tutorController.js';
import { logger } from './logger.js';
// import { ArrowRenderer } from './arrows.js';
import * as UI from './ui.js';
import { soundManager } from './sounds.js';
// import { debounce } from './utils.js';
import { BOARD_SIZE, PHASES } from './gameEngine.js';
import { storageManager } from './storage.js';
import { BattleChess3D } from './battleChess3D.js';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then(registration => {
        logger.info('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        logger.error('ServiceWorker registration failed: ', err);
      });
  });
}

logger.info('main.js loaded (Refactored)');

// Global game instance
let game = null;
let kbRow = 0;
let kbCol = 0;
let battleChess3D = null; // 3D mode instance

// --- Initialization ---

async function initGame(initialPoints, mode = 'setup') {
  try {
    game = new Game(initialPoints, mode);
    window.game = game;

    // Initialize controllers
    game.gameController = new GameController(game);
    game.moveController = new MoveController(game);
    game.aiController = new AIController(game);

    // Make controllers accessible to each other
    game.aiController.game = game;
    game.gameController.game = game;
    game.moveController.game = game;
    game.tutorController = new TutorController(game);

    // --- Delegate Game.prototype methods to controllers ---

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

    // Initialize GameController logic
    game.gameController.initGame(initialPoints, mode);

    // Initialize 3D Battle Chess mode
    const container3D = document.getElementById('battle-chess-3d-container');
    if (container3D && !battleChess3D) {
      battleChess3D = new BattleChess3D(container3D);
      window.battleChess3D = battleChess3D;

      // Listen for 3D board clicks
      container3D.addEventListener('board3dclick', event => {
        const { row, col } = event.detail;
        if (game && game.phase === PHASES.PLAY) {
          game.handleCellClick(row, col);
        }
      });
    }

    // Check for autosaved game
    if (storageManager.hasSave()) {
      checkSavedGame();
    }
  } catch (error) {
    console.error('Error initializing game:', error);
    alert('Fehler beim Starten des Spiels. Bitte Konsole prüfen.');
  }
}

function focusCell(r, c) {
  document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('keyboard-focus'));
  const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (cell) {
    cell.classList.add('keyboard-focus');
    cell.focus();
  }
}

function checkSavedGame() {
  const saveData = storageManager.loadGame();
  if (!saveData) return;

  try {
    if (saveData.timestamp) {
      const hoursAgo = Math.floor((Date.now() - saveData.timestamp) / (1000 * 60 * 60));
      const timeAgo =
        hoursAgo < 1
          ? 'vor weniger als 1 Stunde'
          : hoursAgo === 1
            ? 'vor 1 Stunde'
            : `vor ${hoursAgo} Stunden`;

      const restoreDialog = document.createElement('div');
      restoreDialog.id = 'restore-dialog';
      restoreDialog.className = 'modal-overlay';
      restoreDialog.innerHTML = `
          <div class="modal-content">
            <h2>📂 Gespeichertes Spiel gefunden</h2>
            <p>Möchtest du das Spiel fortsetzen?</p>
            <div class="save-info">
              <p>⏰ Gespeichert: ${timeAgo}</p>
              <p>♟️ Züge gespielt: <strong>${(saveData.moveHistory && saveData.moveHistory.length) || 0}</strong></p>
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
        window.game.loadGame(); // Calls GameController.loadGame -> storageManager.loadGame
        restoreDialog.remove();
      };

      document.getElementById('restore-no').onclick = () => {
        localStorage.removeItem('schach9x9_save_autosave'); // Or storageManager.clearSave()?
        restoreDialog.remove();
      };
    }
  } catch (e) {
    console.error('Failed to parse saved game:', e);
  }
}

// --- DOM Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
  const pointsOverlay = document.getElementById('points-selection-overlay');

  // Handle points selection
  document.querySelectorAll('.points-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const points = parseInt(btn.dataset.points);
      if (points) {
        pointsOverlay.classList.add('hidden');
        pointsOverlay.style.display = 'none';
        initGame(points, 'setup');
      }
    });
  });

  const classicBtn = document.getElementById('classic-mode-btn');
  if (classicBtn) {
    classicBtn.addEventListener('click', () => {
      pointsOverlay.classList.add('hidden');
      pointsOverlay.style.display = 'none';
      initGame(15, 'classic'); // Points don't matter for classic, but passing default
    });
  }

  setupGlobalListeners();
});

function setupGlobalListeners() {
  // --- Menu Overlay Logic ---
  const menuBtn = document.getElementById('menu-btn');
  const menuOverlay = document.getElementById('menu-overlay');
  const menuCloseBtn = document.getElementById('menu-close-btn');

  function toggleMenu(show) {
    if (show) {
      menuOverlay.classList.remove('hidden');
    } else {
      menuOverlay.classList.add('hidden');
    }
  }

  if (menuBtn) menuBtn.addEventListener('click', () => toggleMenu(true));
  if (menuCloseBtn) menuCloseBtn.addEventListener('click', () => toggleMenu(false));

  // Close menu when clicking outside content
  if (menuOverlay) {
    menuOverlay.addEventListener('click', e => {
      if (e.target === menuOverlay) toggleMenu(false);
    });
  }

  // --- Info Overlay Logic ---
  const infoToggleBtn = document.getElementById('info-toggle-btn');
  const infoOverlay = document.getElementById('info-overlay');
  const infoCloseBtn = document.getElementById('info-close-btn');

  function toggleInfo(show) {
    if (show) {
      infoOverlay.classList.remove('hidden');
      // Refresh logs/history when opening
      if (window.game) {
        UI.updateMoveHistoryUI(window.game);
        // UI.updateLogUI(window.game); // If you have a separate log update
      }
    } else {
      infoOverlay.classList.add('hidden');
    }
  }

  if (infoToggleBtn) infoToggleBtn.addEventListener('click', () => toggleInfo(true));
  if (infoCloseBtn) infoCloseBtn.addEventListener('click', () => toggleInfo(false));

  // Tab Switching for Info Overlay
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      // Activate clicked
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const pane = document.getElementById(`tab-${tabId}`);
      if (pane) pane.classList.add('active');
    });
  });

  // --- Action Bar Buttons ---
  const undoBtn = document.getElementById('undo-btn');
  const hintBtn = document.getElementById('hint-btn');

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (window.game && window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY) {
        window.game.undoMove();
      }
    });
  }

  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (window.game && window.game.phase === PHASES.PLAY) {
        window.game.showTutorSuggestions();
      }
    });
  }

  // 3D Mode Toggle
  const toggle3DBtn = document.getElementById('toggle-3d-btn');
  if (toggle3DBtn) {
    toggle3DBtn.addEventListener('click', () => {
      if (!window.battleChess3D || !window.game) return;

      const container3D = document.getElementById('battle-chess-3d-container');
      const board2D = document.getElementById('board-wrapper');
      const isEnabled = container3D.classList.contains('active');

      if (isEnabled) {
        // Disable 3D mode - show 2D board
        container3D.classList.remove('active');
        toggle3DBtn.classList.remove('active-3d');
        window.battleChess3D.toggle(false);

        // Fade out 3D, fade in 2D
        setTimeout(() => {
          if (board2D) board2D.style.opacity = '1';
        }, 300);

        soundManager.playMove();
      } else {
        // Enable 3D mode - hide 2D board
        toggle3DBtn.classList.add('active-3d');

        // Fade out 2D first
        if (board2D) {
          board2D.style.transition = 'opacity 0.3s';
          board2D.style.opacity = '0';
        }

        // Show 3D after fade
        setTimeout(() => {
          container3D.classList.add('active');

          // Initialize 3D scene if not already done
          if (!window.battleChess3D.scene) {
            window.battleChess3D.init().then(() => {
              window.battleChess3D.updateFromGameState(window.game);
              window.battleChess3D.toggle(true);
            });
          } else {
            window.battleChess3D.updateFromGameState(window.game);
            window.battleChess3D.toggle(true);
          }
        }, 300);

        soundManager.playCapture();
      }
    });
  }

  // Unified Skin Selector (for both 2D and 3D)
  const skinSelector = document.getElementById('skin-selector');
  if (skinSelector) {
    // Clean up old localStorage keys
    const oldSkin1 = localStorage.getItem('chessSkin');
    const oldSkin2 = localStorage.getItem('schach9x9_skin');

    // Remove old keys if they exist
    if (oldSkin1) localStorage.removeItem('chessSkin');
    if (oldSkin2) localStorage.removeItem('schach9x9_skin');

    // Get saved skin or default to 'classic'
    let savedSkin = localStorage.getItem('selectedSkin');

    // If no valid skin is saved, use 'classic' and persist it
    if (!savedSkin) {
      savedSkin = 'classic';
      localStorage.setItem('selectedSkin', 'classic');
      console.log('No saved skin found, defaulting to classic');
    }

    // Load chess pieces module and set skin
    import('./chess-pieces.js').then(chessPiecesModule => {
      window.setPieceSkin = chessPiecesModule.setPieceSkin;
      window.getAvailableSkins = chessPiecesModule.getAvailableSkins;

      // Apply saved or default skin
      if (window.setPieceSkin) {
        window.setPieceSkin(savedSkin);
        console.log(`Loaded skin: ${savedSkin}`);
      }

      // Set initial value for the selector
      skinSelector.value = savedSkin;

      // Re-render 2D board if game exists
      if (window.game) {
        import('./ui.js').then(UI => UI.renderBoard(window.game));
      }
    });

    if (window.battleChess3D) {
      window.battleChess3D.currentSkin = savedSkin;
    }

    // Tutor Mode Selector
    const tutorModeSelect = document.getElementById('tutor-mode-select');
    if (tutorModeSelect) {
      tutorModeSelect.addEventListener('change', e => {
        window.game.tutorMode = e.target.value;
        window.game.log(`Tutor-Modus auf "${e.target.value}" geändert.`);
      });
    }

    // Handle skin changes
    skinSelector.addEventListener('change', e => {
      const newSkin = e.target.value;

      // Save to localStorage with consistent key
      localStorage.setItem('selectedSkin', newSkin);
      console.log(`Skin changed to: ${newSkin}`);

      // Update 2D pieces
      import('./chess-pieces.js').then(module => {
        if (module.setPieceSkin(newSkin)) {
          // Clear SVG cache to force re-render of new skin
          window._svgCache = {};

          // Force full re-render of the board
          if (window.game) {
            window.game._forceFullRender = true;
            // Reset previous board state to ensure diffing triggers
            window.game._previousBoardState = null;
          }

          // Re-render 2D board
          import('./ui.js').then(UI => {
            if (window.game) UI.renderBoard(window.game);
          });
        }
      });

      // Update 3D pieces
      if (window.battleChess3D) {
        window.battleChess3D.setSkin(newSkin);
      }

      soundManager.playMove();
    });
  }

  // --- Menu Actions ---
  document.getElementById('puzzle-mode-btn').addEventListener('click', () => {
    if (window.game) {
      window.game.gameController.startPuzzleMode();
      toggleMenu(false);
    }
  });

  document.getElementById('restart-btn').addEventListener('click', () => location.reload());

  document.getElementById('save-btn').addEventListener('click', () => {
    if (window.game) {
      window.game.saveGame();
      toggleMenu(false);
    }
  });

  document.getElementById('load-btn').addEventListener('click', () => {
    if (window.game) {
      window.game.loadGame();
      toggleMenu(false);
    }
  });

  document.getElementById('resign-btn').addEventListener('click', () => {
    if (window.game && window.game.phase === PHASES.PLAY) {
      toggleMenu(false);
      const overlay = document.getElementById('confirmation-overlay');
      const message = document.getElementById('confirmation-message');
      message.textContent = 'Möchtest du wirklich aufgeben?';
      overlay.classList.remove('hidden');

      window.game.pendingConfirmation = () => {
        const color = window.game.isAI ? 'white' : window.game.turn;
        window.game.resign(color);
      };
    } else {
      alert('Du kannst nur während des Spiels aufgeben.');
    }
  });

  document.getElementById('draw-offer-btn').addEventListener('click', () => {
    if (window.game && window.game.phase === PHASES.PLAY) {
      toggleMenu(false);
      const overlay = document.getElementById('confirmation-overlay');
      const message = document.getElementById('confirmation-message');
      message.textContent = 'Möchtest du Remis anbieten?';
      overlay.classList.remove('hidden');

      window.game.pendingConfirmation = () => {
        const color = window.game.isAI ? 'white' : window.game.turn;
        window.game.offerDraw(color);
      };
    } else {
      alert('Du kannst nur während des Spiels Remis anbieten.');
    }
  });

  document.getElementById('stats-btn').addEventListener('click', () => {
    toggleMenu(false);
    if (window.game) UI.showStatisticsOverlay(window.game);
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    toggleMenu(false);
    document.getElementById('help-overlay').classList.remove('hidden');
  });

  // --- Settings ---
  // Theme (Board Colors)
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    const savedTheme = localStorage.getItem('chess_theme') || 'classic';
    themeSelect.value = savedTheme;
    document.body.setAttribute('data-theme', savedTheme);

    themeSelect.addEventListener('change', e => {
      const theme = e.target.value;
      localStorage.setItem('chess_theme', theme);
      document.body.setAttribute('data-theme', theme);

      // Update 3D board theme as well
      if (window.battleChess3D && window.battleChess3D.setTheme) {
        window.battleChess3D.setTheme(theme);
      }
    });
  }

  // Difficulty
  const difficultySelect = document.getElementById('difficulty-select');
  if (difficultySelect) {
    const savedDifficulty = localStorage.getItem('chess_difficulty') || 'beginner';
    difficultySelect.value = savedDifficulty;
    difficultySelect.addEventListener('change', e => {
      const newDifficulty = e.target.value;
      if (window.game) window.game.difficulty = newDifficulty;
      localStorage.setItem('chess_difficulty', newDifficulty);
    });
  }

  // Time Control
  const timeControlSelect = document.getElementById('time-control-select');
  if (timeControlSelect) {
    const savedTimeControl = localStorage.getItem('chess_time_control') || 'blitz5';
    timeControlSelect.value = savedTimeControl;
    timeControlSelect.addEventListener('change', e => {
      const newTimeControl = e.target.value;
      if (window.game) window.game.setTimeControl(newTimeControl);
      localStorage.setItem('chess_time_control', newTimeControl);
    });
  }

  // Sound
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.checked = soundManager.enabled;
    soundToggle.addEventListener('change', e => {
      soundManager.setEnabled(e.target.checked);
    });
  }

  // --- Overlays ---
  document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-overlay').classList.add('hidden');
  });

  document.getElementById('stats-close-btn').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.add('hidden');
  });

  document.getElementById('confirm-yes-btn').addEventListener('click', () => {
    if (window.game && window.game.pendingConfirmation) {
      window.game.pendingConfirmation();
      window.game.pendingConfirmation = null;
    }
    document.getElementById('confirmation-overlay').classList.add('hidden');
  });

  document.getElementById('confirm-no-btn').addEventListener('click', () => {
    if (window.game) window.game.pendingConfirmation = null;
    document.getElementById('confirmation-overlay').classList.add('hidden');
  });

  document.getElementById('accept-draw-btn').addEventListener('click', () => {
    if (window.game) window.game.acceptDraw();
    document.getElementById('draw-offer-overlay').classList.add('hidden');
  });

  document.getElementById('decline-draw-btn').addEventListener('click', () => {
    if (window.game) window.game.declineDraw();
    document.getElementById('draw-offer-overlay').classList.add('hidden');
  });

  document.getElementById('close-game-over-btn').addEventListener('click', () => {
    document.getElementById('game-over-overlay').classList.add('hidden');
  });

  document.getElementById('restart-btn-overlay').addEventListener('click', () => {
    location.reload();
  });

  // Puzzle Overlay
  document.getElementById('puzzle-next-btn').addEventListener('click', () => {
    if (window.game) window.game.gameController.nextPuzzle();
  });

  document.getElementById('puzzle-exit-btn').addEventListener('click', () => {
    if (window.game) window.game.gameController.exitPuzzleMode();
  });

  // --- Shop ---
  const shopButtons = document.querySelectorAll('.shop-item');
  shopButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.game) window.game.selectShopPiece(btn.dataset.piece);

      // Visual feedback
      shopButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const finishBtn = document.getElementById('finish-setup-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      if (window.game) window.game.finishSetupPhase();
    });
  }

  // --- Keyboard ---
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (!window.game) return;
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
            if (window.game.redoStack.length > 0 && window.game.phase === PHASES.PLAY)
              window.game.redoMove();
          } else {
            if (window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY)
              window.game.undoMove();
          }
          break;
        case 'y':
          e.preventDefault();
          if (window.game.redoStack.length > 0 && window.game.phase === PHASES.PLAY)
            window.game.redoMove();
          break;
      }
    }

    if (window.game && !window.game.replayMode) {
      switch (e.key.toLowerCase()) {
        case 'h':
          if (window.game.phase === PHASES.PLAY) window.game.showTutorSuggestions();
          break;
        case 'u':
          if (window.game.moveHistory.length > 0 && window.game.phase === PHASES.PLAY)
            window.game.undoMove();
          break;
        case '3':
          document.getElementById('toggle-3d-btn')?.click();
          break; // Toggle 3D mode
        case 'escape':
        case 'esc':
          if (window.game.selectedSquare) {
            window.game.selectedSquare = null;
            window.game.validMoves = null;
            UI.renderBoard(window.game);
          }
          // Close overlays
          document.querySelectorAll('.fullscreen-overlay, .modal-overlay').forEach(el => {
            if (!el.id.includes('points-selection')) el.classList.add('hidden');
          });
          break;
      }
    }

    // Arrow keys for board navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowUp') kbRow = (kbRow + BOARD_SIZE - 1) % BOARD_SIZE;
      if (e.key === 'ArrowDown') kbRow = (kbRow + 1) % BOARD_SIZE;
      if (e.key === 'ArrowLeft') kbCol = (kbCol + BOARD_SIZE - 1) % BOARD_SIZE;
      if (e.key === 'ArrowRight') kbCol = (kbCol + 1) % BOARD_SIZE;
      focusCell(kbRow, kbCol);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const cell = document.querySelector(`.cell[data-r="${kbRow}"][data-c="${kbCol}"]`);
      if (cell) cell.click();
    }
  });
}
