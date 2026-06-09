import { describe, test, expect, beforeEach } from 'vitest';
import { Game } from '../js/gameEngine.js';

describe('Game.executeMove - AI uses gameEngine executeMove directly', () => {
  let game: any;

  beforeEach(() => {
    game = new Game(10, 'classic');
  });

  test('game.executeMove switches turn correctly', () => {
    const piece = game.board[6][4]; // White pawn
    expect(piece).toBeTruthy();
    expect(piece.color).toBe('white');

    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

    const moves = game.getValidMoves(6, 4, piece);
    expect(moves.length).toBeGreaterThan(0);

    const target = moves[0];
    const turnBefore = game.turn;

    game.executeMove({ r: 6, c: 4 }, target);

    expect(game.turn).toBe(turnBefore === 'white' ? 'black' : 'white');
  });

  test('AI turn flow: white moves, then black (AI) moves', () => {
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    // White moves pawn
    const whiteMoves = game.getValidMoves(6, 4, game.board[6][4]);
    expect(whiteMoves.length).toBeGreaterThan(0);
    game.executeMove({ r: 6, c: 4 }, whiteMoves[0]);
    expect(game.turn).toBe('black');

    // AI: get legal moves for black
    const blackMoves = game.getAllLegalMoves('black');
    expect(blackMoves.length).toBeGreaterThan(0);

    // AI executes a move
    const aiMove = blackMoves[0];
    game.executeMove(aiMove.from, aiMove.to);
    expect(game.turn).toBe('white');
  });
});
