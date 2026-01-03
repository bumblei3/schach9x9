/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mock BoardRenderer
jest.unstable_mockModule('../../js/ui/BoardRenderer.js', () => ({
  renderBoard: jest.fn(),
}));

const OverlayManager = await import('../../js/ui/OverlayManager.js');
const { renderBoard } = await import('../../js/ui/BoardRenderer.js');

describe('OverlayManager', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="generic-modal" style="display: none;">
        <div id="modal-title"></div>
        <div id="modal-message"></div>
        <div id="modal-actions"></div>
      </div>
      <div id="promotion-overlay" class="hidden">
        <div id="promotion-options"></div>
      </div>
      <div id="puzzle-overlay" class="hidden">
        <div id="puzzle-title"></div>
        <div id="puzzle-description"></div>
        <div id="puzzle-status"></div>
        <button id="puzzle-next-btn" class="hidden"></button>
        <button id="puzzle-exit-btn" class="hidden"></button>
      </div>
    `;

    window.PIECE_SVGS = {
      white: {
        e: '<svg>we</svg>',
        q: '<svg>wq</svg>',
        r: '<svg>wr</svg>',
        b: '<svg>wb</svg>',
        n: '<svg>wn</svg>',
        c: '<svg>wc</svg>',
        a: '<svg>wa</svg>',
      },
      black: {
        e: '<svg>be</svg>',
        q: '<svg>bq</svg>',
        r: '<svg>br</svg>',
        b: '<svg>bb</svg>',
        n: '<svg>bn</svg>',
        c: '<svg>bc</svg>',
        a: '<svg>ba</svg>',
      },
    };

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('showModal / closeModal', () => {
    test('showModal displays modal with title and message', () => {
      OverlayManager.showModal('Test Title', 'Test Message');

      const modal = document.getElementById('generic-modal');
      expect(modal.style.display).toBe('flex');
      expect(document.getElementById('modal-title').textContent).toBe('Test Title');
      expect(document.getElementById('modal-message').textContent).toBe('Test Message');
    });

    test('showModal adds action buttons', () => {
      const callback = jest.fn();
      OverlayManager.showModal('Title', 'Msg', [
        { text: 'OK', class: 'btn-primary', callback },
        { text: 'Cancel', class: 'btn-secondary' },
      ]);

      const actions = document.getElementById('modal-actions');
      expect(actions.children.length).toBe(2);
      expect(actions.children[0].textContent).toBe('OK');

      // Click button
      actions.children[0].click();
      expect(callback).toHaveBeenCalled();
      expect(document.getElementById('generic-modal').style.display).toBe('none');
    });

    test('closeModal hides modal', () => {
      OverlayManager.showModal('Title', 'Msg');
      OverlayManager.closeModal();
      expect(document.getElementById('generic-modal').style.display).toBe('none');
    });

    test('showModal returns early if elements missing', () => {
      document.body.innerHTML = '';
      OverlayManager.showModal('Title', 'Msg'); // Should not throw
    });
  });

  describe('showPromotionUI', () => {
    test('displays promotion options', () => {
      const game = {
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
        log: jest.fn(),
      };
      game.board[0][0] = { type: 'p', color: 'white' };

      const callback = jest.fn();
      OverlayManager.showPromotionUI(game, 0, 0, 'white', {}, callback);

      const overlay = document.getElementById('promotion-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);

      const options = document.getElementById('promotion-options');
      expect(options.children.length).toBe(7); // e, q, c, a, r, b, n
    });

    test('clicking promotion option updates piece', () => {
      const game = {
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
        log: jest.fn(),
      };
      game.board[0][0] = { type: 'p', color: 'white' };
      const moveRecord = {};
      const callback = jest.fn();

      OverlayManager.showPromotionUI(game, 0, 0, 'white', moveRecord, callback);

      // Click first option (e = Engel)
      const options = document.getElementById('promotion-options');
      options.children[0].click();

      expect(game.board[0][0].type).toBe('e');
      expect(moveRecord.specialMove).toEqual({ type: 'promotion', promotedTo: 'e' });
      expect(game.log).toHaveBeenCalled();
      expect(renderBoard).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
      expect(document.getElementById('promotion-overlay').classList.contains('hidden')).toBe(true);
    });

    test('returns early if overlay missing', () => {
      document.body.innerHTML = '';
      OverlayManager.showPromotionUI({}, 0, 0, 'white', {}, jest.fn()); // Should not throw
    });
  });

  describe('Puzzle Overlay', () => {
    test('showPuzzleOverlay displays puzzle info', () => {
      const puzzle = { title: 'Puzzle 1', description: 'Find the best move' };
      OverlayManager.showPuzzleOverlay(puzzle);

      const overlay = document.getElementById('puzzle-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('puzzle-title').textContent).toBe('Puzzle 1');
      expect(document.getElementById('puzzle-description').textContent).toBe('Find the best move');
      expect(document.getElementById('puzzle-status').textContent).toBe('Weiß am Zug');
      expect(document.getElementById('puzzle-next-btn').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('puzzle-exit-btn').classList.contains('hidden')).toBe(false);
    });

    test('hidePuzzleOverlay hides overlay', () => {
      document.getElementById('puzzle-overlay').classList.remove('hidden');
      OverlayManager.hidePuzzleOverlay();
      expect(document.getElementById('puzzle-overlay').classList.contains('hidden')).toBe(true);
    });

    test('updatePuzzleStatus updates message and class', () => {
      OverlayManager.updatePuzzleStatus('error', 'Wrong move!');
      const status = document.getElementById('puzzle-status');
      expect(status.textContent).toBe('Wrong move!');
      expect(status.className).toContain('error');
    });

    test('updatePuzzleStatus shows next button on success', () => {
      OverlayManager.updatePuzzleStatus('success', 'Solved!');
      expect(document.getElementById('puzzle-next-btn').classList.contains('hidden')).toBe(false);
    });

    test('showPuzzleOverlay returns early if overlay missing', () => {
      document.body.innerHTML = '';
      OverlayManager.showPuzzleOverlay({ title: 'X', description: 'Y' }); // Should not throw
    });
  });

  describe('showToast', () => {
    test('creates toast container if missing', () => {
      expect(document.getElementById('toast-container')).toBeNull();
      OverlayManager.showToast('Test message');
      expect(document.getElementById('toast-container')).not.toBeNull();
    });

    test('displays toast with correct type icon', () => {
      OverlayManager.showToast('Success!', 'success');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');
      expect(toast.classList.contains('success')).toBe(true);
      expect(toast.innerHTML).toContain('✅');
    });

    test('toast fades out after timeout', () => {
      OverlayManager.showToast('Fading...');
      const container = document.getElementById('toast-container');
      const toast = container.querySelector('.toast');

      expect(toast).not.toBeNull();

      // Advance 3000ms for fade-out class
      jest.advanceTimersByTime(3000);
      expect(toast.classList.contains('fade-out')).toBe(true);

      // Advance 300ms for remove
      jest.advanceTimersByTime(300);
      expect(container.querySelector('.toast')).toBeNull();
    });
  });
});
