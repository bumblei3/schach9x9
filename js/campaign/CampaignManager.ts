import { CAMPAIGN_LEVELS } from './campaignData.js';
import { CampaignState, Level, UnitXp } from './types.js';
import { UNIT_TALENT_TREES } from './talents.js';

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
        unlockedTalentIds: [],
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
        if (!parsed.unlockedPerks) {
          parsed.unlockedPerks = [];
        }
        if (!parsed.unlockedTalentIds) {
          parsed.unlockedTalentIds = [];
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
      unlockedTalentIds: [],
      championType: null,
    };
  }

  saveGame(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('schach_campaign_state', JSON.stringify(this.state));
      window.dispatchEvent(new Event('campaign-update'));
    }
  }

  public getLevel(levelId: string): Level | undefined {
    return CAMPAIGN_LEVELS.find(l => l.id === levelId);
  }

  public getAllLevels(): Level[] {
    return CAMPAIGN_LEVELS;
  }

  unlockLevel(levelId: string): void {
    if (!this.state.unlockedLevels.includes(levelId)) {
      this.state.unlockedLevels.push(levelId);
      this.saveGame();
    }
  }

  isLevelUnlocked(levelId: string): boolean {
    return this.state.unlockedLevels.includes(levelId);
  }

  public isLevelCompleted(levelId: string): boolean {
    return this.state.completedLevels.includes(levelId);
  }

  public isRewardUnlocked(rewardId: string): boolean {
    return this.state.unlockedRewards.includes(rewardId);
  }

  getGold(): number {
    return this.state.gold;
  }

  addGold(amount: number): void {
    this.state.gold += amount;
    this.saveGame();
  }

  spendGold(amount: number): boolean {
    if (this.state.gold >= amount) {
      this.state.gold -= amount;
      this.saveGame();
      return true;
    }
    return false;
  }

  public getUnlockedPerks(): string[] {
    return this.state.unlockedPerks;
  }

  isPerkUnlocked(perkId: string): boolean {
    return this.state.unlockedPerks && this.state.unlockedPerks.includes(perkId);
  }

  unlockPerk(perkId: string): void {
    if (!this.isPerkUnlocked(perkId)) {
      this.state.unlockedPerks.push(perkId);
      this.saveGame();
    }
  }

  setChampion(unitType: string | null): void {
    this.state.championType = unitType;
    this.saveGame();
  }

  getChampion(): string | null {
    return this.state.championType;
  }

  // XP System
  public getUnitXp(unitType: string): UnitXp {
    return (
      this.state.unitXp[unitType] || {
        xp: 0,
        level: 1,
        captures: 0,
      }
    );
  }

  addUnitXp(unitType: string, amount: number, captures: number = 0): boolean {
    const unitStats = this.getUnitXp(unitType);
    let leveledUp = false;

    unitStats.xp += amount;
    if (captures > 0) {
      unitStats.captures = (unitStats.captures || 0) + captures;
    }

    // Level Logik: 1 -> 2 (100XP), 2 -> 3 (300XP), etc.
    // Simple cap at Level 3 for now, or higher for Talents
    const xpThresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500]; // Bis Level 10

    const nextLevel = unitStats.level + 1;
    if (xpThresholds[nextLevel - 1] !== undefined && unitStats.xp >= xpThresholds[nextLevel - 1]) {
      unitStats.level = nextLevel;
      leveledUp = true;
    }

    this.state.unitXp[unitType] = unitStats;
    this.saveGame();

    return leveledUp;
  }

  incrementUnitCaptures(unitType: string): void {
    const unitStats = this.getUnitXp(unitType);
    unitStats.captures++;
    this.state.unitXp[unitType] = unitStats;
    this.saveGame();
  }

  public getLevelStars(levelId: string): number {
    return this.state.levelStars[levelId] || 0;
  }

  completeLevel(levelId: string, starsOrStats: number | any = 0): number {
    if (!this.state.completedLevels.includes(levelId)) {
      this.state.completedLevels.push(levelId);
    }

    const level = this.getLevel(levelId);
    if (!level) return 0;

    let stars = 0;
    if (typeof starsOrStats === 'number') {
      stars = starsOrStats;
    } else {
      stars = this.calculateStars(level, starsOrStats);
    }

    // Update stars if higher
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
    this.saveGame();
    return stars;
  }

  private calculateStars(level: Level, stats: any): number {
    let stars = 1; // Base star for completing the mission

    if (level.goals) {
      // Check 2nd star
      if (level.goals[2] && this.checkGoal(level.goals[2], stats)) {
        stars = 2;
        // Check 3rd star only if 2nd is achieved
        if (level.goals[3] && this.checkGoal(level.goals[3], stats)) {
          stars = 3;
        }
      }
    }

    return stars;
  }

  private checkGoal(goal: any, stats: any): boolean {
    switch (goal.type) {
      case 'moves':
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
    this.saveGame();
  }

  // Talent System
  isTalentUnlocked(talentId: string): boolean {
    return this.state.unlockedTalentIds && this.state.unlockedTalentIds.includes(talentId);
  }

  unlockTalent(unitType: string, talentId: string, cost: number): boolean {
    // Validate existence
    const tree = UNIT_TALENT_TREES[unitType];
    if (!tree) return false;
    const talent = tree.talents.find(t => t.id === talentId);
    if (!talent) return false;

    if (this.isTalentUnlocked(talentId)) return true; // Already unlocked

    // Check cost
    if (this.state.gold < cost) return false;

    this.state.gold -= cost;
    if (!this.state.unlockedTalentIds) this.state.unlockedTalentIds = [];
    this.state.unlockedTalentIds.push(talentId);
    this.saveGame();
    return true;
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
      unlockedTalentIds: [],
      championType: null,
    };
    this.saveGame();
  }
}

export const campaignManager = new CampaignManager();
