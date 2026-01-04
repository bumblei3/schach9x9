import { jest } from '@jest/globals';
import { setupJSDOM, createMockGame } from '../test-utils.js';

// Mock UI
jest.unstable_mockModule('../../js/ui.js', () => ({
  showModal: jest.fn(),
  hideModal: jest.fn(),
  showToast: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  renderEvalGraph: jest.fn(),
}));

// Mock PostGameAnalyzer
jest.unstable_mockModule('../../js/tutor/PostGameAnalyzer.js', () => ({
  analyzeGame: jest.fn(() => ({
    accuracy: 90,
    counts: {
      brilliant: 0,
      great: 0,
      best: 1,
      excellent: 1,
      good: 1,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      book: 0,
    },
  })),
  classifyMove: jest.fn(() => 'best'),
  QUALITY_METADATA: {
    brilliant: { label: 'Brilliant', symbol: '!!', color: '#31c48d' },
    great: { label: 'Großartig', symbol: '!', color: '#31c48d' },
    best: { label: 'Bester Zug', symbol: '★', color: '#9f5fef' },
    excellent: { label: 'Exzellent', symbol: '□', color: '#93c5fd' },
    good: { label: 'Gut', symbol: '✔', color: '#d1d5db' },
    inaccuracy: { label: 'Ungelauigkeit', symbol: '?!', color: '#facc15' },
    mistake: { label: 'Fehler', symbol: '?', color: '#f97316' },
    blunder: { label: 'Patzer', symbol: '??', color: '#f87171' },
    book: { label: 'Buch', symbol: '📖', color: '#a78bfa' },
  },
}));

// Mock logger
jest.unstable_mockModule('../../js/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const UI = await import('../../js/ui.js');
const PostGameAnalyzer = await import('../../js/tutor/PostGameAnalyzer.js');
const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');

describe('AnalysisUI', () => {
  let game;
  let analysisUI;
  let mockWorker;

  beforeEach(() => {
    setupJSDOM();

    mockWorker = {
      postMessage: jest.fn(),
      onmessage: null,
    };

    game = createMockGame();
    game.gameController = {
      aiController: {
        aiWorkers: [mockWorker],
      },
      moveController: {
        reconstructBoardAtMove: jest.fn(),
      },
    };

    analysisUI = new AnalysisUI(game);
    jest.clearAllMocks();
  });

  test('showAnalysisPrompt should call UI.showModal', () => {
    analysisUI.showAnalysisPrompt();
    expect(UI.showModal).toHaveBeenCalledWith(
      expect.stringContaining('Partie analysieren?'),
      expect.any(String),
      expect.any(Array)
    );
  });

  test('startFullAnalysis should handle empty move history', async () => {
    game.moveHistory = [];
    await analysisUI.startFullAnalysis();
    expect(analysisUI.isAnalyzing).toBe(false);
  });

  test('startFullAnalysis should run the analysis loop', async () => {
    game.moveHistory = [{ from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, piece: { color: 'white' } }];

    // Mock board states (initial + after move 1)
    jest.spyOn(analysisUI, 'collectBoardStates').mockReturnValue([
      [[]], // initial
      [[]], // after move 1
    ]);

    const analysisPromise = analysisUI.startFullAnalysis();

    // Check if progress modal shown
    expect(UI.showModal).toHaveBeenCalledWith('Ganganalyse', expect.any(String), [], false);

    // Position 0 check
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze',
        data: expect.objectContaining({ color: 'white' }),
      })
    );

    // Simulate worker response for position 0
    mockWorker.onmessage({
      data: { type: 'analysis', data: { score: 10, topMoves: [{ score: 15, move: {} }] } },
    });

    // Wait for next position request
    await Promise.resolve();

    // Position 1 check
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze',
        data: expect.objectContaining({ color: 'black' }),
      })
    );

    // Simulate worker response for position 1
    mockWorker.onmessage({ data: { type: 'analysis', data: { score: -20, topMoves: [] } } });

    await analysisPromise;

    // Verify results
    expect(PostGameAnalyzer.analyzeGame).toHaveBeenCalledTimes(2);
    expect(UI.updateMoveHistoryUI).toHaveBeenCalled();
    expect(UI.renderEvalGraph).toHaveBeenCalled();
    expect(UI.showModal).toHaveBeenCalledWith(
      'Analyse abgeschlossen',
      expect.any(String),
      expect.any(Array)
    );
  });

  test('showSummaryModal should handle high, mid and low accuracy color classes', () => {
    const white = { accuracy: 95, counts: {} };
    const black = { accuracy: 75, counts: {} };
    const blackLow = { accuracy: 50, counts: {} };

    // Test High
    analysisUI.showSummaryModal(white, { accuracy: 0, counts: {} });
    expect(UI.showModal).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('accuracy-high'),
      expect.any(Array)
    );

    // Test Mid
    analysisUI.showSummaryModal({ accuracy: 0, counts: {} }, black);
    expect(UI.showModal).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('accuracy-mid'),
      expect.any(Array)
    );

    // Test Low
    analysisUI.showSummaryModal({ accuracy: 0, counts: {} }, blackLow);
    expect(UI.showModal).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('accuracy-low'),
      expect.any(Array)
    );
  });

  test('summary modal button should trigger jumpToMove', () => {
    const stats = { accuracy: 90, counts: {} };
    analysisUI.showSummaryModal(stats, stats);

    const buttons = UI.showModal.mock.calls[0][2];
    const reviewButton = buttons.find(b => b.text === 'Partie durchsehen');

    game.gameController.jumpToMove = jest.fn();
    reviewButton.callback();
    expect(game.gameController.jumpToMove).toHaveBeenCalledWith(0);
  });

  test('collectBoardStates should work backwards from current board', () => {
    game.board = [['final']];
    game.moveHistory = [
      { from: { r: 1, c: 1 }, to: { r: 2, c: 2 }, piece: { type: 'p', color: 'white' } },
    ];

    // Mock undoMoveOnBoard to change board
    jest.spyOn(analysisUI, 'undoMoveOnBoard').mockImplementation(board => {
      board[0][0] = 'initial';
    });

    const states = analysisUI.collectBoardStates();
    expect(states.length).toBe(2);
    expect(states[1]).toEqual([['final']]);
    expect(states[0]).toEqual([['initial']]);
  });

  test('undoMoveOnBoard should handle normal move', () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[2][2] = { type: 'p', color: 'white', hasMoved: true };
    const move = {
      from: { r: 1, c: 1 },
      to: { r: 2, c: 2 },
      piece: { type: 'p', color: 'white', hasMoved: false },
      capturedPiece: null,
    };

    analysisUI.undoMoveOnBoard(board, move);
    expect(board[1][1]).toEqual({ type: 'p', color: 'white', hasMoved: false });
    expect(board[2][2]).toBeNull();
  });

  test('undoMoveOnBoard should handle capture', () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[2][2] = { type: 'p', color: 'white', hasMoved: true };
    const move = {
      from: { r: 1, c: 1 },
      to: { r: 2, c: 2 },
      piece: { type: 'p', color: 'white', hasMoved: false },
      capturedPiece: { type: 'r', color: 'black' },
    };

    analysisUI.undoMoveOnBoard(board, move);
    expect(board[1][1]).toEqual({ type: 'p', color: 'white', hasMoved: false });
    expect(board[2][2]).toEqual({ type: 'r', color: 'black', hasMoved: true });
  });

  test('undoMoveOnBoard should handle castling', () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[7][6] = { type: 'k', color: 'white' }; // King pos
    board[7][5] = { type: 'r', color: 'white' }; // Rook pos

    const move = {
      from: { r: 7, c: 4 },
      to: { r: 7, c: 6 },
      piece: { type: 'k', color: 'white', hasMoved: false },
      specialMove: {
        type: 'castling',
        rookFrom: { r: 7, c: 8 },
        rookTo: { r: 7, c: 5 },
        rookHadMoved: false,
      },
    };

    analysisUI.undoMoveOnBoard(board, move);
    expect(board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
    expect(board[7][8]).toEqual({ type: 'r', color: 'white', hasMoved: false });
    expect(board[7][5]).toBeNull();
    expect(board[7][6]).toBeNull();
  });

  test('undoMoveOnBoard should handle en passant', () => {
    const board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    board[2][3] = { type: 'p', color: 'white' };
    const move = {
      from: { r: 3, c: 4 },
      to: { r: 2, c: 3 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      specialMove: {
        type: 'enPassant',
        capturedPawnPos: { r: 3, c: 3 },
        capturedPawn: { color: 'black' },
      },
    };

    analysisUI.undoMoveOnBoard(board, move);
    expect(board[3][4]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(board[3][3]).toEqual({ type: 'p', color: 'black', hasMoved: true });
    expect(board[2][3]).toBeNull();
  });
});
