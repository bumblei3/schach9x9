import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the heavy UI module (modal + history render) so we can assert on calls
vi.mock('../../js/ui.js', () => ({
  showModal: vi.fn(),
  closeModal: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

// Mock PostGameAnalyzer with the real QUALITY_METADATA so renderStatCounts works
vi.mock('../../js/tutor/PostGameAnalyzer.js', () => {
  const MOVE_QUALITY = {
    BRILLIANT: 'brilliant',
    GREAT: 'great',
    BEST: 'best',
    EXCELLENT: 'excellent',
    GOOD: 'good',
    INACCURACY: 'inaccuracy',
    MISTAKE: 'mistake',
    BLUNDER: 'blunder',
    BOOK: 'book',
  } as const;
  const QUALITY_METADATA: Record<string, { label: string; symbol: string; color: string }> = {
    [MOVE_QUALITY.BRILLIANT]: { label: 'Brilliant', symbol: '!!', color: '#31c48d' },
    [MOVE_QUALITY.GREAT]: { label: 'Großartig', symbol: '!', color: '#31c48d' },
    [MOVE_QUALITY.BEST]: { label: 'Bester Zug', symbol: '★', color: '#9f5fef' },
    [MOVE_QUALITY.EXCELLENT]: { label: 'Exzellent', symbol: '□', color: '#93c5fd' },
    [MOVE_QUALITY.GOOD]: { label: 'Gut', symbol: '✔', color: '#d1d5db' },
    [MOVE_QUALITY.INACCURACY]: { label: 'Ungelauigkeit', symbol: '?!', color: '#facc15' },
    [MOVE_QUALITY.MISTAKE]: { label: 'Fehler', symbol: '?', color: '#f97316' },
    [MOVE_QUALITY.BLUNDER]: { label: 'Patzer', symbol: '??', color: '#f87171' },
    [MOVE_QUALITY.BOOK]: { label: 'Buch', symbol: '📖', color: '#a78bfa' },
  };
  return {
    MOVE_QUALITY,
    QUALITY_METADATA,
    analyzeGame: vi.fn(() => ({ accuracy: 90, counts: { best: 3 } })),
    classifyMove: vi.fn(() => 'best'),
  };
});

const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');
const ui = await import('../../js/ui.js');
const pg = await import('../../js/tutor/PostGameAnalyzer.js');

function setupDom() {
  document.body.innerHTML = `
    <div id="evaluation-bar">
      <div id="eval-fill"></div>
      <div id="eval-text"></div>
      <div id="eval-marker"></div>
    </div>
    <div id="analysis-panel" class="hidden">
      <div id="eval-score"></div>
      <div id="eval-bar"></div>
      <div id="top-moves-content"></div>
      <div id="analysis-engine-info"></div>
    </div>
    <div id="live-depth"></div>
    <div id="live-nodes"></div>
    <div id="live-score"></div>
    <div id="live-time"></div>
    <div id="live-pv"></div>
  `;
}

describe('AnalysisUI branch coverage', () => {
  let analysisUI: any;

  beforeEach(() => {
    setupDom();
    analysisUI = new AnalysisUI({} as any);
    (ui.showModal as any).mockClear();
    (ui.closeModal as any).mockClear();
    (ui.updateMoveHistoryUI as any).mockClear();
    (ui.renderEvalGraph as any).mockClear();
    (pg.analyzeGame as any).mockClear();
  });

  // --- updateBar / updatePanel edge branches ---
  test('updateBar clamps at +1000 and -1000', () => {
    analysisUI.updateBar(5000);
    expect(document.getElementById('eval-fill')!.style.height).toBe('100%');
    analysisUI.updateBar(-5000);
    expect(document.getElementById('eval-fill')!.style.height).toBe('0%');
  });

  test('updateBar shows "+" prefix only for positive score', () => {
    analysisUI.updateBar(50);
    expect(document.getElementById('eval-text')!.textContent).toBe('+0.5');
    analysisUI.updateBar(0);
    expect(document.getElementById('eval-text')!.textContent).toBe('0.0');
  });

  test('updatePanel early-returns when panel hidden', () => {
    document.getElementById('analysis-panel')!.classList.add('hidden');
    // should not throw and not touch eval-score
    expect(() => analysisUI.updatePanel(100, [], 1, 1)).not.toThrow();
    expect(document.getElementById('eval-score')!.textContent).toBe('');
  });

  test('updatePanel renders top moves with notation fallback "??"', () => {
    analysisUI.togglePanel();
    analysisUI.updatePanel(
      100,
      [
        { score: 20, move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } }, // no notation
        { notation: 'Nf3', score: -20, move: { from: { r: 7, c: 1 }, to: { r: 5, c: 2 } } },
      ],
      12,
      9000
    );
    const container = document.getElementById('top-moves-content')!;
    expect(container.children.length).toBe(2);
    expect(container.innerHTML).toContain('??');
    expect(container.innerHTML).toContain('Nf3');
  });

  test('updatePanel skips top-moves render when container missing', () => {
    analysisUI.togglePanel();
    analysisUI.topMovesContainer = null;
    expect(() => analysisUI.updatePanel(100, [{ move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } } }], 1, 1)).not.toThrow();
  });

  test('updatePanel skips engine-info when element missing', () => {
    analysisUI.togglePanel();
    analysisUI.engineInfo = null;
    expect(() => analysisUI.updatePanel(100, [], 1, 1)).not.toThrow();
  });

  // --- live progress branches ---
  test('updateLiveProgress returns early when not analyzing', () => {
    analysisUI.isAnalyzing = false;
    analysisUI.updateLiveProgress({ depth: 5, nodes: 100, score: 30, time: 200, pv: 'e4' });
    expect(document.getElementById('live-depth')!.textContent).toBe('');
  });

  test('updateLiveProgress updates all live fields and engine info', () => {
    analysisUI.isAnalyzing = true;
    analysisUI.updateLiveProgress({ depth: 5, nodes: 1234, score: 30, time: 2000, pv: 'e4 e5' });
    expect(document.getElementById('live-depth')!.textContent).toBe('5');
    expect(document.getElementById('live-nodes')!.textContent).toMatch(/1[.,]?234/);
    expect(document.getElementById('live-score')!.textContent).toBe('+0.30');
    expect(document.getElementById('live-time')!.textContent).toBe('2.0s');
    expect(document.getElementById('live-pv')!.textContent).toBe('e4 e5');
    expect(document.getElementById('analysis-engine-info')!.textContent).toContain('Tiefe: 5');
    expect(document.getElementById('analysis-engine-info')!.textContent).toMatch(/1[.,]?234/);
    expect(document.getElementById('analysis-engine-info')!.textContent).toContain('2.0s');
  });

  test('updateLiveProgress handles missing optional fields with "-"', () => {
    analysisUI.isAnalyzing = true;
    analysisUI.updateLiveProgress({});
    expect(document.getElementById('live-depth')!.textContent).toBe('-');
    expect(document.getElementById('live-nodes')!.textContent).toBe('-');
    expect(document.getElementById('live-score')!.textContent).toBe('-');
    expect(document.getElementById('live-time')!.textContent).toBe('-');
    expect(document.getElementById('live-pv')!.textContent).toBe('-');
  });

  test('updateLiveProgress handles negative score sign', () => {
    analysisUI.isAnalyzing = true;
    analysisUI.updateLiveProgress({ score: -40 });
    expect(document.getElementById('live-score')!.textContent).toBe('-0.40');
  });

  test('updateAnalysisStats updates live + engine info', () => {
    analysisUI.updateAnalysisStats({ depth: 7, nodes: 555, score: 80, time: 1500 });
    expect(document.getElementById('live-depth')!.textContent).toBe('7');
    expect(document.getElementById('live-nodes')!.textContent).toBe('555');
    expect(document.getElementById('live-score')!.textContent).toBe('+0.80');
    expect(document.getElementById('live-time')!.textContent).toBe('1.5s');
    expect(document.getElementById('analysis-engine-info')!.textContent).toContain('Tiefe: 7');
  });

  test('updateAnalysisStats handles undefined score and missing time', () => {
    analysisUI.updateAnalysisStats({ depth: 3, nodes: 100 });
    expect(document.getElementById('live-score')!.textContent).toBe('');
    expect(document.getElementById('analysis-engine-info')!.textContent).toContain('0.0s');
  });

  test('updateAnalysisStats skips missing live elements', () => {
    analysisUI.liveDepth = null;
    analysisUI.liveNodes = null;
    analysisUI.liveTime = null;
    analysisUI.liveScore = null;
    analysisUI.engineInfo = null;
    expect(() => analysisUI.updateAnalysisStats({ depth: 1, nodes: 1, score: 1, time: 1 })).not.toThrow();
  });

  // --- showAnalysisPrompt ---
  test('showAnalysisPrompt opens modal with callback', () => {
    analysisUI.showAnalysisPrompt();
    expect(ui.showModal).toHaveBeenCalled();
    const buttons = (ui.showModal as any).mock.calls[0][2];
    expect(buttons.some((b: any) => b.text === 'Analysieren')).toBe(true);
    // invoke the callback -> startFullAnalysis, guarded by empty moveHistory
    const analyzeBtn = buttons.find((b: any) => b.text === 'Analysieren');
    analyzeBtn.callback();
    // game has no moveHistory -> sets isAnalyzing false and returns
    expect(analysisUI.isAnalyzing).toBe(false);
  });

  // --- undoMoveOnBoard branches ---
  function emptyBoard(): any[][] {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
  }

  test('undoMoveOnBoard restores a normal non-capturing move', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'p', color: 'white', hasMoved: true };
    const move: any = {
      from: { r: 4, c: 4 },
      to: { r: 4, c: 5 },
      piece: { type: 'p', color: 'white', hasMoved: true },
    };
    analysisUI.undoMoveOnBoard(board, move);
    expect(board[4][4]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(board[4][5]).toBeNull();
  });

  test('undoMoveOnBoard restores a capturing move', () => {
    const board = emptyBoard();
    board[4][5] = { type: 'n', color: 'black', hasMoved: true };
    const move: any = {
      from: { r: 4, c: 4 },
      to: { r: 4, c: 5 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      captured: { type: 'n', color: 'black', hasMoved: true },
    };
    analysisUI.undoMoveOnBoard(board, move);
    expect(board[4][4]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(board[4][5]).toEqual({ type: 'n', color: 'black', hasMoved: true }); // captured restored
  });

  test('undoMoveOnBoard restores castling', () => {
    const board = emptyBoard();
    board[8][6] = { type: 'k', color: 'white', hasMoved: true };
    board[8][5] = { type: 'r', color: 'white', hasMoved: true };
    const move: any = {
      from: { r: 8, c: 4 },
      to: { r: 8, c: 6 },
      piece: { type: 'k', color: 'white', hasMoved: true },
      specialMove: {
        type: 'castling',
        rookFrom: { r: 8, c: 7 },
        rookTo: { r: 8, c: 5 },
        rookHadMoved: false,
      },
    };
    analysisUI.undoMoveOnBoard(board, move);
    // king back to e1 (8,4), rook back to h1 (8,7)
    expect(board[8][4]).toEqual({ type: 'k', color: 'white', hasMoved: true });
    expect(board[8][7]).toEqual({ type: 'r', color: 'white', hasMoved: false });
  });

  test('undoMoveOnBoard restores en passant', () => {
    const board = emptyBoard();
    board[5][5] = { type: 'p', color: 'white', hasMoved: true };
    const move: any = {
      from: { r: 4, c: 4 },
      to: { r: 5, c: 5 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      specialMove: {
        type: 'enPassant',
        capturedPawnPos: { r: 4, c: 5 },
        capturedPawn: { type: 'p', color: 'black', hasMoved: true },
      },
    };
    analysisUI.undoMoveOnBoard(board, move);
    expect(board[4][4]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    // captured pawn restored on the captured square
    expect(board[4][5]).toEqual({ type: 'p', color: 'black', hasMoved: true });
  });

  test('undoMoveOnBoard en passant infers pawn color from game turn', () => {
    const board = emptyBoard();
    board[5][5] = { type: 'p', color: 'white', hasMoved: true };
    analysisUI.app.game = { turn: 'black' };
    const move: any = {
      from: { r: 4, c: 4 },
      to: { r: 5, c: 5 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      specialMove: { type: 'enPassant', capturedPawnPos: { r: 4, c: 5 } },
    };
    analysisUI.undoMoveOnBoard(board, move);
    expect(board[4][5]).toEqual({ type: 'p', color: 'white', hasMoved: true });
  });

  // --- collectBoardStates ---
  test('collectBoardStates includes start + one state per move', () => {
    const board: any[][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    board[8][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' };
    analysisUI.app.game = {
      board,
      turn: 'white',
      moveHistory: [
        { from: { r: 8, c: 4 }, to: { r: 7, c: 4 }, piece: { type: 'k', color: 'white' } },
      ],
    } as any;
    const states = analysisUI.collectBoardStates();
    expect(states.length).toBe(2);
  });

  // --- renderStatCounts ---
  test('renderStatCounts filters zero counts and renders label/color', () => {
    const html = analysisUI.renderStatCounts({ best: 3, mistake: 0 });
    expect(html).toContain('Bester Zug');
    expect(html).toContain('3');
    expect(html).not.toContain('Fehler');
  });

  // --- showSummaryModal ---
  test('showSummaryModal opens modal and wires "durchsehen" callback', () => {
    const jumpToMove = vi.fn();
    analysisUI.app.game = { gameController: { jumpToMove } };
    analysisUI.showSummaryModal({ accuracy: 90, counts: { best: 2 } }, { accuracy: 50, counts: { blunder: 1 } });
    expect(ui.showModal).toHaveBeenCalled();
    const content = (ui.showModal as any).mock.calls[0][1];
    expect(content).toContain('90%');
    expect(content).toContain('50%');
    const buttons = (ui.showModal as any).mock.calls[0][2];
    const review = buttons.find((b: any) => b.text.includes('durchsehen'));
    review.callback();
    expect(jumpToMove).toHaveBeenCalledWith(0);
  });

  test('showSummaryModal accuracy class thresholds', () => {
    const high = analysisUI.showSummaryModal({ accuracy: 90, counts: {} }, { accuracy: 70, counts: {} });
    const mid = analysisUI.showSummaryModal({ accuracy: 70, counts: {} }, { accuracy: 40, counts: {} });
    const low = analysisUI.showSummaryModal({ accuracy: 40, counts: {} }, { accuracy: 10, counts: {} });
    void high; void mid; void low;
    // assert the right accuracy classes appear
    expect((ui.showModal as any).mock.calls.some((c: any) => c[1].includes('accuracy-high'))).toBe(true);
    expect((ui.showModal as any).mock.calls.some((c: any) => c[1].includes('accuracy-mid'))).toBe(true);
    expect((ui.showModal as any).mock.calls.some((c: any) => c[1].includes('accuracy-low'))).toBe(true);
  });

  // --- startFullAnalysis ---
  test('startFullAnalysis returns early on empty moveHistory', async () => {
    analysisUI.app.game = { moveHistory: [] } as any;
    await analysisUI.startFullAnalysis();
    expect(analysisUI.isAnalyzing).toBe(false);
    expect(ui.showModal).not.toHaveBeenCalled();
  });

  test('startFullAnalysis returns early when no worker available', async () => {
    const board: any[][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    analysisUI.app.game = {
      board,
      turn: 'white',
      moveHistory: [{ from: { r: 8, c: 4 }, to: { r: 7, c: 4 }, piece: { type: 'k', color: 'white' } }],
    } as any;
    // no aiController -> no worker -> returns early without driving UI
    await analysisUI.startFullAnalysis();
    expect(ui.closeModal).not.toHaveBeenCalled();
    expect(ui.updateMoveHistoryUI).not.toHaveBeenCalled();
  });

  test('startFullAnalysis drives worker and classifies moves', async () => {
    const board: any[][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
    const move = { from: { r: 8, c: 4 }, to: { r: 7, c: 4 }, piece: { type: 'k', color: 'white' } };
    analysisUI.app.game = { board, turn: 'white', moveHistory: [move] } as any;

    const handlerRef: any = { fn: null };
    const worker: any = {
      // each postMessage triggers the registered analysis response
      postMessage: () => {
        handlerRef.fn?.({
          data: {
            type: 'analysis',
            data: { score: 10, topMoves: [{ move: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }, score: 10 }] },
          },
        });
      },
      addEventListener: (_type: string, fn: any) => { handlerRef.fn = fn; },
      removeEventListener: vi.fn(),
    };
    analysisUI.app.game.aiController = { aiWorkers: [worker] };

    await analysisUI.startFullAnalysis();

    expect(analysisUI.isAnalyzing).toBe(false);
    expect(ui.closeModal).toHaveBeenCalled();
    expect(ui.updateMoveHistoryUI).toHaveBeenCalled();
    expect(ui.renderEvalGraph).toHaveBeenCalled();
    expect(pg.analyzeGame).toHaveBeenCalledTimes(2);
    expect(pg.classifyMove).toHaveBeenCalled();
    expect((move as any).classification).toBe('best');
  });
});
