import { Board } from '../types/game.js';

export interface Level {
  id: string;
  title: string;
  description: string;
  opponentName: string;
  opponentPersonality: 'balanced' | 'aggressive' | 'defensive' | 'positional';
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

  // Setup Configuration
  setupType: 'fixed' | 'budget';
  playerBudget?: number; // Core budget (normally 15 or 5)
  boardSetup?: Board; // Pre-filled board for fixed scenarios

  // Custom Rules
  winCondition: 'checkmate' | 'survival' | 'capture_target';
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
