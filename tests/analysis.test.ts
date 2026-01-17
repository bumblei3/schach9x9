import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalysisManager } from '../js/AnalysisManager.js';

describe('AnalysisManager', () => {
  let mockGame: any;
  let analysisManager: any;

  // Mock Dependencies
  vi.mock('../js/tutor/TacticsDetector.js', () => ({
    getThreatenedPieces: vi.fn(),
    countDefenders: vi.fn(),
    detectTacticalPatterns: vi.fn(),
  }));

  vi.mock('../js/aiEngine.js', () => ({
    see: vi.fn(),
  }));

  beforeEach(async () => {
    // Reset mocks
    const TacticsDetector = await import('../js/tutor/TacticsDetector.js');
    const aiEngine = await import('../js/aiEngine.js');
    vi.clearAllMocks();

    // Default implementations
    (TacticsDetector.getThreatenedPieces as any).mockReturnValue([]);
    (TacticsDetector.countDefenders as any).mockReturnValue(0);
    (TacticsDetector.detectTacticalPatterns as any).mockReturnValue([]);
    (aiEngine.see as any).mockReturnValue(0);

    mockGame = {
      boardSize: 9,
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      turn: 'white',
      arrowRenderer: {
        highlightMoves: vi.fn(),
        clearArrows: vi.fn(),
      },
      getValidMoves: vi.fn(() => []),
      getAllLegalMoves: vi.fn(() => []),
      tutorController: {
        getPieceName: vi.fn(type => type),
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

  test('should generate threat arrows correctly', async () => {
    const TacticsDetector = await import('../js/tutor/TacticsDetector.js');
    const aiEngine = await import('../js/aiEngine.js');

    // Simulate Black Rook at (0,4) threatening White Queen at (4,4)
    mockGame.board[0][4] = { type: 'r', color: 'black' }; // Add attacker to board

    (TacticsDetector.getThreatenedPieces as any).mockReturnValue([
      { piece: { type: 'q', color: 'white' }, pos: { r: 4, c: 4 } },
    ]);
    (TacticsDetector.countDefenders as any).mockReturnValue(0); // Undefended
    (aiEngine.see as any).mockReturnValue(5); // Positive exchange

    mockGame.turn = 'white';
    analysisManager.showThreats = true;
    const arrows = analysisManager.getThreatArrows();

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toMatchObject({
      fromR: 0,
      fromC: 4, // Logic infers attacker from board, so we need to ensure board has attacker
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

  test('should only show serious threats', async () => {
    const TacticsDetector = await import('../js/tutor/TacticsDetector.js');
    const aiEngine = await import('../js/aiEngine.js');

    // Setup: Attacker exists on board
    mockGame.board[0][7] = { type: 'r', color: 'black' };
    mockGame.turn = 'white';

    // Case 1: Defended and low SEE -> Not serious
    (TacticsDetector.getThreatenedPieces as any).mockReturnValue([
      { piece: { type: 'n', color: 'white' }, pos: { r: 7, c: 7 } },
    ]);
    (TacticsDetector.countDefenders as any).mockReturnValue(1); // Defended
    (aiEngine.see as any).mockReturnValue(-2); // Bad trade

    analysisManager.showThreats = true;
    let arrows = analysisManager.getThreatArrows();
    expect(arrows.length).toBe(0);

    // Case 2: Undefended (or High SEE) -> Serious
    (TacticsDetector.countDefenders as any).mockReturnValue(0); // Undefended
    (aiEngine.see as any).mockReturnValue(3); // Free knight

    arrows = analysisManager.getThreatArrows();
    expect(arrows.length).toBe(1);
  });
  test('should generate opportunity arrows for high severity patterns (fork)', async () => {
    const TacticsDetector = await import('../js/tutor/TacticsDetector.js');

    // Simulate finding a Fork
    (mockGame.getAllLegalMoves as any).mockReturnValue([
      { from: { r: 7, c: 6 }, to: { r: 5, c: 5 } },
    ]);

    (TacticsDetector.detectTacticalPatterns as any).mockReturnValue([
      { type: 'fork', severity: 'high' },
    ]);

    analysisManager.showOpportunities = true;
    const arrows = analysisManager.getOpportunityArrows();

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]).toMatchObject({
      fromR: 7,
      fromC: 6,
      toR: 5,
      toC: 5,
      colorKey: 'orange',
    });
  });

  test('should generate opportunity arrows for high severity patterns (pin)', async () => {
    const TacticsDetector = await import('../js/tutor/TacticsDetector.js');

    // Simulate finding a Pin
    (mockGame.getAllLegalMoves as any).mockReturnValue([
      { from: { r: 0, c: 0 }, to: { r: 0, c: 4 } },
    ]);

    (TacticsDetector.detectTacticalPatterns as any).mockReturnValue([
      { type: 'pin', severity: 'high' },
    ]);

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
