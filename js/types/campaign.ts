import type { Player } from './game.js';

export type CampaignDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface CampaignGoal {
    type: 'moves' | 'material' | 'promotion';
    value: number;
    description: string;
}

export interface CampaignLevelRaw {
    id: string;
    title: string;
    description: string;
    difficulty: CampaignDifficulty;
    playerColor: Player;
    fen: string;
    winCondition: {
        type: string;
    };
    unlocks: string[];
    goals?: Record<number, CampaignGoal>;
}

export interface LevelStats {
    moves: number;
    materialDiff: number;
    promotedCount?: number;
}

export interface LevelProgress {
    completed: boolean;
    stars: number;
}
