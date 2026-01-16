import { describe, it, expect } from 'vitest';
import { Game } from '../js/gameEngine.js';
import { generatePGN } from '../js/utils/PGNGenerator.js';

describe('PGN Generator - Cross Mode', () => {
  it('should include Variant: Cross and FEN headers for cross mode games', () => {
    const game = new Game(15, 'cross');
    const pgn = generatePGN(game);

    expect(pgn).toContain('[Variant "Cross"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(
      '[FEN "3pp3/3pp3/3pp3/pppppppp/pppkpppb/pppppppp/3pp3/3pp3/3pp3 w - - 0 1"]'
    );
  });

  it('should generate standard PGN for standard boards', () => {
    const game = new Game(15, 'setup'); // starts as standard
    const pgn = generatePGN(game);

    expect(pgn).toContain('[Variant "9x9"]');
    expect(pgn).not.toContain('[Variant "Cross"]');
  });

  it('should include moves in Cross Mode PGN', () => {
    const game = new Game(15, 'cross');
    // Simple pawn move: d3-d4 (3,3) to (4,3)
    // In 9x9 notation d3 is col 3, row 6. d4 is col 3, row 5.
    // Wait, moveToNotation uses colToFile and rowToRank.
    // col 3 -> 'd'. row 6 -> rank 9-6=3. Correct.
    game.moveHistory = [
      {
        from: { r: 6, c: 3 },
        to: { r: 5, c: 3 },
        piece: { type: 'p', color: 'white' },
      },
    ];

    const pgn = generatePGN(game);
    expect(pgn).toContain('1. d4');
  });
});
