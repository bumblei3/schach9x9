import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../js/gameEngine.js';
import { storageManager } from '../js/storage.js';
import { setCurrentBoardShape, getCurrentBoardShape, BOARD_SHAPES } from '../js/config.js';

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  clear: () => {
    for (const key in store) delete store[key];
  },
});

describe('Persistence & Board Shape', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentBoardShape(BOARD_SHAPES.STANDARD);
  });

  it('should save and load boardShape correctly in CROSS mode', () => {
    const game = new Game(15, 'cross');
    expect(game.boardShape).toBe(BOARD_SHAPES.CROSS);
    expect(getCurrentBoardShape()).toBe(BOARD_SHAPES.CROSS);

    // Save game
    storageManager.saveGame(game as any, 'test_cross');

    // Reset global state to simulate a fresh load
    setCurrentBoardShape(BOARD_SHAPES.STANDARD);
    expect(getCurrentBoardShape()).toBe(BOARD_SHAPES.STANDARD);

    // Load into a new game instance
    const newGame = new Game(15, 'setup'); // starts as standard
    expect(newGame.boardShape).toBe(BOARD_SHAPES.STANDARD);

    const savedState = storageManager.loadGame('test_cross');
    expect(savedState?.boardShape).toBe(BOARD_SHAPES.CROSS);

    storageManager.loadStateIntoGame(newGame as any, savedState);

    expect(newGame.boardShape).toBe(BOARD_SHAPES.CROSS);
    expect(getCurrentBoardShape()).toBe(BOARD_SHAPES.CROSS);
  });

  it('should fall back to standard if boardShape is missing in save', () => {
    const game = new Game(15, 'classic');
    storageManager.saveGame(game as any, 'test_default');

    // Manually corrupt the save in localStorage to remove boardShape
    const raw = localStorage.getItem('schach9x9_save_test_default');
    if (raw) {
      const data = JSON.parse(raw);
      delete data.boardShape;
      localStorage.setItem('schach9x9_save_test_default', JSON.stringify(data));
    }

    const newGame = new Game(15, 'setup');
    const state = storageManager.loadGame('test_default');
    storageManager.loadStateIntoGame(newGame as any, state);

    expect(newGame.boardShape).toBe(BOARD_SHAPES.STANDARD);
    expect(getCurrentBoardShape()).toBe(BOARD_SHAPES.STANDARD);
  });
});
