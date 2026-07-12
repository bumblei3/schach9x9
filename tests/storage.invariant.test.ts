/**
 * Invariant tests for js/storage.ts
 *
 * Supplements the existing storage.test.ts (functional coverage). Asserts the
 * algebraic properties the persistence layer must preserve:
 *   - save/load round-trip is isomorphic: a saved game loads back equal
 *   - slot isolation: distinct slot names never clobber one another
 *   - hasSave(slot) === (loadGame(slot) !== null) for any slot
 *   - loadStateIntoGame is null-safe (null state => false, no mutation) and
 *     fills documented defaults (boardShape='standard', empty captured pieces,
 *     selectedSquare/validMoves reset) while preserving deep structures
 *   - corrupt JSON in a slot triggers CORRUPT_SAVE (and does not poison hasSave)
 *   - autosave is the default slot and every slot round-trips independently
 * Pure module aside from localStorage (mocked).
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { StorageManager } from '../js/storage.js';
import { PHASES } from '../js/gameEngine.js';

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    _dump: () => store,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

function makeGame(over: Record<string, unknown> = {}): any {
  return {
    mode: 'classic',
    boardShape: 'cross' as const,
    difficulty: 'expert' as const,
    isAI: true,
    board: [
      [null, { type: 'k', color: 'white' }],
      [{ type: 'p', color: 'black' }, null],
    ],
    turn: 'black' as const,
    phase: PHASES.PLAY,
    points: 42,
    moveHistory: [
      { from: { r: 1, c: 1 }, to: { r: 3, c: 1 } },
      { from: { r: 7, c: 0 }, to: { r: 5, c: 0 } },
    ],
    capturedPieces: { white: [{ type: 'p', color: 'black' }], black: [{ type: 'n', color: 'white' }] },
    whiteTime: 123,
    blackTime: 456,
    clockEnabled: false,
    lastMove: { from: { r: 1, c: 1 }, to: { r: 3, c: 1 }, piece: { type: 'p', color: 'white' } },
    selectedSquare: { r: 3, c: 1 },
    validMoves: [{ r: 4, c: 1 }, { r: 5, c: 1 }],
    ...over,
  };
}

describe('save/load round-trip is isomorphic', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('a saved game loads back byte-for-byte identical (modulo function fields)', () => {
    const game = makeGame();
    expect(sm.saveGame(game, 'slot-a')).toBe(true);
    const loaded = sm.loadGame('slot-a');
    expect(loaded).not.toBeNull();
    expect(loaded!.mode).toBe('classic');
    expect(loaded!.boardShape).toBe('cross');
    expect(loaded!.difficulty).toBe('expert');
    expect(loaded!.turn).toBe('black');
    expect(loaded!.points).toBe(42);
    expect(loaded!.whiteTime).toBe(123);
    expect(loaded!.blackTime).toBe(456);
    expect(loaded!.clockEnabled).toBe(false);
    expect(loaded!.moveHistory).toEqual(game.moveHistory);
    expect(loaded!.capturedPieces).toEqual(game.capturedPieces);
    expect(loaded!.lastMove).toEqual(game.lastMove);
  });

  test('round-trip preserves deep board contents', () => {
    const game = makeGame();
    sm.saveGame(game, 'deep');
    const loaded = sm.loadGame('deep')!;
    expect(loaded.board).toHaveLength(2);
    expect(loaded.board[0][1]).toEqual({ type: 'k', color: 'white' });
    expect(loaded.board[1][0]).toEqual({ type: 'p', color: 'black' });
    expect(loaded.board[0][0]).toBeNull();
  });

  test('saveGame returns true on success and the key carries the slot name', () => {
    expect(sm.saveGame(makeGame(), 'my-slot')).toBe(true);
    const stored = localStorageMock._dump();
    const key = Object.keys(stored).find(k => k.includes('my-slot'));
    expect(key).toBe('schach9x9_save_my-slot');
    expect(() => JSON.parse(stored[key!])).not.toThrow();
  });
});

describe('slot isolation', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('distinct slots never clobber one another', () => {
    sm.saveGame(makeGame({ mode: 'classic', points: 1 }), 'slot-1');
    sm.saveGame(makeGame({ mode: 'campaign', points: 2 }), 'slot-2');
    sm.saveGame(makeGame({ mode: 'setup', points: 3 }), 'slot-3');

    expect(sm.loadGame('slot-1')!.mode).toBe('classic');
    expect(sm.loadGame('slot-1')!.points).toBe(1);
    expect(sm.loadGame('slot-2')!.mode).toBe('campaign');
    expect(sm.loadGame('slot-2')!.points).toBe(2);
    expect(sm.loadGame('slot-3')!.mode).toBe('setup');
    expect(sm.loadGame('slot-3')!.points).toBe(3);
  });

  test('re-saving the same slot overwrites only that slot', () => {
    sm.saveGame(makeGame({ points: 1 }), 'slot-1');
    sm.saveGame(makeGame({ points: 2 }), 'slot-2');
    sm.saveGame(makeGame({ points: 99 }), 'slot-1'); // overwrite slot-1 only

    expect(sm.loadGame('slot-1')!.points).toBe(99);
    expect(sm.loadGame('slot-2')!.points).toBe(2);
  });

  test('slot names with special characters stay isolated', () => {
    sm.saveGame(makeGame({ points: 7 }), 'a/b:c');
    sm.saveGame(makeGame({ points: 8 }), 'a-b-c');
    expect(sm.loadGame('a/b:c')!.points).toBe(7);
    expect(sm.loadGame('a-b-c')!.points).toBe(8);
  });
});

describe('hasSave consistency with loadGame', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('hasSave(slot) === (loadGame(slot) !== null) for any slot', () => {
    const slots = ['autosave', 's1', 's2', 'none', 'xyz'];
    for (const slot of slots) {
      expect(sm.hasSave(slot)).toBe(sm.loadGame(slot) !== null);
    }
    sm.saveGame(makeGame(), 's1');
    for (const slot of slots) {
      expect(sm.hasSave(slot)).toBe(sm.loadGame(slot) !== null);
    }
  });

  test('saving then clearing (removeItem) flips hasSave consistently', () => {
    sm.saveGame(makeGame(), 'tmp');
    expect(sm.hasSave('tmp')).toBe(true);
    localStorage.removeItem('schach9x9_save_tmp');
    expect(sm.hasSave('tmp')).toBe(false);
    expect(sm.loadGame('tmp')).toBeNull();
  });
});

describe('loadStateIntoGame null-safety & defaults', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('null state returns false and leaves the target untouched', () => {
    const target: Record<string, unknown> = { mode: 'untouched', points: 5 };
    const ok = sm.loadStateIntoGame(target as never, null);
    expect(ok).toBe(false);
    expect(target.mode).toBe('untouched');
    expect(target.points).toBe(5);
  });

  test('missing boardShape defaults to standard', () => {
    const game = makeGame();
    delete (game as Record<string, unknown>).boardShape;
    sm.saveGame(game, 'noshape');
    const loaded = sm.loadGame('noshape');
    const target: Record<string, unknown> = {};
    sm.loadStateIntoGame(target as never, loaded);
    expect(target.boardShape).toBe('standard');
  });

  test('missing capturedPieces falls back to empty buckets', () => {
    const game = makeGame();
    delete (game as Record<string, unknown>).capturedPieces;
    sm.saveGame(game, 'nocap');
    const loaded = sm.loadGame('nocap');
    const target: Record<string, unknown> = {};
    sm.loadStateIntoGame(target as never, loaded);
    expect(target.capturedPieces).toEqual({ white: [], black: [] });
  });

  test('selectedSquare and validMoves are reset (never carried over)', () => {
    const game = makeGame({ selectedSquare: { r: 3, c: 1 }, validMoves: [{ r: 4, c: 1 }] });
    sm.saveGame(game, 'sel');
    const loaded = sm.loadGame('sel');
    const target: Record<string, unknown> = { selectedSquare: 'STALE', validMoves: 'STALE' };
    sm.loadStateIntoGame(target as never, loaded);
    expect(target.selectedSquare).toBeNull();
    expect(target.validMoves).toBeNull();
  });

  test('restored game matches the original save (isomorphism of loadStateIntoGame)', () => {
    const game = makeGame();
    sm.saveGame(game, 'full');
    const loaded = sm.loadGame('full');
    const target: Record<string, unknown> = {};
    sm.loadStateIntoGame(target as never, loaded);
    expect(target.mode).toBe(game.mode);
    expect(target.difficulty).toBe(game.difficulty);
    expect(target.turn).toBe(game.turn);
    expect(target.phase).toBe(game.phase);
    expect(target.points).toBe(game.points);
    expect(target.board).toEqual(game.board);
    expect(target.moveHistory).toEqual(game.moveHistory);
    expect(target.capturedPieces).toEqual(game.capturedPieces);
    expect(target.lastMove).toEqual(game.lastMove);
    expect(target.whiteTime).toBe(game.whiteTime);
    expect(target.blackTime).toBe(game.blackTime);
    expect(target.clockEnabled).toBe(game.clockEnabled);
  });
});

describe('corrupt save handling', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('a non-JSON slot throws CORRUPT_SAVE and does not report hasSave', () => {
    localStorage.setItem('schach9x9_save_broken', '{not valid json');
    expect(sm.hasSave('broken')).toBe(true); // the key exists...
    expect(() => sm.loadGame('broken')).toThrow('CORRUPT_SAVE'); // ...but parsing fails
  });

  test('valid JSON with an unexpected shape is still returned (no validation guard)', () => {
    // loadGame only guards against unparseable JSON; a syntactically valid but
    // shape-less object passes through as-is (callers must tolerate missing fields).
    localStorage.setItem('schach9x9_save_weird', JSON.stringify({ foo: 'bar' }));
    const loaded = sm.loadGame('weird');
    expect(loaded).not.toBeNull();
    expect((loaded as unknown as Record<string, unknown>).foo).toBe('bar');
  });

  test('a corrupt slot does not poison a healthy sibling slot', () => {
    localStorage.setItem('schach9x9_save_broken', '###');
    sm.saveGame(makeGame(), 'healthy');
    expect(sm.loadGame('healthy')).not.toBeNull();
    expect(() => sm.loadGame('broken')).toThrow('CORRUPT_SAVE');
  });
});

describe('autosave default slot', () => {
  let sm: StorageManager;
  beforeEach(() => {
    localStorage.clear();
    sm = new StorageManager();
  });

  test('saveGame() without a slot writes to autosave and round-trips', () => {
    expect(sm.saveGame(makeGame({ points: 11 }))).toBe(true);
    expect(sm.hasSave('autosave')).toBe(true);
    expect(sm.loadGame('autosave')!.points).toBe(11);
  });

  test('named slot and autosave coexist independently', () => {
    sm.saveGame(makeGame({ points: 1 }), 'named');
    sm.saveGame(makeGame({ points: 2 })); // autosave
    expect(sm.loadGame('named')!.points).toBe(1);
    expect(sm.loadGame('autosave')!.points).toBe(2);
  });
});
