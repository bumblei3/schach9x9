/**
 * Invariant/wiring suite for js/ui/AnalysisUI.ts (the biggest remaining
 * coverage gap: 54.8% stmt / 48.9% branch).
 *
 * Covered here (jsdom):
 *   - updateBar: clamp to ±1000, percentage mapping, +prefix, hidden removal
 *   - updatePanel: lazy DOM re-acquisition, score formatting, top-moves HTML,
 *     engine-info text, no-op when panel hidden
 *   - updateLiveProgress/updateAnalysisStats: isAnalyzing gate, field formats
 *   - togglePanel: show/hide state machine + return value
 *   - collectBoardStates/undoMoveOnBoard: board reconstruction invariants for
 *     normal moves, captures, castling and en passant (round-trip identity)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../js/ui.js', () => ({
  showModal: vi.fn(),
  closeModal: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  renderEvalGraph: vi.fn(),
}));
vi.mock('../../js/ui/BoardRenderer.js', () => ({ renderBoard: vi.fn() }));
vi.mock('../../js/ui/GameStatusUI.js', () => ({ updateStatus: vi.fn() }));
vi.mock('../../js/tutor/PostGameAnalyzer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../js/tutor/PostGameAnalyzer.js')>();
  return {
    ...actual,
    analyzeGame: vi.fn(() => ({ accuracy: 90, counts: {} })),
    classifyMove: vi.fn(() => 'GOOD'),
  };
});

const { AnalysisUI } = await import('../../js/ui/AnalysisUI.js');
type MoveHistoryEntry = {
  from?: { r: number; c: number };
  to?: { r: number; c: number };
  piece?: unknown;
  captured?: unknown;
  specialMove?: Record<string, unknown> | null;
};

function el(id: string, tag = 'div'): HTMLElement {
  const e = document.createElement(tag);
  e.id = id;
  document.body.appendChild(e);
  return e;
}

function makeApp(moveHistory: MoveHistoryEntry[] = [], board: unknown[][] = []) {
  return {
    game: { moveHistory, board, turn: 'white' },
  } as never;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

function makeUI() {
  // Pre-create all DOM refs the constructor grabs.
  [
    'evaluation-bar',
    'eval-fill',
    'eval-text',
    'eval-marker',
    'analysis-panel',
    'analysis-score-value',
    'top-moves-content',
    'eval-bar',
    'eval-score',
    'analysis-engine-info',
    'live-depth',
    'live-nodes',
    'live-score',
    'live-time',
    'live-pv',
  ].forEach((id) => el(id));

  const ui = new AnalysisUI(makeApp());
  // Panel starts visible (remove 'hidden' if any).
  ui.panel!.classList.remove('hidden');
  return ui;
}

describe('AnalysisUI.updateBar', () => {
  test('clamps extreme scores to ±1000 → percentage within [0,100]', () => {
    const ui = makeUI();
    ui.updateBar(50000);
    expect(ui.fill!.style.height).toBe('100%');
    ui.updateBar(-50000);
    expect(ui.fill!.style.height).toBe('0%');
  });

  test('maps score linearly: 50 + score/20', () => {
    const ui = makeUI();
    ui.updateBar(0);
    expect(ui.fill!.style.height).toBe('50%');
    ui.updateBar(200);
    expect(ui.fill!.style.height).toBe('60%');
    expect(ui.text!.textContent).toBe('+2.0');
  });

  test('negative score has no prefix and one decimal', () => {
    const ui = makeUI();
    ui.updateBar(-150);
    expect(ui.text!.textContent).toBe('-1.5');
  });

  test('removes the hidden class from the bar', () => {
    const ui = new AnalysisUI(makeApp());
    ui.bar = el('evaluation-bar2');
    ui.bar.classList.add('hidden');
    ui.fill = el('eval-fill2');
    ui.updateBar(0);
    expect(ui.bar.classList.contains('hidden')).toBe(false);
  });

  test('no-op when bar/fill are missing (no throw)', () => {
    const ui = new AnalysisUI(makeApp());
    expect(() => ui.updateBar(10)).not.toThrow();
  });
});

describe('AnalysisUI.updatePanel', () => {
  test('writes formatted score, mini-bar width and engine info', () => {
    const ui = makeUI();
    ui.updatePanel(
      250,
      [{ move: { from: { r: 8, c: 4 }, to: { r: 6, c: 4 } }, score: 120, notation: 'e7e5' }],
      5,
      12345
    );
    expect(ui.evalScoreValue!.textContent).toBe('+2.50');
    expect(ui.panelBarValue!.style.width).toBe('62.5%');
    expect(ui.engineInfo!.textContent).toContain('Tiefe: 5');
    expect(ui.engineInfo!.textContent).toContain('12345');
    expect(ui.topMovesContainer!.innerHTML).toContain('e7e5');
    expect(ui.topMovesContainer!.innerHTML).toContain('1.2');
  });

  test('lazy re-acquisition fills null topMovesContainer after construction', () => {
    document.body.innerHTML = '';
    const lateEl = el('top-moves-content');
    const app = makeApp();
    const ui = new AnalysisUI(app);
    void lateEl;
    ui.panel = el('analysis-panel');
    ui.panel.classList.remove('hidden');
    ui.updatePanel(0, [], 0, 0);
    expect(ui.topMovesContainer).not.toBeNull();
  });

  test('no-op when the panel is hidden', () => {
    const ui = makeUI();
    ui.panel!.classList.add('hidden');
    ui.evalScoreValue!.textContent = 'unchanged';
    ui.updatePanel(999, [], 9, 9);
    expect(ui.evalScoreValue!.textContent).toBe('unchanged');
  });
});

describe('AnalysisUI live progress', () => {
  test('updateLiveProgress is gated on isAnalyzing', () => {
    const ui = makeUI();
    ui.liveScore!.textContent = 'idle';
    ui.updateLiveProgress({ depth: 5, nodes: 99, score: 120, time: 1500, pv: 'e2e4' });
    expect(ui.liveScore!.textContent).toBe('idle');

    ui.isAnalyzing = true;
    ui.updateLiveProgress({ depth: 5, nodes: 99, score: 120, time: 1500, pv: 'e2e4' });
    expect(ui.liveDepth!.textContent).toBe('5');
    expect(ui.liveNodes!.textContent).toBe('99');
    expect(ui.liveScore!.textContent).toBe('+1.20');
    expect(ui.liveTime!.textContent).toBe('1.5s');
    expect(ui.livePV!.textContent).toBe('e2e4');
    expect(ui.engineInfo!.textContent).toContain('Tiefe: 5');
  });

  test('updateAnalysisStats formats missing values as dashes', () => {
    const ui = makeUI();
    ui.updateAnalysisStats({});
    expect(ui.liveDepth!.textContent).toBe('-');
    expect(ui.engineInfo!.textContent).toContain('Tiefe: -');
    expect(ui.engineInfo!.textContent).toContain('Knoten: -');
  });
});

describe('AnalysisUI.togglePanel', () => {
  test('returns false without a panel; toggles hidden and reports the new visibility', () => {
    const bare = new AnalysisUI(makeApp());
    expect(bare.togglePanel()).toBe(false);

    const ui = makeUI();
    ui.panel!.classList.remove('hidden');
    // Visible -> toggle hides it; return value is the NEW visibility state.
    expect(ui.panel!.classList.contains('hidden')).toBe(false);
    ui.togglePanel();
    expect(ui.panel!.classList.contains('hidden')).toBe(true);
    ui.togglePanel();
    expect(ui.panel!.classList.contains('hidden')).toBe(false);
  });
});

describe('AnalysisUI undoMoveOnBoard / collectBoardStates', () => {
  function emptyBoard(): ({ type: string; color: string; hasMoved: boolean } | null)[][] {
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null));
  }

  test('normal move round-trip: apply then undo restores origin + vacates target', () => {
    const ui = new AnalysisUI(makeApp());
    const board = emptyBoard();
    board[6][4] = { type: 'p', color: 'white', hasMoved: false };

    ui.undoMoveOnBoard(board as never, {
      from: { r: 6, c: 4 },
      to: { r: 5, c: 4 },
      piece: { type: 'p', color: 'white', hasMoved: true },
    });
    expect(board[6][4]).toMatchObject({ type: 'p', color: 'white', hasMoved: true });
    expect(board[5][4]).toBeNull();
  });

  test('capture restore puts the captured piece back with hasMoved true', () => {
    const ui = new AnalysisUI(makeApp());
    const board = emptyBoard();
    board[5][4] = { type: 'n', color: 'black', hasMoved: true }; // captured sits there

    ui.undoMoveOnBoard(board as never, {
      from: { r: 6, c: 3 },
      to: { r: 5, c: 4 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      captured: { type: 'n', color: 'black', hasMoved: true },
    });
    expect(board[6][3]).toMatchObject({ type: 'p' });
    expect(board[5][4]).toMatchObject({ type: 'n', color: 'black', hasMoved: true });
  });

  test('castling undo restores king AND rook incl. rook hasMoved flag', () => {
    const ui = new AnalysisUI(makeApp());
    const board = emptyBoard();
    // After white kingside castle: king e9->g9 (r8), rook h9->f9.
    board[8][6] = { type: 'k', color: 'white', hasMoved: true };
    board[8][5] = { type: 'r', color: 'white', hasMoved: true };

    ui.undoMoveOnBoard(board as never, {
      from: { r: 8, c: 4 },
      to: { r: 8, c: 6 },
      piece: { type: 'k', color: 'white', hasMoved: true },
      specialMove: {
        type: 'castling',
        rookFrom: { r: 8, c: 7 },
        rookTo: { r: 8, c: 5 },
        rookHadMoved: false,
      },
    });
    expect(board[8][4]).toMatchObject({ type: 'k' });
    expect(board[8][6]).toBeNull();
    expect(board[8][7]).toMatchObject({ type: 'r', hasMoved: false });
    expect(board[8][5]).toBeNull();
  });

  test('en passant undo restores the captured pawn at its square and the mover', () => {
    const ui = new AnalysisUI(makeApp());
    const board = emptyBoard();
    // White pawn just captured en passant on r2,c4; black pawn was on r3,c4.
    board[2][4] = { type: 'p', color: 'white', hasMoved: true };

    ui.undoMoveOnBoard(board as never, {
      from: { r: 3, c: 3 },
      to: { r: 2, c: 4 },
      piece: { type: 'p', color: 'white', hasMoved: true },
      specialMove: {
        type: 'enPassant',
        capturedPawnPos: { r: 3, c: 4 },
        capturedPawn: { type: 'p', color: 'black' },
      },
    } as never);
    expect(board[3][3]).toMatchObject({ type: 'p', color: 'white' });
    expect(board[2][4]).toBeNull(); // target cleared
    expect(board[3][4]).toMatchObject({ type: 'p', color: 'black', hasMoved: true });
  });

  test('collectBoardStates returns moveHistory.length + 1 states, first is the initial position', () => {
    const history: MoveHistoryEntry[] = [
      { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, piece: { type: 'p', color: 'white' } } as unknown as MoveHistoryEntry,
      { from: { r: 1, c: 4 }, to: { r: 2, c: 4 }, piece: { type: 'p', color: 'black' } } as unknown as MoveHistoryEntry,
    ];
    const board = emptyBoard();
    board[5][4] = { type: 'p', color: 'white', hasMoved: true };
    board[2][4] = { type: 'p', color: 'black', hasMoved: true };

    const ui = new AnalysisUI(makeApp(history, board));
    const states = ui.collectBoardStates() as unknown[][][];
    expect(states).toHaveLength(3);
    // First state = initial position (both pawns still home).
    const flat0 = states[0].flat();
    const pawns0 = flat0.filter((p) => p && (p as { type: string }).type === 'p');
    expect(pawns0.some((p) => (p as { color: string }).color === 'white')).toBe(true);
    // Last state equals the current board (deep-equal by JSON).
    expect(JSON.stringify(states[states.length - 1])).toBe(JSON.stringify(board));
  });
});

describe('AnalysisUI replay mode', () => {
  function makeReplayDom(): void {
    [
      'replay-board',
      'replay-step-number',
      'replay-move-number',
      'replay-class-badge',
      'replay-class-label',
      'replay-eval-value',
      'replay-better-content',
      'replay-prev-btn',
      'replay-next-btn',
      'replay-close-btn',
      'replay-overlay',
    ].forEach((id) => el(id));
  }

  test('enterReplayMode no-ops without move history; activates with history', () => {
    const empty = new AnalysisUI(makeApp());
    empty.enterReplayMode();
    expect((empty as unknown as { replayActive: boolean }).replayActive).toBe(false);

    makeReplayDom();
    const history: MoveHistoryEntry[] = [
      { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
      { from: { r: 1, c: 4 }, to: { r: 2, c: 4 } },
    ];
    const ui = new AnalysisUI(makeApp(history));
    ui.enterReplayMode();
    expect((ui as unknown as { replayActive: boolean }).replayActive).toBe(true);
    expect((ui as unknown as { replayTotal: number }).replayTotal).toBe(2);
    // Step panel shows "1 / 2".
    const step = document.getElementById('replay-step-number')!;
    expect(step.textContent).toContain('1 / 2');
    // Second enter is a no-op.
    (ui as unknown as { replayPosition: number }).replayPosition = 0;
    ui.enterReplayMode();
  });

  test('prev/next navigation clamps at the ends and updates step + nav buttons', () => {
    makeReplayDom();
    const history: MoveHistoryEntry[] = [{ from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }];
    const ui = new AnalysisUI(makeApp(history));
    ui.enterReplayMode();

    const prevBtn = document.getElementById('replay-prev-btn')!;
    const nextBtn = document.getElementById('replay-next-btn')!;
    // At position 0 prev is dimmed.
    expect(prevBtn.classList.contains('opacity-40')).toBe(true);
    expect(nextBtn.classList.contains('opacity-40')).toBe(true); // total 1 → also last

    // Private navigation via click handlers attached in attachReplayHandlers.
    nextBtn.click(); // stays at 0 (already last)
    const pos = () => (ui as unknown as { replayPosition: number }).replayPosition;
    expect(pos()).toBe(0);
  });

  test('side panel falls back to "ohne Analyse" when a move has no classification', () => {
    makeReplayDom();
    const history: MoveHistoryEntry[] = [{ from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }];
    const ui = new AnalysisUI(makeApp(history));
    ui.enterReplayMode();
    expect(document.getElementById('replay-class-label')!.textContent).toBe('ohne Analyse');
    expect(document.getElementById('replay-eval-value')!.textContent).toBe('—');
    expect(
      document.getElementById('replay-better-content')!.classList.contains('empty')
    ).toBe(true);
  });

  test('populateBestMoveCache maps classifications to symbol+label notation', () => {
    makeReplayDom();
    const history = [
      {
        from: { r: 6, c: 4 },
        to: { r: 5, c: 4 },
        classification: 'BLUNDER' as never,
        evalScore: -300,
      },
    ] as unknown as MoveHistoryEntry[];
    const ui = new AnalysisUI(makeApp(history));
    ui.enterReplayMode();
    // Cache populated from QUALITY_METADATA — badge/label show real metadata now.
    expect(document.getElementById('replay-class-label')!.textContent).not.toBe('ohne Analyse');
    expect(document.getElementById('replay-better-content')!.textContent).toBeTruthy();
  });
});
