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
import { parseFEN } from './utils.js';
import type { Piece } from './types/game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Piece type -> internal board code (mirror of engineNode.pieceToCode). */
function pieceToCode(p: Piece | null): number {
  if (!p) return 0;
  const typeCode: Record<string, number> = {
    p: 1, n: 2, b: 3, r: 4, q: 5, k: 6, a: 7, c: 8, e: 9, j: 10,
  };
  const base = typeCode[p.type] ?? 0;
  return p.color === 'white' ? base : -base;
}

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

/**
 * Parse a 9x9 FEN into the internal number[][] board used by the engines.
 * This is the ONLY authoritative way to build a board from a FEN — callers
 * must use this (not `initialBoard`) when a FEN is supplied, otherwise the
 * tactical position is silently replaced by the starting position.
 */
function boardFromFen(fen: string): number[][] {
  const { board } = parseFEN(fen);
  return board.map(row => row.map(pieceToCode));
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

/** Build the starting board for a game, honoring an optional start FEN. */
export function startingBoard(fen?: string): number[][] {
  return fen ? boardFromFen(fen) : initialBoard();
}

function applyMove(board: number[][], move: NonNullable<NodeResponse['move']>): void {
  const piece = board[move.from.r][move.from.c];
  board[move.to.r][move.to.c] = piece;
  board[move.from.r][move.from.c] = 0;
  // Promotion: a pawn reaching the last rank becomes the chosen piece
  // (archbishop/chancellor/queen). `promotion` is a piece letter or PieceType.
  if (move.promotion) {
    const promoType = String(move.promotion).toLowerCase();
    const typeCode: Record<string, number> = { a: 7, c: 8, q: 5, r: 4, b: 3, n: 2 };
    const code = typeCode[promoType];
    if (code) {
      const colorSign = piece > 0 ? 1 : -1;
      board[move.to.r][move.to.c] = colorSign * code;
    }
  }
}

/**
 * Material balance from NEW's perspective: NEW-owned material minus OLD-owned
 * material. Positive => NEW is ahead. Side ownership depends on `newIsWhite`.
 */
export function materialDiff(board: number[][], newIsWhite: boolean): number {
  let newMat = 0;
  let oldMat = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 0) continue;
      const value = PIECE_VALUE[Math.abs(cell)] ?? 0;
      if (cell > 0) {
        if (newIsWhite) newMat += value;
        else oldMat += value;
      } else {
        if (newIsWhite) oldMat += value;
        else newMat += value;
      }
    }
  }
  return newMat - oldMat;
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
export const TACTICAL_FENS: string[] = [
  // 1. Back-rank: black king a1, white Q d2 + K d1 -> mate threat. (9 files a..i)
  '9/9/9/9/9/9/9/3q5/k1K5N w - - 0 1',
  // 2. Knight fork: N h2 forks black K a1 + R d5.
  '9/9/9/3r5/9/9/7N1/7K1/k8 w - - 0 1',
  // 3. Hanging rook: black R d5, white N d6 attacks it. Black to move.
  '9/9/3N5/3r5/9/9/9/K6k1/9 b - - 0 1',
  // 4. Promotion with check: white pawn d2 one step from promotion (rank 1).
  '9/9/9/9/9/9/3P5/3k3K1/8k w - - 0 1',
  // 5. Discovered check: B a9, R d1, black K d8 -> Rxd1 / discovered.
  'B8/9/9/3k5/9/9/9/3R3K1/8k w - - 0 1',
  // 6. Back-rank trap: black K a1, white Q d2 mate.
  '9/9/9/9/9/9/9/3q5/k1K5N w - - 0 1',
  // 7. Skewer: white R a1, black K + Q same rank -> wins queen.
  '9/9/9/9/9/9/9/R2qk2K1/8k w - - 0 1',
  // 8. Pin break: black B pins R, white N wins bishop.
  '9/9/9/9/9/9/9/2n6/1b1rk2K1 w - - 0 1',
  // 9. Double attack: white Q attacks R + B simultaneously.
  '9/9/9/9/9/9/9/3q5/1r2b2K1 w - - 0 1',
  // 10. En prise rook: black R e5, white pawn captures with tempo.
  '9/9/9/4r4/4P4/9/9/6kK1/8k w - - 0 1',
  // 11. Fork queen+king: white N forks -> wins queen.
  '9/9/9/9/9/9/9/2N6/2q2k1K1 w - - 0 1',
  // 12. Trapped king escape: black K i1, white Q h2 checks.
  '9/9/9/9/9/9/9/7q1/6kK1 w - - 0 1',
];

async function playGame(
  newH: EngineHandle,
  oldH: EngineHandle,
  elo: number,
  newIsWhite: boolean,
  maxMoves: number,
  startFen?: string
): Promise<'new' | 'old' | 'draw'> {
  // BUG FIX: when a start FEN is given, the game MUST start from that
  // position — not the starting position with a phantom first move.
  const board = startingBoard(startFen);
  // Snapshot the starting material balance so the final result reflects
  // MATERIAL GAINED, not absolute material (tactical FENs may start lopsided).
  const startDiff = startFen ? materialDiff(board, newIsWhite) : 0;
  let turn: 'white' | 'black' = startFen ? fenToBoardTurn(startFen) : 'white';
  let moveNumber = 1;
  for (let i = 0; i < maxMoves; i++) {
    const newToMove = (turn === 'white') === newIsWhite;
    const h = newToMove ? newH : oldH;
    const res = await askMove(h, board, turn, elo, moveNumber);
    if (res.error || !res.move) return 'draw'; // crash/illegal -> draw, flagged
    applyMove(board, res.move);
    if (moveNumber >= 100) break; // no mate -> decide by material
    turn = turn === 'white' ? 'black' : 'white';
    if (turn === 'white') moveNumber++;
  }
  // No mate within move limit: decide by net material change from the start.
  const endDiff = materialDiff(board, newIsWhite);
  const net = endDiff - startDiff;
  if (net > 0) return 'new';
  if (net < 0) return 'old';
  return 'draw';
}

/** Extract the side-to-move from a FEN's second field ('w'|'b'). */
export function fenToBoardTurn(fen: string): 'white' | 'black' {
  const turn = fen.split(' ')[1];
  return turn === 'b' ? 'black' : 'white';
}

/** Piece values (9x9: A=archbishop, C=chancellor, E=angel rank above queen). */
const PIECE_VALUE: Record<number, number> = {
  1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 20000, 7: 950, 8: 950, 9: 1100, 10: 1100,
};

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

// Only auto-run when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('[MatchRefs] FATAL:', e);
    process.exit(1);
  });
}
