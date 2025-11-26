/**
 * Arrow Renderer for chess board
 * Draws SVG arrows to show move suggestions
 */
export class ArrowRenderer {
  constructor(boardElement) {
    this.boardElement = boardElement;
    this.updateCellSize();
    this.svgLayer = this.createSVGLayer();
    this.createArrowheadMarkers();
  }

  updateCellSize() {
    // Get cell size from the first cell or compute it
    const firstCell = this.boardElement.querySelector('.cell');
    if (firstCell) {
      this.cellSize = firstCell.offsetWidth;
    } else {
      // Fallback if no cells yet
      this.cellSize = 64;
    }
  }

  createSVGLayer() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'arrow-layer';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none'; // Don't block clicks
    svg.style.zIndex = '5';

    // Make parent relative for absolute positioning
    const parent = this.boardElement.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      parent.appendChild(svg);
    }

    return svg;
  }

  createArrowheadMarkers() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Create markers for each quality level
    const colors = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
    };

    Object.entries(colors).forEach(([name, color]) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrowhead-${name}`);
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 10 3, 0 6');
      polygon.setAttribute('fill', color);

      marker.appendChild(polygon);
      defs.appendChild(marker);
    });

    this.svgLayer.appendChild(defs);
  }

  drawArrow(fromR, fromC, toR, toC, quality = 'gold') {
    // Calculate center positions of cells
    const fromX = fromC * this.cellSize + this.cellSize / 2;
    const fromY = fromR * this.cellSize + this.cellSize / 2;
    const toX = toC * this.cellSize + this.cellSize / 2;
    const toY = toR * this.cellSize + this.cellSize / 2;

    // Shorten arrow so it doesn't overlap pieces
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const shortenBy = this.cellSize * 0.25; // 25% shorter on each end

    const adjustedFromX = fromX + Math.cos(angle) * shortenBy;
    const adjustedFromY = fromY + Math.sin(angle) * shortenBy;
    const adjustedToX = toX - Math.cos(angle) * shortenBy;
    const adjustedToY = toY - Math.sin(angle) * shortenBy;

    // Create path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${adjustedFromX} ${adjustedFromY} L ${adjustedToX} ${adjustedToY}`);

    const colors = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
    };

    path.setAttribute('stroke', colors[quality] || colors.gold);
    path.setAttribute('stroke-width', '5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#arrowhead-${quality})`);
    path.setAttribute('opacity', '0.9');
    path.classList.add('tutor-arrow');

    // Add glow effect
    path.style.filter = `drop-shadow(0 0 4px ${colors[quality]})`;

    this.svgLayer.appendChild(path);
  }

  clearArrows() {
    const arrows = this.svgLayer.querySelectorAll('.tutor-arrow');
    arrows.forEach(arrow => arrow.remove());
  }

  highlightMove(fromR, fromC, toR, toC, quality = 'gold') {
    this.lastArrow = { fromR, fromC, toR, toC, quality };
    this.clearArrows();
    this.drawArrow(fromR, fromC, toR, toC, quality);
  }

  redraw() {
    this.updateCellSize();
    if (this.lastArrow) {
      this.clearArrows(); // Clear existing to avoid duplicates
      this.drawArrow(
        this.lastArrow.fromR,
        this.lastArrow.fromC,
        this.lastArrow.toR,
        this.lastArrow.toC,
        this.lastArrow.quality
      );
    }
  }

  destroy() {
    if (this.svgLayer && this.svgLayer.parentElement) {
      this.svgLayer.parentElement.removeChild(this.svgLayer);
    }
  }
}
