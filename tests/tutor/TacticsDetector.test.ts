/**
 * Focused tests for js/tutor/TacticsDetector.ts — piece-move legality and the
 * threat/defence/attack primitive detectors.
 *
 * TacticsDetector had NO dedicated test file before this. The move-legality
 * table (canPieceMove) and the threat surface primitives (getThreatenedPieces,
 * getDefendedPieces, countDefenders, countAttackers, isTactical) are pure logic
 * that underpins the KI-Mentor "threats/opportunities" arrows. The heavier
 * pattern detectors (detectPins / detectSkewers / detectBattery / detectTactical
 * Patterns) are exercised indirectly through getThreatenedPieces-style paths
 * but their full branch coverage is left to integration — this suite locks the
 * shared primitives, not the 1001-line pattern catalog.
 */

import { describe, test, expect, vi } from 'vitest';

vi.mock('../../js/logger.js', () => ({
  logger: { context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

const td = await import('../../js/tutor/TacticsDetector.js');

const { BOARD_SIZE } = await import('../../js/config.js');

// Minimal analyzer stub — just echoes the piece type as its name.
const analyzer = { getPieceName: (t: string) => t } as any;

// Build a 9x9 board filled with nulls.
function emptyBoard(): (any | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

// A GameLike stub: board + a configurable getValidMoves mock.
function gameStub(
  board: (any | null)[][],
  validMoves: (r: number, c: number, piece: any) => { r: number; c: number }[]
) {
  return {
    board,
    getValidMoves: (r: number, c: number, piece: any) => validMoves(r, c, piece),
  } as any;
}

function piece(color: string, type: string) {
  return { color, type };
}

describe('canPieceMove', () => {
  // NOTE: canPieceMove only models the *direction* of sliding pieces
  // (r/c/b/a/q). Knights, kings, pawns and the angel are intentionally not
  // supported here (returns false) — these tests lock that contract.

  test('rook/chancellor move orthogonally only', () => {
    expect(td.canPieceMove('r', 0, 1)).toBe(true); // vertical
    expect(td.canPieceMove('r', 1, 0)).toBe(true); // horizontal
    expect(td.canPieceMove('r', 1, 1)).toBe(false); // diagonal
    expect(td.canPieceMove('c', 0, 3)).toBe(true);
    expect(td.canPieceMove('c', 2, 2)).toBe(false);
  });

  test('bishop/archbishop move diagonally only', () => {
    expect(td.canPieceMove('b', 1, 1)).toBe(true);
    expect(td.canPieceMove('b', 3, 3)).toBe(true);
    expect(td.canPieceMove('b', 1, 0)).toBe(false);
    expect(td.canPieceMove('a', 2, 2)).toBe(true);
    expect(td.canPieceMove('a', 2, 1)).toBe(false);
  });

  test('queen moves in any non-zero direction', () => {
    expect(td.canPieceMove('q', 1, 0)).toBe(true);
    expect(td.canPieceMove('q', 2, 2)).toBe(true);
    expect(td.canPieceMove('q', 0, 0)).toBe(false); // no movement
  });

  test('non-sliding pieces are not modelled (always false)', () => {
    expect(td.canPieceMove('n', 2, 1)).toBe(false); // knight
    expect(td.canPieceMove('k', 1, 0)).toBe(false); // king
    expect(td.canPieceMove('p', 1, 0)).toBe(false); // pawn
    expect(td.canPieceMove('e', 1, 0)).toBe(false); // angel
  });
});

describe('countDefenders / countAttackers', () => {
  test('countDefenders counts allied pieces that can reach the square', () => {
    const board = emptyBoard();
    // defender knight at (4,2) can reach target (6,3)
    board[4][2] = piece('white', 'n');
    // a non-defender far away
    board[0][0] = piece('white', 'r');
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 2) return [{ r: 6, c: 3 }];
      return [];
    });
    expect(td.countDefenders(game, 6, 3, 'white')).toBe(1);
  });

  test('countDefenders ignores enemy-colored pieces', () => {
    const board = emptyBoard();
    board[4][2] = piece('black', 'n'); // enemy, should NOT count for white
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 2) return [{ r: 6, c: 3 }];
      return [];
    });
    expect(td.countDefenders(game, 6, 3, 'white')).toBe(0);
  });

  test('countAttackers counts enemy pieces that can reach the square', () => {
    const board = emptyBoard();
    board[4][2] = piece('black', 'n'); // attacker
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 2) return [{ r: 6, c: 3 }];
      return [];
    });
    expect(td.countAttackers(game, 6, 3, 'black')).toBe(1);
  });
});

describe('getThreatenedPieces', () => {
  test('reports enemy pieces on squares reachable by the piece at pos', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'r'); // attacker rook
    board[4][7] = piece('black', 'p'); // victim along the rank
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 4) return [{ r: 4, c: 7 }]; // rook reaches the pawn
      return [];
    });
    const threatened = td.getThreatenedPieces(game, analyzer, { r: 4, c: 4 }, 'white');
    expect(threatened.length).toBe(1);
    expect(threatened[0].pos).toEqual({ r: 4, c: 7 });
    expect(threatened[0].type).toBe('p');
  });

  test('ignores same-colored pieces on reachable squares', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'r');
    board[4][7] = piece('white', 'p'); // ally, not a threat
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 4) return [{ r: 4, c: 7 }];
      return [];
    });
    const threatened = td.getThreatenedPieces(game, analyzer, { r: 4, c: 4 }, 'white');
    expect(threatened.length).toBe(0);
  });

  test('returns empty when there is no piece at pos', () => {
    const board = emptyBoard();
    const game = gameStub(board, () => []);
    expect(td.getThreatenedPieces(game, analyzer, { r: 0, c: 0 }, 'white')).toEqual([]);
  });
});

describe('getDefendedPieces', () => {
  test('reports friendly pieces on squares reachable by the defender', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'r'); // defender rook
    board[4][7] = piece('white', 'p'); // defended ally
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 4) return [{ r: 4, c: 7 }];
      return [];
    });
    const defended = td.getDefendedPieces(game, analyzer, { r: 4, c: 4 }, 'white');
    expect(defended.length).toBe(1);
    expect(defended[0].pos).toEqual({ r: 4, c: 7 });
  });
});

describe('isTactical', () => {
  test('is true when the destination square is defended by the enemy (a real threat)', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'q'); // moving queen to (6,6)
    board[6][6] = piece('black', 'p'); // enemy-occupied destination
    const game = gameStub(board, (r, c, p) => {
      if (r === 4 && c === 4) return [{ r: 6, c: 6 }];
      if (r === 6 && c === 6 && p && p.color === 'black') return [{ r: 4, c: 4 }];
      return [];
    });
    expect(td.isTactical(game, { from: { r: 4, c: 4 }, to: { r: 6, c: 6 } })).toBe(true);
  });

  test('is false for a quiet move with no tactical tension', () => {
    const board = emptyBoard();
    board[4][4] = piece('white', 'n');
    const game = gameStub(board, (r, c) => {
      if (r === 4 && c === 4) return [{ r: 6, c: 5 }];
      return [];
    });
    expect(td.isTactical(game, { from: { r: 4, c: 4 }, to: { r: 6, c: 5 } })).toBe(false);
  });
});
