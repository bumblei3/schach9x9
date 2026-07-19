// Elo / strength benchmark for Schach 9x9 headless engine.
// Usage: npx tsx tools/benchmark.ts <games> <whitePers> <blackPers> <whiteDepth> <blackDepth>
// Measures relative strength (win-rate) + engine stats (depth, nps, blunders).
// NOTE: absolute Elo requires a reference opponent with known Elo. We report the
// Elo *difference* implied by the win-rate (logistic model), which is honest for
// relative comparison only.
import { runEngineMatch, type EngineMatchConfig, type GameResult } from '../js/engineMatch.js';
import { AI_PERSONALITIES } from '../js/ai/personalities.js';

function eloDiffFromWinRate(wins: number, losses: number, draws: number): number {
  const n = wins + losses + draws;
  if (n === 0) return 0;
  const score = (wins + 0.5 * draws) / n; // 0..1
  if (score === 1) return 400 * Math.log10(n / Math.max(losses, 0.5));
  if (score === 0) return -400 * Math.log10(n / Math.max(wins, 0.5));
  // logistic: score = 1 / (1 + 10^(-d/400))  ->  d = -400 * log10(1/score - 1)
  return -400 * Math.log10(1 / score - 1);
}

function summarize(label: string, results: GameResult[], wPers: string, bPers: string, wDepth: number, bDepth: number) {
  const wWins = results.filter(r => r.winner === 'white').length;
  const bWins = results.filter(r => r.winner === 'black').length;
  const draws = results.filter(r => r.winner === 'draw').length;
  const avgMoves = results.reduce((s, r) => s + r.moves, 0) / results.length;
  const avgMaxDepth = results.reduce((s, r) => s + ((r.whiteStats.maxDepth || 0) + (r.blackStats.maxDepth || 0)) / 2, 0) / results.length;
  const avgNps = results.reduce((s, r) => s + ((r.whiteStats.nps || 0) + (r.blackStats.nps || 0)) / 2, 0) / results.length;
  const totalBlunders = results.reduce((s, r) => s + r.whiteStats.blunders + r.blackStats.blunders, 0);
  const totalMistakes = results.reduce((s, r) => s + r.whiteStats.mistakes + r.blackStats.mistakes, 0);
  // white = wPers; compute eloDiff assuming white is "reference 0"
  const elo = eloDiffFromWinRate(wWins, bWins, draws);
  console.log(
    `MATCH ${label} | ${wPers}@d${wDepth} vs ${bPers}@d${bDepth} | ` +
    `GAMES=${results.length} W=${wWins} B=${bWins} D=${draws} | ` +
    `avgMoves=${avgMoves.toFixed(1)} avgMaxDepth=${avgMaxDepth.toFixed(1)} avgNps=${Math.round(avgNps)} | ` +
    `blunders=${totalBlunders} mistakes=${totalMistakes} | ` +
    `eloDiff(W over B)=${elo.toFixed(0)}`
  );
  return { wWins, bWins, draws, elo };
}

async function main() {
  const games = parseInt(process.argv[2] || '20', 10);
  const wPers = (process.argv[3] || 'balanced') as keyof typeof AI_PERSONALITIES;
  const bPers = (process.argv[4] || 'aggressive') as keyof typeof AI_PERSONALITIES;
  const wElo = parseInt(process.argv[5] || '2500', 10);
  const bElo = parseInt(process.argv[6] || '2500', 10);
  // Optional explicit depth (arg 7/8) — overrides Elo-scaled depth when set.
  const wDepthArg = process.argv[7];
  const bDepthArg = process.argv[8];
  const wDepth = wDepthArg ? parseInt(wDepthArg, 10) : undefined;
  const bDepth = bDepthArg ? parseInt(bDepthArg, 10) : undefined;
  // Optional opening-book toggle (arg 9): "no" disables the book.
  const bookArg = process.argv[9];
  const openingBook = bookArg !== 'no';

  const config: EngineMatchConfig = {
    engineWhite: { name: `W-${wPers}`, personality: wPers, elo: wElo, color: 'white', depth: wDepth } as EngineMatchConfig['engineWhite'],
    engineBlack: { name: `B-${bPers}`, personality: bPers, elo: bElo, color: 'black', depth: bDepth } as EngineMatchConfig['engineBlack'],
    numGames: games,
    alternateColors: true,
    openingBook,
    timeControl: { type: 'fixed-time', baseTimeMs: 8000, incrementMs: 0, maxTimeMs: 8000 },
    savePgns: false,
    quiet: true,
  };

  const results = await runEngineMatch(config);
  const depthTag = wDepth || bDepth ? `@d${wDepth ?? '?'}-d${bDepth ?? '?'}` : '';
  summarize(`${wPers}@e${wElo}${depthTag}-vs-${bPers}@e${bElo}`, results, wPers, bPers, wElo, bElo);
}

main().catch(e => { console.error(e); process.exit(1); });
