/**
 * Storage Manager for Schach 9x9
 * Handles saving and loading of game state
 * @module storage
 */

import { logger } from './logger.js';
import type { Player, Piece, Square } from './types/game.js';
import type { Phase, AIDifficulty, BoardShape } from './config.js';
import { setCurrentBoardShape } from './config.js';

export interface SavedGameState {
  timestamp: number;
  mode: string;
  boardShape?: BoardShape;
  difficulty: AIDifficulty;
  isAI: boolean;
  savedAt: string;
  board: (Piece | null)[][];
  turn: Player;
  phase: Phase;
  points: number;
  moveHistory: unknown[];
  capturedPieces: { white: Piece[]; black: Piece[] };
  whiteTime: number;
  blackTime: number;
  clockEnabled: boolean;
  lastMove: { from: Square; to: Square; piece: Piece } | null;
}

export interface GameLike {
  mode: string;
  boardShape?: BoardShape;
  difficulty: AIDifficulty;
  isAI: boolean;
  board: (Piece | null)[][];
  turn: Player;
  phase: Phase;
  points: number;
  moveHistory: unknown[];
  capturedPieces: { white: Piece[]; black: Piece[] };
  whiteTime: number;
  blackTime: number;
  clockEnabled: boolean;
  lastMove: { from: Square; to: Square; piece: Piece } | null;
  selectedSquare: Square | null;
  validMoves: Square[] | null;
}

export class StorageManager {
  private readonly storageKey: string = 'schach9x9_save_';

  /**
   * Save the game state
   */
  saveGame(game: GameLike, slotName: string = 'autosave'): boolean {
    try {
      const gameState: SavedGameState = {
        timestamp: Date.now(),
        mode: game.mode,
        boardShape: game.boardShape,
        difficulty: game.difficulty,
        isAI: game.isAI,
        savedAt: new Date().toISOString(),
        board: game.board,
        turn: game.turn,
        phase: game.phase,
        points: game.points,
        moveHistory: game.moveHistory,
        capturedPieces: game.capturedPieces,
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
        clockEnabled: game.clockEnabled,
        lastMove: game.lastMove,
      };

      const key = this.storageKey + slotName;
      const json = JSON.stringify(gameState);
      localStorage.setItem(key, json);
      logger.info(`[Storage] Game saved to ${key} (${json.length} bytes)`);
      return true;
    } catch (error) {
      logger.error('[Storage] Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load a game state
   */
  loadGame(slotName: string = 'autosave'): SavedGameState | null {
    const key = this.storageKey + slotName;
    const json = localStorage.getItem(key);

    if (!json) {
      logger.warn(`[Storage] No save found for ${key}`);
      return null;
    }

    try {
      const state = JSON.parse(json) as SavedGameState;
      logger.info(`[Storage] Game loaded from ${key}`);
      return state;
    } catch (error) {
      logger.error('[Storage] Failed to parse save game:', error);
      throw new Error('CORRUPT_SAVE');
    }
  }

  /**
   * Check if a save exists
   */
  hasSave(slotName: string = 'autosave'): boolean {
    return localStorage.getItem(this.storageKey + slotName) !== null;
  }

  /**
   * Apply a saved state to a game instance
   */
  loadStateIntoGame(game: GameLike, state: SavedGameState | null): boolean {
    if (!state) return false;

    // Restore basic types
    game.mode = state.mode;
    game.boardShape = state.boardShape || 'standard';
    setCurrentBoardShape(game.boardShape);

    game.difficulty = state.difficulty;
    game.isAI = state.isAI;
    game.turn = state.turn;
    game.phase = state.phase;
    game.points = state.points || 0;

    // Restore deep structures
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
