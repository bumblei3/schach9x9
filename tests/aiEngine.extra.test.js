import { PHASES, BOARD_SIZE } from '../js/gameEngine.js';
import * as AIEngine from '../js/aiEngine.js';

describe('AIEngine Extra Coverage', () => {
  test('getAllLegalMoves for special pieces (Knight jumps)', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    // Archbishop at center
    board[4][4] = { type: 'a', color: 'white' };
    // Place king so moves are legal
    board[8][0] = { type: 'k', color: 'white' };

    // Place some enemies and friends at knight jump distances
    board[2][3] = { type: 'p', color: 'black' }; // Enemy
    board[2][5] = { type: 'p', color: 'white' }; // Friend

    const moves = AIEngine.getAllLegalMoves(board, 'white');
    const toPositions = moves.map(m => `${m.to.r},${m.to.c}`);

    expect(toPositions).toContain('2,3'); // Knight jump capture
    expect(toPositions).not.toContain('2,5'); // Knight jump blocked by friend
    expect(toPositions).toContain('3,2'); // Empty square jump
  });

  test('pawn double jump (hasMoved: false)', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[6][0] = { type: 'p', color: 'white', hasMoved: false };
    board[8][4] = { type: 'k', color: 'white' };
    const moves = AIEngine.getAllLegalMoves(board, 'white');
    const toPositions = moves.map(m => `${m.to.r},${m.to.c}`);
    expect(toPositions).toContain('4,0'); // Double jump
  });

  test('Angel (E) moves (Queen + Knight)', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[4][4] = { type: 'e', color: 'white' };
    board[8][4] = { type: 'k', color: 'white' };
    const moves = AIEngine.getAllLegalMoves(board, 'white');
    const toPositions = moves.map(m => `${m.to.r},${m.to.c}`);
    // Diagonals (Bishop-like)
    expect(toPositions).toContain('0,0');
    // Orthogonals (Rook-like)
    expect(toPositions).toContain('4,0');
    // Knight jumps
    expect(toPositions).toContain('6,5');
  });

  test('evaluatePosition for various pieces', () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(null));
    board[4][4] = { type: 'q', color: 'white' };
    board[0][0] = { type: 'r', color: 'black' };
    const score = AIEngine.evaluatePosition(board, 'white');
    expect(score).toBeDefined();
  });
});
