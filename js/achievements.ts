/**
 * Achievement Manager for Schach 9x9
 * Tracks and unlocks achievements based on game statistics.
 */

import { logger } from './logger.js';
import { statisticsManager } from './statisticsManager.js';
import { showToast } from './ui/OverlayManager.js';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress?: number; // current progress
  target?: number; // needed to unlock
}

export class AchievementsManager {
  private achievements: Achievement[] = [];
  private readonly storageKey = 'schach9x9_achievements';

  constructor() {
    this.load();
    this.initializeDefaultAchievements();
    logger.info('[AchievementsManager] Initialized');
  }

  private initializeDefaultAchievements(): void {
    // If no achievements stored, set defaults
    if (this.achievements.length === 0) {
      this.achievements = [
        {
          id: 'first_win',
          name: 'Erster Sieg',
          description: 'Gewinne dein erstes Spiel',
          unlocked: false,
        },
        {
          id: 'win_streak_5',
          name: 'Siegeslauf',
          description: 'Gewinne 5 Spiele in Folge',
          unlocked: false,
          progress: 0,
          target: 5,
        },
        {
          id: 'ten_wins',
          name: 'Zehnfacher Sieger',
          description: 'Gewinne insgesamt 10 Spiele',
          unlocked: false,
          progress: 0,
          target: 10,
        },
        {
          id: 'checkmate_in_5',
          name: 'Schneller Matt',
          description: 'Erziehe ein Matt in 5 Zügen oder weniger',
          unlocked: false,
        },
        {
          id: 'promote_pawn',
          name: 'Bauernbeförderung',
          description: 'Förgere einen Bauern zu einer höheren Figur',
          unlocked: false,
        },
        {
          id: 'win_with_king_only',
          name: 'König allein',
          description: 'Gewinne ein Spiel mit nur deinem König übrig',
          unlocked: false,
        },
      ];
      this.save();
    }
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Achievement[];
        if (Array.isArray(parsed)) {
          this.achievements = parsed;
          logger.info(`[AchievementsManager] Loaded ${this.achievements.length} achievements`);
          return;
        }
      }
    } catch (e) {
      logger.error('[AchievementsManager] Failed to load achievements', e);
    }
    // fallback to empty; will be initialized by initializeDefaultAchievements
    this.achievements = [];
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.achievements));
      logger.debug('[AchievementsManager] Achievements saved');
    } catch (e) {
      logger.error('[AchievementsManager] Failed to save achievements', e);
    }
  }

  public getAll(): Achievement[] {
    return [...this.achievements];
  }

  public isUnlocked(id: string): boolean {
    const ach = this.achievements.find(a => a.id === id);
    return ach ? ach.unlocked : false;
  }

  public unlock(id: string): boolean {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.save();
      logger.info(`[AchievementsManager] Achievement unlocked: ${ach.name}`);
      showToast(`Erfolg freigeschaltet: ${ach.name}`, 'success');
      return true;
    }
    return false;
  }

  /** Call after each game to evaluate achievements */
  public checkAndUnlock(
    gameResult: 'win' | 'loss' | 'draw',
    moveCount: number,
    hasPromotion: boolean,
    kingOnlyWin: boolean
  ): void {
    // Update progress-based achievements
    const stats = statisticsManager.getStatistics();
    // Ten wins
    const tenWinAch = this.achievements.find(a => a.id === 'ten_wins');
    if (tenWinAch && !tenWinAch.unlocked) {
      tenWinAch.progress = stats.wins;
      if (tenWinAch.progress >= tenWinAch.target!) {
        this.unlock('ten_wins');
      }
    }
    // First win
    const firstWinAch = this.achievements.find(a => a.id === 'first_win');
    if (firstWinAch && !firstWinAch.unlocked && gameResult === 'win') {
      this.unlock('first_win');
    }
    // Checkmate in 5
    const mateAch = this.achievements.find(a => a.id === 'checkmate_in_5');
    if (mateAch && !mateAch.unlocked && gameResult === 'win' && moveCount <= 5) {
      this.unlock('checkmate_in_5');
    }
    // Promote pawn
    const promoAch = this.achievements.find(a => a.id === 'promote_pawn');
    if (promoAch && !promoAch.unlocked && hasPromotion) {
      this.unlock('promote_pawn');
    }
    // Win with king only
    const kingOnlyAch = this.achievements.find(a => a.id === 'win_with_king_only');
    if (kingOnlyAch && !kingOnlyAch.unlocked && kingOnlyWin) {
      this.unlock('win_with_king_only');
    }

    // Save after updates
    this.save();
  }
}

export const achievementsManager = new AchievementsManager();
