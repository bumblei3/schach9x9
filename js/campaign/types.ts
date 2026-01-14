import { Board } from '../types/game.js';

export interface Perk {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
}

export interface CampaignGoal {
  type: 'moves' | 'material' | 'promotion';
  value: number;
  description: string;
}

export interface Level {
  id: string;
  title: string;
  description: string;
  opponentName: string;
  opponentPersonality: 'balanced' | 'aggressive' | 'defensive' | 'positional' | 'expert';
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
  playerColor?: 'white' | 'black';

  // Setup Configuration
  setupType: 'fixed' | 'budget';
  playerBudget?: number; // Core budget (normally 15 or 5)
  boardSetup?: Board; // Pre-filled board for fixed scenarios
  fen?: string;

  // Custom Rules
  winCondition: {
    type: 'checkmate' | 'survival' | 'capture_target';
    [key: string]: any;
  };
  targetPiece?: { r: number; c: number }; // For capture_target

  unlocks: string[];
  goals: {
    [stars: number]: CampaignGoal;
  };

  // Rewards
  reward?: string;
  goldReward: number;
}

export interface UnitXp {
  xp: number;
  level: number;
  captures: number;
}

export interface CampaignState {
  currentLevelId: string;
  unlockedLevels: string[];
  completedLevels: string[];
  unlockedRewards: string[]; // Legacy/Other rewards
  gold: number;
  unlockedPerks: string[];
  levelStars: Record<string, number>; // levelId -> stars (1-3)
  unitXp: Record<string, UnitXp>; // unit type (p, n, b, r, q) -> XP
  unlockedTalentIds: string[];
  championType: string | null; // e.g. 'n' for Knight
}
