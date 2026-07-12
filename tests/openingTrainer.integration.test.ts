import { describe, test, expect, beforeEach } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import { OpeningTrainerMenu } from '../js/ui/OpeningTrainerMenu.js';

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
});
