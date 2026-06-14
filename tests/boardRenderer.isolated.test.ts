import { describe, test, expect, vi } from 'vitest';
vi.mock('../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
}));
vi.mock('../js/effects.js', () => ({
  particleSystem: { spawn: vi.fn() },
  floatingTextManager: { show: vi.fn() },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
}));
vi.mock('../js/utils.js', () => ({
  debounce: (fn: any) => fn,
}));

const { renderBoard } = await import('../js/ui/BoardRenderer.js');

describe('BoardRenderer Touch Isolation', () => {
  test('renderBoard renders without error', () => {
    document.body.innerHTML = '<div id="board"></div>';
    (window as any).PIECE_SVGS = { white: { p: '<svg></svg>', k: '<svg></svg>' }, black: { p: '<svg></svg>', k: '<svg></svg>' } };
    
    const game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      boardSize: 9,
      phase: 'play',
      turn: 'white' as const,
    };

    // Place kings
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    // Just verify renderBoard runs without throwing
    expect(() => renderBoard(game)).not.toThrow();
    
    // Verify board element exists
    const board = document.getElementById('board');
    expect(board).toBeDefined();
  });
});