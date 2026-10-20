/**
 * The pre-move warning used to add the *full* material value of every piece
 * `detectThreatsAfterMove` reported. A defended pawn "under attack" therefore
 * counted as 100 cp lost, and ordinary developing moves tripped the mentor
 * threshold (STANDARD = 200 cp) — the player got "⚠️ Warnung: Grober Fehler?"
 * on the first move of the game.
 *
 * The penalty is now a static exchange evaluation: only what the opponent
 * actually wins by capturing counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as MoveAnalyzer from '../../js/tutor/MoveAnalyzer.js';
import * as aiEngine from '../../js/aiEngine.js';
import { PHASES } from '../../js/gameEngine.js';

vi.mock('../../js/tutor/TacticsDetector.js', () => ({
  detectThreatsAfterMove: vi.fn().mockReturnValue([]),
  isTactical: vi.fn().mockReturnValue(false),
  detectTacticalPatterns: vi.fn().mockReturnValue([]),
  detectFairyPatterns: vi.fn().mockReturnValue([]),
}));

vi.mock('../../js/aiEngine.js', () => ({
  evaluatePosition: vi.fn(),
  getAllThreats: vi.fn().mockReturnValue([]),
  getTopMoves: vi.fn().mockResolvedValue([]),
  see: vi.fn().mockReturnValue(0),
  convertBoardToInt: vi.fn().mockReturnValue(new Int8Array(81)),
  COLOR_WHITE: 16,
  COLOR_BLACK: 32,
}));

const BOARD = 9;
const OUR_PAWN = { r: 4, c: 4 };
const THEIR_ROOK = { r: 2, c: 4 };

/** A threat entry as `aiEngine.getAllThreats` would report it. */
function threatOnOurPiece(attacker: { r: number; c: number }, target: { r: number; c: number }) {
  return {
    targetSquare: target.r * BOARD + target.c,
    attackerSquare: attacker.r * BOARD + attacker.c,
    attackerType: 4,
    attackerColor: 32,
    targetType: 1,
    targetColor: 16,
    isDirect: true,
  };
}

describe('pre-move warning penalty (static exchange evaluation)', () => {
  let game: any;

  beforeEach(() => {
    game = {
      kiMentorEnabled: true,
      phase: PHASES.PLAY,
      board: Array(BOARD)
        .fill(null)
        .map(() => Array(BOARD).fill(null)),
      mentorLevel: 'STANDARD', // threshold 200 cp
      stats: { accuracies: [] },
      moveController: { undoMove: vi.fn() },
      turn: 'white',
    };
    // Moving our own pawn, attacked by an enemy rook.
    game.board[7][4] = { type: 'p', color: 'white' };
    game.board[OUR_PAWN.r][OUR_PAWN.c] = { type: 'p', color: 'white' };
    game.board[THEIR_ROOK.r][THEIR_ROOK.c] = { type: 'r', color: 'black' };

    vi.mocked(aiEngine.getAllThreats).mockReturnValue([
      threatOnOurPiece(THEIR_ROOK, OUR_PAWN),
    ] as never);
    vi.mocked(aiEngine.evaluatePosition).mockReset();
    vi.mocked(aiEngine.evaluatePosition).mockResolvedValue(0);
    vi.mocked(aiEngine.see).mockReset();
  });

  const move = { from: { r: 7, c: 4 }, to: { r: 6, c: 4 } };

  it('does not warn when attacked pieces are defended (the old sum-of-values rule did)', async () => {
    // Three defended pawns "under attack": the previous heuristic added
    // 3 x 100 cp and crossed the 200 cp threshold, SEE adds nothing.
    game.board[4][2] = { type: 'p', color: 'white' };
    game.board[4][6] = { type: 'p', color: 'white' };
    game.board[2][2] = { type: 'r', color: 'black' };
    game.board[2][6] = { type: 'r', color: 'black' };
    vi.mocked(aiEngine.getAllThreats).mockReturnValue([
      threatOnOurPiece(THEIR_ROOK, OUR_PAWN),
      threatOnOurPiece({ r: 2, c: 2 }, { r: 4, c: 2 }),
      threatOnOurPiece({ r: 2, c: 6 }, { r: 4, c: 6 }),
    ] as never);
    vi.mocked(aiEngine.see).mockReturnValue(0);

    const result = await MoveAnalyzer.analyzePlayerMovePreExecution(game, move);

    expect(result).toBeNull();
  });

  it('does not warn when the exchange only wins a minor amount below the threshold', async () => {
    vi.mocked(aiEngine.see).mockReturnValue(100); // e.g. a pawn, threshold is 200

    const result = await MoveAnalyzer.analyzePlayerMovePreExecution(game, move);

    expect(result).toBeNull();
  });

  it('does warn when the opponent really wins a piece', async () => {
    vi.mocked(aiEngine.see).mockReturnValue(320); // a hanging knight

    const result = await MoveAnalyzer.analyzePlayerMovePreExecution(game, move);

    expect(result).not.toBeNull();
  });

  it('ignores threats against the opponent’s own pieces', async () => {
    game.board[OUR_PAWN.r][OUR_PAWN.c] = { type: 'n', color: 'black' };
    vi.mocked(aiEngine.see).mockReturnValue(500);

    const result = await MoveAnalyzer.analyzePlayerMovePreExecution(game, move);

    expect(result).toBeNull();
  });

  it('ignores a capture on the king (the king is never won)', async () => {
    game.board[OUR_PAWN.r][OUR_PAWN.c] = { type: 'k', color: 'white' };
    vi.mocked(aiEngine.see).mockReturnValue(900);

    const result = await MoveAnalyzer.analyzePlayerMovePreExecution(game, move);

    expect(result).toBeNull();
  });
});
