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

    // Rook on open file should be worth more (excluding the material of the pawn in closed case)
    // scoreOpen (~500+25pst+20open) vs scoreClosed (~500+25pst + 100pawn)
    // Wait, scoreClosed has an extra pawn!
    // Let's add the same pawn to a DIFFERENT file in boardOpen.
    boardOpen[7][1] = { type: 'p', color: 'white' };

    const finalScoreOpen = evaluatePosition(boardOpen, 'white');
    const finalScoreClosed = evaluatePosition(boardClosed, 'white');

    expect(finalScoreOpen).toBeGreaterThan(finalScoreClosed);
  });

  test('Pawn Structure: Doubled and Isolated Pawns', () => {
    // Doubled Pawns
    const boardDoubled = createEmptyBoard();
    boardDoubled[7][4] = { type: 'p', color: 'white' };
    boardDoubled[6][4] = { type: 'p', color: 'white' }; // Doubled on file 4

    const boardNormal = createEmptyBoard();
    boardNormal[7][4] = { type: 'p', color: 'white' };
    boardNormal[7][5] = { type: 'p', color: 'white' }; // Not doubled

    const scoreDoubled = evaluatePosition(boardDoubled, 'white');
    const scoreNormal = evaluatePosition(boardNormal, 'white');
    expect(scoreDoubled).toBeLessThan(scoreNormal);

    // Isolated Pawns
    const boardIsolated = createEmptyBoard();
    boardIsolated[7][4] = { type: 'p', color: 'white' };
    // No pawns on file 3 or 5

    const boardSupported = createEmptyBoard();
    boardSupported[7][4] = { type: 'p', color: 'white' };
    boardSupported[7][3] = { type: 'p', color: 'white' };

    evaluatePosition(boardIsolated, 'white');
    evaluatePosition(boardSupported, 'white');
    // Note: supported has an extra pawn, so it's naturally higher.
    // Let's add the same pawn elsewhere in isolated case
    boardIsolated[7][0] = { type: 'p', color: 'white' };

    const finalScoreIsolated = evaluatePosition(boardIsolated, 'white');
    const finalScoreSupported = evaluatePosition(boardSupported, 'white');
    expect(finalScoreSupported).toBeGreaterThan(finalScoreIsolated);
  });

  test('King Safety: Open Files and Zone Attacks', () => {
    // Open file near king
    const boardSafe = createEmptyBoard();
    boardSafe[8][4] = { type: 'k', color: 'white' };
    boardSafe[7][4] = { type: 'p', color: 'white' }; // Shield
    // Add material to trigger midgame phase
    boardSafe[0][0] = { type: 'q', color: 'white' };
    boardSafe[0][8] = { type: 'q', color: 'black' };

    const boardExposed = createEmptyBoard();
    boardExposed[8][4] = { type: 'k', color: 'white' };
    // No pawn on file 4
    boardExposed[7][0] = { type: 'p', color: 'white' }; // Far away pawn
    boardExposed[0][0] = { type: 'q', color: 'white' };
    boardExposed[0][8] = { type: 'q', color: 'black' };

    const scoreSafe = evaluatePosition(boardSafe, 'white');
    const scoreExposed = evaluatePosition(boardExposed, 'white');
    expect(scoreSafe).toBeGreaterThan(scoreExposed + 10);

    // King Zone Attacks
    const boardAttacked = createEmptyBoard();
    boardAttacked[8][4] = { type: 'k', color: 'white' };
    boardAttacked[6][4] = { type: 'n', color: 'black' }; // Knight near king

    const boardCalm = createEmptyBoard();
    boardCalm[8][4] = { type: 'k', color: 'white' };
    boardCalm[0][0] = { type: 'n', color: 'black' }; // Knight far away

    const scoreAttacked = evaluatePosition(boardAttacked, 'white');
    const scoreCalm = evaluatePosition(boardCalm, 'white');
    expect(scoreAttacked).toBeLessThan(scoreCalm);
  });

  test('Pawn Structure: Backward Pawn Penalty', () => {
    // Normal pawn vs Backward pawn
    const boardNormal = createEmptyBoard();
    boardNormal[4][4] = { type: 'p', color: 'white' }; // Safe

    const boardBackward = createEmptyBoard();
    boardBackward[4][4] = { type: 'p', color: 'white' };

    // White moves UP (decreasing r). Stop square is 3,4.
    // Black moves DOWN (increasing r).
    // Enemy pawn at 2,5 attacks 3,4. (2 + 1 = 3, 5 - 1 = 4).
    boardBackward[2][5] = { type: 'p', color: 'black' };

    const scoreNormal = evaluatePosition(boardNormal, 'white');
    const scoreBackward = evaluatePosition(boardBackward, 'white');

    // Backward pawn should have lower score
    expect(scoreBackward).toBeLessThan(scoreNormal);
  });

  test('Pawn Structure: Phalanx Bonus', () => {
    // Connected pawns on same rank vs Isolated
    const boardPhalanx = createEmptyBoard();
    boardPhalanx[4][4] = { type: 'p', color: 'white' };
    boardPhalanx[4][5] = { type: 'p', color: 'white' };

    const boardIsolated = createEmptyBoard();
    boardIsolated[4][4] = { type: 'p', color: 'white' };
    boardIsolated[4][6] = { type: 'p', color: 'white' }; // Gap of 1

    const scorePhalanx = evaluatePosition(boardPhalanx, 'white');
    const scoreIso = evaluatePosition(boardIsolated, 'white');

    expect(scorePhalanx).toBeGreaterThan(scoreIso);
  });

  test('Advanced Pawn Logic: Supported and Blocked Passed Pawns', () => {
    // Supported Pawn
    const boardSupported = createEmptyBoard();
    boardSupported[7][4] = { type: 'p', color: 'white' };
    boardSupported[8][3] = { type: 'p', color: 'white' }; // Supports 7,4

    const boardUnsupported = createEmptyBoard();
    boardUnsupported[7][4] = { type: 'p', color: 'white' };
    boardUnsupported[8][0] = { type: 'p', color: 'white' }; // Far away

    const scoreSupported = evaluatePosition(boardSupported, 'white');
    const scoreUnsupported = evaluatePosition(boardUnsupported, 'white');
    // Supported pawn bonus should make it higher
    expect(scoreSupported).toBeGreaterThan(scoreUnsupported);

    // Blocked Passed Pawn
    const boardBlocked = createEmptyBoard();
    boardBlocked[4][4] = { type: 'p', color: 'white' };
    boardBlocked[3][4] = { type: 'n', color: 'black' }; // Blocked by knight

    const boardFree = createEmptyBoard();
    boardFree[4][4] = { type: 'p', color: 'white' };
    boardFree[0][0] = { type: 'n', color: 'black' }; // Far away

    const scoreBlocked = evaluatePosition(boardBlocked, 'white');
    const scoreFree = evaluatePosition(boardFree, 'white');
    expect(scoreFree).toBeGreaterThan(scoreBlocked);
  });

  test('Black Piece Heuristics', () => {
    // Black Bishop Pair
    const boardPair = createEmptyBoard();
    boardPair[0][2] = { type: 'b', color: 'black' };
    boardPair[0][5] = { type: 'b', color: 'black' };

    const boardSingle = createEmptyBoard();
    boardSingle[0][2] = { type: 'b', color: 'black' };
    boardSingle[0][5] = { type: 'n', color: 'black' };

    const scorePair = evaluatePosition(boardPair, 'black');
    const scoreSingle = evaluatePosition(boardSingle, 'black');
    expect(scorePair).toBeGreaterThan(scoreSingle + 10);
  });

  test('8x8 Mode Evaluation', () => {
    // 8x8 board
    const board8 = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));
    board8[7][4] = { type: 'k', color: 'white' };
    board8[0][4] = { type: 'k', color: 'black' };

    const score = evaluatePosition(board8, 'white');
    expect(typeof score).toBe('number');
  });
});
