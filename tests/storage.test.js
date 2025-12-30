import { jest } from '@jest/globals';
import { StorageManager } from '../js/storage.js';
import { PHASES } from '../js/gameEngine.js';

// Mock localStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('StorageManager', () => {
  let storageManager;
  let mockGame;

  beforeEach(() => {
    storageManager = new StorageManager();
    localStorage.clear();
    jest.clearAllMocks();

    mockGame = {
      mode: 'classic',
      difficulty: 'medium',
      isAI: true,
      board: Array(9).fill(Array(9).fill(null)),
      turn: 'white',
      phase: PHASES.PLAY,
      points: 0,
      moveHistory: [{ from: { r: 1, c: 1 }, to: { r: 3, c: 1 } }],
      capturedPieces: { white: [], black: ['p'] },
      whiteTime: 300,
      blackTime: 300,
      clockEnabled: true,
      lastMove: { from: { r: 1, c: 1 }, to: { r: 3, c: 1 } },
    };
  });

  test('should save game state correctly', () => {
    const result = storageManager.saveGame(mockGame, 'test-slot');
    expect(result).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalled();

    const saveKey = 'schach9x9_save_test-slot';
    const savedData = JSON.parse(localStorage.getItem(saveKey));

    expect(savedData.mode).toBe('classic');
    expect(savedData.turn).toBe('white');
    expect(savedData.moveHistory).toHaveLength(1);
    expect(savedData.capturedPieces.black).toContain('p');
  });

  test('should load game state correctly', () => {
    storageManager.saveGame(mockGame, 'test-slot');
    const loadedState = storageManager.loadGame('test-slot');

    expect(loadedState).not.toBeNull();
    expect(loadedState.mode).toBe('classic');
    expect(loadedState.turn).toBe('white');
  });

  test('should return null if no save exists', () => {
    const loadedState = storageManager.loadGame('non-existent');
    expect(loadedState).toBeNull();
  });

  test('should check if save exists', () => {
    expect(storageManager.hasSave('test-slot')).toBe(false);
    storageManager.saveGame(mockGame, 'test-slot');
    expect(storageManager.hasSave('test-slot')).toBe(true);
  });

  test('should load state into game object', () => {
    storageManager.saveGame(mockGame, 'test-slot');
    const loadedState = storageManager.loadGame('test-slot');

    const targetGame = {};
    const success = storageManager.loadStateIntoGame(targetGame, loadedState);

    expect(success).toBe(true);
    expect(targetGame.mode).toBe('classic');
    expect(targetGame.moveHistory).toHaveLength(1);
    expect(targetGame.capturedPieces.black).toEqual(['p']);
    expect(targetGame.points).toBe(0);
  });

  test('should handle autosave default slot', () => {
    storageManager.saveGame(mockGame); // Default is 'autosave'
    expect(localStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('autosave'),
      expect.any(String)
    );
    expect(storageManager.hasSave('autosave')).toBe(true);
  });
});
