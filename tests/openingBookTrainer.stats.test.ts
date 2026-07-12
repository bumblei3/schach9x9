/**
 * Tests for OpeningBookTrainer.printStats() — console output for training
 * summary. Previously untested (pure console.log block, lines 605-618).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpeningBookTrainer } from '../js/utils/OpeningBookTrainer.js';

describe('OpeningBookTrainer.printStats — output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('emits the training-summary header and position/move lines', () => {
    const trainer = new OpeningBookTrainer({ numGames: 0, quiet: true });
    // printStats is private but pure console output; invoke via cast to
    // exercise the previously uncovered block.
    (trainer as unknown as { printStats: () => void }).printStats();

    const printed = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(printed).toContain('Training Complete:');
    expect(printed).toContain('Positions in book:');
    expect(printed).toContain('Total moves tracked:');
  });
});
