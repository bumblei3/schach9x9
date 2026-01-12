import { BoardFactory } from './js/campaign/BoardFactory.js';
import { PIECE_VALUES } from './js/config.js';

console.log('Testing BoardFactory...');

const level1 = BoardFactory.createLevel1Board();
console.log('Level 1 Board created.');

// Count pieces
let whitePieces = 0;
let blackPieces = 0;

for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const p = level1[r][c];
    if (p) {
      if (p.color === 'white') whitePieces++;
      if (p.color === 'black') blackPieces++;
    }
  }
}

console.log(`White Pieces: ${whitePieces} (Expected: 1 King + 2 Knights + 2 Rooks + 5 Pawns = 10)`);
console.log(`Black Pieces: ${blackPieces} (Expected: 1 King + ~14 Pawns)`);

if (whitePieces > 0 && blackPieces > 0) {
  console.log('PASS: Board generated with pieces.');
} else {
  console.error('FAIL: Board is empty or missing pieces.');
}
