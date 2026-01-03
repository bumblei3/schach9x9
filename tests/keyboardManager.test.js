/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { KeyboardManager } from '../js/input/KeyboardManager.js';

// Mock dynamic import for ui.js
jest.unstable_mockModule('../js/ui.js', () => ({
  showToast: jest.fn(),
  closeModal: jest.fn(),
  renderBoard: jest.fn(),
  OverlayManager: { closeAll: jest.fn() },
}));

describe('KeyboardManager', () => {
  let app;
  let keyboardManager;
  let mockGameController;
  let mockTutorController;

  beforeEach(() => {
    mockGameController = {
      undoMove: jest.fn(),
      redoMove: jest.fn(),
      saveGame: jest.fn(),
      resetSelection: jest.fn(),
    };
    mockTutorController = {
      showHint: jest.fn(),
    };
    app = {
      gameController: mockGameController,
      tutorController: mockTutorController,
      game: { selectedSquare: { r: 0, c: 0 }, validMoves: [] },
      toggleFullscreen: jest.fn(),
    };

    keyboardManager = new KeyboardManager(app);
  });

  afterEach(() => {
    keyboardManager.dispose();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should initialize and add event listener', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    new KeyboardManager(app);
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should remove event listener on dispose', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    keyboardManager.dispose();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should call undoMove on Ctrl+Z', async () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    Object.defineProperty(event, 'target', { value: document.body });
    jest.spyOn(event, 'preventDefault');

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
    app.game.analysisManager = { toggleThreats: jest.fn(() => true) };
    const event = new KeyboardEvent('keydown', { key: 't' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.game.analysisManager.toggleThreats).toHaveBeenCalled();
  });

  it('should toggle opportunities on "o" key', async () => {
    app.game.analysisManager = { toggleOpportunities: jest.fn(() => true) };
    const event = new KeyboardEvent('keydown', { key: 'o' });
    Object.defineProperty(event, 'target', { value: document.body });
    await keyboardManager.handleKeyDown(event);
    expect(app.game.analysisManager.toggleOpportunities).toHaveBeenCalled();
  });

  it('should toggle best move on "b" key', async () => {
    app.game.analysisManager = { toggleBestMove: jest.fn(() => true) };
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
});
