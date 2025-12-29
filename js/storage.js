/**
 * Storage Manager for Schach 9x9
 * Handles saving and loading of game state
 * @module storage
 */

// import { BOARD_SIZE, PHASES } from './config.js';

export class StorageManager {
  constructor() {
    this.storageKey = 'schach9x9_save_';
    this.autoSaveKey = 'autosave';
  }

  /**
   * Save the game state
   * @param {Game} game - The game instance
   * @param {string} slotName - Name of the save slot (default: 'autosave')
   */
  saveGame(game, slotName = 'autosave') {
    try {
      const gameState = {
        timestamp: Date.now(),
        mode: game.mode,
        difficulty: game.difficulty,
        isAI: game.isAI,
        savedAt: new Date().toISOString(),
        // Core State
        board: game.board,
        turn: game.turn,
        phase: game.phase,
        points: game.points, // Setup phase points
        // History & Captures
        moveHistory: game.moveHistory, // Assumes serializable
        capturedPieces: game.capturedPieces,
        // Time
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
        clockEnabled: game.clockEnabled,
        // Meta
        lastMove: game.lastMove,
      };

      const key = this.storageKey + slotName;
      const json = JSON.stringify(gameState);
      localStorage.setItem(key, json);
      console.log(`[Storage] Game saved to ${key} (${json.length} bytes)`);
      return true;
    } catch (error) {
      console.error('[Storage] Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load a game state
   * @param {string} slotName - Name of the save slot
   * @returns {object|null} The deserialized game state or null
   */
  loadGame(slotName = 'autosave') {
    const key = this.storageKey + slotName;
    const json = localStorage.getItem(key);

    if (!json) {
      console.warn(`[Storage] No save found for ${key}`);
      return null;
    }

    try {
      const state = JSON.parse(json);
      console.log(`[Storage] Game loaded from ${key}`);
      return state;
    } catch (error) {
      console.error('[Storage] Failed to parse save game:', error);
      throw new Error('CORRUPT_SAVE');
    }
  }

  /**
   * Check if a save exists
   */
  hasSave(slotName = 'autosave') {
    return localStorage.getItem(this.storageKey + slotName) !== null;
  }

  /**
   * Apply a saved state to a game instance
   * Note: This modifies the game in-place. Alternatively, create a new Game.
   * @param {Game} game - The game object to hydrate
   * @param {object} state - The loaded state object
   */
  loadStateIntoGame(game, state) {
    if (!state) return false;

    // Restore basic types
    game.mode = state.mode;
    game.difficulty = state.difficulty;
    game.isAI = state.isAI;
    game.turn = state.turn;
    game.phase = state.phase;
    game.points = state.points || 0;

    // Restore deep structures (JSON.parse creates new objects, which is fine)
    game.board = state.board;
    game.moveHistory = state.moveHistory || [];
    game.capturedPieces = state.capturedPieces || { white: [], black: [] };

    // Restore Clock
    game.whiteTime = state.whiteTime;
    game.blackTime = state.blackTime;
    game.clockEnabled = state.clockEnabled;

    game.lastMove = state.lastMove || null;

    // Reset specialized state
    game.selectedSquare = null;
    game.validMoves = null;

    return true;
  }
}

export const storageManager = new StorageManager();
