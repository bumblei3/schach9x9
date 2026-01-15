/**
 * DOMHandler.ts
 *
 * Handles all DOM access and event listeners for the main application.
 * Decouples UI event logic from the main App bootstrapper.
 */

import { debounce } from '../utils.js';
import * as UI from '../ui.js';
import { generatePGN, copyPGNToClipboard, downloadPGN } from '../utils/PGNGenerator.js';
import { soundManager } from '../sounds.js';
import { setPieceSkin } from '../chess-pieces.js';
import { CampaignUI } from './CampaignUI.js';
import { AnalysisUI } from './AnalysisUI.js';
import { Tutorial } from '../tutorial.js';

export class DOMHandler {
  private app: any;
  private analysisUI: AnalysisUI;
  private campaignUI?: CampaignUI;
  private tutorial?: Tutorial;
  private domInitialized: boolean = false;

  public get isInitialized(): boolean {
    return this.domInitialized;
  }

  /**
   * @param app - Reference to the main App instance
   */
  constructor(app: any) {
    this.app = app;
    this.analysisUI = new AnalysisUI(app);
    if (app.game && app.game.aiController) {
      app.game.aiController.setAnalysisUI(this.analysisUI);
    }
  }

  /**
   * Convenience getter for the game instance
   */
  get game(): any {
    return this.app.game;
  }

  /**
   * Convenience getter for game controller
   */
  get gameController(): any {
    return this.app.gameController;
  }

  /**
   * Initialize all DOM handlers
   */
  public init(): void {
    this.initDOM();
  }

  public initDOM(): void {
    if (this.domInitialized) return;
    this.domInitialized = true;

    try {
      document.body.classList.add('app-ready');
    } catch (e) {
      console.error('[DOMHandler] Failed to add app-ready class:', e);
    }

    const pointsButtons = document.querySelectorAll<HTMLElement>('.points-btn');
    pointsButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const pointsStr = target.dataset.points || target.getAttribute('data-points');
        console.log('[DOMHandler] Clicked points button:', target, 'Points:', pointsStr);

        if (pointsStr) {
          const points = parseInt(pointsStr);
          const overlay = document.getElementById('points-selection-overlay');
          if (overlay) {
            overlay.classList.add('hidden');
            console.log('[DOMHandler] Overlay hidden');
          } else {
            console.error('[DOMHandler] Overlay not found!');
          }
          this.app
            .init(points, 'setup')
            .catch((err: any) => console.error('[DOMHandler] App init failed:', err));
        } else {
          console.error('[DOMHandler] Missing points data on button');
        }
      });
    });

    // Standard 8x8 Mode
    const standard8x8Btn = document.getElementById('standard-8x8-btn');
    if (standard8x8Btn) {
      standard8x8Btn.addEventListener('click', () => {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.app.init(0, 'standard8x8');
      });
    }

    // Standard 8x8 Mode with Upgrades
    const upgrade8x8Btn = document.getElementById('upgrade-8x8-btn');
    if (upgrade8x8Btn) {
      upgrade8x8Btn.addEventListener('click', () => {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.app.init(5, 'standard8x8');
      });
    }

    // Classic Mode (9x9)
    const classicBtn = document.getElementById('classic-mode-btn');
    if (classicBtn) {
      classicBtn.addEventListener('click', () => {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.app.init(0, 'classic');
      });
    }

    // Puzzle Mode
    const puzzleStartBtn = document.getElementById('puzzle-start-btn');
    if (puzzleStartBtn) {
      puzzleStartBtn.addEventListener('click', () => {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.app.init(0, 'puzzle');
      });
    }

    // Campaign Mode
    const campaignStartBtn = document.getElementById('campaign-start-btn');
    if (campaignStartBtn) {
      this.campaignUI = new CampaignUI(this.app);
      campaignStartBtn.addEventListener('click', () => {
        const overlay = document.getElementById('points-selection-overlay');
        if (overlay) overlay.classList.add('hidden');

        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.remove('active');

        this.campaignUI?.show();
      });
    }

    // Tutorial Mode
    const tutorialStartBtn = document.getElementById('start-tutorial-btn');
    if (tutorialStartBtn) {
      tutorialStartBtn.addEventListener('click', () => {
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.remove('active');

        if (!this.tutorial) {
          this.tutorial = new Tutorial();
        }
        this.tutorial.show();
      });
    }

    // Shop Item Selection
    document.querySelectorAll<HTMLElement>('.shop-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const pieceType = btn.dataset.piece;
        if (pieceType && this.game && (this.game as any).selectShopPiece) {
          (this.game as any).selectShopPiece(pieceType);
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

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        if (this.gameController && this.gameController.requestHint) {
          this.gameController.requestHint();
        } else {
          // Fallback if gameController isn't ready or doesn't have the method
          console.warn('[DOMHandler] requestHint not available on gameController');
        }
      });
    }

    const analysisBtn = document.getElementById('toggle-analysis-btn');
    if (analysisBtn) {
      analysisBtn.addEventListener('click', () => {
        if (this.game.aiController) {
          const active = this.game.aiController.toggleAnalysisMode();
          analysisBtn.classList.toggle('active', active);
          this.analysisUI.togglePanel();
        }
      });
    }

    const closeAnalysisBtn = document.getElementById('close-analysis-btn');
    if (closeAnalysisBtn) {
      closeAnalysisBtn.addEventListener('click', () => {
        if (this.game.aiController && this.game.aiController.analysisActive) {
          this.game.aiController.toggleAnalysisMode();
          if (analysisBtn) analysisBtn.classList.remove('active');
        }
        this.analysisUI.panel?.classList.add('hidden');
      });
    }

    // AI Personality Selector
    const personalitySelect = document.getElementById(
      'ai-personality-select'
    ) as HTMLSelectElement | null;
    if (personalitySelect) {
      personalitySelect.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        if (this.game) {
          this.game.aiPersonality = target.value;
        }
      });
    }

    // AI Difficulty Selector (handles both in-game menu and main menu)
    const difficultySelects = document.querySelectorAll<HTMLSelectElement>('#difficulty-select');
    difficultySelects.forEach(select => {
      select.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        const value = target.value;
        if (this.game) {
          this.game.difficulty = value;
          console.log('[DOMHandler] AI Difficulty changed to:', value);
        }
        // Sync other difficulty selects
        difficultySelects.forEach(s => {
          if (s !== target) s.value = value;
        });
      });
    });

    // Time Control Selector
    const timeControlSelect = document.getElementById(
      'time-control-select'
    ) as HTMLSelectElement | null;
    if (timeControlSelect) {
      timeControlSelect.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        if (this.gameController) {
          this.gameController.setTimeControl(target.value);
        }
      });
    }

    // Tutor Mode Selector
    const tutorModeSelect = document.getElementById(
      'tutor-mode-select'
    ) as HTMLSelectElement | null;
    if (tutorModeSelect) {
      tutorModeSelect.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        if (this.game) {
          this.game.tutorMode = target.value;
        }
      });
    }

    // Finish Setup Button
    const finishSetupBtn = document.getElementById('finish-setup-btn');
    if (finishSetupBtn) {
      finishSetupBtn.addEventListener('click', () => {
        if (this.gameController && this.gameController.finishSetupPhase) {
          this.gameController.finishSetupPhase();
        }
      });
    }

    // Game Over Overlay Buttons
    const restartBtnOverlay = document.getElementById('restart-btn-overlay');
    if (restartBtnOverlay) {
      restartBtnOverlay.addEventListener('click', () => {
        document.getElementById('game-over-overlay')?.classList.add('hidden');
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
        if (!container3D || !boardWrapper) return;

        if (this.app.battleChess3D) {
          this.app.battleChess3D.enabled = !this.app.battleChess3D.enabled;

          if (this.app.battleChess3D.enabled) {
            container3D.classList.remove('hidden');
            void container3D.offsetWidth; // Force reflow
            container3D.classList.add('active');
            document.body.classList.add('mode-3d');
            toggle3D.classList.add('active-3d');
            boardWrapper.style.opacity = '0'; // Hide 2D board

            if (!this.app.battleChess3D.scene) {
              this.app.battleChess3D.init().then(() => {
                this.app.battleChess3D.updateFromGameState(this.game);
              });
            } else {
              this.app.battleChess3D.updateFromGameState(this.game);
              this.app.battleChess3D.onWindowResize();
            }
          } else {
            container3D.classList.remove('active');
            document.body.classList.remove('mode-3d');
            toggle3D.classList.remove('active-3d');
            setTimeout(() => {
              if (!this.app.battleChess3D.enabled) {
                container3D.classList.add('hidden');
              }
            }, 500);
            boardWrapper.style.opacity = '1';
          }
        }
      });
    }

    // Handle initial overlay visibility
    const overlay = document.getElementById('points-selection-overlay');
    if (overlay) overlay.classList.remove('hidden');

    this.initMenuHandlers();
    this.initAnalysisHandlers();
    this.initPuzzleHandlers();
    this.initContinueButton();
  }

  private initContinueButton(): void {
    const continueBtn = document.getElementById('main-menu-continue-btn');
    if (!continueBtn) return;

    // Check if an autosave exists
    const hasSave = localStorage.getItem('schach9x9_save_autosave') !== null;
    if (hasSave) {
      continueBtn.classList.remove('hidden');
    }

    continueBtn.addEventListener('click', async () => {
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu) mainMenu.classList.remove('active');

      // If app is not initialized with a game controller, init it first
      if (!this.app.gameController) {
        // We don't know the mode yet, but loadGame will override it.
        // Let's use 'classic' as a default bridge to get the controller.
        await this.app.init(0, 'classic');
      }

      if (this.app.gameController) {
        this.app.gameController.loadGame();
      }
    });
  }

  private initPuzzleHandlers(): void {
    const exitBtn = document.getElementById('puzzle-exit-btn');
    const nextBtn = document.getElementById('puzzle-next-btn');
    const menuCloseBtn = document.getElementById('puzzle-menu-close-btn');

    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        this.gameController?.exitPuzzleMode();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.gameController?.nextPuzzle();
      });
    }

    if (menuCloseBtn) {
      menuCloseBtn.addEventListener('click', () => {
        if (this.gameController && this.gameController.puzzleMenu) {
          this.gameController.puzzleMenu.hide();
        }
      });
    }
  }

  private initAnalysisHandlers(): void {
    const analysisModeBtn = document.getElementById('analysis-mode-btn');
    const closeAnalysisBtn = document.getElementById('close-analysis-btn');
    const continuousBtn = document.getElementById('continuous-analysis-btn');

    if (analysisModeBtn) {
      analysisModeBtn.addEventListener('click', () => {
        if (this.gameController) {
          if (!this.game.analysisMode) {
            this.gameController.enterAnalysisMode();
          } else {
            this.gameController.exitAnalysisMode();
          }
          const mainMenu = document.getElementById('main-menu');
          if (mainMenu) {
            mainMenu.classList.remove('active');
          }
        }
      });
    }

    if (closeAnalysisBtn) {
      closeAnalysisBtn.addEventListener('click', () => {
        this.gameController?.exitAnalysisMode();
      });
    }

    if (continuousBtn) {
      continuousBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.toggleContinuousAnalysis();
          continuousBtn.classList.toggle('active', this.game.continuousAnalysis);
          continuousBtn.textContent = this.game.continuousAnalysis
            ? '⏸️ Pausieren'
            : '🔄 Kontinuierlich';
        }
      });
    }
  }

  private initMenuHandlers(): void {
    const menuBtn = document.getElementById('menu-btn');
    const mainMenu = document.getElementById('main-menu');

    // Header Menu Button
    if (menuBtn && mainMenu) {
      menuBtn.addEventListener('click', () => {
        mainMenu.classList.add('active');
        this.updateResumeButton();
      });
    }

    // Tab Navigation
    document.querySelectorAll('.menu-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return; // e.g. resume button might not have standard tab behavior in all cases

        // Handle "Resume" special case
        if (btn.id === 'resume-game-btn') {
          if (mainMenu) mainMenu.classList.remove('active');
          return;
        }

        // Update active tab styles
        document.querySelectorAll('.menu-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Switch View
        document.querySelectorAll('.menu-view').forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(`view-${tab}`);
        if (targetView) targetView.classList.add('active');
      });
    });

    // Escape Key Handler
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        // Toggle menu if game is running, otherwise ignore (or always toggle?)
        // Better: if menu is setup-only (initial state), maybe prevent closing?
        // But for now, simple toggle is good.
        if (this.game && this.game.phase !== 'SETUP') {
          // Simplistic check
          if (mainMenu) {
            if (mainMenu.classList.contains('active')) {
              mainMenu.classList.remove('active');
            } else {
              mainMenu.classList.add('active');
              this.updateResumeButton();
            }
          }
        }
      } else {
        const activeElement = document.activeElement;
        const isInput =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.getAttribute('contenteditable') === 'true');
        if (isInput) return;

        const key = e.key.toLowerCase();
        if (key === 'a') {
          const btn = document.getElementById('toggle-analysis-btn');
          if (btn) btn.click();
        } else if (key === 'h') {
          const btn = document.getElementById('hint-btn');
          if (btn) btn.click();
        } else if (key === 'b') {
          const btn = document.getElementById('best-move-btn');
          if (btn) btn.click();
        } else if (key === 't') {
          const btn = document.getElementById('threats-btn');
          if (btn) btn.click();
        } else if (key === 'o') {
          const btn = document.getElementById('opportunities-btn');
          if (btn) btn.click();
        }
      }
    });

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
          if (mainMenu) {
            mainMenu.classList.remove('active');
          }
        }
      });
    }

    const resignBtn = document.getElementById('resign-btn');
    if (resignBtn) {
      resignBtn.addEventListener('click', () => {
        if (this.gameController && confirm('Wirklich aufgeben?')) {
          this.gameController.resign(this.game.turn);
          if (mainMenu) {
            mainMenu.classList.remove('active');
          }
        }
      });
    }

    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        if (this.gameController) {
          this.gameController.loadGame();
          if (mainMenu) mainMenu.classList.remove('active');
        }
      });
    }

    const drawBtn = document.getElementById('draw-offer-btn');
    if (drawBtn) {
      drawBtn.addEventListener('click', () => {
        if (this.gameController && confirm('Remis anbieten?')) {
          this.gameController.offerDraw(this.game.turn);
          if (mainMenu) mainMenu.classList.remove('active');
        }
      });
    }

    const puzzleBtn = document.getElementById('puzzle-mode-btn');
    if (puzzleBtn) {
      puzzleBtn.addEventListener('click', () => {
        if (this.gameController && this.gameController.startPuzzleMode) {
          this.gameController.startPuzzleMode();
          if (mainMenu) {
            mainMenu.classList.remove('active');
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
        if (mainMenu) mainMenu.classList.remove('active');
      });
      if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
          helpOverlay.classList.add('hidden');
        });
      }
    }

    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
    if (themeSelect) {
      themeSelect.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        if (this.game) {
          this.game.setTheme(target.value);
        }
      });
      if (localStorage.getItem('chess_theme')) {
        const savedTheme = localStorage.getItem('chess_theme')!;
        themeSelect.value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
      }
    }

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
          downloadPGN(pgn);
        }
        if (mainMenu) {
          mainMenu.classList.remove('active');
        }
      });
    }

    const skinSelector = document.getElementById('skin-selector') as HTMLSelectElement | null;
    if (skinSelector) {
      skinSelector.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        const newSkin = target.value;
        setPieceSkin(newSkin);
        if ((UI as any).clearPieceCache) (UI as any).clearPieceCache();
        if (this.game) {
          this.game._forceFullRender = true;
          UI.renderBoard(this.game);
        }

        if (this.app.battleChess3D && this.app.battleChess3D.pieceManager) {
          this.app.battleChess3D.pieceManager.setSkin(newSkin);
          this.app.battleChess3D.pieceManager.updateFromGameState(this.game);
        }
        localStorage.setItem('chess_skin', newSkin);
      });
      if (localStorage.getItem('chess_skin')) {
        const savedSkin = localStorage.getItem('chess_skin')!;
        skinSelector.value = savedSkin;
        setPieceSkin(savedSkin);
      }
    }

    const soundToggle = document.getElementById('sound-toggle') as HTMLInputElement | null;
    const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;
    const volumeValue = document.getElementById('volume-value');

    if (soundToggle) {
      soundToggle.checked = soundManager.enabled;
      soundToggle.addEventListener('change', () => {
        soundManager.setEnabled(soundToggle.checked);
        if (volumeSlider) volumeSlider.disabled = !soundToggle.checked;
      });
    }

    if (volumeSlider && volumeValue) {
      volumeSlider.value = Math.round(soundManager.volume * 100).toString();
      volumeValue.textContent = volumeSlider.value + '%';
      volumeSlider.disabled = !soundManager.enabled;

      const handleVolumeInput = () => {
        const val = parseInt(volumeSlider.value);
        soundManager.setVolume(val);
        volumeValue.textContent = val + '%';
      };

      volumeSlider.addEventListener('input', debounce(handleVolumeInput, 50));
      volumeSlider.addEventListener('input', () => {
        volumeValue.textContent = volumeSlider.value + '%';
      });
    }

    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
      document.addEventListener('fullscreenchange', () => {
        this.updateFullscreenIcon();
      });
    }

    const mentorSelect = document.getElementById(
      'ki-mentor-level-select'
    ) as HTMLSelectElement | null;
    if (mentorSelect) {
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

        (UI as any).showToast(msg, level !== 'OFF' ? 'success' : 'neutral');
      });
    }
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn('Fullscreen request failed:', e);
      });
    } else {
      document.exitFullscreen();
    }
  }

  private updateFullscreenIcon(): void {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    const isFullscreen = !!document.fullscreenElement;
    const svg = btn.querySelector('svg');
    if (svg) {
      if (isFullscreen) {
        svg.innerHTML = `
          <path d="M4 14h3a2 2 0 0 1 2 2v3"></path>
          <path d="M20 10v-3a2 2 0 0 0-2-2h-3"></path>
          <path d="M4 10V7a2 2 0 0 1 2-2h3"></path>
          <path d="M14 20h3a2 2 0 0 0 2-2v-3"></path>
        `;
      } else {
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

  private updateResumeButton(): void {
    const resumeBtn = document.getElementById('resume-game-btn');
    if (resumeBtn) {
      if (this.game && this.game.phase !== 'SETUP') {
        resumeBtn.classList.remove('hidden');
      } else {
        resumeBtn.classList.add('hidden');
      }
    }
  }
}
