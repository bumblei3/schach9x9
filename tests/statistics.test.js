

// Mock logger
vi.mock('../js/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const { StatisticsManager } = await import('../js/statisticsManager.js');

describe('StatisticsManager', () => {
  let stats;
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

    vi.clearAllMocks();
    stats = new StatisticsManager();
  });

  test('should initialize with default structure if storage is empty', () => {
    expect(stats.data.games).toEqual([]);
    expect(stats.data.stats.totalGames).toBe(0);
  });

  test('should load existing data from storage', () => {
    const mockData = {
      games: [{ id: '1', result: 'win' }],
      stats: { totalGames: 1, wins: 1, losses: 0, draws: 0, winRate: 1 },
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

    const newStats = new StatisticsManager();
    expect(newStats.data.games.length).toBe(1);
    expect(newStats.data.stats.wins).toBe(1);
  });

  test('saveGame should append game and update stats', () => {
    const gameData = {
      result: 'win',
      playerColor: 'white',
      opponent: 'AI-Level1',
      moveHistory: [{}, {}, {}],
      duration: 120000,
      finalPosition: 'fen-string',
    };

    stats.saveGame(gameData);

    expect(stats.data.games.length).toBe(1);
    expect(stats.data.stats.totalGames).toBe(1);
    expect(stats.data.stats.wins).toBe(1);
    expect(stats.data.stats.winRate).toBe(1);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  test('getStatistics should return a copy of stats', () => {
    const currentStats = stats.getStatistics();
    expect(currentStats).toEqual(stats.data.stats);
    expect(currentStats).not.toBe(stats.data.stats); // Verify it's a copy
  });

  test('getGameHistory should filter and sort games', () => {
    stats.data.games = [
      { id: '1', result: 'win', opponent: 'AI-Expert', date: '2023-01-01T10:00:00Z' },
      { id: '2', result: 'loss', opponent: 'AI-Beginner', date: '2023-01-02T10:00:00Z' },
    ];

    const winGames = stats.getGameHistory({ result: 'win' });
    expect(winGames.length).toBe(1);
    expect(winGames[0].id).toBe('1');

    const beginnerGames = stats.getGameHistory({ opponent: 'Beginner' });
    expect(beginnerGames.length).toBe(1);
    expect(beginnerGames[0].id).toBe('2');

    const limited = stats.getGameHistory({ limit: 1 });
    expect(limited.length).toBe(1);
    expect(limited[0].id).toBe('2'); // Sorted newest first
  });

  test('getGameById should return game or null', () => {
    stats.data.games = [{ id: 'test-id', result: 'win' }];
    expect(stats.getGameById('test-id')).toBeDefined();
    expect(stats.getGameById('nothing')).toBeNull();
  });

  test('exportGames and importGames should work together', () => {
    stats.saveGame({ result: 'win', opponent: 'AI' });
    const exported = stats.exportGames();

    const newStats = new StatisticsManager();
    newStats.importGames(exported, false); // Replace

    expect(newStats.data.games.length).toBe(1);
    expect(newStats.data.stats.wins).toBe(1);
  });

  test('importGames with merge should avoid duplicates', () => {
    stats.saveGame({ result: 'win', opponent: 'Alpha' });
    const exported = stats.exportGames();

    // Add another game to current stats
    stats.saveGame({ result: 'loss', opponent: 'Beta' });

    // Import the first game again with merge
    stats.importGames(exported, true);

    expect(stats.data.games.length).toBe(2); // Still 2, not 3 (no duplicate for Alpha)
  });

  test('importGames should handle invalid JSON', () => {
    const success = stats.importGames('invalid-json');
    expect(success).toBe(false);
  });

  test('recalculateStats should handle losses', () => {
    stats.data.games = [{ result: 'loss' }];
    stats.recalculateStats();
    expect(stats.data.stats.losses).toBe(1);
  });

  test('clearHistory should reset data', () => {
    stats.saveGame({ result: 'win' });
    stats.clearHistory(true);
    expect(stats.data.games.length).toBe(0);
    expect(stats.data.stats.totalGames).toBe(0);
  });

  test('clearHistory should require confirmation', () => {
    stats.saveGame({ result: 'win' });
    stats.clearHistory(false);
    expect(stats.data.games.length).toBe(1);
  });

  test('getRecentStats should return stats for specified period', () => {
    const now = new Date();
    const oldDate = new Date();
    oldDate.setDate(now.getDate() - 40);

    stats.data.games = [
      { result: 'win', date: now.toISOString() },
      { result: 'loss', date: oldDate.toISOString() },
    ];

    const recent = stats.getRecentStats(30);
    expect(recent.totalGames).toBe(1);
    expect(recent.wins).toBe(1);
  });

  test('getStatsByOpponent should group correctly', () => {
    stats.data.games = [
      { result: 'win', opponent: 'AI-1' },
      { result: 'loss', opponent: 'AI-1' },
      { result: 'draw', opponent: 'AI-2' },
    ];

    const byOpponent = stats.getStatsByOpponent();
    expect(byOpponent['AI-1'].totalGames).toBe(2);
    expect(byOpponent['AI-2'].totalGames).toBe(1);
  });
});
