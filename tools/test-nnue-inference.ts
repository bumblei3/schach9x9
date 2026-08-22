import { loadNnueWeights, encodeBoard, nnueEvalProb, probToCp } from '../js/ai/nnue.js';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';

setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
const w = loadNnueWeights('data/nnue_weights.json');
// start position
const b = new Int8Array(81);
const back = [4, 2, 3, 5, 6, 3, 2, 4, 7];
for (let c = 0; c < 9; c++) {
  b[c] = 32 | back[c];
  b[9 + c] = 33;
  b[63 + c] = 17;
  b[72 + c] = 16 | back[c];
}
let p = nnueEvalProb(encodeBoard(b, true), w);
console.log('startpos: prob=', p.toFixed(4), 'cp≈', probToCp(p));
// white queen up:
const b2 = Int8Array.from(b);
b2[41] = 16 | 5;
p = nnueEvalProb(encodeBoard(b2, true), w);
console.log('white +Q: prob=', p.toFixed(4), 'cp≈', probToCp(p));
