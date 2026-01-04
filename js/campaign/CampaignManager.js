import { CAMPAIGN_LEVELS } from './campaignData.js';

export class CampaignManager {
    constructor() {
        this.levels = CAMPAIGN_LEVELS;
        this.progress = this.loadProgress();
    }

    /**
     * Load progress from storage
     * @returns {Object} { [levelId]: { completed: boolean, stars: number } }
     */
    loadProgress() {
        // We can rely on storageManager or access localStorage strictly for campaign
        // Let's use a specific key for campaign
        const raw = localStorage.getItem('schach9x9_campaign_progress');
        if (!raw) {
            // Default: First level is unlocked implicitly (or explicitly tracked)
            // Actually, logic: if level is first in list, or parent is unlocked.
            // Better to track explicitly.
            return {};
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to parse campaign progress', e);
            return {};
        }
    }

    saveProgress() {
        localStorage.setItem('schach9x9_campaign_progress', JSON.stringify(this.progress));
    }

    /**
     * Mark a level as completed
     * @param {string} levelId 
     * @param {number} stars (1-3)
     */
    completeLevel(levelId, stars = 1) {
        if (!this.getLevel(levelId)) return;

        const current = this.progress[levelId] || { completed: false, stars: 0 };

        // Update if better result
        this.progress[levelId] = {
            completed: true,
            stars: Math.max(current.stars, stars)
        };

        this.saveProgress();
    }

    /**
     * Check if a level is unlocked
     * @param {string} levelId 
     * @returns {boolean}
     */
    isLevelUnlocked(levelId) {
        // Level 1 is always unlocked
        if (this.levels[0].id === levelId) return true;

        // Check if any level that unlocks this one has been completed
        // Reverse lookup: Find levels that have this levelId in their 'unlocks' array
        const parentLevel = this.levels.find(l => l.unlocks && l.unlocks.includes(levelId));

        // If no parent found (and not first level), it's probably locked or hidden
        if (!parentLevel) return false;

        // It's unlocked if the parent is completed
        return this.isLevelCompleted(parentLevel.id);
    }

    isLevelCompleted(levelId) {
        return !!this.progress[levelId]?.completed;
    }

    getLevel(id) {
        return this.levels.find(l => l.id === id);
    }

    getAllLevels() {
        return this.levels.map(l => ({
            ...l,
            unlocked: this.isLevelUnlocked(l.id),
            completed: this.isLevelCompleted(l.id),
            stars: this.progress[l.id]?.stars || 0
        }));
    }

    resetProgress() {
        this.progress = {};
        this.saveProgress();
    }
}

export const campaignManager = new CampaignManager();
