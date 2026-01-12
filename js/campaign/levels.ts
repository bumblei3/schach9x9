import { Level } from './types.js';

export const CAMPAIGN_LEVELS: Level[] = [
  {
    id: 'level_1',
    title: 'Kapitel 1: Der Aufstand',
    description:
      'Eine Armee von Bauern marschiert auf. Dein König muss sich verteidigen. Lerne die Macht der Bauernstruktur.',
    opponentName: 'Bauernführer Hans',
    opponentPersonality: 'aggressive',
    difficulty: 'beginner',
    setupType: 'fixed',
    winCondition: 'checkmate',
    // Custom board setup will be generated in CampaignManager or passed here if we had a serializer
    // For now, we might rely on special logic in Game.init for 'fixed' levels or define a helper
  },
  {
    id: 'level_2',
    title: 'Kapitel 2: Die Kavallerie',
    description:
      'Vier Springer bedrohen das Land. Ihre Unberechenbarkeit ist gefährlich. Nutze deine Läufer weise.',
    opponentName: 'Ritter Kunibert',
    opponentPersonality: 'aggressive',
    difficulty: 'easy',
    setupType: 'budget',
    playerBudget: 15,
    winCondition: 'checkmate',
  },
  {
    id: 'level_3',
    title: 'Kapitel 3: Der General',
    description:
      'Ein echter militärischer Test. Eine ausgeglichene Armee erwartet dich. Zeige, dass du bereit für die 9x9 Welt bist.',
    opponentName: 'General Eisenfaust',
    opponentPersonality: 'balanced',
    difficulty: 'medium',
    setupType: 'budget',
    playerBudget: 20, // Slightly more points to experiment
    winCondition: 'checkmate',
    reward: 'angel',
  },
];
