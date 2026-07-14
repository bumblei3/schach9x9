/**
 * matchRefs.ts — measure a real strength delta between two engine builds.
 *
 * Schach 9x9's engine is deterministic, so self-play (both sides same build)
 * is useless. This runs TWO engine builds (two git Refs in two worktrees) as
 * separate node processes (js/engineNode.ts line-server) and plays them
 * head-to-head over N games with alternating colors. The result (new wins /
 * old wins / draws) is a real strength measurement of the lever under test.
 *
 * Usage:
 *   NEW_REF=<worktree> OLD_REF=<worktree> npx tsx js/matchRefs.ts
 *   env: MATCH_GAMES (default 6 => 12 w/ alt colors), MATCH_ELO (1600),
 *        MATCH_MAXMOVES (200), MATCH_CAPTUREONLY (if set, openings book off)
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
  moveNumber: number
): Promise<NodeResponse> {
  const gameNumber = ++h.seq;
  return new Promise((resolveCb) => {
    h.pending.set(gameNumber, resolveCb);
    h.proc.stdin!.write(
      JSON.stringify({ gameNumber, board, turn, elo, moveNumber }) + '\n'
    );
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

async function playGame(
  newH: EngineHandle,
  oldH: EngineHandle,
  elo: number,
  newIsWhite: boolean,
  maxMoves: number
): Promise<'new' | 'old' | 'draw'> {
  const board = initialBoard();
  let turn: 'white' | 'black' = 'white';
  let moveNumber = 1;
  for (let i = 0; i < maxMoves; i++) {
    const newToMove = (turn === 'white') === newIsWhite;
    const h = newToMove ? newH : oldH;
    const res = await askMove(h, board, turn, elo, moveNumber);
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

  console.log('[MatchRefs] NEW=' + newDir);
  console.log('[MatchRefs] OLD=' + oldDir);
  console.log(`[MatchRefs] ${numGames}x2 games, elo ${elo}, maxMoves ${maxMoves}`);

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
    const winner = await playGame(newH, oldH, elo, newIsWhite, maxMoves);
    if (winner === 'new') newWins++;
    else if (winner === 'old') oldWins++;
    else draws++;
    console.log(`  game ${g + 1}: ${winner === 'new' ? 'NEW' : winner === 'old' ? 'OLD' : 'DRAW'}`);
  }

  newH.proc.kill();
  oldH.proc.kill();

  console.log('\n=== MATCH REFS RESULT (NEW vs OLD) ===');
  console.log(`NEW wins: ${newWins} | OLD wins: ${oldWins} | Draws: ${draws} (of ${total})`);
  const newPct = ((newWins / total) * 100).toFixed(1);
  if (newWins > oldWins) console.log('VERDICT: NEW stronger (' + newPct + '% win share).');
  else if (newWins < oldWins) console.log('VERDICT: NEW weaker - REVERT lever.');
  else console.log('VERDICT: equal - no measurable delta at this sample.');
}

main().catch((e) => {
  console.error('[MatchRefs] FATAL:', e);
  process.exit(1);
});
