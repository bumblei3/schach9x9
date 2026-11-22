import { readFileSync } from 'fs';
import { reconstructBoardFromHash } from '../js/openingTrainer.js';
import { RulesEngine } from '../js/RulesEngine.js';
import type { Piece, Square } from '../js/types/core.js';

/**
 * Opening-book solvability check.
 *
 * For every position in the book, reconstruct the board from its hash and
 * verify that each recorded move is LEGAL on a real RulesEngine board — not
 * just that the from-square is occupied by the side to move. A book move the
 * UI cannot accept makes the trainer position unsolvable (the player is asked
 * for a move that gets silently rejected).
 *
 * Usage: npx tsx scripts/check-book-solvability.ts [bookPath]
 *   bookPath  default: public/opening-book.json
 */
const bookPath = process.argv[2] || 'public/opening-book.json';
const bookData = JSON.parse(readFileSync(bookPath, 'utf8')) as {
  positions: Record<string, { moves: { from: Square; to: Square; weight: number }[] }>;
  metadata?: unknown;
};
const positions = Object.entries(bookData.positions);

let ok = 0;
let empty = 0;
let wrongColor = 0;
let illegal = 0;
const illegalSamples: string[] = [];

for (const [hash, pos] of positions) {
  const { board, turn } = reconstructBoardFromHash(hash);
  const engine = new RulesEngine({ board });
  for (const m of pos.moves) {
    const p = board[m.from.r]?.[m.from.c];
    if (!p) {
      empty++;
      continue;
    }
    if (p.color !== turn) {
      wrongColor++;
      continue;
    }
    const valid = engine.getValidMoves(m.from.r, m.from.c, p as Piece);
    if (valid.some(v => v.r === m.to.r && v.c === m.to.c)) {
      ok++;
    } else {
      illegal++;
      if (illegalSamples.length < 10) {
        illegalSamples.push(
          `${hash.slice(0, 24)}… ${p.type}${p.color} (${m.from.r},${m.from.c})->(${m.to.r},${m.to.c})`
        );
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      path: bookPath,
      positions: positions.length,
      ok,
      empty,
      wrongColor,
      illegal,
      illegalSamples,
      metadata: bookData.metadata,
    },
    null,
    2
  )
);
