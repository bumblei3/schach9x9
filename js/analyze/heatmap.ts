/**
 * Move-heatmap analysis for the post-game / live stats panel.
 *
 * Counts how often each 9x9 square is used as a move source (from) or
 * destination (to) across a game's move history. Pure function — no DOM,
 * fully unit-testable. Rendering lives in the UI layer (HeatmapUI).
 */
import type { MoveHistoryEntry } from '../gameEngine.js';

export const BOARD_SIZE = 9;

export interface HeatCell {
  /** number of times a piece left this square */
  from: number;
  /** number of times a piece landed on this square */
  to: number;
}

export type Heatmap = HeatCell[][];

export interface HeatmapSummary {
  /** 9x9 grid of from/to counts */
  grid: Heatmap;
  /** total moves counted (history length) */
  totalMoves: number;
  /** the single most-used square [r, c] and its combined count, or null */
  hottest: { r: number; c: number; count: number } | null;
  /** combined count over all squares (from+to), for normalization */
  maxCount: number;
}

function emptyGrid(): Heatmap {
  const g: Heatmap = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: HeatCell[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push({ from: 0, to: 0 });
    g.push(row);
  }
  return g;
}

/**
 * Build a heatmap from a move history.
 * Squares are recorded by their absolute board coordinate (r,c); the caller
 * (UI) decides whether to mirror for the human player's perspective.
 */
export function computeHeatmap(history: MoveHistoryEntry[]): HeatmapSummary {
  const grid = emptyGrid();
  let maxCount = 0;
  let hottest: HeatmapSummary['hottest'] = null;

  for (const move of history) {
    const f = move.from;
    const t = move.to;
    if (f && typeof f.r === 'number' && typeof f.c === 'number') {
      grid[f.r][f.c].from++;
    }
    if (t && typeof t.r === 'number' && typeof t.c === 'number') {
      grid[t.r][t.c].to++;
    }
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const count = grid[r][c].from + grid[r][c].to;
      if (count > maxCount) maxCount = count;
      if (!hottest || count > hottest.count) {
        hottest = { r, c, count };
      }
    }
  }

  // If nothing was ever used, hottest should be null (no square with count>0)
  if (hottest && hottest.count === 0) hottest = null;

  return {
    grid,
    totalMoves: history.length,
    hottest,
    maxCount,
  };
}

/**
 * Intensity 0..1 for a cell, used for color scaling in the UI.
 * Returns 0 when maxCount is 0 (empty history) to avoid divide-by-zero.
 */
export function cellIntensity(cell: HeatCell, maxCount: number): number {
  if (maxCount <= 0) return 0;
  const count = cell.from + cell.to;
  return Math.min(1, count / maxCount);
}
