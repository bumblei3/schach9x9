import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { PieceManager3D } from '../../../js/ui/3d/PieceManager3D.js';

// Mock pieces3D
vi.mock('../../../js/pieces3D.js', () => ({
    createPiece3D: vi.fn().mockReturnValue(new THREE.Group()),
}));

// Mock BattleAnimator
vi.mock('../../../js/battleAnimations.js', () => ({
    BattleAnimator: vi.fn().mockImplementation(function () {
        return {
            playBattle: vi.fn().mockResolvedValue(undefined),
        };
    }),
}));

// Mock effects
vi.mock('../../../js/effects.js', () => ({
    triggerVibration: vi.fn(),
    shakeScreen: vi.fn(),
}));

// Mock logger
vi.mock('../../../js/logger.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe('PieceManager3D', () => {
    let pieceManager: PieceManager3D;
    let mockSceneManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock SceneManager3D
        mockSceneManager = {
            scene: new THREE.Scene(),
            camera: new THREE.PerspectiveCamera(),
            boardToWorld: vi.fn().mockReturnValue({ x: 10, z: 20 }),
        };

        pieceManager = new PieceManager3D(mockSceneManager);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('constructor should initialize correctly', () => {
        expect(pieceManager.pieces).toEqual({});
        expect(pieceManager.highlights).toEqual([]);
        expect(pieceManager.animating).toBe(false);
    });

    test('init should create battleAnimator', async () => {
        const { BattleAnimator } = await import('../../../js/battleAnimations.js');
        pieceManager.init();
        expect(pieceManager.battleAnimator).toBeDefined();
        expect(BattleAnimator).toHaveBeenCalled();
    });

    test('addPiece should add piece to scene and pieces map', () => {
        const spy = vi.spyOn(mockSceneManager.scene, 'add');
        pieceManager.addPiece('p', 'white', 6, 4);

        expect(spy).toHaveBeenCalled();
        expect(Object.keys(pieceManager.pieces)).toContain('6,4');
        expect(pieceManager.pieces['6,4'].userData).toMatchObject({
            type: 'p',
            color: 'white',
            row: 6,
            col: 4,
        });
    });

    test('removePiece should remove piece from scene and map', () => {
        pieceManager.addPiece('p', 'white', 6, 4);
        const spy = vi.spyOn(mockSceneManager.scene, 'remove');

        pieceManager.removePiece(6, 4);

        expect(spy).toHaveBeenCalled();
        expect(pieceManager.pieces['6,4']).toBeUndefined();
    });

    test('updateFromGameState should populate pieces from board', () => {
        const mockGame = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
        };
        mockGame.board[6][4] = { type: 'p', color: 'white' };
        mockGame.board[0][4] = { type: 'k', color: 'black' };

        pieceManager.updateFromGameState(mockGame as any);

        expect(Object.keys(pieceManager.pieces).length).toBe(2);
        expect(pieceManager.pieces['6,4']).toBeDefined();
        expect(pieceManager.pieces['0,4']).toBeDefined();
    });

    test('highlightMoves should add highlight markers to scene', () => {
        const spy = vi.spyOn(mockSceneManager.scene, 'add');
        const moves = [{ r: 4, c: 4 }, { r: 5, c: 4 }];

        pieceManager.highlightMoves(moves);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(pieceManager.highlights.length).toBe(2);
    });

    test('clearHighlights should remove markers from scene', () => {
        pieceManager.highlightMoves([{ r: 4, c: 4 }]);
        const spy = vi.spyOn(mockSceneManager.scene, 'remove');

        pieceManager.clearHighlights();

        expect(spy).toHaveBeenCalled();
        expect(pieceManager.highlights.length).toBe(0);
    });

    test('updateSetupHighlights should add zones to scene', () => {
        const spy = vi.spyOn(mockSceneManager.scene, 'add');
        const mockGame = {
            phase: 'SETUP_WHITE_PIECES',
            whiteCorridor: 3
        };

        pieceManager.updateSetupHighlights(mockGame as any);

        expect(spy).toHaveBeenCalled();
        expect(pieceManager.highlights.length).toBe(9);
    });

    test('updateSetupHighlights should handle black corridor', () => {
        const spy = vi.spyOn(mockSceneManager.scene, 'add');
        const mockGame = {
            phase: 'SETUP_BLACK_PIECES',
            blackCorridor: 3
        };

        pieceManager.updateSetupHighlights(mockGame as any);

        expect(spy).toHaveBeenCalled();
        expect(pieceManager.highlights.length).toBe(9);
    });

    test('setSkin should recreate all pieces with new skin', () => {
        pieceManager.addPiece('p', 'white', 6, 4);
        const removeSpy = vi.spyOn(pieceManager, 'removePiece');
        const addSpy = vi.spyOn(pieceManager, 'addPiece');

        pieceManager.setSkin('neon');

        expect(pieceManager.currentSkin).toBe('neon');
        expect(removeSpy).toHaveBeenCalledWith(6, 4);
        expect(addSpy).toHaveBeenCalledWith('p', 'white', 6, 4);
    });

    test('animateMove should update piece position', async () => {
        const raSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
            setTimeout(cb, 0);
            return 0;
        });

        pieceManager.addPiece('p', 'white', 6, 4);
        const initialPiece = pieceManager.pieces['6,4'];

        const promise = pieceManager.animateMove(6, 4, 4, 4);

        for (let i = 0; i < 6; i++) {
            vi.advanceTimersByTime(100);
        }

        await promise;

        expect(initialPiece.userData.row).toBe(4);
        expect(initialPiece.userData.col).toBe(4);
        expect(pieceManager.pieces['4,4']).toBeDefined();
        raSpy.mockRestore();
    });

    test('playBattleSequence should invoke battleAnimator', async () => {
        pieceManager.init();
        const spy = vi.spyOn(pieceManager.battleAnimator!, 'playBattle');

        const attacker = { type: 'q', color: 'white' };
        const defender = { type: 'p', color: 'black' };

        await pieceManager.playBattleSequence(attacker as any, defender as any, { r: 6, c: 4 } as any, { r: 4, c: 4 } as any);

        expect(spy).toHaveBeenCalled();
        expect(pieceManager.animating).toBe(false);
    });

    test('playBattleSequence should handle heavy and medium effects', async () => {
        const { triggerVibration, shakeScreen } = await import('../../../js/effects.js');
        pieceManager.init();

        await pieceManager.playBattleSequence({ type: 'q', color: 'white' } as any, { type: 'p' } as any, { r: 6, c: 4 }, { r: 4, c: 4 });
        expect(triggerVibration).toHaveBeenCalledWith('heavy');
        expect(shakeScreen).toHaveBeenCalledWith(8, 400);

        await pieceManager.playBattleSequence({ type: 'p', color: 'white' } as any, { type: 'p' } as any, { r: 6, c: 4 }, { r: 4, c: 4 });
        expect(triggerVibration).toHaveBeenCalledWith('medium');
        expect(shakeScreen).toHaveBeenCalledWith(3, 200);
    });

    test('playBattleSequence should log error on failure', async () => {
        const { logger } = await import('../../../js/logger.js');
        pieceManager.init();
        vi.spyOn(pieceManager.battleAnimator!, 'playBattle').mockRejectedValue(new Error('Mock Error'));

        await pieceManager.playBattleSequence({ type: 'p' } as any, { type: 'p' } as any, { r: 6, c: 4 }, { r: 4, c: 4 });

        expect(logger.error).toHaveBeenCalled();
        expect(pieceManager.animating).toBe(false);
    });
});
