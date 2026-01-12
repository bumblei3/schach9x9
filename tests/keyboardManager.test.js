/**
 * @jest-environment jsdom
 */


import { KeyboardManager } from '../js/input/KeyboardManager.js';

// Mock dynamic import for ui.js
vi.mock('../js/ui.js', () => ({
  showToast: vi.fn(),
  closeModal: vi.fn(),
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  OverlayManager: { closeAll: vi.fn() },
}));

describe('KeyboardManager', () => {
  let app;
  let keyboardManager;
  let mockGameController;
  let mockTutorController;

  beforeEach(() => {
    mockGameController = {
      undoMove: vi.fn(),
      redoMove: vi.fn(),
      saveGame: vi.fn(),
      resetSelection: vi.fn(),
    };
    mockTutorController = {
      showHint: vi.fn(),
    };
    app = {
      gameController: mockGameController,
      tutorController: mockTutorController,
      game: { selectedSquare: { r: 0, c: 0 }, validMoves: [] },
      toggleFullscreen: vi.fn(),
    };

    keyboardManager = new KeyboardManager(app);
  });

  afterEach(() => {
    keyboardManager.dispose();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should initialize and add event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    new KeyboardManager(app);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should remove event listener on dispose', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    keyboardManager.dispose();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should call undoMove on Ctrl+Z', async () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    Object.defineProperty(event, 'target', { value: document.body });
    vi.spyOn(event, 'preventDefault');

    await keyboardManager.handleKeyDown(event);

    expect(mockGameController.undoMove).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should call undoMove on "u" key', async () => {
    const event = new KeyboardEvent('keydown', { key: 'u' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.undoMove).toHaveBeenCalled();
  });

  it('should call redoMove on Ctrl+Y', async () => {
    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.redoMove).toHaveBeenCalled();
  });

  it('should call redoMove on "r" key', async () => {
    const event = new KeyboardEvent('keydown', { key: 'r' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.redoMove).toHaveBeenCalled();
  });

  it('should call showHint on "h" key', async () => {
    const event = new KeyboardEvent('keydown', { key: 'h' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockTutorController.showHint).toHaveBeenCalled();
  });

  it('should call saveGame on "s" key', async () => {
    const event = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.saveGame).toHaveBeenCalled();
  });

  it('should call toggleFullscreen on "f" key', async () => {
    const event = new KeyboardEvent('keydown', { key: 'f' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.toggleFullscreen).toHaveBeenCalled();
  });

  it('should handle Escape key to reset selection', async () => {
    const event = new KeyboardEvent('keydown', { key: 'escape' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.resetSelection).toHaveBeenCalled();
  });

  it('should handle Escape key with fallback if resetSelection is missing', async () => {
    delete app.gameController.resetSelection;
    const { renderBoard } = await import('../js/ui.js');

    const event = new KeyboardEvent('keydown', { key: 'escape' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);

    expect(app.game.selectedSquare).toBeNull();
    expect(app.game.validMoves).toEqual([]);
    expect(renderBoard).toHaveBeenCalled();
  });

  it('should ignore shortcuts in textarea', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 'u', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });

    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.undoMove).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('should ignore shortcuts in contentEditable elements', async () => {
    const div = document.createElement('div');
    // Important: JSDOM might not automatically set isContentEditable even if contentEditable='true'
    // depending on version/environment, so we define it.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    document.body.appendChild(div);
    div.focus();

    const event = new KeyboardEvent('keydown', { key: 'u', bubbles: true });
    Object.defineProperty(event, 'target', { value: div });

    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.undoMove).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('should call redoMove on Ctrl+Shift+Z', async () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.redoMove).toHaveBeenCalled();
  });

  it('should do nothing on hint key if tutorController is missing', async () => {
    delete app.tutorController;
    const event = new KeyboardEvent('keydown', { key: 'h' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    // Should not crash
  });

  it('should do nothing on save key if saveGame is missing', async () => {
    delete app.gameController.saveGame;
    const event = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    // Should not crash
  });

  it('should do nothing on fullscreen key if toggleFullscreen is missing', async () => {
    delete app.toggleFullscreen;
    const event = new KeyboardEvent('keydown', { key: 'f' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    // Should not crash
  });

  // Analysis Tools Tests
  it('should toggle threats on "t" key', async () => {
    app.game.analysisManager = { toggleThreats: vi.fn(() => true) };
    const event = new KeyboardEvent('keydown', { key: 't' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.game.analysisManager.toggleThreats).toHaveBeenCalled();
  });

  it('should toggle opportunities on "o" key', async () => {
    app.game.analysisManager = { toggleOpportunities: vi.fn(() => true) };
    const event = new KeyboardEvent('keydown', { key: 'o' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.game.analysisManager.toggleOpportunities).toHaveBeenCalled();
  });

  it('should toggle best move on "b" key', async () => {
    app.game.analysisManager = { toggleBestMove: vi.fn(() => true) };
    const event = new KeyboardEvent('keydown', { key: 'b' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.game.analysisManager.toggleBestMove).toHaveBeenCalled();
  });

  it('should handle analysis keys safely if analysisManager is missing', async () => {
    delete app.game.analysisManager;
    const keys = ['t', 'o', 'b'];
    for (const key of keys) {
      const event = new KeyboardEvent('keydown', { key });
      Object.defineProperty(event, 'target', { value: document.body });
      await keyboardManager.handleKeyDown(event);
      // Should not crash
    }
  });

  it('should handle Escape key when no square is selected', async () => {
    app.game.selectedSquare = null;
    const { closeModal, OverlayManager } = await import('../js/ui.js');

    const event = new KeyboardEvent('keydown', { key: 'escape' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);

    // Should still close modals but not try to deselect
    expect(mockGameController.resetSelection).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(OverlayManager.closeAll).toHaveBeenCalled();
  });

  it('should do nothing if app.game is missing', async () => {
    delete app.game;
    const event = new KeyboardEvent('keydown', { key: 'u' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.undoMove).not.toHaveBeenCalled();
  });

  it('should ignore shortcuts if active element is an input', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'u', bubbles: true });
    // JSDOM doesn't automatically set event.target correctly with new KeyboardEvent constructor if not dispatched
    Object.defineProperty(event, 'target', { value: input });

    await keyboardManager.handleKeyDown(event);
    expect(mockGameController.undoMove).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('should trigger emergency recovery on Ctrl+Shift+F12', async () => {
    const recoverySpy = vi.spyOn(keyboardManager, 'performEmergencyRecovery');

    const event = new KeyboardEvent('keydown', {
      key: 'f12',
      ctrlKey: true,
      shiftKey: true,
    });
    Object.defineProperty(event, 'target', { value: document.body });
    vi.spyOn(event, 'preventDefault');

    await keyboardManager.handleKeyDown(event);

    expect(recoverySpy).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should perform emergency recovery correctly', async () => {
    app.game.turn = 'black';
    app.game.isAnimating = true;
    app.game.selectedSquare = { r: 0, c: 0 };
    app.game.validMoves = [{ r: 1, c: 1 }];
    app.game._forceFullRender = false;

    // Add spinner overlay
    document.body.innerHTML = '<div id="spinner-overlay" style="display:block"></div>';

    keyboardManager.performEmergencyRecovery();

    expect(app.game.turn).toBe('white');
    expect(app.game.isAnimating).toBe(false);
    expect(app.game.selectedSquare).toBeNull();
    expect(app.game._forceFullRender).toBe(true);

    const spinner = document.getElementById('spinner-overlay');
    expect(spinner.style.display).toBe('none');
  });

  it('should update threats button class when pressing "t"', async () => {
    document.body.innerHTML = '<button id="threats-btn"></button>';
    app.game.analysisManager = { toggleThreats: vi.fn(() => true) };

    const event = new KeyboardEvent('keydown', { key: 't' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);

    const btn = document.getElementById('threats-btn');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('should update opportunities button class when pressing "o"', async () => {
    document.body.innerHTML = '<button id="opportunities-btn"></button>';
    app.game.analysisManager = { toggleOpportunities: vi.fn(() => true) };

    const event = new KeyboardEvent('keydown', { key: 'o' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);

    const btn = document.getElementById('opportunities-btn');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('should update best-move button class when pressing "b"', async () => {
    document.body.innerHTML = '<button id="best-move-btn"></button>';
    app.game.analysisManager = { toggleBestMove: vi.fn(() => true) };

    const event = new KeyboardEvent('keydown', { key: 'b' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);

    const btn = document.getElementById('best-move-btn');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('should not crash if game is missing during emergency recovery', () => {
    delete app.game;
    expect(() => keyboardManager.performEmergencyRecovery()).not.toThrow();
  });
});
