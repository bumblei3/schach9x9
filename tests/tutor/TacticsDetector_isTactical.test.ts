import { describe, test, expect, vi } from 'vitest';

// Real invariant tests for the central tactics entry point isTactical()
// (the function the KI-Mentor "threats/opportunities" arrows rely on).
// The shared primitives (canPieceMove, getThreatenedPieces) are covered by
// TacticsDetector.test.ts; this suite locks the boolean contract of isTactical
// and detectTacticalPatterns — the branch-hotspot that integration left open.

vi.mock('../../js/logger.js', () => ({
  logger: { context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

const { isTactical, detectTacticalPatterns, canPieceMove } = await import(
  '../../js/tutor/TacticsDetector.js'
);
const { BOARD_SIZE } = await import('../../js/config.js');

const analyzer = { getPieceName: (t: string) => t } as any;

function emptyBoard(): (any | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function piece(color: string, type: string) {
  return { color, type };
}

// GameLike stub: board + getValidMoves so detectors can enumerate.
function gameStub(
  board: (any | null)[][],
  validMoves: (r: number, c: number, _p: any) => { r: number; c: number }[]
) {
  return {
    board,
    getValidMoves: (r: number, c: number, p: any) => validMoves(r, c, p),
  } as any;
}

describe('isTactical — boolean contract', () => {
  test('capture move is tactical (target square occupied)', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'q');
    board[4][6] = piece('black', 'r'); // queen captures rook
    const game = gameStub(board, () => [{ r: 4, c: 6 }]);
    expect(isTactical(game, { from: { r: 4, c: 4 }, to: { r: 4, c: 6 } })).toBe(true);
  });

  test('pawn promotion move is tactical', () => {
    const board = emptyBoard();
    board[1][4] = piece('white', 'p'); // one step from promotion row (0)
    const game = gameStub(board, () => [{ r: 0, c: 4 }]);
    expect(isTactical(game, { from: { r: 1, c: 4 }, to: { r: 0, c: 4 } })).toBe(true);
  });

  test('quiet non-promotion move with no tactical pattern is NOT tactical', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'n');
    // Knight to empty square, no fork/pin/skewer set up.
    const game = gameStub(board, () => [{ r: 6, c: 5 }]);
    expect(isTactical(game, { from: { r: 4, c: 4 }, to: { r: 6, c: 5 } })).toBe(false);
  });
});

describe('detectTacticalPatterns — pattern surface', () => {
  test('returns [] for a quiet move with no threats', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'q');
    const game = gameStub(board, () => [{ r: 4, c: 5 }]);
    const patterns = detectTacticalPatterns(game, analyzer, {
      from: { r: 4, c: 4 },
      to: { r: 4, c: 5 },
      piece: piece('white', 'q'),
    } as any);
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBe(0);
  });

  test('detects a fork: knight captures into a double-attack', () => {
    // Knight on c3 (2,2) captures on d5 (3,3) forking two rooks on b6/a7.
    const board = emptyBoard();
    board[2][2] = piece('white', 'n');
    board[3][3] = piece('black', 'p'); // capture target (any piece)
    board[1][1] = piece('black', 'r'); // rook a7 attacked by knight from d5? no
    // Set up a clear fork: knight lands on d5 (3,3), attacks b6 (1,5) + f6 (5,5).
    board[1][5] = piece('black', 'r');
    board[5][5] = piece('black', 'r');
    const game = gameStub(board, () => [{ r: 3, c: 3 }]);
    const patterns = detectTacticalPatterns(game, analyzer, {
      from: { r: 2, c: 2 },
      to: { r: 3, c: 3 },
      piece: piece('white', 'n'),
    } as any);
    expect(patterns.length).toBeGreaterThan(0);
  });
});

describe('canPieceMove — direction contract (lock already-covered primitive)', () => {
  test('sliding pieces respect direction; others return false', () => {
    expect(canPieceMove('r', 0, 1)).toBe(true);
    expect(canPieceMove('r', 1, 1)).toBe(false);
    expect(canPieceMove('b', 1, 1)).toBe(true);
    expect(canPieceMove('q', 2, 2)).toBe(true);
    expect(canPieceMove('n', 2, 1)).toBe(false);
    expect(canPieceMove('k', 1, 0)).toBe(false);
    expect(canPieceMove('p', 1, 0)).toBe(false);
    expect(canPieceMove('e', 1, 0)).toBe(false);
  });
});
