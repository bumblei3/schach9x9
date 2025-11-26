// ui.test.js
// Tests for the UI module (initBoardUI) using jsdom environment
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

describe('UI Module - initBoardUI', () => {
  let initBoardUI, gameMock;

  beforeAll(async () => {
    // Mock the gameEngine module that ui.js imports
    // Must use unstable_mockModule for ESM
    jest.unstable_mockModule('./gameEngine.js', () => ({
      BOARD_SIZE: 9,
      PHASES: { PLAY: 'PLAY' },
      PIECE_VALUES: { p: 1, n: 3, b: 3, r: 5, a: 7, c: 9, q: 9, k: 0 },
    }));

    // Import module AFTER mocking
    const ui = await import('./ui.js');
    initBoardUI = ui.initBoardUI;
  });

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML =
      '<div id="game-container"><div id="board-wrapper"><div id="board"></div></div></div>';
    // Mock game object with minimal required API
    gameMock = {
      phase: 'PLAY',
      replayMode: false,
      isAnimating: false,
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      handleCellClick: jest.fn(),
    };
  });

  test('creates 9x9 cells with correct data attributes', () => {
    initBoardUI(gameMock);
    const cells = document.querySelectorAll('.cell');
    expect(cells.length).toBe(81);
    // Verify a few sample cells
    const sample = document.querySelector('.cell[data-r="0"][data-c="0"]');
    expect(sample).not.toBeNull();
    const sample2 = document.querySelector('.cell[data-r="8"][data-c="8"]');
    expect(sample2).not.toBeNull();
  });

  test('adds column and row coordinate labels', () => {
    initBoardUI(gameMock);
    const colLabels = document.querySelectorAll('.col-labels .coord-label');
    const rowLabels = document.querySelectorAll('.row-labels .coord-label');
    expect(colLabels.length).toBe(9);
    expect(rowLabels.length).toBe(9);
    // First column label should be 'a'
    expect(colLabels[0].textContent).toBe('a');
    // First row label (top) should be '9' (since rows are inserted descending)
    expect(rowLabels[0].textContent).toBe('9');
  });

  test('clicking a cell calls game.handleCellClick with correct coordinates', () => {
    initBoardUI(gameMock);
    const target = document.querySelector('.cell[data-r="3"][data-c="5"]');
    target.click();
    expect(gameMock.handleCellClick).toHaveBeenCalledWith(3, 5);
  });
});
