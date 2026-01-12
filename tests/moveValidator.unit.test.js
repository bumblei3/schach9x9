
import { Game } from '../js/gameEngine.js';
import {
  isInsufficientMaterial,
  checkDraw,
  getBoardHash,
  calculateMaterialAdvantage,
} from '../js/move/MoveValidator.js';
import { BOARD_SIZE } from '../js/config.js';

describe('MoveValidator - Unit Tests', () => {
  let game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
  });

  test('should detect King vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Bishop vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'b', color: 'white' };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Knight vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'n', color: 'white' };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect King + Bishop vs King + Bishop (same color square) as insufficient', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'b', color: 'white' };
    game.board[7][7] = { type: 'b', color: 'black' };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should NOT detect King + Bishop vs King + Bishop (diff color square) as insufficient', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'b', color: 'white' };
    game.board[1][2] = { type: 'b', color: 'black' };
    expect(isInsufficientMaterial(game)).toBe(false);
  });

  test('should detect King + 2 Knights vs King as insufficient material', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'n', color: 'white' };
    game.board[2][2] = { type: 'n', color: 'white' };
    expect(isInsufficientMaterial(game)).toBe(true);
  });

  test('should detect 3-fold repetition draw', () => {
    const hash = 'temp-hash';
    game.positionHistory = [hash, hash, hash];
    game.board[0][0] = { type: 'k', color: 'white' }; // Any piece to satisfy getBoardHash if called

    // We need to satisfy getBoardHash returning 'temp-hash' or just mock it
    // Actually, checkDraw calls getBoardHash(game).
    // To make it return 'temp-hash', we'd need to set the board specially.
    // Or we just mock getBoardHash for this test.
    // But getBoardHash is exported, so we can't easily mock it in the same module.
    // Let's just set the board to something that generates a known hash.
    game.board[0][0] = { type: 'k', color: 'white', r: 0, c: 0 };
    const expectedHash = 'wk00;';
    game.positionHistory = [expectedHash, expectedHash, expectedHash];

    document.body.innerHTML = '<div id="game-over-overlay"></div><div id="winner-text"></div>';
    expect(checkDraw(game)).toBe(true);
  });

  test('should detect 50-move rule draw', () => {
    game.halfMoveClock = 100;
    document.body.innerHTML = '<div id="game-over-overlay"></div><div id="winner-text"></div>';
    expect(checkDraw(game)).toBe(true);
  });

  test('should generate board hash', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    const hash = getBoardHash(game);
    expect(hash).toContain('wk00');
  });

  test('should calculate material advantage', () => {
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.board[1][1] = { type: 'q', color: 'white' };
    game.board[7][7] = { type: 'r', color: 'black' };
    expect(calculateMaterialAdvantage(game)).toBe(4);
  });
});
