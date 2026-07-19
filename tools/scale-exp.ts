// Scaling experiment: does giving the engine MORE time/depth make it stronger
// at equal elo? This decides whether raising MAX_SEARCH_TIME (H3) is a real
// lever or whether the engine is already at its search ceiling.
//
// Usage: npx tsx tools/scale-exp.ts <games> <pers> <wDepth> <wTimeMs> <bDepth> <bTimeMs>
//   white = (wDepth, wTimeMs), black = (bDepth, bTimeMs), both same personality.
import { runEngineMatch, type EngineMatchConfig, type GameResult } from '../js/engineMatch.js';
import { AI_PERSONALITIES } from '../js/ai/personalities.js';

function summarize(label: string, results: GameResult[]) {
  const wW = results.filter(r => r.winner === 'white').length;
  const bW = results.filter(r => r.winner === 'black').length;
  const d = results.filter(r => r.winner === 'draw').length;
  const n = wW + bW + d;
  const score = (wW + 0.5 * d) / n;
  const elo = score === 1 ? 999 : score === 0 ? -999 : -400 * Math.log10(1 / score - 1);
  const avgMaxDepth = results.reduce((s, r) => s + ((r.whiteStats.maxDepth || 0) + (r.blackStats.maxDepth || 0)) / 2, 0) / n;
  const avgNps = results.reduce((s, r) => s + ((r.whiteStats.nps || 0) + (r.blackStats.nps || 0)) / 2, 0) / n;
  console.log(
    `SCALE ${label} | GAMES=${n} W=${wW} B=${bW} D=${d} | ` +
    `avgMaxDepth=${avgMaxDepth.toFixed(1)} avgNps=${Math.round(avgNps)} | ` +
    `eloDiff(W over B)=${elo.toFixed(0)}`
  );
}

async function main() {
  const games = parseInt(process.argv[2] || '20', 10);
  const pers = (process.argv[3] || 'balanced') as keyof typeof AI_PERSONALITIES;
  const wDepth = parseInt(process.argv[4] || '7', 10);
  const wTime = parseInt(process.argv[5] || '5000', 10);
  const bDepth = parseInt(process.argv[6] || '9', 10);
  const bTime = parseInt(process.argv[7] || '10000', 10);

  const config: EngineMatchConfig = {
    engineWhite: { name: `W-d${wDepth}@${wTime}`, personality: pers, elo: 2500, color: 'white', depth: wDepth } as EngineMatchConfig['engineWhite'],
    engineBlack: { name: `B-d${bDepth}@${bTime}`, personality: pers, elo: 2500, color: 'black', depth: bDepth } as EngineMatchConfig['engineBlack'],
    numGames: games,
    alternateColors: true,
    timeControl: { type: 'fixed-time', baseTimeMs: Math.min(wTime, bTime), incrementMs: 0, maxTimeMs: Math.max(wTime, bTime) },
    savePgns: false,
    quiet: true,
  };

  const results = await runEngineMatch(config);
  summarize(`d${wDepth}@${wTime}ms-vs-d${bDepth}@${bTime}ms`, results);
}

main().catch(e => { console.error(e); process.exit(1); });
