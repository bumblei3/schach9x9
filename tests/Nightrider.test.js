import { RulesEngine } from '../js/RulesEngine.js';

describe('Nightrider (j)', () => {
  let mockGame;
  let rulesEngine;

  beforeEach(() => {
    mockGame = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      lastMove: null,
    };
    rulesEngine = new RulesEngine(mockGame);
  });

  test('should move in knight patterns multiple times in one direction', () => {
    // White Nightrider at [4,4]
    mockGame.board[4][4] = { type: 'j', color: 'white' };

    const moves = rulesEngine.getPseudoLegalMoves(4, 4, mockGame.board[4][4]);

    // Check one direction: [-2, -1]
    // 1st jump: [4-2, 4-1] = [2, 3]
    // 2nd jump: [2-2, 3-1] = [0, 2]
    expect(moves).toContainEqual({ r: 2, c: 3 });
    expect(moves).toContainEqual({ r: 0, c: 2 });

    // Check one direction: [1, 2]
    // 1st jump: [4+1, 4+2] = [5, 6]
    // 2nd jump: [5+1, 6+2] = [6, 8]
    expect(moves).toContainEqual({ r: 5, c: 6 });
    expect(moves).toContainEqual({ r: 6, c: 8 });
  });

  test('should be blocked by pieces', () => {
    mockGame.board[4][4] = { type: 'j', color: 'white' };
    // Block first jump
    mockGame.board[2][3] = { type: 'p', color: 'white' };

    const moves = rulesEngine.getPseudoLegalMoves(4, 4, mockGame.board[4][4]);

    expect(moves).not.toContainEqual({ r: 2, c: 3 });
    expect(moves).not.toContainEqual({ r: 0, c: 2 });
  });

  test('should capture enemy pieces and stop', () => {
    mockGame.board[4][4] = { type: 'j', color: 'white' };
    // Enemy at first jump
    mockGame.board[2][3] = { type: 'p', color: 'black' };

    const moves = rulesEngine.getPseudoLegalMoves(4, 4, mockGame.board[4][4]);

    expect(moves).toContainEqual({ r: 2, c: 3 });
    expect(moves).not.toContainEqual({ r: 0, c: 2 });
  });

  test('isSquareUnderAttack should detect sliding knight attacks', () => {
    mockGame.board[0][2] = { type: 'j', color: 'black' };

    // [0, 2] attacks [2, 3] and [4, 4]
    expect(rulesEngine.isSquareUnderAttack(2, 3, 'black')).toBe(true);
    expect(rulesEngine.isSquareUnderAttack(4, 4, 'black')).toBe(true);

    // Add blocker at [2, 3]
    mockGame.board[2][3] = { type: 'p', color: 'white' };
    expect(rulesEngine.isSquareUnderAttack(4, 4, 'black')).toBe(false);
  });

  test('should detect check from long distance', () => {
    mockGame.board[0][0] = { type: 'j', color: 'black' };
    mockGame.board[4][2] = { type: 'k', color: 'white' }; // 1st jump: [2, 1], 2nd jump: [4, 2]

    expect(rulesEngine.isSquareUnderAttack(4, 2, 'black')).toBe(true);
    expect(rulesEngine.isInCheck('white')).toBe(true);
  });

  test('should NOT move if pinned against the king', () => {
    // Black Nightrider at [0,0]
    mockGame.board[0][0] = { type: 'j', color: 'black' };
    // White King at [4,2]
    mockGame.board[4][2] = { type: 'k', color: 'white' };
    // White Bishop at [2,1] (pinned)
    mockGame.board[2][1] = { type: 'b', color: 'white' };

    const validMoves = rulesEngine.getValidMoves(2, 1, mockGame.board[2][1]);

    // Bishop usually has moves, but here it's pinned by the Nightrider
    expect(validMoves.length).toBe(0);
  });

  test('should only move along the pin line if pinned but can capture attacker', () => {
    // Similar setup but the pinned piece can capture the attacker
    mockGame.board[0][0] = { type: 'j', color: 'black' };
    mockGame.board[4][2] = { type: 'k', color: 'white' };

    // Nightrider (j) at [2,1] - it's pinning the king but also vulnerable
    mockGame.board[2][1] = { type: 'j', color: 'white' };

    const validMoves = rulesEngine.getValidMoves(2, 1, mockGame.board[2][1]);

    // It should be able to capture the attacker at [0,0]
    expect(validMoves).toContainEqual({ r: 0, c: 0 });
  });
});
