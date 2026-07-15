/**
 * Focused tests for js/gameController.ts — the game-end state machine and
 * king-placement validation.
 *
 * gameController is the largest uncovered logic module (75.6 % lines / 66 %
 * branches). Most of it is UI orchestration, but the game-end state machine
 * (resign / offer-draw / accept-draw / decline-draw) and placeKing validation
 * are pure logic worth locking. The heavy constructor (StatisticsManager,
 * TimeManager, ShopManager, AnalysisController, …) and all rendering/IO are
 * mocked so the tests exercise only the decision logic.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock all heavy / IO dependencies of the controller -------------------
vi.mock('../js/statisticsManager.js', () => ({
  StatisticsManager: class {
    constructor() {}
  },
}));
vi.mock('../js/TimeManager.js', () => ({
  TimeManager: class {
    constructor() {}
    stopClock() {}
    startClock() {}
    tickClock() {}
  },
}));
vi.mock('../js/shop/ShopManager.js', () => ({
  ShopManager: class {
    constructor() {}
  },
}));
vi.mock('../js/AnalysisController.js', () => ({
  AnalysisController: class {
    constructor() {}
  },
}));
vi.mock('../js/ui/AnalysisUI.js', () => ({
  AnalysisUI: class {
    constructor() {}
  },
}));
vi.mock('../js/ui/PuzzleMenu.js', () => ({
  PuzzleMenu: class {
    constructor() {}
  },
}));
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  showShop: vi.fn(),
  showModal: vi.fn(),
}));
vi.mock('../js/sounds.js', () => ({
  soundManager: { playGameOver: vi.fn(), playGameStart: vi.fn(), playMove: vi.fn() },
}));
vi.mock('../js/effects.js', () => ({ confettiSystem: { spawn: vi.fn() } }));
vi.mock('../js/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
  },
}));
// storage.js is exercised by saveGame / loadGame — give it a controllable mock.
const storageManager = {
  saveGame: vi.fn(() => true),
  loadGame: vi.fn(() => null),
  loadStateIntoGame: vi.fn(() => true),
};
vi.mock('../js/storage.js', () => ({ storageManager }));
// aiEngine is imported only for types/constants (PIECE_*) — auto-mock avoids
// pulling the real search engine into this logic suite.
vi.mock('../js/aiEngine.js', () => ({ PIECE_KING: 6, PIECE_QUEEN: 8 }));

// Minimal DOM + storage stubs so getElementById / localStorage never throw.
const noopEl = { textContent: '', classList: { add: vi.fn(), remove: vi.fn() }, checked: false, value: '' };
const noopSelect = { value: '', forEach: (cb: (e: any) => void) => cb(noopSelect) };
vi.stubGlobal('document', {
  getElementById: () => noopEl,
  querySelector: () => noopEl,
  querySelectorAll: () => [] as any[],
});
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const { GameController } = await import('../js/gameController.js');
const { PHASES } = await import('../js/gameEngine.js');

// Build a minimal GameExtended stub with only the fields the tested methods touch.
function makeGame(over: any = {}): any {
  return {
    phase: PHASES.PLAY,
    turn: 'white',
    playerColor: 'white',
    isAI: false,
    drawOffered: false,
    drawOfferedBy: null,
    boardSize: 9,
    board: Array.from({ length: 9 }, () => Array(9).fill(null)),
    log: vi.fn(),
    campaignMode: false,
    initialPoints: 0,
    ...over,
  };
}

let controller: any;
let game: any;

beforeEach(() => {
  game = makeGame();
  controller = new GameController(game);
  // Isolate decision logic from downstream UI/stats side effects.
  vi.spyOn(controller, 'handleGameEnd').mockImplementation(() => {});
  vi.spyOn(controller, 'saveGameToStatistics').mockImplementation(() => {});
  vi.spyOn(controller as any, 'stopClock').mockImplementation(() => {});
});

describe('resign', () => {
  test('white resigning ends the game with black as winner', () => {
    controller.resign('white');
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(controller.handleGameEnd).toHaveBeenCalledWith('win', 'black');
  });

  test('black resigning ends the game with white as winner', () => {
    game.turn = 'black';
    game.playerColor = 'black';
    controller.resign('black');
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(controller.handleGameEnd).toHaveBeenCalledWith('win', 'white');
  });

  test('resigning the side to move (no explicit color) picks the current turn', () => {
    game.turn = 'black';
    controller.resign();
    expect(controller.handleGameEnd).toHaveBeenCalledWith('win', 'white');
  });

  test('no-op when not in PLAY phase', () => {
    game.phase = PHASES.GAME_OVER;
    controller.resign('white');
    expect(controller.handleGameEnd).not.toHaveBeenCalled();
  });
});

describe('offerDraw', () => {
  test('sets drawOffered and the offering side', () => {
    controller.offerDraw('black');
    expect(game.drawOffered).toBe(true);
    expect(game.drawOfferedBy).toBe('black');
  });

  test('no-op when a draw is already offered', () => {
    game.drawOffered = true;
    game.drawOfferedBy = 'white';
    controller.offerDraw('black');
    // stays as the original offer
    expect(game.drawOfferedBy).toBe('white');
  });

  test('no-op when not in PLAY phase', () => {
    game.phase = PHASES.GAME_OVER;
    controller.offerDraw('white');
    expect(game.drawOffered).toBe(false);
  });
});

describe('acceptDraw', () => {
  test('ends the game as a draw and clears the offer', () => {
    game.drawOffered = true;
    game.drawOfferedBy = 'white';
    controller.acceptDraw();
    expect(game.phase).toBe(PHASES.GAME_OVER);
    expect(game.drawOffered).toBe(false);
    expect(game.drawOfferedBy).toBeNull();
    expect(controller.saveGameToStatistics).toHaveBeenCalledWith('draw', null);
  });

  test('no-op when no draw is pending', () => {
    game.drawOffered = false;
    controller.acceptDraw();
    expect(game.phase).not.toBe(PHASES.GAME_OVER);
    expect(controller.saveGameToStatistics).not.toHaveBeenCalled();
  });
});

describe('declineDraw', () => {
  test('clears the pending offer', () => {
    game.drawOffered = true;
    game.drawOfferedBy = 'white';
    controller.declineDraw();
    expect(game.drawOffered).toBe(false);
    expect(game.drawOfferedBy).toBeNull();
  });

  test('no-op when no draw is pending', () => {
    game.drawOffered = false;
    controller.declineDraw();
    expect(game.log).not.toHaveBeenCalled();
  });
});

describe('placeKing', () => {
  test('places the white king at the correct fixed square (row 7, colStart+1)', () => {
    // c = 4 -> colBlock 1 -> colStart 3 -> kingC 4, kingR = 6+1 = 7
    controller.placeKing(7, 4, 'white');
    expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
  });

  test('rejects placement outside the valid 3-row band', () => {
    controller.placeKing(0, 4, 'white'); // white valid rows are 6..8
    const hasKing = game.board.some((row: any[]) => row.some((p: any) => p && p.type === 'k'));
    expect(hasKing).toBe(false);
    expect(game.log).toHaveBeenCalled();
  });

  test('removes any pre-existing king of the same color before placing', () => {
    game.board[7][1] = { type: 'k', color: 'white', hasMoved: false };
    controller.placeKing(7, 7, 'white'); // colBlock 2 -> colStart 6 -> kingC 7
    // Old king gone, new king at (7,7)
    expect(game.board[7][1]).toBeNull();
    expect(game.board[7][7]).toEqual({ type: 'k', color: 'white', hasMoved: false });
  });
});

// Regression guard for the opening-trainer fix shipped in PR #124: a book hash
// may encode "black to move" (trailing 'b'). Without forcing the turn to the
// player's color, handleCellClick would reject every click as "AI turn" and
// the trainer would silently break (streak stuck at 0). loadTrainerPosition
// must override the decoded turn with game.playerColor.
describe('loadTrainerPosition — black-to-move book hash', () => {
  test('forces game.turn to playerColor even when the book hash says black', () => {
    // Valid 163-char hash: 81 empty cells (162 '.') + trailing 'b'.
    const blackHash = '.'.repeat(162) + 'b';
    const trainerPos = {
      hash: blackHash,
      expectedMove: { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } },
    };

    // Inject a manager that returns this black-to-move position, bypassing
    // listPositions()' own black-skip filter (defense-in-depth at the load site).
    (controller as any).openingTrainerManager = {
      getNextPosition: () => trainerPos,
    };

    // Simulate the real broken state: game.turn was left at 'black' (e.g. from
    // the decoded book hash) before the trainer loads the position. Without
    // the fix, loadTrainerPosition never overrides it and handleCellClick
    // rejects every click as "AI turn".
    game.turn = 'black';

    controller.loadTrainerPosition();

    // The fix must override the stale 'black' turn with the player's color so
    // the human can actually move.
    expect((controller as any).currentTrainerPosition).toBe(trainerPos);
    expect(game.turn).toBe(game.playerColor);
    expect(game.turn).toBe('white');
    // The board must have been reconstructed (81 cells) and rendered.
    expect(game.board.length).toBe(9);
    expect(game.board[0].length).toBe(9);
  });
});

// --- Draw offer when the opponent is the AI ---------------------------------
// The human player offers a draw; gameController must schedule the AI's
// draw evaluation (aiEvaluateDrawOffer) after AI_DELAY_MS instead of showing
// the human dialog. This path was previously uncovered.
describe('offerDraw — AI opponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('schedules aiEvaluateDrawOffer when a human offers draw to the AI', () => {
    game = makeGame({ isAI: true, turn: 'white', drawOffered: false });
    game.aiEvaluateDrawOffer = vi.fn();
    controller = new GameController(game);

    controller.offerDraw('white');

    // Not yet called synchronously
    expect(game.aiEvaluateDrawOffer).not.toHaveBeenCalled();
    // After the delay it fires
    vi.advanceTimersByTime(1000);
    expect(game.aiEvaluateDrawOffer).toHaveBeenCalledTimes(1);
  });

  test('schedules aiEvaluateDrawOffer even when it is the AI turn (human offer wins)', () => {
    // In a real game only the human calls offerDraw(); regardless of whose
    // turn it is, an AI opponent must evaluate the pending offer.
    game = makeGame({ isAI: true, turn: 'black', drawOffered: false });
    game.aiEvaluateDrawOffer = vi.fn();
    controller = new GameController(game);

    controller.offerDraw('white');

    expect(game.aiEvaluateDrawOffer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(game.aiEvaluateDrawOffer).toHaveBeenCalledTimes(1);
  });

  test('no-op when not in PLAY phase (no timer scheduled)', () => {
    game = makeGame({ isAI: true, phase: PHASES.GAME_OVER, drawOffered: false });
    game.aiEvaluateDrawOffer = vi.fn();
    controller = new GameController(game);

    controller.offerDraw('white');

    vi.advanceTimersByTime(1000);
    expect(game.aiEvaluateDrawOffer).not.toHaveBeenCalled();
  });
});

// --- saveGame / loadGame error + success branches ---------------------------
describe('saveGame / loadGame', () => {
  beforeEach(() => {
    // reset storage mock to a clean success-by-default state
    storageManager.saveGame.mockReturnValue(true);
    storageManager.loadGame.mockReturnValue(null);
    storageManager.loadStateIntoGame.mockReturnValue(true);
  });

  test('saveGame logs success when storageManager.saveGame returns true', () => {
    game = makeGame();
    controller = new GameController(game);
    (controller as any).saveGame();
    expect(game.log).toHaveBeenCalledWith('💾 Spiel erfolgreich gespeichert!');
  });

  test('saveGame logs error when storageManager.saveGame returns false', () => {
    storageManager.saveGame.mockReturnValue(false);
    game = makeGame();
    controller = new GameController(game);
    (controller as any).saveGame();
    expect(game.log).toHaveBeenCalledWith('❌ Fehler beim Speichern.');
  });

  test('loadGame no-ops with a warning when there is no saved game', () => {
    storageManager.loadGame.mockReturnValue(null);
    game = makeGame();
    controller = new GameController(game);
    (controller as any).loadGame();
    expect(game.log).toHaveBeenCalledWith('⚠️ Kein gespeichertes Spiel gefunden.');
    expect(storageManager.loadStateIntoGame).not.toHaveBeenCalled();
  });

  test('loadGame logs error and returns when storageManager.loadGame throws', () => {
    storageManager.loadGame.mockImplementation(() => {
      throw new Error('corrupt');
    });
    game = makeGame();
    controller = new GameController(game);
    (controller as any).loadGame();
    expect(game.log).toHaveBeenCalledWith('❌ Fehler beim Laden: corrupt');
    expect(storageManager.loadStateIntoGame).not.toHaveBeenCalled();
  });

  test('loadGame restores state via loadStateIntoGame on success', () => {
    const fakeState = { board: [], turn: 'white' } as any;
    storageManager.loadGame.mockReturnValue(fakeState);
    storageManager.loadStateIntoGame.mockReturnValue(true);
    game = makeGame();
    controller = new GameController(game);
    (controller as any).loadGame();
    expect(storageManager.loadStateIntoGame).toHaveBeenCalledWith(
      game,
      fakeState
    );
    expect(game.log).toHaveBeenCalledWith('📂 Spielstand geladen.');
  });
});
