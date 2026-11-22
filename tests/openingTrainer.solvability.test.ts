import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { reconstructBoardFromHash } from '../js/openingTrainer.js';
import { RulesEngine } from '../js/RulesEngine.js';
import type { Piece, Square } from '../js/types/core.js';

/**
 * Solvability guard for the Opening Trainer.
 *
 * Every position the trainer can present must have a book-endorsed move that
 * is LEGAL on a real RulesEngine board. Otherwise the player is asked for a
 * move the UI cannot accept and the trainer silently stays at streak 0.
 *
 * This is the regression guard for the `hasMoved` bug: the book is generated
 * by the integer engine (`OpeningBookTrainer`), which does not track
 * `hasMoved`, so `reconstructBoardFromHash` must not mark pieces as moved.
 * With `hasMoved: true`, 48 of 1271 trainable positions had a pawn
 * double-step as their book move and were unsolvable.
 */

interface BookMove {
  from: Square;
  to: Square;
  weight: number;
  games: number;
}

function loadBook(): Record<string, { moves: BookMove[]; seenCount: number }> {
  const path = resolve(process.cwd(), 'public/opening-book.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    positions: Record<string, { moves: BookMove[]; seenCount: number }>;
  };
  return raw.positions;
}

describe('opening-trainer book solvability', () => {
  const positions = loadBook();

  test('the real book has trainable white-to-move positions', () => {
    const trainable = Object.keys(positions).filter(
      h => h.length >= 160 && h.endsWith('w') && positions[h].moves.length > 0
    );
    expect(trainable.length).toBeGreaterThan(100);
  });

  test('every trainable position\'s best book move is legal on a RulesEngine board', () => {
    const trainable = Object.entries(positions).filter(
      ([h, p]) => h.length >= 160 && h.endsWith('w') && p.moves.length > 0
    );

    let checked = 0;
    const illegal: string[] = [];
    for (const [hash, pos] of trainable) {
      const { board } = reconstructBoardFromHash(hash);
      const engine = new RulesEngine({ board });
      const best = pos.moves.reduce((a, b) => (b.weight > a.weight ? b : a));
      const piece = board[best.from.r][best.from.c];
      expect(piece, `position ${hash.slice(0, 24)}… has no piece on the from-square`).not.toBeNull();
      const valid = engine.getValidMoves(best.from.r, best.from.c, piece as Piece);
      const ok = valid.some(v => v.r === best.to.r && v.c === best.to.c);
      if (!ok) {
        illegal.push(
          `${hash.slice(0, 24)}… ${(piece as Piece).type}${(piece as Piece).color} ` +
            `(${best.from.r},${best.from.c})->(${best.to.r},${best.to.c})`
        );
      }
      checked++;
    }

    expect(checked).toBe(trainable.length);
    expect(illegal, `unsolvable book positions:\n${illegal.join('\n')}`).toEqual([]);
  });
});
