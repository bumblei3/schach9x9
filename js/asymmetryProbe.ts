/**
 * Asymmetry Probe — Schach 9x9 Engine Strength Tuning (2026-07-14)
 *
 * Goal: detect a latent COLOR ASYMMETRY bug in the JS search / eval / TT path.
 * If the engine is color-symmetric, two IDENTICAL engines (balanced, same elo,
 * fixed depth, alternate colors) should split roughly 50/50. A lopsided result
 * (e.g. white wins 20:3) is impossible without a side-to-move / TT / eval color
 * bug.
 *
 * `balanced` vs `balanced`, fixed depth (elo 1600 => depth 5, no blunder
 * randomness), alternateColors => plays numGames*2 games. Aggregate white/black
 * win totals across all games = the asymmetry measure.
 *
 * Usage: npx tsx js/asymmetryProbe.ts
 */

import { runEngineMatch, type GameResult } from './engineMatch.js';

async function main(): Promise<void> {
  const numGames = Number(process.env.PROBE_GAMES ?? 14); // 14 => 28 games total
  const depth = Number(process.env.PROBE_DEPTH ?? 5);
  const elo = Number(process.env.PROBE_ELO ?? 1600); // 1600 => depth 5, no blunder

  console.log(
    `[AsymmetryProbe] balanced vs balanced | elo=${elo} (depth ${depth}) | numGames=${numGames} (${numGames * 2} w/ alt colors)`
  );

  const results: GameResult[] = await runEngineMatch({
    engineWhite: { name: 'Bal', personality: 'balanced', elo, depth, color: 'white' },
    engineBlack: { name: 'Bal', personality: 'balanced', elo, depth, color: 'black' },
    numGames,
    alternateColors: true,
    timeControl: { type: 'fixed-depth', fixedDepth: depth, baseTimeMs: 60000, maxTimeMs: 60000 },
    openingBook: false,
    maxMoves: 200,
    savePgns: false,
    quiet: true,
  });

  let whiteWins = 0;
  let blackWins = 0;
  let draws = 0;
  let crashes = 0;
  for (const r of results) {
    if (r.terminationReason === 'engine-error') crashes++;
    if (r.winner === 'white') whiteWins++;
    else if (r.winner === 'black') blackWins++;
    else draws++;
  }

  const total = results.length;
  const whitePct = ((whiteWins / total) * 100).toFixed(1);
  const blackPct = ((blackWins / total) * 100).toFixed(1);
  const drawPct = ((draws / total) * 100).toFixed(1);

  console.log('\n=== ASYMMETRY PROBE RESULT ===');
  console.log(`Games: ${total} | crashes: ${crashes}`);
  console.log(`White wins : ${whiteWins} (${whitePct}%)`);
  console.log(`Black wins : ${blackWins} (${blackPct}%)`);
  console.log(`Draws      : ${draws} (${drawPct}%)`);

  // Symmetry verdict: identical engines => 50/50 expected. Flag if a color wins
  // > 60% (or a 2:1+ split) — that indicates a color bug, not balance.
  const maxColor = Math.max(whiteWins, blackWins);
  const minColor = Math.min(whiteWins, blackWins);
  if (crashes > 0) {
    console.log('VERDICT: CRASH — probe inconclusive, fix engine-error first.');
  } else if (total >= 10 && maxColor / total > 0.6) {
    console.log(
      `VERDICT: ASYMMETRY DETECTED (${maxColor}:${minColor} favoring ${maxColor === whiteWins ? 'WHITE' : 'BLACK'}) — color bug likely.`
    );
  } else {
    console.log('VERDICT: SYMMETRIC — no color bug detected at this depth/sample.');
  }
}

main().catch(err => {
  console.error('[AsymmetryProbe] FATAL:', err);
  process.exit(1);
});
