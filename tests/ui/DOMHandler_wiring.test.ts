import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mirrors the mock setup of DOMHandler_coverage.test.ts so DOMHandler imports
// cleanly under vitest/jsdom. Focus here is REAL wiring invariants, not
// coverage bumps: each test asserts the DOM state the handler actually drives.
vi.mock('../../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  showShop: vi.fn(),
  showToast: vi.fn(),
  clearPieceCache: vi.fn(),
  showModal: (
    title: string,
    message: string,
    actions: Array<{ text: string; class?: string; callback?: () => void }> = []
  ) => {
    const modal = document.getElementById('generic-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const actionsEl = document.getElementById('modal-actions');
    if (!modal || !titleEl || !messageEl || !actionsEl) return;
    titleEl.textContent = title;
    messageEl.textContent = message;
    actionsEl.replaceChildren();
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.text;
      btn.className = action.class || 'btn-secondary';
      btn.addEventListener('click', () => action.callback?.());
      actionsEl.appendChild(btn);
    });
    modal.classList.remove('hidden');
  },
}));

vi.mock('../../js/sounds.js', () => ({
  soundManager: {
    enabled: true,
    volume: 0.5,
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
    playMove: vi.fn(),
    playGameStart: vi.fn(),
  },
}));

vi.mock('../../js/utils.js', () => ({ debounce: (fn: any) => fn }));
vi.mock('../../js/chess-pieces.js', () => ({ setPieceSkin: vi.fn() }));
vi.mock('../../js/utils/PGNGenerator.js', () => ({
  generatePGN: vi.fn(() => 'MOCK PGN'),
  copyPGNToClipboard: vi.fn(),
  downloadPGN: vi.fn(),
}));
vi.mock('../../js/ui/CampaignUI.js', () => ({ CampaignUI: class { show = vi.fn(); } }));
vi.mock('../../js/ui/AnalysisUI.js', () => ({
  AnalysisUI: class {
    panel = document.createElement('div');
    update = vi.fn();
    updateLiveProgress = vi.fn();
    togglePanel = vi.fn();
  },
}));
vi.mock('../../js/ui/OpeningBookUI.js', () => ({
  OpeningBookUI: class {
    visible = false;
    toggle = vi.fn(function (this: any) { this.visible = !this.visible; });
    hide = vi.fn();
    setGame = vi.fn();
    updateCurrentOpening = vi.fn();
  },
}));
vi.mock('../../js/ui/PostGameAnalysisUI.js', () => ({ hidePostGameStats: vi.fn() }));
vi.mock('../../js/tutorial.js', () => ({ Tutorial: class { show = vi.fn(); } }));

global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.URL.revokeObjectURL = vi.fn();

const { DOMHandler } = await import('../../js/ui/DOMHandler.js');

// jsdom does not implement matchMedia — stub it so mobile/desktop branches
// (setSheetBackdrop, action-overflow bottom-sheet) are exercised deterministically.
function stubMatchMedia(maxWidthMatches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: maxWidthMatches && q.includes('max-width: 768px'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe('DOMHandler wiring invariants', () => {
  let app: any;
  let handler: any;

  beforeEach(() => {
    app = {
      init: vi.fn().mockResolvedValue(undefined),
      game: {
        phase: 'PLAY',
        turn: 'white',
        moveHistory: [],
        analysisManager: { toggleBestMove: vi.fn() },
        tutorController: { showHint: vi.fn() },
        aiController: {
          toggleAnalysisMode: vi.fn(),
          analysisActive: false,
          setAnalysisUI: vi.fn(),
        },
        analysisMode: false,
        continuousAnalysis: false,
        setTheme: vi.fn(),
      },
      gameController: {
        enterAnalysisMode: vi.fn(),
        exitAnalysisMode: vi.fn(),
        toggleContinuousAnalysis: vi.fn(),
        loadGame: vi.fn(),
        offerDraw: vi.fn(),
        showShop: vi.fn(),
        exitPuzzleMode: vi.fn(),
        nextPuzzle: vi.fn(),
      },
      battleChess3D: { enabled: false },
    };

    document.body.innerHTML = `
      <div id="main-menu" class="active"></div>
      <button id="main-menu-continue-btn" class="hidden"></button>
      <button id="action-more-btn"></button>
      <div id="action-overflow-menu" class="hidden"></div>
      <div id="sheet-backdrop" class="hidden"></div>
      <button id="shop-panel" class="hidden"></button>
      <div id="more-modes-grid" class="is-collapsed" hidden></div>
      <button id="toggle-more-modes" aria-expanded="false"></button>
      <button class="points-btn" data-points="15"></button>
      <div data-init-mode="classic" data-init-points="0"></div>
      <div data-init-mode="standard8x8" data-init-points="0"></div>
      <div data-init-mode="campaign" data-init-points="10"></div>
      <div data-init-mode-no-points="x"></div>
    `;

    const store: any = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => { store[k] = v; },
    });
    vi.stubGlobal('location', { reload: vi.fn() });
    stubMatchMedia(false); // desktop by default

    handler = new DOMHandler(app);
  });

  describe('initActionOverflow — "Mehr" overflow menu', () => {
    it('opens menu: hidden=false, aria-expanded=true, button active', () => {
      handler.init();
      const more = document.getElementById('action-more-btn')!;
      const menu = document.getElementById('action-overflow-menu')!;
      expect(menu.classList.contains('hidden')).toBe(true); // starts closed
      more.click();
      expect(menu.classList.contains('hidden')).toBe(false);
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect(more.classList.contains('active')).toBe(true);
    });

    it('toggles closed on second click', () => {
      handler.init();
      const more = document.getElementById('action-more-btn')!;
      const menu = document.getElementById('action-overflow-menu')!;
      more.click();
      expect(menu.classList.contains('hidden')).toBe(false);
      more.click();
      expect(menu.classList.contains('hidden')).toBe(true);
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(more.classList.contains('active')).toBe(false);
    });

    it('Escape closes an open menu', () => {
      handler.init();
      const more = document.getElementById('action-more-btn')!;
      const menu = document.getElementById('action-overflow-menu')!;
      more.click();
      expect(menu.classList.contains('hidden')).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(menu.classList.contains('hidden')).toBe(true);
    });

    it('mobile: opening the overflow shows the sheet backdrop', () => {
      stubMatchMedia(true); // mobile
      handler.init();
      const more = document.getElementById('action-more-btn')!;
      const menu = document.getElementById('action-overflow-menu')!;
      const backdrop = document.getElementById('sheet-backdrop')!;
      more.click();
      expect(menu.classList.contains('hidden')).toBe(false);
      expect(backdrop.classList.contains('hidden')).toBe(false);
      expect(backdrop.getAttribute('aria-hidden')).toBe('false');
    });

    it('no-op if the trigger/menu elements are absent (guard branch)', () => {
      // Remove the elements entirely — init must not throw.
      document.getElementById('action-more-btn')!.remove();
      document.getElementById('action-overflow-menu')!.remove();
      expect(() => handler.init()).not.toThrow();
    });
  });

  describe('initGameModeCards — data-init-mode wiring', () => {
    it('clicking a mode card inits the app with parsed mode + points', () => {
      handler.init();
      document.querySelector<HTMLElement>('[data-init-mode="campaign"]')!.click();
      expect(app.init).toHaveBeenCalledWith(10, 'campaign');
    });

    it('classic card asks before starting, and does not hide the menu', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="generic-modal" class="hidden"><h2 id="modal-title"></h2><div id="modal-message"></div><div id="modal-actions"></div></div>'
      );
      handler.init();
      const menu = document.getElementById('main-menu')!;
      document.querySelector<HTMLElement>('[data-init-mode="classic"]')!.click();
      expect(app.init).not.toHaveBeenCalled();
      expect(menu.classList.contains('active')).toBe(true);
      expect(document.getElementById('modal-title')!.textContent).toBe('Klassisch 9×9');

      const buttons = [...document.querySelectorAll('#modal-actions button')];
      (buttons.find(btn => btn.textContent === 'Sofort spielen') as HTMLButtonElement).click();
      expect(app.init).toHaveBeenCalledWith(0, 'classic');
      expect(menu.classList.contains('active')).toBe(false);
    });

    it('the upgrade choice starts the classic position with 15 points', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="generic-modal" class="hidden"><h2 id="modal-title"></h2><div id="modal-message"></div><div id="modal-actions"></div></div>'
      );
      handler.init();
      document.querySelector<HTMLElement>('[data-init-mode="classic"]')!.click();
      const buttons = [...document.querySelectorAll('#modal-actions button')];
      (
        buttons.find(btn => btn.textContent === 'Mit 15 Punkten verbessern') as HTMLButtonElement
      ).click();
      expect(app.init).toHaveBeenCalledWith(15, 'upgrade');
    });

    it('standard 8x8 card asks before starting', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="generic-modal" class="hidden"><h2 id="modal-title"></h2><div id="modal-message"></div><div id="modal-actions"></div></div>'
      );
      handler.init();
      const menu = document.getElementById('main-menu')!;
      document.querySelector<HTMLElement>('[data-init-mode="standard8x8"]')!.click();
      expect(app.init).not.toHaveBeenCalled();
      expect(menu.classList.contains('active')).toBe(true);
      expect(document.getElementById('modal-title')!.textContent).toBe('Standard 8×8');

      const buttons = [...document.querySelectorAll('#modal-actions button')];
      (buttons.find(btn => btn.textContent === 'Sofort spielen') as HTMLButtonElement).click();
      expect(app.init).toHaveBeenCalledWith(0, 'standard8x8');
      expect(menu.classList.contains('active')).toBe(false);
    });

    it('the 15 point choice starts the 8x8 position with upgrades', () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="generic-modal" class="hidden"><h2 id="modal-title"></h2><div id="modal-message"></div><div id="modal-actions"></div></div>'
      );
      handler.init();
      document.querySelector<HTMLElement>('[data-init-mode="standard8x8"]')!.click();
      const buttons = [...document.querySelectorAll('#modal-actions button')];
      (
        buttons.find(btn => btn.textContent === 'Mit 15 Punkten verbessern') as HTMLButtonElement
      ).click();
      expect(app.init).toHaveBeenCalledWith(15, 'upgrade8x8');
    });

    it('hides the main menu when a card is clicked', () => {
      handler.init();
      const menu = document.getElementById('main-menu')!;
      expect(menu.classList.contains('active')).toBe(true);
      document.querySelector<HTMLElement>('[data-init-mode="campaign"]')!.click();
      expect(menu.classList.contains('active')).toBe(false);
    });

    it('card without a mode attribute does NOT call app.init', () => {
      handler.init();
      app.init.mockClear();
      document.querySelector<HTMLElement>('[data-init-mode-no-points]')!.click();
      expect(app.init).not.toHaveBeenCalled();
    });
  });

  describe('undo button', () => {
    it('clicking Rückgängig calls undoMove and keeps the icon markup', () => {
      app.gameController.undoMove = vi.fn();
      document.body.insertAdjacentHTML(
        'beforeend',
        `<button id="undo-btn">
          <svg class="undo-icon"></svg>
          <span class="action-label">Rückgängig</span>
        </button>`
      );
      handler.init();
      const btn = document.getElementById('undo-btn')!;
      btn.click();
      expect(app.gameController.undoMove).toHaveBeenCalledTimes(1);
      expect(btn.querySelector('.undo-icon')).not.toBeNull();
      expect(btn.querySelector('.action-label')!.textContent).toBe('Rückgängig');
    });
  });

  // Redo existierte als Funktion (`redoStack`, `moveController.redoMove`,
  // Tastaturkürzel `R`) aber nie als Button — der Listener fehlte zusammen mit
  // dem Markup, ohne das `updateUndoRedoButtons` in einen toten Zweig lief.
  describe('redo button', () => {
    it('liegt im ausgelieferten Markup neben Rückgängig', () => {
      const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
      expect(html).toContain('id="redo-btn"');
      const redo = html.indexOf('id="redo-btn"');
      const undo = html.indexOf('id="undo-btn"');
      expect(redo).toBeGreaterThan(undo);
      expect(redo - undo).toBeLessThan(2000);
    });

    it('clicking Wiederholen calls redoMove', () => {
      app.gameController.redoMove = vi.fn();
      document.body.insertAdjacentHTML(
        'beforeend',
        `<button id="redo-btn">
          <svg class="redo-icon"></svg>
          <span class="action-label">Wiederholen</span>
        </button>`
      );
      handler.init();
      const btn = document.getElementById('redo-btn')!;
      btn.click();
      expect(app.gameController.redoMove).toHaveBeenCalledTimes(1);
    });
  });

  describe('initContinueButton — autosave gating', () => {
    it('stays hidden when no autosave exists', () => {
      handler.init();
      const btn = document.getElementById('main-menu-continue-btn')!;
      expect(btn.classList.contains('hidden')).toBe(true);
    });

    it('becomes visible when an autosave exists', () => {
      localStorage.setItem('schach9x9_save_autosave', 'true');
      handler.init();
      const btn = document.getElementById('main-menu-continue-btn')!;
      expect(btn.classList.contains('hidden')).toBe(false);
    });

    it('clicking continue with no gameController inits classic then loads', async () => {
      localStorage.setItem('schach9x9_save_autosave', 'true');
      app.gameController = null;
      handler.init();
      await document.getElementById('main-menu-continue-btn')!.click();
      expect(app.init).toHaveBeenCalledWith(0, 'classic');
    });
  });

  describe('initMoreModesToggle — collapse/expand', () => {
    it('toggles aria-expanded and grid.hidden + is-collapsed', () => {
      handler.init();
      const toggle = document.getElementById('toggle-more-modes')!;
      const grid = document.getElementById('more-modes-grid')!;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(grid.hidden).toBe(true);
      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(grid.hidden).toBe(false);
      expect(grid.classList.contains('is-collapsed')).toBe(false);
    });
  });
});
