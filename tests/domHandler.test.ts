import { describe, expect, test, beforeEach, vi } from 'vitest';

// Mock all internal dependencies of DOMHandler BEFORE importing it
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  clearPieceCache: vi.fn(),
}));

vi.mock('../js/utils/PGNGenerator.js', () => ({
  generatePGN: vi.fn(() => 'MOCK PGN'),
  copyPGNToClipboard: vi.fn(),
  downloadPGN: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
  },
}));

vi.mock('../js/chess-pieces.js', () => ({
  setPieceSkin: vi.fn(),
}));

vi.mock('../js/ui/CampaignUI.js', () => ({
  CampaignUI: vi.fn().mockImplementation(function () {
    return {
      show: vi.fn(),
    };
  }),
}));

vi.mock('../js/ui/AnalysisUI.js', () => ({
  AnalysisUI: vi.fn().mockImplementation(function () {
    return {
      init: vi.fn(),
      togglePanel: vi.fn(),
      panel: {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          toggle: vi.fn(),
        },
      },
    };
  }),
}));

// Mock URL methods for JSDOM
(global as any).URL.createObjectURL = vi.fn(() => 'blob:mock');
(global as any).URL.revokeObjectURL = vi.fn();

// Now import DOMHandler (must be dynamic because of ESM mocks)
const { DOMHandler } = await import('../js/ui/DOMHandler.js');

describe('DOMHandler', () => {
  let app: any;
  let domHandler: any;

  beforeEach(() => {
    // Mock App and Game
    app = {
      init: vi.fn().mockResolvedValue(undefined),
      battleChess3D: {
        enabled: false,
        scene: null,
        init: vi.fn().mockResolvedValue(undefined),
        updateFromGameState: vi.fn(),
        onWindowResize: vi.fn(),
        pieceManager: {
          setSkin: vi.fn(),
          updateFromGameState: vi.fn(),
        },
      },
      game: {
        aiController: {
          setAnalysisUI: vi.fn(),
          toggleAnalysisMode: vi.fn(),
          analysisActive: false,
        },
        analysisManager: {
          toggleBestMove: vi.fn(),
          toggleThreats: vi.fn(),
          toggleOpportunities: vi.fn(),
        },
        tutorController: {
          showHint: vi.fn(),
        },
        finishSetupPhase: vi.fn(),
        selectShopPiece: vi.fn(),
        setTheme: vi.fn(),
        moveHistory: [],
        personality: 'balanced',
        analysisMode: false,
        continuousAnalysis: false,
        tutorMode: 'standard',
        difficulty: 'medium',
      },

      gameController: {
        saveGame: vi.fn(),
        loadGame: vi.fn(),
        resign: vi.fn(),
        offerDraw: vi.fn(),
        startPuzzleMode: vi.fn(),
        enterAnalysisMode: vi.fn(),
        exitAnalysisMode: vi.fn(),
        toggleContinuousAnalysis: vi.fn(),
        finishSetupPhase: vi.fn(),
        requestHint: vi.fn(),
        setTimeControl: vi.fn(),
      },
    };

    // Create full required DOM elements
    document.body.innerHTML = `
            <select id="time-control-select">
                <option value="blitz5">Blitz 5+3</option>
                <option value="rapid10">Rapid 10+0</option>
            </select>
            <div id="points-selection-overlay"></div>
            <button class="points-btn" data-points="15"></button>
            <button id="standard-8x8-btn"></button>
            <button id="classic-mode-btn"></button>
            <button id="puzzle-start-btn"></button>
            <button id="campaign-start-btn"></button>
            <button id="finish-setup-btn"></button>
            <button id="best-move-btn"></button>
            <button id="threats-btn"></button>
            <button id="opportunities-btn"></button>
            <button id="hint-btn"></button>
            <button id="toggle-analysis-btn"></button>
            <button id="toggle-3d-btn"></button>
            <button id="toggle-3d-btn"></button>
            <button id="menu-btn"></button>
            <div id="main-menu"></div>
            <button id="menu-close-btn"></button>
            <button id="restart-btn"></button>
            <button id="restart-btn-overlay"></button>
            <button id="save-btn"></button>
            <button id="load-btn"></button>
            <button id="resign-btn"></button>
            <button id="draw-offer-btn"></button>
            <button id="puzzle-mode-btn"></button>
            <button id="export-pgn-btn"></button>
            <button id="help-btn"></button>
            <div id="help-overlay"></div>
            <button id="close-help-btn"></button>
            <select id="skin-selector">
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
            </select>
            <input type="checkbox" id="sound-toggle" checked />
            <input type="range" id="volume-slider" min="0" max="100" value="30" />
            <span id="volume-value">30%</span>
            <button id="fullscreen-btn"><svg></svg></button>
            <select id="ki-mentor-level-select">
                <option value="OFF">Off</option>
                <option value="STANDARD">Standard</option>
                <option value="STRICT">Strict</option>
            </select>
            <select id="theme-select">
                <option value="classic">Classic</option>
                <option value="blue">Blue</option>
            </select>
            <button id="resume-game-btn" class="hidden"></button>
            <div class="shop-item" data-piece="p"></div>
            <div id="battle-chess-3d-container"></div>
            <div id="board-wrapper"></div>
            <button id="close-analysis-btn"></button>
            <button id="continuous-analysis-btn"></button>
            <button id="analysis-mode-btn"></button>
            <select id="ai-personality-select">
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
            </select>
            <select id="difficulty-select">
                <option value="medium">Medium</option>
                <option value="expert">Expert</option>
            </select>
            <select id="difficulty-select">
                <option value="medium">Medium</option>
                <option value="expert">Expert</option>
            </select>
            <select id="tutor-mode-select">
                <option value="standard">Standard</option>
                <option value="guess_the_move">Guess</option>
            </select>
        `;

    domHandler = new DOMHandler(app);
    domHandler.init();
  });

  test('should handle difficulty selection and synchronization', () => {
    const selects = document.querySelectorAll('#difficulty-select');
    const firstSelect = selects[0] as HTMLSelectElement;
    const secondSelect = selects[1] as HTMLSelectElement;

    firstSelect.value = 'expert';
    firstSelect.dispatchEvent(new Event('change'));

    expect(app.game.difficulty).toBe('expert');
    expect(secondSelect.value).toBe('expert');
  });

  test('should handle time control selection', () => {
    const select = document.querySelector('#time-control-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    if (select) {
      select.value = 'rapid10';
      select.dispatchEvent(new Event('change'));
      expect(app.gameController.setTimeControl).toHaveBeenCalledWith('rapid10');
    }
  });

  test('should initialize and wire up points selection', () => {
    const pointsBtn = document.querySelector('.points-btn') as HTMLButtonElement;
    pointsBtn.click();

    expect(app.init).toHaveBeenCalledWith(15, 'setup');
    expect(document.getElementById('points-selection-overlay')!.classList.contains('hidden')).toBe(
      true
    );
  });

  test('should wire up finish setup button', () => {
    document.getElementById('finish-setup-btn')!.click();
    expect(app.gameController.finishSetupPhase).toHaveBeenCalled();
  });

  test('should wire up shop item selection', () => {
    const shopItem = document.querySelector('.shop-item') as HTMLElement;
    shopItem.click();
    expect(app.game.selectShopPiece).toHaveBeenCalledWith('p');
    expect(shopItem.classList.contains('selected')).toBe(true);
  });

  test('should toggle analysis display items', () => {
    document.getElementById('best-move-btn')!.click();
    expect(app.game.analysisManager.toggleBestMove).toHaveBeenCalled();
  });

  test('should wire up tutor hint button', () => {
    document.getElementById('hint-btn')!.click();
    expect(app.gameController.requestHint).toHaveBeenCalled();
  });

  test('should handle menu toggle', () => {
    const menuBtn = document.getElementById('menu-btn')!;
    const mainMenu = document.getElementById('main-menu')!;

    menuBtn.click();
    expect(mainMenu.classList.contains('active')).toBe(true);

    // Escape key check
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);
    // Should toggle active off (because game is not SETUP in default mock)
    expect(mainMenu.classList.contains('active')).toBe(false);
  });

  test('should handle theme selection', () => {
    const select = document.getElementById('theme-select') as HTMLSelectElement;
    select.value = 'blue';
    select.dispatchEvent(new Event('change'));
    expect(app.game.setTheme).toHaveBeenCalledWith('blue');
  });

  test('should handle campaign start', () => {
    const campaignBtn = document.getElementById('campaign-start-btn')!;
    campaignBtn.click();
    expect(document.getElementById('points-selection-overlay')!.classList.contains('hidden')).toBe(
      true
    );
  });

  test('should handle menu actions', () => {
    document.getElementById('save-btn')!.click();
    expect(app.gameController.saveGame).toHaveBeenCalled();

    document.getElementById('load-btn')!.click();
    expect(app.gameController.loadGame).toHaveBeenCalled();

    (window as any).confirm = vi.fn(() => true);
    document.getElementById('draw-offer-btn')!.click();
    expect(app.gameController.offerDraw).toHaveBeenCalled();

    document.getElementById('resign-btn')!.click();
    expect(app.gameController.resign).toHaveBeenCalled();

    document.getElementById('puzzle-mode-btn')!.click();
    expect(app.gameController.startPuzzleMode).toHaveBeenCalled();
  });

  test('should handle skin selection', () => {
    const selector = document.getElementById('skin-selector') as HTMLSelectElement;
    selector.value = 'modern';
    selector.dispatchEvent(new Event('change'));
    expect(app.game._forceFullRender).toBe(true);
  });

  test('should handle PGN export', async () => {
    const exportBtn = document.getElementById('export-pgn-btn')!;
    app.game.moveHistory = [{ r: 0, c: 0 }];

    (window as any).alert = vi.fn();

    exportBtn.click();
    expect((window as any).alert).not.toHaveBeenCalled();
  });

  test('should handle sound toggle', () => {
    const toggle = document.getElementById('sound-toggle') as HTMLInputElement;
    const slider = document.getElementById('volume-slider') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(slider.disabled).toBe(true);
  });

  test('should handle volume slider input', () => {
    vi.useFakeTimers();
    const slider = document.getElementById('volume-slider') as HTMLInputElement;
    const valueDisplay = document.getElementById('volume-value')!;
    slider.value = '50';
    slider.dispatchEvent(new Event('input'));

    // Trigger debounce
    vi.advanceTimersByTime(100);

    expect(valueDisplay.textContent).toBe('50%');
    vi.useRealTimers();
  });

  test('should handle fullscreen toggle and change', () => {
    const btn = document.getElementById('fullscreen-btn')!;
    (document.documentElement as any).requestFullscreen = vi.fn().mockReturnValue(Promise.resolve());
    (document as any).exitFullscreen = vi.fn();

    btn.click();
    expect((document.documentElement as any).requestFullscreen).toHaveBeenCalled();

    // Mock being in fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
      writable: true,
    });

    // Dispatch change event to cover updateFullscreenIcon
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(btn.classList.contains('active-fullscreen')).toBe(true);

    btn.click();
    expect((document as any).exitFullscreen).toHaveBeenCalled();
  });

  test('should handle classic and puzzle start', () => {
    document.getElementById('classic-mode-btn')!.click();
    expect(app.init).toHaveBeenCalledWith(0, 'classic');

    document.getElementById('puzzle-start-btn')!.click();
    expect(app.init).toHaveBeenCalledWith(0, 'puzzle');
  });

  test('should handle mentor level selection', () => {
    const select = document.getElementById('ki-mentor-level-select') as HTMLSelectElement;
    select.value = 'STRICT';
    try {
      select.dispatchEvent(new Event('change'));
    } catch (_e) {
      // Silence for tests
    }
    expect(app.game.mentorLevel).toBe('STRICT');
    expect(app.game.kiMentorEnabled).toBe(true);
  });

  test('should handle 3D toggle', () => {
    const btn = document.getElementById('toggle-3d-btn')!;
    const container3D = document.getElementById('battle-chess-3d-container')!;

    btn.click();

    // Verify 3D was enabled
    expect(app.battleChess3D.enabled).toBe(true);
    expect(container3D.classList.contains('hidden')).toBe(false);
    expect(app.battleChess3D.init).toHaveBeenCalled();
  });

  test('should handle personality selection', () => {
    const select = document.getElementById('ai-personality-select') as HTMLSelectElement;
    select.value = 'aggressive';
    select.dispatchEvent(new Event('change'));
    // The DOMHandler sets app.game.aiPersonality directly
    expect(app.game.aiPersonality).toBe('aggressive');
  });

  test('should handle analysis actions', () => {
    const analysisBtn = document.getElementById('toggle-analysis-btn')!;

    // Mock the aiController.toggleAnalysisMode to return true
    app.game.aiController.toggleAnalysisMode = vi.fn().mockReturnValue(true);

    analysisBtn.click();
    expect(app.game.aiController.toggleAnalysisMode).toHaveBeenCalled();
  });

  test('should handle restart action', () => {
    const restartBtn = document.getElementById('restart-btn')!;
    (window as any).confirm = vi.fn(() => false); // User cancels

    restartBtn.click();
    expect((window as any).confirm).toHaveBeenCalled();
  });

  test('should handle theme selection from localStorage', () => {
    localStorage.setItem('chess_theme', 'blue');
    // We need a fresh init to pick up localStorage
    const newHandler = new DOMHandler(app);
    newHandler.init();
    expect(document.body.getAttribute('data-theme')).toBe('blue');
  });

  test('should handle help overlay', () => {
    const helpBtn = document.getElementById('help-btn')!;
    const overlay = document.getElementById('help-overlay')!;
    const closeBtn = document.getElementById('close-help-btn')!;

    helpBtn.click();
    expect(overlay.classList.contains('hidden')).toBe(false);

    closeBtn.click();
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  test('should handle PGN export "Keine Züge" case', () => {
    const exportBtn = document.getElementById('export-pgn-btn')!;
    app.game.moveHistory = [];
    (window as any).alert = vi.fn();

    exportBtn.click();
    expect((window as any).alert).toHaveBeenCalledWith('Keine Züge zum Exportieren!');
  });

  test('should handle standard 8x8 mode start', () => {
    document.getElementById('standard-8x8-btn')!.click();
    expect(app.init).toHaveBeenCalledWith(0, 'standard8x8');
  });

  test('should handle threats and opportunities buttons', () => {
    app.game.analysisManager.toggleThreats = vi.fn().mockReturnValue(true);
    app.game.analysisManager.toggleOpportunities = vi.fn().mockReturnValue(true);

    const threatsBtn = document.getElementById('threats-btn')!;
    const opportunitiesBtn = document.getElementById('opportunities-btn')!;

    threatsBtn.click();
    expect(app.game.analysisManager.toggleThreats).toHaveBeenCalled();
    expect(threatsBtn.classList.contains('active')).toBe(true);

    opportunitiesBtn.click();
    expect(app.game.analysisManager.toggleOpportunities).toHaveBeenCalled();
    expect(opportunitiesBtn.classList.contains('active')).toBe(true);
  });

  test('should handle close analysis button', () => {
    // Add close-analysis-btn to DOM if needed
    const closeBtn = document.getElementById('close-analysis-btn')!;
    app.game.aiController.analysisActive = true;

    closeBtn.click();
    expect(app.game.aiController.toggleAnalysisMode).toHaveBeenCalled();
  });

  test('should handle continuous analysis button', () => {
    const continuousBtn = document.getElementById('continuous-analysis-btn')!;
    app.game.continuousAnalysis = false;

    continuousBtn.click();
    expect(app.gameController.toggleContinuousAnalysis).toHaveBeenCalled();
  });

  test('should handle analysis mode button toggle (enter and exit)', () => {
    // Add analysis-mode-btn to DOM
    document.body.innerHTML += '<button id="analysis-mode-btn"></button>';
    const newHandler = new DOMHandler(app);
    newHandler.init();

    const analysisBtn = document.getElementById('analysis-mode-btn')!;

    // Enter analysis mode
    app.game.analysisMode = false;
    analysisBtn.click();
    expect(app.gameController.enterAnalysisMode).toHaveBeenCalled();

    // Exit analysis mode
    app.game.analysisMode = true;
    analysisBtn.click();
    expect(app.gameController.exitAnalysisMode).toHaveBeenCalled();
  });

  test('should handle 3D toggle off after being enabled', () => {
    vi.useFakeTimers();
    const btn = document.getElementById('toggle-3d-btn')!;
    const container3D = document.getElementById('battle-chess-3d-container')!;

    // Enable 3D
    btn.click();
    expect(app.battleChess3D.enabled).toBe(true);

    // Disable 3D
    btn.click();
    expect(app.battleChess3D.enabled).toBe(false);
    expect(container3D.classList.contains('active')).toBe(false);

    // Advance timer for the setTimeout
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
  });

  test('should handle 3D toggle when scene already exists', () => {
    const btn = document.getElementById('toggle-3d-btn')!;

    // Simulate scene already existing
    app.battleChess3D.scene = {};

    btn.click();

    expect(app.battleChess3D.updateFromGameState).toHaveBeenCalled();
    expect(app.battleChess3D.onWindowResize).toHaveBeenCalled();
  });

  test('should handle puzzle handlers', () => {
    // Add puzzle DOM elements
    document.body.innerHTML += `
      <button id="puzzle-exit-btn"></button>
      <button id="puzzle-next-btn"></button>
      <button id="puzzle-menu-close-btn"></button>
    `;

    app.gameController.exitPuzzleMode = vi.fn();
    app.gameController.nextPuzzle = vi.fn();
    app.gameController.puzzleMenu = { hide: vi.fn() };

    const newHandler = new DOMHandler(app);
    newHandler.init();

    document.getElementById('puzzle-exit-btn')!.click();
    expect(app.gameController.exitPuzzleMode).toHaveBeenCalled();

    document.getElementById('puzzle-next-btn')!.click();
    expect(app.gameController.nextPuzzle).toHaveBeenCalled();

    document.getElementById('puzzle-menu-close-btn')!.click();
    expect(app.gameController.puzzleMenu.hide).toHaveBeenCalled();
  });

  test('should handle game over overlay buttons', () => {
    // Add game over DOM elements
    document.body.innerHTML += `
      <div id="game-over-overlay"></div>
      <button id="close-game-over-btn"></button>
    `;

    const newHandler = new DOMHandler(app);
    newHandler.init();

    const gameOverOverlay = document.getElementById('game-over-overlay')!;
    const closeBtn = document.getElementById('close-game-over-btn')!;

    closeBtn.click();
    expect(gameOverOverlay.classList.contains('hidden')).toBe(true);
  });
});
