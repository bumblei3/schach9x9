/**
 * Opening Trainer Manager for Schach 9x9
 * Pure module: loads an opening book and selects training positions.
 */

import { OpeningBook } from './ai/OpeningBook.js';
import type { Square } from './gameEngine.js';

export interface TrainerProgress {
  streak: number;
  attempts: number;
  correct: number;
  solvedHashes: string[];
}

export interface TrainerPosition {
  hash: string;
  expectedMove: { from: Square; to: Square };
  seenCount: number;
}

export class OpeningTrainerManager {
  progress: TrainerProgress = {
    streak: 0,
    attempts: 0,
    correct: 0,
    solvedHashes: [],
  };

  private book: OpeningBook;

  constructor(book: OpeningBook) {
    this.book = book;
  }

  listPositions(): TrainerPosition[] {
    const positions = this.book.data.positions;
    const result: TrainerPosition[] = [];

    for (const [hash, entry] of Object.entries(positions)) {
      if (!entry.moves || entry.moves.length === 0) continue;

      const best = entry.moves.reduce((a, b) => (b.weight > a.weight ? b : a));
      result.push({
        hash,
        expectedMove: { from: best.from, to: best.to },
        seenCount: entry.seenCount,
      });
    }

    return result;
  }

  getNextPosition(): TrainerPosition | null {
    const positions = this.listPositions();
    if (positions.length === 0) return null;
    const index = Math.floor(Math.random() * positions.length);
    return positions[index];
  }
}
