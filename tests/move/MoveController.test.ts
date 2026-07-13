import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---------------------------------------------------------------

// campaignManager is used only by getMaterialValue(); mock its XP/champion API.
const campaignMock = {
  getUnitXp: vi.fn(() => ({ xp: 0, level: 1, captures: 0 })),
  getChampion: vi.fn(() => null),
};
vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: campaignMock,
}));

// UI + BoardRenderer are rendering-only; stub them so no DOM is touched.
vi.mock('../../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showPromotionUI: vi.fn(),
}));

// --- Imports (top-level; esm) -------------------------------------------
const ui = await import('../../js/ui.js');
const { MoveController } = await import('../../js/moveController.js');

// --- Minimal Game stub --------------------------------------------------
type AnyGame = Record<string, any>;

function makeGame(over: Partial<AnyGame> = {}): AnyGame {
  const board = Array.from({ length: 9 }, () => new Array(9).fill(0));
  return {
    board,
    boardSize: 9,
    turn: 'white',
    phase: 'PLAY',
    mode: 'classic',
    playerColor: 'white',
    moveHistory: [] as AnyGame[],
    redoStack: [] as AnyGame[],
    selectedSquare: null,
    validMoves: null,
    selectedShopPiece: null,
    isAI: false,
    kiMentorEnabled: false,
    stats: { playerMoves: 0, playerBestMoves: 0, captures: 0, promotions: 0 },
    getValidMoves: (_r: number, _c: number, _p: any) => [{ r: _r + 1, c: _c }],
    isTutorMove: undefined,
    tutorController: undefined,
    gameController: undefined,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  campaignMock.getUnitXp.mockReturnValue({ xp: 0, level: 1, captures: 0 });
  campaignMock.getChampion.mockReturnValue(null);
});

// --- getMaterialValue (pure campaign RPG bonus logic) ------------------
// In the app, Piece.type is a letter ('r','p',...) and Piece.color is
// 'white'/'black' (see gameEngine Piece interface / setup arrays).
describe('MoveController.getMaterialValue', () => {
  test('returns 0 for a null piece', () => {
    const game = makeGame();
    const mc = new MoveController(game as any);
    expect(mc.getMaterialValue(null)).toBe(0);
  });

  test('non-campaign mode uses the base piece value (no bonus)', () => {
    const game = makeGame({ mode: 'classic' });
    const mc = new MoveController(game as any);
    const base = mc.getMaterialValue({ type: 'r', color: 'white' } as any);
    expect(base).toBeGreaterThan(0);
    // With no campaign bonus, a level-1 player rook equals the base value.
    const baseRef = mc.getMaterialValue({ type: 'r', color: 'white' } as any);
    expect(base).toBe(baseRef);
  });

  test('campaign mode adds +10% per level above 1 for the player color', () => {
    const game = makeGame({ mode: 'campaign', playerColor: 'white' });
    const mc = new MoveController(game as any);

    const base = mc.getMaterialValue({ type: 'r', color: 'white' } as any);

    campaignMock.getUnitXp.mockReturnValue({ xp: 100, level: 3, captures: 0 });
    const leveled = mc.getMaterialValue({ type: 'r', color: 'white' } as any);

    // level 3 => +20% over base
    expect(leveled).toBeCloseTo(base * 1.2, 5);
    expect(leveled).toBeGreaterThan(base);
  });

  test('campaign mode does NOT apply the XP bonus to the opponent color', () => {
    const game = makeGame({ mode: 'campaign', playerColor: 'white' });
    const mc = new MoveController(game as any);

    const base = mc.getMaterialValue({ type: 'r', color: 'black' } as any);
    campaignMock.getUnitXp.mockReturnValue({ xp: 999, level: 9, captures: 0 });
    const leveledOpponent = mc.getMaterialValue({ type: 'r', color: 'black' } as any);

    // Opponent pieces never get the campaign bonus.
    expect(leveledOpponent).toBe(base);
  });

  test('campaign champion piece gets a flat +0.5 hero bonus', () => {
    const game = makeGame({ mode: 'campaign', playerColor: 'white' });
    const mc = new MoveController(game as any);

    const base = mc.getMaterialValue({ type: 'r', color: 'white' } as any);
    campaignMock.getChampion.mockReturnValue('r'); // 'r' == rook type
    const champion = mc.getMaterialValue({ type: 'r', color: 'white' } as any);

    expect(champion).toBeCloseTo(base + 0.5, 5);
  });
});

// --- handlePlayClick (central click-decision logic) ---------------------
describe('MoveController.handlePlayClick', () => {
  test('clicking your own piece selects it and renders valid moves', async () => {
    const game = makeGame();
    game.board[8][4] = { type: 'p', color: 'white' };
    const mc = new MoveController(game as any);

    await mc.handlePlayClick(8, 4);

    expect(game.selectedSquare).toEqual({ r: 8, c: 4 });
    expect(game.validMoves).toEqual([{ r: 9, c: 4 }]);
    expect(ui.renderBoard).toHaveBeenCalledWith(game);
  });

  test('clicking an empty square after a selection deselects', async () => {
    const game = makeGame();
    game.board[8][4] = { type: 'p', color: 'white' };
    const mc = new MoveController(game as any);

    await mc.handlePlayClick(8, 4); // select own pawn
    expect(game.selectedSquare).not.toBeNull();

    await mc.handlePlayClick(0, 0); // empty square, not a valid move
    expect(game.selectedSquare).toBeNull();
    expect(game.validMoves).toBeNull();
  });

  test('clicking an enemy piece shows its threats (selects without moving)', async () => {
    const game = makeGame();
    // turn is white; place a white pawn and a black piece (no capture match)
    game.board[8][4] = { type: 'p', color: 'white' };
    game.board[0][0] = { type: 'r', color: 'black' };
    const mc = new MoveController(game as any);

    await mc.handlePlayClick(0, 0); // enemy piece, not currently selected-own move target

    expect(game.selectedSquare).toEqual({ r: 0, c: 0 });
    expect(ui.renderBoard).toHaveBeenCalled();
  });
});

// --- redoMove / updateUndoRedoButtons (guards + button state) -----------
describe('MoveController.redoMove', () => {
  test('returns early when the redo stack is empty (no move executed)', async () => {
    const game = makeGame({ phase: 'PLAY' });
    game.redoStack = [];
    const executeSpy = vi.spyOn(MoveController.prototype, 'executeMove');
    const mc = new MoveController(game as any);

    await mc.redoMove();

    expect(executeSpy).not.toHaveBeenCalled();
    expect(game.selectedSquare).toBeNull();
  });
});

describe('MoveController.updateUndoRedoButtons', () => {
  test('disables undo/redo buttons when there is no history / empty redo stack', () => {
    const game = makeGame({ phase: 'PLAY', moveHistory: [], redoStack: [] });
    const undoBtn = { disabled: false, textContent: '' } as any;
    const redoBtn = { disabled: false, textContent: '' } as any;
    vi.stubGlobal(
      'document',
      new Proxy(
        {},
        {
          get: (_t, id) => {
            if (id === 'getElementById') {
              return (sel: string) =>
                sel === 'undo-btn' ? undoBtn : sel === 'redo-btn' ? redoBtn : null;
            }
            return undefined;
          },
        }
      )
    );
    const mc = new MoveController(game as any);
    mc.updateUndoRedoButtons();

    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
    vi.unstubAllGlobals();
  });

  test('enables undo when history exists and game is in PLAY phase', () => {
    const game = makeGame({
      phase: 'PLAY',
      moveHistory: [{ from: { r: 8, c: 4 }, to: { r: 7, c: 4 } } as any],
      redoStack: [],
    });
    const undoBtn = { disabled: true, textContent: '' } as any;
    const redoBtn = { disabled: true, textContent: '' } as any;
    vi.stubGlobal(
      'document',
      new Proxy(
        {},
        {
          get: (_t, id) => {
            if (id === 'getElementById') {
              return (sel: string) =>
                sel === 'undo-btn' ? undoBtn : sel === 'redo-btn' ? redoBtn : null;
            }
            return undefined;
          },
        }
      )
    );
    const mc = new MoveController(game as any);
    mc.updateUndoRedoButtons();

    expect(undoBtn.disabled).toBe(false);
    expect(undoBtn.textContent).toContain('1');
    vi.unstubAllGlobals();
  });
});
