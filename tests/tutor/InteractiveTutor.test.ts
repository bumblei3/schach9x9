import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from '../../js/gameController';
import { Game } from '../../js/gameEngine';
import { PHASES } from '../../js/gameEngine';
import { notificationUI } from '../../js/ui/NotificationUI';

// Mock UI dependencies
vi.mock('../../js/ui/NotificationUI', () => ({
  notificationUI: {
    show: vi.fn(),
  },
}));

vi.mock('../../js/arrows', () => ({
  ArrowRenderer: vi.fn().mockImplementation(() => ({
    clearArrows: vi.fn(),
    addArrow: vi.fn(),
  })),
}));

describe('Interactive Tutor', () => {
  let game: any;
  let gameController: GameController;
  let aiControllerMock: any;

  beforeEach(() => {
    game = new Game(0, 'setup');
    game.phase = PHASES.PLAY;
    game.turn = 'white';
    game.playerColor = 'white';
    game.isAI = true;
    game.arrowRenderer = {
      clearArrows: vi.fn(),
      addArrow: vi.fn(),
    };

    gameController = new GameController(game);

    // Mock AI Controller
    aiControllerMock = {
      getHint: vi.fn(),
    };
    game.aiController = aiControllerMock;
  });

  it('should show notification if not player turn', async () => {
    game.turn = 'black';
    await gameController.requestHint();
    expect(notificationUI.show).toHaveBeenCalledWith(
      'Tipps sind nur verfügbar, wenn du am Zug bist.',
      'info'
    );
  });

  it('should request hint from AIController if it is player turn', async () => {
    aiControllerMock.getHint.mockResolvedValue({
      move: { from: { r: 1, c: 1 }, to: { r: 2, c: 1 } },
      explanation: 'Guter Zug',
    });

    await gameController.requestHint();

    expect(notificationUI.show).toHaveBeenCalledWith(
      'Der Tutor analysiert die Stellung...',
      'info'
    );
    expect(aiControllerMock.getHint).toHaveBeenCalled();
  });

  it('should visualize the hint arrow and show explanation', async () => {
    aiControllerMock.getHint.mockResolvedValue({
      move: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } },
      explanation: 'Kontrolliert das Zentrum.',
    });

    await gameController.requestHint();

    expect(game.arrowRenderer.clearArrows).toHaveBeenCalled();
    expect(game.arrowRenderer.addArrow).toHaveBeenCalledWith(
      { r: 6, c: 4 },
      { r: 4, c: 4 },
      '#facc15'
    );
    expect(notificationUI.show).toHaveBeenCalledWith(
      'Tipp: Kontrolliert das Zentrum.',
      'success',
      'Tutor',
      5000
    );
  });

  it('should handle case where no hint is found', async () => {
    aiControllerMock.getHint.mockResolvedValue(null);

    await gameController.requestHint();

    expect(notificationUI.show).toHaveBeenCalledWith(
      'Der Tutor konnte keinen klaren Rat finden.',
      'info'
    );
  });
});
