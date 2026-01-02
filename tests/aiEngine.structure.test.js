import * as aiEngine from '../js/aiEngine.js';

describe('AI Engine Structure', () => {
  test('should export search functions', () => {
    expect(typeof aiEngine.getBestMove).toBe('function');
    expect(typeof aiEngine.analyzePosition).toBe('function');
    expect(typeof aiEngine.setProgressCallback).toBe('function');
  });

  test('should export evaluation functions', () => {
    expect(typeof aiEngine.evaluatePosition).toBe('function');
    expect(aiEngine.PST).toBeDefined();
    expect(aiEngine.PST_EG).toBeDefined();
  });

  test('should export move generation functions', () => {
    expect(typeof aiEngine.getAllLegalMoves).toBe('function');
    expect(typeof aiEngine.makeMove).toBe('function');
    expect(typeof aiEngine.undoMove).toBe('function');
    expect(typeof aiEngine.isInCheck).toBe('function');
  });

  test('should export transposition table functions', () => {
    expect(typeof aiEngine.probeTT).toBe('function');
    expect(typeof aiEngine.storeTT).toBe('function');
    expect(typeof aiEngine.clearTT).toBe('function');
  });

  test('should export opening book functions', () => {
    expect(typeof aiEngine.setOpeningBook).toBe('function');
    expect(typeof aiEngine.queryOpeningBook).toBe('function');
  });
});
