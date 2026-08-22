/**
 * selfmatch.ts — 9×9-vs-9×9 self-play match between two engine configurations.
 *
 * The SF benchmark (tools/stockfish-match.ts) plays the *8×8 mode* because
 * Stockfish cannot play 9×9 — it is a mode comparison, not a strength measure.
 * This tool measures REAL engine strength changes on the native 9×9 board:
 * candidate config vs baseline config, same search code, alternating colors,
 * fixed depth per side. Elo difference via logistic model.
 *
 * Configs are selected by name; each maps to { evalPersonality, extraDepth }
 * or a raw EvalConfig override. New knobs under test get an entry here.
 *
 * Usage:
 *   npx tsx tools/selfmatch.ts --games=20 --depth=4 --white=baseline --black=candidate
 *   npx tsx tools/selfmatch.ts --list
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
  COLOR_WHITE, COLOR_BLACK,
} from '../js/ai/BoardDefinitions.js';

type IntBoard = Int8Array;

// ---------------------------------------------------------------------------
// Config registry — add new experiment configs here (single-variable rule!)
// ---------------------------------------------------------------------------
interface SideConfig {
  personality: 'NORMAL' | 'AGGRESSIVE' | 'SOLID' | 'GENTLE' | 'BALANCED';
  /** optional per-side depth override; default = --depth */
  depth?: number;
  /** optional eval knobs (single-variable experiments) */
  eval?: { bishopPairBonus?: number };
}

const CONFIGS: Record<string, SideConfig> = {
  baseline: { personality: 'NORMAL' },
  aggressive: { personality: 'AGGRESSIVE' },
  solid: { personality: 'SOLID' },
  gentle: { personality: 'GENTLE' },
  /** depth-gap calibration references (sanity: d4 should beat d3 clearly) */
  'd3': { personality: 'NORMAL', depth: 3 },
  'd4': { personality: 'NORMAL', depth: 4 },
  /** E1: bishop pair 30 → 50 (single variable) */
  'bp50': { personality: 'NORMAL', eval: { bishopPairBonus: 50 } },
};

function getConfig(name: string): SideConfig {
  const c = CONFIGS[name];
  if (!c) {
    console.error(`unknown config '${name}'. Available: ${Object.keys(CONFIGS).join(', ')}`);
    process.exit(2);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Board setup (9×9 Capablanca-style start position, mirrors js/engineMatch.ts)
// ---------------------------------------------------------------------------
function initialBoard9x9(): IntBoard {
  const SIZE = 9;
  const b = new Int8Array(SIZE * SIZE);
  const back = [
    PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING,
    PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK, PIECE_ARCHBISHOP,
  ];
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = COLOR_BLACK | back[c]!;
    b[1 * SIZE + c] = COLOR_BLACK | PIECE_PAWN;
    b[7 * SIZE + c] = COLOR_WHITE | PIECE_PAWN;
    b[8 * SIZE + c] = COLOR_WHITE | back[c]!;
  }
  return b;
}

// ---------------------------------------------------------------------------
// Match loop
// ---------------------------------------------------------------------------
type Winner = 'white' | 'black' | 'draw';

interface GameResult {
  game: number;
  winner: Winner;
  termination: string;
  plies: number;
  durationMs: number;
}

async function playGame(
  game: number,
  whiteCfg: SideConfig,
  blackCfg: SideConfig,
  baseDepth: number,
  maxPlies: number
): Promise<GameResult> {
  const board = initialBoard9x9();
  // 9×9 has no castling/EP rights in this variant's default ruleset.
  setRules({ castling: 0, ep: -1 });
  let turn: 'white' | 'black' = 'white';
  let plies = 0;
  const t0 = Date.now();

  const whiteSearch = createJsSearch({
    personality: whiteCfg.personality as never,
    ...whiteCfg.eval,
  });
  const blackSearch = createJsSearch({
    personality: blackCfg.personality as never,
    ...blackCfg.eval,
  });

  while (plies < maxPlies) {
    const legal = getAllLegalMoves(board, turn);
    if (legal.length === 0) {
      const inCheck = isInCheck(board, turn === 'white' ? COLOR_WHITE : COLOR_BLACK);
      if (!inCheck) {
        return { game, winner: 'draw', termination: 'stalemate', plies, durationMs: Date.now() - t0 };
      }
      const winner: Winner = turn === 'white' ? 'black' : 'white';
      return { game, winner, termination: 'checkmate', plies, durationMs: Date.now() - t0 };
    }

    const cfg = turn === 'white' ? whiteCfg : blackCfg;
    const search = turn === 'white' ? whiteSearch : blackSearch;
    const result = await search.run(board, turn, cfg.depth ?? baseDepth);

    if (!result.move) {
      return { game, winner: turn === 'white' ? 'black' : 'white', termination: `no-move-${turn}`, plies, durationMs: Date.now() - t0 };
    }
    // Validate legality (coordinate match)
    const chosen = legal.find(m => m.from === result.move!.from && m.to === result.move!.to);
    if (!chosen) {
      return { game, winner: turn === 'white' ? 'black' : 'white', termination: `illegal-${turn}`, plies, durationMs: Date.now() - t0 };
    }
    makeMove(board, chosen);
    turn = turn === 'white' ? 'black' : 'white';
    plies++;
  }

  return { game, winner: 'draw', termination: 'max-plies', plies, durationMs: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)=(.+)$/);
    if (m) args[m[1]!] = m[2]!;
    else if (a === '--list') args.list = '1';
  }
  return args;
}

function eloDiff(wins: number, losses: number, draws: number): number {
  const n = wins + losses + draws;
  if (n === 0) return 0;
  const score = (wins + 0.5 * draws) / n;
  if (score >= 1) return 400 * Math.log10(n / Math.max(losses, 0.5));
  if (score <= 0) return -400 * Math.log10(n / Math.max(wins, 0.5));
  return -400 * Math.log10(1 / score - 1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    console.log('available configs:', Object.keys(CONFIGS).join(', '));
    return;
  }

  const games = parseInt(args.games ?? '20', 10);
  const depth = parseInt(args.depth ?? '4', 10);
  const maxPlies = parseInt(args['max-plies'] ?? '300', 10);
  const whiteName = args.white ?? 'baseline';
  const blackName = args.black ?? 'candidate';

  const whiteCfg = getConfig(whiteName);
  const blackCfg = getConfig(blackName);

  setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
  if (getCurrentBoardSize() !== 9) throw new Error(`expected size 9, got ${getCurrentBoardSize()}`);

  console.log('=== schach9x9 self-match (native 9×9) ===');
  console.log(`white=${whiteName}(d${whiteCfg.depth ?? depth}) black=${blackName}(d${blackCfg.depth ?? depth}) games=${games} maxPlies=${maxPlies}`);

  const results: GameResult[] = [];
  for (let i = 0; i < games * 2; i++) {
    // alternate colors each game for fairness
    const wCfg = i % 2 === 0 ? whiteCfg : blackCfg;
    const bCfg = i % 2 === 0 ? blackCfg : whiteCfg;
    const r = await playGame(i + 1, wCfg, bCfg, depth, maxPlies);
    results.push(r);
    const whiteWon = r.winner === 'white';
    const namedWinner =
      r.winner === 'draw' ? 'draw'
        : (whiteWon === (i % 2 === 0)) ? 'first-named' : 'second-named';
    console.log(
      `Game ${i + 1}/${games * 2} → ${namedWinner} (${r.termination}) plies=${r.plies} ${r.durationMs}ms`
    );
  }

  // Score from perspective of the FIRST-named (white) config across both colors.
  let firstWins = 0, secondWins = 0, draws = 0;
  results.forEach((r, i) => {
    const firstIsWhiteThisGame = i % 2 === 0;
    if (r.winner === 'draw') draws++;
    else if ((r.winner === 'white') === firstIsWhiteThisGame) firstWins++;
    else secondWins++;
  });

  const n = results.length;
  const score = (firstWins + 0.5 * draws) / n;
  const elo = eloDiff(firstWins, secondWins, draws);
  // 95% CI via binomial std-dev of score
  const se = Math.sqrt(score * (1 - score) / n);
  const eloLo = eloAtScore(Math.max(0.01, score - 1.96 * se), n, secondWins);
  const eloHi = eloAtScore(Math.min(0.99, score + 1.96 * se), n, secondWins);

  console.log('=== SUMMARY ===');
  console.log(`W-D-L (${whiteName}): ${firstWins}-${draws}-${secondWins}  (n=${n})`);
  console.log(`score: ${score.toFixed(3)}  Elo(${whiteName} vs ${blackName}): ${elo.toFixed(1)}  [95% ~ ${eloLo.toFixed(0)} .. ${eloHi.toFixed(0)}]`);
  console.log(`term breakdown: ${termBreakdown(results)}`);
  console.log(`RESULT firstW=${firstWins} secondW=${secondWins} D=${draws} score=${score.toFixed(4)} elo=${elo.toFixed(1)} depth=${depth}`);
}

function eloAtScore(s: number, n: number, losses: number): number {
  if (s >= 1) return 400 * Math.log10(n / Math.max(losses, 0.5));
  if (s <= 0) return -400;
  return -400 * Math.log10(1 / s - 1);
}

function termBreakdown(results: GameResult[]): string {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.termination] = (counts[r.termination] ?? 0) + 1;
  return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ');
}

main().catch(e => { console.error(e); process.exit(1); });
