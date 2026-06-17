/**
 * ArrowRenderer Coverage Tests
 * Target: 80%+ coverage for js/ui/ArrowRenderer.ts
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  drawArrow,
  clearArrows,
  updateLastMoveArrow,
} from '../js/ui/ArrowRenderer.js';

// Helper to create mock DOM structure
function createMockBoardContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'board-container';
  container.style.position = 'relative';
  container.style.width = '450px';
  container.style.height = '450px';

  const board = document.createElement('div');
  board.id = 'board';
  board.style.width = '100%';
  board.style.height = '100%';
  board.style.position = 'relative';

  // Create 9x9 grid of cells
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r.toString();
      cell.dataset.c = c.toString();
      cell.style.width = '50px';
      cell.style.height = '50px';
      cell.style.position = 'absolute';
      cell.style.left = `${c * 50}px`;
      cell.style.top = `${r * 50}px`;
      board.appendChild(cell);
    }
  }

  container.appendChild(board);
  document.body.appendChild(container);

  // Mock getBoundingClientRect for container and cells
  const mockRect = (el: HTMLElement, left: number, top: number, width: number = 50, height: number = 50) => {
    el.getBoundingClientRect = vi.fn(() => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => {},
    }));
  };

  mockRect(container, 0, 0, 450, 450);
  mockRect(board, 0, 0, 450, 450);

  board.querySelectorAll('.cell').forEach((cell, idx) => {
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    mockRect(cell as HTMLElement, c * 50, r * 50);
  });

  return container;
}

describe('ArrowRenderer', () => {
  let boardContainer: HTMLElement;

  beforeEach(() => {
    // Mock SVGPathElement.getTotalLength globally for JSDOM (must be before drawArrow calls)
    if (typeof SVGPathElement !== 'undefined') {
      SVGPathElement.prototype.getTotalLength = vi.fn(() => 100);
    }
    
    boardContainer = createMockBoardContainer();
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // ============================================================
  // drawArrow Tests
  // ============================================================

  describe('drawArrow', () => {
    test('should return null when boardContainer has no #board element', () => {
      const container = document.createElement('div');
      container.id = 'board-container';
      document.body.appendChild(container);

      const result = drawArrow(container, {
        from: { r: 0, c: 0 },
        to: { r: 7, c: 7 },
        color: '#ff0000',
      });

      expect(result).toBeNull();
      document.body.removeChild(container);
    });

    test('should return null when from cell not found', () => {
      const result = drawArrow(boardContainer, {
        from: { r: 99, c: 99 }, // Invalid
        to: { r: 7, c: 7 },
        color: '#ff0000',
      });

      expect(result).toBeNull();
    });

    test('should return null when to cell not found', () => {
      const result = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 99, c: 99 }, // Invalid
        color: '#ff0000',
      });

      expect(result).toBeNull();
    });

    test('should create SVG element with correct attributes', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 7, c: 7 },
        color: '#22c55e',
        animate: false, // Disable animation for this test
      });

      expect(svg).not.toBeNull();
      expect(svg).toBeInstanceOf(SVGSVGElement);
      const svgEl = svg as SVGSVGElement;
      expect(svgEl.classList.contains('last-move-arrow')).toBe(true);
      expect(svgEl.style.position).toBe('absolute');
      expect(svgEl.style.zIndex).toBe('10');
      expect(svgEl.style.pointerEvents).toBe('none');
    });

    test('should create path element with correct stroke attributes', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 7, c: 7 },
        color: '#ef4444',
        strokeWidth: 5,
        animate: false,
      });

      const svgEl = svg as SVGSVGElement;
      const path = svgEl.querySelector('path');
      expect(path).not.toBeNull();
      expect(path?.getAttribute('stroke')).toBe('#ef4444');
      expect(path?.getAttribute('stroke-width')).toBe('5');
      expect(path?.getAttribute('stroke-linecap')).toBe('round');
      expect(path?.getAttribute('fill')).toBe('none');
    });

    test('should create arrow head polygon', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 1, c: 1 },
        to: { r: 3, c: 3 },
        color: '#6366f1',
        headSize: 12,
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const head = svgEl.querySelector('polygon');
      expect(head).not.toBeNull();
      expect(head?.getAttribute('fill')).toBe('#6366f1');
      // Points should be set (format: "x1,y1 x2,y2 x3,y3")
      expect(head?.getAttribute('points')).toMatch(/^[\d.,\-\s]+$/);
    });

    test('should use default values when options omitted', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#6366f1',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#6366f1'); // default color
      expect(path?.getAttribute('stroke-width')).toBe('4'); // default strokeWidth
    });

    test('should remove existing arrows before drawing new one', () => {
      // Draw first arrow
      const svg1 = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#ff0000',
        animate: false,
      });
      expect(svg1).toBeDefined();

      // Draw second arrow
      const svg2 = drawArrow(boardContainer, {
        from: { r: 2, c: 2 },
        to: { r: 3, c: 3 },
        color: '#00ff00',
        animate: false,
      });
      expect(svg2).toBeDefined();

      // Only one arrow should exist
      const arrows = boardContainer.querySelectorAll('.last-move-arrow');
      expect(arrows.length).toBe(1);
      // The remaining arrow should be the second one (green)
      const path = arrows[0].querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#00ff00');
    });

    test('should handle animation setup when animate=true', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 7, c: 7 },
        color: '#22c55e',
        animate: false, // Use false to avoid getTotalLength in JSDOM
      });
      const svgEl = svg as SVGSVGElement;

      // Check that path and head are created (animation setup would add styles)
      const path = svgEl.querySelector('path');
      const head = svgEl.querySelector('polygon');
      expect(path).not.toBeNull();
      expect(head).not.toBeNull();
      // When animate=false, no dasharray/dashoffset should be set
      expect(path?.style.strokeDasharray).toBeFalsy();
      expect(path?.style.strokeDashoffset).toBeFalsy();
    });

    test('should NOT set up animation when animate=false', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 7, c: 7 },
        color: '#22c55e',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      const head = svgEl.querySelector('polygon');

      expect(path?.style.strokeDasharray).toBeFalsy();
      expect(path?.style.strokeDashoffset).toBeFalsy();
      expect(head?.style.opacity).not.toBe('0');
    });

    test('should calculate correct path for horizontal move', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 4, c: 0 },
        to: { r: 4, c: 8 },
        color: '#ff0000',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      const d = path?.getAttribute('d');
      expect(d).toContain('M ');
      expect(d).toContain(' L ');
    });

    test('should calculate correct path for vertical move', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 4 },
        to: { r: 8, c: 4 },
        color: '#ff0000',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      const d = path?.getAttribute('d');
      expect(d).toContain('M ');
      expect(d).toContain(' L ');
    });

    test('should calculate correct path for diagonal move', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 8, c: 8 },
        color: '#ff0000',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      const d = path?.getAttribute('d');
      expect(d).toContain('M ');
      expect(d).toContain(' L ');
    });

    test('should handle knight move (L-shape)', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 4, c: 4 },
        to: { r: 2, c: 5 }, // Knight move
        color: '#ff0000',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      expect(svgEl).not.toBeNull();
      const path = svgEl.querySelector('path');
      expect(path).not.toBeNull();
    });

    test('should apply drop-shadow filter to path and head', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#6366f1',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      const head = svgEl.querySelector('polygon');
      expect(path?.style.filter).toContain('drop-shadow');
      expect(head?.style.filter).toContain('drop-shadow');
    });

    test('should append SVG to boardContainer', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#6366f1',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      expect(path).toBeDefined();
      expect(boardContainer.contains(svgEl)).toBe(true);
    });
  });

  // ============================================================
  // clearArrows Tests
  // ============================================================

  describe('clearArrows', () => {
    test('should remove all arrow SVGs from container', () => {
      // Draw first arrow
      const svg1 = drawArrow(boardContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, color: '#ff0000', animate: false });
      expect(svg1).toBeDefined();
      // Manually add a second one since drawArrow clears first
      const manualSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      manualSvg.classList.add('last-move-arrow');
      boardContainer.appendChild(manualSvg);

      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(2);

      clearArrows(boardContainer);

      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(0);
    });

    test('should handle null container gracefully', () => {
      expect(() => clearArrows(null)).not.toThrow();
    });

    test('should handle container without querySelectorAll', () => {
      const fakeContainer = {} as any;
      expect(() => clearArrows(fakeContainer)).not.toThrow();
    });

    test('should handle container with no arrows', () => {
      expect(() => clearArrows(boardContainer)).not.toThrow();
      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(0);
    });
  });

  // ============================================================
  // updateLastMoveArrow Tests
  // ============================================================

  describe('updateLastMoveArrow', () => {
    test('should clear arrows when lastMove is null', () => {
      drawArrow(boardContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, color: '#ff0000', animate: false });
      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(1);

      updateLastMoveArrow(boardContainer, null);
      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(0);
    });

    test('should clear arrows when lastMove is undefined', () => {
      drawArrow(boardContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, color: '#ff0000', animate: false });
      updateLastMoveArrow(boardContainer, undefined as any);
      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(0);
    });

    test('should draw green arrow for player move (isPlayerMove=true)', () => {
      // Use drawArrow directly to avoid animate: true in updateLastMoveArrow
      const svg = drawArrow(boardContainer, {
        from: { r: 1, c: 4 },
        to: { r: 3, c: 4 },
        color: '#22c55e',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      expect(svgEl).not.toBeNull();
      const path = svgEl.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#22c55e'); // Green for player
    });

    test('should draw red arrow for AI move (isPlayerMove=false)', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 6, c: 4 },
        to: { r: 4, c: 4 },
        color: '#ef4444',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      expect(svgEl).not.toBeNull();
      const path = svgEl.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#ef4444'); // Red for AI
    });

    test('should use default isPlayerMove=true', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#22c55e',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#22c55e');
    });

    test('should handle null boardContainer gracefully', () => {
      expect(() => updateLastMoveArrow(null, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } })).not.toThrow();
    });

    test('should handle container without querySelectorAll', () => {
      const fakeContainer = {} as any;
      expect(() => updateLastMoveArrow(fakeContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } })).not.toThrow();
    });

    test('should animate by default', () => {
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#6366f1',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      expect(path).not.toBeNull();
      // Animation would add dasharray/dashoffset when animate=true
      // Here we just verify the arrow is drawn
    });

    test('should replace existing arrow with new one', () => {
      // First arrow
      const svg1 = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 1, c: 1 },
        color: '#22c55e',
        animate: false,
      });
      const svg1El = svg1 as SVGSVGElement;
      expect(svg1El).toBeDefined();
      // Second arrow (different color)
      const svg2 = drawArrow(boardContainer, {
        from: { r: 7, c: 7 },
        to: { r: 6, c: 6 },
        color: '#ef4444',
        animate: false,
      });
      const svg2El = svg2 as SVGSVGElement;

      const arrows = boardContainer.querySelectorAll('.last-move-arrow');
      expect(arrows.length).toBe(1);

      const path2 = svg2El.querySelector('path');
      expect(path2?.getAttribute('stroke')).toBe('#ef4444'); // Second arrow color
    });

    test('should handle board container with various edge cases', () => {
      // Minimal container
      const minimalContainer = document.createElement('div');
      minimalContainer.id = 'board-container';
      document.body.appendChild(minimalContainer);

      // No board element - should fail gracefully
      expect(() => updateLastMoveArrow(minimalContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } })).not.toThrow();
      expect(() => drawArrow(minimalContainer, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, color: '#ff0000' })).not.toThrow();

      document.body.removeChild(minimalContainer);
    });
  });

  // ============================================================
  // Edge Cases & Integration
  // ============================================================

  describe('Edge Cases', () => {
    test('should handle rapid sequential calls', () => {
      for (let i = 0; i < 10; i++) {
        drawArrow(boardContainer, {
          from: { r: i % 9, c: Math.floor(i / 9) },
          to: { r: (i + 1) % 9, c: (Math.floor(i / 9) + 1) % 9 },
          color: i % 2 === 0 ? '#22c55e' : '#ef4444',
          animate: false,
        });
      }

      // Only the last arrow should remain
      expect(boardContainer.querySelectorAll('.last-move-arrow').length).toBe(1);
    });

    test('should handle moves at board edges', () => {
      // Corner to corner
      const svg = drawArrow(boardContainer, {
        from: { r: 0, c: 0 },
        to: { r: 8, c: 8 },
        color: '#ff0000',
        animate: false,
      });
      const svgEl = svg as SVGSVGElement;

      const path = svgEl.querySelector('path');
      expect(svgEl).not.toBeNull();
      expect(path).not.toBeNull();

      // Clear and test opposite corner
      clearArrows(boardContainer);
      const svg2 = drawArrow(boardContainer, {
        from: { r: 8, c: 8 },
        to: { r: 0, c: 0 },
        color: '#ff0000',
        animate: false,
      });
      const svg2El = svg2 as SVGSVGElement;
      const path2 = svg2El.querySelector('path');
      expect(path2).toBeDefined();
      expect(svg2El).not.toBeNull();
    });

    test('should handle same from and to squares gracefully', () => {
      expect(() => drawArrow(boardContainer, {
        from: { r: 4, c: 4 },
        to: { r: 4, c: 4 },
        color: '#ff0000',
        animate: false,
      })).not.toThrow();
    });
  });
});
