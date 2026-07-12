import { describe, test, expect, vi } from 'vitest';
import {
  canPieceMove,
  detectRemovingGuard,
  detectSkewers,
  detectBattery,
  detectPins,
  detectDiscoveredAttacks,
  countDefenders,
  countAttackers,
  detectTacticalPatterns,
} from '../../js/tutor/TacticsDetector.js';

const analyzer = { getPieceName: (t: string) => t };

function gameWith(board: any, extra: any = {}) {
  return {
    board,
    boardShape: null,
    getValidMoves: vi.fn().mockReturnValue([]),
    isInCheck: vi.fn().mockReturnValue(false),
    isSquareUnderAttack: vi.fn().mockReturnValue(false),
    ...extra,
  };
}

function emptyBoard() {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
}

describe('TacticsDetector.canPieceMove', () => {
  test('rook/chancellor move only orthogonally', () => {
    expect(canPieceMove('r', 0, 1)).toBe(true);
    expect(canPieceMove('r', 1, 1)).toBe(false);
    expect(canPieceMove('c', 0, 1)).toBe(true);
  });
  test('bishop/archbishop move only diagonally', () => {
    expect(canPieceMove('b', 1, 1)).toBe(true);
    expect(canPieceMove('b', 0, 1)).toBe(false);
    expect(canPieceMove('a', 1, 1)).toBe(true);
  });
  test('queen moves any direction', () => {
    expect(canPieceMove('q', 0, 1)).toBe(true);
    expect(canPieceMove('q', 1, 1)).toBe(true);
  });
  test('non-sliding pieces cannot move directionally', () => {
    expect(canPieceMove('n', 1, 2)).toBe(false);
    expect(canPieceMove('k', 1, 0)).toBe(false);
  });
});

describe('TacticsDetector.detectRemovingGuard (covers canPieceAttackSquare)', () => {
  test('returns [] when no opponent piece under attack', () => {
    const board = emptyBoard();
    board[0][0] = { type: 'p', color: 'black', hasMoved: false };
    const g = gameWith(board, { isSquareUnderAttack: vi.fn().mockReturnValue(false) });
    const res = detectRemovingGuard(g, analyzer, { r: 4, c: 4 }, { type: 'r', color: 'white' });
    expect(res).toEqual([]);
  });

  test('detects a removed guard when piece is now under attack and was defending the square', () => {
    const board = emptyBoard();
    // captured piece (defender, white) was at (4,4) — simulate capture already done:
    // white piece at (4,4) no longer there; a black attacker sits there now.
    board[4][4] = { type: 'r', color: 'black', hasMoved: false };
    // a white piece that was defended by the captured piece, now under attack
    board[4][6] = { type: 'q', color: 'white', hasMoved: false };
    const g = gameWith(board, {
      isSquareUnderAttack: vi.fn().mockReturnValue(true),
      // black rook at (4,4) attacks the white queen at (4,6) -> attackersNow = 1 > defendersNow = 0
      getValidMoves: vi.fn((r: number, c: number) => (r === 4 && c === 4 ? [{ r: 4, c: 6 }] : [])),
    });
    // capturedPiece (white rook) at (4,4) could attack (4,6): rook along rank -> true
    const res = detectRemovingGuard(g, analyzer, { r: 4, c: 4 }, { type: 'r', color: 'white' });
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0].undefendedPos).toEqual({ r: 4, c: 6 });
  });

  test('does not flag when capture did not remove a guard', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'black', hasMoved: false };
    board[4][6] = { type: 'q', color: 'white', hasMoved: false };
    const g = gameWith(board, {
      // square NOT under attack -> no guard removal
      isSquareUnderAttack: vi.fn().mockReturnValue(false),
    });
    const res = detectRemovingGuard(g, analyzer, { r: 4, c: 4 }, { type: 'r', color: 'white' });
    expect(res).toEqual([]);
  });
});

describe('TacticsDetector.detectSkewers', () => {
  test('returns [] for non-sliding piece', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    const g = gameWith(board);
    expect(detectSkewers(g, analyzer, { r: 4, c: 4 }, 'white')).toEqual([]);
  });

  test('detects skewer when valuable front piece > behind piece', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][6] = { type: 'q', color: 'black', hasMoved: false }; // front (valuable)
    board[4][8] = { type: 'p', color: 'black', hasMoved: false }; // behind (less)
    const g = gameWith(board, {
      getValidMoves: vi.fn((r: number, c: number) => (r === 4 && c === 4 ? [{ r: 4, c: 6 }] : [])),
    });
    const sk = detectSkewers(g, analyzer, { r: 4, c: 4 }, 'white');
    expect(sk.length).toBe(1);
    expect(sk[0].frontPos).toEqual({ r: 4, c: 6 });
    expect(sk[0].behindPos).toEqual({ r: 4, c: 8 });
  });

  test('does not skewer when behind piece is more valuable', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][6] = { type: 'p', color: 'black', hasMoved: false }; // front (less)
    board[4][8] = { type: 'q', color: 'black', hasMoved: false }; // behind (more)
    const g = gameWith(board, {
      getValidMoves: vi.fn((r: number, c: number) => (r === 4 && c === 4 ? [{ r: 4, c: 6 }] : [])),
    });
    expect(detectSkewers(g, analyzer, { r: 4, c: 4 }, 'white')).toEqual([]);
  });
});

describe('TacticsDetector.detectBattery', () => {
  test('returns [] for non-sliding piece', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    expect(detectBattery(gameWith(board), analyzer, { r: 4, c: 4 }, 'white')).toEqual([]);
  });

  test('detects aligned friendly rooks', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][7] = { type: 'r', color: 'white', hasMoved: false };
    const bat = detectBattery(gameWith(board), analyzer, { r: 4, c: 4 }, 'white');
    expect(bat.length).toBe(1);
    expect(bat[0].behindPos).toEqual({ r: 4, c: 7 });
  });

  test('does not detect enemy piece as battery', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][7] = { type: 'r', color: 'black', hasMoved: false };
    expect(detectBattery(gameWith(board), analyzer, { r: 4, c: 4 }, 'white')).toEqual([]);
  });
});

describe('TacticsDetector.detectPins', () => {
  test('returns [] for non-sliding piece', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'n', color: 'white', hasMoved: false };
    expect(detectPins(gameWith(board), analyzer, { r: 4, c: 4 }, 'white')).toEqual([]);
  });

  test('detects pin when king is behind opponent piece', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][6] = { type: 'n', color: 'black', hasMoved: false }; // pinned piece
    board[4][8] = { type: 'k', color: 'black', hasMoved: false }; // king behind
    const g = gameWith(board, {
      getValidMoves: vi.fn((r: number, c: number) => (r === 4 && c === 4 ? [{ r: 4, c: 6 }] : [])),
    });
    const pins = detectPins(g, analyzer, { r: 4, c: 4 }, 'white');
    expect(pins.length).toBe(1);
    expect(pins[0].pinnedPos).toEqual({ r: 4, c: 6 });
    expect(pins[0].behindPos).toEqual({ r: 4, c: 8 });
  });
});

describe('TacticsDetector.detectDiscoveredAttacks', () => {
  test('detects discovered attack when moving piece revealed a slider line', () => {
    const board = emptyBoard();
    // Our rook at (0,0) looks along rank 0 toward (0,2)
    board[0][0] = { type: 'r', color: 'white', hasMoved: false };
    board[0][1] = { type: 'b', color: 'white', hasMoved: false }; // the moving piece (blocks)
    board[0][2] = { type: 'q', color: 'black', hasMoved: false }; // target behind blocker
    const g = gameWith(board);
    const da = detectDiscoveredAttacks(g, analyzer, { r: 0, c: 1 }, { r: 0, c: 0 }, 'white');
    expect(da.length).toBe(1);
    expect(da[0].targetPos).toEqual({ r: 0, c: 2 });
  });

  test('returns [] when no discovered attack', () => {
    const board = emptyBoard();
    board[0][0] = { type: 'r', color: 'white', hasMoved: false };
    board[2][2] = { type: 'q', color: 'black', hasMoved: false };
    // enemy not on the rook's line through `from` -> no discovered attack
    const g = gameWith(board);
    expect(detectDiscoveredAttacks(g, analyzer, { r: 0, c: 1 }, { r: 0, c: 0 }, 'white')).toEqual(
      []
    );
  });
});

describe('TacticsDetector.countDefenders / countAttackers', () => {
  test('countDefenders counts friendly pieces that can reach the square', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false }; // defender
    board[2][4] = { type: 'r', color: 'white', hasMoved: false }; // another defender (same file)
    board[4][6] = { type: 'r', color: 'black', hasMoved: false }; // not a defender
    const g = gameWith(board, {
      getValidMoves: vi.fn((r: number, c: number) =>
        (r === 4 && c === 4) || (r === 2 && c === 4) ? [{ r: 4, c: 4 }] : []
      ),
    });
    expect(countDefenders(g, 4, 4, 'white')).toBe(2);
  });

  test('countAttackers counts enemy pieces that can reach the square', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'black', hasMoved: false }; // attacker
    board[2][4] = { type: 'r', color: 'black', hasMoved: false };
    board[4][6] = { type: 'r', color: 'white', hasMoved: false }; // not attacker
    const g = gameWith(board, {
      getValidMoves: vi.fn((r: number, c: number) =>
        (r === 4 && c === 4) || (r === 2 && c === 4) ? [{ r: 4, c: 4 }] : []
      ),
    });
    expect(countAttackers(g, 4, 4, 'black')).toBe(2);
  });
});

describe('TacticsDetector.detectTacticalPatterns guards', () => {
  test('returns [] for null/incomplete move', () => {
    const g = gameWith(emptyBoard());
    expect(detectTacticalPatterns(g, analyzer, null as any)).toEqual([]);
    expect(detectTacticalPatterns(g, analyzer, { from: { r: 0, c: 0 } } as any)).toEqual([]);
  });

  test('returns [] when there is no piece at from', () => {
    const g = gameWith(emptyBoard());
    expect(
      detectTacticalPatterns(g, analyzer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } })
    ).toEqual([]);
  });

  test('capture pattern is produced for a capturing move', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][6] = { type: 'p', color: 'black', hasMoved: false };
    const patterns = detectTacticalPatterns(gameWith(board), analyzer, {
      from: { r: 4, c: 4 },
      to: { r: 4, c: 6 },
    });
    expect(patterns.some((p: any) => p.type === 'capture')).toBe(true);
  });

  test('check pattern with no king found yields empty targets', () => {
    const board = emptyBoard();
    board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    board[4][6] = { type: 'k', color: 'black', hasMoved: false };
    const g = gameWith(board, { isInCheck: vi.fn().mockReturnValue(true) });
    board[4][6] = null; // remove king so the scan finds none
    const patterns = detectTacticalPatterns(g, analyzer, {
      from: { r: 4, c: 4 },
      to: { r: 4, c: 6 },
    });
    const check = patterns.find((p: any) => p.type === 'check');
    expect(check).toBeTruthy();
    expect(check!.targets).toEqual([]);
  });
});
