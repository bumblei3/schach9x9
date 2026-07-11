import { describe, expect, test, beforeEach } from 'vitest';
import { Game, type PieceWithMoved } from '../js/gameEngine.js';
import {
  isInsufficientMaterial,
  checkDraw,
  getBoardHash,
  calculateMaterialAdvantage,
} from '../js/move/MoveValidator.js';
import { BOARD_SIZE } from '../js/config.js';
import { campaignManager } from '../js/campaign/CampaignManager.js';

describe('MoveValidator - Unit Tests', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    // Ensure board is fully initialized or overridden correctly
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null as PieceWithMoved | null));
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

describe('MoveValidator.calculateMaterialAdvantage — piece values & invariants', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game(15, 'classic');
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null as PieceWithMoved | null));
    // default: no campaign, so the stabile_bauern perk branch is skipped
    game.campaignMode = false;
  });

  test('sums known PIECE_VALUES (p1 n3 b3 r5 j6 a7 c8 q9 e12 k0)', () => {
    // One of every type per side -> advantage must be exactly 0 (symmetric).
    const whiteTypes = ['p', 'n', 'b', 'r', 'j', 'a', 'c', 'q', 'e'] as const;
    const blackTypes = ['p', 'n', 'b', 'r', 'j', 'a', 'c', 'q', 'e'] as const;
    whiteTypes.forEach((t, i) => {
      game.board[0][i] = { type: t, color: 'white', hasMoved: false };
    });
    blackTypes.forEach((t, i) => {
      game.board[8][i] = { type: t, color: 'black', hasMoved: false };
    });
    // Sum white == sum black -> symmetric material -> 0
    expect(calculateMaterialAdvantage(game)).toBe(0);
  });

  test('white advantage equals (white sum) - (black sum)', () => {
    game.board[0][0] = { type: 'q', color: 'white', hasMoved: false }; // 9
    game.board[8][8] = { type: 'q', color: 'black', hasMoved: false }; // 9
    game.board[1][1] = { type: 'r', color: 'white', hasMoved: false }; // 5
    game.board[7][7] = { type: 'b', color: 'black', hasMoved: false }; // 3
    // White 14, black 12 -> +2
    expect(calculateMaterialAdvantage(game)).toBe(2);
  });

  test('king contributes 0 to material on both sides', () => {
    game.board[0][0] = { type: 'k', color: 'white', hasMoved: false };
    game.board[8][8] = { type: 'k', color: 'black', hasMoved: false };
    game.board[1][1] = { type: 'p', color: 'white', hasMoved: false }; // 1
    game.board[7][7] = { type: 'p', color: 'black', hasMoved: false }; // 1
    // Kings are worth 0, so the two pawns cancel -> 0
    expect(calculateMaterialAdvantage(game)).toBe(0);
  });

  test('unknown piece type contributes 0 (PIECE_VALUES fallback)', () => {
    const fake = { type: 'z', color: 'white', hasMoved: false } as unknown as PieceWithMoved;
    const fakeB = { type: 'z', color: 'black', hasMoved: false } as unknown as PieceWithMoved;
    game.board[0][0] = fake;
    game.board[8][8] = fakeB;
    // 'z' is not in PIECE_VALUES -> value 0 for both -> advantage 0
    expect(calculateMaterialAdvantage(game)).toBe(0);
  });

  test('stabile_bauern perk doubles white pawn value', () => {
    // Activate the perk via the public unlock API on the singleton.
    campaignManager.unlockPerk('stabile_bauern');
    game.campaignMode = true;
    game.board[0][0] = { type: 'p', color: 'white', hasMoved: false }; // normally 1, doubled -> 2
    game.board[8][8] = { type: 'p', color: 'black', hasMoved: false }; // 1
    // White 2, black 1 -> +1 (instead of 0 without the perk)
    expect(calculateMaterialAdvantage(game)).toBe(1);
  });

  test('stabile_bauern perk leaves black pawns unchanged', () => {
    campaignManager.unlockPerk('stabile_bauern');
    game.campaignMode = true;
    game.board[0][0] = { type: 'p', color: 'white', hasMoved: false }; // doubled -> 2
    game.board[8][8] = { type: 'p', color: 'black', hasMoved: false }; // unchanged -> 1
    game.board[1][1] = { type: 'p', color: 'black', hasMoved: false }; // unchanged -> 1
    // White 2, black 2 -> 0
    expect(calculateMaterialAdvantage(game)).toBe(0);
  });
});
