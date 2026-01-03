import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { setupJSDOM, createMockGame } from './test-utils.js';

// Mock dependencies
jest.unstable_mockModule('../js/config.js', () => ({
  BOARD_SIZE: 9,
  PHASES: { PLAY: 'play' },
}));

jest.unstable_mockModule('../js/utils.js', () => ({
  debounce: fn => fn,
}));

jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: { spawn: jest.fn() },
  floatingTextManager: { show: jest.fn() },
}));

describe('BoardRenderer Unit Tests', () => {
  let BoardRenderer;
  let game;

  beforeEach(async () => {
    setupJSDOM();
    jest.clearAllMocks();

    // Import module under test
    BoardRenderer = await import('../js/ui/BoardRenderer.js');

    // Setup initial DOM
    document.body.innerHTML = '<div id="board"></div><div id="board-wrapper"></div>';

    game = createMockGame();

    // Initialize board DOM
    BoardRenderer.initBoardUI(game);
  });

  test('renderBoard should respect _forceFullRender flag', () => {
    // 1. Initial Render
    game.board[0][0] = { type: 'r', color: 'white' };
    game._forceFullRender = true;

    BoardRenderer.renderBoard(game);

    const cell00 = document.querySelector('.cell[data-r="0"][data-c="0"]');
    expect(cell00.innerHTML).toContain('piece-svg'); // Should have rendered
    expect(game._forceFullRender).toBe(false); // Should be reset

    // 2. Modify DOM manually to simulate "stale" state if not re-rendered
    cell00.innerHTML = '';

    // 3. Call renderBoard WITHOUT flag -> Should NOT update cell00 because game state matches previous state
    // (renderBoard checks difference between game.board and game._previousBoardState)
    // verification: game._previousBoardState[0][0] is already {type:'r', ...} from step 1.
    BoardRenderer.renderBoard(game);
    expect(cell00.innerHTML).toBe(''); // Should remain empty

    // 4. Set flag and render -> Should update
    game._forceFullRender = true;
    BoardRenderer.renderBoard(game);
    expect(cell00.innerHTML).toContain('piece-svg');
  });

  test('renderBoard should update only changed cells when flag is false', () => {
    // Initial state
    game._forceFullRender = true;
    BoardRenderer.renderBoard(game); // Populates _previousBoardState
    game._forceFullRender = false;

    // Change a piece
    game.board[1][1] = { type: 'p', color: 'black' };

    // Spy on document.querySelector to track updates if we wanted,
    // but easier to check DOM result.

    BoardRenderer.renderBoard(game);

    const cell11 = document.querySelector('.cell[data-r="1"][data-c="1"]');
    expect(cell11.innerHTML).toContain('piece-svg');
  });
});
