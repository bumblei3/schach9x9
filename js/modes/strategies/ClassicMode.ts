import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import { PHASES } from '../../config.js';
import * as UI from '../../ui.js';
import { logger } from '../../logger.js';

export class ClassicModeStrategy implements GameModeStrategy {
  init(game: GameExtended, controller: GameController): void {
    game.phase = PHASES.PLAY as any;
    game.setupClassicBoard();

    // Show game controls immediately
    const infoTabsContainer = document.getElementById('info-tabs-container');
    if (infoTabsContainer) infoTabsContainer.classList.remove('hidden');

    const quickActions = document.getElementById('quick-actions');
    if (quickActions) quickActions.classList.remove('hidden');

    this.startGame(game, controller);

    logger.info('ClassicModeStrategy initialized');
  }

  async handleInteraction(
    game: GameExtended,
    controller: GameController,
    r: number,
    c: number
  ): Promise<boolean> {
    if (game.phase === (PHASES.PLAY as any) || (game.phase as any) === 'ANALYSIS') {
      if (game.handlePlayClick) {
        await game.handlePlayClick(r, c);
        return true;
      }
    }
    return false;
  }

  onPhaseEnd(game: GameExtended, controller: GameController): void {
    // Classic mode usually doesn't have explicit phase ends like setup,
    // but if we add features later, we can handle them here.
  }

  private startGame(game: GameExtended, controller: GameController): void {
    controller.gameStartTime = Date.now();
    controller.startClock();
    UI.updateStatistics(game);
    UI.updateClockUI(game);
    UI.updateClockDisplay(game);
    UI.renderBoard(game);

    // Initialize Arrow Renderer if needed (usually handled in initGame common logic, but good to ensure)
    // controller.initArrowRenderer() // If we move that method
  }
}
