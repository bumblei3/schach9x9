import { TACTICAL_FENS } from '../js/matchRefs.js';
import { parseFEN } from '../js/utils.js';

let ok = true;
for (const fen of TACTICAL_FENS) {
  const pos = fen.split(' ')[0];
  const rows = pos.split('/');
  const widths = rows.map((r: string) => {
    let w = 0;
    for (const ch of r) {
      if (/\d/.test(ch)) w += Number(ch);
      else w++;
    }
    return w;
  });
  const valid = rows.length === 9 && widths.every((w: number) => w === 9);
  if (!valid) {
    ok = false;
    console.log('BAD  ', fen, 'rows=' + rows.length, 'widths=' + JSON.stringify(widths));
  } else {
    // also confirm parseFEN does not throw and produces 9x9
    const { board } = parseFEN(fen);
    const dims = board.length === 9 && board.every((r: (null | { type: string; color: string })[]) => r.length === 9);
    if (!dims) {
      ok = false;
      console.log('DIM  ', fen, 'board dims wrong');
    }
  }
}
console.log(ok ? 'ALL 12 TACTICAL_FENS VALID 9x9' : 'SOME FENs INVALID');
if (!ok) throw new Error('invalid FENs');
