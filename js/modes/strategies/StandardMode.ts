import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import { PHASES } from '../../config.js';
import * as UI from '../../ui.js';
import { soundManager } from '../../sounds.js';
import { logger } from '../../logger.js';

export class StandardModeStrategy implements GameModeStrategy {
  init(game: GameExtended, controller: GameController, initialPoints: number): void {
    game.setupStandard8x8Board();

    if (initialPoints > 0) {
      game.phase = PHASES.SETUP_WHITE_UPGRADES as any;
      UI.updateShopUI(game);
      controller.showShop(true);
      // Ensure UI updates happen
      UI.updateStatus(game);
      UI.renderBoard(game);
    } else {
      game.phase = PHASES.PLAY as any;
      this.startGame(game, controller);
    }

    logger.info('StandardModeStrategy initialized with', initialPoints, 'points');
  }

  async handleInteraction(
    game: GameExtended,
    controller: GameController,
    r: number,
    c: number
  ): Promise<boolean> {
    if (
      game.phase === (PHASES.SETUP_WHITE_UPGRADES as any) ||
      game.phase === (PHASES.SETUP_BLACK_UPGRADES as any)
    ) {
      controller.upgradePiece(r, c);
      return true;
    }

    if (game.phase === (PHASES.PLAY as any) || (game.phase as any) === 'ANALYSIS') {
      if (game.handlePlayClick) {
        await game.handlePlayClick(r, c);
        return true;
      }
    }
    return false;
  }

  onPhaseEnd(game: GameExtended, controller: GameController): void {
    const handleTransition = () => {
      if (game.phase === (PHASES.SETUP_WHITE_UPGRADES as any)) {
        game.phase = PHASES.SETUP_BLACK_UPGRADES as any;
        game.points = game.initialPoints;
        game.log('Weiß fertig. Schwarz: Truppen-Upgrades möglich.');

        if (game.isAI) {
          setTimeout(() => controller.finishSetupPhase(), 500);
        }
        controller.autoSave();
      } else if (game.phase === (PHASES.SETUP_BLACK_UPGRADES as any)) {
        this.startGame(game, controller);
      }
      UI.updateStatus(game);
      UI.renderBoard(game);
    };

    if (game.points > 0) {
      const isAIBlackSetup = game.isAI && game.phase === (PHASES.SETUP_BLACK_UPGRADES as any);

      if (isAIBlackSetup) {
        handleTransition();
        return;
      }

      UI.showModal(
        'Ungenutzte Punkte',
        `Du hast noch ${game.points} Punkte übrig! Möchtest du wirklich fortfahren?`,
        [
          { text: 'Abbrechen', class: 'btn-secondary', callback: () => {} },
          { text: 'Fortfahren', class: 'btn-primary', callback: handleTransition },
        ]
      );
      return;
    }

    handleTransition();
  }

  private startGame(game: GameExtended, controller: GameController): void {
    game.phase = PHASES.PLAY as any;
    controller.showShop(false);
    controller.gameStartTime = Date.now();

    // Ensure Action Bar is visible
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) actionBar.classList.remove('hidden');

    game.log('Spiel beginnt! Weiß ist am Zug.');
    if (game.updateBestMoves) game.updateBestMoves();
    controller.startClock();
    UI.updateStatistics(game);
    soundManager.playGameStart();
    controller.autoSave();

    // Show game controls immediately (if not already handled)
    const infoTabsContainer = document.getElementById('info-tabs-container');
    if (infoTabsContainer) infoTabsContainer.classList.remove('hidden');

    const quickActions = document.getElementById('quick-actions');
    if (quickActions) quickActions.classList.remove('hidden');

    UI.updateStatus(game);
    UI.renderBoard(game);
  }
}
