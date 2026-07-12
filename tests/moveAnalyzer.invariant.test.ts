/**
 * Invariant tests for js/tutor/MoveAnalyzer.ts — fills the gaps the existing
 * moveAnalyzer*.test.ts suites did not cover (verified via coverage-final.json):
 *
 *  - getScoreDescription boundary thresholds (-500, <-900) that were untested
 *  - analyzeStrategicValue "open file" (no pawn on target file) and "outpost"
 *    (knight to rank 3-5 protected by a friendly pawn) branches
 *  - handlePlayerMove "guess the move" path: tutorMode === 'guess_the_move',
 *    bestMoves hit (+10 tutorPoints, success toast) vs miss (neutral toast),
 *    and the no-bestMoves early branch
 *  - showBlunderWarning undo callback dispatch: prefers moveController.undoMove,
 *    falls back to game.undoMove
 *
 * All UI side-effects (showToast / showModal) are mocked, so the suites are
 * deterministic and DOM-free.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BOARD_SIZE, PHASES } from '../js/gameEngine.js';
import * as MoveAnalyzer from '../js/tutor/MoveAnalyzer.js';
import { showToast, showModal } from '../js/ui.js';

// Mock the UI side-effect modules so we can assert on calls.
vi.mock('../js/ui.js', () => ({
  showToast: vi.fn(),
  showModal: vi.fn(),
  getPieceText: (p: any) => p?.type ?? '?',
  showMoveQuality: vi.fn(),
}));

function createTestGame(overrides: Record<string, unknown> = {}) {
  const game: any = {
    phase: PHASES.PLAY,
    turn: 'white',
    board: Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null)),
    moveHistory: [],
    tutorMode: 'standard',
    tutorPoints: 0,
    bestMoves: [],
    getAllLegalMoves: () => [],
    stats: { accuracies: [] },
    getValidMoves: () => [],
    isInCheck: () => false,
    isSquareAttacked: () => false,
    isSquareUnderAttack: () => false,
    ...overrides,
  };
  game.board[8][4] = { type: 'k', color: 'white' };
  game.board[0][4] = { type: 'k', color: 'black' };
  return game;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// getScoreDescription — full threshold ladder (boundaries were uncovered)
// ===========================================================================

describe('MoveAnalyzer.getScoreDescription — threshold boundaries', () => {
  // Cover both sides of every threshold the implementation uses.
  // Implementation returns the FIRST matching bucket from the top, so any
  // score >= 900 is a win, and the negative buckets mirror them.
  const cases: [number, string][] = [
    [900, '🏆 Gewinnstellung'],
    [3000, '🏆 Gewinnstellung'],
    [500, '⭐ Großer Vorteil'],
    [200, '✨ Klarer Vorteil'],
    [50, '➕ Leichter Vorteil'],
    [0, '⚖️ Ausgeglichen'],
    [-50, '⚖️ Ausgeglichen'],
    [-200, '➖ Leichter Nachteil'],
    [-500, '⚠️ Schwieriger'],
    [-900, '🔴 Großer Nachteil'],
    [-901, '💀 Verloren'],
  ];
  test.each(cases)('score %d => "%s"', (score, label) => {
    expect(MoveAnalyzer.getScoreDescription(score).label).toBe(label);
  });

  test('thresholds are contiguous: each boundary value lands in the expected bucket', () => {
    expect(MoveAnalyzer.getScoreDescription(899).label).toBe('⭐ Großer Vorteil');
    expect(MoveAnalyzer.getScoreDescription(499).label).toBe('✨ Klarer Vorteil');
    expect(MoveAnalyzer.getScoreDescription(199).label).toBe('➕ Leichter Vorteil');
    expect(MoveAnalyzer.getScoreDescription(49).label).toBe('⚖️ Ausgeglichen');
    expect(MoveAnalyzer.getScoreDescription(-51).label).toBe('➖ Leichter Nachteil');
    expect(MoveAnalyzer.getScoreDescription(-201).label).toBe('⚠️ Schwieriger');
    expect(MoveAnalyzer.getScoreDescription(-501).label).toBe('🔴 Großer Nachteil');
    expect(MoveAnalyzer.getScoreDescription(-899).label).toBe('🔴 Großer Nachteil');
  });

  test('color is always a 6-digit hex string', () => {
    for (const s of [-9001, -250, 0, 250, 9001]) {
      expect(MoveAnalyzer.getScoreDescription(s).color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ===========================================================================
// analyzeStrategicValue — open file / knight outpost branches
// ===========================================================================

describe('MoveAnalyzer.analyzeStrategicValue — file & outpost heuristics', () => {
  test('open file: rook to a file with NO pawns of either colour', () => {
    const game = createTestGame();
    game.board[8][0] = { type: 'r', color: 'white' };
    // ensure file c (col 2) has no pawns
    for (let r = 0; r < BOARD_SIZE; r++) game.board[r][2] = null;
    const move = { from: { r: 8, c: 0 }, to: { r: 8, c: 2 } };
    const patterns = MoveAnalyzer.analyzeStrategicValue(game, move);
    expect(patterns.some(p => p.type === 'open_file')).toBe(true);
  });

  test('semi-open does NOT count as open file (file has a pawn)', () => {
    const game = createTestGame();
    game.board[8][0] = { type: 'r', color: 'white' };
    game.board[5][2] = { type: 'p', color: 'black' }; // pawn on file c -> not open
    const move = { from: { r: 8, c: 0 }, to: { r: 8, c: 2 } };
    const patterns = MoveAnalyzer.analyzeStrategicValue(game, move);
    expect(patterns.some(p => p.type === 'open_file')).toBe(false);
  });

  test('knight outpost: to rank 3-5 protected by a friendly pawn diagonally behind', () => {
    const game = createTestGame();
    game.board[8][1] = { type: 'n', color: 'white' };
    // knight to (4,4); white pawn "behind" at (5,3) or (5,5)
    game.board[5][3] = { type: 'p', color: 'white' };
    const move = { from: { r: 8, c: 1 }, to: { r: 4, c: 4 } };
    const patterns = MoveAnalyzer.analyzeStrategicValue(game, move);
    expect(patterns.some(p => p.type === 'outpost')).toBe(true);
  });

  test('knight to central rank but NOT protected by a friendly pawn is not an outpost', () => {
    const game = createTestGame();
    game.board[8][1] = { type: 'n', color: 'white' };
    // no friendly pawn adjacent behind
    const move = { from: { r: 8, c: 1 }, to: { r: 4, c: 4 } };
    const patterns = MoveAnalyzer.analyzeStrategicValue(game, move);
    expect(patterns.some(p => p.type === 'outpost')).toBe(false);
  });

  test('knight to a back/edge rank (not 3-5) is never an outpost', () => {
    const game = createTestGame();
    game.board[8][1] = { type: 'n', color: 'white' };
    game.board[5][3] = { type: 'p', color: 'white' };
    const move = { from: { r: 8, c: 1 }, to: { r: 6, c: 4 } }; // rank 7 (index 6) not in 3-5
    const patterns = MoveAnalyzer.analyzeStrategicValue(game, move);
    expect(patterns.some(p => p.type === 'outpost')).toBe(false);
  });
});

// ===========================================================================
// handlePlayerMove — guess-the-move mode (was 0% covered)
// ===========================================================================

describe('MoveAnalyzer.handlePlayerMove — guess-the-move mode', () => {
  const mkGame = (overrides: Record<string, unknown>) =>
    createTestGame({
      getAllLegalMoves: () => [
        { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
        { from: { r: 6, c: 0 }, to: { r: 5, c: 0 } },
      ],
      ...overrides,
    });

  test('non-guess tutor mode does nothing (no toast)', () => {
    const game = mkGame({ tutorMode: 'standard' });
    MoveAnalyzer.handlePlayerMove(game, {}, { r: 6, c: 4 }, { r: 5, c: 4 });
    expect(showToast).not.toHaveBeenCalled();
    expect(game.tutorPoints).toBe(0);
  });

  test('guess mode with a correct guess awards +10 and shows success toast', () => {
    const game = mkGame({
      tutorMode: 'guess_the_move',
      bestMoves: [{ move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }, score: 100 }],
    });
    MoveAnalyzer.handlePlayerMove(game, {}, { r: 6, c: 4 }, { r: 5, c: 4 });
    expect(game.tutorPoints).toBe(10);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Richtig geraten'), 'success');
  });

  test('guess mode with a wrong guess shows neutral toast and awards no points', () => {
    const game = mkGame({
      tutorMode: 'guess_the_move',
      bestMoves: [{ move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }, score: 100 }],
    });
    MoveAnalyzer.handlePlayerMove(game, {}, { r: 6, c: 0 }, { r: 5, c: 0 });
    expect(game.tutorPoints).toBe(0);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Nicht der beste Zug'),
      'neutral'
    );
  });

  test('guess mode with NO bestMoves does not crash or award points', () => {
    const game = mkGame({ tutorMode: 'guess_the_move', bestMoves: [] });
    expect(() =>
      MoveAnalyzer.handlePlayerMove(game, {}, { r: 6, c: 4 }, { r: 5, c: 4 })
    ).not.toThrow();
    expect(game.tutorPoints).toBe(0);
    expect(showToast).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// showBlunderWarning — undo callback dispatch (was 0% covered)
// ===========================================================================

describe('MoveAnalyzer.showBlunderWarning — undo callback dispatch', () => {
  const baseAnalysis = (over: Record<string, unknown> = {}) => ({
    warnings: ['w'],
    tacticalExplanations: [],
    scoreDiff: -300,
    category: 'blunder',
    ...over,
  });

  test('post-move warning (no callback) uses the "undo Zug" button with moveController.undoMove', () => {
    const undoMove = vi.fn();
    const game: any = { moveController: { undoMove }, undoMove: vi.fn() };
    MoveAnalyzer.showBlunderWarning(game, baseAnalysis() as any, null);
    expect(showModal).toHaveBeenCalledTimes(1);
    const buttons = (showModal as any).mock.calls[0][2];
    // primary button (index 1) triggers undo
    buttons[1].callback();
    expect(undoMove).toHaveBeenCalledTimes(1);
  });

  test('post-move warning falls back to game.undoMove when no moveController', () => {
    const undoMove = vi.fn();
    const game: any = { undoMove };
    MoveAnalyzer.showBlunderWarning(game, baseAnalysis() as any, null);
    (showModal as any).mock.calls[0][2][1].callback();
    expect(undoMove).toHaveBeenCalledTimes(1);
  });

  test('pre-move warning (proceedCallback) uses proceed as primary and does not auto-undo', () => {
    const proceed = vi.fn();
    const undoMove = vi.fn();
    const game: any = { moveController: { undoMove } };
    MoveAnalyzer.showBlunderWarning(game, baseAnalysis() as any, proceed);
    const buttons = (showModal as any).mock.calls[0][2];
    expect(buttons[1].text).toContain('Trotzdem ziehen');
    buttons[1].callback();
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(undoMove).not.toHaveBeenCalled();
  });

  test('title and message differ between pre-move and post-move variants', () => {
    const game: any = { moveController: { undoMove: vi.fn() } };
    MoveAnalyzer.showBlunderWarning(game, baseAnalysis() as any, null);
    const post = (showModal as any).mock.calls[0];
    MoveAnalyzer.showBlunderWarning(game, baseAnalysis() as any, vi.fn());
    const pre = (showModal as any).mock.calls[1];
    expect(post[0]).toContain('Schwerer Fehler');
    expect(pre[0]).toContain('Grober Fehler?');
    expect(post[1]).toContain('zurücknehmen');
    expect(pre[1]).toContain('wirklich ausführen');
  });
});
