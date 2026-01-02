import { jest } from '@jest/globals';
import { KeyboardManager } from '../js/input/KeyboardManager.js';
import { setupJSDOM } from './test-utils.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  showToast: jest.fn(),
  closeModal: jest.fn(),
  renderBoard: jest.fn(),
  toggleShop: jest.fn(),
  OverlayManager: { closeAll: jest.fn() },
}));

let UI;

beforeAll(async () => {
  UI = await import('../js/ui.js');
});

describe('KeyboardManager', () => {
  let app;
  let keyboardManager;
  let gameController;
  let tutorController;

  beforeEach(() => {
    setupJSDOM();

    // Mock App structure
    gameController = {
      undoMove: jest.fn(),
      redoMove: jest.fn(),
      saveGame: jest.fn(),
      handleEscape: jest.fn(),
      handleCellClick: jest.fn(),
      resetSelection: jest.fn(),
    };

    tutorController = {
      showHint: jest.fn(),
    };

    app = {
      game: {
        gameController: gameController, // Circular ref simulation
        selectedSquare: null,
        validMoves: [],
        deselectSquare: jest.fn(),
      },
      gameController: gameController,
      tutorController: tutorController,
    };

    keyboardManager = new KeyboardManager(app);
  });

  afterEach(() => {
    keyboardManager.dispose();
    jest.clearAllMocks();
  });

  test('should trigger undo on Ctrl+Z', async () => {
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gameController.undoMove).toHaveBeenCalled();
    expect(UI.showToast).toHaveBeenCalledWith('Undo', 'info');
  });

  test('should trigger undo on U', async () => {
    const event = new KeyboardEvent('keydown', { key: 'u' });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gameController.undoMove).toHaveBeenCalled();
  });

  test('should trigger redo on Ctrl+Y', async () => {
    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gameController.redoMove).toHaveBeenCalled();
    expect(UI.showToast).toHaveBeenCalledWith('Redo', 'info');
  });

  test('should trigger redo on R', async () => {
    const event = new KeyboardEvent('keydown', { key: 'r' });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gameController.redoMove).toHaveBeenCalled();
  });

  test('should trigger hint on H', async () => {
    const event = new KeyboardEvent('keydown', { key: 'h' });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(tutorController.showHint).toHaveBeenCalled();
  });

  test('should trigger save on S', async () => {
    const event = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(gameController.saveGame).toHaveBeenCalled();
  });

  test('should handle Escape key (close modal and deselect)', async () => {
    app.game.selectedSquare = { r: 1, c: 1 };

    // Simulate generic escape
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 0));

    // Expect calls
    // Escape logic calls UI.closeModal() if it exists on UI object, and UI.OverlayManager.closeAll() if exists
    // In this test, we mocked imports.

    // Check behavior
    if (UI.closeModal) expect(UI.closeModal).toHaveBeenCalled();
    if (UI.OverlayManager) expect(UI.OverlayManager.closeAll).toHaveBeenCalled();

    // Assuming the fallback logic triggers handleCellClick to deselect or resetSelection
    if (gameController.resetSelection.mock.calls.length > 0) {
      expect(gameController.resetSelection).toHaveBeenCalled();
    } else {
      // handleCellClick might be called with selectedSquare coords OR different approach if not resetSelection
      // The logic in KeyboardManager says:
      // if (resetSelection) ... else { renderBoard... }
      // Our mock gameController has resetSelection.
      expect(gameController.resetSelection).toHaveBeenCalled();
    }
  });

  test('should ignore input when typing in text fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    // Mock event target
    const event = {
      key: 'u',
      ctrlKey: false,
      target: input,
      preventDefault: jest.fn(),
    };

    keyboardManager.handleKeyDown(event);
    expect(gameController.undoMove).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
