import { CAMPAIGN_LEVELS } from './campaignData.js';
import { CampaignState, Level } from './types.js';

export class CampaignManager {
  private state: CampaignState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): CampaignState {
    if (typeof localStorage === 'undefined') {
      return {
        currentLevelId: 'tutorial_1',
        unlockedLevels: ['tutorial_1'],
        completedLevels: [],
        unlockedRewards: [],
      };
    }
    const saved = localStorage.getItem('schach_campaign_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse campaign state', e);
      }
    }
    // Default state: Level 1 unlocked
    return {
      currentLevelId: 'tutorial_1',
      unlockedLevels: ['tutorial_1'],
      completedLevels: [],
      unlockedRewards: [],
    };
  }

  private saveState(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('schach_campaign_state', JSON.stringify(this.state));
    }
  }

  public getLevel(levelId: string): Level | undefined {
    return CAMPAIGN_LEVELS.find(l => l.id === levelId);
  }

  public getAllLevels(): Level[] {
    return CAMPAIGN_LEVELS;
  }

  public isLevelUnlocked(levelId: string): boolean {
    return this.state.unlockedLevels.includes(levelId);
  }

  public isLevelCompleted(levelId: string): boolean {
    return this.state.completedLevels.includes(levelId);
  }

  public isRewardUnlocked(rewardId: string): boolean {
    return this.state.unlockedRewards.includes(rewardId);
  }

  public completeLevel(levelId: string): void {
    if (!this.state.completedLevels.includes(levelId)) {
      this.state.completedLevels.push(levelId);
    }

    // Reward Logic
    const level = this.getLevel(levelId);
    if (level && level.reward && !this.state.unlockedRewards.includes(level.reward)) {
      this.state.unlockedRewards.push(level.reward);
      console.log(`[Campaign] Unlocked Reward: ${level.reward}`);
    }

    // Unlock next level logic
    const currentIndex = CAMPAIGN_LEVELS.findIndex(l => l.id === levelId);
    if (currentIndex !== -1 && currentIndex < CAMPAIGN_LEVELS.length - 1) {
      // ... existing next level code ...
      const nextLevel = CAMPAIGN_LEVELS[currentIndex + 1];
      if (!this.state.unlockedLevels.includes(nextLevel.id)) {
        this.state.unlockedLevels.push(nextLevel.id);
        this.state.currentLevelId = nextLevel.id;
      }
    }

    this.saveState();
  }

  public getCurrentLevelId(): string {
    return this.state.currentLevelId;
  }

  public unlockAll(): void {
    const allIds = CAMPAIGN_LEVELS.map(l => l.id);
    // Merge unique IDs
    this.state.unlockedLevels = [...new Set([...this.state.unlockedLevels, ...allIds])];
    this.saveState();
  }

  public resetState(): void {
    this.state = {
      currentLevelId: 'tutorial_1',
      unlockedLevels: ['tutorial_1'],
      completedLevels: [],
      unlockedRewards: [],
    };
    this.saveState();
  }
}

export const campaignManager = new CampaignManager();
