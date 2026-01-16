import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { PHASES } from '../js/config.js';
// Change to proper imports if possible, or keep dynamic if needed.
// Given previous issues, standard import is safer if modules are aligned.
import { AnalysisController } from '../js/AnalysisController.js';
import * as UI from '../js/ui.js';

// Mock dependencies
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

interface MockGame {
  phase: string;
  turn: string;
  board: any[][];
  moveHistory: any[];
  redoStack: any[];
  positionHistory: string[];
  selectedSquare: any;
  validMoves: any[];
  halfMoveClock: number;
  log: any;
  aiController?: {
    analyzePosition: any;
  };
  analysisMode: boolean;
  analysisBasePosition?: any;
  continuousAnalysis?: boolean;
  moveController?: any;
  replayPosition?: number;
  clockEnabled?: boolean;
  [key: string]: any;
}

describe('AnalysisController', () => {
  let game: MockGame;
  let gameController: any;
  let analysisController: AnalysisController;

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
      log: vi.fn(),
      aiController: {
        analyzePosition: vi.fn(),
      },
      analysisMode: false,
    };

    gameController = {
      game: game,
      stopClock: vi.fn(),
      startClock: vi.fn(),
    };

    analysisController = new AnalysisController(gameController);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      expect(game.aiController!.analyzePosition).toHaveBeenCalled();
    });

    test('should toggle continuous analysis', () => {
      game.continuousAnalysis = false;
      game.analysisMode = true;

      analysisController.toggleContinuousAnalysis();

      expect(game.continuousAnalysis).toBe(true);
      expect(game.aiController!.analyzePosition).toHaveBeenCalled();

      analysisController.toggleContinuousAnalysis();
      expect(game.continuousAnalysis).toBe(false);
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      game.moveController = {
        reconstructBoardAtMove: vi.fn(),
      };
      game.analysisMode = true;
    });

    test('should jump to specific move', () => {
      analysisController.jumpToMove(5);
      expect(game.moveController!.reconstructBoardAtMove).toHaveBeenCalledWith(5);
      expect(game.replayPosition).toBe(5);
      expect(UI.renderBoard).toHaveBeenCalled();
    });

    test('should jump to start', () => {
      analysisController.jumpToStart();
      expect(game.moveController!.reconstructBoardAtMove).toHaveBeenCalledWith(0);
      expect(game.replayPosition).toBe(-1);
      expect(UI.renderBoard).toHaveBeenCalled();
    });

    test('should trigger analysis after jump if continuous analysis is on', () => {
      game.continuousAnalysis = true;
      analysisController.jumpToMove(3);
      expect(game.aiController!.analyzePosition).toHaveBeenCalled();
    });

    test('should not crash if moveController is missing', () => {
      delete game.moveController;
      expect(() => analysisController.jumpToMove(1)).not.toThrow();
      expect(() => analysisController.jumpToStart()).not.toThrow();
    });
  });

  describe('AI and Clock Integration', () => {
    test('should request analysis safely', () => {
      game.aiController = undefined;
      // Cast to any to access private method if needed or public wrapper
      // requestPositionAnalysis is public on AnalysisController
      expect(() => analysisController.requestPositionAnalysis()).not.toThrow();
    });

    test('should restart clock on exit if clockEnabled', () => {
      game.analysisMode = true;
      game.clockEnabled = true;

      analysisController.exitAnalysisMode();
      expect(gameController.startClock).toHaveBeenCalled();
    });

    test('should not restart clock on exit if clock disabled', () => {
      game.analysisMode = true;
      game.clockEnabled = false;

      analysisController.exitAnalysisMode();
      expect(gameController.startClock).not.toHaveBeenCalled();
    });
  });
});
