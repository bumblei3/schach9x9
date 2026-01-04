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

  test('Bishop Pair Bonus', () => {
    const boardPair = createEmptyBoard();
    boardPair[8][2] = { type: 'b', color: 'white' };
    boardPair[8][5] = { type: 'b', color: 'white' };

    const boardSingle = createEmptyBoard();
    boardSingle[8][2] = { type: 'b', color: 'white' };
    boardSingle[8][5] = { type: 'n', color: 'white' }; // Swap one bishop for knight

    const scorePair = evaluatePosition(boardPair, 'white');
    const scoreSingle = evaluatePosition(boardSingle, 'white');

    // Material difference is small (330 vs 320), but pair bonus (25) should make it clear
    expect(scorePair).toBeGreaterThan(scoreSingle + 10);
  });

  test('Rook on Open File', () => {
    const boardOpen = createEmptyBoard();
    boardOpen[8][0] = { type: 'r', color: 'white' };
    // File 0 is open (no pawns)

    const boardClosed = createEmptyBoard();
    boardClosed[8][0] = { type: 'r', color: 'white' };
    boardClosed[7][0] = { type: 'p', color: 'white' }; // Blocked by own pawn

    evaluatePosition(boardOpen, 'white');
    evaluatePosition(boardClosed, 'white');

    // Rook on open file should be worth more (excluding the material of the pawn in closed case)
    // scoreOpen (~500+25pst+20open) vs scoreClosed (~500+25pst + 100pawn)
    // Wait, scoreClosed has an extra pawn! 
    // Let's add the same pawn to a DIFFERENT file in boardOpen.
    boardOpen[7][1] = { type: 'p', color: 'white' };

    const finalScoreOpen = evaluatePosition(boardOpen, 'white');
    const finalScoreClosed = evaluatePosition(boardClosed, 'white');

    expect(finalScoreOpen).toBeGreaterThan(finalScoreClosed);
  });
});
