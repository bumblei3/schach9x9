/**
 * Campaign Levels Configuration
 * Defines the scenarios for the single-player campaign.
 */

export interface CampaignGoal {
  type: 'moves' | 'material' | 'promotion';
  value: number;
  description: string;
}

export interface CampaignLevel {
  id: string;
  title: string;
  description: string;
  opponentName: string;
  opponentPersonality: 'balanced' | 'aggressive' | 'defensive' | 'positional' | 'expert';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  setupType: 'fixed' | 'budget';
  playerBudget?: number;
  playerColor: 'white' | 'black';
  fen: string;
  winCondition: {
    type: 'checkmate' | 'survival' | 'capture_target';
  };
  unlocks: string[];
  goals: {
    [stars: number]: CampaignGoal;
  };
}

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 'tutorial_1',
    title: 'Kapitel 1: Der Hinterhalt',
    description:
      'Eine kleine Patrouille wurde überrascht. Besiege den gegnerischen Anführer mit deinen begrenzten Truppen.',
    opponentName: 'Banditenführer',
    opponentPersonality: 'aggressive',
    difficulty: 'easy',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '8/8/8/8/8/3k5/8/3P4/3K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['skirmish_1'],
    goals: {
      2: { type: 'moves', value: 15, description: 'Win in under 15 moves' },
      3: { type: 'moves', value: 10, description: 'Win in under 10 moves' },
    },
  },
  {
    id: 'skirmish_1',
    title: 'Kapitel 2: Die Brücke',
    description: 'Halte die Brücke gegen den Ansturm. Du hast den Vorteil der Engel.',
    opponentName: 'Hauptmann der Wache',
    opponentPersonality: 'defensive',
    difficulty: 'medium',
    setupType: 'fixed',
    playerColor: 'white',
    fen: 'rnbqkbnr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBNR w KQkq - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['boss_1'],
    goals: {
      2: { type: 'moves', value: 40, description: 'Win in under 40 moves' },
      3: { type: 'material', value: 10, description: 'Win with +10 material advantage' },
    },
  },
  {
    id: 'boss_1',
    title: 'Kapitel 3: Der Dunkle Turm',
    description: 'Stürze den König in seiner Festung. Er ist schwer bewacht.',
    opponentName: 'Dunkler Lord',
    opponentPersonality: 'aggressive',
    difficulty: 'hard',
    setupType: 'budget',
    playerBudget: 25,
    playerColor: 'white',
    fen: '9/9/9/3ppp3/3pkp3/3ppp3/9/9/RNBQKBNR w KQkq - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    goals: {
      2: { type: 'moves', value: 50, description: 'Sieg in unter 50 Zügen' },
      3: { type: 'promotion', value: 1, description: 'Befördere einen Bauern zum Engel' },
    },
    unlocks: ['knight_mission'],
  },
  {
    id: 'knight_mission',
    title: 'Kapitel 4: Der Aufstieg',
    description:
      'Deine Springer sind der Schlüssel zum Sieg. Nutze ihre Wendigkeit auf dem schmalen Pfad.',
    opponentName: 'Ritterorden',
    opponentPersonality: 'balanced',
    difficulty: 'hard',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '4k4/9/9/9/3nN3/9/9/9/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['final_boss'],
    goals: {
      2: { type: 'moves', value: 20, description: 'Sieg in unter 20 Zügen' },
      3: { type: 'material', value: 3, description: 'Gewinne mit +3 Materialvorteil' },
    },
  },
  {
    id: 'final_boss',
    title: 'Kapitel 5: Der finale Schlag',
    description:
      'Der dunkle Herrscher stellt sich dir entgegen. Verbessere deine Truppen und siegre!',
    opponentName: 'Der Imperator',
    opponentPersonality: 'expert',
    difficulty: 'expert',
    setupType: 'budget',
    playerBudget: 35,
    playerColor: 'white',
    fen: 'rnbqkbnr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBNR w KQkq - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_rook'],
    goals: {
      2: { type: 'moves', value: 30, description: 'Sieg in unter 30 Zügen' },
      3: { type: 'promotion', value: 2, description: 'Zwei Bauern zum Engel befördern' },
    },
  },
  {
    id: 'endgame_rook',
    title: 'Endspiel 1: Turm-Matt',
    description:
      'Lerne das grundlegende Mattmuster: König und Turm gegen König. Dränge den König an den Rand!',
    opponentName: 'Trainer',
    opponentPersonality: 'defensive',
    difficulty: 'easy',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '9/9/9/9/4k4/9/9/4R4/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_queen'],
    goals: {
      2: { type: 'moves', value: 20, description: 'Matt in unter 20 Zügen' },
      3: { type: 'moves', value: 15, description: 'Matt in unter 15 Zügen' },
    },
  },
  {
    id: 'endgame_queen',
    title: 'Endspiel 2: Damen-Matt',
    description: 'Die Dame ist mächtig. Nutze sie, um den gegnerischen König schnell mattzusetzen.',
    opponentName: 'Trainer',
    opponentPersonality: 'defensive',
    difficulty: 'easy',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '9/9/9/4k4/9/9/9/4Q4/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_pawn'],
    goals: {
      2: { type: 'moves', value: 12, description: 'Matt in unter 12 Zügen' },
      3: { type: 'moves', value: 8, description: 'Matt in unter 8 Zügen' },
    },
  },
  {
    id: 'endgame_pawn',
    title: 'Endspiel 3: Bauernumwandlung',
    description:
      'Ein einzelner Bauer kann das Spiel entscheiden. Führe ihn zur Umwandlung und gewinne!',
    opponentName: 'Trainer',
    opponentPersonality: 'defensive',
    difficulty: 'medium',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '9/9/9/9/4k4/9/4P4/9/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_bishops'],
    goals: {
      2: { type: 'moves', value: 25, description: 'Gewinne in unter 25 Zügen' },
      3: { type: 'promotion', value: 1, description: 'Bauer zur Dame umwandeln' },
    },
  },
  {
    id: 'endgame_bishops',
    title: 'Endspiel 4: Zwei Läufer',
    description: 'Zwei Läufer können den König mattsetzen. Koordiniere sie geschickt!',
    opponentName: 'Trainer',
    opponentPersonality: 'defensive',
    difficulty: 'hard',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '9/9/9/9/4k4/9/9/3B1B3/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_exchange'],
    goals: {
      2: { type: 'moves', value: 30, description: 'Matt in unter 30 Zügen' },
      3: { type: 'moves', value: 20, description: 'Matt in unter 20 Zügen' },
    },
  },
  {
    id: 'endgame_exchange',
    title: 'Endspiel 5: Turm gegen Läufer',
    description:
      'Du hast einen Turm, der Gegner einen Läufer. Nutze deinen Materialvorteil zum Sieg!',
    opponentName: 'Trainer',
    opponentPersonality: 'defensive',
    difficulty: 'hard',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '9/9/9/4k4/9/4b4/9/4R4/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: [],
    goals: {
      2: { type: 'moves', value: 40, description: 'Gewinne in unter 40 Zügen' },
      3: { type: 'material', value: 5, description: 'Gewinne mit +5 Materialvorteil' },
    },
  },
];
