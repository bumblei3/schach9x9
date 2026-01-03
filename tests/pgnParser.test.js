import { PGNParser } from '../js/utils/PGNParser.js';
import { Game } from '../js/gameEngine.js';

describe('PGNParser', () => {
  it('should parse simple PGN strings', () => {
    const parser = new PGNParser();
    const pgn = `
[Event "Test"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0
    `;
    const games = parser.parse(pgn);
    expect(games.length).toBe(1);
    expect(games[0].headers.Event).toBe('Test');
    expect(games[0].moves.length).toBe(4);
    expect(games[0].moves[0]).toBe('e4');
  });

  it('should handle multiple games', () => {
    const parser = new PGNParser();
    const pgn = `
[Event "Game 1"]
1. e4 *

[Event "Game 2"]
1. d4 *
    `;
    const games = parser.parse(pgn);
    expect(games.length).toBe(2);
    expect(games[0].moves[0]).toBe('e4');
    expect(games[1].moves[0]).toBe('d4');
  });

  it('should replay moves on game engine', () => {
    const parser = new PGNParser();
    // Use real game engine for integration test of replay logic
    const game = new Game(15, 'classic');

    // PGN: 1. e4
    // In 9x9 Classic: White Pawns at Rank 2 (index 7). e-file is index 4.
    // e4 is Rank 4 (index 5). 7 -> 5 is a step of -2. valid double push.

    const moves = ['e4'];
    const history = parser.replayGame(moves, game);

    expect(history.length).toBe(1);
    expect(history[0].san).toBe('e4');
    expect(history[0].move).toBeDefined();
    expect(history[0].move.from.r).toBe(7); // Rank 2
    expect(history[0].move.from.c).toBe(4); // File e
    expect(history[0].move.to.r).toBe(5); // Rank 4
    expect(history[0].move.to.c).toBe(4); // File e

    // Check game state updated
    expect(game.turn).toBe('black');
    expect(game.board[5][4]).not.toBeNull(); // Pawn moved
  });
});
