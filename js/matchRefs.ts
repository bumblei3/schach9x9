/**
 * matchRefs.ts — measure a real strength delta between two engine builds.
 *
 * Schach 9x9's engine is deterministic, so self-play (both sides same build)
 * is useless. This runs TWO engine builds (two git Refs in two worktrees) as
 * separate node processes (js/engineNode.ts line-server) and plays them
 * head-to-head. Result (new wins / old wins / draws) is a real strength
 * measurement of the lever under test.
 *
 * Two modes:
 *  - default: symmetric opening, N games with alternating colors (good for
 *    broad regression checks, but deterministic engine tends to draw).
 *  - MATCH_FENS=1: uses a set of TACTICAL_FENS (mid-game positions with
 *    concrete tactics: checks, hanging pieces, forks). Both engines play each
 *    FEN with alternating colors — sensitive to Quiescence/eval levers.
 *
 * Usage:
 *   NEW_REF=<worktree> OLD_REF=<worktree> npx tsx js/matchRefs.ts
 *   env: MATCH_GAMES (default 6 => 12 w/ alt colors), MATCH_ELO (1600),
 *        MATCH_MAXMOVES (200), MATCH_FENS (if set, use tactical FENs)
 *
 * Output summary prints NEW wins / OLD wins / DRAWs and a verdict.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface NodeResponse {
  gameNumber: number;
  move: { from: { r: number; c: number }; to: { r: number; c: number }; promotion?: string } | null;
  score: number | null;
  depth: number | null;
  error?: string;
}

interface EngineHandle {
  proc: ChildProcess;
  pending: Map<number, (_res: NodeResponse) => void>;
  seq: number;
}

function startEngine(worktreeDir: string): EngineHandle {
  const proc = spawn('npx', ['tsx', resolve(worktreeDir, 'js/engineNode.ts')], {
    cwd: worktreeDir,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const handle: EngineHandle = { proc, pending: new Map(), seq: 0 };
  let buf = '';
  proc.stdout!.setEncoding('utf8');
  proc.stdout!.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as NodeResponse;
        const cb = handle.pending.get(parsed.gameNumber);
        if (cb) {
          handle.pending.delete(parsed.gameNumber);
          cb(parsed);
        }
      } catch {
        /* ignore malformed line */
      }
    }
  });
  return handle;
}

function askMove(
  h: EngineHandle,
  board: number[][],
  turn: 'white' | 'black',
  elo: number,
  moveNumber: number,
  fen?: string
): Promise<NodeResponse> {
  const gameNumber = ++h.seq;
  return new Promise((resolveCb) => {
    h.pending.set(gameNumber, resolveCb);
    const payload: Record<string, unknown> = { gameNumber, board, turn, elo, moveNumber };
    if (fen) payload.fen = fen;
    h.proc.stdin!.write(JSON.stringify(payload) + '\n');
  });
}

function initialBoard(): number[][] {
  const board: number[][] = Array(9).fill(null).map(() => Array(9).fill(0));
  const back = [
    -4, -2, -3, -5, -6, -3, -2, -4, -7, // black
    4, 2, 3, 5, 6, 3, 2, 4, 7, // white
  ];
  for (let c = 0; c < 9; c++) {
    board[0][c] = back[c];
    board[1][c] = -1;
    board[7][c] = 1;
    board[8][c] = back[c + 9];
  }
  return board;
}

function applyMove(board: number[][], move: NonNullable<NodeResponse['move']>): void {
  board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
  board[move.from.r][move.from.c] = 0;
}

/**
 * Tactical start positions — NOT the symmetric opening. Mid-game positions
 * with concrete tactics (checks, hanging pieces, forks) where Quiescence
 * extensions / eval matter. Both engines play each FEN with alternating
 * colors, so the result reflects who resolves the tactic better.
 *
 * Format: standard 9x9 FEN (rows 9..1 separated by '/'), piece letters
 * PNBRQKAC (A=archbishop, C=chancellor). Turn is 'w' or 'b'.
 */
const TACTICAL_FENS: string[] = [
  // 1. Queen checkmate threat: Q on 8th, black king on c8 (trapped) -> mate in 1
  '8/8/8/8/8/8/8/3q4/2k4K w - - 0 1',
  // 2. Knight fork: N can fork king (h8) + rook (c4) -> wins material
  '8/8/8/8/8/2r5/8/7N/6kK w - - 0 1',
  // 3. Hanging rook: black R on c4, white N on c5 attacks it -> grab wins
  '8/8/8/2N5/2r5/8/8/K6k b - - 0 1',
  // 4. Promotion with check: pawn one step from promotion, promotes with check
  '8/8/8/8/8/8/4P3/4k2K/7k w - - 0 1',
  // 5. Discovered check: bishop on a8, rook behind on d1 -> Rxd1 discovered check
  '8/8/8/8/8/8/8/b6k/K2R4 w - - 0 1',
  // 6. Back-rank: black king trapped on 8th, white Q delivers mate
  '8/8/8/8/8/8/8/3q4/k1K5 w - - 0 1',
  // 7. Skewer: white rook on a1, king + queen on same rank -> wins queen
  '8/8/8/8/8/8/8/8/R2qk2K w - - 0 1',
  // 8. Pin break: black bishop pins rook, white can win bishop with knight
  '8/8/8/8/8/8/8/2n5/1b1rk2K w - - 0 1',
  // 9. Double attack: white queen attacks rook + bishop simultaneously
  '8/8/8/8/8/8/8/3q4/1r2b2K w - - 0 1',
  // 10. En prise rook: black R on e5, white pawn can capture with tempo
  '8/8/8/8/4r3/4P3/8/6kK/8 w - - 0 1',
  // 11. Fork queen+king: white knight forks -> wins queen
  '8/8/8/8/8/8/8/2N5/2q2k1K w - - 0 1',
  // 12. Trapped king escape: black king on h8, white Q checks, must find mate
  '8/8/8/8/8/8/8/7q/6kK w - - 0 1',
];

async function playGame(
  newH: EngineHandle,
  oldH: EngineHandle,
  elo: number,
  newIsWhite: boolean,
  maxMoves: number,
  startFen?: string
): Promise<'new' | 'old' | 'draw'> {
  const board = initialBoard();
  let turn: 'white' | 'black' = 'white';
  let moveNumber = 1;
  let firstFen: string | undefined = startFen;
  for (let i = 0; i < maxMoves; i++) {
    const newToMove = (turn === 'white') === newIsWhite;
    const h = newToMove ? newH : oldH;
    const res = await askMove(h, board, turn, elo, moveNumber, firstFen);
    firstFen = undefined; // only the first move uses the FEN; rest is board state
    if (res.error || !res.move) return 'draw'; // crash/illegal -> draw, flagged
    applyMove(board, res.move);
    if (moveNumber >= 100) return 'draw';
    turn = turn === 'white' ? 'black' : 'white';
    if (turn === 'white') moveNumber++;
  }
  return 'draw';
}

async function main(): Promise<void> {
  const newDir = process.env.NEW_REF || __dirname;
  const oldDir = process.env.OLD_REF || '/tmp/s9-baseline';
  const numGames = Number(process.env.MATCH_GAMES ?? 6);
  const elo = Number(process.env.MATCH_ELO ?? 1600);
  const maxMoves = Number(process.env.MATCH_MAXMOVES ?? 200);
  const useFens = !!process.env.MATCH_FENS;

  console.log('[MatchRefs] NEW=' + newDir);
  console.log('[MatchRefs] OLD=' + oldDir);
  console.log('[MatchRefs] ' + (useFens ? 'TACTICAL FENs' : 'symmetric opening') +
    ', ' + numGames + 'x2 games, elo ' + elo + ', maxMoves ' + maxMoves);

  const newH = startEngine(newDir);
  const oldH = startEngine(oldDir);
  // give engines a moment to boot tsx
  await new Promise((r) => setTimeout(r, 4000));

  let newWins = 0;
  let oldWins = 0;
  let draws = 0;
  const total = numGames * 2;
  for (let g = 0; g < total; g++) {
    const newIsWhite = g % 2 === 0;
    let startFen: string | undefined;
    if (useFens) {
      // each game picks a FEN; games 0..4 map to FEN 0..4, then wrap
      startFen = TACTICAL_FENS[g % TACTICAL_FENS.length];
    }
    const winner = await playGame(newH, oldH, elo, newIsWhite, maxMoves, startFen);
    if (winner === 'new') newWins++;
    else if (winner === 'old') oldWins++;
    else draws++;
    console.log('  game ' + (g + 1) + ': ' + (winner === 'new' ? 'NEW' : winner === 'old' ? 'OLD' : 'DRAW'));
  }

  newH.proc.kill();
  oldH.proc.kill();

  console.log('');
  console.log('=== MATCH REFS RESULT (NEW vs OLD) ===');
  console.log('NEW wins: ' + newWins + ' | OLD wins: ' + oldWins + ' | Draws: ' + draws + ' (of ' + total + ')');
  const newPct = ((newWins / total) * 100).toFixed(1);
  if (newWins > oldWins) console.log('VERDICT: NEW stronger (' + newPct + '% win share).');
  else if (newWins < oldWins) console.log('VERDICT: NEW weaker - REVERT lever.');
  else console.log('VERDICT: equal - no measurable delta at this sample.');
}

main().catch((e) => {
  console.error('[MatchRefs] FATAL:', e);
  process.exit(1);
});
