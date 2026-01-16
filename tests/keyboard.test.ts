import { describe, expect, test, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { KeyboardManager } from '../js/input/KeyboardManager.js';
import { setupJSDOM } from './test-utils.js';

// Mock dependencies
vi.mock('../js/ui.js', () => ({
  showToast: vi.fn(),
  closeModal: vi.fn(),
  renderBoard: vi.fn(),
  toggleShop: vi.fn(),
  OverlayManager: { closeAll: vi.fn() },
}));

let UI: any;

beforeAll(async () => {
  UI = await import('../js/ui.js');
});

describe('KeyboardManager', () => {
  let app: any;
  let keyboardManager: KeyboardManager;
  let gameController: any;
  let tutorController: any;

  beforeEach(() => {
    setupJSDOM();

    // Mock App structure
    gameController = {
      undoMove: vi.fn(),
      redoMove: vi.fn(),
      saveGame: vi.fn(),
      handleEscape: vi.fn(),
      handleCellClick: vi.fn(),
      resetSelection: vi.fn(),
    };

    tutorController = {
      showHint: vi.fn(),
    };

    app = {
      game: {
        gameController: gameController, // Circular ref simulation
        selectedSquare: null,
        validMoves: [],
        deselectSquare: vi.fn(),
      },
      gameController: gameController,
      tutorController: tutorController,
    };

    keyboardManager = new KeyboardManager(app);
  });

  afterEach(() => {
    keyboardManager.dispose();
    vi.clearAllMocks();
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

    // Check behavior
    if (UI.closeModal) expect(UI.closeModal).toHaveBeenCalled();
    if (UI.OverlayManager) expect(UI.OverlayManager.closeAll).toHaveBeenCalled();

    // Assuming the fallback logic triggers handleCellClick to deselect or resetSelection
    if (gameController.resetSelection.mock.calls.length > 0) {
      expect(gameController.resetSelection).toHaveBeenCalled();
    } else {
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
      preventDefault: vi.fn(),
    };

    keyboardManager.handleKeyDown(event as any);
    expect(gameController.undoMove).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
