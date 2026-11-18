import type { GameModeStrategy } from '../GameModeStrategy.js';
import type { GameExtended, GameController } from '../../gameController.js';
import type { Player } from '../../types/core.js';
import type { PieceWithMoved } from '../../gameEngine.js';
import { PHASES } from '../../config.js';
import * as UI from '../../ui.js';
import { logger } from '../../logger.js';
import { campaignManager } from '../../campaign/CampaignManager.js';
import { campaignLevelDescription } from '../../campaign/campaignData.js';
import { BoardFactory } from '../../campaign/BoardFactory.js';
import { SetupModeStrategy } from './SetupMode.js'; // Re-use setup logic if possible or composition
import { hiringBudget } from '../../campaign/hiringBudget.js';
import { offerTaktikGenieTip } from '../../campaign/taktikGenie.js';
import { placePlundererPawn } from '../../campaign/plunderer.js';
import { placeSprungfederKnight } from '../../campaign/sprungfeder.js';
import type { Level } from '../../campaign/types.js';

export class CampaignModeStrategy implements GameModeStrategy {
  private setupStrategy = new SetupModeStrategy(); // Delegate for 'budget' setup type

  init(game: GameExtended, _controller: GameController, _initialPoints: number): void {
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
    let budget = 0;
    let budgetText = '';
    if (level.setupType === 'budget') {
      const base = level.playerBudget || 0;
      const elite = campaignManager.isPerkUnlocked('elite_garde');
      const taktiker = campaignManager.isTalentUnlocked('n_taktiker');
      const hire = hiringBudget(base, elite, taktiker);
      budget = hire.total;
      budgetText = hire.label;
      if (elite) logger.info('[Campaign] Elite-Garde Perk applied: +10 Budget');
      if (taktiker) logger.info('[Campaign] Taktiker applied: +5 Budget');
    }

    game.points = budget;
    game.initialPoints = budget;

    // Set AI Personality based on level
    if (level.opponentPersonality) {
      game.aiPersonality = level.opponentPersonality;
    }

    // Set Player Color
    game.playerColor = level.playerColor as Player;

    // Handle Setup Type
    if (level.fen) {
      game.board = BoardFactory.fromFEN(level.fen) as (PieceWithMoved | null)[][];
      if (game.board.length !== game.boardSize) {
        game.boardSize = game.board.length;
      }
    } else {
      game.board = BoardFactory.createEmptyBoard() as (PieceWithMoved | null)[][];
    }

    let plundererNote = '';
    if (level.setupType === 'budget' && campaignManager.isTalentUnlocked('p_scavenger')) {
      if (placePlundererPawn(game.board)) {
        plundererNote +=
          '<p class="plunderer-note" style="font-size: 0.95rem; color: #4ecdc4; margin-bottom: 1rem;">Plünderer stellt einen Extra-Bauern aufs Feld.</p>';
      }
    }
    if (level.setupType === 'budget' && campaignManager.isTalentUnlocked('n_sprungfeder')) {
      if (placeSprungfederKnight(game.board)) {
        plundererNote +=
          '<p class="sprungfeder-note" style="font-size: 0.95rem; color: #93c5fd; margin-bottom: 1rem;">Sprungfeder stellt einen Extra-Springer aufs Feld.</p>';
      }
    }
    if (level.setupType === 'budget' && campaignManager.isTalentUnlocked('r_festung')) {
      plundererNote +=
        '<p class="festung-note" style="font-size: 0.95rem; color: #fbbf24; margin-bottom: 1rem;">Festung: der Turm kostet 3 Punkte.</p>';
    }
    if (level.setupType === 'budget' && campaignManager.isTalentUnlocked('q_majestaet')) {
      plundererNote +=
        '<p class="majestaet-note" style="font-size: 0.95rem; color: #f0abfc; margin-bottom: 1rem;">Majestät: die Dame kostet 7 Punkte.</p>';
    }

    if (level.setupType === 'fixed') {
      game.phase = PHASES.PLAY;
      game.captureInitialBoard();
      controller.startClock();
    } else {
      // Budget mode -> Setup Phase
      game.phase = PHASES.SETUP_WHITE_KING;
      controller.showShop(true);
    }

    // UI Updates
    UI.initBoardUI(game);
    UI.updateStatus(game);
    UI.renderBoard(game);

    logger.info(`Started Campaign Level: ${level.title}`);

    this.showIntroModal(level, controller, budgetText, plundererNote);

    // Update Opponent Name in UI
    const opponentNameEl = document.getElementById('opponent-name');
    if (opponentNameEl && level.opponentName) {
      opponentNameEl.textContent = level.opponentName;
    }
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

    if (game.phase === PHASES.PLAY) {
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

  private showIntroModal(
    level: Level,
    controller: GameController,
    budgetText = '',
    plundererNote = ''
  ): void {
    const budgetNote = budgetText
      ? `<p class="campaign-budget" style="font-size: 1.05rem; color: #ffd700; font-weight: bold; margin-bottom: 1rem;">${budgetText}</p>`
      : '';
    const tipNote = campaignManager.isPerkUnlocked('taktik_genie')
      ? '<p class="taktik-genie-note" style="font-size: 0.95rem; color: #c4b5fd; margin-bottom: 1rem;">Taktik-Genie zeigt einmal den besten Zug, sobald die Mission läuft.</p>'
      : '';
    const desc = `
      <div class="campaign-intro">
        <p style="font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.6;">${campaignLevelDescription(level)}</p>
        ${budgetNote}
        ${plundererNote}
        ${tipNote}
        <div class="campaign-goals-box" style="background: rgba(49, 196, 141, 0.1); border: 1px solid rgba(49, 196, 141, 0.3); border-radius: 8px; padding: 1rem;">
          <h4 style="margin-top: 0; color: var(--accent-success); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2rem;">🎯</span> Missionsziele
          </h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
            <li style="display: flex; align-items: center; gap: 10px;">
              <span style="color: gold; font-size: 1.2rem;">⭐</span> <span>${level.winCondition.type === 'checkmate' ? 'Setze den Gegner Matt' : 'Besiege den Gegner'}</span>
            </li>
          </ul>
        </div>
      </div>
    `;

    UI.showModal(level.title, desc, [
      {
        text: 'Mission starten',
        class: 'btn-primary',
        callback: () => {
          if (level.setupType === 'fixed') offerTaktikGenieTip(controller);
        },
      },
    ]);
  }
}
