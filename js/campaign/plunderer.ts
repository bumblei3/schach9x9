import type { Piece } from '../types/core.js';

/**
 * Puts one free white pawn on White's side of a hiring board.
 * The caller decides whether Plünderer is unlocked.
 */
export function placePlundererPawn(board: (Piece | null)[][]): boolean {
  const size = board.length;
  const rows = [size - 2, size - 3, size - 1].filter(r => r >= 0 && r < size);
  const mid = Math.floor(size / 2);

  for (const r of rows) {
    for (let distance = 0; distance < size; distance++) {
      const cols = distance === 0 ? [mid] : [mid - distance, mid + distance];
      for (const c of cols) {
        if (c < 0 || c >= size || board[r][c]) continue;
        board[r][c] = { type: 'p', color: 'white', gifted: true };
        return true;
      }
    }
  }
  return false;
}
