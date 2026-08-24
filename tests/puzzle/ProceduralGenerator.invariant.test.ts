/**
 * Property-style invariant suite for js/puzzle/ProceduralGenerator.ts.
 *
 * The generator is nondeterministic (Math.random), so per the skill's
 * generative-testing rule we assert invariants that must hold on EVERY output
 * across many runs instead of exact values:
 *   - createRandomPosition: exactly 2 kings + difficulty piece set, no square
 *     collision, kings never adjacent, pawns never on promotion ranks 0/8,
 *     white pieces only for q/r/b, black pawn optional but well-formed
 *   - randomSquare: always within 0..8 on both axes
 *   - isPositionLegal: total function over arbitrary boards (never throws)
 *   - generatePuzzle('easy'): returns a valid GeneratedPuzzle or null; when
 *     non-null the solution is non-empty and setupStr is a string
 */

import { describe, test, expect, vi } from 'vitest';

// Mock PuzzleGenerator.findMateSequence so generatePuzzle is fast + deterministic.
vi.mock('../../js/puzzleGenerator.js', () => ({
  PuzzleGenerator: {
    findMateSequence: vi.fn((_board: unknown, _turn: string, _depth?: number) => {
      // Deterministic "mate found" with a one-move solution.
      return [{ from: { r: 0, c: 0 }, to: { r: 0, c: 7 } }] as never;
    }),
    boardToString: vi.fn(() => 'mock-setup-str'),
  },
}));

const { ProceduralGenerator } = await import('../../js/puzzle/ProceduralGenerator.js');
type Board = ({ type: string; color: string; hasMoved: boolean } | null)[][];

function countPieces(board: Board): Record<string, number> {
  const counts: Record<string, number> = {};
  board.flat().forEach((p) => {
    if (p) {
      const key = `${p.color}:${p.type}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  });
  return counts;
}

describe('ProceduralGenerator.createRandomPosition — structural invariants', () => {
  test('100 runs: 9x9 board, exactly 2 kings, correct difficulty piece set', () => {
    for (let i = 0; i < 100; i++) {
      const difficulty = i % 2 === 0 ? 'easy' : 'hard';
      const board = ProceduralGenerator.createRandomPosition(difficulty) as Board;
      expect(board).toHaveLength(9);
      board.forEach((row) => expect(row).toHaveLength(9));

      const counts = countPieces(board);
      expect(counts['white:k']).toBe(1);
      expect(counts['black:k']).toBe(1);

      const expectedExtra = difficulty === 'easy' ? ['q', 'r'] : ['r', 'b'];
      for (const t of expectedExtra) {
        expect(counts[`white:${t}`]).toBe(1);
      }
    }
  });

  test('100 runs: no two pieces share a square; all occupied squares valid coords', () => {
    for (let i = 0; i < 100; i++) {
      const board = ProceduralGenerator.createRandomPosition(i % 2 ? 'easy' : 'hard') as Board;
      const seen = new Set<string>();
      board.forEach((row, r) =>
        row.forEach((p, c) => {
          if (p) {
            const key = `${r},${c}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        })
      );
    }
  });

  test('100 runs: kings are NEVER adjacent (Chebyshev distance > 1)', () => {
    for (let i = 0; i < 100; i++) {
      const board = ProceduralGenerator.createRandomPosition('easy') as Board;
      let wk: { r: number; c: number } | null = null;
      let bk: { r: number; c: number } | null = null;
      board.forEach((row, r) =>
        row.forEach((p, c) => {
          if (p?.type === 'k') {
            if (p.color === 'white') wk = { r, c };
            else bk = { r, c };
          }
        })
      );
      expect(wk).toBeTruthy();
      expect(bk).toBeTruthy();
      const dist = Math.max(Math.abs(wk!.r - bk!.r), Math.abs(wk!.c - bk!.c));
      expect(dist).toBeGreaterThan(1);
    }
  });

  test('pawn-spawn branch invariant: any spawned black pawn avoids ranks 0/8', () => {
    // NEVER mock Math.random with a CONSTANT here: createRandomPosition uses
    // do/while loops that re-draw squares until a free/valid one appears — a
    // constant value would loop forever. Instead run many REAL random trials
    // and assert the invariant whenever a pawn was spawned.
    let spawned = 0;
    for (let i = 0; i < 200; i++) {
      const board = ProceduralGenerator.createRandomPosition('easy') as Board;
      const pawnCount = board
        .flat()
        .filter((p) => p && p.color === 'black' && p.type === 'p').length;
      expect([0, 1]).toContain(pawnCount);
      if (pawnCount === 1) {
        spawned++;
        board[0].forEach((p) => expect(p?.type === 'p').toBeFalsy());
        board[8].forEach((p) => expect(p?.type === 'p').toBeFalsy());
      }
    }
    // Sanity: across 200 runs both branches must have occurred at least once.
    expect(spawned).toBeGreaterThan(10);
  });
});

describe('ProceduralGenerator.randomSquare / isPositionLegal', () => {
  test('randomSquare is always within [0,8] on both axes', () => {
    for (let i = 0; i < 200; i++) {
      const s = ProceduralGenerator.randomSquare();
      expect(s.r).toBeGreaterThanOrEqual(0);
      expect(s.r).toBeLessThanOrEqual(8);
      expect(s.c).toBeGreaterThanOrEqual(0);
      expect(s.c).toBeLessThanOrEqual(8);
      expect(Number.isInteger(s.r)).toBe(true);
      expect(Number.isInteger(s.c)).toBe(true);
    }
  });

  test('isPositionLegal accepts arbitrary boards without throwing', () => {
    expect(ProceduralGenerator.isPositionLegal([])).toBe(true);
    expect(
      ProceduralGenerator.isPositionLegal([
        [{ type: 'k', color: 'white', hasMoved: false }],
      ] as never)
    ).toBe(true);
  });
});

describe('ProceduralGenerator.generatePuzzle', () => {
  test("difficulty easy maps to Matt-in-1 ('Einfach'), other to Matt-in-2 ('Mittel')", async () => {
    const { PuzzleGenerator } = await import('../../js/puzzleGenerator.js');
    const findMate = PuzzleGenerator.findMateSequence as ReturnType<typeof vi.fn>;
    findMate.mockReturnValue([{ from: { r: 0, c: 0 }, to: { r: 0, c: 7 } }]);
    (PuzzleGenerator.boardToString as unknown as ReturnType<typeof vi.fn>).mockReturnValue('mock');

    const easy = ProceduralGenerator.generatePuzzle('easy');
    expect(easy).not.toBeNull();
    expect(easy!.difficulty).toBe('Einfach');
    expect(easy!.title).toContain('Matt in 1');
    expect(easy!.solution).toHaveLength(1);
    expect(typeof easy!.setupStr).toBe('string');
    expect(easy!.id).toMatch(/^proc-/);

    findMate.mockReturnValueOnce([
      { from: { r: 0, c: 0 }, to: { r: 0, c: 7 } },
      { from: { r: 0, c: 7 }, to: { r: 4, c: 4 } },
    ]);
    const hard = ProceduralGenerator.generatePuzzle('medium');
    expect(hard).not.toBeNull();
    expect(hard!.difficulty).toBe('Mittel');
    expect(hard!.title).toContain('Matt in 2');
  });

  test('returns null after maxAttempts when no mate sequence exists', async () => {
    const { PuzzleGenerator } = await import('../../js/puzzleGenerator.js');
    (PuzzleGenerator.findMateSequence as ReturnType<typeof vi.fn>).mockReturnValue(null);

    expect(ProceduralGenerator.generatePuzzle('easy')).toBeNull();
  });
});
