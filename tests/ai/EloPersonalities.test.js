import { getBestMoveDetailed } from '../../js/aiEngine.js';

describe('AI Elo Personalities', () => {
  let uiBoard;

  beforeEach(() => {
    uiBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  const setPiece = (r, c, type, color) => {
    uiBoard[r][c] = { type, color };
  };

  test('AGGRESSIVE personality should reward forward pieces more', async () => {
    // Pawn close to enemy king
    setPiece(1, 4, 'p', 'white');
    setPiece(0, 4, 'k', 'black'); // Enemy king
    setPiece(8, 4, 'k', 'white');

    // Run at depth 1 to get static-like evaluation guidance
    const normalRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'NORMAL' });
    const aggressiveRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'AGGRESSIVE' });

    // AGGRESSIVE score should be higher (attack weight)
    expect(aggressiveRes.score).toBeGreaterThan(normalRes.score);
  });

  test('SOLID personality should reward pawn structure more', async () => {
    // Linked pawns
    setPiece(6, 4, 'p', 'white');
    setPiece(7, 3, 'p', 'white');
    setPiece(8, 4, 'k', 'white');
    setPiece(0, 4, 'k', 'black');

    const normalRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'NORMAL' });
    const solidRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'SOLID' });

    expect(solidRes.score).toBeGreaterThan(normalRes.score);
  });

  test('SOLID personality should penalize exposed kings more', async () => {
    // White king with no pawn shelter
    setPiece(8, 4, 'k', 'white');
    // Black king WITH pawn shelter
    setPiece(0, 4, 'k', 'black');
    setPiece(1, 4, 'p', 'black');

    const normalRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'NORMAL' });
    const solidRes = await getBestMoveDetailed(uiBoard, 'white', 1, 'expert', { personality: 'SOLID' });

    // Solid cares more about safety, so it rates its own safety (exposed) worse?
    // Wait, evaluation is relative.
    // White is exposed.
    // Normal score: -ShelterPenalty.
    // Solid score: -ShelterPenalty * 1.4.
    // So Solid Score should be LOWER (more negative).
    expect(solidRes.score).toBeLessThan(normalRes.score);
  });
});
