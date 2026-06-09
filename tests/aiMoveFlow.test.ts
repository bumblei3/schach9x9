import { describe, test, expect, beforeEach } from 'vitest';
import { Game } from '../js/gameEngine.js';

describe('Game.executeMove - AI uses gameEngine executeMove directly', () => {
  let game: any;

  beforeEach(() => {
    game = new Game(10, 'classic');
  });

  test('game.executeMove switches turn correctly', () => {
    // White pawns are at row size-2 = 7 for size 9
    const piece = game.board[7][4]; // White pawn
    expect(piece).toBeTruthy();
    expect(piece.color).toBe('white');

    // White king at row size-1 = 8
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

    const moves = game.getValidMoves(7, 4, piece);
    expect(moves.length).toBeGreaterThan(0);

    const target = moves[0];
    const turnBefore = game.turn;

    game.executeMove({ r: 7, c: 4 }, target);

    expect(game.turn).toBe(turnBefore === 'white' ? 'black' : 'white');
  });

  test('AI turn flow: white moves, then black (AI) moves', () => {
    // Setup kings
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    // White pawn
    game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };

    // White moves pawn forward
    const whiteMoves = game.getValidMoves(7, 4, game.board[7][4]);
    expect(whiteMoves.length).toBeGreaterThan(0);
    game.executeMove({ r: 7, c: 4 }, whiteMoves[0]);
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
