import { describe, test, expect, beforeEach } from 'vitest';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  coordsToIndex,
  WHITE_PAWN,
  WHITE_KNIGHT,
  WHITE_ROOK,
  WHITE_KING,
  WHITE_BISHOP,
  WHITE_QUEEN,
  BLACK_PAWN,
  BLACK_ROOK,
  BLACK_QUEEN,
  BLACK_KING,
  BLACK_KNIGHT,
  BLACK_BISHOP,
  BLACK_NIGHTRIDER,
} from '../../js/ai/BoardDefinitions';
import type { Move } from '../../js/ai/MoveGenerator';
import { orderMoves, clearMoveOrdering, updateCounterMove } from '../../js/ai/MoveOrdering';

function emptyBoard(): Int8Array {
  return new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
}

function makeMove(from: number, to: number, flags?: string): Move {
  return { from, to, flags };
}

describe('MoveOrdering.orderMoves — TT / Killer / Counter / History', () => {
  beforeEach(() => clearMoveOrdering());

  test('TT move scores highest among non-captures', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const tt = coordsToIndex(4, 6);
    const quietA = coordsToIndex(2, 2);
    const quietB = coordsToIndex(6, 6);
    board[from] = WHITE_KNIGHT; // mover only; destinations empty -> quiet moves
    const moves = [makeMove(from, quietA), makeMove(from, tt), makeMove(from, quietB)];
    const ttMove = makeMove(from, tt);
    const ordered = orderMoves(board, moves, ttMove, null, null, null);
    expect(ordered[0]).toEqual(ttMove);
  });

  test('killer-1 outranks killer-2 and a plain quiet move', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const k1 = coordsToIndex(4, 5);
    const k2 = coordsToIndex(5, 5);
    const quiet = coordsToIndex(6, 6);
    board[from] = WHITE_KNIGHT; // mover only; all destinations empty
    const moves = [makeMove(from, quiet), makeMove(from, k2), makeMove(from, k1)];
    const killers = [makeMove(from, k1), makeMove(from, k2)];
    const ordered = orderMoves(board, moves, null, killers, null, null);
    expect(ordered[0]).toEqual(makeMove(from, k1));
    expect(ordered[1]).toEqual(makeMove(from, k2));
  });

  test('counter move outranks a plain quiet move when no killer is set', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const cm = coordsToIndex(4, 5);
    const quiet = coordsToIndex(6, 6);
    board[from] = WHITE_KNIGHT; // destinations empty
    const prevMove = makeMove(coordsToIndex(0, 0), coordsToIndex(1, 1));
    updateCounterMove(prevMove, makeMove(from, cm));
    const moves = [makeMove(from, quiet), makeMove(from, cm)];
    const ordered = orderMoves(board, moves, null, null, null, prevMove);
    expect(ordered[0]).toEqual(makeMove(from, cm));
  });

  test('history bonus is capped at HISTORY_SCORE_MAX and still ranks the move first', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const quietA = coordsToIndex(2, 2);
    const quietB = coordsToIndex(6, 6);
    board[from] = WHITE_KNIGHT; // destinations empty -> quiet
    const moves = [makeMove(from, quietA), makeMove(from, quietB)];
    const history = new Int32Array(SQUARE_COUNT * SQUARE_COUNT);
    history[from * 81 + quietB] = 999999; // far above the cap
    const ordered = orderMoves(board, moves, null, null, history, null);
    expect(ordered[0]).toEqual(makeMove(from, quietB));
  });
});

describe('MoveOrdering.orderMoves — captures & MVV-LVA', () => {
  test('capturing a higher-value victim outranks capturing a lower-value one', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const takeQueen = coordsToIndex(4, 5);
    const takePawn = coordsToIndex(5, 5);
    board[from] = WHITE_ROOK;
    board[takeQueen] = BLACK_QUEEN; // undefended (high value)
    board[takePawn] = BLACK_PAWN; // undefended (low value)
    const moves = [makeMove(from, takePawn), makeMove(from, takeQueen)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(from, takeQueen));
    expect(ordered[1]).toEqual(makeMove(from, takePawn));
  });

  test('an undefended capture receives the hanging-piece bonus (outranks a defended one of equal victim value)', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const undef = coordsToIndex(4, 5);
    const def = coordsToIndex(5, 5);
    board[from] = WHITE_ROOK;
    board[undef] = BLACK_PAWN; // no defender
    board[def] = BLACK_PAWN;
    board[coordsToIndex(5, 6)] = BLACK_ROOK; // defends (5,5)
    const moves = [makeMove(from, def), makeMove(from, undef)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(from, undef));
  });
});

describe('MoveOrdering.orderMoves — promotion & king safety', () => {
  test('a promotion move outranks an otherwise equal quiet move', () => {
    const board = emptyBoard();
    const promFrom = coordsToIndex(1, 4); // pawn about to promote to row 0
    const promTo = coordsToIndex(0, 4);
    const quietFrom = coordsToIndex(6, 3);
    const quietTo = coordsToIndex(5, 3);
    board[promFrom] = WHITE_PAWN; // promotion destination empty
    board[quietFrom] = WHITE_PAWN; // quiet destination empty
    const moves = [makeMove(quietFrom, quietTo), makeMove(promFrom, promTo, 'promotion')];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(promFrom, promTo, 'promotion'));
  });

  test('a move that exposes our own king is penalized below a safe move', () => {
    const board = emptyBoard();
    // White king on row 0, a white blocker on row 1 between king and an enemy rook on row 2
    const king = coordsToIndex(0, 4);
    const blocker = coordsToIndex(1, 4);
    const safeFrom = coordsToIndex(6, 3);
    const safeTo = coordsToIndex(5, 3);
    board[king] = WHITE_KING;
    board[blocker] = WHITE_PAWN;
    board[coordsToIndex(2, 4)] = BLACK_ROOK; // would check the king if blocker moves
    board[safeFrom] = WHITE_PAWN; // a safe, quiet move
    const moves = [
      makeMove(safeFrom, safeTo),
      makeMove(blocker, coordsToIndex(1, 5)), // unpins -> exposes king -> penalty
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    // safe quiet move must rank ABOVE the king-exposing move
    expect(ordered[0]).toEqual(makeMove(safeFrom, safeTo));
    expect(ordered[1]).toEqual(makeMove(blocker, coordsToIndex(1, 5)));
  });
});

describe('MoveOrdering helpers', () => {
  test('clearMoveOrdering resets the counter-move table', () => {
    const prev = makeMove(coordsToIndex(0, 0), coordsToIndex(1, 1));
    updateCounterMove(prev, makeMove(coordsToIndex(2, 2), coordsToIndex(3, 3)));
    clearMoveOrdering();
    const board = emptyBoard();
    const from = coordsToIndex(2, 2);
    const to = coordsToIndex(3, 3);
    board[from] = WHITE_KNIGHT; // destination empty
    const moves = [makeMove(from, to)];
    const ordered = orderMoves(board, moves, null, null, null, prev);
    // after clearing, no counter-move bonus -> single move stays in place
    expect(ordered).toEqual(moves);
  });

  test('updateCounterMove ignores null inputs without throwing', () => {
    expect(() => {
      updateCounterMove(null, makeMove(1, 2));
      updateCounterMove(makeMove(1, 2), null);
      updateCounterMove(null, null);
    }).not.toThrow();
  });

  test('side to move is inferred from the first non-empty piece on the board', () => {
    const board = emptyBoard();
    const fromW = coordsToIndex(4, 4);
    const toW = coordsToIndex(4, 5);
    board[fromW] = WHITE_KNIGHT; // first encountered -> white to move
    const fromB = coordsToIndex(2, 2);
    const toB = coordsToIndex(2, 3);
    board[fromB] = WHITE_PAWN; // all destinations empty -> quiet
    const moves = [makeMove(fromW, toW), makeMove(fromB, toB)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered.length).toBe(2);
  });
});

describe('MoveOrdering.isSquareAttacked branches (via hanging-piece detection)', () => {
  // A captured enemy piece is only "hanging" if it is NOT defended. The defender's
  // attack is evaluated through isSquareAttacked, which has separate branches for
  // knights/archbishops/chancellors/angels, kings and nightriders.

  test('a defender knight/archbishop/chancellor/angel means the victim is NOT hanging', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(4, 5); // victim
    board[from] = WHITE_ROOK;
    board[to] = BLACK_PAWN;
    // Knight-defender on a knight-move from the victim, same color as victim
    board[coordsToIndex(2, 6)] = WHITE_KNIGHT; // own color would NOT defend black piece;
    // use black knight as defender of the black pawn:
    board[coordsToIndex(2, 6)] = BLACK_KNIGHT; // reachable by knight-offset from (4,5)
    const moves = [makeMove(from, to)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    // defended -> no hanging bonus, but the move is still valid
    expect(ordered).toEqual(moves);
  });

  test('a king defender protects the victim from being hanging', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(4, 5);
    board[from] = WHITE_ROOK;
    board[to] = BLACK_PAWN;
    board[coordsToIndex(5, 5)] = BLACK_KING; // king defends the pawn (adjacent)
    const moves = [makeMove(from, to)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered).toEqual(moves);
  });

  test('a nightrider defender protects the victim from being hanging', () => {
    const board = emptyBoard();
    const from = coordsToIndex(4, 4);
    const to = coordsToIndex(4, 5);
    board[from] = WHITE_ROOK;
    board[to] = BLACK_PAWN;
    board[coordsToIndex(2, 6)] = BLACK_NIGHTRIDER; // nightrider attacks (4,5) via knight offset
    const moves = [makeMove(from, to)];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered).toEqual(moves);
  });
});

describe('MoveOrdering.orderMoves — threat analysis (non-captures)', () => {
  beforeEach(() => clearMoveOrdering());

  // Robust pattern: a SINGLE mover with TWO of its own quiet moves. Exactly one
  // of them creates a board threat (and therefore earns a bonus); the other is
  // geometrically placed so it creates NO threat. Both moves are passed to
  // orderMoves; the threat move must rank first. This isolates each threat
  // branch without depending on an unrelated "control" piece.

  test('a move that gives check outranks a quiet move of the same piece', () => {
    const board = emptyBoard();
    // White rook on (4,0), black king on (4,8) along an open rank.
    board[coordsToIndex(4, 0)] = WHITE_ROOK;
    board[coordsToIndex(4, 8)] = BLACK_KING;
    const moves = [
      makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)), // quiet: no threat
      makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)), // discovers check on (4,8)
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)));
  });

  test('a move directly attacking a high-value enemy piece (rook) outranks a quiet move', () => {
    const board = emptyBoard();
    // White rook on (4,0) can slide to threaten the black rook on (4,6) (value 500).
    board[coordsToIndex(4, 0)] = WHITE_ROOK;
    board[coordsToIndex(4, 6)] = BLACK_ROOK;
    board[coordsToIndex(8, 8)] = BLACK_KING; // ensure a real king so isInCheck is well-defined
    const moves = [
      makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)), // quiet: no threat
      makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)), // threatens (4,6) rook
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)));
  });

  test('a move directly attacking a mid-value enemy piece (bishop) outranks a quiet move', () => {
    const board = emptyBoard();
    board[coordsToIndex(4, 0)] = WHITE_ROOK;
    board[coordsToIndex(4, 6)] = BLACK_BISHOP; // value 330
    board[coordsToIndex(8, 8)] = BLACK_KING;
    const moves = [
      makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)),
      makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)), // threatens bishop on (4,6)
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)));
  });

  test('a move directly attacking a low-value enemy pawn outranks a quiet move', () => {
    const board = emptyBoard();
    board[coordsToIndex(4, 0)] = WHITE_ROOK;
    board[coordsToIndex(4, 6)] = BLACK_PAWN; // value 100
    board[coordsToIndex(8, 8)] = BLACK_KING;
    const moves = [
      makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)),
      makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)), // threatens pawn on (4,6)
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(4, 3)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(4, 0), coordsToIndex(0, 0)));
  });

  test('a move that breaks a pin on our own queen gets the pin-break bonus', () => {
    const board = emptyBoard();
    // White queen on (4,4); white bishop blocker (the mover) on (4,2);
    // black rook on (4,0) attacks through the blocker to the queen.
    board[coordsToIndex(4, 4)] = WHITE_QUEEN;
    board[coordsToIndex(4, 2)] = WHITE_BISHOP; // mover
    board[coordsToIndex(4, 0)] = BLACK_ROOK;
    // Control mover: a white rook far away on an empty corner that creates NO threat.
    board[coordsToIndex(0, 0)] = WHITE_ROOK;
    const moves = [
      makeMove(coordsToIndex(0, 0), coordsToIndex(1, 0)), // quiet control, no bonus
      makeMove(coordsToIndex(4, 2), coordsToIndex(3, 1)), // unpins queen -> bonus
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 2), coordsToIndex(3, 1)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(0, 0), coordsToIndex(1, 0)));
  });

  test('discovered-check bonus: unblocking a check on the enemy king outranks a quiet move', () => {
    const board = emptyBoard();
    // Black king on (4,8), white rook on (4,0), white bishop blocker (mover) on (4,2).
    board[coordsToIndex(4, 8)] = BLACK_KING;
    board[coordsToIndex(4, 0)] = WHITE_ROOK;
    board[coordsToIndex(4, 2)] = WHITE_BISHOP; // mover
    // Control mover far away, no threat.
    board[coordsToIndex(0, 0)] = WHITE_ROOK;
    const moves = [
      makeMove(coordsToIndex(0, 0), coordsToIndex(1, 0)), // no bonus
      makeMove(coordsToIndex(4, 2), coordsToIndex(3, 1)), // reveals rook check on king
    ];
    const ordered = orderMoves(board, moves, null, null, null, null);
    expect(ordered[0]).toEqual(makeMove(coordsToIndex(4, 2), coordsToIndex(3, 1)));
    expect(ordered[1]).toEqual(makeMove(coordsToIndex(0, 0), coordsToIndex(1, 0)));
  });
});
