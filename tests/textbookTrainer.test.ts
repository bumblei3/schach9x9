import { describe, expect, test } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';
import { TEXTBOOK_LINES } from '../js/ai/textbook.js';

describe('Lehrbuch im Trainer (M3.4)', () => {
  const trainer = new OpeningTrainerManager(new OpeningBook());

  test('listTextbookPositions returns one entry per curated line', () => {
    const positions = trainer.listTextbookPositions();
    expect(positions.length).toBe(TEXTBOOK_LINES.length);
    expect(positions[0].hash.startsWith('textbook:')).toBe(true);
  });

  test('submitMove accepts the curated first move', () => {
    const pos = trainer.listTextbookPositions()[0];
    const result = trainer.submitMove(pos, pos.expectedMove);
    expect(result.correct).toBe(true);
  });
});
