// Helper to create empty board
function createEmptyBoard() {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
}

const { evaluatePosition } = await import('../../js/ai/Evaluation.js');

describe('AI Evaluation Logic', () => {
  test('Material: Knight > Pawn', () => {
    const board = createEmptyBoard();
    // White Knight at 0,0 (Corner to minimize PST)
    board[0][0] = { type: 'n', color: 'white' };

    // Black Pawn at 1,8 (Start rank)
    board[1][8] = { type: 'p', color: 'black' };

    const score = evaluatePosition(board, 'white');

    // Knight (320) > Pawn (100)
    expect(score).toBeGreaterThan(0);
  });

  test('PST: Knight in Center > Knight in Corner', () => {
    // Compare two boards
    const boardCenter = createEmptyBoard();
    boardCenter[4][4] = { type: 'n', color: 'white' };

    const boardCorner = createEmptyBoard();
    boardCorner[0][0] = { type: 'n', color: 'white' };

    const scoreCenter = evaluatePosition(boardCenter, 'white');
    const scoreCorner = evaluatePosition(boardCorner, 'white');

    expect(scoreCenter).toBeGreaterThan(scoreCorner);
  });

  test('Symmetry: White Score == -Black Score', () => {
    const board = createEmptyBoard();
    board[4][4] = { type: 'n', color: 'white' };
    board[3][3] = { type: 'p', color: 'black' };

    const scoreWhite = evaluatePosition(board, 'white');
    const scoreBlack = evaluatePosition(board, 'black');

    expect(scoreWhite).toBe(-scoreBlack);
  });

  test('Pawn Structure: Passed Pawn Bonus', () => {
    // White Passed Pawn vs White Blocked Pawn

    // Case A: Passed Pawn at 4,4 (Rank 4). No black pawns ahead.
    const boardPassed = createEmptyBoard();
    boardPassed[4][4] = { type: 'p', color: 'white' };
    // Add minimal kings to avoid Safety noise?
    // Logic doesn't mandate kings.

    // Case B: Blocked Pawn at 4,4. Black Pawn at 3,4.
    const boardBlocked = createEmptyBoard();
    boardBlocked[4][4] = { type: 'p', color: 'white' };
    boardBlocked[3][4] = { type: 'p', color: 'black' };

    const scorePassed = evaluatePosition(boardPassed, 'white');
    const scoreBlocked = evaluatePosition(boardBlocked, 'white');

    // Passed pawn should be worth more
    expect(scorePassed).toBeGreaterThan(scoreBlocked);
  });

  test('King Safety: Pawn Shield', () => {
    // King alone vs King with Shield
    const boardAlone = createEmptyBoard();
    boardAlone[8][4] = { type: 'k', color: 'white' }; // Base rank

    const boardShield = createEmptyBoard();
    boardShield[8][4] = { type: 'k', color: 'white' };
    boardShield[7][3] = { type: 'p', color: 'white' };
    boardShield[7][4] = { type: 'p', color: 'white' };
    boardShield[7][5] = { type: 'p', color: 'white' };

    const scoreAlone = evaluatePosition(boardAlone, 'white');
    const scoreShield = evaluatePosition(boardShield, 'white');

    expect(scoreShield).toBeGreaterThan(scoreAlone);
  });
});
