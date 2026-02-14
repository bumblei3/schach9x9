import { describe, expect, test, beforeEach, vi } from 'vitest';

// Mock config first
vi.mock('../../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
  PIECE_VALUES: { p: 100, k: 0, r: 500, n: 300, b: 300, q: 900 },
  isBlockedCell: vi.fn(() => false),
}));

// Mock dependencies
vi.mock('../../js/effects.js', () => ({
  particleSystem: { spawn: vi.fn(), spawnTrail: vi.fn() },
  floatingTextManager: { show: vi.fn() },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
  confettiSystem: { spawn: vi.fn() },
}));

vi.mock('../../js/utils.js', () => ({
  debounce: (fn: any) => fn,
}));

import * as BoardRenderer from '../../js/ui/BoardRenderer.js';

describe('BoardRenderer Component', () => {
  let game: any;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="board-wrapper">
                <div id="board"></div>
            </div>
            <div id="status-display"></div>
        `;

    (window as any).PIECE_SVGS = {
      white: { p: 'wp', k: 'wk', r: 'wr' },
      black: { p: 'bp', k: 'bk' },
    };
    (window as any)._svgCache = null;

    game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      boardSize: 9,
      phase: 'play',
      turn: 'white',
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      arrowRenderer: { highlightMove: vi.fn(), clearArrows: vi.fn() },
      handleCellClick: vi.fn(),
      getValidMoves: vi.fn(() => []),
      isSquareUnderAttack: vi.fn(() => false),
    };

    // Setup DOM mocks for interaction
    document.elementFromPoint = vi.fn();
  });

  test('should initialize and render board correctly', () => {
    game.board[0][0] = { type: 'p', color: 'white' };
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const boardEl = document.getElementById('board');
    expect(boardEl?.children.length).toBeGreaterThan(0);
    expect(boardEl?.innerHTML).toContain('cell');
  });

  test('should handle piece symbol retrieval', () => {
    const symbol = BoardRenderer.getPieceSymbol({ type: 'p', color: 'white' } as any);
    expect(symbol).toContain('wp');
  });

  test('should animate move', async () => {
    vi.useFakeTimers();
    const from = { r: 0, c: 0 };
    const to = { r: 1, c: 1 };
    const piece = { type: 'p', color: 'white' };

    // Setup cells for animation (needs to find them in DOM)
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const animationPromise = BoardRenderer.animateMove(game, from, to, piece as any);

    // Advance timers for the animation timeout
    vi.advanceTimersByTime(300);

    await animationPromise;
    expect(game.isAnimating).toBe(false);
    vi.useRealTimers();
  });

  test('should handle interaction events', () => {
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const cell = document.querySelector('.cell');
    if (cell) {
      // Touch events
      const touchStart = new Event('touchstart');
      (touchStart as any).touches = [{ clientX: 0, clientY: 0 }];
      cell.dispatchEvent(touchStart);

      // Mouse events
      cell.dispatchEvent(new Event('mouseover'));
      cell.dispatchEvent(new Event('mouseout'));

      expect(game.handleCellClick).not.toHaveBeenCalled();
    }
  });

  test('flashSquare should not crash when called', () => {
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);
    // Just verify no error is thrown
    expect(() => BoardRenderer.flashSquare(0, 0, 'check')).not.toThrow();
    expect(() => BoardRenderer.flashSquare(5, 5, 'mate')).not.toThrow();
    expect(() => BoardRenderer.flashSquare(8, 8, 'capture')).not.toThrow();
  });

  test('showMoveQuality should not crash when called', () => {
    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);
    expect(() =>
      BoardRenderer.showMoveQuality(game, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, 'brilliant')
    ).not.toThrow();
    expect(() =>
      BoardRenderer.showMoveQuality(game, { from: { r: 2, c: 2 }, to: { r: 3, c: 3 } }, 'blunder')
    ).not.toThrow();
  });

  test('getPieceText should return correct symbols', () => {
    const pawnSymbol = BoardRenderer.getPieceText({ type: 'p', color: 'white' } as any);
    expect(pawnSymbol).toBe('♙');

    const kingSymbol = BoardRenderer.getPieceText({ type: 'k', color: 'black' } as any);
    expect(kingSymbol).toBe('♚');

    const nullSymbol = BoardRenderer.getPieceText(null);
    expect(nullSymbol).toBe('');
  });

  test('clearPieceCache should clear the global cache', () => {
    (window as any)._svgCache = { test: 'value' };
    BoardRenderer.clearPieceCache();
    expect((window as any)._svgCache).toEqual({});
  });
});
