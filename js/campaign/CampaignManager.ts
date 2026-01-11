import { CAMPAIGN_LEVELS } from './campaignData.js';
import { CampaignLevelRaw, LevelProgress, LevelStats, CampaignGoal } from '../types/campaign.js';

export class CampaignManager {
    public levels: CampaignLevelRaw[];
    public progress: Record<string, LevelProgress>;

    constructor() {
        this.levels = CAMPAIGN_LEVELS;
        this.progress = this.loadProgress();
    }

    /**
     * Load progress from storage
     * @returns {Object} { [levelId]: { completed: boolean, stars: number } }
     */
    private loadProgress(): Record<string, LevelProgress> {
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

    private saveProgress(): void {
        localStorage.setItem('schach9x9_campaign_progress', JSON.stringify(this.progress));
    }

    /**
     * Mark a level as completed and calculate stars
     * @param levelId
     * @param gameStats { moves, materialDiff, promotedCount }
     */
    public completeLevel(levelId: string, gameStats: LevelStats = { moves: 0, materialDiff: 0 }): number | undefined {
        const level = this.getLevel(levelId);
        if (!level) return;

        const stars = this.calculateStars(level, gameStats);
        const current = this.progress[levelId] || { completed: false, stars: 0 };

        // Update if better result (more stars)
        if (stars > current.stars || !current.completed) {
            this.progress[levelId] = {
                completed: true,
                stars: Math.max(current.stars, stars),
            };
            this.saveProgress();
        }

        return stars; // Return earned stars for UI display
    }

    private calculateStars(level: CampaignLevelRaw, stats: LevelStats): number {
        let stars = 1; // Base star for completing the level

        if (!level.goals) return stars;

        // Check 2-star goal
        if (this.checkGoal(level.goals[2], stats)) {
            stars = 2;
        }

        // Check 3-star goal
        if (this.checkGoal(level.goals[3], stats)) {
            stars = 3;
        }

        return stars;
    }

    private checkGoal(goal: CampaignGoal | undefined, stats: LevelStats): boolean {
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
     * @param levelId
     * @returns {boolean}
     */
    public isLevelUnlocked(levelId: string): boolean {
        // Level 1 is always unlocked
        if (this.levels[0].id === levelId) return true;

        // Check if any level that unlocks this one has been completed
        const parentLevel = this.levels.find(l => l.unlocks && l.unlocks.includes(levelId));

        // If no parent found (and not first level), it's probably locked or hidden
        if (!parentLevel) return false;

        // It's unlocked if the parent is completed
        return this.isLevelCompleted(parentLevel.id);
    }

    public isLevelCompleted(levelId: string): boolean {
        return !!this.progress[levelId]?.completed;
    }

    public getLevel(id: string): CampaignLevelRaw | undefined {
        return this.levels.find(l => l.id === id);
    }

    public getAllLevels(): (CampaignLevelRaw & { unlocked: boolean; completed: boolean; stars: number })[] {
        return this.levels.map(l => ({
            ...l,
            unlocked: this.isLevelUnlocked(l.id),
            completed: this.isLevelCompleted(l.id),
            stars: this.progress[l.id]?.stars || 0,
        }));
    }

    public resetProgress(): void {
        this.progress = {};
        this.saveProgress();
    }
}

export const campaignManager = new CampaignManager();
