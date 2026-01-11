import { CAMPAIGN_LEVELS, type CampaignLevel, type CampaignGoal } from './campaignData.js';

export interface CampaignProgress {
  [levelId: string]: {
    completed: boolean;
    stars: number;
  };
}

export class CampaignManager {
  private levels: CampaignLevel[];
  private progress: CampaignProgress;

  constructor() {
    this.levels = CAMPAIGN_LEVELS;
    this.progress = this.loadProgress();
  }

  /**
   * Load progress from storage
   */
  loadProgress(): CampaignProgress {
    const raw = localStorage.getItem('schach9x9_campaign_progress');
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse campaign progress', e);
      return {};
    }
  }

  saveProgress(): void {
    localStorage.setItem('schach9x9_campaign_progress', JSON.stringify(this.progress));
  }

  /**
   * Mark a level as completed and calculate stars
   */
  completeLevel(levelId: string, gameStats: any = {}): number | undefined {
    const level = this.getLevel(levelId);
    if (!level) return undefined;

    const stars = this.calculateStars(level, gameStats);
    const current = this.progress[levelId] || { completed: false, stars: 0 };

    if (stars > current.stars || !current.completed) {
      this.progress[levelId] = {
        completed: true,
        stars: Math.max(current.stars, stars),
      };
      this.saveProgress();
    }

    return stars;
  }

  calculateStars(level: CampaignLevel, stats: any): number {
    let stars = 1;

    if (!level.goals) return stars;

    if (this.checkGoal(level.goals[2], stats)) {
      stars = 2;
    }

    if (this.checkGoal(level.goals[3], stats)) {
      stars = 3;
    }

    return stars;
  }

  checkGoal(goal: CampaignGoal | undefined, stats: any): boolean {
    if (!goal) return false;

    switch (goal.type) {
      case 'moves':
        return stats.moves <= goal.value;
      case 'material':
        return stats.materialDiff >= goal.value;
      case 'promotion':
        return (stats.promotedCount || 0) >= goal.value;
      default:
        return false;
    }
  }

  /**
   * Check if a level is unlocked
   */
  isLevelUnlocked(levelId: string): boolean {
    if (this.levels[0].id === levelId) return true;

    const parentLevel = this.levels.find(l => l.unlocks && l.unlocks.includes(levelId));

    if (!parentLevel) return false;

    return this.isLevelCompleted(parentLevel.id);
  }

  isLevelCompleted(levelId: string): boolean {
    return !!this.progress[levelId]?.completed;
  }

  getLevel(id: string): CampaignLevel | undefined {
    return this.levels.find(l => l.id === id);
  }

  getAllLevels(): any[] {
    return this.levels.map(l => ({
      ...l,
      unlocked: this.isLevelUnlocked(l.id),
      completed: this.isLevelCompleted(l.id),
      stars: this.progress[l.id]?.stars || 0,
    }));
  }

  resetProgress(): void {
    this.progress = {};
    this.saveProgress();
  }
}

export const campaignManager = new CampaignManager();
