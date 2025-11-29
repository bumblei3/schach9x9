/**
 * Tests for Arrow Renderer
 * @jest-environment jsdom
 */

import { ArrowRenderer } from '../js/arrows.js';

describe('ArrowRenderer', () => {
  let boardElement;
  let renderer;

  beforeEach(() => {
    // Create mock board element
    document.body.innerHTML = `
      <div id="test-container" style="position: relative; width: 576px; height: 576px;">
        <div id="board"></div>
      </div>
    `;
    boardElement = document.getElementById('board');

    // Add mock cells
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = '64px';
        cell.style.height = '64px';
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Mock offsetWidth property (jsdom doesn't calculate layout)
        Object.defineProperty(cell, 'offsetWidth', {
          configurable: true,
          value: 64,
        });
        Object.defineProperty(cell, 'offsetHeight', {
          configurable: true,
          value: 64,
        });

        boardElement.appendChild(cell);
      }
    }

    renderer = new ArrowRenderer(boardElement);
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should create SVG layer on initialization', () => {
      const svgLayer = document.getElementById('arrow-layer');
      expect(svgLayer).toBeTruthy();
      expect(svgLayer.tagName).toBe('svg');
    });

    test('should calculate cell size from board cells', () => {
      expect(renderer.cellSize).toBe(64);
    });

    test('should create arrowhead markers for each quality', () => {
      const goldMarker = document.getElementById('arrowhead-gold');
      const silverMarker = document.getElementById('arrowhead-silver');
      const bronzeMarker = document.getElementById('arrowhead-bronze');

      expect(goldMarker).toBeTruthy();
      expect(silverMarker).toBeTruthy();
      expect(bronzeMarker).toBeTruthy();
    });

    test('should position SVG layer absolutely', () => {
      const svgLayer = renderer.svgLayer;
      expect(svgLayer.style.position).toBe('absolute');
      expect(svgLayer.style.top).toBe('0px');
      expect(svgLayer.style.left).toBe('0px');
    });
  });

  describe('Drawing Arrows', () => {
    test('should draw arrow from one square to another', () => {
      renderer.drawArrow(0, 0, 2, 2, 'gold');

      const arrows = renderer.svgLayer.querySelectorAll('.tutor-arrow');
      expect(arrows.length).toBe(1);
    });

    test('should draw arrows with correct color based on quality', () => {
      renderer.drawArrow(0, 0, 1, 1, 'gold');
      renderer.drawArrow(1, 1, 2, 2, 'silver');
      renderer.drawArrow(2, 2, 3, 3, 'bronze');

      const arrows = renderer.svgLayer.querySelectorAll('.tutor-arrow');
      expect(arrows.length).toBe(3);

      // Check stroke colors
      expect(arrows[0].getAttribute('stroke')).toBe('#FFD700'); // Gold
      expect(arrows[1].getAttribute('stroke')).toBe('#C0C0C0'); // Silver
      expect(arrows[2].getAttribute('stroke')).toBe('#CD7F32'); // Bronze
    });

    test('should use correct marker-end for arrow quality', () => {
      renderer.drawArrow(0, 0, 1, 1, 'gold');

      const arrow = renderer.svgLayer.querySelector('.tutor-arrow');
      expect(arrow.getAttribute('marker-end')).toBe('url(#arrowhead-gold)');
    });

    test('should default to gold quality if not specified', () => {
      renderer.drawArrow(0, 0, 1, 1);

      const arrow = renderer.svgLayer.querySelector('.tutor-arrow');
      expect(arrow.getAttribute('stroke')).toBe('#FFD700');
    });
  });

  describe('Clearing Arrows', () => {
    test('should clear all arrows from SVG layer', () => {
      renderer.drawArrow(0, 0, 1, 1, 'gold');
      renderer.drawArrow(1, 1, 2, 2, 'silver');

      expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(2);

      renderer.clearArrows();

      expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(0);
    });

    test('should not throw error when clearing empty arrows', () => {
      expect(() => renderer.clearArrows()).not.toThrow();
    });
  });

  describe('Highlight Move', () => {
    test('should clear previous arrows and draw new one', () => {
      renderer.highlightMove(0, 0, 1, 1, 'gold');
      expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(1);

      renderer.highlightMove(2, 2, 3, 3, 'silver');
      expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(1);

      const arrow = renderer.svgLayer.querySelector('.tutor-arrow');
      expect(arrow.getAttribute('stroke')).toBe('#C0C0C0'); // Silver
    });

    test('should store last arrow for redraw', () => {
      renderer.highlightMove(0, 0, 1, 1, 'gold');

      expect(renderer.lastArrow).toEqual({
        fromR: 0,
        fromC: 0,
        toR: 1,
        toC: 1,
        quality: 'gold',
      });
    });
  });

  describe('Redraw', () => {
    test('should redraw last arrow after cell size update', () => {
      renderer.highlightMove(0, 0, 1, 1, 'gold');

      // Change cell size
      const cells = boardElement.querySelectorAll('.cell');
      cells.forEach(cell => {
        cell.style.width = '80px';
        cell.style.height = '80px';
        // Update mock offsetWidth
        Object.defineProperty(cell, 'offsetWidth', {
          configurable: true,
          value: 80,
        });
      });

      renderer.redraw();

      expect(renderer.cellSize).toBe(80);
      const arrows = renderer.svgLayer.querySelectorAll('.tutor-arrow');
      expect(arrows.length).toBe(1); // Should still have one arrow
    });

    test('should not throw error when redrawing with no last arrow', () => {
      expect(() => renderer.redraw()).not.toThrow();
    });
  });

  describe('Destroy', () => {
    test('should remove SVG layer from DOM', () => {
      const svgLayer = renderer.svgLayer;
      expect(document.body.contains(svgLayer)).toBe(true);

      renderer.destroy();

      expect(document.body.contains(svgLayer)).toBe(false);
    });

    test('should not throw error when destroying already destroyed renderer', () => {
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('Coordinate Calculations', () => {
    test('should calculate correct center positions for arrows', () => {
      // Cell size is 64px, so center of (0,0) should be at (32, 32)
      renderer.drawArrow(0, 0, 1, 0, 'gold');

      const arrow = renderer.svgLayer.querySelector('.tutor-arrow');
      const path = arrow.getAttribute('d');

      // Path should contain coordinates around the center of cells
      expect(path).toContain('M');
      expect(path).toContain('L');
    });
  });
});
