import type { Piece } from '../types/core.js';

/**
 * Puts one free white knight on a hiring board.
 * The king is later snapped onto row size-2, so the knight takes the back rank first.
 */
export function placeSprungfederKnight(board: (Piece | null)[][]): boolean {
  const size = board.length;
  const rows = [size - 1, size - 3, size - 2].filter(r => r >= 0 && r < size);
  const mid = Math.floor(size / 2);

  for (const r of rows) {
    for (let distance = 0; distance < size; distance++) {
      const cols = distance === 0 ? [mid] : [mid - distance, mid + distance];
      for (const c of cols) {
        if (c < 0 || c >= size || board[r][c]) continue;
        board[r][c] = { type: 'n', color: 'white', gifted: true };
        return true;
      }
    }
  }
  return false;
}
