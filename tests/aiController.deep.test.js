import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/gameEngine.js';

// Mock UI module
const mockUI = {
    renderBoard: jest.fn(),
    updateAnalysisUI: jest.fn()
};
jest.unstable_mockModule('../js/ui.js', () => mockUI);

// Mock Logger
jest.unstable_mockModule('../js/logger.js', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    }
}));

// Mock Worker global
class MockWorker {
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.onmessage = null;
    }
    postMessage = jest.fn();
    terminate = jest.fn();
}
global.Worker = MockWorker;

// Mock Fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({ "e2-e4": "e7-e5" })
    })
);

// Import AIController
const { AIController } = await import('../js/aiController.js');

describe('AIController Deep Logic', () => {
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
            drawOfferedBy: null,
            mode: 'pve',
            placeKing: jest.fn(),
            placeShopPiece: jest.fn(() => { game.points -= 1; }), // Decrement to avoid infinite loop
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
            renderBoard: jest.fn()
        };

        controller = new AIController(game);

        document.body.innerHTML = `
            <div id="spinner-overlay"></div>
            <div id="ai-depth"></div>
            <div id="ai-nodes"></div>
            <div id="ai-best-move"></div>
            <div id="progress-fill"></div>
            <div id="eval-bar"></div>
            <div id="eval-score"></div>
            <div id="top-moves-content"></div>
        `;

        jest.clearAllMocks();
    });

    describe('Setup Phase', () => {
        test('aiSetupKing should place king randomly in corridor', () => {
            controller.aiSetupKing();
            expect(game.placeKing).toHaveBeenCalledWith(1, expect.any(Number), 'black');
            expect(mockUI.renderBoard).toHaveBeenCalled();
        });

        test('aiSetupPieces should buy pieces until points are spent', () => {
            controller.aiSetupPieces();
            expect(game.placeShopPiece).toHaveBeenCalled();
            expect(game.finishSetupPhase).toHaveBeenCalled();
        });
    });

    describe('Resignation & Draw Logic', () => {
        test('aiShouldResign should return true if score is hopeless', () => {
            // Mock evaluatePosition to return hopeless score for black
            const realEval = controller.evaluatePosition;
            controller.evaluatePosition = jest.fn(() => -2000);

            expect(controller.aiShouldResign()).toBe(true);

            controller.evaluatePosition = realEval;
        });

        test('aiShouldResign should return true if material disadvantage is high', () => {
            game.calculateMaterialAdvantage.mockReturnValue(20); // White +20
            expect(controller.aiShouldResign()).toBe(true);
        });

        test('aiEvaluateDrawOffer should accept if losing', () => {
            game.drawOffered = true;
            game.drawOfferedBy = 'white';
            const realEval = controller.evaluatePosition;
            controller.evaluatePosition = jest.fn(() => -300); // AI is losing

            controller.aiEvaluateDrawOffer();
            expect(game.acceptDraw).toHaveBeenCalled();

            controller.evaluatePosition = realEval;
        });

        test('aiShouldOfferDraw should return true if repetition imminent', () => {
            game.positionHistory = ['hash', 'hash'];
            game.getBoardHash.mockReturnValue('hash');

            expect(controller.aiShouldOfferDraw()).toBe(true);
        });
    });

    describe('AI Move & Progress', () => {
        test('aiMove should initiate worker and post message', () => {
            controller.aiMove();
            expect(controller.aiWorker).toBeDefined();
            expect(controller.aiWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'getBestMove'
            }));
        });

        test('updateAIProgress should update DOM elements', () => {
            const data = {
                depth: 3,
                maxDepth: 5,
                nodes: 1000,
                bestMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }
            };
            controller.updateAIProgress(data);

            expect(document.getElementById('ai-depth').textContent).toContain('3/5');
            expect(document.getElementById('ai-nodes').textContent).toContain('1.000');
            expect(document.getElementById('ai-best-move').textContent).toContain('e3-e5'); // 9x9 board: r6->e3, r4->e5
        });
    });

    describe('Analysis Mode', () => {
        test('analyzePosition should post analyze message to worker', () => {
            game.analysisMode = true;
            game.turn = 'white';
            controller.analyzePosition();

            expect(controller.aiWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'analyze'
            }));
        });

        test('updateAnalysisUI should update eval bar and top moves', () => {
            const analysis = {
                score: 50,
                topMoves: [
                    { from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, score: 50 }
                ]
            };
            controller.updateAnalysisUI(analysis);

            expect(document.getElementById('eval-score').textContent).toBe('0.50');
            expect(document.getElementById('top-moves-content').innerHTML).toContain('e3-e5');
        });

        test('highlightMove should add CSS classes to cells', () => {
            document.body.innerHTML += `
                <div class="cell" data-r="6" data-c="4"></div>
                <div class="cell" data-r="4" data-c="4"></div>
            `;
            const move = { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } };
            controller.highlightMove(move);

            expect(document.querySelector('.cell[data-r="6"][data-c="4"]').classList.contains('analysis-from')).toBe(true);
            expect(document.querySelector('.cell[data-r="4"][data-c="4"]').classList.contains('analysis-to')).toBe(true);
        });
    });

    describe('Search & Evaluation Logic', () => {
        test('evaluateMove should simulate move and return score', () => {
            game.board[6][4] = { type: 'p', color: 'white' };
            const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };

            const score = controller.evaluateMove(move);
            expect(score).toBeDefined();
            // Verify board was restored
            expect(game.board[6][4]).toBeDefined();
            expect(game.board[5][4]).toBeNull();
        });

        test('minimax should recurse and return score', () => {
            const move = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };
            game.board[6][4] = { type: 'p', color: 'white' };
            game.getAllLegalMoves = jest.fn()
                .mockReturnValueOnce([{ from: { r: 1, c: 4 }, to: { r: 2, c: 4 } }]) // White moves
                .mockReturnValue([]); // Terminal

            const score = controller.minimax(move, 1, false, -Infinity, Infinity);
            expect(score).toBeDefined();
        });

        test('quiescenceSearch should handle captures', () => {
            game.board[4][4] = { type: 'p', color: 'white' };
            game.board[3][4] = { type: 'p', color: 'black' };

            // Mock getAllLegalMoves to return a capture
            game.getAllLegalMoves = jest.fn(() => [
                { from: { r: 3, r: 4 }, to: { r: 4, c: 4 } }
            ]);

            const score = controller.quiescenceSearch(-Infinity, Infinity, true);
            expect(score).toBeDefined();
        });

        test('evaluatePosition should consider piece-square tables and center control', () => {
            game.board[4][4] = { type: 'p', color: 'black' }; // Center
            const score = controller.evaluatePosition('black');
            expect(score).toBeGreaterThan(100); // 100 for pawn + center bonus
        });
    });
});
