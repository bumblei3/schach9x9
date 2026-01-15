import { Level, Perk } from './types.js';

export const CAMPAIGN_LEVELS: Level[] = [
  {
    id: 'peasant_revolt',
    title: 'Kapitel 1: Der Aufstand',
    description:
      'Eine Armee von Bauern marschiert auf. Dein König muss sich verteidigen. Lerne die Macht der Bauernstruktur.',
    opponentName: 'Bauernführer Hans',
    opponentPersonality: 'aggressive',
    difficulty: 'easy',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '4k4/1ppppppp1/9/9/9/9/9/2PPPP3/3QK4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['bandit_ambush'],
    goals: {
      2: { type: 'moves', value: 20, description: 'Sieg in unter 20 Zügen' },
      3: { type: 'material', value: 5, description: 'Gewinne mit +5 Materialvorteil' },
    },
    goldReward: 20,
  },
  {
    id: 'bandit_ambush',
    title: 'Kapitel 2: Die Kavallerie',
    description:
      'Vier Springer bedrohen das Land. Ihre Unberechenbarkeit ist gefährlich. Nutze deine Läufer weise.',
    opponentName: 'Ritter Kunibert',
    opponentPersonality: 'aggressive',
    difficulty: 'easy',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '4k4/ppppppppp/9/1nnnn4/9/9/9/RRBBQBBRR/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
      drawCountsAsWin: true,
    },
    unlocks: ['skirmish_bridge'],
    goals: {
      2: { type: 'moves', value: 25, description: 'Sieg in unter 25 Zügen' },
      3: { type: 'moves', value: 16, description: 'Sieg in unter 16 Zügen' },
    },
    goldReward: 30,
  },
  {
    id: 'skirmish_bridge',
    title: 'Kapitel 3: Der General',
    description:
      'Ein echter militärischer Test. Eine ausgeglichene Armee erwartet dich. Zeige, dass du bereit für die 9x9 Welt bist.',
    opponentName: 'General Eisenfaust',
    opponentPersonality: 'balanced',
    difficulty: 'medium',
    setupType: 'fixed',
    playerColor: 'white',
    fen: 'rnbqkcbjr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKEACR w KQkq - 0 1',
    winCondition: {
      type: 'checkmate',
      drawCountsAsWin: true,
    },
    unlocks: ['boss_1'],
    goals: {
      2: { type: 'moves', value: 50, description: 'Sieg in unter 50 Zügen' },
      3: { type: 'material', value: 8, description: 'Gewinne mit +8 Materialvorteil' },
    },
    goldReward: 40,
  },
  {
    id: 'boss_1',
    title: 'Kapitel 4: Die Belagerung des dunklen Turms',
    description:
      'Der Turm des Tyrannen steht vor dir. Durchbrich die Verteidigung und stürze den Lord.',
    opponentName: 'Dunkler Lord',
    opponentPersonality: 'aggressive',
    difficulty: 'hard',
    setupType: 'budget',
    playerBudget: 30,
    playerColor: 'white',
    fen: '9/9/9/3ppp3/3pkp3/3ppp3/9/9/9 w - - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    goals: {
      2: { type: 'moves', value: 50, description: 'Sieg in unter 50 Zügen' },
      3: { type: 'promotion', value: 1, description: 'Befördere einen Bauern zum Engel' },
    },
    unlocks: ['knight_mission'],
    goldReward: 60,
  },
  {
    id: 'knight_mission',
    title: 'Kapitel 5: Der Ritt der Gerechten',
    description:
      'Deine Springer sind der Schlüssel zum Sieg. Nutze ihre Wendigkeit, um die feindliche Kavallerie zu umgehen.',
    opponentName: 'General Eisenherz',
    opponentPersonality: 'balanced',
    difficulty: 'hard',
    setupType: 'fixed',
    playerColor: 'white',
    fen: '4k4/9/9/9/2p1n1p2/3pNp3/3n1N3/9/4K4 w - - 0 1',
    winCondition: {
      type: 'checkmate',
      drawCountsAsWin: true,
    },
    unlocks: ['final_battle'],
    goals: {
      2: { type: 'moves', value: 20, description: 'Sieg in unter 20 Zügen' },
      3: { type: 'material', value: 3, description: 'Gewinne mit +3 Materialvorteil' },
    },
    goldReward: 80,
  },
  {
    id: 'final_battle',
    title: 'Kapitel 6: Der Kampf um den Eisernen Thron',
    description:
      'Der Imperator stellt sich dir im Thronsaal entgegen. Das Schicksal des Reiches liegt in deinen Händen!',
    opponentName: 'Der Imperator',
    opponentPersonality: 'expert',
    difficulty: 'expert',
    setupType: 'budget',
    playerBudget: 50,
    playerColor: 'white',
    fen: 'rnbakcbnr/ppppppppp/9/9/9/9/9/9/9 w KQkq - 0 1',
    winCondition: {
      type: 'checkmate',
    },
    unlocks: ['endgame_rook'],
    goals: {
      2: { type: 'moves', value: 30, description: 'Sieg in unter 30 Zügen' },
      3: { type: 'promotion', value: 1, description: 'Befördere einen Bauern zum Kanzler' },
    },
    goldReward: 150,
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
    goldReward: 20,
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
    goldReward: 20,
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
    goldReward: 30,
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
    goldReward: 40,
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
    goldReward: 50,
  },
];

export const CAMPAIGN_PERKS: Perk[] = [
  {
    id: 'stabile_bauern',
    name: 'Stabile Bauern',
    description: 'Deine Bauern zählen doppelt für den Materialvorteil.',
    icon: '🛡️',
    cost: 150,
  },
  {
    id: 'elite_garde',
    name: 'Elite-Garde',
    description: 'Starte Missionen mit +10 zusätzlichem Budget.',
    icon: '🎖️',
    cost: 250,
  },
  {
    id: 'taktik_genie',
    name: 'Taktik-Genie',
    description: 'Schaltet kostenlose Profi-Tipps während der Mission frei.',
    icon: '🧠',
    cost: 200,
  },
];
