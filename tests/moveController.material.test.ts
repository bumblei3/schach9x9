import { describe, expect, test, beforeEach } from 'vitest';
import { Game, type PieceWithMoved } from '../js/gameEngine.js';
import { MoveController } from '../js/moveController.js';
import { campaignManager } from '../js/campaign/CampaignManager.js';
import { BOARD_SIZE } from '../js/config.js';

// `getMaterialValue` is DOM-free pure logic: it maps a piece to its base
// PIECE_VALUES entry, then (in campaign mode, own colour) applies an
// XP-level multiplier and a champion flat bonus. These branches were
// previously uncovered.

function emptyBoard(): (null | PieceWithMoved)[][] {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null as PieceWithMoved | null));
}

describe('MoveController.getMaterialValue — base, RPG & champion', () => {
  let game: Game;
  let controller: MoveController;

  beforeEach(() => {
    game = new Game(15, 'classic');
    game.board = emptyBoard();
    // No campaign by default -> RPG/champion branches skipped.
    game.mode = 'classic';
    game.playerColor = 'white';
    // Reset the campaignManager singleton's state so tests are isolated
    // (it persists across tests otherwise). `state` is private, accessed
    // via an intentional any-cast for test isolation.
    (campaignManager as unknown as { state: { unitXp: Record<string, unknown>; championType: string | null } }).state = {
      unitXp: {},
      championType: null,
    };
    controller = new MoveController(game);
  });

  test('null piece contributes 0', () => {
    expect(controller.getMaterialValue(null)).toBe(0);
  });

  test('unknown piece type contributes 0 (PICE_VALUES fallback)', () => {
    const fake = { type: 'z', color: 'white', hasMoved: false } as unknown as PieceWithMoved;
    expect(controller.getMaterialValue(fake)).toBe(0);
  });

  test('non-campaign mode returns the bare PICE_VALUES entry', () => {
    game.mode = 'classic';
    const pawn = { type: 'p', color: 'white', hasMoved: false } as PieceWithMoved;
    expect(controller.getMaterialValue(pawn)).toBe(1); // p = 1
    const queen = { type: 'q', color: 'black', hasMoved: false } as PieceWithMoved;
    expect(controller.getMaterialValue(queen)).toBe(9); // q = 9
  });

  test('campaign + own colour + xp level > 1 applies the +10%/level multiplier', () => {
    game.mode = 'campaign';
    game.playerColor = 'white';
    // Grant the white pawn enough XP to reach level 2 (>=100).
    campaignManager.addUnitXp('p', 100);
    const pawn = { type: 'p', color: 'white', hasMoved: false } as PieceWithMoved;
    // base 1 * (1 + (2-1)*0.1) = 1.1
    expect(controller.getMaterialValue(pawn)).toBeCloseTo(1.1, 5);
  });

  test('campaign but enemy colour gets no RPG multiplier', () => {
    game.mode = 'campaign';
    game.playerColor = 'white'; // black pawn is NOT the player's colour
    campaignManager.addUnitXp('p', 100); // would level a white pawn, not black
    const pawn = { type: 'p', color: 'black', hasMoved: false } as PieceWithMoved;
    // No multiplier -> bare value 1
    expect(controller.getMaterialValue(pawn)).toBe(1);
  });

  test('campaign + own champion piece gets the flat +0.5 bonus', () => {
    game.mode = 'campaign';
    game.playerColor = 'white';
    campaignManager.setChampion('p'); // white pawn is the champion
    const pawn = { type: 'p', color: 'white', hasMoved: false } as PieceWithMoved;
    // base 1 + 0.5 champion bonus = 1.5
    expect(controller.getMaterialValue(pawn)).toBeCloseTo(1.5, 5);
  });

  test('champion bonus is independent of xp level', () => {
    game.mode = 'campaign';
    game.playerColor = 'white';
    campaignManager.setChampion('q'); // queen champion, no xp grinding
    const queen = { type: 'q', color: 'white', hasMoved: false } as PieceWithMoved;
    // base 9 + 0.5 = 9.5
    expect(controller.getMaterialValue(queen)).toBeCloseTo(9.5, 5);
  });
});
