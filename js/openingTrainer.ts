/**
 * Opening Trainer Manager for Schach 9x9
 * Pure module: loads an opening book and selects training positions.
 */

import { OpeningBook } from './ai/OpeningBook.js';
import type { Square, Piece } from './gameEngine.js';

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

export interface MoveResult {
  correct: boolean;
  expected: { from: Square; to: Square };
  /** Algebraic expected move, e.g. "e2–e4" (9×9 board). */
  expectedAlgebraic: string;
  /** Short German feedback line for toast / menu. */
  feedback: string;
  progress: TrainerProgress;
}

/** Convert board coords to algebraic (a1 bottom-left from white). */
export function squareToAlgebraic(sq: { r: number; c: number }, boardSize: number = 9): string {
  return String.fromCharCode(97 + sq.c) + (boardSize - sq.r);
}

export function moveToAlgebraic(
  from: { r: number; c: number },
  to: { r: number; c: number },
  boardSize: number = 9
): string {
  return `${squareToAlgebraic(from, boardSize)}–${squareToAlgebraic(to, boardSize)}`;
}

const TRAINER_STORAGE_KEY = 'openingTrainer.progress';

export function loadTrainerProgress(): TrainerProgress {
  try {
    const raw = localStorage.getItem(TRAINER_STORAGE_KEY);
    if (!raw) return { streak: 0, attempts: 0, correct: 0, solvedHashes: [] };
    const parsed = JSON.parse(raw) as Partial<TrainerProgress>;
    return {
      streak: parsed.streak ?? 0,
      attempts: parsed.attempts ?? 0,
      correct: parsed.correct ?? 0,
      solvedHashes: Array.isArray(parsed.solvedHashes) ? parsed.solvedHashes : [],
    };
  } catch {
    return { streak: 0, attempts: 0, correct: 0, solvedHashes: [] };
  }
}

export function saveTrainerProgress(progress: TrainerProgress): void {
  try {
    localStorage.setItem(TRAINER_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable / quota — fail silently, progress is non-critical
  }
}

export class OpeningTrainerManager {
  progress: TrainerProgress;

  private book: OpeningBook;

  constructor(book: OpeningBook, progress?: TrainerProgress) {
    this.book = book;
    this.progress = progress ?? loadTrainerProgress();
  }

  saveProgress(): void {
    saveTrainerProgress(this.progress);
  }

  listPositions(): TrainerPosition[] {
    const positions = this.book.data.positions;
    const result: TrainerPosition[] = [];

    for (const [hash, entry] of Object.entries(positions)) {
      if (!entry.moves || entry.moves.length === 0) continue;

      // Only train white-to-move positions. The trainer forces the player to
      // move (GameController.loadTrainerPosition sets game.turn = playerColor,
      // which is white by default). A black-to-move position would present a
      // black piece as the expected move; the trainer strategy only selects
      // own (white) pieces, so the click would never register a move and the
      // streak would silently stay at 0. Skip black-to-move positions.
      // Genuine book hashes are 163 chars (81 squares × 2 + turn char) and end
      // in 'w'/'b'; ignore shorter test/dummy keys so they aren't dropped.
      if (hash.length >= 160 && hash.endsWith('b')) continue;

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

  submitMove(pos: TrainerPosition, move: { from: Square; to: Square }): MoveResult {
    const correct =
      pos.expectedMove.from.r === move.from.r &&
      pos.expectedMove.from.c === move.from.c &&
      pos.expectedMove.to.r === move.to.r &&
      pos.expectedMove.to.c === move.to.c;
    this.progress.attempts++;
    if (correct) {
      this.progress.streak++;
      this.progress.correct++;
      if (!this.progress.solvedHashes.includes(pos.hash)) {
        this.progress.solvedHashes.push(pos.hash);
      }
    } else {
      this.progress.streak = 0;
    }
    const expectedAlgebraic = moveToAlgebraic(pos.expectedMove.from, pos.expectedMove.to);
    const accPct = Math.round(this.accuracy * 100);
    const feedback = correct
      ? `Richtig! 🔥 Serie ${this.progress.streak} · Treffer ${accPct}%`
      : `Falsch — erwartet ${expectedAlgebraic}. Serie zurückgesetzt.`;
    return {
      correct,
      expected: pos.expectedMove,
      expectedAlgebraic,
      feedback,
      progress: { ...this.progress, solvedHashes: [...this.progress.solvedHashes] },
    };
  }

  get accuracy(): number {
    return this.progress.attempts === 0 ? 0 : this.progress.correct / this.progress.attempts;
  }

  reconstructBoard(hash: string): { board: (Piece | null)[][]; turn: 'white' | 'black' } {
    return reconstructBoardFromHash(hash);
  }
}

/**
 * Reconstruct a renderable board + turn from an opening book position hash.
 * The hash uses `OpeningBook.getBoardHash` encoding: each of the 81 squares is
 * 2 chars (`color[0]` + piece type char), empty squares are `..`, and the final
 * char is the turn (`w` or `b`). Total length = 163 chars for a 9x9 board.
 */
export function reconstructBoardFromHash(hash: string): {
  board: (Piece | null)[][];
  turn: 'white' | 'black';
} {
  const turn: 'white' | 'black' = hash.endsWith('w') ? 'white' : 'black';
  const body = hash.slice(0, -1); // drop trailing turn char
  const board: (Piece | null)[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: (Piece | null)[] = [];
    for (let c = 0; c < 9; c++) {
      const i = (r * 9 + c) * 2;
      const colorChar = body[i];
      const typeChar = body[i + 1];
      if (colorChar === '.') {
        row.push(null);
        continue;
      }
      const color: 'white' | 'black' = colorChar === 'w' ? 'white' : 'black';
      const type = typeChar as Piece['type'];
      row.push({ type, color, hasMoved: true });
    }
    board.push(row);
  }
  return { board, turn };
}
