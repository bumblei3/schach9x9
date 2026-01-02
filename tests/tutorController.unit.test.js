import { jest } from '@jest/globals';

// Mock utils for debounce
jest.unstable_mockModule('../js/utils.js', () => ({
    debounce: jest.fn((fn) => fn),
}));

// Mock the sub-modules
jest.unstable_mockModule('../js/tutor/TacticsDetector.js', () => ({
    getThreatenedPieces: jest.fn(),
    detectTacticalPatterns: jest.fn(),
    detectPins: jest.fn(),
    detectDiscoveredAttacks: jest.fn(),
    canPieceMove: jest.fn(),
    detectThreatsAfterMove: jest.fn(),
    countDefenders: jest.fn(),
    countAttackers: jest.fn(),
    getDefendedPieces: jest.fn(),
}));

jest.unstable_mockModule('../js/tutor/MoveAnalyzer.js', () => ({
    getMoveNotation: jest.fn(() => 'e4'),
    getPieceName: jest.fn(() => 'Bauer'),
    analyzeStrategicValue: jest.fn(),
    getScoreDescription: jest.fn(),
    analyzeMoveWithExplanation: jest.fn(),
    handlePlayerMove: jest.fn(),
    checkBlunder: jest.fn(),
    showBlunderWarning: jest.fn(),
}));

jest.unstable_mockModule('../js/tutor/HintGenerator.js', () => ({
    updateBestMoves: jest.fn(),
    isTutorMove: jest.fn(),
    getTutorHints: jest.fn(() => []),
    showTutorSuggestions: jest.fn(),
    getSetupTemplates: jest.fn(() => []),
    applySetupTemplate: jest.fn(),
    placePiece: jest.fn(),
}));

// Mock gameEngine to avoid side effects
jest.unstable_mockModule('../js/gameEngine.js', () => ({
    Game: class {
        constructor() { this.board = Array(9).fill(null).map(() => Array(9).fill(null)); }
    },
    PHASES: { PLAY: 'play' },
}));

// Dynamic imports are required for mocked modules in ESM
const TacticsDetector = await import('../js/tutor/TacticsDetector.js');
const MoveAnalyzer = await import('../js/tutor/MoveAnalyzer.js');
const HintGenerator = await import('../js/tutor/HintGenerator.js');
const { debounce } = await import('../js/utils.js');
const { TutorController } = await import('../js/tutorController.js');
const { Game } = await import('../js/gameEngine.js');

describe('TutorController', () => {
    let game;
    let tutorController;

    beforeEach(() => {
        game = new Game();
        tutorController = new TutorController(game);
        jest.clearAllMocks();
    });

    test('should delegate updateBestMoves to HintGenerator', () => {
        tutorController.updateBestMoves();
        expect(HintGenerator.updateBestMoves).toHaveBeenCalledWith(game, tutorController);
    });

    test('should delegate isTutorMove to HintGenerator', () => {
        tutorController.isTutorMove({ r: 6, c: 4 }, { r: 4, c: 4 });
        expect(HintGenerator.isTutorMove).toHaveBeenCalledWith(game, { r: 6, c: 4 }, { r: 4, c: 4 });
    });

    test('should delegate getTutorHints to HintGenerator', () => {
        tutorController.getTutorHints();
        expect(HintGenerator.getTutorHints).toHaveBeenCalledWith(game, tutorController);
    });

    test('should delegate getMoveNotation to MoveAnalyzer', () => {
        const notation = tutorController.getMoveNotation({ from: 'a2', to: 'a4' });
        expect(notation).toBe('e4');
        expect(MoveAnalyzer.getMoveNotation).toHaveBeenCalledWith(game, { from: 'a2', to: 'a4' });
    });

    test('should delegate showTutorSuggestions to HintGenerator', () => {
        tutorController.showTutorSuggestions();
        expect(HintGenerator.showTutorSuggestions).toHaveBeenCalledWith(game);
    });

    test('should delegate getPieceName to MoveAnalyzer', () => {
        const name = tutorController.getPieceName('p');
        expect(name).toBe('Bauer');
        expect(MoveAnalyzer.getPieceName).toHaveBeenCalledWith('p');
    });

    test('should delegate tactical detections to TacticsDetector', () => {
        tutorController.getThreatenedPieces({ r: 0, c: 0 }, 'white');
        expect(TacticsDetector.getThreatenedPieces).toHaveBeenCalled();

        tutorController.detectTacticalPatterns({});
        expect(TacticsDetector.detectTacticalPatterns).toHaveBeenCalled();

        tutorController.detectPins({}, 'white');
        expect(TacticsDetector.detectPins).toHaveBeenCalled();
    });

    test('should delegate move analysis to MoveAnalyzer', () => {
        tutorController.analyzeStrategicValue({});
        expect(MoveAnalyzer.analyzeStrategicValue).toHaveBeenCalled();

        tutorController.analyzeMoveWithExplanation({}, 0, 0);
        expect(MoveAnalyzer.analyzeMoveWithExplanation).toHaveBeenCalled();
    });

    test('should delegate setup templates to HintGenerator', () => {
        tutorController.getSetupTemplates();
        expect(HintGenerator.getSetupTemplates).toHaveBeenCalledWith(game);

        tutorController.applySetupTemplate('template1');
        expect(HintGenerator.applySetupTemplate).toHaveBeenCalledWith(game, tutorController, 'template1');

        tutorController.placePiece(0, 0, 'p', true);
        expect(HintGenerator.placePiece).toHaveBeenCalledWith(game, 0, 0, 'p', true);
    });

    test('should delegate player move and blunder checks', () => {
        tutorController.handlePlayerMove({ r: 6, c: 4 }, { r: 4, c: 4 });
        expect(MoveAnalyzer.handlePlayerMove).toHaveBeenCalled();

        tutorController.checkBlunder({});
        expect(MoveAnalyzer.checkBlunder).toHaveBeenCalled();

        tutorController.showBlunderWarning({});
        expect(MoveAnalyzer.showBlunderWarning).toHaveBeenCalled();
    });

    test('should delegate remaining analyzer and detector methods', () => {
        tutorController.detectDiscoveredAttacks({}, {}, 'white');
        expect(TacticsDetector.detectDiscoveredAttacks).toHaveBeenCalled();

        tutorController.canPieceMove('p', 1, 0);
        expect(TacticsDetector.canPieceMove).toHaveBeenCalledWith('p', 1, 0);

        tutorController.detectThreatsAfterMove({});
        expect(TacticsDetector.detectThreatsAfterMove).toHaveBeenCalled();

        tutorController.countDefenders(0, 0, 'white');
        expect(TacticsDetector.countDefenders).toHaveBeenCalled();

        tutorController.countAttackers(0, 0, 'black');
        expect(TacticsDetector.countAttackers).toHaveBeenCalled();

        tutorController.getDefendedPieces({}, 'white');
        expect(TacticsDetector.getDefendedPieces).toHaveBeenCalled();

        tutorController.getScoreDescription(100);
        expect(MoveAnalyzer.getScoreDescription).toHaveBeenCalledWith(100);
    });

    test('showHint should force calculation if no bestMoves', () => {
        game.bestMoves = null;
        tutorController.showHint();
        expect(HintGenerator.getTutorHints).toHaveBeenCalled();
        expect(HintGenerator.showTutorSuggestions).toHaveBeenCalled();
    });
});
