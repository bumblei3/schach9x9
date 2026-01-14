import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PuzzleMenu } from '../../js/ui/PuzzleMenu.js';
import { puzzleManager } from '../../js/puzzleManager.js';
import type { GameController } from '../../js/gameController.js';

// Mock puzzleManager
vi.mock('../../js/puzzleManager.js', () => ({
  puzzleManager: {
    getPuzzles: vi.fn().mockReturnValue([
      { id: 'p1', title: 'Puzzle 1', difficulty: 'Einfach', description: 'Test 1' },
      { id: 'p2', title: 'Puzzle 2', difficulty: 'Mittel', description: 'Test 2' },
    ]),
    isSolved: vi.fn().mockReturnValue(false),
  },
}));

describe('PuzzleMenu', () => {
  let puzzleMenu: PuzzleMenu;
  let mockGameController: Partial<GameController>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DOM
    document.body.innerHTML = `
      <div id="puzzle-menu-overlay" class="hidden">
        <button id="puzzle-menu-close-btn"></button>
        <div id="puzzle-menu-list"></div>
      </div>
    `;

    mockGameController = {
      loadPuzzle: vi.fn(),
      startPuzzleMode: vi.fn(),
    };

    puzzleMenu = new PuzzleMenu(mockGameController as GameController);
  });

  test('constructor should initialize DOM and events', () => {
    expect(puzzleMenu.overlay).not.toBeNull();

    const closeBtn = document.getElementById('puzzle-menu-close-btn');
    const hideSpy = vi.spyOn(puzzleMenu, 'hide');

    closeBtn?.dispatchEvent(new MouseEvent('click'));
    expect(hideSpy).toHaveBeenCalled();
  });

  test('show should render list and remove hidden class', () => {
    const renderSpy = vi.spyOn(puzzleMenu, 'renderPuzzleList');
    puzzleMenu.show();

    expect(renderSpy).toHaveBeenCalled();
    expect(puzzleMenu.overlay?.classList.contains('hidden')).toBe(false);
  });

  test('hide should add hidden class', () => {
    if (puzzleMenu.overlay) {
      puzzleMenu.overlay.classList.remove('hidden');
      puzzleMenu.hide();
      expect(puzzleMenu.overlay.classList.contains('hidden')).toBe(true);
    } else {
      throw new Error('Overlay not found');
    }
  });

  test('renderPuzzleList should create cards with correct content', () => {
    puzzleMenu.renderPuzzleList();

    const container = document.getElementById('puzzle-menu-list');
    const cards = container?.querySelectorAll('.puzzle-card');

    expect(cards?.length).toBe(2);
    expect(cards?.[0].innerHTML).toContain('Puzzle 1');
    expect(cards?.[0].innerHTML).toContain('Einfach');
  });

  test('renderPuzzleList should show checkmark for solved puzzles', () => {
    vi.mocked(puzzleManager.isSolved).mockReturnValue(true);
    puzzleMenu.renderPuzzleList();

    const container = document.getElementById('puzzle-menu-list');
    expect(container?.innerHTML).toContain('✅');
    expect(container?.querySelector('.puzzle-card')?.classList.contains('solved')).toBe(true);
  });

  test('clicking a puzzle card should hide menu and load puzzle', () => {
    puzzleMenu.renderPuzzleList();

    const container = document.getElementById('puzzle-menu-list');
    const card = container?.querySelector('.puzzle-card') as HTMLElement;
    const hideSpy = vi.spyOn(puzzleMenu, 'hide');

    card.click();

    expect(hideSpy).toHaveBeenCalled();
    expect(mockGameController.loadPuzzle).toHaveBeenCalledWith(0);
  });

  test('should use startPuzzleMode if loadPuzzle is not available', () => {
    // Temporarily remove loadPuzzle to simulate older interface or optional availability
    const limitedController = {
      startPuzzleMode: vi.fn(),
    };
    const legacyMenu = new PuzzleMenu(limitedController as any);
    // Force render to attach listeners bound to this legacy instance
    legacyMenu.renderPuzzleList();

    const card = document
      .getElementById('puzzle-menu-list')
      ?.querySelector('.puzzle-card') as HTMLElement;
    card.click();

    expect(limitedController.startPuzzleMode).toHaveBeenCalledWith(0);
  });
});
