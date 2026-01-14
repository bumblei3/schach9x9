import { CAMPAIGN_LEVELS, CAMPAIGN_PERKS } from './campaignData.js';
import { CampaignState, Level, Perk, UnitXp } from './types.js';

export class CampaignManager {
  private state: CampaignState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): CampaignState {
    if (typeof localStorage === 'undefined') {
      return {
        currentLevelId: 'peasant_revolt',
        unlockedLevels: ['peasant_revolt'],
        completedLevels: [],
        unlockedRewards: [],
        gold: 0,
        unlockedPerks: [],
        levelStars: {},
        unitXp: {
          p: { xp: 0, level: 1, captures: 0 },
          n: { xp: 0, level: 1, captures: 0 },
          b: { xp: 0, level: 1, captures: 0 },
          r: { xp: 0, level: 1, captures: 0 },
          q: { xp: 0, level: 1, captures: 0 },
          a: { xp: 0, level: 1, captures: 0 },
          c: { xp: 0, level: 1, captures: 0 },
          e: { xp: 0, level: 1, captures: 0 },
        },
        championType: null,
      };
    }
    const saved = localStorage.getItem('schach_campaign_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration to add unitXp and championType if missing
        if (!parsed.unitXp) {
          parsed.unitXp = {
            p: { xp: 0, level: 1, captures: 0 },
            n: { xp: 0, level: 1, captures: 0 },
            b: { xp: 0, level: 1, captures: 0 },
            r: { xp: 0, level: 1, captures: 0 },
            q: { xp: 0, level: 1, captures: 0 },
            a: { xp: 0, level: 1, captures: 0 },
            c: { xp: 0, level: 1, captures: 0 },
            e: { xp: 0, level: 1, captures: 0 },
          };
        }
        if (parsed.championType === undefined) {
          parsed.championType = null;
        }
        if (!parsed.levelStars) {
          parsed.levelStars = {};
        }
        if (parsed.gold === undefined) {
          parsed.gold = 0;
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse campaign state', e);
      }
    }
    // Default state: Level 1 unlocked
    return {
      currentLevelId: 'peasant_revolt',
      unlockedLevels: ['peasant_revolt'],
      completedLevels: [],
      unlockedRewards: [],
      gold: 0,
      unlockedPerks: [],
      levelStars: {},
      unitXp: {
        p: { xp: 0, level: 1, captures: 0 },
        n: { xp: 0, level: 1, captures: 0 },
        b: { xp: 0, level: 1, captures: 0 },
        r: { xp: 0, level: 1, captures: 0 },
        q: { xp: 0, level: 1, captures: 0 },
        a: { xp: 0, level: 1, captures: 0 },
        c: { xp: 0, level: 1, captures: 0 },
        e: { xp: 0, level: 1, captures: 0 },
      },
      championType: null,
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

  public getGold(): number {
    return this.state.gold;
  }

  public getUnlockedPerks(): string[] {
    return this.state.unlockedPerks;
  }

  public isPerkUnlocked(perkId: string): boolean {
    return this.state.unlockedPerks.includes(perkId);
  }

  public buyPerk(perkId: string): boolean {
    const perk = CAMPAIGN_PERKS.find((p: Perk) => p.id === perkId);
    if (!perk) return false;

    if (this.state.gold >= perk.cost && !this.state.unlockedPerks.includes(perkId)) {
      this.state.gold -= perk.cost;
      this.state.unlockedPerks.push(perkId);
      this.saveState();
      return true;
    }
    return false;
  }

  public setChampion(type: string | null): void {
    this.state.championType = type;
    this.saveState();
  }

  public addUnitXp(type: string, amount: number): void {
    const xpEntry = this.state.unitXp[type];
    if (!xpEntry) return;

    xpEntry.xp += amount;
    xpEntry.captures += 1;

    // Check for level up
    const nextLevelXp = xpEntry.level * 100; // Simplified: 100, 200, 300...
    if (xpEntry.xp >= nextLevelXp) {
      xpEntry.level += 1;
    }
    this.saveState();
  }

  public getUnitXp(type: string): UnitXp {
    return (
      this.state.unitXp[type] || {
        xp: 0,
        level: 1,
        captures: 0,
      }
    );
  }

  public getLevelStars(levelId: string): number {
    return this.state.levelStars[levelId] || 0;
  }

  public completeLevel(levelId: string, stats?: any): number {
    if (!this.state.completedLevels.includes(levelId)) {
      this.state.completedLevels.push(levelId);
    }

    const level = this.getLevel(levelId);
    if (!level) return 0;

    // Calculate Stars
    let stars = 1; // Base star for winning
    if (stats && level.goals) {
      if (this.checkGoal(level.goals[2], stats)) {
        stars = 2;
      }
      if (stars === 2 && this.checkGoal(level.goals[3], stats)) {
        stars = 3;
      }
    }

    const currentStars = this.state.levelStars[levelId] || 0;
    if (stars > currentStars) {
      this.state.levelStars[levelId] = stars;
    }

    // Award gold
    if (currentStars === 0) {
      this.state.gold += level.goldReward;
    } else if (stars > currentStars) {
      const bonus = (stars - currentStars) * 20;
      this.state.gold += bonus;
    }

    // Legacy Reward Logic
    if (level.reward && !this.state.unlockedRewards.includes(level.reward)) {
      this.state.unlockedRewards.push(level.reward);
    }

    // Unlock next level logic
    const allLevels = this.getAllLevels();
    const currentIndex = allLevels.findIndex(l => l.id === levelId);
    if (currentIndex !== -1 && currentIndex < allLevels.length - 1) {
      const nextLevel = allLevels[currentIndex + 1];
      if (!this.state.unlockedLevels.includes(nextLevel.id)) {
        this.state.unlockedLevels.push(nextLevel.id);
        this.state.currentLevelId = nextLevel.id;
      }
    }

    this.saveState();
    return stars;
  }

  private checkGoal(goal: any, stats: any): boolean {
    if (!goal || !stats) return false;
    switch (goal.type) {
      case 'moves':
        // stats.moves is full moves
        return stats.moves <= goal.value;
      case 'material':
        return stats.materialDiff >= goal.value;
      case 'promotion':
        return stats.promotedCount >= goal.value;
      default:
        return false;
    }
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
      currentLevelId: 'peasant_revolt',
      unlockedLevels: ['peasant_revolt'],
      completedLevels: [],
      unlockedRewards: [],
      gold: 0,
      unlockedPerks: [],
      levelStars: {},
      unitXp: {
        p: { xp: 0, level: 1, captures: 0 },
        n: { xp: 0, level: 1, captures: 0 },
        b: { xp: 0, level: 1, captures: 0 },
        r: { xp: 0, level: 1, captures: 0 },
        q: { xp: 0, level: 1, captures: 0 },
        a: { xp: 0, level: 1, captures: 0 },
        c: { xp: 0, level: 1, captures: 0 },
        e: { xp: 0, level: 1, captures: 0 },
      },
      championType: null,
    };
    this.saveState();
  }
}

export const campaignManager = new CampaignManager();
