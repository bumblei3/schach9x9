import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpeningTrainerModeStrategy } from '../js/modes/strategies/OpeningTrainerMode';
import { OpeningBook } from '../js/ai/OpeningBook';
import { OpeningTrainerManager } from '../js/openingTrainer';
import { OpeningTrainerMenu } from '../js/ui/OpeningTrainerMenu';

import * as UI from '../js/ui';

vi.mock('../js/ui', () => ({
  renderBoard: vi.fn(),
}));

/**
 * Build a minimal GameExtended-shaped fake. The strategy only touches
 * board / turn / selectedSquare / validMoves / getValidMoves / phase, plus
 * UI.renderBoard (mocked). `getValidMoves` returns the configured valid set.
 */
function makeGame(validMoves: { r: number; c: number }[] = []) {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  board[6][4] = { type: 'k', color: 'white', hasMoved: false };
  board[8][4] = { type: 'k', color: 'black', hasMoved: false };
  return {
    phase: 'PLAY' as unknown as typeof board,
    board,
    turn: 'white' as const,
    selectedSquare: null as { r: number; c: number } | null,
    validMoves: null as { r: number; c: number }[] | null,
    getValidMoves: () => validMoves,
  } as unknown as GameLike;
}

type Square = { r: number; c: number };
type GameLike = {
  phase: unknown;
  board: (null | { type: string; color: string; hasMoved: boolean })[][];
  turn: 'white' | 'black';
  selectedSquare: Square | null;
  validMoves: Square[] | null;
  getValidMoves: () => Square[];
};

function makeController() {
  return {
    submitTrainerMove: vi.fn(),
  } as unknown as {
    submitTrainerMove: ReturnType<typeof vi.fn>;
  };
}

describe('OpeningTrainerModeStrategy', () => {
  let game: GameLike;
  let controller: { submitTrainerMove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    game = makeGame([{ r: 4, c: 4 }]);
    controller = makeController();
  });

  it('first click on an own piece selects it and returns true', async () => {
    const strategy = new OpeningTrainerModeStrategy(controller as never);
    // Click the white king at (6,4)
    const handled = await strategy.handleInteraction(game as never, controller as never, 6, 4);

    expect(handled).toBe(true);
    expect(game.selectedSquare).toEqual({ r: 6, c: 4 });
    expect(game.validMoves).toEqual([{ r: 4, c: 4 }]);
    expect(UI.renderBoard).toHaveBeenCalledTimes(1);
    expect(controller.submitTrainerMove).not.toHaveBeenCalled();
  });

  it('second click on a valid target calls submitTrainerMove with from/to', async () => {
    const strategy = new OpeningTrainerModeStrategy(controller as never);

    await strategy.handleInteraction(game as never, controller as never, 6, 4); // select
    const handled = await strategy.handleInteraction(game as never, controller as never, 4, 4); // move

    expect(handled).toBe(true);
    expect(controller.submitTrainerMove).toHaveBeenCalledWith({
      from: { r: 6, c: 4 },
      to: { r: 4, c: 4 },
    });
    // Selection cleared after a move.
    expect(game.selectedSquare).toBeNull();
    expect(game.validMoves).toBeNull();
  });

  it('clicking elsewhere deselects and returns true', async () => {
    const strategy = new OpeningTrainerModeStrategy(controller as never);

    await strategy.handleInteraction(game as never, controller as never, 6, 4); // select
    const handled = await strategy.handleInteraction(game as never, controller as never, 2, 2); // empty

    expect(handled).toBe(true);
    expect(game.selectedSquare).toBeNull();
    expect(game.validMoves).toBeNull();
    expect(controller.submitTrainerMove).not.toHaveBeenCalled();
  });

  it('clicking a different own piece re-selects instead of moving', async () => {
    game.board[6][2] = { type: 'q', color: 'white', hasMoved: false };
    const strategy = new OpeningTrainerModeStrategy(controller as never);

    await strategy.handleInteraction(game as never, controller as never, 6, 4); // select king
    const handled = await strategy.handleInteraction(game as never, controller as never, 6, 2); // select queen

    expect(handled).toBe(true);
    expect(game.selectedSquare).toEqual({ r: 6, c: 2 });
    expect(controller.submitTrainerMove).not.toHaveBeenCalled();
  });

  it('first click on empty/enemy square swallows the click (returns true, no fall-through)', async () => {
    const strategy = new OpeningTrainerModeStrategy(controller as never);
    // Click an empty square (2,2) — must NOT fall through to MoveController.
    const handled = await strategy.handleInteraction(game as never, controller as never, 2, 2);

    expect(handled).toBe(true);
    expect(game.selectedSquare).toBeNull();
    expect(controller.submitTrainerMove).not.toHaveBeenCalled();
  });

  it('wrong move reports correct=false via manager submitMove', () => {
    const book = new OpeningBook({
      positions: {
        [serializeBoard()]: {
          seenCount: 0,
          moves: [{ from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, weight: 1, games: 1 }],
        },
      },
    });
    const mgr = new OpeningTrainerManager(book, {
      streak: 0,
      attempts: 0,
      correct: 0,
      solvedHashes: [],
    });
    const pos = mgr.getNextPosition();
    expect(pos).not.toBeNull();

    // Submit a move that does NOT match the expected (6,4)->(4,4).
    const res = mgr.submitMove(pos!, { from: { r: 6, c: 4 }, to: { r: 3, c: 3 } });
    expect(res.correct).toBe(false);
    expect(mgr.progress.streak).toBe(0);
    expect(mgr.progress.attempts).toBe(1);
  });

  it('onPhaseEnd is a safe no-op', () => {
    const strategy = new OpeningTrainerModeStrategy(controller as never);
    expect(() => strategy.onPhaseEnd(game as never, controller as never)).not.toThrow();
  });

  it('ignores clicks when not in PLAY phase', async () => {
    game.phase = 'SETUP' as unknown;
    const strategy = new OpeningTrainerModeStrategy(controller as never);

    const handled = await strategy.handleInteraction(game as never, controller as never, 6, 4);

    expect(handled).toBe(false);
    expect(game.selectedSquare).toBeNull();
    expect(controller.submitTrainerMove).not.toHaveBeenCalled();
  });
});

describe('OpeningTrainerMenu.updateProgress', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function makeManager(streak: number, solved: number, attempts: number, correct: number) {
    const book = new OpeningBook({ positions: {} });
    return new OpeningTrainerManager(book, {
      streak,
      attempts,
      correct,
      solvedHashes: Array.from({ length: solved }, (_, i) => `hash${i}`),
    });
  }

  it('reflects updated manager progress after updateProgress()', () => {
    const mgr = makeManager(0, 0, 0, 0);
    const menu = new OpeningTrainerMenu(container, mgr, () => {});

    const before = container.textContent ?? '';
    expect(before).toContain('Streak: 0');
    expect(before).toContain('Solved: 0');

    // Mutate progress (simulating a submitted move) and re-render readout.
    mgr.progress.streak = 5;
    mgr.progress.solvedHashes.push('hash0');
    mgr.progress.attempts = 6;
    mgr.progress.correct = 5;

    menu.updateProgress();

    const after = container.textContent ?? '';
    expect(after).toContain('Streak: 5');
    expect(after).toContain('Solved: 1');
    expect(after).toContain('Accuracy: 83%');
  });

  it('constructs a real manager position and checks submitMove + menu update round-trip', () => {
    // Build a tiny book with one position so we can exercise the manager flow.
    const hash = serializeBoard();
    const book = new OpeningBook({
      positions: {
        [hash]: {
          seenCount: 0,
          moves: [{ from: { r: 6, c: 4 }, to: { r: 4, c: 4 }, weight: 1, games: 1 }],
        },
      },
    });
    const mgr = new OpeningTrainerManager(book, {
      streak: 0,
      attempts: 0,
      correct: 0,
      solvedHashes: [],
    });

    const menu = new OpeningTrainerMenu(container, mgr, () => {});
    const pos = mgr.getNextPosition();
    expect(pos).not.toBeNull();

    const res = mgr.submitMove(pos!, { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } });
    expect(res.correct).toBe(true);
    expect(mgr.progress.streak).toBe(1);

    menu.updateProgress();
    expect(container.textContent).toContain('Streak: 1');
  });
});

/**
 * Build a (near-empty) board hash so the manager has data to pick from.
 * Mirrors reconstructBoardFromHash encoding: 2 chars per square + trailing turn.
 */
function serializeBoard(): string {
  let body = '';
  for (let i = 0; i < 81; i++) {
    body += '..';
  }
  return body + 'w';
}
