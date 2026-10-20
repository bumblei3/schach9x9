/**
 * Regression: `detectThreatsAfterMove` reported every threat at the square the
 * analysed move started from and counted defenders of *that* square instead of
 * the threatened piece's own square.
 *
 * Two visible consequences in the tutor dialog:
 *  - the reported position pointed at the wrong piece;
 *  - defenders of the moved-from square were used for every other piece, so a
 *    defended piece was announced as "hanging" (and an undefended one could be
 *    missed whenever the from-square happened to be defended).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as TacticsDetector from '../../js/tutor/TacticsDetector.js';
import * as aiEngine from '../../js/aiEngine.js';

// BOARD_SIZE / getCurrentBoardSize live in config.ts and are re-exported by the
// AI board helpers — the factory must provide them or square maths yields NaN.
vi.mock('../../js/config.js', () => ({
  isBlockedCell: vi.fn(),
  getCurrentBoardShape: vi.fn(() => 'standard'),
  BOARD_SIZE: 9,
  getCurrentBoardSize: () => 9,
}));

const BOARD = 9;

const MOVER = { type: 'r', color: 'white', hasMoved: true };
const THREATENED_PAWN = { type: 'p', color: 'white', hasMoved: false };

/** UI-board stub for the detector; defenders are real pieces on the board. */
function makeGame(getValidMoves: (r: number, c: number, piece: unknown) => unknown[]) {
  return {
    board: Array(BOARD)
      .fill(null)
      .map(() => Array(BOARD).fill(null)),
    getValidMoves: vi.fn(getValidMoves),
    isSquareUnderAttack: vi.fn(),
    isInCheck: vi.fn(),
    boardShape: 'standard',
  };
}

const analyzer = {
  getPieceName: (t: string) => ({ p: 'Bauer', n: 'Springer', r: 'Turm' })[t] || t,
};

const MOVE = { from: { r: 4, c: 4 }, to: { r: 4, c: 6 } };
const THREATENED_SQUARE = 2 * BOARD + 3; // 21 -> (2,3)

describe('detectThreatsAfterMove — square attribution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('reports the threatened piece square, not the square the move came from', () => {
    const game = makeGame(() => []);
    game.board[4][4] = MOVER;
    game.board[2][3] = THREATENED_PAWN;

    vi.spyOn(aiEngine, 'getAllThreats').mockReturnValue([
      { isDirect: true, targetSquare: THREATENED_SQUARE, type: 'p' },
    ] as never);

    const threats = TacticsDetector.detectThreatsAfterMove(game as never, analyzer, MOVE);

    expect(threats).toHaveLength(1);
    expect(threats[0].pos).toEqual({ r: 2, c: 3 });
  });

  test('does not report a piece as hanging when it is defended on its own square', () => {
    // A white rook on the same rank genuinely covers the pawn's square.
    const game = makeGame(() => []);
    game.board[4][4] = MOVER;
    game.board[2][0] = { type: 'r', color: 'white', hasMoved: false };
    game.board[2][3] = THREATENED_PAWN;

    vi.spyOn(aiEngine, 'getAllThreats').mockReturnValue([
      { isDirect: true, targetSquare: THREATENED_SQUARE, type: 'p' },
    ] as never);

    const threats = TacticsDetector.detectThreatsAfterMove(game as never, analyzer, MOVE);

    expect(threats).toEqual([]);
  });
});
