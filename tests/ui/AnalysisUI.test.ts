/**
 * AnalysisUI Tests
 * Coverage target: 66% -> 85%+
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalysisUI } from '../../js/ui/AnalysisUI.js';

// Mock PostGameAnalyzer
vi.mock('../../js/tutor/PostGameAnalyzer.js', () => ({
    analyzeGame: vi.fn().mockImplementation((_history, _color) => ({
        accuracy: 85,
        counts: { great: 2, good: 5, blunder: 1 },
    })),
    QUALITY_METADATA: {
        great: { label: 'Brillant', color: 'blue' },
        good: { label: 'Gut', color: 'green' },
        blunder: { label: 'Patzer', color: 'red' },
    },
    classifyMove: vi.fn().mockReturnValue('good'),
}));

// Mock UI.js
vi.mock('../../js/ui.js', () => ({
    showModal: vi.fn(),
    closeModal: vi.fn(),
    updateMoveHistoryUI: vi.fn(),
    renderEvalGraph: vi.fn(),
}));

describe('AnalysisUI', () => {
    let analysisUI: AnalysisUI;
    let mockApp: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = `
      <div id="evaluation-bar" class="hidden">
        <div id="eval-fill"></div>
        <span id="eval-text"></span>
        <div id="eval-marker"></div>
      </div>
      <div id="analysis-panel" class="hidden">
        <span id="analysis-score-value"></span>
        <div id="top-moves-content"></div>
        <div id="eval-bar"></div>
        <span id="eval-score"></span>
        <span id="analysis-engine-info"></span>
      </div>
    `;

        mockApp = {
            game: {
                board: [],
                moveHistory: [],
                phase: 'PLAY',
            },
        };

        analysisUI = new AnalysisUI(mockApp);
    });

    describe('constructor', () => {
        test('should initialize DOM references', () => {
            expect(analysisUI.bar).not.toBeNull();
            expect(analysisUI.fill).not.toBeNull();
            expect(analysisUI.text).not.toBeNull();
            expect(analysisUI.panel).not.toBeNull();
        });

        test('should expose game via getter', () => {
            expect(analysisUI.game).toBe(mockApp.game);
        });
    });

    describe('update()', () => {
        test('should update bar and panel', () => {
            const analysis = {
                score: 150,
                topMoves: [
                    { move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }, notation: 'e4', score: 150 },
                ],
                depth: 6,
                nodes: 10000,
            };

            // Show panel first
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.update(analysis);

            expect(analysisUI.fill?.style.height).toBeDefined();
            expect(analysisUI.text?.textContent).toContain('+');
        });
    });

    describe('updateBar()', () => {
        test('should set fill height based on score', () => {
            analysisUI.updateBar(200); // +2.00

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeGreaterThan(50); // White advantage
        });

        test('should handle negative scores', () => {
            analysisUI.updateBar(-300); // -3.00

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeLessThan(50); // Black advantage
        });

        test('should clamp extreme scores', () => {
            analysisUI.updateBar(5000); // Very high

            const fillHeight = parseFloat(analysisUI.fill?.style.height || '0');
            expect(fillHeight).toBeLessThanOrEqual(100);
        });

        test('togglePanel() should toggle visibility and return new state', () => {
            const initialState = analysisUI.panel?.classList.contains('hidden');
            const newState = analysisUI.togglePanel();
            expect(newState).toBe(!initialState);
            expect(analysisUI.panel?.classList.contains('hidden')).toBe(!initialState);
        });

        test('togglePanel() should return false if panel is missing', () => {
            analysisUI.panel = null as any;
            expect(analysisUI.togglePanel()).toBe(false);
        });

        test('should show bar when updating', () => {
            analysisUI.bar?.classList.add('hidden');

            analysisUI.updateBar(0);

            expect(analysisUI.bar?.classList.contains('hidden')).toBe(false);
        });

        test('should display formatted score text', () => {
            analysisUI.updateBar(150);

            expect(analysisUI.text?.textContent).toBe('+1.5');
        });
    });

    describe('updatePanel()', () => {
        test('should not update if panel is hidden', () => {
            analysisUI.panel?.classList.add('hidden');

            analysisUI.updatePanel(100, [], 4, 500);

            // Should not throw, just return early
        });

        test('should update score display', () => {
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.updatePanel(250, [], 6, 1000);

            expect(analysisUI.evalScoreValue?.textContent).toBe('+2.50');
        });

        test('should render top moves', () => {
            analysisUI.panel?.classList.remove('hidden');
            const topMoves = [
                { move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }, notation: 'e4', score: 50 },
                { move: { from: { r: 6, c: 3 }, to: { r: 4, c: 3 } }, notation: 'd4', score: 40 },
            ];

            analysisUI.updatePanel(50, topMoves, 4, 500);

            expect(analysisUI.topMovesContainer?.innerHTML).toContain('e4');
            expect(analysisUI.topMovesContainer?.innerHTML).toContain('d4');
        });

        test('should update engine info', () => {
            analysisUI.panel?.classList.remove('hidden');

            analysisUI.updatePanel(100, [], 8, 50000);

            expect(analysisUI.engineInfo?.textContent).toContain('Tiefe: 8');
            expect(analysisUI.engineInfo?.textContent).toContain('Knoten: 50000');
        });
    });

    describe('undoMoveOnBoard()', () => {
        const createBoard = () => Array(9).fill(null).map(() => Array(9).fill(null));

        test('should undo a standard move', () => {
            const board = createBoard();
            board[0][0] = { type: 'k', color: 'white' }; // Place piece at destination
            const move = {
                from: { r: 1, c: 0 },
                to: { r: 0, c: 0 },
                piece: { type: 'k', color: 'white', hasMoved: false },
                captured: null
            };
            analysisUI.undoMoveOnBoard(board as any, move);
            expect(board[1][0]).toEqual({ type: 'k', color: 'white', hasMoved: false });
            expect(board[0][0]).toBeNull();
        });

        test('should undo capture', () => {
            const board = createBoard();
            board[0][0] = { type: 'k', color: 'white' }; // Piece that moved
            const move = {
                from: { r: 1, c: 0 },
                to: { r: 0, c: 0 },
                piece: { type: 'k', color: 'white' },
                captured: { type: 'q', color: 'black' }
            };
            analysisUI.undoMoveOnBoard(board as any, move);
            expect(board[1][0]).toEqual({ type: 'k', color: 'white', hasMoved: false });
            expect(board[0][0]).toEqual({ type: 'q', color: 'black', hasMoved: true });
        });

        test('should undo en passant', () => {
            const board = createBoard();
            board[2][0] = { type: 'p', color: 'white' };
            const move = {
                from: { r: 1, c: 0 },
                to: { r: 0, c: 1 },
                piece: { type: 'p', color: 'white' },
                specialMove: {
                    type: 'enPassant',
                    capturedPawnPos: { r: 0, c: 0 },
                    capturedPawn: { type: 'p', color: 'black' }
                }
            };
            analysisUI.undoMoveOnBoard(board as any, move);
            expect(board[0][0]).toEqual({ type: 'p', color: 'black', hasMoved: true });
            expect(board[0][1]).toBeNull();
        });

        test('should undo castling', () => {
            const board = createBoard();
            const move = {
                from: { r: 7, c: 4 },
                to: { r: 7, c: 6 },
                piece: { type: 'k', color: 'white' },
                specialMove: {
                    type: 'castling',
                    rookFrom: { r: 7, c: 7 },
                    rookTo: { r: 7, c: 5 },
                    rookHadMoved: false
                }
            };
            board[7][5] = { type: 'r', color: 'white', hasMoved: true };
            analysisUI.undoMoveOnBoard(board as any, move);
            expect(board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
            expect(board[7][7]).toEqual({ type: 'r', color: 'white', hasMoved: false });
            expect(board[7][5]).toBeNull();
            expect(board[7][6]).toBeNull();
        });
    });

    describe('collectBoardStates()', () => {
        test('should return history of board states', () => {
            mockApp.game.board = Array(9).fill(null).map(() => Array(9).fill(null));
            mockApp.game.moveHistory = [
                {
                    from: { r: 1, c: 0 },
                    to: { r: 0, c: 0 },
                    piece: { type: 'k', color: 'white' },
                    captured: null
                }
            ];
            const states = analysisUI.collectBoardStates();
            expect(states.length).toBe(2);
            // First state should be initial (before first move)
            // Second state should be current
            expect(states[0][1][0]).toEqual({ type: 'k', color: 'white', hasMoved: false });
        });
    });

    describe('showAnalysisPrompt()', () => {
        test('should show confirmation modal', async () => {
            const { showModal } = await import('../../js/ui.js');
            analysisUI.showAnalysisPrompt();
            await new Promise(r => setTimeout(r, 0));
            expect(showModal).toHaveBeenCalledWith('Partie analysieren?', expect.any(String), expect.any(Array));

            // Trigger callback on "Analysieren" button (index 1)
            const buttons = (showModal as any).mock.calls[0][2];
            const startSpy = vi.spyOn(analysisUI, 'startFullAnalysis').mockResolvedValue(undefined);
            buttons[1].callback();
            expect(startSpy).toHaveBeenCalled();
        });
    });

    describe('showSummaryModal()', () => {
        test('should show modal with analysis results', async () => {
            const { showModal } = await import('../../js/ui.js');
            const whiteStats = { accuracy: 90, counts: { great: 1 } };
            const blackStats = { accuracy: 70, counts: { blunder: 2 } };

            analysisUI.showSummaryModal(whiteStats, blackStats);

            await new Promise(r => setTimeout(r, 0));

            expect(showModal).toHaveBeenCalledWith(
                'Analyse abgeschlossen',
                expect.stringContaining('accuracy-high'),
                expect.any(Array)
            );
        });

        test('should invoke jumpToMove(0) on callback', async () => {
            const { showModal } = await import('../../js/ui.js');
            const jumpToMove = vi.fn();
            (analysisUI.game as any).gameController = { jumpToMove };

            analysisUI.showSummaryModal({ accuracy: 0, counts: {} }, { accuracy: 0, counts: {} });
            await new Promise(r => setTimeout(r, 0));

            const buttons = (showModal as any).mock.calls[0][2];
            const primaryButton = buttons.find((b: any) => b.class === 'btn-primary');
            primaryButton.callback();

            expect(jumpToMove).toHaveBeenCalledWith(0);
        });
    });

    describe('renderStatCounts()', () => {
        test('should return HTML for statistics', () => {
            const counts = { great: 2, good: 0 };
            const html = analysisUI.renderStatCounts(counts);
            expect(html).toContain('Brillant');
            expect(html).toContain('2');
            expect(html).not.toContain('Gut');
        });
    });

    describe('startFullAnalysis()', () => {
        test('should run full game analysis using workers', async () => {
            const { showModal, closeModal } = await import('../../js/ui.js');

            const mockWorker = {
                addEventListener: vi.fn((_type, handler) => {
                    setTimeout(() => handler({
                        data: {
                            type: 'analysis',
                            data: { score: 100, topMoves: [{ score: 120 }] }
                        }
                    }), 0);
                }),
                removeEventListener: vi.fn(),
                postMessage: vi.fn(),
            };

            (analysisUI.game as any).aiController = {
                aiWorkers: [mockWorker]
            };
            mockApp.game.moveHistory = [
                { from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, piece: { type: 'p', color: 'white' }, captured: null }
            ];
            // Ensure board is large enough and fully populated with nulls
            mockApp.game.board = Array(9).fill(null).map(() => Array(9).fill(null));
            mockApp.game.board[4][4] = { type: 'p', color: 'white', hasMoved: true }; // Piece is currently at target
            mockApp.game.board[6][4] = null; // Original position is now empty

            await analysisUI.startFullAnalysis();
            await new Promise(r => setTimeout(r, 50));

            expect(mockWorker.postMessage).toHaveBeenCalled();
            expect(showModal).toHaveBeenCalledWith('Analyse abgeschlossen', expect.any(String), expect.any(Array));
            expect(closeModal).toHaveBeenCalled();
        });

        test('should return early if history is empty', async () => {
            mockApp.game.moveHistory = [];
            await analysisUI.startFullAnalysis();
            expect(analysisUI.isAnalyzing).toBe(false);
        });
    });
});
