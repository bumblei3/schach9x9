// Mock the sub-modules
vi.mock('../js/tutor/TacticsDetector.js', () => ({
  getThreatenedPieces: vi.fn(),
  detectTacticalPatterns: vi.fn(),
  detectPins: vi.fn(),
  detectDiscoveredAttacks: vi.fn(),
  canPieceMove: vi.fn(),
  detectThreatsAfterMove: vi.fn(),
  countDefenders: vi.fn(),
  countAttackers: vi.fn(),
  getDefendedPieces: vi.fn(),
}));

vi.mock('../js/tutor/MoveAnalyzer.js', () => ({
  getMoveNotation: vi.fn(() => 'e4'),
  getPieceName: vi.fn(() => 'Bauer'),
  analyzeStrategicValue: vi.fn(),
  getScoreDescription: vi.fn(),
  analyzeMoveWithExplanation: vi.fn(),
  handlePlayerMove: vi.fn(),
  checkBlunder: vi.fn(),
  showBlunderWarning: vi.fn(),
}));

vi.mock('../js/tutor/HintGenerator.js', () => ({
  updateBestMoves: vi.fn(),
  isTutorMove: vi.fn(),
  getTutorHints: vi.fn(() => []),
  showTutorSuggestions: vi.fn(),
  getSetupTemplates: vi.fn(() => []),
  applySetupTemplate: vi.fn(),
  placePiece: vi.fn(),
}));

// Mock gameEngine to avoid side effects
vi.mock('../js/gameEngine.js', () => ({
  Game: class {
    constructor() {
      this.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
    }
  },
  PHASES: { PLAY: 'play' },
}));

// Dynamic imports are required for mocked modules in ESM
const TacticsDetector = await import('../js/tutor/TacticsDetector.js');
const MoveAnalyzer = await import('../js/tutor/MoveAnalyzer.js');
const HintGenerator = await import('../js/tutor/HintGenerator.js');
await import('../js/utils.js');
const { TutorController } = await import('../js/tutorController.js');
const { Game } = await import('../js/gameEngine.js');

describe('TutorController', () => {
  let game;
  let tutorController;

  beforeEach(() => {
    game = new Game();
    tutorController = new TutorController(game);
    vi.clearAllMocks();
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

  test('should delegate showTutorSuggestions to HintGenerator', async () => {
    await tutorController.showTutorSuggestions();
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
    expect(HintGenerator.applySetupTemplate).toHaveBeenCalledWith(
      game,
      tutorController,
      'template1'
    );

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

  test('showHint should force calculation if no bestMoves', async () => {
    game.bestMoves = null;
    await tutorController.showHint();
    expect(HintGenerator.getTutorHints).toHaveBeenCalled();
    expect(HintGenerator.showTutorSuggestions).toHaveBeenCalled();
  });
});
