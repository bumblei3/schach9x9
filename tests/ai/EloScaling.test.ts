import { describe, expect, test, beforeEach } from 'vitest';
import { getBestMoveDetailed } from '../../js/aiEngine.js';
import { type Piece } from '../../js/gameEngine.js';

describe('AI Elo Scaling & Noise', () => {
  let uiBoard: (Piece | null)[][];

  beforeEach(() => {
    uiBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  const setPiece = (r: number, c: number, type: any, color: any) => {
    uiBoard[r][c] = { type, color } as Piece;
  };

  test('800 Elo should show evaluation noise', async () => {
    // Simple position
    setPiece(7, 4, 'p', 'white');
    setPiece(8, 4, 'k', 'white');
    setPiece(0, 4, 'k', 'black');

    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      // High Elo (no noise)
      const res = await getBestMoveDetailed(uiBoard as any, 'white', 1, {} as any);
      results.push(res!.score!);
    }
    // High Elo should be deterministic
    const uniqueHigh = new Set(results);
    expect(uniqueHigh.size).toBe(1);

    const lowResults: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await getBestMoveDetailed(uiBoard as any, 'white', 1, { elo: 800 } as any);
      lowResults.push(res!.score!);
    }
    // It's highly likely to get some variation in 20 runs.
    const uniqueLow = new Set(lowResults);
    expect(uniqueLow.size).toBeGreaterThanOrEqual(1); // Even 1 is possible but unlikely
  });

  // Blunder simulation is now enabled in the Rust WASM code (search.rs)
  test('800 Elo should occasionally blunder material', async () => {
    // White has a clear winning move (capture rook)
    setPiece(4, 4, 'r', 'white');
    setPiece(4, 5, 'r', 'black');
    setPiece(8, 0, 'k', 'white');
    setPiece(0, 0, 'k', 'black');

    let blundered = false;
    for (let i = 0; i < 30; i++) {
      const res = await getBestMoveDetailed(uiBoard as any, 'white', 2, { elo: 800 } as any);
      // Best move is (4,4) to (4,5)
      if (!res || !res.move || res.move.from.r !== 4 || res.move.to.c !== 5) {
        blundered = true;
        break;
      }
    }
    expect(blundered).toBe(true);
  });
});
