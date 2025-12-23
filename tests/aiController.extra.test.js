import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/gameEngine.js';

// Setup JSDOM body 
document.body.innerHTML = `
    <div id="spinner-overlay" style="display: none;"></div>
    <div id="ai-depth"></div>
    <div id="ai-nodes"></div>
    <div id="ai-best-move"></div>
    <div id="progress-fill"></div>
    <div id="eval-bar"></div>
    <div id="eval-score"></div>
    <div id="top-moves-content"></div>
    <div id="ai-status"></div>
`;

// Mock Worker
class MockWorker {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
    }
    postMessage = jest.fn();
    terminate = jest.fn();
}
global.Worker = jest.fn().mockImplementation((url) => new MockWorker(url));

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ e2e4: ["e2e5"] }) }));

const { AIController } = await import('../js/aiController.js');

describe('AIController Ultimate Precision V5', () => {
    let game, controller;

    beforeEach(() => {
        game = {
            board: Array(9).fill(null).map(() => Array(9).fill(null)),
            phase: PHASES.PLAY,
            turn: 'black',
            difficulty: 'medium',
            moveHistory: [],
            positionHistory: [],
            blackCorridor: { rowStart: 0, colStart: 3 },
            points: 15,
            drawOffered: false,
            drawOfferedBy: 'white',
            mode: 'pve',
            placeKing: jest.fn(),
            placeShopPiece: jest.fn(() => game.points--),
            finishSetupPhase: jest.fn(),
            resign: jest.fn(),
            offerDraw: jest.fn(),
            acceptDraw: jest.fn(),
            declineDraw: jest.fn(),
            executeMove: jest.fn(),
            log: jest.fn(),
            isInsufficientMaterial: jest.fn(() => false),
            getBoardHash: jest.fn(() => 'hash'),
            calculateMaterialAdvantage: jest.fn(() => 0),
            renderBoard: jest.fn(),
            continuousAnalysis: false,
            analysisMode: false,
            difficulty: 'medium',
            getAllLegalMoves: jest.fn(() => []),
            arrowRenderer: { clearArrows: jest.fn(), drawArrow: jest.fn() },
            halfMoveClock: 0,
            findKing: jest.fn(() => ({ r: 1, c: 4 })) // Add findKing mock
        };
        controller = new AIController(game);
        jest.clearAllMocks();
    });

    test('aiMove - should resign (Line 68)', () => {
        controller.evaluatePosition = jest.fn().mockReturnValue(-1500); // Hopeless
        game.calculateMaterialAdvantage.mockReturnValue(-20); // Massive disadvantage
        controller.aiMove();
        expect(game.resign).toHaveBeenCalledWith('black');
    });

    test('aiMove - should offer draw (Line 74)', () => {
        game.moveHistory = new Array(25).fill({});
        controller.evaluatePosition = jest.fn().mockReturnValue(-150); // Bad but not hopeless
        controller.aiMove();
        expect(game.offerDraw).toHaveBeenCalledWith('black');
    });

    test('aiMove - bestMove null branch (multi-worker)', () => {
        controller.aiMove();
        // With multi-worker, we have aiWorkers array
        expect(controller.aiWorkers).toBeDefined();
        expect(controller.aiWorkers.length).toBeGreaterThan(0);

        // Simulate first worker returning null
        const firstWorker = controller.aiWorkers[0];
        if (firstWorker.onmessage) {
            firstWorker.onmessage({ data: { type: 'bestMove', data: null } });
        }
        expect(game.log).toHaveBeenCalledWith(expect.stringContaining('KI kann nicht ziehen'));
    });

    test('updateAIProgress - data null coverage (Line 163 reset)', () => {
        controller.updateAIProgress(null);
        // Should not crash after fix
    });

    test('highlightMove - arrowRenderer coverage (Line 682-683)', () => {
        const move = { from: { r: 0, c: 0 }, to: { r: 0, c: 1 }, score: 100 };
        controller.highlightMove(move);
        expect(game.arrowRenderer.drawArrow).toHaveBeenCalled();
    });

    test('aiSetupPieces - affordable piece logic coverage', () => {
        game.points = 1;
        controller.aiSetupPieces();
        expect(game.placeShopPiece).toHaveBeenCalled();
    });

    test('evaluatePosition - center bonus coverage (Line 450-452)', () => {
        game.board[4][4] = { type: 'n', color: 'black' };
        const score = controller.evaluatePosition('black');
        expect(score).toBeGreaterThan(0);
    });
});
