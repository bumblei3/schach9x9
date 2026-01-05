import { getBestMoveDetailed } from '../../js/aiEngine.js';

describe('AI Elo Scaling & Noise', () => {
  let uiBoard;

  beforeEach(() => {
    uiBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  const setPiece = (r, c, type, color) => {
    uiBoard[r][c] = { type, color };
  };

  test('800 Elo should show evaluation noise', async () => {
    // Simple position
    setPiece(7, 4, 'p', 'white');
    setPiece(8, 4, 'k', 'white');
    setPiece(0, 4, 'k', 'black');

    const results = [];
    for (let i = 0; i < 5; i++) {
      // High Elo (no noise)
      const res = await getBestMoveDetailed(uiBoard, 'white', 1, 'hard', { elo: 2500 });
      results.push(res.score);
    }
    // High Elo should be deterministic
    const uniqueHigh = new Set(results);
    expect(uniqueHigh.size).toBe(1);

    const lowResults = [];
    for (let i = 0; i < 10; i++) {
      // Low Elo (800)
      const res = await getBestMoveDetailed(uiBoard, 'white', 1, 'hard', { elo: 800 });
      lowResults.push(res.score);
    }
    // Low Elo with 800 should have a noise range of ~200.
    // (2500 - 800) / 8 = 212.
    // It's highly likely to get some variation in 10 runs.
    const uniqueLow = new Set(lowResults);
    expect(uniqueLow.size).toBeGreaterThan(1);
  });

  test('800 Elo should occasionally blunder material', async () => {
    // White has a clear winning move (capture rook)
    setPiece(4, 4, 'rook', 'white');
    setPiece(4, 5, 'rook', 'black');
    setPiece(8, 0, 'king', 'white');
    setPiece(0, 0, 'king', 'black');

    let blundered = false;
    for (let i = 0; i < 20; i++) {
      const res = await getBestMoveDetailed(uiBoard, 'white', 2, 'hard', { elo: 800 });
      // Best move is (4,4) to (4,5)
      if (!res.move || res.move.from.r !== 4 || res.move.to.c !== 5) {
        blundered = true;
        break;
      }
    }
    // 800 Elo has 40% blunder chance at each search end.
    // In 20 runs, it's extremely likely to happen.
    expect(blundered).toBe(true);
  });
});
