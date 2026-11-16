import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeMove } from '../../js/move/MoveExecutor';
import { Game } from '../../js/gameEngine';
import { campaignManager } from '../../js/campaign/CampaignManager';
import { notificationUI } from '../../js/ui/NotificationUI';
import { UNIT_TALENT_TREES } from '../../js/campaign/talents';

// Mock dependencies
vi.mock('../../js/campaign/CampaignManager', () => ({
  campaignManager: {
    isTalentUnlocked: vi.fn(),
    addGold: vi.fn(),
    getUnitXp: vi.fn(),
    addUnitXp: vi.fn(),
  },
}));

vi.mock('../../js/ui/NotificationUI', () => ({
  notificationUI: {
    show: vi.fn(),
  },
}));

vi.mock('../../js/ui', () => ({
  renderBoard: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  updateCapturedUI: vi.fn(),
  updateStatus: vi.fn(),
  updateStatistics: vi.fn(),
  renderEvalGraph: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  flashSquare: vi.fn(),
  showPromotionUI: vi.fn(),
}));

vi.mock('../../js/sounds', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

vi.mock('../../js/aiEngine', () => ({
  evaluatePosition: vi.fn().mockReturnValue(0),
}));

describe('MoveExecutor - Campaign Mechanics', () => {
  let game: any;
  let moveController: any;

  beforeEach(() => {
    vi.clearAllMocks();

    game = new Game();
    game.campaignMode = true;
    game.playerColor = 'white';
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    game.stats = { captures: 0, promotions: 0, totalMoves: 0 };
    game.capturedPieces = { white: [], black: [] };
    game.moveHistory = [];
    game.turn = 'white';
    game.positionHistory = [];

    moveController = {
      updateUndoRedoButtons: vi.fn(),
    };

    // Default mocks
    (campaignManager.getUnitXp as any).mockReturnValue({ level: 1 });
    (campaignManager.isTalentUnlocked as any).mockReturnValue(false);
  });

  it('should award XP for capturing a piece', async () => {
    // Setup: White Pawn captures Black Pawn
    game.board[4][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('p', 10);
    expect(campaignManager.addGold).not.toHaveBeenCalled();
    expect(notificationUI.show).toHaveBeenCalledWith(
      expect.stringContaining('XP'),
      'success',
      'Erfahrung'
    );
  });

  it('should apply Veteran talent bonus (+5 XP)', async () => {
    // Setup: Veteran Pawn captures
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'p_veteran'
    );

    game.board[4][4] = { type: 'p', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    // Default 10 + 5 bonus = 15
    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('p', 15);
    expect(notificationUI.show).toHaveBeenCalledWith(
      '+15 XP für deinen Bauern (Veteran +5)',
      'success',
      'Erfahrung'
    );
  });

  it('names Taktiker on the gold notice', async () => {
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'n_taktiker'
    );

    game.board[4][4] = { type: 'n', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(campaignManager.addGold).toHaveBeenCalledWith(2);
    expect(notificationUI.show).toHaveBeenCalledWith('Taktiker: +2 Gold', 'success', 'Talent');
  });

  it('names Sprungfeder on the XP line', async () => {
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'n_sprungfeder'
    );

    game.board[4][4] = { type: 'n', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('n', 15);
    expect(notificationUI.show).toHaveBeenCalledWith(
      '+15 XP für deinen Springer (Sprungfeder +5)',
      'success',
      'Erfahrung'
    );
  });

  it('does not pay gold when Plünderer only grants a hiring pawn', async () => {
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'p_scavenger'
    );

    game.board[4][4] = { type: 'p', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(campaignManager.addGold).not.toHaveBeenCalled();
    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('p', 10);
  });

  it('should NOT award XP if not player piece', async () => {
    // Setup: Black (AI) captures White
    game.turn = 'black';
    game.board[3][3] = { type: 'p', color: 'black' };
    game.board[4][4] = { type: 'p', color: 'white' };

    await executeMove(game, moveController, { r: 3, c: 3 }, { r: 4, c: 4 });

    expect(campaignManager.addUnitXp).not.toHaveBeenCalled();
  });

  it('should award XP for promotion', async () => {
    // Setup: White Pawn promotes
    game.board[1][0] = { type: 'p', color: 'white' };

    // Mock showPromotionUI to trigger callback immediately
    const uiModule = await import('../../js/ui');
    (uiModule.showPromotionUI as any).mockImplementation(
      (_g: any, _r: number, _c: number, _color: string, _rec: any, callback: () => void) => {
        // Callback simulates user selecting a piece
        _rec.promotion = 'q';
        // Simulate the UI/User actually changing the piece on board
        game.board[0][0] = { type: 'q', color: 'white' };
        callback();
      }
    );

    // Execute without pre-determined type to trigger UI path
    await executeMove(game, moveController, { r: 1, c: 0 }, { r: 0, c: 0 });

    // 50 XP for promotion
    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('p', 50);
    expect(notificationUI.show).toHaveBeenCalledWith(
      expect.stringContaining('Beförderungs-Bonus'),
      'success',
      'Held'
    );
  });

  it('should handle Level Up notification', async () => {
    // Mock getUnitXp to show level increase
    (campaignManager.getUnitXp as any)
      .mockReturnValueOnce({ level: 1 }) // Before
      .mockReturnValueOnce({ level: 2 }); // After

    game.board[4][4] = { type: 'p', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(notificationUI.show).toHaveBeenCalledWith(
      'LEVEL UP! Dein Bauer ist jetzt Stufe 2!',
      'success',
      'Aufstieg',
      5000
    );
  });

  it('names the bishop on the XP line', async () => {
    game.board[4][4] = { type: 'b', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(notificationUI.show).toHaveBeenCalledWith(
      '+10 XP für deinen Läufer',
      'success',
      'Erfahrung'
    );
  });

  it('names the queen with deine on the XP line and Deine on level up', async () => {
    (campaignManager.getUnitXp as any)
      .mockReturnValueOnce({ level: 1 })
      .mockReturnValueOnce({ level: 2 });

    game.board[4][4] = { type: 'q', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(notificationUI.show).toHaveBeenCalledWith('+10 XP für deine Dame', 'success', 'Erfahrung');
    expect(notificationUI.show).toHaveBeenCalledWith(
      'LEVEL UP! Deine Dame ist jetzt Stufe 2!',
      'success',
      'Aufstieg',
      5000
    );
  });
});

const PERCENT_XP = new Set(['n_meister', 'q_omnipraesenz']);

const talentCases = Object.values(UNIT_TALENT_TREES).flatMap(tree =>
  tree.talents.map(talent => ({
    id: talent.id,
    unit: tree.unitType,
    effectType: talent.effectType,
    effectValue: talent.effectValue ?? 0,
  }))
);

describe('every talent id is applied on capture', () => {
  let game: any;
  let moveController: any;

  beforeEach(() => {
    vi.clearAllMocks();
    game = new Game();
    game.campaignMode = true;
    game.playerColor = 'white';
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    game.stats = { captures: 0, promotions: 0, totalMoves: 0 };
    game.capturedPieces = { white: [], black: [] };
    game.moveHistory = [];
    game.turn = 'white';
    game.positionHistory = [];
    moveController = { updateUndoRedoButtons: vi.fn() };
    (campaignManager.getUnitXp as any).mockReturnValue({ level: 1 });
  });

  it.each(talentCases)(
    '$id applies effectValue $effectValue',
    async ({ id, unit, effectType, effectValue }) => {
      (campaignManager.isTalentUnlocked as any).mockImplementation((tid: string) => tid === id);
      game.board[4][4] = { type: unit, color: 'white', hasMoved: false };
      game.board[3][3] = { type: 'p', color: 'black' };

      await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

      if (effectType === 'passive_gold') {
        expect(campaignManager.addGold).toHaveBeenCalledWith(effectValue);
        expect(campaignManager.addUnitXp).toHaveBeenCalledWith(unit, 10);
      } else if (PERCENT_XP.has(id)) {
        expect(campaignManager.addGold).not.toHaveBeenCalled();
        expect(campaignManager.addUnitXp).toHaveBeenCalledWith(
          unit,
          Math.round(10 * (1 + effectValue / 100))
        );
      } else if (effectType === 'stat_boost') {
        expect(campaignManager.addGold).not.toHaveBeenCalled();
        expect(campaignManager.addUnitXp).toHaveBeenCalledWith(unit, 10 + effectValue);
      } else {
        expect(campaignManager.addGold).not.toHaveBeenCalled();
        expect(campaignManager.addUnitXp).toHaveBeenCalledWith(unit, 10);
      }
    }
  );
});
