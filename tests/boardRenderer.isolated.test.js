import { jest } from '@jest/globals';

jest.unstable_mockModule('../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
}));
jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: { spawn: jest.fn() },
  floatingTextManager: { show: jest.fn() },
}));
jest.unstable_mockModule('../js/utils.js', () => ({
  debounce: fn => fn,
}));

const BoardRenderer = await import('../js/ui/BoardRenderer.js');

describe('BoardRenderer Touch Isolation', () => {
  test('touch events find piece-svg', () => {
    document.body.innerHTML = '<div id="board"></div>';
    window.PIECE_SVGS = { white: { p: '<svg id="p-svg"></svg>' } };
    window._svgCache = null;

    const game = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      phase: 'play',
      getValidMoves: () => [],
    };
    game.board[7][4] = { type: 'p', color: 'white' };

    BoardRenderer.initBoardUI(game);
    BoardRenderer.renderBoard(game);

    const cell = document.querySelector('.cell[data-r="7"][data-c="4"]');
    expect(cell.innerHTML).toContain('piece-svg');

    const touch = new Event('touchstart');
    touch.touches = [{ clientX: 0, clientY: 0 }];
    cell.dispatchEvent(touch); // Should not throw
  });
});
