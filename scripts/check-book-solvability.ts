import { readFileSync } from 'fs';
import { reconstructBoardFromHash } from '../js/openingTrainer.js';

const bookPath = process.argv[2] || '/tmp/test-book.json';
const bookData = JSON.parse(readFileSync(bookPath, 'utf8'));
const positions = Object.entries(bookData.positions);
let empty = 0,
  ok = 0,
  wrongColor = 0;
for (const [hash, pos] of positions as [
  string,
  { moves: { from: { r: number; c: number }; to: { r: number; c: number } }[] },
][]) {
  const { board, turn } = reconstructBoardFromHash(hash);
  for (const m of pos.moves) {
    const p = board[m.from.r]?.[m.from.c];
    if (!p) empty++;
    else if (p.color !== turn) wrongColor++;
    else ok++;
  }
}
console.log(
  JSON.stringify({
    path: bookPath,
    positions: positions.length,
    ok,
    empty,
    wrongColor,
    metadata: bookData.metadata,
  })
);
