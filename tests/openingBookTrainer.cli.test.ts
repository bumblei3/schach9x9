/**
 * Tests for OpeningBookTrainer CLI argument parsing.
 *
 * `parseCliArgs` is the pure (no-I/O) extract of the old `main()` CLI parser.
 * It was previously untested (the CLI entrypoint is hard to exercise in unit
 * tests). Extracting it makes the real arg->config mapping verifiable.
 */

import { describe, test, expect } from 'vitest';
import { parseCliArgs } from '../js/utils/OpeningBookTrainer.js';

describe('parseCliArgs — numeric flags', () => {
  test('parses all numeric flags into the config', () => {
    const cfg = parseCliArgs([
      '--games',
      '50',
      '--depth',
      '12',
      '--time',
      '500',
      '--opening-plies',
      '30',
      '--min-count',
      '4',
      '--max-moves',
      '8',
      '--elo',
      '1800',
    ]);
    expect(cfg.numGames).toBe(50);
    expect(cfg.depth).toBe(12);
    expect(cfg.timePerMoveMs).toBe(500);
    expect(cfg.openingMovesTracked).toBe(30);
    expect(cfg.minPositionCount).toBe(4);
    expect(cfg.maxMovesPerPosition).toBe(8);
    expect(cfg.elo).toBe(1800);
  });

  test('defaults are carried through when no flags are given', () => {
    const cfg = parseCliArgs([]);
    expect(cfg.numGames).toBe(100);
    expect(cfg.depth).toBe(8);
    expect(cfg.alternateColors).toBe(true);
    expect(cfg.quiet).toBe(false);
    expect(cfg.help).toBe(false);
  });
});

describe('parseCliArgs — string and boolean flags', () => {
  test('parses personality, input and output paths', () => {
    const cfg = parseCliArgs([
      '--personality',
      'aggressive',
      '--input',
      'base.json',
      '--output',
      'out.json',
    ]);
    expect(cfg.personality).toBe('aggressive');
    expect(cfg.inputBookPath).toBe('base.json');
    expect(cfg.outputBookPath).toBe('out.json');
  });

  test('--no-alternate disables color swapping', () => {
    expect(parseCliArgs(['--no-alternate']).alternateColors).toBe(false);
  });

  test('--quiet sets the quiet flag', () => {
    expect(parseCliArgs(['--quiet']).quiet).toBe(true);
  });

  test('--help sets the help flag (and does not exit the process)', () => {
    expect(parseCliArgs(['--help']).help).toBe(true);
  });
});

describe('parseCliArgs — robustness', () => {
  test('ignores unknown flags without throwing', () => {
    const cfg = parseCliArgs(['--bogus', 'value', '--games', '7']);
    expect(cfg.numGames).toBe(7);
  });

  test('a flag without a following value does not crash', () => {
    // `--games` with no real value consumes the next token ('--depth') as a
    // NaN value; the orphaned '9' is left unparsed. The call must not throw.
    const cfg = parseCliArgs(['--games', '--depth', '9']);
    expect(Number.isNaN(cfg.numGames as number)).toBe(true);
  });
});
