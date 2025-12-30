// Minimal mock for dependencies if needed
global.BOARD_SIZE = 9;

const { evaluatePosition } = await import('../js/aiEngine.js');

describe('AIEngine Deep Evaluation', () => {
  let board;

  beforeEach(() => {
    board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
  });

  function createPiece(type, color) {
    return { type, color, hasMoved: false };
  }

  test('Tapered Evaluation: material balance (Midgame vs Endgame)', () => {
    // Setup a 4v4 Pawn game (White vs Black)
    // Midgame: phaseValue will be high
    board[1][4] = createPiece('p', 'black');
    board[7][4] = createPiece('p', 'white');

    const scoreStart = evaluatePosition(board, 'white');

    // Add more material to shift towards midgame
    board[0][0] = createPiece('r', 'black');
    board[8][0] = createPiece('r', 'white');
    board[0][8] = createPiece('q', 'black');
    board[8][8] = createPiece('q', 'white');

    const scoreWithMaterial = evaluatePosition(board, 'white');

    // Both should be theoretically balanced (0), plus mobility/positional
    expect(Math.abs(scoreStart)).toBeLessThan(100);
    expect(Math.abs(scoreWithMaterial)).toBeLessThan(200);
  });

  test('King Safety: should penalize exposed king', () => {
    // King behind pawn wall
    board[8][4] = createPiece('k', 'white');
    board[7][3] = createPiece('p', 'white');
    board[7][4] = createPiece('p', 'white');
    board[7][5] = createPiece('p', 'white');

    const safeScore = evaluatePosition(board, 'white');

    // King exposed (pawns missing)
    board[7][3] = null;
    board[7][4] = null;
    board[7][5] = null;

    const exposedScore = evaluatePosition(board, 'white');

    expect(exposedScore).toBeLessThan(safeScore);
  });

  test('Endgame King positioning', () => {
    // Only kings left
    board[0][0] = createPiece('k', 'black');
    board[8][4] = createPiece('k', 'white');

    const centerScore = evaluatePosition(board, 'white');

    // Move white king to corner
    board[8][4] = null;
    board[8][8] = createPiece('k', 'white');
    const cornerScore = evaluatePosition(board, 'white');

    // In endgame, king should prefer center (or attacking black king)
    // Our PST_EG for King has higher values in center
    expect(centerScore).toBeGreaterThan(cornerScore);
  });

  test('Pawn Structure: should penalize isolated pawns', () => {
    // Connected pawns
    board[7][3] = createPiece('p', 'white');
    board[7][4] = createPiece('p', 'white');

    const connectedScore = evaluatePosition(board, 'white');

    // Isolated pawns
    board[7][4] = null;
    board[7][6] = createPiece('p', 'white');

    const isolatedScore = evaluatePosition(board, 'white');

    expect(isolatedScore).toBeLessThan(connectedScore);
  });

  test('Mobility bonus', () => {
    // Queen trapped
    board[8][4] = createPiece('q', 'white');
    board[7][3] = createPiece('p', 'white');
    board[7][4] = createPiece('p', 'white');
    board[7][5] = createPiece('p', 'white');
    board[8][3] = createPiece('p', 'white');
    board[8][5] = createPiece('p', 'white');

    const trappedScore = evaluatePosition(board, 'white');

    // Queen free (move pawns to the side)
    board[7][3] = null;
    board[7][0] = createPiece('p', 'white');
    board[7][4] = null;
    board[7][1] = createPiece('p', 'white');
    board[7][5] = null;
    board[7][2] = createPiece('p', 'white');

    const freeScore = evaluatePosition(board, 'white');

    // Queen now has more legal moves (mobility)
    expect(freeScore).toBeGreaterThan(trappedScore);
  });
});
