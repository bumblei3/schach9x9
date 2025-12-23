import { jest } from '@jest/globals';

const { ArrowRenderer } = await import('../js/arrows.js');

describe('ArrowRenderer', () => {
  let boardElement;
  let renderer;

  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = `
            <div id="board-container">
                <div id="board">
                    <div class="cell" style="width: 64px; height: 64px;"></div>
                </div>
            </div>
        `;
    boardElement = document.getElementById('board');
    // Mock offsetWidth as JSDOM doesn't layout
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 64 });

    renderer = new ArrowRenderer(boardElement);
  });

  afterEach(() => {
    renderer.destroy();
  });

  test('should initialize and create SVG layer', () => {
    const svg = document.getElementById('arrow-layer');
    expect(svg).toBeDefined();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(boardElement.parentElement.style.position).toBe('relative');
  });

  test('should create arrowhead markers in defs', () => {
    const defs = renderer.svgLayer.querySelector('defs');
    expect(defs).toBeDefined();
    const markers = defs.querySelectorAll('marker');
    expect(markers.length).toBe(3); // gold, silver, bronze
    expect(markers[0].id).toBe('arrowhead-gold');
  });

  test('drawArrow should create a path with correct attributes', () => {
    renderer.drawArrow(0, 0, 1, 1, 'gold');
    const path = renderer.svgLayer.querySelector('.tutor-arrow');
    expect(path).toBeDefined();
    expect(path.getAttribute('stroke')).toBe('#FFD700');
    expect(path.getAttribute('marker-end')).toBe('url(#arrowhead-gold)');
    expect(path.getAttribute('d')).toContain('M');
    expect(path.getAttribute('d')).toContain('L');
  });

  test('clearArrows should remove all arrow paths', () => {
    renderer.drawArrow(0, 0, 2, 2);
    renderer.drawArrow(1, 1, 3, 3);
    expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(2);

    renderer.clearArrows();
    expect(renderer.svgLayer.querySelectorAll('.tutor-arrow').length).toBe(0);
  });

  test('highlightMove should clear previous and draw new arrow', () => {
    renderer.highlightMove(0, 0, 1, 1, 'silver');
    expect(renderer.lastArrow).toEqual({ fromR: 0, fromC: 0, toR: 1, toC: 1, quality: 'silver' });

    renderer.highlightMove(2, 2, 3, 3, 'gold');
    const arrows = renderer.svgLayer.querySelectorAll('.tutor-arrow');
    expect(arrows.length).toBe(1);
    expect(arrows[0].getAttribute('stroke')).toBe('#FFD700');
  });

  test('redraw should refresh the current arrow', () => {
    renderer.highlightMove(0, 0, 1, 1, 'bronze');
    const initialPath = renderer.svgLayer.querySelector('.tutor-arrow');

    renderer.redraw();
    const newPath = renderer.svgLayer.querySelector('.tutor-arrow');
    expect(newPath).not.toBe(initialPath);
    expect(newPath.getAttribute('stroke')).toBe('#CD7F32');
  });

  test('destroy should remove the SVG layer', () => {
    renderer.destroy();
    expect(document.getElementById('arrow-layer')).toBeNull();
  });

  test('updateCellSize should handle missing cells', () => {
    document.body.innerHTML = '<div id="board"></div>';
    renderer.boardElement = document.getElementById('board');
    renderer.updateCellSize();
    expect(renderer.cellSize).toBe(64); // Fallback
  });
});
