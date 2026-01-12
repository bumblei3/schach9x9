import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import { PHASES } from '../../config.js';
import * as UI from '../../ui.js';
import { logger } from '../../logger.js';
import { campaignManager } from '../../campaign/CampaignManager.js';
import { BoardFactory } from '../../campaign/BoardFactory.js';
import { SetupModeStrategy } from './SetupMode.ts'; // Re-use setup logic if possible or composition

export class CampaignModeStrategy implements GameModeStrategy {
  private setupStrategy = new SetupModeStrategy(); // Delegate for 'budget' setup type

  init(game: GameExtended, controller: GameController, initialPoints: number): void {
    // Campaign init is special, often called via startCampaignLevel
    // but if initGame is called with 'campaign' mode, we might be reloading or starting.

    // If we are just initializing via initGame generically:
    if (!game.currentLevelId) {
      logger.warn('CampaignModeStrategy initialized without currentLevelId');
      return;
    }

    // Logic from GameController.startCampaignLevel is largely about SETUP
    // The actual board setup happens there.
    // Here we mostly verify state or handle reload logic if needed.
  }

  // Custom init for campaign level start
  startLevel(game: GameExtended, controller: GameController, levelId: string): void {
    const level = campaignManager.getLevel(levelId);
    if (!level) {
      console.error('Level not found:', levelId);
      return;
    }

    game.campaignMode = true;
    game.currentLevelId = levelId;
    game.points = level.setupType === 'budget' ? level.playerBudget || 0 : 0;

    // Set AI Personality based on level
    if (level.opponentPersonality) {
      game.aiPersonality = level.opponentPersonality;
    }

    // Handle Setup Type
    if (level.setupType === 'fixed') {
      if (level.id === 'level_1') {
        game.board = BoardFactory.createLevel1Board() as any;
      } else if (level.id === 'level_2') {
        game.board = BoardFactory.createLevel2Board() as any;
      } else {
        game.board = BoardFactory.createEmptyBoard() as any; // Fallback
      }

      game.phase = PHASES.PLAY as any;
      controller.startClock();
    } else {
      // Budget mode -> Setup Phase
      game.phase = PHASES.SETUP_WHITE_KING as any;
      controller.showShop(true);
    }

    // UI Updates
    UI.updateStatus(game);
    UI.renderBoard(game);

    logger.info(`Started Campaign Level: ${level.title}`);

    this.showIntroModal(level);
  }

  async handleInteraction(
    game: GameExtended,
    controller: GameController,
    r: number,
    c: number
  ): Promise<boolean> {
    const level = campaignManager.getLevel(game.currentLevelId || '');
    if (level && level.setupType === 'budget') {
      return this.setupStrategy.handleInteraction(game, controller, r, c);
    }

    if (game.phase === (PHASES.PLAY as any)) {
      if (game.handlePlayClick) {
        await game.handlePlayClick(r, c);
        return true;
      }
    }
    return false;
  }

  onPhaseEnd(game: GameExtended, controller: GameController): void {
    const level = campaignManager.getLevel(game.currentLevelId || '');
    if (level && level.setupType === 'budget') {
      this.setupStrategy.onPhaseEnd(game, controller);
    }
  }

  private showIntroModal(level: any): void {
    const desc = `
      <div class="campaign-intro">
        <p style="font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.6;">${level.description}</p>
        <div class="campaign-goals-box" style="background: rgba(49, 196, 141, 0.1); border: 1px solid rgba(49, 196, 141, 0.3); border-radius: 8px; padding: 1rem;">
          <h4 style="margin-top: 0; color: var(--accent-success); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🎯</span> Missionsziele
          </h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
            <li style="display: flex; align-items: center; gap: 10px;">
              <span style="color: gold; font-size: 1.2rem;">⭐</span> <span>${level.winCondition === 'checkmate' ? 'Setze den Gegner Matt' : 'Besiege den Gegner'}</span>
            </li>
          </ul>
        </div>
      </div>
    `;

    UI.showModal(level.title, desc, [
      { text: 'Mission starten', class: 'btn-primary', callback: () => {} },
    ]);
  }
}
