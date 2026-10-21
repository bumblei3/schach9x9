/**
 * Akt IV chapters are short forced mates, not pawn-wall templates.
 * Each authored line is the mate `findMateSequence` returns, and the
 * fairy-pattern coach names the motif on that move.
 */
import { describe, expect, test } from 'vitest';
import { CAMPAIGN_LEVELS } from '../../js/campaign/campaignData.js';
import { BoardFactory } from '../../js/campaign/BoardFactory.js';
import { PuzzleGenerator } from '../../js/puzzleGenerator.js';
import * as AI from '../../js/aiEngine.js';
import { RulesEngine } from '../../js/RulesEngine.js';
import { detectFairyPatterns, type Analyzer } from '../../js/tutor/TacticsDetector.js';
import type { Board, Piece } from '../../js/types/core.js';

const AKT4 = [
  'archbishop_fork',
  'chancellor_xray_2',
  'angel_battery',
  'nightrider_fork',
  'archbishop_chancellor_duo',
  'angel_endgame',
  'fairy_sacrifice',
] as const;

const MOTIF: Record<string, string> = {
  archbishop_fork: 'archbishop_fork',
  chancellor_xray_2: 'chancellor_skewer',
  angel_battery: 'angel_battery',
  nightrider_fork: 'nightrider_fork',
  angel_endgame: 'angel_fork',
};

const analyzer: Analyzer = { getPieceName: (t: string) => t };

function level(id: string) {
  const found = CAMPAIGN_LEVELS.find(l => l.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

function load(id: string): Board {
  return BoardFactory.fromFEN(level(id).fen!) as Board;
}

function patterns(board: Board, from: { r: number; c: number }, to: { r: number; c: number }) {
  const copy = board.map(row => row.map(cell => (cell ? { ...cell } : null))) as Board;
  const rules = new RulesEngine({ board: copy } as never);
  const game = {
    board: copy,
    boardShape: 'full',
    getValidMoves: (r: number, c: number, piece: Piece) => rules.getValidMoves(r, c, piece),
    isInCheck: () => false,
    isSquareUnderAttack: () => false,
  };
  return detectFairyPatterns(game as never, analyzer, { from, to }).map(p => p.type);
}

function sameMove(
  a: { from: { r: number; c: number }; to: { r: number; c: number } },
  b: { from: { r: number; c: number }; to: { r: number; c: number } }
) {
  return a.from.r === b.from.r && a.from.c === b.from.c && a.to.r === b.to.r && a.to.c === b.to.c;
}

describe('Akt IV positions', () => {
  test('Akt IV FENs are unique against the whole campaign, and chapter 26 is gone', () => {
    const akt4Fens = AKT4.map(id => level(id).fen);
    expect(new Set(akt4Fens).size).toBe(akt4Fens.length);
    for (const id of AKT4) {
      const fen = level(id).fen;
      const owners = CAMPAIGN_LEVELS.filter(l => l.fen === fen).map(l => l.id);
      expect(owners, id).toEqual([id]);
    }
    expect(CAMPAIGN_LEVELS.some(l => l.id === 'fairy_master_2')).toBe(false);
  });

  test('chapter 18 unlocks the archbishop fork', () => {
    expect(level('fairy_master').unlocks).toContain('archbishop_fork');
  });

  test('a quiet king move on chapter 19 is not mate', () => {
    const board = load('archbishop_fork');
    const legal = AI.getAllLegalMoves(board, 'white');
    const mating = legal.filter(m => {
      const piece = board[m.from.r][m.from.c];
      const captured = board[m.to.r][m.to.c];
      board[m.to.r][m.to.c] = piece;
      board[m.from.r][m.from.c] = null;
      const mate = AI.getAllLegalMoves(board, 'black').length === 0 && AI.isInCheck(board, 'black');
      board[m.from.r][m.from.c] = piece;
      board[m.to.r][m.to.c] = captured;
      return mate;
    });
    expect(mating.length).toBeGreaterThan(0);
    expect(mating.length).toBeLessThan(legal.length);
  });

  test.each(AKT4)('%s is a forced mate and the authored line is the one the search returns', id => {
    const chapter = level(id);
    expect(chapter.winCondition.drawCountsAsWin).toBe(false);
    expect(chapter.solution?.length).toBeGreaterThan(0);
    expect(chapter.solution!.length).toBeLessThanOrEqual(4);
    const board = load(id);
    expect(AI.isInCheck(board, 'white')).toBe(false);
    expect(AI.isInCheck(board, 'black')).toBe(false);
    const depth = chapter.solution!.length;
    const seq = PuzzleGenerator.findMateSequence(board, 'white', depth);
    expect(seq, id).not.toBeNull();
    expect(seq!.length).toBe(chapter.solution!.length);
    chapter.solution!.forEach((move, i) => {
      expect(sameMove(seq![i], move), `${id} ply ${i}`).toBe(true);
    });
    const motif = MOTIF[id];
    if (motif) {
      expect(patterns(board, chapter.solution![0].from, chapter.solution![0].to)).toContain(motif);
    }
  });

  test('chapter 23 is not mate without the chancellor', () => {
    const board = load('archbishop_chancellor_duo');
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (piece?.type === 'c' && piece.color === 'white') board[r][c] = null;
      }
    }
    expect(AI.isInCheck(board, 'black')).toBe(false);
    expect(PuzzleGenerator.findMateSequence(board, 'white', 1)).toBeNull();
  });
});
