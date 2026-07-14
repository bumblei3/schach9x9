// Headless regression harness: runs N games, configurable personalities.
// Usage: npx tsx tools/match-harness.ts <games> <whitePers> <blackPers>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { runEngineMatch } from '../js/engineMatch.js';

const games = parseInt(process.argv[2] || '12', 10);
const whitePers = process.argv[3] || 'balanced';
const blackPers = process.argv[4] || 'aggressive';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = {
  engineWhite: { name: `W-${whitePers}`, personality: whitePers, elo: 2500, color: 'white' },
  engineBlack: { name: `B-${blackPers}`, personality: blackPers, elo: 2500, color: 'black' },
  numGames: games,
  alternateColors: true,
  timeControl: { type: 'fixed-time', baseTimeMs: 3000, incrementMs: 100, maxTimeMs: 5000 },
  savePgns: false,
  quiet: true,
};

const results = await runEngineMatch(config);
const whiteWins = results.filter(r => r.winner === 'white').length;
const blackWins = results.filter(r => r.winner === 'black').length;
const draws = results.filter(r => r.winner === 'draw').length;
const avgMoves = results.reduce((s, r) => s + r.moves, 0) / results.length;
const avgDepth = results.reduce((s, r) => s + (r.whiteStats.maxDepth || 0), 0) / results.length;
console.log(`PER=${whitePers}-vs-${blackPers} GAMES=${results.length} W=${whiteWins} B=${blackWins} D=${draws} avgMoves=${avgMoves.toFixed(1)} avgMaxDepth=${avgDepth.toFixed(1)}`);
