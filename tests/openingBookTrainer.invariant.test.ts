/**
 * Invariant tests for the UNTESTED core pipeline of
 * js/utils/OpeningBookTrainer.ts.
 *
 * The existing suites (openingBookTrainer.board / .int) only lock the DOM-free
 * pure helpers (createInitialBoard, boardToUi, applyMoveInt, isTerminalInt,
 * getBoardHashInt). The actual training pipeline — recordOpeningPosition,
 * recordGameResult (incl. swapColors flipping), recalcWeightsFromGameResults
 * (weight normalisation + sort), and finalizeBook (seenCount / move-count
 * filtering) — was at 0% coverage. These are the invariant-rich, highest-risk
 * methods, so this suite exercises them directly.
 *
 * Two strategies:
 *  A) White-box: call the private methods via `(trainer as any)` with crafted
 *     inputs and assert the invariants they must uphold.
 *  B) Black-box: mock the engine (aiEngine.getBestMoveDetailed) so runTraining
 *     runs a deterministic, fast self-play game and assert the produced
 *     BookData obeys the finalization + determinism invariants.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { OpeningBookTrainer, createInitialBoard } from '../js/utils/OpeningBookTrainer.js';
import type { Square } from '../js/gameEngine.js';

// --- Mock the engine so runTraining never hits the real search -------------
// getBestMoveDetailed is imported by OpeningBookTrainer from aiEngine.js.
// Returning a deterministic pawn push makes the whole pipeline reproducible
// and fast (no WASM / depth search).
vi.mock('../js/aiEngine.js', () => {
  const moveFor = (uiBoard: any, color: 'white' | 'black') => {
    const forward = color === 'white' ? -1 : 1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const p = uiBoard?.[r]?.[c];
        if (!p || p.type !== 'p' || p.color !== color) continue;
        const nr = r + forward;
        if (nr < 0 || nr > 8) continue;
        if (uiBoard[nr]?.[c] == null) {
          return {
            move: { from: { r, c }, to: { r: nr, c }, capture: false },
            score: 0,
            depth: 1,
            nodes: 1,
          };
        }
      }
    }
    return null; // no pawn can advance -> engine "gives up" this ply
  };
  return {
    getBestMoveDetailed: vi.fn((uiBoard: any, color: 'white' | 'black') =>
      Promise.resolve(moveFor(uiBoard, color))
    ),
  };
});

const sq = (r: number, c: number): Square => ({ r, c });

const TMP_BOOK = path.join(os.tmpdir(), 'schach9x9-trainer-invariant.json');

beforeEach(() => {
  if (fs.existsSync(TMP_BOOK)) fs.unlinkSync(TMP_BOOK);
});
afterEach(() => {
  if (fs.existsSync(TMP_BOOK)) fs.unlinkSync(TMP_BOOK);
});

// ===========================================================================
// A) White-box: private pipeline methods
// ===========================================================================

describe('OpeningBookTrainer.recordGameResult — result attribution + swapColors', () => {
  function trainer() {
    return new OpeningBookTrainer({ quiet: true, numGames: 0 });
  }
  function stateWithMove(move: { from: Square; to: Square }) {
    return {
      board: createInitialBoard(),
      moveHistory: [{ from: move.from, to: move.to, moveNumber: 1, color: 'white' as const }],
      moveNumber: 1,
      currentTurn: 'white' as const,
    };
  }

  test('a plain win increments whiteWins and totalGames', () => {
    const t = trainer() as any;
    expect(t.stats).toEqual({
      totalGames: 0,
      whiteWins: 0,
      blackWins: 0,
      draws: 0,
      totalPositions: 0,
      totalMovesTracked: 0,
    });
    t.recordGameResult(stateWithMove({ from: sq(7, 0), to: sq(6, 0) }), 'win', false);
    expect(t.stats.whiteWins).toBe(1);
    expect(t.stats.blackWins).toBe(0);
    expect(t.stats.draws).toBe(0);
    expect(t.stats.totalGames).toBe(1);
  });

  test('swapColors flips the winner: a win recorded with swapColors=true is a black win', () => {
    const t = trainer() as any;
    t.recordGameResult(stateWithMove({ from: sq(7, 0), to: sq(6, 0) }), 'win', true);
    expect(t.stats.whiteWins).toBe(0);
    expect(t.stats.blackWins).toBe(1);
    expect(t.stats.totalGames).toBe(1);
  });

  test('swapColors flips the loser too: a loss with swapColors=true is a white win', () => {
    const t = trainer() as any;
    t.recordGameResult(stateWithMove({ from: sq(7, 0), to: sq(6, 0) }), 'loss', true);
    expect(t.stats.whiteWins).toBe(1);
    expect(t.stats.blackWins).toBe(0);
  });

  test('a draw increments only draws, and the win/loss/draw split sums to totalGames', () => {
    const t = trainer() as any;
    t.recordGameResult(stateWithMove({ from: sq(7, 0), to: sq(6, 0) }), 'win', false);
    t.recordGameResult(stateWithMove({ from: sq(7, 1), to: sq(6, 1) }), 'win', true);
    t.recordGameResult(stateWithMove({ from: sq(7, 2), to: sq(6, 2) }), 'loss', false);
    t.recordGameResult(stateWithMove({ from: sq(7, 3), to: sq(6, 3) }), 'loss', true);
    t.recordGameResult(stateWithMove({ from: sq(7, 4), to: sq(6, 4) }), 'draw', false);
    const s = t.stats;
    expect(s.whiteWins).toBe(2);
    expect(s.blackWins).toBe(2);
    expect(s.draws).toBe(1);
    expect(s.whiteWins + s.blackWins + s.draws).toBe(s.totalGames);
  });

  test('recording a result also seeds the book with the game moves', () => {
    const t = trainer() as any;
    t.recordGameResult(stateWithMove({ from: sq(7, 0), to: sq(6, 0) }), 'win', false);
    expect(Object.keys(t.book.data.positions).length).toBeGreaterThan(0);
  });
});

describe('OpeningBookTrainer.recalcWeightsFromGameResults — normalisation invariant', () => {
  test('multi-move positions get weights normalised to ~100 and sorted descending', () => {
    const t = new OpeningBookTrainer({ quiet: true, numGames: 0 }) as any;
    t.book.data.positions = {
      posA: {
        moves: [
          { from: sq(0, 0), to: sq(1, 1), weight: 1, games: 1 },
          { from: sq(0, 0), to: sq(2, 2), weight: 2, games: 1 },
        ],
        seenCount: 2,
      },
      posB: {
        moves: [{ from: sq(0, 0), to: sq(1, 1), weight: 5, games: 1 }],
        seenCount: 1,
      },
    };
    t.recalcWeightsFromGameResults();

    const a = t.book.data.positions.posA.moves;
    const sum = a.reduce((s: number, m: any) => s + m.weight, 0);
    // [1,2] -> total 3 -> round(33.33)=33, round(66.67)=67 -> sums to 100
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
    // sorted descending by weight
    expect(a[0].weight).toBeGreaterThanOrEqual(a[1].weight);

    // single-move positions are untouched (normalisation only applies to >1 move)
    expect(t.book.data.positions.posB.moves[0].weight).toBe(5);
  });

  test('weights never go negative or undefined', () => {
    const t = new OpeningBookTrainer({ quiet: true, numGames: 0 }) as any;
    t.book.data.positions = {
      p: {
        moves: [
          { from: sq(0, 0), to: sq(1, 1), weight: 3, games: 1 },
          { from: sq(0, 0), to: sq(2, 2), weight: 7, games: 1 },
          { from: sq(0, 0), to: sq(3, 3), weight: 0, games: 1 },
        ],
        seenCount: 5,
      },
    };
    t.recalcWeightsFromGameResults();
    for (const m of t.book.data.positions.p.moves) {
      expect(typeof m.weight).toBe('number');
      expect(m.weight).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('OpeningBookTrainer.finalizeBook — filtering invariants', () => {
  function build(opts: { minPositionCount: number; maxMovesPerPosition: number }) {
    const t = new OpeningBookTrainer({ quiet: true, numGames: 0, ...opts }) as any;
    const mkMove = (r: number, c: number) => ({
      from: sq(0, 0),
      to: sq(r, c),
      weight: 1,
      games: 1,
    });
    t.book.data.positions = {
      keep: {
        moves: [mkMove(1, 1), mkMove(2, 2), mkMove(3, 3), mkMove(4, 4), mkMove(5, 5)],
        seenCount: 3,
      },
      dropLowSeen: { moves: [mkMove(1, 1)], seenCount: 1 },
      dropZeroMoves: { moves: [], seenCount: 2 },
    };
    return t;
  }

  test('drops positions below minPositionCount and empty positions', () => {
    const t = build({ minPositionCount: 2, maxMovesPerPosition: 5 });
    const book = t.finalizeBook();
    expect(Object.keys(book.positions)).toEqual(['keep']);
  });

  test('truncates each position to maxMovesPerPosition', () => {
    const t = build({ minPositionCount: 2, maxMovesPerPosition: 3 });
    const book = t.finalizeBook();
    expect(book.positions.keep.moves.length).toBe(3);
    expect(t.stats.totalPositions).toBe(1);
    expect(t.stats.totalMovesTracked).toBe(3);
  });

  test('metadata is stamped with version 3.0 and self-play type', () => {
    const t = build({ minPositionCount: 2, maxMovesPerPosition: 3 });
    const book = t.finalizeBook();
    expect(book.metadata?.version).toBe('3.0');
    expect(book.metadata?.type).toBe('self-play-engine');
    expect(book.metadata?.totalPositions).toBe(1);
  });
});

// ===========================================================================
// B) Black-box: deterministic end-to-end runTraining
// ===========================================================================

describe('OpeningBookTrainer.runTraining — end-to-end invariants', () => {
  const baseConfig = {
    quiet: true,
    numGames: 1,
    depth: 1,
    timePerMoveMs: 1,
    openingMovesTracked: 4,
    minPositionCount: 1,
    maxMovesPerPosition: 5,
    elo: 1,
    drawMoveLimit: 6,
    alternateColors: false,
    outputBookPath: TMP_BOOK,
  };

  test('produces a well-formed BookData and consistent stats', async () => {
    const t = new OpeningBookTrainer(baseConfig);
    const book = await t.runTraining();

    expect(book.metadata?.version).toBe('3.0');
    expect(book.metadata?.type).toBe('self-play-engine');

    // every kept position obeys maxMovesPerPosition and has >=1 move
    for (const [hash, pos] of Object.entries(book.positions)) {
      expect(pos.moves.length).toBeGreaterThan(0);
      expect(pos.moves.length).toBeLessThanOrEqual(baseConfig.maxMovesPerPosition);
      expect(pos.seenCount).toBeGreaterThanOrEqual(baseConfig.minPositionCount);
      // position hashes are non-empty strings
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    }

    // stats: one game played, result bucketed
    const st = (t as any).stats;
    expect(st.totalGames).toBe(1);
    expect(st.whiteWins + st.blackWins + st.draws).toBe(1);
  });

  test('alternateColors doubles the number of games played', async () => {
    const t = new OpeningBookTrainer({ ...baseConfig, alternateColors: true });
    await t.runTraining();
    // alternateColors => numGames * 2 training games
    expect((t as any).stats.totalGames).toBe(baseConfig.numGames * 2);
  });

  test('determinism: the opening book (positions) is identical across runs; only the volatile timestamp differs', async () => {
    const a = await new OpeningBookTrainer(baseConfig).runTraining();
    const b = await new OpeningBookTrainer(baseConfig).runTraining();
    // The actual book must be byte-for-byte reproducible from the same engine.
    expect(JSON.stringify(a.positions)).toBe(JSON.stringify(b.positions));
    // metadata is identical except for the runtime-generated timestamp.
    const stripTs = (m: any) => {
      const { generatedAt, ...rest } = m;
      return rest;
    };
    expect(JSON.stringify(stripTs(a.metadata))).toBe(JSON.stringify(stripTs(b.metadata)));
    // sanity: the timestamp is present and well-formed ISO
    expect((a.metadata as any)?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('written book file is valid JSON matching the returned BookData', async () => {
    const book = await new OpeningBookTrainer(baseConfig).runTraining();
    expect(fs.existsSync(TMP_BOOK)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(TMP_BOOK, 'utf8'));
    expect(JSON.stringify(onDisk.positions)).toBe(JSON.stringify(book.positions));
  });
});
