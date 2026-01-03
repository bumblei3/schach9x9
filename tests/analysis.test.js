import { jest } from '@jest/globals';
import { AnalysisManager } from '../js/AnalysisManager.js';

describe('AnalysisManager', () => {
  let mockGame;
  let analysisManager;

  beforeEach(() => {
    mockGame = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      turn: 'white',
      arrowRenderer: {
        highlightMoves: jest.fn(),
        clearArrows: jest.fn(),
      },
      getValidMoves: jest.fn(() => []),
      getAllLegalMoves: jest.fn(() => []),
      tutorController: {
        getPieceName: jest.fn(type => type),
      },
      bestMoves: [],
    };
    analysisManager = new AnalysisManager(mockGame);
  });

  test('should toggle states correctly', () => {
    expect(analysisManager.showThreats).toBe(false);
    analysisManager.toggleThreats();
    expect(analysisManager.showThreats).toBe(true);

    expect(analysisManager.showOpportunities).toBe(false);
    analysisManager.toggleOpportunities();
    expect(analysisManager.showOpportunities).toBe(true);

    expect(analysisManager.showBestMove).toBe(false);
    analysisManager.toggleBestMove();
    expect(analysisManager.showBestMove).toBe(true);
  });

  test('should generate threat arrows correctly', () => {
    // Put a white queen and a black rook attacking it
    mockGame.board[4][4] = { type: 'q', color: 'white' };
    mockGame.board[0][4] = { type: 'r', color: 'black' };
    mockGame.turn = 'white';

    // Mock black rook moves: it can go to (4,4) to capture the queen
    mockGame.getValidMoves.mockImplementation((r, c, piece) => {
      if (r === 0 && c === 4 && piece.type === 'r') {
        return [{ r: 4, c: 4 }];
      }
      return [];
    });

    analysisManager.showThreats = true;
    const arrows = analysisManager.getThreatArrows();

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toMatchObject({
      fromR: 0,
      fromC: 4,
      toR: 4,
      toC: 4,
      colorKey: 'red',
    });
  });

  test('should generate best move arrow correctly', () => {
    const mockMove = {
      move: { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } },
    };
    mockGame.bestMoves = [mockMove];

    analysisManager.showBestMove = true;
    const arrows = analysisManager.getBestMoveArrows();

    expect(arrows.length).toBe(1);
    expect(arrows[0]).toMatchObject({
      fromR: 7,
      fromC: 4,
      toR: 5,
      toC: 4,
      colorKey: 'green',
    });
  });

  test('should only show serious threats', () => {
    // White knight defended by pawn
    mockGame.board[7][7] = { type: 'n', color: 'white' };
    mockGame.board[8][7] = { type: 'p', color: 'white' };
    // Black rook attacking knight
    mockGame.board[0][7] = { type: 'r', color: 'black' };

    mockGame.getValidMoves.mockImplementation((r, c, piece) => {
      if (r === 0 && c === 7 && piece.type === 'r') return [{ r: 7, c: 7 }];
      if (r === 8 && c === 7 && piece.type === 'p') return [{ r: 7, c: 7 }];
      return [];
    });

    analysisManager.showThreats = true;
    let arrows = analysisManager.getThreatArrows();

    // Since it's defended and it's a rook (5) vs knight (3), it might NOT be serious
    // depending on the logic. In our refined logic: defenders > 0 AND opponentValue (5) >= myValue (3) -> NOT serious.
    expect(arrows.length).toBe(0);

    // Now move the pawn away (undefended)
    mockGame.board[8][7] = null;
    arrows = analysisManager.getThreatArrows();
    expect(arrows.length).toBe(1);
  });
  test('should generate opportunity arrows for high severity patterns (fork)', () => {
    // Setup a fork: White knight at (7,6) moves to (5,5) to attack Black King at (3,4) and Black Queen at (4,7)
    mockGame.board[7][6] = { type: 'n', color: 'white' };
    mockGame.board[3][4] = { type: 'k', color: 'black' };
    mockGame.board[4][7] = { type: 'q', color: 'black' };
    mockGame.turn = 'white';

    mockGame.getValidMoves.mockImplementation((r, c, piece) => {
      if (r === 5 && c === 5 && piece.type === 'n') {
        return [
          { r: 3, c: 4 },
          { r: 4, c: 7 },
        ];
      }
      return [];
    });

    mockGame.getAllLegalMoves.mockReturnValue([
      { from: { r: 7, c: 6 }, to: { r: 5, c: 5 } }, // Move that creates the fork
    ]);

    // Mock isInCheck for the fork detection
    mockGame.isInCheck = jest.fn(color => color === 'black');

    analysisManager.showOpportunities = true;
    const arrows = analysisManager.getOpportunityArrows();

    // Note: Opportunities are found by checking legal moves.
    // If the move leads to a position with high severity patterns, it should be an arrow.
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toMatchObject({
      fromR: 7,
      fromC: 6, // from mockMove
      toR: 5,
      toC: 5,
      colorKey: 'orange',
    });
  });

  test('should generate opportunity arrows for high severity patterns (pin)', () => {
    // Setup a pin: White Rook moves from (0,0) to (0,4) to pin Black Knight at (4,4) against Black King at (8,4)
    mockGame.board[0][0] = { type: 'r', color: 'white' };
    mockGame.board[4][4] = { type: 'n', color: 'black' };
    mockGame.board[8][4] = { type: 'k', color: 'black' };
    mockGame.turn = 'white';

    mockGame.getValidMoves.mockImplementation((r, c, piece) => {
      // White rook at (0,4) attacks along the 4th column
      if (r === 0 && c === 4 && piece.type === 'r') {
        return [
          { r: 4, c: 4 },
          { r: 5, c: 4 },
          { r: 6, c: 4 },
          { r: 7, c: 4 },
          { r: 8, c: 4 },
        ];
      }
      // For the initial detection, the rook at (0,0) must find move to (0,4)
      if (r === 0 && c === 0 && piece.type === 'r') {
        return [{ r: 0, c: 4 }];
      }
      return [];
    });

    mockGame.getAllLegalMoves.mockReturnValue([
      { from: { r: 0, c: 0 }, to: { r: 0, c: 4 } }, // Move that creates the pin
    ]);

    mockGame.isInCheck = jest.fn(() => false);

    analysisManager.showOpportunities = true;
    const arrows = analysisManager.getOpportunityArrows();

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toMatchObject({
      fromR: 0,
      fromC: 0,
      toR: 0,
      toC: 4,
      colorKey: 'orange',
    });
  });
});
