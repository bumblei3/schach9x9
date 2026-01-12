
import { setupJSDOM, createMockGame } from '../test-utils.js';

// Mock UI module
vi.mock('../../js/ui.js', () => ({
  showModal: vi.fn(),
  closeModal: vi.fn(),
  showToast: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

// Mock PostGameAnalyzer
vi.mock('../../js/tutor/PostGameAnalyzer.js', () => ({
  analyzeGame: vi.fn(() => ({
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
  classifyMove: vi.fn(() => 'best'),
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
vi.mock('../../js/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const UI = await import('../../js/ui.js');
await import('../../js/tutor/PostGameAnalyzer.js');
const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');

describe('AnalysisUI', () => {
  let game;
  let analysisUI;
  let mockWorker;

  beforeEach(() => {
    setupJSDOM();

    mockWorker = {
      postMessage: vi.fn(),
      onmessage: null,
      addEventListener: vi.fn((type, handler) => {
        if (type === 'message') mockWorker.onmessage = handler;
      }),
      removeEventListener: vi.fn(),
    };

    game = createMockGame();
    game.aiController = {
      aiWorkers: [mockWorker],
    };
    game.gameController = {
      moveController: {
        reconstructBoardAtMove: vi.fn(),
      },
    };

    analysisUI = new AnalysisUI({ game });
    vi.clearAllMocks();
  });

  test('showAnalysisPrompt should call UI.showModal', async () => {
    analysisUI.showAnalysisPrompt();
    // Wait for dynamic import
    await new Promise(resolve => setTimeout(resolve, 10));
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

  test('collectBoardStates should work backwards from current board', () => {
    game.board = [['final']];
    game.moveHistory = [
      { from: { r: 1, c: 1 }, to: { r: 2, c: 2 }, piece: { type: 'p', color: 'white' } },
    ];

    // Mock undoMoveOnBoard to change board
    vi.spyOn(analysisUI, 'undoMoveOnBoard').mockImplementation(board => {
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
      captured: { type: 'r', color: 'black' },
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

  test('showSummaryModal should call UI.showModal with accuracy classes', async () => {
    const white = { accuracy: 95, counts: {} };
    const black = { accuracy: 50, counts: {} };

    analysisUI.showSummaryModal(white, black);
    // Wait for dynamic import
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(UI.showModal).toHaveBeenCalledWith(
      'Analyse abgeschlossen',
      expect.stringContaining('accuracy-high'),
      expect.any(Array)
    );
  });
});
