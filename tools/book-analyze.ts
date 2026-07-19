// Analyze opening-book.json: how many positions have white-to-move vs
// black-to-move? A lopsided split explains why the engine wins 38:2 as white
// in self-play (the book gives white better opening choices than black).
// Usage: npx tsx tools/book-analyze.ts
import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync('public/opening-book.json', 'utf8'));
const positions = raw.positions || raw.data?.positions || raw;
const hashes = Object.keys(positions);
let whiteToMove = 0;
let blackToMove = 0;
let other = 0;
for (const h of hashes) {
  const last = h[h.length - 1];
  if (last === 'w') whiteToMove++;
  else if (last === 'b') blackToMove++;
  else other++;
}
const total = hashes.length;
console.log(`BOOK positions total=${total}`);
console.log(`  white-to-move: ${whiteToMove} (${(100 * whiteToMove / total).toFixed(1)}%)`);
console.log(`  black-to-move: ${blackToMove} (${(100 * blackToMove / total).toFixed(1)}%)`);
console.log(`  other/unlabeled: ${other}`);
// also: how many moves per position on average, and weight totals
let totalMoves = 0;
let nullMoves = 0;
for (const h of hashes) {
  const pos = positions[h];
  const moves = pos.moves || pos;
  if (Array.isArray(moves)) {
    totalMoves += moves.length;
    if (moves.length === 0) nullMoves++;
  } else {
    nullMoves++;
  }
}
console.log(`  avg moves/position=${(totalMoves / total).toFixed(2)} emptyPositions=${nullMoves}`);
