import { describe, test, expect, beforeEach } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import { OpeningTrainerMenu } from '../js/ui/OpeningTrainerMenu.js';
import { reconstructBoardFromHash } from '../js/openingTrainer.js';
import type { Player } from '../js/types/game.js';

describe('opening-trainer integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('startOpeningTrainerMode exists on GameController prototype', async () => {
    const { GameController } = await import('../js/gameController.js');
    expect(
      typeof (GameController.prototype as unknown as { startOpeningTrainerMode?: unknown })
        .startOpeningTrainerMode
    ).toBe('function');
  });

  test('menu onStart callback is wired to manager position flow', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        h1: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const manager = new OpeningTrainerManager(book);
    let started = 0;
    const container = document.createElement('div');
    const menu = new OpeningTrainerMenu(container, manager, () => {
      started++;
    });
    // The manager has a position; clicking start should invoke the callback.
    expect(manager.getNextPosition()).not.toBeNull();
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(started).toBe(1);
    menu.destroy();
  });

  test('controller position flow reconstructs board into game state', () => {
    // Mirrors the core of GameController.startOpeningTrainerMode without
    // instantiating the full controller (heavy UI deps). Verifies that a
    // book position is reconstructed and would populate game.board/game.turn.
    const book = new OpeningBook();
    type Cell = { type: string; color: 'white' | 'black'; hasMoved: boolean } | null;
    const board: Cell[][] = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null as Cell)
    );
    board[0][0] = { type: 'p', color: 'white', hasMoved: false };
    const hash = book.getBoardHash(board as never, 'white');
    book.load({
      positions: {
        [hash]: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });

    const manager = new OpeningTrainerManager(book);
    const pos = manager.getNextPosition();
    expect(pos).not.toBeNull();

    const game: { board: Cell[][] | null; turn: Player } = {
      board: null,
      turn: 'white',
    };
    const { board: reconBoard, turn } = reconstructBoardFromHash(pos!.hash);
    game.board = reconBoard as Cell[][];
    game.turn = turn;

    expect(game.board![0][0]).not.toBeNull();
    expect(game.board![0][0]).toEqual({ type: 'p', color: 'white', hasMoved: true });
    expect(game.turn).toBe('white');
  });
});
