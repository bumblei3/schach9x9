import { describe, expect, test, beforeEach } from 'vitest';
import { Game } from '../js/gameEngine.js';
import {
  isInsufficientMaterial,
  checkDraw,
  getBoardHash,
  calculateMaterialAdvantage,
} from '../js/move/MoveValidator.js';
import { BOARD_SIZE } from '../js/config.js';

describe('MoveValidator - Unit Tests', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    // Ensure board is fully initialized or overridden correctly
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null)) as any;
  });

  test('should detect King vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Bishop vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'b', color: 'white', hasMoved: false };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Knight vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'n', color: 'white', hasMoved: false };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Bishop vs King + Bishop (same color square) as insufficient', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'b', color: 'white', hasMoved: false };
    game.board[7][7] = { type: 'b', color: 'black', hasMoved: false };
    // Assuming implementation checks square color logic correctly for insufficient material
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should NOT detect King + Bishop vs King + Bishop (diff color square) as insufficient', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'b', color: 'white', hasMoved: false };
    game.board[1][2] = { type: 'b', color: 'black', hasMoved: false };
    expect(isInsufficientMaterial(game)).toBe(false);
  });

  test('should detect King + 2 Knights vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'n', color: 'white', hasMoved: false };
    game.board[2][2] = { type: 'n', color: 'white', hasMoved: false };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect 3-fold repetition draw', () => {
    // We need to satisfy getBoardHash returning 'wk00;' or similar.
    // Setting clean board state for hash:
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    const expectedHash = 'wk00;';
    game.positionHistory = [expectedHash, expectedHash, expectedHash];

    document.body.innerHTML = '<div id="game-over-overlay"></div><div id="winner-text"></div>';

    // Check draw calls getBoardHash on current board
    // Ideally calculate what hash for single white king at 0,0 is:
    // It iterates board. If piece, appends `type+color+r+c;`
    // So 'wk00;' matches logic generally.

    expect(checkDraw(game)).toBe(true);
  });

  test('should detect 50-move rule draw', () => {
    game.halfMoveClock = 100;
    document.body.innerHTML = '<div id="game-over-overlay"></div><div id="winner-text"></div>';
    expect(checkDraw(game)).toBe(true);
  });

  test('should generate board hash', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    const hash = getBoardHash(game);
    expect(hash).toContain('wk00');
  });

  test('should calculate material advantage', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'q', color: 'white', hasMoved: false };
    game.board[7][7] = { type: 'r', color: 'black', hasMoved: false };
    // Queen (9) vs Rook (5) = +4
    expect(calculateMaterialAdvantage(game)).toBe(4);
  });
});
