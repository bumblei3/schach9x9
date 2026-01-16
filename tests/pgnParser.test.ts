import { describe, expect, beforeEach, it } from 'vitest';
import { PGNParser } from '../js/utils/PGNParser.js';
import { Game } from '../js/gameEngine.js';

describe('PGNParser', () => {
  let parser: PGNParser;

  beforeEach(() => {
    parser = new PGNParser();
  });

  describe('parse()', () => {
    it('should parse simple PGN strings', () => {
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

    it('should handle empty input', () => {
      const games = parser.parse('');
      expect(games.length).toBe(0);
    });

    it('should handle PGN with comments', () => {
      const pgn = `
[Event "Commented Game"]
1. e4 {Best move!} e5 {Solid response} 2. Nf3 *
      `;
      const games = parser.parse(pgn);
      expect(games.length).toBe(1);
      expect(games[0].moves).toEqual(['e4', 'e5', 'Nf3']);
    });

    it('should parse various result formats', () => {
      const pgn1 = '[Event "Test"]\n1. e4 1-0';
      const pgn2 = '[Event "Test"]\n1. e4 0-1';
      const pgn3 = '[Event "Test"]\n1. e4 1/2-1/2';

      expect(parser.parse(pgn1)[0].headers.Result).toBe('1-0');
      expect(parser.parse(pgn2)[0].headers.Result).toBe('0-1');
      expect(parser.parse(pgn3)[0].headers.Result).toBe('1/2-1/2');
    });

    it('should handle multiple header tags', () => {
      const pgn = `
[Event "Tournament"]
[Site "Berlin"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]

1. e4 *
      `;
      const games = parser.parse(pgn);
      expect(games[0].headers.Event).toBe('Tournament');
      expect(games[0].headers.Site).toBe('Berlin');
      expect(games[0].headers.White).toBe('Player1');
      expect(games[0].headers.Black).toBe('Player2');
    });

    it('should ignore malformed header tags', () => {
      const pgn = `
[Event "Valid"]
[Malformed Header]
1. e4 *
      `;
      const games = parser.parse(pgn);
      expect(games[0].headers.Event).toBe('Valid');
      expect(games[0].headers['Malformed']).toBeUndefined();
    });
  });

  describe('replayGame()', () => {
    it('should replay pawn moves on game engine', () => {
      const game = new Game(15, 'classic');
      const moves = ['e4'];
      const history = parser.replayGame(moves, game);

      expect(history.length).toBe(1);
      expect(history[0].san).toBe('e4');
      expect(history[0].move).toBeDefined();
      expect(history[0].move!.from.r).toBe(7);
      expect(history[0].move!.from.c).toBe(4);
      expect(history[0].move!.to.r).toBe(5);
      expect(game.turn).toBe('black');
    });

    it('should handle invalid moves gracefully', () => {
      const game = new Game(15, 'classic');
      const moves = ['Qxd8']; // Invalid first move
      const history = parser.replayGame(moves, game);
      expect(history.length).toBe(0);
    });

    it('should record board hash for each move', () => {
      const game = new Game(15, 'classic');
      const moves = ['e4'];
      const history = parser.replayGame(moves, game);
      expect(history[0].hash).toBeDefined();
      expect(typeof history[0].hash).toBe('string');
    });
  });

  describe('generateNotationForCheck()', () => {
    it('should generate pawn notation', () => {
      const game = new Game(15, 'classic');
      const legalMoves = game.getAllLegalMoves('white');
      const e4Move = legalMoves.find(
        m => m.from.c === 4 && m.from.r === 7 && m.to.r === 5 && m.to.c === 4
      );

      if (e4Move) {
        const notation = parser.generateNotationForCheck(e4Move, game, legalMoves);
        expect(notation).toBe('e4');
      } else {
        throw new Error("e4 move not found");
      }
    });

    it('should generate piece notation', () => {
      const game = new Game(15, 'classic');
      const legalMoves = game.getAllLegalMoves('white');

      // Find knight move Nf3
      const nf3Move = legalMoves.find(m => {
        const piece = game.board[m.from.r][m.from.c];
        return piece && piece.type === 'n' && m.to.c === 5 && m.to.r === 6;
      });

      if (nf3Move) {
        const notation = parser.generateNotationForCheck(nf3Move, game, legalMoves);
        expect(notation).toBe('Nf3');
      }
    });

    it('should handle empty square', () => {
      const game = new Game(15, 'classic');
      const fakeMove = { from: { r: 4, c: 4 }, to: { r: 3, c: 3 } } as any;
      const notation = parser.generateNotationForCheck(fakeMove, game, []);
      expect(notation).toBe('');
    });

    it('should generate castling notation', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      // King at 8,4
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

      const castleShort = { from: { r: 8, c: 4 }, to: { r: 8, c: 6 } } as any;
      const notationShort = parser.generateNotationForCheck(castleShort, game, []);
      expect(notationShort).toBe('O-O');

      const castleLong = { from: { r: 8, c: 4 }, to: { r: 8, c: 2 } } as any;
      const notationLong = parser.generateNotationForCheck(castleLong, game, []);
      expect(notationLong).toBe('O-O-O');

      game.board[5][5] = { type: 'k', color: 'white', hasMoved: false };
      game.board[4][5] = null;
      const kingMove = { from: { r: 5, c: 5 }, to: { r: 4, c: 5 } } as any;
      const notationKing = parser.generateNotationForCheck(kingMove, game, []);
      expect(notationKing).toBe('Kf5'); // r4 is rank 5, c5 is f
    });

    it('should generate pawn capture notation', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      game.board[4][4] = { type: 'p', color: 'white', hasMoved: false };
      game.board[3][5] = { type: 'p', color: 'black', hasMoved: false };
      const move = { from: { r: 4, c: 4 }, to: { r: 3, c: 5 } } as any;
      const notation = parser.generateNotationForCheck(move, game, []);
      expect(notation).toBe('exf6');
    });

    it('should handle piece disambiguation (column)', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      game.board[7][1] = { type: 'n', color: 'white', hasMoved: false }; // Nb1
      game.board[7][6] = { type: 'n', color: 'white', hasMoved: false }; // Ng1
      const move = { from: { r: 7, c: 1 }, to: { r: 5, c: 2 } } as any;
      const allMoves = [move, { from: { r: 7, c: 6 }, to: { r: 5, c: 2 } }] as any;
      const notation = parser.generateNotationForCheck(move, game, allMoves);
      expect(notation).toBe('Nbc4');
    });

    it('should handle piece disambiguation (row)', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      game.board[3][3] = { type: 'r', color: 'white', hasMoved: true };
      game.board[5][3] = { type: 'r', color: 'white', hasMoved: true };
      const move = { from: { r: 3, c: 3 }, to: { r: 4, c: 3 } } as any;
      const allMoves = [move, { from: { r: 5, c: 3 }, to: { r: 4, c: 3 } }] as any;
      const notation = parser.generateNotationForCheck(move, game, allMoves);
      expect(notation).toBe('R6d5');
    });

    it('should handle piece disambiguation (both)', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      game.board[3][3] = { type: 'q', color: 'white', hasMoved: false };
      game.board[3][5] = { type: 'q', color: 'white', hasMoved: false };
      game.board[5][3] = { type: 'q', color: 'white', hasMoved: false };
      const move = { from: { r: 3, c: 3 }, to: { r: 4, c: 4 } } as any;
      const allMoves = [
        move,
        { from: { r: 3, c: 5 }, to: { r: 4, c: 4 } },
        { from: { r: 5, c: 3 }, to: { r: 4, c: 4 } },
      ] as any;
      const notation = parser.generateNotationForCheck(move, game, allMoves);
      expect(notation).toBe('Qd6e5');
    });

    it('should generate piece capture notation', () => {
      const game = new Game(15, 'classic');
      game.board = Array(9).fill(null).map(() => Array(9).fill(null)) as any;
      game.board[3][3] = { type: 'r', color: 'white', hasMoved: true };
      game.board[3][5] = { type: 'p', color: 'black', hasMoved: true };
      const move = { from: { r: 3, c: 3 }, to: { r: 3, c: 5 } } as any;
      const notation = parser.generateNotationForCheck(move, game, []);
      expect(notation).toBe('Rxf6');
    });
  });
});
