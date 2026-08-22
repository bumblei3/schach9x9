/**
 * nnue-datagen.ts — NNUE training-data generator (Step 1).
 *
 * Runs self-play on the native 9×9 board and records every position with
 * (a) the engine's search score from the mover's perspective and
 * (b) the final game result from the mover's perspective.
 * Output: JSONL, one record per position:
 *   {"b":[81 ints],"turn":"white"|"black","score":cp,"result":1|0|0.5}
 * Result: 1 = mover won, 0 = mover lost, 0.5 = draw.
 *
 * Usage:
 *   npx tsx tools/nnue-datagen.ts --games=10 --depth=3 --out=data/nnue_gen0.jsonl
 */

import { setBoardVariant, BOARD_VARIANTS, getCurrentBoardSize } from '../js/config.js';
import { createJsSearch } from '../js/search.js';
import {
  getAllLegalMoves,
  makeMove,
  isInCheck,
  setRules,
} from '../js/ai/MoveGenerator.js';
import {
  PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN,
  PIECE_KING, PIECE_ARCHBISHOP,
  COLOR_WHITE,
} from '../js/ai/BoardDefinitions.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

type IntBoard = Int8Array;

function initialBoard9x9(): IntBoard {
  const SIZE = 9;
  const b = new Int8Array(SIZE * SIZE);
  const back = [
    PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING,
    PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK, PIECE_ARCHBISHOP,
  ];
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = 32 | back[c]!; // COLOR_BLACK = 32
    b[1 * SIZE + c] = 32 | PIECE_PAWN;
    b[7 * SIZE + c] = COLOR_WHITE | PIECE_PAWN;
    b[8 * SIZE + c] = COLOR_WHITE | back[c]!;
  }
  return b;
}

interface Sample {
  b: number[];
  turn: string;
  score: number;
  result: number;
}

async function playAndRecord(
  game: number,
  depth: number,
  maxPlies: number,
  collect: Sample[]
): Promise<void> {
  const board = initialBoard9x9();
  setRules({ castling: 0, ep: -1 });
  let turn: 'white' | 'black' = 'white';
  let plies = 0;

  const search = createJsSearch({ personality: 'NORMAL' });

  // positions this game: board snapshot + turn at each decision point
  const gamePositions: { b: number[]; turn: string; score: number }[] = [];

  while (plies < maxPlies) {
    const legal = getAllLegalMoves(board, turn);
    if (legal.length === 0) break;
    const result = await search.run(board, turn, depth);
    if (!result.move) break;
    const chosen = legal.find(m => m.from === result.move!.from && m.to === result.move!.to);
    if (!chosen) break;
    gamePositions.push({ b: Array.from(board), turn, score: result.score });
    makeMove(board, chosen);
    turn = turn === 'white' ? 'black' : 'white';
    plies++;
  }

  // Determine result
  const legal = getAllLegalMoves(board, turn);
  let whiteResult: number; // 1 white won, 0 black won, 0.5 draw
  if (legal.length === 0 && isInCheck(board, turn === 'white' ? 16 : 32)) {
    whiteResult = turn === 'white' ? 0 : 1; // mated side loses
  } else {
    whiteResult = 0.5; // stalemate or max-plies
  }

  for (const p of gamePositions) {
    const moverWon = p.turn === 'white' ? whiteResult : 1 - whiteResult;
    collect.push({ b: p.b, turn: p.turn, score: p.score, result: moverWon });
  }
  console.log(`Game ${game}: plies=${plies} whiteResult=${whiteResult} samples=${gamePositions.length}`);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)=(.+)$/);
    if (m) args[m[1]!] = m[2]!;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const games = parseInt(args.games ?? '10', 10);
  const depth = parseInt(args.depth ?? '3', 10);
  const maxPlies = parseInt(args['max-plies'] ?? '300', 10);
  const out = args.out ?? `data/nnue_gen_d${depth}.jsonl`;

  setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
  if (getCurrentBoardSize() !== 9) throw new Error('expected size 9');

  mkdirSync(dirname(out), { recursive: true });

  console.log(`=== NNUE datagen: games=${games} depth=${depth} out=${out} ===`);
  const all: Sample[] = [];
  for (let i = 0; i < games; i++) {
    await playAndRecord(i + 1, depth, maxPlies, all);
  }

  const body = all.map(s => JSON.stringify(s)).join('\n') + '\n';
  writeFileSync(out, body);
  console.log(`=== wrote ${all.length} samples to ${out} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
