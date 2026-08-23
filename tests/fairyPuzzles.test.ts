import { describe, expect, test } from 'vitest';
import { PuzzleManager } from '../js/puzzleManager.js';
import { PuzzleGenerator } from '../js/puzzleGenerator.js';
import type { GameLike } from '../js/types/game.js';

const FAIRY_IDS = [
  'fairy-archbishop-corner',
  'fairy-archbishop-center',
  'fairy-archbishop-end',
  'fairy-angel-basic',
  'fairy-angel-mirror',
  'fairy-angel-shield',
  'fairy-chancellor-rookline',
  'fairy-chancellor-mirror',
];

function makeGameLike(setupStr: string): GameLike {
  const { board, turn } = PuzzleGenerator.stringToBoard(setupStr);
  return {
    board,
    turn,
    phase: 'PLAY',
    mode: 'puzzle',
    points: 0,
    capturedPieces: { white: [], black: [] },
    moveHistory: [],
    _forceFullRender: true,
  } as unknown as GameLike;
}

describe('Fairy puzzles (M2.2) — engine-verified mate in 1', () => {
  const pm = new PuzzleManager();

  test('all 8 fairy puzzles exist', () => {
    for (const id of FAIRY_IDS) {
      expect(pm.getPuzzle(id)).toBeDefined();
    }
  });

  test.each(FAIRY_IDS)('%s: solution move is a verified mate-in-1', (id) => {
    const puzzle = pm.getPuzzle(id)!;
    expect(puzzle.setupStr).toBeTruthy();
    const { board, turn } = PuzzleGenerator.stringToBoard(puzzle.setupStr!);
    const seq = PuzzleGenerator.findMateSequence(board, turn, 1);
    expect(seq).not.toBeNull();
    const sol = puzzle.solution[0];
    // The authored solution must be among the engine's mating moves.
    const matches = seq!.some(
      (m) => m.from.r === sol.from.r && m.from.c === sol.from.c && m.to.r === sol.to.r && m.to.c === sol.to.c
    );
    expect(matches, `authored move ${JSON.stringify(sol)} is not a mating move`).toBe(true);
  });

  test.each(FAIRY_IDS)('%s: loadPuzzle + checkMove accepts the solution', (id) => {
    const pm2 = new PuzzleManager();
    const index = pm2.puzzles.findIndex((p) => p.id === id);
    const game = makeGameLike(pm2.puzzles[index].setupStr!);
    const loaded = pm2.loadPuzzle(game, index);
    expect(typeof loaded).not.toBe(false);
    const sol = pm2.puzzles[index].solution[0];
    expect(pm2.checkMove(game, { from: sol.from, to: sol.to } as never)).toBe('solved');
  });
});
