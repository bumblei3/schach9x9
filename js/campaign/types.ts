import { Board } from '../types/game.js';

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

  // Custom Rules
  winCondition: {
    type: 'checkmate' | 'survival' | 'capture_target';
    [key: string]: any;
  };
  targetPiece?: { r: number; c: number }; // For capture_target

  // Rewards
  reward?: string;
}

export interface CampaignState {
  currentLevelId: string;
  unlockedLevels: string[];
  completedLevels: string[];
  unlockedRewards: string[];
}
