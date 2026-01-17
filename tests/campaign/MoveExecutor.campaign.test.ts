import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeMove } from '../../js/move/MoveExecutor';
import { Game } from '../../js/gameEngine';
import { campaignManager } from '../../js/campaign/CampaignManager';
import { notificationUI } from '../../js/ui/NotificationUI';

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
    expect(notificationUI.show).toHaveBeenCalledWith(
      expect.stringContaining('XP'),
      'success',
      'Erfahrung'
    );
  });

  it('should apply Veteran talent bonus (+20% XP)', async () => {
    // Setup: Veteran Pawn captures
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'p_veteran'
    );

    game.board[4][4] = { type: 'p', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    // Default 10 + 2 bonus = 12
    expect(campaignManager.addUnitXp).toHaveBeenCalledWith('p', 12);
  });

  it('should apply Scavenger talent bonus (Gold on capture)', async () => {
    // Setup: Scavenger Pawn captures
    (campaignManager.isTalentUnlocked as any).mockImplementation(
      (id: string) => id === 'p_scavenger'
    );

    game.board[4][4] = { type: 'p', color: 'white' };
    game.board[3][3] = { type: 'p', color: 'black' };

    await executeMove(game, moveController, { r: 4, c: 4 }, { r: 3, c: 3 });

    expect(campaignManager.addGold).toHaveBeenCalled();
    expect(notificationUI.show).toHaveBeenCalledWith(
      expect.stringContaining('Gold'),
      'success',
      'Talent'
    );
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
      (_g: any, _r: number, _c: number, _color: string, _rec: any, callback: Function) => {
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
      expect.stringContaining('LEVEL UP'),
      'success',
      'Aufstieg',
      5000
    );
  });
});
