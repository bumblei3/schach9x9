/**
 * Heatmap UI — renders the move-activity heatmap into #move-heatmap-panel.
 *
 * Uses the pure computeHeatmap() from js/analyze/heatmap.ts. No engine
 * dependency; purely visualizes the played move history so a solo player can
 * see which squares they fought over.
 */
import { computeHeatmap, cellIntensity, BOARD_SIZE } from '../analyze/heatmap.js';
import type { MoveHistoryEntry } from '../gameEngine.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

export class HeatmapUI {
  private grid: HTMLElement | null;
  private hottestLabel: HTMLElement | null;
  private panel: HTMLElement | null;

  constructor() {
    this.grid = document.getElementById('heatmap-grid');
    this.hottestLabel = document.getElementById('heatmap-hottest');
    this.panel = document.getElementById('move-heatmap-panel');
    const closeBtn = document.getElementById('close-heatmap-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  show(): void {
    if (this.panel) this.panel.classList.remove('hidden');
  }

  hide(): void {
    if (this.panel) this.panel.classList.add('hidden');
  }

  /**
   * Render the heatmap for a move history. Optionally mirror rows so the
   * board reads from the human player's perspective (white at the bottom).
   */
  render(history: MoveHistoryEntry[], mirrorForWhite = true): void {
    if (!this.grid) return;
    const { grid, hottest, maxCount } = computeHeatmap(history);

    this.grid.innerHTML = '';
    this.grid.style.setProperty('--grid-size', String(BOARD_SIZE));

    for (let r = 0; r < BOARD_SIZE; r++) {
      // When mirrored for white, row 8 (black back rank) is drawn at the top.
      const displayR = mirrorForWhite ? BOARD_SIZE - 1 - r : r;
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = grid[displayR][c];
        const intensity = cellIntensity(cell, maxCount);
        const el = document.createElement('div');
        el.className = 'heatmap-cell';
        el.style.setProperty('--intensity', intensity.toFixed(3));
        el.setAttribute(
          'aria-label',
          `${FILES[c]}${displayR + 1}: ${cell.from} von, ${cell.to} nach`
        );
        el.title = `${FILES[c]}${displayR + 1}: ${cell.from}× von, ${cell.to}× nach`;
        this.grid.appendChild(el);
      }
    }

    if (this.hottestLabel) {
      if (hottest && hottest.count > 0) {
        this.hottestLabel.textContent = `Aktivstes Feld: ${FILES[hottest.c]}${
          hottest.r + 1
        } (${hottest.count}× genutzt)`;
      } else {
        this.hottestLabel.textContent = 'Noch keine Züge gespielt.';
      }
    }
  }
}

// Singleton accessor (constructed after DOM ready by ui.js)
let instance: HeatmapUI | null = null;
export function getHeatmapUI(): HeatmapUI {
  if (!instance) instance = new HeatmapUI();
  return instance;
}
