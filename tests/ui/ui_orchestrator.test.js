import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animateCheck, animateCheckmate } from '../../js/ui.js';
import * as AIEngine from '../../js/aiEngine.js';
import { confettiSystem } from '../../js/effects.js';

vi.mock('../../js/aiEngine.js', () => ({
    findKing: vi.fn(),
}));

vi.mock('../../js/effects.js', () => ({
    confettiSystem: {
        spawn: vi.fn(),
    },
}));

describe('UI Orchestrator - Animation Tests', () => {
    let mockGame;
    let elementMock;

    beforeEach(() => {
        mockGame = { board: [] };

        // Clear mock calls
        confettiSystem.spawn.mockClear();

        // Mock DOM elements
        elementMock = {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
            },
        };

        vi.spyOn(document, 'querySelector').mockImplementation(() => elementMock);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('animateCheck', () => {
        it('should add flashing class to king cell when check occurs', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue({ r: 4, c: 4 });

            animateCheck(mockGame, 'white');

            expect(AIEngine.findKing).toHaveBeenCalledWith(mockGame.board, 'white');
            expect(document.querySelector).toHaveBeenCalledWith('.cell[data-r="4"][data-c="4"]');
            expect(elementMock.classList.add).toHaveBeenCalledWith('king-check-flash');
        });

        it('should remove flashing class after 1 second', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue({ r: 4, c: 4 });

            animateCheck(mockGame, 'white');

            expect(elementMock.classList.remove).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);

            expect(elementMock.classList.remove).toHaveBeenCalledWith('king-check-flash');
        });

        it('should do nothing if king is not found', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue(null);
            animateCheck(mockGame, 'white');
            expect(document.querySelector).not.toHaveBeenCalled();
        });

        it('should do nothing if cell is not found in DOM', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue({ r: 4, c: 4 });
            vi.mocked(document.querySelector).mockReturnValue(null);

            animateCheck(mockGame, 'white');

            // Should handle null gracefully and not throw
            expect(document.querySelector).toHaveBeenCalled();
        });
    });

    describe('animateCheckmate', () => {
        it('should add mate flash class and trigger confetti', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue({ r: 0, c: 4 });

            animateCheckmate(mockGame, 'black');

            expect(document.querySelector).toHaveBeenCalledWith('.cell[data-r="0"][data-c="4"]');
            expect(elementMock.classList.add).toHaveBeenCalledWith('king-mate-flash');
            expect(confettiSystem.spawn).toHaveBeenCalled();
        });

        it('should NOT remove mate flash class automatically', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue({ r: 0, c: 4 });

            animateCheckmate(mockGame, 'black');

            vi.advanceTimersByTime(5000);

            // Unlike check, checkmate flash sticks around
            expect(elementMock.classList.remove).not.toHaveBeenCalled();
        });

        it('should do nothing if king is not found', () => {
            vi.mocked(AIEngine.findKing).mockReturnValue(null);
            animateCheckmate(mockGame, 'black');
            expect(confettiSystem.spawn).not.toHaveBeenCalled();
        });
    });
});
