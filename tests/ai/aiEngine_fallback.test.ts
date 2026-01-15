import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import * as aiEngine from '../../js/aiEngine.js';
import { createEmptyBoard } from '../../js/gameEngine.js';

describe('AIEngine JS Fallback', () => {
    let originalWorker: any;

    beforeAll(() => {
        // Save original Worker
        originalWorker = global.Worker;
        // Undefine Worker to force fallback
        // @ts-ignore
        delete global.Worker;
    });

    afterAll(() => {
        // Restore Worker
        global.Worker = originalWorker;
    });

    test('getBestMoveDetailed should use JS fallback when Worker is undefined', async () => {
        const board = createEmptyBoard();
        board[0][0] = { type: 'k', color: 'white' };
        board[8][8] = { type: 'k', color: 'black' };

        // Place a pawn that can capture or move to verify logic
        board[1][1] = { type: 'p', color: 'white' };
        board[2][2] = { type: 'n', color: 'black' }; // Capture opportunity

        // Spy on logger to confirm fallback usage
        const debugSpy = vi.spyOn(aiEngine.logger, 'debug');

        const result = await aiEngine.getBestMoveDetailed(board, 'white', 1, { elo: 1000 });

        expect(result).toBeDefined();
        expect(result?.move).toBeDefined();
        expect(result?.score).toBeDefined();

        // Verify fallback log message
        expect(debugSpy).toHaveBeenCalledWith('[AiEngine] Using JS Fallback Search');
    });

    test('evaluatePosition should use JS fallback', async () => {
        const board = createEmptyBoard();
        board[0][0] = { type: 'k', color: 'white' };
        board[8][8] = { type: 'k', color: 'black' };

        const score = await aiEngine.evaluatePosition(board, 'white');
        expect(typeof score).toBe('number');
    });
});
