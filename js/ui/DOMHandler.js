import { debounce } from '../utils.js';
import * as UI from '../ui.js';
import { generatePGN, copyPGNToClipboard, downloadPGN } from '../utils/PGNGenerator.js';
import { soundManager } from '../sounds.js';
import { setPieceSkin } from '../chess-pieces.js';
import { CampaignUI } from './CampaignUI.js';

/**
 * Handles all DOM access and event listeners for the main application.
 * Decouples UI event logic from the main App bootstrapper.
 */
export class DOMHandler {
  /**
   * @param {App} app - Reference to the main App instance
   */
  constructor(app) {
    this.app = app;
  }

  /**
   * Convenience getter for the game instance
   */
  get game() {
    return this.app.game;
  }

  /**
   * Convenience getter for game controller
   */
  get gameController() {
    return this.app.gameController;
  }

  /**
   * Initialize all DOM handlers
   */
  init() {
    this.initDOM();
  }

  initDOM() {
    if (this.domInitialized) return;
    this.domInitialized = true;

    // Points selection
    document.querySelectorAll('.points-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const points = parseInt(e.target.dataset.points);
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.app.init(points, 'setup');
      });
    });

    // Standard 8x8 Mode
    const standard8x8Btn = document.getElementById('standard-8x8-btn');
    if (standard8x8Btn) {
      standard8x8Btn.addEventListener('click', () => {
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.app.init(0, 'standard8x8');
      });
    }

    // Classic Mode (9x9)
    const classicBtn = document.getElementById('classic-mode-btn');
    if (classicBtn) {
      classicBtn.addEventListener('click', () => {
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.app.init(0, 'classic');
      });
    }

    // Puzzle Mode
    const puzzleStartBtn = document.getElementById('puzzle-start-btn');
    if (puzzleStartBtn) {
      puzzleStartBtn.addEventListener('click', () => {
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.app.init(0, 'puzzle');
      });
    }

    // Campaign Mode
    const campaignStartBtn = document.getElementById('campaign-start-btn');
    if (campaignStartBtn) {
      this.campaignUI = new CampaignUI(this.app);
      campaignStartBtn.addEventListener('click', () => {
        document.getElementById('points-selection-overlay').style.display = 'none';
        this.campaignUI.show();
      });
    }

    // Shop Item Selection
    document.querySelectorAll('.shop-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const pieceType = btn.dataset.piece;
        if (this.game && this.game.selectShopPiece) {
          this.game.selectShopPiece(pieceType);
          // Highlight selected button
          document.querySelectorAll('.shop-item').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        }
      });
    });

    // Analysis Toggle Buttons
    const bestMoveBtn = document.getElementById('best-move-btn');
    if (bestMoveBtn) {
      bestMoveBtn.addEventListener('click', () => {
        if (this.game.analysisManager) {
          const active = this.game.analysisManager.toggleBestMove();
          bestMoveBtn.classList.toggle('active', active);
        }
      });
    }

    const threatsBtn = document.getElementById('threats-btn');
    if (threatsBtn) {
      threatsBtn.addEventListener('click', () => {
        if (this.game.analysisManager) {
          const active = this.game.analysisManager.toggleThreats();
          threatsBtn.classList.toggle('active', active);
        }
      });
    }

    const opportunitiesBtn = document.getElementById('opportunities-btn');
    if (opportunitiesBtn) {
      opportunitiesBtn.addEventListener('click', () => {
        if (this.game.analysisManager) {
          const active = this.game.analysisManager.toggleOpportunities();
          opportunitiesBtn.classList.toggle('active', active);
        }
      });
    }

    // Finish Setup Button
    const finishSetupBtn = document.getElementById('finish-setup-btn');
    if (finishSetupBtn) {
      finishSetupBtn.addEventListener('click', () => {
        if (this.game && this.game.finishSetupPhase) {
          this.game.finishSetupPhase();
        }
      });
    }

    // Game Over Overlay Buttons
    const restartBtnOverlay = document.getElementById('restart-btn-overlay');
    if (restartBtnOverlay) {
      restartBtnOverlay.addEventListener('click', () => {
        document.getElementById('game-over-overlay')?.classList.add('hidden');
        // Reload to start fresh
        window.location.reload();
      });
    }

    const closeGameOverBtn = document.getElementById('close-game-over-btn');
    if (closeGameOverBtn) {
      closeGameOverBtn.addEventListener('click', () => {
        document.getElementById('game-over-overlay')?.classList.add('hidden');
      });
    }

    // Toggle 3D
    const toggle3D = document.getElementById('toggle-3d-btn');
    if (toggle3D) {
      toggle3D.addEventListener('click', () => {
        const container3D = document.getElementById('battle-chess-3d-container');
        const boardWrapper = document.getElementById('board-wrapper');

        if (this.app.battleChess3D) {
          this.app.battleChess3D.enabled = !this.app.battleChess3D.enabled;

          if (this.app.battleChess3D.enabled) {
            container3D.style.display = 'block';
            // Force reflow
            void container3D.offsetWidth;
            container3D.classList.add('active');

            toggle3D.classList.add('active-3d');
            boardWrapper.style.opacity = '0'; // Hide 2D board

            if (!this.app.battleChess3D.scene) {
              this.app.battleChess3D.init().then(() => {
                this.app.battleChess3D.updateFromGameState(this.game);
              });
            } else {
              this.app.battleChess3D.updateFromGameState(this.game);
              this.app.battleChess3D.onWindowResize(); // Force resize since container was hidden
            }
          } else {
            container3D.classList.remove('active');
            toggle3D.classList.remove('active-3d');

            // Wait for transition before hiding
            setTimeout(() => {
              if (!this.app.battleChess3D.enabled) {
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
    this.initAnalysisHandlers();
    this.initPuzzleHandlers();
  }

  initPuzzleHandlers() {
    const exitBtn = document.getElementById('puzzle-exit-btn');
    const nextBtn = document.getElementById('puzzle-next-btn');

    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.exitPuzzleMode();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.nextPuzzle();
        }
      });
    }
  }

  initAnalysisHandlers() {
    const analysisModeBtn = document.getElementById('analysis-mode-btn');
    const closeAnalysisBtn = document.getElementById('close-analysis-btn');
    const continuousBtn = document.getElementById('continuous-analysis-btn');
    const menuOverlay = document.getElementById('menu-overlay');

    if (analysisModeBtn) {
      analysisModeBtn.addEventListener('click', () => {
        if (this.gameController) {
          if (!this.game.analysisMode) {
            this.gameController.enterAnalysisMode();
          } else {
            this.gameController.exitAnalysisMode();
          }

          // Close menu
          if (menuOverlay) {
            menuOverlay.classList.add('hidden');
            menuOverlay.style.display = 'none';
          }
        }
      });
    }

    if (closeAnalysisBtn) {
      closeAnalysisBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.exitAnalysisMode();
        }
      });
    }

    if (continuousBtn) {
      continuousBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.toggleContinuousAnalysis();
          // Visual feedback
          continuousBtn.classList.toggle('active', this.game.continuousAnalysis);
          continuousBtn.textContent = this.game.continuousAnalysis
            ? '⏸️ Pausieren'
            : '🔄 Kontinuierlich';
        }
      });
    }
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
        if (this.gameController && this.gameController.startPuzzleMode) {
          this.gameController.startPuzzleMode();
          // Close menu
          if (menuOverlay) {
            menuOverlay.classList.add('hidden');
            menuOverlay.style.display = 'none';
          }
        }
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
        const savedTheme = localStorage.getItem('chess_theme');
        themeSelect.value = savedTheme;
        // Apply theme color to body immediately
        document.body.setAttribute('data-theme', savedTheme);
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

    // Skin Selection
    const skinSelector = document.getElementById('skin-selector');
    if (skinSelector) {
      skinSelector.addEventListener('change', e => {
        const newSkin = e.target.value;
        setPieceSkin(newSkin);
        if (UI.clearPieceCache) UI.clearPieceCache();
        if (this.game) {
          this.game._forceFullRender = true;
          UI.renderBoard(this.game);
        }
        localStorage.setItem('chess_skin', newSkin);
      });
      // Set initial value
      if (localStorage.getItem('chess_skin')) {
        const savedSkin = localStorage.getItem('chess_skin');
        skinSelector.value = savedSkin;
        setPieceSkin(savedSkin);
      }
    }

    // Sound Controls
    const soundToggle = document.getElementById('sound-toggle');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');

    if (soundToggle) {
      // Initialize from saved state
      soundToggle.checked = soundManager.enabled;
      soundToggle.addEventListener('change', () => {
        soundManager.setEnabled(soundToggle.checked);
        if (volumeSlider) volumeSlider.disabled = !soundToggle.checked;
      });
    }

    if (volumeSlider && volumeValue) {
      // Initialize from saved state
      volumeSlider.value = Math.round(soundManager.volume * 100);
      volumeValue.textContent = volumeSlider.value + '%';
      volumeSlider.disabled = !soundManager.enabled;

      volumeSlider.addEventListener(
        'input',
        debounce(() => {
          const val = parseInt(volumeSlider.value);
          soundManager.setVolume(val);
          volumeValue.textContent = val + '%';
        }, 50)
      );

      // Immediate visual update (optional, but good UX)
      volumeSlider.addEventListener('input', () => {
        const val = parseInt(volumeSlider.value);
        volumeValue.textContent = val + '%';
      });
    }

    // Fullscreen
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });

      // Update icon when fullscreen state changes
      document.addEventListener('fullscreenchange', () => {
        this.updateFullscreenIcon();
      });
    }

    // KI Mentor Level Select
    const mentorSelect = document.getElementById('ki-mentor-level-select');
    if (mentorSelect) {
      // Initialize from localStorage or default
      const savedLevel = localStorage.getItem('ki_mentor_level') || 'STANDARD';
      mentorSelect.value = savedLevel;
      if (this.game) {
        this.game.mentorLevel = savedLevel;
        this.game.kiMentorEnabled = savedLevel !== 'OFF';
      }

      mentorSelect.addEventListener('change', () => {
        const level = mentorSelect.value;
        if (this.game) {
          this.game.mentorLevel = level;
          this.game.kiMentorEnabled = level !== 'OFF';
        }
        localStorage.setItem('ki_mentor_level', level);

        let msg = 'KI-Mentor deaktiviert';
        if (level === 'STANDARD') msg = 'KI-Mentor: Standard (Patzer)';
        else if (level === 'STRICT') msg = 'KI-Mentor: Streng (Fehler & Patzer)';

        UI.showToast(msg, level !== 'OFF' ? 'success' : 'neutral');
      });
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn('Fullscreen request failed:', e);
      });
    } else {
      document.exitFullscreen();
    }
  }

  updateFullscreenIcon() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    const isFullscreen = !!document.fullscreenElement;
    const svg = btn.querySelector('svg');
    if (svg) {
      if (isFullscreen) {
        // Exit fullscreen icon (corners pointing inward)
        svg.innerHTML = `
          <path d="M4 14h3a2 2 0 0 1 2 2v3"></path>
          <path d="M20 10v-3a2 2 0 0 0-2-2h-3"></path>
          <path d="M4 10V7a2 2 0 0 1 2-2h3"></path>
          <path d="M14 20h3a2 2 0 0 0 2-2v-3"></path>
        `;
      } else {
        // Enter fullscreen icon (corners pointing outward)
        svg.innerHTML = `
          <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
        `;
      }
    }

    btn.classList.toggle('active-fullscreen', isFullscreen);
  }
}
