import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import { PHASES, AI_DELAY_MS } from '../../config.js';
import * as UI from '../../ui.js';
import { soundManager } from '../../sounds.js';
import { logger } from '../../logger.js';

export class SetupModeStrategy implements GameModeStrategy {
  init(game: GameExtended, controller: GameController, initialPoints: number): void {
    if (game.mode === 'upgrade' || game.mode === 'upgrade8x8') {
      game.phase = PHASES.SETUP_WHITE_UPGRADES as any;
    } else {
      game.phase = PHASES.SETUP_WHITE_KING as any;
    }
    game.points = initialPoints;

    // Initialize UI
    UI.updateStatus(game);
    UI.updateShopUI(game);
    // Show shop for Setup Mode
    controller.showShop(true);

    // Render board to show corridor highlighting
    UI.renderBoard(game);

    logger.info('SetupModeStrategy initialized with', initialPoints, 'points');
  }

  async handleInteraction(
    game: GameExtended,
    controller: GameController,
    r: number,
    c: number
  ): Promise<boolean> {
    if (game.phase === (PHASES.SETUP_WHITE_KING as any)) {
      console.log('[SetupMode] Placing King');
      controller.placeKing(r, c, 'white');
      return true;
    } else if (game.phase === (PHASES.SETUP_BLACK_KING as any)) {
      controller.placeKing(r, c, 'black');
      return true;
    } else if (
      game.phase === (PHASES.SETUP_WHITE_PIECES as any) ||
      game.phase === (PHASES.SETUP_BLACK_PIECES as any)
    ) {
      controller.placeShopPiece(r, c);
      return true;
    } else if (
      game.phase === (PHASES.SETUP_WHITE_UPGRADES as any) ||
      game.phase === (PHASES.SETUP_BLACK_UPGRADES as any)
    ) {
      controller.upgradePiece(r, c);
      return true;
    }

    // If we reach here, it might be PLAY or ANALYSIS which are handled generally,
    // or this strategy doesn't handle it.
    // For Setup Mode, once we hit PLAY, we treat it as standard gameplay interaction.
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
      if (game.phase === (PHASES.SETUP_WHITE_PIECES as any)) {
        game.phase = PHASES.SETUP_WHITE_UPGRADES as any;
        game.selectedShopPiece = null;
        controller.updateShopUI();
        game.log('Weiß: Truppen-Upgrades möglich.');
      } else if (game.phase === (PHASES.SETUP_WHITE_UPGRADES as any)) {
        // Setup Mode Transition
        if (game.mode === 'upgrade' || game.mode === 'upgrade8x8') {
          game.phase = PHASES.SETUP_BLACK_UPGRADES as any;
          game.points = game.initialPoints;
          // AI trigger
          if (game.isAI) {
            setTimeout(() => {
              if ((game as any).aiSetupUpgrades) (game as any).aiSetupUpgrades();
              controller.finishSetupPhase();
            }, 1000);
          }
          game.log('Weiß fertig. Schwarz rüstet auf.');
        } else {
          game.phase = PHASES.SETUP_BLACK_PIECES as any;
          game.points = game.initialPoints;
          game.selectedShopPiece = null;
          controller.updateShopUI();
          game.log('Weiß fertig. Schwarz kauft ein.');

          controller.autoSave();

          if (game.isAI) {
            setTimeout(() => {
              if (game.aiSetupPieces) game.aiSetupPieces();
            }, AI_DELAY_MS);
          }
        }
      } else if (game.phase === (PHASES.SETUP_BLACK_PIECES as any)) {
        game.phase = PHASES.SETUP_BLACK_UPGRADES as any;
        game.selectedShopPiece = null;
        controller.updateShopUI();
        game.log('Schwarz: Truppen-Upgrades möglich.');

        if (game.isAI) {
          // AI Upgrades
          setTimeout(() => {
            if ((game as any).aiSetupUpgrades) (game as any).aiSetupUpgrades();
            controller.finishSetupPhase();
          }, 1000); // Give it a moment
        }
      } else if (game.phase === (PHASES.SETUP_BLACK_UPGRADES as any)) {
        this.startGame(game, controller);
      }
      UI.updateStatus(game);
      UI.renderBoard(game);
    };

    // Handle "Unused Points" modal logic (moved from GameController)
    if (game.points > 0) {
      // Don't warn AI if it's their turn to finish setup
      const isAIBlackSetup =
        game.isAI &&
        (game.phase === (PHASES.SETUP_BLACK_PIECES as any) ||
          game.phase === (PHASES.SETUP_BLACK_UPGRADES as any));

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

    // Track game start time for statistics
    controller.gameStartTime = Date.now();

    document.querySelectorAll('.cell.selectable-corridor').forEach(cell => {
      cell.classList.remove('selectable-corridor');
    });
    logger.debug('Removed all corridor highlighting for PLAY phase');

    // Ensure Action Bar is visible
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) actionBar.classList.remove('hidden');

    game.log('Spiel beginnt! Weiß ist am Zug.');
    if (game.updateBestMoves) game.updateBestMoves();
    controller.startClock();
    UI.updateStatistics(game);
    soundManager.playGameStart();
    controller.autoSave();
  }
}
