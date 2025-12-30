import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';
import { setupJSDOM, createMockGame } from './test-utils.js';

// Mocks for ui.js dependencies
jest.unstable_mockModule('../js/chess-pieces.js', () => ({
    PIECE_SVGS: {
        white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
        black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' },
    },
}));

jest.unstable_mockModule('../js/utils.js', () => ({
    formatTime: jest.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`),
    debounce: jest.fn(fn => fn),
}));

jest.unstable_mockModule('../js/effects.js', () => ({
    particleSystem: {
        spawn: jest.fn(),
    },
}));

const UI = await import('../js/ui.js');

describe('UI Coverage Expansion', () => {
    let game;

    beforeEach(() => {
        setupJSDOM();
        game = createMockGame();
        jest.clearAllMocks();
    });

    describe('Puzzle UI', () => {
        test('showPuzzleOverlay should display puzzle info', () => {
            const puzzle = {
                title: 'Mate in 1',
                description: 'Find the mate',
            };
            UI.showPuzzleOverlay(puzzle);
            expect(document.getElementById('puzzle-overlay').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('puzzle-title').textContent).toBe('Mate in 1');
            expect(document.getElementById('puzzle-description').textContent).toBe('Find the mate');
        });

        test('hidePuzzleOverlay should hide it', () => {
            document.getElementById('puzzle-overlay').classList.remove('hidden');
            UI.hidePuzzleOverlay();
            expect(document.getElementById('puzzle-overlay').classList.contains('hidden')).toBe(true);
        });

        test('updatePuzzleStatus should show message and next button on success', () => {
            UI.updatePuzzleStatus('success', 'Correct!');
            const statusEl = document.getElementById('puzzle-status');
            expect(statusEl.textContent).toBe('Correct!');
            expect(statusEl.className).toContain('success');
            expect(document.getElementById('puzzle-next-btn').classList.contains('hidden')).toBe(false);
        });

        test('updatePuzzleStatus should show message on error', () => {
            UI.updatePuzzleStatus('error', 'Wrong move');
            const statusEl = document.getElementById('puzzle-status');
            expect(statusEl.textContent).toBe('Wrong move');
            expect(statusEl.className).toContain('error');
        });
    });

    describe('Check Animations', () => {
        test('animateCheck should find king and add class', () => {
            jest.useFakeTimers();
            game.board[4][4] = { type: 'k', color: 'white' };
            UI.initBoardUI(game); // Ensure cells are created
            UI.animateCheck(game, 'white');

            const kingCell = document.querySelector('.cell[data-r="4"][data-c="4"]');
            expect(kingCell.classList.contains('in-check')).toBe(true);

            jest.advanceTimersByTime(2000);
            expect(kingCell.classList.contains('in-check')).toBe(false);
            jest.useRealTimers();
        });

        test('animateCheckmate should find king and add class', () => {
            jest.useFakeTimers();
            game.board[0][0] = { type: 'k', color: 'black' };
            UI.initBoardUI(game);
            UI.animateCheckmate(game, 'black');

            const kingCell = document.querySelector('.cell[data-r="0"][data-c="0"]');
            expect(kingCell.classList.contains('checkmate')).toBe(true);

            jest.advanceTimersByTime(3000);
            expect(kingCell.classList.contains('checkmate')).toBe(false);
            jest.useRealTimers();
        });

        test('animateCheck should return if king not found', () => {
            // Empty board
            const spy = jest.spyOn(document, 'querySelector');
            UI.animateCheck(game, 'white');
            expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('.cell'));
        });
    });

    describe('Status and Shop Logic', () => {
        test('updateStatus should handle black king setup', () => {
            game.phase = PHASES.SETUP_BLACK_KING;
            UI.updateStatus(game);
            expect(document.getElementById('status-display').textContent).toContain('Schwarz');
        });

        test('updateShopUI should disable items when unaffordable', () => {
            game.points = 2;
            const shopPanel = document.getElementById('shop-panel');
            shopPanel.innerHTML = `
        <div class="shop-item" data-cost="5">Expensive</div>
        <div class="shop-item" data-cost="1">Cheap</div>
      `;
            UI.updateShopUI(game);

            const expensive = shopPanel.querySelector('[data-cost="5"]');
            const cheap = shopPanel.querySelector('[data-cost="1"]');
            expect(expensive.classList.contains('disabled')).toBe(true);
            expect(cheap.classList.contains('disabled')).toBe(false);
        });

        test('updateShopUI should show selected piece info', () => {
            game.selectedShopPiece = 'q';
            game.turn = 'white';
            UI.updateShopUI(game);
            expect(document.getElementById('selected-piece-display').textContent).toContain('♕');
        });
    });

    describe('Piece Symbol Edge Cases', () => {
        test('getPieceText should return correct symbol for Angel and others', () => {
            expect(UI.getPieceText({ type: 'a', color: 'white' })).toBe('A');
            expect(UI.getPieceText({ type: 'k', color: 'black' })).toBe('♚');
            expect(UI.getPieceText(null)).toBe('');
        });
    });
});
