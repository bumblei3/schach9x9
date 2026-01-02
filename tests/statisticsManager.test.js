/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { StatisticsManager } from '../js/statisticsManager.js';
import { logger } from '../js/logger.js';

describe('StatisticsManager', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    manager = new StatisticsManager();
  });

  describe('Initialization', () => {
    test('should initialize with empty data', () => {
      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    test('should load existing data from localStorage', () => {
      const testData = {
        games: [{ id: '1', result: 'win' }],
        stats: { totalGames: 1, wins: 1, losses: 0, draws: 0, winRate: 1 },
      };
      localStorage.setItem('chess9x9-game-history', JSON.stringify(testData));

      const newManager = new StatisticsManager();
      const stats = newManager.getStatistics();
      expect(stats.totalGames).toBe(1);
      expect(stats.wins).toBe(1);
    });
  });

  describe('saveGame', () => {
    test('should save a game and update statistics', () => {
      manager.saveGame({
        result: 'win',
        playerColor: 'white',
        opponent: 'AI-Beginner',
        moveHistory: ['e2-e4', 'e7-e5'],
        duration: 30000,
        finalPosition: 'test-position',
      });

      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.winRate).toBe(1);

      const history = manager.getGameHistory();
      expect(history.length).toBe(1);
      expect(history[0].result).toBe('win');
      expect(history[0].opponent).toBe('AI-Beginner');
    });

    test('should calculate win rate correctly', () => {
      manager.saveGame({ result: 'win' });
      manager.saveGame({ result: 'loss' });
      manager.saveGame({ result: 'draw' });

      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.draws).toBe(1);
      expect(stats.winRate).toBeCloseTo(1 / 3);
    });

    test('should persist data to localStorage', () => {
      manager.saveGame({ result: 'win' });

      const stored = JSON.parse(localStorage.getItem('chess9x9-game-history'));
      expect(stored.games.length).toBe(1);
      expect(stored.stats.totalGames).toBe(1);
    });
  });

  describe('getGameHistory', () => {
    beforeEach(() => {
      manager.saveGame({ result: 'win', opponent: 'AI-Easy' });
      manager.saveGame({ result: 'loss', opponent: 'AI-Hard' });
      manager.saveGame({ result: 'draw', opponent: 'AI-Easy' });
      manager.saveGame({ result: 'win', opponent: 'AI-Hard' });
    });

    test('should return all games by default', () => {
      const games = manager.getGameHistory();
      expect(games.length).toBe(4);
    });

    test('should filter by result', () => {
      const wins = manager.getGameHistory({ result: 'win' });
      expect(wins.length).toBe(2);
      expect(wins.every(g => g.result === 'win')).toBe(true);
    });

    test('should filter by opponent', () => {
      const easyGames = manager.getGameHistory({ opponent: 'Easy' });
      expect(easyGames.length).toBe(2);
      expect(easyGames.every(g => g.opponent.includes('Easy'))).toBe(true);
    });

    test('should limit results', () => {
      const limited = manager.getGameHistory({ limit: 2 });
      expect(limited.length).toBe(2);
    });

    test('should sort by date (newest first)', () => {
      const games = manager.getGameHistory();
      for (let i = 1; i < games.length; i++) {
        expect(new Date(games[i - 1].date) >= new Date(games[i].date)).toBe(true);
      }
    });
  });

  describe('getGameById', () => {
    test('should return game by ID', () => {
      manager.saveGame({ result: 'win' });
      const games = manager.getGameHistory();
      const gameId = games[0].id;

      const foundGame = manager.getGameById(gameId);
      expect(foundGame).toBeTruthy();
      expect(foundGame.id).toBe(gameId);
    });

    test('should return null for non-existent ID', () => {
      const foundGame = manager.getGameById('non-existent-id');
      expect(foundGame).toBeNull();
    });
  });

  describe('exportGames', () => {
    test('should export games as JSON string', () => {
      manager.saveGame({ result: 'win' });
      manager.saveGame({ result: 'loss' });

      const exported = manager.exportGames();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe('1.0');
      expect(parsed.exportDate).toBeTruthy();
      expect(parsed.data.games.length).toBe(2);
      expect(parsed.data.stats.totalGames).toBe(2);
    });
  });

  describe('importGames', () => {
    test('should import games (merge mode)', () => {
      manager.saveGame({ result: 'win', opponent: 'Original' });

      const importData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          games: [
            {
              id: 'imported-1',
              result: 'loss',
              opponent: 'Imported',
              date: new Date().toISOString(),
              playerColor: 'white',
              moves: 20,
              duration: 1000,
              moveHistory: [],
              finalPosition: '',
            },
          ],
          stats: { totalGames: 1, wins: 0, losses: 1, draws: 0, winRate: 0 },
        },
      };

      const success = manager.importGames(JSON.stringify(importData), true);
      expect(success).toBe(true);

      const games = manager.getGameHistory();
      expect(games.length).toBe(2);

      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
    });

    test('should import games (replace mode)', () => {
      manager.saveGame({ result: 'win' });

      const importData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          games: [
            {
              id: 'replaced-1',
              result: 'draw',
              opponent: 'Replaced',
              date: new Date().toISOString(),
              playerColor: 'white',
              moves: 30,
              duration: 2000,
              moveHistory: [],
              finalPosition: '',
            },
          ],
          stats: { totalGames: 1, wins: 0, losses: 0, draws: 1, winRate: 0 },
        },
      };

      const success = manager.importGames(JSON.stringify(importData), false);
      expect(success).toBe(true);

      const games = manager.getGameHistory();
      expect(games.length).toBe(1);
      expect(games[0].opponent).toBe('Replaced');
    });

    test('should handle invalid import data', () => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      const success = manager.importGames('invalid json');
      expect(success).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    test('should avoid duplicate IDs when merging', () => {
      manager.saveGame({ result: 'win' });
      const games = manager.getGameHistory();
      const existingId = games[0].id;

      const importData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          games: [
            {
              id: existingId, // Same ID as existing game
              result: 'loss',
              opponent: 'Duplicate',
              date: new Date().toISOString(),
              playerColor: 'white',
              moves: 20,
              duration: 1000,
              moveHistory: [],
              finalPosition: '',
            },
          ],
          stats: { totalGames: 1, wins: 0, losses: 1, draws: 0, winRate: 0 },
        },
      };

      manager.importGames(JSON.stringify(importData), true);
      const allGames = manager.getGameHistory();
      expect(allGames.length).toBe(1); // Should not duplicate
    });
  });

  describe('clearHistory', () => {
    test('should not clear without confirmation', () => {
      manager.saveGame({ result: 'win' });
      manager.clearHistory(false);

      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(1); // Should still have the game
    });

    test('should clear all history with confirmation', () => {
      manager.saveGame({ result: 'win' });
      manager.saveGame({ result: 'loss' });

      manager.clearHistory(true);

      const stats = manager.getStatistics();
      expect(stats.totalGames).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);

      const games = manager.getGameHistory();
      expect(games.length).toBe(0);
    });
  });

  describe('getRecentStats', () => {
    test('should get stats for recent games', () => {
      // Create games with different dates
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      manager.saveGame({ result: 'win' }); // Recent
      manager.data.games[0].date = oldDate.toISOString(); // Make it old

      manager.saveGame({ result: 'win' }); // Recent
      manager.saveGame({ result: 'loss' }); // Recent

      const stats = manager.getRecentStats(30);
      expect(stats.totalGames).toBe(2); // Only recent ones
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
    });
  });

  describe('getStatsByOpponent', () => {
    test('should group statistics by opponent', () => {
      manager.saveGame({ result: 'win', opponent: 'AI-Easy' });
      manager.saveGame({ result: 'win', opponent: 'AI-Easy' });
      manager.saveGame({ result: 'loss', opponent: 'AI-Easy' });
      manager.saveGame({ result: 'win', opponent: 'AI-Hard' });
      manager.saveGame({ result: 'loss', opponent: 'AI-Hard' });

      const byOpponent = manager.getStatsByOpponent();

      expect(byOpponent['AI-Easy'].totalGames).toBe(3);
      expect(byOpponent['AI-Easy'].wins).toBe(2);
      expect(byOpponent['AI-Easy'].losses).toBe(1);
      expect(byOpponent['AI-Easy'].winRate).toBeCloseTo(2 / 3);

      expect(byOpponent['AI-Hard'].totalGames).toBe(2);
      expect(byOpponent['AI-Hard'].wins).toBe(1);
      expect(byOpponent['AI-Hard'].losses).toBe(1);
      expect(byOpponent['AI-Hard'].winRate).toBe(0.5);
    });
  });

  describe('recalculateStats', () => {
    test('should recalculate statistics from game history', () => {
      // Manually add games and mess up stats
      manager.data.games = [
        { result: 'win' },
        { result: 'win' },
        { result: 'loss' },
        { result: 'draw' },
      ];
      manager.data.stats = { totalGames: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };

      manager.recalculateStats();

      expect(manager.data.stats.totalGames).toBe(4);
      expect(manager.data.stats.wins).toBe(2);
      expect(manager.data.stats.losses).toBe(1);
      expect(manager.data.stats.draws).toBe(1);
      expect(manager.data.stats.winRate).toBe(0.5);
    });
  });
});
