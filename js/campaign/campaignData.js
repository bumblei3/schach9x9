/**
 * Campaign Levels Configuration
 * Defines the scenarios for the single-player campaign.
 */

export const CAMPAIGN_LEVELS = [
    {
        id: 'tutorial_1',
        title: 'Kapitel 1: Der Hinterhalt',
        description: 'Eine kleine Patrouille wurde überrascht. Besiege den gegnerischen Anführer mit deinen begrenzten Truppen.',
        difficulty: 'easy',
        playerColor: 'white',
        // Custom FEN: White has King + 2 K, Black has King + 2 Pawns (simplified for testing)
        // Using standard 9x9 layout but removing pieces
        // 9/9/9/9/9/9/4k4/4P4/4K4 w - - 0 1
        fen: '8/8/8/8/8/3k5/8/3P4/3K4 w - - 0 1',
        winCondition: {
            type: 'checkmate'
        },
        unlocks: ['skirmish_1']
    },
    {
        id: 'skirmish_1',
        title: 'Kapitel 2: Die Brücke',
        description: 'Halte die Brücke gegen den Ansturm. Du hast den Vorteil der Engel.',
        difficulty: 'medium',
        playerColor: 'white',
        // More complex setup
        fen: 'rnbqkbnr/pppppppp/9/9/9/9/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Standard start for now, placeholder 
        winCondition: {
            type: 'checkmate'
        },
        unlocks: ['boss_1']
    },
    {
        id: 'boss_1',
        title: 'Kapitel 3: Der Dunkle Turm',
        description: 'Stürze den König in seiner Festung. Er ist schwer bewacht.',
        difficulty: 'hard',
        playerColor: 'white',
        fen: '8/8/8/3ppp3/3pkp3/3ppp3/8/8/RNBQKBNR w KQkq - 0 1',
        winCondition: {
            type: 'checkmate'
        },
        unlocks: []
    }
];
