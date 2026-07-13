/**
 * Focused tests for OpeningBookTrainer.loadExistingBook — the only untested
 * I/O path in js/utils/OpeningBookTrainer.ts.
 *
 * The other existing suites cover the pure pipeline (recordGameResult,
 * recalcWeightsFromGameResults, finalizeBook, runTraining, parseCliArgs,
 * printStats). But loadExistingBook — which reads an existing book from disk
 * via fs.readFileSync + book.load and seeds the stats position count — was at
 * 0% coverage. A regression there silently drops an input book during
 * incremental training. These tests lock its invariants.
 *
 * The runTraining-based test mocks the engine (aiEngine.getBestMoveDetailed)
 * with a deterministic pawn push, exactly like openingBookTrainer.invariant.
 * test.ts, so it is fast and fully reproducible — no real search, no timeout
 * risk under full-suite load.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { OpeningBookTrainer } from '../js/utils/OpeningBookTrainer.js';

// --- Mock the engine so runTraining never hits the real search -------------
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
          return { move: { from: { r, c }, to: { r: nr, c }, capture: false }, score: 0, depth: 1, nodes: 1 };
        }
      }
    }
    return null;
  };
  return {
    getBestMoveDetailed: vi.fn((uiBoard: any, color: 'white' | 'black') =>
      Promise.resolve(moveFor(uiBoard, color))
    ),
  };
});

const TMP_INPUT = path.join(os.tmpdir(), 'schach9x9-trainer-load-input.json');
const TMP_OUTPUT = path.join(os.tmpdir(), 'schach9x9-trainer-load-output.json');

// book.load parses this shape (see BookData in OpeningBookTrainer.ts).
function writeBook(positions: number) {
  const pos: Record<string, unknown> = {};
  for (let i = 0; i < positions; i++) {
    pos[`pos${i}`] = {
      moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 1, games: 1 }],
      seenCount: 2,
    };
  }
  fs.writeFileSync(
    TMP_INPUT,
    JSON.stringify({
      positions: pos,
      metadata: {
        version: '3.0',
        type: 'self-play-engine',
        totalPositions: positions,
        totalMoves: positions,
      },
    })
  );
}

beforeEach(() => {
  for (const f of [TMP_INPUT, TMP_OUTPUT]) if (fs.existsSync(f)) fs.unlinkSync(f);
});
afterEach(() => {
  for (const f of [TMP_INPUT, TMP_OUTPUT]) if (fs.existsSync(f)) fs.unlinkSync(f);
});

describe('OpeningBookTrainer.loadExistingBook', () => {
  test('loads an existing book and seeds totalPositions + internal book data', async () => {
    writeBook(7);

    const trainer = new OpeningBookTrainer({
      quiet: true,
      numGames: 0,
      inputBookPath: TMP_INPUT,
      outputBookPath: TMP_OUTPUT,
    }) as any;

    await trainer.loadExistingBook();

    // stats.totalPositions is taken from the on-disk book.
    expect(trainer.stats.totalPositions).toBe(7);
    // The internal book now holds the loaded positions.
    expect(Object.keys(trainer.book.data.positions).length).toBe(7);
  });

  test('is a no-op (no throw, no seeds) when inputBookPath is unset', async () => {
    const trainer = new OpeningBookTrainer({ quiet: true, numGames: 0 }) as any;
    await expect(trainer.loadExistingBook()).resolves.toBeUndefined();
    expect(trainer.stats.totalPositions).toBe(0);
    expect(Object.keys(trainer.book.data.positions).length).toBe(0);
  });

  test('is a no-op (no throw) when the input file does not exist', async () => {
    const trainer = new OpeningBookTrainer({
      quiet: true,
      numGames: 0,
      inputBookPath: path.join(os.tmpdir(), 'schach9x9-does-not-exist.json'),
      outputBookPath: TMP_OUTPUT,
    }) as any;
    await expect(trainer.loadExistingBook()).resolves.toBeUndefined();
    expect(trainer.stats.totalPositions).toBe(0);
  });

  test('runTraining preserves loaded positions (incremental training)', async () => {
    // Seed an input book with 3 positions, then run a tiny training that
    // would otherwise produce its own. The loaded book must survive into the
    // finalised output (merged, not overwritten). Engine is mocked above so
    // this is deterministic and fast.
    writeBook(3);

    const book = await new OpeningBookTrainer({
      quiet: true,
      numGames: 1,
      depth: 1,
      timePerMoveMs: 1,
      openingMovesTracked: 2,
      minPositionCount: 1,
      maxMovesPerPosition: 5,
      elo: 1,
      drawMoveLimit: 4,
      alternateColors: false,
      inputBookPath: TMP_INPUT,
      outputBookPath: TMP_OUTPUT,
    }).runTraining();

    // At minimum the 3 loaded positions must be present in the output.
    expect(Object.keys(book.positions).length).toBeGreaterThanOrEqual(3);
  });
});
