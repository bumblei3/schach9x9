/**
 * Statistics Manager for Schach 9x9
 * Manages game history, statistics, and exports/imports
 */

import { logger } from './logger.js';

const STORAGE_KEY = 'chess9x9-game-history';

/**
 * Generates a unique ID for games
 * @returns {string} UUID-like string
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Manages persistent game statistics and history
 */
export class StatisticsManager {
  constructor() {
    this.data = this.loadData();
    logger.info('StatisticsManager initialized');
  }

  /**
   * Loads data from localStorage
   * @returns {Object} Game history data
   */
  loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        logger.info(`Loaded ${parsed.games?.length || 0} games from storage`);
        return parsed;
      }
    } catch (err) {
      logger.error('Error loading game history:', err);
    }

    // Return default structure
    return {
      games: [],
      stats: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      },
    };
  }

  /**
   * Saves data to localStorage
   */
  saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      logger.debug('Game history saved to storage');
    } catch (err) {
      logger.error('Error saving game history:', err);
    }
  }

  /**
   * Saves a completed game to history
   * @param {Object} gameData Game data object
   * @param {string} gameData.result - 'win', 'loss', or 'draw'
   * @param {string} gameData.playerColor - 'white' or 'black'
   * @param {string} gameData.opponent - Opponent name (e.g., 'AI-Beginner')
   * @param {Array} gameData.moveHistory - Array of moves
   * @param {number} gameData.duration - Game duration in milliseconds
   * @param {string} gameData.finalPosition - Final board position
   */
  saveGame(gameData) {
    const game = {
      id: generateId(),
      date: new Date().toISOString(),
      result: gameData.result || 'draw',
      playerColor: gameData.playerColor || 'white',
      opponent: gameData.opponent || 'Unknown',
      moves: gameData.moveHistory?.length || 0,
      duration: gameData.duration || 0,
      moveHistory: gameData.moveHistory || [],
      finalPosition: gameData.finalPosition || '',
    };

    this.data.games.push(game);

    // Update statistics
    this.data.stats.totalGames++;
    if (game.result === 'win') {
      this.data.stats.wins++;
    } else if (game.result === 'loss') {
      this.data.stats.losses++;
    } else {
      this.data.stats.draws++;
    }

    // Calculate win rate
    this.data.stats.winRate =
      this.data.stats.totalGames > 0 ? this.data.stats.wins / this.data.stats.totalGames : 0;

    this.saveData();
    logger.info(`Game saved: ${game.result} vs ${game.opponent} (${game.moves} moves)`);
  }

  /**
   * Gets aggregate statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return { ...this.data.stats };
  }

  /**
   * Gets game history with optional filters
   * @param {Object} filters Filter options
   * @param {string} filters.result - Filter by result ('win', 'loss', 'draw')
   * @param {string} filters.opponent - Filter by opponent name
   * @param {number} filters.limit - Limit number of results
   * @returns {Array} Filtered game history
   */
  getGameHistory(filters = {}) {
    let games = [...this.data.games];

    // Filter by result
    if (filters.result) {
      games = games.filter(g => g.result === filters.result);
    }

    // Filter by opponent
    if (filters.opponent) {
      games = games.filter(g => g.opponent.includes(filters.opponent));
    }

    // Sort by date (newest first)
    games.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit results
    if (filters.limit && filters.limit > 0) {
      games = games.slice(0, filters.limit);
    }

    return games;
  }

  /**
   * Gets a specific game by ID
   * @param {string} id Game ID
   * @returns {Object|null} Game data or null if not found
   */
  getGameById(id) {
    return this.data.games.find(g => g.id === id) || null;
  }

  /**
   * Exports all games as JSON
   * @returns {string} JSON string of all game data
   */
  exportGames() {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: this.data,
    };

    logger.info(`Exported ${this.data.games.length} games`);
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports games from JSON
   * @param {string} jsonData JSON string to import
   * @param {boolean} merge If true, merge with existing data; if false, replace
   * @returns {boolean} Success status
   */
  importGames(jsonData, merge = true) {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.data || !importData.data.games) {
        throw new Error('Invalid import format');
      }

      if (merge) {
        // Merge games (avoid duplicates by ID)
        const existingIds = new Set(this.data.games.map(g => g.id));
        const newGames = importData.data.games.filter(g => !existingIds.has(g.id));
        this.data.games.push(...newGames);

        // Recalculate stats from all games
        this.recalculateStats();
        logger.info(`Imported ${newGames.length} new games (merged)`);
      } else {
        // Replace all data
        this.data = importData.data;
        logger.info(`Imported ${this.data.games.length} games (replaced)`);
      }

      this.saveData();
      return true;
    } catch (err) {
      logger.error('Error importing games:', err);
      return false;
    }
  }

  /**
   * Recalculates statistics from game history
   */
  recalculateStats() {
    const stats = {
      totalGames: this.data.games.length,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
    };

    this.data.games.forEach(game => {
      if (game.result === 'win') stats.wins++;
      else if (game.result === 'loss') stats.losses++;
      else stats.draws++;
    });

    stats.winRate = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;
    this.data.stats = stats;
  }

  /**
   * Clears all game history
   * @param {boolean} confirm Confirmation flag
   */
  clearHistory(confirm = false) {
    if (!confirm) {
      logger.warn('clearHistory called without confirmation');
      return;
    }

    this.data = {
      games: [],
      stats: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      },
    };

    this.saveData();
    logger.info('Game history cleared');
  }

  /**
   * Gets statistics for a specific time period
   * @param {number} days Number of days to look back
   * @returns {Object} Statistics for the period
   */
  getRecentStats(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentGames = this.data.games.filter(g => new Date(g.date) > cutoffDate);

    const stats = {
      totalGames: recentGames.length,
      wins: recentGames.filter(g => g.result === 'win').length,
      losses: recentGames.filter(g => g.result === 'loss').length,
      draws: recentGames.filter(g => g.result === 'draw').length,
    };

    stats.winRate = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;

    return stats;
  }

  /**
   * Gets statistics grouped by opponent
   * @returns {Object} Stats by opponent
   */
  getStatsByOpponent() {
    const byOpponent = {};

    this.data.games.forEach(game => {
      if (!byOpponent[game.opponent]) {
        byOpponent[game.opponent] = {
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
        };
      }

      const stats = byOpponent[game.opponent];
      stats.totalGames++;
      if (game.result === 'win') stats.wins++;
      else if (game.result === 'loss') stats.losses++;
      else stats.draws++;
      stats.winRate = stats.wins / stats.totalGames;
    });

    return byOpponent;
  }
}
