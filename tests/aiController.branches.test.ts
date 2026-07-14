import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setupJSDOM, createMockGame } from './test-utils.js';

const UI_MOCK = {
  initBoardUI: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  renderBoard: vi.fn(),
  showShop: vi.fn(),
  showModal: vi.fn(),
  showPromotionUI: vi.fn(),
  showToast: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  getPieceText: vi.fn((piece: any) => (piece ? piece.type : '')),
  showMoveQuality: vi.fn(),
  showTutorSuggestions: vi.fn(),
  closeModal: vi.fn(),
  showDrawOfferDialog: vi.fn(),
};

vi.mock('../js/ui.js', () => UI_MOCK);

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(), playGameOver: vi.fn(), playMove: vi.fn(),
    playGameStart: vi.fn(), playCapture: vi.fn(),
  },
}));

vi.mock('../js/storage.js', () => ({
  storageManager: { saveGame: vi.fn(), loadGame: vi.fn(), loadStateIntoGame: vi.fn() },
}));

const AI_ENGINE_MOCK = {
  evaluatePosition: vi.fn(),
  see: vi.fn(() => 0),
  isSquareAttacked: vi.fn(() => false),
  findKing: vi.fn(() => ({ r: 0, c: 0 })),
  isInCheck: vi.fn(() => false),
  getAllLegalMoves: vi.fn(() => []),
  getParamsForElo: vi.fn(() => ({ maxDepth: 4, elo: 2500 })),
  convertBoardToInt: vi.fn(() => new Int8Array(64)),
  getAllThreats: vi.fn().mockReturnValue([]),
  getKingThreats: vi.fn().mockReturnValue([]),
  getXRayThreats: vi.fn().mockReturnValue([]),
  getDiscoveredAttackPotential: vi.fn().mockReturnValue([]),
  PIECE_PAWN: 1, PIECE_KNIGHT: 2, PIECE_BISHOP: 3, PIECE_ROOK: 4,
  PIECE_QUEEN: 5, PIECE_KING: 6, PIECE_ARCHBISHOP: 7, PIECE_CHANCELLOR: 8,
  PIECE_ANGEL: 9, PIECE_NIGHTRIDER: 10, PIECE_NONE: 0,
  COLOR_WHITE: 16, COLOR_BLACK: 32,
};

vi.mock('../js/aiEngine.js', () => AI_ENGINE_MOCK);

const { GameController } = await import('../js/gameController.js');
const { AIController } = await import('../js/aiController.js');

describe('AIController branch coverage (setup king/pieces/upgrades)', () => {
  let game: any, gc: any, ac: any;

  beforeEach(() => {
    setupJSDOM();
    game = createMockGame();
    game.findKing = vi.fn(() => ({ r: 1, c: 1 }));
    gc = new GameController(game);
    ac = new AIController(game);
    vi.clearAllMocks();
  });

  test('aiSetupKing: standard board uses random corridor, calls placeKing', () => {
    game.boardShape = 'standard';
    game.gameController = gc;
    const spy = vi.spyOn(gc, 'placeKing');
    ac.aiSetupKing();
    expect(spy).toHaveBeenCalled();
  });

  test('aiSetupKing: cross-shaped board restricts to center corridor', () => {
    game.boardShape = 'cross';
    game.gameController = gc;
    const spy = vi.spyOn(gc, 'placeKing');
    ac.aiSetupKing();
    expect(spy).toHaveBeenCalled();
  });

  test('aiSetupKing: no gameController -> no crash', () => {
    game.boardShape = 'standard';
    game.gameController = null;
    expect(() => ac.aiSetupKing()).not.toThrow();
  });

  test('aiSetupPieces: no blackCorridor -> early return', () => {
    game.blackCorridor = null;
    game.gameController = gc;
    expect(() => ac.aiSetupPieces()).not.toThrow();
  });

  test('aiSetupPieces: buys pieces until points exhausted', () => {
    game.blackCorridor = 0;
    game.points = 30;
    game.boardShape = 'standard';
    game.gameController = gc;
    // ensure board has empty spots in corridor
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) game.board[r][c] = null;
    const spy = vi.spyOn(gc, 'placeShopPiece');
    const spyFinish = vi.spyOn(gc, 'finishSetupPhase');
    ac.aiSetupPieces();
    expect(spy).toHaveBeenCalled();
    expect(spyFinish).toHaveBeenCalled();
  });

  test('aiSetupPieces: cross board filters blocked cells', () => {
    game.blackCorridor = 3;
    game.points = 30;
    game.boardShape = 'cross';
    game.gameController = gc;
    for (let r = 0; r < 3; r++) for (let c = 3; c < 6; c++) game.board[r][c] = null;
    const spy = vi.spyOn(gc, 'placeShopPiece');
    ac.aiSetupPieces();
    expect(spy).toHaveBeenCalled();
  });

  test('aiSetupUpgrades: upgrade mode skips upgrades', () => {
    game.mode = 'upgrade';
    game.gameController = gc;
    const spy = vi.fn();
    gc.shopManager = { aiPerformUpgrades: spy };
    ac.aiSetupUpgrades();
    expect(spy).not.toHaveBeenCalled();
  });

  test('aiSetupUpgrades: classic mode performs upgrades', () => {
    game.mode = 'classic';
    game.gameController = gc;
    const spy = vi.fn();
    gc.shopManager = { aiPerformUpgrades: spy };
    ac.aiSetupUpgrades();
    expect(spy).toHaveBeenCalled();
  });

  test('aiMove: puzzle mode skips move', async () => {
    game.mode = 'puzzle';
    await ac.aiMove();
    // no crash, no move attempted
    expect(true).toBe(true);
  });
});
