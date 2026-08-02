/**
 * stockfish-match.ts — absolute engine strength vs Stockfish (8×8 only).
 *
 * Schach9x9's primary board is 9×9 with fairy pieces, so Stockfish is not a
 * fair reference there. After the size-aware move-gen repair, the
 * `standard8x8` mode can play legal standard chess and can be matched against
 * Stockfish WASM (`stockfish@18`) for an *absolute* strength baseline.
 *
 * Protocol notes (fairness):
 *  - Full standard chess rules on 8×8: castling, en passant, auto-queen
 *    promotion (via RuleState in MoveGenerator + FEN with KQkq/ep for SF).
 *  - Opening book is disabled (depth search only).
 *
 * Usage:
 *   npx tsx tools/stockfish-match.ts [options]
 *   npm run match:stockfish -- --games=4 --depth=3 --sf-depth=4
 *
 * Flags:
 *   --games=N         number of games with alternating colors (default 4)
 *   --depth=N         our engine fixed search depth (default 3)
 *   --sf-depth=N      Stockfish fixed search depth (default 4)
 *   --sf-elo=N        if set, enable UCI_LimitStrength + UCI_Elo
 *   --sf-engine=NAME  lite-single|lite|single|full|asm (default lite-single)
 *   --max-plies=N     hard cap per game (default 200)
 *   --quiet           less per-move logging
 */

import { createRequire } from 'node:module';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setBoardVariant, BOARD_VARIANTS, getCurrentBoardSize } from '../js/config.js';
import { createJsSearch } from '../js/search.js';
import {
  getAllLegalMoves,
  makeMove,
  isInCheck,
  setRules,
  getRules,
  CR_ALL,
  CR_WK,
  CR_WQ,
  CR_BK,
  CR_BQ,
  type Move,
} from '../js/ai/MoveGenerator.js';
import {
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_NONE,
  TYPE_MASK,
  COLOR_MASK,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
} from '../js/ai/BoardDefinitions.js';
import type { IntBoard } from '../js/evaluate.js';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
  games: number;
  depth: number;
  sfDepth: number;
  sfElo: number | null;
  sfEngine: string;
  maxPlies: number;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    games: 4,
    depth: 3,
    sfDepth: 4,
    sfElo: null,
    sfEngine: 'lite-single',
    maxPlies: 200,
    quiet: false,
  };
  for (const a of argv) {
    if (a === '--quiet') args.quiet = true;
    else if (a.startsWith('--games=')) args.games = Math.max(1, parseInt(a.slice(8), 10) || 4);
    else if (a.startsWith('--depth=')) args.depth = Math.max(1, parseInt(a.slice(8), 10) || 3);
    else if (a.startsWith('--sf-depth=')) args.sfDepth = Math.max(1, parseInt(a.slice(11), 10) || 4);
    else if (a.startsWith('--sf-elo=')) args.sfElo = parseInt(a.slice(9), 10) || null;
    else if (a.startsWith('--sf-engine=')) args.sfEngine = a.slice(12) || 'lite-single';
    else if (a.startsWith('--max-plies=')) args.maxPlies = Math.max(20, parseInt(a.slice(12), 10) || 200);
    else if (/^\d+$/.test(a) && args.games === 4) args.games = parseInt(a, 10);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Board helpers (8×8 standard, no castling/EP state)
// ---------------------------------------------------------------------------

const SIZE = 8;

const TYPE_TO_FEN: Record<number, string> = {
  [PIECE_PAWN]: 'p',
  [PIECE_KNIGHT]: 'n',
  [PIECE_BISHOP]: 'b',
  [PIECE_ROOK]: 'r',
  [PIECE_QUEEN]: 'q',
  [PIECE_KING]: 'k',
};

function initialBoard8x8(): IntBoard {
  const b = new Int8Array(SIZE * SIZE);
  const back = [PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING, PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK];
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = COLOR_BLACK | back[c]!;
    b[1 * SIZE + c] = COLOR_BLACK | PIECE_PAWN;
    b[6 * SIZE + c] = COLOR_WHITE | PIECE_PAWN;
    b[7 * SIZE + c] = COLOR_WHITE | back[c]!;
  }
  return b;
}

function squareToUci(sq: number): string {
  const r = Math.floor(sq / SIZE);
  const c = sq % SIZE;
  return String.fromCharCode(97 + c) + String(SIZE - r);
}

function uciToSquare(uci: string): number {
  const c = uci.charCodeAt(0) - 97;
  const rank = parseInt(uci[1]!, 10); // 1..8
  const r = SIZE - rank;
  return r * SIZE + c;
}

function moveToUci(m: Move): string {
  let u = squareToUci(m.from) + squareToUci(m.to);
  if (m.promotion) {
    const ch = TYPE_TO_FEN[m.promotion & TYPE_MASK] ?? 'q';
    u += ch;
  }
  return u;
}

function parseUciMove(uci: string): Move {
  const from = uciToSquare(uci.slice(0, 2));
  const to = uciToSquare(uci.slice(2, 4));
  const promoChar = uci[4]?.toLowerCase();
  let promotion: number | undefined;
  if (promoChar) {
    const map: Record<string, number> = {
      q: PIECE_QUEEN,
      r: PIECE_ROOK,
      b: PIECE_BISHOP,
      n: PIECE_KNIGHT,
    };
    promotion = map[promoChar] ?? PIECE_QUEEN;
  }
  return { from, to, promotion };
}

function castlingFen(cr: number): string {
  let s = '';
  if (cr & CR_WK) s += 'K';
  if (cr & CR_WQ) s += 'Q';
  if (cr & CR_BK) s += 'k';
  if (cr & CR_BQ) s += 'q';
  return s || '-';
}

function epFen(ep: number): string {
  if (ep < 0) return '-';
  return squareToUci(ep);
}

/** Standard FEN including castling rights + EP from module RuleState. */
function boardToFen(board: IntBoard, turn: 'white' | 'black', halfmove = 0, fullmove = 1): string {
  const ranks: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    let empty = 0;
    let row = '';
    for (let c = 0; c < SIZE; c++) {
      const p = board[r * SIZE + c]!;
      if (p === PIECE_NONE) {
        empty++;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const t = p & TYPE_MASK;
      const ch = TYPE_TO_FEN[t] ?? 'p';
      row += (p & COLOR_MASK) === COLOR_WHITE ? ch.toUpperCase() : ch;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  const stm = turn === 'white' ? 'w' : 'b';
  const r = getRules();
  return `${ranks.join('/')} ${stm} ${castlingFen(r.castling)} ${epFen(r.ep)} ${halfmove} ${fullmove}`;
}

function materialCount(board: IntBoard): number {
  let n = 0;
  for (let i = 0; i < board.length; i++) if (board[i] !== PIECE_NONE) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Stockfish UCI wrapper (stockfish npm package)
// ---------------------------------------------------------------------------

interface StockfishHandle {
  send: (_cmd: string) => void;
  waitFor: (_pred: (_line: string) => boolean, _timeoutMs?: number) => Promise<string>;
  quit: () => void;
}

/**
 * Resolve a stockfish.js WASM entry to spawn as a Node child.
 * In-process `require('stockfish')` binds Module.print at init time, so
 * assigning `engine.print` later does not capture UCI lines — subprocess
 * stdout is the reliable channel.
 */
function resolveStockfishScript(engineName: string): string {
  const require = createRequire(import.meta.url);
  const pkgJson = require.resolve('stockfish/package.json');
  const binDir = join(dirname(pkgJson), 'bin');
  const version = (require(pkgJson) as { buildVersion?: string }).buildVersion || '18';
  const map: Record<string, string> = {
    'lite-single': `stockfish-${version}-lite-single.js`,
    lite: `stockfish-${version}-lite.js`,
    single: `stockfish-${version}-single.js`,
    full: `stockfish-${version}.js`,
    asm: `stockfish-${version}-asm.js`,
  };
  const file = map[engineName] || map['lite-single']!;
  const path = join(binDir, file);
  if (!existsSync(path)) {
    throw new Error(`Stockfish engine not found: ${path} (npm i -D stockfish@18)`);
  }
  return path;
}

async function startStockfish(engineName: string): Promise<StockfishHandle> {
  const script = resolveStockfishScript(engineName);
  const proc: ChildProcessWithoutNullStreams = spawn(process.execPath, [script], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const backlog: string[] = [];
  type Waiter = {
    pred: (_line: string) => boolean;
    resolve: (_line: string) => void;
    reject: (_e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const waiters: Waiter[] = [];

  const dispatch = (line: string) => {
    for (let i = 0; i < waiters.length; i++) {
      const w = waiters[i]!;
      if (w.pred(line)) {
        clearTimeout(w.timer);
        waiters.splice(i, 1);
        w.resolve(line);
        return;
      }
    }
    backlog.push(line);
  };

  let stdoutBuf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk;
    let nl: number;
    while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, nl).replace(/\r$/, '');
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line.length) dispatch(line);
    }
  });
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (chunk: string) => {
    if (/error|fail|exception/i.test(chunk)) process.stderr.write(`[sf-err] ${chunk}`);
  });

  const handle: StockfishHandle = {
    send(cmd: string) {
      if (/^(uci|isready|go\b|ucinewgame|position\b)/.test(cmd)) {
        backlog.length = 0;
      }
      proc.stdin.write(cmd + '\n');
    },
    waitFor(pred, timeoutMs = 60000) {
      for (let i = 0; i < backlog.length; i++) {
        if (pred(backlog[i]!)) {
          return Promise.resolve(backlog.splice(i, 1)[0]!);
        }
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(waiter);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error(`Stockfish wait timeout (${timeoutMs}ms)`));
        }, timeoutMs);
        const waiter: Waiter = { pred, resolve, reject, timer };
        waiters.push(waiter);
      });
    },
    quit() {
      try {
        proc.stdin.write('quit\n');
      } catch {
        /* ignore */
      }
      try {
        proc.kill();
      } catch {
        /* ignore */
      }
    },
  };

  handle.send('uci');
  await handle.waitFor(l => l.includes('uciok'), 20000);
  handle.send('isready');
  await handle.waitFor(l => l.includes('readyok'), 20000);
  return handle;
}

async function configureStockfish(
  sf: StockfishHandle,
  opts: { elo: number | null; hashMb?: number }
): Promise<void> {
  sf.send('setoption name Hash value ' + String(opts.hashMb ?? 64));
  if (opts.elo != null) {
    sf.send('setoption name UCI_LimitStrength value true');
    sf.send(`setoption name UCI_Elo value ${opts.elo}`);
  } else {
    sf.send('setoption name UCI_LimitStrength value false');
  }
  sf.send('ucinewgame');
  sf.send('isready');
  await sf.waitFor(l => l === 'readyok', 15000);
}

async function stockfishBestMove(
  sf: StockfishHandle,
  fen: string,
  depth: number
): Promise<string> {
  sf.send(`position fen ${fen}`);
  sf.send(`go depth ${depth}`);
  const line = await sf.waitFor(l => l.startsWith('bestmove '), 120000);
  // bestmove e2e4 ponder e7e5
  const parts = line.trim().split(/\s+/);
  const mv = parts[1];
  if (!mv || mv === '(none)') throw new Error(`Stockfish returned no move: ${line}`);
  return mv;
}

// ---------------------------------------------------------------------------
// Our engine move
// ---------------------------------------------------------------------------

async function ourBestMove(
  board: IntBoard,
  turn: 'white' | 'black',
  depth: number
): Promise<Move | null> {
  const search = createJsSearch({ personality: 'NORMAL' });
  // Pass current castling/EP so search can castle and capture EP.
  const result = await search.run(board, turn, depth, { ...getRules() });
  return result.move;
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

type Winner = 'ours' | 'sf' | 'draw';
type Termination =
  | 'checkmate'
  | 'stalemate'
  | 'max-plies'
  | 'illegal-sf'
  | 'illegal-ours'
  | 'engine-error';

interface GameResult {
  game: number;
  ourColor: 'white' | 'black';
  winner: Winner;
  termination: Termination;
  plies: number;
  durationMs: number;
  moves: string[];
}

async function playGame(
  game: number,
  ourColor: 'white' | 'black',
  sf: StockfishHandle,
  depth: number,
  sfDepth: number,
  maxPlies: number,
  quiet: boolean
): Promise<GameResult> {
  const board = initialBoard8x8();
  setRules({ castling: CR_ALL, ep: -1 });
  let turn: 'white' | 'black' = 'white';
  let plies = 0;
  let fullmove = 1;
  const moves: string[] = [];
  const t0 = Date.now();

  try {
    while (plies < maxPlies) {
      const legal = getAllLegalMoves(board, turn);
      if (legal.length === 0) {
        const inCheck = isInCheck(board, turn === 'white' ? COLOR_WHITE : COLOR_BLACK);
        if (inCheck) {
          // side to move is mated → opponent wins
          const winner: Winner = turn === ourColor ? 'sf' : 'ours';
          return {
            game,
            ourColor,
            winner,
            termination: 'checkmate',
            plies,
            durationMs: Date.now() - t0,
            moves,
          };
        }
        return {
          game,
          ourColor,
          winner: 'draw',
          termination: 'stalemate',
          plies,
          durationMs: Date.now() - t0,
          moves,
        };
      }

      const isOurs = turn === ourColor;
      let uci: string;
      let move: Move;

      if (isOurs) {
        const best = await ourBestMove(board, turn, depth);
        if (!best) {
          return {
            game,
            ourColor,
            winner: 'sf',
            termination: 'illegal-ours',
            plies,
            durationMs: Date.now() - t0,
            moves,
          };
        }
        // Validate against legal list (coordinate match + promo)
        const ok = legal.some(
          m =>
            m.from === best.from &&
            m.to === best.to &&
            (m.promotion ?? 0) === (best.promotion ?? 0)
        );
        if (!ok) {
          // Accept best without promo match if only from/to — search may omit promo on non-promo
          const loose = legal.find(m => m.from === best.from && m.to === best.to);
          if (!loose) {
            return {
              game,
              ourColor,
              winner: 'sf',
              termination: 'illegal-ours',
              plies,
              durationMs: Date.now() - t0,
              moves,
            };
          }
          move = loose;
        } else {
          move = best;
        }
        uci = moveToUci(move);
      } else {
        const fen = boardToFen(board, turn, 0, fullmove);
        uci = await stockfishBestMove(sf, fen, sfDepth);
        move = parseUciMove(uci);
        const loose = legal.find(
          m =>
            m.from === move.from &&
            m.to === move.to &&
            (move.promotion
              ? (m.promotion ?? PIECE_QUEEN) === move.promotion
              : true)
        );
        if (!loose) {
          // Rule-set mismatch (typically castling/EP — not implemented on our
          // int board). Do NOT score as a win for us; void as draw so Elo is
          // not inflated by incomplete rules.
          if (!quiet) {
            console.error(
              `  SF move illegal under our rules (void/draw): ${uci} (legal sample: ${legal
                .slice(0, 5)
                .map(moveToUci)
                .join(' ')})`
            );
          }
          return {
            game,
            ourColor,
            winner: 'draw',
            termination: 'illegal-sf',
            plies,
            durationMs: Date.now() - t0,
            moves,
          };
        }
        // Prefer our legal move object (ensures auto-queen promo applied)
        move = loose;
        uci = moveToUci(move);
      }

      makeMove(board, move);
      moves.push(uci);
      plies++;
      if (!quiet && plies % 10 === 0) {
        process.stdout.write(
          `  g${game} ply ${plies} pieces=${materialCount(board)} last=${uci}\n`
        );
      }

      if (turn === 'black') fullmove++;
      turn = turn === 'white' ? 'black' : 'white';
    }

    return {
      game,
      ourColor,
      winner: 'draw',
      termination: 'max-plies',
      plies,
      durationMs: Date.now() - t0,
      moves,
    };
  } catch (err) {
    console.error(`  game ${game} error:`, err);
    return {
      game,
      ourColor,
      winner: 'draw',
      termination: 'engine-error',
      plies,
      durationMs: Date.now() - t0,
      moves,
    };
  }
}

// ---------------------------------------------------------------------------
// Elo from score (logistic, same spirit as trischach eloFromScore)
// ---------------------------------------------------------------------------

function eloFromScore(score: number): { elo: number; lo: number; hi: number } {
  // score in [0,1]; clamp to avoid inf
  const s = Math.min(0.999, Math.max(0.001, score));
  const elo = 400 * Math.log10(s / (1 - s));
  // crude 95% CI via normal approx on logit is omitted; use ± 200/sqrt(n) later
  return { elo, lo: elo, hi: elo };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
  if (getCurrentBoardSize() !== 8) {
    throw new Error(`expected board size 8, got ${getCurrentBoardSize()}`);
  }

  // Sanity: startpos 20 moves; after e2e4 still 20; castling present when rights set.
  {
    setRules({ castling: CR_ALL, ep: -1 });
    const b = initialBoard8x8();
    const w = getAllLegalMoves(b, 'white');
    if (w.length !== 20) {
      throw new Error(`8x8 start legal moves expected 20, got ${w.length}`);
    }
    const e2e4 = w.find(m => m.from === 52 && m.to === 36);
    if (!e2e4) throw new Error('missing e2e4 in start position');
    makeMove(b, e2e4);
    const bl = getAllLegalMoves(b, 'black');
    if (bl.length !== 20) {
      throw new Error(`after e2e4 black legal expected 20, got ${bl.length}`);
    }
    // Clear path for white O-O and ensure castling is generated
    const castleBoard = initialBoard8x8();
    setRules({ castling: CR_ALL, ep: -1 });
    // Remove pieces between king and h-rook: f1=61, g1=62 are empty at start;
    // need knights/bishops gone for a clean test — remove g1-path by clearing
    // knight and bishop: b1 empty already path... start has N on g1? g1 is empty,
    // pieces on f1 none, g1 none, but knight is on g1? Wait: back rank is
    // a1=r b1=n c1=b d1=q e1=k f1=b g1=n h1=r — f1 and g1 occupied.
    // Clear f1,g1 for O-O test:
    castleBoard[61] = 0;
    castleBoard[62] = 0;
    const castles = getAllLegalMoves(castleBoard, 'white').filter(m => m.flags === 'castle-k');
    if (castles.length !== 1) {
      throw new Error(`expected 1 kingside castle after clearing f1/g1, got ${castles.length}`);
    }
  }

  console.log('=== schach9x9 absolute strength vs Stockfish (8×8) ===');
  console.log(
    `games=${args.games} ourDepth=${args.depth} sfDepth=${args.sfDepth}` +
      (args.sfElo != null ? ` sfElo=${args.sfElo}` : ' sfElo=full') +
      ` engine=${args.sfEngine} maxPlies=${args.maxPlies}`
  );
  console.log('rules: full standard (castling + EP + auto-queen promo)');

  const sf = await startStockfish(args.sfEngine);
  await configureStockfish(sf, { elo: args.sfElo });

  const results: GameResult[] = [];
  for (let i = 0; i < args.games; i++) {
    const ourColor: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
    process.stdout.write(`Game ${i + 1}/${args.games} — we play ${ourColor}...\n`);
    // Fresh game state for SF hash tables
    sf.send('ucinewgame');
    sf.send('isready');
    await sf.waitFor(l => l === 'readyok', 15000);

    const r = await playGame(i + 1, ourColor, sf, args.depth, args.sfDepth, args.maxPlies, args.quiet);
    results.push(r);
    console.log(
      `  → ${r.winner.toUpperCase()} (${r.termination}) plies=${r.plies} ${r.durationMs}ms` +
        (r.moves.length ? ` pv0=${r.moves[0]}` : '')
    );
  }

  sf.quit();

  const wins = results.filter(r => r.winner === 'ours').length;
  const losses = results.filter(r => r.winner === 'sf').length;
  const draws = results.filter(r => r.winner === 'draw').length;
  const n = results.length;
  const score = n > 0 ? (wins + 0.5 * draws) / n : 0;
  const { elo } = eloFromScore(score);
  // Wald-ish CI on score → map endpoints
  const se = n > 0 ? Math.sqrt((score * (1 - score)) / n) : 0;
  const sLo = Math.min(0.999, Math.max(0.001, score - 1.96 * se));
  const sHi = Math.min(0.999, Math.max(0.001, score + 1.96 * se));
  const eloLo = 400 * Math.log10(sLo / (1 - sLo));
  const eloHi = 400 * Math.log10(sHi / (1 - sHi));

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`W-D-L (ours): ${wins}-${draws}-${losses}  (n=${n})`);
  console.log(`score: ${score.toFixed(3)}  Elo vs SF≈ ${elo.toFixed(0)}  [95% ~ ${eloLo.toFixed(0)} .. ${eloHi.toFixed(0)}]`);
  console.log(
    `params: depth=${args.depth} sfDepth=${args.sfDepth} sfElo=${args.sfElo ?? 'full'} engine=${args.sfEngine}`
  );
  console.log('term breakdown:', Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      acc[r.termination] = (acc[r.termination] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => `${k}=${v}`).join(' '));

  // Machine-readable last line for scripts
  console.log(
    `RESULT oursW=${wins} sfW=${losses} D=${draws} score=${score.toFixed(4)} elo=${elo.toFixed(1)} depth=${args.depth} sfDepth=${args.sfDepth}`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
