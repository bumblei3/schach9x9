import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  renderBoard: jest.fn(),
  updateStatus: jest.fn(),
  renderEvalGraph: jest.fn(),
}));

const UI = await import('../js/ui.js');
const { AnalysisController } = await import('../js/AnalysisController.js');

describe('AnalysisController', () => {
  let game;
  let gameController;
  let analysisController;

  beforeEach(() => {
    game = {
      phase: PHASES.PLAY,
      turn: 'white',
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      moveHistory: [],
      redoStack: [],
      positionHistory: ['h1'],
      selectedSquare: null,
      validMoves: [],
      halfMoveClock: 0,
      log: jest.fn(),
      aiController: {
        analyzePosition: jest.fn(),
      },
      analysisMode: false,
    };

    gameController = {
      game: game,
      stopClock: jest.fn(),
      startClock: jest.fn(),
    };

    analysisController = new AnalysisController(gameController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enter Analysis Mode', () => {
    test('should only allow entering during PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      const result = analysisController.enterAnalysisMode();
      expect(result).toBe(false);
      expect(game.analysisMode).toBe(false);
    });

    test('should save game state and enter analysis mode', () => {
      game.moveHistory = ['e2e4'];
      const result = analysisController.enterAnalysisMode();

      expect(result).toBe(true);
      expect(game.analysisMode).toBe(true);
      expect(game.phase).toBe(PHASES.ANALYSIS);
      expect(game.analysisBasePosition).toBeDefined();
      expect(game.analysisBasePosition.moveHistory).toEqual(['e2e4']);
      expect(gameController.stopClock).toHaveBeenCalled();
      expect(UI.renderBoard).toHaveBeenCalled();
    });
  });

  describe('Exit Analysis Mode', () => {
    test('should do nothing if not in analysis mode', () => {
      game.analysisMode = false;
      const result = analysisController.exitAnalysisMode();
      expect(result).toBe(false);
    });

    test('should restore position when exiting with restore=true', () => {
      // First enter analysis to save state
      analysisController.enterAnalysisMode();

      // Modify state (simulate analysis moves)
      game.moveHistory.push('analysis_move');
      game.phase = PHASES.ANALYSIS;

      // Exit with restore
      const result = analysisController.exitAnalysisMode(true);

      expect(result).toBe(true);
      expect(game.analysisMode).toBe(false);
      expect(game.phase).toBe(PHASES.PLAY);
      expect(game.moveHistory).toEqual([]); // Should be restored to empty
    });

    test('should keep current position when exiting with restore=false', () => {
      // First enter analysis to save state
      analysisController.enterAnalysisMode();

      // Modify state
      game.moveHistory.push('analysis_move');

      // Exit without restore
      const result = analysisController.exitAnalysisMode(false);

      expect(result).toBe(true);
      expect(game.moveHistory).toEqual(['analysis_move']);
    });
  });

  describe('Continuous Analysis', () => {
    test('should trigger analysis if continuous mode is enabled', () => {
      game.continuousAnalysis = true;
      analysisController.enterAnalysisMode();
      expect(game.aiController.analyzePosition).toHaveBeenCalled();
    });

    test('should toggle continuous analysis', () => {
      game.continuousAnalysis = false;
      game.analysisMode = true;

      analysisController.toggleContinuousAnalysis();

      expect(game.continuousAnalysis).toBe(true);
      expect(game.aiController.analyzePosition).toHaveBeenCalled();

      analysisController.toggleContinuousAnalysis();
      expect(game.continuousAnalysis).toBe(false);
    });
  });
});
