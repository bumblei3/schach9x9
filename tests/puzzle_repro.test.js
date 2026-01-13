import { PuzzleMenu } from '../js/ui/PuzzleMenu.js';
import { puzzleManager } from '../js/puzzleManager.js';

describe('PuzzleMenu Reproduction Test', () => {
  let mockGameController;
  let mockOverlay;
  let mockContainer;
  let puzzleMenu;

  beforeEach(() => {
    // Mock DOM elements
    mockOverlay = {
      classList: {
        remove: vi.fn(),
        add: vi.fn(),
      },
      style: {
        display: '',
      },
    };

    mockContainer = {
      innerHTML: '',
      appendChild: vi.fn(),
    };

    // Mock document.getElementById
    document.getElementById = vi.fn(id => {
      if (id === 'puzzle-menu-overlay') return mockOverlay;
      if (id === 'puzzle-menu-list') return mockContainer;
      return null;
    });

    // Mock document.createElement
    document.createElement = vi.fn(() => ({
      className: '',
      innerHTML: '',
      onclick: null,
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    }));

    mockGameController = {
      loadPuzzle: vi.fn(),
      startPuzzleMode: vi.fn(),
    };

    puzzleMenu = new PuzzleMenu(mockGameController);
  });

  test('show() should make overlay visible and render puzzles', () => {
    puzzleMenu.show();

    // Verify overlay visibility logic
    expect(mockOverlay.classList.remove).toHaveBeenCalledWith('hidden');

    // Verify puzzle rendering
    const puzzles = puzzleManager.getPuzzles();
    expect(puzzles.length).toBeGreaterThan(0);
    // document.createElement should be called for each puzzle
    expect(document.createElement).toHaveBeenCalledTimes(puzzles.length);
    // container.appendChild should be called
    expect(mockContainer.appendChild).toHaveBeenCalledTimes(puzzles.length);
  });

  test('hide() should hide overlay', () => {
    puzzleMenu.hide();
    expect(mockOverlay.classList.add).toHaveBeenCalledWith('hidden');
  });
});
