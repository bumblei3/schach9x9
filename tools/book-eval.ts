// Opening-book quality evaluator for Schach 9x9.
//
// For every position in opening-book.json, reconstruct the board from its
// hash, ask the engine for its best move (time-bounded getTopMoves), and
// compare against the book move. Reports how often the book move matches the
// engine's choice and the average evaluation loss vs the engine's best.
//
// This is a FOUNDATION-FIRST measurement: before touching the book we must
// know whether its moves are already strong (engine agrees) or weak (engine
// prefers a clearly better move). Only then do we decide to improve or park.
//
// Usage: npx tsx tools/book-eval.ts [depth] [maxPositions]
//   depth         search depth for the engine probe (default 6)
//   maxPositions  cap on positions evaluated (default: all)
import { getTopMoves } from '../js/aiEngine.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import { BOARD_SIZE } from '../js/config.js';
import type { Piece, PieceType } from '../js/types/game.js';
import * as fs from 'fs';
import * as path from 'path';

type Color = 'white' | 'black';
type Board = (Piece | null)[][];

// Reconstruct a board from the hash used by OpeningBook.getBoardHash.
// Hash layout: 81 cells * 2 chars (color[0] + type, or '..' for empty) + 1 char turn.
function boardFromHash(hash: string): { board: Board; turn: Color } | null {
  const cellsLen = BOARD_SIZE * BOARD_SIZE * 2;
  if (hash.length < cellsLen + 1) return null;
  const cells = hash.slice(0, cellsLen);
  const turnChar = hash[cellsLen];
  const turn: Color = turnChar === 'w' ? 'white' : 'black';

  const board: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: (Piece | null)[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = cells.slice((r * BOARD_SIZE + c) * 2, (r * BOARD_SIZE + c) * 2 + 2);
      if (cell === '..' || cell === '') {
        row.push(null);
      } else {
        const color: Color = cell[0] === 'w' ? 'white' : 'black';
        const type = cell.slice(1) as Exclude<PieceType, null>;
        row.push({ type, color });
      }
    }
    board.push(row);
  }
  return { board, turn };
}

// How many legal-move-step sanity: just verify the side to move actually has
// a piece on the from-square of the book move (hash-derived boards can be
// inconsistent; we skip those rather than crash).
function moveSquareEq(
  a: { from: { r: number; c: number }; to: { r: number; c: number } },
  b: { from: { r: number; c: number }; to: { r: number; c: number } }
): boolean {
  return a.from.r === b.from.r && a.from.c === b.from.c && a.to.r === b.to.r && a.to.c === b.to.c;
}

async function main() {
  const depth = parseInt(process.argv[2] || '6', 10);
  const maxPositions = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;

  const bookPath = path.resolve(process.cwd(), 'opening-book.json');
  const raw = JSON.parse(fs.readFileSync(bookPath, 'utf-8')) as {
    positions: Record<string, { moves: { from: { r: number; c: number }; to: { r: number; c: number }; weight: number; games: number }[]; seenCount: number }>;
  };

  const ob = new OpeningBook();
  ob.load(raw);

  const hashes = Object.keys(raw.positions);
  const total = Math.min(hashes.length, maxPositions);

  let evaluated = 0;
  let bookMatchesEngineTop1 = 0;
  let bookInEngineTop3 = 0;
  let bookInEngineTop5 = 0;
  let evalLossSum = 0;
  let skipped = 0;

  console.log(`BOOK_EVAL start: positions=${hashes.length} evaluating=${total} depth=${depth}`);

  for (let i = 0; i < hashes.length && evaluated < total; i++) {
    const hash = hashes[i];
    const recon = boardFromHash(hash);
    if (!recon) {
      skipped++;
      continue;
    }
    const { board, turn } = recon;

    // Pick the book's representative move: highest weight.
    const pos = raw.positions[hash];
    const bookMove = [...pos.moves].sort((a, b) => b.weight - a.weight)[0];
    if (!bookMove) {
      skipped++;
      continue;
    }

    // Sanity: side-to-move piece must be on the book move's from-square.
    const fromPiece = board[bookMove.from.r]?.[bookMove.from.c];
    if (!fromPiece || fromPiece.color !== turn) {
      skipped++;
      continue;
    }

    let topMoves;
    try {
      topMoves = await getTopMoves(board, turn, 5, depth, 4000, 0);
    } catch {
      skipped++;
      continue;
    }
    if (!topMoves || topMoves.length === 0) {
      skipped++;
      continue;
    }

    const engineBest = topMoves[0];
    // Engine score is in centipawns-ish (from evaluatePosition). Book move
    // score: look it up in the engine top-move list if present, else NaN.
    const bookEntry = topMoves.find((t: { move: { from: { r: number; c: number }; to: { r: number; c: number } } | null }) => t.move && moveSquareEq(t.move, bookMove));
    const bookScore = bookEntry?.score ?? NaN;
    const engineScore = engineBest.score ?? 0;

    if (!Number.isNaN(bookScore)) {
      evalLossSum += Math.max(0, engineScore - bookScore);
    }

    const matchesTop1 = engineBest.move && moveSquareEq(engineBest.move, bookMove);
    if (matchesTop1) bookMatchesEngineTop1++;

    // topMoves are sorted best-first; count how deep the book move appears.
    const bookRank = topMoves.findIndex((t: { move: { from: { r: number; c: number }; to: { r: number; c: number } } | null }) => t.move && moveSquareEq(t.move, bookMove));
    if (bookRank >= 0) {
      if (bookRank < 3) bookInEngineTop3++;
      if (bookRank < 5) bookInEngineTop5++;
    }

    evaluated++;
    if (evaluated % 100 === 0) {
      console.log(`  ...progress ${evaluated}/${total}`);
    }
  }

  const avgEvalLoss = evaluated > 0 ? (evalLossSum / evaluated).toFixed(1) : 'n/a';
  console.log('BOOK_EVAL done');
  console.log(
    `positions_evaluated=${evaluated} skipped=${skipped} | ` +
      `bookMatchesEngineTop1=${(100 * bookMatchesEngineTop1 / evaluated).toFixed(1)}% | ` +
      `bookInEngineTop3=${(100 * bookInEngineTop3 / evaluated).toFixed(1)}% | ` +
      `bookInEngineTop5=${(100 * bookInEngineTop5 / evaluated).toFixed(1)}% | ` +
      `avgEvalLossCp=${avgEvalLoss}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
